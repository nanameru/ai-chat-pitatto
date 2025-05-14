const { execSync } = require('child_process');
const path = require('path');

console.log('Running ThoughtAggregation test...');

try {
  console.log('Compiling TypeScript...');
  execSync('npx tsc --esModuleInterop --skipLibCheck src/mastra/tests/thoughtAggregation.test.ts', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../../../')
  });
  
  console.log('Running test...');
  execSync('node src/mastra/tests/thoughtAggregation.test.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../../../')
  });
  
  console.log('Test completed successfully!');
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
