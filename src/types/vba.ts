/**
 * VBAおよびPython相互変換関連の型定義
 */

export interface ConversionResult {
  /** 変換後コード文字列 */
  code: string;
  /** 元言語の行番号 (1-indexed) から 変換先言語の行番号 (1-indexed) へのマッピング */
  lineMap: Record<number, number>;
  /** 変換警告またはエラーメッセージ一覧 */
  warnings?: string[];
  /** 変換エラーが発生した場合のエラー情報 */
  error?: string;
}

export interface VbaConverterOptions {
  /** インデント文字（デフォルト: 空白4文字） */
  indent?: string;
  /** 出力関数として MsgBox を使用するか（デフォルト: true） */
  useMsgBox?: boolean;
}
