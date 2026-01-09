// src/services/routeService.ts
import axios from 'axios';
import { LatLng, RouteSegment, TravelMode, GoogleRouteResponse } from '../types/route';

const GOOGLE_ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export const routeService = {
  /**
   * 複数の地点間のルートを計算する
   * 例: [A, B, C] が渡されたら、[A->B, B->C] の2つの区間データを返す
   */
  async calculateRoutes(locations: LatLng[], mode: TravelMode = 'DRIVE'): Promise<RouteSegment[]> {
    const apiKey = '';
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not configured');

    // 計算リクエストのPromise配列を作成
    const promises = [];

    // 地点数-1 回のループ（区間の数だけ回す）
    for (let i = 0; i < locations.length - 1; i++) {
      const origin = locations[i];
      const destination = locations[i + 1];

      // 個別の非同期関数として定義して、すぐに実行・配列に追加
      const requestPromise = (async (): Promise<RouteSegment | null> => {
        try {
          const response = await axios.post<GoogleRouteResponse>(
            GOOGLE_ROUTES_API_URL,
            {
              origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
              destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
              travelMode: mode,
              // ルーティングの詳細設定（必要に応じて）
              routingPreference: 'TRAFFIC_UNAWARE', // 渋滞考慮しない
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                // 欲しいフィールドだけ指定
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
              },
            }
          );

          const route = response.data.routes?.[0];
          if (!route) {
            console.warn(`Route not found between index ${i} and ${i + 1}`);
            return null;
          }

          // "123s" -> 123 (number) に変換
          const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

          return {
            fromIndex: i,
            toIndex: i + 1,
            durationSeconds: isNaN(durationSeconds) ? 0 : durationSeconds,
            distanceMeters: route.distanceMeters,
            encodedPolyline: route.polyline?.encodedPolyline,
          };
        } catch (error) {
          console.error(`Error calculating route segment ${i} -> ${i + 1}:`, error);
          return null;
        }
      })();

      promises.push(requestPromise);
    }

    const results = await Promise.all(promises);

    // null（エラーやルートなし）を除外して返す
    return results.filter((r): r is RouteSegment => r !== null);
  },
};