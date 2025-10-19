import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = express.Router();

// Define custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Toggle AI Status (User can toggle their own status)
router.patch('/toggle-ai', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle the AI status
    user.aiStatus = !user.aiStatus;
    await user.save();

    res.json({
      message: `AI trading ${user.aiStatus ? 'activated' : 'deactivated'} successfully`,
      aiStatus: user.aiStatus
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile (including AI status and balance)
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      balance: user.balance,
      status: user.status,
      aiStatus: user.aiStatus,
      referralCode: user.referralCode,
      referralCount: user.referralCount,
      referralEarnings: user.referralEarnings,
      level: user.level,
      tier: user.tier,
      commissionUnlocked: user.commissionUnlocked,
      commissionRate: user.getCommissionRate() // Current commission rate
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;