/**
 * 加密文件存储策略
 * 修复OC-003: 使用AES-256-GCM加密存储凭证
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { SecureString } from '../../utils/secure-string.js';
import type { 
  ICredentialStorage, 
  CredentialMetadata,
  IMasterKeyStore 
} from '../../core/interfaces/storage.js';

/**
 * 加密文件存储配置
 */
export interface EncryptedFileStorageConfig {
  /** 存储目录 */
  storageDir: string;
  /** 主密钥存储 */
  keyStore: IMasterKeyStore;
  /** 算法 */
  algorithm?: 'aes-256-gcm';
}

/**
 * 存储文件结构
 */
interface StorageFile {
  version: number;
  entries: Record<string, EncryptedEntry>;
  metadata: Record<string, CredentialMetadata>;
}

/**
 * 加密条目
 */
interface EncryptedEntry {
  encryptedData: string;
  iv: string;
  tag: string;
  algorithm: string;
}

/**
 * 加密文件存储
 */
export class EncryptedFileStorage implements ICredentialStorage {
  private config: Required<EncryptedFileStorageConfig>;
  private cache: Map<string, SecureString> = new Map();
  private metadataCache: Map<string, CredentialMetadata> = new Map();
  private dataLoaded = false;
  
  constructor(config: EncryptedFileStorageConfig) {
    this.config = {
      algorithm: 'aes-256-gcm',
      ...config
    };
  }
  
  /**
   * 获取存储文件路径
   */
  private getStoragePath(): string {
    return path.join(this.config.storageDir, 'credentials.enc');
  }
  
  /**
   * 确保存储目录存在
   */
  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true, mode: 0o700 });
  }
  
  /**
   * 获取主密钥
   */
  private async getKey(): Promise<Buffer> {
    return this.config.keyStore.getKey();
  }
  
  /**
   * 加密数据
   */
  private async encrypt(plaintext: string, key: Buffer): Promise<EncryptedEntry> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      algorithm: this.config.algorithm
    };
  }
  
  /**
   * 解密数据
   */
  private async decrypt(entry: EncryptedEntry, key: Buffer): Promise<string> {
    const decipher: any = crypto.createDecipheriv(
      entry.algorithm,
      key,
      Buffer.from(entry.iv, 'base64')
    );
    
    if (entry.tag) {
      decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    }
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.encryptedData, 'base64')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
  
  /**
   * 加载存储数据
   */
  private async loadData(): Promise<StorageFile> {
    if (this.dataLoaded) {
      return {
        version: 1,
        entries: {},
        metadata: Object.fromEntries(this.metadataCache)
      };
    }
    
    try {
      const storagePath = this.getStoragePath();
      const data = await fs.readFile(storagePath, 'utf8');
      const parsed = JSON.parse(data) as StorageFile;
      
      // 加载元数据
      for (const [key, meta] of Object.entries(parsed.metadata || {})) {
        this.metadataCache.set(key, meta);
      }
      
      this.dataLoaded = true;
      return parsed;
      
    } catch (error) {
      // 文件不存在，返回空结构
      return {
        version: 1,
        entries: {},
        metadata: {}
      };
    }
  }
  
  /**
   * 保存存储数据
   */
  private async saveData(entries: Record<string, EncryptedEntry>): Promise<void> {
    await this.ensureDirectory();
    
    const data: StorageFile = {
      version: 1,
      entries,
      metadata: Object.fromEntries(this.metadataCache)
    };
    
    const storagePath = this.getStoragePath();
    const tempPath = `${storagePath}.tmp`;
    
    // 写入临时文件
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    
    // 原子重命名
    await fs.rename(tempPath, storagePath);
    
    // 设置严格权限
    await fs.chmod(storagePath, 0o600);
  }
  
  /**
   * 存储凭证
   */
  async store(key: string, value: SecureString): Promise<void> {
    const data = await this.loadData();
    const keyBuffer = await this.getKey();
    
    // 获取明文并加密
    const plaintext = await value.decrypt();
    const encrypted = await this.encrypt(plaintext, keyBuffer);
    
    // 更新条目
    data.entries[key] = encrypted;
    
    // 更新元数据
    const existingMeta = this.metadataCache.get(key);
    this.metadataCache.set(key, {
      createdAt: existingMeta?.createdAt || new Date(),
      updatedAt: new Date(),
      usageCount: existingMeta?.usageCount || 0,
      tags: existingMeta?.tags || []
    });
    
    // 保存到文件
    await this.saveData(data.entries);
    
    // 更新缓存
    this.cache.set(key, value);
  }
  
  /**
   * 检索凭证
   */
  async retrieve(key: string): Promise<SecureString | null> {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    
    const data = await this.loadData();
    const entry = data.entries[key];
    
    if (!entry) {
      return null;
    }
    
    const keyBuffer = await this.getKey();
    const plaintext = await this.decrypt(entry, keyBuffer);
    
    const secureString = await SecureString.fromPlaintext(plaintext);
    
    // 更新使用统计
    const meta = this.metadataCache.get(key);
    if (meta) {
      meta.usageCount++;
      meta.lastUsedAt = new Date();
      await this.saveData(data.entries);
    }
    
    // 更新缓存
    this.cache.set(key, secureString);
    
    return secureString;
  }
  
  /**
   * 删除凭证
   */
  async delete(key: string): Promise<void> {
    const data = await this.loadData();
    
    delete data.entries[key];
    this.metadataCache.delete(key);
    this.cache.delete(key);
    
    await this.saveData(data.entries);
  }
  
  /**
   * 轮换凭证
   */
  async rotate(key: string): Promise<void> {
    // 重新加密凭证
    const value = await this.retrieve(key);
    if (value) {
      await this.store(key, value);
    }
    
    await this.updateMetadata(key, { updatedAt: new Date() });
  }
  
  /**
   * 检查存在
   */
  async exists(key: string): Promise<boolean> {
    if (this.cache.has(key)) return true;
    
    const data = await this.loadData();
    return key in data.entries;
  }
  
  /**
   * 列出所有凭证键
   */
  async listKeys(): Promise<string[]> {
    const data = await this.loadData();
    return Object.keys(data.entries);
  }
  
  /**
   * 获取元数据
   */
  async getMetadata(key: string): Promise<CredentialMetadata | null> {
    return this.metadataCache.get(key) || null;
  }
  
  /**
   * 更新元数据
   */
  async updateMetadata(
    key: string, 
    metadata: Partial<CredentialMetadata>
  ): Promise<void> {
    const existing = this.metadataCache.get(key);
    
    if (existing) {
      Object.assign(existing, metadata);
    } else {
      this.metadataCache.set(key, {
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        tags: [],
        ...metadata
      });
    }
    
    const data = await this.loadData();
    await this.saveData(data.entries);
  }
  
  /**
   * 安全删除存储文件
   */
  async secureDelete(passes = 3): Promise<void> {
    const storagePath = this.getStoragePath();
    
    try {
      const stats = await fs.stat(storagePath);
      const size = stats.size;
      
      // 多次覆写
      for (let i = 0; i < passes; i++) {
        const randomData = crypto.randomBytes(size);
        await fs.writeFile(storagePath, randomData);
        await fsync(storagePath);
      }
      
      // 删除文件
      await fs.unlink(storagePath);
      
    } catch (error) {
      // 文件不存在，忽略
    }
  }
}

/**
 * fsync包装
 */
async function fsync(path: string): Promise<void> {
  const fd = await fs.open(path, 'r+');
  try {
    await fd.sync();
  } finally {
    await fd.close();
  }
}
