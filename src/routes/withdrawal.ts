// routes/withdrawal.ts
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Withdrawal, { IWithdrawal } from '../models/Withdrawal';
import User from '../models/User';

const router = express.Router();

// Define custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Hardcoded admin token (use the same one in your frontend)
const HARDCODED_ADMIN_TOKEN = 'admin-hardcoded-token-12345';
const HARDCODED_ADMIN_USER_ID = '000000000000000000000001';

// Middleware to verify JWT token OR hardcoded admin token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  if (token === HARDCODED_ADMIN_TOKEN) {
    req.user = { 
      userId: HARDCODED_ADMIN_USER_ID,
      isAdmin: true 
    };
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
      return next();
    }

    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new withdrawal request (User)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Hardcoded admin cannot create withdrawals
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
      return res.status(403).json({ message: 'Admin cannot create withdrawal requests' });
    }

    const { amount, method, binanceId, remarks } = req.body;

    // Validate input
    if (!amount || !method || !binanceId) {
      return res.status(400).json({ message: 'Amount, method, and Binance ID are required' });
    }

    if (amount < 10) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is $10' });
    }

    // Check user balance
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.balance < 20) {
      return res.status(400).json({ message: 'Minimum balance of $20 required for withdrawal' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Check if user has exactly $10 (can't withdraw)
    if (user.balance <= 10) {
      return res.status(400).json({ message: 'Balance must be above $10 to withdraw' });
    }

    // Check if withdrawal amount would leave balance below $10 (if not withdrawing all)
    if (user.balance - amount < 10 && user.balance - amount > 0) {
      return res.status(400).json({ 
        message: 'After withdrawal, balance must be at least $10 or zero' 
      });
    }

    // Deduct amount from user balance immediately
    user.balance -= amount;
    await user.save();

    // Create withdrawal
    const withdrawal: IWithdrawal = new Withdrawal({
      userId: req.user.userId,
      amount,
      method,
      accountDetails: {
        binanceId
      },
      remarks,
      status: 'pending'
    });

    await withdrawal.save();
    await withdrawal.populate('userId', 'firstName lastName email');

    res.status(201).json({
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        method: withdrawal.method,
        binanceId: withdrawal.accountDetails.binanceId,
        remarks: withdrawal.remarks,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        user: withdrawal.userId,
        currentBalance: user.balance
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's withdrawal history (User)
router.get('/my-withdrawals', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
      return res.status(403).json({ message: 'Admin cannot access user withdrawals' });
    }

    const withdrawals = await Withdrawal.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .select('amount method status createdAt updatedAt adminNote remarks accountDetails');

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending withdrawals (Admin)
router.get('/pending', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: 1 });

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve a withdrawal (Admin)
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminNote } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal is not pending' });
    }

    // Amount was already deducted when withdrawal was created
    // Just update the status
    withdrawal.status = 'approved';
    withdrawal.adminId = req.user.userId === HARDCODED_ADMIN_USER_ID ? HARDCODED_ADMIN_USER_ID as any : req.user.userId;
    withdrawal.adminNote = adminNote;

    await withdrawal.save();
    await withdrawal.populate('userId', 'firstName lastName email');

    res.json({ 
      message: 'Withdrawal approved successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject a withdrawal (Admin)
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminNote } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal is not pending' });
    }

    // Return amount to user balance
    const user = await User.findById(withdrawal.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.balance += withdrawal.amount;
    await user.save();

    // Update withdrawal status
    withdrawal.status = 'rejected';
    withdrawal.adminId = req.user.userId === HARDCODED_ADMIN_USER_ID ? HARDCODED_ADMIN_USER_ID as any : req.user.userId;
    withdrawal.adminNote = adminNote;
    await withdrawal.save();

    await withdrawal.populate('userId', 'firstName lastName email');

    res.json({ 
      message: 'Withdrawal rejected successfully',
      withdrawal,
      returnedBalance: user.balance
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all withdrawals (Admin)
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query: any = {};
    if (status) query.status = status;

    const withdrawals = await Withdrawal.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Withdrawal.countDocuments(query);

    res.json({
      withdrawals,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;