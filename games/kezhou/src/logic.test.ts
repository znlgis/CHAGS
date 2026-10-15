import { getEntry } from '@chags/content';
import { surfaceWorldX } from '@chags/templates/mark.logic';
import { describe, expect, it } from 'vitest';
import { BOAT_X, ROCK_X, SWORD_X, TREE_X } from './layout';
import { markLevel } from './logic';

describe('刻舟求剑 · 关卡数据', () => {
  const raw = getEntry('kezhou');
  const level = markLevel(raw!);

  it('三个地方可以刻：船帮会漂，岸上的树和石头不会', () => {
    expect(level.surfaces.map((s) => s.id)).toEqual(['boat', 'tree', 'rock']);
    expect(level.surfaces.find((s) => s.id === 'boat')?.drifts).toBe(true);
    expect(level.surfaces.filter((s) => !s.drifts).length).toBe(2);
  });

  it('美术里的坐标和关卡数据必须一致 —— 否则画的和点的不是一个地方', () => {
    const boat = level.surfaces.find((s) => s.id === 'boat')!;
    const tree = level.surfaces.find((s) => s.id === 'tree')!;
    const rock = level.surfaces.find((s) => s.id === 'rock')!;
    expect(boat.x).toBe(BOAT_X);
    expect(tree.x).toBe(TREE_X);
    expect(rock.x).toBe(ROCK_X);
    expect(level.sword.x).toBe(SWORD_X);
  });

  it('船从剑落水的地方出发，漂到下游的石头边上', () => {
    const boat = level.surfaces.find((s) => s.id === 'boat')!;
    expect(surfaceWorldX(boat, 0)).toBe(SWORD_X);
    // 终点落在岸边那块石头附近（±60px）：孩子一眼能看出"船已经漂到下游了"。
    // 不写死具体像素 —— 漂多远是难度参数，会随难度调整。
    expect(Math.abs(surfaceWorldX(boat, level.driftDistance) - ROCK_X)).toBeLessThanOrEqual(60);
  });

  it('漂走的距离远大于捞剑的容差 —— 刻在船上一定捞空', () => {
    const boat = level.surfaces.find((s) => s.id === 'boat')!;
    expect(surfaceWorldX(boat, level.driftDistance) - level.sword.x).toBeGreaterThan(
      level.sword.radius * 2,
    );
  });

  it('故事两幕，第一幕是剑掉下去，第二幕是刻记号', () => {
    expect(raw?.story.length).toBe(2);
    expect(raw?.keyMoment.beatId).toBe('s2');
  });
});
