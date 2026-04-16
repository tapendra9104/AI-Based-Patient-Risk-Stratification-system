"""
RAG service for loading the local knowledge base and retrieving context.
"""

import logging
import math
import os
import re
from collections import Counter
from threading import Lock, Thread
from typing import List

logger = logging.getLogger(__name__)

TOKEN_PATTERN = re.compile(r"[a-z0-9]{2,}")


class RAGService:
    """
    Manage the medical knowledge base and lightweight lexical retrieval.

    The original embedding-based retriever pulled in Torch, Transformers, and
    FAISS, which is too heavy for Render's free 512 MB instances. This version
    keeps retrieval local and lightweight by indexing token frequencies.
    """

    def __init__(self):
        self.is_initialized = False
        self.documents: List[str] = []
        self.document_term_counts: List[Counter[str]] = []
        self.document_lengths: List[int] = []
        self.inverse_document_frequency: dict[str, float] = {}
        self.average_document_length = 0.0
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

        Render health checks only need the process to come up, so background
        warm-up keeps the service responsive even on free-tier instances.
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
        """Load documents and build a lightweight lexical index."""
        with self._init_lock:
            if self.is_initialized:
                return

            self.last_error = None
            self.documents = []
            self.document_term_counts = []
            self.document_lengths = []
            self.inverse_document_frequency = {}
            self.average_document_length = 0.0
            self.is_initialized = False

            try:
                logger.info("Initializing lightweight RAG index...")

                self.documents = self._load_documents()
                if not self.documents:
                    self.last_error = "No documents found in knowledge_base/"
                    logger.warning(self.last_error)
                    return

                document_frequency: Counter[str] = Counter()
                for document in self.documents:
                    tokens = self._tokenize(document)
                    term_counts = Counter(tokens)
                    self.document_term_counts.append(term_counts)
                    self.document_lengths.append(sum(term_counts.values()))
                    document_frequency.update(term_counts.keys())

                document_count = len(self.documents)
                self.average_document_length = (
                    sum(self.document_lengths) / document_count if document_count else 0.0
                )
                self.inverse_document_frequency = {
                    term: math.log((document_count + 1) / (frequency + 0.5)) + 1.0
                    for term, frequency in document_frequency.items()
                }

                self.is_initialized = True
                logger.info(
                    "Lightweight RAG index ready with %s chunks",
                    document_count,
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

    def _tokenize(self, text: str) -> List[str]:
        """Split text into normalized tokens."""
        return TOKEN_PATTERN.findall(text.lower())

    def _score_document(self, query_terms: Counter[str], index: int) -> float:
        """Compute a lightweight BM25-style relevance score."""
        doc_terms = self.document_term_counts[index]
        doc_length = max(self.document_lengths[index], 1)
        average_length = max(self.average_document_length, 1.0)
        score = 0.0

        for term, query_count in query_terms.items():
            term_frequency = doc_terms.get(term, 0)
            if term_frequency == 0:
                continue

            idf = self.inverse_document_frequency.get(term, 0.0)
            numerator = term_frequency * 2.2
            denominator = term_frequency + 1.2 * (
                1 - 0.75 + 0.75 * (doc_length / average_length)
            )
            score += idf * (numerator / denominator) * query_count

        return score

    def retrieve_context(self, query: str, top_k: int = 3) -> str:
        """Find the most relevant knowledge-base chunks for a query."""
        if not self.is_initialized:
            if self.get_status() == "not_initialized":
                self.start_background_initialization()
            logger.info(
                "RAG not ready yet (%s); returning empty context",
                self.get_status(),
            )
            return ""

        query_terms = Counter(self._tokenize(query))
        if not query_terms:
            return ""

        scored_documents = []
        for index in range(len(self.documents)):
            score = self._score_document(query_terms, index)
            if score > 0:
                scored_documents.append((score, index))

        if not scored_documents:
            logger.info("RAG found no lexical matches for query")
            return ""

        scored_documents.sort(reverse=True)
        relevant_chunks = [
            self.documents[index]
            for _, index in scored_documents[:top_k]
        ]
        context = "\n\n---\n\n".join(relevant_chunks)
        logger.info(
            "RAG retrieved %s relevant chunks (%s chars)",
            len(relevant_chunks),
            len(context),
        )
        return context


rag_service = RAGService()
