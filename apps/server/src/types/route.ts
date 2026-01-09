// src/types/route.ts

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TWO_WHEELER' | 'TRANSIT';

export interface RouteSegment {
  fromIndex: number;      // 出発地点の配列インデックス
  toIndex: number;        // 到着地点の配列インデックス
  durationSeconds: number; // 所要時間(秒)
  distanceMeters: number;  // 距離(メートル)
  encodedPolyline?: string; // 地図上に線を描くためのエンコードされた文字列
}

// Google APIからのレスポンス型
export interface GoogleRouteResponse {
  routes: Array<{
    distanceMeters: number;
    duration: string; // "3600s"
    polyline?: {
      encodedPolyline: string;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
}