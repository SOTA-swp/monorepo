import React, { useEffect, useMemo, useState } from 'react';
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { PlanLocation } from '@/features/editor/types/node';
import { FlatPlanNodeV2 } from '@/features/editor/utils/structureUtils';

interface PlanMapProps {
  //nodes: PlanNode[];
  nodes: FlatPlanNodeV2[];
  locationMap: Record<string, PlanLocation>;
}

// --- サブコンポーネント: ポリライン (線) ---
// Google Maps APIを直接操作して線を描画します
const Polyline = ({ path }: { path: google.maps.LatLngLiteral[] }) => {
  const map = useMap(); // 親のMapインスタンスを取得
  const mapsLib = useMapsLibrary('maps'); // Mapsライブラリを取得
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    // ポリラインインスタンスの作成
    const newPolyline = new mapsLib.Polyline({
      path,
      geodesic: true,
      strokeColor: '#FF0000', // 赤色
      strokeOpacity: 1.0,
      strokeWeight: 3,
      icons: [{ // 矢印をつける
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
        offset: '100%',
        repeat: '100px' // 一定間隔で矢印を表示
      }],
    });

    newPolyline.setMap(map);
    setPolyline(newPolyline);

    return () => {
      newPolyline.setMap(null); // クリーンアップ
    };
  }, [map, mapsLib]);

  // パスが更新されたら線を書き換える
  useEffect(() => {
    if (polyline) {
      polyline.setPath(path);
    }
  }, [polyline, path]);

  return null; // 画面には何も出力しない（地図上に描画するため）
};

// --- メインコンポーネント: PlanMap ---
export const PlanMap = ({ nodes, locationMap }: PlanMapProps) => {

  // 1. ノードを訪問順に並べ替え、ロケーション情報を持つものだけを抽出する
  // ここで「論理的な経路データ」を作成します
  const routeCoordinates = useMemo(() => {

    return nodes
      .filter(node => node.locationId && locationMap[node.locationId])
      .map(node => {
        const loc = locationMap[node.locationId!];
        return {
          id: node.id,
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name
        };
      });

  }, [nodes, locationMap]);

  // 経路データから座標リスト（ポリライン用）を作成
  const path = routeCoordinates.map(c => ({ lat: c.lat, lng: c.lng }));

  // 初回表示時の中心座標（デフォルトは東京）
  const defaultCenter = { lat: 35.6895, lng: 139.6917 };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={10}
        gestureHandling={'greedy'} // スクロールで地図拡大などを許可
        disableDefaultUI={false}   // ズームコントロールなどを表示
        mapId={null}               // AdvancedMarkerを使わないのでnullでOK
      >
        {/* A. マーカーの描画 */}
        {routeCoordinates.map((point, index) => (
          <Marker
            key={point.id}
            position={{ lat: point.lat, lng: point.lng }}
            label={{
              text: String(index + 1), // 訪問順の番号を表示
              color: 'white',
              fontWeight: 'bold'
            }}
            title={point.name} // ホバー時に名前表示
          />
        ))}

        {/* B. 経路（線）の描画 */}
        <Polyline path={path} />
      </Map>
    </div>
  );
};