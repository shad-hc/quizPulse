import { Request, Response } from 'express';
import User from '../models/User';
import {
  apiCreated,
  apiBadRequest,
  apiNotFound,
  apiServerError,
  apiSuccess,
  apiUnauthorized
} from "../utils/apiResponse"
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      apiBadRequest(res,'email, name, and password are required');
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

    apiCreated(res, 'Signedup Succesfully', {
      user,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
      
  } catch (err) {
    apiServerError(res, 'Signup failed',{
      error : String(err)
    })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      apiBadRequest(res,'email and password are required');
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      apiUnauthorized(res,401,'Invalid Credentials');
      return;
    }

    const payload: TokenPayload = { userId: String(user._id), role: user.role, email: user.email };
  
    apiSuccess(res,'loggedIn Succesfully',{
      user,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload)
    })
  } catch (err) {
    apiServerError(res,'login failed', {
      error: String(err)
    })
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      apiBadRequest(res,'refreshToken is required');
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user) {
      apiNotFound(res,'User not found');
      return;
    }

    const newPayload: TokenPayload = { userId: String(user._id), role: user.role, email: user.email };
  
    apiSuccess(res,'Success',{
      accessToken: signAccessToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    })
  } catch {
    apiUnauthorized(res,401,'Invalid or expired refresh token');
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user?.userId).select('-password');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
