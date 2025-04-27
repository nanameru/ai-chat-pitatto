#!/usr/bin/env ts-node
/* eslint-disable import/extensions */
import dotenv from 'dotenv';
// Load environment variables from .env.local, overriding existing env vars
dotenv.config({ path: '.env.local', override: true });
import { thoughtGenerator } from "../lib/mastra/tools/tot/thought-tools";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: ts-node scripts/run-thought-generator.ts <query> <stage> [maxThoughts]");
    console.error("stage must be one of: planning, analysis, insight");
    process.exit(1);
  }

  const [query, stageArg, maxThoughtsArg] = args;
  const stage = stageArg as "planning" | "analysis" | "insight";
  const maxThoughts = maxThoughtsArg ? parseInt(maxThoughtsArg, 10) : 5;

  try {
    if (!thoughtGenerator || !thoughtGenerator.execute) {
      throw new Error("thoughtGenerator or its execute method is not defined");
    }
    
    // @ts-ignore - ライブラリの型定義の変更に対応
    const result = await thoughtGenerator.execute({
      context: { query, stage, maxThoughts },
      // @ts-ignore - Container interfaceの完全実装を回避
      container: {
        registry: {},
        get: () => null as any,
        set: () => {},
        has: () => false
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error during thought generation:", error);
    process.exit(1);
  }
}

main(); 