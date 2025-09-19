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
// Get user balance
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId).select('balance');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            balance: user.balance
        });
    }
    catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
