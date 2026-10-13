import { describe, expect, it } from 'vitest';
import { LOCALES, createTranslator, localeFromSearch, messages } from './index';
import type { MessageKey } from './messages';

describe('界面文案表', () => {
  it('每种语言都有全部键，且没有空串', () => {
    const baseKeys = Object.keys(messages['zh-CN']) as MessageKey[];
    for (const locale of LOCALES) {
      const table = messages[locale];
      for (const key of baseKeys) {
        expect(table[key], locale + ' 缺少 ' + key).toBeTruthy();
        expect(String(table[key]).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('中英文案确实不同（防止复制粘贴漏翻译）', () => {
    const baseKeys = Object.keys(messages['zh-CN']) as MessageKey[];
    const identical = baseKeys.filter(
      (key) => (messages['zh-CN'][key] as string) === (messages.en[key] as string),
    );
    expect(identical).toEqual([]);
  });

  it('取词器按语言返回，未知语言回落到中文', () => {
    expect(createTranslator('zh-CN')('hall.start')).toBe('开始玩');
    expect(createTranslator('en')('hall.start')).toBe('Play');
  });

  it('从 ?lang= 解析语言', () => {
    expect(localeFromSearch('?lang=en')).toBe('en');
    expect(localeFromSearch('?lang=en-US')).toBe('en');
    expect(localeFromSearch('?lang=zh-TW')).toBe('zh-CN');
    expect(localeFromSearch('?foo=1')).toBeNull();
    expect(localeFromSearch('')).toBeNull();
  });
});
