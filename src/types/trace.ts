import { FlowchartNode, FlowchartEdge } from './flowchart';

/**
 * 変数スナップショット型
 * 変数名をキーとし、基本型 (int, float, str, bool) または特殊表現の値を保持するマップ
 */
export interface VariableSnapshot {
  [varName: string]: any;
}

/**
 * ステップスナップショット型
 * 1ステップごとの実行行番号、各種変数スコープ、標準出力を保持
 */
export interface StepSnapshot {
  /** ステップインデックス（0始まりの連番） */
  stepIndex: number;
  /** 実行中のPythonコード行番号（1始まり） */
  line: number;
  /** トレースイベント（'line' | 'call' | 'return'） */
  event: 'line' | 'call' | 'return';
  /** 関数実行中の場合の関数名 */
  functionName?: string;
  /** グローバル変数のスナップショット */
  globals: VariableSnapshot;
  /** ローカル変数のスナップショット */
  locals: VariableSnapshot;
  /** 本ステップで変更・追加された変数名一覧 */
  changedVars: string[];
  /** 本ステップで出力された標準出力の差分 */
  stdoutDelta: string;
  /** ここまでの累積標準出力 */
  stdoutCumulative: string;
  /** 対応する流れ図のASTノードID */
  astNodeId?: string;
}

/**
 * トレース全体実行結果型
 */
export interface TraceResult {
  /** 全ステップのスナップショット配列 */
  snapshots: StepSnapshot[];
  /** 総ステップ数 */
  totalSteps: number;
  /** 全体の累積標準出力 */
  stdout: string;
  /** draw.io mxGraph XML形式データ */
  flowchartXml?: string;
  /** 流れ図ノード一覧 */
  flowchartNodes?: FlowchartNode[];
  /** 流れ図エッジ一覧 */
  flowchartEdges?: FlowchartEdge[];
  /** ステップ数上限超過等により途中で中断されたかのフラグ */
  truncated?: boolean;
  /** 上限超過時のエラー・警告メッセージ */
  error?: string;
}


