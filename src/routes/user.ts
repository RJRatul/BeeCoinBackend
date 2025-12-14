import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: any;
}

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

// Get user profile - FIXED FOR NEW USERS
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // SAFE ACCESS: Use get() or default values for all fields
    const response = {
      success: true,
      data: {
        id: user._id,
        userId: user.userId || 'N/A',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        balance: user.balance || 0,
        status: user.status || 'active',
        aiStatus: user.aiStatus || false,
        isAdmin: user.isAdmin || false,
        referralCode: user.referralCode || 'N/A',
        referralCount: user.referralCount || 0,
        referralEarnings: user.referralEarnings || 0,
        level: user.level || 0,
        tier: user.tier || 3,
        commissionUnlocked: user.commissionUnlocked || false,
        commissionRate: user.getCommissionRate ? user.getCommissionRate() : 0,
        
        // CRITICAL: Ensure profit fields always have values
        algoProfitAmount: user.algoProfitAmount || 0,
        algoProfitPercentage: user.algoProfitPercentage || 0,
        lastProfitCalculation: user.lastProfitCalculation || null,
        
        // Ensure transactions array exists
        transactions: user.transactions || []
      }
    };

    console.log('📤 Sending user profile:', {
      userId: response.data.userId,
      hasProfitAmount: response.data.algoProfitAmount !== undefined,
      hasProfitPercentage: response.data.algoProfitPercentage !== undefined,
      transactionsCount: response.data.transactions.length
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Toggle AI Status
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
  }
});

// Get user profit statistics - FIXED FOR NEW USERS
router.get('/profit-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // SAFE ACCESS: Use default values for all fields
    const algoProfitAmount = user.algoProfitAmount || 0;
    const algoProfitPercentage = user.algoProfitPercentage || 0;
    const isProfit = algoProfitAmount > 0;
    const isLoss = algoProfitAmount < 0;

    const response = {
      success: true,
      data: {
        userId: user.userId || 'N/A',
        email: user.email || '',
        currentBalance: user.balance || 0,
        algoProfitAmount: algoProfitAmount,
        algoProfitPercentage: algoProfitPercentage,
        lastProfitCalculation: user.lastProfitCalculation || null,
        aiStatus: user.aiStatus || false,
        profitType: isProfit ? 'profit' : isLoss ? 'loss' : 'neutral',
        absoluteProfit: Math.abs(algoProfitAmount),
        isProfit: isProfit,
        isLoss: isLoss
      }
    };

    console.log('📊 Sending profit stats:', {
      userId: response.data.userId,
      profitAmount: response.data.algoProfitAmount,
      profitPercentage: response.data.algoProfitPercentage,
      hasLastProfitCalc: !!response.data.lastProfitCalculation
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching user profit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;