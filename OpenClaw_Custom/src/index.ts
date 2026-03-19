/**
 * OpenClaw_Custom 安全隔离层
 * 
 * 提供对OpenClaw的零侵入安全加固：
 * - OC-001: WebSocket Origin验证
 * - OC-002: 命令执行沙箱
 * - OC-003: 凭证加密存储
 * - OC-006: Skill安全扫描
 * 
 * @module openclaw-custom
 */

// 核心基础设施
export {
  DIContainer,
  Lifetime,
  createToken,
  TOKENS,
  type InjectionToken,
  DependencyResolutionError,
  SecurityError
} from './core/di/index.js';

// 核心接口
export type {
  IAuthenticator,
  IAuthorizer,
  IAuditLogger,
  Credentials,
  Identity,
  Permission,
  Resource,
  Action,
  Decision,
  AuditEvent,
  AuditFilter
} from './core/interfaces/auth.js';

export type {
  ISandbox,
  SandboxOptions,
  SandboxInstance,
  Command,
  ExecutionResult,
  BehaviorResult,
  IPolicyEngine,
  ParsedCommand,
  ExecutionContext,
  PolicyResult
} from './core/interfaces/sandbox.js';

export type {
  IContentSecurity,
  ICommandSanitizer,
  SecurityContext,
  ValidationRule,
  ValidationResult as ContentValidationResult,
  ScanResult,
  Scanner,
  ISecurityEventBus,
  SecurityEvent,
  SecurityEventType,
  SecurityObserver,
  IPathGuard
} from './core/interfaces/security.js';

export type {
  ICredentialStorage,
  ISecureString,
  IMasterKeyStore,
  IHsmClient,
  CredentialMetadata,
  CredentialStorageConfig,
  IEncryptionService,
  EncryptedData
} from './core/interfaces/storage.js';

// Hook系统
export {
  ModuleHookSystem,
  WebSocketInterceptor,
  GatewayInterceptor,
  SkillInterceptor,
  ExecutionInterceptor,
  ExecutionHookSystem,
  type ModuleInterceptor
} from './hooks/index.js';

// 安全装饰器
export {
  StrictOriginValidator,
  TokenBucketRateLimiter,
  type OriginValidatorConfig,
  type ValidationContext,
  type ValidationResult,
  type RateLimitConfig,
  type RequestContext,
  type RateLimitResult
} from './decorators/security/index.js';

// 安全代理
export {
  SecureExecutionProxy,
  type ExecutionContext as ProxyExecutionContext,
  type ExecutionAuditRecord
} from './decorators/proxy/execution-proxy.js';

// 缓解措施
export {
  CredentialEncryptionHardening,
  type MigrationReport
} from './mitigations/oc003-credential-encryption.js';

export {
  SkillSandboxHardening,
  type SkillSpec,
  type InstallResult,
  type StaticAnalysisResult,
  type BehaviorTestResult
} from './mitigations/oc006-skill-sandbox.js';

// 存储策略
export {
  KeyringStorage,
  type KeyringStorageConfig
} from './strategies/credential-storage/keyring-storage.js';

export {
  EncryptedFileStorage,
  type EncryptedFileStorageConfig
} from './strategies/credential-storage/encrypted-file.js';

// 沙箱策略
export {
  DockerSandbox,
  type DockerSandboxConfig
} from './strategies/sandbox/docker-sandbox.js';

// 工具
export {
  SecureString,
  type SecureStringOptions
} from './utils/secure-string.js';

// 启动引导
export {
  OpenClawCustomBootstrap,
  initialize,
  shutdown,
  getStatus,
  isInitialized,
  type SecurityConfig,
  type BootstrapOptions,
  type BootstrapStatus
} from './bootstrap.js';
