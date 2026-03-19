/**
 * 安全字符串实现
 * 防止敏感数据在内存中明文暴露
 */

import crypto from 'crypto';

/**
 * 安全字符串选项
 */
export interface SecureStringOptions {
  /** 算法 */
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc';
  /** 编码 */
  encoding?: BufferEncoding;
}

/**
 * 安全字符串类
 * 实现敏感数据的安全存储和自动清理
 */
export class SecureString {
  private encryptedData: Buffer;
  private iv: Buffer;
  private tag?: Buffer;
  private algorithm: string;
  private _cleared = false;
  private accessCount = 0;
  private createdAt: Date;
  private lastAccessedAt?: Date;
  
  private static masterKey: Buffer | null = null;
  
  private constructor(
    encryptedData: Buffer,
    iv: Buffer,
    tag: Buffer | undefined,
    algorithm: string
  ) {
    this.encryptedData = encryptedData;
    this.iv = iv;
    this.tag = tag;
    this.algorithm = algorithm;
    this.createdAt = new Date();
  }
  
  /**
   * 从明文创建安全字符串
   */
  static async fromPlaintext(
    plaintext: string,
    options: SecureStringOptions = {}
  ): Promise<SecureString> {
    const algorithm = options.algorithm || 'aes-256-gcm';
    const key = await SecureString.getMasterKey();
    
    const iv = crypto.randomBytes(16);
    
    if (algorithm === 'aes-256-gcm') {
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      const tag = cipher.getAuthTag();
      
      return new SecureString(encrypted, iv, tag, algorithm);
    } else {
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      return new SecureString(encrypted, iv, undefined, algorithm);
    }
  }
  
  /**
   * 从加密数据恢复
   */
  static fromEncrypted(
    encryptedData: Buffer,
    iv: Buffer,
    tag: Buffer | undefined,
    algorithm = 'aes-256-gcm'
  ): SecureString {
    return new SecureString(encryptedData, iv, tag, algorithm);
  }
  
  /**
   * 解密获取明文
   */
  async decrypt(): Promise<string> {
    if (this._cleared) {
      throw new Error('SecureString has been cleared');
    }
    
    const key = await SecureString.getMasterKey();
    
    let decipher: crypto.Decipher;
    
    if (this.algorithm === 'aes-256-gcm') {
      if (!this.tag) {
        throw new Error('Auth tag missing for GCM mode');
      }
      decipher = crypto.createDecipheriv(this.algorithm, key, this.iv) as any;
      (decipher as any).setAuthTag(this.tag);
    } else {
      decipher = crypto.createDecipheriv(this.algorithm, key, this.iv);
    }
    
    const decrypted = Buffer.concat([
      decipher.update(this.encryptedData),
      decipher.final()
    ]);
    
    this.accessCount++;
    this.lastAccessedAt = new Date();
    
    return decrypted.toString('utf8');
  }
  
  /**
   * 获取哈希值（用于比较）
   */
  async hash(): Promise<string> {
    const plaintext = await this.decrypt();
    return crypto.createHash('sha256').update(plaintext).digest('hex');
  }
  
  /**
   * 安全清除内存
   */
  clear(): void {
    // 覆写加密数据
    this.encryptedData.fill(0);
    // 安全清除
    this.encryptedData = Buffer.alloc(0);
    this.iv = Buffer.alloc(0);
    this.tag = undefined;
    
    this._cleared = true;
  }
  
  /**
   * 是否已清除
   */
  isCleared(): boolean {
    return this._cleared;
  }
  
  /**
   * 获取访问统计
   */
  getStats(): {
    accessCount: number;
    createdAt: Date;
    lastAccessedAt?: Date;
    cleared: boolean;
  } {
    return {
      accessCount: this.accessCount,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
      cleared: this._cleared
    };
  }
  
  /**
   * 设置主密钥
   */
  static setMasterKey(key: Buffer): void {
    if (key.length !== 32) {
      throw new Error('Master key must be 32 bytes (256 bits)');
    }
    SecureString.masterKey = key;
  }
  
  /**
   * 生成主密钥
   */
  static generateMasterKey(): Buffer {
    return crypto.randomBytes(32);
  }
  
  /**
   * 获取或生成主密钥
   */
  private static async getMasterKey(): Promise<Buffer> {
    if (!SecureString.masterKey) {
      // 生成临时密钥（实际应该存储在安全位置）
      SecureString.masterKey = SecureString.generateMasterKey();
    }
    return SecureString.masterKey;
  }
  
  /**
   * 序列化
   */
  serialize(): {
    encryptedData: string;
    iv: string;
    tag?: string;
    algorithm: string;
  } {
    return {
      encryptedData: this.encryptedData.toString('base64'),
      iv: this.iv.toString('base64'),
      tag: this.tag?.toString('base64'),
      algorithm: this.algorithm
    };
  }
  
  /**
   * 反序列化
   */
  static deserialize(data: {
    encryptedData: string;
    iv: string;
    tag?: string;
    algorithm: string;
  }): SecureString {
    return new SecureString(
      Buffer.from(data.encryptedData, 'base64'),
      Buffer.from(data.iv, 'base64'),
      data.tag ? Buffer.from(data.tag, 'base64') : undefined,
      data.algorithm
    );
  }
  
  /**
   * 防止直接字符串转换
   */
  toString(): string {
    return '[SecureString]***REDACTED***';
  }
  
  /**
   * 防止JSON序列化泄露
   */
  toJSON(): string {
    return '[SecureString]***REDACTED***';
  }
}
