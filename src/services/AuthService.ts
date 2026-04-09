import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'openserve-dev-secret-change-in-production';

export class AuthService {
  static async hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, 10);
  }

  static async verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }

  static generateToken(userId: string, role: string): string {
    const expiry = process.env.JWT_EXPIRY || '8h';
    return jwt.sign(
      { userId, role, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: expiry } as any
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  }
}
