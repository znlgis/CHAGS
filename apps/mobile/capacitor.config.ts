import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 安卓壳：直接吃 apps/site 的构建产物。
 * 不配置 server.url —— 走 Capacitor 内置的本地服务（https://localhost），
 * 这样 ES module、IndexedDB、WebGL 全部按浏览器标准工作。
 */
const config: CapacitorConfig = {
  appId: 'com.chags.tales',
  appName: '历史典故游戏',
  webDir: '../site/dist',
  android: {
    backgroundColor: '#3a2f26',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
