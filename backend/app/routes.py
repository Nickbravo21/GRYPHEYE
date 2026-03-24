from __future__ import annotations

import io
import logging
import threading
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image

from .inference import process_image, process_video

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")

# Simple in-memory job store  (use Redis/Celery in production)
_jobs: Dict[str, Dict[str, Any]] = {}


# ── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "Vision Target Tracker"}


# ── Image Detection ──────────────────────────────────────────────────────────

@router.post("/detect-image")
async def detect_image(
    file: UploadFile = File(...),
    query: str = Form(...),
    use_sam: bool = Form(True),
    show_boxes: bool = Form(True),
    show_masks: bool = Form(True),
    box_threshold: float = Form(0.25),
    text_threshold: float = Form(0.25),
    high_recall: bool = Form(True),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (jpg/png).")

    data = await file.read()
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot parse image file.")

    result = process_image(
        image=image,
        query=query,
        use_sam=use_sam,
        show_boxes=show_boxes,
        show_masks=show_masks,
        box_threshold=box_threshold,
        text_threshold=text_threshold,
        high_recall=high_recall,
    )
    return JSONResponse(result)


# ── Video Detection ──────────────────────────────────────────────────────────

@router.post("/detect-video")
async def detect_video(
    file: UploadFile = File(...),
    query: str = Form(...),
    use_sam: bool = Form(False),
    use_tracking: bool = Form(True),
    show_boxes: bool = Form(True),
    show_masks: bool = Form(False),
    box_threshold: float = Form(0.25),
    text_threshold: float = Form(0.25),
    high_recall: bool = Form(True),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video (mp4).")

    job_id = str(uuid.uuid4())
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    input_path = UPLOAD_DIR / f"{job_id}{suffix}"
    output_path = OUTPUT_DIR / f"{job_id}_result.mp4"

    data = await file.read()
    input_path.write_bytes(data)

    _jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "error": None,
        "result": None,
    }

    def _run():
        def _cb(pct: int):
            _jobs[job_id]["progress"] = pct

        try:
            result = process_video(
                video_path=str(input_path),
                query=query,
                output_path=str(output_path),
                use_sam=use_sam,
                use_tracking=use_tracking,
                show_boxes=show_boxes,
                show_masks=show_masks,
                box_threshold=box_threshold,
                text_threshold=text_threshold,
                high_recall=high_recall,
                progress_callback=_cb,
            )
            _jobs[job_id].update(
                status="done",
                progress=100,
                result={
                    "total_frames": result["total_frames"],
                    "fps": result["fps"],
                    "detection_count": len(result["detections"]),
                    "sample_detections": result["detections"][:50],
                },
            )
        except Exception as exc:
            logger.exception(f"Job {job_id} failed")
            _jobs[job_id].update(status="error", error=str(exc))
        finally:
            if input_path.exists():
                input_path.unlink(missing_ok=True)

    threading.Thread(target=_run, daemon=True).start()
    return JSONResponse({"job_id": job_id, "status": "processing"})


@router.get("/job/{job_id}/status")
def job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return JSONResponse(job)


@router.get("/job/{job_id}/result")
def job_result(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    if job["status"] != "done":
        raise HTTPException(400, f"Job is not complete (status={job['status']}).")

    output_path = OUTPUT_DIR / f"{job_id}_result.mp4"
    if not output_path.exists():
        raise HTTPException(404, "Output video not found.")

    return FileResponse(
        str(output_path),
        media_type="video/mp4",
        filename=f"vtt_{job_id[:8]}.mp4",
    )
