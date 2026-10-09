import {Game} from './game';
import {stringsFor} from './i18n';
import {render} from './render';
import {HEIGHT, WIDTH} from './world';

const BEST_KEY = 'goat-climb.best';

/** The record, kept on the device (each Lumen app has its own origin and storage). */
const store = {
  get(): {best: number; phase: number} {
    try {
      const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null') as {best?: number; phase?: number} | null;
      return {best: Math.max(0, Number(saved?.best) || 0), phase: Math.max(1, Number(saved?.phase) || 1)};
    } catch {
      return {best: 0, phase: 1};
    }
  },
  set(best: number, phase: number): void {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({best, phase}));
    } catch {
      // Private mode or full storage: the record lasts for this session.
    }
  },
};

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || (Date.now() & 0x7fffffff);
const strings = stringsFor(params.get('lang') ?? navigator.language);
document.documentElement.lang = strings === stringsFor('pt') ? 'pt' : 'en';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', {alpha: false})!;
const game = new Game(seed, store);

/** The 480 x 640 world, scaled to fit the screen (the Rokid HUD is exactly that; MRBD is 600 x 600). */
function fit(): void {
  const scale = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  const dpr = devicePixelRatio || 1;
  canvas.style.width = `${Math.floor(WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(HEIGHT * scale)}px`;
  canvas.width = Math.floor(WIDTH * scale * dpr);
  canvas.height = Math.floor(HEIGHT * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

addEventListener('resize', fit);
fit();

// The band arrives as keys: swipes are arrows, the index tap is Enter, the middle tap is Escape
// (Lumen's Back). Escape on the title screen is left alone, so Back closes the app.
addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (game.key(event.key)) event.preventDefault();
});

let last = performance.now();
let clock = 0;
let frame = 0;

function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  game.update(dt);
  render(ctx, game, strings, clock);
  frame = requestAnimationFrame(loop);
}

// Hidden (another app in front, the display off): a climb waits paused, and nothing draws.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.hidden();
    cancelAnimationFrame(frame);
  } else {
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
});

async function start(): Promise<void> {
  const fonts = [
    new FontFace('Bungee', 'url(fonts/Bungee-Regular-latin.woff2)'),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-SemiBold-latin.woff2)', {weight: '500 600'}),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-Bold-latin.woff2)', {weight: '700'}),
  ];
  await Promise.all(fonts.map(async (font) => {
    try {
      document.fonts.add(await font.load());
    } catch {
      // A font that doesn't load falls back to the system's.
    }
  }));
  canvas.focus();
  frame = requestAnimationFrame(loop);
}

if (params.has('test')) {
  (window as unknown as {__goat: unknown}).__goat = {
    game,
    state: () => ({screen: game.screen, height: game.height, phase: game.phase.number, onLedge: game.goat.on !== null, y: game.goat.y, best: game.best}),
    step: (seconds: number) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
      render(ctx, game, strings, clock);
    },
    warp: (meters: number) => game.warp(meters),
  };
}

void start();
