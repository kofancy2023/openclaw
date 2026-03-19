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
   * 获取主密钥
   * @throws {Error} 如果主密钥未设置，抛出错误
   */
  private static async getMasterKey(): Promise<Buffer> {
    if (!SecureString.masterKey) {
      throw new Error(
        'Master key not initialized. ' +
        'Call SecureString.setMasterKey() with a 32-byte key before using encryption. ' +
        'For first-time setup, use SecureString.generateMasterKey() to create a key ' +
        'and persist it securely.'
      );
    }
    return SecureString.masterKey;
  }

  /**
   * 从环境变量或文件加载主密钥
   * @param options 加载选项
   */
  static async loadMasterKey(options: {
    envVar?: string;
    filePath?: string;
    key?: Buffer | string;
  } = {}): Promise<void> {
    // 优先级: 直接传入 > 环境变量 > 文件
    let keyMaterial: Buffer | string | undefined;
    let keySource: string = 'unknown';

    if (options.key) {
      keyMaterial = options.key;
      keySource = 'parameter';
    } else if (options.envVar && process.env[options.envVar]) {
      keyMaterial = process.env[options.envVar];
      keySource = `environment variable ${options.envVar}`;
    } else if (options.filePath) {
      const { readFile } = await import('fs/promises');
      const expandedPath = options.filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');
      try {
        keyMaterial = await readFile(expandedPath, 'utf-8');
        keyMaterial = keyMaterial.trim();
        keySource = `file ${expandedPath}`;
      } catch (error) {
        throw new Error(`Failed to read master key from ${expandedPath}: ${error}`);
      }
    }

    if (!keyMaterial) {
      throw new Error(
        'Master key not found. Provide it via: ' +
        '1) options.key parameter, ' +
        '2) environment variable (set options.envVar), or ' +
        '3) key file (set options.filePath)'
      );
    }

    // 处理字符串类型的密钥
    let keyBuffer: Buffer;
    if (typeof keyMaterial === 'string') {
      // 尝试解析为 base64
      try {
        keyBuffer = Buffer.from(keyMaterial, 'base64');
        if (keyBuffer.length !== 32) {
          // 如果不是32字节，使用 SHA-256 派生
          keyBuffer = crypto.createHash('sha256').update(keyMaterial).digest();
        }
      } catch {
        keyBuffer = crypto.createHash('sha256').update(keyMaterial).digest();
      }
    } else {
      keyBuffer = keyMaterial;
    }

    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid master key length: ${keyBuffer.length} bytes, expected 32`);
    }

    SecureString.setMasterKey(keyBuffer);

    // 安全擦除原始密钥材料（如果是字符串）
    if (typeof keyMaterial === 'string') {
      const len = keyMaterial.length;
      for (let i = 0; i < len; i++) {
        (keyMaterial as any)[i] = '0';
      }
    }

    console.log(`[SecureString] Master key loaded from ${keySource}`);
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
