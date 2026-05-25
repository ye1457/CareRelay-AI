const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const localSamples = {
  elder: {
    subject: "爷爷",
    text: "今天早上8点给爷爷吃了降压药，中午吃了一碗粥，下午血压有点高，晚上还没确认有没有吃药。明天上午9点要去医院复查，医保卡和病历本要提前放包里。",
  },
  baby: {
    subject: "宝宝",
    text: "宝宝上午10点喝奶120ml，12点睡了40分钟，下午有点哭闹，晚上还没洗澡。奶瓶已经消毒，明天上午要观察有没有继续胀气。",
  },
  pet: {
    subject: "小猫",
    text: "今天早上给小猫喂了猫粮，下午吐了一次，精神还可以。晚上还没有喂药，明天要带去宠物医院复查，航空箱需要提前准备。",
  },
};

const state = {
  samples: localSamples,
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
  "正在整理输入",
  "正在检索知识库",
  "正在拆解待确认事项",
  "正在生成交接卡",
  "正在准备家属消息",
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

function currentSubject() {
  return ($("#subjectInput")?.value || "爷爷").trim() || "爷爷";
}

function currentScene() {
  return $("#sceneSelect")?.value || "elder";
}

function sceneLabel(scene) {
  return { elder: "老人照护", baby: "喂养睡眠", pet: "宠物照护" }[scene] || "家庭照护";
}

function sceneAvatar(scene, subject) {
  if (scene === "baby") return "宝";
  if (scene === "pet") return subject.includes("狗") ? "狗" : "猫";
  return subject.slice(0, 1) || "人";
}

function updateTopTitle() {
  const subject = currentSubject();
  const scene = currentScene();
  $("#topTitle").textContent = `${subject}的今日照护`;
  $("#cardSubject").textContent = `${subject}今日交接`;
  $("#profileName").textContent = subject;
  $("#profileMeta").textContent = `${sceneLabel(scene)} · 家庭交接`;
  $("#profileAvatar").textContent = sceneAvatar(scene, subject);
  $("#profileAvatar").className = `avatar ${scene === "baby" ? "baby" : scene === "pet" ? "pet" : "elder"}`;
  $$(".subject-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.subject === subject || button.dataset.scene === scene);
  });
  updateSubjectHints();
}

function setProgress(active) {
  const box = $("#progressBox");
  const btn = $("#analyzeBtn");
  const shortcut = $("#analyzeShortcutBtn");
  if (!active) {
    clearInterval(state.progressTimer);
    box.classList.add("hidden");
    btn.classList.remove("loading");
    btn.disabled = false;
    shortcut.disabled = false;
    return;
  }
  let idx = 0;
  box.classList.remove("hidden");
  btn.classList.add("loading");
  btn.disabled = true;
  shortcut.disabled = true;
  $("#progressText").textContent = progressSteps[idx];
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(() => {
    idx = (idx + 1) % progressSteps.length;
    $("#progressText").textContent = progressSteps[idx];
  }, 1200);
}

async function loadSamples() {
  state.samples = localSamples;
}

async function applySample(key) {
  const sample = state.samples[key];
  if (!sample) return;
  $("#sceneSelect").value = key;
  $("#subjectInput").value = sample.subject;
  $("#careText").value = sample.text;
  state.lastCard = null;
  disableResultActions();
  updateTopTitle();
  await Promise.all([loadMemories(), loadHistory()]);
  updateDraftFromInput();
}

function newHandoff() {
  const subject = currentSubject();
  $("#careText").value = "";
  state.lastCard = null;
  state.audioBlob = null;
  state.imageFile = null;
  state.imageInsights = "";
  state.imageInspected = false;
  state.audioDecoded = false;
  $("#audioStatus").textContent = "未录音";
  $("#imageStatus").textContent = "未上传";
  $("#imagePreview").classList.add("hidden");
  $("#imageInsightsBox").classList.add("hidden");
  disableResultActions();
  renderDraftShell(subject);
  toast("已新建交接");
}

function disableResultActions() {
  $("#copyMessageBtn").disabled = true;
  $("#speakBtn").disabled = true;
}

async function loadMemories() {
  const subject = encodeURIComponent(currentSubject());
  try {
    const res = await fetch(`/api/memory?user_id=demo_user&care_subject=${subject}`);
    const data = await res.json();
    renderMemoryHits(data.memories || [], "memoryHits");
  } catch (_) {
    renderMemoryHits([], "memoryHits");
  }
}

async function loadHistory() {
  const subject = encodeURIComponent(currentSubject());
  try {
    const res = await fetch(`/api/history?user_id=demo_user&care_subject=${subject}&limit=10`);
    const data = await res.json();
    renderHistory(data.records || []);
  } catch (_) {
    renderHistory([]);
  }
}

function renderMemoryHits(memories, targetId = "memoryHits") {
  const node = $(`#${targetId}`);
  if (!node) return;
  updateMemoryStats(memories);
  if (!memories.length) {
    node.innerHTML = `
      <div class="memory-empty-card">
        <span class="memory-card-icon care">记</span>
        <div>
          <strong>还没有保存的长期记忆</strong>
          <p>把复诊准备、用药提醒、生活习惯或照护偏好保存下来，之后生成交接卡时会自动参考。</p>
        </div>
      </div>
    `;
    return;
  }
  node.innerHTML = memories
    .map((item) => {
      const meta = memoryMeta(item.text, item.label);
      const score = Math.round(Number(item.score || 1) * 100);
      return `
        <article class="memory-card ${meta.type}">
          <div class="memory-card-top">
            <span class="memory-card-icon ${meta.type}">${meta.icon}</span>
            <div>
              <strong>${meta.title}</strong>
              <small>${escapeHtml(currentSubject())} · ${escapeHtml(item.label || "profile")}</small>
            </div>
            ${item.id ? `<button class="memory-delete-btn" type="button" data-delete-memory="${item.id}">删除</button>` : ""}
          </div>
          <p>${escapeHtml(item.text)}</p>
          <div class="memory-card-foot">
            <span>${meta.hint}</span>
            <b>${score}%</b>
          </div>
          <div class="memory-confidence"><span style="width:${Math.max(8, Math.min(100, score))}%"></span></div>
        </article>
      `;
    })
    .join("");
}

function updateMemoryStats(memories) {
  const countNode = $("#memoryCount");
  if (!countNode) return;
  const stats = memories.reduce(
    (acc, item) => {
      const type = memoryMeta(item.text, item.label).type;
      acc.total += 1;
      if (type === "medical") acc.medical += 1;
      else if (type === "preference") acc.preference += 1;
      else acc.care += 1;
      return acc;
    },
    { total: 0, care: 0, medical: 0, preference: 0 },
  );
  $("#memoryCount").textContent = stats.total;
  $("#memoryCareCount").textContent = stats.care;
  $("#memoryMedicalCount").textContent = stats.medical;
  $("#memoryPreferenceCount").textContent = stats.preference;
}

function memoryMeta(text = "", label = "") {
  const value = `${text} ${label}`;
  if (/复诊|复查|医院|医生|医保|病历|处方|药|服用|剂量|血压|血糖|症状|不适/.test(value)) {
    return {
      type: "medical",
      icon: "医",
      title: "医疗与复诊",
      hint: "生成交接卡时优先用于安全提醒",
    };
  }
  if (/喜欢|不喜欢|习惯|偏好|睡前|饮食|口味|安抚|拍嗝|猫砂|玩具/.test(value)) {
    return {
      type: "preference",
      icon: "好",
      title: "偏好与习惯",
      hint: "用于个性化照护建议",
    };
  }
  return {
    type: "care",
    icon: "护",
    title: "日常照护",
    hint: "用于补全交接上下文",
  };
}

function suggestionMeta(text = "") {
  const meta = memoryMeta(text, "suggestion");
  return {
    ...meta,
    title: meta.type === "medical" ? "建议保存为医疗记忆" : meta.type === "preference" ? "建议保存为偏好记忆" : "建议保存为照护记忆",
  };
}

function updateSubjectHints() {
  const hint = $("#memorySubjectHint");
  if (hint) hint.textContent = `当前对象：${currentSubject()}。`;
}

async function saveMemory(text) {
  const payload = {
    user_id: "demo_user",
    care_subject: currentSubject(),
    text,
    label: "confirmed",
  };
  const res = await fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("保存失败");
  const data = await res.json();
  renderMemoryHits(data.memories || []);
  toast("已保存到知识库");
}

async function saveManualMemory() {
  const text = ($("#manualMemoryText")?.value || "").trim();
  if (!text) {
    toast("请先填写内容");
    return;
  }
  await saveMemory(text);
  $("#manualMemoryText").value = "";
}

async function deleteMemory(id) {
  const res = await fetch(`/api/memory/${id}?user_id=demo_user`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除失败");
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
  if (!fileOrBlob || state.audioTranscribing) return;
  const form = new FormData();
  form.append("audio", fileOrBlob, filename);
  state.audioTranscribing = true;
  $("#audioStatus").textContent = "转写中";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
    const data = await res.json();
    if (data.ok && data.transcript) {
      state.audioDecoded = true;
      $("#audioStatus").textContent = "已转写";
      appendDecodedText("【语音转写】", data.transcript);
      toast("语音已转写");
    } else {
      state.audioDecoded = false;
      $("#audioStatus").textContent = "转写失败";
      toast((data.warnings || ["语音转写失败"])[0]);
    }
  } catch (error) {
    state.audioDecoded = false;
    $("#audioStatus").textContent = error.name === "AbortError" ? "转写较慢" : "转写失败";
    toast(error.name === "AbortError" ? "语音转写较慢，可先继续整理" : `语音转写失败：${error.message}`);
  } finally {
    clearTimeout(timer);
    state.audioTranscribing = false;
  }
}

async function inspectImageFile(file) {
  if (!file) return;
  const form = new FormData();
  form.append("image", file, file.name || "care-image.png");
  $("#imageStatus").textContent = "解析中";
  $("#imageInsightsBox").classList.remove("hidden");
  $("#imageInsightsBox").textContent = "正在读取图片内容...";
  try {
    const res = await fetch("/api/inspect-image", { method: "POST", body: form });
    const data = await res.json();
    if (data.ok && data.insights) {
      state.imageInsights = data.insights;
      state.imageInspected = true;
      $("#imageStatus").textContent = "已加入记录";
      $("#imageInsightsBox").textContent = data.insights;
      appendDecodedText("【图片解析】", data.insights);
      toast("图片内容已解析");
    } else {
      state.imageInspected = false;
      $("#imageStatus").textContent = "解析失败";
      $("#imageInsightsBox").textContent = (data.warnings || ["图片解析失败"])[0];
      toast((data.warnings || ["图片解析失败"])[0]);
    }
  } catch (error) {
    state.imageInspected = false;
    $("#imageStatus").textContent = "解析失败";
    $("#imageInsightsBox").textContent = `图片解析失败：${error.message}`;
    toast(`图片解析失败：${error.message}`);
  }
}

async function setupRecorder() {
  const recordBtn = $("#recordBtn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
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
      $("#audioStatus").textContent = interim ? `识别中：${interim}` : "识别中";
    };
    recognition.onerror = () => {
      state.recognizing = false;
      $("#audioStatus").textContent = "浏览器识别不可用";
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
    $("#audioStatus").textContent = "浏览器不支持";
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
      $("#audioStatus").textContent = "整理中";
      setTimeout(() => {
        if (state.mediaRecorder && state.mediaRecorder.state === "recording") state.mediaRecorder.stop();
      }, 420);
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
        $("#audioStatus").textContent = "录音失败";
      };
      state.mediaRecorder.onstop = async () => {
        state.audioBlob = new Blob(state.recordedChunks, { type: "audio/webm" });
        state.micStream?.getTracks().forEach((track) => track.stop());
        state.micStream = null;
        if (state.browserSpeechText.trim()) {
          $("#audioStatus").textContent = "已识别";
          toast("语音已识别");
        } else {
          $("#audioStatus").textContent = `已录制 ${(state.audioBlob.size / 1024).toFixed(1)} KB`;
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
      $("#audioStatus").textContent = "录音中";
    } catch (error) {
      $("#audioStatus").textContent = "无法访问麦克风";
      toast(`无法访问麦克风：${error.message}`);
    }
  });
}

function setupUploads() {
  $("#audioUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    state.audioBlob = null;
    state.audioDecoded = false;
    $("#audioStatus").textContent = file ? file.name : "未录音";
    if (file) transcribeAudioFile(file, file.name);
  });

  $("#imageUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    state.imageFile = file || null;
    state.imageInsights = "";
    state.imageInspected = false;
    $("#imageStatus").textContent = file ? file.name : "未上传";
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
  form.append("care_subject", currentSubject());
  form.append("user_id", "demo_user");
  form.append("text", $("#careText").value || "");
  form.append("use_visual", "false");

  if (state.audioTranscribing) {
    toast("语音仍在转写，本次先使用已有文本");
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

function imageSrc(card) {
  if (card?.visual_image_b64) return `data:image/png;base64,${card.visual_image_b64}`;
  if (card?.visual_fallback_svg) return `data:image/svg+xml;base64,${card.visual_fallback_svg}`;
  return "";
}

function renderResult(card, warnings = []) {
  state.lastCard = card;
  $("#copyMessageBtn").disabled = false;
  $("#speakBtn").disabled = false;
  $("#careStatus").textContent = card.care_status || "需确认";
  $("#cardDate").textContent = card.date || "今日";
  $("#cardSubject").textContent = `${card.care_subject || currentSubject()}今日交接`;
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

  renderMetrics(card);
  renderTaskList(card.to_confirm || [], "confirmList");
  renderTaskList(card.todos || [], "todoList");
  renderCompleted(card.completed || []);
  renderTimeline(card.timeline || []);
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
        owner: "现负责照护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: isMedicine ? "按医嘱执行；不确定时联系医生或家人确认。" : "",
      });
    } else if (doneWords.test(sentence) && !todoWords.test(sentence)) {
      completed.push({ title, time: due, source: "输入预览" });
    } else if (todoWords.test(sentence) || isMedicine) {
      todos.push({
        title: isMedicine && !title.includes("确认") ? `按原文确认用药安排：${title}` : title,
        due_time: due || "待定",
        owner: "现负责照护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: isMedicine ? "按医嘱执行；图片或处方信息不清楚时联系医生/家人确认。" : "",
      });
    }
  });

  return { confirms: confirms.slice(-8), todos: todos.slice(-10), completed: completed.slice(-8) };
}

function updateDraftFromInput() {
  const text = ($("#careText").value || "").trim();
  if (!text) {
    renderDraftShell(currentSubject());
    return;
  }
  const draft = buildDraftItems();
  const card = {
    care_subject: currentSubject(),
    date: "今日",
    care_status: draft.confirms.length ? "需确认" : "输入预览",
    summary: `已读取 ${splitCareSentences(text).length} 条记录，预览到 ${draft.completed.length} 条已完成、${draft.confirms.length} 条待确认、${draft.todos.length} 条下一步。`,
    completed: draft.completed,
    to_confirm: draft.confirms,
    todos: draft.todos,
    risk_notes: [],
    family_message: "生成后可直接转发到家人群。",
    emotion_analysis: {
      primary_tone: draft.confirms.length ? "需要确认" : "平稳整理",
      anxiety_level: draft.confirms.length ? 48 : 28,
      reassurance: "交接卡生成后会把不确定事项单独列出。",
      stress_points: draft.confirms.map((item) => item.title).slice(0, 3),
    },
    risk_radar: estimateDraftRisks(draft),
    timeline: [
      ...draft.completed.map((item) => ({ time: item.time || "已记录", label: item.title, type: "done", detail: "输入预览" })),
      ...draft.confirms.map((item) => ({ time: item.due_time || "尽快", label: item.title, type: "confirm", detail: item.safety_note || "待确认" })),
      ...draft.todos.map((item) => ({ time: item.due_time || "待定", label: item.title, type: "todo", detail: item.safety_note || "下一步" })),
    ].slice(-8),
    visual_image_b64: "",
    visual_fallback_svg: "",
    confidence: 0.68,
    interaction_questions: draft.confirms.slice(0, 3).map((item) => item.title),
  };
  renderPreview(card);
}

function renderDraftShell(subject) {
  renderPreview({
    care_subject: subject,
    date: "今日",
    care_status: "输入预览",
    summary: "写下今日记录后，会在这里预览交接重点。",
    completed: [],
    to_confirm: [],
    todos: [],
    risk_notes: [],
    family_message: "生成后可直接转发到家人群。",
    emotion_analysis: { primary_tone: "需要记录", anxiety_level: 20, reassurance: "", stress_points: [] },
    risk_radar: { medication: 20, appointment: 20, symptom: 20, communication: 20 },
    timeline: [],
    interaction_questions: [],
    confidence: 0.72,
  });
}

function renderPreview(card) {
  $("#careStatus").textContent = card.care_status || "输入预览";
  $("#cardDate").textContent = card.date || "今日";
  $("#cardSubject").textContent = `${card.care_subject || currentSubject()}今日交接`;
  $("#summaryText").textContent = card.summary || "";
  const score = healthIndex(card);
  $("#statusScore").textContent = score;
  $("#statusRing").style.setProperty("--score", score);
  $("#warnings").classList.add("hidden");
  renderMetrics(card);
  renderTaskList(card.to_confirm || [], "confirmList");
  renderTaskList(card.todos || [], "todoList");
  renderCompleted(card.completed || []);
  renderTimeline(card.timeline || []);
  renderEmotion(card.emotion_analysis || {});
  renderRisks(card.risk_radar || {});
  renderVisual({});
  $("#familyMessage").textContent = card.family_message || "";
  renderQuestions(card.interaction_questions || []);
}

function estimateDraftRisks(draft) {
  const text = JSON.stringify(draft);
  return {
    medication: /药|服用|剂量|处方/.test(text) ? 62 : 18,
    appointment: /复诊|复查|医院|医生/.test(text) ? 58 : 18,
    symptom: /血压|发热|发烧|吐|痛|哭闹|不适|异常/.test(text) ? 55 : 22,
    communication: draft.confirms.length ? 66 : 24,
  };
}

function renderMetrics(card) {
  $("#completedCount").textContent = (card.completed || []).length;
  $("#confirmCount").textContent = (card.to_confirm || []).length;
  $("#todoCount").textContent = (card.todos || []).length;
  $("#riskCount").textContent = (card.risk_notes || []).length + (card.abnormal_signals || []).length;
}

function healthIndex(card) {
  const risks = card?.risk_radar || {};
  const values = ["medication", "appointment", "symptom", "communication"]
    .map((key) => Number(risks[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return Math.round((card?.confidence || 0.72) * 100);
  const riskAverage = values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length;
  const pendingPenalty = Math.min(18, (card.to_confirm || []).length * 3);
  return Math.max(35, Math.min(98, Math.round(100 - riskAverage * 0.48 - pendingPenalty)));
}

function renderTaskList(items, targetId) {
  const node = $(`#${targetId}`);
  if (!items.length) {
    node.innerHTML = `<div class="task-item"><div class="task-title"><span></span><span>暂无事项</span></div></div>`;
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

function renderTimeline(items) {
  const node = $("#timeline");
  if (!items.length) {
    node.innerHTML = `<div class="timeline-item"><div class="time-chip">待定</div><div><h4>暂无时间线</h4><p>生成后显示照护事件。</p></div></div>`;
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
  const img = $("#visualImage");
  const empty = $("#visualEmpty");
  if (src) {
    img.src = src;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    empty.classList.remove("hidden");
  }
  $("#visualBadge").textContent = card?.visual_image_b64 ? "已生成" : card?.visual_fallback_svg ? "备用图" : "待生成";
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
    node.innerHTML = `
      <div class="suggestion-empty-card">
        <span class="memory-card-icon care">AI</span>
        <div>
          <strong>暂无新的建议</strong>
          <p>生成交接卡后，CareRelay 会把适合长期保存的内容推荐到这里。</p>
        </div>
      </div>
    `;
    return;
  }
  node.innerHTML = items
    .map((item) => {
      const meta = suggestionMeta(item);
      return `
        <article class="suggestion-card ${meta.type}">
          <div class="memory-card-top">
            <span class="memory-card-icon ${meta.type}">${meta.icon}</span>
            <div>
              <strong>${meta.title}</strong>
              <small>${escapeHtml(currentSubject())} · AI 建议</small>
            </div>
          </div>
          <p>${escapeHtml(item)}</p>
          <div class="suggestion-card-actions">
            <span>${meta.hint}</span>
            <button type="button" data-save-memory="${escapeHtml(item)}">保存为记忆</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderQuestions(items) {
  const node = $("#questionList");
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
  navigator.clipboard.writeText(message).then(() => toast("已复制家属消息"));
}

function showPage(pageId) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === pageId));
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
}

function setupEvents() {
  $$("[data-sample]").forEach((button) => button.addEventListener("click", () => applySample(button.dataset.sample)));
  $$(".subject-option").forEach((button) => {
    button.addEventListener("click", async () => {
      $("#subjectInput").value = button.dataset.subject;
      $("#sceneSelect").value = button.dataset.scene;
      updateTopTitle();
      await Promise.all([loadMemories(), loadHistory()]);
      updateDraftFromInput();
    });
  });
  $("#sceneSelect").addEventListener("change", (event) => applySample(event.target.value));
  $("#newHandoffBtn").addEventListener("click", newHandoff);
  $("#analyzeBtn").addEventListener("click", analyze);
  $("#analyzeShortcutBtn").addEventListener("click", analyze);
  $("#speakBtn").addEventListener("click", speak);
  $("#copyMessageBtn").addEventListener("click", copyMessage);
  $("#copyInlineBtn").addEventListener("click", copyMessage);
  $("#refreshMemoryBtn").addEventListener("click", loadMemories);
  $("#refreshHistoryBtn").addEventListener("click", loadHistory);
  $("#saveManualMemoryBtn").addEventListener("click", saveManualMemory);
  $("#careText").addEventListener("input", scheduleDraftUpdate);
  $("#subjectInput").addEventListener("change", async () => {
    updateTopTitle();
    await Promise.all([loadMemories(), loadHistory()]);
    updateDraftFromInput();
  });
  $("#subjectInput").addEventListener("input", () => {
    updateTopTitle();
    clearTimeout(state.subjectTimer);
    state.subjectTimer = setTimeout(() => {
      loadMemories();
      loadHistory();
    }, 520);
  });
  $("#visualStage").addEventListener("click", () => {
    const src = $("#visualImage").src;
    if (!src) return;
    $("#lightboxImage").src = src;
    $("#imageLightbox").classList.remove("hidden");
  });
  $("#imageLightbox").addEventListener("click", () => $("#imageLightbox").classList.add("hidden"));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
  setupVideoEvents();
  document.addEventListener("click", async (event) => {
    const saveText = event.target?.dataset?.saveMemory;
    const deleteId = event.target?.dataset?.deleteMemory;
    if (saveText) await saveMemory(saveText);
    if (deleteId) await deleteMemory(deleteId);
  });
}

function scheduleDraftUpdate() {
  state.lastCard = null;
  disableResultActions();
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(updateDraftFromInput, 220);
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
  $$("[data-talk]").forEach((button) => {
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
    toast("视频已开启");
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
  if (!state.videoStream) return toast("请先开启视频");
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
  updateTopTitle();
  await Promise.all([loadMemories(), loadHistory()]);
  updateDraftFromInput();
}

init().catch((error) => toast(error.message));
