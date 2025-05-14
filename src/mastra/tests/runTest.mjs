// Simple test runner for thoughtAggregation.test.ts
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running ThoughtAggregation test...');

try {
  // Compile TypeScript to JavaScript
  console.log('Compiling TypeScript...');
  execSync('npx tsc --esModuleInterop --skipLibCheck src/mastra/tests/thoughtAggregation.test.ts', {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../../../')
  });
  
  // Run the compiled JavaScript
  console.log('Running test...');
  execSync('node src/mastra/tests/thoughtAggregation.test.js', {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../../../')
  });
  
  console.log('Test completed successfully!');
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
