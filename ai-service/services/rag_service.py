"""
RAG service for loading the local knowledge base and retrieving context.
"""

import logging
import os
from threading import Lock, Thread
from typing import List

logger = logging.getLogger(__name__)


class RAGService:
    """Manage the medical knowledge base and semantic retrieval."""

    def __init__(self):
        self.is_initialized = False
        self.documents: List[str] = []
        self.embeddings_model = None
        self.index = None
        self.last_error = None
        self._init_lock = Lock()
        self._init_thread = None
        self.knowledge_dir = os.path.join(
            os.path.dirname(__file__),
            "..",
            "knowledge_base",
        )

    def get_status(self) -> str:
        """Return a short status string for health checks and logs."""
        if self.is_initialized:
            return "ready"
        if self._init_thread and self._init_thread.is_alive():
            return "initializing"
        if self.last_error:
            return "failed"
        return "not_initialized"

    def start_background_initialization(self) -> bool:
        """
        Start RAG initialization without blocking app startup.

        This lets the service return 200 from /health quickly on platforms such
        as Render while the embedding model loads in the background.
        """
        if self.is_initialized:
            return False
        if self._init_thread and self._init_thread.is_alive():
            return False

        self._init_thread = Thread(
            target=self.initialize,
            name="rag-service-init",
            daemon=True,
        )
        self._init_thread.start()
        return True

    def initialize(self):
        """Load documents, build embeddings, and create the FAISS index."""
        with self._init_lock:
            if self.is_initialized:
                return

            self.last_error = None
            self.documents = []
            self.embeddings_model = None
            self.index = None
            self.is_initialized = False

            try:
                logger.info("Initializing RAG system...")

                self.documents = self._load_documents()
                if not self.documents:
                    self.last_error = "No documents found in knowledge_base/"
                    logger.warning(self.last_error)
                    return

                logger.info("Loaded %s text chunks", len(self.documents))

                from sentence_transformers import SentenceTransformer

                model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
                logger.info("Loading embedding model: %s", model_name)
                self.embeddings_model = SentenceTransformer(model_name)

                logger.info("Creating embeddings for medical documents...")
                document_embeddings = self.embeddings_model.encode(
                    self.documents,
                    show_progress_bar=True,
                    convert_to_numpy=True,
                )

                import faiss
                import numpy as np

                dimension = document_embeddings.shape[1]
                self.index = faiss.IndexFlatL2(dimension)
                self.index.add(document_embeddings.astype(np.float32))

                self.is_initialized = True
                logger.info(
                    "RAG system ready. Index contains %s vectors",
                    self.index.ntotal,
                )

            except ImportError as import_error:
                self.last_error = str(import_error)
                logger.warning("RAG dependencies not installed: %s", import_error)
                logger.warning(
                    "Install with: pip install sentence-transformers faiss-cpu"
                )

            except Exception as error:
                self.last_error = str(error)
                logger.error("Failed to initialize RAG: %s", error)

            finally:
                self._init_thread = None

    def _load_documents(self) -> List[str]:
        """Load all knowledge-base text files and split them into chunks."""
        chunks: List[str] = []

        if not os.path.exists(self.knowledge_dir):
            logger.warning(
                "Knowledge base directory not found: %s",
                self.knowledge_dir,
            )
            return chunks

        for filename in os.listdir(self.knowledge_dir):
            if not filename.endswith(".txt"):
                continue

            filepath = os.path.join(self.knowledge_dir, filename)
            logger.info("Reading knowledge file: %s", filename)

            with open(filepath, "r", encoding="utf-8") as file:
                content = file.read()

            raw_chunks = content.split("\n\n")
            for chunk in raw_chunks:
                cleaned = chunk.strip()
                if len(cleaned) > 50:
                    chunks.append(cleaned)

        return chunks

    def retrieve_context(self, query: str, top_k: int = 3) -> str:
        """Find the most relevant knowledge-base chunks for a query."""
        if not self.is_initialized:
            if self.get_status() == "not_initialized":
                self.start_background_initialization()
            logger.info("RAG not ready yet (%s); returning empty context", self.get_status())
            return ""

        try:
            import numpy as np

            query_embedding = self.embeddings_model.encode([query])
            query_vector = np.array(query_embedding).astype(np.float32)
            distances, indices = self.index.search(query_vector, top_k)

            relevant_chunks = []
            for i, idx in enumerate(indices[0]):
                if idx < len(self.documents):
                    relevant_chunks.append(self.documents[idx])
                    logger.debug(
                        "RAG match #%s (distance: %.2f)",
                        i + 1,
                        distances[0][i],
                    )

            context = "\n\n---\n\n".join(relevant_chunks)
            logger.info(
                "RAG retrieved %s relevant chunks (%s chars)",
                len(relevant_chunks),
                len(context),
            )
            return context

        except Exception as error:
            logger.error("RAG retrieval failed: %s", error)
            return ""


rag_service = RAGService()
