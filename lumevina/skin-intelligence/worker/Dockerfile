# The Lumevina Skin Intelligence worker. Small, CPU only.
#   docker build -t lumevina-skin-worker .
#   docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... lumevina-skin-worker
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# MediaPipe's face landmark model, pinned; its SHA-256 is checked so a changed file fails the build
ARG FACE_MODEL_URL=https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
ARG FACE_MODEL_SHA256="64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
RUN mkdir -p /models && curl -fsSL "$FACE_MODEL_URL" -o /models/face_landmarker.task \
 && if [ -n "$FACE_MODEL_SHA256" ]; then echo "$FACE_MODEL_SHA256  /models/face_landmarker.task" | sha256sum -c -; fi
ENV LUMEVINA_FACE_MODEL=/models/face_landmarker.task PYTHONUNBUFFERED=1
COPY lumevina_skin ./lumevina_skin
COPY run.py .
USER 1000
CMD ["python", "run.py"]
