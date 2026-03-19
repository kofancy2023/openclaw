#!/usr/bin/env node
/**
 * OpenClaw_Custom 模型安全层使用示例
 * 
 * 展示如何：
 * 1. 初始化安全层
 * 2. 配置凭证
 * 3. 执行安全的模型切换
 * 4. 内容智能路由
 */

import {
  createSecurityLayer,
  initCredentialManager,
  EncryptionService
} from '../dist/core/model-security/index.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  OpenClaw_Custom 模型安全层使用示例                     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // ============================================================
    // 步骤 1: 生成主密钥（首次使用）
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
      storageType: 'memory'  // 示例使用内存存储，生产环境使用 'file'
    });

    // 存储模型凭证
    await credentialManager.store('moonshot', {
      value: 'sk-example-moonshot-key',
      type: 'api-key'
    });

    await credentialManager.store('anthropic', {
      value: 'sk-example-anthropic-key',
      type: 'api-key'
    });

    console.log('✓ 已存储 moonshot 和 anthropic 的凭证');
    console.log();

    // ============================================================
    // 步骤 3: 创建并初始化安全层
    // ============================================================
    console.log('=== 步骤 3: 创建并初始化安全层 ===');
    
    const security = createSecurityLayer();
    
    await security.initialize({
      debug: true,
      config: {
        // 故障转移链
        failover: {
          chain: [
            { model: 'moonshot/kimi-k2.5', region: 'cn' },
            { model: 'ollama/qwen3.5:9b', region: 'local' },
            { model: 'anthropic/claude-sonnet-4-5', region: 'global' }
          ]
        },
        
        // 内容分类规则
        contentClassification: {
          enabled: true,
          rules: [
            {
              name: 'sensitive-data',
              patterns: ['\\d{17}[\\dXx]', '身份证', '银行卡'],
              action: { type: 'route', target: 'ollama/qwen3.5:9b' },
              priority: 100
            },
            {
              name: 'code-task',
              patterns: ['编程', '写代码', 'debug'],
              action: { type: 'route', target: 'kimi-coding/k2p5' },
              priority: 50
            }
          ]
        },
        
        // 访问控制
        accessControl: {
          enabled: true,
          permissions: [
            {
              role: 'developer',
              allow: ['moonshot/*', 'ollama/*', 'anthropic/claude-sonnet-4-5'],
              deny: ['anthropic/claude-opus-4-6']
            }
          ]
        }
      }
    });

    console.log('✓ 安全层初始化完成');
    console.log();

    // ============================================================
    // 步骤 4: 获取建议的模型
    // ============================================================
    console.log('=== 步骤 4: 智能模型建议 ===');
    
    // 示例 1: 普通对话
    const suggestion1 = await security.suggestModel('你好，请介绍一下自己', {
      userId: 'user-001',
      role: 'developer'
    });
    console.log(`内容: "你好，请介绍一下自己"`);
    console.log(`建议模型: ${suggestion1.model}`);
    console.log(`原因: ${suggestion1.reason}`);
    console.log();

    // 示例 2: 包含敏感数据
    const suggestion2 = await security.suggestModel(
      '我的身份证号是 110101199001011234，请帮我分析',
      { userId: 'user-001', role: 'developer' }
    );
    console.log(`内容: "我的身份证号是 110101199001011234..."`);
    console.log(`建议模型: ${suggestion2.model}`);
    console.log(`原因: ${suggestion2.reason}`);
    console.log(`⚠️  敏感数据被自动路由到本地模型！`);
    console.log();

    // 示例 3: 编程任务
    const suggestion3 = await security.suggestModel(
      '请帮我写一个快速排序的代码',
      { userId: 'user-001', role: 'developer' }
    );
    console.log(`内容: "请帮我写一个快速排序的代码"`);
    console.log(`建议模型: ${suggestion3.model}`);
    console.log(`原因: ${suggestion3.reason}`);
    console.log();

    // ============================================================
    // 步骤 5: 执行模型切换
    // ============================================================
    console.log('=== 步骤 5: 执行模型切换 ===');
    
    // 正常切换
    const result1 = await security.switchModel({
      targetModel: 'moonshot/kimi-k2.5',
      userId: 'user-001',
      sessionId: 'session-001',
      reason: 'user-request'
    });
    
    console.log(`请求切换: moonshot/kimi-k2.5`);
    console.log(`结果: ${result1.success ? '✓ 成功' : '✗ 失败'}`);
    if (result1.success) {
      console.log(`实际模型: ${result1.actualModel}`);
    }
    console.log();

    // 尝试切换被禁止的模型
    console.log('测试访问控制...');
    const result2 = await security.switchModel({
      targetModel: 'anthropic/claude-opus-4-6',
      userId: 'user-001',
      sessionId: 'session-001',
      role: 'developer'
    });
    
    console.log(`请求切换: anthropic/claude-opus-4-6 (被禁止)`);
    console.log(`结果: ${result2.success ? '✓ 成功' : '✗ 失败'}`);
    if (!result2.success) {
      console.log(`错误: ${result2.error}`);
    }
    console.log();

    // ============================================================
    // 步骤 6: 获取状态信息
    // ============================================================
    console.log('=== 步骤 6: 当前状态 ===');
    
    const status = security.getStatus();
    console.log(`初始化状态: ${status.initialized}`);
    console.log(`活跃模型: ${status.activeModel || 'none'}`);
    console.log(`已注册策略: ${status.policies.join(', ')}`);
    console.log();

    // ============================================================
    // 步骤 7: 监听事件
    // ============================================================
    console.log('=== 步骤 7: 事件监听 ===');
    
    security.on('model-switch', (event) => {
      console.log(`[事件] 模型切换: ${event.payload.from} -> ${event.payload.to}`);
    });

    security.on('policy-violation', (event) => {
      console.log(`[事件] 策略违规: ${event.payload.reason}`);
    });

    // 测试触发事件
    await security.switchModel({
      targetModel: 'moonshot/kimi-k2.5',
      userId: 'user-001',
      sessionId: 'session-002',
      reason: 'testing-event'
    });
    console.log();

    // ============================================================
    // 步骤 8: 获取凭证
    // ============================================================
    console.log('=== 步骤 8: 凭证管理 ===');
    
    const credential = await credentialManager.retrieve('moonshot');
    if (credential) {
      console.log(`moonshot 凭证类型: ${credential.type}`);
      console.log(`凭证值: ${credential.value.substring(0, 10)}...`);
      
      // 安全地使用凭证调用 API
      // await callModelAPI('moonshot/kimi-k2.5', credential.value);
    }
    
    const providers = await credentialManager.listProviders();
    console.log(`已配置的提供者: ${providers.join(', ')}`);
    console.log();

    // ============================================================
    // 清理
    // ============================================================
    console.log('=== 清理 ===');
    await security.shutdown();
    console.log('✓ 安全层已关闭');
    console.log();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  示例运行完成！                                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行示例
main();
