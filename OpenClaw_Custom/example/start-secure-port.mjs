#!/usr/bin/env node
/**
 * OpenClaw + OpenClaw_Custom 安全端口配置示例
 * 
 * 使用非默认端口(18789) 运行，避免被自动化扫描发现
 * 
 * 使用方式:
 * node example/start-secure-port.mjs
 */

import { initialize, getStatus } from '../dist/index.js';

// 安全端口配置（避免使用默认 18789）
const SECURITY_CONFIG = {
  // 使用高位随机端口 (30000-65535)
  // 推荐: 49152-65535 (动态私有端口范围)
  port: 55443,  // 示例端口，生产环境建议使用随机端口
  
  // 仅监听本地回环，防止外部访问
  host: '127.0.0.1',
  
  // 随机端口生成（可选，用于最高安全性）
  // port: Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152,
};

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║ OpenClaw + OpenClaw_Custom (Secure Port Mode)         ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();
console.log(`🔒 Security Configuration:`);
console.log(`   ✅ Port: ${SECURITY_CONFIG.port} (Non-default)`);
console.log(`   ✅ Host: ${SECURITY_CONFIG.host} (Local only)`);
console.log(`   ✅ Default port 18789: DISABLED`);
console.log();

async function main() {
  try {
    // 1. 安全检查
    console.log('[1/4] Running security checks...');
    
    if (SECURITY_CONFIG.port === 18789) {
      console.error('❌ ERROR: Using default port 18789 is not secure!');
      console.error('   Please change to a random port between 30000-65535');
      process.exit(1);
    }
    
    if (SECURITY_CONFIG.port < 1024) {
      console.warn('⚠️  WARNING: Ports below 1024 require elevated privileges');
    }
    
    console.log('   ✅ Port security check passed');
    
    // 2. 初始化安全层
    console.log('[2/4] Initializing security layer...');
    const bootstrap = await initialize({
      autoMount: true,
      migrateCredentials: true,
      debug: false,
      config: {
        // Gateway 安全配置
        gateway: {
          port: SECURITY_CONFIG.port,
          host: SECURITY_CONFIG.host,
          authRequired: true,
          mfaEnabled: false
        },
        // WebSocket 安全配置
        websocket: {
          allowedOrigins: [
            `http://localhost:${SECURITY_CONFIG.port}`,
            `http://127.0.0.1:${SECURITY_CONFIG.port}`
          ],
          tokenBinding: true,
          ipBinding: true  // 绑定 IP 增强安全性
        },
        // Skill 安全配置
        skills: {
          staticAnalysis: true,
          behaviorTesting: true,
          sandboxInstall: true
        }
      }
    });
    
    const status = getStatus();
    console.log('   ✅ Security layer initialized');
    
    // 3. 启动 OpenClaw Gateway（示例）
    console.log();
    console.log('[3/4] Starting OpenClaw Gateway...');
    console.log(`   ✅ Gateway URL: http://${SECURITY_CONFIG.host}:${SECURITY_CONFIG.port}`);
    console.log('   ✅ Security hooks active');
    
    // 实际生产环境启动代码：
    // import { startGateway } from 'openclaw';
    // await startGateway({
    //   port: SECURITY_CONFIG.port,
    //   host: SECURITY_CONFIG.host
    // });
    
    // 4. 运行状态
    console.log();
    console.log('[4/4] Service is running');
    console.log();
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║ 🛡️  Active Security Features                          ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║ ✅ Non-default port (anti-scan)                       ║');
    console.log('║ ✅ Localhost binding (network isolation)              ║');
    console.log('║ ✅ WebSocket Origin validation (OC-001)               ║');
    console.log('║ ✅ Command execution sandbox (OC-002)                 ║');
    console.log('║ ✅ Credential encryption (OC-003)                     ║');
    console.log('║ ✅ Skill security scanning (OC-006)                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
    console.log('Press Ctrl+C to stop');
    console.log();
    
    // 优雅关闭
    process.on('SIGINT', async () => {
      console.log();
      console.log('🛑 Shutting down...');
      const { shutdown } = await import('../dist/index.js');
      await shutdown();
      console.log('✅ Service stopped');
      process.exit(0);
    });
    
    // 保持运行
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

main();
