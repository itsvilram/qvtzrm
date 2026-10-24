# Backend API: FastAPI + pandas, serving /api on port 8000.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first, so code changes don't reinstall them.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ app/
COPY data/ data/

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# The slim image has no curl, so the healthcheck uses Python.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
