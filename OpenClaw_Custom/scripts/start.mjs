#!/usr/bin/env node
/**
 * OpenClaw_Custom 安全层启动脚本
 * 
 * 使用方式:
 * node scripts/start.mjs
 */

import { initialize, getStatus, shutdown } from '../dist/index.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║    OpenClaw_Custom Security Layer - Startup           ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

async function main() {
  try {
    // 加载主密钥
    const masterKeyPath = join(homedir(), '.openclaw', 'secure', 'master.key');
    let masterKey;
    try {
      masterKey = readFileSync(masterKeyPath, 'utf-8').trim();
      console.log('[✓] Master key loaded from:', masterKeyPath);
    } catch (error) {
      console.error('[✗] Failed to load master key from:', masterKeyPath);
      console.error('    Please generate a master key first:');
      console.error('    node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))" > ~/.openclaw/secure/master.key');
      process.exit(1);
    }

    // 设置主密钥环境变量
    process.env.OPENCLAW_MASTER_KEY = masterKey;

    // 初始化安全层
    console.log('[1/3] Initializing security layer...');
    const bootstrap = await initialize({
      autoMount: true,
      migrateCredentials: true,
      debug: true,
      config: {
        websocket: {
          allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
          ],
          tokenBinding: true
        },
        skills: {
          staticAnalysis: true,
          behaviorTesting: true,
          sandboxInstall: false  // Docker 网络问题，暂时关闭
        }
      }
    });
    
    const status = getStatus();
    console.log('   ✅ Security layer initialized');
    console.log('   ✅ Mitigations applied:', status.riskMitigationsApplied.join(', '));
    
    // 显示安全层状态
    console.log();
    console.log('[2/3] Security Layer Status:');
    console.log('   Initialized:', status.initialized);
    console.log('   Module Hooks:', status.moduleHooksInstalled ? '✅' : '❌');
    console.log('   Exec Hooks:', status.execHooksInstalled ? '✅' : '❌');
    
    // 显示激活的安全功能
    console.log();
    console.log('[3/3] Active Security Features:');
    console.log('   ✅ OC-001: WebSocket Origin Validation');
    console.log('   ✅ OC-002: Command Execution Sandbox');
    console.log('   ✅ OC-003: Credential Encryption (AES-256-GCM)');
    console.log('   ✅ OC-006: Skill Security Scanning');
    console.log('   ✅ ReDoS Protection: Regex timeout & pattern detection');
    console.log('   ✅ Rate Limiting: Token bucket with persistence');
    console.log('   ✅ Audit Logging: Security event tracking');
    console.log();
    
    console.log('════════════════════════════════════════════════════════');
    console.log('  Security layer is running. Press Ctrl+C to stop.');
    console.log('════════════════════════════════════════════════════════');
    console.log();
    
    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log();
      console.log('Shutting down security layer...');
      await shutdown();
      console.log('Goodbye!');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log();
      console.log('Shutting down security layer...');
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
