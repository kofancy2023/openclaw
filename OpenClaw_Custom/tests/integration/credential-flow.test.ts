import { describe, it, expect, beforeAll } from 'vitest';
import { SecureString } from '../../src/utils/secure-string.js';

describe('OC-003: Credential Encryption Flow', () => {
  beforeAll(() => {
    // Set up master key for testing
    const masterKey = SecureString.generateMasterKey();
    SecureString.setMasterKey(masterKey);
  });
  
  describe('End-to-end encryption', () => {
    it('should encrypt and decrypt API key', async () => {
      const apiKey = 'sk-abcdefghijklmnopqrstuvwxyz1234567890abcd';
      
      // Encrypt
      const secure = await SecureString.fromPlaintext(apiKey);
      
      // Verify it's encrypted (not plaintext)
      expect(secure.toString()).not.toContain(apiKey);
      expect(secure.toString()).toBe('[SecureString]***REDACTED***');
      
      // Decrypt
      const decrypted = await secure.decrypt();
      expect(decrypted).toBe(apiKey);
    });
    
    it('should handle multiple credentials', async () => {
      const credentials = {
        openai: 'sk-openai1234567890',
        anthropic: 'sk-anthropic0987654321',
        github: 'ghp_githubtoken1234567890'
      };
      
      const secureCredentials: Record<string, SecureString> = {};
      
      for (const [name, value] of Object.entries(credentials)) {
        secureCredentials[name] = await SecureString.fromPlaintext(value);
      }
      
      // Verify all encrypted
      for (const [name, secure] of Object.entries(secureCredentials)) {
        expect(secure.toString()).toBe('[SecureString]***REDACTED***');
        
        const decrypted = await secure.decrypt();
        expect(decrypted).toBe(credentials[name as keyof typeof credentials]);
      }
    });
    
    it('should support serialization for storage', async () => {
      const secret = 'my-secret-value';
      const secure = await SecureString.fromPlaintext(secret);
      
      // Serialize (for storage)
      const serialized = secure.serialize();
      
      expect(serialized.encryptedData).toBeDefined();
      expect(serialized.iv).toBeDefined();
      expect(serialized.algorithm).toBeDefined();
      
      // Deserialize
      const restored = SecureString.deserialize(serialized);
      
      // Should decrypt to same value
      expect(await restored.decrypt()).toBe(secret);
    });
  });
  
  describe('Security properties', () => {
    it('should not expose plaintext in error messages', async () => {
      const secure = await SecureString.fromPlaintext('secret');
      secure.clear();
      
      try {
        await secure.decrypt();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).not.toContain('secret');
        expect(error.message).toContain('cleared');
      }
    });
    
    it('should generate unique encryption for same plaintext', async () => {
      const plaintext = 'same-value';
      
      const secure1 = await SecureString.fromPlaintext(plaintext);
      const secure2 = await SecureString.fromPlaintext(plaintext);
      
      const data1 = secure1.serialize();
      const data2 = secure2.serialize();
      
      // IVs should be different
      expect(data1.iv).not.toBe(data2.iv);
      
      // Encrypted data should be different
      expect(data1.encryptedData).not.toBe(data2.encryptedData);
    });
  });
});
