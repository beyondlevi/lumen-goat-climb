# Goat Climb

A climbing game for [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) glasses, played with
the Meta Neural Band. A mountain goat jumps from ledge to ledge: climb as high as you can before
the mountain leaves you behind.

| Band | In the game |
| --- | --- |
| Swipe left | Leap up and to the left (mid-air: drift left) |
| Swipe up | Jump straight up (mid-air: stop drifting) |
| Swipe right | Leap up and to the right (mid-air: drift right) |
| Index tap | How to play, resume |
| Middle tap | Pause; exit from the title |

Off one side of the screen, the goat comes back on the other. The mountain keeps rising: fall
below the bottom edge and the climb ends. The best height stays on the glasses.

## Five phases

| Height | Phase | What changes |
| --- | --- | --- |
| 0 m | Meadow | Wide, steady ledges |
| 200 m | Forest | Logs slide sideways; the mountain rises faster |
| 450 m | Cliffs | Cracked ledges fall after one landing |
| 750 m | Snow | Ice slides you along; wind pushes you mid-air |
| 1100 m | Peak | Clouds fade away; eagles swoop. It keeps getting faster |

Every mountain is generated, and only with ledges a goat can reach: a ledge that goes away is
never the only way up.

## Install on the glasses

Download `lumen-goat-climb.mrbd.zip` from the [releases](https://github.com/beyondlevi/lumen-goat-climb/releases)
and add it from the Lumen companion's Apps tab, or push it to the glasses:

```sh
adb push lumen-goat-climb.mrbd.zip /sdcard/Android/data/dev.lumen.glasses/files/webapps/
```

Lumen installs it the next time its home opens. The game runs offline: it never uses the
internet.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173 (arrows, Enter, Escape play it)
npm test           # unit tests, including an automatic player climbing 20 mountains
npm run package    # dist/lumen-goat-climb.mrbd.zip
npm run test:e2e   # after a build: plays it in Chromium and Firefox, screenshots in .e2e-output/
```

The game draws on a 480 x 640 canvas (the Rokid display, portrait) with line art on black:
black is see-through on the glasses and their green display turns colors into brightness. The
texts are in English and Portuguese (`src/i18n.ts`).

## License

MIT (see [LICENSE](LICENSE)). The fonts, [Bungee](https://github.com/djrrb/Bungee) and
[Chakra Petch](https://github.com/m4rc1e/Chakra-Petch), are under the SIL Open Font License 1.1
(`public/fonts/OFL-*.txt`).
