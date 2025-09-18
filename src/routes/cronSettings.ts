import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Settings from '../models/Settings';
import User from '../models/User';
import { cronService } from '../services/cronService';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Hardcoded admin token
const HARDCODED_ADMIN_TOKEN = 'admin-hardcoded-token-12345';
const HARDCODED_ADMIN_USER_ID = '000000000000000000000001';

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
      return next();
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

// Get current cron schedule
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schedule = await cronService.getCurrentSchedule();
    res.json(schedule);
  } catch (error) {
    console.error('Error getting cron schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update cron schedule
router.put('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { time, timeZone } = req.body;

    if (!time || !timeZone) {
      return res.status(400).json({ message: 'Time and timeZone are required' });
    }

    const result = await cronService.updateCronSchedule(time, timeZone, req.user.userId);

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Error updating cron schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;