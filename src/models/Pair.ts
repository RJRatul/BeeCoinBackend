import mongoose, { Document, Schema } from 'mongoose';

export interface IPair extends Document {
  pairName: string;
  svgImage: string;
  isActive: boolean;
  profitLoss: number;
  createdAt: Date;
  updatedAt: Date;
}

const PairSchema: Schema = new Schema({
  pairName: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  svgImage: { 
    type: String, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  profitLoss: { 
    type: Number, 
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model<IPair>('Pair', PairSchema);