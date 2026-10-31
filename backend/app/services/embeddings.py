"""Embedding service per ARCHITECTURE.md §4.4 and §6.1."""

import hashlib
import math
import re
from typing import Any

from app.config import settings

EMBEDDING_DIM: int = 384
_local_model: Any = None


def _embed_hash(text: str) -> list[float]:
    """Deterministic, zero-download feature-hash embedding (dim=384, L2 normalized)."""
    tokens = re.findall(r"\w+", text.lower())
    if not tokens:
        # Default unit vector along the first dimension for empty text
        vec = [0.0] * EMBEDDING_DIM
        vec[0] = 1.0
        return vec

    vec = [0.0] * EMBEDDING_DIM
    for token in tokens:
        # Use blake2b with 8-byte digest for fast, stable 64-bit integer hashing
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        val = int.from_bytes(digest, "big")
        bucket = val % EMBEDDING_DIM
        # Use top bit for +/- sign (Murmur/SimHash style feature hashing)
        sign = 1.0 if (val & (1 << 63)) == 0 else -1.0
        vec[bucket] += sign

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        return [x / norm for x in vec]
    vec[0] = 1.0
    return vec


def _get_local_model() -> Any:
    """Lazy load sentence-transformers model if local backend is selected."""
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]

        _local_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    return _local_model


def embed_text(text: str) -> list[float]:
    """Embed a single text string into a 384-dimensional vector."""
    if settings.EMBEDDING_BACKEND == "local":
        model = _get_local_model()
        result: list[float] = model.encode(text).tolist()
        return result
    return _embed_hash(text)


def embed_chunks(texts: list[str]) -> list[list[float]]:
    """Embed multiple text chunks into 384-dimensional vectors."""
    if not texts:
        return []
    if settings.EMBEDDING_BACKEND == "local":
        model = _get_local_model()
        results: list[list[float]] = model.encode(texts).tolist()
        return results
    return [_embed_hash(t) for t in texts]
