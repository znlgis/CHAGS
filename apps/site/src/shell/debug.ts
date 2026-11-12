export interface ChagsDebugBridge {
  events: string[];
  last: string | null;
  /** 最近一次载入失败的技术详情（玩家看到的是人话，这一份留给开发与自动化） */
  lastError?: string;
}

declare global {
  interface Window {
    __chags?: ChagsDebugBridge;
  }
}

/**
 * 给自动化测试与 AI 协作用的观测窗口：游戏不动任何生产逻辑，
 * 外壳只是把事件序列暴露出来。生产环境同样开着，因为它不采集个人信息。
 */
export function recordDebugEvent(type: string, detail?: string): void {
  // Toy 发布形态不留调试桥：审核会把「挂到 window 上的全局对象」当成后门来读，
  // 而它只在自动化测试里有意义（见 apps/site/src/shell/debug.ts 顶部说明）。
  if (import.meta.env.VITE_TOY === '1') return;
  const w = window;
  if (!w.__chags) w.__chags = { events: [], last: null };
  const entry = detail ? type + ':' + detail : type;
  w.__chags.events.push(entry);
  w.__chags.last = entry;
}