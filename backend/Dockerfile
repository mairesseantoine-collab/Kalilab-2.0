# KaliLab Backend - ISO 15189 SMQ
# Multi-stage build: builder + slim runtime

# ---- Builder stage ----
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ---- Runtime stage ----
FROM python:3.11-slim

LABEL maintainer="KaliLab SMQ <admin@kalilab.be>"
LABEL description="KaliLab ISO 15189 Quality Management System - Backend API"
LABEL version="1.0.0"

WORKDIR /app

# Runtime system dependencies (libpq for asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Create non-root user for security
RUN addgroup --system kalilab && \
    adduser --system --ingroup kalilab --no-create-home kalilab && \
    chown -R kalilab:kalilab /app

USER kalilab

# Environment defaults (override with docker run -e or docker-compose)
ENV DATABASE_URL="postgresql+asyncpg://kalilab:kalilab@db:5432/kalilab" \
    SECRET_KEY="change-me-in-production-use-openssl-rand-hex-32" \
    ALGORITHM="HS256" \
    ACCESS_TOKEN_EXPIRE_MINUTES="60" \
    S3_ENDPOINT="http://minio:9000" \
    S3_BUCKET="kalilab-docs" \
    S3_ACCESS_KEY="minioadmin" \
    S3_SECRET_KEY="minioadmin" \
    PYTHONDONTWRITEBYTECODE="1" \
    PYTHONUNBUFFERED="1"

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
