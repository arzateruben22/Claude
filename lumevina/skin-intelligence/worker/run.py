#!/usr/bin/env python3
"""Lumevina Skin Intelligence worker: takes jobs from analysis_jobs and runs them.

  SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  LUMEVINA_FACE_MODEL=/models/face_landmarker.task  python run.py

  --once     run what is queued now, then stop (for a scheduled run)
  --idle N   seconds to wait when the queue is empty (default 5)

It only reaches out to Supabase (rows over PostgREST, images in the private
skin-images bucket); it has no public endpoint and calls no AI service.
"""

import argparse
import logging
import os
import signal
import socket
import time

from lumevina_skin import ALGORITHM_VERSION
from lumevina_skin.jobs import run_one
from lumevina_skin.store import SupabaseStore


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--idle", type=float, default=5.0)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    worker = f"{socket.gethostname()}:{os.getpid()}"
    store = SupabaseStore()
    stop = {"now": False}
    signal.signal(signal.SIGTERM, lambda *_: stop.update(now=True))
    signal.signal(signal.SIGINT, lambda *_: stop.update(now=True))
    logging.info("worker %s, %s", worker, ALGORITHM_VERSION)
    while not stop["now"]:
        try:
            job = run_one(store, worker)
        except Exception as e:  # Supabase unreachable: wait and try again
            logging.warning("queue: %s", e)
            time.sleep(min(60, args.idle * 4))
            continue
        if job is None:
            if args.once:
                break
            time.sleep(args.idle)
            continue
        if job.get("error"):
            logging.warning("job %s %s failed: %s", job["id"], job["kind"], job["error"])
        else:
            logging.info("job %s %s done", job["id"], job["kind"])


if __name__ == "__main__":
    main()
