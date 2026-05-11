FROM python:3.11-slim

WORKDIR /app

# prophet/pystan için C++ build araçları
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ cmake make \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-deploy.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-deploy.txt

COPY . .

CMD uvicorn cache_server:app --host 0.0.0.0 --port ${PORT:-8000}
