import { describe, it, expect, vi } from 'vitest';
import { vbaLanguage, vbaConfiguration, registerVbaLanguage } from '../services/vbaLanguage';
import type * as monaco from 'monaco-editor';

describe('VBA Language Multi-word Bracket Pair Configuration', () => {
  it('registers "do while" and "do until" in configuration brackets', () => {
    const brackets = (vbaConfiguration.brackets || []) as Array<[string, string]>;
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'do while' && pair[1]?.toLowerCase() === 'loop')).toBe(true);
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'do until' && pair[1]?.toLowerCase() === 'loop')).toBe(true);
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'do' && pair[1]?.toLowerCase() === 'loop')).toBe(true);
    // while - end while は除外されていること
    expect(brackets.some((pair) => pair[0]?.toLowerCase() === 'while')).toBe(false);
  });

  it('registers "do while" and "do until" in language brackets', () => {
    const brackets = (vbaLanguage.brackets || []) as Array<{ token: string; open: string; close: string }>;
    expect(brackets.some((b) => b.open === 'do while' && b.close === 'loop' && b.token === 'keyword.tag-do')).toBe(true);
    expect(brackets.some((b) => b.open === 'do until' && b.close === 'loop' && b.token === 'keyword.tag-do')).toBe(true);
    expect(brackets.some((b) => b.open === 'do' && b.close === 'loop' && b.token === 'keyword.tag-do')).toBe(true);
  });

  it('tokenizes Do While as a single keyword.tag-do token', () => {
    const rootRules = (vbaLanguage as any).tokenizer.root as Array<[RegExp, any] | any>;
    const doWhileRule = rootRules.find(
      (rule) => Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].source.includes('do') && rule[0].source.includes('while')
    );
    expect(doWhileRule).toBeDefined();
    const [regex, token] = doWhileRule;
    expect(regex.test('Do While')).toBe(true);
    expect(regex.test('do while')).toBe(true);
    expect(token).toBe('keyword.tag-do');
  });

  it('registers both vba and vb languages', () => {
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
