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

const careModes = {
  elder: {
    label: "老人照护",
    sidebarLabel: "老人照护",
    eyebrow: "今天 · AI 交接",
    topTitle: (subject) => `${subject}的今日照护`,
    artifactTitle: "今日交接卡",
    composerTitle: "今日记录",
    textLabel: "照护记录",
    scoreLabel: "今日指数",
    summaryTitle: (subject) => `${subject}今日交接`,
    emptySummary: "填写今日记录后，点击生成按钮会整理成交接卡。",
    familyMessage: "生成后可直接转发到家人群。",
    visualEmptyTitle: "CareRelay",
    visualEmptySubtitle: "今日交接",
    metrics: {
      completed: "已完成",
      confirm: "待确认",
      todo: "下一步",
      risk: "风险提示",
    },
    blocks: {
      family: "家属消息",
      confirm: "必须确认",
      todo: "下一步",
      timeline: "时间线",
      visual: "信息图",
      risk: "风险",
      completed: "已完成",
      questions: "追问",
    },
    risks: {
      medication: "药物",
      appointment: "复诊",
      symptom: "异常",
      communication: "沟通",
    },
    riskKeys: ["medication", "appointment", "symptom", "communication"],
    riskDefaults: {
      medication: 20,
      appointment: 20,
      symptom: 20,
      communication: 20,
    },
    riskRules: [
      ["medication", /药|服用|剂量|处方/],
      ["appointment", /复诊|复查|医院|医生/],
      ["symptom", /血压|发热|发烧|吐|痛|哭闹|不适|异常/],
    ],
    quickTitle: "老人快速记录",
    quickHint: "把用药、生命体征、进食和复诊补成可交接记录。",
    quickInputs: [
      { label: "用药", text: "用药：时间 ，药名/剂量 ，是否已按医嘱服用：" },
      { label: "血压", text: "血压：时间 ，数值 ，是否需要继续观察：" },
      { label: "进食", text: "进食：时间 ，吃了 ，饮水情况：" },
      { label: "睡眠", text: "睡眠：昨晚/午休 ，醒后精神状态：" },
      { label: "复诊", text: "复诊：时间 ，地点/科室 ，需要准备：" },
      { label: "异常", text: "异常观察：时间 ，表现 ，是否已联系家人/医生：" },
    ],
    focusTitle: "今日照护重点",
    focusHint: "老人页面优先把用药、复诊和异常交接清楚。",
    focusCards: [
      { icon: "药", title: "用药确认", text: "药名、剂量、时间和是否已服用要单独交接，避免漏服或重复。" },
      { icon: "诊", title: "复诊准备", text: "医保卡、病历、检查单和出发时间放在下一步里，接手人能直接执行。" },
      { icon: "异", title: "异常观察", text: "血压、血糖、疼痛、发热或精神变化会被放到风险与追问区域。" },
    ],
    memory: {
      title: "个性化知识库",
      desc: "适合保存复诊准备、用药边界、生活习惯、照护偏好。",
      placeholder: "例如：爷爷复诊前一天要准备医保卡和病历本。",
      empty: "把复诊准备、用药提醒、生活习惯或照护偏好保存下来，之后生成交接卡时会自动参考。",
      suggestionEmpty: "生成交接卡后，CareRelay 会把适合长期保存的内容推荐到这里。",
      labels: { care: "照护", medical: "医疗", preference: "偏好" },
      meta: {
        medical: {
          icon: "医",
          title: "医疗与复诊",
          hint: "生成交接卡时优先用于安全提醒",
          pattern: /复诊|复查|医院|医生|医保|病历|处方|药|服用|剂量|血压|血糖|症状|不适/,
        },
        preference: {
          icon: "好",
          title: "偏好与习惯",
          hint: "用于个性化照护建议",
          pattern: /喜欢|不喜欢|习惯|偏好|睡前|饮食|口味|安抚|拍嗝|猫砂|玩具/,
        },
        care: {
          icon: "护",
          title: "日常照护",
          hint: "用于补全交接上下文",
        },
      },
      suggestionTitles: {
        medical: "建议保存为医疗记忆",
        preference: "建议保存为偏好记忆",
        care: "建议保存为照护记忆",
      },
    },
  },
  baby: {
    label: "宝宝照护",
    sidebarLabel: "喂养睡眠",
    eyebrow: "今天 · 宝宝节律",
    topTitle: (subject) => `${subject}的今日节律`,
    artifactTitle: "宝宝节律卡",
    composerTitle: "喂养与作息记录",
    textLabel: "宝宝记录",
    scoreLabel: "节律指数",
    summaryTitle: (subject) => `${subject}今日节律`,
    emptySummary: "记录喂奶、睡眠、尿布、体温和哭闹情况后，点击生成按钮会整理成节律卡。",
    familyMessage: "生成后可直接发给家人，统一下一次喂养、哄睡和观察安排。",
    visualEmptyTitle: "Baby Rhythm",
    visualEmptySubtitle: "喂养 · 睡眠 · 尿布",
    metrics: {
      completed: "已记录",
      confirm: "需关注",
      todo: "下一次",
      risk: "异常信号",
    },
    blocks: {
      family: "家人同步",
      confirm: "需要关注",
      todo: "下一次照护",
      timeline: "宝宝节律",
      visual: "节律图",
      risk: "观察重点",
      completed: "已记录",
      questions: "继续追问",
    },
    risks: {
      medication: "喂养",
      appointment: "睡眠",
      symptom: "体温/不适",
      communication: "安抚沟通",
    },
    riskKeys: ["medication", "appointment", "symptom", "communication"],
    riskDefaults: {
      medication: 22,
      appointment: 24,
      symptom: 20,
      communication: 24,
    },
    riskRules: [
      ["medication", /奶|母乳|配方|辅食|ml|毫升|拍嗝|吐奶|胀气/],
      ["appointment", /睡|醒|午觉|夜醒|入睡|哄睡/],
      ["symptom", /体温|发烧|发热|咳|哭闹|胀气|疹|拉肚子|便便|不适/],
    ],
    quickTitle: "宝宝快速记录",
    quickHint: "把高频照护项补成一句可交接的记录。",
    quickInputs: [
      { label: "喂奶", text: "刚刚喝奶 ml，拍嗝情况：，下一次预计：" },
      { label: "睡眠", text: "这次睡眠从 到 ，醒来状态：" },
      { label: "尿布", text: "尿布情况：尿量 ，便便 ，皮肤状态：" },
      { label: "体温", text: "体温 ℃，精神状态：，是否继续观察：" },
      { label: "哭闹", text: "哭闹持续 分钟，可能原因：，安抚方式：" },
      { label: "洗澡", text: "洗澡/清洁状态：，护肤或红屁屁情况：" },
    ],
    focusTitle: "今日照护节奏",
    focusHint: "宝宝页面优先让家人知道下一次要做什么。",
    focusCards: [
      { icon: "奶", title: "下一次喂养", text: "记录奶量、拍嗝、吐奶或胀气，避免重复喂或漏喂。" },
      { icon: "睡", title: "睡眠窗口", text: "把入睡、醒来和夜醒放到同一条节律里，便于接手哄睡。" },
      { icon: "温", title: "异常观察", text: "体温、持续哭闹、皮疹、便便异常会被放到更醒目的位置。" },
    ],
    memory: {
      title: "宝宝习惯库",
      desc: "适合保存奶量范围、睡眠节律、安抚方式、过敏或儿保准备。",
      placeholder: "例如：宝宝睡前需要先拍嗝，再抱走动 5 分钟比较容易入睡。",
      empty: "把奶量范围、入睡习惯、安抚方式或过敏不适保存下来，之后会自动用于宝宝交接。",
      suggestionEmpty: "生成宝宝节律卡后，CareRelay 只会把稳定习惯和可复用观察建议推荐到这里。",
      labels: { care: "节律", medical: "不适", preference: "安抚" },
      meta: {
        medical: {
          icon: "温",
          title: "过敏与不适",
          hint: "用于提醒体温、过敏、胀气或儿保事项",
          pattern: /体温|发烧|发热|过敏|疹|咳|胀气|吐奶|拉肚子|医院|医生|儿保|疫苗|药/,
        },
        preference: {
          icon: "哄",
          title: "安抚与偏好",
          hint: "用于生成更贴近宝宝习惯的照护安排",
          pattern: /安抚|喜欢|不喜欢|习惯|睡前|抱|摇|白噪音|奶嘴|玩具|拍嗝/,
        },
        care: {
          icon: "节",
          title: "喂养睡眠节律",
          hint: "用于补全下一次喂养、睡眠和尿布安排",
        },
      },
      suggestionTitles: {
        medical: "建议保存为不适观察",
        preference: "建议保存为安抚偏好",
        care: "建议保存为节律记忆",
      },
    },
  },
  pet: {
    label: "宠物照护",
    sidebarLabel: "宠物照护",
    eyebrow: "今天 · 宠物状态",
    topTitle: (subject) => `${subject}的今日状态`,
    artifactTitle: "宠物状态卡",
    composerTitle: "饮食与状态记录",
    textLabel: "宠物记录",
    scoreLabel: "状态指数",
    summaryTitle: (subject) => `${subject}今日状态`,
    emptySummary: "记录喂食、饮水、排泄、精神状态和异常后，点击生成按钮会整理成状态卡。",
    familyMessage: "生成后可直接发给家人，统一喂食、用药、清理和复查准备。",
    visualEmptyTitle: "Pet Status",
    visualEmptySubtitle: "饮食 · 排泄 · 精神",
    metrics: {
      completed: "已记录",
      confirm: "需确认",
      todo: "待处理",
      risk: "异常信号",
    },
    blocks: {
      family: "家人同步",
      confirm: "必须确认",
      todo: "待处理",
      timeline: "状态时间线",
      visual: "状态图",
      risk: "观察重点",
      completed: "已记录",
      questions: "继续追问",
    },
    risks: {
      medication: "饮食饮水",
      appointment: "排泄",
      symptom: "异常症状",
      communication: "用药复查",
    },
    riskKeys: ["medication", "appointment", "symptom", "communication"],
    riskDefaults: {
      medication: 20,
      appointment: 20,
      symptom: 20,
      communication: 22,
    },
    riskRules: [
      ["medication", /猫粮|狗粮|罐头|喂|吃|饮水|喝水|食欲|没吃/],
      ["appointment", /排便|便便|软便|拉稀|尿|猫砂|遛|外出/],
      ["symptom", /吐|呕吐|咳|打喷嚏|精神|没精神|跛|疼|异常|不适/],
      ["communication", /药|喂药|复查|宠物医院|医生|疫苗|驱虫/],
    ],
    quickTitle: "宠物快速记录",
    quickHint: "把日常观察补成接手人能执行的记录。",
    quickInputs: [
      { label: "喂食", text: "喂食：，食欲：，下一次喂食：" },
      { label: "饮水", text: "饮水情况：，是否明显变多/变少：" },
      { label: "排泄", text: "排泄情况：尿 ，便便 ，猫砂/外出清理：" },
      { label: "精神", text: "精神状态：，活动量：，是否愿意互动：" },
      { label: "呕吐", text: "呕吐/软便情况：次数 ，颜色/状态：，是否继续观察：" },
      { label: "用药复查", text: "用药/复查：，下一次时间：，需要准备：" },
    ],
    focusTitle: "今日观察重点",
    focusHint: "宠物页面优先把异常信号和可执行事项拆清楚。",
    focusCards: [
      { icon: "食", title: "饮食饮水", text: "记录食欲、饮水变化和喂食时间，方便判断状态是否偏离平时。" },
      { icon: "便", title: "排泄清理", text: "尿量、软便、猫砂盆或外出情况会被放进交接主线。" },
      { icon: "医", title: "异常与复查", text: "呕吐、精神差、用药和宠物医院复查会单独提醒接手人。" },
    ],
    memory: {
      title: "宠物习惯库",
      desc: "适合保存饮食偏好、排泄规律、兽医用药、外出和清理习惯。",
      placeholder: "例如：小猫不喜欢鱼味罐头，喂药后要给一点冻干奖励。",
      empty: "把食物偏好、排泄规律、用药复查或外出习惯保存下来，之后会自动用于宠物交接。",
      suggestionEmpty: "生成宠物状态卡后，CareRelay 只会把稳定习惯和可复用观察建议推荐到这里。",
      labels: { care: "生活", medical: "兽医", preference: "偏好" },
      meta: {
        medical: {
          icon: "医",
          title: "兽医与用药",
          hint: "用于提醒用药、复查、疫苗或驱虫",
          pattern: /宠物医院|兽医|医生|复查|药|喂药|疫苗|驱虫|处方|呕吐|吐|软便|拉稀|不适/,
        },
        preference: {
          icon: "好",
          title: "饮食与偏好",
          hint: "用于生成更贴近平时习惯的照护建议",
          pattern: /喜欢|不喜欢|偏好|习惯|猫粮|狗粮|罐头|冻干|零食|玩具|猫砂|牵引/,
        },
        care: {
          icon: "护",
          title: "生活与排泄",
          hint: "用于补全喂食、饮水、排泄和清理安排",
        },
      },
      suggestionTitles: {
        medical: "建议保存为兽医记忆",
        preference: "建议保存为偏好记忆",
        care: "建议保存为生活习惯",
      },
    },
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
  careEntries: [],
  careEntrySeq: 0,
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

function priorityInfo(priority) {
  const value = String(priority || "").trim().toLowerCase();
  if (["high", "高", "高优先级", "urgent", "critical"].includes(value)) {
    return { key: "high", label: "高优先级", rank: 0 };
  }
  if (["low", "低", "低优先级"].includes(value)) {
    return { key: "low", label: "低优先级", rank: 2 };
  }
  return { key: "medium", label: "中优先级", rank: 1 };
}

function priorityText(priority) {
  return priorityInfo(priority).label;
}

function modeFor(scene = currentScene()) {
  return careModes[scene] || careModes.elder;
}

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

function setGenerationSource(label, state = "") {
  const node = $("#generationSource");
  if (!node) return;
  node.textContent = label;
  node.className = `source-badge ${state}`.trim();
}

function riskName(key) {
  return modeFor().risks[key] || careModes.elder.risks[key] || key;
}

function currentSubject() {
  return ($("#subjectInput")?.value || "爷爷").trim() || "爷爷";
}

function currentScene() {
  return $("#sceneSelect")?.value || "elder";
}

function sceneLabel(scene) {
  return modeFor(scene).sidebarLabel || modeFor(scene).label || "家庭照护";
}

function sceneAvatar(scene, subject) {
  if (scene === "baby") return "宝";
  if (scene === "pet") return subject.includes("狗") ? "狗" : "猫";
  return subject.slice(0, 1) || "人";
}

function subjectAvatarClass(scene) {
  if (scene === "baby") return "baby";
  if (scene === "pet") return "pet";
  return "elder";
}

function setSubjectOptionContent(button, scene, subject, metaText) {
  button.dataset.subject = subject;
  button.dataset.scene = scene;
  button.innerHTML = `
    <span class="avatar ${subjectAvatarClass(scene)}">${escapeHtml(sceneAvatar(scene, subject))}</span>
    <span>
      <strong>${escapeHtml(subject)}</strong>
      <small>${escapeHtml(metaText || sceneLabel(scene))}</small>
    </span>
  `;
}

function findSubjectOption(scene, subject, { includeDraft = true } = {}) {
  const normalized = (subject || "").trim();
  return $$(".subject-option").find(
    (button) =>
      button.dataset.scene === scene &&
      (button.dataset.subject || "").trim() === normalized &&
      (includeDraft || button.dataset.draftSubject !== "true"),
  );
}

function placeSubjectOption(button, scene) {
  const list = $(".subject-list");
  if (!list) return;
  const sameSceneOptions = $$(".subject-option").filter((item) => item !== button && item.dataset.scene === scene);
  const lastSameScene = sameSceneOptions[sameSceneOptions.length - 1];
  if (lastSameScene) lastSameScene.after(button);
  else list.append(button);
}

function syncSubjectSidebar({ persist = false } = {}) {
  const list = $(".subject-list");
  if (!list) return;
  const subject = currentSubject();
  const scene = currentScene();
  let activeOption = findSubjectOption(scene, subject, { includeDraft: false });
  const draftOption = list.querySelector("[data-draft-subject='true']");

  if (activeOption) {
    if (draftOption && draftOption !== activeOption) draftOption.remove();
  } else {
    activeOption = draftOption || document.createElement("button");
    activeOption.type = "button";
    activeOption.className = "subject-option current-subject-option";
    activeOption.dataset.draftSubject = persist ? "" : "true";
    if (persist) {
      delete activeOption.dataset.draftSubject;
      activeOption.dataset.customSubject = "true";
    }
    setSubjectOptionContent(activeOption, scene, subject, `${sceneLabel(scene)} · 当前`);
    placeSubjectOption(activeOption, scene);
  }

  if (persist && activeOption.dataset.draftSubject === "true") {
    delete activeOption.dataset.draftSubject;
    activeOption.dataset.customSubject = "true";
  }

  $$(".subject-option").forEach((button) => {
    const isActive = button === activeOption;
    const isCurrentSubject = button.dataset.customSubject === "true" || button.dataset.draftSubject === "true";
    button.classList.toggle("active", isActive);
    button.classList.toggle("current-subject-option", isActive && isCurrentSubject);
    const small = button.querySelector("small");
    if (small) small.textContent = isActive ? `${sceneLabel(button.dataset.scene)} · 当前` : sceneLabel(button.dataset.scene);
  });
}

function updateTopTitle() {
  const subject = currentSubject();
  const scene = currentScene();
  const mode = modeFor(scene);
  document.body.dataset.scene = scene;
  setText("#workspaceEyebrow", mode.eyebrow);
  setText("#topTitle", mode.topTitle(subject));
  setText("#artifactTitle", mode.artifactTitle);
  setText("#composerTitle", mode.composerTitle);
  setText("#careTextLabel", mode.textLabel);
  setText("#scoreLabel", mode.scoreLabel);
  setText("#cardSubject", mode.summaryTitle(subject));
  setText("#completedMetricLabel", mode.metrics.completed);
  setText("#confirmMetricLabel", mode.metrics.confirm);
  setText("#todoMetricLabel", mode.metrics.todo);
  setText("#riskMetricLabel", mode.metrics.risk);
  setText("#familyBlockTitle", mode.blocks.family);
  setText("#confirmBlockTitle", mode.blocks.confirm);
  setText("#todoBlockTitle", mode.blocks.todo);
  setText("#timelineBlockTitle", mode.blocks.timeline);
  setText("#visualBlockTitle", mode.blocks.visual);
  setText("#riskBlockTitle", mode.blocks.risk);
  setText("#completedBlockTitle", mode.blocks.completed);
  setText("#questionBlockTitle", mode.blocks.questions);
  setText("#visualEmpty strong", mode.visualEmptyTitle);
  setText("#visualEmpty span", mode.visualEmptySubtitle);
  $("#profileName").textContent = subject;
  $("#profileMeta").textContent = `${sceneLabel(scene)} · 家庭交接`;
  $("#profileAvatar").textContent = sceneAvatar(scene, subject);
  $("#profileAvatar").className = `avatar ${scene === "baby" ? "baby" : scene === "pet" ? "pet" : "elder"}`;
  syncSubjectSidebar();
  renderQuickInputs();
  renderModeFocus();
  updateMemorySceneCopy();
  updateSubjectHints();
}

function renderQuickInputs() {
  const mode = modeFor();
  const panel = $("#quickInputPanel");
  const row = $("#quickInputRow");
  if (!panel || !row) return;
  const inputs = mode.quickInputs || [];
  panel.classList.toggle("hidden", !inputs.length);
  setText("#quickInputTitle", mode.quickTitle || "快速补充");
  setText("#quickInputHint", mode.quickHint || "选择一个重点，自动补到记录里。");
  row.innerHTML = inputs
    .map((item) => `<button class="quick-input-chip" type="button" data-quick-input="${escapeHtml(item.text)}">${escapeHtml(item.label)}</button>`)
    .join("");
}

function appendQuickInput(text) {
  const textarea = $("#careText");
  const value = (text || "").trim();
  if (!textarea || !value) return;
  const prefix = textarea.value.trim() ? "\n" : "";
  textarea.value = `${textarea.value.trim()}${prefix}${value}`;
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}

function renderModeFocus() {
  const mode = modeFor();
  const panel = $("#modeFocusPanel");
  const node = $("#modeFocusCards");
  if (!panel || !node) return;
  const cards = mode.focusCards || [];
  panel.classList.toggle("hidden", !cards.length);
  setText("#modeFocusTitle", mode.focusTitle || "场景重点");
  setText("#modeFocusHint", mode.focusHint || "");
  node.innerHTML = cards
    .map(
      (item) => `
        <article class="mode-focus-card">
          <span>${escapeHtml(item.icon)}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function updateMemorySceneCopy() {
  const mode = modeFor();
  const memory = mode.memory;
  if (!memory) return;
  setText("#memoryTitle", memory.title);
  setText("#memoryComposeTitle", "新增一条长期记忆");
  setText("#memoryComposeDesc", memory.desc);
  setText("#memoryComposeHint", "会自动归入当前照护对象");
  setText("#memoryCareLabel", memory.labels.care);
  setText("#memoryMedicalLabel", memory.labels.medical);
  setText("#memoryPreferenceLabel", memory.labels.preference);
  const manual = $("#manualMemoryText");
  if (manual) manual.placeholder = memory.placeholder;
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
  setGenerationSource("调用中", "loading");
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
  resetCareEntries();
  disableResultActions();
  updateTopTitle();
  await Promise.all([loadMemories(), loadHistory()]);
  renderDraftShell(currentSubject());
}

function newHandoff() {
  const subject = currentSubject();
  $("#careText").value = "";
  resetCareEntries();
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
  $("#copyInlineBtn").disabled = true;
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
    const res = await fetch(`/api/history?user_id=demo_user&care_subject=${subject}&limit=48`);
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
  const mode = modeFor();
  if (!memories.length) {
    node.innerHTML = `
      <div class="memory-empty-card">
        <span class="memory-card-icon care">记</span>
        <div>
          <strong>还没有保存的长期记忆</strong>
          <p>${escapeHtml(mode.memory.empty)}</p>
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
  updateMemorySceneCopy();
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
  const meta = modeFor().memory.meta;
  const value = `${text} ${label}`;
  if (meta.medical.pattern.test(value)) return { type: "medical", ...meta.medical };
  if (meta.preference.pattern.test(value)) return { type: "preference", ...meta.preference };
  return { type: "care", ...meta.care };
}

function suggestionMeta(text = "") {
  const meta = memoryMeta(text, "suggestion");
  const titles = modeFor().memory.suggestionTitles;
  return {
    ...meta,
    title: titles[meta.type],
  };
}

const shortTermMemoryPattern =
  /(今天|今日|今晚|明天|明早|明晚|后天|本周|这周|这次|本次|刚刚|现在|马上|尽快|稍后|待会儿|待会|下一次|下次|早上|上午|中午|下午|晚上|\d{1,2}\s*(?:点|:|：)\s*\d{0,2}|\d{4}[-/年]\d{1,2}|\d{1,2}[月/]\d{1,2}|周[一二三四五六日天])/;
const boundedMemoryPattern = /((?:未来|接下来|连续)\s*\d+\s*(?:天|周|月)|(?:未来|接下来|连续)[一二三四五六七八九十]+(?:天|周|月))/;
const oneOffMemoryPattern = /(待确认|还没|未确认|确认是否|有没有|发到家人群|转发|今天已|已完成|已做|临时|一次)/;
const metaMemoryPattern = /(交接模板|固定格式|接龙模板|补原文|原始记录|凭猜测|信息质量|对象\+时间|统一格式)/;
const incompleteMemoryPattern = /(前|后|时|需要|确认|准备|观察|记录)$/;
const durableMemoryPattern =
  /(每次|每当|每天|每日|每晚|每早|每周|每月|固定|长期|通常|一般|经常|习惯|规律|偏好|喜欢|不喜欢|过敏|忌口|禁忌|避免|不能|不要|少盐|少油|少糖|睡前|饭前|饭后|起床后|复诊前|复查前|复诊后|复查后|外出前|喂药后|洗澡后|入睡前|安抚方式|奶量范围|食物偏好|排泄规律|医保卡|病历本|航空箱|处方单)/;
const hardRecurringMemoryPattern = /(每次|每当|每天|每日|每晚|每早|每周|每月|固定|长期|通常|一般|经常|习惯|规律|偏好)/;

function normalizeMemoryCandidate(text = "") {
  let value = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[。；;，,\s]+|[。；;，,\s]+$/g, "");
  let next = value.replace(/^(?:记住|保存|建议保存|长期记住|长期记忆|可保存为长期记忆)[：:\s]*/, "").trim();
  while (next !== value) {
    value = next.replace(/^[。；;，,\s]+|[。；;，,\s]+$/g, "");
    next = value.replace(/^(?:记住|保存|建议保存|长期记住|长期记忆|可保存为长期记忆)[：:\s]*/, "").trim();
  }
  return value;
}

function isShortTermMemoryCandidate(text = "") {
  const value = normalizeMemoryCandidate(text);
  if (!value) return false;
  if (boundedMemoryPattern.test(value) && !hardRecurringMemoryPattern.test(value)) return true;
  return (shortTermMemoryPattern.test(value) || oneOffMemoryPattern.test(value)) && !hardRecurringMemoryPattern.test(value);
}

function isLongTermMemoryCandidate(text = "") {
  const value = normalizeMemoryCandidate(text);
  return value.length >= 4 && durableMemoryPattern.test(value) && !metaMemoryPattern.test(value) && !incompleteMemoryPattern.test(value) && !isShortTermMemoryCandidate(value);
}

function longTermSuggestions(items = []) {
  const seen = new Set();
  return items
    .map((item) => normalizeMemoryCandidate(item))
    .filter((item) => {
      if (!isLongTermMemoryCandidate(item)) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function updateSubjectHints() {
  const hint = $("#memorySubjectHint");
  if (hint) hint.textContent = `当前对象：${currentSubject()} · ${modeFor().label}。`;
}

async function saveMemory(text) {
  const normalizedText = normalizeMemoryCandidate(text);
  if (!normalizedText) {
    toast("请先填写内容");
    return false;
  }
  if (isShortTermMemoryCandidate(normalizedText)) {
    toast("这是今日短期待办，不会保存到长期记忆");
    return false;
  }
  const payload = {
    user_id: "demo_user",
    care_subject: currentSubject(),
    text: normalizedText,
    label: "confirmed",
  };
  const res = await fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = "保存失败";
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch (_) {}
    throw new Error(message);
  }
  const data = await res.json();
  renderMemoryHits(data.memories || []);
  toast("已保存到长期记忆");
  return true;
}

async function saveManualMemory() {
  const text = ($("#manualMemoryText")?.value || "").trim();
  if (!text) {
    toast("请先填写内容");
    return;
  }
  try {
    const saved = await saveMemory(text);
    if (saved) $("#manualMemoryText").value = "";
  } catch (error) {
    toast(error.message);
  }
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

function normalizeCareRecordText(text = "") {
  return String(text)
    .replace(/【[^】]+】/g, "")
    .replace(/[，。、“”‘’；：？！,.!?;:\s]/g, "")
    .toLowerCase()
    .trim();
}

function bigrams(value) {
  const chars = Array.from(value);
  if (chars.length < 2) return new Set(chars);
  const set = new Set();
  for (let index = 0; index < chars.length - 1; index += 1) {
    set.add(`${chars[index]}${chars[index + 1]}`);
  }
  return set;
}

function normalizedCareSignal(value) {
  return String(value || "")
    .replace(/[：]/g, ":")
    .replace(/[／]/g, "/")
    .toLowerCase()
    .trim();
}

function extractCareRecordSignals(text = "") {
  const value = String(text || "").toLowerCase();
  const numberMatches =
    value.match(/\d+(?:[.:：/／]\d+)?|[一二两三四五六七八九十半]+(?=\s*(?:点|时|碗|口|毫升|ml|片|粒|颗|次|分钟|小时|度|℃|斤|克|kg|g))/gi) || [];
  const numbers = new Set(numberMatches.map(normalizedCareSignal).filter(Boolean));
  const dates = new Set();
  const timeSlots = new Set();
  const collect = (target, matchers) => {
    matchers.forEach(([name, pattern]) => {
      if (pattern.test(value)) target.add(name);
    });
  };
  collect(dates, [
    ["today", /(今天|今日|今早|今晚|今晨|今中午|今下午)/],
    ["tomorrow", /(明天|明日|明早|明晚|次日|第二天)/],
    ["yesterday", /(昨天|昨日)/],
  ]);
  collect(timeSlots, [
    ["morning", /(早上|早晨|上午|清晨|今早|明早)/],
    ["noon", /(中午|午饭|午餐)/],
    ["afternoon", /(下午|午后|今下午)/],
    ["evening", /(傍晚|晚上|晚饭|晚餐|睡前|今晚|明晚)/],
    ["night", /(凌晨|半夜|夜里|夜间)/],
  ]);
  return { dates, numbers, timeSlots };
}

function careSetIntersects(left, right) {
  return [...left].some((item) => right.has(item));
}

function careSetIsSubset(left, right) {
  return [...left].every((item) => right.has(item));
}

function hasCareRecordSignalConflict(a, b) {
  const left = extractCareRecordSignals(a);
  const right = extractCareRecordSignals(b);
  if (left.dates.size && right.dates.size && !careSetIntersects(left.dates, right.dates)) return true;
  if (left.timeSlots.size && right.timeSlots.size && !careSetIntersects(left.timeSlots, right.timeSlots)) return true;
  if (
    left.numbers.size &&
    right.numbers.size &&
    !careSetIsSubset(left.numbers, right.numbers) &&
    !careSetIsSubset(right.numbers, left.numbers)
  ) {
    return true;
  }
  return false;
}

function careRecordSimilarity(a, b) {
  const left = normalizeCareRecordText(a);
  const right = normalizeCareRecordText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  if (shorter.length >= 8 && longer.includes(shorter)) {
    return shorter.length / longer.length >= 0.62 ? 0.94 : 0.78;
  }
  const leftSet = bigrams(left);
  const rightSet = bigrams(right);
  let overlap = 0;
  leftSet.forEach((item) => {
    if (rightSet.has(item)) overlap += 1;
  });
  return (2 * overlap) / Math.max(1, leftSet.size + rightSet.size);
}

function isDuplicateCareRecord(text, entries = state.careEntries) {
  return entries.some((entry) => careRecordSimilarity(text, entry.text) >= 0.86 && !hasCareRecordSignalConflict(text, entry.text));
}

function careRecordFragments(text = "") {
  const value = String(text || "").trim();
  if (!value) return [];
  const fragments = splitCareSentences(value).filter((item) => normalizeCareRecordText(item).length >= 3);
  return fragments.length ? fragments : [value];
}

function prepareCareEntryMerge(text = "") {
  const pending = [];
  const duplicates = [];
  const seen = [...state.careEntries];
  careRecordFragments(text).forEach((fragment) => {
    if (isDuplicateCareRecord(fragment, seen)) {
      duplicates.push(fragment);
      return;
    }
    const entry = {
      id: `care-${Date.now()}-${state.careEntrySeq + pending.length + 1}`,
      text: fragment,
      scene: currentScene(),
      subject: currentSubject(),
    };
    pending.push(entry);
    seen.push(entry);
  });
  return { entries: [...state.careEntries, ...pending], pending, duplicates };
}

function careEntriesToText(entries = state.careEntries) {
  return entries.map((entry) => entry.text).join("。\n");
}

function renderCareEntries() {
  const panel = $("#careRecordLog");
  const list = $("#careRecordList");
  if (!panel || !list) return;
  panel.classList.toggle("hidden", !state.careEntries.length);
  setText("#careRecordCount", `${state.careEntries.length} 条`);
  list.innerHTML = state.careEntries
    .map(
      (entry, index) => `
        <article class="care-record-item">
          <span>${index + 1}</span>
          <p>${escapeHtml(entry.text)}</p>
        </article>
      `,
    )
    .join("");
}

function resetCareEntries() {
  state.careEntries = [];
  state.careEntrySeq = 0;
  renderCareEntries();
}

function commitCareEntries(entries) {
  state.careEntries = entries;
  state.careEntrySeq = Math.max(state.careEntrySeq, entries.length);
  renderCareEntries();
}

function clearComposerInput() {
  $("#careText").value = "";
  state.audioBlob = null;
  state.imageFile = null;
  state.imageInsights = "";
  state.imageInspected = false;
  state.audioDecoded = false;
  $("#audioUpload").value = "";
  $("#imageUpload").value = "";
  $("#audioStatus").textContent = "未录音";
  $("#imageStatus").textContent = "未上传";
  $("#imagePreview").classList.add("hidden");
  $("#imageInsightsBox").classList.add("hidden");
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
  syncSubjectSidebar({ persist: true });
  clearTimeout(state.draftTimer);
  const merge = prepareCareEntryMerge($("#careText").value || "");
  const combinedText = careEntriesToText(merge.entries);
  if (!combinedText.trim()) {
    toast("请先填写照护记录");
    return;
  }
  setProgress(true);
  const wantsVisual = $("#visualToggle").checked;
  const form = new FormData();
  form.append("care_subject", currentSubject());
  form.append("user_id", "demo_user");
  form.append("text", combinedText);
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
    commitCareEntries(merge.entries);
    clearComposerInput();
    loadHistory();
    if (wantsVisual) generateVisualAsync(data.card);
    if (merge.duplicates.length) {
      toast(`交接卡已生成，已合并 ${merge.duplicates.length} 条重复记录`);
    } else if (merge.pending.length) {
      toast(`交接卡已生成，新增 ${merge.pending.length} 条记录`);
    } else {
      toast(data.ok ? "交接卡已更新" : "已显示兜底结果");
    }
  } catch (error) {
    setGenerationSource("生成失败", "failed");
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
  const mode = modeFor();
  state.lastCard = card;
  setGenerationSource("API 已生成", "generated");
  $("#copyMessageBtn").disabled = false;
  $("#copyInlineBtn").disabled = false;
  $("#speakBtn").disabled = false;
  $("#careStatus").textContent = card.care_status || "需确认";
  $("#cardDate").textContent = card.date || "今日";
  $("#cardSubject").textContent = mode.summaryTitle(card.care_subject || currentSubject());
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
  const scene = currentScene();
  const sentences = splitCareSentences(text);
  const confirmWords = /(不确定|没确认|未确认|是否|还没|待确认|确认一下|需要确认|还要确认|有没有)/;
  const todoWords = /(下一步|下一次|预计|待做|待办|还要|需要|要去|要带|记得|提醒|明天|加一个|新增|添加|加上|加入|准备|观察|复查|复诊|喂药|洗澡|测|安排|喂奶|喂食|饮水|排泄|猫砂|遛|拍嗝|哄睡)/;
  const doneWords = /(已完成|已经|已|吃了|喝了|睡了|完成|做了|喂了|测了|洗了|消毒)/;
  const medicineWords =
    scene === "baby"
      ? /(处方|药|服用|口服|剂量|mg)/i
      : scene === "pet"
        ? /(处方|药|喂药|服用|口服|剂量|mg)/i
        : /(处方|药|服用|口服|饭前|饭后|每日|每天|一天|每次|剂量|片|粒|胶囊|ml|毫升|mg)/i;
  const abnormalWords = /(疼|痛|吐|呕吐|发烧|发热|咳|血压|血糖|哭闹|胀气|软便|拉稀|异常|不适|精神差|没精神|体温)/;
  const confirms = [];
  const todos = [];
  const completed = [];

  sentences.forEach((sentence) => {
    const title = cleanDraftTitle(sentence);
    if (isLongTermMemoryCandidate(sentence)) return;
    const due = inferDueTime(sentence);
    const isMedicine = medicineWords.test(sentence);
    const isAbnormal = abnormalWords.test(sentence);
    const safetyNote = sceneSafetyNote(scene, { isMedicine, isAbnormal });
    if (confirmWords.test(sentence)) {
      confirms.push({
        title: title.startsWith("确认") ? title : `确认${title}`,
        due_time: due || "尽快",
        owner: "现负责照护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: safetyNote,
      });
    } else if (doneWords.test(sentence) && !todoWords.test(sentence)) {
      completed.push({ title, time: due, source: "输入预览" });
    } else if (todoWords.test(sentence) || isMedicine) {
      todos.push({
        title: isMedicine && !title.includes("确认") ? `按原文确认用药安排：${title}` : title,
        due_time: due || "待定",
        owner: "现负责照护人",
        priority: isMedicine || isAbnormal ? "high" : "medium",
        safety_note: safetyNote,
      });
    } else if (isAbnormal && scene !== "elder") {
      confirms.push({
        title,
        due_time: due || "持续观察",
        owner: "现负责照护人",
        priority: "high",
        safety_note: safetyNote,
      });
    }
  });

  return { confirms: confirms.slice(-8), todos: todos.slice(-10), completed: completed.slice(-8) };
}

function sceneSafetyNote(scene, flags = {}) {
  if (!flags.isMedicine && !flags.isAbnormal) return "";
  if (scene === "baby") {
    return flags.isMedicine
      ? "宝宝用药必须按医嘱或儿科建议确认剂量。"
      : "体温、持续哭闹、吐奶或胀气加重时，建议尽快和家人确认是否就医。";
  }
  if (scene === "pet") {
    return flags.isMedicine
      ? "宠物用药按兽医要求执行，避免重复喂药。"
      : "呕吐、软便、精神差或饮水异常要记录频次，必要时联系宠物医院。";
  }
  return flags.isMedicine ? "按医嘱执行；图片或处方信息不清楚时联系医生/家人确认。" : "";
}

function updateDraftFromInput() {
  const text = ($("#careText").value || "").trim();
  const mode = modeFor();
  if (!text) {
    renderDraftShell(currentSubject());
    return;
  }
  const draft = buildDraftItems();
  const card = {
    care_subject: currentSubject(),
    date: "今日",
    care_status: draft.confirms.length ? "需确认" : "输入预览",
    summary: `已读取 ${splitCareSentences(text).length} 条记录，预览到 ${draft.completed.length} 条${mode.metrics.completed}、${draft.confirms.length} 条${mode.metrics.confirm}、${draft.todos.length} 条${mode.metrics.todo}。`,
    completed: draft.completed,
    to_confirm: draft.confirms,
    todos: draft.todos,
    risk_notes: [],
    family_message: mode.familyMessage,
    emotion_analysis: {
      primary_tone: draft.confirms.length ? "需要确认" : "平稳整理",
      anxiety_level: draft.confirms.length ? 48 : 28,
      reassurance: `${mode.artifactTitle}生成后会把不确定事项单独列出。`,
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
  const mode = modeFor();
  renderPreview({
    source_label: "待生成",
    care_subject: subject,
    date: "今日",
    care_status: "待生成",
    summary: mode.emptySummary,
    completed: [],
    to_confirm: [],
    todos: [],
    risk_notes: [],
    family_message: mode.familyMessage,
    emotion_analysis: { primary_tone: "需要记录", anxiety_level: 20, reassurance: "", stress_points: [] },
    risk_radar: mode.riskDefaults,
    timeline: [],
    interaction_questions: [],
    confidence: 0.72,
  });
}

function renderPreview(card) {
  const mode = modeFor();
  setGenerationSource(card.source_label || "输入预览", card.source_state || "");
  $("#careStatus").textContent = card.care_status || "待生成";
  $("#cardDate").textContent = card.date || "今日";
  $("#cardSubject").textContent = mode.summaryTitle(card.care_subject || currentSubject());
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
  const mode = modeFor();
  const text = JSON.stringify(draft);
  const risks = { ...mode.riskDefaults };
  mode.riskRules.forEach(([key, pattern]) => {
    if (pattern.test(text)) risks[key] = key === "symptom" ? 58 : 54;
  });
  if (draft.confirms.length) risks.communication = 66;
  return risks;
}

function renderMetrics(card) {
  $("#completedCount").textContent = (card.completed || []).length;
  $("#confirmCount").textContent = (card.to_confirm || []).length;
  $("#todoCount").textContent = (card.todos || []).length;
  $("#riskCount").textContent = (card.risk_notes || []).length + (card.abnormal_signals || []).length;
}

function healthIndex(card) {
  const risks = card?.risk_radar || {};
  const values = modeFor()
    .riskKeys.map((key) => Number(risks[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return Math.round((card?.confidence || 0.72) * 100);
  const riskAverage = values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length;
  const pendingPenalty = Math.min(18, (card.to_confirm || []).length * 3);
  return Math.max(35, Math.min(98, Math.round(100 - riskAverage * 0.48 - pendingPenalty)));
}

function renderTaskList(items, targetId) {
  const node = $(`#${targetId}`);
  if (!items.length) {
    node.innerHTML = `<div class="task-item task-empty"><div class="task-title"><span></span><span>暂无事项</span></div></div>`;
    return;
  }
  const sortedItems = items
    .map((item, index) => ({
      item,
      index,
      priority: priorityInfo(item.priority),
      due: parseTimelineTime({ time: item.due_time, label: item.title, detail: item.safety_note }),
    }))
    .sort((a, b) => {
      if (a.priority.rank !== b.priority.rank) return a.priority.rank - b.priority.rank;
      if (a.due.sort !== b.due.sort) return a.due.sort - b.due.sort;
      return a.index - b.index;
    });
  node.innerHTML = sortedItems
    .map(({ item, priority, due }, renderIndex) => {
      return `
        <div class="task-item priority-${priority.key}" data-priority-rank="${priority.rank}" data-sort-index="${renderIndex}">
          <label class="task-title">
            <input type="checkbox" />
            <span>${escapeHtml(item.title)}</span>
          </label>
          <div class="task-meta">
            <span>${escapeHtml(due.display || "时间待定")}</span>
            <span>${escapeHtml(item.owner || "家人")}</span>
            <span class="priority-pill">${priority.label}</span>
          </div>
          ${item.safety_note ? `<p class="task-note">${escapeHtml(item.safety_note)}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

function reorderTaskList(node) {
  const items = Array.from(node.querySelectorAll(".task-item:not(.task-empty)"));
  items
    .sort((a, b) => {
      const aDone = a.classList.contains("task-completed") ? 1 : 0;
      const bDone = b.classList.contains("task-completed") ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const aRank = Number(a.dataset.priorityRank || 1);
      const bRank = Number(b.dataset.priorityRank || 1);
      if (!aDone && aRank !== bRank) return aRank - bRank;
      const aDoneAt = Number(a.dataset.completedAt || 0);
      const bDoneAt = Number(b.dataset.completedAt || 0);
      if (aDone && aDoneAt !== bDoneAt) return aDoneAt - bDoneAt;
      return Number(a.dataset.sortIndex || 0) - Number(b.dataset.sortIndex || 0);
    })
    .forEach((item) => node.appendChild(item));
}

function handleTaskToggle(event) {
  const checkbox = event.target?.closest?.(".task-title input[type='checkbox']");
  if (!checkbox) return;
  const item = checkbox.closest(".task-item");
  const list = checkbox.closest(".task-list");
  if (!item || !list) return;
  item.classList.toggle("task-completed", checkbox.checked);
  if (checkbox.checked) {
    item.dataset.completedAt = String(Date.now());
    item.classList.remove("task-just-completed");
    void item.offsetWidth;
    item.classList.add("task-just-completed");
  } else {
    delete item.dataset.completedAt;
    item.classList.remove("task-just-completed");
  }
  reorderTaskList(list);
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dayLabel(offset, absoluteLabel = "") {
  if (offset === -1) return "昨日";
  if (offset === 0) return "今日";
  if (offset === 1) return "明日";
  if (offset === 2) return "后日";
  return absoluteLabel || "日期待定";
}

function parseTimelineTime(item = {}) {
  const rawTime = String(item.time || "").trim();
  const joined = `${rawTime} ${item.label || ""} ${item.detail || ""}`;
  let dayOffset = /后天|后日/.test(joined) ? 2 : /明天|明日|明早|明晚/.test(joined) ? 1 : 0;
  let absoluteLabel = "";
  let hasDate = /今天|今日|明天|明日|后天|后日|明早|明晚/.test(joined);

  const isoMatch = joined.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch.map((value) => value || "");
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(Number(year), Number(month) - 1, Number(day));
    dayOffset = Math.round((target - base) / 86400000);
    absoluteLabel = `${pad2(month)}-${pad2(day)}`;
    hasDate = true;
  }

  const timeMatch = joined.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*(?:点|:|：)\s*([0-5]?\d)?/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    return {
      sort: dayOffset * 1440 + hour * 60 + minute,
      display: `${dayLabel(dayOffset, absoluteLabel)} ${pad2(hour)}:${pad2(minute)}`,
      exact: true,
    };
  }

  const periodRules = [
    ["凌晨", 360, "凌晨"],
    ["明早", 540, "上午"],
    ["早上", 480, "早上"],
    ["上午", 540, "上午"],
    ["中午", 720, "中午"],
    ["下午", 900, "下午"],
    ["明晚", 1200, "晚上"],
    ["今晚", 1200, "晚上"],
    ["晚上", 1200, "晚上"],
    ["晚间", 1200, "晚上"],
  ];
  const period = periodRules.find(([word]) => joined.includes(word));
  if (period) {
    return {
      sort: dayOffset * 1440 + period[1],
      display: `${dayLabel(dayOffset, absoluteLabel)} ${period[2]}`,
      exact: false,
    };
  }

  if (hasDate) {
    return {
      sort: dayOffset * 1440 + 1439,
      display: dayLabel(dayOffset, absoluteLabel),
      exact: false,
    };
  }

  return { sort: Number.POSITIVE_INFINITY, display: rawTime || "待定", exact: false };
}

function timelineEventKind(item = {}) {
  const text = `${item.type || ""} ${item.label || ""} ${item.detail || ""}`;
  if (/药|服用|剂量|喂药/.test(text)) return "medicine";
  if (/血压|血糖|体温|异常|不适|吐|痛|哭闹/.test(text)) return "risk";
  if (/复诊|复查|医院|医生|医保|病历/.test(text)) return "appointment";
  if (/吃|喝|粥|进食|喂奶|喂食|饮水/.test(text)) return "meal";
  if (/准备|放入|带|材料|航空箱/.test(text)) return "prepare";
  if (/睡|午休|入睡/.test(text)) return "sleep";
  if (/确认|待确认|有没有|是否/.test(text)) return "confirm";
  return String(item.type || "care");
}

function timelineItemScore(item = {}) {
  return String(item.label || "").length * 2 + String(item.detail || "").length + (item.type === "done" ? 4 : 0);
}

function normalizeTimelineItems(items = []) {
  const map = new Map();
  items.forEach((item, index) => {
    const parsed = parseTimelineTime(item);
    const kind = timelineEventKind(item);
    const key = `${Number.isFinite(parsed.sort) ? parsed.sort : "unknown"}-${kind}`;
    const normalized = { ...item, _time: parsed, _kind: kind, _index: index };
    const existing = map.get(key);
    if (!existing || timelineItemScore(normalized) > timelineItemScore(existing)) {
      map.set(key, normalized);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a._time.sort !== b._time.sort) return a._time.sort - b._time.sort;
    const typeOrder = { done: 0, care: 1, confirm: 2, todo: 3, risk: 4 };
    const aType = typeOrder[a.type] ?? 5;
    const bType = typeOrder[b.type] ?? 5;
    if (aType !== bType) return aType - bType;
    return a._index - b._index;
  });
}

function renderTimeline(items) {
  const node = $("#timeline");
  if (!items.length) {
    node.innerHTML = `<div class="timeline-item"><div class="time-chip">待定</div><div><h4>暂无时间线</h4><p>生成后显示照护事件。</p></div></div>`;
    return;
  }
  node.innerHTML = normalizeTimelineItems(items)
    .map(
      (item) => `
        <div class="timeline-item ${escapeHtml(item.type || "care")}">
          <div class="time-chip">${escapeHtml(item._time.display || "待定")}</div>
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
  const mode = modeFor();
  const entries = mode.riskKeys.map((key) => [key, risks[key] ?? mode.riskDefaults[key] ?? 20]);
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
    } else if (data.visual_fallback_svg) {
      state.lastCard.visual_fallback_svg = data.visual_fallback_svg;
      renderVisual(state.lastCard);
      toast((data.warnings || ["交接卡已生成，AI 图片使用备用图"])[0]);
    } else {
      renderVisual(state.lastCard);
      $("#visualBadge").textContent = imageSrc(state.lastCard) ? "备用图" : "待生成";
      toast((data.warnings || ["交接卡已生成，AI 图片使用备用图"])[0]);
    }
  } catch (error) {
    if (state.lastCard === currentCard) {
      renderVisual(state.lastCard);
      $("#visualBadge").textContent = imageSrc(state.lastCard) ? "备用图" : "待生成";
      toast("交接卡已生成，AI 图片暂不可用");
    }
  }
}

function renderSuggestions(items) {
  const node = $("#memorySuggestions");
  const suggestions = longTermSuggestions(items);
  if (!suggestions.length) {
    node.innerHTML = `
      <div class="suggestion-empty-card">
        <span class="memory-card-icon care">AI</span>
        <div>
          <strong>暂无新的建议</strong>
          <p>${escapeHtml(modeFor().memory.suggestionEmpty)}</p>
        </div>
      </div>
    `;
    return;
  }
  node.innerHTML = suggestions
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
            <button type="button" data-save-memory="${escapeHtml(item)}">保存为长期记忆</button>
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

function parseHistoryDate(value) {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

function historyDayKey(value) {
  const date = parseHistoryDate(value);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
}

function historyDayLabel(value) {
  const date = parseHistoryDate(value);
  if (!date) return "日期待确认";
  const today = new Date();
  const startOf = (item) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const dayDiff = Math.round((startOf(today) - startOf(date)) / 86400000);
  const dateText = `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
  if (dayDiff === 0) return `今天 · ${dateText}`;
  if (dayDiff === 1) return `昨天 · ${dateText}`;
  return dateText;
}

function historyTimeLabel(value) {
  const date = parseHistoryDate(value);
  if (!date) return "时间待确认";
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function historyDisplayText(item) {
  return String(item.summary || item.input_text || "已生成交接记录").trim();
}

function historyInputPreview(item) {
  const input = String(item.input_text || "").trim();
  const summary = historyDisplayText(item);
  if (!input || careRecordSimilarity(input, summary) >= 0.9) return "";
  return input.length > 88 ? `${input.slice(0, 88)}...` : input;
}

function historySimilarity(a, b) {
  const left = normalizeCareRecordText(a);
  const right = normalizeCareRecordText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return careRecordSimilarity(left, right);
}

function sameHistoryCluster(item, group) {
  const subject = item.care_subject || currentSubject();
  if (subject !== group.care_subject) return false;
  if (historyDayKey(item.created_at) !== group.dayKey) return false;
  const summaryScore = historySimilarity(historyDisplayText(item), group.text);
  if (summaryScore < 0.92) return false;
  if (summaryScore >= 0.98) return true;
  const leftInput = String(item.input_text || "").trim();
  const rightInput = String(group.input_text || "").trim();
  if (!leftInput || !rightInput) return true;
  return historySimilarity(leftInput, rightInput) >= 0.88;
}

function compactHistoryRecords(records) {
  const groups = [];
  records.forEach((item) => {
    const text = historyDisplayText(item);
    const existing = groups.find((group) => sameHistoryCluster(item, group));
    if (existing) {
      existing.count += 1;
      existing.merged.push(item);
      return;
    }
    groups.push({
      ...item,
      care_subject: item.care_subject || currentSubject(),
      text,
      inputPreview: historyInputPreview(item),
      dayKey: historyDayKey(item.created_at),
      count: 1,
      merged: [item],
    });
  });
  return groups.slice(0, 12);
}

function historyInitial(subject) {
  return Array.from(String(subject || "照").trim())[0] || "照";
}

function renderHistory(records) {
  const node = $("#historyList");
  if (!records.length) {
    setText("#historySummary", "当前对象还没有历史交接记录。");
    node.innerHTML = `<div class="history-empty">暂无历史交接记录</div>`;
    return;
  }
  const compacted = compactHistoryRecords(records);
  const mergedCount = compacted.reduce((total, item) => total + Math.max(0, item.count - 1), 0);
  setText(
    "#historySummary",
    `显示最近 ${compacted.length} 组交接${mergedCount ? `，已合并 ${mergedCount} 条重复记录` : "，按时间倒序排列"}`,
  );
  const byDay = compacted.reduce((groups, item) => {
    if (!groups[item.dayKey]) groups[item.dayKey] = [];
    groups[item.dayKey].push(item);
    return groups;
  }, {});
  node.innerHTML = Object.entries(byDay)
    .map(
      ([dayKey, items]) => `
        <section class="history-day-group" aria-label="${escapeHtml(historyDayLabel(items[0]?.created_at || dayKey))}">
          <div class="history-day-label">${escapeHtml(historyDayLabel(items[0]?.created_at || dayKey))}</div>
          ${items
            .map(
              (item) => `
                <article class="history-item">
                  <div class="history-rail" aria-hidden="true">
                    <span>${escapeHtml(historyInitial(item.care_subject))}</span>
                  </div>
                  <div class="history-card-main">
                    <div class="history-item-top">
                      <div>
                        <strong>${escapeHtml(item.care_subject)}</strong>
                        <small>${escapeHtml(item.count > 1 ? `同类记录 ${item.count} 次` : "单次交接")}</small>
                      </div>
                      <div class="history-meta">
                        <span>${escapeHtml(historyTimeLabel(item.created_at))}</span>
                        ${item.count > 1 ? `<b>已合并</b>` : ""}
                      </div>
                    </div>
                    <p>${escapeHtml(item.text)}</p>
                    ${item.inputPreview ? `<div class="history-input-preview">${escapeHtml(item.inputPreview)}</div>` : ""}
                  </div>
                </article>
              `,
            )
            .join("")}
        </section>
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
  $(".subject-list")?.addEventListener("click", async (event) => {
    const button = event.target?.closest?.(".subject-option");
    if (button) {
      const sameSubject = currentSubject() === button.dataset.subject && currentScene() === button.dataset.scene;
      $("#subjectInput").value = button.dataset.subject;
      $("#sceneSelect").value = button.dataset.scene;
      if (!sameSubject) resetCareEntries();
      syncSubjectSidebar({ persist: true });
      updateTopTitle();
      await Promise.all([loadMemories(), loadHistory()]);
      state.lastCard = null;
      disableResultActions();
      renderDraftShell(currentSubject());
    }
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
  document.addEventListener("change", handleTaskToggle);
  $("#subjectInput").addEventListener("change", async () => {
    resetCareEntries();
    syncSubjectSidebar({ persist: true });
    updateTopTitle();
    await Promise.all([loadMemories(), loadHistory()]);
    state.lastCard = null;
    disableResultActions();
    renderDraftShell(currentSubject());
  });
  $("#subjectInput").addEventListener("input", () => {
    state.lastCard = null;
    disableResultActions();
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
    const quick = event.target?.closest?.("[data-quick-input]");
    if (quick) {
      appendQuickInput(quick.dataset.quickInput);
      return;
    }
    const saveText = event.target?.dataset?.saveMemory;
    const deleteId = event.target?.dataset?.deleteMemory;
    if (saveText) {
      try {
        await saveMemory(saveText);
      } catch (error) {
        toast(error.message);
      }
    }
    if (deleteId) await deleteMemory(deleteId);
  });
}

function scheduleDraftUpdate() {
  state.lastCard = null;
  disableResultActions();
  clearTimeout(state.draftTimer);
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
  renderCareEntries();
  await Promise.all([loadMemories(), loadHistory()]);
  renderDraftShell(currentSubject());
}

init().catch((error) => toast(error.message));
