/**
 * ノードの役割を定義する型
 * - DAY: 日程（例：1日目）
 * - SPOT: 具体的な場所・行動
 * - PROCESS: 移動や手続きなど
 */
export type NodeType = 'PROCESS' | 'SPOT' | 'MOVE';

export const PARENT_ID_ROOT = 'root';

/**
 * 時間指定の種類
 * - NONE: 時間指定なし
 * - POINT: 点の時間（開始のみ）
 * - RANGE: 範囲の時間（開始と終了、または開始と所要時間）
 */
export type TimeType = 'NONE' | 'POINT' | 'RANGE';

export interface PlanLocation {
  id: string;        // Google Place ID または UUID
  name: string;      // 場所の名前
  address?: string;  // 住所
  lat: number;       // 緯度
  lng: number;       // 経度
  placeId?: string;  // Google Maps Place ID

  // 将来的な拡張
  thumbnail?: string;
  googleUrl?: string;
}

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

  // --- [Idea Space View] 座標情報 ---
  // ホワイトボード上での位置。
  // タイムラインに組み込まれていない（候補）状態でも、この座標で表示されます。
  x?: number;
  y?: number;
}