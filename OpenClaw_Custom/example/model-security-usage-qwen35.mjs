#!/usr/bin/env node
/**
 * OpenClaw_Custom 模型安全层使用示例 - Qwen 3.5 版本
 * 
 * 本示例针对 Qwen 3.5 系列模型优化：
 * - qwen3.5:9b - 主力模型
 * - qwen3.5:0.8b - 轻量级模型
 * 
 * 使用方法:
 *   node example/model-security-usage-qwen35.mjs
 */

import {
  createSecurityLayer,
  initCredentialManager,
  EncryptionService
} from '../dist/core/model-security/index.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║ OpenClaw_Custom 模型安全层 - Qwen 3.5 示例            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // ============================================================
    // 步骤 1: 生成主密钥
    // ============================================================
    console.log('=== 步骤 1: 生成主密钥 ===');
    
    if (!process.env.OPENCLAW_MASTER_KEY) {
      const masterKey = EncryptionService.generateKey();
      console.log('⚠️  未设置 OPENCLAW_MASTER_KEY 环境变量');
      console.log('   建议生成并设置主密钥:');
      console.log(`   export OPENCLAW_MASTER_KEY="${masterKey}"`);
      console.log();
      
      // 示例中使用临时密钥
      process.env.OPENCLAW_MASTER_KEY = masterKey;
    }

    // ============================================================
    // 步骤 2: 初始化凭证管理器
    // ============================================================
    console.log('=== 步骤 2: 初始化凭证管理器 ===');
    
    const credentialManager = await initCredentialManager({
      storageType: 'memory'  // 示例使用内存存储
    });

    // 存储云端模型凭证（可选）
    await credentialManager.store('moonshot', {
      value: 'sk-example-moonshot-key',
      type: 'api-key'
    });

    console.log('✅ 已存储云端模型凭证');
    console.log();

    // ============================================================
    // 步骤 3: 创建并初始化安全层 - Qwen 3.5 配置
    // ============================================================
    console.log('=== 步骤 3: 创建安全层（Qwen 3.5 配置）===');
    
    const security = createSecurityLayer();
    
    await security.initialize({
      debug: true,
      config: {
        // 默认区域：本地
        defaultRegion: 'local',
        
        // 故障转移链：优先使用 Qwen 3.5
        failover: {
          chain: [
            { model: 'ollama/qwen3.5:9b', region: 'local' },    // 首选：9B 主力
            { model: 'ollama/qwen3.5:0.8b', region: 'local' },  // 备用：0.8B 轻量
            { model: 'moonshot/kimi-k2.5', region: 'cn' }       // 最后：云端备用
          ]
        },
        
        // 内容智能路由
        contentClassification: {
          enabled: true,
          rules: [
            {
              name: 'simple-chat',
              // 简单对话使用 0.8B（响应快）
              patterns: ['^你好$', '^谢谢$', '^再见$'],
              action: { 
                type: 'route', 
                target: 'ollama/qwen3.5:0.8b' 
              },
              priority: 90
            },
            {
              name: 'complex-task',
              // 复杂任务使用 9B（能力强）
              patterns: ['分析', '总结', '详细', '编程', '代码'],
              action: { 
                type: 'route', 
                target: 'ollama/qwen3.5:9b' 
              },
              priority: 80
            },
            {
              name: 'sensitive-data',
              // 敏感数据强制本地
              patterns: ['\\d{17}[\\dXx]', '身份证', '银行卡'],
              action: { 
                type: 'route', 
                target: 'ollama/qwen3.5:0.8b' 
              },
              priority: 100
            }
          ]
        },
        
        // 访问控制
        accessControl: {
          enabled: true,
          permissions: [
            {
              role: 'developer',
              allow: ['ollama/qwen3.5:*', 'moonshot/*'],
              deny: []
            }
          ]
        }
      }
    });

    console.log('✅ 安全层初始化完成');
    console.log();

    // ============================================================
    // 步骤 4: 测试智能模型路由
    // ============================================================
    console.log('=== 步骤 4: Qwen 3.5 智能模型路由测试 ===');
    
    // 测试 1: 简单对话 → 0.8B
    const suggestion1 = await security.suggestModel('你好', {
      userId: 'user-001',
      role: 'developer'
    });
    console.log(`内容: "你好"`);
    console.log(`建议模型: ${suggestion1.model}`);
    console.log(`原因: ${suggestion1.reason}`);
    console.log();

    // 测试 2: 复杂任务 → 9B
    const suggestion2 = await security.suggestModel(
      '请详细分析这个技术方案',
      { userId: 'user-001', role: 'developer' }
    );
    console.log(`内容: "请详细分析这个技术方案"`);
    console.log(`建议模型: ${suggestion2.model}`);
    console.log(`原因: ${suggestion2.reason}`);
    console.log();

    // 测试 3: 敏感数据 → 0.8B（本地处理）
    const suggestion3 = await security.suggestModel(
      '我的身份证号是 110101199001011234',
      { userId: 'user-001', role: 'developer' }
    );
    console.log(`内容: "我的身份证号是 110101199001011234..."`);
    console.log(`建议模型: ${suggestion3.model}`);
    console.log(`原因: ${suggestion3.reason}`);
    console.log(`⚠️ 敏感数据自动使用本地 Qwen 3.5！`);
    console.log();

    // 测试 4: 编程任务 → 9B
    const suggestion4 = await security.suggestModel(
      '帮我写一个 Python 排序算法',
      { userId: 'user-001', role: 'developer' }
    );
    console.log(`内容: "帮我写一个 Python 排序算法"`);
    console.log(`建议模型: ${suggestion4.model}`);
    console.log(`原因: ${suggestion4.reason}`);
    console.log();

    // ============================================================
    // 步骤 5: 执行模型切换
    // ============================================================
    console.log('=== 步骤 5: 执行模型切换 ===');
    
    // 切换到 Qwen 3.5 9B
    const result1 = await security.switchModel({
      targetModel: 'ollama/qwen3.5:9b',
      userId: 'user-001',
      sessionId: 'session-001',
      reason: 'user-request'
    });
    
    console.log(`请求切换: ollama/qwen3.5:9b`);
    console.log(`结果: ${result1.success ? '✅ 成功' : '❌ 失败'}`);
    if (result1.success) {
      console.log(`实际模型: ${result1.actualModel}`);
    }
    console.log();

    // ============================================================
    // 步骤 6: 获取状态
    // ============================================================
    console.log('=== 步骤 6: 当前状态 ===');
    
    const status = security.getStatus();
    console.log(`初始化状态: ${status.initialized}`);
    console.log(`活跃模型: ${status.activeModel || 'none'}`);
    console.log(`已注册策略: ${status.policies.join(', ')}`);
    console.log();

    // ============================================================
    // 步骤 7: 清理
    // ============================================================
    console.log('=== 清理 ===');
    await security.shutdown();
    console.log('✅ 安全层已关闭');
    console.log();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║ Qwen 3.5 示例运行完成！                               ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
    console.log('提示：确保已拉取 Qwen 3.5 模型：');
    console.log('  ollama pull qwen3.5:9b');
    console.log('  ollama pull qwen3.5:0.8b');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行示例
main();
