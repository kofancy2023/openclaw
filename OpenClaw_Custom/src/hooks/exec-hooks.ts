/**
 * 执行Hook系统
 * 拦截child_process、fs等敏感操作
 */

import { ISecurityEventBus, SecurityEventType } from '../core/interfaces/security.js';
import { createRequire } from 'module';

/**
 * 执行Hook系统
 */
export class ExecutionHookSystem {
  private patches: Map<string, () => void> = new Map();
  private eventBus?: ISecurityEventBus;
  private installed = false;
  
  // 原始方法备份
  private originalExec?: Function;
  private originalExecSync?: Function;
  private originalSpawn?: Function;
  private originalReadFile?: Function;
  private originalWriteFile?: Function;
  
  constructor(eventBus?: ISecurityEventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * 安装钩子
   */
  install(): void {
    if (this.installed) {
      console.warn('[ExecutionHookSystem] Already installed');
      return;
    }
    
    // 拦截child_process
    this.patchChildProcess();
    
    // 拦截fs模块
    this.patchFileSystem();
    
    // 拦截JSON方法
    this.patchJSON();
    
    this.installed = true;
    console.log('[ExecutionHookSystem] Installed successfully');
    
    this.emitEvent('EXEC_HOOK_INSTALLED', {});
  }
  
  /**
   * 卸载钩子
   */
  uninstall(): void {
    if (!this.installed) {
      return;
    }
    
    // 恢复所有补丁
    for (const [, restore] of this.patches) {
      restore();
    }
    
    this.patches.clear();
    this.installed = false;
    
    console.log('[ExecutionHookSystem] Uninstalled successfully');
    
    this.emitEvent('EXEC_HOOK_UNINSTALLED', {});
  }
  
  /**
   * 拦截child_process
   */
  private patchChildProcess(): void {
    try {
      const require = createRequire(import.meta.url);
      const cp = require('child_process');
      
      // 保存原始方法
      this.originalExec = cp.exec;
      this.originalExecSync = cp.execSync;
      this.originalSpawn = cp.spawn;
      
      const self = this;
      
      // 包装exec
      cp.exec = function(
        command: string,
        options?: unknown,
        callback?: (error: Error | null, stdout: string, stderr: string) => void
      ) {
        const sanitized = self.sanitizeCommand(command);
        
        if (!sanitized.allowed) {
          const error = new Error(`Command blocked: ${sanitized.reason}`);
          self.emitEvent('COMMAND_BLOCKED', { command, reason: sanitized.reason });
          
          if (typeof options === 'function') {
            options(error, '', '');
            return undefined;
          } else if (callback) {
            callback(error, '', '');
            return undefined;
          }
          throw error;
        }
        
        self.emitEvent('COMMAND_EXECUTION', { 
          original: command,
          sanitized: sanitized.command 
        });
        
        const finalCommand = sanitized.command || command;
        
        if (typeof options === 'function') {
          return self.originalExec!.call(cp, finalCommand, options);
        }
        return self.originalExec!.call(cp, finalCommand, options, callback);
      };
      
      // 包装execSync
      cp.execSync = function(command: string, options?: unknown) {
        const sanitized = self.sanitizeCommand(command);
        
        if (!sanitized.allowed) {
          self.emitEvent('COMMAND_BLOCKED', { command, reason: sanitized.reason });
          throw new Error(`Command blocked: ${sanitized.reason}`);
        }
        
        const finalCommand = sanitized.command || command;
        return self.originalExecSync!.call(cp, finalCommand, options);
      };
      
      // 包装spawn
      cp.spawn = function(command: string, args?: string[], options?: unknown) {
        const fullCommand = `${command} ${args?.join(' ') || ''}`;
        const sanitized = self.sanitizeCommand(fullCommand);
        
        if (!sanitized.allowed) {
          self.emitEvent('COMMAND_BLOCKED', { command: fullCommand, reason: sanitized.reason });
          throw new Error(`Command blocked: ${sanitized.reason}`);
        }
        
        return self.originalSpawn!.call(cp, command, args, options);
      };
      
      // 注册恢复函数
      this.patches.set('child_process', () => {
        cp.exec = this.originalExec;
        cp.execSync = this.originalExecSync;
        cp.spawn = this.originalSpawn;
      });
      
    } catch (error) {
      console.error('[ExecutionHookSystem] Failed to patch child_process:', error);
    }
  }
  
  /**
   * 拦截文件系统
   */
  private patchFileSystem(): void {
    try {
      const require = createRequire(import.meta.url);
      const fs = require('fs');
      
      this.originalReadFile = fs.readFile;
      this.originalWriteFile = fs.writeFile;
      
      const self = this;
      const sensitivePatterns = [
        /\.openclaw[\\/]auth-profiles\.json/,
        /\.openclaw[\\/]openclaw\.json/,
        /\.ssh[\\/]/,
        /\.aws[\\/]/,
        /\.docker[\\/]config\.json/,
        /id_rsa/,
        /\.env/
      ];
      
      // 包装readFile
      fs.readFile = function(
        path: string,
        options?: unknown,
        callback?: (err: Error | null, data: Buffer) => void
      ) {
        if (self.isSensitivePath(path, sensitivePatterns)) {
          self.emitEvent('SENSITIVE_FILE_ACCESS', { path, operation: 'read' });
        }
        
        if (typeof options === 'function') {
          return self.originalReadFile!.call(fs, path, options);
        }
        return self.originalReadFile!.call(fs, path, options, callback);
      };
      
      // 包装writeFile
      fs.writeFile = function(
        path: string,
        data: string | Buffer,
        options?: unknown,
        callback?: (err: Error | null) => void
      ) {
        if (self.isSensitivePath(path, sensitivePatterns)) {
          self.emitEvent('SENSITIVE_FILE_ACCESS', { path, operation: 'write' });
        }
        
        if (typeof options === 'function') {
          return self.originalWriteFile!.call(fs, path, data, options);
        }
        return self.originalWriteFile!.call(fs, path, data, options, callback);
      };
      
      // 注册恢复函数
      this.patches.set('fs', () => {
        fs.readFile = this.originalReadFile;
        fs.writeFile = this.originalWriteFile;
      });
      
    } catch (error) {
      console.error('[ExecutionHookSystem] Failed to patch fs:', error);
    }
  }
  
  /**
   * 拦截JSON方法
   */
  private patchJSON(): void {
    const originalParse = JSON.parse;
    const originalStringify = JSON.stringify;
    
    const self = this;
    
    JSON.parse = function(text: string, reviver?: (key: string, value: unknown) => unknown) {
      // 大小限制检查
      if (text.length > 10 * 1024 * 1024) { // 10MB
        self.emitEvent('JSON_PARSE_ERROR', { reason: 'Payload too large' });
        throw new Error('JSON payload too large');
      }
      
      try {
        return originalParse(text, reviver);
      } catch (error) {
        self.emitEvent('JSON_PARSE_ERROR', { error: String(error) });
        throw error;
      }
    };
    
    // 注册恢复函数
    this.patches.set('json', () => {
      JSON.parse = originalParse;
      JSON.stringify = originalStringify;
    });
  }
  
  /**
   * 净化命令
   */
  private sanitizeCommand(command: string): { allowed: boolean; command?: string; reason?: string } {
    // 危险模式检查
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//, reason: 'Dangerous deletion pattern' },
      { pattern: />\s*\/dev\/null.*&&.*rm/, reason: 'Suspicious redirect and delete' },
      { pattern: /curl\s+[^|]+\|\s*(?:sh|bash|zsh)/, reason: 'Remote code execution via curl' },
      { pattern: /wget\s+[^|]+\|\s*(?:sh|bash|zsh)/, reason: 'Remote code execution via wget' },
      { pattern: /eval\s*\(.*\$/, reason: 'Dynamic eval usage' },
      { pattern: /`.*`/, reason: 'Command substitution' },
      { pattern: /\$\(.*\)/, reason: 'Subshell execution' }
    ];
    
    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(command)) {
        return { allowed: false, reason };
      }
    }
    
    return { allowed: true, command };
  }
  
  /**
   * 检查敏感路径
   */
  private isSensitivePath(path: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(path));
  }
  
  /**
   * 发送事件
   */
  private emitEvent(type: string, details: Record<string, unknown>): void {
    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: type as SecurityEventType,
        timestamp: new Date(),
        severity: 'medium',
        source: 'ExecutionHookSystem',
        details
      });
    }
  }
  
  /**
   * 获取状态
   */
  getStatus(): { installed: boolean; patchCount: number } {
    return {
      installed: this.installed,
      patchCount: this.patches.size
    };
  }
}

import crypto from 'crypto';
