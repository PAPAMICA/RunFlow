FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
COPY packages/runflow-shared packages/runflow-shared
COPY apps/api apps/api
COPY migrations migrations
COPY alembic.ini .

RUN uv sync --package runflow-api

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/api"

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn runflow_api.main:app --host 0.0.0.0 --port 8000"]
