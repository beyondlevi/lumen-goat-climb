# Working on this game

A [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) web app: a canvas game that Lumen runs
offline on Rokid glasses from a `.mrbd.zip` package. Lumen's guide for apps is
[docs/building-apps.md](https://github.com/beyondlevi/rokid-lumen/blob/main/docs/building-apps.md).
Unlike Lumen's other apps it doesn't use the UI Toolkit for Meta Ray-Ban Display: it draws its own
line art on a `<canvas>`.

## Rules

- **The band drives it as keys.** Swipes are arrow keys (left, up, right jump), the index tap is
  `Enter`, the middle tap is Back (`Escape`). Call `preventDefault()` on `Escape` only when the
  game used it: on the title screen it must reach Lumen, which closes the app.
- **Black is see-through on the glasses**, and their display is green: colors become brightness.
  Keep the background pure black and everything else bright line art.
- **The logical screen is 480 x 640** (the Rokid HUD, portrait), scaled to fit any other screen.
- **Offline.** Fonts and everything else ship in the package; nothing loads from the internet.
- **English first, multilingual from the start.** Every text lives in `src/i18n.ts`, English by
  default and Portuguese (`pt`) with it; placeholders, never concatenation. Code, comments, docs
  and commits in English.
- **Fair mountains.** `World` only builds ledges a goat can reach with the band's moves; a ledge
  that goes away (cracked, a cloud) is never the only way up. The unit tests check it on many
  seeds, with a simple automatic player.
- **GeckoView only** (Firefox 156 on the glasses).

## Commands

- `npm run dev`, `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (after a build: plays
  the game in Chromium and Firefox with the band's keys, screenshots in `.e2e-output/`)
- `npm run package` builds `dist/lumen-goat-climb.mrbd.zip`, the package Lumen installs.
