/**
 * 流れ図ノード種別型
 * - terminal: 端子（開始・終了）
 * - process: 処理（代入・演算等）
 * - decision: 判断（if/elif等）
 * - loop: 繰り返し（while/for等）
 * - subroutine: サブルーチン（関数定義・呼び出し）
 */
export type FlowchartNodeType =
  | 'terminal'
  | 'process'
  | 'decision'
  | 'loop'
  | 'subroutine';

/**
 * 流れ図エッジ（接続線）のラベル型
 */
export type FlowchartEdgeLabel = 'True' | 'False' | 'Loop' | 'Next' | 'Yes' | 'No';

/**
 * 流れ図エッジ（接続線）構造体
 */
export interface FlowchartEdge {
  /** エッジ固有識別子 */
  id: string;
  /** 接続元ノードID */
  sourceId: string;
  /** 接続先ノードID */
  targetId: string;
  /** エッジの表示ラベル ('True' | 'False' | 'Loop' | 'Next') */
  label?: FlowchartEdgeLabel;
  /** draw.io mxGraph 用スタイル文字列 */
  style?: string;
}

/**
 * 流れ図ノード構造体
 */
export interface FlowchartNode {
  /** ノード固有識別子 */
  id: string;
  /** ノード種別 */
  type: FlowchartNodeType;
  /** 表示テキストラベル */
  label: string;
  /** 対応するソースコード行範囲 [開始行, 終了行] */
  lineRange?: [number, number];
  /** 描画用 X 座標 */
  x?: number;
  /** 描画用 Y 座標 */
  y?: number;
  /** 描画用 幅 */
  width?: number;
  /** 描画用 高さ */
  height?: number;
  /** 子ノード配列 */
  children?: FlowchartNode[];
  /** ノードに関連付けられたエッジ配列 */
  edges?: FlowchartEdge[];
  /** 関数の端子または返り値あり呼び出し等の補助種別 */
  subType?: 'function-terminal' | 'function-call-return';
  /** draw.io mxGraph XMLスニペット */
  xmlSnippet?: string;
}

/**
 * 流れ図グラフ（CFG）構造体
 */
export interface FlowchartGraph {
  /** ノード一覧 */
  nodes: FlowchartNode[];
  /** エッジ一覧 */
  edges: FlowchartEdge[];
}

