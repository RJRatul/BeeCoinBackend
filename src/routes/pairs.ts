import express, { Request, Response, NextFunction } from 'express';
import Pair, { IPair } from '../models/Pair';
import User from '../models/User';
import jwt from 'jsonwebtoken';

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

// Create a new pair (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pairName, svgImage, isActive, profitLoss } = req.body;

    // Validate input
    if (!pairName || !svgImage || profitLoss === undefined) {
      return res.status(400).json({ 
        message: 'Pair name, SVG image, and profit/loss are required' 
      });
    }

    // Create pair
    const pair: IPair = new Pair({
      pairName,
      svgImage,
      isActive: isActive !== undefined ? isActive : true,
      profitLoss
    });

    await pair.save();

    res.status(201).json({
      message: 'Pair created successfully',
      pair: {
        id: pair._id,
        pairName: pair.pairName,
        svgImage: pair.svgImage,
        isActive: pair.isActive,
        profitLoss: pair.profitLoss,
        createdAt: pair.createdAt,
        updatedAt: pair.updatedAt
      }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Pair name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pairs (Admin - all pairs, User - only active)
// routes/pairs.ts - FIXED VERSION
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // For hardcoded admin, return all pairs
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
      const allPairs = await Pair.find()
        .sort({ createdAt: -1 })
        .select('pairName svgImage isActive profitLoss createdAt updatedAt');
      return res.json(allPairs);
    }

    // For regular users, check if they're admin
    const user = await User.findById(req.user.userId);
    const isAdmin = user?.isAdmin;
    
    let query = {};
    if (!isAdmin) {
      query = { isActive: true };  // Only filter for non-admin users
    }

    const pairs = await Pair.find(query)
      .sort({ createdAt: -1 })
      .select('pairName svgImage isActive profitLoss createdAt updatedAt');

    res.json(pairs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single pair by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pair = await Pair.findById(req.params.id);
    
    if (!pair) {
      return res.status(404).json({ message: 'Pair not found' });
    }

    // Non-admin users can only see active pairs
    const user = await User.findById(req.user.userId);
    if (!user?.isAdmin && !pair.isActive) {
      return res.status(404).json({ message: 'Pair not found' });
    }

    res.json(pair);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a pair (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pairName, svgImage, isActive, profitLoss } = req.body;
    
    const updateData: any = {};
    if (pairName !== undefined) updateData.pairName = pairName;
    if (svgImage !== undefined) updateData.svgImage = svgImage;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (profitLoss !== undefined) updateData.profitLoss = profitLoss;

    const pair = await Pair.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!pair) {
      return res.status(404).json({ message: 'Pair not found' });
    }

    res.json({
      message: 'Pair updated successfully',
      pair: {
        id: pair._id,
        pairName: pair.pairName,
        svgImage: pair.svgImage,
        isActive: pair.isActive,
        profitLoss: pair.profitLoss,
        updatedAt: pair.updatedAt
      }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Pair name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a pair (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pair = await Pair.findByIdAndDelete(req.params.id);

    if (!pair) {
      return res.status(404).json({ message: 'Pair not found' });
    }

    res.json({ message: 'Pair deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle pair status (Admin only)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pair = await Pair.findById(req.params.id);

    if (!pair) {
      return res.status(404).json({ message: 'Pair not found' });
    }

    pair.isActive = !pair.isActive;
    await pair.save();

    res.json({
      message: `Pair ${pair.isActive ? 'activated' : 'deactivated'} successfully`,
      pair: {
        id: pair._id,
        pairName: pair.pairName,
        isActive: pair.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;