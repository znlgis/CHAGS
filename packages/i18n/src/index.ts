import { DEFAULT_LOCALE, LOCALES } from '@chags/content';
import type { Locale } from '@chags/content';
import { messages } from './messages';
import type { MessageKey, Translator } from './messages';

export * from './messages';
export { LOCALES, DEFAULT_LOCALE };
export type { Locale };

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文',
  en: 'English',
};

/** 取词器；缺键时回落到中文，最后回落到键名本身（永不抛错、永不空白） */
export function createTranslator(locale: Locale): Translator {
  const table = messages[locale] ?? messages[DEFAULT_LOCALE];
  return (key: MessageKey): string => table[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
}

/** 从 URL 的 ?lang= 读语言，用于分享与自动化测试 */
export function localeFromSearch(search: string): Locale | null {
  const value = new URLSearchParams(search).get('lang');
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';
  return null;
}
