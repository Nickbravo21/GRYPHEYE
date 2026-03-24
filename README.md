# GRYPHEYE-0.0.2

> **Open-vocabulary AI object detection, pixel-level segmentation, and multi-object tracking — in your browser.**

GRYPHEYE-0.0.2 is a full-stack web application that lets you upload any image or video, type a plain-English description of what you want to find (e.g. `"tank"`, `"person with backpack"`, `"drone"`), and instantly receive annotated results with bounding boxes, segmentation masks, confidence scores, and persistent tracking IDs across video frames — all without retraining any model.

---

## Table of Contents

1. [How It Works — Overview](#1-how-it-works--overview)
2. [AI Models Used](#2-ai-models-used)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Installation & Running (Local)](#5-installation--running-local)
6. [Installation & Running (Docker)](#6-installation--running-docker)
7. [Using the Application](#7-using-the-application)
8. [API Reference](#8-api-reference)
9. [Configuration & Tuning](#9-configuration--tuning)
10. [Frontend Component Guide](#10-frontend-component-guide)
11. [Backend Module Guide](#11-backend-module-guide)
12. [Detection Output Format](#12-detection-output-format)
13. [Performance & Hardware Notes](#13-performance--hardware-notes)
14. [Troubleshooting](#14-troubleshooting)
15. [Architecture Diagram](#15-architecture-diagram)

---

## 1. How It Works — Overview

### Image Pipeline

```
User uploads image + types query
        │
        ▼
  Grounding DINO
  (text-guided detection)
        │
        ▼  boxes + scores + labels
  Segment Anything (SAM)        ← optional, toggleable
  (pixel-level masks per box)
        │
        ▼  masks
  OpenCV Draw Layer
  (boxes, labels, confidence bars, coloured mask overlays)
        │
        ▼
  Base-64 JPEG returned to browser
  + raw JSON detections list
```

### Video Pipeline

```
User uploads video + types query
        │
        ▼
  Background thread (non-blocking)
        │
  ┌─────┴──────────────────────────────────────┐
  │  Per-frame loop:                            │
  │    Grounding DINO → detections             │
  │    ByteTrack → assign/persist object IDs   │
  │    SAM (optional, disabled by default)     │
  │    OpenCV → annotate frame                 │
  └─────┬──────────────────────────────────────┘
        │ progress updates polled by frontend
        ▼
  MP4 written to /outputs/
  Job marked "done"
        │
        ▼
  Frontend streams video in-browser
  + shows detection table with frame numbers + IDs
```

---

## 2. AI Models Used

| Model | Provider | Size | Purpose |
|-------|----------|------|---------|
| **Grounding DINO Tiny** | IDEA-Research (HuggingFace) | ~700 MB | Zero-shot, open-vocabulary object detection driven by natural language text prompts |
| **SAM ViT-Base** | Meta (HuggingFace) | ~375 MB | Segment Anything — generates pixel-precise masks for each detected bounding box |
| **ByteTrack** | supervision library | — (algorithm only) | Multi-object tracking that maintains consistent object IDs across video frames |

### Grounding DINO

Grounding DINO is a transformer-based detector that fuses visual and language features. Unlike traditional detectors trained on fixed class lists (e.g. COCO's 80 classes), Grounding DINO accepts any text phrase as input and will attempt to localise matching objects, even if it has never seen them labelled during training. This makes it ideal for open-ended queries like `"military vehicle"` or `"person carrying weapon"`.

- Model ID: `IDEA-Research/grounding-dino-tiny`
- Input: RGB image + text query (auto-terminated with `.`)
- Output: bounding boxes (xyxy), confidence scores, text labels

### SAM — Segment Anything

SAM takes the bounding boxes produced by Grounding DINO as spatial prompts and outputs a binary pixel mask for each detected object. This gives precise object outlines rather than coarse rectangles. SAM runs in **box-prompt mode** — no manual point clicking is required.

- Model ID: `facebook/sam-vit-base`
- Input: image + list of bounding boxes
- Output: binary masks `(N, H, W)` — one per detected object

### ByteTrack

ByteTrack is a high-performance multi-object tracker that works by associating detections across frames using IoU-based matching. It does **not** require a separate re-identification model. VTT uses the `supervision` library's implementation (`sv.ByteTrack`), which is plugged directly into the Grounding DINO per-frame outputs. Each tracked object is assigned a stable integer ID that persists for the duration of the video, even through brief occlusions.

---

## 3. Project Structure

```
GRYPHEYE-0.0.2/
├── backend/                        # Python FastAPI server
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, model lifespan loading
│   │   ├── models.py               # ModelRegistry singleton — loads GDINO + SAM
│   │   ├── inference.py            # Core AI pipeline (detection, SAM, tracking, drawing)
│   │   └── routes.py               # REST API endpoints
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Container definition
│
├── frontend/                       # React single-page application
│   ├── public/
│   │   └── index.html              # HTML shell, Google Font imports
│   └── src/
│       ├── App.js                  # Root component — state, detection flow, layout
│       ├── App.css                 # Global layout, header, panels, buttons
│       ├── index.js                # React entry point
│       ├── index.css               # CSS variables, scrollbars, reset
│       ├── components/
│       │   ├── UploadPanel.jsx     # Drag-and-drop / click file selector
│       │   ├── QueryInput.jsx      # Text input + example query chips
│       │   ├── ToggleControls.jsx  # Toggle switches + sliders for options
│       │   ├── PreviewWindow.jsx   # Annotated image/video display area
│       │   ├── LoadingState.jsx    # Animated spinner + progress bar
│       │   ├── ResultsDisplay.jsx  # Tab bar: Detections view / Raw JSON view
│       │   └── DetectionList.jsx   # Cards showing label, confidence, box coords
│       └── services/
│           └── api.js              # Axios wrappers for all backend calls
│
└── docker-compose.yml              # Orchestrates backend + frontend containers
```

---

## 4. Prerequisites

### Local (without Docker)

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Python | 3.10+ | 3.11 recommended |
| Node.js | 18+ | For the React frontend |
| npm | 9+ | Comes with Node |
| pip | 23+ | `pip install --upgrade pip` |
| CUDA (optional) | 11.8+ | Inference is 5–20× faster on GPU |

### Docker

| Requirement | Notes |
|-------------|-------|
| Docker Engine | 24+ |
| Docker Compose v2 | `docker compose` (not `docker-compose`) |
| NVIDIA Container Toolkit | Only needed for GPU inside Docker |

---

## 5. Installation & Running (Local)

### Step 1 — Clone / enter the project

```bash
cd /path/to/GRYPHEYE-0.0.2
```

### Step 2 — Backend setup

```bash
cd backend

# Create a virtual environment (strongly recommended)
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install all Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

> **Note on PyTorch:** `requirements.txt` installs the default CPU build of PyTorch.
> For CUDA 12.x GPU support, install the matching build first:
> ```bash
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
> ```

### Step 3 — Start the backend

```bash
# Still inside backend/ with venv active
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On first launch the server will download both models from HuggingFace (~1.1 GB total) and cache them in `~/.cache/huggingface/`. Subsequent starts are immediate.

Expected startup output:
```
INFO  Loading Grounding DINO  (IDEA-Research/grounding-dino-tiny) …
INFO  ✓ Grounding DINO ready
INFO  Loading SAM  (facebook/sam-vit-base) …
INFO  ✓ SAM ready
INFO  All models ready. API is live.
INFO  Uvicorn running on http://0.0.0.0:8000
```

### Step 4 — Frontend setup

Open a **second terminal**:

```bash
cd frontend
npm install
npm start
```

The React dev server starts on `http://localhost:3000` and proxies all `/api` calls to `http://localhost:8000`.

### Step 5 — Open the app

Navigate to **http://localhost:3000** in your browser.

---

## 6. Installation & Running (Docker)

Docker builds and runs both services automatically.

```bash
# From the project root (where docker-compose.yml lives)
docker compose up --build
```

- Backend is available at `http://localhost:8000`
- Frontend is available at `http://localhost:3000`

### GPU access inside Docker

The `docker-compose.yml` already includes the NVIDIA GPU reservation block. You only need the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed on the host. If you don't have a GPU, remove the `deploy.resources` block from `docker-compose.yml` and the backend will fall back to CPU automatically.

### Model cache persistence

The compose file mounts a named Docker volume `model_cache` to `/root/.cache/huggingface` inside the container. This means models are only downloaded once and survive container restarts.

### Stopping

```bash
docker compose down
```

---

## 7. Using the Application

The UI is divided into a **left control panel** and a **right results area**.

---

### Step 01 — Upload Target Media

Click the upload zone or drag and drop a file onto it.

| Accepted Formats | Max Recommended Size |
|-----------------|---------------------|
| JPEG (`.jpg`, `.jpeg`) | — |
| PNG (`.png`) | — |
| MP4 Video (`.mp4`) | Keep under ~50 MB for reasonable speed |

Once a file is loaded its name, size, and type (IMAGE / VIDEO) are shown beneath the dropzone. Click **CLEAR** to remove it and start over.

---

### Step 02 — Detection Query

Type a plain-English description of what you want to detect. You can use:

- Single words: `tank`, `drone`, `car`, `person`
- Phrases: `person with backpack`, `military vehicle`, `aircraft`
- Multiple targets: `person. tank. drone` (separate with `. ` to detect several classes)

**Quick-select chips** below the input let you click common examples without typing.

Press **Enter** or click **INITIATE DETECTION** to run.

> **Tip:** Grounding DINO is context-aware. `"soldier"` and `"person in uniform"` will often find the same objects. More specific phrases generally yield fewer but more precise detections.

---

### Step 03 — Options

| Control | Default | Effect |
|---------|---------|--------|
| **Bounding Boxes** | ON | Draws labelled rectangles around each detection |
| **SAM Segmentation** | ON (images) / OFF (video) | Runs Segment Anything to produce pixel-level masks |
| **Show Masks** | ON | Overlays coloured mask fills on the image/video |
| **Object Tracking** | ON | Video only — assigns consistent IDs across frames using ByteTrack |
| **Box Confidence** slider | 0.25 | Minimum score for a detection to be included (0.05–0.95). Lower = more detections, more noise. Higher = fewer, more certain. |
| **Text Threshold** slider | 0.25 | Minimum text-feature alignment score. Works in tandem with box confidence. |

> **SAM on video** is disabled by default because running SAM on every frame is very slow. Enable it only on short clips or when pixel masks are critical.

---

### Running Detection

Click **INITIATE DETECTION**.

**For images:**
- The button shows `ANALYZING IMAGE…` with a pulsing animation.
- Results appear in 2–30 seconds depending on hardware and whether SAM is enabled.
- The annotated image appears in the right panel.

**For videos:**
- The button shows `PROCESSING VIDEO… X%` with a live progress counter.
- Processing happens in a background thread — the UI remains responsive.
- When done, the annotated video auto-plays in the right panel with browser controls (play/pause/scrub).
- The first 50 detections from all frames appear in the results table.

---

### Reading the Results

**Preview Window** (large right area):
- For images: the processed image with overlaid boxes and/or masks.
- For video: an HTML5 `<video>` player with the annotated output.
- Each detected object is drawn in a unique colour that stays consistent across the frame (or across all frames if tracking is on).
- Label format: `#ID label confidence` — e.g. `#3 person 0.72`

**Results Panel** (bottom strip, tabbed):

`DETECTIONS (N)` tab — one card per detection showing:
- Object **label** (capitalised)
- Tracking **ID badge** (e.g. `#3`) — colour-matched to the box on screen
- **Confidence bar** — green ≥70%, yellow 40–70%, red <40%
- **Pixel coordinates** `x, y  width×height`
- **Frame number** (video only)

`RAW JSON` tab — the raw detection array as pretty-printed JSON, useful for integrating with other tools. Up to 10 entries shown inline with a count of the remainder.

---

## 8. API Reference

The backend is a standard REST API. All endpoints are prefixed with `/api`.

---

### `GET /api/health`

Health check. Returns immediately.

**Response:**
```json
{
  "status": "ok",
  "service": "GRYPHEYE-0.0.2"
}
```

---

### `POST /api/detect-image`

Run detection on a single image. Synchronous — waits for inference to complete.

**Request:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | ✓ | — | Image file (JPEG or PNG) |
| `query` | string | ✓ | — | Natural language detection prompt |
| `use_sam` | bool | | `true` | Run SAM segmentation |
| `show_boxes` | bool | | `true` | Include boxes in output image |
| `show_masks` | bool | | `true` | Include mask overlays in output image |
| `box_threshold` | float | | `0.25` | Box confidence cutoff (0.0–1.0) |
| `text_threshold` | float | | `0.25` | Text similarity cutoff (0.0–1.0) |

**Response:** `application/json`
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "detections": [
    {
      "id": 0,
      "label": "person",
      "confidence": 0.83,
      "box": { "x": 142.3, "y": 88.1, "width": 64.5, "height": 190.2 }
    }
  ],
  "count": 1
}
```

**cURL example:**
```bash
curl -X POST http://localhost:8000/api/detect-image \
  -F "file=@photo.jpg" \
  -F "query=person" \
  -F "use_sam=true" \
  -F "box_threshold=0.3"
```

---

### `POST /api/detect-video`

Submit a video for background processing. Returns a `job_id` immediately.

**Request:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | ✓ | — | MP4 video file |
| `query` | string | ✓ | — | Natural language detection prompt |
| `use_sam` | bool | | `false` | Run SAM per frame (very slow) |
| `use_tracking` | bool | | `true` | Enable ByteTrack ID assignment |
| `show_boxes` | bool | | `true` | Draw boxes on output video |
| `show_masks` | bool | | `false` | Draw mask overlays on output video |
| `box_threshold` | float | | `0.25` | Box confidence cutoff |
| `text_threshold` | float | | `0.25` | Text similarity cutoff |

**Response:** `application/json`
```json
{
  "job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "processing"
}
```

---

### `GET /api/job/{job_id}/status`

Poll the status of a video processing job.

**Response states:**

| `status` | Meaning |
|----------|---------|
| `"processing"` | Still running |
| `"done"` | Complete — result video is ready |
| `"error"` | Failed — see `error` field |

**Response (processing):**
```json
{
  "status": "processing",
  "progress": 47,
  "error": null,
  "result": null
}
```

**Response (done):**
```json
{
  "status": "done",
  "progress": 100,
  "error": null,
  "result": {
    "total_frames": 312,
    "fps": 30.0,
    "detection_count": 874,
    "sample_detections": [ ... ]
  }
}
```

---

### `GET /api/job/{job_id}/result`

Download the annotated output video as an MP4 file.

Only callable when `status == "done"`. Returns the file as `video/mp4` with filename `vtt_<short_id>.mp4`.

**cURL example:**
```bash
curl -O http://localhost:8000/api/job/f47ac10b-.../result
```

---

### `GET /outputs/{job_id}_result.mp4`

Static file endpoint — the frontend uses this to stream the video directly into the `<video>` element without a download prompt.

---

## 9. Configuration & Tuning

### Adjusting detection sensitivity

| Situation | Recommended change |
|-----------|-------------------|
| Too many false positives | Increase `box_threshold` to 0.35–0.5 |
| Missing obvious objects | Decrease `box_threshold` to 0.15–0.2 |
| Labels not matching your query words | Decrease `text_threshold` to 0.15 |
| Very slow inference | Disable SAM, use CPU-only for testing |

### Changing the models

Edit `backend/app/models.py`:

```python
GDINO_MODEL_ID = "IDEA-Research/grounding-dino-base"  # larger, more accurate
SAM_MODEL_ID   = "facebook/sam-vit-large"              # larger, more precise masks
```

Available variants:

| Model | ID | RAM usage | Speed |
|-------|----|-----------|-------|
| Grounding DINO Tiny | `IDEA-Research/grounding-dino-tiny` | ~1.4 GB VRAM | Fast |
| Grounding DINO Base | `IDEA-Research/grounding-dino-base` | ~3 GB VRAM | Moderate |
| SAM ViT-Base | `facebook/sam-vit-base` | ~375 MB | Fast |
| SAM ViT-Large | `facebook/sam-vit-large` | ~1.2 GB | Slower |
| SAM ViT-Huge | `facebook/sam-vit-huge` | ~2.4 GB | Slowest |

### Changing the API base URL (frontend)

If the backend is on a different host/port, set the environment variable before starting:

```bash
REACT_APP_API_URL=http://my-server:8000/api npm start
```

Or create a `.env` file in `frontend/`:
```
REACT_APP_API_URL=http://my-server:8000/api
```

---

## 10. Frontend Component Guide

### `App.js` — Root component

Owns all application state:
- `file` — the selected File object
- `fileType` — `'image'` or `'video'`
- `query` — the current text prompt
- `options` — all toggle/slider values
- `loading`, `progress`, `error`, `result`

Orchestrates the detection flow: calls `detectImage()` or `detectVideo()` + `pollJobStatus()` from `api.js`, then stores the result for child components to render.

---

### `UploadPanel.jsx`

Provides drag-and-drop and click-to-browse file selection. Validates that the file is an image or video before accepting it. Shows file name, size, and type badge after selection. Exposes a **CLEAR** button to reset.

Props: `onFileSelect(file, type)`, `disabled`

---

### `QueryInput.jsx`

Text input bound to the query string. Pressing **Enter** triggers detection. Below the input, six quick-select chip buttons let users click common queries (`person`, `military vehicle`, `drone`, `tank`, `person with backpack`, `aircraft`). The active chip is highlighted.

Props: `value`, `onChange`, `disabled`, `onSubmit`

---

### `ToggleControls.jsx`

Renders all the detection option controls:
- **Toggle switches** — pill-shaped on/off buttons with a sliding indicator
- **Range sliders** — for `boxThreshold` and `textThreshold`, showing the current value

The **Object Tracking** toggle is only shown when `fileType === 'video'`. The **Show Masks** toggle is automatically disabled when SAM is turned off.

Props: `options`, `fileType`, `onChange(key, value)`, `disabled`

---

### `PreviewWindow.jsx`

The large central display area. Shows:
- An idle crosshair placeholder when no file is loaded
- `<LoadingState>` while inference is running
- An `<img>` tag (base-64 source) after image detection
- An HTML5 `<video>` tag (streaming from `/outputs/`) after video detection

Decorated with corner crosshair brackets and a subtle grid overlay for the tactical aesthetic.

Props: `result`, `loading`, `progress`, `fileType`, `file`

---

### `LoadingState.jsx`

Animated SVG spinner (two concentric arcs rotating in opposite directions) shown during inference. For videos it also shows a live numeric progress percentage and a green fill progress bar. For images it shows `"ANALYZING IMAGE…"`.

Props: `fileType`, `progress`

---

### `ResultsDisplay.jsx`

Bottom panel with two tabs:
- **DETECTIONS (N)** — renders `<DetectionList>`
- **RAW JSON** — pretty-prints up to 10 detection entries as JSON

For video results, the frame count and FPS are shown in the tab bar.

Props: `result`

---

### `DetectionList.jsx`

Renders one card per detection entry. Each card shows:
- Label name (bold, capitalised)
- Tracking ID badge (colour-matched to its on-screen box)
- Colour-coded confidence bar (green / yellow / red)
- Pixel coordinates `x, y  width×height`
- Frame number (video only)

Cards use a colour derived from the object's ID, cycling through 8 distinct colours. Cards wrap responsively.

Props: `detections[]`, `type`

---

### `services/api.js`

Three exported async functions:

| Function | Description |
|----------|-------------|
| `detectImage(file, query, options)` | POST to `/api/detect-image`, returns `{ image, detections, count }` |
| `detectVideo(file, query, options)` | POST to `/api/detect-video`, returns `{ job_id }` |
| `pollJobStatus(jobId, progressCallback, intervalMs)` | Recursive polling loop, resolves when `status === 'done'`, rejects on `'error'` |

---

## 11. Backend Module Guide

### `app/main.py`

Initialises the FastAPI application. Key responsibilities:
- Registers the **lifespan** context manager which calls `load_models()` on startup and logs shutdown.
- Adds **CORS middleware** (all origins allowed — restrict in production).
- Mounts `/outputs` as a static file directory so videos can be streamed by filename.
- Includes the router from `routes.py` under the `/api` prefix.

---

### `app/models.py`

Defines `ModelRegistry` — a **singleton class** that holds references to:
- `gdino_processor` — HuggingFace processor for Grounding DINO
- `gdino_model` — Grounding DINO model weights
- `sam_processor` — HuggingFace SAM processor
- `sam_model` — SAM model weights
- `device` — `"cuda"` or `"cpu"`, detected automatically at load time

`load_models()` is called **once** at startup. Every inference call retrieves the same singleton via `ModelRegistry.get()`, ensuring models are never reloaded between requests.

---

### `app/inference.py`

The core AI pipeline. Key functions:

| Function | Description |
|----------|-------------|
| `run_grounding_dino(image, query, ...)` | Runs GDINO. Auto-appends `.` to the query. Returns `boxes` (xyxy), `scores`, `labels`. |
| `run_sam(image, boxes_xyxy)` | Runs SAM with box prompts. Returns `(N, H, W)` boolean mask array. Takes the highest-quality mask candidate (index 0 of 3 outputs). |
| `draw_results(image_bgr, ...)` | OpenCV drawing layer. Draws coloured mask fills first, then rectangles and label banners on top. |
| `process_image(image, query, ...)` | Full image pipeline. Returns base-64 JPEG + detection list. |
| `process_video(video_path, ...)` | Full video pipeline. Frame loop with ByteTrack. Writes MP4 to `output_path`. Returns metadata + all detections. |

**Colour assignment:** object colours are determined by `_color(idx)` which cycles through a 10-colour palette indexed by tracking ID (or detection index for images). This ensures each unique object always gets the same colour.

---

### `app/routes.py`

REST endpoint handlers:

| Endpoint | Handler | Pattern |
|----------|---------|---------|
| `GET /health` | `health()` | Synchronous, instant |
| `POST /detect-image` | `detect_image()` | Synchronous, blocks until inference done |
| `POST /detect-video` | `detect_video()` | Async — spawns daemon thread, returns `job_id` immediately |
| `GET /job/{id}/status` | `job_status()` | Returns from in-memory `_jobs` dict |
| `GET /job/{id}/result` | `job_result()` | Returns `FileResponse` to the MP4 |

**Job storage** uses a plain Python dict `_jobs`. This is intentional for simplicity — jobs are lost on server restart. For production, replace with Redis + Celery.

**Temp file cleanup:** input video files are deleted from `uploads/` after processing completes (or fails). Output videos in `outputs/` are kept until the server restarts.

---

## 12. Detection Output Format

### Image detection response

```json
{
  "image": "data:image/jpeg;base64,<base64-encoded JPEG>",
  "count": 3,
  "detections": [
    {
      "id": 0,
      "label": "person",
      "confidence": 0.847,
      "box": {
        "x": 142.3,
        "y": 88.6,
        "width": 64.1,
        "height": 189.7
      }
    },
    ...
  ]
}
```

### Video detection entry (per frame)

```json
{
  "frame": 47,
  "label": "vehicle",
  "confidence": 0.712,
  "tracking_id": 3,
  "box": {
    "x": 380.2,
    "y": 210.5,
    "width": 128.9,
    "height": 74.3
  }
}
```

All box coordinates are in **pixel space**, relative to the top-left corner of the image/frame.
`tracking_id` is `null` when tracking is disabled.

---

## 13. Performance & Hardware Notes

| Hardware | Image (no SAM) | Image (+ SAM) | Video 30fps (no SAM) |
|----------|---------------|---------------|----------------------|
| CPU only | 3–8 s | 15–40 s | ~2–5 fps throughput |
| NVIDIA GPU (8 GB VRAM) | 0.3–1 s | 1–4 s | 5–15 fps throughput |
| NVIDIA GPU (16+ GB VRAM) | 0.2–0.5 s | 0.5–2 s | 10–25 fps throughput |

Throughput figures assume 720p input. 4K video will be proportionally slower.

**Tips for faster processing:**
- Disable SAM for any real-time or large-batch use case.
- Use `grounding-dino-tiny` (default) rather than `base`.
- For GPU: ensure PyTorch was installed with the matching CUDA build.
- For video: shorter clips (< 60 seconds) process much faster and are easier to review.

---

## 14. Troubleshooting

### Backend won't start / model download fails

```
OSError: We couldn't connect to 'https://huggingface.co'
```

You are behind a firewall. Set the HuggingFace mirror or pre-download:
```bash
# Option A: set proxy
export HTTPS_PROXY=http://your-proxy:port

# Option B: pre-download and use local path
huggingface-cli download IDEA-Research/grounding-dino-tiny
```

---

### `RuntimeError: CUDA out of memory`

- Switch to `sam-vit-base` instead of `large` or `huge`.
- Disable SAM entirely.
- Reduce input resolution by pre-scaling images before upload.

---

### Video stays at 0% forever

- Check backend logs: `uvicorn` terminal shows per-frame progress.
- The frontend polls every 2 seconds — a very long video may appear stuck for the first few percent.
- If the backend log shows an error, the job status will switch to `"error"` and the UI will display it.

---

### Detection returns 0 results

1. Try a simpler, more common query (`"person"` instead of `"insurgent"`).
2. Lower `box_threshold` to `0.10–0.15`.
3. Lower `text_threshold` to `0.10`.
4. Make sure the subject is reasonably visible and not tiny relative to the image.

---

### Video plays with no audio

This is expected. The processing pipeline (OpenCV VideoWriter) does not copy audio tracks. Only the visual frames are annotated and re-encoded.

---

### `npm start` fails with proxy error

Make sure the backend is running first on port `8000`. The React dev server's proxy (`"proxy": "http://localhost:8000"` in `package.json`) requires the backend to be reachable.

---

### Docker GPU not detected

Ensure the NVIDIA Container Toolkit is installed:
```bash
# Ubuntu
sudo apt install nvidia-container-toolkit
sudo systemctl restart docker
```

Then verify:
```bash
docker run --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

---

## 15. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ UploadPanel  │   │  QueryInput  │   │  ToggleControls   │   │
│  └──────┬───────┘   └──────┬───────┘   └────────┬──────────┘   │
│         │                  │                    │               │
│         └──────────────────▼────────────────────┘               │
│                       App.js (state)                            │
│                            │                                    │
│                   services/api.js (axios)                       │
│                            │                                    │
│          ┌─────────────────┼──────────────────┐                │
│          │                 │                  │                 │
│   detectImage()     detectVideo()      pollJobStatus()          │
│          │                 │                  │                 │
│          └─────────────────▼──────────────────┘                │
│                     PreviewWindow                               │
│                     ResultsDisplay / DetectionList              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / FormData / JSON
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    FASTAPI BACKEND (:8000)                       │
│                                                                 │
│   POST /api/detect-image  ──►  process_image()                  │
│                                    │                            │
│   POST /api/detect-video  ──►  Thread ──► process_video()       │
│   GET  /api/job/{id}/status ◄── _jobs dict                      │
│   GET  /api/job/{id}/result ──► FileResponse(mp4)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   inference.py                           │   │
│  │                                                          │   │
│  │  run_grounding_dino()  →  run_sam()  →  draw_results()   │   │
│  │                                                          │   │
│  │  process_video(): frame loop + sv.ByteTrack              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   models.py (singleton)                  │   │
│  │                                                          │   │
│  │   ModelRegistry.gdino_model   (IDEA-Research/gdino-tiny) │   │
│  │   ModelRegistry.sam_model     (facebook/sam-vit-base)    │   │
│  │   ModelRegistry.device        cuda | cpu                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│   /uploads/   ← temporary input files (auto-deleted)           │
│   /outputs/   ← annotated output videos (persisted)            │
└─────────────────────────────────────────────────────────────────┘
```

---

*GRYPHEYE-0.0.2 — built with Grounding DINO · Segment Anything · ByteTrack · FastAPI · React*
*CLASSIFICATION: UNCLASSIFIED // FOR DEMONSTRATION USE ONLY*
