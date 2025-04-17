/**
 * OpenAI API直接テストスクリプト
 * 
 * 環境変数OPENAI_API_KEYを使用してOpenAI APIを呼び出します。
 * 実行方法：npx tsx scripts/test-openai-api-direct.ts
 */

// 環境変数を.envファイルから読み込む（既存の環境変数を上書き）
import * as dotenv from 'dotenv';
console.log('dotenvの設定前');
console.log('システム環境変数:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'なし');
dotenv.config({ path: '.env.local', override: true });
console.log('dotenvの設定後');

async function main() {
  console.log('OpenAI API直接テスト開始');
  
  // 環境変数のデバッグ
  console.log('環境変数一覧:');
  console.log('OPENAI_API_KEY存在:', process.env.OPENAI_API_KEY ? 'はい' : 'いいえ');
  if (process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY長さ:', process.env.OPENAI_API_KEY.length);
    console.log('OPENAI_API_KEY先頭:', process.env.OPENAI_API_KEY.substring(0, 15));
  }
  
  // APIキーのチェック
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('⚠️ 環境変数OPENAI_API_KEYが設定されていません');
    process.exit(1);
  }
  
  // APIキーの前後数文字のみを表示（セキュリティのため）
  const maskedKey = `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log(`✅ APIキーを検出: ${maskedKey}`);
  
  try {
    // APIエンドポイントを直接呼び出す
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'あなたは親切なアシスタントです。' },
          { role: 'user', content: '日本の首都は？' }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });
    
    // レスポンスのステータスコードをチェック
    console.log(`APIレスポンスステータス: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('⚠️ APIエラー:', JSON.stringify(errorData, null, 2));
      process.exit(1);
    }
    
    // レスポンスデータを表示
    const data = await response.json();
    console.log('✅ API呼び出し成功!');
    console.log('応答内容:', data.choices[0].message.content);
    console.log('モデル:', data.model);
    console.log('使用トークン数:', data.usage?.total_tokens);
  } catch (error) {
    console.error('⚠️ API呼び出し中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(error => {
  console.error('⚠️ 予期せぬエラー:', error);
  process.exit(1);
}); 