# CHAGS · Chinese Historical Anecdotes Game Series

One story, one small game — kids remember an anecdote by **playing** it, not by reading it.

**English** · [中文](README.md) ｜ The app switches between Chinese and English in one tap (UI / story content / narration all follow).

![Release](https://github.com/znlgis/CHAGS/actions/workflows/release.yml/badge.svg)

## Tech stack

Phaser 4.2 (games) · Vue 3.5 + Pinia (shell) · Vite 8 · TypeScript 5.9.3 · pnpm workspace · Vitest · Playwright

> ⚠️ TypeScript is deliberately pinned to **5.9.3**: TypeScript 7 removed the `./lib/tsc` subpath export,
> which makes `vue-tsc@3.3.13` fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` (verified locally).

## Getting started

```bash
pnpm install
pnpm dev            # dev server at http://127.0.0.1:5183
pnpm verify         # typecheck + lint + test + content:check + build (must be green before committing)
pnpm e2e            # Playwright end-to-end (run npx playwright install chromium first)
pnpm e2e:dist       # same suite against the production build (verifies chunk lazy-loading)
pnpm audit:i18n     # screenshot every screen in both languages into .scratch/i18n-audit/
pnpm dist:win       # portable Windows exe (~3.3 MB, double-click to play, no install)
pnpm dist:apk       # Android APK (sideload)
```

Handy debug links:

- `/?autoplay=1#/play/caochong-elephant` — play the whole game automatically (used for headless verification)
- `/?lang=en` — force English

## Current status

**Twelve stories** are playable. `pnpm verify` is green and every story has a real-mouse-input
playthrough in the end-to-end suite.

The shell stays small (Phaser is not in it). Each game's own business code is only a few KB;
Phaser is a shared chunk loaded only when a game starts — see `pnpm size` for the exact numbers.

### 1. Cao Chong Weighs the Elephant (history · substitution)

No "next" button, no multiple-choice question. The player performs Cao Chong's four steps:

drag the elephant onto the scale (it collapses) → drag it onto the boat (the boat sinks)
→ tap the hull to carve the waterline → carry stones aboard until the mark meets the water
→ weigh the stones: 3000.

| Story beats | The scale collapses | Carving the mark | Swapping for stones | The mark meets the water | Elephant = 3000 |
|---|---|---|---|---|---|
| ![story](docs/screenshots/02-story.png) | ![collapse](docs/screenshots/04-scale-fails.png) | ![mark](docs/screenshots/05-mark.png) | ![stones](docs/screenshots/06-substitute.png) | ![match](docs/screenshots/07-matched.png) | ![weighed](docs/screenshots/08-weighed.png) |

### 2. Pangu Splits Heaven and Earth (myth · creation and transformation)

Five stages, built from three templates plus one bespoke scene:

1. **Crack** — tap the egg four times; chaos bursts open, light specks rise, dark lumps sink
2. **Hold** — tap 30 times: the sky rises, the earth sinks, **Pangu is literally stretched on screen**, up to 18,000 years
3. **Give** — drag six orbs home: left eye → sun, right eye → moon, hair → stars, breath → wind, blood → rivers, skin → plants

When you pick up an orb, its destination glows — no failure, no text. On arrival the original line is **spoken aloud**.
There is no depiction of death anywhere: Pangu "lies down, becomes light, and the light returns to the world".

| The egg | Cracks | Holding the sky | Placing an orb | The finished world |
|---|---|---|---|---|
| ![egg](docs/screenshots/13-chaos.png) | ![cracks](docs/screenshots/14-cracked.png) | ![hold](docs/screenshots/17-sky-high.png) | ![place](docs/screenshots/19-sun-placed.png) | ![world](docs/screenshots/20-world-complete.png) |

### 3. Houyi Shoots the Suns (myth · aim and restraint)

Drag back to aim, release to shoot. Ten suns scorch the land — but you must not shoot them all.
After nine, the ground turns green and the last sun turns warm; shoot that one too and **the sky goes
dark for a moment**, then the sun comes back by itself with one short line: leave one sun. No punishment.

| Ten suns | Aiming | Nine down |
|---|---|---|
| ![suns](docs/screenshots/35-houyi-ten-suns.png) | ![aim](docs/screenshots/36-houyi-aiming.png) | ![nine](docs/screenshots/37-houyi-nine.png) |

### 4. Nüwa Mends the Sky (myth · repair)

Five holes in the sky, one shape each. Drag the five-coloured stones into the matching hole —
**the match is by shape, not by colour**, so colour-blind kids can play it too.

| Five holes | One mended | The sky mended |
|---|---|---|
| ![holes](docs/screenshots/31-nuwa-holes.png) | ![one](docs/screenshots/32-nuwa-one.png) | ![mended](docs/screenshots/33-nuwa-mended.png) |

### 5. Jingwei Fills the Sea (myth · persistence)

One tap, one stone. The bird is tiny and the sea is enormous — that disproportion is the whole point.
At the end a small island rises from the water, and she is still flying.

| A tiny bird, a huge sea | Halfway | An island appears |
|---|---|---|
| ![start](docs/screenshots/41-jingwei-start.png) | ![half](docs/screenshots/42-jingwei-half.png) | ![island](docs/screenshots/43-jingwei-island.png) |

### 6. Kuafu Chases the Sun (myth · running)

**Hold to run**, let go and you slow down. At the river Wei he stops for a drink, then runs on.
He never catches the sun — and the final screen has no him in it, only a peach grove.

| Running | Drinking | The peach grove |
|---|---|---|
| ![run](docs/screenshots/45-kuafu-running.png) | ![drink](docs/screenshots/46-kuafu-drinking.png) | ![peach](docs/screenshots/47-kuafu-peach.png) |

### 7. Yugong Moves the Mountains (fable · generations)

Tap to carry one basket. At 30% the scoffer arrives and shakes his head; at 60% Yugong grows old and
**hands the hoe to the next generation** — and the diggers on screen multiply.

| Two mountains | The scoffer | Three generations |
|---|---|---|
| ![mountains](docs/screenshots/49-yugong-mountains.png) | ![scoffer](docs/screenshots/50-yugong-zhisou.png) | ![generations](docs/screenshots/52-yugong-done.png) |

### 8. Shennong Tastes a Hundred Herbs (legend · taste before you sort)

Six plants, each with a question mark over it: **until you taste it, you cannot know what it is.**
Drag a plant to Shennong's mouth and a small badge appears on it — edible, medicine, or do not eat —
using the same picture as the wooden board it belongs to. No reading required.

Drop an untasted plant on a board and it is carried back to his mouth first: no mistake, no penalty.
Tasting a poisonous one only makes him frown and see stars for a moment.

| Unknown | One taste | Sorted |
|---|---|---|
| ![unknown](docs/screenshots/54-shennong-unknown.png) | ![taste](docs/screenshots/55-shennong-tasting.png) | ![sorted](docs/screenshots/56-shennong-sorted.png) |

### 9. Yu Tames the Flood (legend · dam or channel)

First he **dams** it himself: one tap, one basket of earth, and the water rises with the dike — until
the tenth tap, when the water tops the bank and the dike bursts. Only then does the game hand over the
other idea: draw a channel with a finger and the flood follows it, the water drops level by level and
green shoots come up on the land it leaves behind. Three channels, and each time he passes his own door
with the lamp still burning inside — and does not go in.

| Building the dike | It bursts | Drawing a channel |
|---|---|---|
| ![dike](docs/screenshots/58-dayu-dike.png) | ![burst](docs/screenshots/59-dayu-breach.png) | ![channel](docs/screenshots/60-dayu-channel.png) |

### 10. The Grand Duke Goes Fishing (history · waiting)

One screen of the Wei river, and the main line is simply **waiting**. The sun overhead is the progress
bar; the carriage on the horizon comes a little closer every moment.

Swap in a bent hook, add bait, move to another spot — each of those makes you wait longer (at most
three times, so you can never get stuck) and **you still never catch a fish**. When King Wen finally
arrives, you have to reel in the straight hook yourself.

| The straight hook, three feet above the water | Tap him for a line | Tempted |
|---|---|---|
| ![wait](docs/screenshots/62-taigong-waiting.png) | ![talk](docs/screenshots/63-taigong-listener.png) | ![tempted](docs/screenshots/64-taigong-tempted.png) |

### 11. The Beacon Fires (history · trust)

Light the fire once and the flame runs tower to tower; the lords ride in — and **she laughs**.
There are three pips of trust: one goes dark each time. The second time fewer riders come and someone
shakes his head on the way home; the third time **they do not even reach the gate**.

The fourth fire is real: smoke on the horizon, the flame runs out again, and **nobody comes**.
The child spends the trust with their own finger; there is not one line of preaching, the source note
says later historians doubt the story, and the fault lands on the one who lit the fire — not on her.

| Night | The flame runs out | She laughs | Nobody came |
|---|---|---|---|
| ![night](docs/screenshots/66-fenghuo-night.png) | ![relay](docs/screenshots/67-fenghuo-relay.png) | ![laugh](docs/screenshots/68-fenghuo-laugh.png) | ![nobody](docs/screenshots/69-fenghuo-nobody.png) |

### 12. The Man of Qi Who Worried the Sky Would Fall (fable · thinking it through)

Four worry bubbles float over his head: the sky will fall, the earth will sink, the sun and moon will
drop, the stars will come down. In the tray are four ways to think it through: a puff of air, a clod of
earth, the sun and moon, a pebble.

Drag one across and the bubble plays a short "look for yourself": air holds up birds and clouds, the
ground is firm under your foot, the sun comes back the next morning, a falling star is only a pebble.
The bubble pops, the room brightens — and when all four are gone the dark cloud clears and he sleeps.

| Four worries | One less | Asleep |
|---|---|---|
| ![worries](docs/screenshots/71-qiren-worries.png) | ![popped](docs/screenshots/72-qiren-one-less.png) | ![asleep](docs/screenshots/73-qiren-asleep.png) |

## Design principle: fewer words, more doing

Across all twelve stories there is almost no teaching text on screen: the two opening lines of a story,
and one short hint that only appears if the child is stuck. Everything else is shape, motion, sound and
speech. Kids **work out** the idea instead of being told it.

## Bilingual by design

| Layer | How |
|---|---|
| UI strings | `@chags/i18n` — one flat key→text catalog per language |
| Story content | Chinese lives in `allusions/*.json`; translations live in `i18n/en/*.json` as structural mirrors |
| Narration | `AudioBus.speak(text, locale)` — TTS picks a `zh-CN` / `en-US` voice |
| Docs | `README.md` / `README.en.md`, `docs/` and `docs/en/` |

**Games never know a language exists.** The shell hands them already-translated content, so adding a language
means adding one JSON file — zero game code changes. Missing translations are caught at build time by
`pnpm content:check` (missing keys, structural mismatch, array length, over-long text).

## Repository layout

```
apps/site                  Vue 3.5 shell: hall / game host / album, language switcher
packages/game-kit          Contracts (GameModule / GameContext / events). No Phaser.
packages/content           Story data + zod schemas + translations
packages/i18n              UI message catalogs (zh-CN / en)
packages/templates         Gameplay templates: story / substitution / tap / place / aim / sort / trace / wait / quiz / reward
packages/phaser-kit        Phaser bootstrap, cartoon drawing primitives, drag controller, base scene
packages/platform          Web services: IndexedDB / WebAudio / TTS / lifecycle
packages/progress          Save file, migration, spaced-repetition scheduling (pure functions)
games/caochong-elephant    Cao Chong Weighs the Elephant
games/pangu                Pangu Splits Heaven and Earth (+ bespoke chaos scene)
games/houyi, nuwa, jingwei, kuafu, yugong   Houyi / Nüwa / Jingwei / Kuafu / Yugong
games/shennong, dayu, taigong, fenghuo, qiren   Shennong / Yu / the Grand Duke / the beacon fires / the man of Qi
e2e                        Playwright smoke, real-input playthroughs, screenshot capture
```

## Three architectural rules

1. **Logic is separate from rendering** — rules live in plain TypeScript with no Phaser import, unit-testable in Node.
2. **Games never touch the environment** — storage, audio and lifecycle go through `GameContext.services`;
   no direct `localStorage`, `fetch` or `wx.*`.
3. **Every game is headlessly drivable** — `?seed=&autoplay=1` lets CI play it without a human.

See [docs/en/architecture.md](docs/en/architecture.md) for the full design.
