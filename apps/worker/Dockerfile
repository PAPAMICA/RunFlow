FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
COPY packages/runflow-shared packages/runflow-shared
COPY apps/worker apps/worker

RUN uv sync --package runflow-worker

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/worker"
ENV PYTHONUNBUFFERED=1

CMD ["runflow-worker", "start"]
