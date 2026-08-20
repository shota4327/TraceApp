import type * as monaco from 'monaco-editor';
import { language as vbLanguage, conf as vbConf } from 'monaco-editor/esm/vs/basic-languages/vb/vb';

/**
 * VBA (マクロ言語) 用の LanguageConfiguration
 * 記号括弧 ( {}, [], () ) のみをブラケットとし、キーワードによるブロック色分けは行わない
 */
export const vbaConfiguration: monaco.languages.LanguageConfiguration = {
  ...vbConf,
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
};

/**
 * VBA (マクロ言語) 用の Monarch 言語定義
 * すべての制御文・構文キーワード（If, Then, ElseIf, Else, End If, For, Next, Do, While, Loop, Sub, Function, MsgBox 等）を
 * 統一されたキーワード色（青色）としてハイライト表示する。
 */
export const vbaLanguage: monaco.languages.IMonarchLanguage = {
  ...vbLanguage,
  tagwords: [],
  brackets: [
    { token: 'delimiter.bracket', open: '{', close: '}' },
    { token: 'delimiter.array', open: '[', close: ']' },
    { token: 'delimiter.parenthesis', open: '(', close: ')' },
  ],
  keywords: [
    ...(vbLanguage.keywords || []),
    'MsgBox',
    'msgbox',
    'InputBox',
    'inputbox',
  ],
  tokenizer: {
    ...vbLanguage.tokenizer,
    root: [
      { include: '@whitespace' },
      // End If / End Sub / End Function 等の End 構文も通常の keyword (青色) として認識
      [/end\s+[a-zA-Z_]\w*/i, 'keyword'],
      // 識別子およびキーワード（すべて青色の keyword として認識）
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      // プリプロセッサディレクティブ
      [/^\s*#\w+/, 'keyword'],
      // 数値リテラル
      [/\d*\d+e([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/\d*\.\d+(e[\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/&H[0-9a-f]+(@integersuffix)/, 'number.hex'],
      [/&0[0-7]+(@integersuffix)/, 'number.octal'],
      [/\d+(@integersuffix)/, 'number'],
      // 日付リテラル
      [/#.*#/, 'number'],
      // 括弧・区切り記号
      [/[{}()\[\]]/, '@brackets'],
      [/@symbols/, 'delimiter'],
      // 文字列リテラル
      [/["\u201c\u201d]/, { token: 'string.quote', next: '@string' }],
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
