import { DEFAULT_LOCALE, LOCALES, createTranslator, localeFromSearch } from '@chags/i18n';
import type { Locale } from '@chags/i18n';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'chags.locale';

/** 优先级：URL 的 ?lang= > 上次选择 > 默认中文 */
function initialLocale(): Locale {
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

  apply(locale.value);

  function toggle(): void {
    apply(locale.value === 'en' ? 'zh-CN' : 'en');
  }

  return { locale, t, setLocale: apply, toggle };
});
