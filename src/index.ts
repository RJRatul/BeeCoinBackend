import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import depositsRoutes from './routes/deposits'; 
import withdrawalRoutes from './routes/withdrawal'; 
import balanceRoutes from './routes/balance';
import pairRoutes from './routes/pairs';
import userRoutes from './routes/user';
import profitRulesRoutes from './routes/profitRules'; 
import cronSettingsRoutes from './routes/cronSettings';
import adminUsersRoutes from './routes/adminUsers';
import { cronService } from './services/cronService'; 
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/deposits', depositsRoutes); 
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/pairs', pairRoutes);
app.use('/api/user', userRoutes);
app.use('/api/profit-rules', profitRulesRoutes);
app.use('/api/cron-settings', cronSettingsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => {
    console.log('MongoDB connected');
    
    // Initialize cron jobs after successful DB connection
    cronService.initScheduledJobs();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log('MongoDB connection error:', err));