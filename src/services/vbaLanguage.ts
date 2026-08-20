import type * as monaco from 'monaco-editor';
import { language as vbLanguage, conf as vbConf } from 'monaco-editor/esm/vs/basic-languages/vb/vb';

/**
 * VBA (マクロ言語) 用の LanguageConfiguration
 * `End While` を要求して赤字エラーの原因となる `while` のブラケット設定を除外し、
 * `Do While ... Loop` および `Do Until ... Loop` をブラケットペアとして登録
 */
export const vbaConfiguration: monaco.languages.LanguageConfiguration = {
  ...vbConf,
  brackets: [
    ['do while', 'loop'],
    ['do until', 'loop'],
    ['do', 'loop'],
    ...(vbConf.brackets || []).filter(
      (pair) => !(Array.isArray(pair) && (pair[0]?.toLowerCase() === 'while' || pair[0]?.toLowerCase() === 'do'))
    ),
  ],
};

/**
 * VBA (マクロ言語) 用の Monarch 言語定義
 * `While` を tagwords (End While待ちタグ) から除外した上で、
 * `Do While` / `Do Until` / `Loop While` / `Loop Until` を 1つのブラケットトークン `keyword.tag-do` として認識させることで、
 * Sub関数内でのブラケットペア色（緑色等）や、Loop欠落時のエラー色（赤色）が常に `Do` と連動して同一色になるよう設定
 */
export const vbaLanguage: monaco.languages.IMonarchLanguage = {
  ...vbLanguage,
  tagwords: (vbLanguage.tagwords || []).filter((word: string) => word.toLowerCase() !== 'while'),
  brackets: [
    { token: 'keyword.tag-do', open: 'do while', close: 'loop' },
    { token: 'keyword.tag-do', open: 'do until', close: 'loop' },
    { token: 'keyword.tag-do', open: 'do', close: 'loop' },
    ...(vbLanguage.brackets || []).filter(
      (b: any) => !(b.open && (b.open.toLowerCase() === 'while' || b.open.toLowerCase() === 'do'))
    ),
  ],
  tokenizer: {
    ...vbLanguage.tokenizer,
    root: [
      // Do While / Do Until を一体の keyword.tag-do トークンとして認識
      [/\bdo\s+while\b/i, 'keyword.tag-do'],
      [/\bdo\s+until\b/i, 'keyword.tag-do'],
      [/\bloop\s+while\b/i, 'keyword.tag-do'],
      [/\bloop\s+until\b/i, 'keyword.tag-do'],
      ...(vbLanguage.tokenizer.root || []),
    ],
  },
};

/**
 * Monaco Editor インスタンスに VBA 言語定義を登録する
 */
export function registerVbaLanguage(monacoInstance: typeof monaco): void {
  if (!monacoInstance?.languages) return;

  const existingLangs = monacoInstance.languages.getLanguages().map((l) => l.id);
  if (!existingLangs.includes('vba')) {
    monacoInstance.languages.register({ id: 'vba', extensions: ['.vba', '.bas'] });
  }

  monacoInstance.languages.setMonarchTokensProvider('vba', vbaLanguage);
  monacoInstance.languages.setLanguageConfiguration('vba', vbaConfiguration);

  // 既存の vb 言語にも適用（キャッシュやデフォルト参照用）
  monacoInstance.languages.setMonarchTokensProvider('vb', vbaLanguage);
  monacoInstance.languages.setLanguageConfiguration('vb', vbaConfiguration);
}
