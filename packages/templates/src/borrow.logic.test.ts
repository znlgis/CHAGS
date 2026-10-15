import { describe, expect, it } from 'vitest';
import { BorrowLevelSchema } from './schemas';
import {
  borrowStart, canLift, connectProp, disconnectProp, hasFulcrum, isBorrowDone, isLifted,
  nextPropToConnect, propAt, pull, selfPower, suggestedConnections, totalPower,
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
