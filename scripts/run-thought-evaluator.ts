#!/usr/bin/env ts-node
/* eslint-disable import/extensions */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// Load environment variables from .env.local, overriding existing env vars
dotenv.config({ path: '.env.local', override: true });
import { thoughtEvaluator } from "../lib/mastra/tools/tot/thought-tools";

/**
 * 思考評価ツール実行スクリプト
 * 
 * 使用例:
 * - JSONファイルから思考を読み込んで評価:
 *   npx tsx scripts/run-thought-evaluator.ts --input thoughts.json --stage planning
 * 
 * - 評価基準を指定:
 *   npx tsx scripts/run-thought-evaluator.ts --input thoughts.json --stage planning --criteria "網羅性,実行可能性,創造性"
 */
async function main() {
  // コマンドライン引数をパース
  const args = process.argv.slice(2);
  let inputFile = '';
  let stage = 'planning';
  let criteria: string[] = [];

  // 引数解析
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) {
      inputFile = args[i + 1];
      i++;
    } else if (args[i] === '--stage' && i + 1 < args.length) {
      stage = args[i + 1] as "planning" | "analysis" | "insight";
      i++;
    } else if (args[i] === '--criteria' && i + 1 < args.length) {
      criteria = args[i + 1].split(',');
      i++;
    }
  }

  if (!inputFile) {
    console.error("使用法: npx tsx scripts/run-thought-evaluator.ts --input <thoughts_file.json> --stage [planning|analysis|insight] [--criteria criteria1,criteria2,...]");
    console.error("例: npx tsx scripts/run-thought-evaluator.ts --input ./thoughts.json --stage planning");
    process.exit(1);
  }

  try {
    // 指定されたJSONファイルから思考データを読み込む
    const resolvedPath = path.resolve(inputFile);
    console.log(`[ToT] 思考ファイル読み込み: ${resolvedPath}`);
    
    const fileData = fs.readFileSync(resolvedPath, 'utf8');
    const data = JSON.parse(fileData);
    
    // 思考配列を取得
    let thoughts = [];
    if (data.thoughts) {
      // thoughtGeneratorの出力形式
      thoughts = data.thoughts;
    } else if (Array.isArray(data)) {
      // 思考の配列が直接渡された場合
      thoughts = data;
    } else {
      throw new Error("サポートされていないJSONフォーマットです。'thoughts'プロパティを含むオブジェクト、または思考の配列が必要です。");
    }

    if (!thoughts.length) {
      throw new Error("評価する思考が見つかりません。");
    }

    console.log(`[ToT] 思考評価開始: ${thoughts.length}件の思考を評価します。ステージ=${stage}`);

    if (!thoughtEvaluator || !thoughtEvaluator.execute) {
      throw new Error("thoughtEvaluator or its execute method is not defined");
    }
    
    // 思考評価を実行
    // @ts-ignore - ライブラリの型定義の変更に対応
    const result = await thoughtEvaluator.execute({
      context: { 
        thoughts,
        stage,
        evaluationCriteria: criteria.length > 0 ? criteria : undefined 
      },
      // @ts-ignore - Container interfaceの完全実装を回避
      container: {
        registry: {},
        get: () => null as any,
        set: () => {},
        has: () => false
      }
    });
    
    // 結果を整形して出力
    console.log(`[ToT] 評価完了: 最高スコア=${result.bestThought?.score?.toFixed(2) || 'N/A'}`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error during thought evaluation:", error);
    process.exit(1);
  }
}

main(); 