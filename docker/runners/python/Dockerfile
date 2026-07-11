FROM python:3.13-slim

RUN mkdir -p /cache && pip install --no-cache-dir pip

# RunFlow SDK pre-installed for runflow_sdk result parser
COPY packages/python-sdk /tmp/runflow-sdk
RUN pip install --no-cache-dir /tmp/runflow-sdk && rm -rf /tmp/runflow-sdk

WORKDIR /runflow
CMD ["python"]
