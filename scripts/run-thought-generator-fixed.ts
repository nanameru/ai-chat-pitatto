#!/usr/bin/env ts-node
/* eslint-disable import/extensions */
import dotenv from 'dotenv';
// Load environment variables from .env.local, overriding existing env vars
dotenv.config({ path: '.env.local', override: true });
import { thoughtGenerator } from "../lib/mastra/tools/tot/thought-tools";

/**
 * 最新バージョンのライブラリ用に修正したThought Generator実行スクリプト
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: ts-node scripts/run-thought-generator-fixed.ts <query> <stage> [maxThoughts]");
    console.error("stage must be one of: planning, analysis, insight");
    process.exit(1);
  }

  const [query, stageArg, maxThoughtsArg] = args;
  const stage = stageArg as "planning" | "analysis" | "insight";
  const maxThoughts = maxThoughtsArg ? parseInt(maxThoughtsArg, 10) : 5;

  try {
    if (!thoughtGenerator) {
      throw new Error("thoughtGenerator is not defined");
    }
    
    // 実際の内部実装を確認し、新API形式での呼び出し
    // @ts-ignore - ライブラリの型定義の変更に対応
    const result = await thoughtGenerator.execute({
      // 内部呼び出し用のダミーコンテナ
      container: {
        get: () => null,
        set: () => {},
        has: () => false,
        registry: {}
      }, 
      context: { 
        query, 
        stage, 
        maxThoughts 
      }
    });
    
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error during thought generation:", error);
    process.exit(1);
  }
}

main(); 