/**
 * WebSocket速率限制装饰器
 * 防止连接洪泛攻击
 */

import { ISecurityEventBus } from '../../core/interfaces/security.js';

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
  /** 突发容量 */
  burstSize?: number;
  /** 封锁时间（毫秒） */
  blockDuration?: number;
  /** 跳过成功的请求 */
  skipSuccessfulRequests?: boolean;
  /** 键提取函数 */
  keyGenerator?: (context: RequestContext) => string;
}

/**
 * 请求上下文
 */
export interface RequestContext {
  ip: string;
  origin?: string;
  token?: string;
  path?: string;
  method?: string;
}

/**
 * 速率限制状态
 */
interface RateLimitState {
  tokens: number;
  lastRefill: number;
  blockedUntil?: number;
  violationCount: number;
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalLimit: number;
  retryAfter?: number;
}

/**
 * 令牌桶速率限制器
 */
export class TokenBucketRateLimiter {
  private config: Required<RateLimitConfig>;
  private state: Map<string, RateLimitState> = new Map();
  private eventBus?: ISecurityEventBus;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(config: RateLimitConfig, eventBus?: ISecurityEventBus) {
    this.config = {
      ...config,
      windowMs: config.windowMs ?? 60000,
      maxRequests: config.maxRequests ?? 100,
      burstSize: config.burstSize ?? 10,
      blockDuration: config.blockDuration ?? 300000,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      keyGenerator: config.keyGenerator ?? ((ctx) => ctx.ip)
    };
    this.eventBus = eventBus;
    
    // 启动清理任务
    this.startCleanupTask();
  }
  
  /**
   * 检查是否允许请求
   */
  check(context: RequestContext): RateLimitResult {
    const key = this.config.keyGenerator(context);
    const now = Date.now();
    
    // 获取或创建状态
    let state = this.state.get(key);
    if (!state) {
      state = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        violationCount: 0
      };
      this.state.set(key, state);
    }
    
    // 检查是否被封禁
    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.blockedUntil,
        totalLimit: this.config.maxRequests,
        retryAfter: Math.ceil((state.blockedUntil - now) / 1000)
      };
    }
    
    // 补充令牌
    this.refillTokens(state, now);
    
    // 检查令牌
    if (state.tokens < 1) {
      // 记录违规
      state.violationCount++;
      
      // 多次违规，封禁
      if (state.violationCount >= 5) {
        state.blockedUntil = now + this.config.blockDuration;
        this.emitBlockEvent(context, key);
      }
      
      this.emitRateLimitEvent(context, key);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + this.getTimeUntilNextRefill(state, now),
        totalLimit: this.config.maxRequests,
        retryAfter: Math.ceil(this.getTimeUntilNextRefill(state, now) / 1000)
      };
    }
    
    // 消耗令牌
    state.tokens--;
    
    return {
      allowed: true,
      remaining: state.tokens,
      resetTime: now + this.getTimeUntilNextRefill(state, now),
      totalLimit: this.config.maxRequests
    };
  }
  
  /**
   * 消耗令牌（异步版本）
   */
  async consume(context: RequestContext): Promise<RateLimitResult> {
    return this.check(context);
  }
  
  /**
   * 补充令牌
   */
  private refillTokens(state: RateLimitState, now: number): void {
    const elapsed = now - state.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);
    
    if (tokensToAdd > 0) {
      state.tokens = Math.min(
        this.config.maxRequests,
        state.tokens + tokensToAdd
      );
      state.lastRefill = now;
      
      // 重置违规计数
      if (state.tokens >= this.config.maxRequests) {
        state.violationCount = 0;
      }
    }
  }
  
  /**
   * 获取下次补充时间
   */
  private getTimeUntilNextRefill(state: RateLimitState, now: number): number {
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const timePerToken = 1 / refillRate;
    return Math.ceil(timePerToken);
  }
  
  /**
   * 手动封禁
   */
  block(key: string, duration?: number): void {
    const state = this.state.get(key);
    if (state) {
      state.blockedUntil = Date.now() + (duration || this.config.blockDuration);
    }
  }
  
  /**
   * 解除封禁
   */
  unblock(key: string): boolean {
    const state = this.state.get(key);
    if (state) {
      state.blockedUntil = undefined;
      state.violationCount = 0;
      return true;
    }
    return false;
  }
  
  /**
   * 重置状态
   */
  reset(key?: string): void {
    if (key) {
      this.state.delete(key);
    } else {
      this.state.clear();
    }
  }
  
  /**
   * 获取状态
   */
  getStatus(key: string): RateLimitState | undefined {
    return this.state.get(key);
  }
  
  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每5分钟清理一次过期状态
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  /**
   * 清理过期状态
   */
  private cleanup(): void {
    const now = Date.now();
    const expiryTime = this.config.windowMs * 2;
    
    for (const [key, state] of this.state) {
      // 清理长时间未使用的状态
      if (now - state.lastRefill > expiryTime) {
        // 只有在未被封禁的情况下才清理
        if (!state.blockedUntil || state.blockedUntil < now) {
          this.state.delete(key);
        }
      }
    }
  }
  
  /**
   * 停止清理任务
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  /**
   * 发送速率限制事件
   */
  private emitRateLimitEvent(context: RequestContext, key: string): void {
    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date(),
        severity: 'medium',
        source: 'TokenBucketRateLimiter',
        sourceIp: context.ip,
        details: {
          key,
          origin: context.origin,
          path: context.path
        }
      });
    }
  }
  
  /**
   * 发送封禁事件
   */
  private emitBlockEvent(context: RequestContext, key: string): void {
    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: 'SUSPICIOUS_BEHAVIOR',
        timestamp: new Date(),
        severity: 'high',
        source: 'TokenBucketRateLimiter',
        sourceIp: context.ip,
        details: {
          key,
          origin: context.origin,
          reason: 'Too many rate limit violations',
          blockDuration: this.config.blockDuration
        }
      });
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalTrackedKeys: number;
    blockedKeys: number;
    config: RateLimitConfig;
  } {
    const now = Date.now();
    let blockedCount = 0;
    
    for (const state of this.state.values()) {
      if (state.blockedUntil && state.blockedUntil > now) {
        blockedCount++;
      }
    }
    
    return {
      totalTrackedKeys: this.state.size,
      blockedKeys: blockedCount,
      config: this.config
    };
  }
}

import crypto from 'crypto';
