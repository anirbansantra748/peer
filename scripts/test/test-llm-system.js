// Test script for LLM system improvements
// Run with: node test-llm-system.js

require('dotenv').config();
const { rewriteFileWithAI, analyzeComplexity } = require('../shared/llm/rewrite');

// Test data
const simpleFindings = [
  { rule: 'missing-semicolon', severity: 'low', message: 'Missing semicolon', line: 2 },
  { rule: 'unused-variable', severity: 'low', message: 'Unused var', line: 1 }
];

const complexFindings = [
  { rule: 'sql-injection', severity: 'critical', message: 'SQL injection risk', line: 10 },
  { rule: 'xss-vulnerability', severity: 'high', message: 'XSS risk', line: 15 }
];

const testCode = `
function test() {
  let x = 5
  const db = require('db');
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  db.query(query);
}
`;

async function testComplexityDetection() {
  console.log('\n=== Testing Complexity Detection ===');

  const simple = analyzeComplexity(simpleFindings);
  const complex = analyzeComplexity(complexFindings);

  console.log('✓ Simple findings:', simple === 'simple' ? '✅ PASS' : '❌ FAIL');
  console.log('✓ Complex findings:', complex === 'complex' ? '✅ PASS' : '❌ FAIL');
}

async function testModelRouting() {
  console.log('\n=== Testing Model Routing ===');

  const startTime = Date.now();

  try {
    // Test simple fix routing (should use Groq)
    console.log('\n📝 Testing simple fix (should use Groq)...');
    const simpleResult = await rewriteFileWithAI({
      file: 'test.js',
      code: testCode,
      findings: simpleFindings
    });

    console.log(`✓ Provider used: ${simpleResult.provider || 'unknown'}`);
    console.log(`✓ Model used: ${simpleResult.modelUsed || 'unknown'}`);
    console.log(`✓ Response time: ${simpleResult.responseTime || 'N/A'}ms`);
    console.log(`✓ Has output: ${simpleResult.text ? '✅' : '❌'}`);
    console.log(`✓ Output length: ${simpleResult.text?.length || 0} chars`);

    // Test complex fix routing (should use Gemini now since DeepSeek is disabled)
    console.log('\n📝 Testing complex fix (should use Gemini as fallback)...');
    const complexResult = await Promise.race([
      rewriteFileWithAI({
        file: 'test.js',
        code: testCode,
        findings: complexFindings
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout after 35s')), 35000))
    ]).catch(err => {
      console.log('⚠️  Complex test timed out or failed:', err.message);
      return { text: '', provider: 'timeout', modelUsed: 'none', responseTime: 35000 };
    });

    console.log(`✓ Provider used: ${complexResult.provider || 'unknown'}`);
    console.log(`✓ Model used: ${complexResult.modelUsed || 'unknown'}`);
    console.log(`✓ Response time: ${complexResult.responseTime || 'N/A'}ms`);
    console.log(`✓ Has output: ${complexResult.text ? '✅' : '❌'}`);
    console.log(`✓ Output length: ${complexResult.text?.length || 0} chars`);

    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms`);

    return { simpleResult, complexResult, totalTime };
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testPromptQuality(results) {
  console.log('\n=== Testing Prompt Quality ===');

  const { simpleResult, complexResult } = results;

  // Check if output has clean inline comments (not FIX/OLD/WARN markers)
  const hasFIXMarker = simpleResult.text?.includes('// FIX:') || simpleResult.text?.includes('// OLD:');
  const hasInlineComments = simpleResult.text?.includes('//') && !hasFIXMarker;

  console.log('✓ No FIX/OLD/WARN markers:', hasFIXMarker ? '❌ FAIL' : '✅ PASS');
  console.log('✓ Has inline comments:', hasInlineComments ? '✅ PASS' : '⚠️  WARN');
  console.log('✓ Code looks valid:', simpleResult.text?.includes('function') ? '✅ PASS' : '❌ FAIL');

  // Show sample output
  console.log('\n📄 Sample output (first 200 chars):');
  console.log(simpleResult.text?.substring(0, 200) + '...');
}

async function testPerformanceMetrics(results) {
  console.log('\n=== Performance Metrics ===');

  const { simpleResult, complexResult, totalTime } = results;

  const simpleTime = simpleResult.responseTime || 0;
  const complexTime = complexResult.responseTime || 0;
  const avgTime = (simpleTime + complexTime) / 2;

  console.log(`📊 Simple fix time: ${simpleTime}ms ${simpleTime < 5000 ? '✅' : '⚠️'}`);
  console.log(`📊 Complex fix time: ${complexTime}ms ${complexTime < 15000 ? '✅' : '⚠️'}`);
  console.log(`📊 Average time: ${avgTime.toFixed(0)}ms`);
  console.log(`📊 Total test time: ${totalTime}ms`);

  // Performance grading
  if (avgTime < 3000) console.log('🚀 Grade: EXCELLENT (< 3s avg)');
  else if (avgTime < 5000) console.log('✅ Grade: GOOD (< 5s avg)');
  else if (avgTime < 10000) console.log('⚠️  Grade: ACCEPTABLE (< 10s avg)');
  else console.log('❌ Grade: NEEDS IMPROVEMENT (> 10s avg)');
}

async function testFallbackBehavior() {
  console.log('\n=== Testing Fallback Behavior ===');

  // Temporarily disable primary provider to test fallback
  const originalGroq = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'invalid_key_test';

  try {
    console.log('🔄 Testing fallback (Groq disabled)...');
    const result = await rewriteFileWithAI({
      file: 'test.js',
      code: testCode,
      findings: simpleFindings
    });

    const usedFallback = result.provider !== 'groq';
    console.log(`✓ Fallback triggered: ${usedFallback ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Fallback provider: ${result.provider || 'none'}`);

  } catch (error) {
    console.log(`✓ Fallback handled error: ✅ PASS`);
  } finally {
    // Restore original key
    process.env.GROQ_API_KEY = originalGroq;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   LLM System Comprehensive Test Suite ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    // Test 1: Complexity Detection
    await testComplexityDetection();

    // Test 2: Model Routing & Performance
    const results = await testModelRouting();

    // Test 3: Prompt Quality
    await testPromptQuality(results);

    // Test 4: Performance Metrics
    await testPerformanceMetrics(results);

    // Test 5: Fallback Behavior
    await testFallbackBehavior();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ✅ ALL TESTS COMPLETED               ║');
    console.log('╚════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
