import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer, Lifetime, createToken, DependencyResolutionError } from '../../src/core/di/index.js';

interface ITestService {
  getValue(): string;
}

const TestServiceToken = createToken<ITestService>('TestService');

class TestService implements ITestService {
  private value: string;
  
  constructor(value = 'test') {
    this.value = value;
  }
  
  getValue(): string {
    return this.value;
  }
}

describe('DIContainer', () => {
  let container: DIContainer;
  
  beforeEach(() => {
    container = new DIContainer();
  });
  
  describe('register', () => {
    it('should register a service', () => {
      container.register(TestServiceToken, TestService);
      
      expect(container.isRegistered(TestServiceToken)).toBe(true);
    });
    
    it('should resolve a registered service', () => {
      container.register(TestServiceToken, TestService);
      
      const service = container.resolve(TestServiceToken);
      
      expect(service).toBeInstanceOf(TestService);
      expect(service.getValue()).toBe('test');
    });
    
    it('should throw when resolving unregistered service', () => {
      expect(() => container.resolve(TestServiceToken)).toThrow(DependencyResolutionError);
    });
  });
  
  describe('singleton', () => {
    it('should return same instance for singleton', () => {
      container.register(TestServiceToken, TestService, Lifetime.Singleton);
      
      const instance1 = container.resolve(TestServiceToken);
      const instance2 = container.resolve(TestServiceToken);
      
      expect(instance1).toBe(instance2);
    });
    
    it('should return different instances for transient', () => {
      container.register(TestServiceToken, TestService, Lifetime.Transient);
      
      const instance1 = container.resolve(TestServiceToken);
      const instance2 = container.resolve(TestServiceToken);
      
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('factory', () => {
    it('should register and resolve factory', () => {
      const factoryToken = createToken<string>('Factory');
      
      container.registerFactory(factoryToken, () => 'factory-value');
      
      const value = container.resolve(factoryToken);
      
      expect(value).toBe('factory-value');
    });
  });
  
  describe('instance', () => {
    it('should register instance', () => {
      const instance = new TestService('instance');
      container.registerInstance(TestServiceToken, instance);
      
      const resolved = container.resolve(TestServiceToken);
      
      expect(resolved).toBe(instance);
      expect(resolved.getValue()).toBe('instance');
    });
  });
});
