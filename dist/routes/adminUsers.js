"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();
// Hardcoded admin token
const HARDCODED_ADMIN_TOKEN = 'admin-hardcoded-token-12345';
const HARDCODED_ADMIN_USER_ID = '000000000000000000000001';
// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
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
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
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
        // Check if it's the hardcoded admin user
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            return next();
        }
        // For regular users, check if they're admin in database
        const user = await User_1.default.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const query = search
            ? {
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }
            : {};
        const users = await User_1.default.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));
        const total = await User_1.default.countDocuments(query);
        res.json({
            users,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get single user by ID (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update user status (Admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Valid status (active/inactive) is required' });
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            message: `User status updated to ${status} successfully`,
            user
        });
    }
    catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Update user profile (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, balance, isAdmin, aiStatus, status } = req.body;
        const updateData = {};
        if (firstName !== undefined)
            updateData.firstName = firstName;
        if (lastName !== undefined)
            updateData.lastName = lastName;
        if (balance !== undefined)
            updateData.balance = balance;
        if (isAdmin !== undefined)
            updateData.isAdmin = isAdmin;
        if (aiStatus !== undefined)
            updateData.aiStatus = aiStatus;
        if (status !== undefined)
            updateData.status = status;
        const user = await User_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            message: 'User updated successfully',
            user
        });
    }
    catch (error) {
        console.error('Error updating user:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
