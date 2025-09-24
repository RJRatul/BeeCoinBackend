// models/Withdrawal.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawal extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  method: string;
  accountDetails: {
    binanceId?: string;
    // Add other method details here if needed
  };
  remarks?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: mongoose.Types.ObjectId;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 10 // Minimum withdrawal amount
  },
  method: { 
    type: String, 
    required: true,
    enum: ['Binance'], // Can add more methods later
    default: 'Binance'
  },
  accountDetails: {
    binanceId: { type: String, required: true }
  },
  remarks: { 
    type: String 
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
  }
}, {
  timestamps: true
});

export default mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);