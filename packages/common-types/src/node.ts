/**
 * ノードの役割を定義する型
 * - DAY: 日程（例：1日目）
 * - SPOT: 具体的な場所・行動
 * - PROCESS: 移動や手続きなど
 */
export type NodeType = 'DAY' | 'PROCESS' | 'SPOT';

/**
 * 時間指定の種類
 * - NONE: 時間指定なし
 * - POINT: 点の時間（開始のみ）
 * - RANGE: 範囲の時間（開始と終了、または開始と所要時間）
 */
export type TimeType = 'NONE' | 'POINT' | 'RANGE';

/**
 * Yjsに保存されるNodeデータのインターフェース
 * フラットなMap構造で管理されるため、parentIdで階層を表現します。
 */
export interface PlanNode {
  // システム識別用
  id: string;          // UUID (例: "550e8400-e29b...")
  parentId: string | null; // ルート要素の場合はnull

  // 基本プロパティ
  type: NodeType;
  name: string;        // 名称
  displayOrder: number; // 同一親内での並び順 (1000, 2000...のように間隔を空けるのがコツ)

  // 詳細プロパティ (オプション)
  description?: string; // メモ
  
  // 時間管理
  timeType: TimeType;
  startTime?: string;   // ISO 8601形式 (例: "2025-11-25T10:00:00Z")
  endTime?: string;     // ISO 8601形式
  duration?: number;    // 分単位
  
  // 場所情報
  locationId?: string;  // Locationデータへの参照
}