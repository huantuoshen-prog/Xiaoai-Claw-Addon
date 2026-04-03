const THEME_STORAGE_KEY = "xiaoai_console_theme";
const CONSOLE_TAB_STORAGE_KEY = "xiaoai_console_tab";
const TAB_ORDER = ["overview", "chat", "control", "events"];
const DEFAULT_DIALOG_WINDOW_SECONDS = 30;
const MIN_DIALOG_WINDOW_SECONDS = 5;
const MAX_DIALOG_WINDOW_SECONDS = 300;
const DEFAULT_VOICE_CONTEXT_TURNS = 6;
const DEFAULT_VOICE_CONTEXT_CHARS = 1400;
const MAX_VOICE_CONTEXT_TURNS = 24;
const MAX_VOICE_CONTEXT_CHARS = 8000;
const MAX_OPENCLAW_VOICE_SYSTEM_PROMPT_CHARS = 6000;
const MAX_TRANSITION_PHRASES = 12;
const MAX_TRANSITION_PHRASE_CHARS = 40;
const SPEAKER_PAUSE_MEMORY_TTL_MS = 20 * 1000;
const CONTROL_MASONRY_BREAKPOINT_PX = 961;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getStoredThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) || "auto";
    return stored === "light" || stored === "dark" || stored === "auto"
      ? stored
      : "auto";
  } catch (_) {
    return "auto";
  }
}

function resolveTheme(mode) {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeMode(mode, persist) {
  const safeMode =
    mode === "light" || mode === "dark" || mode === "auto" ? mode : "auto";
  const resolved = resolveTheme(safeMode);
  document.documentElement.dataset.themeMode = safeMode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, safeMode);
    } catch (_) {}
  }
  syncThemeSwitches();
}

function syncThemeSwitches() {
  const current = document.documentElement.dataset.themeMode || "auto";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === current;
    button.dataset.active = active ? "true" : "false";
    button.setAttribute("aria-pressed", String(active));
  });
}

function initThemeSwitches() {
  document.querySelectorAll("[data-theme-switch]").forEach((root) => {
    root.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        applyThemeMode(button.dataset.themeChoice || "auto", true);
      });
    });
  });
  syncThemeSwitches();
}

function initThemeSystem() {
  applyThemeMode(getStoredThemeMode(), false);
  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if ((document.documentElement.dataset.themeMode || "auto") === "auto") {
        applyThemeMode("auto", false);
      }
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleChange);
    }
  }
}

function initAccessPage() {
  const accessTokenInput = byId("accessTokenInput");

  if (accessTokenInput) {
    window.setTimeout(() => {
      accessTokenInput.focus();
    }, 80);
  }
}

function initConsolePage() {
  const API = {
    bootstrap: new URL("./api/bootstrap", window.location.href),
    conversations: new URL("./api/conversations", window.location.href),
    events: new URL("./api/events", window.location.href),
    chatSend: new URL("./api/chat/send", window.location.href),
    speak: new URL("./api/speaker/speak", window.location.href),
    audioPlay: new URL("./api/speaker/play-audio", window.location.href),
    audioPause: new URL("./api/speaker/pause", window.location.href),
    audioResume: new URL("./api/speaker/resume", window.location.href),
    audioStop: new URL("./api/speaker/stop", window.location.href),
    wake: new URL("./api/device/wake-up", window.location.href),
    volume: new URL("./api/device/volume", window.location.href),
    mute: new URL("./api/device/mute", window.location.href),
    dialogWindow: new URL("./api/device/dialog-window", window.location.href),
    thinking: new URL("./api/openclaw/thinking", window.location.href),
    nonStreaming: new URL("./api/openclaw/non-streaming", window.location.href),
    openclawModel: new URL("./api/openclaw/model", window.location.href),
    voiceSystemPrompt: new URL("./api/openclaw/voice-system-prompt", window.location.href),
    transitionPhrases: new URL("./api/device/transition-phrases", window.location.href),
    debugLog: new URL("./api/debug-log", window.location.href),
    voiceContext: new URL("./api/openclaw/voice-context", window.location.href),
    mode: new URL("./api/device/mode", window.location.href),
    wakeWord: new URL("./api/device/wake-word", window.location.href),
    deviceList: new URL("./api/device/list", window.location.href),
    deviceSelect: new URL("./api/device/select", window.location.href),
    accountLogout: new URL("./api/account/logout", window.location.href),
  };

  const state = {
    composeMode: "chat",
    activeTab: "overview",
    bootstrap: null,
    refreshTimer: null,
    hasConversationRender: false,
    currentVolumeValue: 0,
    confirmedVolumeValue: 0,
    hasVolumeSnapshot: false,
    muted: false,
    confirmedMuted: false,
    deviceMuted: false,
    confirmedDeviceMuted: false,
    unmuteBlocked: false,
    confirmedUnmuteBlocked: false,
    muteSupported: true,
    confirmedMuteSupported: true,
    volumeInputTimer: null,
    volumeTextEditing: false,
    speakerControlInFlight: null,
    speakerControlQueued: null,
    speakerStatePending: false,
    speakerStatePendingTimer: null,
    currentDialogWindowValue: DEFAULT_DIALOG_WINDOW_SECONDS,
    dialogWindowDirty: false,
    dialogWindowSaving: false,
    currentVoiceContextTurnsValue: DEFAULT_VOICE_CONTEXT_TURNS,
    currentVoiceContextCharsValue: DEFAULT_VOICE_CONTEXT_CHARS,
    voiceContextDirty: false,
    voiceContextSaving: false,
    currentVoiceSystemPromptValue: "",
    voiceSystemPromptDirty: false,
    voiceSystemPromptSaving: false,
    currentTransitionPhrasesValue: "",
    transitionPhrasesDirty: false,
    transitionPhrasesSaving: false,
    deviceListVisible: false,
    deviceListLoaded: false,
    deviceListLoading: false,
    deviceItems: [],
    lastChatScrollTop: 0,
    wakeWordDirty: false,
    loginWorkspaceOpen: false,
    loginWorkspaceUrl: "",
    pendingDeviceSelectionAfterLogin: false,
    animateEventsNextRender: false,
    eventItems: [],
    eventItemsLoaded: false,
    eventRenderSignature: "",
    thinkingEnabled: false,
    thinkingSaving: false,
    forceNonStreamingEnabled: false,
    forceNonStreamingSaving: false,
    openclawAgentId: "xiaoai",
    openclawModel: "",
    openclawModels: [],
    openclawModelLoading: false,
    openclawModelSaving: false,
    debugLogEnabled: true,
    debugLogSaving: false,
    browserAudioReady: false,
    latestAudioEventId: "",
    currentBrowserAudioUrl: "",
    currentAudioSource: "idle",
    currentAudioStartBusy: false,
    currentAudioPauseBusy: false,
    currentAudioStopBusy: false,
    speakerPauseMemory: null,
    rawSpeakerAudioPlayback: null,
    speakerProgressTimer: null,
    speakerProgressBaseAtMs: 0,
    speakerProgressBasePositionSeconds: 0,
    speakerProgressDurationSeconds: 0,
    controlMasonryFrame: 0,
    controlMasonryObserver: null,
  };

  const els = {
    statDevice: byId("statDevice"),
    statDeviceMeta: byId("statDeviceMeta"),
    deviceStatusText: byId("deviceStatusText"),
    deviceStateBadge: byId("deviceStateBadge"),
    statAccount: byId("statAccount"),
    statRegion: byId("statRegion"),
    statMode: byId("statMode"),
    statModeDetail: byId("statModeDetail"),
    statVolume: byId("statVolume"),
    statVolumeDetail: byId("statVolumeDetail"),
    statLogTitle: byId("statLogTitle"),
    statLog: byId("statLog"),
    statHelper: byId("statHelper"),
    accountActionBtn: byId("accountActionBtn"),
    loginWorkspace: byId("loginWorkspace"),
    loginWorkspaceBackdrop: byId("loginWorkspaceBackdrop"),
    loginWorkspaceFrameShell: byId("loginWorkspaceFrameShell"),
    loginWorkspaceFrame: byId("loginWorkspaceFrame"),
    loginWorkspaceHint: byId("loginWorkspaceHint"),
    loginWorkspaceExternal: byId("loginWorkspaceExternal"),
    loginWorkspaceCloseBtn: byId("loginWorkspaceCloseBtn"),
    toggleDeviceListBtn: byId("toggleDeviceListBtn"),
    deviceListShell: byId("deviceListShell"),
    deviceList: byId("deviceList"),
    conversationScroll: byId("conversationScroll"),
    conversationList: byId("conversationList"),
    eventScroll: byId("eventScroll"),
    eventList: byId("eventList"),
    chatStage: byId("chatStage"),
    composerShell: byId("composerShell"),
    textComposerRow: byId("textComposerRow"),
    composerInput: byId("composerInput"),
    audioUrlInput: byId("audioUrlInput"),
    sendBtn: byId("sendBtn"),
    audioSendBtn: byId("audioSendBtn"),
    wakeBtn: byId("wakeBtn"),
    wakeWordInput: byId("wakeWordInput"),
    wakeWordSaveBtn: byId("wakeWordSaveBtn"),
    voiceSystemPromptInput: byId("voiceSystemPromptInput"),
    voiceSystemPromptSaveBtn: byId("voiceSystemPromptSaveBtn"),
    transitionPhrasesInput: byId("transitionPhrasesInput"),
    transitionPhrasesSaveBtn: byId("transitionPhrasesSaveBtn"),
    thinkingOffToggle: byId("thinkingOffToggle"),
    thinkingOffLabel: byId("thinkingOffLabel"),
    forceNonStreamingToggle: byId("forceNonStreamingToggle"),
    forceNonStreamingLabel: byId("forceNonStreamingLabel"),
    openclawModelSelect: byId("openclawModelSelect"),
    openclawModelDetail: byId("openclawModelDetail"),
    debugLogToggle: byId("debugLogToggle"),
    debugLogLabel: byId("debugLogLabel"),
    volumeSlider: byId("volumeSlider"),
    volumeMuteToggle: byId("volumeMuteToggle"),
    volumeMuteLabel: byId("volumeMuteLabel"),
    dialogWindowInput: byId("dialogWindowInput"),
    voiceContextTurnsInput: byId("voiceContextTurnsInput"),
    voiceContextCharsInput: byId("voiceContextCharsInput"),
    browserAudioDock: byId("browserAudioDock"),
    browserAudioPlayerShell: byId("browserAudioPlayerShell"),
    speakerAudioShell: byId("speakerAudioShell"),
    speakerAudioProgress: byId("speakerAudioProgress"),
    speakerAudioProgressFill: byId("speakerAudioProgressFill"),
    speakerAudioTime: byId("speakerAudioTime"),
    browserAudioTitle: byId("browserAudioTitle"),
    browserAudioStatus: byId("browserAudioStatus"),
    browserAudioPlayer: byId("browserAudioPlayer"),
    browserAudioToggleBtn: byId("browserAudioToggleBtn"),
    browserAudioTime: byId("browserAudioTime"),
    currentAudioStartBtn: byId("currentAudioStartBtn"),
    currentAudioPauseBtn: byId("currentAudioPauseBtn"),
    currentAudioStopBtn: byId("currentAudioStopBtn"),
    controlStack: document.querySelector(".control-stack"),
    toast: byId("toast"),
    tabButtons: Array.from(document.querySelectorAll("[data-console-tab]")),
    tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
    composeButtons: Array.from(
      document.querySelectorAll("[data-compose-mode]")
    ),
    modeButtons: Array.from(document.querySelectorAll("[data-mode-choice]")),
  };

  function showToast(message, tone) {
    if (!els.toast) {
      return;
    }
    els.toast.textContent = message;
    els.toast.dataset.tone = tone === "error" ? "error" : "success";
    els.toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function normalizeAudioEventUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    try {
      const url = new URL(raw, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.toString();
    } catch (_) {
      return "";
    }
  }

  function formatAudioTime(value) {
    const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function buildEventRenderSignature(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return "__empty__";
    }
    return items
      .map((item, index) =>
        [
          index,
          item && item.id ? item.id : "",
          item && item.time ? item.time : "",
          item && item.kind ? item.kind : "",
          item && item.level ? item.level : "",
          item && item.title ? item.title : "",
          item && item.detail ? item.detail : "",
          normalizeAudioEventUrl(item && item.audioUrl),
        ].join("\u001f")
      )
      .join("\u001e");
  }

  function isEventAudioPreviewPlaying() {
    if (!els.eventList) {
      return false;
    }
    return Array.from(
      els.eventList.querySelectorAll('[data-audio-player-root="event"]')
    ).some((root) => {
      const parts = readAudioPlayerParts(root);
      return Boolean(parts && !parts.audio.paused && !parts.audio.ended);
    });
  }

  function flushPendingEventRender() {
    if (!els.eventList || state.activeTab !== "events" || !state.eventItemsLoaded) {
      return;
    }
    if (isEventAudioPreviewPlaying()) {
      return;
    }
    const nextSignature = buildEventRenderSignature(state.eventItems);
    if (nextSignature === state.eventRenderSignature) {
      return;
    }
    renderEvents(state.eventItems, { signature: nextSignature });
  }

  function clearControlMasonryLayout(options) {
    const preserveObserver = Boolean(options && options.preserveObserver);
    if (state.controlMasonryFrame) {
      window.cancelAnimationFrame(state.controlMasonryFrame);
      state.controlMasonryFrame = 0;
    }
    if (!preserveObserver && state.controlMasonryObserver) {
      state.controlMasonryObserver.disconnect();
      state.controlMasonryObserver = null;
    }
    if (!els.controlStack) {
      return;
    }
    els.controlStack.classList.remove("is-masonry-ready");
    els.controlStack.style.removeProperty("height");
    els.controlStack.querySelectorAll(".control-card").forEach((card) => {
      card.style.gridRowEnd = "";
      card.style.position = "";
      card.style.left = "";
      card.style.top = "";
      card.style.width = "";
    });
  }

  function shouldUseControlMasonryLayout() {
    return Boolean(
      els.controlStack &&
        window.matchMedia &&
        window.matchMedia("(min-width: 961px)").matches
    );
  }

  function applyControlMasonryLayout() {
    if (!els.controlStack) {
      return;
    }
    if (!shouldUseControlMasonryLayout()) {
      clearControlMasonryLayout({ preserveObserver: true });
      return;
    }
    const stack = els.controlStack;
    const cards = Array.from(stack.querySelectorAll(".control-card"));
    if (!cards.length) {
      clearControlMasonryLayout({ preserveObserver: true });
      return;
    }

    clearControlMasonryLayout({ preserveObserver: true });
    stack.classList.add("is-masonry-ready");

    const stackStyle = window.getComputedStyle(stack);
    const gap =
      Number.parseFloat(stackStyle.getPropertyValue("--control-stack-gap")) ||
      Number.parseFloat(stackStyle.columnGap) ||
      Number.parseFloat(stackStyle.gap) ||
      12;
    const columnCount = 2;
    const stackWidth = stack.clientWidth;
    const columnWidth = (stackWidth - gap * (columnCount - 1)) / columnCount;
    if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
      clearControlMasonryLayout({ preserveObserver: true });
      return;
    }

    const columnHeights = new Array(columnCount).fill(0);
    cards.forEach((card) => {
      let column = 0;
      for (let index = 1; index < columnCount; index += 1) {
        if (columnHeights[index] < columnHeights[column]) {
          column = index;
        }
      }
      card.style.position = "absolute";
      card.style.width = `${columnWidth}px`;
      card.style.left = `${column * (columnWidth + gap)}px`;
      card.style.top = `${columnHeights[column]}px`;
      columnHeights[column] += card.offsetHeight + gap;
    });

    stack.style.height = `${Math.max(0, Math.max(...columnHeights) - gap)}px`;
  }

  function scheduleControlMasonryLayout() {
    if (state.controlMasonryFrame) {
      window.cancelAnimationFrame(state.controlMasonryFrame);
    }
    state.controlMasonryFrame = window.requestAnimationFrame(() => {
      state.controlMasonryFrame = 0;
      applyControlMasonryLayout();
    });
  }

  function installControlMasonryLayout() {
    clearControlMasonryLayout();
    if (!els.controlStack) {
      return;
    }
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        scheduleControlMasonryLayout();
      });
      if (els.controlStack.parentElement) {
        observer.observe(els.controlStack.parentElement);
      }
      els.controlStack.querySelectorAll(".control-card").forEach((card) => {
        observer.observe(card);
      });
      state.controlMasonryObserver = observer;
    }
    window.addEventListener("resize", scheduleControlMasonryLayout);
    scheduleControlMasonryLayout();
  }

  function readSpeakerAudioParts() {
    if (
      !els.speakerAudioShell ||
      !els.speakerAudioProgress ||
      !els.speakerAudioProgressFill ||
      !els.speakerAudioTime
    ) {
      return null;
    }
    return {
      shell: els.speakerAudioShell,
      progress: els.speakerAudioProgress,
      progressFill: els.speakerAudioProgressFill,
      time: els.speakerAudioTime,
    };
  }

  function getCurrentAudioTitle() {
    const raw =
      els.browserAudioTitle && els.browserAudioTitle.textContent
        ? els.browserAudioTitle.textContent.trim()
        : "";
    return normalizeAudioReplyTitle(raw) || "音频回复";
  }

  function normalizeAudioReplyTitle(value) {
    let normalized = String(value || "").trim();
    while (normalized) {
      const next = normalized.replace(/^\s*音频回复[:：]\s*/u, "").trim();
      if (next === normalized) {
        break;
      }
      normalized = next;
    }
    return (
      normalized || ""
    );
  }

  function getSpeakerAudioPlayback() {
    return state.bootstrap && state.bootstrap.audioPlayback
      ? state.bootstrap.audioPlayback
      : null;
  }

  function getRawSpeakerAudioPlayback() {
    return state.rawSpeakerAudioPlayback ? state.rawSpeakerAudioPlayback : null;
  }

  function canResumeSpeakerPlayback(playback) {
    const rawPlayback = getRawSpeakerAudioPlayback();
    return Boolean(
      playback &&
        playback.status === "paused" &&
        rawPlayback &&
        rawPlayback.status === "paused"
    );
  }

  function clearSpeakerPauseMemory() {
    state.speakerPauseMemory = null;
  }

  function getSpeakerPauseMemory() {
    const memory = state.speakerPauseMemory;
    if (!memory) {
      return null;
    }
    if (Date.now() >= (Number(memory.expiresAtMs) || 0)) {
      clearSpeakerPauseMemory();
      return null;
    }
    return {
      ...memory,
    };
  }

  function rememberSpeakerPausePlayback(playback, deviceId) {
    if (!playback) {
      return null;
    }
    const normalizedUrl = normalizeAudioEventUrl(playback.audioUrl);
    const normalizedTitle = normalizeAudioReplyTitle(playback.title) || "最近一次音频";
    const next = {
      deviceId: String(deviceId || ""),
      title: normalizedTitle,
      audioUrl: normalizedUrl || "",
      status: "paused",
      positionSeconds: Math.max(0, Number(playback.positionSeconds) || 0),
      durationSeconds: Math.max(0, Number(playback.durationSeconds) || 0),
      expiresAtMs: Date.now() + SPEAKER_PAUSE_MEMORY_TTL_MS,
    };
    state.speakerPauseMemory = next;
    return {
      ...next,
    };
  }

  function resolveSpeakerPlayback(playback, device) {
    const currentDeviceId =
      device && typeof device.minaDeviceId === "string"
        ? device.minaDeviceId.trim()
        : "";
    const remembered = getSpeakerPauseMemory();
    const normalizedPlaybackUrl = normalizeAudioEventUrl(playback && playback.audioUrl);

    if (
      remembered &&
      currentDeviceId &&
      remembered.deviceId &&
      remembered.deviceId !== currentDeviceId
    ) {
      clearSpeakerPauseMemory();
      return playback;
    }

    if (playback && playback.status === "playing") {
      clearSpeakerPauseMemory();
      return playback;
    }

    if (playback && playback.status === "paused") {
      rememberSpeakerPausePlayback(playback, currentDeviceId);
      return playback;
    }

    if (
      remembered &&
      normalizedPlaybackUrl &&
      remembered.audioUrl &&
      remembered.audioUrl !== normalizedPlaybackUrl
    ) {
      clearSpeakerPauseMemory();
      return playback;
    }

    if (
      remembered &&
      (!playback || playback.status === "idle")
    ) {
      return {
        ...(playback || {}),
        ...remembered,
        status: "paused",
        title:
          normalizeAudioReplyTitle(remembered.title || (playback && playback.title)) ||
          "最近一次音频",
        audioUrl: remembered.audioUrl || normalizedPlaybackUrl,
        positionSeconds: Math.max(
          0,
          Number(remembered.positionSeconds) ||
            Number(playback && playback.positionSeconds) ||
            0
        ),
        durationSeconds: Math.max(
          0,
          Number(remembered.durationSeconds) ||
            Number(playback && playback.durationSeconds) ||
            0
        ),
      };
    }

    return playback;
  }

  function getSpeakerStartLabel(playback) {
    return playback && playback.status === "playing" ? "暂停" : "播放";
  }

  function getBrowserStartLabel() {
    return els.browserAudioPlayer && !els.browserAudioPlayer.paused
      ? "暂停"
      : "播放";
  }

  function setCurrentAudioMeta(options) {
    const source = options && options.source ? options.source : "idle";
    const title =
      options && typeof options.title === "string" && options.title.trim()
        ? options.title.trim()
        : "暂未播放音频";
    const statusText =
      options && typeof options.statusText === "string" && options.statusText.trim()
        ? options.statusText.trim()
        : "输入 URL 后可直接让音箱播放；如果失败，控制台会直接提示错误。";
    state.currentAudioSource = source;
    if (source !== "speaker") {
      stopSpeakerProgressTimer();
    }

    if (els.browserAudioTitle) {
      els.browserAudioTitle.textContent = title;
    }
    if (els.browserAudioStatus) {
      els.browserAudioStatus.textContent = statusText;
    }
    if (els.browserAudioPlayerShell) {
      els.browserAudioPlayerShell.hidden = source !== "browser";
    }
    if (els.speakerAudioShell) {
      els.speakerAudioShell.hidden = source !== "speaker";
    }
    if (els.currentAudioStartBtn) {
      const canStart =
        Boolean(options && options.canStart) && !state.currentAudioStartBusy;
      const showStart =
        source !== "idle" &&
        (state.currentAudioStartBusy ||
          (!state.currentAudioPauseBusy && canStart));
      els.currentAudioStartBtn.disabled = !canStart;
      els.currentAudioStartBtn.hidden = !showStart;
      els.currentAudioStartBtn.textContent = state.currentAudioStartBusy
        ? "播放中"
        : options && typeof options.startLabel === "string" && options.startLabel.trim()
          ? options.startLabel.trim()
          : "播放";
    }
    if (els.currentAudioPauseBtn) {
      const canPause =
        Boolean(options && options.canPause) && !state.currentAudioPauseBusy;
      const showPause =
        source !== "idle" &&
        (state.currentAudioPauseBusy ||
          (!state.currentAudioStartBusy && canPause));
      els.currentAudioPauseBtn.disabled = !canPause;
      els.currentAudioPauseBtn.hidden = !showPause;
      els.currentAudioPauseBtn.textContent = state.currentAudioPauseBusy
        ? "暂停中"
        : "暂停";
    }
    if (els.currentAudioStopBtn) {
      const canStop =
        source !== "idle" &&
        !state.currentAudioStartBusy &&
        !state.currentAudioPauseBusy &&
        !state.currentAudioStopBusy;
      els.currentAudioStopBtn.hidden = source === "idle";
      els.currentAudioStopBtn.disabled = !canStop;
      els.currentAudioStopBtn.textContent = state.currentAudioStopBusy
        ? "停止中"
        : "停止";
    }
  }

  function syncSpeakerAudioUi(positionSeconds, durationSeconds, status) {
    const parts = readSpeakerAudioParts();
    if (!parts) {
      return;
    }
    const duration =
      Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
    const current = clamp(
      Number(positionSeconds) || 0,
      0,
      duration || Math.max(Number(positionSeconds) || 0, 0)
    );
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    parts.progress.dataset.enabled = duration > 0 ? "true" : "false";
    parts.progressFill.style.width = `${clamp(percent, 0, 100)}%`;
    parts.time.textContent = `${formatAudioTime(current)} / ${
      duration > 0 ? formatAudioTime(duration) : "--:--"
    }`;
    parts.shell.dataset.audioState = status || "idle";
  }

  function stopSpeakerProgressTimer() {
    if (state.speakerProgressTimer) {
      window.clearTimeout(state.speakerProgressTimer);
      state.speakerProgressTimer = null;
    }
  }

  function getProjectedSpeakerPositionSeconds() {
    const base = Math.max(0, Number(state.speakerProgressBasePositionSeconds) || 0);
    const duration =
      Number.isFinite(state.speakerProgressDurationSeconds) &&
      state.speakerProgressDurationSeconds > 0
        ? state.speakerProgressDurationSeconds
        : 0;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - state.speakerProgressBaseAtMs) / 1000)
    );
    const projected = base + elapsedSeconds;
    return duration > 0 ? Math.min(duration, projected) : projected;
  }

  function tickSpeakerProgressUi() {
    const playback = getSpeakerAudioPlayback();
    if (
      !playback ||
      state.currentAudioSource !== "speaker" ||
      playback.status !== "playing"
    ) {
      stopSpeakerProgressTimer();
      return;
    }

    const duration =
      Number.isFinite(state.speakerProgressDurationSeconds) &&
      state.speakerProgressDurationSeconds > 0
        ? state.speakerProgressDurationSeconds
        : 0;
    const nextPosition = getProjectedSpeakerPositionSeconds();
    syncSpeakerAudioUi(nextPosition, duration, "playing");
    if (state.bootstrap && state.bootstrap.audioPlayback) {
      state.bootstrap.audioPlayback = {
        ...state.bootstrap.audioPlayback,
        positionSeconds: nextPosition,
      };
    }

    if (duration > 0 && nextPosition >= duration) {
      stopSpeakerProgressTimer();
      return;
    }
  }

  function syncSpeakerProgressRuntime(playback) {
    stopSpeakerProgressTimer();
    if (
      !playback ||
      state.currentAudioSource !== "speaker" ||
      playback.status !== "playing"
    ) {
      state.speakerProgressBaseAtMs = 0;
      state.speakerProgressBasePositionSeconds = Math.max(
        0,
        Number(playback && playback.positionSeconds) || 0
      );
      state.speakerProgressDurationSeconds =
        Number.isFinite(playback && playback.durationSeconds) &&
        Number(playback.durationSeconds) > 0
          ? Number(playback.durationSeconds)
          : 0;
      return;
    }

    state.speakerProgressBaseAtMs = Date.now();
    state.speakerProgressBasePositionSeconds = Math.max(
      0,
      Number(playback.positionSeconds) || 0
    );
    state.speakerProgressDurationSeconds =
      Number.isFinite(playback.durationSeconds) && Number(playback.durationSeconds) > 0
        ? Number(playback.durationSeconds)
        : 0;
    tickSpeakerProgressUi();
    state.speakerProgressTimer = window.setInterval(() => {
      tickSpeakerProgressUi();
    }, 1000);
  }

  function renderIdleCurrentAudio() {
    syncSpeakerProgressRuntime(null);
    syncSpeakerAudioUi(0, 0, "idle");
    setCurrentAudioMeta({
      source: "idle",
      title: "暂未播放音频",
      statusText:
        "输入 URL 后可直接让音箱播放；如果失败，控制台会直接提示错误。",
      canStart: false,
      startLabel: "播放",
      canPause: false,
    });
  }

  function renderSpeakerCurrentAudio(playback) {
    const title =
      playback && typeof playback.title === "string" && playback.title.trim()
        ? normalizeAudioReplyTitle(playback.title) || playback.title.trim()
        : "最近一次音频";
    const status = playback && playback.status ? playback.status : "idle";
    const resumablePause = canResumeSpeakerPlayback(playback);
    const statusText =
      status === "playing"
        ? "音箱正在播放这段音频。"
        : status === "paused"
          ? resumablePause
            ? "音箱当前已暂停在这里。"
            : "这段音频的暂停状态已经过期，再点播放会从头开始。"
          : "音箱当前没有继续播放这段音频。";
    syncSpeakerAudioUi(
      playback && playback.positionSeconds,
      playback && playback.durationSeconds,
      status
    );
    setCurrentAudioMeta({
      source: "speaker",
      title,
      statusText,
      canStart: Boolean(playback && normalizeAudioEventUrl(playback.audioUrl)),
      startLabel: getSpeakerStartLabel(playback),
      canPause: status === "playing",
    });
    syncSpeakerProgressRuntime(playback);
  }

  function syncBrowserCurrentAudioMeta() {
    if (!els.browserAudioPlayer || state.currentAudioSource !== "browser") {
      return;
    }
    const hasSrc = Boolean(els.browserAudioPlayer.getAttribute("src"));
    if (!hasSrc) {
      renderIdleCurrentAudio();
      return;
    }
    if (
      els.browserAudioPlayerShell &&
      els.browserAudioPlayerShell.dataset.audioUnavailable === "true"
    ) {
      setCurrentAudioMeta({
      source: "browser",
      title: getCurrentAudioTitle(),
      statusText: "这段音频现在已经不可用了，可能已过期或被清理。",
      canStart: false,
      startLabel: "播放",
      canPause: false,
    });
      return;
    }
    const ended =
      Number.isFinite(els.browserAudioPlayer.duration) &&
      els.browserAudioPlayer.duration > 0 &&
      els.browserAudioPlayer.currentTime >=
        Math.max(0, els.browserAudioPlayer.duration - 0.25);
    setCurrentAudioMeta({
      source: "browser",
      title: getCurrentAudioTitle(),
      statusText: ended
        ? "浏览器预览已经播完了。"
        : els.browserAudioPlayer.paused
          ? "浏览器预览已暂停。"
          : "浏览器正在播放这段音频。",
      canStart: hasSrc,
      startLabel: getBrowserStartLabel(),
      canPause: !els.browserAudioPlayer.paused && !ended,
    });
  }

  function describeAudioPlayError(error, audio) {
    const name =
      error && typeof error.name === "string" ? error.name.trim() : "";
    const message =
      error && typeof error.message === "string" ? error.message.trim() : "";
    if (name === "NotAllowedError") {
      return "浏览器拦住了自动播放，可以点播放继续。";
    }
    if (
      (audio && audio.error) ||
      name === "NotSupportedError" ||
      /media|source|network|decode|supported|404|403/i.test(message)
    ) {
      return "这段音频现在已经不可用了，可能已过期或被清理。";
    }
    return "音频暂时无法播放，可能链接已失效或已被清理。";
  }

  function markAudioPlayerUnavailable(root) {
    const parts = readAudioPlayerParts(root);
    if (!parts) {
      return;
    }
    root.dataset.audioUnavailable = "true";
    parts.progress.dataset.enabled = "false";
    parts.progressFill.style.width = "0%";
    parts.time.textContent = "资源不可用";
    parts.toggle.textContent = "失效";
    root.dataset.audioState = "error";
  }

  function readAudioPlayerParts(root) {
    if (!root) {
      return null;
    }
    const audio = root.querySelector("audio");
    const toggle = root.querySelector("[data-audio-toggle]");
    const progress = root.querySelector("[data-audio-progress]");
    const progressFill = root.querySelector("[data-audio-progress-fill]");
    const time = root.querySelector("[data-audio-time]");
    if (!audio || !toggle || !progress || !progressFill || !time) {
      return null;
    }
    return {
      audio,
      toggle,
      progress,
      progressFill,
      time,
    };
  }

  function pauseManagedAudioPlayers(exceptAudio) {
    document.querySelectorAll(".audio-player-media").forEach((node) => {
      if (node !== exceptAudio) {
        try {
          node.pause();
        } catch (_) {}
      }
    });
  }

  function syncAudioPlayerUi(root) {
    const parts = readAudioPlayerParts(root);
    if (!parts) {
      return;
    }

    if (root.dataset.audioUnavailable === "true") {
      markAudioPlayerUnavailable(root);
      return;
    }

    const duration =
      Number.isFinite(parts.audio.duration) && parts.audio.duration > 0
        ? parts.audio.duration
        : 0;
    const current = clamp(
      Number(parts.audio.currentTime) || 0,
      0,
      duration || Math.max(Number(parts.audio.currentTime) || 0, 0)
    );
    const ended = duration > 0 && current >= Math.max(0, duration - 0.25);
    const progressPercent = duration > 0 ? (current / duration) * 100 : 0;

    parts.progress.dataset.enabled = duration > 0 ? "true" : "false";
    parts.progressFill.style.width = `${clamp(progressPercent, 0, 100)}%`;
    parts.time.textContent = `${formatAudioTime(current)} / ${
      duration > 0 ? formatAudioTime(duration) : "--:--"
    }`;

    if (!parts.audio.getAttribute("src")) {
      parts.toggle.textContent = "播放";
      root.dataset.audioState = "idle";
      return;
    }

    if (!parts.audio.paused) {
      parts.toggle.textContent = "暂停";
      root.dataset.audioState = "playing";
      return;
    }

    parts.toggle.textContent = ended ? "重播" : current > 0 ? "继续" : "播放";
    root.dataset.audioState = ended ? "ended" : current > 0 ? "paused" : "idle";
  }

  function bindAudioPlayer(root) {
    const parts = readAudioPlayerParts(root);
    if (!parts || root.dataset.audioPlayerBound === "true") {
      return;
    }

    root.dataset.audioPlayerBound = "true";

    parts.toggle.addEventListener("click", async () => {
      if (!parts.audio.getAttribute("src")) {
        return;
      }
      if (!parts.audio.paused) {
        parts.audio.pause();
        syncAudioPlayerUi(root);
        return;
      }
      if (
        Number.isFinite(parts.audio.duration) &&
        parts.audio.duration > 0 &&
        parts.audio.currentTime >= Math.max(0, parts.audio.duration - 0.25)
      ) {
        parts.audio.currentTime = 0;
      }
      pauseManagedAudioPlayers(parts.audio);
      try {
        await parts.audio.play();
      } catch (error) {
        const message = describeAudioPlayError(error, parts.audio);
        showToast(message, "error");
        if (!(error && error.name === "NotAllowedError")) {
          markAudioPlayerUnavailable(root);
          if (root === els.browserAudioPlayerShell) {
            setCurrentAudioMeta({
              source: "browser",
              title: getCurrentAudioTitle(),
              statusText: "这段音频现在已经不可用了，可能已过期或被清理。",
              canStart: false,
              startLabel: getBrowserStartLabel(),
              canPause: false,
            });
          }
          return;
        }
      }
      syncAudioPlayerUi(root);
      if (root === els.browserAudioPlayerShell) {
        syncBrowserCurrentAudioMeta();
      }
    });

    [
      "loadedmetadata",
      "durationchange",
      "timeupdate",
      "play",
      "pause",
      "ended",
      "emptied",
    ].forEach((eventName) => {
      parts.audio.addEventListener(eventName, () => {
        syncAudioPlayerUi(root);
        if (root === els.browserAudioPlayerShell) {
          syncBrowserCurrentAudioMeta();
        }
        if (
          root.dataset.audioPlayerRoot === "event" &&
          (eventName === "pause" || eventName === "ended" || eventName === "emptied")
        ) {
          window.requestAnimationFrame(() => {
            flushPendingEventRender();
          });
        }
      });
    });

    parts.audio.addEventListener("error", () => {
      markAudioPlayerUnavailable(root);
      if (root === els.browserAudioPlayerShell) {
        setCurrentAudioMeta({
          source: "browser",
          title: getCurrentAudioTitle(),
          statusText: "这段音频现在已经不可用了，可能已过期或被清理。",
          canStart: false,
          startLabel: getBrowserStartLabel(),
          canPause: false,
        });
      }
      if (root.dataset.audioPlayerRoot === "event") {
        window.requestAnimationFrame(() => {
          flushPendingEventRender();
        });
      }
    });

    syncAudioPlayerUi(root);
  }

  function hydrateAudioPlayers(scope) {
    (scope || document)
      .querySelectorAll("[data-audio-player-root]")
      .forEach((root) => bindAudioPlayer(root));
  }

  function closeBrowserAudioDock(options) {
    if (els.browserAudioPlayer) {
      els.browserAudioPlayer.pause();
      els.browserAudioPlayer.removeAttribute("src");
      els.browserAudioPlayer.load();
    }
    if (els.browserAudioPlayerShell) {
      delete els.browserAudioPlayerShell.dataset.audioUnavailable;
    }
    state.currentBrowserAudioUrl = "";
    if (els.browserAudioPlayerShell) {
      syncAudioPlayerUi(els.browserAudioPlayerShell);
    }
    if (options && options.restoreSpeaker && state.bootstrap && state.bootstrap.audioPlayback) {
      renderSpeakerCurrentAudio(state.bootstrap.audioPlayback);
      return;
    }
    renderIdleCurrentAudio();
  }

  async function playBrowserAudio(url, title, options) {
    const playableUrl = normalizeAudioEventUrl(url);
    if (!playableUrl || !els.browserAudioPlayer || !els.browserAudioPlayerShell) {
      return false;
    }
    const nextTitle = normalizeAudioReplyTitle(title) || "音频回复";
    setCurrentAudioMeta({
      source: "browser",
      title: nextTitle,
      statusText:
        options && options.autoplay === false
          ? "浏览器已经接到这段音频，点播放即可开始。"
          : "浏览器正在准备播放这段音频。",
      canStart: true,
      startLabel: "播放",
      canPause: false,
    });
    if (state.currentBrowserAudioUrl !== playableUrl) {
      els.browserAudioPlayer.src = playableUrl;
      els.browserAudioPlayer.load();
      state.currentBrowserAudioUrl = playableUrl;
    }
    delete els.browserAudioPlayerShell.dataset.audioUnavailable;
    els.browserAudioPlayer.currentTime = 0;
    hydrateAudioPlayers(document);
    syncAudioPlayerUi(els.browserAudioPlayerShell);
    if (options && options.autoplay === false) {
      return true;
    }
    try {
      pauseManagedAudioPlayers(els.browserAudioPlayer);
      await els.browserAudioPlayer.play();
      syncAudioPlayerUi(els.browserAudioPlayerShell);
      syncBrowserCurrentAudioMeta();
      return true;
    } catch (error) {
      showToast(describeAudioPlayError(error, els.browserAudioPlayer), "error");
      syncAudioPlayerUi(els.browserAudioPlayerShell);
      syncBrowserCurrentAudioMeta();
      return false;
    }
  }

  function shouldAutoPreviewEventAudio(item) {
    if (!item) {
      return false;
    }
    const title = String(item.title || "").trim();
    const detail = String(item.detail || "").trim();
    const kind = String(item.kind || "").trim();
    return [title, detail, kind].some((value) => value.includes("浏览器兜底"));
  }

  function maybeHandleLatestEventAudio(items) {
    const events = Array.isArray(items) ? items : [];
    const latest = events.find(
      (item) =>
        shouldAutoPreviewEventAudio(item) &&
        normalizeAudioEventUrl(item && item.audioUrl)
    );
    if (!latest) {
      state.browserAudioReady = true;
      return;
    }
    if (!state.browserAudioReady) {
      state.browserAudioReady = true;
      state.latestAudioEventId = String(latest.id || "");
      return;
    }
    const latestId = String(latest.id || "");
    if (!latestId || latestId === state.latestAudioEventId) {
      return;
    }
    state.latestAudioEventId = latestId;
    if (
      normalizeAudioEventUrl(latest.audioUrl) &&
      normalizeAudioEventUrl(latest.audioUrl) === state.currentBrowserAudioUrl
    ) {
      return;
    }
    void playBrowserAudio(
      latest.audioUrl,
      normalizeAudioReplyTitle(latest.detail || latest.title) || "音频回复"
    );
  }

  async function pauseCurrentAudio() {
    if (state.currentAudioPauseBusy || !els.currentAudioPauseBtn) {
      return;
    }

    if (state.currentAudioSource === "browser") {
      if (els.browserAudioPlayer) {
        els.browserAudioPlayer.pause();
        syncAudioPlayerUi(els.browserAudioPlayerShell);
        syncBrowserCurrentAudioMeta();
      }
      return;
    }

    if (state.currentAudioSource !== "speaker") {
      return;
    }

    const playbackBeforePause = getSpeakerAudioPlayback();
    const pausedPlayback = playbackBeforePause
      ? {
          ...playbackBeforePause,
          status: "paused",
        }
      : null;

    state.currentAudioPauseBusy = true;
    setCurrentAudioMeta({
      source: "speaker",
      title: getCurrentAudioTitle(),
      statusText: "正在向音箱发送暂停指令…",
      canStart: false,
      startLabel: "播放",
      canPause: false,
    });

    try {
      const payload = await postJson(API.audioPause, {});
      const rememberedPlayback = rememberSpeakerPausePlayback(
        pausedPlayback || (state.bootstrap && state.bootstrap.audioPlayback),
        state.bootstrap && state.bootstrap.device
          ? state.bootstrap.device.minaDeviceId
          : ""
      );
      state.rawSpeakerAudioPlayback = pausedPlayback
        ? {
            ...pausedPlayback,
            status: "paused",
          }
        : rememberedPlayback
          ? {
              ...rememberedPlayback,
              status: "paused",
            }
          : getRawSpeakerAudioPlayback();
      if (state.bootstrap && rememberedPlayback) {
        state.bootstrap.audioPlayback = rememberedPlayback;
        renderSpeakerCurrentAudio(rememberedPlayback);
      }
      showToast(payload.message || "已发送暂停指令。", "success");
      await refreshBootstrap(true);
    } catch (error) {
      clearSpeakerPauseMemory();
      showToast(error.message || String(error), "error");
      if (state.bootstrap && state.bootstrap.audioPlayback) {
        renderSpeakerCurrentAudio(state.bootstrap.audioPlayback);
      } else {
        renderIdleCurrentAudio();
      }
    } finally {
      state.currentAudioPauseBusy = false;
      if (state.currentAudioSource === "speaker") {
        if (state.bootstrap && state.bootstrap.audioPlayback) {
          renderSpeakerCurrentAudio(state.bootstrap.audioPlayback);
        } else {
          renderIdleCurrentAudio();
        }
      } else {
        syncBrowserCurrentAudioMeta();
      }
    }
  }

  async function startCurrentAudio() {
    if (state.currentAudioStartBusy || !els.currentAudioStartBtn) {
      return;
    }

    if (state.currentAudioSource === "browser") {
      if (!els.browserAudioPlayer || !els.browserAudioPlayer.getAttribute("src")) {
        return;
      }
      state.currentAudioStartBusy = true;
      setCurrentAudioMeta({
        source: "browser",
        title: getCurrentAudioTitle(),
        statusText: "正在开始浏览器预览…",
        canStart: false,
        startLabel: getBrowserStartLabel(),
        canPause: false,
      });
      try {
        if (
          Number.isFinite(els.browserAudioPlayer.duration) &&
          els.browserAudioPlayer.duration > 0 &&
          els.browserAudioPlayer.currentTime >=
            Math.max(0, els.browserAudioPlayer.duration - 0.25)
        ) {
          els.browserAudioPlayer.currentTime = 0;
        }
        pauseManagedAudioPlayers(els.browserAudioPlayer);
        await els.browserAudioPlayer.play();
      } catch (error) {
        showToast(describeAudioPlayError(error, els.browserAudioPlayer), "error");
        if (!(error && error.name === "NotAllowedError")) {
          markAudioPlayerUnavailable(els.browserAudioPlayerShell);
        }
      } finally {
        state.currentAudioStartBusy = false;
        syncAudioPlayerUi(els.browserAudioPlayerShell);
        syncBrowserCurrentAudioMeta();
      }
      return;
    }

    if (state.currentAudioSource !== "speaker") {
      return;
    }

    const playback = getSpeakerAudioPlayback();
    if (canResumeSpeakerPlayback(playback)) {
      state.currentAudioStartBusy = true;
      setCurrentAudioMeta({
        source: "speaker",
        title: getCurrentAudioTitle(),
        statusText: "正在向音箱发送播放指令…",
        canStart: false,
        startLabel: "播放",
        canPause: false,
      });
      try {
        const payload = await postJson(API.audioResume, {});
        clearSpeakerPauseMemory();
        state.rawSpeakerAudioPlayback = {
          ...(getRawSpeakerAudioPlayback() || playback || {}),
          status: "playing",
        };
        if (state.bootstrap && state.bootstrap.audioPlayback) {
          state.bootstrap.audioPlayback = {
            ...state.bootstrap.audioPlayback,
            status: "playing",
          };
          renderSpeakerCurrentAudio(state.bootstrap.audioPlayback);
        }
        showToast(payload.message || "已发送继续播放指令。", "success");
        await refreshBootstrap(true);
      } catch (error) {
        showToast(error.message || String(error), "error");
        if (getSpeakerAudioPlayback()) {
          renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
        } else {
          renderIdleCurrentAudio();
        }
      } finally {
        state.currentAudioStartBusy = false;
        if (getSpeakerAudioPlayback()) {
          renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
        } else {
          renderIdleCurrentAudio();
        }
      }
      return;
    }

    const audioUrl = normalizeAudioEventUrl(playback && playback.audioUrl);
    if (!audioUrl) {
      showToast("当前这段音频没有可重新播放的链接。", "error");
      return;
    }

    state.currentAudioStartBusy = true;
    setCurrentAudioMeta({
      source: "speaker",
      title: getCurrentAudioTitle(),
      statusText: "正在向音箱重新发送播放指令…",
      canStart: false,
      startLabel: getSpeakerStartLabel(playback),
      canPause: false,
    });

    try {
      const payload = await postJson(API.audioPlay, {
        url: audioUrl,
        title:
          normalizeAudioReplyTitle(playback && playback.title) || getCurrentAudioTitle(),
        interrupt: true,
        forceRetry: true,
      });
      clearSpeakerPauseMemory();
      if (payload && (payload.ok === false || payload.playback === "browser-fallback")) {
        throw new Error(payload.message || "音箱没有真正开始播放这段音频。");
      }
      const nextPlayback = {
        ...(playback || {}),
        title:
          (payload && payload.title) ||
          normalizeAudioReplyTitle(payload && payload.detail) ||
          getCurrentAudioTitle(),
        status: "playing",
        audioUrl: (payload && payload.url) || audioUrl,
        positionSeconds: 0,
      };
      state.rawSpeakerAudioPlayback = {
        ...nextPlayback,
      };
      if (state.bootstrap) {
        state.bootstrap.audioPlayback = nextPlayback;
      }
      renderSpeakerCurrentAudio(nextPlayback);
      showToast(
        (payload && payload.message) || "已开始播放。",
        payload && payload.ok === false ? "error" : "success"
      );
      await refreshBootstrap(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
      if (state.currentAudioSource === "browser") {
        syncBrowserCurrentAudioMeta();
      } else if (getSpeakerAudioPlayback()) {
        renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
      } else {
        renderIdleCurrentAudio();
      }
    } finally {
      state.currentAudioStartBusy = false;
      if (state.currentAudioSource === "browser") {
        syncBrowserCurrentAudioMeta();
      } else if (getSpeakerAudioPlayback()) {
        renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
      } else {
        renderIdleCurrentAudio();
      }
    }
  }

  async function stopCurrentAudio() {
    if (state.currentAudioStopBusy || !els.currentAudioStopBtn) {
      return;
    }

    if (state.currentAudioSource === "browser") {
      state.currentAudioStopBusy = true;
      setCurrentAudioMeta({
        source: "browser",
        title: getCurrentAudioTitle(),
        statusText: "正在清空浏览器音频…",
        canStart: false,
        startLabel: "播放",
        canPause: false,
      });
      try {
        closeBrowserAudioDock({ restoreSpeaker: false });
        showToast("已停止浏览器音频，并清空当前播放内容。", "success");
      } finally {
        state.currentAudioStopBusy = false;
        renderIdleCurrentAudio();
      }
      return;
    }

    if (state.currentAudioSource !== "speaker") {
      return;
    }

    state.currentAudioStopBusy = true;
    setCurrentAudioMeta({
      source: "speaker",
      title: getCurrentAudioTitle(),
      statusText: "正在向音箱发送停止指令…",
      canStart: false,
      startLabel: "播放",
      canPause: false,
    });

    try {
      const payload = await postJson(API.audioStop, {});
      clearSpeakerPauseMemory();
      state.rawSpeakerAudioPlayback = null;
      if (state.bootstrap) {
        state.bootstrap.audioPlayback = null;
      }
      renderIdleCurrentAudio();
      showToast(payload.message || "已停止当前音频。", "success");
      await refreshBootstrap(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
      if (getSpeakerAudioPlayback()) {
        renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
      } else {
        renderIdleCurrentAudio();
      }
    } finally {
      state.currentAudioStopBusy = false;
      if (getSpeakerAudioPlayback()) {
        renderSpeakerCurrentAudio(getSpeakerAudioPlayback());
      } else {
        renderIdleCurrentAudio();
      }
    }
  }

  function setLoginWorkspaceVisibility(visible) {
    state.loginWorkspaceOpen = Boolean(visible);
    if (els.loginWorkspace) {
      els.loginWorkspace.hidden = !state.loginWorkspaceOpen;
      els.loginWorkspace.setAttribute(
        "aria-hidden",
        String(!state.loginWorkspaceOpen)
      );
    }
    document.body.classList.toggle(
      "login-workspace-open",
      state.loginWorkspaceOpen
    );
  }

  function normalizeLoginWorkspaceUrl(rawUrl) {
    if (!rawUrl) {
      return "";
    }
    try {
      const url = new URL(rawUrl, window.location.href);
      url.searchParams.set("embedded", "1");
      return url.toString();
    } catch (_) {
      return "";
    }
  }

  function normalizeLoginWorkspaceHint(text) {
    const next = String(text || "").trim();
    if (!next || next.length > 48 || next.includes("\n")) {
      return "完成登录后会自动回到控制台。";
    }
    return next;
  }

  function closeLoginWorkspace() {
    setLoginWorkspaceVisibility(false);
  }

  function maskAccountLabel(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) {
      return "未保存账号";
    }
    const atIndex = raw.indexOf("@");
    if (atIndex > 0) {
      const local = raw.slice(0, atIndex);
      const domain = raw.slice(atIndex);
      const visible = local.slice(0, Math.min(3, local.length));
      return `${visible}${local.length > 3 ? "***" : ""}${domain}`;
    }
    if (raw.length <= 5) {
      if (raw.length <= 2) {
        return raw;
      }
      return `${raw.slice(0, 1)}${"*".repeat(
        Math.max(1, raw.length - 2)
      )}${raw.slice(-1)}`;
    }
    return `${raw.slice(0, 3)}${"*".repeat(Math.max(1, raw.length - 5))}${raw.slice(
      -2
    )}`;
  }

  function syncLoginWorkspaceFrameHeight(nextHeight) {
    const frameShell = els.loginWorkspaceFrameShell;
    if (!frameShell) {
      return;
    }

    let desiredHeight = Number(nextHeight) || 0;
    if (!desiredHeight && els.loginWorkspaceFrame) {
      try {
        const frameDocument = els.loginWorkspaceFrame.contentWindow?.document;
        const docEl = frameDocument?.documentElement;
        const body = frameDocument?.body;
        desiredHeight = Math.max(
          docEl ? docEl.scrollHeight : 0,
          docEl ? docEl.offsetHeight : 0,
          body ? body.scrollHeight : 0,
          body ? body.offsetHeight : 0
        );
      } catch (_) {}
    }

    const panel = frameShell.closest(".login-workspace-panel");
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const shellRect = frameShell.getBoundingClientRect();
    const compactViewport = window.innerWidth <= 720;
    const reservedHeight =
      panelRect && shellRect
        ? Math.max(0, panelRect.height - shellRect.height)
        : compactViewport
          ? 52
          : 68;
    const minHeight = compactViewport ? 220 : 280;
    const maxHeight = Math.max(
      minHeight,
      Math.floor(window.innerHeight - (compactViewport ? 20 : 28) - reservedHeight)
    );
    const fallbackHeight = compactViewport ? 276 : 360;
    const safeHeight = clamp(
      Math.ceil(desiredHeight || fallbackHeight),
      minHeight,
      maxHeight
    );
    frameShell.style.height = `${safeHeight}px`;
    frameShell.style.minHeight = `${safeHeight}px`;
  }

  function openLoginWorkspace(rawUrl, hint) {
    const loginUrl = normalizeLoginWorkspaceUrl(rawUrl);
    if (!loginUrl) {
      return false;
    }
    state.loginWorkspaceUrl = loginUrl;
    if (els.loginWorkspaceFrame && els.loginWorkspaceFrame.src !== loginUrl) {
      els.loginWorkspaceFrame.src = loginUrl;
    }
    if (els.loginWorkspaceExternal) {
      els.loginWorkspaceExternal.href = loginUrl;
    }
    if (els.loginWorkspaceHint) {
      els.loginWorkspaceHint.textContent =
        normalizeLoginWorkspaceHint(hint);
    }
    setLoginWorkspaceVisibility(true);
    syncLoginWorkspaceFrameHeight();
    return true;
  }

  async function apiFetch(url, options) {
    let response;
    try {
      response = await fetch(url, {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(options && options.headers ? options.headers : {}),
        },
        ...options,
      });
    } catch (error) {
      const message =
        error && typeof error.message === "string" && error.message.trim()
          ? error.message.trim()
          : "fetch failed";
      throw new Error(`请求失败，控制台后端可能正在重启：${message}`);
    }

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_) {
      payload = { error: text || "Unknown response" };
    }

    if (!response.ok) {
      const fallback = text || "请求失败";
      const message =
        payload && payload.error
          ? typeof payload.error === "string"
            ? payload.error
            : payload.error.message || fallback
          : fallback;
      throw Object.assign(new Error(message), {
        payload,
        status: response.status,
      });
    }

    return payload;
  }

  function postJson(url, body) {
    return apiFetch(url, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  function normalizeTab(value) {
    return TAB_ORDER.includes(value) ? value : "overview";
  }

  function getStoredConsoleTab() {
    try {
      return normalizeTab(localStorage.getItem(CONSOLE_TAB_STORAGE_KEY) || "overview");
    } catch (_) {
      return "overview";
    }
  }

  function setActiveTab(value, persist) {
    const nextTab = normalizeTab(value);
    const previousTab = state.activeTab;
    state.activeTab = nextTab;

    if (nextTab === "events" && previousTab !== "events" && els.eventList) {
      els.eventList.dataset.renderState = "preparing";
    }

    els.tabButtons.forEach((button) => {
      const active = button.dataset.consoleTab === nextTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
    });

    els.tabPanels.forEach((panel) => {
      const active = panel.dataset.tabPanel === nextTab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (persist) {
      try {
        localStorage.setItem(CONSOLE_TAB_STORAGE_KEY, nextTab);
      } catch (_) {}
    }

    if (nextTab === "chat") {
      syncComposerMetrics();
      showComposer();
      scheduleConversationBottomStick(true);
      refreshConversations(true);
    }
    if (nextTab === "events") {
      state.animateEventsNextRender = previousTab !== "events";
      if (state.eventItemsLoaded) {
        renderEvents(state.eventItems);
      } else if (els.eventList) {
        els.eventList.innerHTML =
          '<div class="empty-state">正在读取事件流，稍后就会出现在这里。</div>';
        els.eventList.dataset.renderState = "ready";
      }
      refreshEvents(true);
    }
    if (nextTab === "overview" || nextTab === "control") {
      refreshBootstrap(true);
    }
    if (nextTab === "control") {
      scheduleControlMasonryLayout();
      refreshOpenclawModelState(true);
    }
  }

  function setBadgeTone(element, tone) {
    if (!element) {
      return;
    }
    element.dataset.tone = tone || "neutral";
  }

  function formatFullDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return date.toLocaleTimeString("zh-CN", {
      hour12: false,
    });
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return date.toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isNearBottom(element) {
    if (!element) {
      return true;
    }
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  }

  function scrollConversationToBottom(force) {
    const scroller = els.conversationScroll;
    if (!scroller) {
      return;
    }
    if (!force && !isNearBottom(scroller)) {
      return;
    }
    scroller.scrollTop = scroller.scrollHeight;
  }

  function scheduleConversationBottomStick(force) {
    if (!els.conversationScroll) {
      return;
    }
    window.requestAnimationFrame(() => {
      scrollConversationToBottom(force);
      window.requestAnimationFrame(() => scrollConversationToBottom(force));
    });
    window.setTimeout(() => scrollConversationToBottom(force), 120);
  }

  function showComposer() {
    if (els.chatStage) {
      els.chatStage.classList.remove("is-composer-hidden");
    }
  }

  function hideComposer() {
    if (els.chatStage) {
      els.chatStage.classList.add("is-composer-hidden");
    }
  }

  function autoResizeComposer() {
    if (!els.composerInput) {
      return;
    }
    els.composerInput.style.height = "0px";
    const nextHeight = clamp(els.composerInput.scrollHeight, 38, 112);
    els.composerInput.style.height = `${nextHeight}px`;
    syncComposerMetrics();
  }

  function syncComposerMetrics() {
    if (!els.chatStage || !els.composerShell) {
      return;
    }
    const composerHeight = Math.max(
      88,
      Math.ceil(els.composerShell.getBoundingClientRect().height || 0)
    );
    els.chatStage.style.setProperty(
      "--chat-composer-height",
      `${composerHeight}px`
    );
  }

  function normalizeIntegerText(value, max) {
    const digits = String(value == null ? "" : value).replace(/[^\d]/g, "");
    if (!digits) {
      return "";
    }
    return String(clamp(Number(digits) || 0, 0, max));
  }

  function getFiniteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeVoiceSystemPromptInput(value) {
    return String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .slice(0, MAX_OPENCLAW_VOICE_SYSTEM_PROMPT_CHARS);
  }

  function normalizeTransitionPhrasesList(value) {
    const candidates = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.replace(/\r\n?/g, "\n").split("\n")
        : [];
    const normalized = [];
    const seen = new Set();
    candidates.forEach((item) => {
      const phrase = String(item == null ? "" : item)
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, MAX_TRANSITION_PHRASE_CHARS);
      if (!phrase || seen.has(phrase)) {
        return;
      }
      seen.add(phrase);
      normalized.push(phrase);
    });
    return normalized.slice(0, MAX_TRANSITION_PHRASES);
  }

  function normalizeTransitionPhrasesInput(value) {
    return normalizeTransitionPhrasesList(value).join("\n");
  }

  function clearSpeakerStatePendingTimer() {
    if (state.speakerStatePendingTimer) {
      window.clearTimeout(state.speakerStatePendingTimer);
      state.speakerStatePendingTimer = null;
    }
  }

  function setSpeakerStatePending(pending) {
    state.speakerStatePending = Boolean(pending);
    if (!state.speakerStatePending) {
      clearSpeakerStatePendingTimer();
    }
  }

  function normalizeSpeakerControlCommand(command) {
    if (!command || typeof command !== "object") {
      return null;
    }
    if (command.kind === "mute") {
      return {
        kind: "mute",
        value: Boolean(command.value),
      };
    }
    if (command.kind === "volume") {
      return {
        kind: "volume",
        value: clamp(Math.round(Number(command.value) || 0), 0, 100),
      };
    }
    return null;
  }

  function sameSpeakerControlCommand(left, right) {
    return Boolean(
      left &&
        right &&
        left.kind === right.kind &&
        left.value === right.value
    );
  }

  function sanitizeVolumeMetricText(value) {
    return normalizeIntegerText(value, 100);
  }

  function syncVolumeMetricText(value, options) {
    if (!els.statVolume) {
      return;
    }
    const text = String(value == null ? "" : value);
    const force = Boolean(options && options.force);
    if (!force && state.volumeTextEditing && document.activeElement === els.statVolume) {
      return;
    }
    if (els.statVolume.textContent !== text) {
      els.statVolume.textContent = text;
    }
  }

  function updateVolumeDisplay(value, options) {
    const safe = clamp(Number(value) || 0, 0, 100);
    state.currentVolumeValue = safe;
    if (els.statVolume) {
      els.statVolume.setAttribute("aria-valuenow", String(safe));
    }
    if (els.volumeSlider) {
      els.volumeSlider.value = String(safe);
    }
    syncVolumeMetricText(safe, { force: Boolean(options && options.forceText) });
    return safe;
  }

  function hasPendingLocalVolumeDraft() {
    return Boolean(state.volumeTextEditing || state.volumeInputTimer);
  }

  function updateDialogWindowDisplay(value, options) {
    const safe = clamp(Number(value) || 0, MIN_DIALOG_WINDOW_SECONDS, MAX_DIALOG_WINDOW_SECONDS);
    const forceInput = Boolean(options && options.forceInput);
    state.currentDialogWindowValue = safe;
    if (
      els.dialogWindowInput &&
      (forceInput ||
        document.activeElement !== els.dialogWindowInput ||
        !state.dialogWindowDirty)
    ) {
      els.dialogWindowInput.value = String(safe);
    }
    return safe;
  }

  function updateVoiceContextDisplay(turns, chars, options) {
    const safeTurns = clamp(Number(turns) || 0, 0, MAX_VOICE_CONTEXT_TURNS);
    const safeChars = clamp(Number(chars) || 0, 0, MAX_VOICE_CONTEXT_CHARS);
    const forceInput = Boolean(options && options.forceInput);
    const keepUserInput = !forceInput && (state.voiceContextDirty || state.voiceContextSaving);
    state.currentVoiceContextTurnsValue = safeTurns;
    state.currentVoiceContextCharsValue = safeChars;
    if (els.voiceContextTurnsInput && !keepUserInput) {
      els.voiceContextTurnsInput.value = String(safeTurns);
    }
    if (els.voiceContextCharsInput && !keepUserInput) {
      els.voiceContextCharsInput.value = String(safeChars);
    }
    return {
      turns: safeTurns,
      chars: safeChars,
    };
  }

  function updateVoiceSystemPromptDisplay(value, options) {
    const normalized = normalizeVoiceSystemPromptInput(value);
    const forceInput = Boolean(options && options.forceInput);
    const keepUserInput =
      !forceInput &&
      (state.voiceSystemPromptDirty || state.voiceSystemPromptSaving);
    state.currentVoiceSystemPromptValue = normalized;
    if (els.voiceSystemPromptInput && !keepUserInput) {
      els.voiceSystemPromptInput.value = normalized;
    }
    return normalized;
  }

  function updateTransitionPhrasesDisplay(value, options) {
    const normalized = normalizeTransitionPhrasesInput(value);
    const forceInput = Boolean(options && options.forceInput);
    const keepUserInput =
      !forceInput &&
      (state.transitionPhrasesDirty || state.transitionPhrasesSaving);
    state.currentTransitionPhrasesValue = normalized;
    if (els.transitionPhrasesInput && !keepUserInput) {
      els.transitionPhrasesInput.value = normalized;
    }
    return normalized;
  }

  function renderThinkingToggle(enabled) {
    const nextEnabled = Boolean(enabled);
    state.thinkingEnabled = nextEnabled;
    if (els.thinkingOffToggle) {
      els.thinkingOffToggle.classList.toggle("is-active", nextEnabled);
      els.thinkingOffToggle.setAttribute("aria-pressed", String(nextEnabled));
    }
    if (els.thinkingOffLabel) {
      els.thinkingOffLabel.textContent = nextEnabled ? "已打开" : "已关闭";
    }
  }

  function renderForceNonStreamingToggle(enabled) {
    const nextEnabled = Boolean(enabled);
    state.forceNonStreamingEnabled = nextEnabled;
    if (els.forceNonStreamingToggle) {
      els.forceNonStreamingToggle.classList.toggle("is-active", nextEnabled);
      els.forceNonStreamingToggle.setAttribute(
        "aria-pressed",
        String(nextEnabled)
      );
    }
    if (els.forceNonStreamingLabel) {
      els.forceNonStreamingLabel.textContent = nextEnabled ? "已开启" : "已关闭";
    }
  }

  function formatOpenclawModelContextWindow(value) {
    const safe = Number(value);
    if (!Number.isFinite(safe) || safe <= 0) {
      return "";
    }
    return safe.toLocaleString("zh-CN");
  }

  function formatOpenclawModelInputs(inputs) {
    const normalized = Array.isArray(inputs)
      ? inputs
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean)
      : [];
    if (!normalized.length) {
      return "";
    }
    return normalized
      .map((item) => {
        if (item === "image") {
          return "图片";
        }
        if (item === "text") {
          return "文本";
        }
        return item;
      })
      .join(" / ");
  }

  function normalizeOpenclawModelItem(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const ref = String(value.ref || "").trim();
    const name = String(value.name || ref || "").trim();
    const provider = String(value.provider || "").trim();
    if (!ref || !name || !provider) {
      return null;
    }
    const contextWindow = Number(value.contextWindow);
    return {
      ref,
      name,
      provider,
      contextWindow:
        Number.isFinite(contextWindow) && contextWindow > 0
          ? contextWindow
          : undefined,
      reasoning: Boolean(value.reasoning),
      input: Array.isArray(value.input)
        ? value.input
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        : [],
    };
  }

  function renderOpenclawModelControl(agentId, currentModel, models) {
    state.openclawModelLoading = false;
    state.openclawAgentId =
      typeof agentId === "string" && agentId.trim() ? agentId.trim() : "xiaoai";
    state.openclawModel =
      typeof currentModel === "string" && currentModel.trim()
        ? currentModel.trim()
        : "";
    state.openclawModels = Array.isArray(models)
      ? models.map((item) => normalizeOpenclawModelItem(item)).filter(Boolean)
      : [];

    const currentOption = state.openclawModels.find(
      (item) => item.ref === state.openclawModel
    );

    if (els.openclawModelSelect) {
      const select = els.openclawModelSelect;
      select.replaceChildren();

      if (!state.openclawModels.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "未读取到可用模型";
        select.appendChild(option);
      } else {
        if (!state.openclawModel) {
          const placeholder = document.createElement("option");
          placeholder.value = "";
          placeholder.textContent = "请选择模型";
          select.appendChild(placeholder);
        } else if (!currentOption) {
          const missingOption = document.createElement("option");
          missingOption.value = state.openclawModel;
          missingOption.textContent = `${state.openclawModel}（当前模型，未在列表中）`;
          select.appendChild(missingOption);
        }

        state.openclawModels.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.ref;
          option.textContent =
            item.name && item.name !== item.ref
              ? `${item.name} (${item.ref})`
              : item.ref;
          select.appendChild(option);
        });
      }

      select.value = state.openclawModel || "";
      if (!state.openclawModel && select.options.length > 0) {
        select.selectedIndex = 0;
      }
      select.disabled =
        state.openclawModelLoading ||
        state.openclawModelSaving ||
        !state.openclawModels.length;
    }

    if (els.openclawModelDetail) {
      if (currentOption) {
        const detailParts = [
          `专属 agent：${state.openclawAgentId}`,
          `提供商：${currentOption.provider}`,
          currentOption.contextWindow
            ? `上下文：${formatOpenclawModelContextWindow(
                currentOption.contextWindow
              )}`
            : "",
          currentOption.input.length
            ? `输入：${formatOpenclawModelInputs(currentOption.input)}`
            : "",
          currentOption.reasoning ? "推理：开启" : "推理：关闭",
        ].filter(Boolean);
        els.openclawModelDetail.textContent = detailParts.join(" · ");
      } else if (state.openclawModel) {
        els.openclawModelDetail.textContent = `专属 agent：${state.openclawAgentId} · 当前模型：${state.openclawModel}`;
      } else if (state.openclawModels.length) {
        els.openclawModelDetail.textContent = `专属 agent：${state.openclawAgentId} · 请选择一个模型，保存后会自动重启网关。`;
      } else {
        els.openclawModelDetail.textContent = `专属 agent：${state.openclawAgentId} · 当前配置里还没有读取到可用模型。`;
      }
    }
  }

  function renderOpenclawModelLoading(message) {
    state.openclawModelLoading = true;
    if (els.openclawModelSelect) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "正在读取模型配置…";
      els.openclawModelSelect.replaceChildren(option);
      els.openclawModelSelect.disabled = true;
    }
    if (els.openclawModelDetail) {
      els.openclawModelDetail.textContent =
        message || "正在直接读取 OpenClaw 配置中的模型信息…";
    }
  }

  function renderOpenclawModelLoadFailure(message) {
    state.openclawModelLoading = false;
    if (els.openclawModelSelect) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "读取失败，请重试";
      els.openclawModelSelect.replaceChildren(option);
      els.openclawModelSelect.disabled = true;
    }
    if (els.openclawModelDetail) {
      els.openclawModelDetail.textContent =
        message || "读取 OpenClaw 模型配置失败，请稍后重试。";
    }
  }

  async function refreshOpenclawModelState(silent, options) {
    renderOpenclawModelLoading("正在直接读取 OpenClaw 配置中的模型信息…");
    try {
      const payload = await apiFetch(API.openclawModel);
      renderOpenclawModelControl(
        payload && payload.agentId,
        payload && payload.model,
        payload && payload.models
      );
      return true;
    } catch (error) {
      if (options && options.preserveOnError) {
        renderOpenclawModelControl(
          state.openclawAgentId,
          state.openclawModel,
          state.openclawModels
        );
      } else {
        renderOpenclawModelLoadFailure(
          error && error.message
            ? `模型信息读取失败：${error.message}`
            : "读取 OpenClaw 模型配置失败，请稍后重试。"
        );
      }
      if (!silent) {
        showToast(error.message || String(error), "error");
      }
      return false;
    }
  }

  function renderDebugLogToggle(enabled) {
    const nextEnabled = Boolean(enabled);
    state.debugLogEnabled = nextEnabled;
    if (els.debugLogToggle) {
      els.debugLogToggle.classList.toggle("is-active", nextEnabled);
      els.debugLogToggle.setAttribute("aria-pressed", String(nextEnabled));
    }
    if (els.debugLogLabel) {
      els.debugLogLabel.textContent = nextEnabled ? "已开启" : "已关闭";
    }
  }

  function readVolumeDeviceMuted(volume) {
    return Boolean(volume && volume.deviceMuted);
  }

  function readVolumeUnmuteBlocked(volume) {
    return Boolean(volume && volume.unmuteBlocked);
  }

  function readVolumeMuteSupported(volume) {
    return !(volume && volume.muteSupported === false);
  }

  function syncMuteToggleAvailability(forceDisabled) {
    if (!els.volumeMuteToggle) {
      return;
    }
    const unsupported = !state.muteSupported;
    const blocked =
      !forceDisabled &&
      !unsupported &&
      state.unmuteBlocked &&
      state.muted &&
      !state.speakerControlInFlight &&
      !state.speakerControlQueued;
    els.volumeMuteToggle.disabled = Boolean(forceDisabled || unsupported || blocked);
    els.volumeMuteToggle.title = unsupported
      ? "当前设备不支持可靠的播放静音控制"
      : blocked
        ? "设备真实静音仍处于开启状态，需在音箱侧手动解除一次"
        : "";
  }

  function getSpeakerControlStatusText() {
    if (state.speakerControlQueued) {
      return "已记录新的设置，当前任务完成后继续处理";
    }
    if (state.speakerControlInFlight) {
      return state.speakerControlInFlight.kind === "mute"
        ? "正在切换播放静音"
        : "正在把音量写入音箱";
    }
    if (state.speakerStatePending) {
      return "音箱状态回传中";
    }
    if (!state.muteSupported) {
      return "当前设备不支持可靠的播放静音控制";
    }
    if (state.unmuteBlocked) {
      return "设备真实静音仍处于开启状态，需在音箱侧手动解除一次";
    }
    if (state.deviceMuted) {
      return "设备真实静音已开启";
    }
    return state.muted ? "播放静音已开启" : "设备播放音量";
  }

  function renderMuteToggle(enabled) {
    const nextEnabled = Boolean(enabled);
    state.muted = nextEnabled;
    const pendingMuteCommand =
      state.speakerControlQueued && state.speakerControlQueued.kind === "mute"
        ? state.speakerControlQueued
        : state.speakerControlInFlight && state.speakerControlInFlight.kind === "mute"
          ? state.speakerControlInFlight
          : null;
    const effectiveEnabled = pendingMuteCommand
      ? Boolean(pendingMuteCommand.value)
      : nextEnabled;
    if (els.volumeMuteToggle) {
      els.volumeMuteToggle.classList.toggle("is-active", effectiveEnabled);
      els.volumeMuteToggle.classList.toggle(
        "is-busy",
        Boolean(state.speakerControlInFlight)
      );
      els.volumeMuteToggle.setAttribute("aria-pressed", String(effectiveEnabled));
    }
    syncMuteToggleAvailability(!(state.bootstrap && state.bootstrap.ready));
    if (els.volumeMuteLabel) {
      els.volumeMuteLabel.textContent = state.speakerControlInFlight
        ? "处理中"
        : !state.muteSupported
          ? "不支持"
        : state.unmuteBlocked && effectiveEnabled
          ? "需手动解除"
        : effectiveEnabled
          ? "已开启"
          : "已关闭";
    }
  }

  function renderSpeakerControlState() {
    if (!state.hasVolumeSnapshot) {
      syncVolumeMetricText("-", { force: true });
      if (els.statVolume) {
        els.statVolume.setAttribute("aria-valuenow", "0");
      }
      if (els.volumeSlider) {
        els.volumeSlider.value = "0";
      }
      renderMuteToggle(false);
      if (els.statVolumeDetail) {
        els.statVolumeDetail.textContent = "当前没有拿到音量状态";
      }
      return;
    }
    updateVolumeDisplay(state.currentVolumeValue, {
      forceText: !state.volumeTextEditing,
    });
    renderMuteToggle(state.muted);
    if (els.statVolumeDetail) {
      els.statVolumeDetail.textContent = getSpeakerControlStatusText();
    }
  }

  function setControlAvailability(ready) {
    const disabled = !ready;
    [
      els.composerInput,
      els.audioUrlInput,
      els.sendBtn,
      els.audioSendBtn,
      els.wakeBtn,
      els.volumeSlider,
      els.dialogWindowInput,
      els.voiceContextTurnsInput,
      els.voiceContextCharsInput,
    ].forEach((element) => {
      if (element) {
        element.disabled = disabled;
      }
    });
    syncMuteToggleAvailability(disabled);
    els.composeButtons.forEach((button) => {
      button.disabled = disabled;
    });
    els.modeButtons.forEach((button) => {
      button.disabled = disabled;
    });
    if (els.statVolume) {
      els.statVolume.setAttribute(
        "contenteditable",
        disabled ? "false" : "plaintext-only"
      );
      els.statVolume.setAttribute("aria-disabled", String(disabled));
    }
  }

  function setComposeMode(mode) {
    state.composeMode = mode === "speak" ? "speak" : "chat";
    els.composeButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.composeMode === state.composeMode
      );
    });

    if (!els.composerInput || !els.sendBtn) {
      return;
    }

    if (state.composeMode === "chat") {
      els.composerInput.placeholder = "输入一条发给小爱的消息";
      els.sendBtn.textContent = "发送";
    } else {
      els.composerInput.placeholder = "输入一段要直接播报的文字";
      els.sendBtn.textContent = "播报";
    }

    syncComposerMetrics();
  }

  function setModeSelection(mode) {
    els.modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.modeChoice === mode);
    });
  }

  function buildReadyStatusText(data) {
    if (!data.ready) {
      return data.loginHint || data.lastError || "当前还没完成登录";
    }
    if (data.lastError) {
      return `已连接，但最近一次异常为：${data.lastError}`;
    }
    return "设备已连接，控制台可以直接使用";
  }

  function renderBootstrap(data) {
    const wasReady = state.bootstrap ? Boolean(state.bootstrap.ready) : false;
    state.bootstrap = data;
    const device = data.device || {};
    const volume = data.volume || null;
    const serverVolume =
      volume && typeof volume.percent === "number"
        ? clamp(Number(volume.percent) || 0, 0, 100)
        : 0;
    const ready = Boolean(data.ready);
    const authenticated = Boolean(data.authenticated || ready);
    state.rawSpeakerAudioPlayback = data.audioPlayback || null;
    const speakerAudioPlayback = resolveSpeakerPlayback(
      state.rawSpeakerAudioPlayback,
      device
    );
    state.bootstrap.audioPlayback = speakerAudioPlayback;

    if (els.statDevice) {
      els.statDevice.textContent = device.name || (authenticated ? "待选择设备" : "未绑定设备");
    }
    if (els.statDeviceMeta) {
      const meta = [device.hardware, device.model].filter(Boolean).join(" / ");
      els.statDeviceMeta.textContent =
        meta || (authenticated ? "账号已登录，请先在下方选择要接管的音箱" : "等待读取设备规格");
    }
    if (els.deviceStatusText) {
      els.deviceStatusText.textContent = buildReadyStatusText(data);
    }
    if (els.deviceStateBadge) {
      els.deviceStateBadge.textContent = ready
        ? "已连接"
        : authenticated
          ? "待选设备"
          : "待登录";
      setBadgeTone(
        els.deviceStateBadge,
        ready ? "ready" : authenticated ? "warn" : "neutral"
      );
    }

    if (els.statAccount) {
      els.statAccount.textContent = maskAccountLabel(data.account);
    }
    if (els.statRegion) {
      const regionValue =
        authenticated || data.account ? data.serverCountry || "-" : "-";
      els.statRegion.textContent = `区域：${regionValue}`;
    }

    if (els.statMode) {
      els.statMode.textContent = data.modeLabel || data.mode || "-";
    }
    if (els.statModeDetail) {
      els.statModeDetail.textContent = ready
        ? data.lastConversationAt
          ? `最近对话：${formatDateTime(data.lastConversationAt)}`
          : "已连接，等待新的对话"
        : "设备未就绪时不会接管新对话";
    }

    state.hasVolumeSnapshot = Boolean(volume);
    const localVolumeDraft = hasPendingLocalVolumeDraft();
    if (volume) {
      state.confirmedVolumeValue = serverVolume;
      state.confirmedMuted = Boolean(volume.muted);
      state.confirmedDeviceMuted = readVolumeDeviceMuted(volume);
      state.confirmedUnmuteBlocked = readVolumeUnmuteBlocked(volume);
      state.confirmedMuteSupported = readVolumeMuteSupported(volume);
      if (!state.speakerControlInFlight && !state.speakerControlQueued) {
        if (!localVolumeDraft) {
          state.currentVolumeValue = serverVolume;
        }
        state.muted = Boolean(volume.muted);
        state.deviceMuted = state.confirmedDeviceMuted;
        state.unmuteBlocked = state.confirmedUnmuteBlocked;
        state.muteSupported = state.confirmedMuteSupported;
      }
      setSpeakerStatePending(Boolean(volume.pending));
    } else if (!state.speakerControlInFlight && !state.speakerControlQueued) {
      if (!localVolumeDraft) {
        state.currentVolumeValue = 0;
      }
      state.confirmedVolumeValue = 0;
      state.muted = false;
      state.confirmedMuted = false;
      state.deviceMuted = false;
      state.confirmedDeviceMuted = false;
      state.unmuteBlocked = false;
      state.confirmedUnmuteBlocked = false;
      state.muteSupported = true;
      state.confirmedMuteSupported = true;
      setSpeakerStatePending(false);
    }
    renderSpeakerControlState();

    if (els.statLogTitle) {
      els.statLogTitle.textContent =
        data.debugLogEnabled === false ? "调试日志（已关闭）" : "调试日志";
    }
    if (els.statLog) {
      els.statLog.textContent = data.debugLogPath || "未提供日志路径";
    }
    if (els.statHelper) {
      els.statHelper.textContent = `micoapi 辅助：${data.helperStatus || "未知"}`;
    }

    if (state.currentAudioSource !== "browser" || !state.currentBrowserAudioUrl) {
      if (speakerAudioPlayback) {
        renderSpeakerCurrentAudio(speakerAudioPlayback);
      } else {
        renderIdleCurrentAudio();
      }
    } else {
      syncBrowserCurrentAudioMeta();
    }

    if (els.accountActionBtn) {
      const action = authenticated ? "logout" : "login";
      els.accountActionBtn.dataset.action = action;
      els.accountActionBtn.textContent = authenticated ? "退出登录" : "登录账号";
      if (data.loginUrl) {
        els.accountActionBtn.dataset.loginUrl = data.loginUrl;
      } else {
        delete els.accountActionBtn.dataset.loginUrl;
      }
    }

    if (els.toggleDeviceListBtn) {
      els.toggleDeviceListBtn.disabled = !authenticated;
      els.toggleDeviceListBtn.textContent = buildDeviceListButtonLabel();
    }
    if (!authenticated && state.deviceListVisible) {
      setDeviceListVisible(false);
    }

    if (els.wakeWordInput) {
      const nextWakeWordPattern = data.wakeWordPattern || "小[虾瞎侠下夏霞]";
      if (document.activeElement !== els.wakeWordInput || !state.wakeWordDirty) {
        els.wakeWordInput.value = nextWakeWordPattern;
        state.wakeWordDirty = false;
      }
    }

    updateDialogWindowDisplay(
      getFiniteNumber(
        data.dialogWindowSeconds,
        state.currentDialogWindowValue || DEFAULT_DIALOG_WINDOW_SECONDS
      )
    );
    updateVoiceContextDisplay(
      getFiniteNumber(
        data.voiceContextMaxTurns,
        state.currentVoiceContextTurnsValue
      ),
      getFiniteNumber(
        data.voiceContextMaxChars,
        state.currentVoiceContextCharsValue
      )
    );
    updateVoiceSystemPromptDisplay(
      typeof data.openclawVoiceSystemPrompt === "string"
        ? data.openclawVoiceSystemPrompt
        : state.currentVoiceSystemPromptValue
    );
    updateTransitionPhrasesDisplay(
      Array.isArray(data.transitionPhrases)
        ? data.transitionPhrases
        : state.currentTransitionPhrasesValue
    );
    renderThinkingToggle(
      Boolean(
        data && Object.prototype.hasOwnProperty.call(data, "thinkingEnabled")
          ? data.thinkingEnabled
          : data.openclawThinkingOff === false
      )
    );
    renderForceNonStreamingToggle(
      Boolean(
        data &&
          Object.prototype.hasOwnProperty.call(data, "openclawForceNonStreaming")
          ? data.openclawForceNonStreaming
          : false
      )
    );
    renderDebugLogToggle(data.debugLogEnabled !== false);
    setModeSelection(data.mode || "wake");
    renderSpeakerControlState();
    setControlAvailability(ready);

    if (state.loginWorkspaceOpen && els.loginWorkspaceHint) {
      els.loginWorkspaceHint.textContent =
        normalizeLoginWorkspaceHint(data.loginHint);
    }

    if (!wasReady && ready && state.loginWorkspaceOpen) {
      closeLoginWorkspace();
      showToast(
        device.name ? `登录完成，已接入 ${device.name}。` : "登录完成。",
        "success"
      );
      void refreshAll(true);
    }

    if (state.pendingDeviceSelectionAfterLogin) {
      if (authenticated && !ready) {
        state.pendingDeviceSelectionAfterLogin = false;
        setActiveTab("overview", true);
        setDeviceListVisible(true);
        if (!state.deviceListLoaded) {
          void loadDeviceList();
        }
      } else if (ready || !authenticated) {
        state.pendingDeviceSelectionAfterLogin = false;
      }
    }

    if (state.deviceListVisible && state.deviceListLoaded) {
      renderDeviceList(state.deviceItems);
    }
  }

  function flattenConversationMessages(items) {
    const messages = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item && item.query) {
        messages.push({
          id: `${item.id || item.requestId || item.time}-user`,
          role: "user",
          text: item.query,
          time: item.time,
        });
      }
      const answers = Array.isArray(item && item.answers) ? item.answers : [];
      answers.forEach((answer, index) => {
        if (!answer) {
          return;
        }
        messages.push({
          id: `${item.id || item.requestId || item.time}-assistant-${index}`,
          role: "assistant",
          text: answer,
          time: item.time,
        });
      });
    });
    return messages;
  }

  function renderConversations(items, options) {
    const shouldStickBottom =
      Boolean(options && options.forceStickBottom) ||
      !state.hasConversationRender ||
      isNearBottom(els.conversationScroll);

    const messages = flattenConversationMessages(items);
    if (!messages.length) {
      els.conversationList.innerHTML =
        '<div class="empty-state empty-state-chat">还没有可展示的历史对话。</div>';
      state.hasConversationRender = true;
      return;
    }

    let previousDay = "";
    els.conversationList.innerHTML = messages
      .map((message) => {
        const day = dateKey(message.time);
        const dayDivider =
          day !== previousDay
            ? `<div class="chat-day-divider"><span>${escapeHtml(
                formatFullDate(message.time)
              )}</span></div>`
            : "";
        previousDay = day;
        return `${dayDivider}<article class="chat-message chat-message-${escapeHtml(
          message.role
        )}">
          <div class="chat-bubble chat-bubble-${escapeHtml(message.role)}">${escapeHtml(
            message.text
          )}</div>
          <div class="chat-time">${escapeHtml(formatTime(message.time))}</div>
        </article>`;
      })
      .join("");

    state.hasConversationRender = true;
    if (shouldStickBottom) {
      scheduleConversationBottomStick(true);
    }
  }

  function renderPendingConversation(text) {
    const pendingHtml = `<article class="chat-message chat-message-user" data-pending-turn="true">
      <div class="chat-bubble chat-bubble-user">${escapeHtml(text)}</div>
      <div class="chat-time">${escapeHtml(formatTime(new Date().toISOString()))}</div>
    </article>
    <article class="chat-message chat-message-assistant is-pending" data-pending-turn="true">
      <div class="chat-bubble chat-bubble-assistant">正在等待小爱的回复…</div>
      <div class="chat-time">${escapeHtml(formatTime(new Date().toISOString()))}</div>
    </article>`;
    const empty = els.conversationList.querySelector(".empty-state");
    if (empty) {
      els.conversationList.innerHTML = "";
    }
    els.conversationList.insertAdjacentHTML("beforeend", pendingHtml);
    state.hasConversationRender = true;
    scheduleConversationBottomStick(true);
  }

  function renderEvents(items, options) {
    const signature =
      options && typeof options.signature === "string"
        ? options.signature
        : buildEventRenderSignature(items);
    if (!Array.isArray(items) || items.length === 0) {
      els.eventList.innerHTML =
        '<div class="empty-state">事件流还是空的，后续的识别、模式切换和异常都会出现在这里。</div>';
      state.animateEventsNextRender = false;
      state.eventRenderSignature = signature;
      els.eventList.dataset.renderState = "ready";
      return;
    }

    const shouldAnimate = state.animateEventsNextRender;
    if (shouldAnimate) {
      els.eventList.dataset.renderState = "preparing";
    }
    els.eventList.innerHTML = items
      .map((item, index) => {
        const level = item.level || "info";
        const animationClass = shouldAnimate ? " event-card-enter-prep" : "";
        const animationStyle = shouldAnimate
          ? ` style="--event-index:${Math.min(index, 9)}"`
          : "";
        const audioUrl = normalizeAudioEventUrl(item && item.audioUrl);
        return `<article class="event-card${animationClass}" data-level="${escapeHtml(
          level
        )}"${animationStyle}>
          <div class="event-top">
            <span class="event-kind ${escapeHtml(level)}">${escapeHtml(
              item.kind || "event"
            )}</span>
            <span class="event-time">${escapeHtml(formatDateTime(item.time))}</span>
          </div>
          <div class="event-title">${escapeHtml(
            item.title || "未命名事件"
          )}</div>
          ${
            item.detail
              ? `<div class="event-detail">${escapeHtml(item.detail)}</div>`
              : ""
          }
          ${
            audioUrl
              ? `<div class="event-audio">
                  <div class="audio-player-shell audio-player-shell-event" data-audio-player-root="event">
                    <audio class="audio-player-media" preload="none" src="${escapeHtml(audioUrl)}"></audio>
                    <div class="audio-player-row audio-player-row-compact">
                      <button class="soft-btn compact-btn audio-player-toggle" data-audio-toggle type="button">播放</button>
                      <div class="audio-player-progress" data-audio-progress aria-hidden="true">
                        <span class="audio-player-progress-fill" data-audio-progress-fill></span>
                      </div>
                      <div class="audio-player-time" data-audio-time>00:00 / --:--</div>
                    </div>
                  </div>
                </div>`
              : ""
          }
        </article>`;
      })
      .join("");
    hydrateAudioPlayers(els.eventList);
    state.eventRenderSignature = signature;
    state.animateEventsNextRender = false;
    if (!shouldAnimate) {
      els.eventList.dataset.renderState = "ready";
      return;
    }

    window.requestAnimationFrame(() => {
      const cards = Array.from(
        els.eventList.querySelectorAll(".event-card-enter-prep")
      );
      cards.forEach((card) => {
        card.classList.remove("event-card-enter-prep");
        card.classList.add("event-card-enter");
      });
      els.eventList.dataset.renderState = "ready";
    });
  }

  function renderDeviceList(items) {
    if (!els.deviceList) {
      return;
    }
    if (!Array.isArray(items) || !items.length) {
      els.deviceList.innerHTML =
        '<div class="empty-state device-empty-state">当前账号下没有可切换的小爱设备。</div>';
      return;
    }

    els.deviceList.innerHTML = items
      .map((item) => {
        const meta = [item.hardware, item.model, item.miDid].filter(Boolean).join(" / ");
        return `<button class="device-item${
          item.selected ? " is-selected" : ""
        }" type="button" data-device-select="${escapeHtml(item.minaDeviceId || "")}">
          <div class="device-item-head">
            <span class="device-item-name">${escapeHtml(
              item.speakerName || item.hardware || item.minaDeviceId || "未命名设备"
            )}</span>
            ${
              item.selected
                ? '<span class="device-item-badge">当前设备</span>'
                : ""
            }
          </div>
          <div class="device-item-meta">${escapeHtml(meta || "缺少设备描述信息")}</div>
        </button>`;
      })
      .join("");
  }

  function buildDeviceListButtonLabel() {
    const bootstrap = state.bootstrap || {};
    const authenticated = Boolean(bootstrap.authenticated || bootstrap.ready);
    const ready = Boolean(bootstrap.ready);
    if (state.deviceListVisible) {
      return "收起列表";
    }
    if (!authenticated) {
      return "登录后选择";
    }
    return ready ? "切换设备" : "选择设备";
  }

  function setDeviceListVisible(visible) {
    state.deviceListVisible = Boolean(visible);
    if (els.deviceListShell) {
      els.deviceListShell.hidden = !state.deviceListVisible;
    }
    if (els.toggleDeviceListBtn) {
      els.toggleDeviceListBtn.textContent = buildDeviceListButtonLabel();
    }
  }

  async function refreshBootstrap(silent) {
    try {
      const payload = await apiFetch(API.bootstrap);
      renderBootstrap(payload);
      return true;
    } catch (error) {
      if (!silent) {
        showToast(error.message || String(error), "error");
      }
      return false;
    }
  }

  async function refreshConversations(silent) {
    try {
      const payload = await apiFetch(new URL("?limit=40", API.conversations));
      renderConversations(payload.items || []);
      return true;
    } catch (error) {
      if (!silent) {
        showToast(error.message || String(error), "error");
      }
      return false;
    }
  }

  async function refreshEvents(silent) {
    try {
      const payload = await apiFetch(new URL("?limit=120", API.events));
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      const nextSignature = buildEventRenderSignature(nextItems);
      state.eventItems = nextItems;
      state.eventItemsLoaded = true;
      maybeHandleLatestEventAudio(state.eventItems);
      if (state.activeTab === "events") {
        if (!isEventAudioPreviewPlaying() && nextSignature !== state.eventRenderSignature) {
          renderEvents(state.eventItems, { signature: nextSignature });
        }
      }
      return true;
    } catch (error) {
      if (els.eventList) {
        els.eventList.dataset.renderState = "ready";
      }
      if (!silent) {
        showToast(error.message || String(error), "error");
      }
      return false;
    }
  }

  async function refreshAll(silent) {
    await Promise.all([
      refreshBootstrap(silent),
      refreshConversations(silent),
      refreshEvents(silent),
    ]);
  }

  async function loadDeviceList() {
    if (state.deviceListLoading || !els.deviceList) {
      return;
    }
    state.deviceListLoading = true;
    els.deviceList.innerHTML =
      '<div class="empty-state device-empty-state">正在读取设备列表…</div>';
    try {
      const payload = await apiFetch(API.deviceList);
      state.deviceItems = Array.isArray(payload.items) ? payload.items : [];
      state.deviceListLoaded = true;
      renderDeviceList(state.deviceItems);
    } catch (error) {
      els.deviceList.innerHTML = `<div class="empty-state device-empty-state">${escapeHtml(
        error.message || String(error)
      )}</div>`;
      showToast(error.message || String(error), "error");
    } finally {
      state.deviceListLoading = false;
    }
  }

  async function toggleDeviceList() {
    const bootstrap = state.bootstrap || {};
    if (!bootstrap.ready && !bootstrap.authenticated) {
      showToast("请先登录账号，再选择设备。", "error");
      return;
    }
    setDeviceListVisible(!state.deviceListVisible);
    if (state.deviceListVisible && !state.deviceListLoaded) {
      await loadDeviceList();
    }
  }

  async function selectDevice(minaDeviceId) {
    if (!minaDeviceId) {
      return;
    }
    try {
      const payload = await postJson(API.deviceSelect, { minaDeviceId });
      showToast(payload.message || "设备已切换。", "success");
      state.deviceListLoaded = false;
      setDeviceListVisible(false);
      await refreshAll(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    }
  }

  async function handleAccountAction() {
    const action = els.accountActionBtn
      ? els.accountActionBtn.dataset.action || "logout"
      : "logout";

    if (action === "login") {
      const loginUrl =
        (els.accountActionBtn && els.accountActionBtn.dataset.loginUrl) ||
        (state.bootstrap && state.bootstrap.loginUrl);
      if (
        loginUrl &&
        openLoginWorkspace(
          loginUrl,
          (state.bootstrap && state.bootstrap.loginHint) || ""
        )
      ) {
        return;
      }
      await refreshBootstrap(false);
      const nextLoginUrl =
        (els.accountActionBtn && els.accountActionBtn.dataset.loginUrl) ||
        (state.bootstrap && state.bootstrap.loginUrl);
      if (
        nextLoginUrl &&
        openLoginWorkspace(
          nextLoginUrl,
          (state.bootstrap && state.bootstrap.loginHint) || ""
        )
      ) {
        return;
      }
      showToast("当前还没拿到可用的登录入口，请稍后再试。", "error");
      return;
    }

    if (els.accountActionBtn) {
      els.accountActionBtn.disabled = true;
    }
    try {
      const payload = await postJson(API.accountLogout, {});
      showToast(payload.message || "已退出登录。", "success");
      state.deviceItems = [];
      state.deviceListLoaded = false;
      setDeviceListVisible(false);
      await refreshAll(true);
      if (payload && payload.loginUrl && els.accountActionBtn) {
        els.accountActionBtn.dataset.loginUrl = payload.loginUrl;
      }
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      if (els.accountActionBtn) {
        els.accountActionBtn.disabled = false;
      }
    }
  }

  async function sendCompose() {
    setActiveTab("chat", true);
    showComposer();

    const mode = state.composeMode;
    const text = els.composerInput ? els.composerInput.value.trim() : "";

    if (!text) {
      showToast("先输入一点内容再发送。", "error");
      return;
    }

    const originalLabel = els.sendBtn ? els.sendBtn.textContent : "发送";
    if (els.sendBtn) {
      els.sendBtn.disabled = true;
      els.sendBtn.textContent = mode === "chat" ? "发送中" : "播报中";
    }

    if (mode === "chat") {
      renderPendingConversation(text);
    }

    try {
      if (mode === "chat") {
        const payload = await postJson(API.chatSend, { text });
        showToast(payload.message || "消息已发给小爱。", "success");
      } else {
        const payload = await postJson(API.speak, { text });
        showToast(payload.message || "播报完成。", "success");
      }
      if (els.composerInput) {
        els.composerInput.value = "";
      }
      autoResizeComposer();
      await refreshAll(true);
    } catch (error) {
      if (mode === "chat") {
        await refreshConversations(true);
      }
      showToast(error.message || String(error), "error");
    } finally {
      if (els.sendBtn) {
        els.sendBtn.disabled = false;
        els.sendBtn.textContent = originalLabel;
      }
    }
  }

  async function sendAudioPlay() {
    const audioUrl = els.audioUrlInput ? els.audioUrlInput.value.trim() : "";

    if (!audioUrl) {
      showToast("先输入一个音频 URL。", "error");
      return;
    }

    const originalAudioLabel = els.audioSendBtn
      ? els.audioSendBtn.textContent
      : "播放";
    if (els.audioSendBtn) {
      els.audioSendBtn.disabled = true;
      els.audioSendBtn.textContent = "播放中";
    }

    try {
      const payload = await postJson(API.audioPlay, {
        url: audioUrl,
        interrupt: true,
        forceRetry: true,
      });
      clearSpeakerPauseMemory();
      if (payload && (payload.ok === false || payload.playback === "browser-fallback")) {
        throw new Error(payload.message || "音箱没有真正开始播放这段音频。");
      }
      const nextPlayback = {
        title:
          (payload && payload.title) ||
          normalizeAudioReplyTitle(payload && payload.detail) ||
          "最近一次音频",
        status: "playing",
        audioUrl: (payload && payload.url) || normalizeAudioEventUrl(audioUrl),
        positionSeconds: 0,
        durationSeconds: 0,
      };
      if (state.bootstrap) {
        state.bootstrap.audioPlayback = nextPlayback;
      }
      renderSpeakerCurrentAudio(nextPlayback);
      showToast(
        payload.message || "音频已准备好。",
        payload && payload.ok === false ? "error" : "success"
      );
      if (els.audioUrlInput) {
        els.audioUrlInput.value = "";
      }
      await refreshAll(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      if (els.audioSendBtn) {
        els.audioSendBtn.disabled = false;
        els.audioSendBtn.textContent = originalAudioLabel;
      }
    }
  }

  async function applyMode(mode) {
    els.modeButtons.forEach((button) => {
      button.disabled = true;
    });
    try {
      const payload = await postJson(API.mode, { mode });
      showToast(payload.message || "模式已更新。", "success");
      await refreshBootstrap(true);
      await refreshEvents(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      const ready = state.bootstrap ? Boolean(state.bootstrap.ready) : false;
      els.modeButtons.forEach((button) => {
        button.disabled = !ready;
      });
    }
  }

  async function applyWakeWordPattern() {
    const raw = els.wakeWordInput ? els.wakeWordInput.value.trim() : "";
    if (!raw) {
      showToast("请输入唤醒词或正则源码。", "error");
      return;
    }

    if (els.wakeWordSaveBtn) {
      els.wakeWordSaveBtn.disabled = true;
      els.wakeWordSaveBtn.textContent = "保存中";
    }

    try {
      const payload = await postJson(API.wakeWord, { pattern: raw });
      state.wakeWordDirty = false;
      showToast(payload.message || "唤醒词已更新。", "success");
      await refreshBootstrap(true);
      await refreshEvents(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      if (els.wakeWordSaveBtn) {
        els.wakeWordSaveBtn.disabled = false;
        els.wakeWordSaveBtn.textContent = "保存唤醒词";
      }
    }
  }

  function applySpeakerControlPayload(payload, fallbackCommand) {
    const volume =
      payload &&
      payload.volume &&
      typeof payload.volume.percent === "number"
        ? payload.volume
        : null;
    if (!volume) {
      if (fallbackCommand && fallbackCommand.kind === "volume") {
        state.currentVolumeValue = fallbackCommand.value;
        state.confirmedVolumeValue = fallbackCommand.value;
      }
      if (fallbackCommand && fallbackCommand.kind === "mute") {
        state.muted = Boolean(fallbackCommand.value);
        state.confirmedMuted = Boolean(fallbackCommand.value);
      }
      setSpeakerStatePending(false);
      renderSpeakerControlState();
      return;
    }

    state.hasVolumeSnapshot = true;
    if (state.bootstrap) {
      state.bootstrap.volume = {
        ...(state.bootstrap.volume || {}),
        ...volume,
      };
    }
    state.currentVolumeValue = clamp(Number(volume.percent) || 0, 0, 100);
    state.confirmedVolumeValue = state.currentVolumeValue;
    state.muted = Boolean(volume.muted);
    state.confirmedMuted = state.muted;
    state.deviceMuted = readVolumeDeviceMuted(volume);
    state.confirmedDeviceMuted = state.deviceMuted;
    state.unmuteBlocked = readVolumeUnmuteBlocked(volume);
    state.confirmedUnmuteBlocked = state.unmuteBlocked;
    state.muteSupported = readVolumeMuteSupported(volume);
    state.confirmedMuteSupported = state.muteSupported;
    setSpeakerStatePending(Boolean(volume.pending));
    renderSpeakerControlState();
  }

  function scheduleSpeakerControlVerification(attempt) {
    clearSpeakerStatePendingTimer();
    if (!state.speakerStatePending || state.speakerControlInFlight || state.speakerControlQueued) {
      return;
    }
    const delays = [700, 1500, 2600];
    const index = clamp(Number(attempt) || 0, 0, delays.length - 1);
    state.speakerStatePendingTimer = window.setTimeout(async () => {
      state.speakerStatePendingTimer = null;
      const ok = await refreshBootstrap(true);
      if (
        ok &&
        state.bootstrap &&
        state.bootstrap.volume &&
        state.bootstrap.volume.pending &&
        index < delays.length - 1
      ) {
        scheduleSpeakerControlVerification(index + 1);
      }
    }, delays[index]);
  }

  async function flushSpeakerControlQueue() {
    if (state.speakerControlInFlight || !state.speakerControlQueued) {
      return;
    }

    const command = state.speakerControlQueued;
    state.speakerControlQueued = null;
    state.speakerControlInFlight = command;
    setSpeakerStatePending(true);
    renderSpeakerControlState();

    try {
      const payload =
        command.kind === "mute"
          ? await postJson(API.mute, { muted: Boolean(command.value) })
          : await postJson(API.volume, { volume: command.value });
      applySpeakerControlPayload(payload, command);
      if (!command.silentToast) {
        showToast(
          payload && payload.message
            ? payload.message
            : command.kind === "mute"
              ? Boolean(command.value)
                ? "已打开播放静音。"
                : "已关闭播放静音。"
              : `播放音量已设为 ${command.value}%。`,
          "success"
        );
      }
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      const errorPayload =
        error && typeof error === "object" && error.payload ? error.payload : null;
      if (errorPayload && errorPayload.volume) {
        applySpeakerControlPayload(errorPayload, command);
      } else {
        state.currentVolumeValue = state.confirmedVolumeValue;
        state.muted = state.confirmedMuted;
        state.deviceMuted = state.confirmedDeviceMuted;
        state.unmuteBlocked = state.confirmedUnmuteBlocked;
        state.muteSupported = state.confirmedMuteSupported;
        setSpeakerStatePending(false);
        renderSpeakerControlState();
      }
      showToast(error.message || String(error), "error");
    } finally {
      state.speakerControlInFlight = null;
      if (state.speakerControlQueued) {
        renderSpeakerControlState();
        void flushSpeakerControlQueue();
      } else {
        renderSpeakerControlState();
        scheduleSpeakerControlVerification(0);
      }
    }
  }

  function enqueueSpeakerControlCommand(command, options) {
    const normalized = normalizeSpeakerControlCommand(command);
    if (!normalized || !state.hasVolumeSnapshot) {
      renderSpeakerControlState();
      return;
    }

    const nextCommand = {
      ...normalized,
      silentToast: Boolean(options && options.silentToast),
    };
    const currentPending = state.speakerControlQueued || state.speakerControlInFlight;
    const idleAndMatched =
      !currentPending &&
      !state.speakerStatePending &&
      (
        (nextCommand.kind === "volume" &&
          nextCommand.value === state.confirmedVolumeValue) ||
        (nextCommand.kind === "mute" &&
          nextCommand.value === state.confirmedMuted)
      );
    if (idleAndMatched) {
      renderSpeakerControlState();
      return;
    }

    state.speakerControlQueued = sameSpeakerControlCommand(
      state.speakerControlQueued,
      nextCommand
    )
      ? state.speakerControlQueued
      : nextCommand;
    setSpeakerStatePending(true);
    renderSpeakerControlState();
    void flushSpeakerControlQueue();
  }

  function scheduleVolumeCommit(immediate, silentToast) {
    window.clearTimeout(state.volumeInputTimer);
    if (immediate) {
      enqueueSpeakerControlCommand(
        { kind: "volume", value: state.currentVolumeValue },
        { silentToast: Boolean(silentToast) }
      );
      return;
    }
    state.volumeInputTimer = window.setTimeout(() => {
      state.volumeInputTimer = null;
      enqueueSpeakerControlCommand(
        { kind: "volume", value: state.currentVolumeValue },
        { silentToast: Boolean(silentToast) }
      );
    }, 180);
  }

  async function applyDialogWindowSeconds() {
    if (state.dialogWindowSaving) {
      return;
    }
    const raw = els.dialogWindowInput ? els.dialogWindowInput.value.trim() : "";
    if (!raw) {
      updateDialogWindowDisplay(state.currentDialogWindowValue, {
        forceInput: true,
      });
      state.dialogWindowDirty = false;
      showToast("请输入 5 到 300 秒之间的时长。", "error");
      return;
    }
    const seconds = clamp(
      Number(raw) || 0,
      MIN_DIALOG_WINDOW_SECONDS,
      MAX_DIALOG_WINDOW_SECONDS
    );
    if (seconds === state.currentDialogWindowValue && !state.dialogWindowDirty) {
      updateDialogWindowDisplay(seconds, { forceInput: true });
      return;
    }
    state.dialogWindowSaving = true;
    try {
      const payload = await postJson(API.dialogWindow, { seconds });
      state.dialogWindowDirty = false;
      updateDialogWindowDisplay(seconds, { forceInput: true });
      showToast(payload.message || `唤醒窗口已自动保存为 ${seconds} 秒。`, "success");
      await refreshBootstrap(true);
      await refreshEvents(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      state.dialogWindowSaving = false;
    }
  }

  async function applyVoiceContextSettings() {
    if (state.voiceContextSaving) {
      return;
    }
    const turnsRaw = els.voiceContextTurnsInput
      ? normalizeIntegerText(els.voiceContextTurnsInput.value, MAX_VOICE_CONTEXT_TURNS)
      : "";
    const charsRaw = els.voiceContextCharsInput
      ? normalizeIntegerText(els.voiceContextCharsInput.value, MAX_VOICE_CONTEXT_CHARS)
      : "";

    if (els.voiceContextTurnsInput) {
      els.voiceContextTurnsInput.value = turnsRaw;
    }
    if (els.voiceContextCharsInput) {
      els.voiceContextCharsInput.value = charsRaw;
    }

    if (!turnsRaw && !charsRaw) {
      state.voiceContextDirty = false;
      updateVoiceContextDisplay(
        state.currentVoiceContextTurnsValue,
        state.currentVoiceContextCharsValue,
        { forceInput: true }
      );
      return;
    }

    const turns =
      turnsRaw === ""
        ? state.currentVoiceContextTurnsValue
        : clamp(Number(turnsRaw) || 0, 0, MAX_VOICE_CONTEXT_TURNS);
    const chars =
      charsRaw === ""
        ? state.currentVoiceContextCharsValue
        : clamp(Number(charsRaw) || 0, 0, MAX_VOICE_CONTEXT_CHARS);

    if (
      turns === state.currentVoiceContextTurnsValue &&
      chars === state.currentVoiceContextCharsValue &&
      !state.voiceContextDirty
    ) {
      updateVoiceContextDisplay(turns, chars, { forceInput: true });
      return;
    }

    state.voiceContextSaving = true;
    try {
      const payload = await postJson(API.voiceContext, { turns, chars });
      state.voiceContextDirty = false;
      const nextTurns = getFiniteNumber(payload && payload.turns, turns);
      const nextChars = getFiniteNumber(payload && payload.chars, chars);
      updateVoiceContextDisplay(nextTurns, nextChars, { forceInput: true });
      showToast(
        payload && payload.message
          ? payload.message
          : `上下文记忆已保存：保留最近 ${nextTurns} 轮，最多 ${nextChars} 字，超出的更早对话会自动压缩。`,
        "success"
      );
      await refreshBootstrap(true);
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      state.voiceContextSaving = false;
    }
  }

  async function applyVoiceSystemPrompt() {
    if (state.voiceSystemPromptSaving) {
      return;
    }
    const raw = els.voiceSystemPromptInput
      ? normalizeVoiceSystemPromptInput(els.voiceSystemPromptInput.value)
      : "";
    const trimmed = raw.trim();
    if (
      !state.voiceSystemPromptDirty &&
      trimmed === state.currentVoiceSystemPromptValue.trim()
    ) {
      updateVoiceSystemPromptDisplay(state.currentVoiceSystemPromptValue, {
        forceInput: true,
      });
      return;
    }

    state.voiceSystemPromptSaving = true;
    if (els.voiceSystemPromptSaveBtn) {
      els.voiceSystemPromptSaveBtn.disabled = true;
      els.voiceSystemPromptSaveBtn.textContent = "保存中";
    }
    try {
      const payload = await postJson(API.voiceSystemPrompt, { prompt: raw });
      state.voiceSystemPromptDirty = false;
      updateVoiceSystemPromptDisplay(
        payload && typeof payload.prompt === "string"
          ? payload.prompt
          : trimmed,
        { forceInput: true }
      );
      showToast(
        payload && payload.message
          ? payload.message
          : trimmed
            ? "xiaoai agent workspace 的 AGENTS.md 已保存。"
            : "xiaoai agent workspace 的 AGENTS.md 已恢复默认内容。",
        "success"
      );
      await refreshBootstrap(true);
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      state.voiceSystemPromptSaving = false;
      if (els.voiceSystemPromptSaveBtn) {
        els.voiceSystemPromptSaveBtn.disabled = false;
        els.voiceSystemPromptSaveBtn.textContent = "保存";
      }
    }
  }

  async function applyTransitionPhrases() {
    if (state.transitionPhrasesSaving) {
      return;
    }
    const nextPhrases = els.transitionPhrasesInput
      ? normalizeTransitionPhrasesList(els.transitionPhrasesInput.value)
      : [];
    const previousPhrases = normalizeTransitionPhrasesList(
      state.currentTransitionPhrasesValue
    );
    if (
      !state.transitionPhrasesDirty &&
      JSON.stringify(nextPhrases) === JSON.stringify(previousPhrases)
    ) {
      updateTransitionPhrasesDisplay(state.currentTransitionPhrasesValue, {
        forceInput: true,
      });
      return;
    }

    state.transitionPhrasesSaving = true;
    if (els.transitionPhrasesSaveBtn) {
      els.transitionPhrasesSaveBtn.disabled = true;
      els.transitionPhrasesSaveBtn.textContent = "保存中";
    }
    try {
      const payload = await postJson(API.transitionPhrases, {
        phrases: nextPhrases,
      });
      state.transitionPhrasesDirty = false;
      updateTransitionPhrasesDisplay(
        Array.isArray(payload && payload.phrases) ? payload.phrases : nextPhrases,
        { forceInput: true }
      );
      showToast(
        payload && payload.message
          ? payload.message
          : nextPhrases.length
            ? "过渡播报词已保存。"
            : "已恢复默认过渡播报词。",
        "success"
      );
      await refreshBootstrap(true);
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      state.transitionPhrasesSaving = false;
      if (els.transitionPhrasesSaveBtn) {
        els.transitionPhrasesSaveBtn.disabled = false;
        els.transitionPhrasesSaveBtn.textContent = "保存";
      }
    }
  }

  function commitVoiceContextSettingsFromBlur() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (
        active === els.voiceContextTurnsInput ||
        active === els.voiceContextCharsInput
      ) {
        return;
      }
      if (state.voiceContextDirty) {
        void applyVoiceContextSettings();
        return;
      }
      if (
        els.voiceContextTurnsInput &&
        els.voiceContextCharsInput &&
        (!els.voiceContextTurnsInput.value.trim() ||
          !els.voiceContextCharsInput.value.trim())
      ) {
        updateVoiceContextDisplay(
          state.currentVoiceContextTurnsValue,
          state.currentVoiceContextCharsValue,
          { forceInput: true }
        );
      }
    }, 0);
  }

  async function waitForGatewayRestartRecovery() {
    const delays = [900, 1800, 3200, 5200];
    for (const delay of delays) {
      await sleep(delay);
      const ready = await refreshBootstrap(true);
      if (ready) {
        if (state.activeTab === "control") {
          await refreshOpenclawModelState(true, { preserveOnError: true });
        }
        if (state.activeTab === "chat") {
          await refreshConversations(true);
        }
        if (state.activeTab === "events") {
          await refreshEvents(true);
        }
        return true;
      }
    }
    return false;
  }

  async function applyOpenclawModel(modelRef) {
    const nextModel = String(modelRef || "").trim();
    if (!nextModel) {
      showToast("请选择一个模型。", "error");
      renderOpenclawModelControl(
        state.openclawAgentId,
        state.openclawModel,
        state.openclawModels
      );
      return;
    }
    if (state.openclawModelSaving) {
      return;
    }
    const previousModel = state.openclawModel;
    state.openclawModelSaving = true;
    renderOpenclawModelControl(
      state.openclawAgentId,
      nextModel,
      state.openclawModels
    );
    try {
      const payload = await postJson(API.openclawModel, {
        model: nextModel,
      });
      const confirmedModel =
        payload && typeof payload.model === "string" && payload.model.trim()
          ? payload.model.trim()
          : nextModel;
      renderOpenclawModelControl(
        payload && payload.agentId ? payload.agentId : state.openclawAgentId,
        confirmedModel,
        state.openclawModels
      );
      showToast(
        payload && payload.message
          ? payload.message
          : `模型已切换为 ${confirmedModel}。`,
        "success"
      );
      if (!payload || payload.restarting !== false) {
        void waitForGatewayRestartRecovery();
      } else {
        await refreshBootstrap(true);
        await refreshOpenclawModelState(true, { preserveOnError: true });
      }
    } catch (error) {
      renderOpenclawModelControl(
        state.openclawAgentId,
        previousModel,
        state.openclawModels
      );
      showToast(error.message || String(error), "error");
    } finally {
      state.openclawModelSaving = false;
      renderOpenclawModelControl(
        state.openclawAgentId,
        state.openclawModel,
        state.openclawModels
      );
    }
  }

  async function applyThinkingEnabled(enabled) {
    if (state.thinkingSaving) {
      return;
    }
    state.thinkingSaving = true;
    if (els.thinkingOffToggle) {
      els.thinkingOffToggle.disabled = true;
    }
    try {
      const payload = await postJson(API.thinking, {
        thinkingEnabled: Boolean(enabled),
      });
      renderThinkingToggle(
        Boolean(
          payload && Object.prototype.hasOwnProperty.call(payload, "thinkingEnabled")
            ? payload.thinkingEnabled
            : enabled
        )
      );
      showToast(
        payload && payload.message
          ? payload.message
          : enabled
            ? "已打开思考。"
            : "已关闭思考。",
        "success"
      );
      await refreshBootstrap(true);
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      renderThinkingToggle(state.thinkingEnabled);
      showToast(error.message || String(error), "error");
    } finally {
      state.thinkingSaving = false;
      if (els.thinkingOffToggle) {
        els.thinkingOffToggle.disabled = false;
      }
    }
  }

  async function applyForceNonStreamingEnabled(enabled) {
    if (state.forceNonStreamingSaving) {
      return;
    }
    state.forceNonStreamingSaving = true;
    if (els.forceNonStreamingToggle) {
      els.forceNonStreamingToggle.disabled = true;
    }
    try {
      const payload = await postJson(API.nonStreaming, {
        forceNonStreamingEnabled: Boolean(enabled),
      });
      renderForceNonStreamingToggle(
        Boolean(
          payload && Object.prototype.hasOwnProperty.call(payload, "enabled")
            ? payload.enabled
            : enabled
        )
      );
      showToast(
        payload && payload.message
          ? payload.message
          : enabled
            ? "已开启强制非流式请求。"
            : "已关闭强制非流式请求。",
        "success"
      );
      await refreshBootstrap(true);
      if (payload && payload.restarting) {
        window.setTimeout(() => {
          void refreshBootstrap(true);
        }, 2600);
      }
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      renderForceNonStreamingToggle(state.forceNonStreamingEnabled);
      showToast(error.message || String(error), "error");
    } finally {
      state.forceNonStreamingSaving = false;
      if (els.forceNonStreamingToggle) {
        els.forceNonStreamingToggle.disabled = false;
      }
    }
  }

  async function applyDebugLogEnabled(enabled) {
    if (state.debugLogSaving) {
      return;
    }
    state.debugLogSaving = true;
    if (els.debugLogToggle) {
      els.debugLogToggle.disabled = true;
    }
    try {
      const payload = await postJson(API.debugLog, {
        debugLogEnabled: Boolean(enabled),
      });
      renderDebugLogToggle(
        Boolean(
          payload && Object.prototype.hasOwnProperty.call(payload, "enabled")
            ? payload.enabled
            : enabled
        )
      );
      showToast(
        payload && payload.message
          ? payload.message
          : enabled
            ? "已打开调试日志。"
            : "已关闭调试日志。",
        "success"
      );
      await refreshBootstrap(true);
      if (state.activeTab === "events") {
        await refreshEvents(true);
      }
    } catch (error) {
      renderDebugLogToggle(state.debugLogEnabled);
      showToast(error.message || String(error), "error");
    } finally {
      state.debugLogSaving = false;
      if (els.debugLogToggle) {
        els.debugLogToggle.disabled = false;
      }
    }
  }

  async function applyMuted(enabled) {
    enqueueSpeakerControlCommand(
      { kind: "mute", value: Boolean(enabled) },
      { silentToast: false }
    );
  }

  async function wakeUp() {
    if (els.wakeBtn) {
      els.wakeBtn.disabled = true;
    }
    try {
      const payload = await postJson(API.wake, {});
      showToast(payload.message || "唤醒指令已发送。", "success");
      await refreshBootstrap(true);
      await refreshEvents(true);
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      if (els.wakeBtn) {
        els.wakeBtn.disabled = false;
      }
    }
  }

  function installRefreshTimer() {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(() => {
      refreshBootstrap(true);
      if (state.activeTab === "chat") {
        refreshConversations(true);
      }
      if (state.activeTab === "chat" || state.activeTab === "events") {
        refreshEvents(true);
      }
    }, 3000);
  }

  function bindChatScroll() {
    if (!els.conversationScroll) {
      return;
    }
    els.conversationScroll.addEventListener("scroll", () => {
      const current = els.conversationScroll.scrollTop;
      const delta = current - state.lastChatScrollTop;
      state.lastChatScrollTop = current;
      if (isNearBottom(els.conversationScroll) || delta > 8) {
        showComposer();
      } else if (delta < -8 && current > 18) {
        hideComposer();
      }
    });
  }

  els.composeButtons.forEach((button) => {
    button.addEventListener("click", () =>
      setComposeMode(button.dataset.composeMode)
    );
  });

  els.tabButtons.forEach((button) => {
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.consoleTab, true);
    });
  });

  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.modeChoice;
      if (!mode) {
        return;
      }
      applyMode(mode);
    });
  });

  if (els.toggleDeviceListBtn) {
    els.toggleDeviceListBtn.addEventListener("click", () => {
      void toggleDeviceList();
    });
  }

  if (els.deviceList) {
    els.deviceList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-device-select]");
      if (!button) {
        return;
      }
      void selectDevice(button.dataset.deviceSelect || "");
    });
  }

  if (els.accountActionBtn) {
    els.accountActionBtn.addEventListener("click", () => {
      void handleAccountAction();
    });
  }

  if (els.currentAudioPauseBtn) {
    els.currentAudioPauseBtn.addEventListener("click", () => {
      void pauseCurrentAudio();
    });
  }

  if (els.currentAudioStartBtn) {
    els.currentAudioStartBtn.addEventListener("click", () => {
      void startCurrentAudio();
    });
  }

  if (els.currentAudioStopBtn) {
    els.currentAudioStopBtn.addEventListener("click", () => {
      void stopCurrentAudio();
    });
  }

  if (els.loginWorkspaceCloseBtn) {
    els.loginWorkspaceCloseBtn.addEventListener("click", () => {
      closeLoginWorkspace();
    });
  }

  if (els.loginWorkspaceBackdrop) {
    els.loginWorkspaceBackdrop.addEventListener("click", () => {
      closeLoginWorkspace();
    });
  }

  if (els.loginWorkspaceFrame) {
    els.loginWorkspaceFrame.addEventListener("load", () => {
      window.setTimeout(() => syncLoginWorkspaceFrameHeight(), 40);
      window.setTimeout(() => syncLoginWorkspaceFrameHeight(), 180);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const payload = event.data || {};
    if (payload.source !== "xiaoai-cloud-portal") {
      return;
    }
    const detail = payload.payload || {};
    if (payload.type === "layout") {
      syncLoginWorkspaceFrameHeight(detail.height);
      return;
    }
    if (els.loginWorkspaceHint && typeof detail.message === "string" && detail.message) {
      els.loginWorkspaceHint.textContent = normalizeLoginWorkspaceHint(
        detail.message
      );
    } else if (
      els.loginWorkspaceHint &&
      typeof detail.text === "string" &&
      detail.text
    ) {
      els.loginWorkspaceHint.textContent = normalizeLoginWorkspaceHint(
        detail.text
      );
    }
    if (payload.type === "session" && detail.status === "success") {
      state.pendingDeviceSelectionAfterLogin = true;
      closeLoginWorkspace();
      showToast(detail.message || "登录完成。", "success");
      setActiveTab("overview", true);
      void refreshAll(true);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.loginWorkspaceOpen) {
      closeLoginWorkspace();
    }
  });

  if (els.wakeWordInput) {
    els.wakeWordInput.addEventListener("input", () => {
      state.wakeWordDirty = true;
    });
    els.wakeWordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void applyWakeWordPattern();
      }
    });
  }

  if (els.wakeWordSaveBtn) {
    els.wakeWordSaveBtn.addEventListener("click", () => {
      void applyWakeWordPattern();
    });
  }

  if (els.voiceSystemPromptInput) {
    els.voiceSystemPromptInput.addEventListener("input", () => {
      state.voiceSystemPromptDirty = true;
      const normalized = normalizeVoiceSystemPromptInput(
        els.voiceSystemPromptInput.value
      );
      if (normalized !== els.voiceSystemPromptInput.value) {
        els.voiceSystemPromptInput.value = normalized;
      }
    });
    els.voiceSystemPromptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void applyVoiceSystemPrompt();
      }
    });
  }

  if (els.voiceSystemPromptSaveBtn) {
    els.voiceSystemPromptSaveBtn.addEventListener("click", () => {
      void applyVoiceSystemPrompt();
    });
  }

  if (els.transitionPhrasesInput) {
    els.transitionPhrasesInput.addEventListener("input", () => {
      state.transitionPhrasesDirty = true;
      const normalized = normalizeTransitionPhrasesInput(
        els.transitionPhrasesInput.value
      );
      if (normalized !== els.transitionPhrasesInput.value) {
        els.transitionPhrasesInput.value = normalized;
      }
    });
    els.transitionPhrasesInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void applyTransitionPhrases();
      }
    });
  }

  if (els.transitionPhrasesSaveBtn) {
    els.transitionPhrasesSaveBtn.addEventListener("click", () => {
      void applyTransitionPhrases();
    });
  }

  if (els.thinkingOffToggle) {
    els.thinkingOffToggle.addEventListener("click", () => {
      void applyThinkingEnabled(!state.thinkingEnabled);
    });
  }

  if (els.forceNonStreamingToggle) {
    els.forceNonStreamingToggle.addEventListener("click", () => {
      void applyForceNonStreamingEnabled(!state.forceNonStreamingEnabled);
    });
  }

  if (els.openclawModelSelect) {
    els.openclawModelSelect.addEventListener("change", () => {
      void applyOpenclawModel(els.openclawModelSelect.value);
    });
  }

  if (els.debugLogToggle) {
    els.debugLogToggle.addEventListener("click", () => {
      void applyDebugLogEnabled(!state.debugLogEnabled);
    });
  }

  if (els.volumeMuteToggle) {
    els.volumeMuteToggle.addEventListener("click", () => {
      if (
        state.speakerControlInFlight &&
        state.speakerControlInFlight.kind === "mute"
      ) {
        return;
      }
      const pendingMuteCommand =
        state.speakerControlQueued && state.speakerControlQueued.kind === "mute"
          ? state.speakerControlQueued
          : null;
      void applyMuted(
        pendingMuteCommand ? !Boolean(pendingMuteCommand.value) : !state.muted
      );
    });
  }

  if (els.statVolume) {
    els.statVolume.addEventListener("focus", () => {
      state.volumeTextEditing = true;
      syncVolumeMetricText(state.currentVolumeValue, { force: true });
      window.requestAnimationFrame(() => {
        if (!els.statVolume || document.activeElement !== els.statVolume) {
          return;
        }
        const selection = window.getSelection();
        if (!selection) {
          return;
        }
        const range = document.createRange();
        range.selectNodeContents(els.statVolume);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });
    els.statVolume.addEventListener("input", () => {
      const raw = sanitizeVolumeMetricText(els.statVolume.textContent);
      if ((els.statVolume.textContent || "") !== raw) {
        syncVolumeMetricText(raw, { force: true });
      }
      if (!raw) {
        return;
      }
      updateVolumeDisplay(raw, { forceText: false });
      renderSpeakerControlState();
      scheduleVolumeCommit(false, true);
    });
    els.statVolume.addEventListener("blur", () => {
      state.volumeTextEditing = false;
      const raw = sanitizeVolumeMetricText(els.statVolume.textContent);
      if (!raw) {
        updateVolumeDisplay(state.confirmedVolumeValue, { forceText: true });
        renderSpeakerControlState();
        return;
      }
      updateVolumeDisplay(raw, { forceText: true });
      renderSpeakerControlState();
      scheduleVolumeCommit(true, true);
    });
    els.statVolume.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        els.statVolume.blur();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        state.volumeTextEditing = false;
        updateVolumeDisplay(state.confirmedVolumeValue, { forceText: true });
        renderSpeakerControlState();
        els.statVolume.blur();
      }
    });
  }

  if (els.volumeSlider) {
    els.volumeSlider.addEventListener("input", () => {
      updateVolumeDisplay(els.volumeSlider.value || "0", { forceText: true });
      renderSpeakerControlState();
      scheduleVolumeCommit(false, true);
    });
    els.volumeSlider.addEventListener("change", () => {
      updateVolumeDisplay(els.volumeSlider.value || "0", { forceText: true });
      renderSpeakerControlState();
      scheduleVolumeCommit(true, true);
    });
  }

  if (els.dialogWindowInput) {
    els.dialogWindowInput.addEventListener("input", () => {
      const raw = normalizeIntegerText(
        els.dialogWindowInput.value,
        MAX_DIALOG_WINDOW_SECONDS
      );
      state.dialogWindowDirty = true;
      els.dialogWindowInput.value = raw;
      if (!raw) {
        return;
      }
      updateDialogWindowDisplay(
        clamp(Number(raw) || 0, MIN_DIALOG_WINDOW_SECONDS, MAX_DIALOG_WINDOW_SECONDS),
        {
        forceInput: false,
        }
      );
    });
    els.dialogWindowInput.addEventListener("blur", () => {
      if (!els.dialogWindowInput.value.trim()) {
        state.dialogWindowDirty = false;
        updateDialogWindowDisplay(state.currentDialogWindowValue, {
          forceInput: true,
        });
        return;
      }
      if (state.dialogWindowDirty) {
        void applyDialogWindowSeconds();
      }
    });
    els.dialogWindowInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void applyDialogWindowSeconds();
      }
    });
  }

  if (els.voiceContextTurnsInput) {
    els.voiceContextTurnsInput.addEventListener("input", () => {
      state.voiceContextDirty = true;
      els.voiceContextTurnsInput.value = normalizeIntegerText(
        els.voiceContextTurnsInput.value,
        MAX_VOICE_CONTEXT_TURNS
      );
    });
    els.voiceContextTurnsInput.addEventListener("blur", () => {
      commitVoiceContextSettingsFromBlur();
    });
    els.voiceContextTurnsInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void applyVoiceContextSettings();
      }
    });
  }

  if (els.voiceContextCharsInput) {
    els.voiceContextCharsInput.addEventListener("input", () => {
      state.voiceContextDirty = true;
      els.voiceContextCharsInput.value = normalizeIntegerText(
        els.voiceContextCharsInput.value,
        MAX_VOICE_CONTEXT_CHARS
      );
    });
    els.voiceContextCharsInput.addEventListener("blur", () => {
      commitVoiceContextSettingsFromBlur();
    });
    els.voiceContextCharsInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void applyVoiceContextSettings();
      }
    });
  }

  if (els.composerInput) {
    els.composerInput.addEventListener("input", autoResizeComposer);
    els.composerInput.addEventListener("focus", () => {
      syncComposerMetrics();
      showComposer();
      scheduleConversationBottomStick(true);
    });
    els.composerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCompose();
      }
    });
  }

  if (els.sendBtn) {
    els.sendBtn.addEventListener("click", sendCompose);
  }

  if (els.audioUrlInput) {
    els.audioUrlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendAudioPlay();
      }
    });
  }

  if (els.audioSendBtn) {
    els.audioSendBtn.addEventListener("click", sendAudioPlay);
  }

  if (els.wakeBtn) {
    els.wakeBtn.addEventListener("click", wakeUp);
  }

  bindChatScroll();
  setComposeMode("chat");
  setDeviceListVisible(false);
  updateVolumeDisplay(0);
  state.hasVolumeSnapshot = false;
  updateDialogWindowDisplay(DEFAULT_DIALOG_WINDOW_SECONDS);
  updateVoiceContextDisplay(
    DEFAULT_VOICE_CONTEXT_TURNS,
    DEFAULT_VOICE_CONTEXT_CHARS,
    { forceInput: true }
  );
  renderThinkingToggle(false);
  renderDebugLogToggle(true);
  renderSpeakerControlState();
  setControlAvailability(false);
  renderIdleCurrentAudio();
  hydrateAudioPlayers(document);
  autoResizeComposer();
  syncComposerMetrics();
  installControlMasonryLayout();
  if (els.composerShell && typeof ResizeObserver === "function") {
    const composerResizeObserver = new ResizeObserver(() => {
      syncComposerMetrics();
    });
    composerResizeObserver.observe(els.composerShell);
  }
  window.addEventListener("resize", syncComposerMetrics);
  window.addEventListener("resize", () => syncLoginWorkspaceFrameHeight());
  setActiveTab(getStoredConsoleTab(), false);
  refreshAll(false);
  installRefreshTimer();
}

function boot() {
  initThemeSystem();
  initThemeSwitches();
  if (document.body.dataset.page === "access") {
    initAccessPage();
    return;
  }
  if (document.body.dataset.page === "console") {
    initConsolePage();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
