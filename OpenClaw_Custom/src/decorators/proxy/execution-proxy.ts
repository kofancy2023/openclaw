/**
 * 安全执行代理
 * 修复OC-002: 命令执行RCE漏洞
 */

import { IAuditLogger } from '../../core/interfaces/auth.js';
import type { 
  ISandbox, 
  SandboxOptions,
  // SandboxInstance,
  Command,
  ExecutionResult 
} from '../../core/interfaces/sandbox.js';

/**
 * 执行上下文
 */
export interface ExecutionContext {
  identity?: string;
  session?: string;
  sourceIp?: string;
  userAgent?: string;
  allowedPaths?: string[];
  networkPolicy?: 'allow' | 'deny' | 'monitor';
  timeout?: number;
}

/**
 * 命令解析结果
 */
export interface ParsedCommand {
  executable: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  redirects: Array<{ type: 'in' | 'out' | 'err'; target: string }>;
  pipes: boolean;
  subshell: boolean;
  dangerous: boolean;
  riskScore: number;
}

/**
 * 策略评估结果
 */
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  sandboxOptions?: SandboxOptions;
}

/**
 * 执行审计记录
 */
export interface ExecutionAuditRecord {
  executionId: string;
  command: string;
  context: ExecutionContext;
  startTime: Date;
  endTime?: Date;
  result?: ExecutionResult;
  error?: string;
  policyResult?: PolicyResult;
}

/**
 * 危险命令模式
 */
const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+-rf\s+\//, risk: 1.0, reason: 'System deletion' },
  { pattern: /mkfs\./, risk: 1.0, reason: 'Filesystem formatting' },
  { pattern: /dd\s+if=.*of=\/dev\//, risk: 1.0, reason: 'Direct disk write' },
  { pattern: />\s*\/etc\/passwd/, risk: 1.0, reason: 'Password file overwrite' },
  { pattern: /curl\s+.*\|\s*(?:sh|bash|zsh)/, risk: 0.9, reason: 'Remote code execution' },
  { pattern: /wget\s+.*\|\s*(?:sh|bash|zsh)/, risk: 0.9, reason: 'Remote code execution' },
  { pattern: /eval\s*\$/, risk: 0.8, reason: 'Dynamic evaluation' },
  { pattern: /exec\s*\$/, risk: 0.8, reason: 'Dynamic execution' },
  { pattern: /\$\(.*curl.*\)/, risk: 0.8, reason: 'Command substitution with curl' },
  { pattern: /\`.*curl.*\`/, risk: 0.8, reason: 'Backtick substitution with curl' },
  { pattern: /nc\s+-.*-e/, risk: 0.9, reason: 'Netcat backdoor' },
  { pattern: /bash\s+-i\s+>&/, risk: 0.9, reason: 'Reverse shell' },
  { pattern: /python.*-c.*socket/, risk: 0.8, reason: 'Python reverse shell' },
  { pattern: /perl.*-e.*socket/, risk: 0.8, reason: 'Perl reverse shell' }
];

/**
 * 允许的命令白名单
 */
const ALLOWED_COMMANDS = [
  'git',
  'node',
  'npm',
  'pnpm',
  'yarn',
  'docker',
  'kubectl',
  'terraform',
  'ansible',
  'pytest',
  'jest',
  'vitest',
  'eslint',
  'prettier',
  'tsc',
  'cargo',
  'go',
  'python',
  'python3',
  'pip',
  'pip3'
];

/**
 * 安全执行代理
 */
export class SecureExecutionProxy {
  private sandbox: ISandbox;
  private auditLogger?: IAuditLogger;
  private executionHistory: Map<string, ExecutionAuditRecord> = new Map();
  private useSandboxByDefault: boolean;
  
  constructor(
    sandbox: ISandbox,
    options: {
      auditLogger?: IAuditLogger;
      useSandboxByDefault?: boolean;
    } = {}
  ) {
    this.sandbox = sandbox;
    this.auditLogger = options.auditLogger;
    this.useSandboxByDefault = options.useSandboxByDefault ?? true;
  }
  
  /**
   * 执行命令
   */
  async execute(
    command: string,
    context: ExecutionContext = {}
  ): Promise<ExecutionResult> {
    const executionId = crypto.randomUUID();
    const startTime = new Date();
    
    // 创建审计记录
    const auditRecord: ExecutionAuditRecord = {
      executionId,
      command,
      context,
      startTime
    };
    
    this.executionHistory.set(executionId, auditRecord);
    
    try {
      // 1. 解析命令
      const parsed = this.parseCommand(command);
      
      // 2. 策略评估
      const policyResult = await this.evaluatePolicy(parsed, context);
      auditRecord.policyResult = policyResult;
      
      if (!policyResult.allowed) {
        const error = new Error(`Command blocked: ${policyResult.reason}`);
        await this.logBlockedExecution(auditRecord, error.message);
        throw error;
      }
      
      // 3. 记录开始执行
      await this.logExecutionStart(auditRecord);
      
      // 4. 执行命令（沙箱或直接）
      let result: ExecutionResult;
      
      if (this.useSandboxByDefault || parsed.dangerous) {
        result = await this.executeInSandbox(
          executionId,
          parsed,
          policyResult.sandboxOptions,
          context
        );
      } else {
        result = await this.executeDirectly(parsed, context);
      }
      
      // 5. 记录完成
      auditRecord.endTime = new Date();
      auditRecord.result = result;
      await this.logExecutionComplete(auditRecord);
      
      return result;
      
    } catch (error) {
      // 记录错误
      auditRecord.endTime = new Date();
      auditRecord.error = String(error);
      await this.logExecutionError(auditRecord, error);
      throw error;
    }
  }
  
  /**
   * 解析命令
   */
  private parseCommand(command: string): ParsedCommand {
    // 简单的命令解析（实际应该使用shell解析库）
    const trimmed = command.trim();
    
    // 检测危险模式
    let dangerous = false;
    let maxRisk = 0;
    const matchedPatterns: string[] = [];
    
    for (const { pattern, risk, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        dangerous = true;
        maxRisk = Math.max(maxRisk, risk);
        matchedPatterns.push(reason);
      }
    }
    
    // 检测管道和子shell
    const pipes = trimmed.includes('|') || trimmed.includes('||') || trimmed.includes('&&');
    const subshell = /\$\(|\`|\(.*\)/.test(trimmed);
    
    // 提取可执行文件
    const parts = trimmed.split(/\s+/);
    const executable = parts[0] || '';
    const args = parts.slice(1);
    
    return {
      executable,
      args,
      env: {},
      cwd: process.cwd(),
      redirects: [],
      pipes,
      subshell,
      dangerous,
      riskScore: maxRisk
    };
  }
  
  /**
   * 评估策略
   */
  private async evaluatePolicy(
    parsed: ParsedCommand,
    context: ExecutionContext
  ): Promise<PolicyResult> {
    // 1. 检查是否在白名单中
    if (!ALLOWED_COMMANDS.includes(parsed.executable)) {
      // 危险级别过高，拒绝
      if (parsed.riskScore > 0.7) {
        return {
          allowed: false,
          reason: `Command '${parsed.executable}' has high risk score: ${parsed.riskScore}`
        };
      }
    }
    
    // 2. 检查危险模式
    if (parsed.dangerous && parsed.riskScore > 0.8) {
      return {
        allowed: false,
        reason: 'Dangerous command pattern detected'
      };
    }
    
    // 3. 构建沙箱选项
    const sandboxOptions: SandboxOptions = {
      network: parsed.dangerous ? 'none' : context.networkPolicy || 'restricted',
      filesystem: parsed.dangerous ? 'readonly' : 'overlay',
      resources: {
        memory: '512m',
        cpu: '0.5',
        timeout: context.timeout || 300000
      },
      mounts: context.allowedPaths?.map(p => ({
        source: p,
        target: p,
        readonly: false
      }))
    };
    
    return {
      allowed: true,
      sandboxOptions
    };
  }
  
  /**
   * 在沙箱中执行
   */
  private async executeInSandbox(
    executionId: string,
    parsed: ParsedCommand,
    sandboxOptions: SandboxOptions = {},
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // 创建沙箱实例
    const instance = await this.sandbox.create({
      image: 'openclaw-sandbox:latest',
      network: 'none',
      ...sandboxOptions
    });
    
    try {
      // 执行命令
      const cmd: Command = {
        command: [parsed.executable, ...parsed.args],
        workingDir: parsed.cwd,
        env: parsed.env,
        timeout: context.timeout || 300000
      };
      
      return await this.sandbox.execute(instance, cmd);
      
    } finally {
      // 清理沙箱
      await this.sandbox.destroy(instance);
    }
  }
  
  /**
   * 直接执行（仅用于可信命令）
   */
  private async executeDirectly(
    parsed: ParsedCommand,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const child = spawn(parsed.executable, parsed.args, {
        cwd: parsed.cwd,
        env: { ...process.env, ...parsed.env },
        timeout: context.timeout || 300000
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          duration: Date.now() - startTime
        });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * 记录执行开始
   */
  private async logExecutionStart(record: ExecutionAuditRecord): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.log({
        id: record.executionId,
        type: 'COMMAND_EXECUTION',
        timestamp: record.startTime,
        severity: 'low',
        source: 'SecureExecutionProxy',
        subject: record.context.identity ? { id: record.context.identity, type: 'user', permissions: [], roles: [], issuedAt: new Date() } : undefined,
        action: 'execute',
        outcome: 'success',
        details: {
          command: record.command,
          session: record.context.session
        }
      });
    }
  }
  
  /**
   * 记录执行完成
   */
  private async logExecutionComplete(record: ExecutionAuditRecord): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.log({
        id: record.executionId,
        type: 'COMMAND_EXECUTION',
        timestamp: record.endTime!,
        severity: 'low',
        source: 'SecureExecutionProxy',
        outcome: 'success',
        details: {
          command: record.command,
          exitCode: record.result?.exitCode,
          duration: record.result?.duration
        }
      });
    }
  }
  
  /**
   * 记录执行错误
   */
  private async logExecutionError(
    record: ExecutionAuditRecord,
    error: unknown
  ): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.log({
        id: record.executionId,
        type: 'COMMAND_EXECUTION',
        timestamp: record.endTime!,
        severity: 'medium',
        source: 'SecureExecutionProxy',
        outcome: 'failure',
        details: {
          command: record.command,
          error: String(error)
        }
      });
    }
  }
  
  /**
   * 记录被阻止的执行
   */
  private async logBlockedExecution(
    record: ExecutionAuditRecord,
    reason: string
  ): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.log({
        id: record.executionId,
        type: 'COMMAND_BLOCKED',
        timestamp: new Date(),
        severity: 'high',
        source: 'SecureExecutionProxy',
        outcome: 'failure',
        details: {
          command: record.command,
          reason
        }
      });
    }
  }
  
  /**
   * 获取执行历史
   */
  getExecutionHistory(): ExecutionAuditRecord[] {
    return Array.from(this.executionHistory.values());
  }
  
  /**
   * 获取执行记录
   */
  getExecutionRecord(executionId: string): ExecutionAuditRecord | undefined {
    return this.executionHistory.get(executionId);
  }
}

import crypto from 'crypto';
