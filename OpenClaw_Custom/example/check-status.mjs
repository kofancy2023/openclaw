#!/usr/bin/env node
/**
 * 检查 OpenClaw + OpenClaw_Custom 运行状态
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║ OpenClaw + OpenClaw_Custom 状态检查                   ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

let hasError = false;

// 1. 检查安全层编译
const securityLayerPath = join(__dirname, '..', 'dist', 'index.js');
if (existsSync(securityLayerPath)) {
  console.log('✅ 安全层已编译');
} else {
  console.log('❌ 安全层未编译 (运行: npx tsc)');
  hasError = true;
}

// 2. 检查 openclaw.mjs 是否注入安全层
const openclawPath = join(__dirname, '..', '..', 'openclaw.mjs');
if (existsSync(openclawPath)) {
  const content = await import('fs').then(m => m.readFileSync(openclawPath, 'utf-8'));
  if (content.includes('OpenClaw_Custom/dist/index.js')) {
    console.log('✅ openclaw.mjs 已注入安全层');
  } else {
    console.log('⚠️  openclaw.mjs 未注入安全层');
    console.log('   提示: 运行 scripts/inject-security-layer.ps1');
  }
} else {
  console.log('❌ 找不到 openclaw.mjs');
  hasError = true;
}

console.log();
console.log('📊 OpenClaw 状态');

// 3. 检查 OpenClaw 版本
try {
  const version = execSync('node openclaw.mjs --version', { 
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf-8',
    timeout: 5000
  }).trim();
  console.log(`   版本: ${version}`);
} catch {
  console.log('   版本: 无法获取');
}

// 4. 检查 Gateway 是否运行
try {
  const status = execSync('node openclaw.mjs gateway status --json', {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf-8',
    timeout: 5000
  });
  const data = JSON.parse(status);
  console.log('   Gateway: 运行中');
  if (data.port) {
    console.log(`   端口: ${data.port}`);
  }
} catch {
  console.log('   Gateway: 未运行');
}

console.log();

// 5. 检查环境变量
console.log('🔧 环境变量:');
const envVars = ['OPENCLAW_GATEWAY_PORT', 'OPENCLAW_GATEWAY_HOST', 'OPENCLAW_SANDBOX_COMMANDS'];
envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ${varName}=${value}`);
  } else {
    console.log(`   ${varName}: 未设置`);
  }
});

console.log();

if (hasError) {
  console.log('❌ 检查失败，请修复上述问题');
  process.exit(1);
} else {
  console.log('✅ 检查完成');
  console.log();
  console.log('💡 快速命令');
  console.log('   启动: node OpenClaw_Custom/example/run-local.mjs');
  console.log('   状态: node openclaw.mjs gateway status');
  console.log('   诊断: node openclaw.mjs doctor');
}
