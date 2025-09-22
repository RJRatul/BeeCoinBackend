// models/User.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  balance: number;
  status: 'active' | 'inactive';
  aiStatus: boolean;
  isAdmin?: boolean;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  referralCount: number;
  referralEarnings: number;
  // New fields for tier system
  level: number; // 0: Base, 1-5: Levels
  tier: number; // 1, 2, 3
  commissionUnlocked: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateReferralCode(): string;
  updateTierAndLevel(): Promise<void>;
  getCommissionRate(): number;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    aiStatus: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    // New fields
    level: { type: Number, default: 0 }, // Base level = 0
    tier: { type: Number, default: 3 }, // Start with tier 3
    commissionUnlocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Commission rate configuration
const COMMISSION_RATES = {
  0: { 3: 3, 2: 8, 1: 12 },   // Base level
  1: { 3: 5, 2: 10, 1: 15 },  // Level 1
  2: { 3: 6, 2: 12, 1: 18 },  // Level 2
  3: { 3: 7, 2: 14, 1: 21 },  // Level 3
  4: { 3: 9, 2: 16, 1: 25 },  // Level 4
  5: { 3: 12, 2: 18, 1: 30 }  // Level 5
};

// Thresholds for tier and level upgrades
const UPGRADE_THRESHOLDS = {
  // Level 0 (Base)
  0: { tier3: 5, tier2: 6, tier1: 7, nextLevel: 8 },
  // Level 1
  1: { tier3: 8, tier2: 9, tier1: 10, nextLevel: 11 },
  // Level 2
  2: { tier3: 11, tier2: 12, tier1: 13, nextLevel: 14 },
  // Level 3
  3: { tier3: 14, tier2: 15, tier1: 16, nextLevel: 17 },
  // Level 4
  4: { tier3: 17, tier2: 18, tier1: 19, nextLevel: 20 },
  // Level 5
  5: { tier3: 20, tier2: 21, tier1: 22, nextLevel: 1000 } // 1000 means no next level
};

// Method to get commission rate based on current level and tier
userSchema.methods.getCommissionRate = function(): number {
  const rates = COMMISSION_RATES[this.level as keyof typeof COMMISSION_RATES];
  return rates ? rates[this.tier as keyof typeof rates] || 0 : 0;
};

// Method to update tier and level based on referral count
userSchema.methods.updateTierAndLevel = async function(): Promise<void> {
  const thresholds = UPGRADE_THRESHOLDS[this.level as keyof typeof UPGRADE_THRESHOLDS];
  
  if (!thresholds) return;

  // Check if commission should be unlocked
  if (!this.commissionUnlocked && this.referralCount >= 5) {
    this.commissionUnlocked = true;
  }

  // Update tier based on referral count
  if (this.referralCount >= thresholds.tier1) {
    this.tier = 1;
  } else if (this.referralCount >= thresholds.tier2) {
    this.tier = 2;
  } else if (this.referralCount >= thresholds.tier3) {
    this.tier = 3;
  }

  // Check for level upgrade
  if (this.referralCount >= thresholds.nextLevel && this.level < 5) {
    this.level += 1;
    // Reset tier to 3 when leveling up
    this.tier = 3;
  }

  await this.save();
};

// Generate unique referral code
userSchema.methods.generateReferralCode = function(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  // Generate referral code for new users
  if (this.isNew && !this.referralCode) {
    let isUnique = false;
    let code = '';
    while (!isUnique) {
      code = this.generateReferralCode();
      const existingUser = await mongoose.model('User').findOne({ referralCode: code });
      if (!existingUser) isUnique = true;
    }
    this.referralCode = code;
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', userSchema);