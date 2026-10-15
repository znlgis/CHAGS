import { describe, expect, it } from 'vitest';
import { RuseLevelSchema } from './schemas';
import {
  RUSE_TIMING, autoplayLevel, gazeSide, isCarriedPast, isDisguised, isExposed, isRuseComplete,
  itemAt, lampIndex, lampPhase, litMsFor, msLitLeft, msToLight, nextItemToCarry, noiseAt,
  noiseForKnock, safeFor, shellAt, sideAt,
} from './ruse.logic';

/** 第 1 计 · 瞒天过海：三件货各三个外壳，正确外壳都是柴捆；灯 5.2 秒亮一次 */
const hide = RuseLevelSchema.parse({
  mode: 'hide',
  gate: { x: 600, y: 430, radius: 90 },
  items: [
    {
      id: 'drum',
      kind: 'drum',
      x: 150,
      y: 640,
      disguiseAs: 'straw',
      shells: [
        { id: 'drum-straw', kind: 'straw', x: 330, y: 640 },
        { id: 'drum-sack', kind: 'sack', x: 450, y: 640 },
        { id: 'drum-net', kind: 'net', x: 570, y: 640 },
      ],
    },
    {
      id: 'banner',
      kind: 'banner',
      x: 150,
      y: 810,
      disguiseAs: 'straw',
      shells: [
        { id: 'banner-straw', kind: 'straw', x: 330, y: 810 },
        { id: 'banner-sack', kind: 'sack', x: 450, y: 810 },
      ],
    },
    {
      id: 'armor',
      kind: 'armor',
      x: 150,
      y: 980,
      disguiseAs: 'straw',
      shells: [
        { id: 'armor-straw', kind: 'straw', x: 330, y: 980 },
        { id: 'armor-sack', kind: 'sack', x: 450, y: 980 },
        { id: 'armor-net', kind: 'net', x: 570, y: 980 },
      ],
    },
  ],
  lamp: { intervalMs: 5200, warnMs: 1200 },
  noises: [],
  hint: '先给货换个最平常的样子',
});

/** 第 6 计 · 声东击西：三件东西从右下方出发，敲锣把灯留在左边 */
const divert = RuseLevelSchema.parse({
  mode: 'divert',
  gate: { x: 600, y: 400, radius: 90 },
  items: [
    { id: 'cart', kind: 'cart', x: 620, y: 1000 },
    { id: 'torch', kind: 'torch', x: 520, y: 1130 },
    { id: 'waterskin', kind: 'waterskin', x: 660, y: 1130 },
  ],
  lamp: { intervalMs: 3400, warnMs: 900 },
  gaze: { left: { x: 170, y: 500 }, right: { x: 580, y: 500 } },
  noises: [
    { id: 'gong-left', x: 120, y: 980, holdMs: 2600 },
    { id: 'drum-left', x: 230, y: 1080, holdMs: 2600 },
  ],
  hint: '敲锣把灯引到左边，再从右边走',
});

const drum = hide.items[0]!;
const cart = divert.items[0]!;

describe('灯：暗 → 征兆 → 亮', () => {
  it('一轮里三个时刻各就各位（5.2 秒一轮、亮前 1.2 秒有征兆）', () => {
    expect(litMsFor(hide)).toBe(1400);
    expect(lampPhase(hide, 0)).toBe('dark');
    expect(lampPhase(hide, 2599)).toBe('dark');
    expect(lampPhase(hide, 2600)).toBe('warn');
    expect(lampPhase(hide, 3799)).toBe('warn');
    expect(lampPhase(hide, 3800)).toBe('lit');
    expect(lampPhase(hide, 5199)).toBe('lit');
    // 过了这一轮又是下一轮
    expect(lampPhase(hide, 5200)).toBe('dark');
    expect(lampIndex(hide, 5200)).toBe(1);
  });

  it('一轮里三个时刻加起来正好是一轮，不会有"没有阶段"的空隙', () => {
    const counts: Record<string, number> = { dark: 0, warn: 0, lit: 0 };
    for (let t = 0; t < hide.lamp.intervalMs; t += 10) {
      counts[lampPhase(hide, t)] = (counts[lampPhase(hide, t)] ?? 0) + 1;
    }
    const sum = (counts.dark ?? 0) + (counts.warn ?? 0) + (counts.lit ?? 0);
    expect(sum).toBe(hide.lamp.intervalMs / 10);
    // 亮的时长就是 litMsFor，不多不少
    expect((counts.lit ?? 0) * 10).toBe(litMsFor(hide));
    expect((counts.warn ?? 0) * 10).toBe(hide.lamp.warnMs);
  });

  it('倒计时（还有多久亮）在亮着的时候归零', () => {
    expect(msToLight(hide, 0)).toBe(3800);
    expect(msToLight(hide, 3000)).toBe(800);
    expect(msToLight(hide, 3800)).toBe(0);
    expect(msToLight(hide, 5000)).toBe(0);
    expect(msLitLeft(hide, 3800)).toBe(1400);
    expect(msLitLeft(hide, 5000)).toBe(200);
    expect(msLitLeft(hide, 1000)).toBe(0);
  });

  it('负数（回看上一轮）也落在同一套时刻里', () => {
    expect(lampPhase(hide, -100)).toBe('lit');
    expect(lampPhase(hide, -1500)).toBe('warn');
    expect(lampPhase(hide, -3000)).toBe('dark');
  });

  it('征兆比一整轮还长时整轮都在征兆：挤掉的是"暗"的那一段，不会算出负时长', () => {
    const odd = RuseLevelSchema.parse({ ...hide, lamp: { intervalMs: 1000, warnMs: 5000 } });
    expect(litMsFor(odd)).toBe(270);
    expect(lampPhase(odd, 0)).toBe('warn');
    expect(lampPhase(odd, 729)).toBe('warn');
    expect(lampPhase(odd, 730)).toBe('lit');
    expect(lampPhase(odd, 999)).toBe('lit');
    // 下一轮照旧
    expect(lampPhase(odd, 1000)).toBe('warn');
  });
});

describe('灯照哪一边，敲锣怎么延长', () => {
  it('不敲锣时一轮换一边：偶数轮照左、奇数轮照右', () => {
    expect(gazeSide(divert, 0)).toBe('left');
    expect(gazeSide(divert, 3399)).toBe('left');
    expect(gazeSide(divert, 3400)).toBe('right');
    expect(gazeSide(divert, 6800)).toBe('left');
  });

  it('敲锣把"照左"延长 holdMs：本来该照右的时候也照左', () => {
    const hold = 3400 + 2600; // 在第 2 轮敲一下锣
    expect(gazeSide(divert, 3400)).toBe('right');
    expect(gazeSide(divert, 3400, hold)).toBe('left');
    expect(gazeSide(divert, 5999, hold)).toBe('left');
    // 延长的时长一秒不多、一秒不少
    expect(gazeSide(divert, 6000, hold)).toBe('right');
    expect(gazeSide(divert, hold, hold)).toBe('right');
  });

  it('灯留在左边的时候，右边的东西就是安全的', () => {
    // 6400 落在第 2 轮的亮的阶段，且这一轮本该照右
    expect(lampPhase(divert, 6400)).toBe('lit');
    expect(gazeSide(divert, 6400)).toBe('right');
    expect(isExposed(divert, cart, 6400, { side: 'right' })).toBe(true);
    expect(isExposed(divert, cart, 6400, { side: 'right', holdUntilMs: 7000 })).toBe(false);
  });

  it('左右的分界取两处 gaze 的中点', () => {
    expect(sideAt(divert, 170)).toBe('left');
    expect(sideAt(divert, 375)).toBe('left');
    expect(sideAt(divert, 376)).toBe('right');
    expect(sideAt(divert, 620)).toBe('right');
    // hide 没有 gaze：也有一条中轴线（关卡不会用到，但判定不能崩）
    expect(sideAt(hide, 100)).toBe('left');
  });
});

describe('被看见了（失败路径：零惩罚，退回原位）', () => {
  it('hide：灯亮时外壳不对就被看见，外壳对了就没事', () => {
    expect(lampPhase(hide, 4000)).toBe('lit');
    expect(isExposed(hide, drum, 4000, { shellKind: null })).toBe(true);
    expect(isExposed(hide, drum, 4000, { shellKind: 'sack' })).toBe(true);
    expect(isExposed(hide, drum, 4000, { shellKind: 'straw' })).toBe(false);
    // 灯没亮的时候，什么外壳都没关系
    expect(isExposed(hide, drum, 1000, { shellKind: 'sack' })).toBe(false);
    expect(isExposed(hide, drum, 2700, { shellKind: 'sack' })).toBe(false);
  });

  it('divert：灯正好照在这一边就被看见（不吃外壳）', () => {
    // 第 1 轮（照左）的亮的阶段：左边危险，右边安全
    expect(lampPhase(divert, 3000)).toBe('lit');
    expect(isExposed(divert, cart, 3000, { side: 'left' })).toBe(true);
    expect(isExposed(divert, cart, 3000, { side: 'right' })).toBe(false);
    // 灯没亮的时候两边都能走
    expect(isExposed(divert, cart, 1000, { side: 'left' })).toBe(false);
  });

  it('已经过关的东西，灯怎么照都不会被退回来', () => {
    expect(isExposed(hide, drum, 4000, { shellKind: null, passed: true })).toBe(false);
    expect(isExposed(divert, cart, 3000, { side: 'left', passed: true })).toBe(false);
  });

  it('外壳"对不对"只看它该装成什么样', () => {
    expect(isDisguised(drum, 'straw')).toBe(true);
    expect(isDisguised(drum, 'net')).toBe(false);
    expect(isDisguised(drum, null)).toBe(false);
    expect(isDisguised(divert.items[0]!, 'straw')).toBe(false);
  });
});

describe('过关：拖过检查口就永久安全', () => {
  it('检查口带宽容度：站上去就行，不用像素级对准', () => {
    expect(isCarriedPast(hide, 600, 430)).toBe(true);
    expect(isCarriedPast(hide, 689, 430)).toBe(true);
    expect(isCarriedPast(hide, 700, 430)).toBe(false);
    expect(isCarriedPast(hide, 700, 430, 12)).toBe(true);
    // 出发点离检查口很远 —— 没有人一开局就过关
    for (const item of hide.items) expect(isCarriedPast(hide, item.x, item.y)).toBe(false);
  });

  it('三件都过了才算成，一件都不能落下', () => {
    expect(isRuseComplete(hide, [])).toBe(false);
    expect(isRuseComplete(hide, ['drum', 'banner'])).toBe(false);
    expect(isRuseComplete(hide, ['drum', 'banner', 'armor'])).toBe(true);
    // 多写了别的 id 不影响
    expect(isRuseComplete(hide, ['drum', 'banner', 'armor', 'ghost'])).toBe(true);
    // 退回原位不会把已经过关的那件算回来
    expect(isRuseComplete(hide, ['drum', 'banner'])).toBe(false);
  });

  it('还没过关的第一件：无头验证按关卡脚本的顺序走', () => {
    expect(nextItemToCarry(hide, [])?.id).toBe('drum');
    expect(nextItemToCarry(hide, ['drum'])?.id).toBe('banner');
    expect(nextItemToCarry(hide, ['drum', 'banner', 'armor'])).toBeUndefined();
  });
});

describe('时机：这一趟走得完吗', () => {
  it('hide：外壳对了，什么时候走都安全', () => {
    expect(safeFor(hide, drum, 3990, 400, { shellKind: 'straw' })).toBe(true);
  });

  it('hide：外壳不对，灯亮着的时候不能动身', () => {
    expect(safeFor(hide, drum, 3990, 400, { shellKind: 'sack' })).toBe(false);
    // 离亮还有一会儿，那就来得及
    expect(safeFor(hide, drum, 3000, 300, { shellKind: 'sack' })).toBe(true);
  });

  it('divert：锣声还在的时候走得完，锣声过了就走不完', () => {
    // 第 2 轮马上要亮，而这一轮照右 —— 不敲锣就不能动身
    expect(safeFor(divert, cart, 5800, 300, { side: 'right' })).toBe(false);
    // 敲过锣：灯被留在左边，这一趟走得完
    expect(safeFor(divert, cart, 5800, 300, { side: 'right', holdUntilMs: 7000 })).toBe(true);
    // 锣声只管到 7000：一趟要走 7 秒，中途又会遇到"照右"的亮 —— 那就再等下一声锣
    expect(safeFor(divert, cart, 6400, 7000, { side: 'right', holdUntilMs: 7000 })).toBe(false);
  });
});

describe('无头验证：把灯的周期按比例压短', () => {
  it('真实操作时关卡原样不动', () => {
    expect(autoplayLevel(hide, false)).toBe(hide);
  });

  it('压短之后三个时刻仍然自洽（征兆 + 亮 < 一轮）', () => {
    for (const level of [hide, divert]) {
      const fast = autoplayLevel(level, true);
      expect(fast.lamp.intervalMs).toBeLessThan(level.lamp.intervalMs);
      expect(fast.lamp.intervalMs).toBeGreaterThanOrEqual(RUSE_TIMING.autoplayMinCycleMs);
      // 比例不变：征兆在周期里的占比与压缩前一样
      const before = level.lamp.warnMs / level.lamp.intervalMs;
      const after = fast.lamp.warnMs / fast.lamp.intervalMs;
      expect(Math.abs(after - before)).toBeLessThan(0.02);
      expect(fast.lamp.warnMs + litMsFor(fast)).toBeLessThan(fast.lamp.intervalMs);
      // 锣声也跟着压短，但不能短到"还没走完就没了"
      for (const [i, noise] of fast.noises.entries()) {
        expect(noise.holdMs).toBeLessThan(level.noises[i]!.holdMs);
        expect(noise.holdMs).toBeGreaterThanOrEqual(RUSE_TIMING.litMsMin);
      }
    }
  });

  it('压缩后的关卡里，三个时刻都还会出现', () => {
    const fast = autoplayLevel(hide, true);
    const phases = new Set<string>();
    for (let t = 0; t < fast.lamp.intervalMs; t += 5) phases.add(lampPhase(fast, t));
    expect([...phases].sort()).toEqual(['dark', 'lit', 'warn']);
  });
});

describe('点选：手指粗也能点得到', () => {
  it('点外壳：拿最近的那个，顺便知道它是哪件东西的', () => {
    expect(shellAt(hide, 335, 645, 56)?.shell.kind).toBe('straw');
    expect(shellAt(hide, 335, 645, 56)?.item.id).toBe('drum');
    expect(shellAt(hide, 450, 810, 56)?.item.id).toBe('banner');
    expect(shellAt(hide, 375, 1200, 56)).toBeUndefined();
  });

  it('点东西：divert 里三件都在右下', () => {
    expect(itemAt(divert, 620, 1000, 96)?.id).toBe('cart');
    expect(itemAt(divert, 130, 1000, 96)).toBeUndefined();
  });

  it('点锣鼓：左侧两件都能点到，无头验证轮流敲', () => {
    expect(noiseAt(divert, 120, 980, 84)?.id).toBe('gong-left');
    expect(noiseAt(divert, 240, 1090, 84)?.id).toBe('drum-left');
    expect(noiseAt(divert, 600, 980, 84)).toBeUndefined();
    expect(noiseForKnock(divert, 0)?.id).toBe('gong-left');
    expect(noiseForKnock(divert, 1)?.id).toBe('drum-left');
    expect(noiseForKnock(divert, 2)?.id).toBe('gong-left');
    expect(noiseForKnock(hide, 0)).toBeUndefined();
  });
});

describe('schema：关卡自己有解、也不给答案留两份', () => {
  it('hide 模式每件都要写 disguiseAs，且正确外壳只能有一个', () => {
    expect(() =>
      RuseLevelSchema.parse({
        ...hide,
        items: [{ ...drum, disguiseAs: undefined }],
      }),
    ).toThrow();
    expect(() =>
      RuseLevelSchema.parse({
        ...hide,
        items: [{ ...drum, shells: [...drum.shells, { id: 'x', kind: 'straw', x: 0, y: 0 }] }],
      }),
    ).toThrow();
  });

  it('divert 模式必须有 gaze 与至少一个锣鼓，而且不许有外壳', () => {
    expect(() =>
      RuseLevelSchema.parse({ ...divert, noises: [], gaze: undefined }),
    ).toThrow();
    expect(() =>
      RuseLevelSchema.parse({
        ...divert,
        items: [{ ...cart, shells: [{ id: 'x', kind: 'straw', x: 0, y: 0 }] }],
      }),
    ).toThrow();
  });
});
describe('无头验证：一局真的走得完（被看见也不卡死）', () => {
  it('hide：套上正好的外壳，三件一趟一趟都过得去', () => {
    const fast = autoplayLevel(hide, true);
    const carryMs = 190;
    let t = 0;
    let passed: string[] = [];
    for (let guard = 0; guard < 20 && !isRuseComplete(fast, passed); guard += 1) {
      const item = nextItemToCarry(fast, passed)!;
      // 外壳对了，什么时候动身都安全
      expect(safeFor(fast, item, t, carryMs, { shellKind: item.disguiseAs })).toBe(true);
      t += carryMs;
      passed = [...passed, item.id];
      t += 200;
    }
    expect(isRuseComplete(fast, passed)).toBe(true);
    expect(t).toBeLessThan(3000);
  });

  it('divert：先敲锣再走，三件东西都能从右边过去', () => {
    const fast = autoplayLevel(divert, true);
    const carryMs = 190;
    let t = 0;
    let passed: string[] = [];
    let holdUntil = 0;
    let noiseReadyAt = 0;
    let knockIndex = 0;
    for (let guard = 0; guard < 400 && !isRuseComplete(fast, passed); guard += 1) {
      const item = nextItemToCarry(fast, passed)!;
      if (t >= noiseReadyAt) {
        const noise = noiseForKnock(fast, knockIndex)!;
        knockIndex += 1;
        holdUntil = t + noise.holdMs;
        noiseReadyAt = t + RUSE_TIMING.noiseCooldownMs;
      }
      expect(safeFor(fast, item, t, carryMs, { side: sideAt(fast, item.x), holdUntilMs: holdUntil })).toBe(true);
      t += carryMs;
      passed = [...passed, item.id];
      t += 200;
    }
    expect(isRuseComplete(fast, passed)).toBe(true);
    expect(t).toBeLessThan(4000);
  });

  it('divert：不看时机、闷头走的玩法会被灯照到退回 —— 但退回零惩罚，多试几次还是过关', () => {
    const fast = autoplayLevel(divert, true);
    // 一个慢慢挪的玩家：一趟要走 600ms，中间一定会撞上一次"灯照右边"
    const carryMs = 600;
    const step = 60;
    let t = 0;
    let passed: string[] = [];
    let progress = 0;
    let caught = 0;
    for (let guard = 0; guard < 3000 && !isRuseComplete(fast, passed); guard += 1) {
      const item = nextItemToCarry(fast, passed)!;
      const sight = { side: sideAt(fast, item.x) };
      if (isExposed(fast, item, t, sight)) {
        // 被灯照到：这一趟白走，退回起点；退回不含任何惩罚，下一轮接着来
        if (progress > 0) caught += 1;
        progress = 0;
        // 已经过关的那几件不受影响
        expect(passed).not.toContain(item.id);
      } else {
        progress += step;
        if (progress >= carryMs) {
          progress = 0;
          passed = [...passed, item.id];
        }
      }
      t += step;
    }
    expect(isRuseComplete(fast, passed)).toBe(true);
    expect(caught).toBeGreaterThan(0);
    expect(t).toBeLessThan(20000);
  });
});