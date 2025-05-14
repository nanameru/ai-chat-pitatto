import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { thoughtNodeSchema, nodeConnectionSchema } from '../types/thoughtNode';
import { getLogger } from '..';

export const aggregationInputSchema = z.object({
  nodes: z.array(thoughtNodeSchema),
  query: z.string().describe("元のユーザーからの質問"),
  existingConnections: z.array(nodeConnectionSchema).optional(),
});

export const aggregationOutputSchema = z.object({
  connections: z.array(nodeConnectionSchema),
  synthesizedThoughts: z.array(z.object({
    nodeIds: z.array(z.string()),
    content: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});

export const generateAggregationPrompt = (input: z.infer<typeof aggregationInputSchema>): string => `
あなたは複数の思考ノード間の関連性を分析し、それらを結合して新たな高次の思考を生成する専門家です。

元の質問:
"${input.query}"

以下の思考ノードの関連性を分析し、結合すべきノードを特定して、新たな合成思考を生成してください：

${input.nodes.map(node => `ノードID: ${node.id}
内容: ${node.content}
スコア: ${node.score}
`).join('\n\n')}

これらのノード間の関連性を分析し、意味的に関連するノードを結合して、より高次の思考を生成してください。
結果は必ず以下のJSON形式で返してください:

{
  "connections": [
    {
      "sourceNodeId": "思考1のID",
      "targetNodeId": "思考2のID",
      "strength": 0.85,
      "reasoning": "これらのノードを結合する理由"
    },
  ],
  "synthesizedThoughts": [
    {
      "nodeIds": ["思考1のID", "思考2のID"],
      "content": "結合から生成された新たな思考内容",
      "confidence": 0.9
    },
  ]
}
`;

export const thoughtAggregationAgent = new Agent({
  name: 'thoughtAggregationAgent',
  instructions: `
# =====================  ThoughtAggregationAgent Prompt  =====================
prompt:
  role: |
    あなたは「思考集約スペシャリスト」です。
    複数の思考ノード間の関連性を分析し、それらを結合して新たな高次の思考を生成します。
    脳のシナプス結合のように、関連する思考同士を動的に結びつけることが目的です。

  goal:
    - relationship_analysis: >
        複数の思考ノード間の意味的関連性や補完性を分析する。
    - connection_identification: >
        どの思考ノードを結合すべきかを判断し、結合強度を計算する。
    - thought_synthesis: >
        結合された思考から新たな高次の思考を生成する。

  input_schema:
    nodes: "array: 思考ノードの配列"
    query: "string: 元のユーザー質問"
    existingConnections: "array (optional): 既存の結合情報"

  quality_criteria:
    - relevance: "結合と合成思考は元のクエリに関連していること。"
    - novelty: "合成思考は単なる入力ノードの要約ではなく、新たな洞察を含むこと。"
    - coherence: "結合は意味的に一貫性があり、論理的であること。"
    - diversity: "様々なタイプの結合パターンを探索すること。"

  workflow_steps:
    - "Step 1: 各ノードの内容を理解し、元のクエリとの関連性を分析する。"
    - "Step 2: ノード間の意味的関連性を分析し、結合候補を特定する。"
    - "Step 3: 各結合候補の強度（0.0〜1.0）を計算する。"
    - "Step 4: 結合されたノードから新たな合成思考を生成する。"
    - "Step 5: 最終チェックを行い、出力フォーマットに整形して回答する。"

  output_format: |
    \`\`\`json
    {
      "connections": [
        {
          "sourceNodeId": "思考1のID",
          "targetNodeId": "思考2のID",
          "strength": 0.85,
          "reasoning": "これらのノードを結合する理由"
        },
      ],
      "synthesizedThoughts": [
        {
          "nodeIds": ["思考1のID", "思考2のID"],
          "content": "結合から生成された新たな思考内容",
          "confidence": 0.9
        },
      ]
    }
    \`\`\`

  examples:
    success: |
      \`\`\`json
      {
        "connections": [
          {
            "sourceNodeId": "thought-1",
            "targetNodeId": "thought-3",
            "strength": 0.85,
            "reasoning": "両方のノードがAIの倫理的側面に言及しており、相互に補完する視点を提供している"
          },
          {
            "sourceNodeId": "thought-2",
            "targetNodeId": "thought-4",
            "strength": 0.72,
            "reasoning": "技術的実装と実用例の関係性が強い"
          }
        ],
        "synthesizedThoughts": [
          {
            "nodeIds": ["thought-1", "thought-3"],
            "content": "AIの倫理的枠組みは技術的制約と社会的期待の両面から考慮する必要がある。技術的には安全性メカニズムの実装が必要であり、社会的には透明性と説明責任の確保が重要である。",
            "confidence": 0.9
          },
          {
            "nodeIds": ["thought-2", "thought-4"],
            "content": "AIの実装において、理論的アルゴリズムの選択と実際のユースケースの要件は密接に関連している。最適なアルゴリズムは使用コンテキストによって異なり、実世界のフィードバックループが重要である。",
            "confidence": 0.85
          }
        ]
      }
      \`\`\`
    failure: |
      \`\`\`json
      {
        "error": "出力が正しいJSON形式ではありません"
      }
      \`\`\`
# ============================================================================
`,
  model: openai('gpt-4o'),
});

export async function aggregateThoughts(input: z.infer<typeof aggregationInputSchema>): Promise<z.infer<typeof aggregationOutputSchema>> {
    const logger = getLogger();
    const prompt = generateAggregationPrompt(input);
    logger.info("(ThoughtAggregationAgent) Analyzing thought nodes with prompt:", { prompt });
    
    try {
        const response = await thoughtAggregationAgent.generate(prompt);
        logger.info("(ThoughtAggregationAgent) Raw agent response received.", { response });
        
        if (response.text) {
            try {
                let responseText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                const parsedJson = JSON.parse(responseText);
                
                if (parsedJson && 
                    typeof parsedJson === 'object' && 
                    'connections' in parsedJson && 
                    'synthesizedThoughts' in parsedJson) {
                    
                    const result = {
                        connections: parsedJson.connections || [],
                        synthesizedThoughts: parsedJson.synthesizedThoughts || []
                    };
                    
                    logger.info("(ThoughtAggregationAgent) Successfully extracted aggregation results.", { 
                        connectionCount: result.connections.length,
                        synthesizedThoughtCount: result.synthesizedThoughts.length
                    });
                    
                    return result;
                } else {
                    logger.warn("(ThoughtAggregationAgent) Agent response does not contain expected fields.", { parsedJson });
                    return { connections: [], synthesizedThoughts: [] };
                }
            } catch (parseError) {
                logger.error("(ThoughtAggregationAgent) Failed to parse agent response JSON.", { error: parseError, responseText: response.text });
                return { connections: [], synthesizedThoughts: [] };
            }
        } else {
            logger.error("(ThoughtAggregationAgent) Agent returned no text response.");
            return { connections: [], synthesizedThoughts: [] };
        }
    } catch (error) {
        logger.error("(ThoughtAggregationAgent) Error during agent generation or processing.", { error });
        return { connections: [], synthesizedThoughts: [] };
    }
}
