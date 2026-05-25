from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from datetime import date
from pathlib import Path

from pydantic import ValidationError

from .api_client import APIClient, CareRelayAPIError
from .fallback import build_offline_card, fallback_svg
from .memory import MemoryStore
from .memory_policy import filter_reusable_memory_suggestions, is_reusable_memory_text, normalize_memory_text
from .schemas import CareRelayCard, CompletedItem, EmotionAnalysis, ModelCall, TimelineItem, TodoItem


def _extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.IGNORECASE).replace("```", "").strip()
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE).strip()
    start = cleaned.find("{")
    if start < 0:
        raise ValueError("No JSON object found")
    depth = 0
    in_string = False
    escape = False
    for idx, char in enumerate(cleaned[start:], start=start):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(cleaned[start : idx + 1])
    raise ValueError("Unbalanced JSON object")


def _as_todo_items(items: list | None, default_owner: str = "家人") -> list[TodoItem]:
    normalized: list[TodoItem] = []
    for item in items or []:
        if isinstance(item, dict):
            payload = dict(item)
            payload["title"] = payload.get("title") or payload.get("task") or payload.get("content") or payload.get("item") or "待确认事项"
            payload["due_time"] = payload.get("due_time") or payload.get("time") or payload.get("deadline") or ""
            payload["owner"] = payload.get("owner") or default_owner
            payload["priority"] = payload.get("priority") or "medium"
            payload["status"] = payload.get("status") or "pending"
            payload["source"] = payload.get("source") or "AI"
            payload["safety_note"] = payload.get("safety_note") or payload.get("note") or ""
            normalized.append(TodoItem(**payload))
        elif isinstance(item, str):
            normalized.append(TodoItem(title=item, owner=default_owner))
    return normalized


def _as_completed_items(items: list | None) -> list[CompletedItem]:
    normalized: list[CompletedItem] = []
    for item in items or []:
        if isinstance(item, dict):
            payload = dict(item)
            payload["title"] = payload.get("title") or payload.get("task") or payload.get("content") or payload.get("item") or "已完成事项"
            payload["time"] = payload.get("time") or payload.get("due_time") or ""
            payload["source"] = payload.get("source") or "记录"
            normalized.append(CompletedItem(**payload))
        elif isinstance(item, str):
            normalized.append(CompletedItem(title=item))
    return normalized


def _as_timeline_items(items: list | None) -> list[TimelineItem]:
    normalized: list[TimelineItem] = []
    for item in items or []:
        if isinstance(item, dict):
            payload = dict(item)
            payload["time"] = payload.get("time") or payload.get("due_time") or "待定"
            payload["label"] = payload.get("label") or payload.get("title") or payload.get("event") or "照护事项"
            payload["type"] = payload.get("type") or "care"
            payload["detail"] = payload.get("detail") or payload.get("note") or ""
            normalized.append(TimelineItem(**payload))
        elif isinstance(item, str):
            normalized.append(TimelineItem(time="待定", label=item))
    return normalized


def _as_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = re.split(r"[；;。\n、]+", value)
        return [part.strip() for part in parts if part.strip()]
    return [str(value)]


def _as_int(value, default: int = 20) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match:
            return int(match.group(0))
    return default


def _as_float(value, default: float = 0.78) -> float:
    if isinstance(value, (int, float)):
        score = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        score = float(match.group(0)) if match else default
    else:
        score = default
    if score > 1:
        score /= 100
    return max(0, min(1, score))


def _normalize_emotion(value) -> EmotionAnalysis:
    if isinstance(value, str):
        return EmotionAnalysis(primary_tone=value, stress_points=_as_list(value))
    payload = dict(value or {})
    payload["primary_tone"] = str(payload.get("primary_tone") or payload.get("tone") or "需要确认")
    anxiety_level = _as_int(payload.get("anxiety_level"), 40)
    if 0 < anxiety_level <= 10:
        anxiety_level *= 10
    payload["anxiety_level"] = max(0, min(100, anxiety_level))
    payload["stress_points"] = _as_list(payload.get("stress_points"))
    payload["reassurance"] = str(payload.get("reassurance") or "信息已整理，关键不确定项请由家属确认。")
    return EmotionAnalysis(**payload)


class CareRelayPipeline:
    def __init__(self) -> None:
        self.client = APIClient()
        self.memory = MemoryStore(client=self.client)

    def process(
        self,
        *,
        text: str = "",
        care_subject: str = "爷爷",
        user_id: str = "demo_user",
        audio_path: Path | None = None,
        image_path: Path | None = None,
        use_visual: bool = True,
    ) -> tuple[CareRelayCard, list[str]]:
        trace: list[ModelCall] = []
        warnings: list[str] = []
        transcript = ""
        image_insights = ""

        if audio_path:
            try:
                transcript, audio_trace = self.client.transcribe_audio(audio_path)
                trace.extend(audio_trace)
            except Exception as exc:
                warnings.append(f"语音转写失败，已继续处理其他输入：{str(exc)[:120]}")

        if image_path:
            try:
                image_insights, vision_trace = self.client.analyze_image(image_path)
                trace.extend(vision_trace)
            except Exception as exc:
                warnings.append(f"图片理解失败，已继续处理其他输入：{str(exc)[:120]}")

        combined_text = "\n".join(part for part in [text.strip(), transcript.strip(), image_insights.strip()] if part)
        if not combined_text:
            card = build_offline_card(care_subject)
            card.model_trace = trace
            warnings.append("未提供有效输入，已展示离线样例。")
            return card, warnings

        memory_hits, memory_trace = self.memory.search(user_id, care_subject, combined_text)
        trace.extend(memory_trace)

        try:
            raw_card, analysis_trace = self._analyze(care_subject, combined_text, memory_hits)
            trace.extend(analysis_trace)
            card = self._normalize_card(raw_card, care_subject, transcript, image_insights, memory_hits)
        except Exception as exc:
            card = self._build_structured_local_card(care_subject, combined_text)
            card.risk_notes.append("请以当前输入记录为准；不确定事项先由现负责监护人确认后再执行。")
            card.transcript = transcript
            card.image_insights = image_insights

        self._merge_input_extractions(card, combined_text)
        self._apply_safety(card)
        self._apply_memory_policy(card, combined_text)

        if use_visual:
            visual_b64, visual_trace = self.client.generate_image(self._build_visual_prompt(card))
            trace.extend(visual_trace)
            card.visual_image_b64 = visual_b64
        if not card.visual_image_b64:
            card.visual_fallback_svg = fallback_svg(card)

        card.model_trace = trace
        try:
            self.memory.save_record(user_id, care_subject, combined_text, card.model_dump_json())
        except Exception:
            pass
        return card, warnings

    def _analyze(self, care_subject: str, combined_text: str, memory_hits: list) -> tuple[dict, list[ModelCall]]:
        memory_text = "\n".join(f"- {m.text}" for m in memory_hits) or "- 暂无可用个人记忆"
        today = date.today().isoformat()
        system = (
            "你是 CareRelay AI，家庭照护交接总控 Agent。你的任务是把文本、语音转写和图片理解结果融合成结构化交接卡。"
            "你只做信息整理、任务提醒、情感/沟通压力分析和安全边界提示，不做医疗诊断，不给药物剂量建议。"
            "涉及药物、症状、剂量、复诊时，必须使用“按医嘱执行/联系医生确认”的保守表达。"
            "所有不确定信息必须放入 to_confirm。输出必须是严格 JSON，不要 Markdown，不要解释。"
            "交接卡要具体、清晰、内容丰富，优先抽取时间、动作、负责人与待确认原因，禁止空泛套话。"
            "严格区分短期待办和长期记忆：todos 只放今天、今晚、明天、下一次这类一次性执行事项；"
            "memory_suggestions 只放可复用的长期规律、偏好、禁忌、每次复诊/睡前/喂药后的固定准备。"
            "不要把“今晚确认”“明天去做”“今天已完成”“发到家人群”等一次性事项写进 memory_suggestions。"
        )
        user = f"""
日期:{today}
对象:{care_subject}
个人记忆:{memory_text}
输入记录:{combined_text}

输出一个严格 JSON 对象，字段如下:
care_subject,date,summary,care_status,
emotion_analysis{{primary_tone,anxiety_level,stress_points,reassurance}},
completed[{{title,time,source}}],
to_confirm[{{title,due_time,owner,priority,status,source,safety_note}}],
todos[{{title,due_time,owner,priority,status,source,safety_note}}],
long_term_watch[{{title,due_time,owner,priority,status,source,safety_note}}],
abnormal_signals,risk_notes,family_message,voice_briefing,
interaction_questions,timeline[{{time,label,type,detail}}],
risk_radar{{medication,appointment,symptom,communication}},
visual_prompt,confidence,memory_suggestions。
质量要求: 内容具体清晰；summary写2句；completed/to_confirm/todos各2-5条；timeline至少4条；每条尽量含时间、动作、负责人；不确定事项放to_confirm并说明原因；药物/剂量只写按医嘱执行或联系医生确认；不要医疗诊断。long_term_watch 只放可复用的长期观察策略，不放今天/明天的一次性计划；memory_suggestions 最多3条，不以“记住：”开头，只输出之后多次生成交接卡仍有价值的经验。
""".strip()
        trace: list[ModelCall] = []
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]

        def run_model(model: str) -> tuple[str, dict | None, ModelCall]:
            start = time.time()
            timeout = 18 if model in {"gpt-5.5", "gpt-5.4"} else 16 if model.startswith("gpt-5") else 14
            try:
                content = self.client.chat_completion(
                    model,
                    messages,
                    temperature=0.1,
                    max_tokens=1600,
                    timeout=timeout,
                    response_format={"type": "json_object"},
                )
                parsed = _extract_json_object(content)
                return model, parsed, self.client._record("AnalysisAgent", model, "ok", start)
            except Exception as exc:
                last_error = str(exc)
                status = "invalid_json" if "JSON" in last_error or "object" in last_error else "failed"
                return model, None, self.client._record("AnalysisAgent", model, status, start, last_error)

        priority = {model: index for index, model in enumerate(self.client.models.analysis_models)}
        best_success: tuple[int, dict] | None = None
        last_error = ""
        executor = ThreadPoolExecutor(max_workers=len(self.client.models.analysis_models))
        futures = [executor.submit(run_model, model) for model in self.client.models.analysis_models]
        try:
            for future in as_completed(futures, timeout=20):
                model, parsed, call = future.result()
                trace.append(call)
                if parsed is not None:
                    rank = priority.get(model, 999)
                    if best_success is None or rank < best_success[0]:
                        best_success = (rank, parsed)
                    if rank == 0:
                        executor.shutdown(wait=False, cancel_futures=True)
                        return parsed, trace
                else:
                    last_error = call.detail
        except FuturesTimeoutError:
            last_error = last_error or "analysis model race timed out"
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        if best_success is not None:
            return best_success[1], trace
        raise CareRelayAPIError(last_error or "No valid JSON returned by analysis models")

    def _normalize_card(
        self,
        raw: dict,
        care_subject: str,
        transcript: str,
        image_insights: str,
        memory_hits: list,
    ) -> CareRelayCard:
        risk_radar = raw.get("risk_radar") or {}
        normalized_radar = {
            "medication": _as_int(risk_radar.get("medication"), 20) if isinstance(risk_radar, dict) else 20,
            "appointment": _as_int(risk_radar.get("appointment"), 20) if isinstance(risk_radar, dict) else 20,
            "symptom": _as_int(risk_radar.get("symptom"), 20) if isinstance(risk_radar, dict) else 20,
            "communication": _as_int(risk_radar.get("communication"), 20) if isinstance(risk_radar, dict) else 20,
        }
        card = CareRelayCard(
            care_subject=raw.get("care_subject") or care_subject,
            date=raw.get("date") or date.today().isoformat(),
            summary=raw.get("summary") or "今日照护信息已整理。",
            care_status=raw.get("care_status") or "需确认",
            emotion_analysis=_normalize_emotion(raw.get("emotion_analysis")),
            completed=_as_completed_items(raw.get("completed")),
            to_confirm=_as_todo_items(raw.get("to_confirm")),
            todos=_as_todo_items(raw.get("todos")),
            long_term_watch=_as_todo_items(raw.get("long_term_watch")),
            abnormal_signals=_as_list(raw.get("abnormal_signals")),
            risk_notes=_as_list(raw.get("risk_notes")),
            family_message=raw.get("family_message") or "今日照护信息已整理，请家人确认待办和不确定事项。",
            voice_briefing=raw.get("voice_briefing") or "今日照护交接已生成，请优先确认高风险待办。",
            interaction_questions=_as_list(raw.get("interaction_questions")),
            timeline=_as_timeline_items(raw.get("timeline")),
            risk_radar={k: max(0, min(100, v)) for k, v in normalized_radar.items()},
            visual_prompt=raw.get("visual_prompt") or "",
            confidence=_as_float(raw.get("confidence"), 0.78),
            memory_hits=memory_hits,
            memory_suggestions=filter_reusable_memory_suggestions(_as_list(raw.get("memory_suggestions"))),
            transcript=transcript,
            image_insights=image_insights,
        )
        if not card.timeline:
            card.timeline = self._timeline_from_card(card)
        if not card.visual_prompt:
            card.visual_prompt = self._build_visual_prompt(card)
        return card

    def _merge_input_extractions(self, card: CareRelayCard, combined_text: str) -> None:
        parsed = self._parse_input_text(combined_text)
        if not any(parsed.values()):
            return

        card.completed = self._merge_completed(parsed["completed"], card.completed)
        card.to_confirm = self._merge_todos(parsed["confirm"], card.to_confirm)
        card.todos = self._merge_todos(parsed["todo"], card.todos)

        extracted_timeline: list[TimelineItem] = []
        for item in parsed["completed"][:3]:
            extracted_timeline.append(TimelineItem(time=item.time or "已记录", label=item.title, type="done", detail="来自输入解析"))
        for item in parsed["confirm"][:3]:
            extracted_timeline.append(TimelineItem(time=item.due_time or "待确认", label=item.title, type="confirm", detail=item.safety_note))
        for item in parsed["todo"][:3]:
            extracted_timeline.append(TimelineItem(time=item.due_time or "待办", label=item.title, type="todo", detail=item.safety_note))
        card.timeline = self._merge_timeline(extracted_timeline, card.timeline)

    def _build_structured_local_card(self, care_subject: str, combined_text: str) -> CareRelayCard:
        card = build_offline_card(care_subject, combined_text)
        parsed = self._parse_input_text(combined_text)
        if parsed["completed"] or parsed["confirm"] or parsed["todo"]:
            card.completed = parsed["completed"] or card.completed
            card.to_confirm = parsed["confirm"] or card.to_confirm
            card.todos = parsed["todo"] or card.todos
            card.summary = (
                f"{care_subject}今日交接已整理："
                f"已完成{len(card.completed)}项、待确认{len(card.to_confirm)}项、下一步{len(card.todos)}项。"
                "请优先处理高优先级确认事项，并把执行结果同步给家人。"
            )
            card.family_message = (
                f"【{care_subject}今日交接】已完成："
                f"{'；'.join(item.title for item in card.completed[:2]) or '暂无明确完成项'}。"
                f"待确认：{'；'.join(item.title for item in card.to_confirm[:2]) or '暂无'}。"
                f"下一步：{'；'.join(item.title for item in card.todos[:2]) or '暂无'}。药物相关按医嘱执行。"
            )[:180]
            card.voice_briefing = (
                f"{care_subject}今日重点：请先确认"
                f"{card.to_confirm[0].title if card.to_confirm else '关键不确定事项'}，"
                f"随后执行{card.todos[0].title if card.todos else '下一步照护安排'}。"
            )
            card.timeline = self._timeline_from_card(card)
            card.care_status = "需确认" if card.to_confirm else "已整理"
            card.offline_mode = False
        return card

    def _parse_input_text(self, text: str) -> dict[str, list]:
        sentences = self._split_input_sentences(text)
        done_re = re.compile(r"(已完成|已经|已|做了|完成|吃了|喝了|睡了|喂了|测了|洗了|消毒)")
        confirm_re = re.compile(r"(待确认|没确认|未确认|还没确认|不确定|是否|确认一下|需要确认|还要确认|有没有)")
        todo_re = re.compile(r"(下一步|待做|待办|还要|需要|记得|提醒|准备|观察|复查|复诊|明天|加一个|新增|安排)")
        medicine_re = re.compile(r"(处方|药|服用|口服|饭前|饭后|每日|每天|一天|每次|剂量|片|粒|胶囊|ml|毫升|mg)")
        abnormal_re = re.compile(r"(疼|痛|吐|发烧|发热|咳|血压|血糖|哭闹|胀气|异常|不适|精神差)")

        completed: list[CompletedItem] = []
        confirm: list[TodoItem] = []
        todo: list[TodoItem] = []
        for sentence in sentences:
            title = self._clean_input_title(sentence)
            if len(title) < 2:
                continue
            due_time = self._infer_due_time(sentence)
            if confirm_re.search(sentence):
                confirm.append(
                    TodoItem(
                        title=title if title.startswith("确认") else f"确认{title}",
                        due_time=due_time or "尽快",
                        owner="现负责监护人",
                        priority="high" if medicine_re.search(sentence) or abnormal_re.search(sentence) else "medium",
                        source="输入解析",
                        safety_note="不确定信息先确认再执行；涉及药物请按医嘱或联系医生确认。" if medicine_re.search(sentence) else "请由当前监护人确认后同步给家人。",
                    )
                )
            elif done_re.search(sentence) and not todo_re.search(sentence):
                completed.append(CompletedItem(title=title, time=due_time, source="输入解析"))
            elif todo_re.search(sentence) or medicine_re.search(sentence):
                is_medicine = bool(medicine_re.search(sentence))
                todo.append(
                    TodoItem(
                        title=f"按原文确认用药安排：{title}" if is_medicine and "确认" not in title else title,
                        due_time=due_time or "待定",
                        owner="现负责监护人",
                        priority="high" if is_medicine or abnormal_re.search(sentence) else "medium",
                        source="输入解析",
                        safety_note="按医嘱执行；图片或处方信息不清楚时联系医生/家人确认。" if is_medicine else "",
                    )
                )
        return {"completed": completed[:8], "confirm": confirm[:8], "todo": todo[:8]}

    @staticmethod
    def _split_input_sentences(text: str) -> list[str]:
        cleaned = re.sub(r"【(?:语音转写|语音识别|图片解析)】", "。", text or "")
        marker_pattern = (
            r"(今天已经做了|今天已完成|已经做了|已完成|已做|"
            r"后续还要确认|后续需要确认|晚上还没确认|还没确认|没确认|未确认|还要确认|需要确认|待确认|"
            r"下一步待做|下一步|待做|待办|后续还要|还需要|需要)"
        )
        cleaned = re.sub(marker_pattern, r"。\1", cleaned)
        cleaned = re.sub(r"[，,](?=(?:早上|上午|中午|下午|晚上|今晚|后续|下一步|待|还要|需要|明天|晚上还没|还没确认|未确认|没确认|是否|已经|已完成))", "。", cleaned)
        return [
            part.strip(" \t\r\n：:，,。")
            for part in re.split(r"[。；;!?！？\n]+", cleaned)
            if part.strip(" \t\r\n：:，,。")
        ][:24]

    @staticmethod
    def _clean_input_title(sentence: str) -> str:
        title = re.sub(
            r"^(今天已经做了|今天已完成|已经做了|已完成|已做|做了|"
            r"后续还要确认|后续需要确认|晚上还没确认|还没确认|没确认|未确认|还要确认|需要确认|待确认|"
            r"下一步待做|下一步|待做|待办|后续还要|还需要|需要)",
            "",
            sentence,
        )
        return title.strip(" ：:，,。") or sentence.strip(" ：:，,。")

    @staticmethod
    def _infer_due_time(sentence: str) -> str:
        exact_times = ("今晚", "明早", "明晚", "明天上午", "明天中午", "明天下午", "明天晚上", "明天", "今天上午", "今天中午", "今天下午", "今天晚上", "上午", "中午", "下午", "晚上", "早上")
        for item in exact_times:
            if item in sentence:
                return item
        match = re.search(r"(\d{1,2}\s*(?:点|:|：)\s*\d{0,2})", sentence)
        return match.group(1).replace(" ", "") if match else ""

    @staticmethod
    def _merge_todos(extracted: list[TodoItem], current: list[TodoItem]) -> list[TodoItem]:
        titles = {item.title for item in current}
        merged = list(current)
        for item in reversed(extracted):
            if item.title not in titles:
                merged.insert(0, item)
                titles.add(item.title)
        return merged[:12]

    @staticmethod
    def _merge_completed(extracted: list[CompletedItem], current: list[CompletedItem]) -> list[CompletedItem]:
        titles = {item.title for item in current}
        merged = list(current)
        for item in reversed(extracted):
            if item.title not in titles:
                merged.insert(0, item)
                titles.add(item.title)
        return merged[:12]

    @staticmethod
    def _merge_timeline(extracted: list[TimelineItem], current: list[TimelineItem]) -> list[TimelineItem]:
        labels = {item.label for item in current}
        merged = list(current)
        for item in reversed(extracted):
            if item.label not in labels:
                merged.insert(0, item)
                labels.add(item.label)
        return merged[:12]

    def _apply_memory_policy(self, card: CareRelayCard, combined_text: str) -> None:
        candidates: list[str] = []
        candidates.extend(card.memory_suggestions)
        candidates.extend(item.title for item in card.long_term_watch)
        candidates.extend(self._extract_reusable_memory_candidates(combined_text))
        card.memory_suggestions = filter_reusable_memory_suggestions(candidates)

    def _extract_reusable_memory_candidates(self, text: str) -> list[str]:
        candidates: list[str] = []
        for sentence in self._split_input_sentences(text):
            value = normalize_memory_text(sentence)
            if is_reusable_memory_text(value):
                candidates.append(value)
        return candidates[:6]

    def _apply_safety(self, card: CareRelayCard) -> None:
        joined = " ".join([card.summary, card.family_message, *card.risk_notes, *(item.title for item in card.todos)])
        medicine_words = ("药", "服用", "剂量", "降压", "胰岛素", "处方")
        if any(word in joined for word in medicine_words) and not any("按医嘱" in note or "医生" in note for note in card.risk_notes):
            card.risk_notes.append("涉及药物、剂量或复诊安排时，请按医嘱执行；不确定时联系医生或家人确认。")
        prohibited = ["保证不会漏", "不用去医院", "一定没事", "再吃一次"]
        for word in prohibited:
            card.family_message = card.family_message.replace(word, "请进一步确认")
            card.voice_briefing = card.voice_briefing.replace(word, "请进一步确认")
        for item in card.to_confirm + card.todos:
            if any(word in item.title for word in medicine_words) and not item.safety_note:
                item.safety_note = "按医嘱执行；不确定时先联系家人或医生确认。"

    def _timeline_from_card(self, card: CareRelayCard) -> list[TimelineItem]:
        timeline: list[TimelineItem] = []
        for item in card.completed[:3]:
            timeline.append(TimelineItem(time=item.time or "已完成", label=item.title, type="done", detail=item.source))
        for item in card.to_confirm[:3]:
            timeline.append(TimelineItem(time=item.due_time or "待确认", label=item.title, type="confirm", detail=item.safety_note))
        for item in card.todos[:3]:
            timeline.append(TimelineItem(time=item.due_time or "待办", label=item.title, type="todo", detail=item.safety_note))
        return timeline

    def _build_visual_prompt(self, card: CareRelayCard) -> str:
        confirm = "；".join(item.title for item in card.to_confirm[:4]) or "暂无待确认事项"
        todos = "；".join(item.title for item in card.todos[:4]) or "暂无待办事项"
        risks = "；".join(card.risk_notes[:3]) or "按医嘱执行，关键事项由家属确认"
        abnormal = "；".join(card.abnormal_signals[:3]) or "暂无明确异常"
        timeline = "；".join(f"{item.time} {item.label}" for item in card.timeline[:5]) or "今日照护时间线"
        return (
            "Create a vivid, polished, detailed 1024x1024 Chinese caregiver handoff infographic, like a premium family-care app poster. "
            "Use a warm professional visual style, clear hierarchy, large readable Chinese headings, soft healthcare colors, clean icons, "
            "and an elegant dashboard composition. Make the key points obvious at a glance. "
            f"Title: {card.care_subject}今日照护交接. "
            f"Core summary: {card.summary}. "
            f"Timeline: {timeline}. "
            f"Must confirm: {confirm}. "
            f"Next actions: {todos}. "
            f"Abnormal signals: {abnormal}. "
            f"Safety notes: {risks}. "
            "Include visual sections for 已完成, 待确认, 下一步, 异常观察, 安全提醒, 家人群消息. "
            "Use meaningful caregiver icons such as medicine, calendar, meal, sleep, blood pressure, message, checklist. "
            "No medical diagnosis, no dosage recommendation, no clutter, no tiny unreadable text."
        )
