import { ensurePatches } from '@chags/content';
import { DEFAULT_LOCALE, LOCALES, createTranslator, localeFromSearch } from '@chags/i18n';
import type { Locale } from '@chags/i18n';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'chags.locale';

/** 优先级：URL 的 ?lang= > 上次选择 > 默认中文 */
export function initialLocale(): Locale {
  const fromUrl = localeFromSearch(window.location.search);
  if (fromUrl) return fromUrl;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  return DEFAULT_LOCALE;
}

export const useLocale = defineStore('locale', () => {
  const locale = ref<Locale>(initialLocale());
  const t = computed(() => createTranslator(locale.value));

  function apply(next: Locale): void {
    locale.value = next;
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式下写不了也无所谓，本次会话仍然生效
    }
  }

  /**
   * 切语言：先把该语言的摘要译文加载好再切换（英文补丁是懒加载的，约 9 KB gzip；
   * 默认语言中文不需要补丁，立即生效）。加载失败就回落中文文案，不阻塞切换。
   */
  async function setLocale(next: Locale): Promise<void> {
    await ensurePatches(next);
    apply(next);
  }

  apply(locale.value);

  function toggle(): void {
    void setLocale(locale.value === 'en' ? 'zh-CN' : 'en');
  }

  return { locale, t, setLocale, toggle };
});
