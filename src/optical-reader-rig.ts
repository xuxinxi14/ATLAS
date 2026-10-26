import * as THREE from "three";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Insertion curve (1000–1560ms):
 * Soft acceleration in the first half, smooth deceleration in the second half,
 * and a subtle final seating settle without bounce.
 */
function insertionCurve(u: number): number {
  const t = clamp01(u);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Quintic ease-in-out with a gentle final 12% seating ramp
  const main = smootherstep(0, 0.9, t) * 0.965;
  const seat = smoothstep(0.84, 1.0, t) * 0.035;
  return main + seat;
}

export interface OpticalReaderTimelineFrame {
  /** Total elapsed time on the 0..2.25s timeline */
  time: number;
  /** Normalized 0..1 overall progress */
  progress: number;
  /** 0–220ms: Detail UI fade-out & takeover */
  takeover: number;
  /** 100–700ms: Pure vertical clearance lift above the array */
  verticalLift: number;
  /** 520–1100ms: Optical Reader rig docking into upper operation space */
  rigDock: number;
  /** 1000–1560ms: Lateral slide of cassette along side guide rail into slot cavity */
  lateralInsert: number;
  /** 1460–1860ms: Contact points illuminate first */
  contactGlow: number;
  /** 1460–1860ms: Single warm-amber indicator line sweeps along screen edge */
  amberSweep: number;
  /** 1460–1860ms: Screen transitions from standby warm-gray to warm-white */
  screenActive: number;
  /** 1720–2250ms: Camera pushes in and calibrates to near-frontal view */
  cameraPush: number;
  /** 1720–2250ms: Title stabilizes first (1720–2000ms) */
  titleReveal: number;
  /** 1840–2250ms: Summary & body fade in after title stabilizes */
  bodyReveal: number;
  /** Whether the confirmation chime at ~1480ms should fire */
  activationReady: boolean;
}

export const OPTICAL_TIMELINE_DURATION = 2.25;

export function evaluateOpticalReaderTimeline(
  seconds: number,
  reduced = false,
): OpticalReaderTimelineFrame {
  if (reduced) {
    const p = clamp01(seconds / 0.18);
    return {
      time: p * OPTICAL_TIMELINE_DURATION,
      progress: p,
      takeover: p,
      verticalLift: p,
      rigDock: p,
      lateralInsert: p,
      contactGlow: p,
      amberSweep: p,
      screenActive: p,
      cameraPush: p,
      titleReveal: p,
      bodyReveal: p,
      activationReady: p > 0.5,
    };
  }

  const t = Math.max(0, Math.min(OPTICAL_TIMELINE_DURATION, seconds));
  const progress = t / OPTICAL_TIMELINE_DURATION;

  // 1. 接管 (0–220ms)
  const takeover = smoothstep(0.0, 0.22, t);
  // 2. 抽离 (100–700ms): pure vertical clearance while keeping array X/Z
  const verticalLift = smootherstep(0.1, 0.7, t);
  // 3. 对接 (520–1100ms): Optical Reader appears in upper space & aligns rail
  const rigDock = smootherstep(0.52, 1.1, t);
  // 4. 插入 (1000–1560ms): Cassette slides laterally into the side slot cavity
  const lateralInsert = insertionCurve((t - 1.0) / 0.56);
  // 5. 激活 (1460–1860ms): Contact points first, then amber edge sweep, then warm-white screen
  const contactGlow = smoothstep(1.44, 1.62, t);
  const amberSweep = smoothstep(1.48, 1.84, t);
  const screenActive = smootherstep(1.52, 1.86, t);
  // 6. 阅读接续 (1720–2250ms): Camera pushes in & calibrates; title first, then summary & body
  const cameraPush = smootherstep(1.15, 2.22, t);
  const titleReveal = smoothstep(1.72, 2.02, t);
  const bodyReveal = smoothstep(1.86, 2.25, t);

  return {
    time: t,
    progress,
    takeover,
    verticalLift,
    rigDock,
    lateralInsert,
    contactGlow,
    amberSweep,
    screenActive,
    cameraPush,
    titleReveal,
    bodyReveal,
    activationReady: t >= 1.48,
  };
}

/**
 * 3D Optical Reader (`读取屏`) mesh rig that docks with the extracted cassette in `ArchiveScene`.
 * Follows Rhine Lab visual language: ivory-white housing, frosted translucent bezel,
 * recessed side slot with rear receiving cavity, two warm-amber contact LEDs,
 * micro-indicator dots, titanium fastener, and warm-white optical screen.
 */
export class OpticalReaderRig {
  readonly group = new THREE.Group();

  private readonly ivoryMat: THREE.MeshPhysicalMaterial;
  private readonlyspineCapMat: THREE.MeshStandardMaterial;
  private readonly slotCavityMat: THREE.MeshStandardMaterial;
  private readonly frostedFrameMat: THREE.MeshPhysicalMaterial;
  private readonly screenSurfaceMat: THREE.MeshStandardMaterial;
  private readonly fastenerMat: THREE.MeshStandardMaterial;
  private readonly microDotMat: THREE.MeshBasicMaterial;
  private readonly contactTopMat: THREE.MeshBasicMaterial;
  private readonly contactBottomMat: THREE.MeshBasicMaterial;
  private readonly amberSweepMat: THREE.MeshBasicMaterial;
  private readonly amberSweepMesh: THREE.Mesh;

  private lastTheme = -1;
  private lastOpacity = -1;
  private lastScreenActive = -1;
  private lastContactGlow = -1;
  private lastSweep = -1;

  constructor() {
    this.group.name = "optical-reader-rig";
    this.group.visible = false;

    this.ivoryMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f0e9e0"),
      roughness: 0.3,
      metalness: 0.04,
      clearcoat: 0.22,
      clearcoatRoughness: 0.28,
      transparent: true,
      opacity: 0,
    });

    this.readonlyspineCapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ddd4c8"),
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      opacity: 0,
    });

    this.slotCavityMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#221f1b"),
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
    });

    this.frostedFrameMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f7f3ec"),
      roughness: 0.22,
      metalness: 0.02,
      transmission: 0.55,
      thickness: 0.08,
      transparent: true,
      opacity: 0,
    });

    this.screenSurfaceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#dbd5cd"),
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 0,
      roughness: 0.45,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
    });

    this.fastenerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6e6a63"),
      roughness: 0.32,
      metalness: 0.72,
      transparent: true,
      opacity: 0,
    });

    this.microDotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#8a8377"),
      transparent: true,
      opacity: 0,
    });

    this.contactTopMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ed821b"),
      transparent: true,
      opacity: 0,
    });

    this.contactBottomMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ed821b"),
      transparent: true,
      opacity: 0,
    });

    this.amberSweepMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ed821b"),
      transparent: true,
      opacity: 0,
    });

    // -------------------------------------------------------------------------
    // Geometry construction (in cassette-aligned coordinates)
    // Cassette spans X: [-2.5, +2.5], Y: [0, 3.7], Z: [-0.255, +0.255].
    // When lateralInsert goes 0 -> 1, the cassette slides +2.15 along X, so its
    // left edge is at X = -0.35 (3.8% of viewport) and slot mouth is at X = +2.52 (28.8%).
    // Spine spans X: [2.52, 3.00] (28.8%..33.0%), Screen spans X: [3.00, 10.25] (33.0%..96.2%).
    // -------------------------------------------------------------------------
    const slotMouthX = 2.52;
    const spineWidth = 0.48;
    const spineCenterX = slotMouthX + spineWidth * 0.5;
    const readerHeight = 4.36;
    const readerCenterY = 1.85;
    const screenWidth = 7.25;
    const screenCenterX = slotMouthX + spineWidth + screenWidth * 0.5;

    // 1. Left Receiver Spine (front & back jaw framing the side slot)
    // Top bridge above slot (Y: 3.74 .. 4.03)
    const topJaw = new THREE.Mesh(
      new THREE.BoxGeometry(spineWidth, 0.3, 0.74),
      this.ivoryMat,
    );
    topJaw.position.set(spineCenterX, 3.88, 0.02);
    this.group.add(topJaw);

    // Bottom bridge below slot (Y: -0.33 .. -0.04)
    const bottomJaw = new THREE.Mesh(
      new THREE.BoxGeometry(spineWidth, 0.3, 0.74),
      this.ivoryMat,
    );
    bottomJaw.position.set(spineCenterX, -0.18, 0.02);
    this.group.add(bottomJaw);

    // Front spine plate (overlaps the slot cavity on the +Z side so the cassette slides behind it)
    const frontSpine = new THREE.Mesh(
      new THREE.BoxGeometry(spineWidth, readerHeight, 0.14),
      this.ivoryMat,
    );
    frontSpine.position.set(spineCenterX, readerCenterY, 0.33);
    frontSpine.castShadow = true;
    frontSpine.receiveShadow = true;
    this.group.add(frontSpine);

    // Inner bevel strip along the right edge of the spine
    const spineSeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, readerHeight, 0.16),
      this.readonlyspineCapMat,
    );
    spineSeam.position.set(slotMouthX + spineWidth, readerCenterY, 0.33);
    this.group.add(spineSeam);

    // Dark recessed side-slot mouth shadow strip (X = slotMouthX, Y: -0.04 .. 3.74)
    const slotShadow = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 3.78, 0.58),
      this.slotCavityMat,
    );
    slotShadow.position.set(slotMouthX + 0.02, 1.85, 0.0);
    this.group.add(slotShadow);

    // Rear receiving chamber housing behind the screen (physically encloses the inserted cassette)
    const rearCavityBack = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, readerHeight - 0.12, 0.12),
      this.ivoryMat,
    );
    rearCavityBack.position.set(slotMouthX + 1.3, readerCenterY, -0.34);
    this.group.add(rearCavityBack);

    // 2. Two warm-amber contact points on the slot lip (top & bottom of slot mouth)
    const contactGeom = new THREE.PlaneGeometry(0.055, 0.11);
    const contactTop = new THREE.Mesh(contactGeom, this.contactTopMat);
    contactTop.position.set(slotMouthX + 0.07, 3.22, 0.405);
    this.group.add(contactTop);

    const contactBottom = new THREE.Mesh(contactGeom, this.contactBottomMat);
    contactBottom.position.set(slotMouthX + 0.07, 0.48, 0.405);
    this.group.add(contactBottom);

    // 3. Micro-indicator dots on the spine face (two groups of 3 vertical dots)
    const dotGeom = new THREE.CircleGeometry(0.018, 12);
    for (const yPos of [2.98, 2.86, 2.74, 0.86, 0.74, 0.62]) {
      const dot = new THREE.Mesh(dotGeom, this.microDotMat);
      dot.position.set(spineCenterX + 0.04, yPos, 0.405);
      this.group.add(dot);
    }

    // 4. Bottom-left titanium screw fastener on the spine
    const fastener = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.02, 20),
      this.fastenerMat,
    );
    fastener.rotation.x = Math.PI / 2;
    fastener.position.set(spineCenterX + 0.02, -0.1, 0.402);
    this.group.add(fastener);

    // 5. Outer Frosted Optical Screen Bezel & Reading Surface
    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(screenWidth + 0.18, readerHeight, 0.22),
      this.frostedFrameMat,
    );
    outerFrame.position.set(screenCenterX + 0.05, readerCenterY, 0.22);
    this.group.add(outerFrame);

    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(screenWidth, readerHeight - 0.18),
      this.screenSurfaceMat,
    );
    screenSurface.position.set(screenCenterX + 0.02, readerCenterY, 0.34);
    this.group.add(screenSurface);

    // 6. Single Warm-Amber Edge Indicator Line (sweeps across top bezel during activation)
    this.amberSweepMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(screenWidth, 0.028),
      this.amberSweepMat,
    );
    this.amberSweepMesh.position.set(
      screenCenterX + 0.02,
      readerCenterY + (readerHeight - 0.18) * 0.5 - 0.015,
      0.345,
    );
    this.group.add(this.amberSweepMesh);
  }

  update(
    frame: OpticalReaderTimelineFrame,
    basePosition: THREE.Vector3,
    themeAmount: number,
    recededAmount = 0,
  ) {
    const visible = frame.rigDock > 0.001;
    this.group.visible = visible;
    if (!visible) return;

    // Position the rig in the upper operation space aligned with the raised cassette.
    // As rigDock progresses 0 -> 1, the rig settles down from +0.55 Y into alignment.
    // When recededAmount > 0 (user scrolls deep into long text), the spine gently shifts left.
    const dockOffsetY = (1 - frame.rigDock) * 0.55;
    const dockOffsetX = (1 - frame.rigDock) * 0.45 - recededAmount * 1.65;
    this.group.position.set(
      basePosition.x + dockOffsetX,
      basePosition.y + dockOffsetY,
      basePosition.z,
    );

    const opacity = clamp01(frame.rigDock * (1 - recededAmount * 0.45));
    if (
      Math.abs(themeAmount - this.lastTheme) > 0.002 ||
      Math.abs(opacity - this.lastOpacity) > 0.002 ||
      Math.abs(frame.screenActive - this.lastScreenActive) > 0.002 ||
      Math.abs(frame.contactGlow - this.lastContactGlow) > 0.002 ||
      Math.abs(frame.amberSweep - this.lastSweep) > 0.002
    ) {
      this.lastTheme = themeAmount;
      this.lastOpacity = opacity;
      this.lastScreenActive = frame.screenActive;
      this.lastContactGlow = frame.contactGlow;
      this.lastSweep = frame.amberSweep;

      const isDark = themeAmount > 0.5;
      this.ivoryMat.color.lerpColors(
        new THREE.Color("#f0e9e0"),
        new THREE.Color("#252f34"),
        themeAmount,
      );
      this.ivoryMat.opacity = opacity;

      this.readonlyspineCapMat.color.lerpColors(
        new THREE.Color("#ddd4c8"),
        new THREE.Color("#323e44"),
        themeAmount,
      );
      this.readonlyspineCapMat.opacity = opacity;

      this.slotCavityMat.opacity = opacity;
      this.frostedFrameMat.color.lerpColors(
        new THREE.Color("#f7f3ec"),
        new THREE.Color("#1d262a"),
        themeAmount,
      );
      this.frostedFrameMat.opacity = opacity * 0.92;

      // Screen transitions from standby warm-gray to warm-white (or dark slate in dark mode)
      const standbyColor = new THREE.Color().lerpColors(
        new THREE.Color("#dcd6ce"),
        new THREE.Color("#141b1e"),
        themeAmount,
      );
      const activeColor = new THREE.Color().lerpColors(
        new THREE.Color("#fbf9f5"),
        new THREE.Color("#182125"),
        themeAmount,
      );
      this.screenSurfaceMat.color.lerpColors(
        standbyColor,
        activeColor,
        frame.screenActive,
      );
      this.screenSurfaceMat.emissive.set(isDark ? "#1c262b" : "#fffcf7");
      this.screenSurfaceMat.emissiveIntensity =
        frame.screenActive * (isDark ? 0.22 : 0.32);
      this.screenSurfaceMat.opacity = opacity;

      this.fastenerMat.opacity = opacity;
      this.microDotMat.opacity = opacity * 0.75;

      // Contact LEDs glow warm amber
      const contactAlpha = opacity * frame.contactGlow;
      this.contactTopMat.opacity = contactAlpha;
      this.contactBottomMat.opacity = contactAlpha;

      // Single warm-amber sweep line along top edge
      const sweepScale = Math.max(0.001, frame.amberSweep);
      this.amberSweepMesh.scale.x = sweepScale;
      this.amberSweepMat.opacity =
        opacity *
        (frame.amberSweep > 0.01 ? 0.85 - frame.cameraPush * 0.35 : 0);
    }
  }

  projectScreenBounds(camera: THREE.Camera): {
    leftPct: number;
    topPct: number;
    widthPct: number;
    heightPct: number;
  } {
    this.group.updateMatrixWorld(true);
    const tl = new THREE.Vector3(3.0, 3.94, 0.34)
      .applyMatrix4(this.group.matrixWorld)
      .project(camera);
    const br = new THREE.Vector3(10.25, -0.24, 0.34)
      .applyMatrix4(this.group.matrixWorld)
      .project(camera);
    const leftPct = clamp01((tl.x + 1) * 0.5) * 100;
    const rightPct = clamp01((br.x + 1) * 0.5) * 100;
    const topPct = clamp01((1 - tl.y) * 0.5) * 100;
    const bottomPct = clamp01((1 - br.y) * 0.5) * 100;
    return {
      leftPct: Math.max(4, Math.min(42, leftPct)),
      topPct: Math.max(6, Math.min(28, topPct)),
      widthPct: Math.max(50, Math.min(92, rightPct - leftPct)),
      heightPct: Math.max(58, Math.min(88, bottomPct - topPct)),
    };
  }
}
