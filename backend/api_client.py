from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np
import requests

from .config import CACHE_DIR, CONFIG
from .schemas import ModelCall


class CareRelayAPIError(RuntimeError):
    pass


class APIClient:
    def __init__(self) -> None:
        self.base_url = CONFIG.base_url
        self.api_key = CONFIG.api_key
        self.models = CONFIG.models
        self.session = requests.Session()
        self.session.trust_env = False

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _record(self, agent: str, model: str, status: str, start: float, detail: str = "") -> ModelCall:
        return ModelCall(agent=agent, model=model, status=status, latency_ms=int((time.time() - start) * 1000), detail=detail[:240])

    def chat_completion(
        self,
        model: str,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2200,
        timeout: int | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format
        response = self.session.post(
            f"{self.base_url}/chat/completions",
            headers=self.headers,
            json=payload,
            timeout=timeout or self.models.chat_timeout,
        )
        if response.status_code != 200:
            raise CareRelayAPIError(f"{response.status_code}: {response.text[:500]}")
        data = response.json()
        return data["choices"][0]["message"].get("content") or ""

    def chat_with_fallback(
        self,
        agent: str,
        models: tuple[str, ...],
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2200,
        timeout: int | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> tuple[str, list[ModelCall]]:
        trace: list[ModelCall] = []
        last_error = ""
        for model in models:
            start = time.time()
            try:
                content = self.chat_completion(
                    model,
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    response_format=response_format,
                )
                trace.append(self._record(agent, model, "ok", start))
                return content, trace
            except Exception as exc:
                last_error = str(exc)
                trace.append(self._record(agent, model, "failed", start, last_error))
        raise CareRelayAPIError(last_error or f"No model available for {agent}")

    def analyze_image(self, image_path: Path) -> tuple[str, list[ModelCall]]:
        mime = mimetypes.guess_type(str(image_path))[0] or "image/png"
        image_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
        messages = [
            {
                "role": "system",
                "content": (
                    "你是家庭照护图片理解助手。请识别图片中的药盒、复诊单、聊天截图、单据、护理记录等信息。"
                    "只输出中文要点，包含：可见文字、照护对象、时间、药物/剂量原文、复诊事项、待办、异常或风险。"
                    "不要做医疗诊断；涉及药物只提醒按医嘱执行。"
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "请提取这张图片中和家庭照护交接有关的信息。"},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                ],
            },
        ]
        return self.chat_with_fallback(
            "VisionAgent",
            self.models.vision_models,
            messages,
            temperature=0,
            max_tokens=900,
            timeout=self.models.vision_timeout,
        )

    def transcribe_audio(self, audio_path: Path) -> tuple[str, list[ModelCall]]:
        start = time.time()
        model = self.models.asr_model
        prepared_path = self._prepare_audio(audio_path)
        last_error = ""
        for attempt in range(2):
            with prepared_path.open("rb") as fp:
                response = self.session.post(
                    f"{self.base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    data={"model": model, "language": "zh", "prompt": "这是一段中文家庭照护交接记录，可能包含服药、复诊、饮食、睡眠、异常情况和待办事项。"},
                    files={"file": (prepared_path.name, fp, "audio/wav" if prepared_path.suffix == ".wav" else "application/octet-stream")},
                    timeout=self.models.asr_timeout,
                )
            if response.status_code == 200:
                data = response.json()
                return data.get("text", ""), [self._record("AudioAgent", model, "ok", start, f"attempt={attempt + 1}")]
            last_error = response.text[:240]
            time.sleep(0.8 * (attempt + 1))
        trace = [self._record("AudioAgent", model, "failed", start, last_error)]
        raise CareRelayAPIError(json.dumps([t.model_dump() for t in trace], ensure_ascii=False))

    @staticmethod
    def _prepare_audio(audio_path: Path) -> Path:
        if audio_path.suffix.lower() in {".wav", ".mp3", ".m4a", ".mpeg", ".mpga"}:
            return audio_path
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        wav_path = CACHE_DIR / f"{audio_path.stem}_16k.wav"
        cmd = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(audio_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(wav_path),
        ]
        try:
            subprocess.run(cmd, check=True, timeout=25)
            if wav_path.exists() and wav_path.stat().st_size > 0:
                return wav_path
        except Exception:
            pass
        return audio_path

    def generate_image(self, prompt: str) -> tuple[str, list[ModelCall]]:
        start = time.time()
        model = self.models.image_model
        payload = {"model": model, "prompt": prompt, "size": "1024x1024", "n": 1}
        response = self.session.post(
            f"{self.base_url}/images/generations",
            headers=self.headers,
            json=payload,
            timeout=self.models.image_timeout,
        )
        if response.status_code != 200:
            return "", [self._record("VisualAgent", model, "failed", start, response.text[:240])]
        try:
            data = response.json()
        except Exception:
            return "", [self._record("VisualAgent", model, "failed", start, response.text[:240])]
        item = (data.get("data") or [{}])[0]
        b64 = item.get("b64_json") or item.get("base64") or item.get("image_base64") or ""
        if isinstance(b64, str) and b64.startswith("data:image"):
            b64 = b64.split(",", 1)[-1]
        if b64:
            return b64, [self._record("VisualAgent", model, "ok", start, "b64_json")]
        image_url = item.get("url") or item.get("image_url") or ""
        if image_url:
            downloaded_b64 = self._download_image_as_b64(str(image_url))
            if downloaded_b64:
                return downloaded_b64, [self._record("VisualAgent", model, "ok", start, "url")]
            return "", [self._record("VisualAgent", model, "failed", start, "image_url_download_failed")]
        return "", [self._record("VisualAgent", model, "ok", start, f"empty keys={','.join(item.keys())}")]

    def _download_image_as_b64(self, image_url: str) -> str:
        if image_url.startswith("data:image"):
            return image_url.split(",", 1)[-1]
        try:
            response = self.session.get(image_url, timeout=self.models.image_timeout)
            if response.status_code == 200 and response.content:
                return base64.b64encode(response.content).decode("ascii")
        except Exception:
            return ""
        return ""

    def embed(self, text: str) -> tuple[list[float], list[ModelCall]]:
        start = time.time()
        model = self.models.embedding_model
        try:
            response = self.session.post(
                f"{self.base_url}/embeddings",
                headers=self.headers,
                json={"model": model, "input": text[:8000]},
                timeout=30,
            )
            if response.status_code == 200:
                embedding = response.json()["data"][0]["embedding"]
                return embedding, [self._record("MemoryAgent", model, "ok", start)]
            detail = response.text[:240]
        except Exception as exc:
            detail = str(exc)
        return self.local_embedding(text), [self._record("MemoryAgent", "local-hash-embedding", "fallback", start, detail)]

    @staticmethod
    def local_embedding(text: str, dims: int = 256) -> list[float]:
        vec = np.zeros(dims, dtype=np.float32)
        for token in text:
            digest = hashlib.sha1(token.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:2], "big") % dims
            vec[idx] += 1.0
        norm = float(np.linalg.norm(vec))
        if norm:
            vec /= norm
        return vec.astype(float).tolist()
