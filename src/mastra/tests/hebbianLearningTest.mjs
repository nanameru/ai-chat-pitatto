// Test for Hebbian learning and synapse pruning mechanisms
import { v4 as uuidv4 } from 'uuid';
import { 
  updateConnectionStrengthHebbian, 
  pruneConnections, 
  calculateNodeActivity,
  calculateNetworkState
} from '../types/thoughtNode.js';

console.log('=== Hebbian Learning and Synapse Pruning Test ===');

// Create test nodes
const testNodes = [
  {
    id: 'node-1',
    content: "AIの倫理的側面に関する考察",
    score: 8.5,
    metadata: { type: 'initial' },
    createdAt: new Date()
  },
  {
    id: 'node-2',
    content: "AIモデルの選択基準について",
    score: 7.2,
    metadata: { type: 'initial' },
    createdAt: new Date()
  },
  {
    id: 'node-3',
    content: "AIシステムの透明性と説明可能性",
    score: 8.9,
    metadata: { type: 'initial' },
    createdAt: new Date()
  },
  {
    id: 'node-4',
    content: "実際のAI実装における実用的アプローチ",
    score: 7.8,
    metadata: { type: 'initial' },
    createdAt: new Date()
  }
];

// Create initial connections
let connections = [
  {
    id: uuidv4(),
    sourceNodeId: 'node-1',
    targetNodeId: 'node-3',
    strength: 0.5,
    reasoning: "両方のノードがAIの倫理的側面に言及している",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3日前
    lastActivated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: uuidv4(),
    sourceNodeId: 'node-2',
    targetNodeId: 'node-4',
    strength: 0.4,
    reasoning: "技術的実装と選択基準の関連性",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3日前
    lastActivated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: uuidv4(),
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    strength: 0.1,
    reasoning: "弱い関連性",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10日前
    lastActivated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    activationCount: 1
  }
];

// Print initial state
console.log('\n=== Initial State ===');
console.log('Nodes:', testNodes.length);
console.log('Connections:', connections.length);
const initialMetrics = calculateNetworkState(testNodes, connections);
console.log('Network Metrics:', initialMetrics);

// Simulate multiple learning cycles
const cycles = 3;
const learningRate = 0.1;
const pruningThreshold = 0.2;
const inactivityThresholdMs = 7 * 24 * 60 * 60 * 1000; // 1週間
const decayFactor = 0.9;

console.log('\n=== Simulating Hebbian Learning Cycles ===');

for (let cycle = 1; cycle <= cycles; cycle++) {
  console.log(`\n--- Cycle ${cycle} ---`);
  
  // Calculate node activities
  const nodeActivities = new Map();
  testNodes.forEach(node => {
    const activity = calculateNodeActivity(node, connections, testNodes, decayFactor);
    nodeActivities.set(node.id, activity);
    console.log(`Node ${node.id} activity: ${activity.toFixed(3)}`);
  });
  
  // Update connection strengths using Hebbian learning
  connections = connections.map(conn => {
    const sourceActivity = nodeActivities.get(conn.sourceNodeId) || 0;
    const targetActivity = nodeActivities.get(conn.targetNodeId) || 0;
    
    if (sourceActivity > 0 && targetActivity > 0) {
      const oldStrength = conn.strength;
      const updatedConn = updateConnectionStrengthHebbian(
        conn, 
        sourceActivity, 
        targetActivity, 
        learningRate
      );
      
      console.log(`Connection ${conn.sourceNodeId} ↔ ${conn.targetNodeId} strength updated: ${oldStrength.toFixed(3)} → ${updatedConn.strength.toFixed(3)} (Δ${(updatedConn.strength - oldStrength).toFixed(3)})`);
      return updatedConn;
    }
    return conn;
  });
  
  // Prune weak connections
  const connectionCountBefore = connections.length;
  connections = pruneConnections(connections, pruningThreshold, inactivityThresholdMs);
  const prunedCount = connectionCountBefore - connections.length;
  
  if (prunedCount > 0) {
    console.log(`Pruned ${prunedCount} weak connections`);
  }
  
  // Calculate network metrics
  const metrics = calculateNetworkState(testNodes, connections);
  console.log('Network Metrics:', metrics);
}

// Print final state
console.log('\n=== Final State ===');
console.log('Nodes:', testNodes.length);
console.log('Connections:', connections.length);
connections.forEach(conn => {
  console.log(`Connection ${conn.sourceNodeId} ↔ ${conn.targetNodeId}: strength=${conn.strength.toFixed(3)}, activations=${conn.activationCount}`);
});

const finalMetrics = calculateNetworkState(testNodes, connections);
console.log('Final Network Metrics:', finalMetrics);

// Compare initial and final states
console.log('\n=== Comparison ===');
console.log('Initial Average Strength:', initialMetrics.averageStrength.toFixed(3));
console.log('Final Average Strength:', finalMetrics.averageStrength.toFixed(3));
console.log('Strength Change:', (finalMetrics.averageStrength - initialMetrics.averageStrength).toFixed(3));
console.log('Initial Connection Count:', initialMetrics.connectionCount);
console.log('Final Connection Count:', finalMetrics.connectionCount);
