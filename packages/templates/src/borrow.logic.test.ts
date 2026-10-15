import { describe, expect, it } from 'vitest';
import { BorrowBannerLevelSchema, BorrowLevelSchema } from './schemas';
import {
  borrowStart, canLift, connectProp, disconnectProp, hasFulcrum, isBorrowDone, isLifted,
  nextPropToConnect, propAt, pull, selfPower, suggestedConnections, totalPower,
} from './borrow.logic';
import {
  availableFlags, bannerStart, flagAt, isBannerDone, isFlagRaised, isPersonRallied,
  nextFlagToRaise, personAt, poleAt, raiseFlag, ralliedCount, ralliedRatio,
} from './borrow.logic';

/** 与方案文档第 3 计的关卡一模一样：大石 (500,1000,120,weight 40)，needed 30 */
const level = BorrowLevelSchema.parse({
  mode: 'force',
  load: { x: 500, y: 1000, radius: 120, weight: 40 },
  props: [
    { id: 'self', kind: 'self', x: 220, y: 1120, radius: 80, power: 1 },
    { id: 'fulcrum', kind: 'fulcrum', x: 430, y: 1150, radius: 76, power: 0 },
    { id: 'stick', kind: 'source', x: 300, y: 900, radius: 76, power: 12 },
    { id: 'wheel', kind: 'source', x: 620, y: 820, radius: 86, power: 18 },
    { id: 'ox', kind: 'source', x: 680, y: 1080, radius: 86, power: 14 },
  ],
  needed: 30,
  hint: '别硬推，借杠杆的力',
});

function connectAll(ids: string[]) {
  let state = borrowStart();
  for (const id of ids) state = connectProp(level, state, id);
  return state;
}

describe('借刀杀人 · 借力', () => {
  it('自己的力气小得可怜：光靠自己永远抬不动', () => {
    expect(selfPower(level)).toBe(1);
    expect(selfPower(level)).toBeLessThan(level.needed);
    const state = connectAll(['self']);
    expect(totalPower(level, state.connected)).toBe(1);
    expect(canLift(level, state.connected)).toBe(false);
    expect(pull(level, state).result).toBe('stuck');
  });

  it('缺支点抬不动：木棍加水车够 30，可没有垫脚的地方', () => {
    const state = connectAll(['stick', 'wheel']);
    expect(totalPower(level, state.connected)).toBe(30);
    expect(hasFulcrum(level, state.connected)).toBe(false);
    expect(canLift(level, state.connected)).toBe(false);
    expect(isLifted(level, state.connected)).toBe(false);
    expect(pull(level, state).result).toBe('stuck');
  });

  it('木棍 + 水车（30）抬得动 —— 前提是垫上了支点', () => {
    const state = connectAll(['fulcrum', 'stick', 'wheel']);
    expect(totalPower(level, state.connected)).toBe(30);
    expect(canLift(level, state.connected)).toBe(true);
    expect(isLifted(level, state.connected)).toBe(true);
    const pulled = pull(level, state);
    expect(pulled.result).toBe('lifted');
    expect(isBorrowDone(level, pulled.state)).toBe(true);
  });

  it('解开绳子会掉回去：30 变成 12，石头落回地上', () => {
    const lifted = pull(level, connectAll(['fulcrum', 'stick', 'wheel'])).state;
    expect(isBorrowDone(level, lifted)).toBe(true);
    const untied = disconnectProp(level, lifted, 'wheel');
    expect(totalPower(level, untied.connected)).toBe(12);
    expect(isLifted(level, untied.connected)).toBe(false);
    expect(isBorrowDone(level, untied)).toBe(false);
  });

  it('重复连同一件不算两份力', () => {
    const once = connectAll(['fulcrum', 'stick']);
    const twice = connectProp(level, once, 'stick');
    expect(twice).toBe(once);
    expect(twice.connected).toEqual(['fulcrum', 'stick']);
    expect(totalPower(level, twice.connected)).toBe(12);
  });

  it('不认识的东西连不上、没连过的解不开（都返回原来那份状态）', () => {
    const state = connectAll(['stick']);
    expect(connectProp(level, state, 'nowhere')).toBe(state);
    expect(disconnectProp(level, state, 'ox')).toBe(state);
    expect(totalPower(level, state.connected)).toBe(12);
    // 没连进来的 id 不算力
    expect(totalPower(level, ['stick', 'nowhere'])).toBe(12);
  });

  it('零惩罚：纹丝不动点多少次都行，借对了力照样抬得起来', () => {
    let state = connectAll(['self']);
    for (let i = 0; i < 10; i += 1) {
      const pulled = pull(level, state);
      expect(pulled.result).toBe('stuck');
      state = pulled.state;
    }
    expect(state.tries).toBe(10);
    state = connectProp(level, state, 'fulcrum');
    state = connectProp(level, state, 'stick');
    state = connectProp(level, state, 'wheel');
    expect(pull(level, state).result).toBe('lifted');
  });

  it('三件力源全借来也够（44 ≥ 30）', () => {
    const state = connectAll(['fulcrum', 'stick', 'wheel', 'ox']);
    expect(totalPower(level, state.connected)).toBe(44);
    expect(canLift(level, state.connected)).toBe(true);
  });

  it('该连什么：先垫支点，再加力源，够了就停', () => {
    expect(suggestedConnections(level)).toEqual(['fulcrum', 'stick', 'wheel']);
    expect(nextPropToConnect(level, [])?.id).toBe('fulcrum');
    expect(nextPropToConnect(level, ['fulcrum'])?.id).toBe('stick');
    expect(nextPropToConnect(level, ['fulcrum', 'stick'])?.id).toBe('wheel');
    expect(nextPropToConnect(level, ['fulcrum', 'stick', 'wheel'])).toBeUndefined();
  });

  it('命中判定：手指落在哪一件上', () => {
    expect(propAt(620, 820, level, 56)?.id).toBe('wheel');
    expect(propAt(620, 820, level, 0)?.id).toBe('wheel');
    expect(propAt(375, 700, level, 20)).toBeNull();
  });
});

/** 第 14 计借尸还魂的关卡：中央一根旗杆，三面旗 rally 2 / 3 / 4，六个散人，needed 6 */
const bannerLevel = BorrowBannerLevelSchema.parse({
  mode: 'banner',
  pole: { x: 375, y: 560, radius: 140 },
  flags: [
    { id: 'torn', x: 120, y: 1090, radius: 92, rally: 2 },
    { id: 'red', x: 375, y: 1130, radius: 92, rally: 4 },
    { id: 'long', x: 630, y: 1090, radius: 92, rally: 3 },
  ],
  scattered: [
    { id: 'p1', x: 90, y: 660, radius: 54 },
    { id: 'p2', x: 250, y: 800, radius: 54 },
    { id: 'p3', x: 500, y: 790, radius: 54 },
    { id: 'p4', x: 665, y: 640, radius: 54 },
    { id: 'p5', x: 170, y: 930, radius: 54 },
    { id: 'p6', x: 600, y: 930, radius: 54 },
  ],
  needed: 6,
  hint: '把旧旗竖起来，人自己会回来',
});

describe('借尸还魂 · 借名号（banner）', () => {
  it('开局：一面旗都没竖，一个人都还没回来', () => {
    const state = bannerStart(bannerLevel);
    expect(state.raised).toEqual([]);
    expect(state.rallied).toEqual([]);
    expect(ralliedCount(state)).toBe(0);
    expect(ralliedRatio(bannerLevel, state)).toBe(0);
    expect(isBannerDone(bannerLevel, state)).toBe(false);
    expect(availableFlags(bannerLevel, state).map((f) => f.id)).toEqual(['torn', 'red', 'long']);
  });

  it('竖一面 rally 2 的旗：前两个还没回来的人自己归队，人数数得清', () => {
    const result = raiseFlag(bannerLevel, bannerStart(bannerLevel), 'torn');
    expect(result.flag?.id).toBe('torn');
    expect(result.rallied).toBe(2);
    expect(result.state.raised).toEqual(['torn']);
    expect(result.state.rallied).toEqual(['p1', 'p2']);
    expect(isFlagRaised(result.state, 'torn')).toBe(true);
    expect(isPersonRallied(result.state, 'p1')).toBe(true);
    expect(isPersonRallied(result.state, 'p3')).toBe(false);
    // 2 < 6：还没够，接着换一面旗
    expect(isBannerDone(bannerLevel, result.state)).toBe(false);
    expect(availableFlags(bannerLevel, result.state).map((f) => f.id)).toEqual(['red', 'long']);
  });

  it('牌面 2 + 4：竖两面正好凑够六个人', () => {
    const first = raiseFlag(bannerLevel, bannerStart(bannerLevel), 'torn');
    const second = raiseFlag(bannerLevel, first.state, 'red');
    expect(second.rallied).toBe(4);
    expect(ralliedCount(second.state)).toBe(6);
    expect(isBannerDone(bannerLevel, second.state)).toBe(true);
    expect(ralliedRatio(bannerLevel, second.state)).toBe(1);
  });

  it('牌面 3 + 4 也成：召回的总是"还没回来的"那些人', () => {
    const first = raiseFlag(bannerLevel, bannerStart(bannerLevel), 'red');
    const second = raiseFlag(bannerLevel, first.state, 'long');
    expect(first.state.rallied).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(second.state.rallied).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(second.rallied).toBe(2); // 只剩两个人没回来了，rally 3 也只召回两个
    expect(isBannerDone(bannerLevel, second.state)).toBe(true);
  });

  it('每面旗只能用一次：同一面插两次不改账本，不认识的名字也一样', () => {
    const once = raiseFlag(bannerLevel, bannerStart(bannerLevel), 'red');
    const twice = raiseFlag(bannerLevel, once.state, 'red');
    expect(twice.state).toBe(once.state);
    expect(twice.rallied).toBe(0);
    expect(twice.flag).toBeNull();
    const stranger = raiseFlag(bannerLevel, once.state, 'nowhere');
    expect(stranger.state).toBe(once.state);
    expect(stranger.flag).toBeNull();
    expect(ralliedCount(once.state)).toBe(4);
  });

  it('零惩罚：召不够就换一面接着竖，三面全竖上一定够；人不会重复计数', () => {
    let state = bannerStart(bannerLevel);
    for (const id of ['torn', 'red', 'long']) {
      state = raiseFlag(bannerLevel, state, id).state;
    }
    expect(state.raised).toEqual(['torn', 'red', 'long']);
    // 2 + 4 + 3 = 9，可散在外面只有 6 个 —— 封顶在人头上
    expect(ralliedCount(state)).toBe(bannerLevel.scattered.length);
    expect(ralliedCount(state)).toBe(6);
    expect(isBannerDone(bannerLevel, state)).toBe(true);
    expect(availableFlags(bannerLevel, state)).toEqual([]);
  });

  it('该竖哪面旗：挑还在的、rally 最大的那一面；够了就不再指', () => {
    const start = bannerStart(bannerLevel);
    expect(nextFlagToRaise(bannerLevel, start)?.id).toBe('red');
    const afterRed = raiseFlag(bannerLevel, start, 'red').state;
    expect(nextFlagToRaise(bannerLevel, afterRed)?.id).toBe('long');
    const afterLong = raiseFlag(bannerLevel, afterRed, 'long').state;
    expect(isBannerDone(bannerLevel, afterLong)).toBe(true);
    expect(nextFlagToRaise(bannerLevel, afterLong)).toBeUndefined();
  });

  it('命中判定：手指落在哪面旗 / 哪个散人上，拖到旗杆上算不算数', () => {
    expect(flagAt(120, 1090, bannerLevel, 46)?.id).toBe('torn');
    expect(flagAt(630, 1090, bannerLevel, 46)?.id).toBe('long');
    expect(flagAt(375, 560, bannerLevel, 46)).toBeNull(); // 旗杆上没插旗
    expect(flagAt(375, 700, bannerLevel, 46)).toBeNull();
    expect(personAt(90, 660, bannerLevel, 46)?.id).toBe('p1');
    expect(personAt(665, 640, bannerLevel, 46)?.id).toBe('p4');
    expect(personAt(375, 560, bannerLevel, 46)).toBeNull();
    expect(poleAt(bannerLevel, 375, 560)).toBe(true);
    expect(poleAt(bannerLevel, 375, 560 + 140, 72)).toBe(true); // 圆边上再加宽容度
    expect(poleAt(bannerLevel, 375, 560 + 140 + 73, 72)).toBe(false);
  });

  it('无头验证的那条路：一面一面挑最大的竖，两面就走完（4 + 3 ≥ 6）', () => {
    let state = bannerStart(bannerLevel);
    const plan: string[] = [];
    while (!isBannerDone(bannerLevel, state)) {
      const flag = nextFlagToRaise(bannerLevel, state);
      expect(flag).toBeDefined();
      state = raiseFlag(bannerLevel, state, flag!.id).state;
      plan.push(flag!.id);
      expect(plan.length).toBeLessThanOrEqual(bannerLevel.flags.length); // 一定停得下来
    }
    expect(plan).toEqual(['red', 'long']);
    expect(ralliedCount(state)).toBeGreaterThanOrEqual(bannerLevel.needed);
  });

  it('内容写错在构建期就报错：旗加起来不够 / 要的人比散在外面的还多 / id 重复', () => {
    expect(BorrowBannerLevelSchema.safeParse({
      mode: 'banner',
      pole: { x: 375, y: 560, radius: 140 },
      flags: [{ id: 'torn', x: 120, y: 1090, radius: 92, rally: 1 }],
      scattered: [{ id: 'p1', x: 90, y: 660, radius: 54 }],
      needed: 1,
      hint: '把旧旗竖起来',
    }).success).toBe(false); // 只有一面旗（min 2）
    const base = {
      mode: 'banner',
      pole: { x: 375, y: 560, radius: 140 },
      flags: [
        { id: 'torn', x: 120, y: 1090, radius: 92, rally: 2 },
        { id: 'red', x: 375, y: 1130, radius: 92, rally: 4 },
      ],
      scattered: [
        { id: 'p1', x: 90, y: 660, radius: 54 },
        { id: 'p2', x: 250, y: 800, radius: 54 },
        { id: 'p3', x: 500, y: 790, radius: 54 },
      ],
      needed: 3,
      hint: '把旧旗竖起来',
    };
    expect(BorrowBannerLevelSchema.safeParse(base).success).toBe(true);
    expect(BorrowBannerLevelSchema.safeParse({ ...base, needed: 4 }).success).toBe(false);
    expect(BorrowBannerLevelSchema.safeParse({
      ...base,
      flags: [{ id: 'torn', x: 120, y: 1090, radius: 92, rally: 1 }, { id: 'torn', x: 375, y: 1130, radius: 92, rally: 1 }],
    }).success).toBe(false);
  });
});
