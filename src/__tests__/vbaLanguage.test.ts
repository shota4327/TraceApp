import { describe, it, expect, vi } from 'vitest';
import { vbaLanguage, vbaConfiguration, registerVbaLanguage } from '../services/vbaLanguage';
import type * as monaco from 'monaco-editor';

describe('VBA Language Syntax Highlighting Configuration', () => {
  it('configures brackets with only standard parenthesis/bracket symbols', () => {
    const brackets = (vbaConfiguration.brackets || []) as Array<[string, string]>;
    expect(brackets.some((pair) => pair[0] === '(' && pair[1] === ')')).toBe(true);
    expect(brackets.some((pair) => pair[0] === '{' && pair[1] === '}')).toBe(true);
    expect(brackets.some((pair) => pair[0] === '[' && pair[1] === ']')).toBe(true);
    // 制御文のブラケットペアは除外されていること（すべて青色のキーワードにするため）
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'if')).toBe(false);
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'do')).toBe(false);
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'for')).toBe(false);
  });

  it('sets tagwords to empty array to eliminate unwanted tag-bracket colorization', () => {
    expect(vbaLanguage.tagwords).toEqual([]);
  });

  it('includes MsgBox in keywords and tokenizes End If / End Sub as keyword', () => {
    const keywords = (vbaLanguage.keywords || []) as string[];
    expect(keywords.some((k) => k.toLowerCase() === 'msgbox')).toBe(true);

    const rootRules = (vbaLanguage as any).tokenizer.root as Array<[RegExp, any] | any>;
    const endRule = rootRules.find(
      (rule) => Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].source.includes('end')
    );
    expect(endRule).toBeDefined();
    const [regex, token] = endRule;
    expect(regex.test('End If')).toBe(true);
    expect(regex.test('End Sub')).toBe(true);
    expect(regex.test('End Function')).toBe(true);
    expect(token).toBe('keyword');
  });

  it('registers both vba and vb languages in Monaco instance', () => {
    const registeredLangs: any[] = [];
    const mockMonaco = {
      languages: {
        getLanguages: vi.fn(() => registeredLangs),
        register: vi.fn((def) => registeredLangs.push(def)),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
      },
    } as unknown as typeof monaco;

    registerVbaLanguage(mockMonaco);

    expect(mockMonaco.languages.register).toHaveBeenCalledWith({ id: 'vba', extensions: ['.vba', '.bas'] });
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith('vba', vbaLanguage);
    expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalledWith('vba', vbaConfiguration);
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith('vb', vbaLanguage);
    expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalledWith('vb', vbaConfiguration);
  });
});
