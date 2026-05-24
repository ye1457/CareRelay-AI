from __future__ import annotations

import base64
import html
from datetime import date

from .schemas import CareRelayCard, CompletedItem, EmotionAnalysis, MemoryHit, TimelineItem, TodoItem


SAMPLE_INPUTS = {
    "elder": {
        "subject": "爷爷",
        "text": "今天早上8点给爷爷吃了降压药，中午吃了一碗粥，下午血压有点高，晚上还没确认有没有吃药。明天上午9点要去医院复查，医保卡和病历本要提前放包里。",
    },
    "baby": {
        "subject": "宝宝",
        "text": "宝宝上午10点喝奶120ml，12点睡了40分钟，下午有点哭闹，晚上还没洗澡。奶瓶已经消毒，明天上午要观察有没有继续胀气。",
    },
    "pet": {
        "subject": "小猫",
        "text": "今天早上给猫喂了猫粮，下午吐了一次，精神还可以。晚上还没有喂药，明天要带去宠物医院复查，航空箱需要提前准备。",
    },
}


def fallback_svg(card: CareRelayCard | None = None) -> str:
    title = html.escape(card.care_subject if card else "照护对象")
    todos = len(card.todos) if card else 3
    confirms = len(card.to_confirm) if card else 2
    risks = len(card.risk_notes) if card else 2
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8efe4"/>
          <stop offset="54%" stop-color="#e9f6ef"/>
          <stop offset="100%" stop-color="#eef4fb"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="48" fill="url(#bg)"/>
      <rect x="82" y="92" width="860" height="840" rx="36" fill="#fffdf8" stroke="#dbe7df" stroke-width="4"/>
      <text x="126" y="168" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#243b3f">CareRelay 今日交接</text>
      <text x="126" y="226" font-family="Arial, sans-serif" font-size="34" fill="#5d706d">{title} · 信息已整理</text>
      <circle cx="246" cy="398" r="112" fill="#d8f1e4"/>
      <text x="246" y="382" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#17745c">{todos}</text>
      <text x="246" y="434" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#42635c">待办</text>
      <circle cx="512" cy="398" r="112" fill="#fff0cf"/>
      <text x="512" y="382" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#a16405">{confirms}</text>
      <text x="512" y="434" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#76572a">待确认</text>
      <circle cx="778" cy="398" r="112" fill="#ffe1dc"/>
      <text x="778" y="382" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#b64b3b">{risks}</text>
      <text x="778" y="434" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#78463f">风险</text>
      <line x1="170" y1="628" x2="854" y2="628" stroke="#cfe0d8" stroke-width="8" stroke-linecap="round"/>
      <circle cx="248" cy="628" r="22" fill="#1b8065"/>
      <circle cx="512" cy="628" r="22" fill="#df9c2f"/>
      <circle cx="776" cy="628" r="22" fill="#c85d4c"/>
      <text x="170" y="696" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#253b3d">已完成</text>
      <text x="430" y="696" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#253b3d">需确认</text>
      <text x="700" y="696" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#253b3d">下一步</text>
      <rect x="150" y="754" width="724" height="78" rx="24" fill="#edf7f2"/>
      <text x="512" y="805" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#244743">按医嘱执行 · 关键事项由家属确认</text>
    </svg>
    """
    return base64.b64encode(svg.encode("utf-8")).decode("ascii")


def build_offline_card(subject: str = "爷爷", text: str = "") -> CareRelayCard:
    today = date.today().isoformat()
    subject = subject or "爷爷"
    context = f"{subject} {text}"
    if text:
        lower_text = text
    elif any(word in subject for word in ("宝宝", "孩子", "婴儿")):
        lower_text = SAMPLE_INPUTS["baby"]["text"]
    elif any(word in subject for word in ("猫", "狗", "宠物")):
        lower_text = SAMPLE_INPUTS["pet"]["text"]
    else:
        lower_text = SAMPLE_INPUTS["elder"]["text"]
    card = CareRelayCard(
        care_subject=subject,
        date=today,
        summary=f"{subject}今日照护记录已整理：已识别用药/进食/观察事项，并发现晚间服药与复诊准备需要确认。",
        care_status="待确认",
        emotion_analysis=EmotionAnalysis(
            primary_tone="轻度焦虑但可控",
            anxiety_level=62,
            stress_points=["晚间服药情况不确定", "复诊前准备事项需要同步", "异常指标缺少具体数值"],
            reassurance="已将不确定事项单独列出，先确认再执行可以明显降低重复沟通和照护风险。",
        ),
        completed=[
            CompletedItem(title="08:00 已完成一次照护动作", time="08:00", source="文本记录"),
            CompletedItem(title="中午已完成进食/日常照护记录", time="12:00", source="文本记录"),
        ],
        to_confirm=[
            TodoItem(title="确认晚上是否已按医嘱服药", due_time="今晚", priority="high", safety_note="不确定是否服药时，不要自行重复服药。"),
            TodoItem(title="补充下午异常指标的具体数值", due_time="今晚", priority="medium", safety_note="记录具体时间和数值，便于复诊沟通。"),
        ],
        todos=[
            TodoItem(title="明天09:00 前往医院复诊", due_time="明天 09:00", priority="high", safety_note="提前准备医保卡、病历本和近期记录。"),
            TodoItem(title="把今日交接消息发到家人群", due_time="现在", priority="medium"),
        ],
        long_term_watch=[
            TodoItem(title="连续记录血压/睡眠/饮食变化", due_time="未来3天", priority="medium"),
        ],
        abnormal_signals=["下午出现血压偏高/状态异常线索，需要记录具体表现。"],
        risk_notes=[
            "涉及药物时请按医嘱执行；未确认服药状态前不要自行补服或重复服药。",
            "如出现明显不适或紧急症状，请及时就医。",
        ],
        family_message=f"【{subject}今日交接】早间照护已完成；晚上是否已服药仍需确认。明天09:00复诊，请提前准备医保卡、病历本，并记录下午异常情况的具体数值。药物相关请按医嘱执行。",
        voice_briefing=f"{subject}今日交接重点：请先确认晚上是否已经服药；明天九点复诊，提前准备医保卡和病历本。药物相关按医嘱执行，不确定时联系家人或医生确认。",
        interaction_questions=["今晚由谁确认服药情况？", "下午异常指标是否有具体数值？", "明天复诊谁陪同？"],
        timeline=[
            TimelineItem(time="08:00", label="已完成早间照护", type="done", detail="记录中出现明确完成事项。"),
            TimelineItem(time="下午", label="出现异常线索", type="risk", detail="需要补充具体数值或表现。"),
            TimelineItem(time="今晚", label="服药待确认", type="confirm", detail="确认前不要重复服药。"),
            TimelineItem(time="明天 09:00", label="医院复诊", type="todo", detail="准备证件和记录。"),
        ],
        risk_radar={"medication": 78, "appointment": 72, "symptom": 58, "communication": 68},
        visual_prompt=f"Warm polished caregiver handoff infographic for {subject}, showing completed care, pending confirmation, tomorrow appointment, medication safety, modern healthcare dashboard style.",
        confidence=0.72,
        memory_hits=[MemoryHit(text=f"{subject}常规复诊前需要准备医保卡和病历本。", label="demo", score=0.91)],
        memory_suggestions=[f"记住：{subject}复诊前需要准备医保卡和病历本。"],
        transcript="",
        image_insights="",
        offline_mode=True,
    )
    if "宝宝" in context or "宝宝" in lower_text or "孩子" in context or "婴儿" in context:
        card.care_status = "平稳观察"
        card.summary = f"{subject}今日照护记录已整理：已识别喝奶、睡眠、哭闹和晚间洗澡/胀气观察事项。"
        card.emotion_analysis = EmotionAnalysis(
            primary_tone="轻度担心但可安抚",
            anxiety_level=54,
            stress_points=["哭闹原因需要继续观察", "晚间洗澡尚未完成", "胀气情况需要明天复核"],
            reassurance="已把宝宝的吃睡和待办分开记录，照护人可以按时间逐项确认。",
        )
        card.completed = [
            CompletedItem(title="上午10:00 已喝奶约120ml", time="10:00", source="样例记录"),
            CompletedItem(title="12:00 已睡约40分钟", time="12:00", source="样例记录"),
            CompletedItem(title="奶瓶已完成消毒", time="下午", source="样例记录"),
        ]
        card.to_confirm = [
            TodoItem(title="确认晚间是否已经洗澡", due_time="今晚", priority="medium"),
            TodoItem(title="确认哭闹是否伴随持续胀气或明显不适", due_time="今晚", priority="high", safety_note="如持续哭闹、发热或明显不适，请联系医生确认。"),
        ]
        card.todos = [
            TodoItem(title="明天继续观察胀气和吃奶状态", due_time="明天上午", priority="medium"),
            TodoItem(title="记录下一次喝奶时间和奶量", due_time="下一次喂奶", priority="medium"),
        ]
        card.long_term_watch = [TodoItem(title="连续记录喝奶量、睡眠时长和哭闹时段", due_time="未来3天", priority="medium")]
        card.abnormal_signals = ["下午有哭闹和疑似胀气线索，需要结合体温、吃奶和排便继续观察。"]
        card.risk_notes = ["宝宝若出现持续哭闹、发热、精神差或吃奶明显减少，请及时联系医生。"]
        card.family_message = f"【{subject}今日交接】上午已喝奶120ml，中午睡40分钟，奶瓶已消毒。今晚请确认是否洗澡，并观察哭闹/胀气是否持续；异常时联系医生。"
        card.voice_briefing = f"{subject}今日交接重点：已记录喝奶和睡眠，今晚请确认洗澡，明天继续观察胀气和哭闹情况。"
        card.interaction_questions = ["今晚由谁负责洗澡？", "哭闹时是否伴随发热或吃奶减少？", "下一次喂奶预计几点？"]
        card.timeline = [
            TimelineItem(time="10:00", label="喝奶120ml", type="done", detail="记录奶量。"),
            TimelineItem(time="12:00", label="睡眠40分钟", type="done", detail="记录睡眠。"),
            TimelineItem(time="今晚", label="洗澡待确认", type="confirm", detail="由当前监护人确认。"),
            TimelineItem(time="明天上午", label="观察胀气", type="todo", detail="记录哭闹、排便、吃奶情况。"),
        ]
        card.risk_radar = {"medication": 10, "appointment": 18, "symptom": 48, "communication": 42}
        card.memory_hits = [MemoryHit(text=f"{subject}睡前需要先拍嗝并记录最后一次喝奶时间。", label="demo", score=0.91)]
        card.memory_suggestions = [f"记住：{subject}睡前需要拍嗝并记录最后一次喝奶时间。"]
        card.visual_prompt = f"Warm polished baby care handoff infographic for {subject}, milk, sleep, bath, crying observation, family timeline."
    if "猫" in context or "宠物" in context or "狗" in context or "猫" in lower_text or "宠物" in lower_text:
        card.care_status = "异常观察"
        card.summary = f"{subject}今日照护记录已整理：已识别喂食、呕吐、晚间喂药待确认和明日就医准备。"
        card.emotion_analysis = EmotionAnalysis(
            primary_tone="担心但可追踪",
            anxiety_level=58,
            stress_points=["下午呕吐一次", "晚间喂药尚未确认", "明日复查需要准备外出物品"],
            reassurance="已把异常观察和就医准备列成清单，先记录频次和精神状态更利于沟通。",
        )
        card.completed = [
            CompletedItem(title="早上已完成喂食", time="早上", source="样例记录"),
        ]
        card.to_confirm = [
            TodoItem(title="确认晚上是否已按医嘱喂药", due_time="今晚", priority="high", safety_note="药物请按兽医医嘱执行；不确定时不要重复喂药。"),
            TodoItem(title="确认呕吐后精神、食欲和饮水是否变化", due_time="今晚", priority="high"),
        ]
        card.todos = [
            TodoItem(title="明天带去宠物医院复查", due_time="明天", priority="high"),
            TodoItem(title="提前准备航空箱、病历和今日呕吐记录", due_time="今晚", priority="medium"),
        ]
        card.long_term_watch = [TodoItem(title="连续记录食欲、排便、呕吐次数和精神状态", due_time="未来3天", priority="medium")]
        card.abnormal_signals = ["下午呕吐一次，需要观察是否反复、是否精神变差。"]
        card.risk_notes = ["若反复呕吐、精神明显变差或不进食，请及时联系宠物医生。"]
        card.family_message = f"【{subject}今日交接】早上已喂食，下午呕吐一次。今晚请确认是否已按医嘱喂药，并记录精神/食欲；明天复查，提前准备航空箱和病历。"
        card.voice_briefing = f"{subject}今日交接重点：今晚确认喂药和精神食欲，明天去宠物医院复查，提前准备航空箱和病历。"
        card.interaction_questions = ["今晚由谁确认喂药？", "呕吐后是否继续进食喝水？", "明天谁负责带去复查？"]
        card.timeline = [
            TimelineItem(time="早上", label="已喂食", type="done", detail="记录喂食。"),
            TimelineItem(time="下午", label="呕吐一次", type="risk", detail="记录精神和食欲。"),
            TimelineItem(time="今晚", label="喂药待确认", type="confirm", detail="按兽医医嘱执行。"),
            TimelineItem(time="明天", label="宠物医院复查", type="todo", detail="准备航空箱和病历。"),
        ]
        card.risk_radar = {"medication": 70, "appointment": 62, "symptom": 66, "communication": 50}
        card.memory_hits = [MemoryHit(text=f"{subject}外出复查前需要准备航空箱和既往病历。", label="demo", score=0.9)]
        card.memory_suggestions = [f"记住：{subject}复查前准备航空箱和既往病历。"]
        card.visual_prompt = f"Warm polished pet care handoff infographic for {subject}, feeding, vomiting observation, medication confirmation, vet appointment."
    card.visual_fallback_svg = fallback_svg(card)
    return card
