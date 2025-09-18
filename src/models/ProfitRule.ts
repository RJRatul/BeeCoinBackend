import mongoose, { Document, Schema } from 'mongoose';

export interface IProfitRule extends Document {
  minBalance: number;
  maxBalance: number;
  profit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProfitRuleSchema: Schema = new Schema({
  minBalance: { type: Number, required: true },
  maxBalance: { type: Number, required: true },
  profit: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Prevent overlapping balance ranges
ProfitRuleSchema.index({ minBalance: 1, maxBalance: 1 }, { unique: true });

export default mongoose.model<IProfitRule>('ProfitRule', ProfitRuleSchema);