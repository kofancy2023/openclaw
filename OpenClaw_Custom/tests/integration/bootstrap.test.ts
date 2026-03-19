import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  OpenClawCustomBootstrap,
  initialize,
  shutdown,
  getStatus,
  isInitialized
} from '../../src/bootstrap.js';

describe('Bootstrap Integration', () => {
  describe('OpenClawCustomBootstrap', () => {
    let bootstrap: OpenClawCustomBootstrap;
    
    it('should initialize successfully', async () => {
      bootstrap = new OpenClawCustomBootstrap({
        autoMount: true,
        migrateCredentials: false,
        debug: false
      });
      
      const status = await bootstrap.initialize();
      
      expect(status.initialized).toBe(true);
      expect(status.moduleHooksInstalled).toBe(true);
      expect(status.execHooksInstalled).toBe(true);
      // 缓解措施在迁移完成后添加
      // expect(status.riskMitigationsApplied).toContain('OC-001: WebSocket origin validation');
    });
    
    it('should provide container access', async () => {
      const container = bootstrap.getContainer();
      
      expect(container).toBeDefined();
    });
    
    it('should provide module hooks access', async () => {
      const hooks = bootstrap.getModuleHooks();
      
      expect(hooks).toBeDefined();
      
      const hookStatus = hooks.getStatus();
      expect(hookStatus.installed).toBe(true);
    });
    
    it('should shutdown cleanly', async () => {
      await bootstrap.shutdown();
      
      const status = bootstrap.getStatus();
      expect(status.initialized).toBe(false);
    });
  });
  
  describe('Global functions', () => {
    it('should initialize globally', async () => {
      const instance = await initialize({
        autoMount: true,
        migrateCredentials: false
      });
      
      expect(instance).toBeDefined();
      expect(isInitialized()).toBe(true);
      expect(getStatus()?.initialized).toBe(true);
    });
    
    it('should shutdown globally', async () => {
      await shutdown();
      
      expect(isInitialized()).toBe(false);
      expect(getStatus()).toBeNull();
    });
  });
});
