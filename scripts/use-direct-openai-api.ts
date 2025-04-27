#!/usr/bin/env ts-node
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

async function main() {
  try {
    console.log("Testing direct OpenAI API call with o4-mini...");
    console.log("Using API Key:", process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Not set");
    
    // 画像の例のように o4-mini を直接呼び出す (AI SDKを使わず直接fetchで呼び出す)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'o4-mini',
        messages: [{ role: 'user', content: 'What is love?' }],
        // temperature パラメータを省略
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log("Response:", data.choices[0].message.content);
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }
}

main(); 