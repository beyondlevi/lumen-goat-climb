import {phaseAt} from './phases';
import {Rng} from './rng';

/** The logical screen: the Rokid HUD, portrait. Everything is drawn in these units. */
export const WIDTH = 480;
export const HEIGHT = 640;

/** Physics, in px and seconds. y grows downward; climbing makes y negative. */
export const GRAVITY = 1500;
/** Straight up: about 200 px high. */
export const JUMP_UP = 780;
/** Up and to a side: about 170 px high. */
export const JUMP_SIDE = 720;
export const SIDE_SPEED = 230;
/** 10 px of height make one meter. */
export const PX_PER_METER = 10;

export type LedgeKind = 'grass' | 'wood' | 'rock' | 'crack' | 'ice' | 'cloud';

export interface Ledge {
  id: number;
  kind: LedgeKind;
  /** Left edge now (it moves on a sliding ledge). */
  x: number;
  /** The top surface, world y. */
  y: number;
  w: number;
  /** Sliding: x = baseX + amp * sin(2π t / period + offset). */
  baseX: number;
  amp: number;
  period: number;
  offset: number;
  /** A cracked ledge falls from this time on (null: not landed on yet). */
  crumbleAt: number | null;
  /** A cloud fades out from this time on. */
  fadeAt: number | null;
  /** Falling (a cracked ledge after its time): its speed. */
  fallSpeed: number;
  /** Gone for good (a faded cloud, a fallen ledge off screen). */
  gone: boolean;
}

/** Seconds a cracked ledge holds after the goat lands on it. */
export const CRUMBLE_DELAY = 0.45;
/** Seconds a cloud holds after the goat lands on it. */
export const CLOUD_DELAY = 1.3;

/** The time to come down onto a surface [rise] px above the take-off with vertical speed [v], or null. */
export function airtime(v: number, rise: number): number | null {
  const d = v * v - 2 * GRAVITY * rise;
  if (d < 0) return null;
  return (v + Math.sqrt(d)) / GRAVITY;
}

/** How far sideways the goat can get while climbing [rise] px with a side jump. */
export function reach(rise: number): number {
  const t = airtime(JUMP_SIDE, rise);
  return t === null ? 0 : t * SIDE_SPEED;
}

/** Horizontal distance on a screen whose sides wrap around. */
export function wrappedDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % WIDTH;
  return Math.min(d, WIDTH - d);
}

const MARGIN = 8;
/** A ledge that goes away sits at most this far above the one below it. */
const TEMPORARY_GAP = 80;
/** Skipping a ledge that went away: the climb from the ledge below it stays under this. */
const SKIP_RISE = 165;

function temporary(kind: LedgeKind): boolean {
  return kind === 'crack' || kind === 'cloud';
}

/** The mountain: ledges generated above the goat as it climbs, the same for the same seed. */
export class World {
  readonly ledges: Ledge[] = [];
  private readonly rng: Rng;
  private nextId = 1;
  private top: Ledge;
  /** The highest ledge that stays (not cracked, not a cloud). */
  private lastSolid: Ledge;

  constructor(seed: number) {
    this.rng = new Rng(seed);
    // The meadow's floor, the whole width: a first jump that misses lands back on it.
    this.top = this.add('grass', MARGIN, 0, WIDTH - 2 * MARGIN);
    this.lastSolid = this.top;
  }

  /** The ledge the goat starts on. */
  get start(): Ledge {
    return this.ledges[0];
  }

  /** Makes sure there are ledges up to world y [above] (a negative y, higher up). */
  generateUntil(above: number): void {
    while (this.top.y > above) this.top = this.nextLedge(this.top);
  }

  /** Drops what fell below world y [below]. */
  prune(below: number): void {
    for (let i = this.ledges.length - 1; i >= 0; i--) {
      if (this.ledges[i].y > below) this.ledges.splice(i, 1);
    }
  }

  /** Moves sliding ledges and drops fallen ones at time [t] (s), [dt] since the last step. */
  update(t: number, dt: number): void {
    for (const ledge of this.ledges) {
      if (ledge.amp > 0 && ledge.crumbleAt === null) {
        ledge.x = ledge.baseX + ledge.amp * Math.sin((2 * Math.PI * t) / ledge.period + ledge.offset);
      }
      if (ledge.crumbleAt !== null && t >= ledge.crumbleAt) {
        ledge.fallSpeed += GRAVITY * dt;
        ledge.y += ledge.fallSpeed * dt;
      }
      if (ledge.fadeAt !== null && t >= ledge.fadeAt + 0.4) ledge.gone = true;
    }
  }

  /** Whether the goat can stand on [ledge] now. */
  static solid(ledge: Ledge, t: number): boolean {
    if (ledge.gone) return false;
    if (ledge.crumbleAt !== null && t >= ledge.crumbleAt) return false;
    if (ledge.fadeAt !== null && t >= ledge.fadeAt) return false;
    return true;
  }

  private nextLedge(below: Ledge): Ledge {
    const meters = -below.y / PX_PER_METER;
    const phase = phaseAt(meters);
    const roll = this.rng.next();
    const plain: LedgeKind = phase.key === 'meadow' ? 'grass' : phase.key === 'forest' ? 'wood' : 'rock';
    let kind: LedgeKind;
    if (roll < phase.cloud) kind = 'cloud';
    else if (roll < phase.cloud + phase.ice) kind = 'ice';
    else if (roll < phase.cloud + phase.ice + phase.cracked) kind = 'crack';
    else kind = plain;
    // A ledge that goes away (cracked, a cloud) is a step, never the only way up: never two in a
    // row, it sits low, and the next ledge is reachable from the one below it too.
    const belowTemporary = temporary(below.kind);
    if (belowTemporary && temporary(kind)) kind = plain;
    let gap = this.rng.range(phase.gap[0], phase.gap[1]);
    if (temporary(kind)) gap = Math.min(gap, TEMPORARY_GAP);
    if (belowTemporary) gap = Math.min(gap, Math.max(40, SKIP_RISE - (this.lastSolid.y - below.y)));
    const y = below.y - gap;
    const w = Math.round(this.rng.range(phase.width[0], phase.width[1]));
    const anchors = belowTemporary ? [below, this.lastSolid] : [below];
    const limits = anchors.map((from) => {
      const rise = from.y - y;
      // Three quarters of what a side jump reaches at that rise (sides wrapping), and close
      // enough that a goat standing at the far end of the ledge below still makes it.
      return Math.max(30, Math.min(reach(rise) * 0.7, reach(rise) * 0.72 - from.w / 2 + w / 2));
    });
    const fits = (x: number) => anchors.every((from, i) => wrappedDistance(x + w / 2, from.baseX + from.w / 2) <= limits[i]);
    const fromCenter = below.baseX + below.w / 2;
    let x = Math.min(WIDTH - MARGIN - w, Math.max(MARGIN, fromCenter - w / 2));
    for (let tries = 0; tries < 24; tries++) {
      const shift = this.rng.range(-limits[0], limits[0]);
      const center = (((fromCenter + shift) % WIDTH) + WIDTH) % WIDTH;
      const candidate = Math.min(WIDTH - MARGIN - w, Math.max(MARGIN, center - w / 2));
      if (fits(candidate)) {
        x = candidate;
        break;
      }
    }
    const ledge = this.add(kind, x, y, w);
    // Sliding: never two in a row (a sliding ledge under a sliding ledge can drift out of reach),
    // and never next to a ledge that goes away.
    if (below.amp === 0 && !belowTemporary && !temporary(kind) && this.rng.chance(phase.moving)) {
      const room = Math.min(x - MARGIN, WIDTH - MARGIN - w - x);
      ledge.amp = Math.max(0, Math.min(this.rng.range(30, 70), room));
      ledge.period = this.rng.range(2.4, 4);
      ledge.offset = this.rng.range(0, Math.PI * 2);
    }
    if (!temporary(kind)) this.lastSolid = ledge;
    return ledge;
  }

  private add(kind: LedgeKind, x: number, y: number, w: number): Ledge {
    const ledge: Ledge = {
      id: this.nextId++, kind, x, y, w, baseX: x, amp: 0, period: 3, offset: 0,
      crumbleAt: null, fadeAt: null, fallSpeed: 0, gone: false,
    };
    this.ledges.push(ledge);
    return ledge;
  }
}
