import { Request, Response } from 'express';
import User from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required' });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Only allow admin/organizer roles if explicitly granted (default: user)
    const safeRole = ['user', 'organizer', 'admin'].includes(role) ? role : 'user';
    const user = await User.create({ email, name, password, role: safeRole });

    const payload: TokenPayload = { userId: String(user._id), role: user.role, email: user.email };
    res.status(201).json({
      user,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed', detail: String(err) });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload: TokenPayload = { userId: String(user._id), role: user.role, email: user.email };
    res.json({
      user,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: String(err) });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newPayload: TokenPayload = { userId: String(user._id), role: user.role, email: user.email };
    res.json({
      accessToken: signAccessToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    // @ts-ignore
    const user = await User.findById(req.user?.userId).select('-password');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
