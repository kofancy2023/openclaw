/**
 * Docker沙箱实现
 * 提供隔离执行环境
 */

import path from 'path';
import { 
  ISandbox, 
  SandboxOptions, 
  SandboxInstance, 
  Command, 
  ExecutionResult,
  BehaviorResult
} from '../../core/interfaces/sandbox.js';

/**
 * Docker沙箱配置
 */
export interface DockerSandboxConfig {
  /** Docker二进制路径 */
  dockerPath?: string;
  /** 默认镜像 */
  defaultImage?: string;
  /** 是否自动清理 */
  autoCleanup?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * Docker容器信息
 */
interface ContainerInfo {
  id: string;
  name: string;
  status: 'creating' | 'running' | 'exited' | 'dead';
  exitCode?: number;
  pid?: number;
}

/**
 * Docker沙箱实现
 */
export class DockerSandbox implements ISandbox {
  private config: Required<DockerSandboxConfig>;
  private containers: Map<string, ContainerInfo> = new Map();
  private instanceCounter = 0;
  
  constructor(config: DockerSandboxConfig = {}) {
    this.config = {
      dockerPath: 'docker',
      defaultImage: 'openclaw-sandbox:latest',
      autoCleanup: true,
      debug: false,
      ...config
    };
  }
  
  /**
   * 创建沙箱实例
   */
  async create(options: SandboxOptions): Promise<SandboxInstance> {
    const instanceId = `sandbox-${Date.now()}-${++this.instanceCounter}`;
    
    // 构建Docker运行参数
    const args = this.buildDockerArgs(options, instanceId);
    
    try {
      // 创建容器
      const { spawn } = await import('child_process');
      
      const createProcess = spawn(this.config.dockerPath, [
        'create',
        ...args,
        options.image || this.config.defaultImage,
        'sleep',
        'infinity'
      ]);
      
      const containerId = await new Promise<string>((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        
        createProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        createProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        createProcess.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Docker create failed: ${errorOutput}`));
          }
        });
      });
      
      // 启动容器
      await this.dockerCommand(['start', containerId]);
      
      // 保存容器信息
      const containerInfo: ContainerInfo = {
        id: containerId,
        name: instanceId,
        status: 'running'
      };
      
      this.containers.set(instanceId, containerInfo);
      
      if (this.config.debug) {
        console.log(`[DockerSandbox] Created container ${containerId} (${instanceId})`);
      }
      
      return {
        id: instanceId,
        options,
        status: 'running',
        createdAt: new Date(),
        startedAt: new Date()
      };
      
    } catch (error) {
      throw new Error(`Failed to create sandbox: ${error}`);
    }
  }
  
  /**
   * 执行命令
   */
  async execute(
    instance: SandboxInstance,
    command: Command
  ): Promise<ExecutionResult> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      throw new Error(`Container not found: ${instance.id}`);
    }
    
    if (container.status !== 'running') {
      throw new Error(`Container not running: ${instance.id}`);
    }
    
    const startTime = Date.now();
    
    try {
      // 构建执行命令
      const execArgs = ['exec'];
      
      if (command.workingDir) {
        execArgs.push('-w', command.workingDir);
      }
      
      // 添加环境变量
      for (const [key, value] of Object.entries(command.env || {})) {
        execArgs.push('-e', `${key}=${value}`);
      }
      
      execArgs.push(container.id);
      
      // 添加命令
      const cmdArray = Array.isArray(command.command) 
        ? command.command 
        : command.command.split(' ');
      
      execArgs.push(...cmdArray);
      
      // 执行
      const { spawn } = await import('child_process');
      
      const execProcess = spawn(this.config.dockerPath, execArgs);
      
      // 处理超时
      const timeout = command.timeout || 300000;
      const timeoutId = setTimeout(() => {
        execProcess.kill('SIGTERM');
      }, timeout);
      
      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        
        execProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });
        
        execProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
        
        execProcess.on('close', (code, signal) => {
          clearTimeout(timeoutId);
          
          const duration = Date.now() - startTime;
          
          resolve({
            exitCode: code || (signal ? 1 : 0),
            stdout,
            stderr,
            duration,
            timedOut: signal === 'SIGTERM'
          });
        });
        
        execProcess.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
        
        // 写入stdin
        if (command.stdin) {
          execProcess.stdin?.write(command.stdin);
          execProcess.stdin?.end();
        }
      });
      
    } catch (error) {
      throw new Error(`Failed to execute command: ${error}`);
    }
  }
  
  /**
   * 执行并监控行为
   */
  async executeWithMonitoring(
    instance: SandboxInstance,
    command: Command
  ): Promise<{ result: ExecutionResult; behavior: BehaviorResult }> {
    // 先执行命令
    const result = await this.execute(instance, command);
    
    // 获取行为日志（从Docker日志）
    const behavior = await this.getBehaviorLogs(instance);
    
    return { result, behavior };
  }
  
  /**
   * 启动沙箱
   */
  async start(instance: SandboxInstance): Promise<void> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      throw new Error(`Container not found: ${instance.id}`);
    }
    
    await this.dockerCommand(['start', container.id]);
    container.status = 'running';
  }
  
  /**
   * 停止沙箱
   */
  async stop(instance: SandboxInstance, force = false): Promise<void> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      return;
    }
    
    const args = force ? ['kill', container.id] : ['stop', container.id];
    await this.dockerCommand(args);
    
    container.status = 'exited';
  }
  
  /**
   * 销毁沙箱
   */
  async destroy(instance: SandboxInstance): Promise<void> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      return;
    }
    
    try {
      // 强制停止
      await this.stop(instance, true);
      
      // 删除容器
      await this.dockerCommand(['rm', '-f', container.id]);
      
      // 清理记录
      this.containers.delete(instance.id);
      
      if (this.config.debug) {
        console.log(`[DockerSandbox] Destroyed container ${container.id}`);
      }
      
    } catch (error) {
      console.error(`[DockerSandbox] Failed to destroy container: ${error}`);
    }
  }
  
  /**
   * 获取状态
   */
  async getStatus(instance: SandboxInstance): Promise<SandboxInstance['status']> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      return 'exited';
    }
    
    // 查询Docker获取最新状态
    try {
      const output = await this.dockerCommandOutput([
        'inspect',
        '-f',
        '{{.State.Status}}',
        container.id
      ]);
      
      const status = output.trim();
      
      switch (status) {
        case 'running':
          return 'running';
        case 'exited':
          return 'exited';
        case 'dead':
          return 'error';
        default:
          return 'creating';
      }
      
    } catch {
      return 'error';
    }
  }
  
  /**
   * 读取文件
   */
  async readFile(instance: SandboxInstance, filePath: string): Promise<Buffer> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      throw new Error(`Container not found: ${instance.id}`);
    }
    
    // 验证路径安全性
    this.validatePath(filePath);
    
    const output = await this.dockerCommandOutput([
      'exec',
      container.id,
      'cat',
      filePath
    ]);
    
    return Buffer.from(output);
  }
  
  /**
   * 验证文件路径安全性
   * 防止路径遍历和命令注入
   */
  private validatePath(filePath: string): void {
    // 检查路径遍历攻击
    const normalizedPath = path.posix.normalize(filePath);
    
    // 禁止包含 null 字节
    if (filePath.includes('\0')) {
      throw new Error('Invalid file path: contains null byte');
    }
    
    // 禁止路径遍历（以 .. 开头或包含 ../）
    if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
      // 允许绝对路径，但需要检查
      if (!path.isAbsolute(filePath)) {
        throw new Error('Invalid file path: path traversal detected');
      }
    }
    
    // 禁止 shell 特殊字符
    const dangerousChars = /[;&|`$(){}[\]\<>\n\r]/;
    if (dangerousChars.test(filePath)) {
      throw new Error('Invalid file path: contains dangerous characters');
    }
  }
  
  /**
   * Shell 参数转义
   * 用于将用户输入安全地传递给 shell 命令
   */
  private shellEscape(arg: string): string {
    // 使用单引号包裹，并处理内部的单引号
    // ' -> '\'' (结束引号，插入转义的单引号，重新开始引号)
    return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
  }

  /**
   * 写入文件
   * 使用安全的参数传递，避免命令注入
   */
  async writeFile(
    instance: SandboxInstance,
    filePath: string,
    content: Buffer | string
  ): Promise<void> {
    const container = this.containers.get(instance.id);
    
    if (!container) {
      throw new Error(`Container not found: ${instance.id}`);
    }
    
    // 验证路径安全性
    this.validatePath(filePath);
    
    const { spawn } = await import('child_process');
    
    // 方法1: 使用 tee 命令，路径经过转义
    const escapedPath = this.shellEscape(filePath);
    const writeProcess = spawn(this.config.dockerPath, [
      'exec',
      '-i',
      container.id,
      'sh',
      '-c',
      `tee ${escapedPath} > /dev/null`
    ], {
      // 安全选项：限制 shell 环境
      env: {},
      // 隐藏命令窗口（Windows）
      windowsHide: true
    });
    
    return new Promise((resolve, reject) => {
      let stderr = '';
      
      writeProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      writeProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to write file: exit code ${code}, stderr: ${stderr}`));
        }
      });
      
      writeProcess.on('error', reject);
      
      // 设置超时，防止死锁
      const timeout = setTimeout(() => {
        writeProcess.kill('SIGTERM');
        reject(new Error('Write file operation timed out'));
      }, 30000);
      
      writeProcess.on('close', () => {
        clearTimeout(timeout);
      });
      
      // 写入内容
      if (Buffer.isBuffer(content)) {
        writeProcess.stdin?.write(content);
      } else {
        writeProcess.stdin?.write(content, 'utf8');
      }
      writeProcess.stdin?.end();
    });
  }
  
  /**
   * 构建Docker参数
   */
  private buildDockerArgs(options: SandboxOptions, name: string): string[] {
    const args: string[] = [
      '--name', name,
      '--rm'  // 自动删除
    ];
    
    // 网络
    if (options.network === 'none') {
      args.push('--network', 'none');
    } else if (options.network === 'restricted') {
      // 使用自定义受限网络
      args.push('--network', 'openclaw-restricted');
    }
    
    // 只读根文件系统
    if (options.filesystem === 'readonly') {
      args.push('--read-only');
    }
    
    // 资源限制
    if (options.resources?.memory) {
      args.push('--memory', options.resources.memory);
    }
    
    if (options.resources?.cpu) {
      args.push('--cpus', options.resources.cpu);
    }
    
    if (options.resources?.maxPids) {
      args.push('--pids-limit', String(options.resources.maxPids));
    }
    
    // 挂载点
    for (const mount of options.mounts || []) {
      const mountArg = `${mount.type || 'bind'}:${mount.source}:${mount.target}${mount.readonly ? ':ro' : ''}`;
      args.push('--mount', mountArg);
    }
    
    // 安全选项
    args.push('--security-opt', 'no-new-privileges:true');
    args.push('--cap-drop', 'ALL');
    
    // 允许的能力
    for (const cap of options.capabilities || []) {
      args.push('--cap-add', cap);
    }
    
    // 用户
    if (options.user) {
      args.push('--user', options.user);
    }
    
    return args;
  }
  
  /**
   * 执行Docker命令
   */
  private async dockerCommand(args: string[]): Promise<void> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.dockerPath, args);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker command failed: ${args.join(' ')}`));
        }
      });
      
      process.on('error', reject);
    });
  }
  
  /**
   * 执行Docker命令并获取输出
   */
  private async dockerCommandOutput(args: string[]): Promise<string> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.dockerPath, args);
      
      let output = '';
      let error = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Docker command failed: ${error}`));
        }
      });
      
      process.on('error', reject);
    });
  }
  
  /**
   * 获取行为日志
   */
  // @ts-ignore
  private async getBehaviorLogs(_instance: SandboxInstance): Promise<BehaviorResult> {
    // 从Docker stats/logs分析行为
    // 这是一个简化实现
    return {
      suspicious: [],
      networkConnections: [],
      fileAccesses: [],
      processSpawns: [],
      syscallViolations: []
    };
  }
}
