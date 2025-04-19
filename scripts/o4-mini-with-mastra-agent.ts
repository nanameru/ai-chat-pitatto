#!/usr/bin/env ts-node
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log("Testing o4-mini with Mastra Agent...");
    
    // Create the agent
    const agent = new Agent({
      name: "o4-mini Test Agent",
      instructions: "あなたは質問に簡潔に答えるアシスタントです。",
      model: openai("o4-mini"), // o4-mini を直接指定、温度パラメータ不要
    });
    
    // Generate a response
    const result = await agent.generate("気候変動の影響について教えてください。");
    
    console.log("Response:", result.text);
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }
}

main(); 