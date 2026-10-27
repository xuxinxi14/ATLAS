import type { RouteView } from "./app/router.ts";

export type HomeDestination = "library" | "archive" | "reader" | "studio";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const homeTransitDuration = (destination: HomeDestination) =>
  ({ library: 1.1, archive: 1.35, studio: 1.4, reader: 2.05 })[destination];

export interface HomeTransitFrame {
  progress: number;
  homeOpacity: number;
  shellOpacity: number;
  otherOpacity: number;
  anchorOpacity: number;
  retreat: number;
  cameraMix: number;
  rigPresence: number;
  observationMix: number;
}

/** progress = 0 at the observation deck, 1 at the destination. Reversing uses
 * the same sampled positions: neither the slab nor camera resets on Escape. */
export function evaluateHomeTransit(
  progress: number,
  destination: HomeDestination,
  reduced = false,
): HomeTransitFrame {
  const p = clamp(progress);
  if (reduced)
    return {
      progress: p,
      homeOpacity: 1 - p,
      shellOpacity: 1 - p,
      otherOpacity: p,
      anchorOpacity: 0,
      retreat: 0,
      cameraMix: 0,
      rigPresence: 0,
      observationMix: 0,
    };
  const t = p * (destination === "library" ? 1.1 : 1.35);
  const library = destination === "library";
  return {
    progress: p,
    homeOpacity: 1 - smooth(0.08, 0.32, t),
    shellOpacity: 1 - smooth(library ? 0.5 : 0.58, library ? 0.98 : 1.0, t),
    otherOpacity: library
      ? smooth(0.57, 1.08, t)
      : destination === "archive"
        ? smooth(0.98, 1.35, t)
        : smooth(0.34, 0.96, t),
    anchorOpacity: smooth(0.1, 0.28, t) * (1 - smooth(0.53, 0.82, t)),
    retreat: library ? 0 : smooth(0.18, 0.64, t),
    // Camera only enters the array after the near edge has fully cleared.
    cameraMix: 1 - smooth(library ? 0.18 : 0.64, library ? 0.98 : 1.18, t),
    rigPresence: library ? 1 - p : 1 - smooth(0.88, 1.25, t),
    observationMix: 1 - smooth(library ? 0.18 : 0.64, library ? 0.98 : 1.18, t),
  };
}

/** A single reversible clock, shared by DOM and the existing Three.js rig.
 * Retargeting never restarts progress; rapid navigation keeps the current pose. */
export class HomeTransitClock {
  progress = 1;
  destination: HomeDestination = "archive";
  reduced = false;
  private target = 1;
  private lastTime = 0;
  private duration = 1.35;
  get active() {
    return Math.abs(this.progress - this.target) > 0.00001;
  }

  navigate(
    from: RouteView,
    to: RouteView,
    now: number,
    animate: boolean,
    reduced: boolean,
  ) {
    this.update(now);
    if (from !== "home" && to !== "home" && !this.active) return;
    if (!this.active) {
      this.destination = (to === "home" ? from : to) as HomeDestination;
      if (
        !["library", "archive", "reader", "studio"].includes(this.destination)
      ) {
        this.destination = "archive";
      }
    }
    this.reduced = reduced;
    this.duration = reduced ? 0.16 : homeTransitDuration(this.destination);
    this.target = to === "home" ? 0 : 1;
    if (!animate) this.progress = this.target;
    this.lastTime = now;
  }

  update(now: number) {
    if (this.lastTime && this.active) {
      const step = Math.max(0, now - this.lastTime) / (this.duration * 1000);
      this.progress +=
        Math.sign(this.target - this.progress) *
        Math.min(Math.abs(this.target - this.progress), step);
    }
    this.lastTime = now;
    return evaluateHomeTransit(this.progress, this.destination, this.reduced);
  }
}
