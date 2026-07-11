FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-client sshpass sudo && \
    pip install --no-cache-dir ansible && rm -rf /var/lib/apt/lists/*

WORKDIR /runflow
CMD ["ansible-playbook"]
