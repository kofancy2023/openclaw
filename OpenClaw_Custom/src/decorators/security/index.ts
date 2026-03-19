/**
 * 安全装饰器模块导出
 */

export {
  StrictOriginValidator,
  type OriginValidatorConfig,
  type ValidationContext,
  type ValidationResult,
  type ValidationErrorCode,
  type WebSocketConnectionRequest
} from './origin-validator.js';

export {
  TokenBucketRateLimiter,
  type RateLimitConfig,
  type RequestContext,
  type RateLimitResult
} from './rate-limiter.js';
