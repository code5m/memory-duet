FROM python:3.12-slim
WORKDIR /app
RUN useradd --uid 10001 --create-home duet && mkdir -p /app/data && chown duet:duet /app/data
COPY server.py /app/server.py
COPY web /app/web
ENV PYTHONDONTWRITEBYTECODE=1
ENV MEMORY_DUET_HOST=0.0.0.0
ENV MEMORY_DUET_PORT=8765
USER duet
EXPOSE 8765
CMD ["python3","server.py"]
