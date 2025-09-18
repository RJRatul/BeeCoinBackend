import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ProfitRule from '../models/ProfitRule';
import User from '../models/User';

const router = express.Router();

// Define custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Hardcoded admin token (use the same one in your frontend)
const HARDCODED_ADMIN_TOKEN = 'admin-hardcoded-token-12345';
const HARDCODED_ADMIN_USER_ID = '000000000000000000000001'; // Fake MongoDB-like ID

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // Check if it's the hardcoded admin token
  if (token === HARDCODED_ADMIN_TOKEN) {
    req.user = { 
      userId: HARDCODED_ADMIN_USER_ID,
      isAdmin: true 
    };
    return next();
  }

  // Otherwise, verify as JWT token
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
    // Check if it's the hardcoded admin user
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
      return next(); // Allow access for hardcoded admin
    }

    // For regular users, check if they're admin in database
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all profit rules (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await ProfitRule.find().sort({ minBalance: 1 });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching profit rules:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new profit rule (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minBalance, maxBalance, profit, isActive } = req.body;

    // Validate input
    if (minBalance === undefined || maxBalance === undefined || profit === undefined) {
      return res.status(400).json({ message: 'minBalance, maxBalance, and profit are required' });
    }

    if (minBalance >= maxBalance) {
      return res.status(400).json({ message: 'minBalance must be less than maxBalance' });
    }

    const newRule = new ProfitRule({
      minBalance,
      maxBalance,
      profit,
      isActive: isActive !== undefined ? isActive : true
    });

    await newRule.save();
    res.status(201).json({
      message: 'Profit rule created successfully',
      rule: newRule
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Profit rule with this balance range already exists' });
    }
    console.error('Error creating profit rule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profit rule (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minBalance, maxBalance, profit, isActive } = req.body;
    const ruleId = req.params.id;

    const updateData: any = {};
    if (minBalance !== undefined) updateData.minBalance = minBalance;
    if (maxBalance !== undefined) updateData.maxBalance = maxBalance;
    if (profit !== undefined) updateData.profit = profit;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedRule = await ProfitRule.findByIdAndUpdate(
      ruleId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedRule) {
      return res.status(404).json({ message: 'Profit rule not found' });
    }

    res.json({
      message: 'Profit rule updated successfully',
      rule: updatedRule
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Profit rule with this balance range already exists' });
    }
    console.error('Error updating profit rule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete profit rule (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ruleId = req.params.id;
    const deletedRule = await ProfitRule.findByIdAndDelete(ruleId);

    if (!deletedRule) {
      return res.status(404).json({ message: 'Profit rule not found' });
    }

    res.json({ message: 'Profit rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting profit rule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle profit rule status (Admin only)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await ProfitRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({ message: 'Profit rule not found' });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    res.json({
      message: `Profit rule ${rule.isActive ? 'activated' : 'deactivated'} successfully`,
      rule: {
        id: rule._id,
        isActive: rule.isActive
      }
    });
  } catch (error) {
    console.error('Error toggling profit rule status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;