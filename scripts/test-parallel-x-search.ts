/**
 * サブクエリの並列実行をテストするスクリプト
 * 
 * 使用方法:
 * 1. このスクリプトを実行するには、以下のコマンドを使用します:
 *    npx tsx scripts/test-parallel-x-search.ts "検索クエリ"
 * 
 * 2. 検索クエリを指定しない場合は、デフォルトのクエリが使用されます
 */

import { generateSubQueries } from '../lib/ai/x-search/subquery-generator';
import { executeParallelCozeQueries } from '../lib/ai/coze/coze';

// 環境変数を設定するためのdotenvを読み込む
import * as dotenv from 'dotenv';

// .env.localファイルを読み込む
dotenv.config({ path: '.env.local' });

// 環境変数が正しく設定されているか確認
const checkEnvironmentVariables = () => {
  const apiKey = process.env.NEXT_PUBLIC_COZE_API_KEY;
  if (!apiKey) {
    console.error('環境変数 NEXT_PUBLIC_COZE_API_KEY が設定されていません。');
    console.error('以下の環境変数が設定されています:');
    console.error(Object.keys(process.env).filter(key => key.includes('COZE') || key.includes('API')));
    return false;
  }
  console.log('環境変数 NEXT_PUBLIC_COZE_API_KEY が設定されています。');
  return true;
};

/**
 * メイン関数
 */
async function main() {
  try {
    console.log(`\n===== X検索並列実行テスト =====`);
    
    // 環境変数のチェック
    if (!checkEnvironmentVariables()) {
      console.error('環境変数が正しく設定されていないため、テストを中断します。');
      process.exit(1);
    }
    
    // APIキーの一部を表示（セキュリティのため最初の4文字のみ）
    const apiKey = process.env.NEXT_PUBLIC_COZE_API_KEY || '';
    console.log(`APIキー: ${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 4)}`);
    
    // コマンドライン引数から検索クエリを取得
    const searchQuery = process.argv[2] || 'AIの最新動向について教えて';
    console.log(`検索クエリ: "${searchQuery}"`);

    // 1. サブクエリを生成
    console.log(`\n----- サブクエリ生成 -----`);
    console.time('サブクエリ生成時間');
    const subQueries = await generateSubQueries(searchQuery);
    console.timeEnd('サブクエリ生成時間');
    
    console.log(`\n生成されたサブクエリ (${subQueries.length}件):`);
    subQueries.forEach((query, index) => {
      console.log(`${index + 1}. ${query}`);
    });

    // 2. サブクエリを並列実行
    console.log(`\n----- サブクエリ並列実行 -----`);
    console.time('並列実行時間');
    
    // 進捗状況を表示するコールバック関数
    const onProgress = (processed: number) => {
      console.log(`進捗状況: ${processed}/${subQueries.length} 完了`);
    };
    
    // 並列実行
    const results = await executeParallelCozeQueries(
      subQueries,
      'test-user',
      'test-chat',
      onProgress,
      { skipStorage: true } // データベースへの保存をスキップ
    );
    
    console.timeEnd('並列実行時間');

    // 3. 結果を表示
    console.log(`\n----- 実行結果 -----`);
    results.forEach((result, index) => {
      console.log(`\n[サブクエリ ${index + 1}] ${result.query}`);
      console.log(`投稿数: ${result.posts?.length || 0}`);
      
      if (result.error) {
        console.log(`エラー: ${result.error}`);
      } else if (result.posts?.length === 0) {
        console.log('投稿が見つかりませんでした');
      } else {
        console.log('投稿サンプル:');
        // 最初の3件のみ表示
        result.posts?.slice(0, 3).forEach((post, postIndex) => {
          console.log(`  ${postIndex + 1}. @${post.author.username}: ${post.text.substring(0, 100)}${post.text.length > 100 ? '...' : ''}`);
        });
        
        if (result.posts && result.posts.length > 3) {
          console.log(`  ... 他 ${result.posts.length - 3} 件`);
        }
      }
    });

    // 4. 集計結果
    console.log(`\n----- 集計結果 -----`);
    const totalPosts = results.reduce((sum, result) => sum + (result.posts?.length || 0), 0);
    const successfulQueries = results.filter(result => !result.error && (result.posts?.length || 0) > 0).length;
    const failedQueries = results.filter(result => !!result.error).length;
    const emptyQueries = results.filter(result => !result.error && (result.posts?.length || 0) === 0).length;
    
    console.log(`合計投稿数: ${totalPosts}`);
    console.log(`成功したクエリ: ${successfulQueries}/${subQueries.length}`);
    console.log(`失敗したクエリ: ${failedQueries}/${subQueries.length}`);
    console.log(`結果が空のクエリ: ${emptyQueries}/${subQueries.length}`);
    
    console.log(`\n===== テスト完了 =====\n`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(console.error);
