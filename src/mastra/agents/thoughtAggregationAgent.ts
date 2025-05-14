import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { 
  thoughtNodeSchema, 
  nodeConnectionSchema, 
  updateConnectionStrengthHebbian,
  pruneConnections,
  calculateNodeActivity
} from '../types/thoughtNode';
import { getLogger } from '..';

export const aggregationInputSchema = z.object({
  nodes: z.array(thoughtNodeSchema),
  query: z.string().describe("元のユーザーからの質問"),
  existingConnections: z.array(nodeConnectionSchema).optional(),
  learningRate: z.number().min(0).max(1).optional().default(0.1),
  pruningThreshold: z.number().min(0).max(1).optional().default(0.2),
  inactivityThresholdMs: z.number().optional().default(7 * 24 * 60 * 60 * 1000), // 1週間
  decayFactor: z.number().min(0).max(1).optional().default(0.9),
  cycleCount: z.number().optional().default(0),
  persistentState: z.record(z.any()).optional().default({}),
});

export const aggregationOutputSchema = z.object({
  connections: z.array(nodeConnectionSchema),
  synthesizedThoughts: z.array(z.object({
    nodeIds: z.array(z.string()),
    content: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  updatedState: z.record(z.any()).optional(),
  networkMetrics: z.object({
    nodeCount: z.number(),
    connectionCount: z.number(),
    averageStrength: z.number(),
    averageScore: z.number(),
    connectionDensity: z.number(),
    timestamp: z.date(),
  }).optional(),
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
    
    const existingConnections = input.existingConnections || [];
    const cycleCount = input.cycleCount || 0;
    const persistentState = input.persistentState || {};
    
    const learningRate = input.learningRate || 0.1;
    const pruningThreshold = input.pruningThreshold || 0.2;
    const inactivityThresholdMs = input.inactivityThresholdMs || (7 * 24 * 60 * 60 * 1000);
    const decayFactor = input.decayFactor || 0.9;
    
    try {
        const nodeActivities = new Map<string, number>();
        input.nodes.forEach(node => {
            const activity = calculateNodeActivity(node, existingConnections, input.nodes, decayFactor);
            nodeActivities.set(node.id, activity);
            logger.debug(`Node ${node.id} activity: ${activity.toFixed(3)}`);
        });
        
        let updatedConnections = [...existingConnections];
        if (cycleCount > 0 && existingConnections.length > 0) {
            logger.info(`(ThoughtAggregationAgent) Updating ${existingConnections.length} existing connections using Hebbian learning`);
            
            updatedConnections = existingConnections.map(conn => {
                const sourceActivity = nodeActivities.get(conn.sourceNodeId) || 0;
                const targetActivity = nodeActivities.get(conn.targetNodeId) || 0;
                
                if (sourceActivity > 0 && targetActivity > 0) {
                    const updatedConn = updateConnectionStrengthHebbian(
                        conn, 
                        sourceActivity, 
                        targetActivity, 
                        learningRate
                    );
                    
                    logger.debug(`Connection ${conn.sourceNodeId} ↔ ${conn.targetNodeId} strength updated: ${conn.strength.toFixed(3)} → ${updatedConn.strength.toFixed(3)}`);
                    return updatedConn;
                }
                return conn;
            });
            
            const connectionCountBefore = updatedConnections.length;
            updatedConnections = pruneConnections(updatedConnections, pruningThreshold, inactivityThresholdMs);
            const prunedCount = connectionCountBefore - updatedConnections.length;
            
            if (prunedCount > 0) {
                logger.info(`(ThoughtAggregationAgent) Pruned ${prunedCount} weak connections`);
            }
        }
        
        const response = await thoughtAggregationAgent.generate(prompt);
        logger.info("(ThoughtAggregationAgent) Raw agent response received.");
        
        if (response.text) {
            try {
                let responseText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                const parsedJson = JSON.parse(responseText);
                
                if (parsedJson && 
                    typeof parsedJson === 'object' && 
                    'connections' in parsedJson && 
                    'synthesizedThoughts' in parsedJson) {
                    
                    const newConnections = parsedJson.connections || [];
                    
                    const mergedConnections = [...updatedConnections];
                    for (const newConn of newConnections) {
                        const isDuplicate = updatedConnections.some(
                            existConn => 
                                (existConn.sourceNodeId === newConn.sourceNodeId && 
                                 existConn.targetNodeId === newConn.targetNodeId) ||
                                (existConn.sourceNodeId === newConn.targetNodeId && 
                                 existConn.targetNodeId === newConn.sourceNodeId)
                        );
                        
                        if (!isDuplicate) {
                            mergedConnections.push(newConn);
                        }
                    }
                    
                    const networkMetrics = {
                        nodeCount: input.nodes.length,
                        connectionCount: mergedConnections.length,
                        averageStrength: mergedConnections.length > 0 
                            ? mergedConnections.reduce((sum, conn) => sum + conn.strength, 0) / mergedConnections.length 
                            : 0,
                        averageScore: input.nodes.length > 0
                            ? input.nodes.reduce((sum, node) => sum + node.score, 0) / input.nodes.length
                            : 0,
                        connectionDensity: input.nodes.length > 1
                            ? mergedConnections.length / (input.nodes.length * (input.nodes.length - 1) / 2)
                            : 0,
                        timestamp: new Date()
                    };
                    
                    const updatedState = {
                        ...persistentState,
                        lastCycleTimestamp: new Date(),
                        totalCycles: cycleCount + 1,
                        nodeActivities: Object.fromEntries(nodeActivities),
                    };
                    
                    const result = {
                        connections: mergedConnections,
                        synthesizedThoughts: parsedJson.synthesizedThoughts || [],
                        updatedState,
                        networkMetrics
                    };
                    
                    logger.info("(ThoughtAggregationAgent) Successfully extracted aggregation results.", { 
                        connectionCount: result.connections.length,
                        synthesizedThoughtCount: result.synthesizedThoughts.length,
                        cycleCount: updatedState.totalCycles
                    });
                    
                    return result;
                } else {
                    logger.warn("(ThoughtAggregationAgent) Agent response does not contain expected fields.", { parsedJson });
                    return { 
                        connections: updatedConnections, 
                        synthesizedThoughts: [],
                        updatedState: {
                            ...persistentState,
                            lastCycleTimestamp: new Date(),
                            totalCycles: cycleCount + 1,
                            error: "Invalid agent response format"
                        }
                    };
                }
            } catch (parseError) {
                logger.error("(ThoughtAggregationAgent) Failed to parse agent response JSON.", { error: parseError });
                return { 
                    connections: updatedConnections, 
                    synthesizedThoughts: [],
                    updatedState: {
                        ...persistentState,
                        lastCycleTimestamp: new Date(),
                        totalCycles: cycleCount + 1,
                        error: "JSON parse error"
                    }
                };
            }
        } else {
            logger.error("(ThoughtAggregationAgent) Agent returned no text response.");
            return { 
                connections: updatedConnections, 
                synthesizedThoughts: [],
                updatedState: {
                    ...persistentState,
                    lastCycleTimestamp: new Date(),
                    totalCycles: cycleCount + 1,
                    error: "Empty agent response"
                }
            };
        }
    } catch (error) {
        logger.error("(ThoughtAggregationAgent) Error during agent generation or processing.", { error });
        return { 
            connections: existingConnections, 
            synthesizedThoughts: [],
            updatedState: {
                ...persistentState,
                lastCycleTimestamp: new Date(),
                totalCycles: cycleCount + 1,
                error: String(error)
            }
        };
    }
}
