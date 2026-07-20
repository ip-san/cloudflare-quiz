/**
 * Diagram value objects - 解説に挿入される図解の純TypeScript型定義
 *
 * これらは domain 層の純粋な型で、Zod schema や validation には依存しない。
 * `infrastructure/validation/QuizValidator.ts` の Zod schemas は、
 * これらの型と構造的に一致するように定義されている（compile-time assertion で保証）。
 */

// ─── Building blocks ──────────────────────────────────────────────────────

export interface DiagramItem {
  text: string
  sub?: string | undefined
}

export interface ComparisonColumn {
  heading: string
  items: string[]
}

export interface TerminalLine {
  type: 'command' | 'prompt' | 'response' | 'info'
  text: string
}

export interface ConfigLine {
  text: string
  highlight?: boolean | undefined
}

export interface NetworkNode {
  id: string
  text: string
  sub?: string | undefined
}

export interface NetworkEdge {
  from: string
  to: string
  label?: string | undefined
  dashed?: boolean | undefined
}

export interface SequenceMessage {
  from: number
  to: number
  text: string
  dashed?: boolean | undefined
}

export interface SwimlaneSegment {
  start: number
  end: number
  text?: string | undefined
}

export interface SwimlaneLane {
  name: string
  segments: SwimlaneSegment[]
}

export interface VennSet {
  text: string
  items?: string[] | undefined
}

export interface TreeNode {
  text: string
  sub?: string | undefined
  children?: TreeNode[] | undefined
}

export interface FormulaComponent {
  text: string
  sub?: string | undefined
  highlight?: boolean | undefined
}

// ─── Diagram variants ────────────────────────────────────────────────────

export interface HierarchyDiagram {
  type: 'hierarchy'
  label?: string | undefined
  items: DiagramItem[]
}

export interface FlowDiagram {
  type: 'flow'
  label?: string | undefined
  steps: DiagramItem[]
}

export interface CycleDiagram {
  type: 'cycle'
  label?: string | undefined
  trigger?: string | undefined
  states: DiagramItem[]
}

export interface ComparisonDiagram {
  type: 'comparison'
  label?: string | undefined
  columns: ComparisonColumn[]
}

export interface TerminalDiagram {
  type: 'terminal'
  label?: string | undefined
  lines: TerminalLine[]
}

export interface ConfigDiagram {
  type: 'config'
  label?: string | undefined
  filepath: string
  lines: ConfigLine[]
}

export interface NetworkDiagram {
  type: 'network'
  label?: string | undefined
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

export interface SequenceDiagram {
  type: 'sequence'
  label?: string | undefined
  actors: string[]
  messages: SequenceMessage[]
}

export interface LayerDiagram {
  type: 'layer'
  label?: string | undefined
  layers: DiagramItem[]
}

export interface SwimlaneDiagram {
  type: 'swimlane'
  label?: string | undefined
  lanes: SwimlaneLane[]
  totalSteps?: number | undefined
}

export interface VennDiagram {
  type: 'venn'
  label?: string | undefined
  sets: VennSet[]
  intersectionLabel?: string | undefined
}

export interface MatrixDiagram {
  type: 'matrix'
  label?: string | undefined
  rowHeader?: string | undefined
  colHeader?: string | undefined
  rows: string[]
  cols: string[]
  cells: string[][]
}

export interface TreeDiagram {
  type: 'tree'
  label?: string | undefined
  root: TreeNode
}

export interface FormulaDiagram {
  type: 'formula'
  label?: string | undefined
  result: string
  components: FormulaComponent[]
  operator?: string | undefined
}

/** キーキャップ（1つの物理キー） */
export interface KeyCap {
  label: string
  /** 操作対象として強調するキー（修飾キーは false 想定） */
  highlight?: boolean | undefined
}

/** 同時押しするキーの組（例: Ctrl + C） */
export interface KeyCombo {
  keys: KeyCap[]
  /** この組が何をするか（例: 中断 / モード循環） */
  caption?: string | undefined
}

export interface KeyboardDiagram {
  type: 'keyboard'
  label?: string | undefined
  /** 1つ以上のキー組。sequence=true なら手順（連打/順次）、false/未指定なら同時押し1組または比較 */
  combos: KeyCombo[]
  /** true: combos を順番に押す手順として矢印で連結（例: Esc → Esc） */
  sequence?: boolean | undefined
  caption?: string | undefined
}

/**
 * diagram variants の discriminated union
 *
 * Quiz の `explanation` に挿入する図解データ。
 * `type` フィールドで variant を判別する。
 */
export type DiagramData =
  | HierarchyDiagram
  | FlowDiagram
  | CycleDiagram
  | ComparisonDiagram
  | TerminalDiagram
  | ConfigDiagram
  | NetworkDiagram
  | SequenceDiagram
  | LayerDiagram
  | SwimlaneDiagram
  | VennDiagram
  | MatrixDiagram
  | TreeDiagram
  | FormulaDiagram
  | KeyboardDiagram
