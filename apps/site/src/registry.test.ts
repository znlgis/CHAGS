import { allusions } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { registry } from './registry';

/**
 * 典故 id 一共出现在四个地方：内容 JSON、allusions/index.ts、这个注册表、以及 e2e 的遍历。
 * 新增第 8 个典故（或者手滑打错一个 id）时，以前是全绿 ——
 * 用户点进去才会看到"找不到这个典故"。
 */
describe('典故注册表', () => {
  it('内容里有几个典故，注册表里就要有几个', () => {
    expect(Object.keys(registry).sort()).toEqual(allusions.map((a) => a.id).sort());
  });

  it('注册表里的每个 id 都能对应到一份内容', () => {
    const ids = new Set(allusions.map((a) => a.id));
    for (const id of Object.keys(registry)) {
      expect(ids.has(id), id + ' 没有对应的内容 JSON').toBe(true);
    }
  });

  it('每个 id 都有懒加载入口（不是 undefined）', () => {
    for (const [id, load] of Object.entries(registry)) {
      expect(typeof load, id + ' 的加载函数不对').toBe('function');
    }
  });
});
