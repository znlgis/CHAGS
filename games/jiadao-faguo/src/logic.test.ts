import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gatesLeft, hasPass, homeHit,
  isPassDone, nextGate, returnHome, takeGate, takenCount,
} from '@chags/templates/chain.logic';
import {
  CAPITAL, DESIGN_H, DESIGN_W, ENVOY, GATE_RADIUS, GATES, HOME, ROUTE, SKY_TOP,
} from './layout';
import { jiadaoLevel } from './logic';

const entry = getEntry('jiadao-faguo')!;
const level = jiadaoLevel(entry);

/**
 * 模板的点击宽容度（chain.ts 里 CHAIN.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 46;

/** 一个点在路点里的下标：关口就落在路点上 */
function routeIndexOf(x: number, y: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  ROUTE.forEach((point, index) => {
    const dist = Math.hypot(point.x - x, point.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

/** 照模板 runAutoplay 的同一条路走一遍：谈借路 → 一关一关过 → 回师 */
function runAutoplay(): { steps: string[]; state: ReturnType<typeof chainStart>; at: number } {
  let state = chainStart();
  let at = 0;
  const steps: string[] = [];
  for (let guard = 0; guard < 12; guard += 1) {
    const step = chainStep(level, state);
    if (step === undefined) break;
    if (step.kind === 'envoy') {
      steps.push('envoy');
      state = askPass(state, at);
    } else if (step.kind === 'gate') {
      steps.push(step.gate.id);
      state = takeGate(level, state, step.gate.id);
    } else {
      steps.push('home');
      state = returnHome(level, state, at);
    }
    at += CHAIN_TIMING.autoplayStepMs;
  }
  return { steps, state, at };
}

describe('假道伐虢 · 美术与关卡数据互锁', () => {
  it('三处关口就在这条路上，而且是按行军先后排的 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('pass');
    expect(level.gates.map((gate) => gate.id)).toEqual(GATES.map((gate) => gate.id));
    for (const [index, gate] of level.gates.entries()) {
      expect(gate.x).toBe(GATES[index]!.x);
      expect(gate.y).toBe(GATES[index]!.y);
      expect(gate.radius).toBe(GATE_RADIUS);
      // 关口正落在路点上：路从这儿过，关卡数据就得在这儿
      const point = ROUTE[routeIndexOf(gate.x, gate.y)]!;
      expect(Math.hypot(gate.x - point.x, gate.y - point.y)).toBe(0);
    }
    // 虞关 → 虢关 → 上阳关：路点的先后就是关口的先后
    expect(level.gates.map((gate) => routeIndexOf(gate.x, gate.y))).toEqual([2, 3, 4]);
    expect(level.gates.map((gate) => gate.label)).toEqual(['虞关', '虢关', '上阳关']);
    expect(level.gates.every((gate) => gate.label.length <= 12)).toBe(true);
  });

  it('谈借路在虞帐、回师回晋营，这条路一路往北 —— 顺序写在路上', () => {
    expect(level.envoy).toEqual({ x: ENVOY.x, y: ENVOY.y, radius: ENVOY.radius });
    expect(level.home).toEqual({ x: HOME.x, y: HOME.y, radius: HOME.radius });
    expect(routeIndexOf(ENVOY.x, ENVOY.y)).toBe(1);
    expect(routeIndexOf(HOME.x, HOME.y)).toBe(0);
    // 先谈借路（虞帐），再一关一关往北：每一段都比上一段靠北
    for (let i = 0; i + 1 < ROUTE.length; i += 1) {
      expect(ROUTE[i + 1]!.y, '第 ' + i + ' 段没往北走').toBeLessThan(ROUTE[i]!.y);
    }
    // 虢都上阳在最后一处关口的上面：路到此为止
    expect(CAPITAL.y).toBeLessThan(level.gates[2]!.y);
  });

  it('五个可以点的地方都在画面里，彼此点得开（手指粗也点不到隔壁）', () => {
    const spots = [
      { id: 'envoy', x: level.envoy.x, y: level.envoy.y, radius: level.envoy.radius },
      { id: 'home', x: level.home.x, y: level.home.y, radius: level.home.radius },
      ...level.gates.map((gate) => ({ id: gate.id, x: gate.x, y: gate.y, radius: gate.radius })),
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

describe('假道伐虢 · 判定：顺序不能跳（点错是零惩罚）', () => {
  it('一局真的走得完：谈借路 → 一关一关过 → 回师（与场景同一条路）', () => {
    const { steps, state } = runAutoplay();
    expect(steps).toEqual(['envoy', 'yu-gate', 'guo-gate', 'shangyang-gate', 'home']);
    expect(takenCount(state)).toBe(3);
    expect(gatesLeft(level, state)).toBe(0);
    expect(isPassDone(level, state)).toBe(true);
    expect(state.home).toBe(true);
    expect(nextGate(level, state)).toBeUndefined();
    expect(chainStep(level, state)).toBeUndefined();
  });

  it('没借到路，一个关口也拿不了（原样返回）', () => {
    const start = chainStart();
    expect(hasPass(start)).toBe(false);
    for (const gate of level.gates) expect(takeGate(level, start, gate.id)).toBe(start);
    expect(nextGate(level, start)?.id).toBe('yu-gate');
    expect(chainStep(level, start)).toEqual({ kind: 'envoy' });
    // 谈成借路：第一处关口这才动得了
    const passed = askPass(start, 1200);
    expect(hasPass(passed)).toBe(true);
    expect(passed.passAtMs).toBe(1200);
    expect(takeGate(level, passed, 'yu-gate')).not.toBe(passed);
    // 谈成之后再点虞帐：原样返回，不重复计
    expect(askPass(passed, 4000)).toBe(passed);
  });

  it('顺序不能跳：跳着点、回头点、点个不存在的，都只是没进展', () => {
    let state = askPass(chainStart(), 0);
    expect(takeGate(level, state, 'guo-gate')).toBe(state);
    expect(takeGate(level, state, 'shangyang-gate')).toBe(state);
    expect(takeGate(level, state, 'no-such-gate')).toBe(state);
    state = takeGate(level, state, 'yu-gate');
    expect(takenCount(state)).toBe(1);
    expect(takeGate(level, state, 'yu-gate')).toBe(state);
    expect(takeGate(level, state, 'shangyang-gate')).toBe(state);
    expect(nextGate(level, state)?.id).toBe('guo-gate');
    // 错的那几下只是没进展：接着按顺序走，照样走得完
    state = takeGate(level, state, 'guo-gate');
    state = takeGate(level, state, 'shangyang-gate');
    expect(takenCount(state)).toBe(3);
    expect(isPassDone(level, state)).toBe(false); // 还没回师
  });

  it('关口没拿完就点自家营地：回不去；拿完了才回得去（零惩罚）', () => {
    let state = askPass(chainStart(), 0);
    expect(returnHome(level, state, 5000)).toBe(state);
    state = takeGate(level, state, 'yu-gate');
    expect(returnHome(level, state, 5000)).toBe(state);
    for (const id of ['guo-gate', 'shangyang-gate']) state = takeGate(level, state, id);
    const home = returnHome(level, state, 6000);
    expect(home).not.toBe(state);
    expect(home.home).toBe(true);
    expect(home.homeAtMs).toBe(6000);
    expect(isPassDone(level, home)).toBe(true);
    expect(returnHome(level, home, 9000)).toBe(home);
  });

  it('手指粗也点得到，点空处什么也不算', () => {
    for (const gate of level.gates) {
      expect(gateAt(level, gate.x, gate.y, 0)?.id).toBe(gate.id);
      expect(gateAt(level, gate.x, gate.y + gate.radius + TAP_FORGIVE, TAP_FORGIVE)?.id).toBe(gate.id);
      expect(gateAt(level, gate.x, gate.y + gate.radius + TAP_FORGIVE + 1, 0)).toBeUndefined();
    }
    expect(envoyHit(level, level.envoy.x, level.envoy.y, 0)).toBe(true);
    expect(envoyHit(level, level.envoy.x, level.envoy.y - level.envoy.radius - TAP_FORGIVE, TAP_FORGIVE)).toBe(
      true,
    );
    expect(envoyHit(level, 8, 1300, 0)).toBe(false);
    expect(homeHit(level, level.home.x, level.home.y, 0)).toBe(true);
    expect(homeHit(level, 700, 1300, 0)).toBe(false);
    // 站在虞帐或者自家营里，不会顺手点到哪个关口
    expect(gateAt(level, level.envoy.x, level.envoy.y, TAP_FORGIVE)).toBeUndefined();
    expect(gateAt(level, level.home.x, level.home.y, TAP_FORGIVE)).toBeUndefined();
    expect(gateAt(level, 375, 1230, 0)).toBeUndefined();
  });

  it('autoplay 的每一步都给画面留够时间：走完一局远在 e2e 的等待之内', () => {
    expect(CHAIN_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(CHAIN_TIMING.envoyMs);
    expect(CHAIN_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(CHAIN_TIMING.gateMs);
    const { at } = runAutoplay();
    expect(at + CHAIN_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });
});

describe('假道伐虢 · 故事与复习', () => {
  it('两幕：路是借来的 → 回来时路对着自己；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('借');
    expect(entry.story[1]!.text).toContain('回来');
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择站在虞公的角度问：该不该把路借出去 —— 正解是不借', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text.startsWith('不借')).toBe(true);
    expect(entry.keyMoment.question).toContain('虞公');
    expect(entry.keyMoment.question).toContain('借');
    // 揭晓落在"借出去的路，回来时可能对着自己"
    expect(entry.keyMoment.reveal).toContain('借出去的路');
    expect(entry.keyMoment.reveal).toContain('回来时可能对着自己');
    // 另外两个选项不是"点了就错"，都要说清楚后果
    for (const option of options) {
      if (option.isCanonical) continue;
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('三十六计的登记信息：第 24 计 · 混战计（第 4 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 24, set: 4 });
    expect(entry.dynasty).toBe('春秋');
    expect(entry.yearApprox).toBe(-655);
    expect(entry.figures).toContain('晋献公');
    expect(entry.figures).toContain('虞公');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('假道伐虢');
    expect(entry.source.quote).toBe('两大之间，敌胁以从，我假以势。');
    expect(entry.moral).toContain('借出去');
    expect(entry.game.template).toBe('chain');
    expect(entry.game.stages[0]!.template).toBe('chain');
  });

  it('复习题：记忆题问借路与唇亡齿寒，迁移题落在"借东西之前先想清楚"', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer');
    expect(transfer?.question).toContain('滑板');
    expect(transfer?.explanation).toContain('先想清楚');
  });

  it('儿童化：没有交战、没有一处流血 —— 只有借路、关口与回师', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战']) expect(prose).not.toContain(word);
    // 唇亡齿寒的教训要在故事里说清楚
    expect(prose).toContain('唇亡齿寒');
    // 关卡脚本里也没有一处交战
    const scriptText = level.hint + level.gates.map((gate) => gate.label).join('');
    for (const word of ['血', '死', '杀', '伤']) expect(scriptText).not.toContain(word);
  });
});

describe('假道伐虢 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('jiadao-faguo', 'en')!;
    expect(merged.title).toBe('Borrow a Road to Attack Guo');
    expect(merged.game.stages[0]!.levelScript).toMatchObject({
      hint: 'Borrow first, then pass',
      gates: [{ label: 'Yu Pass' }, { label: 'Guo Pass' }, { label: 'Shangyang' }],
    });
    expect(merged.moral).toBe('Before you lend anything out, think what he will do with it.');
  });
});
