#!/usr/bin/env ts-node
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

async function main() {
  try {
    console.log("Testing direct o4-mini API call...");
    console.log("Using API Key:", process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Not set");
    
    // 画像の例のようにシンプルな設定で o4-mini を呼び出す
    const { text } = await generateText({
      model: openai("o4-mini", { baseURL: "https://api.openai.com/v1", temperature: undefined }),
      prompt: "What is love?",
    });
    
    console.log("Response:", text);
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }
}

main(); 