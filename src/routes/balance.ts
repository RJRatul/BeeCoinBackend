import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = express.Router();

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

// Get user balance
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.userId).select('balance');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      balance: user.balance
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;