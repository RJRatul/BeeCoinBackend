import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  balance: number;
  isAdmin: boolean;
  aiStatus: boolean;
  transactions: {
    amount: number;
    type: string;
    description: string;
    createdAt: Date;
  }[];
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  aiStatus: { type: Boolean, default: false },
  transactions: [{
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const user = this as any;
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  const user = this as any;
  return bcrypt.compare(candidatePassword, user.password);
};

export default mongoose.model<IUser>('User', UserSchema);