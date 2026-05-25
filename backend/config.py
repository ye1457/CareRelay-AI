from __future__ import annotations

import importlib.util
import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CACHE_DIR = DATA_DIR / "cache"
DB_PATH = DATA_DIR / "care_relay.sqlite3"


def _load_test_api_value(name: str) -> str | None:
    test_api_path = WORKSPACE_ROOT / "test_api.py"
    if not test_api_path.exists():
        return None
    spec = importlib.util.spec_from_file_location("care_relay_test_api", test_api_path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    value = getattr(module, name, None)
    return value if isinstance(value, str) else None


def get_api_key() -> str:
    return os.environ.get("CARE_RELAY_API_KEY") or _load_test_api_value("API_KEY") or ""


def get_base_url() -> str:
    base_url = (
        os.environ.get("CARE_RELAY_BASE_URL")
        or _load_test_api_value("BASE_URL")
        or "http://123.129.219.111:3000/v1"
    ).rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme and parsed.netloc and parsed.path in ("", "/"):
        return f"{base_url}/v1"
    return base_url


@dataclass(frozen=True)
class ModelConfig:
    analysis_models: tuple[str, ...] = ("gpt-5.5", "gpt-5.4", "gpt-5.2", "gpt-5.4-mini", "gpt-4.1-mini")
    critique_models: tuple[str, ...] = ("gpt-5.5", "gpt-5.4", "gpt-5.2", "claude-sonnet-4-6")
    vision_models: tuple[str, ...] = ("qwen3-vl-32b-instruct", "qwen3-vl-8b-Instruct", "gpt-4o-mini")
    text_fallback_models: tuple[str, ...] = ("gpt-4.1-mini", "gpt-4o-mini")
    asr_model: str = "whisper-1"
    image_model: str = "gpt-image-2"
    embedding_model: str = "text-embedding-3-large"
    chat_timeout: int = 14
    vision_timeout: int = 45
    image_timeout: int = 55
    asr_timeout: int = 24


@dataclass(frozen=True)
class AppConfig:
    api_key: str = field(default_factory=get_api_key)
    base_url: str = field(default_factory=get_base_url)
    models: ModelConfig = field(default_factory=ModelConfig)


CONFIG = AppConfig()
