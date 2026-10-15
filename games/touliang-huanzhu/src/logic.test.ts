import { ContentEntrySchema, getEntry, mergeLocalized, validatePatch } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/touliang-huanzhu.json';
import rawDetail from '../../../packages/content/src/entries/touliang-huanzhu.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/touliang-huanzhu.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/touliang-huanzhu.game.json';
// 模板的纯判定：共享 index.ts 的登记由 Lead 统一做 —— 这里直接从源文件拿，
// 与既有游戏包相对导入内容 JSON 是同一个做法（登记前后都不会红）。
import {
  BEAM_TIMING, beamPostAt, beamStart, check, isBeamDone, isPostRebuilt, nextPostToWork, startWork,
  tickWork, workingPostId,
} from '../../../packages/templates/src/swap.logic';
import {
  CHECK_MS, CHECKER, DESIGN_H, DESIGN_W, PILE_BOTTOM, PILE_TOP, PODIUM_BOTTOM, PODIUM_TOP, POST_KINDS,
  POST_RADIUS, POST_XS, POST_Y, SKY_TOP, SPARE_KINDS, SPARE_RADIUS, SPARE_XS, SPARE_Y, WORK_MS,
} from './layout';
import { touliangLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('touliang-huanzhu') ?? ContentEntrySchema.parse(raw);
const level = touliangLevel(entry);

/**
 * 模板的点击宽容度（swap.ts 里 SWAP_BEAM.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 48;

/** 一帧多长：与场景里 Phaser 的 delta 同一个数量级 */
const FRAME_MS = 16;

describe('偷梁换柱 · 美术与关卡数据互锁', () => {
  it('四根柱子站在台基上那一条线上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('beam');
    expect(level.posts.map((post) => post.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    for (const [index, post] of level.posts.entries()) {
      expect(post.x).toBe(POST_XS[index]!);
      expect(post.y).toBe(POST_Y);
      expect(post.radius).toBe(POST_RADIUS);
      expect(post.kind).toBe(POST_KINDS[index]!);
    }
    // 料堆里的四根新柱：位置与花纹跟四根柱子一一对应（外形一模一样）
    for (const [index, spare] of level.spares.entries()) {
      expect(spare.x).toBe(SPARE_XS[index]!);
      expect(spare.y).toBe(SPARE_Y);
      expect(spare.radius).toBe(SPARE_RADIUS);
      expect(spare.kind).toBe(SPARE_KINDS[index]!);
    }
    expect(level.workMs).toBe(WORK_MS);
    expect(level.checkMs).toBe(CHECK_MS);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('柱子与料堆都在画面里、都在自己该在的地方，手指点得着', () => {
    for (const post of level.posts) {
      expect(post.x - post.radius).toBeGreaterThanOrEqual(0);
      expect(post.x + post.radius).toBeLessThanOrEqual(DESIGN_W);
      // 柱子站在台基上：整个命中圈都在台基那一片里
      expect(post.y - post.radius).toBeGreaterThan(PODIUM_TOP);
      expect(post.y + post.radius).toBeLessThan(PODIUM_BOTTOM);
      // 点在圆柱心上，拿到的就是这一根
      expect(beamPostAt(level, post.x, post.y, TAP_FORGIVE)?.id).toBe(post.id);
    }
    for (const spare of level.spares) {
      expect(spare.x - spare.radius).toBeGreaterThanOrEqual(0);
      expect(spare.x + spare.radius).toBeLessThanOrEqual(DESIGN_W);
      // 新柱躺在席子上：多半截在席子里（圆圈比席子略大一点，看得清）
      expect(spare.y - spare.radius).toBeGreaterThan(PILE_TOP - 30);
      expect(spare.y + spare.radius).toBeLessThan(PILE_BOTTOM + 30);
    }
    // 监工站在台基下面的台阶上（不在柱子的命中圈里，点他不会误动哪一根）
    expect(CHECKER.y).toBeGreaterThan(PODIUM_BOTTOM - 4);
    expect(beamPostAt(level, CHECKER.x, CHECKER.y, TAP_FORGIVE)).toBeUndefined();
    expect(SKY_TOP).toBeLessThan(POST_Y);
    expect(DESIGN_H).toBeGreaterThan(PILE_BOTTOM);
  });

  it('每根柱子都找得到同 kind 的新柱 —— 一根都不许配错（外形要一模一样）', () => {
    for (const post of level.posts) {
      expect(level.spares.some((spare) => spare.kind === post.kind)).toBe(true);
    }
    // 少一根火纹的新柱：schema 当场拒掉
    const wrong = {
      ...level,
      spares: level.spares.map((spare) => (spare.kind === 'flame' ? { ...spare, kind: 'wave' } : spare)),
    };
    expect(templateSchemas.swap!.safeParse(wrong).success).toBe(false);
  });

  it('换一根 1400 毫秒、每隔 4200 毫秒清点一次 —— 换一根一定短于两次清点之间', () => {
    expect(level.workMs).toBeLessThan(level.checkMs);
    // 四根各干满一次的总时长，加上收尾，也远在 e2e 的等待之内
    expect(level.posts.length * level.workMs + BEAM_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });
});

describe('偷梁换柱 · 判定（按住才换得完，清点只是白干一根）', () => {
  /** 照场景的同一条路：一帧一帧按住不放，按住就往前推 */
  function holdUntilDone(postId: string, from = beamStart(level), fromMs = 0) {
    let state = startWork(from, postId, fromMs);
    let at = fromMs;
    for (let i = 0; i < 200 && !isPostRebuilt(state, postId); i += 1) {
      state = tickWork(level, state, at, FRAME_MS, true);
      at += FRAME_MS;
    }
    return { state, at };
  }

  it('一局真的走得完：一根一根按住换好（与场景同一条路）', () => {
    let state = beamStart(level);
    let at = 0;
    let nextPollAt = 0;
    const steps: string[] = [];
    while (!isBeamDone(level, state) && at < 20_000) {
      state = tickWork(level, state, at, FRAME_MS, workingPostId(state) !== null);
      state = check(level, state, at);
      if (at >= nextPollAt) {
        nextPollAt = at + BEAM_TIMING.autoplayStepMs;
        const post = nextPostToWork(level, state);
        if (post !== undefined && workingPostId(state) !== post.id) {
          state = startWork(state, post.id, at);
          steps.push(post.id);
        }
      }
      at += FRAME_MS;
    }
    expect(steps).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(isBeamDone(level, state)).toBe(true);
    expect(state.rebuilt).toEqual(['p1', 'p2', 'p3', 'p4']);
    // 四根 1400ms 连起来才 5600ms，中间最多撞上一次清点（撞上了也只是那一根白干）
    expect(state.seen).toBeLessThanOrEqual(1);
    expect(state.rebuilt).toHaveLength(4);
    expect(at + BEAM_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('清点抓个正着：正拆着的那根进度清零、记一笔，但不结束（零惩罚）', () => {
    const half = tickWork(level, startWork(beamStart(level), 'p1', 0), 0, 700, true);
    expect(half.working?.ms).toBe(700);
    const caught = check(level, half, level.checkMs);
    expect(caught.seen).toBe(1);
    expect(caught.lastSeenPost).toBe('p1');
    expect(caught.working?.ms).toBe(0);
    expect(isPostRebuilt(caught, 'p1')).toBe(false);
    expect(isBeamDone(level, caught)).toBe(false);
    // 手还按着：从头再按一遍照样换得完
    const done = holdUntilDone('p1', caught, level.checkMs);
    expect(isPostRebuilt(done.state, 'p1')).toBe(true);
  });

  it('已经换好的不受影响：清点只打断手上那一根', () => {
    const first = holdUntilDone('p1');
    const half = tickWork(level, startWork(first.state, 'p2', first.at), first.at, 600, true);
    const caught = check(level, half, level.checkMs);
    expect(isPostRebuilt(caught, 'p1')).toBe(true);
    expect(caught.covers['p1']).toBe('s1');
    expect(caught.lastSeenPost).toBe('p2');
    expect(caught.working?.ms).toBe(0);
    expect(caught.rebuilt).toEqual(['p1']);
  });

  it('按住不足 workMs 不算换好；松手只是停下来（进度留着）', () => {
    const pressed = startWork(beamStart(level), 'p4', 0);
    const almost = tickWork(level, pressed, 0, level.workMs - 1, true);
    expect(isPostRebuilt(almost, 'p4')).toBe(false);
    expect(tickWork(level, almost, 0, 320, false)).toBe(almost); // 松手：原样返回
    const done = tickWork(level, almost, level.workMs, 1, true);
    expect(isPostRebuilt(done, 'p4')).toBe(true);
  });

  it('点空处 / 点已经换好的柱子：什么都不算（零惩罚）', () => {
    expect(beamPostAt(level, 375, 200, TAP_FORGIVE)).toBeUndefined();
    const done = holdUntilDone('p1').state;
    // 换好的那一根再按：判定上是"原样返回"，场景据此只提示一句
    expect(startWork(done, 'p1', 5000)).toBe(done);
    expect(isPostRebuilt(done, 'p1')).toBe(true);
  });
});

describe('偷梁换柱 · 故事与复习', () => {
  it('两幕：那头鹿 → 换掉关键的那一根；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.text).toContain('鹿');
    expect(entry.story[1]!.text).toContain('换');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['趁没人清点的时候，一根一根按住换好']);
  });

  it('三十六计的登记信息：第 25 计 · 并战计（第 5 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 25, set: 5 });
    expect(entry.dynasty).toBe('秦');
    expect(entry.yearApprox).toBe(-207);
    expect(entry.figures).toEqual(['赵高', '秦二世']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('偷梁换柱');
    expect(entry.source.quote).toContain('频更其阵');
    expect(entry.moral).toContain('关键的那一根');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('swap');
    expect(entry.game.stages[0]!.template).toBe('swap');
    expect(templateSchemas.swap!.safeParse(entry.game.stages[0]!.levelScript).success).toBe(true);
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(1);
    for (const question of entry.quiz) expect(question.answer).toBeLessThan(question.options.length);
    expect(entry.quiz[1]!.question).toContain('纸桥');
  });

  it('儿童化：换的是柱子，没有人受伤，也没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '砍', '打']) expect(prose).not.toContain(word);
    // 落点在"换掉关键的那一根"，不是"把人怎么样"
    expect(entry.keyMoment.reveal).toContain('关键的那一根');
  });
});

describe('偷梁换柱 · 英译补丁', () => {
  it('摘要 / 详情两半各自合法，英译补丁也分别对得上（与 content:check 同一套口径）', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Replace the Beams with Rotten Timbers');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
    expect(merged.keyMoment.options.filter((option) => option.isCanonical)).toHaveLength(1);
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    // 关卡里的那句提示也翻了（英文 ≤ 24 字符）
    expect(merged.game.stages[0]!.levelScript).toMatchObject({ hint: 'Hold on, beat the count' });
    const hint = (merged.game.stages[0]!.levelScript as { hint: string }).hint;
    expect(hint.length).toBeLessThanOrEqual(24);
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
