import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  userId: string;
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
  level: number;
  tier: number;
  commissionUnlocked: boolean;
  algoProfitAmount: number;
  algoProfitPercentage: number;
  lastProfitCalculation?: Date;
  transactions: Array<{
    amount: number;
    type: 'credit' | 'debit' | 'system';
    description: string;
    ruleId?: mongoose.Types.ObjectId;
    createdAt: Date;
    _id: mongoose.Types.ObjectId;
  }>;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateReferralCode(): string;
  updateTierAndLevel(): Promise<void>;
  getCommissionRate(): number;
  calculateProfitPercentage(profitAmount: number, previousBalance: number): number;
}

interface IUserModel extends Model<IUser> {
  generateUniqueUserId(): Promise<string>;
}

const TransactionSchema = new Schema({
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit', 'system'], required: true },
  description: { type: String, required: true },
  ruleId: { type: Schema.Types.ObjectId, ref: 'ProfitRule' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new Schema<IUser, IUserModel>(
  {
    userId: { type: String, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    aiStatus: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    referralCode: { type: String, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    tier: { type: Number, default: 3 },
    commissionUnlocked: { type: Boolean, default: false },
    algoProfitAmount: { type: Number, default: 0 },
    algoProfitPercentage: { type: Number, default: 0 },
    lastProfitCalculation: { type: Date },
    transactions: [TransactionSchema]
  },
  { timestamps: true }
);

const COMMISSION_RATES = {
  0: { 3: 3, 2: 8, 1: 12 },
  1: { 3: 5, 2: 10, 1: 15 },
  2: { 3: 6, 2: 12, 1: 18 },
  3: { 3: 7, 2: 14, 1: 21 },
  4: { 3: 9, 2: 16, 1: 25 },
  5: { 3: 12, 2: 18, 1: 30 }
};

const UPGRADE_THRESHOLDS = {
  0: { tier3: 5, tier2: 6, tier1: 7, nextLevel: 8 },
  1: { tier3: 8, tier2: 9, tier1: 10, nextLevel: 11 },
  2: { tier3: 11, tier2: 12, tier1: 13, nextLevel: 14 },
  3: { tier3: 14, tier2: 15, tier1: 16, nextLevel: 17 },
  4: { tier3: 17, tier2: 18, tier1: 19, nextLevel: 20 },
  5: { tier3: 20, tier2: 21, tier1: 22, nextLevel: 1000 }
};

// ===================== MERGED PRE-SAVE HOOK =====================
userSchema.pre('save', async function(next) {
  const user = this as any;
  
  try {
    // ========== DATE FIXING ==========
    // Fix createdAt
    if (user.createdAt && typeof user.createdAt === 'object' && '$date' in user.createdAt) {
      user.createdAt = new Date(user.createdAt.$date);
    }
    
    // Fix updatedAt
    if (user.updatedAt && typeof user.updatedAt === 'object' && '$date' in user.updatedAt) {
      user.updatedAt = new Date(user.updatedAt.$date);
    }
    
    // Fix lastProfitCalculation
    if (user.lastProfitCalculation && typeof user.lastProfitCalculation === 'object' && '$date' in user.lastProfitCalculation) {
      user.lastProfitCalculation = new Date(user.lastProfitCalculation.$date);
    }
    
    // Fix transaction dates
    if (user.transactions && Array.isArray(user.transactions)) {
      user.transactions = user.transactions.map((transaction: any) => {
        if (transaction.createdAt && typeof transaction.createdAt === 'object' && '$date' in transaction.createdAt) {
          transaction.createdAt = new Date(transaction.createdAt.$date);
        }
        return transaction;
      });
    }
    
    // ========== NEW USER INITIALIZATION ==========
    if (user.isNew) {
      console.log('🔧 Creating new user, initializing fields...');
      
      // 1. Generate userId if not present
      if (!user.userId) {
        const UserModel = user.constructor as IUserModel;
        user.userId = await UserModel.generateUniqueUserId();
        console.log(`✅ Generated userId: ${user.userId}`);
      }

      // 2. Generate referral code if not present
      if (!user.referralCode) {
        let isUnique = false;
        let code = '';
        while (!isUnique) {
          code = user.generateReferralCode();
          const existingUser = await mongoose.model('User').findOne({ referralCode: code });
          if (!existingUser) isUnique = true;
        }
        user.referralCode = code;
        console.log(`✅ Generated referralCode: ${user.referralCode}`);
      }

      // 3. Initialize ALL required fields for new users
      user.balance = user.balance || 0;
      user.status = 'active';
      user.aiStatus = false;
      user.isAdmin = false;
      user.referralCount = 0;
      user.referralEarnings = 0;
      user.level = 0;
      user.tier = 3;
      user.commissionUnlocked = false;
      user.algoProfitAmount = 0;
      user.algoProfitPercentage = 0;
      user.lastProfitCalculation = undefined;
      user.transactions = [];
      
      console.log('✅ All fields initialized for new user');
    }

    // 4. Hash password if modified
    if (user.isModified('password')) {
      user.password = await bcrypt.hash(user.password, 12);
      console.log('✅ Password hashed');
    }

    next();
  } catch (error: any) {
    console.error('❌ Error in pre-save hook:', error);
    next(error);
  }
});

// ===================== QUERY MIDDLEWARE =====================
// Query middleware to fix dates when finding users
userSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.createdAt && typeof doc.createdAt === 'object' && '$date' in doc.createdAt) {
        doc.createdAt = new Date(doc.createdAt.$date);
      }
      if (doc.updatedAt && typeof doc.updatedAt === 'object' && '$date' in doc.updatedAt) {
        doc.updatedAt = new Date(doc.updatedAt.$date);
      }
      if (doc.lastProfitCalculation && typeof doc.lastProfitCalculation === 'object' && '$date' in doc.lastProfitCalculation) {
        doc.lastProfitCalculation = new Date(doc.lastProfitCalculation.$date);
      }
      if (doc.transactions && Array.isArray(doc.transactions)) {
        doc.transactions.forEach((transaction: any) => {
          if (transaction.createdAt && typeof transaction.createdAt === 'object' && '$date' in transaction.createdAt) {
            transaction.createdAt = new Date(transaction.createdAt.$date);
          }
        });
      }
    });
  }
});

userSchema.post('findOne', function(doc) {
  if (doc) {
    if (doc.createdAt && typeof doc.createdAt === 'object' && '$date' in doc.createdAt) {
      doc.createdAt = new Date(doc.createdAt.$date);
    }
    if (doc.updatedAt && typeof doc.updatedAt === 'object' && '$date' in doc.updatedAt) {
      doc.updatedAt = new Date(doc.updatedAt.$date);
    }
    if (doc.lastProfitCalculation && typeof doc.lastProfitCalculation === 'object' && '$date' in doc.lastProfitCalculation) {
      doc.lastProfitCalculation = new Date(doc.lastProfitCalculation.$date);
    }
    if (doc.transactions && Array.isArray(doc.transactions)) {
      doc.transactions.forEach((transaction: any) => {
        if (transaction.createdAt && typeof transaction.createdAt === 'object' && '$date' in transaction.createdAt) {
          transaction.createdAt = new Date(transaction.createdAt.$date);
        }
      });
    }
  }
  return doc;
});

// ===================== STATIC METHODS =====================
// Static method to generate unique 6-digit numeric UserId
userSchema.statics.generateUniqueUserId = async function(): Promise<string> {
  let isUnique = false;
  let userId = '';

  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    userId = randomNum.toString();
    
    const existingUser = await this.findOne({ userId });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return userId;
};

// ===================== INSTANCE METHODS =====================
// Method to generate referral code
userSchema.methods.generateReferralCode = function(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Method to calculate profit percentage
userSchema.methods.calculateProfitPercentage = function(profitAmount: number, previousBalance: number): number {
  if (previousBalance === 0) {
    return profitAmount > 0 ? 100 : (profitAmount < 0 ? -100 : 0);
  }
  const percentage = (profitAmount / previousBalance) * 100;
  return Number(percentage.toFixed(2));
};

// Method to get commission rate
userSchema.methods.getCommissionRate = function(): number {
  const rates = COMMISSION_RATES[this.level as keyof typeof COMMISSION_RATES];
  return rates ? rates[this.tier as keyof typeof rates] || 0 : 0;
};

// Method to update tier and level
userSchema.methods.updateTierAndLevel = async function(): Promise<void> {
  const thresholds = UPGRADE_THRESHOLDS[this.level as keyof typeof UPGRADE_THRESHOLDS];
  if (!thresholds) return;

  if (!this.commissionUnlocked && this.referralCount >= 5) {
    this.commissionUnlocked = true;
  }

  if (this.referralCount >= thresholds.tier1) {
    this.tier = 1;
  } else if (this.referralCount >= thresholds.tier2) {
    this.tier = 2;
  } else if (this.referralCount >= thresholds.tier3) {
    this.tier = 3;
  }

  if (this.referralCount >= thresholds.nextLevel && this.level < 5) {
    this.level += 1;
    this.tier = 3;
  }

  await this.save();
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser, IUserModel>('User', userSchema);
export default User;