// routes/auth.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, referralCode } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let referredByUser = null;
    
    // Check if referral code is provided and valid
    if (referralCode) {
      referredByUser = await User.findOne({ referralCode });
      if (!referredByUser) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
    }

    const user: IUser = new User({ 
      email, 
      password, 
      firstName, 
      lastName,
      aiStatus: false,
      referredBy: referredByUser?._id
    });

    await user.save();

    // Update referrer's stats if applicable
    if (referredByUser) {
      referredByUser.referralCount += 1;
      await referredByUser.updateTierAndLevel();
      await referredByUser.save();
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        balance: user.balance,
        aiStatus: user.aiStatus,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        level: user.level,
        tier: user.tier,
        commissionUnlocked: user.commissionUnlocked
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        balance: user.balance,
        aiStatus: user.aiStatus,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        level: user.level,
        tier: user.tier,
        commissionUnlocked: user.commissionUnlocked
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;