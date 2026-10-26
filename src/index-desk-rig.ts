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

export const INDEX_DESK_TIMELINE_DURATION = 1.25;

export interface IndexDeskTimelineFrame {
  /**
   * Transition clock in seconds (0.00s = settled in 2D Index Desk,
   * 1.25s = settled in 3D Archive Hall).
   */
  time: number;
  /** Normalized 0..1 progress from 2D Index Desk (0) to 3D Archive Hall (1) */
  progress: number;
  /** Normalized 1..0 presence of the 2D Index Desk (1 = settled in 2D, 0 = settled in 3D) */
  deskPresence: number;
  /** 0–160ms: Immediate action response & state lock */
  responseAck: number;
  /** 80–340ms: Directory text and secondary controls fade out (0 = visible, 1 = faded) */
  directoryFade: number;
  /** Opacity of full directory text and controls (1 -> 0 during 80–340ms) */
  directoryOpacity: number;
  /**
   * Opacity of the single selected anchor ("■ T-001 Title") which stays visible
   * through 02 台面退让 (350ms) and fades out as the desk retreats (360–640ms).
   */
  selectedAnchorOpacity: number;
  /** 180–650ms: Desk lifts and retreats backward along the side guide rails */
  deskRetreat: number;
  /** 440–1060ms: Camera lowers and dives through under-desk clearance into the array */
  cameraDive: number;
  /** 1 - cameraDive: how much the camera is at the elevated Retrieval Bridge vantage */
  cameraBridgeMix: number;
  /** 860–1250ms: Positioning signal hands over to 3D cassette & 3D Hall HUD restores */
  hudHandover: number;
}

/**
 * Evaluates the 1.25s bidirectional transition timeline between the 2D Glass Index Desk
 * (seconds = 0.00) and the 3D Archive Hall (seconds = 1.25).
 * Reverse transitions (3D -> 2D) run the exact same function as `seconds` counts down
 * from 1.25 to 0.00, guaranteeing velocity/pose continuity and mid-way Esc reversal.
 */
export function evaluateIndexDeskTimeline(
  seconds: number,
  reduced = false,
): IndexDeskTimelineFrame {
  if (reduced) {
    const p = clamp01(seconds / INDEX_DESK_TIMELINE_DURATION);
    const inv = 1 - p;
    return {
      time: p * INDEX_DESK_TIMELINE_DURATION,
      progress: p,
      deskPresence: inv,
      responseAck: p > 0.01 ? 1 : 0,
      directoryFade: p,
      directoryOpacity: inv,
      selectedAnchorOpacity: inv,
      deskRetreat: p,
      cameraDive: p,
      cameraBridgeMix: inv,
      hudHandover: p,
    };
  }

  const t = Math.max(0, Math.min(INDEX_DESK_TIMELINE_DURATION, seconds));
  const progress = t / INDEX_DESK_TIMELINE_DURATION;

  // 1. 0–160ms: Action response & state lock
  const responseAck = smoothstep(0.0, 0.16, t);
  // 2. 80–340ms: Directory text and secondary controls fade out
  const directoryFade = smoothstep(0.08, 0.34, t);
  const directoryOpacity = 1 - directoryFade;
  // Selected code & short amber marker remain visible during 80–360ms (02 台面退让)
  // and fade out cleanly between 360ms and 640ms
  const selectedAnchorOpacity = 1 - smoothstep(0.36, 0.64, t);
  // 3. 180–650ms: Desk lifts slightly and retreats along side guide rails
  const deskRetreat = smootherstep(0.18, 0.65, t);
  // 4. 440–1060ms: Camera lowers, pitches, and enters the array beneath the front lip
  const cameraDive = smootherstep(0.44, 1.06, t);
  const cameraBridgeMix = 1 - cameraDive;
  // 5. 860–1250ms: Positioning signal hands over to 3D cassette & 3D HUD restores
  const hudHandover = smoothstep(0.86, 1.25, t);

  return {
    time: t,
    progress,
    deskPresence: 1 - progress,
    responseAck,
    directoryFade,
    directoryOpacity,
    selectedAnchorOpacity,
    deskRetreat,
    cameraDive,
    cameraBridgeMix,
    hudHandover,
  };
}

/**
 * 3D Retrieval Bridge & Under-Desk Positioning Rig (`检索桥 / 玻璃索引台`).
 * Provides the physical side guide rails, retreating glass bridge lip, front array apron,
 * and localized warm-amber positioning signal on the selected archive cassette beneath the desk.
 */
export class IndexDeskRig {
  readonly group = new THREE.Group();
  private readonly bridgeAssembly = new THREE.Group();
  private readonly railAssembly = new THREE.Group();
  private readonly locatorAssembly = new THREE.Group();

  private readonly glassMat: THREE.MeshPhysicalMaterial;
  private readonly ivoryRimMat: THREE.MeshStandardMaterial;
  private readonly railMat: THREE.MeshStandardMaterial;
  private readonly apronMat: THREE.MeshStandardMaterial;
  private readonly amberBarMat: THREE.MeshBasicMaterial;
  private readonly amberHaloMat: THREE.MeshBasicMaterial;
  private readonly amberLight: THREE.PointLight;

  constructor() {
    this.group.name = "AtlasIndexDeskRig";
    this.group.visible = false;

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f1ea,
      roughness: 0.2,
      metalness: 0.02,
      transmission: 0.68,
      thickness: 0.35,
      ior: 1.46,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.ivoryRimMat = new THREE.MeshStandardMaterial({
      color: 0xeae5dc,
      roughness: 0.32,
      metalness: 0.18,
      transparent: true,
      opacity: 0,
    });

    this.railMat = new THREE.MeshStandardMaterial({
      color: 0xc8c3b8,
      roughness: 0.28,
      metalness: 0.58,
      transparent: true,
      opacity: 0,
    });

    this.apronMat = new THREE.MeshStandardMaterial({
      color: 0xe3ded4,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 0,
    });

    this.amberBarMat = new THREE.MeshBasicMaterial({
      color: 0xed821b,
      transparent: true,
      opacity: 0,
    });

    this.amberHaloMat = new THREE.MeshBasicMaterial({
      color: 0xffa64d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    // 1. Left & Right low-profile guide rails (支承与导轨)
    const railGeo = new THREE.BoxGeometry(0.14, 0.18, 12.5);
    const leftRail = new THREE.Mesh(railGeo, this.railMat);
    leftRail.position.set(-8.8, 2.35, -1.5);
    const rightRail = new THREE.Mesh(railGeo, this.railMat);
    rightRail.position.set(8.8, 2.35, -1.5);

    const bracketGeo = new THREE.BoxGeometry(0.22, 0.75, 0.28);
    const leftBracket = new THREE.Mesh(bracketGeo, this.railMat);
    leftBracket.position.set(-8.8, 2.05, 4.35);
    const rightBracket = new THREE.Mesh(bracketGeo, this.railMat);
    rightBracket.position.set(8.8, 2.05, 4.35);

    // Front recessed bay apron (台下阵列前缘护框)
    const frontApronGeo = new THREE.BoxGeometry(19.2, 0.65, 0.45);
    const frontApron = new THREE.Mesh(frontApronGeo, this.apronMat);
    frontApron.position.set(0, -1.35, 5.25);

    this.railAssembly.add(
      leftRail,
      rightRail,
      leftBracket,
      rightBracket,
      frontApron,
    );

    // 2. Retreating Glass Bridge Slab & Front Lip (台面玻璃前缘与窄象牙边)
    const frontLipGlassGeo = new THREE.BoxGeometry(17.4, 0.22, 0.48);
    const frontLipGlass = new THREE.Mesh(frontLipGlassGeo, this.glassMat);
    frontLipGlass.position.set(0, 2.65, 3.85);

    const frontIvoryTrimGeo = new THREE.BoxGeometry(17.52, 0.07, 0.08);
    const frontIvoryTrim = new THREE.Mesh(frontIvoryTrimGeo, this.ivoryRimMat);
    frontIvoryTrim.position.set(0, 2.76, 4.08);

    const leftRimGeo = new THREE.BoxGeometry(0.12, 0.16, 8.8);
    const leftRim = new THREE.Mesh(leftRimGeo, this.ivoryRimMat);
    leftRim.position.set(-8.68, 2.7, -0.3);
    const rightRim = new THREE.Mesh(leftRimGeo, this.ivoryRimMat);
    rightRim.position.set(8.68, 2.7, -0.3);

    this.bridgeAssembly.add(
      frontLipGlass,
      frontIvoryTrim,
      leftRim,
      rightRim,
    );

    // 3. Localized Warm-Amber Positioning Signal (台下局部琥珀定位信号)
    const amberStripGeo = new THREE.BoxGeometry(0.16, 0.12, 3.85);
    const amberStrip = new THREE.Mesh(amberStripGeo, this.amberBarMat);
    amberStrip.position.set(0, 2.02, 0);

    const amberHaloGeo = new THREE.BoxGeometry(0.95, 0.06, 4.1);
    const amberHalo = new THREE.Mesh(amberHaloGeo, this.amberHaloMat);
    amberHalo.position.set(0, 2.04, 0);

    this.amberLight = new THREE.PointLight(0xed821b, 0, 6.8, 1.7);
    this.amberLight.position.set(0, 2.55, 0.8);

    this.locatorAssembly.add(amberStrip, amberHalo, this.amberLight);

    this.group.add(
      this.railAssembly,
      this.bridgeAssembly,
      this.locatorAssembly,
    );
  }

  update(
    frame: IndexDeskTimelineFrame,
    selectedCassettePos: THREE.Vector3,
    hasValid3DTarget: boolean,
    themeAmount: number,
  ) {
    // Visible whenever not completely settled in 3D Archive Hall
    const active = frame.progress < 0.998;
    this.group.visible = active;
    if (!active) {
      this.amberLight.intensity = 0;
      return;
    }

    // Dark/light material adaptation
    this.ivoryRimMat.color.setHex(themeAmount > 0.5 ? 0x2a353a : 0xeae5dc);
    this.apronMat.color.setHex(themeAmount > 0.5 ? 0x1c2529 : 0xe3ded4);
    this.railMat.color.setHex(themeAmount > 0.5 ? 0x56646a : 0xc8c3b8);
    this.glassMat.color.setHex(themeAmount > 0.5 ? 0x222d32 : 0xf4f1ea);

    // During 180–650ms (deskRetreat: 0 -> 1), the bridge slab lifts (+2.25 Y)
    // and slides backward (-5.6 Z) along the side guide rails so the camera
    // passes cleanly through the real clearance beneath the front lip!
    const retreat = frame.deskRetreat;
    const bridgeVisibility = clamp01(1 - smoothstep(0.55, 0.92, frame.progress));

    this.bridgeAssembly.position.set(
      selectedCassettePos.x * 0.15,
      retreat * 2.35,
      -retreat * 5.8,
    );
    this.bridgeAssembly.rotation.x = THREE.MathUtils.degToRad(-4 * retreat);

    this.railAssembly.position.set(
      selectedCassettePos.x * 0.15,
      retreat * 1.1,
      -retreat * 2.4,
    );

    this.glassMat.opacity = bridgeVisibility * 0.72;
    this.ivoryRimMat.opacity = bridgeVisibility * 0.92;
    this.railMat.opacity = bridgeVisibility * 0.85;
    this.apronMat.opacity = clamp01(1 - frame.cameraDive * 1.25) * 0.94;

    // Localized warm-amber positioning signal on the selected cassette in the array:
    // Active in 2D Index Desk (when hasValid3DTarget is true) and hands over during 860–1250ms
    const signalStrength = hasValid3DTarget
      ? clamp01(1 - frame.hudHandover * 0.92)
      : 0;

    this.locatorAssembly.visible = signalStrength > 0.005;
    this.locatorAssembly.position.copy(selectedCassettePos);
    this.amberBarMat.opacity = signalStrength * 0.95;
    this.amberHaloMat.opacity = signalStrength * 0.36;
    this.amberLight.intensity = signalStrength * 2.8;
  }

  dispose() {
    this.glassMat.dispose();
    this.ivoryRimMat.dispose();
    this.railMat.dispose();
    this.apronMat.dispose();
    this.amberBarMat.dispose();
    this.amberHaloMat.dispose();
  }
}
