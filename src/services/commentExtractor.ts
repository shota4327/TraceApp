/**
 * コメント抽出・構文解析ユーティリティモジュール
 * 文字列リテラル内の # を保護しながら、行末コメントを抽出・一元管理します。
 */

/** 分離されたコード部分とコメント情報 */
export interface SplitCommentResult {
  /** コメントを除去した純粋なコード部分 */
  codePart: string;
  /** 抽出された行末コメント文字列（# は含まない） */
  comment?: string;
}

/**
 * 1行の文字列からコード部分と末尾コメント（# ...）を分離
 * （シングル/ダブルクォート内の # は文字列の一部として保護）
 * 
 * @param lineText 1行分のPythonコード文字列
 * @returns コード部分とコメントのオブジェクト
 */
export function splitLineComment(lineText: string): SplitCommentResult {
  let inSingle = false;
  let inDouble = false;
  let escapeNext = false;
  let commentIndex = -1;

  for (let i = 0; i < lineText.length; i++) {
    const char = lineText[i]!;
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === '#' && !inSingle && !inDouble) {
      commentIndex = i;
      break;
    }
  }

  if (commentIndex >= 0) {
    const codePart = lineText.slice(0, commentIndex).trim();
    const rawComment = lineText.slice(commentIndex + 1).trim();
    return { codePart, comment: rawComment || undefined };
  }
  return { codePart: lineText.trim() };
}

/**
 * Pythonコード全体から行番号（1始まり）をキーとするコメント辞書を一括抽出
 * 
 * @param code Pythonコード文字列全体
 * @returns 行番号ごとのコメントマップ（例: { 1: "(ア)", 4: "合計計算" }）
 */
export function extractLineComments(code: string): Record<number, string> {
  const lines = code.split('\n');
  const comments: Record<number, string> = {};

  lines.forEach((lineText, idx) => {
    const { comment } = splitLineComment(lineText);
    if (comment) {
      comments[idx + 1] = comment;
    }
  });

  return comments;
}
