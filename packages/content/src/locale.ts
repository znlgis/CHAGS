/** 全项目共用的语言标识。放在最底层，谁都能引用而不产生循环依赖。 */
export const LOCALES = ['zh-CN', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** 语音合成用的 BCP-47 标签 */
export function speechLang(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'zh-CN';
}
