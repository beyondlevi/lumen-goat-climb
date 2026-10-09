/** The climb's phases, by height: each one harder than the last. */
export type PhaseKey = 'meadow' | 'forest' | 'cliffs' | 'snow' | 'peak';

export interface Phase {
  /** 1-based, as the HUD shows it. */
  number: number;
  key: PhaseKey;
  /** Where it starts, in meters. */
  from: number;
  /** Where the next one starts (Infinity for the last). */
  to: number;
  /** Vertical gap between ledges, px. */
  gap: [number, number];
  /** Ledge width, px. */
  width: [number, number];
  /** How fast the mountain rises (the camera), px/s. */
  rise: number;
  /** Chance that a ledge slides sideways. */
  moving: number;
  /** Chance that a ledge is cracked (it falls after one landing). */
  cracked: number;
  /** Chance that a ledge is ice (the goat slides). */
  ice: number;
  /** Chance that a ledge is a cloud (it fades after one landing). */
  cloud: number;
  /** Wind gusts push the goat mid-air. */
  wind: boolean;
  /** Eagles swoop across. */
  eagles: boolean;
}

export const PHASES: readonly Phase[] = [
  {number: 1, key: 'meadow', from: 0, to: 200, gap: [70, 100], width: [110, 140], rise: 14, moving: 0, cracked: 0, ice: 0, cloud: 0, wind: false, eagles: false},
  {number: 2, key: 'forest', from: 200, to: 450, gap: [80, 112], width: [95, 125], rise: 20, moving: 0.35, cracked: 0, ice: 0, cloud: 0, wind: false, eagles: false},
  {number: 3, key: 'cliffs', from: 450, to: 750, gap: [88, 124], width: [85, 115], rise: 26, moving: 0.15, cracked: 0.3, ice: 0, cloud: 0, wind: false, eagles: false},
  {number: 4, key: 'snow', from: 750, to: 1100, gap: [94, 132], width: [80, 110], rise: 32, moving: 0.1, cracked: 0.15, ice: 0.55, cloud: 0, wind: true, eagles: false},
  {number: 5, key: 'peak', from: 1100, to: Infinity, gap: [100, 140], width: [75, 105], rise: 38, moving: 0.15, cracked: 0.15, ice: 0.2, cloud: 0.45, wind: true, eagles: true},
];

/** The phase at [meters] of height. */
export function phaseAt(meters: number): Phase {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (meters >= PHASES[i].from) return PHASES[i];
  }
  return PHASES[0];
}

/** How far into its phase [meters] is, 0..1 (the last phase grows forever: 0..1 over 500 m, then 1). */
export function phaseProgress(meters: number): number {
  const phase = phaseAt(meters);
  const span = Number.isFinite(phase.to) ? phase.to - phase.from : 500;
  return Math.min(1, Math.max(0, (meters - phase.from) / span));
}

/** The rise speed at [meters]: the phase's, a little faster as the phase goes on, capped. */
export function riseAt(meters: number): number {
  const phase = phaseAt(meters);
  const extra = phase.key === 'peak' ? Math.min(22, (meters - phase.from) / 50) : 4 * phaseProgress(meters);
  return phase.rise + extra;
}
