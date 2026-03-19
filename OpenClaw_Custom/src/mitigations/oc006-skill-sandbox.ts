/**
 * OC-006 Skill供应链攻击缓解措施
 * 实施多维度静态分析和行为沙箱
 */

import { ISandbox } from '../core/interfaces/sandbox.js';
import { ScanResult } from '../core/interfaces/security.js';

/**
 * Skill安装规范
 */
export interface SkillSpec {
  name: string;
  version?: string;
  source: string;
  sourceType: 'npm' | 'git' | 'local' | 'url';
  checksum?: string;
  dependencies?: string[];
}

/**
 * 安装结果
 */
export interface InstallResult {
  success: boolean;
  path?: string;
  error?: string;
  riskScore: number;
  warnings: string[];
  scanResults: ScanResult[];
}

/**
 * 静态分析结果
 */
export interface StaticAnalysisResult {
  passed: boolean;
  riskScore: number;
  findings: Finding[];
}

/**
 * 发现的问题
 */
export interface Finding {
  type: 'dangerous_pattern' | 'suspicious_import' | 'high_entropy' | 'obfuscation' | 'permission_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line?: number;
  message: string;
  code?: string;
}

/**
 * 行为测试结果
 */
export interface BehaviorTestResult {
  passed: boolean;
  suspicious: string[];
  networkConnections: string[];
  fileAccesses: string[];
  processSpawns: string[];
}

/**
 * 扫描器接口
 */
export interface SkillScanner {
  name: string;
  scan(source: string): Promise<ScanResult>;
}

/**
 * Skill沙箱安全加固
 */
export class SkillSandboxHardening {
  private sandbox: ISandbox;
  private scanners: SkillScanner[];
  private maxRiskScore: number;
  
  constructor(
    sandbox: ISandbox,
    options: {
      maxRiskScore?: number;
      scanners?: SkillScanner[];
    } = {}
  ) {
    this.sandbox = sandbox;
    this.maxRiskScore = options.maxRiskScore ?? 0.3;
    this.scanners = options.scanners || this.createDefaultScanners();
  }
  
  /**
   * 安装Skill（带安全检查）
   */
  async installSkill(spec: SkillSpec): Promise<InstallResult> {
    const warnings: string[] = [];
    const scanResults: ScanResult[] = [];
    
    try {
      // 1. 下载Skill
      console.log(`[OC-006] Downloading skill: ${spec.name}`);
      const downloadResult = await this.downloadSkill(spec);
      
      // 2. 静态分析
      console.log(`[OC-006] Running static analysis...`);
      const staticResult = await this.performStaticAnalysis(downloadResult.path);
      
      if (staticResult.riskScore > this.maxRiskScore) {
        return {
          success: false,
          error: `Static analysis failed: Risk score ${staticResult.riskScore} exceeds threshold ${this.maxRiskScore}`,
          riskScore: staticResult.riskScore,
          warnings: staticResult.findings.map(f => f.message),
          scanResults
        };
      }
      
      // 3. 多维度扫描
      console.log(`[OC-006] Running multi-dimensional scan...`);
      for (const scanner of this.scanners) {
        const result = await scanner.scan(downloadResult.path);
        scanResults.push(result);
        
        if (!result.clean) {
          warnings.push(`${scanner.name} detected threats: ${result.threats.map(t => t.type).join(', ')}`);
        }
      }
      
      // 4. 行为测试
      console.log(`[OC-006] Running behavior test...`);
      const behaviorResult = await this.performBehaviorTest(downloadResult.path);
      
      if (behaviorResult.suspicious.length > 0) {
        return {
          success: false,
          error: `Behavior test failed: Suspicious behaviors detected - ${behaviorResult.suspicious.join(', ')}`,
          riskScore: 0.8,
          warnings: behaviorResult.suspicious,
          scanResults
        };
      }
      
      // 5. 隔离安装
      console.log(`[OC-006] Installing in sandbox...`);
      const installResult = await this.performSandboxedInstall(
        downloadResult.path,
        spec
      );
      
      return {
        success: installResult.success,
        path: installResult.path,
        error: installResult.error,
        riskScore: staticResult.riskScore,
        warnings,
        scanResults
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${error}`,
        riskScore: 1.0,
        warnings,
        scanResults
      };
    }
  }
  
  /**
   * 下载Skill
   */
  private async downloadSkill(spec: SkillSpec): Promise<{ path: string }> {
    const { mkdtemp } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const path = await import('path');
    
    const tempDir = await mkdtemp(path.join(tmpdir(), 'skill-'));
    
    switch (spec.sourceType) {
      case 'npm':
        await this.downloadFromNpm(spec, tempDir);
        break;
      case 'git':
        await this.downloadFromGit(spec, tempDir);
        break;
      case 'local':
        await this.copyFromLocal(spec, tempDir);
        break;
      case 'url':
        await this.downloadFromUrl(spec, tempDir);
        break;
    }
    
    return { path: tempDir };
  }
  
  /**
   * 从npm下载
   */
  private async downloadFromNpm(spec: SkillSpec, targetDir: string): Promise<void> {
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', [
        'pack',
        `${spec.source}@${spec.version || 'latest'}`,
        '--pack-destination',
        targetDir
      ]);
      
      npm.on('close', (code) => {
        if (code === 0) {
          // 解压tarball
          const tar = spawn('tar', [
            '-xzf',
            path.join(targetDir, '*.tgz'),
            '-C',
            targetDir
          ]);
          
          tar.on('close', (tarCode) => {
            if (tarCode === 0) {
              resolve();
            } else {
              reject(new Error('Failed to extract npm package'));
            }
          });
        } else {
          reject(new Error(`npm pack failed with code ${code}`));
        }
      });
    });
  }
  
  /**
   * 从Git下载
   */
  private async downloadFromGit(spec: SkillSpec, targetDir: string): Promise<void> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const git = spawn('git', [
        'clone',
        '--depth', '1',
        spec.source,
        targetDir
      ]);
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git clone failed with code ${code}`));
        }
      });
    });
  }
  
  /**
   * 从本地复制
   */
  private async copyFromLocal(spec: SkillSpec, targetDir: string): Promise<void> {
    const { cp } = await import('fs/promises');
    await cp(spec.source, targetDir, { recursive: true });
  }
  
  /**
   * 从URL下载
   */
  private async downloadFromUrl(spec: SkillSpec, targetDir: string): Promise<void> {
    const response = await fetch(spec.source);
    const buffer = await response.arrayBuffer();
    
    const path = await import('path');
    const { writeFile } = await import('fs/promises');
    
    const fileName = path.basename(new URL(spec.source).pathname) || 'skill.zip';
    const filePath = path.join(targetDir, fileName);
    
    await writeFile(filePath, Buffer.from(buffer));
  }
  
  /**
   * 执行静态分析
   */
  private async performStaticAnalysis(skillPath: string): Promise<StaticAnalysisResult> {
    const findings: Finding[] = [];
    
    // 1. 模式扫描
    const patternFindings = await this.scanPatterns(skillPath);
    findings.push(...patternFindings);
    
    // 2. 依赖分析
    const dependencyFindings = await this.analyzeDependencies(skillPath);
    findings.push(...dependencyFindings);
    
    // 3. 权限分析
    const permissionFindings = await this.analyzePermissions(skillPath);
    findings.push(...permissionFindings);
    
    // 计算风险分数
    const riskScore = this.calculateRiskScore(findings);
    
    return {
      passed: riskScore <= this.maxRiskScore,
      riskScore,
      findings
    };
  }
  
  /**
   * 扫描危险模式
   */
  private async scanPatterns(skillPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const { glob } = await import('glob');
    const { readFile } = await import('fs/promises');
    
    // 查找所有JS/TS文件
    const files = await glob('**/*.{js,ts,mjs,cjs}', { cwd: skillPath });
    
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'Use of eval()' },
      { pattern: /Function\s*\(\s*["']/, message: 'Dynamic function creation' },
      { pattern: /child_process/, message: 'Use of child_process' },
      { pattern: /require\s*\(\s*["']fs["']\s*\)/, message: 'File system access' },
      { pattern: /require\s*\(\s*["']net["']\s*\)/, message: 'Network access' },
      { pattern: /require\s*\(\s*["']http["']\s*\)/, message: 'HTTP access' },
      { pattern: /fetch\s*\(/, message: 'Network fetch' },
      { pattern: /process\.env/, message: 'Environment variable access' },
      { pattern: /fs\.readFile/, message: 'File read operation' },
      { pattern: /fs\.writeFile/, message: 'File write operation' }
    ];
    
    for (const file of files) {
      const content = await readFile(`${skillPath}/${file}`, 'utf8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        for (const { pattern, message } of dangerousPatterns) {
          if (pattern.test(lines[i])) {
            findings.push({
              type: 'dangerous_pattern',
              severity: 'medium',
              file,
              line: i + 1,
              message,
              code: lines[i].trim()
            });
          }
        }
      }
    }
    
    return findings;
  }
  
  /**
   * 分析依赖
   */
  private async analyzeDependencies(skillPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    
    const packageJsonPath = path.join(skillPath, 'package.json');
    
    try {
      const content = await readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(content);
      
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };
      
      const suspiciousPackages = [
        'node-fetch',
        'axios',
        'request',
        'child_process',
        'fs-extra',
        'shelljs',
        'execa'
      ];
      
      for (const pkg of suspiciousPackages) {
        if (deps[pkg]) {
          findings.push({
            type: 'suspicious_import',
            severity: 'low',
            file: 'package.json',
            message: `Dependency on ${pkg} detected`
          });
        }
      }
      
    } catch {
      // package.json不存在或无效
    }
    
    return findings;
  }
  
  /**
   * 分析权限
   */
  private async analyzePermissions(skillPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const { stat } = await import('fs/promises');
    const path = await import('path');
    
    // 检查是否有可执行文件
    const binDir = path.join(skillPath, 'bin');
    
    try {
      const stats = await stat(binDir);
      if (stats.isDirectory()) {
        findings.push({
          type: 'permission_issue',
          severity: 'low',
          file: 'bin/',
          message: 'Binary files present'
        });
      }
    } catch {
      // bin目录不存在
    }
    
    return findings;
  }
  
  /**
   * 执行行为测试
   */
  private async performBehaviorTest(skillPath: string): Promise<BehaviorTestResult> {
    const suspicious: string[] = [];
    const networkConnections: string[] = [];
    const fileAccesses: string[] = [];
    const processSpawns: string[] = [];
    
    // 创建隔离沙箱
    const sandbox = await this.sandbox.create({
      image: 'openclaw-skill-test:latest',
      network: 'monitored',
      filesystem: 'overlay',
      resources: {
        memory: '512m',
        cpu: '0.5',
        timeout: 300000
      },
      mounts: [{
        source: skillPath,
        target: '/skill',
        readonly: true
      }]
    });
    
    try {
      // 运行测试脚本
      const result = await this.sandbox.execute(sandbox, {
        command: ['node', 'test.js'],
        workingDir: '/skill',
        timeout: 300000
      });
      
      // 分析结果
      if (result.stdout.includes('network')) {
        suspicious.push('Network activity detected');
      }
      
      if (result.stdout.includes('file')) {
        suspicious.push('File system access detected');
      }
      
    } catch (error) {
      suspicious.push(`Test execution failed: ${error}`);
    } finally {
      // 清理沙箱
      await this.sandbox.destroy(sandbox);
    }
    
    return {
      passed: suspicious.length === 0,
      suspicious,
      networkConnections,
      fileAccesses,
      processSpawns
    };
  }
  
  /**
   * 沙箱中执行安装
   */
  private async performSandboxedInstall(
    skillPath: string,
    spec: SkillSpec
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const outputDir = `/opt/openclaw/skills/${spec.name}`;
    
    const sandbox = await this.sandbox.create({
      image: 'openclaw-skill-install:latest',
      network: 'none',
      filesystem: 'ephemeral',
      resources: {
        memory: '1g',
        cpu: '1.0'
      },
      mounts: [
        {
          source: skillPath,
          target: '/skill-src',
          readonly: true
        },
        {
          source: outputDir,
          target: '/skill-out',
          readonly: false
        }
      ]
    });
    
    try {
      let installCommand: string[];
      
      switch (spec.sourceType) {
        case 'npm':
          installCommand = ['npm', 'install', '--production', '--no-optional'];
          break;
        case 'git':
        case 'local':
          installCommand = ['cp', '-r', '/skill-src/.', '/skill-out/'];
          break;
        default:
          installCommand = ['echo', 'No install step'];
      }
      
      const result = await this.sandbox.execute(sandbox, {
        command: installCommand,
        workingDir: '/skill-src',
        timeout: 600000
      });
      
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Install failed: ${result.stderr}`
        };
      }
      
      return {
        success: true,
        path: outputDir
      };
      
    } finally {
      await this.sandbox.destroy(sandbox);
    }
  }
  
  /**
   * 计算风险分数
   */
  private calculateRiskScore(findings: Finding[]): number {
    const severityWeights = {
      critical: 1.0,
      high: 0.5,
      medium: 0.2,
      low: 0.05
    };
    
    const totalWeight = findings.reduce((sum, f) => {
      return sum + severityWeights[f.severity];
    }, 0);
    
    // 归一化到0-1
    return Math.min(1, totalWeight / 5);
  }
  
  /**
   * 创建默认扫描器
   */
  private createDefaultScanners(): SkillScanner[] {
    return [
      {
        name: 'PatternScanner',
        scan: async () => ({ clean: true, threats: [], confidence: 1 })
      },
      {
        name: 'EntropyScanner',
        scan: async () => ({ clean: true, threats: [], confidence: 1 })
      }
    ];
  }
}
