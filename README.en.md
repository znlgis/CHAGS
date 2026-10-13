# CHAGS · Chinese Historical Anecdotes Game Series

One story, one small game — kids remember an anecdote by **playing** it, not by reading it.

**English** · [中文](README.md) ｜ The app switches between Chinese and English in one tap (UI / story content / narration all follow).

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
```

Handy debug links:

- `/?autoplay=1#/play/caochong-elephant` — play the whole game automatically (used for headless verification)
- `/?lang=en` — force English

## Current status

Two stories are fully playable. `pnpm verify` is green and the end-to-end suite has **8 passing tests**,
each story covered by a real-mouse-input playthrough.

The shell is **63.4 KB gzip** (Phaser is not in it). Each game's own business code is only 3–7 KB;
Phaser is a shared chunk loaded only when a game starts.

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

## Design principle: fewer words, more doing

Across both games the only teaching text on screen is the two opening lines of each story.
Everything else is shape, motion, sound and speech. Kids **work out** the idea instead of being told it.

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
packages/templates         Gameplay templates: story / substitution / grow / place / quiz / reward
packages/phaser-kit        Phaser bootstrap, cartoon drawing primitives, drag controller, base scene
packages/platform          Web services: IndexedDB / WebAudio / TTS / lifecycle
packages/progress          Save file, migration, spaced-repetition scheduling (pure functions)
games/caochong-elephant    Cao Chong Weighs the Elephant
games/pangu                Pangu Splits Heaven and Earth (+ bespoke chaos scene)
e2e                        Playwright smoke, real-input playthroughs, screenshot capture
```

## Three architectural rules

1. **Logic is separate from rendering** — rules live in plain TypeScript with no Phaser import, unit-testable in Node.
2. **Games never touch the environment** — storage, audio and lifecycle go through `GameContext.services`;
   no direct `localStorage`, `fetch` or `wx.*`.
3. **Every game is headlessly drivable** — `?seed=&autoplay=1` lets CI play it without a human.

See [docs/en/architecture.md](docs/en/architecture.md) for the full design.
