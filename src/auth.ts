import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthPayload } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'ultrasonic-secret-key-change-in-prod';
const SALT_ROUNDS = 10;
const users: Map<string, User> = new Map();

const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substr(2);

const seedAdmin = async () => {
  const hash = await bcrypt.hash('admin123', SALT_ROUNDS);
  users.set('admin', { id: 'admin-001', username: 'admin', email: 'admin@sensor.local', passwordHash: hash, createdAt: new Date() });
};
seedAdmin();

export const registerUser = async (username: string, email: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> => {
  if (users.has(username)) throw new Error('Username already exists');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user: User = { id: generateId(), username, email, passwordHash, createdAt: new Date() };
  users.set(username, user);
  const token = jwt.sign({ userId: user.id, username } as AuthPayload, JWT_SECRET, { expiresIn: '24h' });
  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
};

export const loginUser = async (username: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> => {
  const user = users.get(username);
  if (!user) throw new Error('Invalid credentials');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');
  const token = jwt.sign({ userId: user.id, username } as AuthPayload, JWT_SECRET, { expiresIn: '24h' });
  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try { const payload = jwt.verify(token, JWT_SECRET) as AuthPayload; (req as any).user = payload; next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};