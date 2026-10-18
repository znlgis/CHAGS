import { getEntry } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import {
  HINT_TIMING, hintProgress, hintPropAt, hintStart, isHintDone, isWantedProp, knockHint,
  listenerStep, nextHintProp, wantedKind, wrongKnocks,
} from '@chags/templates/probe.logic';
import {
  DESIGN_H, DESIGN_W, LISTENER_PATH, LISTENER_RADIUS, PROPS, PROP_RADIUS, PROP_Y, STEPS, WALL,
  WANTED_ID, YOUSAN,
} from './layout';
import { zhisangLevel } from './logic';

const entry = getEntry('zhisang-mahuai')!;
const level = zhisangLevel(entry);

/**
 * 模板的点击宽容度（probe.ts 里 PROBE_HINT.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 48;

describe('指桑骂槐 · 美术与关卡数据互锁', () => {
  it('四样东西站在同一条线上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('hint');
    expect(level.props.map((prop) => prop.id)).toEqual(PROPS.map((prop) => prop.id));
    for (const [index, prop] of level.props.entries()) {
      expect(prop.x).toBe(PROPS[index]!.x);
      expect(prop.y).toBe(PROP_Y);
      expect(prop.radius).toBe(PROP_RADIUS);
    }
  });

  it('四样里恰好只有一样是他听得懂的，而且就是美术里说好的那一样（鼓）', () => {
    // 关卡脚本里 has 就是"这样东西的类别"：'snake' 的那一样 = listener.wants
    expect(wantedKind(level)).toBe('snake');
    const wanted = level.props.filter((prop) => prop.has === level.listener.wants);
    expect(wanted).toHaveLength(1);
    expect(wanted[0]!.id).toBe(WANTED_ID);
    expect(isWantedProp(level, WANTED_ID)).toBe(true);
    for (const prop of level.props) {
      if (prop.id === WANTED_ID) continue;
      expect(isWantedProp(level, prop.id)).toBe(false);
    }
    // 没有一样是他听得懂的：schema 当场拒掉（这一关不可能过）
    expect(
      templateSchemas.probe!.safeParse({
        ...level,
        listener: { ...level.listener, wants: 'ghost' },
      }).success,
    ).toBe(false);
  });

  it('二世站在走位的第一格，要走 3 步 —— 每一步都落在画好的走位上', () => {
    const first = LISTENER_PATH[0]!;
    expect(level.listener).toEqual({ x: first.x, y: first.y, radius: LISTENER_RADIUS, wants: 'snake' });
    expect(level.steps).toBe(STEPS);
    expect(STEPS).toBe(LISTENER_PATH.length - 1);
    // 他一步一步往鼓那边走：往右上走，每一步都离鼓更近
    const drum = level.props.find((prop) => prop.id === WANTED_ID)!;
    let last = Math.hypot(first.x - drum.x, first.y - drum.y);
    for (const point of LISTENER_PATH.slice(1)) {
      const dist = Math.hypot(point.x - drum.x, point.y - drum.y);
      expect(dist).toBeLessThan(last);
      last = dist;
    }
    // 走位都在画面里，也不压着宫墙
    for (const point of LISTENER_PATH) {
      expect(point.x - LISTENER_RADIUS).toBeGreaterThanOrEqual(0);
      expect(point.x + LISTENER_RADIUS).toBeLessThanOrEqual(DESIGN_W);
      expect(point.y - LISTENER_RADIUS).toBeGreaterThan(WALL.bottom);
      expect(point.y + LISTENER_RADIUS).toBeLessThan(DESIGN_H);
    }
    // 优旃站在鼓边上，不站在走位上（挡不着路）
    expect(Math.abs(YOUSAN.x - drum.x)).toBeLessThan(140);
    for (const point of LISTENER_PATH) {
      expect(Math.hypot(point.x - YOUSAN.x, point.y - YOUSAN.y)).toBeGreaterThan(120);
    }
  });

  it('点选：点心就是那一样；四样之间的空处点得开，二世站着的地方点不到东西', () => {
    for (const prop of level.props) {
      expect(hintPropAt(level, prop.x, prop.y, TAP_FORGIVE)?.id).toBe(prop.id);
      expect(hintPropAt(level, prop.x, prop.y, 0)?.id).toBe(prop.id);
    }
    expect(hintPropAt(level, 375, 200, TAP_FORGIVE)).toBeUndefined();
    // 二世站的地方离四样东西都远：点他不会误敲了哪一样
    expect(hintPropAt(level, level.listener.x, level.listener.y, TAP_FORGIVE)).toBeUndefined();
    // 两样中间那条线上，拿最近的那一样
    expect(hintPropAt(level, 196, PROP_Y, TAP_FORGIVE)?.id).toBe('ash');
    expect(hintPropAt(level, 194, PROP_Y, TAP_FORGIVE)?.id).toBe('mulberry');
  });
});

describe('指桑骂槐 · 判定（敲对了才往前走，敲错只记一笔）', () => {
  it('敲对的那一样：他往前走一步；走够 steps 步，他自己就改了主意', () => {
    let state = hintStart();
    const steps: number[] = [];
    while (!isHintDone(level, state)) {
      state = knockHint(level, state, WANTED_ID);
      steps.push(hintProgress(state));
    }
    expect(steps).toEqual([1, 2, 3]);
    expect(hintProgress(state)).toBe(level.steps);
    expect(listenerStep(level, state)).toBe(STEPS);
    expect(isHintDone(level, state)).toBe(true);
    expect(wrongKnocks(state)).toBe(0);
    expect(nextHintProp(level, state)).toBeUndefined();
  });

  it('敲错只记一笔：进度不动、不扣星、不结束（零惩罚），接着敲对的照样成', () => {
    let state = hintStart();
    for (const id of ['mulberry', 'ash', 'bell', 'mulberry']) {
      state = knockHint(level, state, id);
    }
    expect(wrongKnocks(state)).toBe(4);
    expect(hintProgress(state)).toBe(0);
    expect(isHintDone(level, state)).toBe(false);
    // 敲错四回之后照样一步不少地走完
    state = knockHint(level, state, WANTED_ID);
    state = knockHint(level, state, 'bell');
    state = knockHint(level, state, WANTED_ID);
    state = knockHint(level, state, WANTED_ID);
    expect(isHintDone(level, state)).toBe(true);
    expect(wrongKnocks(state)).toBe(5);
  });

  it('敲过的记下来（重复的不算新的一样），写错 id 什么也不算', () => {
    let state = hintStart();
    state = knockHint(level, state, 'ash');
    state = knockHint(level, state, 'ash');
    state = knockHint(level, state, WANTED_ID);
    expect(state.knocked).toEqual(['ash', WANTED_ID]);
    expect(knockHint(level, state, 'ghost')).toBe(state);
    expect(wrongKnocks(state)).toBe(2);
  });

  it('一局真的走得完：照场景的同一条路，敲三下（与真实操作同一条路）', () => {
    let state = hintStart();
    const steps: string[] = [];
    for (let i = 0; i < 10 && !isHintDone(level, state); i += 1) {
      const prop = nextHintProp(level, state);
      expect(prop).toBeDefined();
      if (prop === undefined) break;
      steps.push(prop.id);
      state = knockHint(level, state, prop.id);
    }
    expect(steps).toEqual([WANTED_ID, WANTED_ID, WANTED_ID]);
    expect(isHintDone(level, state)).toBe(true);
    // 一次也没敲错（小手从头到尾只指他听得懂的那一样）
    expect(wrongKnocks(state)).toBe(0);
  });

  it('时间常量：走一步看得清，走完一局远在 e2e 的等待之内', () => {
    expect(HINT_TIMING.stepMs).toBeGreaterThanOrEqual(HINT_TIMING.knockMs);
    expect(level.steps * HINT_TIMING.stepMs + HINT_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });
});

describe('指桑骂槐 · 故事与复习', () => {
  it('两幕：二世要漆城 → 优旃换个说法；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('漆');
    expect(entry.story[1]!.text).toContain('棚子');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['先说好极了，再把要搭大棚子这件难处点给他听']);
  });

  it('三十六计的登记信息：第 26 计 · 并战计（第 5 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 26, set: 5 });
    expect(entry.dynasty).toBe('秦');
    expect(entry.yearApprox).toBe(-209);
    expect(entry.figures).toEqual(['优旃', '秦二世']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('指桑骂槐');
    expect(entry.source.quote).toContain('大凌小者');
    expect(entry.moral).toContain('换个说法');
    expect(entry.game.template).toBe('probe');
    expect(entry.game.stages[0]!.template).toBe('probe');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('转笔');
  });

  it('儿童化：没有流血、没有骂人，落点在"换个说法，别人更容易听进去"', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '砍']) expect(prose).not.toContain(word);
    expect(entry.keyMoment.reveal).toContain('换个说法');
    // 这不是"背后说坏话"：误解那一条专门把这件事说清楚
    expect(entry.misconceptions.some((item) => item.includes('背后'))).toBe(true);
  });
});

describe('指桑骂槐 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('zhisang-mahuai', 'en')!;
    expect(merged.title).toBe('Point at the Mulberry Tree While Cursing the Locust Tree');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
    expect(merged.game.stages[0]!.levelScript).toMatchObject({ hint: 'Knock the one he hears' });
  });
});
