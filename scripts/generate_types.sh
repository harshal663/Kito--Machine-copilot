#!/usr/bin/env bash
set -euo pipefail

echo "Exporting OpenAPI schema from FastAPI backend..."
uv run python scripts/export_openapi.py

echo "Generating TypeScript types for Next.js frontend..."
cd frontend
npm run generate-types

echo "✓ Frontend API types updated in frontend/src/types/api.generated.ts"

