import {
  ContentEntrySchema, EntryDetailSchema, EntrySummarySchema, getEntry, mergeLocalized, validatePatch,
} from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
// 模板的纯判定：共享 index.ts 的登记由 Lead 统一做 —— 这里直接从源文件拿，
// 与既有游戏包相对导入内容 JSON 是同一个做法（登记前后都不会红）。
import {
  assignFlag, bestScale, borrowProgress, borrowStart, canHangAt, flagCountAt, flagsLeft, isBorrowDone,
  nextPropToFree, nextPropToHang, nextPropToTouch, propAt, scaleAt, unassignFlag,
} from '../../../packages/templates/src/show.logic';
import rawSummary from '../../../packages/content/src/entries/shushang-kaihua.json';
import rawDetail from '../../../packages/content/src/entries/shushang-kaihua.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/shushang-kaihua.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/shushang-kaihua.game.json';
import {
  BRIDGE, DESIGN_H, DESIGN_W, FAR_BANK_BOTTOM, PROPS, PROP_RADIUS, RIVER_TOP, SKY_TOP,
} from './layout';
import { shushangLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('shushang-kaihua') ?? ContentEntrySchema.parse(raw);
const level = shushangLevel(entry);

/**
 * 模板的点击宽容度（show.ts 里 SHOW.borrowForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 44;

describe('树上开花 · 美术与关卡数据互锁', () => {
  it('三个支点画在哪儿，关卡数据就得在哪儿 —— 而且都在对岸（对面看得见的地方）', () => {
    expect(level.mode).toBe('borrow');
    expect(level.props.map((prop) => prop.id)).toEqual(PROPS.map((prop) => prop.id));
    for (const [index, prop] of level.props.entries()) {
      expect(prop.x).toBe(PROPS[index]!.x);
      expect(prop.y).toBe(PROPS[index]!.y);
      expect(prop.radius).toBe(PROP_RADIUS);
      // 支点都在北岸：旗是挂给河对面看的
      expect(prop.y).toBeLessThan(RIVER_TOP);
      expect(prop.y - prop.radius).toBeGreaterThan(SKY_TOP);
    }
    // 北桥头就是桥的北端：画面上那两根柱子
    const bridge = PROPS.find((prop) => prop.id === 'bridge')!;
    expect(bridge.x).toBe(BRIDGE.x);
    expect(bridge.y).toBe(BRIDGE.top);
    expect(FAR_BANK_BOTTOM).toBe(BRIDGE.top);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('三个支点都在画面里，彼此点得开（手指粗也点不到隔壁）', () => {
    for (const prop of level.props) {
      expect(prop.x - prop.radius).toBeGreaterThanOrEqual(0);
      expect(prop.x + prop.radius).toBeLessThanOrEqual(DESIGN_W);
      expect(prop.y + prop.radius).toBeLessThan(DESIGN_H);
    }
    for (const a of level.props) {
      for (const b of level.props) {
        if (a.id === b.id) continue;
        expect(
          Math.hypot(a.x - b.x, a.y - b.y),
          a.id + ' 与 ' + b.id + ' 挨在一起了',
        ).toBeGreaterThan(a.radius + b.radius + 2 * TAP_FORGIVE);
      }
    }
  });

  it('关卡数据是"有解"的：桥头每面顶 40、只挂得下两面，一共六面旗、要 100 规模', () => {
    expect(level.props.map((prop) => prop.capacity)).toEqual([3, 3, 2]);
    expect(level.props.map((prop) => prop.weight)).toEqual([30, 24, 40]);
    expect(level.flags).toBe(6);
    expect(level.needed).toBe(100);
    // 挂得下（Σ容量 ≥ 旗数）而且够得着（最好的挂法 ≥ needed）—— 这一关才过得去
    expect(level.props.reduce((sum, prop) => sum + prop.capacity, 0)).toBeGreaterThanOrEqual(
      level.flags,
    );
    expect(bestScale(level)).toBeGreaterThanOrEqual(level.needed);
    // 桥头最显眼但只挂得下两面 —— 剩下的旗要去哪儿，就是这一关的抉择
    expect(bestScale(level)).toBe(40 * 2 + 30 * 3 + 24);
  });
});

describe('树上开花 · 判定：把旗分配到支点上', () => {
  it('一局真的走得完：按 weight 从高到低挂（与场景同一条路）', () => {
    let state = borrowStart();
    const order: string[] = [];
    for (let guard = 0; guard < 12 && !isBorrowDone(level, state); guard += 1) {
      const prop = nextPropToHang(level, state);
      expect(prop).toBeDefined();
      if (prop === undefined) break;
      order.push(prop.id);
      state = assignFlag(level, state, prop.id);
    }
    // 桥头两面（80）+ 林子一面（30）= 110 ≥ 100
    expect(order).toEqual(['bridge', 'bridge', 'woods']);
    expect(isBorrowDone(level, state)).toBe(true);
    expect(scaleAt(level, state)).toBe(110);
    expect(borrowProgress(level, state)).toBe(1);
    expect(flagsLeft(level, state)).toBe(3);
  });

  it('挂不上就是不挂上：超出容量原样返回，手里的旗与规模都不动', () => {
    let state = borrowStart();
    state = assignFlag(level, state, 'bridge');
    state = assignFlag(level, state, 'bridge');
    expect(flagCountAt(state, 'bridge')).toBe(2);
    expect(canHangAt(level, state, 'bridge')).toBe(false);
    const full = state;
    expect(assignFlag(level, full, 'bridge')).toBe(full);
    expect(assignFlag(level, full, 'nowhere')).toBe(full);
    expect(flagsLeft(level, full)).toBe(4);
    expect(scaleAt(level, full)).toBe(80);
    expect(full.hangs).toBe(2);
    // 这场面还差一点：差的就是林子里那一面
    expect(borrowProgress(level, full)).toBeCloseTo(0.8, 9);
    expect(isBorrowDone(level, full)).toBe(false);
    expect(isBorrowDone(level, assignFlag(level, full, 'woods'))).toBe(true);
  });

  it('撤下重挂零惩罚：撤下来的旗回到手里，换一处挂上去照旧算规模', () => {
    let state = borrowStart();
    state = assignFlag(level, state, 'bridge');
    state = assignFlag(level, state, 'bridge');
    state = assignFlag(level, state, 'woods'); // 110：成了
    expect(isBorrowDone(level, state)).toBe(true);

    const back = unassignFlag(level, state, 'bridge'); // 70：只是"重新想想"
    expect(flagCountAt(back, 'bridge')).toBe(1);
    expect(scaleAt(level, back)).toBe(70);
    expect(flagsLeft(level, back)).toBe(4);
    expect(isBorrowDone(level, back)).toBe(false);
    expect(back.unhangs).toBe(1);

    let again = assignFlag(level, back, 'mound'); // 94
    expect(scaleAt(level, again)).toBe(94);
    expect(isBorrowDone(level, again)).toBe(false);
    again = assignFlag(level, again, 'mound'); // 118
    expect(scaleAt(level, again)).toBe(118);
    expect(isBorrowDone(level, again)).toBe(true);
    expect(flagsLeft(level, again)).toBe(2);
    // 在没挂过的地方撤：原样返回（零惩罚）
    expect(unassignFlag(level, again, 'woods')).not.toBe(again);
    expect(unassignFlag(level, again, 'nothing-here')).toBe(again);
  });

  it('边界：六面旗全挂出去（3+3），规模封顶；挂满之后就只能撤一面下来', () => {
    let state = borrowStart();
    for (const id of ['woods', 'woods', 'woods', 'mound', 'mound', 'mound']) {
      state = assignFlag(level, state, id);
    }
    expect(flagsLeft(level, state)).toBe(0);
    expect(scaleAt(level, state)).toBe(3 * 30 + 3 * 24);
    expect(canHangAt(level, state, 'bridge')).toBe(false); // 手里没旗了
    expect(assignFlag(level, state, 'bridge')).toBe(state);
    expect(nextPropToHang(level, state)).toBeUndefined();
    // 小手该去撤"每面顶得最少"的那一处 —— 撤一面，桥头就挂得上了
    expect(nextPropToFree(level, state)?.id).toBe('mound');
    expect(nextPropToTouch(level, state)?.id).toBe('mound');
    const freed = unassignFlag(level, state, 'mound');
    expect(canHangAt(level, freed, 'bridge')).toBe(true);
    expect(assignFlag(level, freed, 'bridge')).not.toBe(freed);
  });

  it('点选：支点的圆心与边缘都算，最近的那个优先', () => {
    for (const prop of level.props) {
      expect(propAt(level, prop.x, prop.y, 0)?.id).toBe(prop.id);
      expect(propAt(level, prop.x + prop.radius, prop.y, 0)?.id).toBe(prop.id);
      // 手指落在命中圈外面一点点：没点中（但离旁边那个支点还远）
      expect(propAt(level, prop.x + prop.radius + 1, prop.y, 0)).toBeUndefined();
    }
    const woods = level.props[0]!;
    expect(propAt(level, woods.x, woods.y + woods.radius + TAP_FORGIVE - 8, TAP_FORGIVE)?.id).toBe(
      'woods',
    );
    // 站在南岸（张飞那边）：什么也点不到 —— 旗得挂到对岸去
    expect(propAt(level, 375, 1150, TAP_FORGIVE)).toBeUndefined();
  });
});

describe('树上开花 · 故事与复习', () => {
  it('两幕：桥头只剩一个人 → 借来的一片尘土；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.text).toContain('桥');
    expect(entry.story[1]!.text).toContain('尘土');
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择站在张飞的角度问：人少怎么办 —— 正解是借林子与尘土造势', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text).toContain('拖树枝');
    expect(entry.keyMoment.question).toContain('张飞');
    expect(entry.keyMoment.question).toContain('二十来骑');
    expect(entry.keyMoment.reveal).toContain('借来的');
    // 另外两个选项不是"点了就错"，都要说清楚后果
    for (const option of options) {
      if (option.isCanonical) continue;
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('三十六计的登记信息：第 29 计 · 并战计（第 5 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 29, set: 5 });
    expect(entry.dynasty).toBe('东汉');
    expect(entry.yearApprox).toBe(208);
    expect(entry.figures).toContain('张飞');
    expect(entry.figures).toContain('曹操');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('树上开花');
    expect(entry.source.quote).toBe('借局布势，力小势大。鸿渐于陆，其羽可用为仪也。');
    expect(entry.moral).toContain('借');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('show');
    expect(entry.game.stages[0]!.template).toBe('show');
    expect(templateSchemas.show!.safeParse(entry.game.stages[0]!.levelScript).success).toBe(true);
  });

  it('复习题：记忆题问尘土与桥头，迁移题落在"借现成的东西把场面撑起来"', () => {
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(
      1,
    );
    for (const question of entry.quiz) expect(question.answer).toBeLessThan(question.options.length);
    const transfer = entry.quiz.find((question) => question.kind === 'transfer')!;
    expect(transfer.question).toContain('合唱');
    expect(transfer.explanation).toContain('借');
  });

  it('儿童化：没有一场交战、没有一处流血 —— 只有尘土、旗与桥', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战']) expect(prose).not.toContain(word);
    // 落点要落在"借势"上，而不是"打"
    expect(prose).toContain('借');
    const scriptText = level.hint + level.props.map((prop) => prop.id).join('');
    for (const word of ['血', '死', '杀', '伤']) expect(scriptText).not.toContain(word);
  });
});

describe('树上开花 · 英译补丁', () => {
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

  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法（连提示也翻了）', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Blossoms on a Tree');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
    expect(merged.keyMoment.options.filter((option) => option.isCanonical)).toHaveLength(1);
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    expect(merged.game.stages[0]!.levelScript).toMatchObject({ hint: 'Hang flags, look bigger' });
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
    expect(merged.moral).toBe('Borrow what is already around you, and your side will look stronger.');
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
