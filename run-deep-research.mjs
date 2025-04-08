// Node.js script to run deepResearchAgentV2 agent
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Try to dynamically import the agent
async function main() {
  try {
    console.log("Deep Research Agent V2 を読み込み中...");
    
    // Import the agent module dynamically
    const agentModule = await import('./lib/mastra/agents/deep-research-v2/index.js');
    const deepResearchAgentV2 = agentModule.default || agentModule.deepResearchAgentV2;
    
    if (!deepResearchAgentV2) {
      throw new Error("エージェントモジュールが正しく読み込めませんでした。");
    }
    
    console.log("クエリ: 生成AIについておせいて");
    
    // Run the agent with the query
    const response = await deepResearchAgentV2.chat({
      messages: [
        {
          role: "user",
          content: "生成AIについておせいて"
        }
      ]
    });
    
    // Print the agent's response
    console.log("\n---応答---\n");
    console.log(response.messages[response.messages.length - 1].content);
    console.log("\n---処理完了---\n");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main(); 