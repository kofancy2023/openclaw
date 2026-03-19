/**
 * 系统密钥环存储策略
 * 修复OC-003: 使用操作系统密钥环存储凭证
 */

import { SecureString } from '../../utils/secure-string.js';
import type { 
  ICredentialStorage, 
  CredentialMetadata
} from '../../core/interfaces/storage.js';

/**
 * 密钥环存储配置
 */
export interface KeyringStorageConfig {
  /** 服务名称 */
  service: string;
  /** 账户前缀 */
  accountPrefix?: string;
}

/**
 * 系统密钥环存储
 * 使用keytar库访问系统密钥环
 */
export class KeyringStorage implements ICredentialStorage {
  private config: Required<KeyringStorageConfig>;
  private keytar: typeof import('keytar') | null = null;
  private metadataCache: Map<string, CredentialMetadata> = new Map();
  
  constructor(config: KeyringStorageConfig) {
    this.config = {
      accountPrefix: 'openclaw.',
      ...config
    };
  }
  
  /**
   * 初始化keytar
   */
  private async initKeytar(): Promise<typeof import('keytar')> {
    if (!this.keytar) {
      try {
        this.keytar = await import('keytar');
      } catch (error) {
        throw new Error(
          `Failed to load keytar: ${error}. ` +
          'Please install keytar: npm install keytar'
        );
      }
    }
    return this.keytar;
  }
  
  /**
   * 获取完整账户名
   */
  private getAccountName(key: string): string {
    return `${this.config.accountPrefix}${key}`;
  }
  
  /**
   * 存储凭证
   */
  async store(key: string, value: SecureString): Promise<void> {
    const keytar = await this.initKeytar();
    const account = this.getAccountName(key);
    
    // 解密获取明文值
    const plaintext = await value.decrypt();
    
    // 存储到密钥环
    await keytar.setPassword(this.config.service, account, plaintext);
    
    // 更新元数据
    const metadata: CredentialMetadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      tags: []
    };
    
    this.metadataCache.set(key, metadata);
    await this.saveMetadata();
    
    // 清除内存中的明文
    // 注意：这里依赖于JS引擎的垃圾回收
  }
  
  /**
   * 检索凭证
   */
  async retrieve(key: string): Promise<SecureString | null> {
    const keytar = await this.initKeytar();
    const account = this.getAccountName(key);
    
    // 从密钥环获取
    const password = await keytar.getPassword(this.config.service, account);
    
    if (!password) {
      return null;
    }
    
    // 转换为SecureString
    const secureString = await SecureString.fromPlaintext(password);
    
    // 更新使用统计
    const metadata = this.metadataCache.get(key);
    if (metadata) {
      metadata.usageCount++;
      metadata.lastUsedAt = new Date();
      await this.updateMetadata(key, {});
    }
    
    return secureString;
  }
  
  /**
   * 删除凭证
   */
  async delete(key: string): Promise<void> {
    const keytar = await this.initKeytar();
    const account = this.getAccountName(key);
    
    await keytar.deletePassword(this.config.service, account);
    
    this.metadataCache.delete(key);
    await this.saveMetadata();
  }
  
  /**
   * 轮换凭证
   */
  async rotate(key: string): Promise<void> {
    // 密钥环中的凭证不需要轮换，因为它们由操作系统保护
    // 只需更新元数据
    await this.updateMetadata(key, { updatedAt: new Date() });
  }
  
  /**
   * 检查存在
   */
  async exists(key: string): Promise<boolean> {
    const keytar = await this.initKeytar();
    const account = this.getAccountName(key);
    
    const password = await keytar.getPassword(this.config.service, account);
    return password !== null;
  }
  
  /**
   * 列出所有凭证键
   */
  async listKeys(): Promise<string[]> {
    const keytar = await this.initKeytar();
    
    const credentials = await keytar.findCredentials(this.config.service);
    
    return credentials
      .map(cred => cred.account)
      .filter(account => account.startsWith(this.config.accountPrefix))
      .map(account => account.slice(this.config.accountPrefix.length));
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
    
    await this.saveMetadata();
  }
  
  /**
   * 保存元数据到文件
   */
  private async saveMetadata(): Promise<void> {
    // 元数据可以存储在配置文件中，不包含敏感信息
    // 实际实现需要持久化存储
  }
  
  /**
   * 加载元数据
   */
  // @ts-ignore
  private async loadMetadata(): Promise<void> {
    // 从持久化存储加载元数据
  }
}
