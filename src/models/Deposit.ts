// models/Deposit.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IReferralCommission {
  referrerId: mongoose.Types.ObjectId;
  commissionRate: number;
  commissionAmount: number;
  paid: boolean;
}

export interface IDeposit extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: mongoose.Types.ObjectId;
  adminNote?: string;
  // NEW: Store commission details for referral tracking
  referralCommission?: IReferralCommission;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCommissionSchema: Schema = new Schema({
  referrerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  commissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  commissionAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  paid: { 
    type: Boolean, 
    default: false 
  }
});

const DepositSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  transactionId: { 
    type: String, 
    required: true,
    unique: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  adminNote: { 
    type: String 
  },
  // Add the referralCommission field
  referralCommission: {
    type: ReferralCommissionSchema,
    required: false
  }
}, {
  timestamps: true
});

export default mongoose.model<IDeposit>('Deposit', DepositSchema);