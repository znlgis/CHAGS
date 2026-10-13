export interface ChagsDebugBridge {
  events: string[];
  last: string | null;
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
  const w = window;
  if (!w.__chags) w.__chags = { events: [], last: null };
  const entry = detail ? type + ':' + detail : type;
  w.__chags.events.push(entry);
  w.__chags.last = entry;
}
