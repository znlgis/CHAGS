# CHAGS · Chinese Historical Anecdotes Game Series

One story, one small game — kids remember an anecdote by **playing** it, not by reading it.

**English** · [中文](README.md) ｜ The app switches between Chinese and English in one tap (UI / story content / narration all follow).

![Release](https://github.com/znlgis/CHAGS/actions/workflows/release.yml/badge.svg)

## Tech stack

Phaser 4.2 (games) · Vue 3.5 + Pinia (shell) · Vite 8 · TypeScript 5.9.3 · pnpm workspace · Vitest · Playwright

> ⚠️ TypeScript is deliberately pinned to **5.9.3**: TypeScript 7 removed the `./lib/tsc` subpath export,
> which makes `vue-tsc@3.3.13` fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` (verified locally).

## Getting started

Requirements: **Node 24 + pnpm 11.22** — the same versions as the CI `NODE_VERSION` and the `packageManager` field in `package.json`.

```bash
pnpm install
pnpm dev            # dev server at http://127.0.0.1:5183
pnpm verify         # typecheck + lint + test + content:check + build + size (must be green before committing)
pnpm e2e            # Playwright end-to-end (run npx playwright install chromium first)
pnpm e2e:dist       # same suite against the production build (verifies chunk lazy-loading)
pnpm audit:i18n     # screenshot every screen in both languages into .scratch/i18n-audit/
pnpm icons          # regenerate the app icons (needs Python + Pillow; only when icons change)
pnpm keystore       # generate an Android signing key (optional — see docs/打包与分发.md §4)
pnpm dist:win       # portable Windows exe (double-click to play, no install; size: see the build output)
pnpm dist:apk       # Android APK (sideload)
```

> Android signing: **you do not need a release key to build an installable APK.** Both the local
> build and CI fall back to a debug signature, which installs fine on your own phone. Run
> `pnpm keystore` only when you want future builds to install straight over the old one
> (keeping saves) and to configure the four GitHub Secrets.

Handy debug links:

- `/?autoplay=1#/play/caochong-elephant` — play the whole game automatically (used for headless verification)
- `/?lang=en` — force English

## Groups: two today, more later

The collection's first-level structure is **groups**, defined in one place — `packages/content/src/groups.ts`:

| Group | Games | Notes |
|---|---|---|
| 典故 `allusion` | **17** (all live) | One story, one game; sorted by year |
| 三十六计 `stratagem` | **36** (Volumes 1–6: 1–6, 7–12, 13–18, 19–24, 25–30, 31–36) | Thirty-Six Stratagems, one game each; sorted by **stratagem number** — all six volumes are live |

The hall and the album render one section per group, and **a group with no content yet does not
disappear**: it shows up as "coming soon".

![Groups: scroll to the bottom for the reserved stratagem slot](docs/screenshots/91-hall-groups.png)

Adding a group takes three steps: add a row to `GROUPS` (`id` / `order` / `orderBy`), add
`group.<id>.title` / `.note` / `.empty` to `packages/i18n/src/messages.ts` (missing one is a
**compile error**), and give every new content entry a `"group": "<id>"` — the schema deliberately
has no default, so a stratagem can never be filed under "stories" by accident.

## Adding a game

This is what every one of the 53 games touched, in order:

1. **A new workspace package** `games/<id>/`: `package.json` + `src/{manifest,index,logic,art}.ts`
   — add `scenes/` and `layout.ts` for bespoke screens. Rules live in `logic.ts` (no Phaser import,
   unit-testable);
2. **Both halves of the content**: `packages/content/src/entries/<id>.json` (summary: title / era /
   source / moral / keywords) and `<id>.game.json` (detail: story beats / key moment / quiz /
   misconceptions / level script). The quiz is **3 questions and must include one `transfer`**, which
   `content:check` enforces. A new template also needs an id in `TemplateId`
   (`packages/game-kit/src/contract.ts`) and a level schema registered in
   `packages/templates/src/schemas.ts`;
3. **Translation patches**: `packages/content/src/i18n/en/<id>.json` and `<id>.game.json` (one per
   half). A missing field, a structural mismatch or Chinese left inside the English file fails the build;
4. **Two registry lines**: `packages/content/src/entries/index.ts` and
   `packages/content/src/i18n/index.ts`;
5. **Shell wiring**: a dependency in `apps/site/package.json` plus one lazy `import` line in
   `apps/site/src/registry.ts`. `apps/site/src/registry.test.ts` guards both — **one line missing from
   the registry (or one line too many) fails a unit test** instead of surfacing as "game not found"
   after a child taps the card;
6. **An end-to-end case** in `e2e/`: a headless `?autoplay=1` playthrough (a new template does not count
   until it implements `runAutoplay()`);
7. **`pnpm verify` green** (typecheck / lint / test / content:check / build / size), then `pnpm e2e`.

The same file-level checklist lives in [docs/三十六计方案.md](docs/三十六计方案.md), section 6.

## Current status

**Seventeen stories plus all thirty-six stratagems (all six volumes)** are playable. `pnpm verify` is green
(typecheck, lint, 1221 unit tests, content check, build, size) and every game has a headless playthrough
in the end-to-end suite (`?autoplay=1` — a new template only counts once it implements `runAutoplay()`).

The shell stays small: no Phaser, and no story or level-script content either. Each game's own
business code is only a few KB; Phaser is a shared chunk and the full content (stories, quizzes,
level scripts) is a separate lazy chunk — both load only when a game starts. See `pnpm size`.

### Due review (new this round)

Every story card in the album now carries a **Review** button. When a story comes due, the card shows a
"Review due" badge and the hall shows a banner — **only when something is actually due** — that takes the
child straight to the first one.

The quiz is 3 questions (one of them a transfer question), and **the score decides when you meet again**:
1 / 3 / 7 / 21 / 60 days. The grade only moves the next review date; **it never touches the stars** —
stars only ever go up, and getting a review question wrong should not cost one. The page is plain DOM, so
three questions no longer pull in Phaser; the reasoning is in [docs/技术方案.md](docs/技术方案.md) §7.17
(Chinese).

### 1. Cao Chong Weighs the Elephant (history · substitution)

No "next" button, no multiple-choice question. The player performs Cao Chong's four steps:

drag the elephant onto the scale (it collapses) → drag it onto the boat (the boat sinks)
→ tap the hull to carve the waterline → carry stones aboard until the mark meets the water
→ weigh the stones: 3300 (six big stones only reach 3000 — you have to mix in a mid-sized one).

| Story beats | The scale collapses | Carving the mark | Swapping for stones | The mark meets the water | Elephant = 3300 |
|---|---|---|---|---|---|
| ![story](docs/screenshots/02-story.png) | ![collapse](docs/screenshots/04-scale-fails.png) | ![mark](docs/screenshots/05-mark.png) | ![stones](docs/screenshots/06-substitute.png) | ![match](docs/screenshots/07-matched.png) | ![weighed](docs/screenshots/08-weighed.png) |

### 2. Pangu Splits Heaven and Earth (myth · creation and transformation)

Five stages, built from three templates plus one bespoke scene:

1. **Crack** — tap the egg four times; chaos bursts open, light specks rise, dark lumps sink
2. **Hold** — tap 40 times: the sky rises, the earth sinks, **Pangu is literally stretched on screen**, up to 18,000 years
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

Eight plants, each with a question mark over it: **until you taste it, you cannot know what it is.**
Drag a plant to Shennong's mouth and a small badge appears on it — edible, medicine, or do not eat —
using the same picture as the wooden board it belongs to. No reading required.

Drop an untasted plant on a board and it is carried back to his mouth first: no mistake, no penalty.
Tasting a poisonous one only makes him frown and see stars for a moment.

| Unknown | One taste | Sorted |
|---|---|---|
| ![unknown](docs/screenshots/54-shennong-unknown.png) | ![taste](docs/screenshots/55-shennong-tasting.png) | ![sorted](docs/screenshots/56-shennong-sorted.png) |

### 9. Yu Tames the Flood (legend · dam or channel)

First he **dams** it himself: one tap, one basket of earth, and the water rises with the dike — until
the fourteenth basket, when the water tops the bank and the dike bursts. Only then does the game hand over the
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

### 13. Marking the Boat for a Lost Sword (fable · frames of reference)

A man crosses the river and his sword falls in. **The sword never leaves the screen and the boat never
stops moving** — the whole idea is carried by that one picture. Carve a mark on the boat's side, the way
the story does: the boat drifts, the mark drifts with it, and diving where the mark is finds only weeds.
Back upstream, the child can mark the tree on the bank, or drop a float on the water — a mark on
something that stays put is the one that works.

| Carved on the boat | Drifted, sword still upstream | Marked on the tree — found |
|---|---|---|
| ![carve](docs/screenshots/74-kezhou-story.png) | ![drift](docs/screenshots/75-kezhou-drifted.png) | ![found](docs/screenshots/76-kezhou-found.png) |

### 14. Three in the Morning, Four at Night (fable · wording and substance)

Seven acorns are strung on a taut rope; only the little divider in the middle moves.
"Three in the morning, four at night" — the monkeys erupt. Slide the divider one place: "four in the
morning, three at night" — and they cheer. The rope always reads **3 + 4 = 7**: the wording changed,
not one acorn did.

| Three and four: uproar | One place over: delight |
|---|---|
| ![angry](docs/screenshots/78-zhaosanmusi-angry.png) | ![happy](docs/screenshots/79-zhaosanmusi-happy.png) |

### 15. The Cunning Rabbit's Three Burrows (history · a way out)

Three mounds in the meadow; a tap digs one spadeful. Open one burrow and the fox arrives — one guarded
entrance and the rabbit cannot get out. A second burrow outwits the fox; but the fox and the hawk come
together and watch two entrances, which is still not enough. **The third burrow is forced by the number
of dangers in the level data**, not by a line of text.

| One burrow, the fox at the door | Three burrows |
|---|---|
| ![one](docs/screenshots/81-jiaotu-one-burrow.png) | ![three](docs/screenshots/82-jiaotu-three-burrows.png) |

### 16. A Hundred Paces Through a Willow Leaf (history · practice)

Five willow leaves hang on the tree, and the child **steps back by themselves**: ten paces, thirty,
fifty, eighty, a hundred. The farther the leaf, the smaller it is drawn — and the smaller the hit
radius. Each hit leaves a hole in a leaf; then step back again. (Same bow gesture as Houyi, but one
shoots suns in the night sky and the other practises on leaves in a sunlit grove — this one is about
practice.)

| Ten paces | A hundred paces |
|---|---|
| ![ten](docs/screenshots/84-yangyouji-ten-paces.png) | ![hundred](docs/screenshots/85-yangyouji-hundred-paces.png) |

### 17. Cook Ding Carves an Ox (fable · follow the seam)

The first cut lands on bone: a clang, and the blade gains a nick — the child finds that out first-hand.
Then the seams light up: grab a piece and **push along the seam** and it slides free with a click. The
last three pieces are given no hint at all. The ending is a whole skeleton — and a knife still like new
after nineteen years.

| The first cut | Opened along the seams |
|---|---|
| ![cut](docs/screenshots/87-paoding-first-cut.png) | ![skeleton](docs/screenshots/88-paoding-skeleton.png) |

## Thirty-Six Stratagems · Volume 1: the six Advantageous Stratagems

The first volume is live: **one game per stratagem, each with its own verb**.
They are not "stories" but "strategy" (`kind: strategy`) and sit in their own group in the hall,
sorted by stratagem number.

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 1 | Crossing the Sea Under Camouflage | Give each obvious object its most ordinary-looking shell, then slip it past a patrolling lamp | `ruse` |
| 2 | Besiege Wei to Rescue Zhao | The front will not budge: tap the two places he *must* save, and his guard pulls back | `siege` |
| 3 | A Borrowed Sword | A boulder on a building site: set a fulcrum, hook up a pole and a water wheel, borrow their strength | `borrow` |
| 4 | Wait Till They Tire | Three drum rolls: hold still for the first two, strike only in the window after the third | `stillness` |
| 5 | Strike While the Fire Burns | The camp swings between calm and chaos; work only gets done in the short window while it is in chaos | `window` |
| 6 | Make a Noise in the East, Attack in the West | Bang the gong to hold the lamp on the left, walk past on the right; being seen only sends you back | `ruse` (divert) |

| Slip past the check | Hit what he must save | Borrowed strength |
|---|---|---|
| ![camouflage](docs/screenshots/92-stratagem-01-mantian.png) | ![siege](docs/screenshots/93-stratagem-02-weiwei.png) | ![lever](docs/screenshots/94-stratagem-03-jiedao.png) |

| The third drum roll | The window | Noise in the east |
|---|---|---|
| ![drums](docs/screenshots/95-stratagem-04-yiyi.png) | ![window](docs/screenshots/96-stratagem-05-chenhuo.png) | ![divert](docs/screenshots/97-stratagem-06-shengdong.png) |

**For children** (the six hard rules live in [docs/三十六计方案.md](docs/三十六计方案.md)): the Chinese
names and the original text stay; conflict is abstracted into puzzles, races and building sites, with no
blood and no death; the defensive stratagems (hide a knife behind a smile, sow discord, play on desire,
the self-harm ruse) teach **spotting** them, not using them. Every stratagem carries a historical source —
and where the wording of that source could not be verified word for word, the stratagem's own text is used
instead of inventing a quotation.

This volume adds **five new gameplay templates** (`ruse` / `siege` / `borrow` / `stillness` /
`window`). The remaining thirty then arrived five volumes at a time, adding fourteen templates in all;
of `wait` / `split` / `trace`, two ended up reused whole (34 and 36). Each volume starts with a design note, e.g.
[三十六计-第一辑方案.md](docs/三十六计-第一辑方案.md).

## Thirty-Six Stratagems · Volume 2: the six Opportunistic Stratagems (7–12)

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 7 | Something Out of Nothing | Paint straw figures onto empty spots on the rail in the fog: they fade, so keep painting until the other side believes | `show` |
| 8 | Secretly March to Chencang | The open road decays unless topped up; the hidden path only moves when tapped — both lines compete for one finger | `twoline` |
| 9 | Watch the Fire from Afar | Step in to make peace and the two sides make up and turn on you — the game is holding still | `wait` (reused) |
| 10 | A Smile Hiding a Knife | Sweet words, but the eyes, the sleeve, the fingers give him away: **this one teaches spotting it, not using it** | `read` |
| 11 | The Plum Stands In for the Peach | Tian Ji's horse race: match your lowest against his best, win the other two | `matchup` |
| 12 | Lead the Sheep Along | The column walks on; an opportunity passes once per round, and only in that short window can it be picked up | `window` (glimpse) |

| Out of nothing | The hidden road | Watching from afar |
|---|---|---|
| ![paint](docs/screenshots/98-stratagem-07-wuzhong.png) | ![two lines](docs/screenshots/99-stratagem-08-andu.png) | ![watch](docs/screenshots/100-stratagem-09-gean.png) |

| Reading the tells | The horse race | Picked up in passing |
|---|---|---|
| ![tells](docs/screenshots/101-stratagem-10-xiaoli.png) | ![race](docs/screenshots/102-stratagem-11-lidai.png) | ![passing](docs/screenshots/103-stratagem-12-shunshou.png) |

Volume 2 adds **four new templates** (`show` / `twoline` / `read` / `matchup`) plus a `glimpse`
mode on `window`; the design note is
[三十六计-第二辑方案.md](docs/三十六计-第二辑方案.md).

## Thirty-Six Stratagems · Volume 3: the six Offensive Stratagems (13–18)

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 13 | Beating the Grass to Startle the Snake | Tap one clump of grass at a time — hit a snake and the clumps nearby are wrecked too (probing has a cost) | `probe` |
| 14 | A Borrowed Name | Raise the old banner and the scattered people come back on their own | `borrow` (banner) |
| 15 | Lure the Tiger from the Mountain | Draw the guard away, then take the thing in the gap — pick the bait that buys enough time | `lure` |
| 16 | Let Him Go to Win Him Over | Hold to close in, release to fall back: keep the distance inside the band — too close and he fights, too far and he is gone | `chase` |
| 17 | Cast a Brick to Attract Jade | Offer one small thing and he answers with something better — the plainest brick brings back the most | `lure` (trade) |
| 18 | Catch the Ringleader | One row of identical figures: find the leader with a harmless reed arrow | `probe` (spot) |

| Startle the snake | A borrowed name | Lure the tiger |
|---|---|---|
| ![grass](docs/screenshots/104-stratagem-13-dacao.png) | ![banner](docs/screenshots/105-stratagem-14-jieshi.png) | ![lure](docs/screenshots/106-stratagem-15-diaohu.png) |

| Keep your distance | A brick for jade | Find the leader |
|---|---|---|
| ![chase](docs/screenshots/107-stratagem-16-yuqin.png) | ![brick](docs/screenshots/108-stratagem-17-paozhuan.png) | ![leader](docs/screenshots/109-stratagem-18-qinzei.png) |

Volume 3 adds **three new templates** (`probe` / `lure` / `chase`) plus a `banner` mode on
`borrow` (the `force` branch is untouched); the design note is
[三十六计-第三辑方案.md](docs/三十六计-第三辑方案.md).

## Thirty-Six Stratagems · Volume 4: the six Confusion Stratagems (19–24)

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 19 | Pull the Firewood from Under the Pot | Do not fight the fire: pull the logs out from underneath, and the base log drops it fast | `siege` (support) |
| 20 | Muddy the Water to Catch Fish | The window is **made by you**: stir the water, and only while it is muddy are the fish slow enough | `window` (stir) |
| 21 | The Golden Cicada Sheds Its Shell | Swap each guard for a look-alike dummy; the inspector looks up every few seconds | `swap` |
| 22 | Shut the Door to Catch the Thief | Shut every gate before he bolts; miss one and he runs — you simply start again | `siege` (close) |
| 23 | Befriend the Far, Attack the Near | A ring of neighbours: settle the near ones, befriend the far ones — wrong order just means re-arranging | `matchup` (order) |
| 24 | Borrow a Road to Attack Guo | Talk your way to a borrowed road, take the passes in order, then march home (Yu's lesson: chipped teeth feel the cold) | `chain` |

| Under the pot | Muddy water | Shed the shell |
|---|---|---|
| ![logs](docs/screenshots/110-stratagem-19-fudi.png) | ![muddy](docs/screenshots/111-stratagem-20-hunshui.png) | ![shell](docs/screenshots/112-stratagem-21-jinchan.png) |

| Shut the gates | Far and near | The borrowed road |
|---|---|---|
| ![gates](docs/screenshots/113-stratagem-22-guanmen.png) | ![map](docs/screenshots/114-stratagem-23-yuanjiao.png) | ![road](docs/screenshots/115-stratagem-24-jiadao.png) |

Volume 4 adds **two new templates** (`swap` / `chain`) and **extends three** (`siege` gains
support / close, `window` gains stir, `matchup` gains order). When extending, the older modes
(`vital` / `fire` / `glimpse` / `pair`) keep their logic and tests untouched; the design note is
[三十六计-第四辑方案.md](docs/三十六计-第四辑方案.md).

## Thirty-Six Stratagems · Volume 5: the six Annexation Stratagems (25–30)

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 25 | Replace the Beams with Rotten Timbers | Swap a row of load-bearing posts for **identical-looking** new ones; each takes a hold-to-work spell, and the inspector **calls the roll** every few seconds | `swap` (beam) |
| 26 | Point at the Mulberry Tree While Cursing the Locust Tree | No naming names: mulberry, locust, bell, drum — knock the one he understands, and the man who should take the hint steps forward himself | `probe` (hint) |
| 27 | Feign Madness, Keep Your Wits | The rival keeps testing you: **any tap during a test gives you away**, so only the gaps between tests let you push on | `stillness` (feign) |
| 28 | Lure Him Up, Then Pull the Ladder | Give the convenience first: build the ladder rung by rung, watch him climb into place, then pull it away (pull early and he simply slides back) | `siege` (ladder) |
| 29 | Blossoms on a Tree | Borrow the tree and the wall to hang flags: every prop holds so many and each flag counts for so much — reach the scale and it works | `show` (borrow) |
| 30 | The Guest Becomes the Host | Every step must be **permitted first**: permission lasts only a moment, then expires and has to be asked for again — no hurrying | `chain` (step) |

| Swap the beams | Take the hint | Feign madness |
|---|---|---|
| ![beams](docs/screenshots/116-stratagem-25-touliang.png) | ![hint](docs/screenshots/117-stratagem-26-zhisang.png) | ![madness](docs/screenshots/118-stratagem-27-jiachi.png) |

| Pull the ladder | Blossoms on a tree | Guest becomes host |
|---|---|---|
| ![ladder](docs/screenshots/119-stratagem-28-shangwu.png) | ![blossoms](docs/screenshots/120-stratagem-29-shushang.png) | ![host](docs/screenshots/121-stratagem-30-fanke.png) |

Volume 5 adds **no new templates**: each stratagem gains one mode on an existing template
(`swap.beam` / `probe.hint` / `stillness.feign` / `siege.ladder` / `show.borrow` / `chain.step`).
The older modes (`swap.shell` / `probe.knock`·`spot` / `stillness.bide` /
`siege.vital`·`support`·`close` / `show.draw` / `chain.pass`) keep their logic and their existing
tests untouched; the design note is [三十六计-第五辑方案.md](docs/三十六计-第五辑方案.md).

## Thirty-Six Stratagems · Volume 6: the six Desperate Stratagems (31–36) — all six volumes done

| # | Stratagem | What the child actually does | Template |
|---|---|---|---|
| 31 | The Beauty Trap | His gaze keeps resting on **the one thing he cares about**: notice it, then hand that over; a wrong gift simply comes back | `lure` (favor) |
| 32 | The Empty Fort | Once the gates are open, **do not move at all**: any tap while he watches spoils that round — sit through two clean rounds and he leaves | `stillness` (calm) |
| 33 | Turn Their Spy Around | Make a noise so he turns away, then hold to slide the letter into view — let him **see it himself** | `twoline` (plant) |
| 34 | Pay a Real Price | Two trays: what you keep / what you give away. **He only believes a gift that really costs you** — and you cannot give everything | *reuse* `split` |
| 35 | Interlocking Stratagems | Light the first ring, then link the rest in order — **break the chain and you start again from the bank** | `chain` (domino) |
| 36 | Retreat Is the Best Course | Trace the road back, one stage at a time: after three stages the men and the baggage are safe | *reuse* `trace` |

| Beauty trap | Empty fort | Turn the spy |
|---|---|---|
| ![beauty](docs/screenshots/122-stratagem-31-meiren.png) | ![fort](docs/screenshots/123-stratagem-32-kongcheng.png) | ![spy](docs/screenshots/124-stratagem-33-fanjian.png) |

| Real price | Interlocking | Retreat |
|---|---|---|
| ![price](docs/screenshots/125-stratagem-34-kurou.png) | ![chain](docs/screenshots/126-stratagem-35-lianhuan.png) | ![retreat](docs/screenshots/127-stratagem-36-zou.png) |

The final volume again adds **no new templates**: four modes on existing templates (`lure.favor` /
`stillness.calm` / `twoline.plant` / `chain.domino`) plus two straight reuses (34 uses `split`,
36 uses `trace`, both untouched). The older modes stayed untouched too — in this volume the existing
test files lost **zero lines**, and the only edited line of logic was one import. The design note is
[三十六计-第六辑方案.md](docs/三十六计-第六辑方案.md).

### All thirty-six, by volume

| Volume | Stratagems | Templates |
|---|---|---|
| Advantageous | 1–6 | `ruse` `siege` `borrow` `stillness` `window` |
| Opportunistic | 7–12 | `show` `twoline` `wait` `read` `matchup` `window` |
| Offensive | 13–18 | `probe` `borrow` `lure` `chase` |
| Confusion | 19–24 | `siege` `window` `swap` `matchup` `chain` |
| Annexation | 25–30 | `swap` `probe` `stillness` `siege` `show` `chain` |
| Desperate | 31–36 | `lure` `stillness` `twoline` `split` `chain` `trace` |

One stratagem, one game, one verb — and the six volume names are the sections you see in the hall.

## Design principle: fewer words, more doing

Across all fifty-three games there is almost no teaching text on screen: the two opening lines of a story,
and one short hint that appears when the level starts or when the child is stuck (tap the story page too early and it only says
"Listen to the story first"). Everything else is shape, motion, sound and speech. Kids **work out** the idea
instead of being told it.

## Two hard rules (2026-10-15)

1. **The story must be heard before the game starts.** The "tap to continue" hand only appears once the
   narration of that beat has finished; on a device with no voice at all (muted, no voice pack, headless
   browser) the game waits out a reading-time estimate instead, so the beat can never be skipped for free.
   Only the debug switches `?autoplay=1` and `?story=instant` bypass it.

   | Listening: speaker + progress bar | Tapped too early: "listen first" |
   |---|---|
   | ![listening](docs/screenshots/89-story-listening.png) | ![keep listening](docs/screenshots/90-story-keep-listening.png) |
2. **Difficulty went up one notch, punishment stays at zero.** More steps (30 → 40 taps, 10 → 14 baskets,
   6 → 8 herbs, 5 → 7 beacon towers…), tighter tolerances, and hints that arrive later — but no mistakes
   can ever end a session.

## Bilingual by design

| Layer | How |
|---|---|
| UI strings | `@chags/i18n` — one flat key→text catalog per language |
| Story content | Chinese lives in `entries/*.json`; translations live in `i18n/en/*.json` as structural mirrors |
| Narration | `AudioBus.speak(text, locale)` — TTS picks a `zh-CN` / `en-US` voice |
| Docs | `README.md` / `README.en.md`, `docs/` and `docs/en/` |

**Games never know a language exists.** The shell hands them already-translated content, so adding a language
means adding one JSON file — zero game code changes. Missing translations are caught at build time by
`pnpm content:check` (missing keys, structural mismatch, array length, over-long text).

## Repository layout

```
apps/site                  Vue 3.5 shell: hall (grouped) / game host / album / due review
apps/desktop               Tauri 2 desktop shell (portable exe)
apps/mobile                Capacitor 8 Android shell (APK)
packages/game-kit          Contracts (GameModule / GameContext / events) + TemplateId. No Phaser.
packages/content           Content (summary <id>.json + detail <id>.game.json) + zod + English patches
packages/i18n              UI message catalogs (zh-CN / en; a missing key is a compile error)
packages/templates         Gameplay template implementations; the contract declares 36 template ids
                           (packages/game-kit/src/contract.ts): 26 used by content plus the shared
                           opening `story`; match / order / drag / board / timing / react / branch /
                           build / grow are reserved ids, not implemented yet; butcher / beacon are
                           bespoke scenes inside game packages, registered in the template layer;
                           chaos has no template id at all and lives in the Pangu package
packages/phaser-kit        Phaser bootstrap, cartoon drawing primitives, drag controller, base scene
packages/platform          Web services: IndexedDB / WebAudio / TTS / lifecycle
packages/progress          Save file, migration, spaced-repetition scheduling (pure functions)
games/<id>                 53 game packages: one story / one stratagem each
e2e                        Playwright smoke, real-input playthroughs, screenshot capture
scripts                    Size guard (check-size.mjs), icon generation (make-icons.py)
```

The single source of truth for the game list is `packages/content/src/entries/` (content) and
`apps/site/src/registry.ts` (the lazy-load registry) — if the two disagree,
`apps/site/src/registry.test.ts` fails on the spot. That is 53 entries: seventeen stories
(Cao Chong → Cook Ding) plus all thirty-six stratagems.

## Three architectural rules

1. **Logic is separate from rendering** — rules live in plain TypeScript with no Phaser import, unit-testable in Node.
2. **Games never touch the environment** — storage, audio and lifecycle go through `GameContext.services`;
   no direct `localStorage`, `fetch` or `wx.*`.
3. **Every game is headlessly drivable** — `?seed=&autoplay=1` lets CI play it without a human.

See [docs/en/architecture.md](docs/en/architecture.md) for the full design.
