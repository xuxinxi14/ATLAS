import { createRollingClock } from "./rolling-clock";
import { InspectionOverlay } from "./inspection-overlay";
import { DocumentDecryption } from "./document-decryption";
import "./document-decryption.css";
import "./decryption.css";
import { escapeHtml } from "./html";
import {
  normalizeQuality,
  qualityPresets,
  type QualityPreset,
  type RenderQuality,
} from "./render-quality";
import { qualityMarkup, syncQualityUI } from "./quality-settings";
import { superPerformanceQuality, wallpaperQuality } from "./wallpaper-quality";
import "@kitlangton/rolling-number/styles.css";
import "./style.css";
import "./quality-settings.css";
import "./responsive.css";
import "./styles/atlas-views.css";
import { viewportLayout, openingLayout } from "./viewport-layout";
import { assetUrl } from "./asset-url";
import { initPwa, pwaSettingsMarkup } from "./pwa";
import {
  createRollingNumber,
  createRollingText,
} from "@kitlangton/rolling-number";
import { ArchiveScene } from "./scene";
import { ModelViewer } from "./model-viewer";
import { ContentTransition, SurfaceTransition } from "./ui-transitions";
import { BootSequence } from "./boot";
import { loadBootWebfonts } from "./boot-lettering";
import { wrap, type ArchiveNavigation } from "./archive-loop";
import {
  records,
  categories,
  portals,
  archiveColumns,
  columnFiles,
  fileLocation,
  refreshArchiveRecords,
} from "./data";
import {
  knowledgeRepository,
  hotReloadRepositoryData,
  statusMeta,
  typeMeta,
} from "./knowledge/repository";
import type { EntryStatus, EntryType } from "./knowledge/types";
import {
  parseHashRoute,
  buildEntryHash,
  buildLibraryHash,
  buildStudioHash,
  type RouteView,
} from "./app/router";
import {
  searchKnowledge,
  hotReloadSearchIndex,
} from "./search/search-engine";
import { renderTelemetryHomeMarkup } from "./app/telemetry-view";
import {
  renderLibraryViewMarkup,
  filterAndSortLibraryEntries,
  resolveLibrarySelection,
  deskDomainTitle,
  type LibraryState,
} from "./library/library-view";
import {
  renderReaderViewMarkup,
  hydrateEntryHtmlImages,
  prefetchEntryAssets,
} from "./reader/reader-view";
import {
  renderStudioViewMarkup,
  createDefaultStudioDraft,
  ATLAS_AI_ARCHIVE_PROMPT,
  type StudioDraftState,
} from "./studio/studio-view";
import { TerminalAudio } from "./audio";
import { audioSettingsMarkup } from "./audio-settings";
import {
  createMotionPreferences,
  fullMotion,
  motionEnabled,
  motionPresetFor,
  motionSettingsMarkup,
  motionSummary,
  reducedMotion,
  type MotionKey,
  type MotionPreset,
  type StoredMotion,
} from "./motion-preferences";
import { StartupGate } from "./startup";
import {
  isWallpaper,
  wallpaperHost,
  wallpaperFrame,
  type WallpaperProperties,
} from "./wallpaper";
import "./startup.css";
import "./wallpaper.css";
import { Workbench } from "./workbench";
let workbench: Workbench | undefined;
import { ArchivePlayground } from "./archive-playground";
import { ARRAY_OPENING_END, openingShowsDetail } from "./wallpaper-opening";
import { paintTheme, themeSettingsMarkup } from "./theme-ui";
let playground: ArchivePlayground | undefined;
import { WallpaperEffects } from "./wallpaper-effects";
import { WallpaperBackground } from "./wallpaper-background";
import { enableGamepad, isGamepadEvent, onInputDevice } from "./gamepad";
let wallpaperEffects: WallpaperEffects | undefined;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
import { logo, brandHeading } from "./brand";

$("#stage").innerHTML = `
  <div id="three-scene" class="three-scene"></div>
  <div class="scene-atmosphere archive-atmosphere"></div>
  <div id="boot-background" class="boot-background"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="3"><path d="M-210 705C-45 705 182 704 247 567C337 377 99 306 4 435S27 680 169 631C309 584 227 314 279 111S568-113 568-113"/><path d="M1560-80C1374 114 1671 168 1601 323S1371 367 1431 480S1692 666 1559 787S1329 886 1498 1130"/><circle cx="1450" cy="648" r="346"/><circle cx="1450" cy="648" r="348"/></g></svg></div>
  <header class="brand">${brandHeading}</header>
  <nav class="system-nav" aria-label="系统导航">
    <button class="nav-mode-btn" data-action="nav-home" title="遥测中枢概览 (#/home)">TELEMETRY <span class="key">H</span></button>
    <button class="nav-mode-btn" data-action="nav-library" title="二维知识索引目录 (#/library)">2D LIBRARY <span class="key">L</span></button>
    <button class="nav-mode-btn active" data-action="nav-archive" title="三维档案大厅 (#/archive)">3D ARCHIVE</button>
    <button class="nav-mode-btn" data-action="nav-studio" title="内置档案编撰台 (#/studio)">✎ STUDIO <span class="key">N</span></button>
    <button data-action="search"><span class="nav-glyph">⌕</span> ARCHIVE INDEX <span class="key">/</span></button>
    <button data-action="saved" aria-label="查看收藏档案" title="收藏档案">＋ SAVED <span id="saved-count">00</span></button>
    <button class="settings-button" data-action="settings" aria-label="系统设置" title="系统设置"><span class="settings-glyph" aria-hidden="true">◷</span><span class="settings-label">设置</span></button>
    <i class="nav-mode-indicator" aria-hidden="true"></i>
  </nav>
  <button id="skip" class="skip" data-action="skip">ENTER SYSTEM <span>↗</span></button>
  <section id="boot" class="boot" aria-label="系统启动">
    <div class="access-text">ACCESS</div>
    <div class="boot-logo">${logo}</div>
    <div class="auth-status"><span>▪</span> <span id="auth-message"></span><i></i></div>
    <div class="scan"><svg viewBox="0 0 1920 1080" aria-hidden="true"><g fill="none" stroke="#080a08" stroke-width="2" stroke-linecap="round"><path/><path stroke="#fff"/><path/><path/><path/><path/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="scan-core" cx="960" cy="540" r="5" fill="#080a08" stroke="none"/></g></svg><span>PERMISSION AUTHORIZED</span></div>
    <div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading">WELCOME TO</div><div class="welcome-company"><strong>RHINE LAB.LLC.</strong><strong class="welcome-highlight" aria-hidden="true">RHINE LAB.LLC.</strong></div><div class="welcome-database">INTERNAL DATABASE</div><div class="welcome-logo">${logo}</div></div>
  </section>
  <svg id="inspection-marks" viewBox="0 0 1920 1080" aria-hidden="true"><path id="inspection-lines"/><g id="inspection-corners"></g><circle id="inspection-point" r="1.8"/></svg>
  <div id="inspection-text" aria-hidden="true">CONFIDENTIALITY:<strong>GENERAL BUSINESS USE</strong></div>
  <section id="archive-ui" class="archive-ui" aria-label="档案选择">
    <div class="archive-callout"><div class="eyebrow">INTERNAL DATABASE <span>／</span> <span id="archive-category">机构档案</span></div><button class="file-title" data-action="open">FILE NUMBER: <span id="selected-id">X-<span id="selected-code">001</span></span><span class="file-open">↗</span></button><div class="callout-rule"><i></i></div><div class="file-summary"><span id="selected-title">莱茵生命</span><span id="selected-clearance">BUSINESS AREA</span></div><div class="callout-actions-row"><button class="read-file" data-action="open">ACCESS FILE <span>→</span></button><button class="read-file read-file-2d" data-action="open-current-reader">2D FULLTEXT <span>↗</span></button></div></div>
    <div id="hover-label" class="hover-label" hidden>X-<span id="hover-code">001</span> / <span id="hover-title"></span></div>
    <div class="archive-counter"><span class="tiny-label">ARCHIVE / SELECT</span><div><span id="selected-number">01</span><i>/</i><span class="count-total">12</span></div></div>
    <div class="archive-navigation"><button data-action="prev" aria-label="上一个档案">↑</button><div id="file-ticks" class="file-ticks"></div><button data-action="next" aria-label="下一个档案">↓</button></div>
    <div class="column-navigation"><button data-action="column-prev" aria-label="上一列">←</button><div><span id="column-number">COLUMN <span id="column-index">03</span> / 05</span><strong id="column-name">机构档案</strong></div><button data-action="column-next" aria-label="下一列">→</button></div>
    <div class="archive-hint"><kbd>←</kbd> <kbd>→</kbd> 切换列 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后档案 <span>／</span> <kbd>ENTER</kbd> 读取</div>
  </section>
  <section id="detail-ui" class="detail-ui" aria-label="档案内容" hidden>
    <button class="back-button" data-action="back">← <span>ARCHIVE OVERVIEW</span><small>ESC</small></button>
    <div class="object-caption"><span id="object-id">NO.001</span><div>INTERNAL DATABASE</div><small>DRAG TO INSPECT <span>↔</span></small><button class="viewer-open" data-action="model-viewer">360° 查看文档模型 <span>↗</span></button></div>
    <article id="detail-content" class="detail-content"></article>
  </section>
  <section id="atlas-surface" class="atlas-surface" aria-label="ATLAS 二维知识终端" hidden></section>
  <div id="spatial-transit-hud" class="spatial-transit-hud" aria-hidden="true">
    <div class="transit-shutter-top"></div>
    <div class="transit-shutter-bottom"></div>
    <div class="transit-scanline"></div>
    <div class="transit-reticle tl"></div>
    <div class="transit-reticle tr"></div>
    <div class="transit-reticle bl"></div>
    <div class="transit-reticle br"></div>
    <div class="transit-telemetry-bar">
      <span class="transit-tag">◈ OPTICAL LINK // SECTOR TRANSIT</span>
      <strong id="transit-route-label">01 // 3D ARCHIVE HALL → 02 // 2D LIBRARY</strong>
      <span id="transit-coord-label">LANE 01 · SPECIMEN X-001 · LOCKED</span>
    </div>
  </div>
  <div class="powered">POWERED BY <b>RHINE LAB</b><i></i></div>
  <footer class="system-footer"><span><i class="status-light"></i> SESSION AUTHORIZED${isWallpaper ? '<button type="button" class="three-toggle" data-action="toggle-three" aria-pressed="true" title="卸载三维模型，保留 2D 界面">3D 开启</button>' : ""}</span><span>ATLAS // PERSONAL KNOWLEDGE TERMINAL <i>／</i> <span id="clock">00:00:00</span></span><button data-action="replay" title="重播启动流程">REINITIALIZE ↗</button></footer>
  <div id="pwa-update-notice" class="pwa-update-notice" role="status" hidden><span>新版本已就绪</span><button data-pwa-action="update">更新并重启 ↻</button></div>
  <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>
  <div id="loading" class="loading"><div class="loading-mark">${logo}</div><span>CONNECTING TO INTERNAL DATABASE</span><i></i></div>
`;

$("#boot-background").insertAdjacentHTML(
  "beforeend",
  '<div class="boot-white"></div>',
);
const bootSequence = new BootSequence($("#stage"));
$("#viewport").insertAdjacentHTML(
  "beforeend",
  '<button class="mobile-entry" data-action="skip">进入档案 <span>→</span></button>',
);

type Mode = "boot" | "archive" | "detail";
let mode: Mode = "boot",
  selected = 0,
  bootStart = 0,
  lastStep = "",
  ready = false;
let modal: "search" | "saved" | "settings" | null = null,
  searchQuery = "",
  filter = "全部档案";
let activeTab = "overview";
let atlasView: RouteView = "archive";
let activeReaderSlug = records[0]?.slug ?? "tools/aegisub";
let activeReaderAnchor: string | undefined;
const libraryState: LibraryState = {
  category: "all",
  type: "all",
  status: "all",
  query: "",
  sortBy: "updated",
  layout: "grid",
  selectedId: records[0]?.entryId ?? "tools/aegisub",
  savedOnly: false,
  filterOpen: false,
  openRowMenuId: null,
  unfiltered3DNoticeId: null,
};
const libraryDomainMemory: Record<string, string> = {};
const studioState: StudioDraftState = createDefaultStudioDraft("tools");
let studioPreviewTimer: ReturnType<typeof setTimeout> | undefined;
let transitTimer: ReturnType<typeof setTimeout> | undefined;
const reviewParams = new URLSearchParams(location.search);
let frozenTime =
  reviewParams.get("freeze") === "1"
    ? Number(reviewParams.get("time") ?? 0)
    : null;
if (reviewParams.get("review") === "1") {
  $("#stage").dataset.review = "true";
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "rhine-review-frame"
    )
      return;
    const t = Number(event.data.time);
    if (!Number.isFinite(t) || t < 0 || t >= 35) return;
    frozenTime = t;
    if (ready && mode !== "boot") setMode("boot");
  });
}
let toastTimer: ReturnType<typeof setTimeout>;
let previousFocus: HTMLElement | null = null;
const detailTransition = new SurfaceTransition(
  $("#detail-ui"),
  undefined,
  180,
  180,
);
const tabTransition = new ContentTransition();
let modalTransition: SurfaceTransition | undefined;
let modalClosing = false;
let modalSiblings: { node: HTMLElement; inert: boolean }[] = [];
let pendingDetailFocus = false;
let bookmarkFeedback: Animation | undefined;
function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const saved = new Set<string>(readLocal<string[]>("rhine-saved", []));
const storedPrefs = readLocal<
  Partial<{
    sound: boolean;
    music: boolean;
    soundVolume: number;
    musicVolume: number;
    reduced: boolean;
    quality: boolean;
    rendering: RenderQuality;
    superPerformance: boolean;
    colorTheme: "light" | "dark";
    motion: StoredMotion;
    motionPreset: MotionPreset;
  }>
>("rhine-settings", {});
const initialMotion = createMotionPreferences(
  storedPrefs.motion,
  storedPrefs.reduced ??
    (storedPrefs.motion === undefined
      ? matchMedia("(prefers-reduced-motion: reduce)").matches
      : undefined),
);
const initialMotionPreset = motionPresetFor(initialMotion);
const prefs = {
  sound: storedPrefs.sound ?? true,
  music: storedPrefs.music ?? storedPrefs.sound ?? true,
  soundVolume: storedPrefs.soundVolume ?? 0.55,
  musicVolume: storedPrefs.musicVolume ?? 0.5,
  motion: initialMotion,
  motionPreset: initialMotionPreset,
  quality: storedPrefs.quality ?? true,
  superPerformance: storedPrefs.superPerformance ?? false,
  rendering: normalizeQuality(
    storedPrefs.rendering,
    storedPrefs.quality !== false,
  ),
  colorTheme: storedPrefs.colorTheme === "dark" ? "dark" : "light",
};
const motionActive = (key: MotionKey) => motionEnabled(prefs.motion, key);
const motionIsReduced = () =>
  Object.values(prefs.motion).every((value) => !value);
paintTheme(prefs.colorTheme === "dark" ? 1 : 0);
const rollingMotion = {
  duration: 460,
  motionBlur: true,
  animated: motionActive("rollingNumbers"),
};
const updateFooterClock = createRollingClock($("#clock"));
const numberOptions = {
  ...rollingMotion,
  locales: "en-US",
  format: { minimumIntegerDigits: 2, useGrouping: false },
};
const fileCounter = createRollingNumber($("#selected-number"), {
  ...numberOptions,
  value: 1,
});
const columnCounter = createRollingNumber($("#column-index"), {
  ...numberOptions,
  value: 3,
});
const codeOptions = {
  ...numberOptions,
  format: { minimumIntegerDigits: 3, useGrouping: false },
  value: 1,
};
const textOptions = {
  ...rollingMotion,
  animated: motionActive("rollingText"),
  transition: "direct" as const,
  stagger: "none" as const,
};
const selectionTitle = createRollingText($("#selected-title"), {
  ...textOptions,
  text: $("#selected-title").textContent ?? "",
});
const columnTitle = createRollingText($("#column-name"), {
  ...textOptions,
  text: $("#column-name").textContent ?? "",
});
const hoverTitle = createRollingText($("#hover-title"), {
  ...textOptions,
  text: "",
});
const categoryTitle = createRollingText($("#archive-category"), {
  ...textOptions,
  text: $("#archive-category").textContent ?? "",
});
const clearanceTitle = createRollingText($("#selected-clearance"), {
  ...textOptions,
  text: $("#selected-clearance").textContent ?? "",
});
const rollingTitles = [
  selectionTitle,
  columnTitle,
  hoverTitle,
  categoryTitle,
  clearanceTitle,
];
const selectedCode = createRollingNumber($("#selected-code"), codeOptions);
const hoverCode = createRollingNumber($("#hover-code"), codeOptions);
const audio = new TerminalAudio();
let musicSuppressed = false;
function configureAudio() {
  audio.configure({ ...prefs, music: prefs.music && !musicSuppressed });
}
configureAudio();
const reviewEntry =
  reviewParams.has("scene") ||
  reviewParams.has("time") ||
  reviewParams.get("review") === "1";
let started = false;
const loading = $("#loading");
// The entry screen uses the actual viewport, including portrait phones; the
// reference animation still uses its calibrated 1920 x 1080 stage.
$("#viewport").append(loading);
$("#stage").inert = true;
$(".mobile-entry").inert = true;
const entry =
  !isWallpaper && !reviewEntry && (prefs.sound || prefs.music)
    ? new StartupGate({
        root: loading,
        unlock: () => audio.unlock(),
        cancel: () => audio.cancelEntry(),
        start: (silent) => completeStartup(silent),
      })
    : undefined;
if (entry) {
  audio.holdForEntry();
  if (prefs.music)
    void audio.prepareMusic().catch(() => {
      /* Entry offers retry. */
    });
}
let audioPreview = false,
  audioPreviewRequest = 0;
let scene: ArchiveScene | undefined;
let threeState: "on" | "closing" | "off" | "loading" = "on";
let resumeCell: { lane: number; row: number } | undefined;
let resumeSelection = -1;
let viewer: ModelViewer | undefined;
const accessLog: { id: string; time: string }[] = [];
const columnMemory = archiveColumns.map((_, lane) => columnFiles(lane)[0]);
function recordAccess() {
  accessLog.unshift({
    id: records[selected].id,
    time: new Date().toLocaleTimeString("en-GB"),
  });
}
function saveAudioPrefs() {
  try {
    localStorage.setItem("rhine-settings", JSON.stringify(prefs));
  } catch {}
  configureAudio();
}
function superPerformanceEnabled() {
  return isWallpaper
    ? wallpaperHost()?.properties.superperformance?.value === true
    : prefs.superPerformance;
}
function effectiveRenderQuality() {
  return superPerformanceEnabled() ? superPerformanceQuality : prefs.rendering;
}
function savePrefs() {
  saveAudioPrefs();
  if (!motionActive("rollingText"))
    rollingTitles.forEach((title) => title.finish());
  if (!motionActive("rollingNumbers"))
    [fileCounter, columnCounter, selectedCode, hoverCode].forEach((counter) =>
      counter.finish(),
    );
  if (!motionActive("surfaceTransitions")) {
    detailTransition.finish();
    modalTransition?.finish();
    tabTransition.finish();
    bookmarkFeedback?.cancel();
  }
  scene?.setMotion(prefs.motion);
  scene?.setTheme(
    prefs.colorTheme === "dark",
    !motionActive("surfaceTransitions") || !started,
  );
  document
    .querySelectorAll<HTMLElement>("[data-color-theme]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.colorTheme === prefs.colorTheme),
      ),
    );
  scene?.setSuperPerformance(superPerformanceEnabled());
  viewer?.setSuperPerformance(superPerformanceEnabled());
  scene?.setQuality(effectiveRenderQuality());
  viewer?.setQuality(effectiveRenderQuality());
  viewer?.setMotion(prefs.motion);
  syncQualityUI(prefs.rendering);
  updateQualitySummary();
  fileCounter.update({
    animated: motionActive("rollingNumbers") && mode === "archive",
  });
  rollingTitles.forEach((title) =>
    title.update({
      animated: motionActive("rollingText") && mode === "archive",
    }),
  );
  columnCounter.update({
    animated: motionActive("rollingNumbers") && mode === "archive",
  });
  selectedCode.update({
    animated: motionActive("rollingNumbers") && mode === "archive",
  });
  hoverCode.update({
    animated: motionActive("rollingNumbers") && mode === "archive",
  });
  $("#stage").classList.toggle("reduce-motion", motionIsReduced());
  $("#stage").classList.toggle(
    "reduce-surfaces",
    !motionActive("surfaceTransitions"),
  );
  workbench?.setMotion(prefs.motion);
  updateFooterClock(new Date(), motionActive("rollingNumbers"));
  syncWallpaperBackground();
}
let previousLayout = "";
function fit() {
  const stage = $("#stage");
  const viewport = $("#viewport");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reference =
    reviewParams.has("time") || reviewParams.get("review") === "1";
  const { width, height, scale, kind } =
    mode === "boot" && !reference
      ? openingLayout(viewport.clientWidth, viewport.clientHeight)
      : viewportLayout(
          viewport.clientWidth,
          viewport.clientHeight,
          coarse,
          mode === "boot",
        );
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.dataset.layout = kind;
  stage.dataset.touch = String(coarse);
  viewport.dataset.mobileBoot = String(
    mode === "boot" && (coarse || viewport.clientWidth < 1100),
  );
  stage.style.setProperty("--stage-scale", String(scale));
  stage.style.setProperty("--opening-width", `${width}px`);
  stage.style.setProperty("--opening-height", `${height}px`);
  stage.style.setProperty(
    "--opening-scan-scale",
    String(Math.min(1, width / 1920)),
  );
  stage.dataset.openingPortrait = String(width < height);
  // The software keyboard resizes dialogs without recomposing the 3D scene.
  const visible = window.visualViewport;
  const stageTop = (viewport.clientHeight - height * scale) / 2;
  stage.style.setProperty(
    "--modal-top",
    `${Math.max(0, (visible?.offsetTop ?? 0) - stageTop) / scale}px`,
  );
  stage.style.setProperty(
    "--modal-height",
    `${Math.min(height, (visible?.height ?? viewport.clientHeight) / scale)}px`,
  );
  $("#viewport").style.setProperty("--scale", String(scale));
  const marks = document.querySelector("#inspection-marks");
  marks?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const layoutKey = JSON.stringify([
    width,
    height,
    scale,
    kind,
    devicePixelRatio,
  ]);
  if (layoutKey !== previousLayout) {
    previousLayout = layoutKey;
    scene?.resize();
    viewer?.resize();
  }
  updateQualitySummary();
  // Re-measure line covers and tab underline after wrapping changes.
  requestAnimationFrame(() => {
    documentDecryption.refresh();
    const tab = document.querySelector<HTMLElement>(
      ".detail-tabs button.active",
    );
    const indicator = document.querySelector<HTMLElement>(".tab-indicator");
    if (tab && indicator)
      indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    syncNavButtons(false);
  });
}
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);
matchMedia("(pointer: coarse)").addEventListener("change", fit);
fit();
const maxTickSlots = Math.max(
  8,
  ...archiveColumns.map((_, lane) => Math.min(16, columnFiles(lane).length)),
);
$("#file-ticks").innerHTML = Array.from(
  { length: maxTickSlots },
  (_, slot) => `<button data-select="${slot}"></button>`,
).join("");
const fileTicks = [
  ...$("#file-ticks").querySelectorAll<HTMLButtonElement>("button"),
];

function isEntrySaved(idOrCode: string): boolean {
  const entry =
    knowledgeRepository.byId(idOrCode) ?? knowledgeRepository.bySlug(idOrCode);
  if (entry) {
    return saved.has(entry.id) || saved.has(entry.globalCode);
  }
  return saved.has(idOrCode);
}

let renderedAtlasView: RouteView = "archive";
let atlasExitAnimation: Animation | undefined;

const VIEW_SPATIAL_META: Record<
  RouteView,
  { depth: number; x: number; code: string; label: string }
> = {
  boot: { depth: 0, x: 0, code: "00", label: "SYSTEM BOOT // 启动序列" },
  home: { depth: 1, x: -1, code: "01", label: "TELEMETRY MATRIX // 遥测中枢" },
  archive: { depth: 2, x: 0, code: "02", label: "3D ARCHIVE HALL // 三维档案大厅" },
  library: { depth: 3, x: 1, code: "03", label: "2D DIRECTORY // 二维知识索引" },
  reader: { depth: 4, x: 2, code: "04", label: "SPECIMEN DOSSIER // 档案正文" },
  studio: { depth: 5, x: 3, code: "05", label: "ARCHIVE STUDIO // 档案编撰台" },
};

function currentSpatialCoordText(): string {
  const rec = records[selected];
  if (!rec) return "SECTOR 01 · READY";
  const { lane } = fileLocation(selected);
  return `LANE 0${lane + 1} (${rec.category}) · ${rec.visualCode} (${rec.id}) · ${rec.title.slice(0, 18)}`;
}

function triggerSpatialTransit(
  fromView: RouteView,
  toView: RouteView,
  coordOverride?: string,
) {
  if (!motionActive("surfaceTransitions") || mode === "boot") return;
  const hud = document.querySelector<HTMLElement>("#spatial-transit-hud");
  if (!hud) return;
  const fromMeta = VIEW_SPATIAL_META[fromView] ?? VIEW_SPATIAL_META.archive;
  const toMeta = VIEW_SPATIAL_META[toView] ?? VIEW_SPATIAL_META.archive;

  const routeEl = hud.querySelector<HTMLElement>("#transit-route-label");
  const coordEl = hud.querySelector<HTMLElement>("#transit-coord-label");
  if (routeEl) {
    routeEl.textContent = `${fromMeta.code} // ${fromMeta.label.split(" // ")[0]}  →  ${toMeta.code} // ${toMeta.label}`;
  }
  if (coordEl) {
    coordEl.textContent = coordOverride ?? currentSpatialCoordText();
  }

  clearTimeout(transitTimer);
  hud.classList.remove("active");
  // Force reflow so rapid consecutive transitions restart cleanly
  void hud.offsetWidth;
  hud.classList.add("active");
  transitTimer = setTimeout(() => {
    hud.classList.remove("active");
  }, 520);
}

function syncNavButtons(animated = true) {
  let activeBtn: HTMLElement | null = null;
  document
    .querySelectorAll<HTMLElement>(".system-nav .nav-mode-btn")
    .forEach((btn) => {
      const act = btn.dataset.action;
      const isAct =
        (act === "nav-home" && atlasView === "home") ||
        (act === "nav-library" &&
          (atlasView === "library" || atlasView === "reader")) ||
        (act === "nav-archive" && atlasView === "archive") ||
        (act === "nav-studio" && atlasView === "studio");
      btn.classList.toggle("active", isAct);
      btn.setAttribute("aria-pressed", String(isAct));
      if (isAct) activeBtn = btn;
    });
  const indicator = document.querySelector<HTMLElement>(".nav-mode-indicator");
  if (indicator && activeBtn) {
    const btnEl = activeBtn as HTMLElement;
    indicator.style.transition =
      animated && motionActive("surfaceTransitions") ? "" : "none";
    indicator.style.transform = `translateX(${btnEl.offsetLeft}px) scaleX(${btnEl.offsetWidth})`;
  }
}

let previousReaderSlug = "";
let manualReaderRecede: boolean | null = null;

function syncOpticalReaderDom() {
  const stage = $("#stage");
  if (!scene || !motionActive("surfaceTransitions")) {
    stage.style.setProperty("--optical-dock", "1");
    stage.style.setProperty("--optical-contact", "1");
    stage.style.setProperty("--optical-sweep", "0");
    stage.style.setProperty("--optical-active", "1");
    stage.style.setProperty("--optical-title-reveal", "1");
    stage.style.setProperty("--optical-body-reveal", "1");
    return;
  }
  const f = scene.opticalReaderFrame;
  stage.style.setProperty("--optical-dock", f.rigDock.toFixed(4));
  stage.style.setProperty("--optical-contact", f.contactGlow.toFixed(4));
  stage.style.setProperty("--optical-sweep", f.amberSweep.toFixed(4));
  stage.style.setProperty("--optical-active", f.screenActive.toFixed(4));
  stage.style.setProperty("--optical-title-reveal", f.titleReveal.toFixed(4));
  stage.style.setProperty("--optical-body-reveal", f.bodyReveal.toFixed(4));
}

function syncIndexDeskDom() {
  const stage = $("#stage");
  const surface = $("#atlas-surface");
  if (!scene || !motionActive("surfaceTransitions")) {
    const active = atlasView === "library";
    stage.style.setProperty("--desk-ack", active ? "0" : "1");
    stage.style.setProperty("--desk-dir-opacity", active ? "1" : "0");
    stage.style.setProperty("--desk-anchor-opacity", "0");
    stage.style.setProperty("--desk-retreat", active ? "0" : "1");
    stage.style.setProperty("--desk-dive", active ? "0" : "1");
    stage.style.setProperty("--desk-hud-handover", "1");
    stage.dataset.deskTransitioning = "false";
    return;
  }
  const f = scene.indexDeskFrame;
  stage.style.setProperty("--desk-ack", f.responseAck.toFixed(4));
  stage.style.setProperty("--desk-dir-opacity", f.directoryOpacity.toFixed(4));
  stage.style.setProperty(
    "--desk-anchor-opacity",
    f.selectedAnchorOpacity.toFixed(4),
  );
  stage.style.setProperty("--desk-retreat", f.deskRetreat.toFixed(4));
  stage.style.setProperty("--desk-dive", f.cameraDive.toFixed(4));
  stage.style.setProperty("--desk-hud-handover", f.hudHandover.toFixed(4));
  const isMidTransition = f.time > 0.008 && f.time < 1.242;
  stage.dataset.deskTransitioning = String(isMidTransition);
  if (
    atlasView === "archive" &&
    surface.dataset.deskBridgeHold === "true" &&
    f.time >= 1.24
  ) {
    delete surface.dataset.deskBridgeHold;
    delete stage.dataset.atlasOverlay;
    surface.hidden = true;
  }
}

function exitOpticalReader() {
  manualReaderRecede = null;
  previousReaderSlug = "";
  scene?.setReaderReceded(false);
  scene?.setReaderMode(false);
  if (mode === "detail") {
    setMode("archive");
  } else {
    scene?.setMode("archive");
  }
  navigateAtlas("#/archive");
  audio.play("back");
}

function renderSpatialLinkBarMarkup(): string {
  if (atlasView === "reader" || atlasView === "library") return "";
  const rec = records[selected];
  if (!rec) return "";
  const { lane } = fileLocation(selected);
  const cameraModeLabel =
    atlasView === "studio" && !studioState.isNew
      ? "CASSETTE INSPECT // 档案盒已升起检视"
      : "ARRAY ORBIT // 阵列轨道已对齐";
  return `
    <div class="atlas-spatial-bar" role="region" aria-label="三维档案馆空间联动状态">
      <div class="spatial-bar-left">
        <span class="spatial-pulse"></span>
        <span class="spatial-kicker">3D SPATIAL LOCK // ${cameraModeLabel}</span>
        <strong>COLUMN 0${lane + 1} · ${escapeHtml(rec.category)} · ${escapeHtml(rec.visualCode)} (${escapeHtml(rec.id)})</strong>
        <span class="spatial-title">${escapeHtml(rec.title)}</span>
      </div>
      <div class="spatial-bar-actions">
        <button type="button" class="spatial-jump-btn" data-atlas-action="inspect-current-3d" title="收起二维终端，直接检视当前已锁定的三维档案盒">
          INSPECT 3D MODEL ↗ <span>切回三维现场</span>
        </button>
      </div>
    </div>
  `;
}

function renderAtlasSurface(preserveLibraryInputFocus = false) {
  const surface = $("#atlas-surface");
  const is2D =
    atlasView === "home" ||
    atlasView === "library" ||
    atlasView === "reader" ||
    atlasView === "studio";
  syncNavButtons();

  if (!is2D || mode === "boot") {
    const prevView = renderedAtlasView;
    delete $("#stage").dataset.atlasOverlay;
    $("#stage").dataset.atlasView = "archive";
    $("#archive-ui").inert =
      mode !== "archive" || Boolean(modal) || Boolean(workbench?.enabled);
    $("#detail-ui").inert = mode !== "detail" || Boolean(modal);
    renderedAtlasView = "archive";

    if (prevView !== "archive" && prevView !== "reader" && mode !== "boot") {
      triggerSpatialTransit(prevView, "archive");
    }

    if (!surface.hidden) {
      surface.inert = true;
      if (!motionActive("surfaceTransitions") || mode === "boot") {
        atlasExitAnimation?.cancel();
        atlasExitAnimation = undefined;
        delete surface.dataset.deskBridgeHold;
        surface.hidden = true;
      } else if (prevView === "library" && scene) {
        atlasExitAnimation?.cancel();
        atlasExitAnimation = undefined;
        surface.dataset.deskBridgeHold = "true";
        $("#stage").dataset.atlasOverlay = "true";
        syncIndexDeskDom();
      } else if (prevView === "reader") {
        atlasExitAnimation?.cancel();
        const anim = surface.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 240,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        });
        atlasExitAnimation = anim;
        anim.onfinish = () => {
          surface.hidden = true;
          anim.cancel();
          atlasExitAnimation = undefined;
        };
      } else if (!atlasExitAnimation) {
        const currentOpacity = getComputedStyle(surface).opacity || "1";
        const anim = surface.animate(
          [
            {
              opacity: currentOpacity,
              transform: "perspective(1400px) translate3d(0, 0, 0) scale(1)",
              filter: "blur(0px)",
            },
            {
              opacity: 0,
              transform:
                "perspective(1400px) translate3d(0, 18px, 55px) scale(1.03)",
              filter: "blur(6px)",
            },
          ],
          {
            duration: 320,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        atlasExitAnimation = anim;
        anim.onfinish = () => {
          surface.hidden = true;
          anim.cancel();
          atlasExitAnimation = undefined;
        };
      }
    }
    return;
  }

  const wasHidden =
    surface.hidden ||
    Boolean(atlasExitAnimation) ||
    surface.dataset.deskBridgeHold === "true";
  const previousView = renderedAtlasView;
  delete surface.dataset.deskBridgeHold;
  atlasExitAnimation?.cancel();
  atlasExitAnimation = undefined;

  let selStart: number | null = null;
  let selEnd: number | null = null;
  let activeInputId = "";
  let prevDirScrollTop = 0;
  if (preserveLibraryInputFocus) {
    const dirListEl = surface.querySelector<HTMLElement>(".desk-dir-list");
    if (dirListEl) {
      prevDirScrollTop = dirListEl.scrollTop;
    }
    const activeEl = document.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (activeEl && activeEl.id) {
      activeInputId = activeEl.id;
      try {
        selStart = activeEl.selectionStart;
        selEnd = activeEl.selectionEnd;
      } catch {}
    }
  }

  const hasWebGL = Boolean(scene);
  const bodyHtml =
    atlasView === "home"
      ? renderTelemetryHomeMarkup(hasWebGL)
      : atlasView === "library"
        ? renderLibraryViewMarkup(libraryState, saved, hasWebGL)
        : atlasView === "studio"
          ? renderStudioViewMarkup(studioState)
          : renderReaderViewMarkup(activeReaderSlug, saved, hasWebGL);

  surface.innerHTML = `<div id="atlas-surface-body" class="atlas-surface-body">${bodyHtml}</div>${renderSpatialLinkBarMarkup()}`;
  surface.hidden = false;
  surface.inert = Boolean(modal);
  $("#stage").dataset.atlasOverlay = "true";
  $("#stage").dataset.atlasView = atlasView;
  $("#archive-ui").inert = true;
  $("#detail-ui").inert = true;

  const viewChanged = previousView !== atlasView || wasHidden;
  renderedAtlasView = atlasView;

  if (atlasView === "reader") {
    syncOpticalReaderDom();
    const readerScroll = surface.querySelector<HTMLElement>(
      "#atlas-reader-scroll",
    );
    const readerStage = surface.querySelector<HTMLElement>(
      "#optical-reader-stage",
    );
    const recedeBtn = surface.querySelector<HTMLElement>(
      '[data-optical-action="toggle-recede"]',
    );
    if (readerStage && manualReaderRecede !== null) {
      readerStage.dataset.receded = String(manualReaderRecede);
      recedeBtn?.setAttribute("aria-pressed", String(manualReaderRecede));
    }
    readerScroll?.addEventListener(
      "scroll",
      () => {
        if (!readerStage || manualReaderRecede !== null) return;
        const shouldRecede = readerScroll.scrollTop > 48;
        const shouldRestore = readerScroll.scrollTop <= 14;
        if (shouldRecede && readerStage.dataset.receded !== "true") {
          readerStage.dataset.receded = "true";
          recedeBtn?.setAttribute("aria-pressed", "true");
          scene?.setReaderReceded(true);
        } else if (shouldRestore && readerStage.dataset.receded === "true") {
          readerStage.dataset.receded = "false";
          recedeBtn?.setAttribute("aria-pressed", "false");
          scene?.setReaderReceded(false);
        }
      },
      { passive: true },
    );
  } else if (atlasView === "library") {
    syncIndexDeskDom();
    if (preserveLibraryInputFocus && prevDirScrollTop > 0) {
      const nextDirList = surface.querySelector<HTMLElement>(".desk-dir-list");
      if (nextDirList) {
        nextDirList.scrollTop = prevDirScrollTop;
      }
    }
  } else if (
    viewChanged &&
    !preserveLibraryInputFocus &&
    motionActive("surfaceTransitions")
  ) {
    if (previousView !== "reader") {
      triggerSpatialTransit(previousView, atlasView);
    }

    const prevMeta =
      VIEW_SPATIAL_META[previousView] ?? VIEW_SPATIAL_META.archive;
    const nextMeta = VIEW_SPATIAL_META[atlasView] ?? VIEW_SPATIAL_META.library;
    const dir = nextMeta.depth >= prevMeta.depth ? 1 : -1;

    if (wasHidden) {
      surface.animate(
        [
          {
            opacity: 0,
            transform: `perspective(1400px) translate3d(${dir * 26}px, 14px, ${-55 * dir}px) scale(${dir > 0 ? 0.968 : 1.028})`,
            filter: "blur(6px)",
          },
          {
            opacity: 1,
            transform: "perspective(1400px) translate3d(0, 0, 0) scale(1)",
            filter: "blur(0px)",
          },
        ],
        {
          duration: 380,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
    } else {
      const bodyEl = surface.querySelector<HTMLElement>("#atlas-surface-body");
      bodyEl?.animate(
        [
          {
            opacity: 0,
            transform: `perspective(1400px) translate3d(${dir * 38}px, 10px, ${-48 * dir}px) scale(${dir > 0 ? 0.975 : 1.022})`,
            filter: "blur(4px)",
          },
          {
            opacity: 1,
            transform: "perspective(1400px) translate3d(0, 0, 0) scale(1)",
            filter: "blur(0px)",
          },
        ],
        {
          duration: 360,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
    }

    surface
      .querySelectorAll<HTMLElement>("[data-stagger]")
      .forEach((el) => {
        const idx = Number(el.dataset.stagger ?? 0);
        el.animate(
          [
            { opacity: 0, translate: `${dir * 14}px 14px` },
            { opacity: 1, translate: "0 0" },
          ],
          {
            duration: 420,
            delay: 40 + idx * 60,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "backwards",
          },
        );
      });

    surface
      .querySelectorAll<HTMLElement>("[data-rule]")
      .forEach((rule, idx) => {
        rule.animate(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          {
            duration: 540,
            delay: 50 + idx * 65,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "backwards",
          },
        );
      });
  }

  if (preserveLibraryInputFocus && activeInputId) {
    const nextInput = document.getElementById(activeInputId) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (nextInput) {
      nextInput.focus({ preventScroll: true });
      if (selStart !== null && selEnd !== null) {
        try {
          nextInput.setSelectionRange(selStart, selEnd);
        } catch {}
      }
    }
  }

  if (atlasView === "reader" && activeReaderAnchor) {
    const targetId = activeReaderAnchor;
    requestAnimationFrame(() => {
      const heading = document.getElementById(targetId);
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function sync3DCameraWith2DView() {
  if (!scene || !ready || mode === "boot") return;
  if (atlasView === "home") {
    scene.setIndexDeskMode(false);
    scene.setReaderMode(false);
    scene.setMode("archive");
  } else if (atlasView === "library") {
    scene.setReaderMode(false);
    if (mode === "detail") {
      setMode("archive");
    } else {
      scene.setMode("archive");
    }
    const entries = filterAndSortLibraryEntries(libraryState, saved);
    const chosen = resolveLibrarySelection(entries, libraryState.selectedId);
    if (chosen) {
      libraryState.selectedId = chosen.id;
      libraryDomainMemory[libraryState.category] = chosen.id;
      libraryDomainMemory[chosen.category] = chosen.id;
    }
    const recIndex =
      chosen && chosen.category !== "inbox"
        ? records.findIndex((r) => r.entryId === chosen.id)
        : -1;
    if (recIndex >= 0) {
      if (recIndex !== selected) {
        selected = recIndex;
        columnMemory[fileLocation(selected).lane] = selected;
        scene.select(selected);
        updateSelection();
      }
      scene.setIndexDeskMode(true, { hasValid3DTarget: true });
    } else {
      if (libraryState.category && libraryState.category !== "all") {
        const lane = portals.findIndex(
          (p) =>
            p.id === libraryState.category || p.title === libraryState.category,
        );
        if (lane >= 0 && columnMemory[lane] !== undefined) {
          const targetIdx = columnMemory[lane];
          if (targetIdx !== selected) {
            selected = targetIdx;
            scene.select(selected, { axis: "lane", direction: 1 });
            updateSelection();
          }
        }
      }
      scene.setIndexDeskMode(true, { hasValid3DTarget: false });
    }
  } else if (atlasView === "reader") {
    void prefetchEntryAssets(activeReaderSlug);
    scene.setIndexDeskMode(false, { immediate: true });
    const isShortSwitch =
      renderedAtlasView === "library" ||
      (renderedAtlasView === "reader" &&
        previousReaderSlug !== "" &&
        previousReaderSlug !== activeReaderSlug);
    previousReaderSlug = activeReaderSlug;
    if (!isShortSwitch) {
      manualReaderRecede = null;
      scene.setReaderReceded(false);
    }
    const entry = knowledgeRepository.bySlug(activeReaderSlug);
    if (entry) {
      const recIndex = records.findIndex((r) => r.entryId === entry.id);
      if (recIndex >= 0 && recIndex !== selected) {
        selected = recIndex;
        columnMemory[fileLocation(selected).lane] = selected;
        scene.select(selected);
        updateSelection();
      }
    }
    scene.setReaderMode(true, { shortSwitch: isShortSwitch });
  } else if (atlasView === "studio") {
    scene.setIndexDeskMode(false);
    scene.setReaderMode(false);
    if (!studioState.isNew && studioState.originalSlug) {
      const entry = knowledgeRepository.bySlug(studioState.originalSlug);
      if (entry) {
        const recIndex = records.findIndex((r) => r.entryId === entry.id);
        if (recIndex >= 0) {
          selected = recIndex;
          columnMemory[fileLocation(selected).lane] = selected;
          scene.select(selected);
          updateSelection();
        }
      }
      scene.setMode("detail");
    } else {
      scene.setMode("archive");
    }
  }
}

function navigateAtlas(hash: string) {
  if (location.hash === hash) {
    syncHashRoute();
  } else {
    location.hash = hash;
  }
}

function syncHashRoute() {
  const parsed = parseHashRoute(location.hash);
  if (!parsed) {
    if (!scene && ready) {
      atlasView = "home";
      if (mode === "boot") setMode("archive");
      renderAtlasSurface();
      return;
    }
    atlasView = "archive";
    previousReaderSlug = "";
    if (ready && mode !== "boot") {
      scene?.setIndexDeskMode(false);
      scene?.setReaderMode(false);
      scene?.setMode(mode === "detail" ? "detail" : "archive");
    }
    renderAtlasSurface();
    return;
  }

  if (ready && mode === "boot") {
    setMode("archive");
  }

  if (parsed.view === "home") {
    atlasView = "home";
    previousReaderSlug = "";
    sync3DCameraWith2DView();
    renderAtlasSurface();
    return;
  }

  if (parsed.view === "library") {
    const comingFrom3D = atlasView === "archive";
    atlasView = "library";
    previousReaderSlug = "";
    if (parsed.category) {
      libraryState.category = parsed.category;
    }
    if (parsed.query !== undefined) {
      libraryState.query = parsed.query;
    }
    libraryState.openRowMenuId = null;
    if (comingFrom3D) {
      const current3DId = records[selected]?.entryId;
      if (current3DId) {
        const visibleEntries = filterAndSortLibraryEntries(libraryState, saved);
        if (visibleEntries.some((e) => e.id === current3DId)) {
          libraryState.selectedId = current3DId;
          libraryState.unfiltered3DNoticeId = null;
        } else {
          libraryState.unfiltered3DNoticeId = current3DId;
        }
      }
    }
    sync3DCameraWith2DView();
    renderAtlasSurface();
    return;
  }

  if (parsed.view === "studio") {
    atlasView = "studio";
    previousReaderSlug = "";
    const targetSlug = parsed.slug || "";
    if (targetSlug && targetSlug !== studioState.originalSlug) {
      void loadStudioEntryFromDisk(targetSlug);
    } else if (!targetSlug && !studioState.isNew) {
      Object.assign(
        studioState,
        createDefaultStudioDraft(parsed.category || "tools"),
      );
      void scheduleStudioLivePreview(true);
    } else if (!studioState.previewHtml) {
      void scheduleStudioLivePreview(true);
    }
    sync3DCameraWith2DView();
    renderAtlasSurface();
    return;
  }

  if (parsed.view === "reader" && parsed.slug) {
    atlasView = "reader";
    activeReaderSlug = parsed.slug;
    activeReaderAnchor = parsed.anchor;
    void prefetchEntryAssets(activeReaderSlug);
    sync3DCameraWith2DView();
    renderAtlasSurface();
    return;
  }

  if (parsed.view === "archive") {
    if (!scene && ready) {
      atlasView = "home";
      renderAtlasSurface();
      return;
    }
    atlasView = "archive";
    previousReaderSlug = "";
    if (parsed.category) {
      const lane = portals.findIndex(
        (p) => p.id === parsed.category || p.title === parsed.category,
      );
      if (lane >= 0) {
        select(columnMemory[lane]);
      }
    }
    scene?.setIndexDeskMode(false);
    scene?.setReaderMode(false);
    scene?.setMode(mode === "detail" ? "detail" : "archive");
    renderAtlasSurface();
  }
}
window.addEventListener("hashchange", () => syncHashRoute());

function applyHotSnapshot(
  snapshot: {
    manifest?: any;
    telemetry?: any;
    searchIndex?: any;
  },
  silent = false,
) {
  if (!snapshot?.manifest) return;
  hotReloadRepositoryData(snapshot.manifest, snapshot.telemetry);
  if (Array.isArray(snapshot.searchIndex)) {
    hotReloadSearchIndex(snapshot.searchIndex);
  }
  refreshArchiveRecords();
  if (selected >= records.length) {
    selected = Math.max(0, records.length - 1);
  }
  archiveColumns.forEach((_, lane) => {
    const files = columnFiles(lane);
    if (files.length > 0 && !files.includes(columnMemory[lane])) {
      columnMemory[lane] = files[0];
    }
  });
  updateSelection();
  if (mode === "detail") {
    renderDetail();
  }
  if (atlasView !== "archive") {
    renderAtlasSurface(true);
  }
  if (!silent) {
    notify("◈ 知识库档案已实时热更新");
  }
}

async function scheduleStudioLivePreview(immediate = false) {
  clearTimeout(studioPreviewTimer);
  const runPreview = async () => {
    try {
      const res = await fetch("/__atlas_api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: studioState.body }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      studioState.previewHtml = hydrateEntryHtmlImages(data.html || "");
      studioState.previewQuickstartHtml = hydrateEntryHtmlImages(
        data.quickstartHtml || "",
      );
      const bodyContainer = document.querySelector<HTMLElement>(
        "#studio-preview-body",
      );
      if (bodyContainer) {
        bodyContainer.innerHTML =
          studioState.previewHtml ||
          '<p class="studio-preview-placeholder">暂无正文内容</p>';
      }
      const qsBox = document.querySelector<HTMLElement>(
        "#studio-preview-quickstart",
      );
      const qsBody = document.querySelector<HTMLElement>(
        "#studio-preview-quickstart-body",
      );
      if (qsBox && qsBody) {
        qsBox.hidden = !studioState.previewQuickstartHtml;
        qsBody.innerHTML = studioState.previewQuickstartHtml;
      }
    } catch {
      // Fallback client-side minimal preview when running in static mode
      studioState.localDiskAvailable = false;
      const bodyContainer = document.querySelector<HTMLElement>(
        "#studio-preview-body",
      );
      if (bodyContainer) {
        bodyContainer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(studioState.body)}</pre>`;
      }
    }
  };
  if (immediate) {
    await runPreview();
  } else {
    studioPreviewTimer = setTimeout(() => void runPreview(), 140);
  }
}

async function loadStudioEntryFromDisk(slugOrId: string) {
  const clean = slugOrId.replace(/^\/+|\/+$/g, "");
  const fallbackEntry =
    knowledgeRepository.bySlug(clean) ?? knowledgeRepository.byId(clean);

  try {
    const res = await fetch(
      `/__atlas_api/entry?slug=${encodeURIComponent(clean)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.exists) {
        const fm = data.frontMatter || {};
        const entry = data.entry || fallbackEntry;
        const resolvedSlug = String(fm.slug || entry?.slug || clean);
        const slugParts = resolvedSlug.split("/");
        studioState.originalSlug = resolvedSlug;
        studioState.isNew = false;
        studioState.title = String(fm.title || entry?.title || "");
        studioState.category = String(
          fm.category || entry?.category || slugParts[0] || "tools",
        );
        studioState.fileSlug =
          slugParts.slice(1).join("/") || resolvedSlug;
        studioState.subcategory = String(
          fm.subcategory || entry?.subcategory || "general",
        );
        studioState.type = (fm.type || entry?.type || "skill") as EntryType;
        studioState.status = (fm.status ||
          entry?.status ||
          "learning") as EntryStatus;
        studioState.tags = Array.isArray(fm.tags)
          ? fm.tags.join(", ")
          : Array.isArray(entry?.tags)
            ? entry.tags.join(", ")
            : "";
        studioState.summary = String(fm.summary || entry?.summary || "");
        studioState.version_scope = String(
          fm.version_scope || entry?.version_scope || "通用版本",
        );
        studioState.source_urls = Array.isArray(fm.source_urls)
          ? fm.source_urls.join(", ")
          : "";
        studioState.created = String(
          fm.created ||
            entry?.created ||
            new Date().toISOString().slice(0, 10),
        );
        studioState.body = String(data.body || "")
          .replace(/^#\s+.+\n+/, "")
          .trim();
        studioState.localDiskAvailable = true;
        await scheduleStudioLivePreview(true);
        sync3DCameraWith2DView();
        renderAtlasSurface();
        return;
      }
    }
  } catch {
    studioState.localDiskAvailable = false;
  }

  if (fallbackEntry) {
    studioState.originalSlug = fallbackEntry.slug;
    studioState.isNew = false;
    studioState.title = fallbackEntry.title;
    studioState.category = fallbackEntry.category;
    studioState.fileSlug =
      fallbackEntry.slug.split("/").slice(1).join("/") || fallbackEntry.id;
    studioState.subcategory = fallbackEntry.subcategory;
    studioState.type = fallbackEntry.type;
    studioState.status = fallbackEntry.status;
    studioState.tags = fallbackEntry.tags.join(", ");
    studioState.summary = fallbackEntry.summary;
    studioState.version_scope = fallbackEntry.version_scope;
    studioState.source_urls = fallbackEntry.source_urls.join(", ");
    studioState.created = fallbackEntry.created;
    studioState.body = fallbackEntry.plainText;
    studioState.previewHtml = hydrateEntryHtmlImages(fallbackEntry.html);
    studioState.previewQuickstartHtml = hydrateEntryHtmlImages(
      fallbackEntry.quickstartHtml,
    );
    sync3DCameraWith2DView();
    renderAtlasSurface();
  }
}

function syncStudioCardPreviewDom() {
  const titleEl = document.querySelector<HTMLElement>("#studio-preview-title");
  if (titleEl) {
    titleEl.textContent = studioState.title.trim() || "未命名知识档案";
  }
  const summaryEl = document.querySelector<HTMLElement>(
    "#studio-preview-summary",
  );
  if (summaryEl) {
    summaryEl.textContent =
      studioState.summary.trim() ||
      "在左侧填写一句话摘要后，将在此处及 3D 详情面板『01 // 概述与摘要』中同步展示。";
  }
  const tagsEl = document.querySelector<HTMLElement>("#studio-preview-tags");
  if (tagsEl) {
    const tags = studioState.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    tagsEl.innerHTML =
      tags.length > 0
        ? tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")
        : `<span>#${escapeHtml(studioState.category)}</span>`;
  }
  const pathEl = document.querySelector<HTMLElement>("#studio-target-path");
  if (pathEl) {
    const stem =
      studioState.fileSlug.trim() ||
      studioState.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      "new-specimen";
    pathEl.textContent = `content/${studioState.category}/${stem}.md`;
  }
}

async function saveStudioDraftToDisk() {
  if (studioState.saving) return;
  const title = studioState.title.trim();
  if (!title) {
    notify("请先填写档案中文标题（SPECIMEN TITLE）");
    document.querySelector<HTMLInputElement>("#studio-input-title")?.focus();
    return;
  }

  studioState.saving = true;
  renderAtlasSurface(true);

  try {
    const res = await fetch("/__atlas_api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalSlug: studioState.isNew ? "" : studioState.originalSlug,
        title,
        category: studioState.category,
        fileSlug: studioState.fileSlug.trim(),
        subcategory: studioState.subcategory,
        type: studioState.type,
        status: studioState.status,
        tags: studioState.tags,
        summary: studioState.summary.trim(),
        version_scope: studioState.version_scope.trim(),
        source_urls: studioState.source_urls,
        created: studioState.created,
        body: studioState.body,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "保存失败");
    }

    studioState.saving = false;
    studioState.isNew = false;
    studioState.originalSlug = data.slug;
    studioState.fileSlug = String(data.slug).split("/").slice(1).join("/");
    studioState.lastSavedAt = new Date().toLocaleTimeString("en-GB");

    if (data.snapshot) {
      applyHotSnapshot(data.snapshot, true);
    }

    const nextHash = buildStudioHash(data.slug);
    if (location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
    sync3DCameraWith2DView();
    renderAtlasSurface(true);
    audio.play("confirm");
    notify(`✓ 已写入本地磁盘：${data.relPath}`);
  } catch (err) {
    studioState.saving = false;
    renderAtlasSurface(true);
    notify(
      `保存失败：${err instanceof Error ? err.message : "请确认使用本地 npm run dev 启动"}`,
    );
  }
}

async function deleteStudioEntryFromDisk() {
  if (studioState.isNew || !studioState.originalSlug) return;
  const confirmed = window.confirm(
    `确定要从本地 content/ 目录永久删除档案「${studioState.title || studioState.originalSlug}」吗？`,
  );
  if (!confirmed) return;

  try {
    const res = await fetch("/__atlas_api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: studioState.originalSlug }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "删除失败");
    }
    if (data.snapshot) {
      applyHotSnapshot(data.snapshot, true);
    }
    Object.assign(studioState, createDefaultStudioDraft("tools"));
    await scheduleStudioLivePreview(true);
    history.replaceState(null, "", "#/studio");
    renderAtlasSurface();
    audio.play("back");
    notify("档案已从本地知识库中删除");
  } catch (err) {
    notify(`删除失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

async function parseAiMarkdownIntoStudio() {
  const rawInput = document.querySelector<HTMLTextAreaElement>(
    "#studio-ai-raw-input",
  );
  const rawVal = rawInput?.value.trim() || "";
  if (!rawVal) {
    notify("请先在输入框中粘贴 AI 生成的 Markdown 文本");
    rawInput?.focus();
    return;
  }

  // Strip outer ```markdown ... ``` wrapper if the user copied the outer fence too
  const unwrapped = rawVal
    .replace(/^```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n```\s*$/, "");

  try {
    const res = await fetch("/__atlas_api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawMarkdown: unwrapped }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error("解析失败");

    const fm = data.frontMatter || {};
    const bodyText = String(data.body || "");
    const h1Match = bodyText.match(/^#\s+(.+)$/m);
    const inferredTitle = h1Match ? h1Match[1].trim() : "";

    if (fm.title || inferredTitle) {
      studioState.title = String(fm.title || inferredTitle).trim();
    }
    if (fm.category) {
      studioState.category = String(fm.category).trim();
    }
    if (fm.slug) {
      const parts = String(fm.slug).trim().split("/");
      if (parts.length >= 2) {
        studioState.category = parts[0];
        studioState.fileSlug = parts.slice(1).join("/");
      } else {
        studioState.fileSlug = parts[0];
      }
    }
    if (fm.subcategory) {
      studioState.subcategory = String(fm.subcategory).trim();
    }
    if (fm.type) {
      studioState.type = String(fm.type).trim() as EntryType;
    }
    if (fm.status) {
      studioState.status = String(fm.status).trim() as EntryStatus;
    }
    if (Array.isArray(fm.tags)) {
      studioState.tags = fm.tags.join(", ");
    }
    if (fm.summary) {
      studioState.summary = String(fm.summary).trim();
    }
    if (fm.version_scope) {
      studioState.version_scope = String(fm.version_scope).trim();
    }
    if (Array.isArray(fm.source_urls)) {
      studioState.source_urls = fm.source_urls.join(", ");
    }

    studioState.body = bodyText.replace(/^#\s+.+\n+/, "").trim();
    studioState.previewHtml = hydrateEntryHtmlImages(data.html || "");
    studioState.previewQuickstartHtml = hydrateEntryHtmlImages(
      data.quickstartHtml || "",
    );
    studioState.aiPasteOpen = false;
    renderAtlasSurface();
    audio.play("confirm");
    notify("⚡ AI 笔记已自动拆解填入！检查无误后点击 SAVE TO DISK 即可归档");
  } catch (err) {
    notify(`解析失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

function insertStudioSnippet(kind: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "#studio-input-body",
  );
  if (!textarea) return;
  const snippets: Record<string, string> = {
    quickstart: `\n## 快速复习\n\n- **核心结论**：一句话总结最关键的操作或判断标准。\n\n~~~powershell\n# 核心可执行命令\n~~~\n`,
    code: `\n~~~powershell\n# 在此输入命令或代码\n~~~\n`,
    tip: `\n> [!TIP]\n> 在此记录实用技巧或快捷操作建议。\n`,
    warning: `\n> [!WARNING]\n> 在此记录常见报错原因与避坑注意事项。\n`,
    checklist: `\n## 验证清单\n\n- [x] 验证步骤一\n- [ ] 验证步骤二\n`,
    math: `\n$$\n\\text{Rate} = \\frac{V_{\\max} [S]}{K_m + [S]}\n$$\n`,
    table: `\n| 参数 / 选项 | 作用说明 | 推荐值 |\n|---|---|---|\n| \`--flag\` | 示例参数说明 | 默认开启 |\n`,
  };
  const snippet = snippets[kind];
  if (!snippet) return;

  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value =
    textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
  studioState.body = textarea.value;
  textarea.focus();
  const nextCursor = start + snippet.length;
  textarea.setSelectionRange(nextCursor, nextCursor);
  void scheduleStudioLivePreview();
  audio.play("ui-tick");
}

async function uploadStudioImageFile(file: File) {
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch("/__atlas_api/upload-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: studioState.category,
        fileName: file.name || "screenshot.png",
        base64Data,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "上传失败");

    const mdImage = `\n![${file.name.replace(/\.[^.]+$/, "") || "截图说明"}](${data.markdownPath})\n`;
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "#studio-input-body",
    );
    if (textarea) {
      const pos = textarea.selectionStart ?? textarea.value.length;
      textarea.value =
        textarea.value.slice(0, pos) + mdImage + textarea.value.slice(pos);
      studioState.body = textarea.value;
    } else {
      studioState.body += mdImage;
    }
    void scheduleStudioLivePreview(true);
    audio.play("confirm");
    notify(`图片已存入 content/${studioState.category}/assets/${data.fileName}`);
  } catch (err) {
    notify(`图片上传失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

function setMode(next: Mode) {
  if (workbench?.enabled && next === "detail") next = "archive";
  const previousMode = mode;
  rollingTitles.forEach((title) =>
    title.update({
      animated: motionActive("rollingText") && next === "archive",
    }),
  );
  if (next !== "archive") {
    rollingTitles.forEach((title) => title.finish());
    hoverCode.finish();
    $("#hover-label").hidden = true;
  }
  if (next === "detail" && mode !== "detail") recordAccess();
  mode = next;
  syncWallpaperBackground();
  audio.setScene(next);
  if (next !== "boot" && audioPreview) {
    audioPreview = false;
    audioPreviewRequest++;
    configureAudio();
  }
  $("#stage").dataset.mode = next;
  workbench?.syncVisibility();
  if (previousMode !== next) fit();
  $("#boot").inert = next !== "boot";
  $("#boot").setAttribute("aria-hidden", String(next !== "boot"));
  $("#archive-ui").inert =
    next !== "archive" || Boolean(modal) || Boolean(workbench?.enabled);
  $("#archive-ui").setAttribute(
    "aria-hidden",
    String(next !== "archive" || Boolean(workbench?.enabled)),
  );
  $(".system-nav").inert = next === "boot" || Boolean(modal);
  $(".system-footer").inert = next === "boot" || Boolean(modal);
  if (next === "detail") {
    if (previousMode !== "detail")
      detailTransition.show(!motionActive("surfaceTransitions"));
  } else if (
    previousMode === "detail" ||
    (next === "boot" && !$("#detail-ui").hidden)
  ) {
    pendingDetailFocus = false;
    tabTransition.cancel();
    detailTransition.hide(
      !motionActive("surfaceTransitions") || next === "boot",
    );
    if (!modal && next === "archive")
      $(".read-file").focus({ preventScroll: true });
  }
  $("#detail-ui").inert = next !== "detail" || Boolean(modal);
  scene?.setMode(next === "boot" ? "hidden" : next);
  if (next !== "boot") {
    bootSequence.reset();
    $(".file-title").firstChild!.textContent = "FILE NUMBER: ";
    $("#stage").dataset.boot = "done";
  }
  if (next === "detail" && previousMode !== "detail") {
    renderDetail();
    pendingDetailFocus = true;
    if (!scene) {
      $("#detail-content").style.opacity = "1";
      $("#detail-content").style.translate = "0 0";
      $("#detail-content").inert = false;
    }
  }
  renderAtlasSurface();
}
function select(index: number, navigation?: ArchiveNavigation) {
  selected = (index + records.length) % records.length;
  columnMemory[fileLocation(selected).lane] = selected;
  if (mode === "detail") setMode("archive");
  activeTab = "overview";
  scene?.select(selected, navigation);
  updateSelection(navigation);
  const columnMove =
    navigation && "axis" in navigation && navigation.axis === "lane";
  audio.play(
    columnMove ? "column" : "tick",
    columnMove ? navigation.direction * 0.45 : 0,
  );
}
function stepFile(direction: number) {
  const files = columnFiles(fileLocation(selected).lane);
  if (files.length < 2) return;
  select(
    files[(files.indexOf(selected) + direction + files.length) % files.length],
    { axis: "row", direction },
  );
}
function stepColumn(direction: number) {
  const lane = fileLocation(selected).lane;
  const next = wrap(lane + direction, archiveColumns.length);
  select(columnMemory[next], { axis: "lane", direction });
}
function updateSelection(navigation?: ArchiveNavigation) {
  const r = records[selected];
  const { lane } = fileLocation(selected);
  const files = columnFiles(lane);
  selectionTitle.update({
    text: r.title,
    animated: motionActive("rollingText") && mode === "archive",
  });
  clearanceTitle.update({
    text: `${r.visualCode} · ${statusMeta(r.status).label}`,
    animated: motionActive("rollingText") && mode === "archive",
  });
  categoryTitle.update({
    text: r.category,
    animated: motionActive("rollingText") && mode === "archive",
  });
  const direction =
    navigation && "axis" in navigation
      ? navigation.direction > 0
        ? "up"
        : "down"
      : "auto";
  selectedCode.update({
    value: Number(r.id.slice(2)),
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction,
  });
  fileCounter.update({
    value: Math.max(1, files.indexOf(selected) + 1),
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "row"
        ? direction
        : "auto",
  });
  $(".count-total").textContent = String(files.length).padStart(2, "0");
  columnCounter.update({
    value: lane + 1,
    animated: motionActive("rollingNumbers") && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "lane"
        ? direction
        : "auto",
  });
  columnTitle.update({
    text: archiveColumns[lane],
    animated: motionActive("rollingText") && mode === "archive",
  });
  $<HTMLButtonElement>('[data-action="column-prev"]').disabled = false;
  $<HTMLButtonElement>('[data-action="column-next"]').disabled = false;
  const visibleFiles =
    files.length <= fileTicks.length
      ? files
      : files.slice(0, fileTicks.length);
  fileTicks.forEach((button, slot) => {
    const index = visibleFiles[slot];
    if (index === undefined) {
      button.hidden = true;
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
      delete button.dataset.status;
      return;
    }
    const record = records[index];
    button.hidden = false;
    button.dataset.select = String(index);
    button.dataset.status = record.status;
    button.setAttribute(
      "aria-label",
      `选择档案 ${record.id} ${record.title}`,
    );
    button.title = `${record.visualCode} (${record.id}) · ${record.title} [${statusMeta(record.status).label}]`;
    button.classList.toggle("selected", index === selected);
    button.setAttribute("aria-pressed", String(index === selected));
  });
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
}
function replayBoot(forcePreview = false) {
  if (!ready) return;
  closeModal(() => replayBootAfterModal(forcePreview));
}
function replayBootAfterModal(forcePreview: boolean) {
  atlasView = "archive";
  if (location.hash && location.hash !== "#/archive") {
    history.replaceState(null, "", location.pathname + location.search);
  }
  bootStart = performance.now() / 1000 - 1.76;
  frozenTime = null;
  lastStep = "";
  setMode(!motionActive("boot") && !forcePreview ? "archive" : "boot");
  audio.restartBoot();
  scene?.select(0);
  selected = 0;
  updateSelection();
  if (!forcePreview) audio.play("ui-tick");
}
function openFile() {
  if (!ready) return;
  closeModal(() => {
    atlasView = "archive";
    setMode("detail");
    audio.play("open");
  });
}
function toggleSavedById(targetId?: string) {
  const entry = targetId
    ? (knowledgeRepository.byId(targetId) ?? knowledgeRepository.bySlug(targetId))
    : undefined;
  const primaryId = entry ? entry.globalCode : records[selected].id;
  const altId = entry ? entry.id : records[selected].entryId;
  const wasSaved = saved.has(primaryId) || saved.has(altId);
  if (wasSaved) {
    saved.delete(primaryId);
    saved.delete(altId);
  } else {
    saved.add(primaryId);
  }
  try {
    localStorage.setItem("rhine-saved", JSON.stringify([...saved]));
  } catch {}
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  const button = document.querySelector<HTMLButtonElement>(
    '[data-action="bookmark"]',
  );
  const currentRecord = records[selected];
  const currentSaved =
    saved.has(currentRecord.id) || saved.has(currentRecord.entryId);
  if (button) {
    button.firstChild!.textContent = currentSaved ? "− SAVED" : "＋ SAVE";
    button.querySelector("span")!.textContent = currentSaved
      ? "已收藏"
      : "收藏档案";
    button.setAttribute("aria-pressed", String(currentSaved));
    bookmarkFeedback?.cancel();
    if (motionActive("surfaceTransitions"))
      bookmarkFeedback = button.animate(
        [{ backgroundColor: "#67634c" }, { backgroundColor: "#252820" }],
        { duration: 220, easing: "ease-out" },
      );
  }
  if (atlasView !== "archive") {
    renderAtlasSurface(true);
  }
  audio.play("confirm");
  notify(!wasSaved ? "档案已加入收藏" : "已取消收藏");
}
function toggleSaved() {
  toggleSavedById();
}
function renderDetail() {
  tabTransition.cancel();
  const r = records[selected];
  const sMeta = statusMeta(r.status);
  const tMeta = typeMeta(r.type);
  const isSaved = isEntrySaved(r.id);
  $("#object-id").textContent =
    r.visualCode || "NO." + String(selected + 1).padStart(3, "0");
  $("#detail-content").innerHTML = `
  <div class="detail-kicker"><span>FILE ${r.id} · ${escapeHtml(r.visualCode)}</span><span>${escapeHtml(r.clearance)}</span></div>
  <h2>${escapeHtml(r.en)}</h2><div class="detail-title-cn"><b>${escapeHtml(r.title)}</b><span>${escapeHtml(r.category)}</span></div>
  <div class="detail-rule"></div>
  <dl class="metadata"><div><dt>DEPARTMENT / 所属领域</dt><dd>${escapeHtml(r.department)}</dd></div><div><dt>COLLECTION / 适用与更新</dt><dd>${escapeHtml(r.date)}</dd></div><div><dt>TYPE / 词条类型</dt><dd>${escapeHtml(tMeta.label)} · ${escapeHtml(r.lead)}</dd></div><div><dt>STATUS / 掌握状态</dt><dd><i data-status="${escapeHtml(r.status)}"></i>${escapeHtml(sMeta.label)} · ${escapeHtml(sMeta.en)}</dd></div></dl>
  <div class="detail-tabs" role="tablist"><button id="tab-overview" class="active" role="tab" aria-controls="tab-panel" aria-selected="true" data-tab="overview">01 <span>概述与摘要</span></button><button id="tab-notes" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="notes">02 <span>核心要点</span></button><button id="tab-history" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="history">03 <span>归档溯源</span></button><i class="tab-indicator" aria-hidden="true"></i></div>
  <div id="tab-panel" class="tab-panel" role="tabpanel">${overview()}</div>
  <div class="detail-actions"><button class="solid-button" data-action="open-reader" data-entry-slug="${escapeHtml(r.slug)}">READ ARTICLE ↗<span>展开全文</span></button><button class="solid-button secondary-solid" data-action="edit-studio" data-entry-slug="${escapeHtml(r.slug)}">EDIT FILE ✎<span>编辑档案</span></button><button class="solid-button secondary-solid" data-action="bookmark">${isSaved ? "− SAVED" : "＋ SAVE"}<span>${isSaved ? "已收藏" : "收藏档案"}</span></button><a class="export-button" href="${assetUrl(`archives/ATLAS-${r.entryId}.txt`)}" download="ATLAS-${r.entryId}.txt" aria-label="导出 ${r.id} 档案">EXPORT <span>↓</span></a></div>
  <div class="detail-footnote"><a href="${escapeHtml(buildEntryHash(r.slug))}">OPEN IN 2D READER (${r.readingMinutes} MIN) ↗</a><span>${String(selected + 1).padStart(3, "0")} / ${String(records.length).padStart(3, "0")}</span></div>`;
  $("#detail-content").setAttribute("tabindex", "-1");
  $('[data-action="bookmark"]').setAttribute(
    "aria-pressed",
    String(isSaved),
  );
  documentDecryption.reset(
    $("#detail-content"),
    !motionActive("documentReveal") ||
      !scene ||
      scene.decryptionFrame.phase === "clear",
  );
  setTab(activeTab, false);
}
function overview() {
  const r = records[selected];
  const tagsHtml = r.tags.length
    ? `<div class="detail-inline-tags">${r.tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  return `<div class="panel-label">ABSTRACT / 档案摘要</div><p>${escapeHtml(r.abstract)}</p>${tagsHtml}`;
}
function setTab(tab: string, sound = true) {
  if (sound && tab === activeTab) return;
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const active = (b as HTMLElement).dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.setAttribute("tabindex", active ? "0" : "-1");
  });
  const r = records[selected];
  const tabButton = $<HTMLButtonElement>(`[data-tab="${tab}"]`);
  const indicator = $(".tab-indicator");
  indicator.style.transition =
    sound && motionActive("surfaceTransitions") ? "" : "none";
  indicator.style.transform = `translateX(${tabButton.offsetLeft}px) scaleX(${tabButton.offsetWidth})`;
  $("#tab-panel").setAttribute("aria-labelledby", tabButton.id);
  $("#tab-panel").innerHTML =
    tab === "overview"
      ? overview()
      : tab === "notes"
        ? `<div class="panel-label">RESEARCH NOTES / 研究记录</div><ol class="research-notes">${r.findings.map((f, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${escapeHtml(f)}</li>`).join("")}</ol>`
        : `<div class="panel-label">ACCESS LOG / 本次访问</div>${accessLog
            .filter((entry) => entry.id === r.id)
            .slice(0, 4)
            .map(
              (entry) =>
                `<div class="log-row"><span>${entry.time}</span><span>ATLAS USER</span><b>READ AUTHORIZED</b></div>`,
            )
            .join(
              "",
            )}<p class="log-note">源文件：${escapeHtml(r.relPath)} · 标签：${escapeHtml(r.tags.join(" / "))}</p>`;
  $("#tab-panel").scrollTop = 0;
  documentDecryption.refresh();
  if (sound) {
    tabTransition.reveal($("#tab-panel"), !motionActive("surfaceTransitions"));
    audio.play("ui-tick");
  }
}
function notify(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}

function openModal(kind: NonNullable<typeof modal>) {
  if (!ready) return;
  if (!modal) {
    previousFocus = document.activeElement as HTMLElement;
    modalSiblings = [...$("#stage").children]
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.id !== "modal-root",
      )
      .map((node) => ({ node, inert: node.inert }));
    modalSiblings.forEach(({ node }) => (node.inert = true));
    $("#atlas-surface").inert = true;
  }
  modalClosing = false;
  modal = kind;
  searchQuery = "";
  filter = "全部档案";
  audio.play("page-open");
  renderModal();
}
function closeModal(afterClose?: () => void) {
  if (!modal) {
    afterClose?.();
    return;
  }
  if (modalClosing) return;
  modalClosing = true;
  audio.play("page-close");
  modalTransition!.hide(!motionActive("surfaceTransitions"), () => {
    modal = null;
    modalClosing = false;
    $("#modal-root").replaceChildren();
    modalTransition = undefined;
    modalSiblings.forEach(({ node, inert }) => (node.inert = inert));
    modalSiblings = [];
    $("#archive-ui").inert = mode !== "archive" || Boolean(workbench?.enabled);
    $("#detail-ui").inert = mode !== "detail";
    $("#atlas-surface").inert = $("#atlas-surface").hidden;
    previousFocus?.focus({ preventScroll: true });
    afterClose?.();
  });
}
function renderModal() {
  if (!modal) return;
  modalTransition?.dispose();
  const filterCategories = [...categories, "闪念草稿箱"];
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="terminal-modal ${modal === "settings" ? "settings-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "settings" ? "系统设置" : modal === "saved" ? "收藏档案" : "档案检索"}"><div class="modal-top"><span>ATLAS // ${modal === "settings" ? "SYSTEM PREFERENCES" : "KNOWLEDGE DIRECTORY"}</span><button data-action="close-modal" aria-label="关闭窗口">CLOSE <span>×</span></button></div>${modal === "settings" ? settingsMarkup() : `<h2>${modal === "saved" ? "SAVED ARCHIVES" : "ARCHIVE INDEX"}<small>${modal === "saved" ? "收藏档案" : "全文与命令加权检索"}</small></h2><div class="search-field"><span>⌕</span><input id="archive-search" type="search" autocomplete="off" placeholder="输入标题、编号 (X-001 / T-001)、标签或正文命令…" aria-label="检索档案"/><span class="key">ESC</span></div><div class="category-filters">${filterCategories.map((c, i) => `<button data-filter="${escapeHtml(c)}" class="${i === 0 ? "active" : ""}">${escapeHtml(c)}</button>`).join("")}</div><div class="result-header"><span>FILE / 档案与摘要</span><span>PORTAL / 领域</span><span>ACCESS</span></div><div id="search-results" class="search-results"></div><div class="modal-bottom"><span id="result-count"></span><span>ATLAS KNOWLEDGE BASE <i>●</i> ${records.length} ARCHIVED</span></div>`}</section></div>`;
  const backdrop = $(".modal-backdrop");
  backdrop.hidden = true;
  modalTransition = new SurfaceTransition(backdrop, $(".terminal-modal"));
  modalTransition.show(!motionActive("surfaceTransitions"));
  if (modal === "settings") updateQualitySummary();
  if (modal !== "settings") {
    renderResults();
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $("#archive-search").focus();
    });
  } else
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing)
        $('[data-action="close-modal"]').focus();
    });
  $("#modal-root")
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
}
function renderResults() {
  const catFilter = filter === "闪念草稿箱" ? "inbox" : filter;
  const rawResults = searchKnowledge(searchQuery, {
    category: catFilter,
    includeDrafts: true,
  });
  const filtered = rawResults.filter(({ item }) => {
    if (modal === "saved") {
      return isEntrySaved(item.id) || (item.globalCode ? isEntrySaved(item.globalCode) : false);
    }
    return true;
  });

  $("#search-results").innerHTML = filtered.length
    ? filtered
        .map(({ item, snippet }) => {
          const recIdx = records.findIndex((r) => r.entryId === item.id);
          const displayId = item.globalCode ?? item.visualCode;
          const isSaved = isEntrySaved(item.id);
          const sMeta = statusMeta(item.status);
          return `<button class="result-row" data-result="${recIdx >= 0 ? recIdx : 0}" data-result-slug="${escapeHtml(item.slug)}" data-result-in-3d="${recIdx >= 0}"><span class="result-name"><b>${escapeHtml(displayId)}</b><span>${escapeHtml(item.title)}<small>${escapeHtml(item.visualCode)} · ${escapeHtml(sMeta.label)} · ${escapeHtml(snippet)}</small></span>${isSaved ? "<i>＋</i>" : ""}</span><span>${escapeHtml(item.categoryTitle)}</span><span>${atlasView === "archive" && recIdx >= 0 ? "3D / 2D" : "READ 2D"} <i>↗</i></span></button>`;
        })
        .join("")
    : `<div class="empty-results"><span>∅</span><strong>${modal === "saved" && !searchQuery ? "尚无收藏档案" : "没有匹配的档案"}</strong><p>${modal === "saved" && !searchQuery ? "读取档案时，选择 SAVE ARCHIVE 或 ☆ 收藏 将其保存在此处。" : "尝试其他名称、档案编号，或切换知识领域分类。"}</p><button data-action="reset-search">${modal === "saved" ? "查看全部档案 →" : "重置检索 →"}</button></div>`;
  $("#result-count").textContent =
    `${String(filtered.length).padStart(2, "0")} RECORDS FOUND`;
}
function updateQualitySummary() {
  const summary = document.querySelector("#quality-summary");
  if (!summary) return;
  if (!scene) {
    summary.textContent = "3D 已关闭 · 三维模型与渲染资源已释放";
    return;
  }
  const canvas = scene.renderer.domElement;
  const metrics = JSON.parse(
    canvas.parentElement?.dataset.renderQuality ?? "{}",
  );
  summary.textContent = `${superPerformanceEnabled() ? "超级性能模式已启用 · 画质设置暂被覆盖，关闭后恢复 · " : ""}实际渲染 ${canvas.width} × ${canvas.height} · ${effectiveRenderQuality().antialias === "smaa" ? "SMAA" : "原始抗锯齿"} · 纹理 ${metrics.anisotropy ?? 1}×${metrics.limited ? " · 已达到缓冲上限" : ""}`;
}
function motionPreferenceNoteMarkup() {
  const preset = prefs.motionPreset;
  const allEnabled = Object.values(prefs.motion).every(Boolean);
  return `<div id="motion-preference-note" class="motion-preference-note"><p>${motionSummary(prefs.motion)}</p><span>预设：${preset === "full" ? "完整动画" : preset === "reduced" ? "减少动画" : "自定义"} · 选择会保存在本站</span>${allEnabled ? "" : '<button data-action="enable-motion">启用完整动画并重播 ↻</button>'}</div>`;
}
function settingsMarkup() {
  return `<h2>SYSTEM SETTINGS<small>终端偏好设置</small></h2><p class="settings-intro">ATLAS USER <span>·</span> SESSION AUTHORIZED</p>${isWallpaper ? '<p class="wallpaper-settings-note">每次启动都会读取 Wallpaper Engine 中的设置。在此修改仅对当前运行生效，无法持久保存；如需保留，请在 Wallpaper Engine 的壁纸属性中调整。</p>' : ""}<div class="settings-list">${themeSettingsMarkup(prefs.colorTheme === "dark")}${!isWallpaper ? `<label><div><strong>SUPER PERFORMANCE</strong><span>降低三维画质和渲染分辨率，保留完整动效；关闭后恢复原画质</span></div><input type="checkbox" data-pref="superPerformance" ${prefs.superPerformance ? "checked" : ""}/><i class="toggle"></i></label>` : ""}${workbench?.settingsMarkup() ?? ""}${audioSettingsMarkup(prefs)}</div>${motionPreferenceNoteMarkup()}${motionSettingsMarkup(prefs.motion, prefs.motionPreset)}${qualityMarkup(prefs.rendering)}${pwaSettingsMarkup()}<div class="settings-shortcuts">${isWallpaper ? "<span>DESKTOP CONTROLS</span><p>拖动阵列或点击界面按钮浏览档案。桌面模式下，方向键与滚轮可能无法传入壁纸。</p>" : "<span>KEYBOARD CONTROLS</span><p><kbd>←</kbd><kbd>→</kbd> 切列 <kbd>↑</kbd><kbd>↓</kbd> 选档 <kbd>ENTER</kbd> 读取 <kbd>/</kbd> 检索 <kbd>H</kbd> 遥测 <kbd>L</kbd> 二维索引 <kbd>ESC</kbd> 返回</p>"}</div><div class="settings-bottom">${!isWallpaper && document.fullscreenEnabled ? '<button data-action="fullscreen">FULLSCREEN <span>↗</span></button>' : ""}<button data-action="restart">REINITIALIZE SYSTEM <span>↻</span></button></div><div class="modal-bottom"><span>ATLAS / 1.0 · 使用 MiSans 字体（小米） <a href="${assetUrl("fonts/MiSans-license.pdf")}" target="_blank" rel="noopener">字体许可</a></span><span>POWERED BY RHINE LAB</span></div>`;
}

document.addEventListener("input", (e) => {
  const slider = e.target as HTMLInputElement;
  if (slider.dataset.quality) {
    const output = document.querySelector<HTMLOutputElement>(
      `[data-quality-output="${slider.dataset.quality}"]`,
    );
    if (output) output.value = `${slider.value}%`;
  }
  const volume = e.target as HTMLInputElement;
  if (
    volume.dataset.volume === "musicVolume" ||
    volume.dataset.volume === "soundVolume"
  ) {
    prefs[volume.dataset.volume] = Number(volume.value) / 100;
    volume
      .closest("label")
      ?.querySelector("output")
      ?.replaceChildren(`${volume.value}%`);
    saveAudioPrefs();
  }
  if ((e.target as HTMLElement).id === "archive-search") {
    searchQuery = (e.target as HTMLInputElement).value;
    renderResults();
  }
  if ((e.target as HTMLElement).id === "atlas-library-search") {
    libraryState.query = (e.target as HTMLInputElement).value;
    sync3DCameraWith2DView();
    renderAtlasSurface(true);
  }
  const targetId = (e.target as HTMLElement).id;
  if (targetId === "studio-input-title") {
    studioState.title = (e.target as HTMLInputElement).value;
    syncStudioCardPreviewDom();
  } else if (targetId === "studio-input-slug") {
    studioState.fileSlug = (e.target as HTMLInputElement).value;
    syncStudioCardPreviewDom();
  } else if (targetId === "studio-input-summary") {
    studioState.summary = (e.target as HTMLInputElement).value;
    syncStudioCardPreviewDom();
  } else if (targetId === "studio-input-tags") {
    studioState.tags = (e.target as HTMLInputElement).value;
    syncStudioCardPreviewDom();
  } else if (targetId === "studio-input-version") {
    studioState.version_scope = (e.target as HTMLInputElement).value;
  } else if (targetId === "studio-input-body") {
    studioState.body = (e.target as HTMLTextAreaElement).value;
    void scheduleStudioLivePreview(false);
  }
});
document.addEventListener("paste", (e) => {
  if (
    atlasView !== "studio" ||
    (e.target as HTMLElement)?.id !== "studio-input-body"
  ) {
    return;
  }
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        void uploadStudioImageFile(file);
        return;
      }
    }
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === "studio-image-input" && el instanceof HTMLInputElement) {
    const file = el.files?.[0];
    if (file) {
      void uploadStudioImageFile(file);
      el.value = "";
    }
    return;
  }
  if (el.id === "atlas-library-type") {
    libraryState.type = el.value as EntryType | "all";
    renderAtlasSurface();
    return;
  }
  if (el.id === "atlas-library-status") {
    libraryState.status = el.value as EntryStatus | "all";
    renderAtlasSurface();
    return;
  }
  if (el.id === "atlas-library-sort") {
    libraryState.sortBy = el.value as "updated" | "title" | "status";
    renderAtlasSurface();
    return;
  }
  if (el.id === "quality-preset" && Object.hasOwn(qualityPresets, el.value)) {
    prefs.rendering = { ...qualityPresets[el.value as QualityPreset] };
    savePrefs();
  } else if (el.dataset.quality) {
    const key = el.dataset.quality as keyof RenderQuality;
    prefs.rendering = normalizeQuality({
      ...prefs.rendering,
      [key]: key === "antialias" ? el.value : Number(el.value),
    });
    savePrefs();
  }
  if (el instanceof HTMLInputElement && el.dataset.pref) {
    const key = el.dataset.pref;
    if (
      key === "sound" ||
      key === "music" ||
      key === "quality" ||
      key === "superPerformance"
    )
      prefs[key] = el.checked;
    if (key === "sound" || key === "music") saveAudioPrefs();
    else savePrefs();
    audio.play("confirm");
  }
  if (el instanceof HTMLInputElement && el.dataset.motion) {
    const key = el.dataset.motion as MotionKey;
    prefs.motion[key] = el.checked;
    prefs.motionPreset = motionPresetFor(prefs.motion);
    savePrefs();
    const motionRoot = $("#motion-settings");
    const advancedOpen =
      motionRoot.querySelector<HTMLDetailsElement>(".motion-advanced")?.open ??
      false;
    const settingsPanel = motionRoot.closest<HTMLElement>(".settings-modal");
    const scrollTop = settingsPanel?.scrollTop ?? 0;
    motionRoot.outerHTML = motionSettingsMarkup(
      prefs.motion,
      prefs.motionPreset,
    );
    $("#motion-preference-note").outerHTML = motionPreferenceNoteMarkup();
    $("#motion-settings").querySelector<HTMLDetailsElement>(
      ".motion-advanced",
    )!.open = advancedOpen;
    requestAnimationFrame(() => {
      if (settingsPanel) settingsPanel.scrollTop = scrollTop;
      document
        .querySelector<HTMLInputElement>(`[data-motion="${key}"]`)
        ?.focus({ preventScroll: true });
    });
    notify(
      key === "boot"
        ? "开场设置将在下次重播时生效"
        : el.checked
          ? "已启用此动画"
          : "已关闭此动画",
    );
    audio.play("confirm");
  }
});
document.addEventListener("click", (e) => {
  const themeButton = (e.target as Element).closest<HTMLElement>(
    "[data-color-theme]",
  );
  if (themeButton) {
    prefs.colorTheme =
      themeButton.dataset.colorTheme === "dark" ? "dark" : "light";
    savePrefs();
    renderAtlasSurface(true);
    return;
  }
  const copyBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-copy-code]",
  );
  if (copyBtn) {
    const rawCode = copyBtn.dataset.copyCode ?? "";
    void navigator.clipboard?.writeText(rawCode).catch(() => {});
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "✓ 已复制";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove("copied");
    }, 1600);
    audio.play("confirm");
    notify("代码已复制到剪贴板");
    return;
  }
  const tocBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-scroll-heading]",
  );
  if (tocBtn) {
    const headingId = tocBtn.dataset.scrollHeading;
    if (headingId) {
      const target = document.getElementById(headingId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .querySelectorAll(".reader-toc-link")
        .forEach((b) => b.classList.toggle("active", b === tocBtn));
      const tocDrawer = document.getElementById("optical-toc-drawer");
      const tocTrigger = document.querySelector<HTMLElement>(
        '[data-optical-toggle="toc"]',
      );
      if (tocDrawer && !tocDrawer.hidden) {
        tocDrawer.hidden = true;
        tocTrigger?.setAttribute("aria-expanded", "false");
      }
      audio.play("ui-tick");
    }
    return;
  }
  const opticalToggleBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-optical-toggle]",
  );
  if (opticalToggleBtn) {
    const kind = opticalToggleBtn.dataset.opticalToggle;
    const tocDrawer = document.getElementById("optical-toc-drawer");
    const moreMenu = document.getElementById("optical-more-menu");
    const tocTrigger = document.querySelector<HTMLElement>(
      '[data-optical-toggle="toc"]',
    );
    const moreTrigger = document.querySelector<HTMLElement>(
      '[data-optical-toggle="more"]',
    );
    if (kind === "toc" && tocDrawer) {
      const nextOpen = tocDrawer.hidden;
      tocDrawer.hidden = !nextOpen;
      tocTrigger?.setAttribute("aria-expanded", String(nextOpen));
      if (nextOpen && moreMenu) {
        moreMenu.hidden = true;
        moreTrigger?.setAttribute("aria-expanded", "false");
      }
      audio.play("ui-tick");
    } else if (kind === "more" && moreMenu) {
      const nextOpen = moreMenu.hidden;
      moreMenu.hidden = !nextOpen;
      moreTrigger?.setAttribute("aria-expanded", String(nextOpen));
      if (nextOpen && tocDrawer) {
        tocDrawer.hidden = true;
        tocTrigger?.setAttribute("aria-expanded", "false");
      }
      audio.play("ui-tick");
    }
    return;
  }
  const opticalDrawerTabBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-optical-drawer-tab]",
  );
  if (opticalDrawerTabBtn) {
    const tab = opticalDrawerTabBtn.dataset.opticalDrawerTab;
    document
      .querySelectorAll<HTMLElement>("[data-optical-drawer-tab]")
      .forEach((b) =>
        b.classList.toggle("active", b === opticalDrawerTabBtn),
      );
    const paneToc = document.getElementById("optical-pane-toc");
    const paneTree = document.getElementById("optical-pane-tree");
    if (paneToc && paneTree) {
      paneToc.hidden = tab !== "toc";
      paneTree.hidden = tab !== "tree";
    }
    audio.play("ui-tick");
    return;
  }
  const opticalActionBtn = (e.target as Element).closest<HTMLElement>(
    "[data-optical-action]",
  );
  if (opticalActionBtn) {
    const oAct = opticalActionBtn.dataset.opticalAction;
    const moreMenu = document.getElementById("optical-more-menu");
    const moreTrigger = document.querySelector<HTMLElement>(
      '[data-optical-toggle="more"]',
    );
    if (moreMenu) {
      moreMenu.hidden = true;
      moreTrigger?.setAttribute("aria-expanded", "false");
    }
    if (oAct === "toggle-dossier") {
      const dossier = document.getElementById(
        "optical-archive-dossier",
      ) as HTMLDetailsElement | null;
      if (dossier) {
        dossier.open = !dossier.open;
        if (dossier.open) {
          requestAnimationFrame(() =>
            dossier.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          );
        }
      }
      audio.play("ui-tick");
      return;
    }
    if (oAct === "toggle-recede") {
      const readerStage = document.getElementById("optical-reader-stage");
      const next = readerStage?.dataset.receded !== "true";
      manualReaderRecede = next;
      if (readerStage) {
        readerStage.dataset.receded = String(next);
      }
      opticalActionBtn.setAttribute("aria-pressed", String(next));
      scene?.setReaderReceded(next);
      audio.play("ui-tick");
      return;
    }
    return;
  }
  if (atlasView === "reader") {
    const tocDrawer = document.getElementById("optical-toc-drawer");
    const moreMenu = document.getElementById("optical-more-menu");
    const clickedInsideDrawer = Boolean(
      (e.target as Element).closest("#optical-toc-drawer"),
    );
    const clickedInsideMore = Boolean(
      (e.target as Element).closest("#optical-more-menu"),
    );
    if (tocDrawer && !tocDrawer.hidden && !clickedInsideDrawer) {
      tocDrawer.hidden = true;
      document
        .querySelector<HTMLElement>('[data-optical-toggle="toc"]')
        ?.setAttribute("aria-expanded", "false");
    }
    if (moreMenu && !moreMenu.hidden && !clickedInsideMore) {
      moreMenu.hidden = true;
      document
        .querySelector<HTMLElement>('[data-optical-toggle="more"]')
        ?.setAttribute("aria-expanded", "false");
    }
  }
  if (atlasView === "library") {
    const clickedFilterWrap = Boolean(
      (e.target as Element).closest(".desk-filter-wrap"),
    );
    if (libraryState.filterOpen && !clickedFilterWrap) {
      libraryState.filterOpen = false;
      const pop = document.querySelector<HTMLElement>(".desk-filter-popover");
      const btn = document.querySelector<HTMLElement>(
        '[data-atlas-action="toggle-desk-filter"]',
      );
      if (pop) pop.hidden = true;
      if (btn) {
        btn.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    }
    const clickedMoreWrap = Boolean(
      (e.target as Element).closest(".desk-col-more"),
    );
    if (libraryState.openRowMenuId && !clickedMoreWrap) {
      const prevMenuId = libraryState.openRowMenuId;
      libraryState.openRowMenuId = null;
      document
        .querySelectorAll<HTMLElement>(".desk-row-menu")
        .forEach((m) => (m.hidden = true));
      document
        .querySelectorAll<HTMLElement>('[data-atlas-action="toggle-row-menu"]')
        .forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-expanded", "false");
        });
      document
        .querySelector<HTMLElement>(
          `.desk-dir-row[data-entry-id="${CSS.escape(prevMenuId)}"]`,
        )
        ?.focus({ preventScroll: true });
    }
  }
  const catTab = (e.target as Element).closest<HTMLButtonElement>(
    "[data-library-category]",
  );
  if (catTab) {
    const nextCat = catTab.dataset.libraryCategory ?? "all";
    libraryState.category = nextCat;
    libraryState.openRowMenuId = null;
    const rememberedId = libraryDomainMemory[nextCat];
    const nextEntries = filterAndSortLibraryEntries(libraryState, saved);
    if (rememberedId && nextEntries.some((en) => en.id === rememberedId)) {
      libraryState.selectedId = rememberedId;
    } else if (nextCat !== "all" && nextCat !== "inbox") {
      const lane = portals.findIndex((p) => p.id === nextCat);
      const laneEntryId =
        lane >= 0 ? records[columnMemory[lane]]?.entryId : undefined;
      if (laneEntryId && nextEntries.some((en) => en.id === laneEntryId)) {
        libraryState.selectedId = laneEntryId;
      } else {
        libraryState.selectedId = nextEntries[0]?.id ?? null;
      }
    } else {
      libraryState.selectedId = nextEntries[0]?.id ?? null;
    }
    const targetHash = buildLibraryHash(nextCat);
    if (location.hash !== targetHash) {
      history.replaceState(null, "", targetHash);
    }
    sync3DCameraWith2DView();
    renderAtlasSurface(true);
    audio.play("column");
    return;
  }
  const studioFilterBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-studio-filter]",
  );
  if (studioFilterBtn) {
    studioState.filterCategory = studioFilterBtn.dataset.studioFilter ?? "all";
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const studioCatBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-studio-set-category]",
  );
  if (studioCatBtn) {
    studioState.category = studioCatBtn.dataset.studioSetCategory ?? "tools";
    if (studioState.category === "inbox") {
      studioState.status = "draft";
    }
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const studioTypeBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-studio-set-type]",
  );
  if (studioTypeBtn) {
    studioState.type = (studioTypeBtn.dataset.studioSetType ??
      "skill") as EntryType;
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const studioStatusBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-studio-set-status]",
  );
  if (studioStatusBtn) {
    studioState.status = (studioStatusBtn.dataset.studioSetStatus ??
      "learning") as EntryStatus;
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const studioInsertBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-studio-insert]",
  );
  if (studioInsertBtn) {
    insertStudioSnippet(studioInsertBtn.dataset.studioInsert ?? "");
    return;
  }
  const studioActBtn = (e.target as Element).closest<HTMLElement>(
    "[data-studio-action]",
  );
  if (studioActBtn) {
    const sAct = studioActBtn.dataset.studioAction;
    if (sAct === "new-blank") {
      Object.assign(
        studioState,
        createDefaultStudioDraft(
          studioState.filterCategory !== "all"
            ? studioState.filterCategory
            : "tools",
        ),
      );
      void scheduleStudioLivePreview(true);
      if (location.hash !== "#/studio") {
        history.replaceState(null, "", "#/studio");
      }
      sync3DCameraWith2DView();
      renderAtlasSurface();
      audio.play("ui-tick");
      return;
    }
    if (sAct === "copy-ai-prompt") {
      void navigator.clipboard
        ?.writeText(ATLAS_AI_ARCHIVE_PROMPT)
        .catch(() => {});
      audio.play("confirm");
      notify("✓ AI 归档提示词已复制！发给任意聊天 AI 即可生成笔记");
      return;
    }
    if (sAct === "toggle-ai-import") {
      studioState.aiPasteOpen = !studioState.aiPasteOpen;
      renderAtlasSurface(true);
      if (studioState.aiPasteOpen) {
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLTextAreaElement>("#studio-ai-raw-input")
            ?.focus(),
        );
      }
      audio.play("ui-tick");
      return;
    }
    if (sAct === "apply-ai-import") {
      void parseAiMarkdownIntoStudio();
      return;
    }
    if (sAct === "save-entry") {
      void saveStudioDraftToDisk();
      return;
    }
    if (sAct === "delete-entry") {
      void deleteStudioEntryFromDisk();
      return;
    }
    return;
  }
  const typeChip = (e.target as Element).closest<HTMLButtonElement>(
    "[data-library-type]",
  );
  if (typeChip) {
    libraryState.type = (typeChip.dataset.libraryType ?? "all") as
      | EntryType
      | "all";
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const statusChip = (e.target as Element).closest<HTMLButtonElement>(
    "[data-library-status]",
  );
  if (statusChip) {
    libraryState.status = (statusChip.dataset.libraryStatus ?? "all") as
      | EntryStatus
      | "all";
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const sortChip = (e.target as Element).closest<HTMLButtonElement>(
    "[data-library-sort]",
  );
  if (sortChip) {
    libraryState.sortBy = (sortChip.dataset.librarySort ?? "updated") as
      | "updated"
      | "title"
      | "status";
    renderAtlasSurface(true);
    audio.play("ui-tick");
    return;
  }
  const layoutBtn = (e.target as Element).closest<HTMLButtonElement>(
    "[data-library-layout]",
  );
  if (layoutBtn) {
    const nextLayout = layoutBtn.dataset.libraryLayout;
    if (nextLayout === "grid" || nextLayout === "list") {
      libraryState.layout = nextLayout;
      renderAtlasSurface(true);
      audio.play("ui-tick");
    }
    return;
  }
  const atlasActionBtn = (e.target as Element).closest<HTMLElement>(
    "[data-atlas-action]",
  );
  if (atlasActionBtn) {
    const act = atlasActionBtn.dataset.atlasAction;
    if (act === "exit-optical-reader") {
      exitOpticalReader();
      return;
    }
    if (act === "enter-archive") {
      navigateAtlas("#/archive");
      audio.play("confirm");
      return;
    }
    if (act === "inspect-current-3d") {
      navigateAtlas("#/archive");
      openFile();
      return;
    }
    if (act === "open-3d-portal") {
      const portalId = atlasActionBtn.dataset.portal ?? "";
      const lane = portals.findIndex((p) => p.id === portalId);
      navigateAtlas("#/archive");
      if (lane >= 0) select(columnMemory[lane]);
      audio.play("column");
      return;
    }
    if (act === "locate-3d") {
      const entryId = atlasActionBtn.dataset.entryId ?? "";
      const recIdx = records.findIndex(
        (r) => r.entryId === entryId || r.id === entryId,
      );
      navigateAtlas("#/archive");
      if (recIdx >= 0) {
        select(recIdx);
        openFile();
      }
      return;
    }
    if (act === "toggle-save") {
      const rowId = atlasActionBtn.dataset.entryId;
      const hadRowMenu = libraryState.openRowMenuId === rowId;
      libraryState.openRowMenuId = null;
      toggleSavedById(rowId);
      if (hadRowMenu && rowId) {
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              `.desk-dir-row[data-entry-id="${CSS.escape(rowId)}"]`,
            )
            ?.focus({ preventScroll: true }),
        );
      }
      return;
    }
    if (act === "toggle-desk-filter") {
      libraryState.filterOpen = !libraryState.filterOpen;
      const pop = document.querySelector<HTMLElement>(".desk-filter-popover");
      if (pop) {
        pop.hidden = !libraryState.filterOpen;
        atlasActionBtn.classList.toggle("open", libraryState.filterOpen);
        atlasActionBtn.setAttribute(
          "aria-expanded",
          String(libraryState.filterOpen),
        );
      } else {
        renderAtlasSurface(true);
      }
      audio.play("ui-tick");
      return;
    }
    if (act === "clear-library-query") {
      libraryState.query = "";
      renderAtlasSurface(true);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>("#atlas-library-search")
          ?.focus(),
      );
      audio.play("ui-tick");
      return;
    }
    if (act === "toggle-library-saved-only") {
      libraryState.savedOnly = !libraryState.savedOnly;
      sync3DCameraWith2DView();
      renderAtlasSurface(true);
      audio.play("ui-tick");
      return;
    }
    if (act === "toggle-row-menu") {
      e.stopPropagation();
      const entryId = atlasActionBtn.dataset.entryId ?? "";
      const isClosing = libraryState.openRowMenuId === entryId;
      libraryState.openRowMenuId = isClosing ? null : entryId;
      document.querySelectorAll<HTMLElement>(".desk-row-menu").forEach((m) => {
        m.hidden = m.dataset.rowMenuFor !== libraryState.openRowMenuId;
      });
      document
        .querySelectorAll<HTMLElement>('[data-atlas-action="toggle-row-menu"]')
        .forEach((b) => {
          const open = b.dataset.entryId === libraryState.openRowMenuId;
          b.classList.toggle("active", open);
          b.setAttribute("aria-expanded", String(open));
        });
      if (isClosing && entryId) {
        document
          .querySelector<HTMLElement>(
            `.desk-dir-row[data-entry-id="${CSS.escape(entryId)}"]`,
          )
          ?.focus({ preventScroll: true });
      }
      audio.play("ui-tick");
      return;
    }
    if (act === "desk-select-row") {
      if ((e.target as Element).closest(".desk-col-more")) {
        return;
      }
      const entryId = atlasActionBtn.dataset.entryId ?? "";
      if (!entryId) return;
      libraryState.selectedId = entryId;
      libraryState.openRowMenuId = null;
      libraryState.unfiltered3DNoticeId = null;
      const entry = knowledgeRepository.byId(entryId);
      if (entry) {
        libraryDomainMemory[libraryState.category] = entry.id;
        libraryDomainMemory[entry.category] = entry.id;
      }
      sync3DCameraWith2DView();
      renderAtlasSurface(true);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `.desk-dir-row[data-entry-id="${CSS.escape(entryId)}"]`,
          )
          ?.focus({ preventScroll: true }),
      );
      audio.play("tick");
      return;
    }
    if (act === "desk-direct-read") {
      e.preventDefault();
      const entryId =
        atlasActionBtn.dataset.entryId ?? libraryState.selectedId ?? "";
      const entry =
        knowledgeRepository.byId(entryId) ??
        knowledgeRepository.bySlug(entryId);
      if (!entry) return;
      libraryState.openRowMenuId = null;
      void prefetchEntryAssets(entry.slug);
      navigateAtlas(buildEntryHash(entry.slug));
      audio.play("open");
      return;
    }
    if (act === "desk-enter-3d") {
      // Prevent duplicate triggers during the 0-160ms responseAck window
      if (
        scene &&
        scene.indexDeskFrame.time > 0.002 &&
        scene.indexDeskFrame.time < 0.16
      ) {
        return;
      }
      const entryId =
        atlasActionBtn.dataset.entryId ?? libraryState.selectedId ?? "";
      const entry = entryId ? knowledgeRepository.byId(entryId) : undefined;
      if (entry && entry.category !== "inbox") {
        const recIdx = records.findIndex(
          (r) => r.entryId === entry.id || r.id === entry.globalCode,
        );
        if (recIdx >= 0) {
          select(recIdx);
        }
      }
      navigateAtlas("#/archive");
      audio.play("confirm");
      return;
    }
    if (act === "desk-export-txt") {
      const entryId = atlasActionBtn.dataset.entryId ?? "";
      const entry = knowledgeRepository.byId(entryId);
      libraryState.openRowMenuId = null;
      if (entry) {
        const blob = new Blob(
          [
            `ATLAS ARCHIVE // ${entry.globalCode} (${entry.visualCode})\nTITLE: ${entry.title}\nCATEGORY: ${deskDomainTitle(entry.category, entry.categoryTitle)}\nUPDATED: ${entry.updated}\n\n${entry.plainText}\n`,
          ],
          { type: "text/plain;charset=utf-8" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ATLAS-${entry.globalCode}-${entry.id.replace(/\//g, "-")}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        audio.play("confirm");
        notify(`已导出 ${entry.globalCode} 纯文本档案`);
      }
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `.desk-dir-row[data-entry-id="${CSS.escape(entryId)}"]`,
          )
          ?.focus({ preventScroll: true }),
      );
      return;
    }
    if (act === "reveal-3d-selection") {
      const entryId = atlasActionBtn.dataset.entryId ?? "";
      const entry = knowledgeRepository.byId(entryId);
      libraryState.category = "all";
      libraryState.type = "all";
      libraryState.status = "all";
      libraryState.savedOnly = false;
      libraryState.query = "";
      libraryState.unfiltered3DNoticeId = null;
      if (entry) {
        libraryState.selectedId = entry.id;
      }
      sync3DCameraWith2DView();
      renderAtlasSurface(true);
      audio.play("confirm");
      return;
    }
    if (act === "reset-library-filters") {
      libraryState.category = "all";
      libraryState.type = "all";
      libraryState.status = "all";
      libraryState.savedOnly = false;
      libraryState.filterOpen = false;
      libraryState.query = "";
      libraryState.unfiltered3DNoticeId = null;
      sync3DCameraWith2DView();
      navigateAtlas("#/library");
      audio.play("ui-tick");
      return;
    }
    if (act === "quick-new-guide") {
      navigateAtlas("#/studio");
      audio.play("open");
      return;
    }
  }
  if (!started) return;
  if (modalClosing) return;
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el) return;
  if (el.dataset.action === "motion-preset") {
    const preset = el.dataset.preset;
    if (preset !== "full" && preset !== "reduced") return;
    prefs.motionPreset = preset;
    prefs.motion = preset === "full" ? fullMotion() : reducedMotion();
    savePrefs();
    renderModal();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[data-action="motion-preset"][data-preset="${prefs.motionPreset}"]`,
        )
        ?.focus({ preventScroll: true }),
    );
    audio.play("confirm");
    return;
  }
  if (el.dataset.select) {
    select(Number(el.dataset.select));
    return;
  }
  if (el.dataset.result) {
    const index = Number(el.dataset.result);
    const slug = el.dataset.resultSlug;
    const in3d = el.dataset.resultIn3d === "true";
    closeModal(() => {
      if (atlasView === "archive" && in3d && scene) {
        select(index);
        openFile();
      } else if (slug) {
        navigateAtlas(buildEntryHash(slug));
      } else {
        select(index);
        openFile();
      }
    });
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.filter === filter,
        ),
      );
    renderResults();
    return;
  }
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  const action = el.dataset.action;
  if (action === "nav-home") {
    navigateAtlas("#/home");
    audio.play("ui-tick");
    return;
  }
  if (action === "nav-library") {
    navigateAtlas("#/library");
    audio.play("ui-tick");
    return;
  }
  if (action === "nav-studio") {
    navigateAtlas("#/studio");
    audio.play("ui-tick");
    return;
  }
  if (action === "nav-archive") {
    navigateAtlas("#/archive");
    audio.play("ui-tick");
    return;
  }
  if (action === "open-current-reader") {
    const slug = records[selected].slug;
    void prefetchEntryAssets(slug);
    navigateAtlas(buildEntryHash(slug));
    audio.play("open");
    return;
  }
  if (action === "open-reader") {
    const slug = el.dataset.entrySlug || records[selected].slug;
    void prefetchEntryAssets(slug);
    navigateAtlas(buildEntryHash(slug));
    audio.play("open");
    return;
  }
  if (action === "edit-studio") {
    const slug = el.dataset.entrySlug || records[selected].slug;
    navigateAtlas(buildStudioHash(slug));
    audio.play("open");
    return;
  }
  if (action === "toggle-theme-quick") {
    prefs.colorTheme = prefs.colorTheme === "dark" ? "light" : "dark";
    savePrefs();
    renderAtlasSurface(true);
    audio.play("confirm");
    return;
  }
  if (action === "toggle-three") {
    void toggleThree();
    return;
  }
  if (action === "sound-preview") audio.play("confirm");
  if (action === "skip") {
    setMode("archive");
    syncHashRoute();
    audio.play("confirm");
  }
  if (action === "prev") stepFile(-1);
  if (action === "next") stepFile(1);
  if (action === "column-prev") stepColumn(-1);
  if (action === "column-next") stepColumn(1);
  if (action === "open") openFile();
  if (action === "model-viewer" && mode === "detail" && scene) {
    const activeScene = scene;
    // Safari does not always focus a button when it is tapped. Capture the
    // actual opener so closing the modal reliably restores the right control.
    el.focus({ preventScroll: true });
    viewer ??= new ModelViewer(
      $("#stage"),
      () => {
        audio.setScene(mode);
        audio.play("page-close");
      },
      (sound) => audio.play(sound === "tick" ? "ui-tick" : sound),
    );
    audio.setScene("viewer");
    viewer.setSuperPerformance(superPerformanceEnabled());
    viewer.setQuality(effectiveRenderQuality());
    viewer.setMotion(prefs.motion);
    scene.finishDecryption();
    viewer.open(
      records[selected].id,
      records[selected].title,
      () => activeScene.createAssemblyModel(),
      !motionActive("viewerNavigation"),
    );
    audio.play("page-open");
  }
  if (action === "back") {
    setMode("archive");
    audio.play("back");
  }
  if (action === "search" || action === "saved" || action === "settings") {
    el.focus({ preventScroll: true });
    openModal(action);
  }
  if (action === "close-modal") closeModal();
  if (action === "bookmark") toggleSaved();
  if (action === "reset-search") {
    modal = "search";
    searchQuery = "";
    filter = "全部档案";
    renderModal();
  }
  if (action === "replay" || action === "restart") {
    replayBoot();
  }
  if (action === "enable-motion") {
    prefs.motion = fullMotion();
    prefs.motionPreset = "full";
    savePrefs();
    replayBoot();
  }
  if (action === "fullscreen" && document.fullscreenEnabled) {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify("请使用浏览器的全屏快捷键 F11"));
  }
});
document.addEventListener("keydown", (e) => {
  if (!started) return;
  if (viewer?.isOpen) return;
  if (
    atlasView === "studio" &&
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "s"
  ) {
    e.preventDefault();
    void saveStudioDraftToDisk();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (mode === "boot" && ready) setMode("archive");
    openModal("search");
    return;
  }
  if (playground?.active && !modal) {
    if (e.key === "Escape") {
      e.preventDefault();
      playground.stop();
    } else if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "/",
      ].includes(e.key) &&
      !(e.target instanceof HTMLButtonElement)
    )
      e.preventDefault();
    return;
  }
  if (modalClosing) {
    e.preventDefault();
    return;
  }
  const typing =
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement;
  if (e.key === "Escape") {
    if (modal) closeModal();
    else if (atlasView === "studio") {
      if (studioState.aiPasteOpen) {
        studioState.aiPasteOpen = false;
        renderAtlasSurface(true);
      } else {
        navigateAtlas("#/library");
        audio.play("back");
      }
    } else if (atlasView === "reader") {
      const tocDrawer = document.getElementById("optical-toc-drawer");
      const moreMenu = document.getElementById("optical-more-menu");
      if (tocDrawer && !tocDrawer.hidden) {
        tocDrawer.hidden = true;
        document
          .querySelector<HTMLElement>('[data-optical-toggle="toc"]')
          ?.setAttribute("aria-expanded", "false");
        audio.play("ui-tick");
        return;
      }
      if (moreMenu && !moreMenu.hidden) {
        moreMenu.hidden = true;
        document
          .querySelector<HTMLElement>('[data-optical-toggle="more"]')
          ?.setAttribute("aria-expanded", "false");
        audio.play("ui-tick");
        return;
      }
      exitOpticalReader();
    } else if (atlasView === "library") {
      if (libraryState.openRowMenuId) {
        const prevRowId = libraryState.openRowMenuId;
        libraryState.openRowMenuId = null;
        renderAtlasSurface(true);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              `.desk-dir-row[data-entry-id="${CSS.escape(prevRowId)}"]`,
            )
            ?.focus({ preventScroll: true }),
        );
        audio.play("ui-tick");
        return;
      }
      if (libraryState.filterOpen) {
        libraryState.filterOpen = false;
        renderAtlasSurface(true);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              '[data-atlas-action="toggle-desk-filter"]',
            )
            ?.focus({ preventScroll: true }),
        );
        audio.play("ui-tick");
        return;
      }
      if (libraryState.query.trim()) {
        libraryState.query = "";
        sync3DCameraWith2DView();
        renderAtlasSurface(true);
        audio.play("ui-tick");
        return;
      }
      navigateAtlas("#/archive");
      audio.play("back");
    } else if (
      atlasView === "archive" &&
      scene &&
      $("#atlas-surface").dataset.deskBridgeHold === "true"
    ) {
      // Mid-transition Esc from 2D -> 3D reverses smoothly back to 2D Glass Index Desk
      navigateAtlas("#/library");
      audio.play("back");
    } else if (mode === "detail" || (mode === "boot" && ready)) {
      const sound = mode === "detail" ? "back" : "ui-tick";
      setMode("archive");
      audio.play(sound);
    }
    return;
  }
  if (modal && e.key === "Tab") {
    const focusables = [
      ...$("#modal-root").querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
      ),
    ];
    const visible = focusables.filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.matches(":disabled") &&
        el.getClientRects().length > 0,
    );
    const first = visible[0],
      last = visible.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (typing || modal || !ready) return;
  if (atlasView === "reader" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const lower = e.key.toLowerCase();
    if (lower === "e") {
      e.preventDefault();
      navigateAtlas(buildStudioHash(activeReaderSlug));
      audio.play("open");
      return;
    }
    if (lower === "s") {
      e.preventDefault();
      toggleSavedById(activeReaderSlug);
      return;
    }
    if (lower === "i") {
      e.preventDefault();
      const dossier = document.getElementById(
        "optical-archive-dossier",
      ) as HTMLDetailsElement | null;
      if (dossier) {
        dossier.open = !dossier.open;
        if (dossier.open) {
          requestAnimationFrame(() =>
            dossier.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          );
        }
      }
      audio.play("ui-tick");
      return;
    }
    if (lower === "f") {
      e.preventDefault();
      const readerStage = document.getElementById("optical-reader-stage");
      const next = readerStage?.dataset.receded !== "true";
      manualReaderRecede = next;
      if (readerStage) readerStage.dataset.receded = String(next);
      scene?.setReaderReceded(next);
      audio.play("ui-tick");
      return;
    }
  }
  if (
    (e.target as HTMLElement).dataset.tab &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const tabs = ["overview", "notes", "history"];
    setTab(
      tabs[(tabs.indexOf(activeTab) + (e.key === "ArrowRight" ? 1 : 2)) % 3],
    );
    $<HTMLButtonElement>(`[data-tab="${activeTab}"]`).focus();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    openModal("search");
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "h") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    navigateAtlas("#/home");
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    navigateAtlas("#/library");
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    navigateAtlas("#/studio");
    return;
  }
  if (atlasView === "library") {
    const entries = filterAndSortLibraryEntries(libraryState, saved);
    if (entries.length > 0 && ["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const cur = resolveLibrarySelection(entries, libraryState.selectedId);
      const curIdx = cur ? entries.findIndex((en) => en.id === cur.id) : 0;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const nextEntry =
        entries[(curIdx + step + entries.length) % entries.length];
      if (nextEntry) {
        libraryState.selectedId = nextEntry.id;
        libraryState.openRowMenuId = null;
        libraryDomainMemory[libraryState.category] = nextEntry.id;
        libraryDomainMemory[nextEntry.category] = nextEntry.id;
        sync3DCameraWith2DView();
        renderAtlasSurface(true);
        requestAnimationFrame(() => {
          const rowEl = document.querySelector<HTMLElement>(
            `.desk-dir-row[data-entry-id="${CSS.escape(nextEntry.id)}"]`,
          );
          rowEl?.scrollIntoView({ block: "nearest" });
          rowEl?.focus({ preventScroll: true });
        });
        audio.play("tick");
      }
      return;
    }
    if (
      e.key === "Enter" &&
      (document.activeElement === document.body ||
        (document.activeElement as HTMLElement)?.classList.contains(
          "desk-dir-row",
        ))
    ) {
      e.preventDefault();
      const cur = resolveLibrarySelection(entries, libraryState.selectedId);
      if (cur) {
        void prefetchEntryAssets(cur.slug);
        navigateAtlas(buildEntryHash(cur.slug));
        audio.play("open");
      }
      return;
    }
    return;
  }
  if (atlasView !== "archive") return;
  if (e.key === "Home" && isGamepadEvent(e) && mode === "archive" && !modal) {
    e.preventDefault();
    openModal("saved");
  }
  if (e.key === "ArrowLeft" && mode !== "boot") {
    e.preventDefault();
    stepColumn(-1);
  }
  if (e.key === "ArrowRight" && mode !== "boot") {
    e.preventDefault();
    stepColumn(1);
  }
  if (["ArrowUp", "ArrowDown"].includes(e.key) && mode !== "boot") {
    e.preventDefault();
    stepFile(e.key === "ArrowUp" ? -1 : 1);
  }
  if (
    e.key === "Enter" &&
    (document.activeElement === document.body ||
      document.activeElement?.id === "detail-content" ||
      ["prev", "next", "column-prev", "column-next"].includes(
        (document.activeElement as HTMLElement)?.dataset.action ?? "",
      ) ||
      (document.activeElement as HTMLElement)?.dataset.select)
  ) {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    else if (mode === "archive") openFile();
  }
});

const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function bootFrame(t: number) {
  if (isWallpaper && !scene && frozenTime === null && t >= 21.9) {
    setMode("archive");
    return undefined;
  }
  if (
    frozenTime === null &&
    t >= ARRAY_OPENING_END &&
    (!reviewEntry ||
      (isWallpaper &&
        !openingShowsDetail(
          wallpaperHost()?.properties.openingdetail?.value,
          !!workbench?.enabled,
        )))
  ) {
    setMode("archive");
    return undefined;
  }
  audio.updateBoot(t, frozenTime !== null);
  const motion = bootSequence.update(t);
  if (workbench?.enabled && frozenTime === null) {
    const end = openingShowsDetail(
      wallpaperHost()?.properties.openingdetail?.value,
      true,
    )
      ? 35
      : ARRAY_OPENING_END;
    if (t > end - 0.35)
      $(".powered").style.opacity = String(1 - ease((t - end + 0.35) / 0.35));
  }
  let step: string = motion.step;
  if (t >= 22) {
    step = "array";
  }
  if (t >= 25.68) {
    step = "select";
  }
  if (t >= 28.3) {
    step = "inspect";
  }
  if (step !== lastStep) {
    $("#stage").dataset.boot = step;
    lastStep = step;
  }
  $(".file-title").firstChild!.textContent =
    step === "array"
      ? "SELECTING FILES...".slice(0, Math.max(0, Math.floor((t - 21.94) * 18)))
      : "FILE NUMBER: ";
  $("#stage").style.setProperty(
    "--entry-opacity",
    String(ease((t - 21.9) / 0.13)),
  );
  $(".callout-rule").style.transform = `scaleX(${ease((t - 22.08) / 0.9)})`;
  const reveal = ease((t - 22) / 0.4),
    lift = ease((t - 26) / 1.8),
    zoom = 0.55 * ease((t - 27.3) / 1.65) + 0.45 * ease((t - 29.0) / 5.0);
  if (t >= 35) {
    setMode("detail");
    return undefined;
  }
  return { reveal, lift, zoom, time: t };
}

const inspectionOverlay = new InspectionOverlay();
const documentDecryption = new DocumentDecryption();
// A newly opened archive can introduce another font shard. Re-measure its
// redaction lines after font swap while retaining the current reveal progress.
document.fonts.addEventListener("loadingdone", () =>
  documentDecryption.refresh(),
);

let lastTime = 0,
  frameCount = 0,
  frameStart = performance.now(),
  fps = 0;
function frame(ms: number) {
  if (!wallpaperFrame(ms)) {
    requestAnimationFrame(frame);
    return;
  }
  if (document.hidden) {
    requestAnimationFrame(frame);
    return;
  }
  workbench?.tick();
  const time = ms / 1000;
  const theme = scene?.themeAmount ?? (prefs.colorTheme === "dark" ? 1 : 0);
  paintTheme(theme);
  viewer?.setTheme(theme);
  playground?.tick(time);
  const cinema =
    mode === "boot" && ready
      ? bootFrame(frozenTime ?? time - bootStart)
      : undefined;
  wallpaperEffects?.update(
    time,
    motionIsReduced(),
    motionActive("pointerParallax"),
  );
  // Keep the 3D Archive Hall live behind the frosted terminal glass so camera & cassette transitions remain continuous; ArchiveScene's static-frame cache automatically idles GPU when motion settles.
  if (!viewer?.isOpen && (!cinema || cinema.time >= 21.9))
    scene?.update(time, cinema);
  if (atlasView === "reader" || scene?.readerActiveOrTransitioning) {
    syncOpticalReaderDom();
  }
  if (
    atlasView === "library" ||
    scene?.indexDeskActiveOrTransitioning ||
    $("#atlas-surface").dataset.deskBridgeHold === "true"
  ) {
    syncIndexDeskDom();
  }
  viewer?.update(time);
  if (threeState === "closing" && scene?.presentationHidden) releaseThree();
  playground?.position();
  if (scene && mode === "detail" && atlasView === "archive") {
    documentDecryption.update(
      time,
      scene.decryptionFrame,
      !motionActive("documentReveal"),
    );
    $("#detail-content").style.opacity = String(scene.detailVisibility);
    $("#detail-content").style.translate =
      `0 ${(1 - scene.detailVisibility) * 18}px`;
    $("#detail-content").inert = scene.detailVisibility < 0.1;
    if (
      pendingDetailFocus &&
      scene.detailVisibility >= 0.1 &&
      !modal &&
      !viewer?.isOpen
    ) {
      $("#detail-content").focus({ preventScroll: true });
      pendingDetailFocus = false;
    }
  }
  $("#stage").style.setProperty(
    "--detail-shade",
    String(mode === "boot" ? 0 : (scene?.detailVisibility ?? 0)),
  );
  const currentScene = scene;
  if (currentScene && (atlasView === "archive" || mode === "boot"))
    inspectionOverlay.render(
      currentScene.decryptionFrame,
      (x, y) => currentScene.projectCard(x, y),
      Boolean(cinema),
      motionActive("modelDecryption"),
    );
  if (Math.floor(time) !== lastTime) {
    lastTime = Math.floor(time);
    updateFooterClock(new Date(), motionActive("rollingNumbers"));
  }
  frameCount++;
  if (ms - frameStart > 1000) {
    fps = (frameCount * 1000) / (ms - frameStart);
    frameStart = ms;
    frameCount = 0;
    $("#three-scene").dataset.fps = String(Math.round(fps));
    $("#three-scene").dataset.renderStats = JSON.stringify(
      scene?.getStats() ?? { loaded: false, drawCalls: 0, triangles: 0 },
    );
  }
  requestAnimationFrame(frame);
}
function bindScene(scene: ArchiveScene, cell?: { lane: number; row: number }) {
  scene.select(selected, cell ? { cell } : undefined);
  scene.onReaderActivationSound = () => {
    audio.play("confirm");
  };
  scene.onSelect = (i, cell) => {
    if (mode !== "archive" || modal || viewer?.isOpen) return;
    select(i, cell ? { cell } : undefined);
  };
  scene.onNavigate = (axis, direction) => {
    if (mode !== "archive" || modal || viewer?.isOpen) return;
    if (axis === "lane") stepColumn(direction);
    else stepFile(direction);
  };
  scene.onHover = (i) => {
    const label = $("#hover-label");
    if (i === null) {
      label.hidden = true;
      hoverCode.finish();
      hoverTitle.finish();
      return;
    }
    const animated = motionActive("rollingText") && mode === "archive";
    const numbersAnimated =
      motionActive("rollingNumbers") && mode === "archive";
    hoverCode.update({
      value: Number(records[i].id.slice(2)),
      animated: !label.hidden && numbersAnimated,
    });
    hoverTitle.update({
      text: records[i].title,
      animated: !label.hidden && animated,
    });
    label.hidden = false;
    // Prepare the first visible value so the next hover can animate immediately.
    hoverCode.update({ animated: numbersAnimated });
    hoverTitle.update({ animated });
  };
}
function syncThreeButton() {
  $("#stage").dataset.threeState = threeState;
  syncWallpaperBackground();
  const button = document.querySelector<HTMLButtonElement>(
    '[data-action="toggle-three"]',
  );
  if (!button) return;
  button.textContent =
    threeState === "loading"
      ? "3D 载入中…"
      : threeState === "closing"
        ? "3D 关闭中…"
        : threeState === "off"
          ? "3D 关闭"
          : "3D 开启";
  button.disabled = threeState === "loading";
  button.setAttribute("aria-pressed", String(threeState === "on"));
  button.title =
    threeState === "off"
      ? "重新载入三维模型"
      : threeState === "closing"
        ? "取消关闭，恢复三维画面"
        : "卸载三维模型，保留 2D 界面";
}
function releaseThree() {
  if (!scene) return;
  resumeCell = { ...scene.getStats().selectedCell };
  resumeSelection = selected;
  viewer?.dispose();
  viewer = undefined;
  scene.dispose();
  scene = undefined;
  if (mode === "detail") {
    $("#detail-content").style.opacity = "1";
    $("#detail-content").style.translate = "0 0";
    $("#detail-content").inert = false;
    documentDecryption.reset($("#detail-content"), true);
  }
  threeState = "off";
  syncThreeButton();
  $("#hover-label").hidden = true;
  delete $("#three-scene").dataset.renderQuality;
  updateQualitySummary();
}
async function toggleThree() {
  if (!isWallpaper || !ready || threeState === "loading") return;
  if (threeState === "closing") {
    scene?.setPresentationVisible(true, !motionActive("surfaceTransitions"));
    threeState = "on";
    syncThreeButton();
    return;
  }
  if (scene) {
    playground?.stop();
    threeState = "closing";
    syncThreeButton();
    scene.setPresentationVisible(false, !motionActive("surfaceTransitions"));
    if (!motionActive("surfaceTransitions")) releaseThree();
    return;
  }
  threeState = "loading";
  syncThreeButton();
  let next: ArchiveScene | undefined;
  try {
    next = new ArchiveScene($("#three-scene"));
    next.renderer.domElement.style.opacity = "0";
    next.setPresentationVisible(false, true);
    await next.load();
    next.setMode(mode === "detail" ? "detail" : "archive");
    bindScene(next, resumeSelection === selected ? resumeCell : undefined);
    next.revealImmediately();
    scene = next;
    scene.setTheme(prefs.colorTheme === "dark", true);
    scene.setArchiveCoverage(
      wallpaperHost()?.properties.archivecoverage?.value === "extra",
    );
    savePrefs();
    scene.setPresentationVisible(true, !motionActive("surfaceTransitions"));
    threeState = "on";
    syncThreeButton();
  } catch (error) {
    next?.dispose();
    scene = undefined;
    threeState = "off";
    syncThreeButton();
    notify("三维模型载入失败，请点击 3D 关闭重试。");
    console.error(error);
  }
}

async function start() {
  try {
    if (isWallpaper) await window.rhineWallpaperPropertiesReady;
    const disableWebGL = reviewParams.get("webgl") === "0";
    if (
      !disableWebGL &&
      (!isWallpaper ||
        wallpaperHost()?.properties.load3donstartup?.value !== false)
    ) {
      try {
        scene = new ArchiveScene($("#three-scene"));
        scene.setTheme(prefs.colorTheme === "dark", true);
        scene.setArchiveCoverage(
          wallpaperHost()?.properties.archivecoverage?.value === "extra",
        );
        await scene.load();
      } catch (webglError) {
        console.warn(
          "WebGL unavailable, falling back to 2D ATLAS knowledge views:",
          webglError,
        );
        scene?.dispose();
        scene = undefined;
        threeState = "off";
        syncThreeButton();
      }
    } else {
      threeState = "off";
      syncThreeButton();
    }
    await Promise.allSettled([
      loadBootWebfonts(),
      // With unicode-range faces, preload the opening's actual characters,
      // not every font shard. Other archive text loads on demand.
      document.fonts.load(
        "300 20px MiSans",
        "ACCESS WELCOME TO INTERNAL DATABASE",
      ),
      document.fonts.load(
        "400 20px MiSans",
        "身份信息确认请求已接收开始处理权限验证通过欢迎访问莱茵生命内部资料档案编号保密级别商业区选择档案：0123456789 JOYCE MOORE",
      ),
      document.fonts.load(
        "600 20px MiSans",
        "SYNTHESIZE INFORMATION ANALYSIS OS",
      ),
      document.fonts.load(
        "700 20px MiSans",
        "RHINE LAB WELCOME TO INTERNAL DATABASE",
      ),
    ]);
    if (scene) bindScene(scene);
    savePrefs();
    ready = true;
    select(0);
    if (entry && !parseHashRoute(location.hash) && scene) entry.ready();
    else {
      if (isWallpaper) {
        // CEF allows automatic audio; never block the visual on audio policy or decoding.
        await Promise.race([
          audio.unlock(),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      }
      completeStartup(Boolean(parseHashRoute(location.hash)) || !scene);
    }
  } catch (error) {
    console.error(error);
    $("#loading").innerHTML =
      '<div class="error-state"><strong>CONNECTION INTERRUPTED</strong><p>终端资源未能载入，请刷新重试。</p><button onclick="location.reload()">RECONNECT →</button></div>';
  }
}
function completeStartup(silent: boolean) {
  if (started || !ready) return;
  started = true;
  if (silent) {
    prefs.sound = false;
    prefs.music = false;
    saveAudioPrefs();
  }
  audio.releaseEntry();
  audio.restartBoot();
  const hasDirectRoute = Boolean(parseHashRoute(location.hash)) || !scene;
  const fade = motionActive("boot") && !hasDirectRoute ? 600 : 0;
  bootStart =
    performance.now() / 1000 -
    (reviewParams.has("time") ? Number(reviewParams.get("time")) : 1.76);
  if (!reviewParams.has("time")) bootStart += fade / 1000;
  setMode("boot");
  if (
    hasDirectRoute ||
    reviewParams.get("scene") === "archive" ||
    (!motionActive("boot") && !reviewParams.has("time"))
  )
    setMode("archive");
  if (reviewParams.get("scene") === "detail") setMode("detail");
  if (isWallpaper && wallpaperHost()?.properties.boot?.value === false)
    setMode("archive");
  syncHashRoute();
  $("#stage").inert = false;
  $(".mobile-entry").inert = false;
  loading.classList.add("loaded");
  loading.inert = true;
  setTimeout(() => {
    const restoreFocus =
      loading.contains(document.activeElement) ||
      document.activeElement === document.body;
    loading.remove();
    if (entry && restoreFocus && atlasView === "archive") {
      const skip = $("#skip");
      const target =
        mode === "boot"
          ? skip.getClientRects().length
            ? skip
            : $(".mobile-entry")
          : $(".read-file");
      target.focus({ preventScroll: true });
    }
  }, fade);
  requestAnimationFrame(frame);
  // Do not compete with entry audio/font downloads. Full offline installation
  // begins after startup is complete and remains atomic.
  setTimeout(() => void initPwa(notify), 1500);
}
updateSelection();
const customBackground = isWallpaper
  ? new WallpaperBackground($("#stage"), notify)
  : undefined;
function syncWallpaperBackground(retry = false) {
  customBackground?.update(
    wallpaperHost()?.properties ?? {},
    mode !== "boot" && (threeState === "off" || threeState === "loading"),
    !motionActive("surfaceTransitions"),
    retry,
  );
}
if (isWallpaper) {
  const apply = (properties: WallpaperProperties) => {
    const theme = properties.colortheme?.value;
    if (theme === "light" || theme === "dark") prefs.colorTheme = theme;
    scene?.setArchiveCoverage(
      properties.archivecoverage?.value === "extra" ||
        wallpaperHost()?.properties.archivecoverage?.value === "extra",
    );
    for (const key of ["sound", "music"] as const)
      if (typeof properties[key]?.value === "boolean")
        prefs[key] = properties[key].value as boolean;
    if (typeof properties.reduced?.value === "boolean") {
      prefs.motion = properties.reduced.value ? reducedMotion() : fullMotion();
      prefs.motionPreset = motionPresetFor(prefs.motion);
    }
    for (const key of ["soundVolume", "musicVolume"] as const) {
      const value = properties[key.toLowerCase()]?.value;
      if (typeof value === "number" && Number.isFinite(value))
        prefs[key] = Math.max(0, Math.min(1, value / 100));
    }
    const qualityProperties = { ...wallpaperHost()?.properties, ...properties };
    if (
      Object.keys(properties).some(
        (key) => key === "renderquality" || key.startsWith("quality"),
      )
    )
      prefs.rendering = wallpaperQuality(qualityProperties, prefs.rendering);
    savePrefs();
    if (
      properties.customwallpaperfile ||
      properties.customwallpaper?.value === true
    )
      syncWallpaperBackground(true);
    if (properties.boot?.value === false && started && mode === "boot")
      setMode("archive");
    // Keep an already-open settings surface in sync without replacing focused controls.
    document
      .querySelectorAll<HTMLInputElement>("[data-pref]")
      .forEach((input) => {
        const key = input.dataset.pref as
          | "sound"
          | "music"
          | "quality"
          | "superPerformance";
        if (key in prefs) input.checked = prefs[key];
      });
    document
      .querySelectorAll<HTMLInputElement>("[data-motion]")
      .forEach((input) => {
        input.checked = prefs.motion[input.dataset.motion as MotionKey];
      });
    document
      .querySelectorAll<HTMLElement>('[data-action="motion-preset"]')
      .forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.preset === prefs.motionPreset),
        );
      });
    const note = document.querySelector("#motion-preference-note");
    if (note) note.outerHTML = motionPreferenceNoteMarkup();
    for (const key of ["soundVolume", "musicVolume"] as const) {
      const input = document.querySelector<HTMLInputElement>(
        `[data-volume="${key}"]`,
      );
      if (input) {
        input.value = String(Math.round(prefs[key] * 100));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(`${input.value}%`);
      }
    }
  };
  window.addEventListener("rhine-wallpaper-properties", (event) =>
    apply((event as CustomEvent<WallpaperProperties>).detail),
  );
  let pausedAt: number | undefined;
  const pause = () => {
    const paused = wallpaperHost()?.paused ?? false;
    if (paused && pausedAt === undefined) pausedAt = performance.now();
    if (!paused && pausedAt !== undefined) {
      if (started && mode === "boot")
        bootStart += (performance.now() - pausedAt) / 1000;
      pausedAt = undefined;
    }
    audio.setHostPaused(paused);
  };
  window.addEventListener("rhine-wallpaper-pause", pause);
  apply(wallpaperHost()?.properties ?? {});
  pause();
}
if (isWallpaper) {
  workbench = new Workbench(
    $("#stage"),
    () => {
      if (ready && mode !== "boot") setMode("archive");
    },
    (lane) => {
      if (ready && !modal) select(columnMemory[lane]);
    },
  );
  workbench.setMotion(prefs.motion);
  playground = new ArchivePlayground(
    $("#stage"),
    () => scene,
    () => ({
      enabled: !!workbench?.enabled && mode === "archive" && ready,
      paused:
        Boolean(modal) ||
        modalClosing ||
        Boolean(wallpaperHost()?.paused) ||
        document.hidden,
      reduced: motionIsReduced(),
    }),
    (value) => {
      musicSuppressed = value;
      configureAudio();
    },
    () => audio.play("tick"),
  );
  wallpaperEffects = new WallpaperEffects($("#stage"), () => scene);
  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>(
      "[data-workbench-mode]",
    );
    if (button)
      closeModal(() => {
        workbench!.setEnabled(button.dataset.workbenchMode === "workbench");
      });
  });
}
void start();
enableGamepad();
const ARCHIVE_HINT: Record<"keyboard" | "gamepad", string> = {
  keyboard: `<kbd>←</kbd> <kbd>→</kbd> 切换列 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后档案 <span>／</span> <kbd>ENTER</kbd> 读取 <span>／</span> <kbd>H</kbd> 遥测 <kbd>L</kbd> 索引 <kbd>N</kbd> 编撰台`,
  gamepad: `<kbd>LS</kbd> <kbd>DP</kbd> 切换列 / 前后档案 <span>／</span> <kbd>A</kbd> 读取`,
};
onInputDevice((device) => {
  const hint = document.querySelector(".archive-hint");
  if (hint) hint.innerHTML = ARCHIVE_HINT[device];
});
// Deterministic review controls: the running application, never a video surrogate.
Object.assign(window, {
  rhine: {
    // The review button supplies a real user activation. Preferences stay local to this preview.
    playBootPreview: async (music = false) => {
      if (!ready || !navigator.userActivation.isActive) return false;
      const request = ++audioPreviewRequest;
      audioPreview = true;
      audio.configure({ ...prefs, sound: true, music });
      const unlocked = await audio.unlock();
      if (request !== audioPreviewRequest) return false;
      if (!unlocked) {
        audioPreview = false;
        configureAudio();
        return false;
      }
      replayBoot(true);
      return true;
    },
    seek: (t: number) => {
      setMode("boot");
      bootStart = performance.now() / 1000 - t;
      lastStep = "";
    },
    archive: () => {
      atlasView = "archive";
      setMode("archive");
    },
    detail: () => openFile(),
    select: (i: number) => select(i),
    navigate: (hash: string) => navigateAtlas(hash),
    stats: () => ({
      ...scene?.getStats(),
      threeState,
      fps: Math.round(fps),
      mode,
      atlasView,
      activeReaderSlug,
      ready,
      startup: started ? "started" : (entry?.phase ?? "loading"),
      motion: { reduced: motionIsReduced(), preset: prefs.motionPreset },
      bootTime:
        mode === "boot"
          ? started
            ? (frozenTime ?? performance.now() / 1000 - bootStart) + 5
            : 6.76
          : null,
      selected: records[selected].id,
      selectedVisualCode: records[selected].visualCode,
      totalEntries: records.length,
      saved: [...saved],
      audio: audio.stats(),
      wallpaper: isWallpaper ? wallpaperHost() : null,
    }),
  },
});
if (import.meta.hot) {
  import.meta.hot.dispose(() => audio.dispose());
  import.meta.hot.on("atlas:content-updated", (snapshot) => {
    applyHotSnapshot(snapshot, false);
  });
}
