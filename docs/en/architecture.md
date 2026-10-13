# CHAGS Architecture · v1.2

> Status: living document. Chinese version: [../技术方案.md](../技术方案.md)
> A collection of small games about Chinese historical anecdotes and myths, for children aged 7–10.

**In one line:** Phaser 4 + Vue 3.5, H5-first, five layers ("shell + engine + gameplay templates + content data + standalone game bundles").
Each story is an independently developed, independently bundled, lazily loaded game module. Gameplay skeletons are reused
through templates; story content is driven by JSON.

---

## 0. TL;DR

| Decision | Choice | Why |
|---|---|---|
| Game engine | **Phaser 4.2** (MIT) | Pure code, diffable, unit-testable — the best fit for a collection of small modules |
| Shell | **Vue 3.5 SFC + Pinia 4 + Tailwind 4** | Hall / album / settings are UI-heavy; single-file components keep a page in one file |
| Language | **TypeScript 5.9.3** (strict) | Engine and games are separated by contracts; types are the main safety net |
| Build | **Vite 8 + pnpm workspace** | Native multi-entry and code splitting — every game becomes its own chunk automatically |
| Content | **JSON + zod, validated at build time** | New story = new data, not new code |
| Gameplay | **Template library** | Makes story #30 far cheaper than story #1 |
| Storage | **IndexedDB, local-first, behind an interface** | No backend, no ads, no personal data — the safest option for children's privacy |
| Offline | **PWA** (planned) | Playable on weak networks, installable to the home screen |
| i18n | **Chinese + English, switchable at runtime** | UI, story content, narration and docs all follow |
| Backend | **None** | A static site is the cheapest, most stable and most compliant deployment |

**Three architectural rules** — everything below obeys them:

1. **Logic is separate from rendering.** Scoring, judging and scheduling live in plain TypeScript that never imports
   Phaser, so they can be unit-tested without a browser.
2. **Games never touch the environment.** Storage, audio, lifecycle and sharing all go through the injected
   `GameContext`. No game may call `localStorage`, `fetch` or `wx.*` directly — this is the
   single cheap escape hatch for a future WeChat mini-game port or cloud saves.
3. **Every game is headlessly drivable.** `#/play/<id>?seed=fixed&autoplay=1`, otherwise automated testing and
   AI-assisted development are impossible.

---

## 1. Constraints derived from the product

The product is a **collection of Chinese historical anecdotes for children (6–12), where the point is not "played it"
but "remembered it and understood what it means."**

| # | Product need | Technical constraint |
|---|---|---|
| 1 | A parent hands over a phone; no install allowed | H5 / PWA, playable from a link |
| 2 | Short attention span; a session is 3–5 minutes | No long connections, no loading waits, resumable at any time |
| 3 | Played in cars, at grandparents', on weak networks | Static assets + Service Worker precache |
| 4 | Must run on old Android phones and old iPads | 2D, strict size budget, graceful degradation |
| 5 | **"Remembering" is the core metric** | The content model itself carries *key discovery / misconceptions / transfer questions / review interval* |
| 6 | The collection should grow to 30–100 stories | Modular boundaries + a template library: a new story = one package + one JSON file |
| 7 | Parents ask about privacy | No ad SDK, no social features, no personal data, local by default |
| 8 | Likely developed with heavy AI assistance | All-text assets (diffable), unit-testable, one command to verify, deterministic randomness |

Point 8 is not a footnote: it rules out editor-driven engines (Cocos, Unity) whose scenes are binary or giant JSON blobs —
impossible to review, diff or verify automatically.

---

## 2. Technology choices

### 2.1 Engine comparison

| Option | Fit for a collection | WeChat mini-game | Pros | Cons | Verdict |
|---|---|---|---|---|---|
| **Phaser 4.2** | ★★★★★ | needs adapter work | Pure code/TS, MIT, mature ecosystem, tree-shakable ESM | No editor; UI must be written by hand | ✅ **chosen** |
| Phaser 3.90 | ★★★★☆ | community adapters exist | Most tutorials | Previous generation | fallback only |
| Cocos Creator 3.x | ★★★☆ | ★★★★★ one-click export | Strong Chinese ecosystem, editor | Editor assets are opaque to CI/AI; large bundles | fallback if mini-game is mandatory |
| PixiJS | ★★☆ | no | Fast, small | A renderer, not a framework | ✗ |
| Godot 4 Web | ★★☆ | no | Nice tooling | 30 MB+ web export, poor mobile browser support | ✗ |
| Unity WebGL | ★ | no | 3D | Unusable as mobile H5 | ✗ |
| Plain DOM/CSS | ★★★ (quiz only) | yes | Lightest, accessible | Can't do drag/physics/board interactions | album & review screens only |

**Measured engine size** (`phaser@4.2.1/dist/phaser.min.js`, full build): 1,375,976 bytes raw, **357,778 bytes gzip (≈350 KB)**.
This number is why the engine must never enter the shell bundle: it loads only when a game starts, and is cached afterwards.

### 2.2 Shell: Vue 3.5, not all-Phaser

Vue 3.5 SFC + Composition API + Pinia. The reason is that the hall, album, settings and parent screens are UI-heavy:
DOM plus Tailwind is far faster to build than drawing lists, scrolling and forms inside a canvas.

**Phaser appears only in `games/*` and `packages/phaser-kit`** — the shell bundle never contains it.

**Vue × Phaser pitfalls (learned the hard way):**

1. **Hold the Phaser instance in `shallowRef` or `markRaw`.** A plain `ref` makes Vue deeply proxy the
   entire Phaser object graph (scenes, textures, WebGL context) — sluggish at best, crashing at worst.
2. **Never wrap the game container in `<KeepAlive>` or `<Transition>`.** Always `await unmount()`
   before leaving the route, or the RAF loop and canvas leak.
3. **Give game modules an HMR boundary** so editing a scene triggers a full reload instead of stacking canvases.
4. **Never keep Phaser GameObjects inside `computed` or `watch`** — they are not reactive data.
5. The minimal host is `defineProps` + `shallowRef` + `onMounted`/`onBeforeUnmount`.

### 2.3 Version baseline (measured 2026-10-13)

| Package | Version | Note |
|---|---|---|
| phaser | **4.2.1** | latest |
| vue | **3.5.44** | latest stable (3.6 is still RC) |
| @vitejs/plugin-vue | 6.0.10 | supports Vite 8 |
| pinia | 4.0.3 | |
| vue-tsc | 3.3.13 | SFC type checking |
| vite | 8.3.4 | Rolldown |
| **typescript** | **5.9.3** | ⚠️ deliberately not 7.0.2 — see below |
| tailwindcss | 4.3.3 | |
| zod | 4.6.7 | content schemas |
| eslint / eslint-plugin-vue / typescript-eslint | 10.12 / 10.11.1 / 8.71.2 | |
| vitest / @playwright/test | 5.0.4 / 1.64.0 | |
| pnpm / node | 11.22.0 / 24.9.0 | |

> 🔴 **Measured hard constraint: TypeScript 7 cannot be used here.**
> `typescript@7.0.2 + vue-tsc@3.3.13` → `ERR_PACKAGE_PATH_NOT_EXPORTED: './lib/tsc'`. TS 7 (the native Go
> compiler) removed that subpath export and `vue-tsc` depends on it; no published vue-tsc supports TS 7.
> With `typescript@5.9.3` the same code works and correctly reports `src/Hello.vue(3,7): error TS2322`.
> TS 5.9.3 is the only version satisfying `vue-tsc >=5.0.0`, `typescript-eslint <6.1.0` and
> `pinia >=5.6.0` at once. Cost: no native-compiler speed-up yet. Code changes needed to upgrade later: none.

### 2.4 Art and asset pipeline

- **WebP** (with AVIF as progressive enhancement); sprite sheets for sequences; ≤ 200 KB per image.
- 750×1334 portrait design resolution; `@1x`/`@2x` only.
- Fonts **must be commercially licensed** (Noto Sans SC, LXGW WenKai, ZCOOL KuaiLe — verify each). Subset them: a full CJK
  font is 5–10 MB, a subset can be ~100 KB.
- Keep an `ASSETS-LICENSES.md` ledger from day one.
- Style: **rounded cartoon with Chinese colours** (vermilion / indigo / cream / ink).
- **Stage 0–1 ship zero image assets**: everything is drawn with Phaser Graphics, so gameplay could be verified before art
  existed. Swapping in real art changes no code.

### 2.5 Audio

- Audio goes through `PlatformServices.audio`, never directly through Phaser's sound system.
- **iOS and WeChat require a user gesture to unlock audio** — the shell does it once on the first tap.
- Narration is split per story beat; generated with TTS first, real voice-over later for key idioms.
- `AudioBus.speak(text, locale)` selects a `zh-CN` or `en-US` voice; recorded audio would follow the
  same locale switch (`audio/<locale>/<id>.m4a`).
- **Stage 0 approach (zero files):** TTS for narration, WebAudio oscillators for effects. Interfaces unchanged when real
  audio arrives.

### 2.6 Data and storage

- **No backend.** Progress, album and review schedule live in IndexedDB behind `ProgressStore`.
- The save file carries `schemaVersion` + `migrate()`: writing migration now is nearly free; adding it later
  is a disaster.

### 2.7 Testing and quality

| Level | Tool | Covers |
|---|---|---|
| Types | `vue-tsc --noEmit` | Whole repo, including `.vue` |
| Lint | eslint 10 flat + eslint-plugin-vue + typescript-eslint | Style, plus banned APIs (no `Math.random`/`Date.now` in logic) |
| Unit | Vitest | Pure logic: judging, scoring, scheduling, merging |
| Content | `content:check` | zod schemas, template stage schemas, **translation completeness**, cross-references |
| End-to-end | Playwright | Real-mouse playthroughs, autoplay runs, screenshot capture, production-build chunk loading |
| Size | size-limit (planned) | Bundle budgets |

**One command: `pnpm verify` = typecheck → lint → test → content:check → build.** For AI-assisted work this command
*is* the definition of done.

### 2.8 Deployment

- Static output on a CDN. For mainland China: an ICP-registered domain plus a domestic CDN — registration is a hard
  prerequisite for the WeChat ecosystem, so start early.
- PWA: precache the shell and played games.

### 2.9 Anti-scope

Accounts, backend APIs, leaderboards, multiplayer, IAP, ads, 3D, a CMS, and multi-language *content editing* beyond the
two shipped languages. All of them raise cost and compliance risk while contributing nothing to "make the child remember".

---

## 3. Architecture

### 3.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Shell  apps/site  (Vue 3.5 SFC)                             │
│  hall · timeline scroll · album · settings · parent area      │
│  ── state: Pinia ── routing: hash composable ── i18n: @chags/i18n
└───────────────┬─────────────────────────────────────────────┘
                │  dynamic import (code splitting; Phaser appears only here)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Game bundle  games/<id>   ← one story = one package          │
│  scene composition (Phaser)    logic/ (pure TS, unit-testable)│
└───────────────┬─────────────────────────────────────────────┘
                │  depends only on the layers below, never on the shell
                ▼
┌──────────────┬──────────────┬──────────────┬────────────────┐
│ game-kit     │ templates    │ content      │ phaser-kit     │
│ contracts    │ gameplay     │ story data   │ engine boot,   │
│ + events     │ templates    │ + i18n       │ cartoon, drag  │
└──────────────┴──────────────┴──────┬───────┴────────────────┘
                                     │
                        ┌────────────┴───────────┐
                        │ progress   │ platform  │  saves & review · storage/audio/lifecycle
                        └────────────┴───────────┘
```

`game-kit` and `content` contain **no Phaser dependency**, so the shell can import them safely.

### 3.2 Repository layout

```
apps/site/            Vue 3.5 shell
packages/
  game-kit/           GameModule / GameContext / events (no Phaser)
  content/            story JSON + zod + translations + localisation
  i18n/               UI message catalogs
  templates/          gameplay templates + stage schemas + content checker
  phaser-kit/         engine bootstrap, cartoon primitives, drag controller, base scene
  platform/           Web implementations: IndexedDB / WebAudio / TTS / lifecycle
  progress/           save file, migration, spaced repetition (pure)
games/
  caochong-elephant/  Cao Chong Weighs the Elephant
  pangu/              Pangu Splits Heaven and Earth
e2e/                  Playwright
docs/  docs/en/       design docs, Chinese and English
```

Packages point `"exports"` straight at `./src/index.ts` (just-in-time packages): **no build step, no path aliases**,
one edit is immediately visible everywhere.

### 3.3 Core contracts

```ts
export interface GameManifest {
  id: string;
  title: string;
  version: string;
  template: TemplateId;                 // primary template id, e.g. 'substitution'
  orientation: 'portrait' | 'landscape';
  designSize: { width: number; height: number };
  ageRange: [number, number];
  sessionSeconds: [number, number];
  skills: string[];
  curriculum: { dynasty: string; yearApprox?: number; figures: string[] };
  assets: { cover: string };
}

export interface GameEventMap {
  'session:start':  { at: number };
  'scene:enter':    { scene: string };
  'beat:enter':     { beatId: string };
  'choice:made':    { beatId: string; choiceId: string; correct: boolean; latencyMs: number };
  'hint:used':      { beatId: string; level: number };
  'level:complete': { levelId: string; stars: 0|1|2|3; mistakes: number; correct: number; total: number; durationMs: number };
  'card:unlocked':  { allusionId: string; cardId: string };
  'session:exit':   { reason: 'complete'|'quit'|'background'; progress: number };
}

export interface GameContext {
  container: HTMLElement;
  manifest: GameManifest;
  content: AllusionContent;      // already localised — the game never knows a language exists
  services: PlatformServices;    // storage / audio / lifecycle / share / telemetry
  locale: Locale;
  reducedMotion: boolean;
  debug?: { seed?: string; skipIntro?: boolean; autoplay?: boolean };
  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void;
  requestExit(): void;
}

export interface GameModule {
  manifest: GameManifest;
  mount(ctx: GameContext): Promise<void>;   // creates its own Phaser.Game
  unmount(): Promise<void>;                 // must destroy it; no global leftovers
  pause(): void;
  resume(): void;
}
```

The shell keeps exactly one file that knows all games:

```ts
export const registry: Record<string, () => Promise<{ default: GameModule }>> = {
  'caochong-elephant': () => import('@chags/game-caochong-elephant'),
  pangu: () => import('@chags/game-pangu'),
};
```

Vite turns each game into its own chunk automatically. **Adding a story touches no shell logic beyond one import line.**

### 3.4 Template library

**A game = templates (skeleton) + one content JSON (flesh) + bespoke art and narrative (character) + ~20% custom code.**

One story can chain several templates (`game.stages` in the content) and may insert a game-specific scene.
Pangu is all three at once:

```
story (two opening beats) → chaos (bespoke: tap the egg, chaos bursts)
                          → grow  (hold the sky: 30 taps, 18,000 years)
                          → place (six orbs return to sun, moon, rivers, plants)
                          → reward (story card)
```

| Template | Interaction primitive | Story kind | Used by | Status |
|---|---|---|---|---|
| `story` | Storybook beats + narration (shared opening) | any | all | ✅ |
| `substitution` | Drag + waterline: swap for something weighable | principles | Cao Chong | ✅ |
| `grow` | Repeated taps make one thing grow, against rising resistance | persistence | Pangu | ✅ |
| `place` | Drag items to where they belong | belonging, transformation | Pangu | ✅ |
| `quiz` | Multiple choice (review mode only, never on first play) | recall, transfer | review centre | ✅ |
| `match` | Pairing | concepts | 望梅止渴, 杯弓蛇影 | todo |
| `order` | Sequencing / timeline | cause and effect | 拔苗助长, 一鸣惊人 | todo |
| `board` | Board tactics | strategy | 田忌赛马 | todo |
| `timing` | Timing bar | waiting vs acting | 守株待兔 | todo |
| `react` | Reaction tapping | quick thinking | 司马光砸缸 | todo |
| `branch` | Branching choices | decisions and consequences | 完璧归赵 | todo |
| `build` | Repair / build | putting things right | 亡羊补牢 | todo |

Templates trade off against sameness. The hard rule is that **every story must declare a `keyMoment`** (the
discovery the child should make), and that templates only supply interaction primitives — narration, art, feedback and
sound stay bespoke. Target ratio: **60% reuse / 40% custom**.

### 3.5 Content model

Content is fully separated from code; a non-programmer can edit it, and `content:check` blocks mistakes at build time.

```jsonc
{
  "id": "pangu",
  "title": "盘古开天辟地",
  "kind": "myth",                    // 'history' (default) | 'myth'
  "yearApprox": -9999,               // timeline ordering only; myths sit at the far left
  "source": { "book": "《三五历纪》", "quote": "天地混沌如鸡子……" },
  "moral": "他把自己，变成了整个世界。",
  "keywords": ["混沌", "分开", "化身"],
  "story": [ { "id": "s1", "title": "…", "text": "…", "narration": "…" } ],

  "keyMoment": {                     // ★ the seed of the gameplay
    "beatId": "s2",
    "question": "盘古倒下了，可这个世界是从哪里来的？",
    "options": [ { "id": "body", "text": "…", "isCanonical": true, "hint": "" } ],
    "reveal": "…"
  },

  "misconceptions": ["…"],           // used for distractors and review
  "quiz": [ { "kind": "transfer", "question": "…", "options": ["…"], "answer": 0 } ],

  "game": {
    "template": "grow",              // primary template (thumbnail / filtering)
    "stages": [                      // executed in order
      { "template": "grow",  "levelScript": { "targetValue": 18000, "stepValue": 600 } },
      { "template": "place", "levelScript": { "slots": [], "orbs": [] } }
    ]
  }
}
```

The `★` fields are the technical answer to "make the child remember": **they are part of the data model, not a note in
a design doc.**

### 3.6 Memory engineering (five layers → technical hooks)

| Layer | Mechanism | Implementation |
|---|---|---|
| L1 | **Immersion** — do the story, don't read it | `story` beats with narration; the child plays the role |
| L2 | **Key discovery** — work it out yourself | Embodied in the interaction (drag, tap, push); `keyMoment` supplies the reveal line and review questions |
| L3 | **Multi-channel encoding** — see, hear, do, say | Art, speech, dragging, spoken lines on placement |
| L4 | **Collection and structure** — story cards, timeline scroll | `card:unlocked`; cards placed by `yearApprox` on a scroll from myth to late imperial China |
| L5 | **Spaced repetition + transfer** — meet it again after 1/3/7/21 days | `packages/progress` (simplified SM-2) plus transfer questions |

### 3.7 Kid-facing UX rules

Tap targets ≥ 88×88 logical px; no hover-dependent UI; no fail state, no timer pressure, unlimited retries;
pinyin and speech alongside text; minimum 28 px type; never encode meaning in colour alone; a rest prompt after 20 minutes;
a parent lock for exit and settings; respect `prefers-reduced-motion`; no ads, no external links, no personal data
(China's Regulations on the Protection of Minors in Cyberspace and the Provisions on the Protection of Children's Personal
Information).

### 3.8 Platform adapter

`PlatformServices` is the single platform boundary: `storage` (IndexedDB → `wx.setStorage`),
`audio`, `lifecycle`, `share`, `telemetry` (a local buffer that never leaves the device), `now()`.

**Being honest about WeChat mini-games:** it is not "swap the adapter and ship". WebGL context differences, package-size
limits, the `wx` global and asset loading all need work. If a mini-game must ship first, use Cocos Creator or spend
two or three days proving Phaser works there. If H5 ships first (the current plan), this architecture is optimal and a
mini-game becomes an optional later branch.

---

## 4. Key decisions (ADR summary)

| # | Decision | Why | When to revisit |
|---|---|---|---|
| 1 | H5 first, no native app | Zero install friction, fastest iteration, simplest compliance | If app-store distribution is needed |
| 2 | Phaser 4 over Cocos | All-code assets, CI/AI friendly, one command verifies | If a mini-game becomes mandatory |
| 3 | Vue 3.5 SFC shell + Phaser games | Each side plays to its strength; Phaser stays out of the shell bundle | — |
| 4 | pnpm workspace, source-linked packages | One package per story, no build step | — |
| 5 | Content JSON + zod | New story needs no code; errors surface at build time | — |
| 6 | Template library + scene factories | Makes content scale | Sameness risk, offset by 40% bespoke work |
| 7 | Logic separate from rendering | Rules testable in Node; AI can change logic without touching rendering | — |
| 8 | Local-first, no backend | Zero ops, best privacy | Cloud saves later via `ProgressStore` |
| 9 | **TypeScript pinned to 5.9.3** | Measured: vue-tsc is incompatible with TS 7 | When vue-tsc supports TS 7 |
| 10 | Zero art/audio assets in early stages | Verify the loop first; swapping assets changes no code | When real art arrives |
| 11 | Every game headlessly drivable | Prerequisite for automated tests and AI work | — |
| 12 | **Content localisation via structural patches** | Keeps source JSON readable; untranslated stories fall back to Chinese | — |

---

## 5. Performance and size budget

| Metric | Budget | Notes |
|---|---|---|
| Shell JS | **≤ 150 KB gzip** | currently **63.4 KB**, Phaser excluded |
| Per-game chunk | ≤ 120 KB gzip | currently 3 KB and 7 KB |
| Phaser | ≈ 350 KB gzip | measured; shared chunk, loaded on first game |
| Per-game first-screen assets | ≤ 2 MB | lazy, per beat |
| Playable within | ≤ 3 s on 4G | shell + cover only |
| Frame rate | 60 fps mid-range Android, ≥ 30 fps low-end | degradation path: fewer particles, lower fps |
| Session length | 3–5 minutes | matches attention span |

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **Art production is the bottleneck** | One style guide, componentised assets, one story finished as a visual reference first |
| Gameplay sameness | ≥ 8 templates; every story needs a `keyMoment`; forced bespoke work |
| Mini-game porting uncertainty | Decide early; prove with a short spike before committing |
| Font / music licensing | Only commercially licensed sources; keep the ledger |
| Historical accuracy | Every story cites its source text; an editorial checklist |
| Full CJK font size | Subsetting and lazy loading |
| Silent audio on iOS/WeChat | Unlock on the first gesture in the shell |
| **Vue reactivity swallowing Phaser** | `shallowRef`/`markRaw`, no KeepAlive around the host, full reload on scene HMR |
| **Phaser 4 Container hit areas are unintuitive** | Measured: a tap on A grabbed B 80 px away. Replaced with a distance-based drag controller (also kinder to small fingers) |
| **TypeScript 7 is unusable here** | Measured and pinned to 5.9.3; verify vue-tsc before upgrading |
| Over-engineering | Stage 0 was time-boxed to one week: one template, one story, end to end |

---

## 7. Roadmap

### Stage 0 — technical proof ✅ (completed 2026-10-13)
Workspace, content schemas, `story` + `substitution` templates, Cao Chong end to end, Playwright smoke tests,
`pnpm verify`.

**Result:** `pnpm verify` green; 19 unit tests; real-browser playthrough; shell 59.5 KB gzip (no Phaser).

### Stage 1 — playable collection (in progress)
Two stories shipped, four templates plus a bespoke scene, bilingual, album and progress.

### Stage 2 — expansion (ongoing)
Templates up to 8, stories up to 20–30, spaced repetition running on real usage data.

### Stage 3 — platform (optional)
Cloud saves (swap `PlatformServices.storage`), accounts, parent reports, a WeChat mini-game spike.

---

## 7.1 Cao Chong: from "tap a button" to "do it yourself" (2026-10-13)

The first version was judged "rigid, too much text, preachy". The diagnosis: **the "key discovery" had been turned into a
text multiple-choice question**, and "remembering" into reading plus quizzing — the child was always *reading*, never *doing*.

| | Before | After |
|---|---|---|
| Story | 4 beats with a "next" button | 2 beats, tap anywhere, one line each |
| Key discovery | A three-option text question | **No question** — the child works it out by trying |
| Gameplay | Tap stone buttons, watch a number | **Drag** the elephant and the stones, watch the waterline |
| Payoff | Three text questions | Stones go on the scale, the total climbs to 3000 |
| On-screen text | A sentence or two per screen plus questions | Almost none — shape, motion and sound |

**Four stages (a reusable "equivalent substitution" skeleton):**

1. **Weigh it directly** → the scale collapses: the child discovers the problem by hitting it
2. **Onto the boat** → the boat sinks and leaves a waterline: the child finds that a boat can record weight
3. **Carve the mark** → the child records it by hand
4. **Swap for stones** → carry stones until the mark returns to the water: **this is equivalent substitution itself**
5. **Weigh the stones** → the numbers add up: 3000

`keyMoment` data is still kept, but **is no longer rendered as a multiple-choice question** — it supplies the reveal
line and the review questions. The discovery is carried by the interaction.

**Reusable pieces that came out of it:** `cartoon.ts` (thick-outlined rounded shapes, ground shadows, wavy water,
sparkles, ripples, a cartoon hand, squash-and-stretch) and `createDragController` (grab the nearest target within a
radius — no reliance on GameObject hit areas).

## 7.2 Pangu: the second story (2026-10-13)

Myths are handled differently from history: Cao Chong is "clever problem-solving", Pangu is "the grandeur of creation and
giving yourself away". The content model gained `kind: 'history' | 'myth'`; myths use `yearApprox: -9999` and sit
at the far left of the timeline scroll, producing a span "from myth to recorded history".

**Two new reusable templates**
- **`grow`** (persistence): repeated taps make one thing grow. Reusable for 愚公移山, 精卫填海, 铁杵磨针, 闻鸡起舞, 卧薪尝胆.
- **`place`** (belonging): drag things where they belong. Reusable for 孔融让梨, 完璧归赵, 负荆请罪.

The "tap the egg until it bursts" scene is **game-specific code** (`games/pangu/src/scenes/chaos.ts`), not a template —
the 40% custom half of the 60/40 rule.

**Three design decisions**

1. **Persistence becomes sore fingers.** "The sky rises a zhang a day, the earth thickens a zhang a day, Pangu grows a
   zhang a day" turns into "each tap raises the sky one zhang and stretches the figure on screen", 30 taps for 18,000 years.
   Pitch rises with height, so progress is audible.
2. **Failure-free placement.** Pick up an orb and its destination glows. Shape plus hint, no text; each arrival is
   **spoken aloud** ("his left eye became the sun") — heard, not read.
3. **Handling death.** There is no depiction of death. Pangu "lies down, becomes light, and the light returns to the world",
   with soft audio. The visual language is "he became the world", not "he died".

**Measured:** `pnpm verify` green; 6 end-to-end tests including a real-mouse Pangu playthrough; production build with
a 60.6 KB gzip shell and 3 KB / 7 KB game chunks.

## 7.3 Bilingual Chinese/English (2026-10-13)

| Layer | Approach | Why |
|---|---|---|
| **UI strings** | New `@chags/i18n`: one flat key→text catalog per language | Generic labels don't belong in story JSON |
| **Story content** | Chinese stays in `allusions/*.json`; translations live in `i18n/en/*.json` as structural mirrors | Keeps source readable; an untranslated story still runs |
| **Narration** | `AudioBus.speak(text, locale)`; TTS picks a `zh-CN`/`en-US` voice | Recorded audio will follow the same locale switch |
| **Docs** | `README.md` / `README.en.md`; `docs/` and `docs/en/` | Each language reads as its own document |

**Key design points**

1. **Games never know a language exists.** The shell hands over the result of `getAllusion(id, locale)` — already
   translated. Adding a language is adding one JSON file; zero game code changes.
2. **Translation completeness is enforced at build time.** `pnpm content:check` verifies, per story: missing
   translations, structural mismatches, array lengths, and over-long text after merging. The message catalog is checked at
   compile time (a missing English key is a type error) and by unit tests (Chinese and English must not be identical, which
   catches copy-paste omissions).
3. **Language priority:** `?lang=` > last choice (localStorage) > Chinese. `?lang=en` makes share links and
   automated tests deterministic.
4. **Switching language remounts the game** (the host is keyed by locale), so no half-translated scene can survive.

**Measured:** `pnpm verify` green; **8 end-to-end tests**, one dedicated to switching languages (UI, story titles,
story cards, and persistence across a reload). Shell 63.4 KB gzip.

---

## 8. Confirmed decisions

1. ✅ Stack: Phaser 4.2 + Vue 3.5 + Vite 8 + TypeScript 5.9.3 + pnpm workspace, H5-first, no backend, local saves.
2. ✅ Target: mobile browsers and in-app webviews, portrait, zero install.
3. ✅ Art and audio: procedural geometry, WebAudio effects, TTS narration — no real voice-over.
4. ✅ Architecture granularity: pnpm workspace with multiple packages.
5. ✅ First story: Cao Chong Weighs the Elephant.
6. ✅ Art style: rounded cartoon.
7. ✅ Myth data model: a `kind` field; myths at the far left of the timeline.
8. ✅ Second story: Pangu, shipping the `grow` and `place` templates.
9. ✅ Bilingual UI / content / narration / docs, with build-time enforcement.

## 9. Still open

- Which story is third (suggestion: 司马光砸缸 — the `react` template, complementing Cao Chong's slow reasoning).
- When real art enters the pipeline.
- Whether the timeline scroll should tint myths differently (data is ready, UI is not).
- Whether to pursue WeChat mini-games.

---

*This document covers technology and architecture. Per-story gameplay design lives in separate documents.*
