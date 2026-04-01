import { AuthService } from './AuthService';

describe('AuthService', () => {
  it('should hash PIN', async () => {
    const pin = '1234';
    const hash = await AuthService.hashPin(pin);
    expect(hash).not.toBe(pin);
  });

  it('should verify PIN', async () => {
    const pin = '1234';
    const hash = await AuthService.hashPin(pin);
    const result = await AuthService.verifyPin(pin, hash);
    expect(result).toBe(true);
  });

  it('should reject wrong PIN', async () => {
    const hash = await AuthService.hashPin('1234');
    const result = await AuthService.verifyPin('9999', hash);
    expect(result).toBe(false);
  });

  it('should generate JWT token', () => {
    const token = AuthService.generateToken('user-123', 'service');
    expect(token).toBeTruthy();
  });

  it('should verify JWT token', () => {
    const token = AuthService.generateToken('user-123', 'service');
    const verified = AuthService.verifyToken(token);
    expect(verified.userId).toBe('user-123');
    expect(verified.role).toBe('service');
  });

  it('should return null for invalid token', () => {
    const result = AuthService.verifyToken('invalid-token');
    expect(result).toBeNull();
  });
});
