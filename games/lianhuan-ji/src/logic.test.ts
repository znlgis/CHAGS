import {
  ContentEntrySchema, EntryDetailSchema, EntrySummarySchema, getEntry, mergeLocalized, validatePatch,
} from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
// 模板的纯判定：共享 index.ts 的登记由 Lead 统一做 —— 这里直接从源文件拿，
// 与既有游戏包相对导入内容 JSON 是同一个做法（登记前后都不会红）。
import {
  DOMINO_TIMING, advanceDomino, applyDomino, dominoStart, igniteChain, igniteHit, isDominoDone,
  linkAt, litCount, nextDominoMove, settleDomino,
} from '../../../packages/templates/src/chain.logic';
import rawSummary from '../../../packages/content/src/entries/lianhuan-ji.json';
import rawDetail from '../../../packages/content/src/entries/lianhuan-ji.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/lianhuan-ji.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/lianhuan-ji.game.json';
import {
  DESIGN_H, DESIGN_W, IGNITE, RING_RADIUS, RINGS, RIVER_TOP, SKY_TOP, WINDOW_MS,
} from './layout';
import { lianhuanLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('lianhuan-ji') ?? ContentEntrySchema.parse(raw);
const level = lianhuanLevel(entry);

/**
 * 模板的点击宽容度（chain.ts 里 CHAIN_DOMINO.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 46;

/**
 * 照模板 runAutoplay 的同一条路走一遍：起头 → 一环一环点亮
 * （连"点在哪一环上"都过一遍命中判定，而不是把 id 直接递进去）。
 */
function runAutoplay(
  from: ReturnType<typeof dominoStart> = dominoStart(),
  startAt = 0,
): { moves: string[]; state: ReturnType<typeof dominoStart>; at: number } {
  let state = from;
  let at = startAt;
  const moves: string[] = [];
  for (let guard = 0; guard < 20 && !isDominoDone(level, state); guard += 1) {
    const move = nextDominoMove(level, state, at);
    if (move === undefined) break;
    if (move.kind === 'ignite') {
      moves.push('ignite');
      state = igniteChain(level, state, at);
    } else {
      const hit = linkAt(level, move.link.x, move.link.y);
      moves.push(hit?.id ?? 'missed');
      state = applyDomino(level, state, hit?.id ?? 'missed', at);
    }
    at += DOMINO_TIMING.autoplayStepMs;
  }
  return { moves, state, at };
}

describe('连环计 · 美术与关卡数据互锁', () => {
  it('四环就在这条铁索上，而且是按点亮的先后排的 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('domino');
    expect(level.links.map((link) => link.id)).toEqual(RINGS.map((ring) => ring.id));
    for (const [index, link] of level.links.entries()) {
      expect(link.x).toBe(RINGS[index]!.x);
      expect(link.y).toBe(RINGS[index]!.y);
      expect(link.radius).toBe(RING_RADIUS);
      // 一环比一环靠北：火是往北走的，顺序就写在江面上
      if (index > 0) expect(link.y).toBeLessThan(level.links[index - 1]!.y);
    }
    expect(level.links.every((link) => link.y > RIVER_TOP)).toBe(true);
  });

  it('起头在南岸的火种上；一环点亮之后下一环的时限就是画面那条沙漏', () => {
    expect(level.ignite).toEqual({ x: IGNITE.x, y: IGNITE.y, radius: IGNITE.radius });
    expect(level.windowMs).toBe(WINDOW_MS);
    // 时限要够孩子看清"现在该点哪一环"（schema 也卡了 900 毫秒的下限 —— 不然就成比手速了）
    expect(level.windowMs).toBeGreaterThanOrEqual(900);
    // 火种在最南边（最靠下），四环都在它北边
    expect(level.ignite.y).toBeGreaterThan(level.links[0]!.y);
  });

  it('五个可以点的地方都在画面里，彼此点得开（手指粗也点不到隔壁）', () => {
    const spots = [
      { id: 'ignite', x: level.ignite.x, y: level.ignite.y, radius: level.ignite.radius },
      ...level.links.map((link) => ({ id: link.id, x: link.x, y: link.y, radius: link.radius })),
    ];
    for (const spot of spots) {
      expect(spot.x - spot.radius).toBeGreaterThanOrEqual(0);
      expect(spot.x + spot.radius).toBeLessThanOrEqual(DESIGN_W);
      expect(spot.y - spot.radius).toBeGreaterThan(SKY_TOP);
      expect(spot.y + spot.radius).toBeLessThan(DESIGN_H);
    }
    for (const a of spots) {
      for (const b of spots) {
        if (a.id === b.id) continue;
        expect(
          Math.hypot(a.x - b.x, a.y - b.y),
          a.id + ' 与 ' + b.id + ' 挨在一起了',
        ).toBeGreaterThan(a.radius + b.radius + 2 * TAP_FORGIVE);
      }
    }
  });
});

describe('连环计 · 判定：一环接一环', () => {
  it('一局真的走得完：起头 → 四环按顺序点亮（与场景同一条路）', () => {
    const { moves, state, at } = runAutoplay();
    expect(moves).toEqual(['ignite', 'ring-1', 'ring-2', 'ring-3', 'ring-4']);
    expect(litCount(state)).toBe(4);
    expect(state.lit).toEqual(['ring-1', 'ring-2', 'ring-3', 'ring-4']);
    expect(isDominoDone(level, state)).toBe(true);
    expect(state.breaks).toBe(0);
    expect(at + DOMINO_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('没起头一环也点不亮；起头之后只认"下一环"：跳着点只是没进展', () => {
    const start = dominoStart();
    for (const link of level.links) {
      expect(advanceDomino(level, start, link.id, 0)).toBe('notStarted');
      expect(applyDomino(level, start, link.id, 0)).toBe(start);
    }
    const started = igniteChain(level, start, 0);
    // 跳着点：不是下一环
    expect(advanceDomino(level, started, 'ring-3', 100)).toBe('wrong');
    expect(applyDomino(level, started, 'ring-3', 100)).toBe(started);
    // 正好是下一环：接上了，时限从这一刻重新起算
    const first = applyDomino(level, started, 'ring-1', 100);
    expect(first.lit).toEqual(['ring-1']);
    expect(advanceDomino(level, first, 'ring-3', 200)).toBe('wrong');
    expect(applyDomino(level, first, 'no-such-ring', 200)).toBe(first);
    expect(litCount(first)).toBe(1);
  });

  it('超时就从 ignite 重来：链子回到"还没起头"，记一笔 break（零惩罚、不结束）', () => {
    let state = igniteChain(level, dominoStart(), 0);
    state = applyDomino(level, state, 'ring-1', 0);
    // 差一毫秒还在：接得上
    expect(advanceDomino(level, state, 'ring-2', level.windowMs - 1)).toBe('ok');
    // 正好到点：断了
    expect(advanceDomino(level, state, 'ring-2', level.windowMs)).toBe('expired');
    const broken = applyDomino(level, state, 'ring-2', level.windowMs);
    expect(broken.breaks).toBe(1);
    expect(broken.ignited).toBe(false);
    expect(broken.lit).toEqual([]);
    expect(isDominoDone(level, broken)).toBe(false);
    // 断了之后点哪一环都没反应：得先回到岸边重新起头
    expect(advanceDomino(level, broken, 'ring-1', level.windowMs + 50)).toBe('notStarted');
    // 重新起头（零惩罚）：又是第一环，接着走，照样走得完
    const restarted = igniteChain(level, broken, level.windowMs + 100);
    expect(restarted.lit).toEqual([]);
    expect(restarted.ignites).toBe(2);
    expect(restarted.breaks).toBe(1);
    const { state: done, moves } = runAutoplay(restarted, level.windowMs + 100);
    expect(moves).toEqual(['ring-1', 'ring-2', 'ring-3', 'ring-4']);
    expect(isDominoDone(level, done)).toBe(true);
    // 断过的那一笔留着（复盘用），但没扣星、没结束、也没锁住什么
    expect(done.breaks).toBe(1);
  });

  it('tick 里每帧调 settleDomino：没断原样返回，断了只记一笔', () => {
    const running = applyDomino(level, igniteChain(level, dominoStart(), 0), 'ring-1', 0);
    expect(settleDomino(level, running, level.windowMs - 1)).toBe(running);
    const broken = settleDomino(level, running, level.windowMs);
    expect(broken.breaks).toBe(1);
    expect(settleDomino(level, broken, level.windowMs + 16)).toBe(broken);
  });

  it('autoplay 每一步都远在 windowMs 之前 —— 无头验证自己不会把链子走断', () => {
    expect(DOMINO_TIMING.autoplayStepMs).toBeLessThan(level.windowMs);
    const { state } = runAutoplay();
    expect(state.breaks).toBe(0);
    expect(isDominoDone(level, state)).toBe(true);
  });

  it('手指粗也点得到，点空处什么也不算', () => {
    for (const link of level.links) {
      expect(linkAt(level, link.x, link.y, 0)?.id).toBe(link.id);
      expect(linkAt(level, link.x, link.y + link.radius + TAP_FORGIVE, TAP_FORGIVE)?.id).toBe(link.id);
      expect(linkAt(level, link.x, link.y + link.radius + TAP_FORGIVE + 1, 0)).toBeUndefined();
    }
    expect(igniteHit(level, level.ignite.x, level.ignite.y, 0)).toBe(true);
    expect(igniteHit(level, level.ignite.x, level.ignite.y - level.ignite.radius - 1, 0)).toBe(false);
    // 站在岸边的火种上，不会顺手点到哪一环
    expect(linkAt(level, level.ignite.x, level.ignite.y, TAP_FORGIVE)).toBeUndefined();
    expect(linkAt(level, 375, 700, 0)).toBeUndefined();
  });
});

describe('连环计 · 故事与复习', () => {
  it('两幕：铁索连船 → 一环接一环地安排；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.narration).toContain('铁索');
    expect(entry.story[1]!.text).toContain('一桩都不落空');
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择站在周瑜的角度问：正解是办完一桩立刻接上下一桩', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text.startsWith('先办第一桩，办完立刻接上第二桩')).toBe(true);
    expect(entry.keyMoment.question).toContain('周瑜');
    expect(entry.keyMoment.reveal).toContain('一件事接一件事');
    // 另外两个选项不是"点了就错"，都要说清楚后果
    for (const option of options) {
      if (option.isCanonical) continue;
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('三十六计的登记信息：第 35 计 · 败战计（第 6 套）；史源是本计按语，并注明演义', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 35, set: 6 });
    expect(entry.dynasty).toBe('东汉');
    expect(entry.yearApprox).toBe(208);
    expect(entry.figures).toContain('曹操');
    expect(entry.figures).toContain('周瑜');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·败战计》');
    expect(entry.source.chapter).toContain('三国演义');
    expect(entry.source.chapter).toContain('演义');
    expect(entry.source.quote).toBe('将多兵众，不可以敌，使其自累，以杀其势。在师中吉，承天宠也。');
    expect(entry.moral).toContain('一件事接一件事');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('chain');
    expect(entry.game.stages[0]!.template).toBe('chain');
    expect(templateSchemas.chain!.safeParse(entry.game.stages[0]!.levelScript).success).toBe(true);
  });

  it('复习题：记忆题问铁索连船与连环计的要紧处，迁移题落在"一环接一环"', () => {
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(
      1,
    );
    for (const question of entry.quiz) expect(question.answer).toBeLessThan(question.options.length);
    const transfer = entry.quiz.find((question) => question.kind === 'transfer')!;
    expect(transfer.question).toContain('联欢会');
    expect(transfer.explanation).toContain('一环接一环');
  });

  it('儿童化：没有交战、没有一处流血 —— 只有江面、船、铁索与信号火把', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战', '夺']) expect(prose).not.toContain(word);
    // 落点是"一件事接一件事地安排"，不是"打一场"
    expect(prose).toContain('一件事接一件事');
    const scriptText = level.hint + level.breakLine;
    for (const word of ['血', '死', '杀', '伤']) expect(scriptText).not.toContain(word);
  });
});

describe('连环计 · 英译补丁', () => {
  it('摘要 / 详情两半各自合法，英译补丁也分别对得上（与 content:check 同一套口径）', () => {
    const summary = EntrySummarySchema.parse(rawSummary);
    const detail = EntryDetailSchema.parse(rawDetail);
    expect(validatePatch(summary, enPatchSummary)).toEqual([]);
    expect(validatePatch(detail, enPatchDetail)).toEqual([]);
    const mergedSummary = EntrySummarySchema.parse(mergeLocalized(summary, enPatchSummary));
    const mergedDetail = EntryDetailSchema.parse(mergeLocalized(detail, enPatchDetail));
    const stage = mergedDetail.game.stages[0]!;
    expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    expect(findCjk({ ...mergedSummary, ...mergedDetail })).toEqual([]);
  });

  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法（连断了那句话也翻了）', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Interlocking Stratagems');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
    expect(merged.keyMoment.options.filter((option) => option.isCanonical)).toHaveLength(1);
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    expect(merged.game.stages[0]!.levelScript).toMatchObject({
      hint: 'Light up, then link on',
      breakLine: 'A link broke — light it from the shore again',
    });
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Desperate Stratagems');
    expect(merged.moral).toBe(
      'Arrange one thing after another with no gap — that is what holds it all together.',
    );
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
