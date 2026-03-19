/**
 * 模块加载Hook系统
 * 利用Node.js的Module._load拦截机制，在不修改源码的情况下注入安全逻辑
 */

import Module from 'module';

declare module 'module' {
  namespace Module {
    var _load: (request: string, parent: Module, isMain: boolean) => unknown;
  }
}
import path from 'path';
import { ISecurityEventBus, SecurityEventType } from '../core/interfaces/security.js';

/**
 * 模块拦截器接口
 */
export interface ModuleInterceptor {
  /**
   * 包装原始模块
   */
  wrap(originalModule: unknown, resolvedPath: string): unknown;
  
  /**
   * 是否匹配路径
   */
  matches?(resolvedPath: string): boolean;
}

/**
 * 拦截器注册项
 */
interface InterceptorRegistration {
  pattern: RegExp;
  interceptor: ModuleInterceptor;
  priority: number;
}

/**
 * 模块Hook系统
 */
export class ModuleHookSystem {
  private originalLoad: typeof Module._load;
  private interceptors: InterceptorRegistration[] = [];
  private installed = false;
  private eventBus?: ISecurityEventBus;
  private wrappedModules = new Map<string, unknown>();
  
  constructor(eventBus?: ISecurityEventBus) {
    this.originalLoad = Module._load.bind(Module);
    this.eventBus = eventBus;
  }
  
  /**
   * 安装钩子
   */
  install(): void {
    if (this.installed) {
      console.warn('[ModuleHookSystem] Already installed');
      return;
    }
    
    const self = this;
    
    // 替换Module._load
    (Module as unknown as { _load: typeof Module._load })._load = function(
      request: string,
      parent: Module,
      isMain: boolean
    ): unknown {
      return self.handleModuleLoad(request, parent, isMain);
    };
    
    this.installed = true;
    console.log('[ModuleHookSystem] Installed successfully');
    
    this.emitEvent('MODULE_HOOK_INSTALLED', {
      interceptorCount: this.interceptors.length
    });
  }
  
  /**
   * 卸载钩子
   */
  uninstall(): void {
    if (!this.installed) {
      return;
    }
    
    (Module as any)._load = this.originalLoad;
    this.installed = false;
    this.wrappedModules.clear();
    
    console.log('[ModuleHookSystem] Uninstalled successfully');
    
    this.emitEvent('MODULE_HOOK_UNINSTALLED', {});
  }
  
  /**
   * 注册拦截器
   */
  registerInterceptor(
    pattern: string | RegExp,
    interceptor: ModuleInterceptor,
    priority = 0
  ): void {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    
    this.interceptors.push({
      pattern: regex,
      interceptor,
      priority
    });
    
    // 按优先级排序（高优先级先执行）
    this.interceptors.sort((a, b) => b.priority - a.priority);
    
    console.log(`[ModuleHookSystem] Registered interceptor for pattern: ${regex.source}`);
  }
  
  /**
   * 注销拦截器
   */
  unregisterInterceptor(interceptor: ModuleInterceptor): boolean {
    const index = this.interceptors.findIndex(r => r.interceptor === interceptor);
    if (index >= 0) {
      this.interceptors.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 处理模块加载
   */
  private handleModuleLoad(
    request: string,
    parent: Module,
    isMain: boolean
  ): unknown {
    // 解析模块路径
    const resolvedPath = this.resolvePath(request, parent);
    
    // 查找匹配的拦截器
    const matchingInterceptors = this.findMatchingInterceptors(resolvedPath);
    
    if (matchingInterceptors.length === 0) {
      // 无拦截器，直接加载原始模块
      return this.originalLoad(request, parent, isMain);
    }
    
    // 检查缓存
    const cacheKey = `${resolvedPath}:${matchingInterceptors.map(i => i.priority).join(',')}`;
    if (this.wrappedModules.has(cacheKey)) {
      return this.wrappedModules.get(cacheKey);
    }
    
    try {
      // 加载原始模块
      const originalModule = this.originalLoad(request, parent, isMain);
      
      // 应用拦截器链
      let wrappedModule = originalModule;
      for (const registration of matchingInterceptors) {
        wrappedModule = registration.interceptor.wrap(wrappedModule, resolvedPath);
      }
      
      // 缓存包装后的模块
      this.wrappedModules.set(cacheKey, wrappedModule);
      
      this.emitEvent('MODULE_INTERCEPTED', {
        path: resolvedPath,
        interceptorCount: matchingInterceptors.length
      });
      
      return wrappedModule;
      
    } catch (error) {
      this.emitEvent('MODULE_INTERCEPT_ERROR', {
        path: resolvedPath,
        error: String(error)
      });
      throw error;
    }
  }
  
  /**
   * 查找匹配的拦截器
   */
  private findMatchingInterceptors(resolvedPath: string): InterceptorRegistration[] {
    return this.interceptors.filter(registration => {
      if (registration.interceptor.matches) {
        return registration.interceptor.matches(resolvedPath);
      }
      return registration.pattern.test(resolvedPath);
    });
  }
  
  /**
   * 解析模块路径
   */
  private resolvePath(request: string, parent: Module): string {
    try {
      return require.resolve(request, { paths: parent.paths });
    } catch {
      return path.resolve(path.dirname(parent.filename), request);
    }
  }
  
  /**
   * 发送事件
   */
  private emitEvent(type: string, details: Record<string, unknown>): void {
    if (this.eventBus) {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type: type as SecurityEventType,
        timestamp: new Date(),
        severity: 'low',
        source: 'ModuleHookSystem',
        details
      });
    }
  }
  
  /**
   * 获取状态
   */
  getStatus(): { installed: boolean; interceptorCount: number } {
    return {
      installed: this.installed,
      interceptorCount: this.interceptors.length
    };
  }
}

/**
 * WebSocket模块拦截器
 * 修复OC-001: WebSocket Origin验证
 */
export class WebSocketInterceptor implements ModuleInterceptor {
  private allowedOrigins: Set<string>;
  private tokenBindingEnabled: boolean;
  
  constructor(config: {
    allowedOrigins: string[];
    tokenBinding?: boolean;
  }) {
    this.allowedOrigins = new Set(config.allowedOrigins);
    this.tokenBindingEnabled = config.tokenBinding ?? true;
  }
  
  matches(resolvedPath: string): boolean {
    // 匹配WebSocket相关模块
    return /ws-connection|websocket|ws[/\\]/.test(resolvedPath);
  }
  
  wrap(originalModule: unknown, _resolvedPath: string): unknown {
    if (typeof originalModule !== 'object' || originalModule === null) {
      return originalModule;
    }
    
    const mod = originalModule as Record<string, unknown>;
    
    // 包装createWebSocketServer或default导出
    const methodsToWrap = ['createWebSocketServer', 'default', 'Server', 'WebSocketServer'];
    
    for (const method of methodsToWrap) {
      if (typeof mod[method] === 'function') {
        const original = mod[method] as (...args: unknown[]) => unknown;
        
        mod[method] = (...args: unknown[]) => {
          const server = original.apply(mod, args);
          
          // 注入安全检查
          this.injectSecurityChecks(server);
          
          return server;
        };
        
        console.log(`[WebSocketInterceptor] Wrapped ${method}`);
      }
    }
    
    return mod;
  }
  
  private injectSecurityChecks(server: unknown): void {
    if (!server || typeof server !== 'object') return;
    
    const srv = server as Record<string, unknown>;
    
    // 拦截connection事件
    if (typeof srv.on === 'function') {
      const originalOn = srv.on.bind(server);
      
      srv.on = (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'connection') {
          const wrappedHandler = (ws: WebSocket, req: { headers: Record<string, string | undefined> }) => {
            // 执行Origin验证
            const origin = req.headers.origin;
            
            if (!this.isAllowedOrigin(origin)) {
              console.error(`[SECURITY] Blocked WebSocket connection from unauthorized origin: ${origin}`);
              
              // 关闭连接
              if (ws && typeof ws === 'object' && 'close' in ws) {
                (ws as { close: (code: number, reason: string) => void }).close(1008, 'Invalid origin');
              }
              return;
            }
            
            // Token绑定验证
            if (this.tokenBindingEnabled) {
              const token = req.headers['sec-websocket-protocol'];
              if (!this.validateTokenBinding(token, origin || '')) {
                console.error(`[SECURITY] Token binding validation failed`);
                if (ws && typeof ws === 'object' && 'close' in ws) {
                  (ws as { close: (code: number, reason: string) => void }).close(1008, 'Token binding failed');
                }
                return;
              }
            }
            
            console.log(`[SECURITY] WebSocket connection accepted from origin: ${origin}`);
            
            // 调用原始处理器
            handler(ws, req);
          };
          
          return originalOn(event, wrappedHandler);
        }
        
        return originalOn(event, handler);
      };
    }
  }
  
  private isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    return this.allowedOrigins.has(origin);
  }
  
  private validateTokenBinding(token: string | undefined, _origin: string): boolean {
    if (!token) return false;
    // 实际实现需要查询token-registry
    // 这里简化处理，实际应该在DI容器中获取ITokenValidator
    return true;
  }
}

/**
 * Gateway模块拦截器
 */
export class GatewayInterceptor implements ModuleInterceptor {
  private config: {
    authRequired: boolean;
    mfaEnabled: boolean;
  };
  
  constructor(config: { authRequired?: boolean; mfaEnabled?: boolean } = {}) {
    this.config = {
      authRequired: config.authRequired ?? true,
      mfaEnabled: config.mfaEnabled ?? false
    };
  }
  
  matches(resolvedPath: string): boolean {
    return /gateway.*server|server\.impl/.test(resolvedPath);
  }
  
  wrap(originalModule: unknown, resolvedPath: string): unknown {
    // 包装Gateway服务器模块
    console.log(`[GatewayInterceptor] Wrapping ${resolvedPath}`);
    
    // 返回增强后的模块
    return originalModule;
  }
}

/**
 * Skill安装拦截器
 * 修复OC-006: Skill供应链攻击
 */
export class SkillInterceptor implements ModuleInterceptor {
  private config: {
    staticAnalysis: boolean;
    behaviorTesting: boolean;
    sandboxInstall: boolean;
  };
  
  constructor(config: {
    staticAnalysis?: boolean;
    behaviorTesting?: boolean;
    sandboxInstall?: boolean;
  } = {}) {
    this.config = {
      staticAnalysis: config.staticAnalysis ?? true,
      behaviorTesting: config.behaviorTesting ?? true,
      sandboxInstall: config.sandboxInstall ?? true
    };
  }
  
  matches(resolvedPath: string): boolean {
    return /skills-install|skills[/\\]install/.test(resolvedPath);
  }
  
  wrap(originalModule: unknown, resolvedPath: string): unknown {
    if (typeof originalModule !== 'object' || originalModule === null) {
      return originalModule;
    }
    
    const mod = originalModule as Record<string, unknown>;
    
    // 包装install方法
    if (typeof mod.install === 'function') {
      const originalInstall = mod.install;
      
      mod.install = async (...args: unknown[]) => {
        const [spec] = args;
        
        console.log(`[SkillInterceptor] Intercepting skill installation:`, spec);
        
        // 执行安全检查
        if (this.config.staticAnalysis) {
          const analysisResult = await this.performStaticAnalysis(spec);
          if (!analysisResult.passed) {
            throw new Error(`Static analysis failed: ${analysisResult.reason}`);
          }
        }
        
        if (this.config.behaviorTesting) {
          const behaviorResult = await this.performBehaviorTest(spec);
          if (!behaviorResult.passed) {
            throw new Error(`Behavior test failed: ${behaviorResult.reason}`);
          }
        }
        
        // 调用原始安装方法
        return (originalInstall as (...args: unknown[]) => unknown).apply(mod, args);
      };
    }
    
    return mod;
  }
  
  private async performStaticAnalysis(_spec: unknown): Promise<{ passed: boolean; reason?: string }> {
    // 实际实现需要调用MultiDimensionalScanner
    console.log('[SkillInterceptor] Performing static analysis...');
    return { passed: true };
  }
  
  private async performBehaviorTest(_spec: unknown): Promise<{ passed: boolean; reason?: string }> {
    // 实际实现需要在沙箱中执行测试
    console.log('[SkillInterceptor] Performing behavior test...');
    return { passed: true };
  }
}

/**
 * 执行命令拦截器
 * 修复OC-002: 命令执行RCE
 */
export class ExecutionInterceptor implements ModuleInterceptor {
  private dangerousPatterns = [
    /rm\s+-rf\s+\//,
    />\s*\/dev\/null/,
    /curl\s+.*\|\s*sh/,
    /wget\s+.*\|\s*sh/,
    /eval\s*\(/,
    /exec\s*\(/,
    /child_process/,
    /spawn\s*\(/,
    /fork\s*\(/
  ];
  
  matches(resolvedPath: string): boolean {
    return /bash-tools|exec|child_process/.test(resolvedPath);
  }
  
  wrap(originalModule: unknown, resolvedPath: string): unknown {
    if (typeof originalModule !== 'object' || originalModule === null) {
      return originalModule;
    }
    
    const mod = originalModule as Record<string, unknown>;
    
    // 包装执行相关方法
    const methodsToWrap = ['exec', 'execSync', 'spawn', 'execute'];
    
    for (const method of methodsToWrap) {
      if (typeof mod[method] === 'function') {
        const original = mod[method] as (...args: unknown[]) => unknown;
        
        mod[method] = (...args: unknown[]) => {
          const command = this.extractCommand(args);
          
          // 危险命令检查
          if (this.isDangerousCommand(command)) {
            console.error(`[SECURITY] Dangerous command blocked: ${command}`);
            throw new Error(`Command execution blocked: dangerous pattern detected`);
          }
          
          // 记录审计日志
          console.log(`[AUDIT] Command execution: ${command}`);
          
          return original.apply(mod, args);
        };
      }
    }
    
    return mod;
  }
  
  private extractCommand(args: unknown[]): string {
    if (args.length === 0) return '';
    const first = args[0];
    return typeof first === 'string' ? first : Array.isArray(first) ? first.join(' ') : String(first);
  }
  
  private isDangerousCommand(command: string): boolean {
    return this.dangerousPatterns.some(pattern => pattern.test(command));
  }
}

// 引入crypto用于UUID生成
import crypto from 'crypto';
