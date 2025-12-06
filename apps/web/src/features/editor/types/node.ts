export type NodeType = 'PROCESS' | 'SPOT' | 'MOVE';

export const PARENT_ID_ROOT = 'root';

export type TimeType = 'NONE' | 'POINT' | 'RANGE';

export interface PlanLocation {
  id: string;        // Google Place ID または UUID
  name: string;      // 場所の名前
  address?: string;  // 住所
  lat: number;       // 緯度
  lng: number;       // 経度
  placeId?: string;  // Google Maps Place ID
  thumbnail?: string;
  googleUrl?: string;
}

export interface PlanNodeData {
  id: string;
  type: NodeType;
  name: string;

  description?: string;

  locationId?: string;

  createdAt?: number;
  // 時間管理
  timeType?: TimeType;
  startTime?: string;   // ISO 8601形式 (例: "2025-11-25T10:00:00Z")
  endTime?: string;     // ISO 8601形式
  duration?: number;    // 分単位

  x?: number;
  y?: number;
}

/**
 * 構造データのイメージ (型定義としてはコードに出ないが、Yjs上の構造)
 * planStructure (Y.Map)
 * Key: ParentNodeId (ルートの場合は "root")
 * Value: Y.Array<string> (子ノードIDのリスト)
 */



// export interface PlanNode {
//   // システム識別用
//   id: string;          // UUID (例: "550e8400-e29b...")
//   parentId: string | null; // ルート要素の場合はnull

//   // 基本プロパティ
//   type: NodeType;
//   name: string;        // 名称
//   displayOrder: number; 

//   // 詳細プロパティ (オプション)
//   description?: string; // メモ
  
//   // 時間管理
//   timeType: TimeType;
//   startTime?: string;   // ISO 8601形式 (例: "2025-11-25T10:00:00Z")
//   endTime?: string;     // ISO 8601形式
//   duration?: number;    // 分単位
  
//   // 場所情報
//   locationId?: string;  // Locationデータへの参照

//   // --- [Idea Space View] 座標情報 ---
//   // ホワイトボード上での位置。
//   // タイムラインに組み込まれていない（候補）状態でも、この座標で表示されます。
//   x?: number;
//   y?: number;
// }

