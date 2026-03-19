#!/usr/bin/env node
/**
 * OpenClaw + OpenClaw_Custom 本地运行脚本
 * 
 * 使用方法:
 *   node example/run-local.mjs [port]
 * 
 * 示例:
 *   node example/run-local.mjs           # 使用随机端口
 *   node example/run-local.mjs 55443     # 使用指定端口
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析参数
const customPort = process.argv[2];
const PORT = customPort || (Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║ OpenClaw + OpenClaw_Custom 本地启动                   ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

// 检查安全层是否编译
const securityLayerPath = join(__dirname, '..', 'dist', 'index.js');
if (!existsSync(securityLayerPath)) {
  console.error('❌ 错误: 安全层未编译');
  console.error('   请先运行: npx tsc');
  process.exit(1);
}

// 检查是否在 openclaw 根目录
const openclawPath = join(__dirname, '..', '..', 'openclaw.mjs');
if (!existsSync(openclawPath)) {
  console.error('❌ 错误: 找不到 openclaw.mjs');
  console.error('   请确保你在 openclaw 项目的 OpenClaw_Custom 目录中运行');
  process.exit(1);
}

console.log(`🔒 安全配置:`);
console.log(`   ✅ 端口: ${PORT} (非默认)`);
console.log(`   ✅ 地址: 127.0.0.1 (仅本地)`);
console.log(`   ✅ 安全层: ${securityLayerPath}`);
console.log();

// 设置环境变量
process.env.OPENCLAW_GATEWAY_PORT = String(PORT);
process.env.OPENCLAW_GATEWAY_HOST = '127.0.0.1';

console.log('🚀 正在启动 OpenClaw Gateway...');
console.log(`   命令: node openclaw.mjs gateway run --port ${PORT}`);
console.log();

// 启动 OpenClaw Gateway
const openclawRoot = join(__dirname, '..', '..');
const gateway = spawn('node', ['openclaw.mjs', 'gateway', 'run', '--port', String(PORT), '--bind', '127.0.0.1'], {
  cwd: openclawRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    OPENCLAW_CUSTOM_ENABLED: 'true',
    OPENCLAW_GATEWAY_PORT: String(PORT),
    OPENCLAW_GATEWAY_HOST: '127.0.0.1'
  }
});

gateway.on('error', (err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});

gateway.on('exit', (code) => {
  if (code !== 0) {
    console.log(`\n⚠️ Gateway 退出，代码: ${code}`);
  }
  process.exit(code);
});

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 正在关闭...');
  gateway.kill('SIGINT');
});
