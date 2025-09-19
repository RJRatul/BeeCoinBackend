"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Deposit_1 = __importDefault(require("../models/Deposit"));
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();
// Hardcoded admin token (use the same one in your frontend)
const HARDCODED_ADMIN_TOKEN = 'admin-hardcoded-token-12345';
const HARDCODED_ADMIN_USER_ID = '000000000000000000000001'; // Fake MongoDB-like ID
// Middleware to verify JWT token OR hardcoded admin token
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
// Middleware to check if user is admin (supports both real and hardcoded admin)
const requireAdmin = async (req, res, next) => {
    try {
        // Check if it's the hardcoded admin user
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            return next(); // Allow access for hardcoded admin
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
// Special middleware for hardcoded admin only (bypasses database checks)
const isHardcodedAdmin = (req, res, next) => {
    if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
        return next();
    }
    return res.status(403).json({ message: 'Admin access required' });
};
// Create a new deposit request (User)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Hardcoded admin cannot create deposits
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            return res.status(403).json({ message: 'Admin cannot create deposit requests' });
        }
        const { amount, transactionId } = req.body;
        // Validate input
        if (!amount || !transactionId) {
            return res.status(400).json({ message: 'Amount and transaction ID are required' });
        }
        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be positive' });
        }
        // Create deposit
        const deposit = new Deposit_1.default({
            userId: req.user.userId,
            amount,
            transactionId,
            status: 'pending'
        });
        await deposit.save();
        // Populate user details for response
        await deposit.populate('userId', 'firstName lastName email');
        res.status(201).json({
            message: 'Deposit request submitted successfully',
            deposit: {
                id: deposit._id,
                amount: deposit.amount,
                transactionId: deposit.transactionId,
                status: deposit.status,
                createdAt: deposit.createdAt,
                user: deposit.userId
            }
        });
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Transaction ID already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});
// Get user's deposit history (User)
router.get('/my-deposits', authenticateToken, async (req, res) => {
    try {
        // Hardcoded admin cannot access user deposits
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            return res.status(403).json({ message: 'Admin cannot access user deposits' });
        }
        const deposits = await Deposit_1.default.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .select('amount transactionId status createdAt updatedAt adminNote');
        res.json(deposits);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
// Get all pending deposits (Admin) - Allow both real and hardcoded admin
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const deposits = await Deposit_1.default.find({ status: 'pending' })
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: 1 });
        res.json(deposits);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
// Approve a deposit (Admin) - Allow both real and hardcoded admin
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        const deposit = await Deposit_1.default.findById(req.params.id);
        if (!deposit) {
            return res.status(404).json({ message: 'Deposit not found' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: 'Deposit is not pending' });
        }
        // Update user balance AND get the updated user
        const updatedUser = await User_1.default.findByIdAndUpdate(deposit.userId, { $inc: { balance: deposit.amount } }, { new: true } // This returns the updated document
        );
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Update deposit status
        deposit.status = 'approved';
        // For hardcoded admin, use a special admin ID
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            deposit.adminId = HARDCODED_ADMIN_USER_ID;
        }
        else {
            deposit.adminId = req.user.userId;
        }
        deposit.adminNote = adminNote;
        await deposit.save();
        // Populate user details for the response
        await deposit.populate('userId', 'firstName lastName email');
        res.json({
            message: 'Deposit approved successfully',
            deposit,
            updatedBalance: updatedUser.balance // Send the new balance to frontend
        });
    }
    catch (error) {
        console.error('Error approving deposit:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Reject a deposit (Admin) - Allow both real and hardcoded admin
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        const deposit = await Deposit_1.default.findById(req.params.id);
        if (!deposit) {
            return res.status(404).json({ message: 'Deposit not found' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ message: 'Deposit is not pending' });
        }
        // Update deposit status
        deposit.status = 'rejected';
        // For hardcoded admin, use a special admin ID
        if (req.user.userId === HARDCODED_ADMIN_USER_ID) {
            deposit.adminId = HARDCODED_ADMIN_USER_ID;
        }
        else {
            deposit.adminId = req.user.userId;
        }
        deposit.adminNote = adminNote;
        await deposit.save();
        // Populate user details for the response
        await deposit.populate('userId', 'firstName lastName email');
        res.json({
            message: 'Deposit rejected successfully',
            deposit
        });
    }
    catch (error) {
        console.error('Error rejecting deposit:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Get all deposits (Admin) - Allow both real and hardcoded admin
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};
        if (status)
            query.status = status;
        const deposits = await Deposit_1.default.find(query)
            .populate('userId', 'firstName lastName email')
            .populate('adminId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Deposit_1.default.countDocuments(query);
        res.json({
            deposits,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
