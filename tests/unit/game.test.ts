import {describe, expect, it} from 'vitest';
import {Game} from '../../src/game';
import {catalogsForTests, fill, stringsFor} from '../../src/i18n';
import {PHASES, phaseAt, phaseProgress, riseAt} from '../../src/phases';
import {GRAVITY, JUMP_SIDE, JUMP_UP, PX_PER_METER, WIDTH, World, airtime, reach, wrappedDistance} from '../../src/world';

function memoryStore(best = 0) {
  let saved = {best, phase: 1};
  return {get: () => saved, set: (b: number, p: number) => { saved = {best: b, phase: p}; }};
}

/** Signed horizontal distance from [from] to [to] on a screen whose sides wrap. */
function towards(from: number, to: number): number {
  let d = to - from;
  if (d > WIDTH / 2) d -= WIDTH;
  if (d < -WIDTH / 2) d += WIDTH;
  return d;
}

/**
 * A player that only uses the band's moves: from each ledge it jumps toward the closest ledge above
 * and steers mid-air (sideways to drift, up to stop). Returns the height reached.
 */
function climb(game: Game, meters: number): number {
  for (let frames = 0; frames < 60 * 600 && game.screen === 'playing' && game.height < meters; frames++) {
    const goat = game.goat;
    if (goat.on) {
      const from = goat.on;
      const above = game.world.ledges
        .filter((l) => l.y < from.y - 1 && World.solid(l, game.t) && l.kind !== 'crack' || (l.kind === 'crack' && l.crumbleAt === null && l.y < from.y - 1))
        .sort((a, b) => b.y - a.y)[0];
      const d = towards(goat.x, above.x + above.w / 2);
      game.move(Math.abs(d) < 30 ? 'up' : d < 0 ? 'left' : 'right');
    } else if (goat.vy > -200) {
      // Coming down: line up with the ledge below the feet that is closest above where it took off.
      const target = game.world.ledges
        .filter((l) => World.solid(l, game.t) && l.y >= goat.y - 4)
        .sort((a, b) => a.y - b.y)[0];
      if (target) {
        const d = towards(goat.x, target.x + target.w / 2);
        if (Math.abs(d) < target.w / 2 - 12) {
          if (goat.vx !== 0) game.move('up');
        } else if (Math.sign(goat.vx) !== Math.sign(d)) {
          game.move(d < 0 ? 'left' : 'right');
        }
      }
    }
    game.update(1 / 60);
  }
  return game.height;
}

describe('phases', () => {
  it('start where the design says and get harder', () => {
    expect(PHASES.map((p) => p.from)).toEqual([0, 200, 450, 750, 1100]);
    expect(phaseAt(0).key).toBe('meadow');
    expect(phaseAt(199).key).toBe('meadow');
    expect(phaseAt(200).key).toBe('forest');
    expect(phaseAt(5000).key).toBe('peak');
    for (let i = 1; i < PHASES.length; i++) {
      expect(PHASES[i].rise).toBeGreaterThan(PHASES[i - 1].rise);
      expect(PHASES[i].gap[1]).toBeGreaterThanOrEqual(PHASES[i - 1].gap[1]);
      expect(PHASES[i].width[0]).toBeLessThanOrEqual(PHASES[i - 1].width[0]);
    }
    expect(phaseProgress(100)).toBeCloseTo(0.5);
    expect(riseAt(3000)).toBeLessThanOrEqual(PHASES[4].rise + 22);
  });
});

describe('the mountain', () => {
  it('only builds ledges the goat can reach, for any seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const world = new World(seed);
      world.generateUntil(-2000 * PX_PER_METER);
      const ledges = [...world.ledges].sort((a, b) => b.y - a.y);
      for (let i = 1; i < ledges.length; i++) {
        const below = ledges[i - 1];
        const above = ledges[i];
        const gap = below.y - above.y;
        expect(gap).toBeGreaterThan(0);
        // Below what a side jump reaches, with room to spare.
        expect(gap).toBeLessThan((JUMP_SIDE * JUMP_SIDE) / (2 * GRAVITY) - 20);
        if (above.kind === 'crack' || above.kind === 'cloud') expect(gap).toBeLessThanOrEqual(80);
        const shift = wrappedDistance(below.baseX + below.w / 2, above.baseX + above.w / 2);
        expect(shift).toBeLessThanOrEqual(Math.max(30, Math.min(reach(gap) * 0.7, reach(gap) * 0.72 - below.w / 2 + above.w / 2)) + 1);
        // Without the ledges that go away, the climb still works.
        expect(below.kind === 'crack' || below.kind === 'cloud' ? above.kind !== 'crack' && above.kind !== 'cloud' : true).toBe(true);
        expect(above.x).toBeGreaterThanOrEqual(0);
        expect(above.x + above.w).toBeLessThanOrEqual(WIDTH);
      }
    }
  });

  it('brings in each phase\'s ledges', () => {
    const world = new World(7);
    world.generateUntil(-1600 * PX_PER_METER);
    const kindsAbove = (from: number, to: number) => new Set(world.ledges.filter((l) => -l.y / PX_PER_METER >= from && -l.y / PX_PER_METER < to).map((l) => l.kind));
    expect([...kindsAbove(0, 200)]).toEqual(['grass']);
    expect(kindsAbove(200, 450).has('wood')).toBe(true);
    expect(kindsAbove(450, 750).has('crack')).toBe(true);
    expect(kindsAbove(750, 1100).has('ice')).toBe(true);
    expect(kindsAbove(1100, 1600).has('cloud')).toBe(true);
    expect(world.ledges.some((l) => l.amp > 0)).toBe(true);
  });

  it('jumps as high as the physics says', () => {
    expect((JUMP_UP * JUMP_UP) / (2 * GRAVITY)).toBeGreaterThan(190);
    expect(airtime(JUMP_SIDE, 100)).toBeGreaterThan(0.6);
    expect(airtime(JUMP_SIDE, 1000)).toBeNull();
  });
});

describe('a game', () => {
  it('goes from the title to the climb, pauses, quits and keeps the record', () => {
    const store = memoryStore(50);
    const game = new Game(3, store);
    expect(game.screen).toBe('title');
    expect(game.key('Escape')).toBe(false); // Back closes the app from the title.
    expect(game.key('Enter')).toBe(true);
    expect(game.screen).toBe('howto');
    game.key('Escape');
    expect(game.screen).toBe('title');
    game.key('ArrowUp');
    expect(game.screen).toBe('playing');
    game.key('Escape');
    expect(game.screen).toBe('paused');
    game.key('Enter');
    expect(game.screen).toBe('playing');
    game.key('Escape');
    game.key('Escape');
    expect(game.screen).toBe('title');
    expect(game.best).toBe(50);
  });

  it('keeps the height of a climb that is quit from the pause', () => {
    const store = memoryStore(10);
    const game = new Game(4, store);
    game.key('ArrowUp');
    game.warp(30);
    const reached = game.height;
    expect(reached).toBeGreaterThan(10);
    game.key('Escape');
    game.key('Escape');
    expect(game.screen).toBe('title');
    expect(game.best).toBe(reached);
    expect(store.get().best).toBe(reached);
  });

  it('can be climbed with the band\'s moves through the first four phases', () => {
    // A simple player (no planning around wind or ice) gets through on almost every mountain.
    let through = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const game = new Game(seed, memoryStore());
      game.key('ArrowUp');
      if (climb(game, 1100) >= 1100) through++;
    }
    expect(through).toBeGreaterThanOrEqual(18);
  });

  it('ends when the goat falls below the rising edge, and saves a record', () => {
    const store = memoryStore(0);
    const game = new Game(5, store);
    game.key('ArrowUp');
    game.warp(30);
    game.goat.on = null;
    game.goat.vy = 0;
    game.world.ledges.length = 0;
    for (let i = 0; i < 600 && game.screen === 'playing'; i++) game.update(1 / 60);
    expect(game.screen).toBe('over');
    expect(store.get().best).toBeGreaterThanOrEqual(30);
    expect(game.record).toBe(true);
    game.key('ArrowUp');
    expect(game.screen).toBe('playing');
    expect(game.height).toBe(0);
  });

  it('shows the banner of a new phase', () => {
    const game = new Game(9, memoryStore());
    game.key('ArrowUp');
    game.warp(205);
    game.update(1 / 60);
    expect(game.phase.key).toBe('forest');
  });

  it('pauses when the app goes to the background', () => {
    const game = new Game(2, memoryStore());
    game.key('ArrowUp');
    game.hidden();
    expect(game.screen).toBe('paused');
  });
});

describe('texts', () => {
  it('have the same keys and placeholders in English and Portuguese', () => {
    const {en, pt} = catalogsForTests;
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k])).sort();
    expect(keys(pt)).toEqual(keys(en));
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (typeof en[key] === 'string') expect(holes(pt[key] as string)).toBe(holes(en[key] as string));
    }
    expect(stringsFor('pt-PT').play).toBe(pt.play);
    expect(stringsFor('fr-FR').play).toBe(en.play);
    expect(fill('{a} m', {a: 3})).toBe('3 m');
  });
});
