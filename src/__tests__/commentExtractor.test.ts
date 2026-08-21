import { describe, it, expect } from 'vitest';
import { splitLineComment, extractLineComments } from '../services/commentExtractor';

describe('commentExtractor: コメント抽出ユーティリティの検証 (Issue #3)', () => {
  describe('splitLineComment', () => {
    it('通常の行末コメント（# ...）を分離できること', () => {
      const result = splitLineComment('a = a + 1 #(ア)');
      expect(result.codePart).toBe('a = a + 1');
      expect(result.comment).toBe('(ア)');
    });

    it('ハッシュタグとコメントの間にスペースがある場合でもトリムして抽出できること', () => {
      const result = splitLineComment('total = 0  #  初期値設定  ');
      expect(result.codePart).toBe('total = 0');
      expect(result.comment).toBe('初期値設定');
    });

    it('シングルクォート文字列内の # をコメントとして誤認しないこと', () => {
      const result = splitLineComment("msg = '# not a comment' # 本物のコメント");
      expect(result.codePart).toBe("msg = '# not a comment'");
      expect(result.comment).toBe('本物のコメント');
    });

    it('ダブルクォート文字列内の # をコメントとして誤認しないこと', () => {
      const result = splitLineComment('url = "https://example.com/#section"');
      expect(result.codePart).toBe('url = "https://example.com/#section"');
      expect(result.comment).toBeUndefined();
    });

    it('エスケープされたクォートを含む行でも正しく解析できること', () => {
      const result = splitLineComment('text = "He said \\"Hello\\" #1" # コメント');
      expect(result.codePart).toBe('text = "He said \\"Hello\\" #1"');
      expect(result.comment).toBe('コメント');
    });

    it('コメントがない行は元の文字列をそのままトリムして返却すること', () => {
      const result = splitLineComment('x = 10 + 20');
      expect(result.codePart).toBe('x = 10 + 20');
      expect(result.comment).toBeUndefined();
    });
  });

  describe('extractLineComments', () => {
    it('複数行のPythonコードから行番号ごとのコメントマップを正しく抽出すること', () => {
      const code = `a = 10 #(ア)
b = 20
total = a + b # (イ) 計算結果
print(total)`;

      const comments = extractLineComments(code);
      expect(comments).toEqual({
        1: '(ア)',
        3: '(イ) 計算結果',
      });
    });
  });
});
