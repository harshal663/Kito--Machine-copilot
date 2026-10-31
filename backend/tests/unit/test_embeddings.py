"""Unit tests for embedding service per ARCHITECTURE.md §4.4."""

import math

from app.services.embeddings import EMBEDDING_DIM, embed_chunks, embed_text


def test_embed_dimension_and_norm() -> None:
    """Ensure embedding dimension is 384 and vector is L2 normalized."""
    text = "Vibration spike on lathe spindle bearing at 24.4 Hz"
    vec = embed_text(text)
    assert len(vec) == EMBEDDING_DIM
    norm = math.sqrt(sum(x * x for x in vec))
    assert abs(norm - 1.0) < 1e-5


def test_embed_determinism() -> None:
    """Ensure identical texts produce identical embeddings."""
    text = "Bearing temperature exceeded warning threshold"
    vec1 = embed_text(text)
    vec2 = embed_text(text)
    assert vec1 == vec2


def test_embed_distinct_texts() -> None:
    """Ensure different texts produce different vectors."""
    vec1 = embed_text("Spindle bearing wear")
    vec2 = embed_text("Hydraulic oil leakage")
    assert vec1 != vec2


def test_embed_empty_string() -> None:
    """Ensure empty or whitespace-only string returns normalized unit vector."""
    vec = embed_text("")
    assert len(vec) == EMBEDDING_DIM
    norm = math.sqrt(sum(x * x for x in vec))
    assert abs(norm - 1.0) < 1e-5


def test_embed_chunks() -> None:
    """Ensure batch embedding returns expected number of vectors."""
    texts = ["chunk 1", "chunk 2", "chunk 3"]
    vecs = embed_chunks(texts)
    assert len(vecs) == 3
    for v in vecs:
        assert len(v) == EMBEDDING_DIM
