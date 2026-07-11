FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
COPY packages/runflow-shared packages/runflow-shared
COPY apps/api apps/api
COPY migrations migrations
COPY alembic.ini .

RUN uv sync --package runflow-api

COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/api"

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
