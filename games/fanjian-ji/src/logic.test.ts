import { ContentEntrySchema, getEntry, mergeLocalized, validatePatch } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/fanjian-ji.json';
import rawDetail from '../../../packages/content/src/entries/fanjian-ji.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/fanjian-ji.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/fanjian-ji.game.json';
// 模板的纯判定：共享 index.ts 的登记由 Lead 统一做 —— 这里直接从源文件拿，
// 与既有游戏包相对导入内容 JSON 是同一个做法（登记前后都不会红）。
import {
  PLANT_TIMING, hitRedirect, hitSpot, isLookingAway, isPlantDone, lookAwayLeftMs, plantProgress,
  plantRatio, plantStart, plantStep, redirectLook, visitorAt,
} from '../../../packages/templates/src/twoline.logic';
import {
  BELL, DESK, DESIGN_H, DESIGN_W, FLOOR_Y, SPOT, TENT, VISITOR_FROM, VISITOR_RADIUS, VISITOR_TO,
  WALK_MS,
} from './layout';
import { fanjianLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('fanjian-ji') ?? ContentEntrySchema.parse(raw);
const level = fanjianLevel(entry);

/**
 * 模板的点击宽容度（twoline.ts 里 TWOLINE_PLANT.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 64;

/** 一帧多长：与场景里 Phaser 的 delta 同一个数量级 */
const FRAME_MS = 16;

describe('反间计 · 美术与关卡数据互锁', () => {
  it('案上那块地方、帐角的铜铃、他踱步的两头 —— 画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('plant');
    expect(level.spot).toMatchObject({ x: SPOT.x, y: SPOT.y, radius: SPOT.radius, plantMs: SPOT.plantMs });
    expect(level.redirect).toMatchObject({
      x: BELL.x,
      y: BELL.y,
      radius: BELL.radius,
      lookAwayMs: BELL.lookAwayMs,
    });
    expect(level.visitor.from).toEqual(VISITOR_FROM);
    expect(level.visitor.to).toEqual(VISITOR_TO);
    expect(level.visitor.radius).toBe(VISITOR_RADIUS);
    expect(level.visitor.walkMs).toBe(WALK_MS);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('两处都在画面里：案上的地方整块落在案面上，铜铃挂在帐角', () => {
    // 案上那块地方：整个命中圈都在案面里（画出来才不会跑到案外）
    expect(level.spot.x - level.spot.radius).toBeGreaterThanOrEqual(DESK.x);
    expect(level.spot.x + level.spot.radius).toBeLessThanOrEqual(DESK.x + DESK.w);
    expect(level.spot.y - level.spot.radius).toBeGreaterThanOrEqual(DESK.y);
    expect(level.spot.y + level.spot.radius).toBeLessThanOrEqual(DESK.y + DESK.h);
    // 铜铃在帐里、在标题条下面
    expect(level.redirect.x - level.redirect.radius).toBeGreaterThan(TENT.left);
    expect(level.redirect.x + level.redirect.radius).toBeLessThan(TENT.right);
    expect(level.redirect.y + level.redirect.radius).toBeLessThan(TENT.bottom);
    // 他踱步的那条线在地席上、在案子下面
    expect(FLOOR_Y).toBeGreaterThan(DESK.y + DESK.h);
    expect(FLOOR_Y).toBeLessThan(TENT.bottom);
    expect(VISITOR_FROM.y).toBe(VISITOR_TO.y);
    expect(Math.max(VISITOR_FROM.x, VISITOR_TO.x)).toBeLessThan(TENT.right);
    expect(Math.min(VISITOR_FROM.x, VISITOR_TO.x)).toBeGreaterThan(TENT.left);
    expect(DESIGN_H).toBeGreaterThan(TENT.bottom);
  });

  it('手指点哪儿：案上要按住、帐角弄动静，两个地方隔着老远不会串', () => {
    expect(hitSpot(level, level.spot.x, level.spot.y, TAP_FORGIVE)).toBe(true);
    expect(hitRedirect(level, level.spot.x, level.spot.y, TAP_FORGIVE)).toBe(false);
    expect(hitRedirect(level, level.redirect.x, level.redirect.y, TAP_FORGIVE)).toBe(true);
    expect(hitSpot(level, level.redirect.x, level.redirect.y, TAP_FORGIVE)).toBe(false);
    // 点在两处中间：哪一处都不是 —— 只是没收获（零惩罚）
    const middle = { x: (SPOT.x + BELL.x) / 2, y: (SPOT.y + BELL.y) / 2 };
    expect(hitSpot(level, middle.x, middle.y, TAP_FORGIVE)).toBe(false);
    expect(hitRedirect(level, middle.x, middle.y, TAP_FORGIVE)).toBe(false);
    // 两处的命中圈（含宽容度）不重叠
    const apart = Math.hypot(SPOT.x - BELL.x, SPOT.y - BELL.y);
    expect(apart).toBeGreaterThan(SPOT.radius + BELL.radius + 2 * TAP_FORGIVE);
    expect(DESIGN_W).toBeGreaterThan(SPOT.x + SPOT.radius);
  });

  it('一个空档（2600）里摆得完（1600）；他一个来回（5200）正好容得下两次空档', () => {
    expect(level.spot.plantMs).toBeLessThan(level.redirect.lookAwayMs);
    expect(level.redirect.lookAwayMs).toBeGreaterThanOrEqual(900);
    expect(PLANT_TIMING.autoplayStepMs).toBeLessThan(level.spot.plantMs);
    // 他来回一趟的时间里，至少够试两次（试坏了也有下一次，零惩罚）
    expect(2 * level.redirect.lookAwayMs).toBeGreaterThanOrEqual(level.visitor.walkMs);
  });
});

describe('反间计 · 判定（趁空档按住才推进，他回头就清零）', () => {
  /** 照场景的同一条路：每 autoplayStepMs 看一次"该弄动静还是该按住"，每一帧把墙钟喂给 plantStep */
  function playAutoplay(limitMs = 30_000) {
    let state = plantStart();
    let holding = false;
    let nextStepAt = 0;
    let at = 0;
    let exposed = 0;
    const walked: { x: number; y: number }[] = [];
    for (; at <= limitMs && !isPlantDone(level, state); at += FRAME_MS) {
      if (at >= nextStepAt) {
        nextStepAt = at + PLANT_TIMING.autoplayStepMs;
        if (isLookingAway(state, at)) {
          holding = true; // 空档开着：按到案上不放
        } else {
          holding = false; // 抬手
          state = redirectLook(level, state, at); // 弄出点动静
        }
      }
      const tick = plantStep(level, state, at, FRAME_MS, holding);
      state = tick.state;
      if (tick.result === 'exposed') exposed += 1;
      walked.push(visitorAt(level, at));
    }
    return { state, at, exposed, walked };
  }

  it('一局真的走得完：照场景同一条路，一次也不会被撞见', () => {
    const { state, at, exposed } = playAutoplay();
    expect(isPlantDone(level, state)).toBe(true);
    expect(exposed).toBe(0);
    expect(state.caught).toBe(0);
    expect(state.progressMs).toBe(level.spot.plantMs);
    expect(at).toBeLessThan(10_000);
    expect(at + PLANT_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('被模拟的人真的在动：这一局里他确实从一头走到了另一头', () => {
    const { walked } = playAutoplay();
    const xs = walked.map((p) => p.x);
    // 我们的判定不看他在哪儿，但画面把他画在那儿 —— 用例也得让他真的动起来
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
      Math.abs(VISITOR_FROM.x - VISITOR_TO.x) * 0.5,
    );
    for (const p of walked) expect(p.y).toBe(VISITOR_FROM.y);
  });

  it('他正看着的时候按住：什么都不发生（零惩罚）', () => {
    let state = plantStart();
    for (let at = 0; at < 3000; at += FRAME_MS) {
      const tick = plantStep(level, state, at, FRAME_MS, true);
      state = tick.state;
      expect(tick.result).toBe('idle');
    }
    expect(plantProgress(state)).toBe(0);
    expect(state.caught).toBe(0);
    expect(isPlantDone(level, state)).toBe(false);
  });

  it('★ 摆到一半他回过头：进度清零、记一笔 caught，但这一局不结束（零惩罚）', () => {
    // 空档从 0 开到 2600；从 1200 才开始按住 —— 他到点回头时只摆了 1400 毫秒
    let state = redirectLook(level, plantStart(), 0);
    let at = 1200;
    for (; at < level.redirect.lookAwayMs; at += FRAME_MS) {
      state = plantStep(level, state, at, FRAME_MS, true).state;
    }
    expect(plantProgress(state)).toBeGreaterThan(0);
    expect(plantProgress(state)).toBeLessThan(level.spot.plantMs);
    expect(plantRatio(level, state)).toBeGreaterThan(0.5);

    const caught = plantStep(level, state, level.redirect.lookAwayMs, FRAME_MS, true);
    expect(caught.result).toBe('exposed');
    expect(plantProgress(caught.state)).toBe(0);
    expect(caught.state.caught).toBe(1);
    expect(caught.state.lastCaughtAtMs).toBe(level.redirect.lookAwayMs);
    // 不结束、不扣星：这一局还在，重新弄出动静就是
    expect(isPlantDone(level, caught.state)).toBe(false);
    expect(lookAwayLeftMs(caught.state, level.redirect.lookAwayMs)).toBe(0);
  });

  it('被撞见之后重新弄出动静、重新按住，照样摆得完（零惩罚的重来）', () => {
    let state = redirectLook(level, plantStart(), 0);
    for (let at = 1200; at < level.redirect.lookAwayMs; at += FRAME_MS) {
      state = plantStep(level, state, at, FRAME_MS, true).state;
    }
    state = plantStep(level, state, level.redirect.lookAwayMs, FRAME_MS, true).state;
    expect(state.caught).toBe(1);
    state = plantStep(level, state, 2700, FRAME_MS, false).state; // 抬手
    state = redirectLook(level, state, 2700); // 再弄一次动静
    expect(state.redirects).toBe(2);
    for (let at = 2700; at < 2700 + level.redirect.lookAwayMs && !isPlantDone(level, state); at += FRAME_MS) {
      state = plantStep(level, state, at, FRAME_MS, true).state;
    }
    expect(isPlantDone(level, state)).toBe(true);
    expect(state.caught).toBe(1); // 被撞见过一次，但这一局照样走完了
  });

  it('点空处：只是没收获 —— 不扣星、不结束（场景那边只记一笔 misses）', () => {
    const state = plantStart();
    expect(hitSpot(level, 375, 200, TAP_FORGIVE)).toBe(false);
    expect(hitRedirect(level, 375, 200, TAP_FORGIVE)).toBe(false);
    expect(isPlantDone(level, state)).toBe(false);
    expect(state.caught).toBe(0);
  });
});

describe('反间计 · 故事与复习', () => {
  it('两幕：最好的酒菜又撤下去 → 他自己看到的那一眼；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.text).toContain('撤');
    expect(entry.story[1]!.narration).toContain('陈平');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text)).toEqual([
      '趁他转头看别处的时候，把该让他看见的摆上去',
    ]);
    expect(entry.keyMoment.reveal).toContain('他自己看到');
  });

  it('三十六计的登记信息：第 33 计 · 败战计（第 6 套）；史源用本计原文', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 33, set: 6 });
    expect(entry.dynasty).toBe('秦末');
    expect(entry.yearApprox).toBe(-204);
    expect(entry.figures).toEqual(['陈平', '项羽', '范增']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·败战计》');
    expect(entry.source.chapter).toBe('反间计');
    expect(entry.source.quote).toContain('疑中之疑');
    expect(entry.moral).toContain('自己看到');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('twoline');
    expect(entry.game.stages[0]!.template).toBe('twoline');
    expect(templateSchemas.twoline!.safeParse(entry.game.stages[0]!.levelScript).success).toBe(true);
    // 这一计的名字与英文标题是全站共享词汇，别自创
    expect(entry.title).toBe('反间计');
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(1);
    for (const question of entry.quiz) expect(question.answer).toBeLessThan(question.options.length);
    expect(entry.quiz[1]!.question).toContain('器材');
  });

  it('儿童化：没有一处流血、伤人；落点是"他自己看到"', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '砍', '打']) expect(prose).not.toContain(word);
    expect(entry.keyMoment.reveal).toContain('他自己看到');
  });
});

describe('反间计 · 英译补丁', () => {
  it('摘要 / 详情两半各自合法，英译补丁也分别对得上（与 content:check 同一套口径）', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Turn Their Spy Around');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Desperate Stratagems');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
    expect(merged.keyMoment.options.filter((option) => option.isCanonical)).toHaveLength(1);
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    // 关卡里的两句提示也翻了（英文 hint ≤ 24、两句台词 ≤ 48）
    expect(merged.game.stages[0]!.levelScript).toMatchObject({
      hint: 'Draw him off, then hold',
      plantedLine: 'He saw it on the desk — and said it himself.',
    });
    const script = merged.game.stages[0]!.levelScript as {
      hint: string;
      caughtLine: string;
      plantedLine: string;
    };
    expect(script.hint.length).toBeLessThanOrEqual(24);
    expect(script.caughtLine.length).toBeLessThanOrEqual(48);
    expect(script.plantedLine.length).toBeLessThanOrEqual(48);
    expect(findCjk(merged)).toEqual([]);
  });
});

/** 中日韩字符：英文版里出现它，就说明这个字段漏翻了（与 content:check 同一套判据） */
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function findCjk(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return CJK.test(value) ? [path] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findCjk(item, path + '[' + index + ']'));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      findCjk(item, path === '' ? key : path + '.' + key),
    );
  }
  return [];
}
