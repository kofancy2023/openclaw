/**
 * WebSocket速率限制装饰器
 * 防止连接洪泛攻击
 */

import { ISecurityEventBus } from '../../core/interfaces/security.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * 速率限制状态存储接口
 */
export interface RateLimitStateStorage {
  save(state: Map<string, RateLimitState>): Promise<void>;
  load(): Promise<Map<string, RateLimitState>>;
}

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
 * 可序列化的状态数据
 */
interface SerializableState {
  key: string;
  tokens: number;
  lastRefill: number;
  blockedUntil?: number;
  violationCount: number;
}

/**
 * 文件存储实现
 */
export class FileRateLimitStorage implements RateLimitStateStorage {
  private filePath: string;
  private saveInterval: number;
  private lastSave: number = 0;
  private dirty = false;
  private saveTimer?: NodeJS.Timeout;

  constructor(filePath: string, saveIntervalMs = 5000) {
    this.filePath = filePath;
    this.saveInterval = saveIntervalMs;
  }

  async save(state: Map<string, RateLimitState>): Promise<void> {
    this.dirty = true;
    
    const now = Date.now();
    // 限制保存频率
    if (now - this.lastSave < this.saveInterval) {
      // 延迟保存
      if (!this.saveTimer) {
        this.saveTimer = setTimeout(() => {
          this.doSave(state);
        }, this.saveInterval);
      }
      return;
    }

    await this.doSave(state);
  }

  private async doSave(state: Map<string, RateLimitState>): Promise<void> {
    if (!this.dirty) return;

    try {
      const data: SerializableState[] = [];
      const now = Date.now();

      for (const [key, value] of state) {
        // 只保存未过期的状态
        if (value.blockedUntil && value.blockedUntil < now) {
          continue;
        }
        data.push({ key, ...value });
      }

      const dir = dirname(this.filePath);
      await mkdir(dir, { recursive: true });

      const tempFile = `${this.filePath}.tmp`;
      await writeFile(tempFile, JSON.stringify(data, null, 2));
      
      // 原子重命名
      const { rename } = await import('fs/promises');
      await rename(tempFile, this.filePath);

      this.lastSave = Date.now();
      this.dirty = false;
    } catch (error) {
      console.error('[FileRateLimitStorage] Failed to save:', error);
    } finally {
      this.saveTimer = undefined;
    }
  }

  async load(): Promise<Map<string, RateLimitState>> {
    try {
      const { existsSync } = await import('fs');
      if (!existsSync(this.filePath)) {
        return new Map();
      }

      const content = await readFile(this.filePath, 'utf-8');
      const data: SerializableState[] = JSON.parse(content);
      const state = new Map<string, RateLimitState>();
      const now = Date.now();

      for (const item of data) {
        // 跳过过期的封禁状态
        if (item.blockedUntil && item.blockedUntil < now) {
          continue;
        }
        const { key, ...rest } = item;
        state.set(key, rest);
      }

      return state;
    } catch (error) {
      console.error('[FileRateLimitStorage] Failed to load:', error);
      return new Map();
    }
  }

  /**
   * 立即保存（用于关闭时）
   */
  async flush(state: Map<string, RateLimitState>): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    await this.doSave(state);
  }
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
 * 
 * 支持持久化存储，重启后状态不丢失
 */
export class TokenBucketRateLimiter {
  private config: Required<RateLimitConfig>;
  private state: Map<string, RateLimitState> = new Map();
  private eventBus?: ISecurityEventBus;
  private cleanupInterval?: NodeJS.Timeout;
  private storage?: RateLimitStateStorage;
  private initialized = false;
  
  constructor(
    config: RateLimitConfig, 
    eventBus?: ISecurityEventBus,
    storage?: RateLimitStateStorage
  ) {
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
    this.storage = storage;
  }
  
  /**
   * 初始化速率限制器
   * 从存储加载状态（如果有）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.storage) {
      this.state = await this.storage.load();
      console.log(`[TokenBucketRateLimiter] Loaded ${this.state.size} rate limit states`);
    }
    
    // 启动清理任务
    this.startCleanupTask();
    this.initialized = true;
  }
  
  /**
   * 关闭速率限制器
   * 保存状态到存储
   */
  async shutdown(): Promise<void> {
    this.stop();
    
    if (this.storage && this.storage instanceof FileRateLimitStorage) {
      await this.storage.flush(this.state);
      console.log('[TokenBucketRateLimiter] State saved');
    }
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
      
      // 触发异步保存
      this.persistState();
      
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
    
    // 触发异步保存
    this.persistState();
    
    return {
      allowed: true,
      remaining: state.tokens,
      resetTime: now + this.getTimeUntilNextRefill(state, now),
      totalLimit: this.config.maxRequests
    };
  }
  
  /**
   * 持久化状态
   */
  private persistState(): void {
    if (this.storage) {
      // 异步保存，不阻塞请求处理
      this.storage.save(this.state).catch(err => {
        console.error('[TokenBucketRateLimiter] Failed to persist state:', err);
      });
    }
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
    } else {
      // 创建新状态并封禁
      this.state.set(key, {
        tokens: 0,
        lastRefill: Date.now(),
        blockedUntil: Date.now() + (duration || this.config.blockDuration),
        violationCount: 5
      });
    }
    this.persistState();
  }
  
  /**
   * 解除封禁
   */
  unblock(key: string): boolean {
    const state = this.state.get(key);
    if (state) {
      state.blockedUntil = undefined;
      state.violationCount = 0;
      this.persistState();
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
    this.persistState();
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
