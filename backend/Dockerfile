FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Create non-root user
RUN groupadd -r copilot && useradd -r -g copilot -m -d /home/copilot copilot

WORKDIR /app

# Copy dependency specifications first for layer caching
COPY pyproject.toml uv.lock README.md /app/

# Install dependencies into virtualenv
RUN uv sync --frozen --no-dev

# Copy application source code
COPY app /app/app
COPY migrations /app/migrations
COPY alembic.ini /app/

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && chown -R copilot:copilot /app

USER copilot

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

