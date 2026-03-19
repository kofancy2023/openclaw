/**
 * OC-003 凭证加密缓解措施
 * 将明文存储的凭证迁移到加密存储
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SecureString } from '../utils/secure-string.js';
import type { ICredentialStorage } from '../core/interfaces/storage.js';

/**
 * 迁移报告
 */
export interface MigrationReport {
  migrated: Array<{ path: string; keys: string[] }>;
  failed: Array<{ path: string; keys: string[]; error: string }>;
  skipped: Array<{ path: string; keys: string[]; reason: string }>;
  summary: {
    totalFiles: number;
    migratedFiles: number;
    failedFiles: number;
    skippedFiles: number;
    totalKeys: number;
  };
}

/**
 * 凭证加密迁移工具
 */
export class CredentialEncryptionHardening {
  private storage: ICredentialStorage;
  private backupDir: string;
  
  constructor(
    storage: ICredentialStorage,
    backupDir?: string
  ) {
    this.storage = storage;
    this.backupDir = backupDir || path.join(os.homedir(), '.openclaw', 'backups');
  }
  
  /**
   * 从明文迁移到加密存储
   */
  async migrateFromPlaintext(): Promise<MigrationReport> {
    const report: MigrationReport = {
      migrated: [],
      failed: [],
      skipped: [],
      summary: {
        totalFiles: 0,
        migratedFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
        totalKeys: 0
      }
    };
    
    // 定义可能包含凭证的文件
    const plaintextPaths = [
      path.join(os.homedir(), '.openclaw', 'openclaw.json'),
      path.join(os.homedir(), '.openclaw', 'auth-profiles.json'),
      path.join(os.homedir(), '.openclaw', 'credentials.json')
    ];
    
    for (const filePath of plaintextPaths) {
      report.summary.totalFiles++;
      
      try {
        const result = await this.migrateFile(filePath);
        
        if (result.migrated) {
          report.migrated.push({ path: filePath, keys: result.keys });
          report.summary.migratedFiles++;
          report.summary.totalKeys += result.keys?.length ?? 0;
        } else {
          report.skipped.push({ path: filePath, keys: [], reason: result.reason || 'Unknown' });
          report.summary.skippedFiles++;
        }
        
      } catch (error) {
        report.failed.push({ 
          path: filePath,
          keys: [],
          error: String(error) 
        });
        report.summary.failedFiles++;
      }
    }
    
    return report;
  }
  
  /**
   * 迁移单个文件
   */
  private async migrateFile(filePath: string): Promise<{
    migrated: boolean;
    keys: string[];
    reason?: string;
  }> {
    // 检查文件是否存在
    if (!await this.fileExists(filePath)) {
      return { migrated: false, keys: [], reason: 'File not found' };
    }
    
    // 读取文件
    const content = await fs.readFile(filePath, 'utf8');
    
    // 解析JSON
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(content);
    } catch (error) {
      return { migrated: false, keys: [], reason: `Invalid JSON: ${error}` };
    }
    
    // 创建备份
    const backupPath = await this.createBackup(filePath);
    
    // 提取敏感字段
    const sensitiveKeys = this.extractSensitiveKeys(config);
    
    if (sensitiveKeys.length === 0) {
      return { migrated: false, keys: [], reason: 'No sensitive keys found' };
    }
    
    // 迁移每个敏感字段
    const migratedKeys: string[] = [];
    
    for (const key of sensitiveKeys) {
      const value = this.getNestedValue(config, key);
      
      if (value && typeof value === 'string') {
        // 创建安全字符串并存储
        const secureString = await SecureString.fromPlaintext(value);
        const storageKey = `config:${path.basename(filePath)}:${key}`;
        
        await this.storage.store(storageKey, secureString);
        
        // 替换为引用
        this.setNestedValue(config, key, {
          __ref: storageKey,
          __encrypted: true,
          __migrated: new Date().toISOString()
        });
        
        migratedKeys.push(key);
      }
    }
    
    // 写入加密后的配置
    await fs.writeFile(
      filePath,
      JSON.stringify(config, null, 2),
      { mode: 0o600 }  // 严格权限
    );
    
    console.log(`[OC-003] Migrated ${migratedKeys.length} keys from ${filePath}`);
    console.log(`[OC-003] Backup created at ${backupPath}`);
    
    return { migrated: true, keys: migratedKeys };
  }
  
  /**
   * 创建备份
   */
  private async createBackup(filePath: string): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true, mode: 0o700 });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      this.backupDir,
      `${path.basename(filePath)}.${timestamp}.bak`
    );
    
    await fs.copyFile(filePath, backupPath);
    await fs.chmod(backupPath, 0o600);
    
    return backupPath;
  }
  
  /**
   * 提取敏感字段
   */
  private extractSensitiveKeys(obj: unknown, prefix = ''): string[] {
    const keys: string[] = [];
    const sensitivePatterns = [
      /api[_-]?key/i,
      /apikey/i,
      /token/i,
      /password/i,
      /secret/i,
      /credential/i,
      /auth/i,
      /private[_-]?key/i,
      /access[_-]?token/i,
      /refresh[_-]?token/i
    ];
    
    const traverse = (current: unknown, path: string) => {
      if (typeof current !== 'object' || current === null) return;
      
      for (const [key, value] of Object.entries(current)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // 检查键名是否敏感
        if (sensitivePatterns.some(p => p.test(key))) {
          // 只存储字符串值
          if (typeof value === 'string' && value.length > 0) {
            keys.push(currentPath);
          }
        }
        
        // 递归检查嵌套对象
        if (typeof value === 'object' && value !== null) {
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(obj, prefix);
    return keys;
  }
  
  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((o: unknown, p: string) => {
      if (o && typeof o === 'object') {
        return (o as Record<string, unknown>)[p];
      }
      return undefined;
    }, obj);
  }
  
  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    
    const target = parts.reduce((o: unknown, p: string) => {
      if (o && typeof o === 'object') {
        const record = o as Record<string, unknown>;
        if (!(p in record)) {
          record[p] = {};
        }
        return record[p];
      }
      return undefined;
    }, obj);
    
    if (target && typeof target === 'object') {
      (target as Record<string, unknown>)[last] = value;
    }
  }
  
  /**
   * 检查文件存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 安全删除明文文件
   */
  async secureDelete(filePath: string, passes = 3): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const size = stats.size;
      
      // 多次覆写
      for (let pass = 0; pass < passes; pass++) {
        const randomData = crypto.randomBytes(size);
        await fs.writeFile(filePath, randomData);
        await fsync(filePath);
      }
      
      await fs.unlink(filePath);
      
      console.log(`[OC-003] Securely deleted ${filePath}`);
      
    } catch (error) {
      console.error(`[OC-003] Failed to delete ${filePath}:`, error);
    }
  }
  
  /**
   * 回滚迁移
   */
  async rollback(backupPath: string, originalPath: string): Promise<void> {
    await fs.copyFile(backupPath, originalPath);
    console.log(`[OC-003] Rolled back ${originalPath} from ${backupPath}`);
  }
}

/**
 * fsync包装
 */
async function fsync(filePath: string): Promise<void> {
  const fd = await fs.open(filePath, 'r+');
  try {
    await fd.sync();
  } finally {
    await fd.close();
  }
}

import crypto from 'crypto';
