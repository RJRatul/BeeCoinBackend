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
    const { time, timeZone, marketOffDays } = req.body;

    if (!time || !timeZone) {
      return res.status(400).json({ message: 'Time and timeZone are required' });
    }

    const result = await cronService.updateCronSchedule(time, timeZone, req.user.userId, marketOffDays);

    if (result.success) {
      res.json({
        message: result.message,
        marketOffDays: result.marketOffDays
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Error updating cron schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get market off days
router.get('/market-off-days', async (req: Request, res: Response) => {
  try {
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    const marketOffDays = settings?.marketOffDays || [0, 6];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const marketOffDayNames = marketOffDays.map(day => dayNames[day]);

    res.json({
      success: true,
      marketOffDays,
      marketOffDayNames
    });
  } catch (error) {
    console.error('Error getting market off days:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update market off days
router.put('/market-off-days', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketOffDays } = req.body;

    if (!Array.isArray(marketOffDays)) {
      return res.status(400).json({ message: 'marketOffDays must be an array' });
    }

    // Validate days (0-6)
    const invalidDays = marketOffDays.filter(day => day < 0 || day > 6);
    if (invalidDays.length > 0) {
      return res.status(400).json({ message: 'Market off days must be numbers between 0 (Sunday) and 6 (Saturday)' });
    }

    // Get current settings
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    const currentTime = settings?.cronScheduleTime || '06:00';
    const currentTimeZone = settings?.timeZone || 'Asia/Dhaka';

    // Update with current time settings plus new market off days
    const result = await cronService.updateCronSchedule(
      currentTime,
      currentTimeZone,
      req.user.userId,
      marketOffDays
    );

    if (result.success) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const marketOffDayNames = marketOffDays.map(day => dayNames[day]);

      res.json({
        message: 'Market off days updated successfully',
        marketOffDays,
        marketOffDayNames
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Error updating market off days:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;