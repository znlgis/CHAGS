import { getAllusion } from '@chags/content';
import { createSessionState } from '@chags/templates/session';
import { describe, expect, it } from 'vitest';
import { balanceLevel, gradeOfRun } from './logic';

describe('曹冲称象', () => {
  it('内容里的关卡脚本能通过模板 schema', () => {
    const raw = getAllusion('caochong-elephant');
    expect(raw).toBeTruthy();
    const level = balanceLevel(raw?.game.levelScript);
    expect(level.targetWeight).toBe(3000);
    expect(level.capacity).toBe(3600);
    expect(level.stones.length).toBe(3);
  });

  it('模板 schema 会拒绝坏关卡（目标重量超过载重上限）', () => {
    const raw = getAllusion('caochong-elephant');
    const broken = { ...(raw?.game.levelScript as object), targetWeight: 99999 };
    expect(() => balanceLevel(broken)).toThrow();
  });

  it('全对得 3 级，错多了降级', () => {
    const session = createSessionState(0);
    session.correct = 3;
    session.total = 3;
    expect(gradeOfRun(session)).toBe(3);
    session.correct = 2;
    expect(gradeOfRun(session)).toBe(2);
    session.correct = 1;
    expect(gradeOfRun(session)).toBe(1);
    session.correct = 0;
    expect(gradeOfRun(session)).toBe(0);
  });
});
