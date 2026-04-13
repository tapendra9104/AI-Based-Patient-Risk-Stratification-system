"""
============================================
RAG SERVICE — Retrieval Augmented Generation
============================================

Purpose: Makes the AI smarter by giving it relevant medical knowledge
         BEFORE it analyzes a patient.

What is RAG (Retrieval Augmented Generation)?
=============================================
Imagine you're a doctor. Before diagnosing a patient, you might
look up their symptoms in a medical textbook. RAG does exactly this:

1. STORE: We take medical documents and convert them into
   "embeddings" (numerical representations) and store them in FAISS.

2. RETRIEVE: When a patient comes in, we convert their data into
   an embedding and find the most RELEVANT medical knowledge.

3. AUGMENT: We add this relevant knowledge to the prompt we send
   to the LLM, so it has expert context for its analysis.

Without RAG:  LLM sees only patient data → generic response
With RAG:     LLM sees patient data + relevant medical guidelines → expert response

Components:
- Sentence Transformers: Converts text to embeddings (vectors)
- FAISS: Facebook's fast similarity search library for finding relevant docs
"""

import os
import logging
from typing import List

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAGService — Manages the medical knowledge base and retrieval.

    Think of this as a smart medical library:
    - It reads all our medical documents
    - Converts them into searchable format (embeddings)
    - When asked, finds the most relevant information for a patient
    """

    def __init__(self):
        """Initialize the RAG service."""
        self.is_initialized = False
        self.documents = []           # Raw text chunks from medical docs
        self.embeddings_model = None  # Model that converts text → vectors
        self.index = None             # FAISS index for fast similarity search
        self.knowledge_dir = os.path.join(os.path.dirname(__file__), "..", "knowledge_base")

    def initialize(self):
        """
        Initialize the RAG system:
        1. Load medical documents from the knowledge_base folder
        2. Split them into smaller chunks (for better retrieval)
        3. Create embeddings for each chunk
        4. Build a FAISS index for fast searching
        """
        try:
            logger.info("📚 Initializing RAG system...")

            # ---- Step 1: Load and chunk documents ----
            self.documents = self._load_documents()

            if not self.documents:
                logger.warning("⚠️  No documents found in knowledge_base/")
                self.is_initialized = False
                return

            logger.info(f"   Loaded {len(self.documents)} text chunks")

            # ---- Step 2: Load the embedding model ----
            # This model converts text into 384-dimensional vectors
            # all-MiniLM-L6-v2 is small (80MB) but accurate
            from sentence_transformers import SentenceTransformer

            model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
            logger.info(f"   Loading embedding model: {model_name}")
            self.embeddings_model = SentenceTransformer(model_name)

            # ---- Step 3: Create embeddings for all documents ----
            logger.info("   Creating embeddings for medical documents...")
            document_embeddings = self.embeddings_model.encode(
                self.documents,
                show_progress_bar=True,
                convert_to_numpy=True
            )

            # ---- Step 4: Build the FAISS index ----
            import faiss
            import numpy as np

            # Get the dimension of our embeddings (384 for MiniLM)
            dimension = document_embeddings.shape[1]

            # Create a flat L2 index (simple but effective for small datasets)
            # L2 = Euclidean distance (lower = more similar)
            self.index = faiss.IndexFlatL2(dimension)

            # Add all document embeddings to the index
            self.index.add(document_embeddings.astype(np.float32))

            self.is_initialized = True
            logger.info(f"✅ RAG system ready! Index contains {self.index.ntotal} vectors")

        except ImportError as import_error:
            logger.warning(f"⚠️  RAG dependencies not installed: {import_error}")
            logger.warning("   Install with: pip install sentence-transformers faiss-cpu")
            self.is_initialized = False

        except Exception as error:
            logger.error(f"❌ Failed to initialize RAG: {error}")
            self.is_initialized = False

    def _load_documents(self) -> List[str]:
        """
        Load all .txt files from the knowledge_base directory
        and split them into smaller chunks.

        Why split into chunks?
        - Smaller chunks = more precise retrieval
        - The LLM gets only the most relevant paragraph,
          not an entire document
        """
        chunks = []

        if not os.path.exists(self.knowledge_dir):
            logger.warning(f"⚠️  Knowledge base directory not found: {self.knowledge_dir}")
            return chunks

        # Read every .txt file in the knowledge_base folder
        for filename in os.listdir(self.knowledge_dir):
            if filename.endswith(".txt"):
                filepath = os.path.join(self.knowledge_dir, filename)
                logger.info(f"   Reading: {filename}")

                with open(filepath, "r", encoding="utf-8") as file:
                    content = file.read()

                # Split the document into chunks by double newlines
                # Each chunk is roughly a "section" of the document
                raw_chunks = content.split("\n\n")

                for chunk in raw_chunks:
                    cleaned = chunk.strip()
                    # Only keep chunks that have meaningful content (> 50 chars)
                    if len(cleaned) > 50:
                        chunks.append(cleaned)

        return chunks

    def retrieve_context(self, query: str, top_k: int = 3) -> str:
        """
        Find the most relevant medical knowledge for a given query.

        Parameters:
            query (str): The text to search for (e.g., patient symptoms)
            top_k (int): How many relevant chunks to return (default: 3)

        Returns:
            str: Concatenated relevant medical text to use as LLM context

        How it works:
        1. Convert the query text into an embedding vector
        2. Search the FAISS index for the closest document vectors
        3. Return those documents as context text
        """
        if not self.is_initialized:
            logger.warning("⚠️  RAG not initialized — returning empty context")
            return ""

        try:
            import numpy as np

            # Convert query to embedding vector
            query_embedding = self.embeddings_model.encode([query])
            query_vector = np.array(query_embedding).astype(np.float32)

            # Search FAISS index for the top_k most similar documents
            # distances = how far away each result is (lower = more relevant)
            # indices = which documents matched (array positions)
            distances, indices = self.index.search(query_vector, top_k)

            # Collect the matching documents
            relevant_chunks = []
            for i, idx in enumerate(indices[0]):
                if idx < len(self.documents):
                    relevant_chunks.append(self.documents[idx])
                    logger.debug(f"   RAG match #{i+1} (distance: {distances[0][i]:.2f})")

            # Join all relevant chunks into one context string
            context = "\n\n---\n\n".join(relevant_chunks)

            logger.info(f"📎 RAG retrieved {len(relevant_chunks)} relevant chunks ({len(context)} chars)")
            return context

        except Exception as error:
            logger.error(f"❌ RAG retrieval failed: {error}")
            return ""


# Create a global instance (singleton pattern)
# This means we only load the model and build the index ONCE,
# not on every request (which would be very slow)
rag_service = RAGService()
