import { ensurePatches } from '@chags/content';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { initialLocale } from './stores/locale';
import './style.css';

/**
 * 首屏之前先把当前语言的摘要译文加载好：
 * 英文补丁是懒加载的（约 9 KB gzip，中文用户不下载），
 * 但 ?lang=en 或上次选过英文时，必须在渲染前就位，否则会先闪一屏中文标题。
 */
void ensurePatches(initialLocale()).then(() => {
  createApp(App).use(createPinia()).mount('#app');
});
