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
    console.error('❌ No token provided');
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    console.log('✅ Token verified for user:', user.userId);
    next();
  });
};

// Toggle AI Status (User can toggle their own status)
router.patch('/toggle-ai', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔄 Toggling AI status for user:', req.user.userId); // Add logging
    
    if (!req.user || !req.user.userId) {
      console.error('❌ No user in request');
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    const user = await User.findById(req.user.userId);
    
    if (!user) {
      console.error('❌ User not found for ID:', req.user.userId);
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log(`📊 Current AI status: ${user.aiStatus}, toggling to ${!user.aiStatus}`);
    
    user.aiStatus = !user.aiStatus;
    await user.save();

    console.log(`✅ AI status updated to: ${user.aiStatus}`);

    res.json({
      success: true,
      message: `AI trading ${user.aiStatus ? 'activated' : 'deactivated'} successfully`,
      aiStatus: user.aiStatus
    });
  } catch (error) {
    console.error('❌ Toggle AI error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
      commissionRate: user.getCommissionRate(), // Current commission rate
      // Add the new algo profit fields
      algoProfitAmount: user.algoProfitAmount || 0,
      algoProfitPercentage: user.algoProfitPercentage || 0,
      lastProfitCalculation: user.lastProfitCalculation || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// NEW ENDPOINT: Get user profit statistics
router.get('/profit-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isProfit = user.algoProfitAmount && user.algoProfitAmount > 0;
    const isLoss = user.algoProfitAmount && user.algoProfitAmount < 0;

    res.json({
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        currentBalance: user.balance,
        algoProfitAmount: user.algoProfitAmount || 0,
        algoProfitPercentage: user.algoProfitPercentage || 0,
        lastProfitCalculation: user.lastProfitCalculation || null,
        aiStatus: user.aiStatus,
        profitType: isProfit ? 'profit' : isLoss ? 'loss' : 'neutral',
        absoluteProfit: Math.abs(user.algoProfitAmount || 0),
        isProfit: isProfit,
        isLoss: isLoss
      }
    });
  } catch (error) {
    console.error('Error fetching user profit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;