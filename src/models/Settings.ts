import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  cronScheduleTime: string; // Format: "HH:mm" (e.g., "06:00")
  timeZone: string;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema({
  cronScheduleTime: { 
    type: String, 
    required: true, 
    default: "06:00",
    validate: {
      validator: function(v: string) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Invalid time format. Use HH:mm (e.g., 06:00)'
    }
  },
  timeZone: { 
    type: String, 
    required: true, 
    default: "Asia/Dhaka" 
  },
  updatedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, {
  timestamps: true
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = function() {
  return this.findOne().sort({ createdAt: -1 }).limit(1);
};

export default mongoose.model<ISettings>('Settings', SettingsSchema);