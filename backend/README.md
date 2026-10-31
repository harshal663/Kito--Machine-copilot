# Machine Copilot Backend

Backend API and background worker for the Proactive Edge-to-Voice Machine Copilot.

## Requirements
- Python >=3.12, <3.13
- PostgreSQL with `pgvector`
- Redis

## Development
```bash
uv sync
uv run uvicorn app.main:app --reload
```

