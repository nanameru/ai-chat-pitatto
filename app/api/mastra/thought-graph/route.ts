import { NextRequest, NextResponse } from 'next/server';
import { ThoughtNode, NodeConnection, SynthesizedThought, calculateNetworkState } from '../../../../src/mastra/types/thoughtNode';

const sampleNodes: ThoughtNode[] = [
  {
    id: 'thought-1',
    content: 'AIの倫理的側面は、開発者と利用者の双方に責任がある。透明性と説明可能性を確保することが重要である。',
    score: 8.5,
    metadata: { type: 'initial' },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-2',
    content: 'AIモデルの選択は、タスクの複雑さ、データの量、計算リソース、および期待される精度に基づいて行うべきである。',
    score: 7.2,
    metadata: { type: 'initial' },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-3',
    content: 'AIシステムの透明性と説明可能性は、ユーザーの信頼を構築し、システムの採用を促進するために不可欠である。',
    score: 8.9,
    metadata: { type: 'initial' },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-4',
    content: '実際のAI実装では、理論的な最適解よりも実用的なアプローチが優先されることが多い。',
    score: 7.8,
    metadata: { type: 'initial' },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-5',
    content: 'AIの倫理的枠組みは技術的制約と社会的期待の両面から考慮する必要がある。技術的には安全性メカニズムの実装が必要であり、社会的には透明性と説明責任の確保が重要である。',
    score: 9.0,
    metadata: { type: 'synthesized', sourceNodeIds: ['thought-1', 'thought-3'] },
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-6',
    content: 'AIの実装において、理論的アルゴリズムの選択と実際のユースケースの要件は密接に関連している。最適なアルゴリズムは使用コンテキストによって異なり、実世界のフィードバックループが重要である。',
    score: 8.5,
    metadata: { type: 'synthesized', sourceNodeIds: ['thought-2', 'thought-4'] },
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
];

const sampleConnections: NodeConnection[] = [
  {
    id: 'conn-1',
    sourceNodeId: 'thought-1',
    targetNodeId: 'thought-3',
    strength: 0.85,
    reasoning: '両方のノードがAIの倫理的側面と透明性に言及している',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 3
  },
  {
    id: 'conn-2',
    sourceNodeId: 'thought-2',
    targetNodeId: 'thought-4',
    strength: 0.72,
    reasoning: '両方のノードがAIの実装と選択基準に関連している',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 2
  },
  {
    id: 'conn-3',
    sourceNodeId: 'thought-1',
    targetNodeId: 'thought-2',
    strength: 0.35,
    reasoning: 'AIの倫理的側面とモデル選択の間に弱い関連性がある',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-4',
    sourceNodeId: 'thought-3',
    targetNodeId: 'thought-4',
    strength: 0.45,
    reasoning: '透明性と実装アプローチの間に中程度の関連性がある',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-5',
    sourceNodeId: 'thought-5',
    targetNodeId: 'thought-1',
    strength: 0.95,
    reasoning: '合成思考とその元となった思考の間の強い関連性',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-6',
    sourceNodeId: 'thought-5',
    targetNodeId: 'thought-3',
    strength: 0.90,
    reasoning: '合成思考とその元となった思考の間の強い関連性',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-7',
    sourceNodeId: 'thought-6',
    targetNodeId: 'thought-2',
    strength: 0.88,
    reasoning: '合成思考とその元となった思考の間の強い関連性',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-8',
    sourceNodeId: 'thought-6',
    targetNodeId: 'thought-4',
    strength: 0.92,
    reasoning: '合成思考とその元となった思考の間の強い関連性',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    lastActivated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    activationCount: 1
  }
];

const sampleSynthesizedThoughts: SynthesizedThought[] = [
  {
    id: 'thought-5',
    nodeIds: ['thought-1', 'thought-3'],
    content: 'AIの倫理的枠組みは技術的制約と社会的期待の両面から考慮する必要がある。技術的には安全性メカニズムの実装が必要であり、社会的には透明性と説明責任の確保が重要である。',
    confidence: 0.9,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'thought-6',
    nodeIds: ['thought-2', 'thought-4'],
    content: 'AIの実装において、理論的アルゴリズムの選択と実際のユースケースの要件は密接に関連している。最適なアルゴリズムは使用コンテキストによって異なり、実世界のフィードバックループが重要である。',
    confidence: 0.85,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
];

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId') || 'default';
    
    const networkMetrics = calculateNetworkState(sampleNodes, sampleConnections);
    
    return NextResponse.json({
      success: true,
      data: {
        nodes: sampleNodes,
        connections: sampleConnections,
        synthesizedThoughts: sampleSynthesizedThoughts,
        networkMetrics
      }
    });
  } catch (error) {
    console.error('Error fetching thought graph data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch thought graph data' },
      { status: 500 }
    );
  }
}
