import {phaseAt, riseAt, type Phase} from './phases';
import {Rng} from './rng';
import {
  CLOUD_DELAY, CRUMBLE_DELAY, GRAVITY, HEIGHT, JUMP_SIDE, JUMP_UP, PX_PER_METER, SIDE_SPEED, WIDTH, World, type Ledge,
} from './world';

export type Screen = 'title' | 'howto' | 'playing' | 'paused' | 'over';
export type Move = 'left' | 'up' | 'right';

export interface Goat {
  /** Center x. */
  x: number;
  /** Feet y (world). */
  y: number;
  vx: number;
  vy: number;
  /** The ledge it stands on, or null mid-air. */
  on: Ledge | null;
  facing: 1 | -1;
  /** Sliding speed on ice. */
  slide: number;
  /** When it last landed (s), for the landing pose and dust. */
  landedAt: number;
  /** Knocked by an eagle: no steering until then. */
  stunUntil: number;
}

export interface Eagle {
  x: number;
  y: number;
  vx: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  until: number;
}

/** Where the goat stays on screen when it climbs faster than the mountain rises. */
const FOLLOW_FROM_TOP = 260;
/** A move asked for in the air happens on landing, if it lands within this time. */
const BUFFER = 0.18;
/** Steering speed mid-air. */
const AIR_SPEED = 210;
/** Below the bottom edge by this much, the climb ends. */
const FALL_OUT = 24;
/** Seconds the phase banner shows. */
export const BANNER_TIME = 2.4;

/**
 * One game: the screens (title, how to play, the climb, pause, game over), the goat's physics,
 * the rising mountain, the phases and their hazards. No drawing here (see render.ts), so it runs
 * the same in tests. Time [t] is the game's own clock, in seconds; it stops while paused.
 */
export class Game {
  screen: Screen = 'title';
  world: World;
  goat!: Goat;
  /** World y at the top of the screen. */
  camera = 0;
  t = 0;
  /** Height reached this run, in meters. */
  height = 0;
  best: number;
  bestPhase: number;
  /** The record before this run (for the game over screen). */
  previousBest = 0;
  started = false;
  phase: Phase;
  /** When the current phase's banner began (null: none). */
  bannerAt: number | null = null;
  eagles: Eagle[] = [];
  particles: Particle[] = [];
  /** Wind now: −1 left, 1 right, 0 calm; and when it changes. */
  wind = 0;
  private windUntil = 0;
  private nextEagle = 0;
  private buffered: {move: Move; at: number} | null = null;
  private rng: Rng;
  private seed: number;
  private readonly store: {get(): {best: number; phase: number}; set(best: number, phase: number): void};

  constructor(seed: number, store: Game['store']) {
    this.seed = seed;
    this.store = store;
    const saved = store.get();
    this.best = saved.best;
    this.bestPhase = saved.phase;
    this.rng = new Rng(seed ^ 0x5eed);
    this.world = new World(seed);
    this.phase = phaseAt(0);
    this.reset();
  }

  /** A fresh mountain and goat, the camera at the start. */
  reset(): void {
    this.world = new World(this.seed++);
    this.rng = new Rng(this.seed ^ 0x5eed);
    const start = this.world.start;
    this.goat = {x: start.x + start.w / 2, y: start.y, vx: 0, vy: 0, on: start, facing: 1, slide: 0, landedAt: -10, stunUntil: 0};
    this.camera = start.y - (HEIGHT - 120);
    this.t = 0;
    this.height = 0;
    this.started = false;
    this.phase = phaseAt(0);
    this.bannerAt = null;
    this.eagles = [];
    this.particles = [];
    this.wind = 0;
    this.windUntil = 0;
    this.nextEagle = 0;
    this.buffered = null;
    this.world.generateUntil(this.camera - HEIGHT);
  }

  // ---- Input ----

  /** A key from the band (arrows, Enter = index tap, Escape = middle tap). True if the game used it. */
  key(key: string): boolean {
    switch (this.screen) {
      case 'title':
        if (key === 'ArrowUp') return this.begin();
        if (key === 'Enter') return this.show('howto');
        return false; // Escape: the app's Back (Lumen closes it).
      case 'howto':
        if (key === 'Escape' || key === 'Enter' || key === 'ArrowUp') return this.show('title');
        return false;
      case 'playing':
        if (key === 'ArrowLeft') return this.move('left');
        if (key === 'ArrowRight') return this.move('right');
        if (key === 'ArrowUp') return this.move('up');
        if (key === 'Escape') return this.pause();
        return false;
      case 'paused':
        if (key === 'Enter' || key === 'ArrowUp') return this.show('playing');
        if (key === 'Escape') {
          this.reset();
          return this.show('title');
        }
        return false;
      case 'over':
        if (key === 'ArrowUp' || key === 'Enter') return this.begin();
        if (key === 'Escape') {
          this.reset();
          return this.show('title');
        }
        return false;
    }
  }

  /** The app went to the background: a climb waits paused. */
  hidden(): void {
    if (this.screen === 'playing') this.pause();
  }

  private show(screen: Screen): boolean {
    this.screen = screen;
    return true;
  }

  /** A paused climb already counts for the record: quitting it, or the app closing, keeps it. */
  private pause(): boolean {
    this.keepRecord();
    return this.show('paused');
  }

  private begin(): boolean {
    this.reset();
    this.previousBest = this.best;
    this.screen = 'playing';
    return true;
  }

  /** A jump from a ledge, or steering mid-air (and the move kept for the landing, just before it). */
  move(move: Move): boolean {
    const goat = this.goat;
    if (goat.on) {
      this.jump(move);
      return true;
    }
    this.buffered = {move, at: this.t};
    if (this.t < goat.stunUntil) return true;
    // Mid-air: a side swipe drifts that way, up stops the drift.
    if (move === 'up') {
      goat.vx = 0;
    } else {
      goat.vx = move === 'left' ? -AIR_SPEED : AIR_SPEED;
      goat.facing = move === 'left' ? -1 : 1;
    }
    return true;
  }

  private jump(move: Move): void {
    const goat = this.goat;
    const ledge = goat.on;
    const carry = ledge && ledge.amp > 0 ? this.ledgeSpeed(ledge) : 0;
    goat.on = null;
    goat.slide = 0;
    this.buffered = null;
    this.started = true;
    if (move === 'up') {
      goat.vy = -JUMP_UP;
      goat.vx = carry;
    } else {
      goat.vy = -JUMP_SIDE;
      goat.vx = (move === 'left' ? -SIDE_SPEED : SIDE_SPEED) + carry;
      goat.facing = move === 'left' ? -1 : 1;
    }
  }

  private ledgeSpeed(ledge: Ledge): number {
    return (ledge.amp * 2 * Math.PI / ledge.period) * Math.cos((2 * Math.PI * this.t) / ledge.period + ledge.offset);
  }

  // ---- Simulation ----

  /** Advances the climb by [dt] seconds (in small steps, so fast falls never pass through a ledge). */
  update(dt: number): void {
    if (this.screen !== 'playing') return;
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const step = Math.min(left, 1 / 120);
      this.step(step);
      left -= step;
      if (this.screen !== 'playing') return;
    }
  }

  private step(dt: number): void {
    this.t += dt;
    const t = this.t;
    const goat = this.goat;
    this.world.update(t, dt);
    this.updateWind(t);

    if (goat.on) {
      const ledge = goat.on;
      if (!World.solid(ledge, t)) {
        goat.on = null;
        goat.vy = Math.max(0, ledge.fallSpeed);
        goat.vx = 0;
      } else {
        goat.y = ledge.y;
        if (ledge.amp > 0) goat.x += this.ledgeSpeed(ledge) * dt;
        if (ledge.kind === 'ice') {
          goat.slide += this.wind * 120 * dt;
          goat.x += goat.slide * dt;
          const drag = 220 * dt;
          goat.slide = Math.abs(goat.slide) <= drag ? 0 : goat.slide - Math.sign(goat.slide) * drag;
        }
        // Walked (slid) off the edge.
        if (goat.x < ledge.x - 6 || goat.x > ledge.x + ledge.w + 6) {
          goat.on = null;
          goat.vx = goat.slide;
          goat.vy = 0;
        }
      }
    }

    if (!goat.on) {
      const before = goat.y;
      goat.vy += GRAVITY * dt;
      if (this.wind !== 0) goat.vx += this.wind * 240 * dt;
      goat.x += goat.vx * dt;
      goat.y += goat.vy * dt;
      if (goat.x < 0) goat.x += WIDTH;
      if (goat.x >= WIDTH) goat.x -= WIDTH;
      if (goat.vy > 0) this.land(before);
    }

    // Height, phases.
    const meters = Math.max(0, Math.floor(-goat.y / PX_PER_METER));
    if (meters > this.height) this.height = meters;
    const phase = phaseAt(this.height);
    if (phase.number > this.phase.number) {
      this.phase = phase;
      this.bannerAt = t;
    }

    // The mountain rises once the climb started; the camera follows a goat that climbs faster.
    if (this.started) this.camera -= riseAt(this.height) * dt;
    if (goat.y - this.camera < FOLLOW_FROM_TOP) this.camera = goat.y - FOLLOW_FROM_TOP;
    this.world.generateUntil(this.camera - HEIGHT);
    this.world.prune(this.camera + HEIGHT + 200);

    this.updateEagles(t, dt);
    this.particles = this.particles.filter((p) => p.until > t);
    for (const p of this.particles) {
      p.vy += GRAVITY * 0.3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (goat.y - this.camera > HEIGHT + FALL_OUT) this.over();
  }

  private land(before: number): void {
    const goat = this.goat;
    for (const ledge of this.world.ledges) {
      if (!World.solid(ledge, this.t)) continue;
      if (before > ledge.y + 0.5 || goat.y < ledge.y) continue;
      if (goat.x < ledge.x - 6 || goat.x > ledge.x + ledge.w + 6) continue;
      goat.on = ledge;
      goat.y = ledge.y;
      goat.slide = ledge.kind === 'ice' ? goat.vx * 0.6 : 0;
      goat.vx = 0;
      goat.vy = 0;
      goat.landedAt = this.t;
      if (ledge.kind === 'crack' && ledge.crumbleAt === null) ledge.crumbleAt = this.t + CRUMBLE_DELAY;
      if (ledge.kind === 'cloud' && ledge.fadeAt === null) ledge.fadeAt = this.t + CLOUD_DELAY;
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1;
        this.particles.push({x: goat.x + side * 10, y: ledge.y - 2, vx: side * this.rng.range(40, 110), vy: -this.rng.range(40, 120), until: this.t + 0.35});
      }
      const buffered = this.buffered;
      if (buffered && this.t - buffered.at <= BUFFER) this.jump(buffered.move);
      this.buffered = null;
      return;
    }
  }

  private updateWind(t: number): void {
    if (!this.phase.wind) {
      this.wind = 0;
      return;
    }
    if (t < this.windUntil) return;
    if (this.wind === 0) {
      this.wind = this.rng.chance(0.5) ? -1 : 1;
      this.windUntil = t + this.rng.range(1.2, 2);
    } else {
      this.wind = 0;
      this.windUntil = t + this.rng.range(3.5, 6.5);
    }
  }

  private updateEagles(t: number, dt: number): void {
    if (this.phase.eagles && t >= this.nextEagle) {
      if (this.nextEagle > 0) {
        const fromLeft = this.rng.chance(0.5);
        this.eagles.push({x: fromLeft ? -60 : WIDTH + 60, y: this.camera + this.rng.range(100, 380), vx: fromLeft ? 150 : -150});
      }
      this.nextEagle = t + this.rng.range(4, 7.5);
    }
    const goat = this.goat;
    for (const eagle of this.eagles) {
      eagle.x += eagle.vx * dt;
      // The goat's body is about 40 x 30 above its feet; the eagle about 50 x 16.
      if (t >= goat.stunUntil && Math.abs(eagle.x - goat.x) < 40 && Math.abs(eagle.y - (goat.y - 22)) < 24) {
        goat.on = null;
        goat.vy = 320;
        goat.vx = Math.sign(eagle.vx) * 120;
        goat.stunUntil = t + 0.6;
      }
    }
    this.eagles = this.eagles.filter((e) => e.x > -100 && e.x < WIDTH + 100);
  }

  private over(): void {
    this.screen = 'over';
    this.keepRecord();
  }

  private keepRecord(): void {
    if (this.height > this.best) {
      this.best = this.height;
      this.bestPhase = this.phase.number;
      this.store.set(this.best, this.bestPhase);
    }
  }

  /** A new record this run. */
  get record(): boolean {
    return this.height > this.previousBest && this.height === this.best;
  }

  /** Test hook: start this run as if it had climbed to [meters]. */
  warp(meters: number): void {
    const y = -meters * PX_PER_METER;
    this.world.generateUntil(y - HEIGHT);
    const ledge = this.world.ledges.reduce((best, l) => (Math.abs(l.y - y) < Math.abs(best.y - y) ? l : best));
    this.goat.on = ledge;
    this.goat.x = ledge.x + ledge.w / 2;
    this.goat.y = ledge.y;
    this.camera = ledge.y - (HEIGHT - 160);
    this.height = Math.floor(-ledge.y / PX_PER_METER);
    this.phase = phaseAt(this.height);
    this.started = true;
    this.screen = 'playing';
  }
}
