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
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
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
    }
    catch (error) {
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
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
