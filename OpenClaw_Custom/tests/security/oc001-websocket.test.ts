import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StrictOriginValidator, 
  type WebSocketConnectionRequest 
} from '../../src/decorators/security/origin-validator.js';

describe('OC-001: WebSocket Origin Validation', () => {
  let validator: StrictOriginValidator;
  
  beforeEach(() => {
    validator = new StrictOriginValidator({
      allowedOrigins: ['http://localhost:3000', 'https://example.com'],
      tokenBindingEnabled: true,
      ipBindingEnabled: false,
      allowEmptyOrigin: false
    });
  });
  
  describe('Origin validation', () => {
    it('should accept allowed origin', async () => {
      const request = createRequest({ origin: 'http://localhost:3000' });
      
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(true);
      expect(result.code).toBe('VALID');
    });
    
    it('should reject unauthorized origin', async () => {
      const request = createRequest({ origin: 'http://evil.com' });
      
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(false);
      expect(result.code).toBe('ORIGIN_NOT_ALLOWED');
    });
    
    it('should reject missing origin', async () => {
      const request = createRequest({ origin: undefined });
      
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(false);
      expect(result.code).toBe('ORIGIN_MISSING');
    });
    
    it('should support wildcard patterns', async () => {
      const wildcardValidator = new StrictOriginValidator({
        allowedOrigins: ['https://*.example.com'],
        tokenBindingEnabled: false,
        allowEmptyOrigin: false
      });
      
      const request = createRequest({ origin: 'https://sub.example.com' });
      
      const result = await wildcardValidator.validate(request);
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Token binding', () => {
    it('should bind token to origin', async () => {
      const token = 'test-token';
      const origin = 'http://localhost:3000';
      
      validator.bindToken(token, origin);
      
      expect(validator.isTokenBound(token)).toBe(true);
    });
    
    it('should validate token origin binding', async () => {
      const token = 'test-token';
      const origin = 'http://localhost:3000';
      
      validator.bindToken(token, origin);
      
      const request = createRequest({ origin, token });
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject token with wrong origin', async () => {
      const token = 'test-token';
      const boundOrigin = 'http://localhost:3000';
      const wrongOrigin = 'https://example.com';
      
      validator.bindToken(token, boundOrigin);
      
      const request = createRequest({ origin: wrongOrigin, token });
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOKEN_ORIGIN_MISMATCH');
    });
  });
  
  describe('Rate limiting', () => {
    it('should allow requests within limit', async () => {
      const request = createRequest({ origin: 'http://localhost:3000', ip: '127.0.0.1' });
      
      const result = await validator.validate(request);
      
      expect(result.valid).toBe(true);
    });
    
    it('should block excessive requests from same IP', async () => {
      const ip = '192.168.1.1';
      
      // Make many requests
      for (let i = 0; i < 70; i++) {
        const request = createRequest({ origin: 'http://localhost:3000', ip });
        await validator.validate(request);
      }
      
      // Next request should be blocked
      const request = createRequest({ origin: 'http://localhost:3000', ip });
      const result = await validator.validate(request);
      
      expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});

function createRequest(options: {
  origin?: string;
  token?: string;
  ip?: string;
}): WebSocketConnectionRequest {
  return {
    headers: {
      origin: options.origin,
      'sec-websocket-protocol': options.token,
      'user-agent': 'Test/1.0'
    },
    socket: {
      remoteAddress: options.ip || '127.0.0.1',
      remotePort: 12345
    }
  };
}
