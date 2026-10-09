import {BANNER_TIME, type Game, type Goat} from './game';
import {fill, type Strings} from './i18n';
import {phaseProgress} from './phases';
import {HEIGHT, WIDTH, type LedgeKind} from './world';

/**
 * Line art on black, as the approved design: black is see-through on the glasses, and their green
 * display turns these colors into brightness levels.
 */
export const COLORS = {
  text: '#FFFFFF',
  dim: '#9AA3B5',
  faint: '#2C3446',
  goat: '#F4EEE4',
  fill: '#3A2F27',
  grass: '#7BD66B',
  wood: '#C28A55',
  rock: '#A9988A',
  ice: '#9FDCFF',
  cloud: '#E9F1FF',
  danger: '#FF6B5E',
  accent: '#FFD24A',
};

const TITLE_FONT = 'Bungee, "Chakra Petch", sans-serif';
const BODY_FONT = '"Chakra Petch", sans-serif';

type Pose = 'stand' | 'jump' | 'land' | 'fall';

const LEGS: Record<Pose, string> = {
  stand: 'M22 40 L21 54 M28 41 L28 54 M40 41 L41 54 M46 40 L47 54',
  jump: 'M22 40 L14 48 M28 41 L20 50 M40 41 L48 47 M46 40 L55 45',
  land: 'M22 40 L18 54 M28 41 L27 54 M40 41 L42 54 M46 40 L51 54',
  fall: 'M22 40 L24 50 M28 41 L31 52 M40 41 L37 52 M46 40 L44 50',
};

const GOAT = {
  body: new Path2D('M14 30 C14 22 22 19 32 19 C42 19 50 22 50 30 C50 38 44 42 32 42 C20 42 14 38 14 30 Z'),
  head: new Path2D('M44 24 L48 15 C50 9 61 8 63 13 L65 21 C65 25 61 26 58 23 L52 22 L49 27'),
  lines: new Path2D(
    'M20 41 L22 44 L25 41 L28 44 L31 41 L34 44 L37 41 L40 44 L43 41 ' + // shaggy belly
    'M14 27 L9 22 L13 24 ' + // tail
    'M53 11 C50 4 43 3 42 8 C41 12 45 13 47 11 M56 10 C56 4 51 1 48 3 ' + // horns
    'M51 14 L46 15 L50 17 ' + // ear
    'M60 22 L61 28 L58 24', // beard
  ),
  legs: Object.fromEntries(Object.entries(LEGS).map(([pose, d]) => [pose, new Path2D(d)])) as Record<Pose, Path2D>,
};

/** Draws the goat with its feet at (x, y), facing right (1) or left (−1). */
export function drawGoat(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, facing: 1 | -1, pose: Pose): void {
  ctx.save();
  ctx.translate(x - 32 * scale * facing, y - 56 * scale);
  ctx.scale(scale * facing, scale);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.goat;
  ctx.fillStyle = COLORS.fill;
  ctx.fill(GOAT.body);
  ctx.stroke(GOAT.body);
  ctx.fill(GOAT.head);
  ctx.stroke(GOAT.head);
  ctx.stroke(GOAT.lines);
  ctx.stroke(GOAT.legs[pose]);
  ctx.fillStyle = COLORS.goat;
  ctx.beginPath();
  ctx.arc(57, 14, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws a ledge with its top surface at screen y. */
export function drawLedge(ctx: CanvasRenderingContext2D, kind: LedgeKind, x: number, y: number, w: number, moving = false): void {
  ctx.save();
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'grass': {
      ctx.strokeStyle = COLORS.grass;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 14, 7);
      for (let i = 8; i < w - 8; i += 18) {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + 3, y - 7);
        ctx.lineTo(x + i + 6, y);
      }
      ctx.stroke();
      break;
    }
    case 'wood': {
      ctx.strokeStyle = COLORS.wood;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 14, 4);
      for (let i = 16; i < w - 8; i += 22) {
        ctx.moveTo(x + i, y + 3);
        ctx.lineTo(x + i, y + 11);
      }
      ctx.moveTo(x + w - 3, y + 7);
      ctx.ellipse(x + w - 6, y + 7, 3, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'rock':
    case 'crack': {
      ctx.strokeStyle = COLORS.rock;
      if (kind === 'crack') ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - 10, y + 18);
      ctx.lineTo(x + w * 0.55, y + 24);
      ctx.lineTo(x + 14, y + 16);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      if (kind === 'crack') {
        ctx.strokeStyle = COLORS.danger;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y);
        ctx.lineTo(x + w * 0.5 - 6, y + 9);
        ctx.lineTo(x + w * 0.5 + 1, y + 14);
        ctx.lineTo(x + w * 0.5 - 3, y + 23);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x + w * 0.3, y + 6);
        ctx.lineTo(x + w * 0.3 + 10, y + 10);
        ctx.moveTo(x + w * 0.65, y + 9);
        ctx.lineTo(x + w * 0.65 - 8, y + 14);
        ctx.stroke();
      }
      break;
    }
    case 'ice': {
      ctx.strokeStyle = COLORS.ice;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 12, 3);
      for (let i = 10; i < w - 10; i += 20) {
        ctx.moveTo(x + i, y + 12);
        ctx.lineTo(x + i + 3, y + 22);
        ctx.lineTo(x + i + 6, y + 12);
      }
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 4);
      ctx.lineTo(x + 28, y + 4);
      ctx.stroke();
      break;
    }
    case 'cloud': {
      ctx.strokeStyle = COLORS.cloud;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 16);
      ctx.bezierCurveTo(x - 4, y + 16, x - 2, y - 2, x + 14, y + 1);
      ctx.bezierCurveTo(x + 18, y - 12, x + 40, y - 12, x + 44, y);
      ctx.bezierCurveTo(x + 54, y - 8, x + w + 6, y, x + w - 6, y + 16);
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
  if (moving) {
    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 7);
    ctx.lineTo(x - 24, y + 7);
    ctx.moveTo(x - 20, y + 3);
    ctx.lineTo(x - 24, y + 7);
    ctx.lineTo(x - 20, y + 11);
    ctx.moveTo(x + w + 14, y + 7);
    ctx.lineTo(x + w + 24, y + 7);
    ctx.moveTo(x + w + 20, y + 3);
    ctx.lineTo(x + w + 24, y + 7);
    ctx.lineTo(x + w + 20, y + 11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEagle(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, flap: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lift = 10 * flap;
  ctx.beginPath();
  ctx.moveTo(-28, lift);
  ctx.bezierCurveTo(-18, -10 + lift, -8, -10 + lift, 0, 0);
  ctx.bezierCurveTo(8, -10 + lift, 18, -10 + lift, 28, lift);
  ctx.moveTo(-4, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(4, 0);
  ctx.moveTo(4, 2);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.restore();
}

/** Faint stars that drift slower than the mountain (a sense of height). */
function drawStars(ctx: CanvasRenderingContext2D, camera: number): void {
  ctx.fillStyle = COLORS.faint;
  const shift = camera * 0.15;
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97.3) % WIDTH;
    const sy = (((i * 151.7 - shift) % HEIGHT) + HEIGHT) % HEIGHT;
    ctx.beginPath();
    ctx.arc(sx, sy, i % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = COLORS.danger;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 18);
  for (let i = 0; i <= WIDTH + 20; i += 20) ctx.lineTo(i, HEIGHT - 18 + ((i / 20) % 2 ? 6 : 0));
  ctx.stroke();
  ctx.restore();
}

function drawWind(ctx: CanvasRenderingContext2D, dir: number, t: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 150 + i * 140;
    const x = ((t * 260 * dir + i * 170) % (WIDTH + 120) + WIDTH + 120) % (WIDTH + 120) - 60;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 60 * dir, y);
    ctx.stroke();
  }
  ctx.restore();
}

function poseOf(game: Game, goat: Goat): Pose {
  if (goat.on) return game.t - goat.landedAt < 0.12 ? 'land' : 'stand';
  if (goat.vy < 0) return 'jump';
  return goat.vy > 700 ? 'fall' : 'land';
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/** Wraps [value] to [width] and draws it, line by line; returns the y after the last line. */
function paragraph(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, lineHeight: number, font: string, color: string, align: CanvasTextAlign = 'left'): number {
  ctx.font = font;
  for (const block of value.split('\n')) {
    let line = '';
    for (const word of block.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        text(ctx, line, x, y, font, color, align);
        y += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    text(ctx, line, x, y, font, color, align);
    y += lineHeight;
  }
  return y;
}

function button(ctx: CanvasRenderingContext2D, label: string, hint: string, cy: number, primary: boolean): void {
  ctx.save();
  ctx.font = `20px ${TITLE_FONT}`;
  const w = Math.max(260, ctx.measureText(label).width + 48);
  ctx.strokeStyle = primary ? COLORS.text : COLORS.dim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(WIDTH / 2 - w / 2, cy - 28, w, 56, 28);
  ctx.stroke();
  ctx.restore();
  text(ctx, label, WIDTH / 2, cy + 8, `20px ${TITLE_FONT}`, primary ? COLORS.text : COLORS.dim, 'center');
  text(ctx, hint, WIDTH / 2, cy + 50, `600 14px ${BODY_FONT}`, COLORS.dim, 'center');
}

function arrow(ctx: CanvasRenderingContext2D, d: 'left' | 'up' | 'right', x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const s = size / 2;
  if (d === 'left') { ctx.moveTo(x + s * 0.3, y - s * 0.6); ctx.lineTo(x - s * 0.4, y); ctx.lineTo(x + s * 0.3, y + s * 0.6); }
  if (d === 'right') { ctx.moveTo(x - s * 0.3, y - s * 0.6); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x - s * 0.3, y + s * 0.6); }
  if (d === 'up') { ctx.moveTo(x - s * 0.6, y + s * 0.3); ctx.lineTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.6, y + s * 0.3); }
  ctx.stroke();
  ctx.restore();
}

function hud(ctx: CanvasRenderingContext2D, game: Game, s: Strings): void {
  ctx.font = `34px ${TITLE_FONT}`;
  const value = String(game.height);
  text(ctx, value, 20, 50, `34px ${TITLE_FONT}`, COLORS.text);
  text(ctx, ' m', 20 + ctx.measureText(value).width, 50, `18px ${TITLE_FONT}`, COLORS.text);
  text(ctx, fill(s.best, {meters: Math.max(game.best, game.height)}), 20, 74, `600 16px ${BODY_FONT}`, COLORS.dim);
  const phaseName = s.phases[game.phase.key].name;
  text(ctx, fill(s.phase, {number: game.phase.number, name: phaseName}), WIDTH - 20, 38, `700 16px ${BODY_FONT}`, COLORS.text, 'right');
  ctx.save();
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(WIDTH - 160, 48, 140, 6, 3);
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.roundRect(WIDTH - 160, 48, Math.max(2, 140 * phaseProgress(game.height)), 6, 3);
  ctx.fill();
  ctx.restore();
}

function controls(ctx: CanvasRenderingContext2D, s: Strings, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const items: ['left' | 'up' | 'right', string][] = [['left', s.left], ['up', s.up], ['right', s.right]];
  ctx.font = `600 15px ${BODY_FONT}`;
  const widths = items.map(([, label]) => 26 + ctx.measureText(label).width);
  let x = WIDTH / 2 - (widths.reduce((a, b) => a + b, 0) + 22 * (items.length - 1)) / 2;
  items.forEach(([d, label], i) => {
    arrow(ctx, d, x + 10, HEIGHT - 32, 20, COLORS.dim);
    text(ctx, label, x + 24, HEIGHT - 27, `600 15px ${BODY_FONT}`, COLORS.dim);
    x += widths[i] + 22;
  });
  ctx.restore();
}

/** The climb itself: stars, ledges, eagles, dust, the goat, the rising edge. */
function scene(ctx: CanvasRenderingContext2D, game: Game): void {
  const cam = game.camera;
  drawStars(ctx, cam);
  for (const ledge of game.world.ledges) {
    const y = ledge.y - cam;
    if (y < -40 || y > HEIGHT + 40 || ledge.gone) continue;
    ctx.save();
    if (ledge.fadeAt !== null && game.t >= ledge.fadeAt) ctx.globalAlpha = Math.max(0, 1 - (game.t - ledge.fadeAt) / 0.4);
    else if (ledge.fadeAt !== null) ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(game.t * 9));
    drawLedge(ctx, ledge.kind, ledge.x, y, ledge.w, ledge.amp > 0 && ledge.crumbleAt === null);
    ctx.restore();
  }
  for (const eagle of game.eagles) drawEagle(ctx, eagle.x, eagle.y - cam, Math.sign(eagle.vx), Math.sin(game.t * 10));
  ctx.save();
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const p of game.particles) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - cam);
    ctx.lineTo(p.x - p.vx * 0.03, p.y - cam - p.vy * 0.03);
    ctx.stroke();
  }
  ctx.restore();
  const goat = game.goat;
  const pose = poseOf(game, goat);
  drawGoat(ctx, goat.x, goat.y - cam, 1, goat.facing, pose);
  // Halfway through a side: show it on the other side too.
  if (goat.x < 34) drawGoat(ctx, goat.x + WIDTH, goat.y - cam, 1, goat.facing, pose);
  if (goat.x > WIDTH - 34) drawGoat(ctx, goat.x - WIDTH, goat.y - cam, 1, goat.facing, pose);
  if (game.wind !== 0) drawWind(ctx, game.wind, game.t);
  drawFloor(ctx);
}

function banner(ctx: CanvasRenderingContext2D, game: Game, s: Strings): void {
  if (game.bannerAt === null) return;
  const age = game.t - game.bannerAt;
  if (age > BANNER_TIME) return;
  const alpha = Math.min(1, age / 0.25, (BANNER_TIME - age) / 0.4);
  const phase = s.phases[game.phase.key];
  ctx.save();
  ctx.globalAlpha = alpha;
  text(ctx, `${game.phase.from} m`, WIDTH / 2, 190, `700 18px ${BODY_FONT}`, COLORS.dim, 'center');
  text(ctx, fill(s.phase, {number: game.phase.number, name: ''}).replace(/ · $/, ''), WIDTH / 2, 248, `52px ${TITLE_FONT}`, COLORS.text, 'center');
  text(ctx, phase.name, WIDTH / 2, 286, `28px ${TITLE_FONT}`, COLORS.text, 'center');
  paragraph(ctx, phase.banner, WIDTH / 2, 326, 400, 24, `600 18px ${BODY_FONT}`, COLORS.dim, 'center');
  ctx.restore();
}

function titleScreen(ctx: CanvasRenderingContext2D, game: Game, s: Strings, t: number): void {
  drawStars(ctx, t * -8);
  ctx.save();
  ctx.strokeStyle = COLORS.faint;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 470);
  [[90, 420], [150, 445], [240, 380], [330, 435], [400, 405], [480, 450]].forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();
  ctx.restore();
  drawLedge(ctx, 'rock', 40, 390, 120);
  drawLedge(ctx, 'grass', 300, 340, 120);
  drawLedge(ctx, 'cloud', 190, 240, 90);
  ctx.save();
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 9]);
  ctx.beginPath();
  ctx.moveTo(130, 390);
  ctx.quadraticCurveTo(235, 260, 340, 340);
  ctx.stroke();
  ctx.restore();
  const bob = Math.sin(t * 2) > 0.95 ? 'land' : 'stand';
  drawGoat(ctx, 126, 390, 1.5, 1, bob);
  text(ctx, s.title1, WIDTH / 2, 134, `64px ${TITLE_FONT}`, COLORS.text, 'center');
  text(ctx, s.title2, WIDTH / 2, 198, `64px ${TITLE_FONT}`, COLORS.text, 'center');
  text(ctx, s.tagline, WIDTH / 2, 230, `600 18px ${BODY_FONT}`, COLORS.dim, 'center');
  const best = game.best > 0 ? fill(s.bestLine, {meters: game.best, phase: game.bestPhase}) : s.firstClimb;
  button(ctx, s.play, best, 528, true);
  text(ctx, s.titleHints, WIDTH / 2, 616, `600 15px ${BODY_FONT}`, COLORS.dim, 'center');
}

function howScreen(ctx: CanvasRenderingContext2D, s: Strings): void {
  text(ctx, s.howTitle, 36, 78, `34px ${TITLE_FONT}`, COLORS.text);
  const rows: ['left' | 'up' | 'right', string, string][] = [
    ['left', s.swipeLeft, s.swipeLeftText],
    ['up', s.swipeUp, s.swipeUpText],
    ['right', s.swipeRight, s.swipeRightText],
  ];
  rows.forEach(([d, title, body], i) => {
    const cy = 136 + i * 86;
    ctx.save();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(68, cy, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    arrow(ctx, d, 68, cy, 30, COLORS.text);
    text(ctx, title, 118, cy - 4, `20px ${TITLE_FONT}`, COLORS.text);
    text(ctx, body, 118, cy + 20, `500 17px ${BODY_FONT}`, COLORS.dim);
  });
  ctx.fillStyle = COLORS.faint;
  ctx.fillRect(36, 392, WIDTH - 72, 2);
  let y = paragraph(ctx, s.howLand, 36, 426, WIDTH - 72, 24, `500 17px ${BODY_FONT}`, COLORS.text);
  y = paragraph(ctx, s.howRise, 36, y + 8, WIDTH - 72, 24, `500 17px ${BODY_FONT}`, COLORS.text);
  text(ctx, s.howPause, 36, y + 12, `600 15px ${BODY_FONT}`, COLORS.dim);
}

/** Darkens the top of the climb under the HUD, so ledges passing behind it don't cross its text. */
function topFade(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, 96);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 96);
}

/** Draws [game] as it is now; [clock] (s) runs on the title screens too. */
export function render(ctx: CanvasRenderingContext2D, game: Game, s: Strings, clock: number): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  switch (game.screen) {
    case 'title':
      titleScreen(ctx, game, s, clock);
      return;
    case 'howto':
      howScreen(ctx, s);
      return;
    case 'playing':
      scene(ctx, game);
      topFade(ctx);
      hud(ctx, game, s);
      if (game.t < 8) controls(ctx, s, game.t < 6 ? 1 : (8 - game.t) / 2);
      banner(ctx, game, s);
      return;
    case 'paused':
      ctx.save();
      ctx.globalAlpha = 0.25;
      scene(ctx, game);
      ctx.restore();
      hud(ctx, game, s);
      text(ctx, s.paused, WIDTH / 2, 250, `48px ${TITLE_FONT}`, COLORS.text, 'center');
      button(ctx, s.resume, s.resumeHint, 330, true);
      button(ctx, s.quit, s.quitHint, 430, false);
      return;
    case 'over': {
      ctx.save();
      ctx.globalAlpha = 0.2;
      scene(ctx, game);
      ctx.restore();
      drawGoat(ctx, WIDTH / 2, 560 + Math.sin(clock * 3) * 4, 1.2, 1, 'fall');
      const name = s.phases[game.phase.key].name;
      text(ctx, s.fell, WIDTH / 2, 100, `40px ${TITLE_FONT}`, COLORS.text, 'center');
      ctx.font = `72px ${TITLE_FONT}`;
      const value = String(game.height);
      const total = ctx.measureText(value).width;
      ctx.font = `30px ${TITLE_FONT}`;
      const unit = ctx.measureText(' m').width;
      text(ctx, value, WIDTH / 2 - (total + unit) / 2, 196, `72px ${TITLE_FONT}`, COLORS.text);
      text(ctx, ' m', WIDTH / 2 - (total + unit) / 2 + total, 196, `30px ${TITLE_FONT}`, COLORS.text);
      if (game.record) text(ctx, s.newRecord, WIDTH / 2, 228, `700 18px ${BODY_FONT}`, COLORS.accent, 'center');
      const line = game.record
        ? fill(s.overLineRecord, {phase: game.phase.number, name, best: game.previousBest})
        : fill(s.overLine, {phase: game.phase.number, name, best: game.best});
      text(ctx, line, WIDTH / 2, 256, `600 17px ${BODY_FONT}`, COLORS.dim, 'center');
      button(ctx, s.again, s.overHint, 330, true);
      return;
    }
  }
}

