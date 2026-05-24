const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  samples: {},
  audioBlob: null,
  imageFile: null,
  imageInsights: "",
  imageInspected: false,
  audioDecoded: false,
  lastCard: null,
  mediaRecorder: null,
  micStream: null,
  recordedChunks: [],
  speechRecognition: null,
  recognizing: false,
  browserSpeechText: "",
  audioTranscribing: false,
  draftTimer: null,
  subjectTimer: null,
  videoStream: null,
  progressTimer: null,
};

const progressSteps = [
  "正在收集多模态输入",
  "正在整理语音内容",
  "正在解析图片内容",
  "检索个人知识库",
  "正在生成交接卡",
  "准备可视化占位",
  "整理家人群消息",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.remove("hidden");
  setTimeout(() => node.classList.add("hidden"), 2200);
}

function priorityText(priority) {
  return { high: "高优先级", medium: "中优先级", low: "低优先级" }[priority] || priority || "中优先级";
}

function riskName(key) {
  return {
    medication: "药物",
    appointment: "复诊",
    symptom: "异常",
    communication: "沟通",
  }[key] || key;
}

function imageSrc(card) {
  if (card.visual_image_b64) return `data:image/png;base64,${card.visual_image_b64}`;
  if (card.visual_fallback_svg) return `data:image/svg+xml;base64,${card.visual_fallback_svg}`;
  return "";
}

function setProgress(active) {
  const box = $("#progressBox");
  const btn = $("#analyzeBtn");
  if (!active) {
    clearInterval(state.progressTimer);
    box.classList.add("hidden");
    btn.classList.remove("loading");
    btn.disabled = false;
    return;
  }
  let idx = 0;
  box.classList.remove("hidden");
  btn.classList.add("loading");
  btn.disabled = true;
  $("#progressText").textContent = progressSteps[idx];
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(() => {
    idx = (idx + 1) % progressSteps.length;
    $("#progressText").textContent = progressSteps[idx];
  }, 1300);
}

async function loadSamples() {
  const res = await fetch("/api/samples");
  state.samples = await res.json();
}

async function applySample(key) {
  const sample = state.samples[key];
  if (!sample) return;
  $("#sceneSelect").value = key;
  $("#subjectInput").value = sample.subject;
  $("#careText").value = sample.text;
  updateSubjectHints();
  await refreshSubjectCard();
  updateDraftFromInput();
}

async function refreshSubjectCard() {
  const subject = $("#subjectInput").value || "爷爷";
  updateSubjectHints();
  const res = await fetch(`/api/offline-card?care_subject=${encodeURIComponent(subject)}`);
  const card = await res.json();
  renderResult(card, []);
  await Promise.all([loadMemories(), loadHistory()]);
}

async function loadMemories() {
  const subject = encodeURIComponent($("#subjectInput").value || "爷爷");
  const res = await fetch(`/api/memory?user_id=demo_user&care_subject=${subject}`);
  const data = await res.json();
  renderMemoryHits(data.memories || [], "memoryHits");
  updateSubjectHints();
}

async function loadHistory() {
  const subject = encodeURIComponent($("#subjectInput").value || "");
  const res = await fetch(`/api/history?user_id=demo_user&care_subject=${subject}&limit=8`);
  const data = await res.json();
  renderHistory(data.records || []);
}

function renderMemoryHits(memories, targetId = "memoryHits") {
  const node = $(`#${targetId}`);
  if (!node) return;
  if (!memories.length) {
    node.innerHTML = `<div class="memory-item"><span>暂无已保存记忆</span></div>`;
    return;
  }
  node.innerHTML = memories
    .map(
      (item) => `
      <div class="memory-item">
        <span>${escapeHtml(item.text)}<br><small>${escapeHtml(item.label)} · ${(item.score || 1).toFixed(2)}</small></span>
        ${item.id ? `<button data-delete-memory="${item.id}">删除</button>` : ""}
      </div>
    `,
    )
    .join("");
}

function updateSubjectHints() {
  const subject = $("#subjectInput")?.value || "爷爷";
  const hint = $("#memorySubjectHint");
  if (hint) hint.textContent = `当前对象：${subject}。这里保存的偏好和常规事项只会用于这个对象。`;
}

async function saveMemory(text) {
  const payload = {
    user_id: "demo_user",
    care_subject: $("#subjectInput").value || "爷爷",
    text,
    label: "confirmed",
  };
  const res = await fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("save memory failed");
  const data = await res.json();
  renderMemoryHits(data.memories || []);
  toast("已保存到个人知识库");
}

async function saveManualMemory() {
  const text = ($("#manualMemoryText")?.value || "").trim();
  if (!text) {
    toast("请先填写要记住的内容");
    return;
  }
  await saveMemory(text);
  $("#manualMemoryText").value = "";
}

async function deleteMemory(id) {
  const res = await fetch(`/api/memory/${id}?user_id=demo_user`, { method: "DELETE" });
  if (!res.ok) throw new Error("delete memory failed");
  await loadMemories();
  toast("已删除记忆");
}

function appendDecodedText(title, content) {
  const text = (content || "").trim();
  if (!text) return;
  const textarea = $("#careText");
  const prefix = textarea.value.trim() ? "\n\n" : "";
  textarea.value = `${textarea.value.trim()}${prefix}${title}\n${text}`;
  textarea.dispatchEvent(new Event("input"));
}

async function transcribeAudioFile(fileOrBlob, filename = "care-audio.webm") {
  if (!fileOrBlob) return;
  if (state.audioTranscribing) return;
  const form = new FormData();
  form.append("audio", fileOrBlob, filename);
  state.audioTranscribing = true;
  $("#audioStatus").textContent = "后台转写中，可继续输入或先生成";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
    const data = await res.json();
    if (data.ok && data.transcript) {
      state.audioDecoded = true;
      $("#audioStatus").textContent = "语音已转写到文本框";
      appendDecodedText("【语音转写】", data.transcript);
      toast("语音已转写");
    } else {
      state.audioDecoded = false;
      $("#audioStatus").textContent = "转写失败，生成时仍会尝试处理音频";
      toast((data.warnings || ["语音转写失败"])[0]);
    }
  } catch (error) {
    state.audioDecoded = false;
    $("#audioStatus").textContent = error.name === "AbortError" ? "转写时间较长，可先手动补充或继续生成" : "转写失败，可继续录音或上传";
    toast(error.name === "AbortError" ? "语音正在后台处理，先不阻塞操作" : `语音转写失败：${error.message}`);
  } finally {
    clearTimeout(timer);
    state.audioTranscribing = false;
  }
}

async function inspectImageFile(file) {
  if (!file) return;
  const form = new FormData();
  form.append("image", file, file.name || "care-image.png");
  $("#imageStatus").textContent = "正在解析图片";
  $("#imageInsightsBox").classList.remove("hidden");
  $("#imageInsightsBox").textContent = "正在读取图片中的照护信息...";
  try {
    const res = await fetch("/api/inspect-image", { method: "POST", body: form });
    const data = await res.json();
    if (data.ok && data.insights) {
      state.imageInsights = data.insights;
      state.imageInspected = true;
      $("#imageStatus").textContent = "图片信息已加入文本框";
      $("#imageInsightsBox").textContent = data.insights;
      appendDecodedText("【图片解析】", data.insights);
      toast("图片内容已解析");
    } else {
      state.imageInspected = false;
      $("#imageStatus").textContent = "图片解析失败，生成时仍会尝试处理图片";
      $("#imageInsightsBox").textContent = (data.warnings || ["图片解析失败"])[0];
      toast((data.warnings || ["图片解析失败"])[0]);
    }
  } catch (error) {
    state.imageInspected = false;
    $("#imageStatus").textContent = "图片解析失败，生成时仍会尝试处理图片";
    $("#imageInsightsBox").textContent = `图片解析失败：${error.message}`;
    toast(`图片解析失败：${error.message}`);
  }
}

async function setupRecorder() {
  const recordBtn = $("#recordBtn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    state.speechRecognition = recognition;
    recognition.onstart = () => {
      state.recognizing = true;
      state.browserSpeechText = "";
    };
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) state.browserSpeechText += text;
        else interim += text;
      }
      $("#audioStatus").textContent = interim ? `识别中：${interim}` : "正在识别中文语音";
    };
    recognition.onerror = (event) => {
      state.recognizing = false;
      $("#audioStatus").textContent = `浏览器识别不可用，仍在录音：${event.error || "unknown"}`;
    };
    recognition.onend = () => {
      state.recognizing = false;
      if (state.browserSpeechText.trim()) {
        state.audioDecoded = true;
        appendDecodedText("【语音识别】", state.browserSpeechText.trim());
      }
    };
  }

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    recordBtn.disabled = true;
    $("#audioStatus").textContent = "浏览器不支持录音，可上传音频";
    return;
  }
  recordBtn.addEventListener("click", async () => {
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      if (state.speechRecognition && state.recognizing) {
        try {
          state.speechRecognition.stop();
        } catch (_) {}
      }
      recordBtn.classList.remove("recording");
      $("#audioStatus").textContent = "录音结束，正在整理语音";
      setTimeout(() => {
        if (state.mediaRecorder && state.mediaRecorder.state === "recording") state.mediaRecorder.stop();
      }, 450);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      state.micStream = stream;
      state.recordedChunks = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      state.mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size) state.recordedChunks.push(event.data);
      };
      state.mediaRecorder.onerror = () => {
        $("#audioStatus").textContent = "录音失败，请检查浏览器麦克风权限";
      };
      state.mediaRecorder.onstop = async () => {
        state.audioBlob = new Blob(state.recordedChunks, { type: "audio/webm" });
        state.micStream?.getTracks().forEach((track) => track.stop());
        state.micStream = null;
        if (state.browserSpeechText.trim()) {
          $("#audioStatus").textContent = "浏览器已识别，同时保留录音";
          toast("语音已识别");
        } else {
          $("#audioStatus").textContent = `已录制 ${(state.audioBlob.size / 1024).toFixed(1)} KB，后台转写中`;
          transcribeAudioFile(state.audioBlob, "care-recording.webm");
        }
      };
      state.browserSpeechText = "";
      state.audioDecoded = false;
      state.mediaRecorder.start();
      if (state.speechRecognition) {
        try {
          state.speechRecognition.start();
        } catch (_) {}
      }
      recordBtn.classList.add("recording");
      $("#audioStatus").textContent = "录音中，再点一次停止";
    } catch (error) {
      $("#audioStatus").textContent = "无法访问麦克风，请在浏览器地址栏允许麦克风权限";
      toast(`无法访问麦克风：${error.message}`);
    }
  });
}

function setupUploads() {
  $("#audioUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    state.audioBlob = null;
    state.audioDecoded = false;
    $("#audioStatus").textContent = file ? file.name : "未录制";
    if (file) transcribeAudioFile(file, file.name);
  });
  $("#imageUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    state.imageFile = file || null;
    state.imageInsights = "";
    state.imageInspected = false;
    $("#imageStatus").textContent = file ? file.name : "药盒 / 复诊单 / 截图";
    const preview = $("#imagePreview");
    if (!file) {
      preview.classList.add("hidden");
      return;
    }
    preview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
    preview.classList.remove("hidden");
    inspectImageFile(file);
  });
}

async function analyze() {
  setProgress(true);
  const wantsVisual = $("#visualToggle").checked;
  const form = new FormData();
  form.append("care_subject", $("#subjectInput").value || "爷爷");
  form.append("user_id", "demo_user");
  form.append("text", $("#careText").value || "");
  form.append("use_visual", "false");
  if (state.audioTranscribing) {
    toast("语音仍在后台转写，本次先使用已有文本");
  } else if (state.audioBlob && !state.audioDecoded) {
    form.append("audio", state.audioBlob, "care-recording.webm");
  } else if ($("#audioUpload").files[0] && !state.audioDecoded) {
    form.append("audio", $("#audioUpload").files[0]);
  }
  if (state.imageFile && !state.imageInspected) form.append("image", state.imageFile);

  try {
    const res = await fetch("/api/analyze", { method: "POST", body: form });
    const data = await res.json();
    renderResult(data.card, data.warnings || []);
    loadHistory();
    if (wantsVisual) generateVisualAsync(data.card);
    toast(data.ok ? "交接卡已生成" : "已显示兜底结果");
  } catch (error) {
    toast(`生成失败：${error.message}`);
  } finally {
    setProgress(false);
  }
}

function renderResult(card, warnings = []) {
  state.hasGenerated = true;
  state.lastCard = card;
  $("#copyMessageBtn").disabled = false;
  $("#speakBtn").disabled = false;
  $("#careStatus").textContent = card.care_status || "需确认";
  $("#cardDate").textContent = card.date || "今日";
  $("#cardSubject").textContent = `${card.care_subject || "照护对象"}今日交接`;
  $("#summaryText").textContent = card.summary || "";
  const score = healthIndex(card);
  $("#statusScore").textContent = score;
  $("#statusRing").style.setProperty("--score", score);

  if (warnings.length) {
    $("#warnings").classList.remove("hidden");
    $("#warnings").innerHTML = warnings.map((item) => `<div>${escapeHtml(item)}</div>`).join("");
  } else {
    $("#warnings").classList.add("hidden");
  }

  renderTimeline(card.timeline || []);
  renderTaskList(card.to_confirm || [], "confirmList");
  renderTaskList(card.todos || [], "todoList");
  renderCompleted(card.completed || []);
  renderEmotion(card.emotion_analysis || {});
  renderRisks(card.risk_radar || {});
  renderVisual(card);
  $("#familyMessage").textContent = card.family_message || "";
  renderMemoryHits(card.memory_hits || []);
  renderSuggestions(card.memory_suggestions || []);
  renderQuestions(card.interaction_questions || []);
}

function splitCareSentences(text) {
  const markerPattern = /(今天已经做了|今天已完成|已经做了|已完成|已做|后续还要确认|后续需要确认|晚上还没确认|还没确认|没确认|未确认|还要确认|需要确认|待确认|下一步待做|下一步|待做|待办|后续还要|还需要|需要)/g;
  return (text || "")
    .replace(/【(?:语音转写|语音识别|图片解析)】/g, "。")
    .replace(markerPattern, "。$1")
    .replace(/[，,](?=(?:早上|上午|中午|下午|晚上|今晚|后续|下一步|待|还要|需要|明天|晚上还没|还没确认|未确认|没确认|是否|已经|已完成))/g, "。")
    .replace(/\n+/g, "。")
    .split(/[。；;.!?？]/)
    .map((item) => item.trim().replace(/^[：:，,。]+|[：:，,。]+$/g, ""))
    .filter(Boolean)
    .slice(-24);
}

function cleanDraftTitle(sentence) {
  return (
    sentence
      .replace(/^(今天已经做了|今天已完成|已经做了|已完成|已做|做了|后续还要确认|后续需要确认|晚上还没确认|还没确认|没确认|未确认|还要确认|需要确认|待确认|下一步待做|下一步|待做|待办|后续还要|还需要|需要)/, "")
      .replace(/^[：:，,。]+|[：:，,。]+$/g, "")
      .trim() || sentence
  );
}

function inferDueTime(sentence) {
  const words = ["今晚", "明早", "明晚", "明天上午", "明天中午", "明天下午", "明天晚上", "明天", "今天上午", "今天中午", "今天下午", "今天晚上", "上午", "中午", "下午", "晚上", "早上"];
  const found = words.find((word) => sentence.includes(word));
  if (found) return found;
  const match = sentence.match(/(\d{1,2}\s*(?:点|:|：)\s*\d{0,2})/);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function healthIndex(card) {
  const risks = card?.risk_radar || {};
  const values = ["medication", "appointment", "symptom", "communication"]
    .map((key) => Number(risks[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return Math.round((card?.confidence || 0.72) * 100);
  const riskAverage = values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length;
  const pendingPenalty = Math.min(16, (card.to_confirm || []).length * 3);
  return Math.max(35, Math.min(98, Math.round(100 - riskAverage * 0.48 - pendingPenalty)));
}

function buildDraftItems() {
  const text = $("#careText").value || "";
  const sentences = splitCareSentences(text);
  const confirmWords = /(不确定|没确认|未确认|是否|还没|待确认|确认一下|需要确认|还要确认|有没有)/;
  const todoWords = /(下一步|待做|待办|还要|需要|要去|要带|记得|提醒|明天|加一个|新增|添加|加上|加入|准备|观察|复查|复诊|喂药|洗澡|测|安排)/;
  const doneWords = /(已完成|已经|已|吃了|喝了|睡了|完成|做了|喂了|测了|洗了|消毒)/;
  const medicineWords = /(处方|药|服用|口服|饭前|饭后|每日|每天|一天|每次|剂量|片|粒|胶囊|ml|毫升|mg)/i;
  const abnormalWords = /(疼|痛|吐|发烧|发热|咳|血压|血糖|哭闹|胀气|异常|不适|精神差)/;
  const confirms = [];
  const todos = [];
  const completed = [];
  sentences.forEach((sentence) => {
    const title = cleanDraftTitle(sentence);
    const due = inferDueTime(sentence);
    const isMedicine = medicineWords.test(sentence);
    const isAbnormal = abnormalWords.test(sentence);
    if (confirmWords.test(sentence)) {
      confirms.push({
        title: title.startsWith("确认") ? title : `确认${title}`,
        due_time: due || "尽快",
        owner: "现负责监护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: isMedicine ? "按医嘱执行；不确定时联系医生或家人确认。" : "输入预览，生成后会进一步校验。",
      });
    } else if (doneWords.test(sentence) && !todoWords.test(sentence)) {
      completed.push({ title, time: due, source: "输入预览" });
    } else if (todoWords.test(sentence) || isMedicine) {
      todos.push({
        title: isMedicine && !title.includes("确认") ? `按原文确认用药安排：${title}` : title,
        due_time: due || "待定",
        owner: "现负责监护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: isMedicine ? "按医嘱执行；图片或处方信息不清楚时联系医生/家人确认。" : "",
      });
    }
  });
  return { confirms: confirms.slice(-8), todos: todos.slice(-10), completed: completed.slice(-8) };
}

function updateDraftFromInput() {
  const text = ($("#careText").value || "").trim();
  if (!text) return;
  const draft = buildDraftItems();
  $("#summaryText").textContent = `已读取输入内容，发现 ${draft.todos.length} 条可能待办、${draft.confirms.length} 条待确认。点击生成可获得完整交接卡。`;
  $("#careStatus").textContent = draft.confirms.length ? "需确认" : "输入预览";
  renderTaskList(draft.confirms, "confirmList");
  renderTaskList(draft.todos, "todoList");
  renderCompleted(draft.completed);
  const timeline = [...draft.completed.map((item) => ({ time: "已记录", label: item.title, type: "done", detail: "来自输入预览" })), ...draft.todos.map((item) => ({ time: item.due_time, label: item.title, type: "todo", detail: "来自输入预览" }))].slice(-6);
  renderTimeline(timeline);
}

function scheduleDraftUpdate() {
  state.hasGenerated = false;
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(updateDraftFromInput, 260);
}

function renderTimeline(items) {
  const node = $("#timeline");
  if (!items.length) {
    node.innerHTML = `<div class="timeline-item"><div class="time-chip">待定</div><div><h4>暂无时间线</h4><p>生成后会显示照护事件。</p></div></div>`;
    return;
  }
  node.innerHTML = items
    .map(
      (item) => `
      <div class="timeline-item ${escapeHtml(item.type || "care")}">
        <div class="time-chip">${escapeHtml(item.time || "待定")}</div>
        <div>
          <h4>${escapeHtml(item.label || "")}</h4>
          <p>${escapeHtml(item.detail || "")}</p>
        </div>
      </div>
    `,
    )
    .join("");
}

function renderTaskList(items, targetId) {
  const node = $(`#${targetId}`);
  if (!items.length) {
    node.innerHTML = `<div class="task-item"><div class="task-title">暂无事项</div></div>`;
    return;
  }
  node.innerHTML = items
    .map(
      (item) => `
      <div class="task-item">
        <label class="task-title">
          <input type="checkbox" />
          <span>${escapeHtml(item.title)}</span>
        </label>
        <div class="task-meta">
          <span>${escapeHtml(item.due_time || "时间待定")}</span>
          <span>${escapeHtml(item.owner || "家人")}</span>
          <span>${priorityText(item.priority)}</span>
        </div>
        ${item.safety_note ? `<p class="task-note">${escapeHtml(item.safety_note)}</p>` : ""}
      </div>
    `,
    )
    .join("");
}

function renderCompleted(items) {
  const node = $("#completedList");
  if (!items.length) {
    node.innerHTML = `<span class="completed-pill">暂无明确完成事项</span>`;
    return;
  }
  node.innerHTML = items
    .map((item) => `<span class="completed-pill">${escapeHtml(item.time || "")} ${escapeHtml(item.title || item)}</span>`)
    .join("");
}

function renderEmotion(emotion) {
  $("#emotionTone").textContent = emotion.primary_tone || "需要确认";
  $("#anxietyValue").textContent = emotion.anxiety_level ?? 40;
  $(".anxiety-meter").style.setProperty("--anxiety", emotion.anxiety_level ?? 40);
  $("#emotionNote").textContent = emotion.reassurance || "";
  const points = emotion.stress_points || [];
  $("#stressPoints").innerHTML = points.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function renderRisks(risks) {
  const node = $("#riskBars");
  const entries = Object.entries({
    medication: risks.medication ?? 20,
    appointment: risks.appointment ?? 20,
    symptom: risks.symptom ?? 20,
    communication: risks.communication ?? 20,
  });
  node.innerHTML = entries
    .map(
      ([key, value]) => `
      <div class="risk-row">
        <span>${riskName(key)}</span>
        <div class="risk-track"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>
        <strong>${value}</strong>
      </div>
    `,
    )
    .join("");
}

function renderVisual(card) {
  const src = imageSrc(card);
  if (src) $("#visualImage").src = src;
  else $("#visualImage").removeAttribute("src");
  $("#visualBadge").textContent = card.visual_image_b64 ? "已生成" : "备用图";
}

async function generateVisualAsync(card) {
  if (!card) return;
  const currentCard = card;
  $("#visualBadge").textContent = "生成中";
  const payload = { ...card, visual_image_b64: "", visual_fallback_svg: "", model_trace: [] };
  try {
    const res = await fetch("/api/generate-visual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (state.lastCard !== currentCard) return;
    if (data.ok && data.visual_image_b64) {
      state.lastCard.visual_image_b64 = data.visual_image_b64;
      renderVisual(state.lastCard);
      toast("信息图已生成");
    } else {
      $("#visualBadge").textContent = "备用图";
      toast((data.warnings || ["信息图生成较慢，已保留备用图"])[0]);
    }
  } catch (error) {
    if (state.lastCard === currentCard) {
      $("#visualBadge").textContent = "备用图";
      toast(`信息图生成失败：${error.message}`);
    }
  }
}

function renderSuggestions(items) {
  const node = $("#memorySuggestions");
  if (!items.length) {
    node.innerHTML = "";
    return;
  }
  node.innerHTML = items
    .map(
      (item) => `
      <div class="suggestion-item">
        <span>${escapeHtml(item)}</span>
        <button data-save-memory="${escapeHtml(item)}">保存</button>
      </div>
    `,
    )
    .join("");
}

function renderQuestions(items) {
  const node = $("#questionList");
  if (!node) return;
  if (!items.length) {
    node.innerHTML = `<div class="question-item">暂无追问</div>`;
    return;
  }
  node.innerHTML = items.map((item) => `<div class="question-item">${escapeHtml(item)}</div>`).join("");
}

function renderHistory(records) {
  const node = $("#historyList");
  if (!records.length) {
    node.innerHTML = `<div class="history-item">暂无历史交接记录</div>`;
    return;
  }
  node.innerHTML = records
    .map(
      (item) => `
      <div class="history-item">
        <strong>${escapeHtml(item.care_subject)} · ${escapeHtml(item.created_at)}</strong>
        <p>${escapeHtml(item.summary || item.input_text || "已生成交接记录")}</p>
      </div>
    `,
    )
    .join("");
}

function speak() {
  if (!state.lastCard) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(state.lastCard.voice_briefing || state.lastCard.family_message || "");
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function copyMessage() {
  const message = state.lastCard?.family_message || $("#familyMessage").textContent;
  navigator.clipboard.writeText(message).then(() => toast("已复制家人群消息"));
}

function setupEvents() {
  $$(".sample-chip").forEach((button) => button.addEventListener("click", () => applySample(button.dataset.sample)));
  $("#sceneSelect").addEventListener("change", (event) => applySample(event.target.value));
  $("#analyzeBtn").addEventListener("click", analyze);
  $("#speakBtn").addEventListener("click", speak);
  $("#copyMessageBtn").addEventListener("click", copyMessage);
  $("#refreshMemoryBtn").addEventListener("click", loadMemories);
  $("#refreshHistoryBtn").addEventListener("click", loadHistory);
  $("#saveManualMemoryBtn").addEventListener("click", saveManualMemory);
  $("#careText").addEventListener("input", scheduleDraftUpdate);
  $("#subjectInput").addEventListener("change", refreshSubjectCard);
  $("#subjectInput").addEventListener("input", () => {
    updateSubjectHints();
    clearTimeout(state.subjectTimer);
    state.subjectTimer = setTimeout(refreshSubjectCard, 520);
  });
  $("#visualImage").addEventListener("click", () => {
    const src = $("#visualImage").src;
    if (!src) return;
    $("#lightboxImage").src = src;
    $("#imageLightbox").classList.remove("hidden");
  });
  $("#imageLightbox").addEventListener("click", () => $("#imageLightbox").classList.add("hidden"));
  $$(".rail-btn").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });
  $("#railToggle").addEventListener("click", () => $(".app-shell").classList.toggle("rail-open"));
  setupVideoEvents();
  document.addEventListener("click", async (event) => {
    const saveText = event.target?.dataset?.saveMemory;
    const deleteId = event.target?.dataset?.deleteMemory;
    if (saveText) {
      await saveMemory(saveText);
    }
    if (deleteId) {
      await deleteMemory(deleteId);
    }
  });
}

function showPage(pageId) {
  $$(".rail-btn").forEach((item) => item.classList.toggle("active", item.dataset.page === pageId));
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
  const page = document.getElementById(pageId);
  page?.querySelector(".panel")?.focus?.();
}

function setupVideoEvents() {
  $("#startVideoBtn")?.addEventListener("click", startVideo);
  $("#stopVideoBtn")?.addEventListener("click", stopVideo);
  $("#toggleMicBtn")?.addEventListener("click", () => toggleTrack("audio", "#toggleMicBtn", "麦克风"));
  $("#toggleCameraBtn")?.addEventListener("click", () => toggleTrack("video", "#toggleCameraBtn", "摄像头"));
  $("#speakTalkBtn")?.addEventListener("click", () => {
    const text = ($("#talkText").value || "").trim();
    if (!text) return toast("请先输入要说的话");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  });
  $$(".quick-talk-list [data-talk]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#talkText").value = button.dataset.talk;
    });
  });
}

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    state.videoStream = stream;
    $("#careVideo").srcObject = stream;
    $("#videoPlaceholder").classList.add("hidden");
    $("#videoStatus").textContent = "观察中";
    toast("视频观察已开启");
  } catch (error) {
    $("#videoStatus").textContent = "无法连接";
    toast(`无法开启摄像头/麦克风：${error.message}`);
  }
}

function stopVideo() {
  state.videoStream?.getTracks().forEach((track) => track.stop());
  state.videoStream = null;
  $("#careVideo").srcObject = null;
  $("#videoPlaceholder").classList.remove("hidden");
  $("#videoStatus").textContent = "未连接";
}

function toggleTrack(kind, buttonSelector, label) {
  if (!state.videoStream) return toast("请先开启视频观察");
  const tracks = state.videoStream.getTracks().filter((track) => track.kind === kind);
  tracks.forEach((track) => {
    track.enabled = !track.enabled;
  });
  const enabled = tracks.some((track) => track.enabled);
  $(buttonSelector).textContent = `${label}${enabled ? "开" : "关"}`;
}

async function init() {
  setupEvents();
  setupUploads();
  await setupRecorder();
  await loadSamples();
  await refreshSubjectCard();
  updateDraftFromInput();
}

init().catch((error) => toast(error.message));
