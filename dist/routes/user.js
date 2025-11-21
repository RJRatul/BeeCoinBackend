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

// UPDATE USER INFORMATION (Admin only) - NEW ENDPOINT
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, balance } = req.body;
        
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
        
        const updateData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            balance: parseFloat(balance.toFixed(2))
        };
        
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

// Get user profile (including AI status and balance)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            balance: user.balance,
            status: user.status,
            aiStatus: user.aiStatus
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;