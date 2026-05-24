from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CACHE_DIR, DATA_DIR, PROJECT_ROOT, UPLOAD_DIR
from .fallback import SAMPLE_INPUTS, build_offline_card
from .memory import MemoryStore
from .pipeline import CareRelayPipeline
from .schemas import AnalyzeResult, CareRelayCard, MemoryCreateRequest, MemoryDeleteResult, MemoryListResult


DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CareRelay AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = CareRelayPipeline()
memory_store: MemoryStore = pipeline.memory

frontend_dir = PROJECT_ROOT / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(frontend_dir / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "CareRelay AI"}


def _save_upload(upload: UploadFile | None, prefix: str) -> Path | None:
    if not upload or not upload.filename:
        return None
    suffix = Path(upload.filename).suffix or ".bin"
    path = UPLOAD_DIR / f"{prefix}_{uuid.uuid4().hex}{suffix}"
    with path.open("wb") as fp:
        shutil.copyfileobj(upload.file, fp)
    return path


@app.post("/api/analyze", response_model=AnalyzeResult)
def analyze(
    care_subject: str = Form("爷爷"),
    user_id: str = Form("demo_user"),
    text: str = Form(""),
    use_visual: bool = Form(True),
    audio: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
) -> AnalyzeResult:
    try:
        audio_path = _save_upload(audio, "audio")
        image_path = _save_upload(image, "image")
        card, warnings = pipeline.process(
            text=text,
            care_subject=care_subject,
            user_id=user_id,
            audio_path=audio_path,
            image_path=image_path,
            use_visual=use_visual,
        )
        return AnalyzeResult(ok=True, card=card, warnings=warnings)
    except Exception as exc:
        card = build_offline_card(care_subject, text)
        return AnalyzeResult(ok=False, card=card, warnings=[f"主流程异常，已切换离线样例：{str(exc)[:180]}"])


@app.post("/api/transcribe")
def transcribe_audio(audio: UploadFile = File(...)) -> dict:
    try:
        audio_path = _save_upload(audio, "audio_direct")
        if audio_path is None:
            raise HTTPException(status_code=400, detail="audio file is empty")
        transcript, trace = pipeline.client.transcribe_audio(audio_path)
        return {"ok": True, "transcript": transcript.strip(), "trace": [item.model_dump() for item in trace], "warnings": []}
    except Exception as exc:
        return {"ok": False, "transcript": "", "trace": [], "warnings": [f"语音转写失败：{str(exc)[:180]}"]}


@app.post("/api/inspect-image")
def inspect_image(image: UploadFile = File(...)) -> dict:
    try:
        image_path = _save_upload(image, "image_direct")
        if image_path is None:
            raise HTTPException(status_code=400, detail="image file is empty")
        insights, trace = pipeline.client.analyze_image(image_path)
        return {"ok": True, "insights": insights.strip(), "trace": [item.model_dump() for item in trace], "warnings": []}
    except Exception as exc:
        return {"ok": False, "insights": "", "trace": [], "warnings": [f"图片解析失败：{str(exc)[:180]}"]}


@app.post("/api/generate-visual")
def generate_visual(card: CareRelayCard) -> dict:
    try:
        prompt = pipeline._build_visual_prompt(card)
        visual_b64, trace = pipeline.client.generate_image(prompt)
        if not visual_b64:
            return {
                "ok": False,
                "visual_image_b64": "",
                "trace": [item.model_dump() for item in trace],
                "warnings": ["信息图生成未返回图片，已保留本地备用图。"],
            }
        return {
            "ok": True,
            "visual_image_b64": visual_b64,
            "trace": [item.model_dump() for item in trace],
            "warnings": [],
        }
    except Exception as exc:
        return {"ok": False, "visual_image_b64": "", "trace": [], "warnings": [f"信息图生成失败：{str(exc)[:180]}"]}


@app.get("/api/history")
def history(user_id: str = "demo_user", care_subject: str = "", limit: int = 12) -> dict:
    subject = care_subject.strip() or None
    return {"ok": True, "records": memory_store.list_records(user_id=user_id, care_subject=subject, limit=limit)}


@app.get("/api/samples")
def samples() -> dict:
    return SAMPLE_INPUTS


@app.get("/api/offline-card")
def offline_card(care_subject: str = "爷爷") -> dict:
    return build_offline_card(care_subject).model_dump()


@app.post("/api/memory", response_model=MemoryListResult)
def create_memory(payload: MemoryCreateRequest) -> MemoryListResult:
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="memory text is empty")
    memory_store.add_memory(payload.user_id, payload.care_subject, payload.text.strip(), payload.label)
    memories = memory_store.list_memories(payload.user_id, payload.care_subject)
    return MemoryListResult(ok=True, memories=memories)


@app.get("/api/memory", response_model=MemoryListResult)
def list_memory(user_id: str = "demo_user", care_subject: str = "爷爷") -> MemoryListResult:
    return MemoryListResult(ok=True, memories=memory_store.list_memories(user_id, care_subject))


@app.delete("/api/memory/{memory_id}", response_model=MemoryDeleteResult)
def delete_memory(memory_id: int, user_id: str = "demo_user") -> MemoryDeleteResult:
    deleted = memory_store.delete_memory(memory_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="memory not found")
    return MemoryDeleteResult(ok=True, deleted_id=memory_id)
