"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User_1.default.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all users with pagination and search (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        
        const skip = (page - 1) * limit;
        
        // Build search query
        const searchQuery = {};
        if (search) {
            searchQuery.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { userId: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User_1.default.find(searchQuery)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await User_1.default.countDocuments(searchQuery);
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            users,
            totalPages,
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user by ID (Admin only)
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user status (Admin only)
router.patch('/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Valid status is required' });
        }
        
        const user = await User_1.default.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            message: `User status updated to ${status}`,
            user
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATE USER INFORMATION (Admin only) - UPDATED ENDPOINT
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, balance, algoProfitAmount, algoProfitPercentage } = req.body;
        
        // Validate required fields
        if (!firstName || !lastName || balance === undefined) {
            return res.status(400).json({ 
                message: 'First name, last name, and balance are required' 
            });
        }
        
        // Validate balance is a number
        if (typeof balance !== 'number' || balance < 0) {
            return res.status(400).json({ 
                message: 'Balance must be a positive number' 
            });
        }
        
        // Validate algo profit fields if provided
        if (algoProfitAmount !== undefined && typeof algoProfitAmount !== 'number') {
            return res.status(400).json({ 
                message: 'Algo profit amount must be a number' 
            });
        }
        
        if (algoProfitPercentage !== undefined && typeof algoProfitPercentage !== 'number') {
            return res.status(400).json({ 
                message: 'Algo profit percentage must be a number' 
            });
        }
        
        const updateData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            balance: parseFloat(balance.toFixed(2))
        };
        
        // Add algo profit fields if provided
        if (algoProfitAmount !== undefined) {
            updateData.algoProfitAmount = parseFloat(algoProfitAmount.toFixed(2));
        }
        
        if (algoProfitPercentage !== undefined) {
            updateData.algoProfitPercentage = parseFloat(algoProfitPercentage.toFixed(2));
        }
        
        const user = await User_1.default.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            message: 'User updated successfully',
            user
        });
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Toggle AI Status (User can toggle their own status)
router.patch('/toggle-ai', authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId);
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

// Get user profile (including AI status, balance, and algo profit data) - UPDATED ENDPOINT
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId).select('-password');
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
            // New algo profit fields
            algoProfitAmount: user.algoProfitAmount,
            algoProfitPercentage: user.algoProfitPercentage,
            lastProfitCalculation: user.lastProfitCalculation,
            profitType: user.algoProfitAmount > 0 ? 'profit' : user.algoProfitAmount < 0 ? 'loss' : 'neutral'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// NEW ENDPOINT: Get user profit statistics
router.get('/profit-stats', authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                userId: user.userId,
                email: user.email,
                currentBalance: user.balance,
                algoProfitAmount: user.algoProfitAmount,
                algoProfitPercentage: user.algoProfitPercentage,
                lastProfitCalculation: user.lastProfitCalculation,
                aiStatus: user.aiStatus,
                profitType: user.algoProfitAmount > 0 ? 'profit' : user.algoProfitAmount < 0 ? 'loss' : 'neutral',
                // Additional calculated fields
                absoluteProfit: Math.abs(user.algoProfitAmount),
                isProfit: user.algoProfitAmount > 0,
                isLoss: user.algoProfitAmount < 0
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

// NEW ENDPOINT: Get all users profit statistics (admin only)
router.get('/profit-stats/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User_1.default.find({}, 'userId email balance algoProfitAmount algoProfitPercentage lastProfitCalculation aiStatus firstName lastName')
            .sort({ algoProfitAmount: -1 });

        const stats = users.map(user => ({
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            currentBalance: user.balance,
            algoProfitAmount: user.algoProfitAmount,
            algoProfitPercentage: user.algoProfitPercentage,
            lastProfitCalculation: user.lastProfitCalculation,
            aiStatus: user.aiStatus,
            profitType: user.algoProfitAmount > 0 ? 'profit' : user.algoProfitAmount < 0 ? 'loss' : 'neutral',
            absoluteProfit: Math.abs(user.algoProfitAmount),
            isProfit: user.algoProfitAmount > 0,
            isLoss: user.algoProfitAmount < 0
        }));

        res.json({
            success: true,
            data: stats,
            summary: {
                totalUsers: users.length,
                usersWithProfit: users.filter(u => u.algoProfitAmount > 0).length,
                usersWithLoss: users.filter(u => u.algoProfitAmount < 0).length,
                usersNeutral: users.filter(u => u.algoProfitAmount === 0).length,
                totalProfit: users.reduce((sum, u) => sum + (u.algoProfitAmount > 0 ? u.algoProfitAmount : 0), 0),
                totalLoss: users.reduce((sum, u) => sum + (u.algoProfitAmount < 0 ? u.algoProfitAmount : 0), 0),
                averageProfitPercentage: users.length > 0 ? 
                    users.reduce((sum, u) => sum + u.algoProfitPercentage, 0) / users.length : 0,
                highestProfit: Math.max(...users.map(u => u.algoProfitAmount)),
                highestProfitPercentage: Math.max(...users.map(u => u.algoProfitPercentage))
            }
        });
    } catch (error) {
        console.error('Error fetching all users profit stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// NEW ENDPOINT: Reset algo profit for a user (admin only)
router.post('/users/:id/reset-profit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User_1.default.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    algoProfitAmount: 0,
                    algoProfitPercentage: 0,
                    lastProfitCalculation: null
                }
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Algo profit data reset successfully',
            user: {
                userId: user.userId,
                email: user.email,
                algoProfitAmount: user.algoProfitAmount,
                algoProfitPercentage: user.algoProfitPercentage,
                lastProfitCalculation: user.lastProfitCalculation
            }
        });
    } catch (error) {
        console.error('Error resetting algo profit:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;