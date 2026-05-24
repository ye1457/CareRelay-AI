from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ModelCall(BaseModel):
    agent: str
    model: str
    status: str
    latency_ms: int = 0
    detail: str = ""


class MemoryHit(BaseModel):
    id: int | None = None
    text: str
    label: str = "profile"
    score: float = 0.0
    created_at: str | None = None


class TodoItem(BaseModel):
    title: str
    due_time: str = ""
    owner: str = "家人"
    priority: str = "medium"
    status: str = "pending"
    source: str = "AI"
    safety_note: str = ""


class CompletedItem(BaseModel):
    title: str
    time: str = ""
    source: str = "记录"


class TimelineItem(BaseModel):
    time: str
    label: str
    type: str = "care"
    detail: str = ""


class EmotionAnalysis(BaseModel):
    primary_tone: str = "需要确认"
    anxiety_level: int = Field(default=40, ge=0, le=100)
    stress_points: list[str] = Field(default_factory=list)
    reassurance: str = "信息已整理，关键不确定项请由家属确认。"


class CareRelayCard(BaseModel):
    care_subject: str
    date: str
    summary: str
    care_status: str = "需确认"
    emotion_analysis: EmotionAnalysis = Field(default_factory=EmotionAnalysis)
    completed: list[CompletedItem] = Field(default_factory=list)
    to_confirm: list[TodoItem] = Field(default_factory=list)
    todos: list[TodoItem] = Field(default_factory=list)
    long_term_watch: list[TodoItem] = Field(default_factory=list)
    abnormal_signals: list[str] = Field(default_factory=list)
    risk_notes: list[str] = Field(default_factory=list)
    family_message: str
    voice_briefing: str
    interaction_questions: list[str] = Field(default_factory=list)
    timeline: list[TimelineItem] = Field(default_factory=list)
    risk_radar: dict[str, int] = Field(
        default_factory=lambda: {"medication": 20, "appointment": 20, "symptom": 20, "communication": 20}
    )
    visual_prompt: str = ""
    visual_image_b64: str = ""
    visual_fallback_svg: str = ""
    confidence: float = Field(default=0.75, ge=0, le=1)
    memory_hits: list[MemoryHit] = Field(default_factory=list)
    memory_suggestions: list[str] = Field(default_factory=list)
    transcript: str = ""
    image_insights: str = ""
    model_trace: list[ModelCall] = Field(default_factory=list)
    offline_mode: bool = False


class AnalyzeResult(BaseModel):
    ok: bool
    card: CareRelayCard
    warnings: list[str] = Field(default_factory=list)


class MemoryCreateRequest(BaseModel):
    user_id: str = "demo_user"
    care_subject: str
    text: str
    label: str = "profile"


class MemoryDeleteResult(BaseModel):
    ok: bool
    deleted_id: int


class MemoryListResult(BaseModel):
    ok: bool
    memories: list[MemoryHit]


JsonDict = dict[str, Any]
