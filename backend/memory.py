from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

import numpy as np

from .api_client import APIClient
from .config import DB_PATH
from .schemas import MemoryHit, ModelCall


class MemoryStore:
    def __init__(self, db_path: Path = DB_PATH, client: APIClient | None = None) -> None:
        self.db_path = db_path
        self.client = client or APIClient()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.ensure_seed_data()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    care_subject TEXT NOT NULL,
                    text TEXT NOT NULL,
                    label TEXT NOT NULL DEFAULT 'profile',
                    embedding TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    care_subject TEXT NOT NULL,
                    input_text TEXT,
                    output_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

    def ensure_seed_data(self) -> None:
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM memories WHERE user_id='demo_user'").fetchone()[0]
        if count:
            return
        seeds = [
            ("demo_user", "爷爷", "爷爷复诊前通常需要准备医保卡、病历本、最近三天血压记录。", "routine"),
            ("demo_user", "爷爷", "爷爷晚上服药必须由家人确认，不能因为不确定就重复服药。", "safety"),
            ("demo_user", "宝宝", "宝宝晚间哭闹时优先记录喝奶量、睡眠时长和是否胀气。", "routine"),
            ("demo_user", "小猫", "小猫复查前要准备航空箱、病历和最近一次喂药时间。", "routine"),
        ]
        for user_id, subject, text, label in seeds:
            self.add_memory(user_id, subject, text, label)

    def add_memory(self, user_id: str, care_subject: str, text: str, label: str = "profile") -> tuple[MemoryHit, list[ModelCall]]:
        embedding, trace = self.client.embed(text)
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO memories (user_id, care_subject, text, label, embedding, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (user_id, care_subject, text, label, json.dumps(embedding), now, now),
            )
            memory_id = int(cur.lastrowid)
        return MemoryHit(id=memory_id, text=text, label=label, score=1.0, created_at=now), trace

    def list_memories(self, user_id: str, care_subject: str | None = None) -> list[MemoryHit]:
        query = "SELECT * FROM memories WHERE user_id=? AND active=1"
        params: list[str] = [user_id]
        if care_subject:
            query += " AND care_subject=?"
            params.append(care_subject)
        query += " ORDER BY updated_at DESC LIMIT 80"
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [
            MemoryHit(id=row["id"], text=row["text"], label=row["label"], score=1.0, created_at=row["created_at"])
            for row in rows
        ]

    def delete_memory(self, memory_id: int, user_id: str = "demo_user") -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE memories SET active=0, updated_at=? WHERE id=? AND user_id=?",
                (datetime.now().isoformat(timespec="seconds"), memory_id, user_id),
            )
            return cur.rowcount > 0

    def search(self, user_id: str, care_subject: str, query_text: str, top_k: int = 5) -> tuple[list[MemoryHit], list[ModelCall]]:
        memories = self.list_memories(user_id, care_subject)
        if not memories:
            return [], []
        query_embedding, trace = self.client.embed(query_text or care_subject)
        q = np.array(query_embedding, dtype=np.float32)
        scored: list[MemoryHit] = []
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM memories WHERE user_id=? AND care_subject=? AND active=1",
                (user_id, care_subject),
            ).fetchall()
        for row in rows:
            try:
                emb = np.array(json.loads(row["embedding"]), dtype=np.float32)
            except Exception:
                continue
            dims = min(len(q), len(emb))
            if dims == 0:
                continue
            qv = q[:dims]
            ev = emb[:dims]
            denom = float(np.linalg.norm(qv) * np.linalg.norm(ev))
            score = float(np.dot(qv, ev) / denom) if denom else 0.0
            scored.append(
                MemoryHit(id=row["id"], text=row["text"], label=row["label"], score=round(score, 4), created_at=row["created_at"])
            )
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k], trace

    def save_record(self, user_id: str, care_subject: str, input_text: str, output_json: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO records (user_id, care_subject, input_text, output_json, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, care_subject, input_text, output_json, datetime.now().isoformat(timespec="seconds")),
            )

    def list_records(self, user_id: str = "demo_user", care_subject: str | None = None, limit: int = 12) -> list[dict]:
        query = "SELECT * FROM records WHERE user_id=?"
        params: list = [user_id]
        if care_subject:
            query += " AND care_subject=?"
            params.append(care_subject)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        records = []
        for row in rows:
            summary = ""
            try:
                output = json.loads(row["output_json"])
                summary = output.get("summary", "")
            except Exception:
                pass
            records.append(
                {
                    "id": row["id"],
                    "care_subject": row["care_subject"],
                    "input_text": row["input_text"] or "",
                    "summary": summary,
                    "created_at": row["created_at"],
                }
            )
        return records
