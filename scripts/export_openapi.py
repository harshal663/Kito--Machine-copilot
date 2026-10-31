"""Export OpenAPI specification to docs/openapi.json."""

import json
from pathlib import Path
import sys

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))

from app.main import app  # noqa: E402


def export_openapi() -> None:
    """Generate OpenAPI schema and write to docs/openapi.json."""
    output_path = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    openapi_schema = app.openapi()

    with open(output_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(openapi_schema, f, indent=2)
        f.write("\n")

    print(f"OpenAPI spec successfully exported to {output_path}")


if __name__ == "__main__":
    export_openapi()
