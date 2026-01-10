// src/routes/plan/route.ts
import { FastifyInstance } from 'fastify';
import { routeService } from '../../services/routeService';
import { LatLng, TravelMode } from '../../types/route';
import { ApiRoutes } from '../../../../../packages/api-contract/src';

// リクエストボディの型定義
interface CalculateRouteBody {
  locations: LatLng[];
  mode?: TravelMode;
}

export async function planRouteRoutes(server: FastifyInstance) {
  server.post<{ Body: CalculateRouteBody }>(
    ApiRoutes.routes.calculate,
    async (request, reply) => {
      const { locations, mode = 'DRIVE' } = request.body;

      // バリデーション
      if (!Array.isArray(locations) || locations.length < 2) {
        return reply.status(400).send({ 
          message: '計算には少なくとも2つの地点が必要です' 
        });
      }

      // 緯度経度が数値かどうかの簡易チェック
      const isValid = locations.every(
        (loc) => typeof loc.lat === 'number' && typeof loc.lng === 'number'
      );
      if (!isValid) {
        return reply.status(400).send({ 
          message: '緯度経度の形式が不正です' 
        });
      }

      try {
        // サービス呼び出し
        const results = await routeService.calculateRoutes(locations, mode);

        // レスポンス
        return reply.status(200).send(results);

      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ 
          message: 'ルート計算中にサーバーエラーが発生しました' 
        });
      }
    }
  );
}