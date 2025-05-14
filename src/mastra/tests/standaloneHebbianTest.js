
console.log('=== Hebbian Learning and Synapse Pruning Test ===');

function updateConnectionStrengthHebbian(connection, sourceNodeActivity, targetNodeActivity, learningRate = 0.1) {
  const activityProduct = sourceNodeActivity * targetNodeActivity;
  const strengthDelta = learningRate * activityProduct;
  const newStrength = Math.min(1.0, connection.strength + strengthDelta);
  
  return {
    ...connection,
    strength: newStrength,
    lastActivated: new Date(),
    activationCount: (connection.activationCount || 0) + 1
  };
}

function pruneConnections(connections, pruningThreshold = 0.2, inactivityThresholdMs = 7 * 24 * 60 * 60 * 1000) {
  const now = new Date();
  
  return connections.filter(conn => {
    const lastActive = conn.lastActivated || conn.createdAt || now;
    const inactiveTimeMs = now.getTime() - lastActive.getTime();
    const shouldPrune = inactiveTimeMs > inactivityThresholdMs && conn.strength < pruningThreshold;
    return !shouldPrune;
  });
}

function calculateNodeActivity(node, connections, allNodes, decayFactor = 0.9) {
  const baseActivity = node.score / 10;
  
  const relatedConnections = connections.filter(
    conn => conn.sourceNodeId === node.id || conn.targetNodeId === node.id
  );
  
  if (relatedConnections.length === 0) {
    return baseActivity;
  }
  
  const avgConnectionStrength = relatedConnections.reduce(
    (sum, conn) => sum + conn.strength, 
    0
  ) / relatedConnections.length;
  
  const connectedNodesActivity = relatedConnections.reduce((sum, conn) => {
    const connectedNodeId = conn.sourceNodeId === node.id ? conn.targetNodeId : conn.sourceNodeId;
    const connectedNode = allNodes.find(n => n.id === connectedNodeId);
    if (!connectedNode) return sum;
    
    return sum + (connectedNode.score / 10) * conn.strength;
  }, 0) / relatedConnections.length;
  
  return decayFactor * (baseActivity * 0.4 + avgConnectionStrength * 0.3 + connectedNodesActivity * 0.3);
}

function calculateNetworkState(nodes, connections) {
  const avgStrength = connections.length > 0 
    ? connections.reduce((sum, conn) => sum + conn.strength, 0) / connections.length 
    : 0;
  
  const avgScore = nodes.length > 0
    ? nodes.reduce((sum, node) => sum + node.score, 0) / nodes.length
    : 0;
    
  const connDensity = nodes.length > 1
    ? connections.length / (nodes.length * (nodes.length - 1) / 2)
    : 0;
    
  return {
    nodeCount: nodes.length,
    connectionCount: connections.length,
    averageStrength: avgStrength,
    averageScore: avgScore,
    connectionDensity: connDensity,
    timestamp: new Date()
  };
}

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

let connections = [
  {
    id: 'conn-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-3',
    strength: 0.5,
    reasoning: "両方のノードがAIの倫理的側面に言及している",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3日前
    lastActivated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-2',
    sourceNodeId: 'node-2',
    targetNodeId: 'node-4',
    strength: 0.4,
    reasoning: "技術的実装と選択基準の関連性",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3日前
    lastActivated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    activationCount: 1
  },
  {
    id: 'conn-3',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    strength: 0.1,
    reasoning: "弱い関連性",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10日前
    lastActivated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    activationCount: 1
  }
];

console.log('\n=== Initial State ===');
console.log('Nodes:', testNodes.length);
console.log('Connections:', connections.length);
const initialMetrics = calculateNetworkState(testNodes, connections);
console.log('Network Metrics:', JSON.stringify(initialMetrics, null, 2));

const cycles = 3;
const learningRate = 0.1;
const pruningThreshold = 0.2;
const inactivityThresholdMs = 7 * 24 * 60 * 60 * 1000; // 1週間
const decayFactor = 0.9;

console.log('\n=== Simulating Hebbian Learning Cycles ===');

for (let cycle = 1; cycle <= cycles; cycle++) {
  console.log(`\n--- Cycle ${cycle} ---`);
  
  const nodeActivities = new Map();
  testNodes.forEach(node => {
    const activity = calculateNodeActivity(node, connections, testNodes, decayFactor);
    nodeActivities.set(node.id, activity);
    console.log(`Node ${node.id} activity: ${activity.toFixed(3)}`);
  });
  
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
  
  const connectionCountBefore = connections.length;
  connections = pruneConnections(connections, pruningThreshold, inactivityThresholdMs);
  const prunedCount = connectionCountBefore - connections.length;
  
  if (prunedCount > 0) {
    console.log(`Pruned ${prunedCount} weak connections`);
  }
  
  const metrics = calculateNetworkState(testNodes, connections);
  console.log('Network Metrics:', JSON.stringify(metrics, null, 2));
}

console.log('\n=== Final State ===');
console.log('Nodes:', testNodes.length);
console.log('Connections:', connections.length);
connections.forEach(conn => {
  console.log(`Connection ${conn.sourceNodeId} ↔ ${conn.targetNodeId}: strength=${conn.strength.toFixed(3)}, activations=${conn.activationCount}`);
});

const finalMetrics = calculateNetworkState(testNodes, connections);
console.log('Final Network Metrics:', JSON.stringify(finalMetrics, null, 2));

console.log('\n=== Comparison ===');
console.log('Initial Average Strength:', initialMetrics.averageStrength.toFixed(3));
console.log('Final Average Strength:', finalMetrics.averageStrength.toFixed(3));
console.log('Strength Change:', (finalMetrics.averageStrength - initialMetrics.averageStrength).toFixed(3));
console.log('Initial Connection Count:', initialMetrics.connectionCount);
console.log('Final Connection Count:', finalMetrics.connectionCount);
