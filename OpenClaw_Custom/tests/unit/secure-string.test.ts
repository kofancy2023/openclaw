import { describe, it, expect } from 'vitest';
import { SecureString } from '../../src/utils/secure-string.js';

describe('SecureString', () => {
  describe('fromPlaintext', () => {
    it('should encrypt plaintext', async () => {
      const plaintext = 'sensitive-data';
      const secure = await SecureString.fromPlaintext(plaintext);
      
      expect(secure.isCleared()).toBe(false);
      expect(secure.toString()).toBe('[SecureString]***REDACTED***');
      expect(secure.toJSON()).toBe('[SecureString]***REDACTED***');
    });
    
    it('should decrypt correctly', async () => {
      const plaintext = 'sensitive-data';
      const secure = await SecureString.fromPlaintext(plaintext);
      
      const decrypted = await secure.decrypt();
      
      expect(decrypted).toBe(plaintext);
    });
    
    it('should generate different IVs', async () => {
      const plaintext = 'test';
      const secure1 = await SecureString.fromPlaintext(plaintext);
      const secure2 = await SecureString.fromPlaintext(plaintext);
      
      const data1 = secure1.serialize();
      const data2 = secure2.serialize();
      
      expect(data1.iv).not.toBe(data2.iv);
    });
  });
  
  describe('clear', () => {
    it('should mark as cleared', async () => {
      const secure = await SecureString.fromPlaintext('test');
      
      secure.clear();
      
      expect(secure.isCleared()).toBe(true);
    });
    
    it('should throw when decrypting cleared', async () => {
      const secure = await SecureString.fromPlaintext('test');
      secure.clear();
      
      await expect(secure.decrypt()).rejects.toThrow('has been cleared');
    });
  });
  
  describe('hash', () => {
    it('should generate consistent hash', async () => {
      const secure1 = await SecureString.fromPlaintext('same');
      const secure2 = await SecureString.fromPlaintext('same');
      
      const hash1 = await secure1.hash();
      const hash2 = await secure2.hash();
      
      expect(hash1).toBe(hash2);
    });
    
    it('should generate different hash for different values', async () => {
      const secure1 = await SecureString.fromPlaintext('value1');
      const secure2 = await SecureString.fromPlaintext('value2');
      
      const hash1 = await secure1.hash();
      const hash2 = await secure2.hash();
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('serialize', () => {
    it('should serialize and deserialize', async () => {
      const original = await SecureString.fromPlaintext('test');
      const serialized = original.serialize();
      
      const restored = SecureString.deserialize(serialized);
      
      expect(await restored.decrypt()).toBe('test');
    });
  });
});
