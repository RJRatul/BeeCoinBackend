import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import depositsRoutes from './routes/deposits'; 
import balanceRoutes from './routes/balance';
import pairRoutes from './routes/pairs';
import userRoutes from './routes/user';
import { cronService } from './services/cronService'; // Import the cron service

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/deposits', depositsRoutes); 
app.use('/api/balance', balanceRoutes);
app.use('/api/pairs', pairRoutes);
app.use('/api/user', userRoutes);

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