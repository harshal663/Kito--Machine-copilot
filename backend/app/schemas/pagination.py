"""Generic cursor pagination schema per ARCHITECTURE.md §3.1."""

from pydantic import BaseModel


class Page[T](BaseModel):
    """Cursor-paginated container."""

    items: list[T]
    next_cursor: str | None = None
