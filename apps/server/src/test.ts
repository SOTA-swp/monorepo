// test-route.js

// サーバーのURL (ポートが違う場合は修正してください)
const SERVER_URL = 'http://localhost:4000/api/routes/calculate';

// テストデータ: 東京駅 -> スカイツリー
const payload = {
  mode: 'DRIVE',
  locations: [
    { lat: 35.681236, lng: 139.767125 }, // 東京駅
    { lat: 35.710063, lng: 139.8107 }, // スカイツリー
    { lat: 35.681236, lng: 139.767125 }, // 東京駅
    { lat: 35.710063, lng: 139.8107 }, // スカイツリー
    { lat: 35.681236, lng: 139.767125 }, // 東京駅
    { lat: 35.710063, lng: 139.8107 }, // スカイツリー
  ],
};

console.log('--- ルート計算テスト開始 ---');
console.log(`Target: ${SERVER_URL}`);
console.log('Payload:', JSON.stringify(payload, null, 2));

async function runTest() {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    console.log(`\n📡 Status Code: ${status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error Response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n✅ Response Data:');
    console.dir(data, { depth: null, colors: true });

    // 簡易チェック
    if (Array.isArray(data) && data.length > 0) {
      const segment = data[0];
      if (segment.durationSeconds > 0) {
        console.log(`\n🎉 テスト成功！`);
        console.log(`所要時間: ${Math.floor(segment.durationSeconds / 60)} 分`);
        console.log(`距離: ${segment.distanceMeters} メートル`);
      } else {
        console.warn('⚠️ データは返ってきましたが、時間が0秒です。');
      }
    } else {
      console.warn('⚠️ データが空です。APIキーや課金設定を確認してください。');
    }
  } catch (error) {
    console.error('❌ 通信エラー:', (error as Error).message);
    console.log('サーバー(localhost:4000)は起動していますか？');
  }
}

runTest();
