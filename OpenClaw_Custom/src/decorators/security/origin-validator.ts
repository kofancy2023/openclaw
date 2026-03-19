/**
 * WebSocket Origin验证装饰器
 * 修复OC-001: WebSocket劫持漏洞
 * 
 * 安全特性:
 * 1. 严格Origin白名单验证
 * 2. Token与Origin绑定验证
 * 3. IP地址绑定验证
 * 4. 连接速率限制
 */

import { ISecurityEventBus } from '../../core/interfaces/security.js';

/**
 * Origin验证配置
 */
export interface OriginValidatorConfig {
  /** 允许的Origin列表 */
  allowedOrigins: string[];
  /** 是否启用Token绑定 */
  tokenBindingEnabled: boolean;
  /** 是否启用IP绑定 */
  ipBindingEnabled: boolean;
  /** 是否允许空Origin（浏览器环境通常都有Origin） */
  allowEmptyOrigin: boolean;
  /** 自定义验证函数 */
  customValidator?: (origin: string, context: ValidationContext) => boolean | Promise<boolean>;
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  origin: string;
  token?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  code: ValidationErrorCode | 'RATE_LIMIT_EXCEEDED';
}

/**
 * 验证错误码
 */
export type ValidationErrorCode =
  | 'VALID'
  | 'ORIGIN_MISSING'
  | 'ORIGIN_NOT_ALLOWED'
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'TOKEN_ORIGIN_MISMATCH'
  | 'TOKEN_IP_MISMATCH'
  | 'CUSTOM_VALIDATION_FAILED';

/**
 * Token绑定存储
 */
interface TokenBinding {
  token: string;
  origin: string;
  ip?: string;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * WebSocket连接请求
 */
export interface WebSocketConnectionRequest {
  headers: {
    origin?: string;
    'sec-websocket-protocol'?: string;
    'user-agent'?: string;
    [key: string]: string | undefined;
  };
  socket: {
    remoteAddress?: string;
    remotePort?: number;
  };
}

/**
 * 严格Origin验证器
 */
export class StrictOriginValidator {
  private config: OriginValidatorConfig;
  private eventBus?: ISecurityEventBus;
  private tokenBindings: Map<string, TokenBinding> = new Map();
  private connectionAttempts: Map<string, number[]> = new Map();
  
  constructor(
    config: OriginValidatorConfig,
    eventBus?: ISecurityEventBus
  ) {
    this.config = {
      ...config,
      allowEmptyOrigin: config.allowEmptyOrigin ?? false,
      tokenBindingEnabled: config.tokenBindingEnabled ?? true,
      ipBindingEnabled: config.ipBindingEnabled ?? false
    };
    this.eventBus = eventBus;
  }
  
  /**
   * 验证连接请求
   */
  async validate(request: WebSocketConnectionRequest): Promise<ValidationResult> {
    const context = this.extractContext(request);
    
    // 1. Origin验证
    const originResult = this.validateOrigin(context.origin);
    if (!originResult.valid) {
      await this.emitValidationFailure(context, originResult);
      return originResult;
    }
    
    // 2. Token绑定验证
    if (this.config.tokenBindingEnabled && context.token) {
      const tokenResult = await this.validateTokenBinding(context);
      if (!tokenResult.valid) {
        await this.emitValidationFailure(context, tokenResult);
        return tokenResult;
      }
    }
    
    // 3. 速率限制检查
    const rateLimitResult = this.checkRateLimit(context.ip);
    if (!rateLimitResult.valid) {
      await this.emitValidationFailure(context, rateLimitResult);
      return rateLimitResult;
    }
    
    // 4. 自定义验证
    if (this.config.customValidator) {
      const customResult = await this.config.customValidator(context.origin, context);
      if (!customResult) {
        const result: ValidationResult = {
          valid: false,
          reason: 'Custom validation failed',
          code: 'CUSTOM_VALIDATION_FAILED'
        };
        await this.emitValidationFailure(context, result);
        return result;
      }
    }
    
    // 验证通过，绑定Token
    if (context.token) {
      this.bindToken(context.token, context.origin, context.ip);
    }
    
    await this.emitValidationSuccess(context);
    
    return { valid: true, code: 'VALID' };
  }
  
  /**
   * 提取验证上下文
   */
  private extractContext(request: WebSocketConnectionRequest): ValidationContext {
    return {
      origin: request.headers.origin || '',
      token: request.headers['sec-websocket-protocol'],
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      timestamp: new Date()
    };
  }
  
  /**
   * 验证Origin
   */
  private validateOrigin(origin: string): ValidationResult {
    // 检查空Origin
    if (!origin) {
      if (!this.config.allowEmptyOrigin) {
        return {
          valid: false,
          reason: 'Origin header is missing',
          code: 'ORIGIN_MISSING'
        };
      }
      return { valid: true, code: 'VALID' };
    }
    
    // 检查白名单
    const allowedOrigins = this.config.allowedOrigins;
    
    // 支持通配符匹配
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return allowed === origin;
    });
    
    if (!isAllowed) {
      return {
        valid: false,
        reason: `Origin '${origin}' is not in the allowed list`,
        code: 'ORIGIN_NOT_ALLOWED'
      };
    }
    
    return { valid: true, code: 'VALID' };
  }
  
  /**
   * 验证Token绑定
   */
  private async validateTokenBinding(context: ValidationContext): Promise<ValidationResult> {
    const { token, origin, ip } = context;
    
    if (!token) {
      if (this.config.tokenBindingEnabled) {
        return {
          valid: false,
          reason: 'Token is required but not provided',
          code: 'TOKEN_MISSING'
        };
      }
      return { valid: true, code: 'VALID' };
    }
    
    const binding = this.tokenBindings.get(token);
    
    // 新Token，进行绑定
    if (!binding) {
      return { valid: true, code: 'VALID' };
    }
    
    // 检查Token是否过期
    if (binding.expiresAt && binding.expiresAt < new Date()) {
      this.tokenBindings.delete(token);
      return {
        valid: false,
        reason: 'Token has expired',
        code: 'TOKEN_INVALID'
      };
    }
    
    // 验证Origin绑定
    if (binding.origin !== origin) {
      return {
        valid: false,
        reason: 'Token is not bound to this origin',
        code: 'TOKEN_ORIGIN_MISMATCH'
      };
    }
    
    // 验证IP绑定
    if (this.config.ipBindingEnabled && binding.ip && binding.ip !== ip) {
      return {
        valid: false,
        reason: 'Token is not bound to this IP address',
        code: 'TOKEN_IP_MISMATCH'
      };
    }
    
    return { valid: true, code: 'VALID' };
  }
  
  /**
   * 检查速率限制
   */
  private checkRateLimit(ip: string | undefined): ValidationResult {
    if (!ip) {
      return { valid: true, code: 'VALID' };
    }
    
    const now = Date.now();
    const windowMs = 60000; // 1分钟窗口
    const maxAttempts = 60; // 每分钟最大60次尝试
    
    // 获取该IP的尝试记录
    let attempts = this.connectionAttempts.get(ip) || [];
    
    // 清理过期记录
    attempts = attempts.filter(time => now - time < windowMs);
    
    // 检查是否超过限制
    if (attempts.length >= maxAttempts) {
      return {
        valid: false,
        reason: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }
    
    // 记录本次尝试
    attempts.push(now);
    this.connectionAttempts.set(ip, attempts);
    
    return { valid: true, code: 'VALID' };
  }
  
  /**
   * 绑定Token
   */
  bindToken(token: string, origin: string, ip?: string): void {
    this.tokenBindings.set(token, {
      token,
      origin,
      ip: this.config.ipBindingEnabled ? ip : undefined,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时过期
    });
  }
  
  /**
   * 解绑Token
   */
  unbindToken(token: string): boolean {
    return this.tokenBindings.delete(token);
  }
  
  /**
   * 检查Token是否绑定
   */
  isTokenBound(token: string): boolean {
    const binding = this.tokenBindings.get(token);
    if (!binding) return false;
    
    // 检查是否过期
    if (binding.expiresAt && binding.expiresAt < new Date()) {
      this.tokenBindings.delete(token);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取Token绑定信息
   */
  getTokenBinding(token: string): TokenBinding | null {
    return this.tokenBindings.get(token) || null;
  }
  
  /**
   * 发送验证失败事件
   */
  private async emitValidationFailure(
    context: ValidationContext,
    result: ValidationResult
  ): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'INVALID_ORIGIN_ATTEMPT',
        timestamp: new Date(),
        severity: 'high',
        source: 'StrictOriginValidator',
        sourceIp: context.ip,
        details: {
          origin: context.origin,
          token: context.token ? '[REDACTED]' : undefined,
          reason: result.reason,
          code: result.code
        }
      });
    }
  }
  
  /**
   * 发送验证成功事件
   */
  private async emitValidationSuccess(context: ValidationContext): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'AUTH_SUCCESS',
        timestamp: new Date(),
        severity: 'low',
        source: 'StrictOriginValidator',
        sourceIp: context.ip,
        details: {
          origin: context.origin,
          timestamp: context.timestamp
        }
      });
    }
  }
  
  /**
   * 清理过期绑定
   */
  cleanupExpiredBindings(): number {
    const now = new Date();
    let cleaned = 0;
    
    for (const [token, binding] of this.tokenBindings) {
      if (binding.expiresAt && binding.expiresAt < now) {
        this.tokenBindings.delete(token);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 获取状态统计
   */
  getStats(): {
    activeBindings: number;
    allowedOrigins: number;
    tokenBindingEnabled: boolean;
    ipBindingEnabled: boolean;
  } {
    return {
      activeBindings: this.tokenBindings.size,
      allowedOrigins: this.config.allowedOrigins.length,
      tokenBindingEnabled: this.config.tokenBindingEnabled,
      ipBindingEnabled: this.config.ipBindingEnabled
    };
  }
}

import crypto from 'crypto';
