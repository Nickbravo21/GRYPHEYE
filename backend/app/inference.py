"""
Core inference module.

Image pipeline :  Grounding DINO  →  (SAM)  →  draw overlays
Video pipeline :  Grounding DINO  →  ByteTrack  →  (SAM)  →  draw overlays
"""

from __future__ import annotations

import base64
import colorsys
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np
import supervision as sv
import torch
from PIL import Image

from .models import ModelRegistry

logger = logging.getLogger(__name__)

# ── Colour palette ─────────────────────────────────────────────────────────────

_PALETTE: List[Tuple[int, int, int]] = [
    (0, 255, 65),
    (255, 82, 82),
    (82, 130, 255),
    (255, 210, 50),
    (200, 80, 255),
    (50, 230, 200),
    (255, 160, 50),
    (255, 80, 200),
    (80, 200, 255),
    (180, 255, 80),
]


def _color(idx: int) -> Tuple[int, int, int]:
    return _PALETTE[int(idx) % len(_PALETTE)]


# ── Query helpers ──────────────────────────────────────────────────────────────

def _format_query(query: str) -> str:
    """Grounding DINO requires the text prompt to end with a period."""
    q = query.strip()
    return q if q.endswith(".") else q + "."


# ── Grounding DINO ─────────────────────────────────────────────────────────────

def run_grounding_dino(
    image: Image.Image,
    query: str,
    box_threshold: float = 0.25,
    text_threshold: float = 0.25,
) -> Dict[str, Any]:
    """Return raw detections from Grounding DINO."""
    registry = ModelRegistry.get()
    text = _format_query(query)

    inputs = registry.gdino_processor(
        images=image, text=text, return_tensors="pt"
    ).to(registry.device)

    with torch.no_grad():
        outputs = registry.gdino_model(**inputs)

    results = registry.gdino_processor.post_process_grounded_object_detection(
        outputs,
        inputs.input_ids,
        threshold=box_threshold,
        text_threshold=text_threshold,
        target_sizes=[image.size[::-1]],
    )[0]

    return {
        "boxes": results["boxes"].cpu().numpy(),   # xyxy, float32
        "scores": results["scores"].cpu().numpy(),
        "labels": results["labels"],               # list[str]
    }


# ── SAM ────────────────────────────────────────────────────────────────────────

def run_sam(
    image: Image.Image,
    boxes_xyxy: np.ndarray,
) -> Optional[np.ndarray]:
    """Return binary masks (N, H, W) for each detected box, or None."""
    if len(boxes_xyxy) == 0:
        return None

    registry = ModelRegistry.get()
    input_boxes = [boxes_xyxy.tolist()]          # batch dim expected by processor

    inputs = registry.sam_processor(
        images=image,
        input_boxes=input_boxes,
        return_tensors="pt",
    ).to(registry.device)

    with torch.no_grad():
        outputs = registry.sam_model(**inputs)

    masks = registry.sam_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu(),
    )
    # masks is list[Tensor(N, 3, H, W)] – take image 0, best mask candidate 0
    best = masks[0][:, 0, :, :].numpy()          # (N, H, W) bool
    return best.astype(bool)


# ── Drawing ────────────────────────────────────────────────────────────────────

def draw_results(
    image_bgr: np.ndarray,
    boxes: np.ndarray,
    scores: np.ndarray,
    labels: List[str],
    masks: Optional[np.ndarray] = None,
    tracker_ids: Optional[np.ndarray] = None,
    show_boxes: bool = True,
    show_masks: bool = True,
) -> np.ndarray:
    result = image_bgr.copy()

    if show_masks and masks is not None:
        overlay = result.copy()
        for i, mask in enumerate(masks):
            obj_id = int(tracker_ids[i]) if tracker_ids is not None else i
            c = _color(obj_id)
            overlay[mask] = (
                overlay[mask] * 0.3 + np.array(c, dtype=np.float32) * 0.7
            ).clip(0, 255).astype(np.uint8)
        result = cv2.addWeighted(overlay, 0.85, result, 0.15, 0)

    if show_boxes:
        font = cv2.FONT_HERSHEY_SIMPLEX
        for i, (box, score, label) in enumerate(zip(boxes, scores, labels)):
            x1, y1, x2, y2 = map(int, box)
            obj_id = int(tracker_ids[i]) if tracker_ids is not None else i
            c = _color(obj_id)

            cv2.rectangle(result, (x1, y1), (x2, y2), c, 2)

            prefix = f"#{obj_id} " if tracker_ids is not None else ""
            text = f"{prefix}{label} {score:.2f}"
            (tw, th), bl = cv2.getTextSize(text, font, 0.5, 1)
            cv2.rectangle(result, (x1, y1 - th - bl - 6), (x1 + tw + 4, y1), c, -1)
            cv2.putText(
                result, text, (x1 + 2, y1 - bl - 2),
                font, 0.5, (10, 10, 10), 1, cv2.LINE_AA,
            )

    return result


# ── Public API ─────────────────────────────────────────────────────────────────

def process_image(
    image: Image.Image,
    query: str,
    use_sam: bool = True,
    show_boxes: bool = True,
    show_masks: bool = True,
    box_threshold: float = 0.25,
    text_threshold: float = 0.25,
) -> Dict[str, Any]:
    det = run_grounding_dino(image, query, box_threshold, text_threshold)
    boxes, scores, labels = det["boxes"], det["scores"], det["labels"]

    masks: Optional[np.ndarray] = None
    if use_sam and len(boxes) > 0:
        try:
            masks = run_sam(image, boxes)
        except Exception as exc:
            logger.warning(f"SAM failed: {exc}")

    image_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    annotated = draw_results(
        image_bgr, boxes, scores, labels, masks,
        show_boxes=show_boxes, show_masks=show_masks,
    )

    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b64 = base64.b64encode(buf).decode()

    detection_list = [
        {
            "id": i,
            "label": lbl,
            "confidence": float(sc),
            "box": {
                "x": float(box[0]), "y": float(box[1]),
                "width": float(box[2] - box[0]),
                "height": float(box[3] - box[1]),
            },
        }
        for i, (box, sc, lbl) in enumerate(zip(boxes, scores, labels))
    ]

    return {
        "image": f"data:image/jpeg;base64,{b64}",
        "detections": detection_list,
        "count": len(detection_list),
    }


def process_video(
    video_path: str,
    query: str,
    output_path: str,
    use_sam: bool = False,
    use_tracking: bool = True,
    show_boxes: bool = True,
    show_masks: bool = False,
    box_threshold: float = 0.25,
    text_threshold: float = 0.25,
    progress_callback: Optional[Callable[[int], None]] = None,
) -> Dict[str, Any]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    tracker = sv.ByteTrack() if use_tracking else None
    all_detections: List[Dict] = []
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        det = run_grounding_dino(pil, query, box_threshold, text_threshold)
        boxes, scores, labels = det["boxes"], det["scores"], det["labels"]

        tracker_ids: Optional[np.ndarray] = None
        if use_tracking and tracker is not None and len(boxes) > 0:
            sv_det = sv.Detections(
                xyxy=boxes,
                confidence=scores,
                class_id=np.zeros(len(boxes), dtype=int),
            )
            sv_det = tracker.update_with_detections(sv_det)
            boxes = sv_det.xyxy
            scores = sv_det.confidence if sv_det.confidence is not None else scores
            tracker_ids = sv_det.tracker_id

        masks: Optional[np.ndarray] = None
        if use_sam and len(boxes) > 0:
            try:
                masks = run_sam(pil, boxes)
            except Exception as exc:
                logger.warning(f"SAM frame {frame_idx} failed: {exc}")

        annotated = draw_results(
            frame, boxes, scores, labels, masks, tracker_ids,
            show_boxes=show_boxes, show_masks=show_masks,
        )
        writer.write(annotated)

        for i, (box, sc, lbl) in enumerate(zip(boxes, scores, labels)):
            all_detections.append({
                "frame": frame_idx,
                "label": lbl,
                "confidence": float(sc),
                "tracking_id": int(tracker_ids[i]) if tracker_ids is not None else None,
                "box": {
                    "x": float(box[0]), "y": float(box[1]),
                    "width": float(box[2] - box[0]),
                    "height": float(box[3] - box[1]),
                },
            })

        frame_idx += 1
        if progress_callback and total > 0:
            progress_callback(min(99, int(frame_idx / total * 100)))

    cap.release()
    writer.release()

    return {"total_frames": frame_idx, "fps": fps, "detections": all_detections}
