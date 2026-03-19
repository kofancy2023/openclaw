#!/usr/bin/env node
/**
 * OpenClaw + OpenClaw_Custom 集成启动示例
 * 
 * 使用方式:
 * node example/start-openclaw.mjs
 */

import { initialize, getStatus } from '../dist/index.js';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║    OpenClaw + OpenClaw_Custom Security Layer          ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

async function main() {
  try {
    // 1. 初始化安全层
    console.log('[1/3] Initializing security layer...');
    const bootstrap = await initialize({
      autoMount: true,
      migrateCredentials: true,
      debug: true,
      config: {
        websocket: {
          allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000'
          ],
          tokenBinding: true
        },
        skills: {
          staticAnalysis: true,
          behaviorTesting: true,
          sandboxInstall: true
        }
      }
    });
    
    const status = getStatus();
    console.log('   ✅ Security layer initialized');
    console.log('   ✅ Mitigations applied:', status.riskMitigationsApplied.join(', '));
    
    // 2. 启动OpenClaw（示例）
    console.log();
    console.log('[2/3] Starting OpenClaw with security layer...');
    console.log('   ℹ️ In production, you would import and start OpenClaw here');
    console.log('   ✅ Security hooks are now active and monitoring');
    
    // 示例: 如果OpenClaw已安装，可以这样启动
    // import { startGateway } from 'openclaw';
    // await startGateway();
    
    // 3. 保持运行
    console.log();
    console.log('[3/3] Running (Press Ctrl+C to stop)...');
    console.log();
    console.log('Security features active:');
    console.log('  ✅ WebSocket Origin validation (OC-001)');
    console.log('  ✅ Command execution sandbox (OC-002)');
    console.log('  ✅ Credential encryption (OC-003)');
    console.log('  ✅ Skill security scanning (OC-006)');
    console.log();
    
    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log();
      console.log('Shutting down...');
      const { shutdown } = await import('../dist/index.js');
      await shutdown();
      console.log('Goodbye!');
      process.exit(0);
    });
    
    // 无限等待
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

main();
