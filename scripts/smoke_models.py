from __future__ import annotations

import base64
import io
import struct
import sys
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.api_client import APIClient


def make_png(path: Path, w: int = 128, h: int = 128) -> None:
    raw = b"".join(b"\x00" + bytes((232, 95, 78)) * w for _ in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def make_wav(path: Path) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"\x00\x00" * 1600)


def main() -> int:
    client = APIClient()
    tmp = ROOT / "data" / "cache"
    tmp.mkdir(parents=True, exist_ok=True)
    print("CareRelay AI smoke test")

    text, trace = client.chat_with_fallback(
        "SmokeText",
        client.models.analysis_models,
        [{"role": "user", "content": "只回答一个紧凑 JSON：{\"ok\":true}"}],
        max_tokens=80,
        timeout=30,
    )
    print("TEXT:", trace[-1].model, text[:120].replace("\n", " "))

    image_path = tmp / "smoke.png"
    make_png(image_path)
    vision, trace = client.analyze_image(image_path)
    print("VISION:", trace[-1].model, vision[:120].replace("\n", " "))

    wav_path = tmp / "smoke.wav"
    make_wav(wav_path)
    transcript, trace = client.transcribe_audio(wav_path)
    print("ASR:", trace[-1].model, repr(transcript[:80]))

    b64, trace = client.generate_image("A polished Chinese family caregiver handoff dashboard icon, warm professional style")
    print("IMAGE:", trace[-1].model, "bytes", len(base64.b64decode(b64)) if b64 else 0)

    emb, trace = client.embed("爷爷复诊前需要准备医保卡和血压记录")
    print("EMBED:", trace[-1].model, "dims", len(emb))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
