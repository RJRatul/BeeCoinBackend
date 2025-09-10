import mongoose, { Document, Schema } from 'mongoose';

export interface IDeposit extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: mongoose.Types.ObjectId;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  }
}, {
  timestamps: true
});

export default mongoose.model<IDeposit>('Deposit', DepositSchema);