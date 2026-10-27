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

export type StudioEntrySource = "library" | "archive" | "reader";

export const STUDIO_LIBRARY_DURATION = 1.3;
export const STUDIO_ARCHIVE_DURATION = 1.8;

export function studioTimelineDuration(source: StudioEntrySource): number {
  return source === "library"
    ? STUDIO_LIBRARY_DURATION
    : STUDIO_ARCHIVE_DURATION;
}

export interface StudioTrayTimelineFrame {
  source: StudioEntrySource;
  time: number;
  duration: number;
  progress: number;
  /** 0–160ms (library) or 0–180ms (archive): Immediate button response & lock */
  responseAck: number;
  /** 100–400ms (library): Glass Index Desk retreats slightly to make room in front */
  indexBridgeRetreat: number;
  /** Pure vertical clearance in the original array slot before any lateral/forward transfer */
  verticalClearance: number;
  /** Tray sliding forward along the left/right guide rails */
  traySlide: number;
  /** Cassette orientation & transfer from array clearance into the left cassette bay */
  cassetteTransfer: number;
  /** Final decelerated seating into the left shallow cassette bay */
  cassetteDock: number;
  /** Camera framing alignment to near-orthographic studio input view */
  cameraFrame: number;
  /** Warm-amber contact lamp illumination in the left cassette bay */
  contactGlow: number;
  /** Sequential reveal of title, metadata, and body on the right writing surface */
  editorReveal: number;
  /** True when the tray has fully settled and input focus can be handed over */
  settled: boolean;
}

/**
 * Evaluates the interruptible, bidirectional Sliding Studio timeline:
 * - From 2D Index Desk (`source === "library"`): 1.30s total
 *   (0.00s 索引选中 -> 0.35s 托盘展开 -> 0.85s 档案停靠 -> 1.30s 编辑接管)
 * - From 3D Archive Hall (`source === "archive" | "reader"`): 1.80s total
 *   (0.00s 当前选档 -> 0.55s 竖直净空 -> 1.15s 转向停靠 -> 1.80s 编辑接管)
 */
export function evaluateStudioTrayTimeline(
  seconds: number,
  source: StudioEntrySource = "library",
  reduced = false,
): StudioTrayTimelineFrame {
  const duration = studioTimelineDuration(source);
  if (reduced) {
    const p = clamp01(seconds / 0.16);
    return {
      source,
      time: p * duration,
      duration,
      progress: p,
      responseAck: p > 0.01 ? 1 : 0,
      indexBridgeRetreat: p,
      verticalClearance: p,
      traySlide: p,
      cassetteTransfer: p,
      cassetteDock: p,
      cameraFrame: p,
      contactGlow: p,
      editorReveal: p,
      settled: p >= 0.99,
    };
  }

  const t = Math.max(0, Math.min(duration, seconds));
  const progress = t / duration;

  if (source === "library") {
    // Section 5: 2D Index -> Sliding Studio (1.30s)
    // 0-160ms: Selected row responds
    const responseAck = smoothstep(0.0, 0.16, t);
    // 100-400ms: Directory fades out, Glass Index Bridge retreats slightly
    const indexBridgeRetreat = smootherstep(0.1, 0.4, t);
    // 240-580ms: Target cassette rises vertically in its original array slot for clearance
    const verticalClearance = smootherstep(0.2, 0.54, t);
    // 240-800ms: Sliding Studio Tray slides forward along side guide rails
    const traySlide = smootherstep(0.24, 0.8, t);
    // 480-1040ms: Cassette turns and transfers toward the left cassette bay (only after clearance)
    const cassetteTransfer = smootherstep(0.46, 1.02, t);
    // 700-1080ms: Cassette settles into the left shallow cassette bay
    const cassetteDock = smootherstep(0.7, 1.08, t);
    // 240-1080ms: Camera follows tray and stabilizes into studio input framing
    const cameraFrame = smootherstep(0.24, 1.08, t);
    // 880-1120ms: Contact lamp illuminates softly
    const contactGlow = smoothstep(0.88, 1.12, t);
    // 980-1300ms: Title, metadata, and body appear sequentially
    const editorReveal = smootherstep(0.98, 1.3, t);

    return {
      source,
      time: t,
      duration,
      progress,
      responseAck,
      indexBridgeRetreat,
      verticalClearance,
      traySlide,
      cassetteTransfer,
      cassetteDock,
      cameraFrame,
      contactGlow,
      editorReveal,
      settled: t >= duration - 0.015,
    };
  }

  // Section 6: 3D Archive Hall -> Sliding Studio (1.80s)
  // 0-180ms: Edit action responds, detail text fades out
  const responseAck = smoothstep(0.0, 0.18, t);
  // 100-600ms: Cassette stays at original X/Z in array and only lifts vertically to clearance
  const verticalClearance = smootherstep(0.1, 0.6, t);
  // 450-1100ms: Camera turns toward front studio tray; tray slides out along side rails
  const traySlide = smootherstep(0.45, 1.1, t);
  const cameraFrame = smootherstep(0.45, 1.38, t);
  // 560-1420ms: Only after vertical clearance (t >= 0.52s) does cassette turn & move toward bay
  const cassetteTransfer = smootherstep(0.54, 1.4, t);
  // 950-1450ms: Cassette decelerates into left cassette bay without bounce
  const cassetteDock = smootherstep(0.95, 1.45, t);
  // 1120-1460ms: Contact lamp illuminates softly
  const contactGlow = smoothstep(1.12, 1.46, t);
  // 1350-1800ms: Writing surface appears layer by layer
  const editorReveal = smootherstep(1.35, 1.8, t);

  return {
    source,
    time: t,
    duration,
    progress,
    responseAck,
    indexBridgeRetreat: 0,
    verticalClearance,
    traySlide,
    cassetteTransfer,
    cassetteDock,
    cameraFrame,
    contactGlow,
    editorReveal,
    settled: t >= duration - 0.015,
  };
}

/**
 * 3D Sliding Studio Tray (录入托盘) carrier.
 * Renders the low-profile side guide rails, shallow left cassette bay,
 * warm-amber contact indicator light, and front frosted tray lip beneath the DOM writing surface.
 */
export class StudioTrayRig {
  readonly group = new THREE.Group();
  private readonly trayFrame: THREE.Mesh;
  private readonly bayWell: THREE.Mesh;
  private readonly leftRail: THREE.Mesh;
  private readonly rightRail: THREE.Mesh;
  private readonly contactLamp: THREE.Mesh;
  private readonly contactHalo: THREE.Mesh;
  private readonly frameMaterial: THREE.MeshPhysicalMaterial;
  private readonly bayMaterial: THREE.MeshStandardMaterial;
  private readonly railMaterial: THREE.MeshStandardMaterial;
  private readonly contactMaterial: THREE.MeshBasicMaterial;
  private readonly haloMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.group.name = "SlidingStudioTrayRig";
    this.group.visible = false;

    this.frameMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf4f1ea),
      roughness: 0.3,
      metalness: 0.08,
      transmission: 0.35,
      thickness: 0.25,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.bayMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe6e1d6),
      roughness: 0.42,
      metalness: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdad4c8),
      roughness: 0.34,
      metalness: 0.24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.contactMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xed821b),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xed821b),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Front tray lip & bevelled frame
    const frameGeo = new THREE.BoxGeometry(14.8, 0.14, 0.42);
    this.trayFrame = new THREE.Mesh(frameGeo, this.frameMaterial);
    this.trayFrame.position.set(0, -1.75, 2.2);

    // Left recessed cassette bay cradle
    const bayGeo = new THREE.BoxGeometry(2.75, 3.85, 0.18);
    this.bayWell = new THREE.Mesh(bayGeo, this.bayMaterial);
    this.bayWell.position.set(-4.85, 0.05, 1.65);

    // Left & right low-profile sliding guide rails
    const railGeo = new THREE.BoxGeometry(0.08, 4.6, 0.28);
    this.leftRail = new THREE.Mesh(railGeo, this.railMaterial);
    this.leftRail.position.set(-7.45, 0.1, 1.85);

    this.rightRail = new THREE.Mesh(railGeo, this.railMaterial);
    this.rightRail.position.set(7.45, 0.1, 1.85);

    // Warm-amber contact lamp at bottom-left of cassette bay
    const lampGeo = new THREE.BoxGeometry(0.06, 0.42, 0.06);
    this.contactLamp = new THREE.Mesh(lampGeo, this.contactMaterial);
    this.contactLamp.position.set(-5.98, -1.32, 1.92);

    const haloGeo = new THREE.PlaneGeometry(0.42, 0.85);
    this.contactHalo = new THREE.Mesh(haloGeo, this.haloMaterial);
    this.contactHalo.position.set(-5.98, -1.32, 1.94);

    this.group.add(
      this.trayFrame,
      this.bayWell,
      this.leftRail,
      this.rightRail,
      this.contactLamp,
      this.contactHalo,
    );
  }

  /**
   * Computes the target world position and rotation for the active 3D cassette (`this.model`)
   * when docked inside the left 18-21% cassette bay of the Sliding Studio Tray.
   * Keeps the original cassette aspect ratio, twin rings, and nameplate completely intact.
   */
  getDockedCassettePose(
    cameraAim: THREE.Vector3,
    viewDirection: THREE.Vector3,
    isPortraitOrCompact: boolean,
  ): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
      .normalize();
    const up = new THREE.Vector3()
      .crossVectors(viewDirection, right)
      .normalize();

    // Place the cassette in the left cassette dock bay (-4.05 units left of center aim,
    // centered vertically in the lower-left bay of the tray)
    const bayLateralOffset = isPortraitOrCompact ? -2.2 : -4.08;
    const bayVerticalOffset = isPortraitOrCompact ? -1.45 : -2.24;
    const bayDepthOffset = 3.2;

    const position = cameraAim
      .clone()
      .addScaledVector(right, bayLateralOffset)
      .addScaledVector(up, bayVerticalOffset)
      .addScaledVector(viewDirection, bayDepthOffset);

    // Orient the cassette so its front cover and twin rings face the camera cleanly
    // with a subtle 5-degree instrument tray inclination (never stretching geometry)
    const lookMatrix = new THREE.Matrix4().lookAt(
      viewDirection.clone().multiplyScalar(10),
      new THREE.Vector3(0, 0, 0),
      up,
    );
    const tiltQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(THREE.MathUtils.degToRad(-5.5), 0, 0),
    );
    const quaternion = new THREE.Quaternion()
      .setFromRotationMatrix(lookMatrix)
      .multiply(tiltQuat);

    return { position, quaternion };
  }

  update(
    frame: StudioTrayTimelineFrame,
    cameraAim: THREE.Vector3,
    viewDirection: THREE.Vector3,
    hasTargetCassette: boolean,
    saveContactPulse: number,
    themeAmount: number,
  ) {
    if (frame.traySlide <= 0.001 && frame.responseAck <= 0.001) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
      .normalize();
    const up = new THREE.Vector3()
      .crossVectors(viewDirection, right)
      .normalize();

    // Slide the tray forward along the guide rails as traySlide goes 0 -> 1
    const slideOffsetY = (1 - frame.traySlide) * -1.45;
    const slideOffsetZ = (1 - frame.traySlide) * -3.2;

    const centerPos = cameraAim
      .clone()
      .addScaledVector(up, slideOffsetY - 0.18)
      .addScaledVector(viewDirection, 1.8 + slideOffsetZ);

    this.group.position.copy(centerPos);
    const lookMat = new THREE.Matrix4().lookAt(
      viewDirection.clone().multiplyScalar(10),
      new THREE.Vector3(0, 0, 0),
      up,
    );
    this.group.quaternion.setFromRotationMatrix(lookMat);

    // Theme adaptation (Light warm ivory vs Dark graphite)
    this.frameMaterial.color.setHex(themeAmount > 0.5 ? 0x243035 : 0xf4f1ea);
    this.bayMaterial.color.setHex(themeAmount > 0.5 ? 0x1b2428 : 0xe6e1d6);
    this.railMaterial.color.setHex(themeAmount > 0.5 ? 0x3b484e : 0xdad4c8);

    const trayAlpha = frame.traySlide * (1 - frame.editorReveal * 0.35);
    this.frameMaterial.opacity = trayAlpha * 0.48;
    this.bayMaterial.opacity = trayAlpha * 0.42;
    this.railMaterial.opacity = frame.traySlide * 0.65;

    const contactIntensity = hasTargetCassette
      ? Math.min(1, frame.contactGlow * 0.85 + saveContactPulse * 0.9)
      : saveContactPulse * 0.6;
    this.contactMaterial.opacity = contactIntensity;
    this.haloMaterial.opacity =
      contactIntensity * (0.35 + saveContactPulse * 0.45);
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    this.frameMaterial.dispose();
    this.bayMaterial.dispose();
    this.railMaterial.dispose();
    this.contactMaterial.dispose();
    this.haloMaterial.dispose();
  }
}
