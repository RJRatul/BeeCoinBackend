import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment-timezone';
import mongoose from 'mongoose';
import User from '../models/User';
import ProfitRule, { IProfitRule } from '../models/ProfitRule';
import Settings from '../models/Settings';

class CronService {
  private cronJob: ScheduledTask | null = null;
  private timeZone = 'Asia/Dhaka';

  // Helper function to calculate profit based on active rules
  private async calculateProfit(balance: number): Promise<{ profit: number; ruleId?: string }> {
    try {
      const activeRule = await ProfitRule.findOne({
        minBalance: { $lte: balance },
        maxBalance: { $gte: balance },
        isActive: true
      }).sort({ minBalance: 1 });

      if (activeRule) {
        // Properly type cast to IProfitRule and handle the _id
        const rule = activeRule as IProfitRule & { _id: mongoose.Types.ObjectId };
        return { profit: rule.profit, ruleId: rule._id.toString() };
      }

      return { profit: 0 };
    } catch (error) {
      console.error('Error calculating profit:', error);
      return { profit: 0 };
    }
  }

  async initScheduledJobs() {
    try {
      // Get the schedule time from settings
      const settings = await Settings.findOne().sort({ createdAt: -1 });
      const scheduleTime = settings?.cronScheduleTime || '06:00';
      this.timeZone = settings?.timeZone || 'Asia/Dhaka';
      
      // Parse the time
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      // Schedule the job
      this.scheduleJob(hours, minutes);
      
      console.log(`Cron jobs initialized - Will run daily at ${scheduleTime} ${this.timeZone}`);
    } catch (error) {
      console.error('Error initializing cron jobs:', error);
      // Fallback to default schedule
      this.scheduleJob(6, 0);
      console.log('Cron jobs initialized with fallback - Will run daily at 06:00 Asia/Dhaka');
    }
  }

  private scheduleJob(hours: number, minutes: number) {
    // Stop existing job if any
    if (this.cronJob) {
      this.cronJob.stop();
    }
    
    // Schedule new job
    this.cronJob = cron.schedule(`${minutes} ${hours} * * *`, this.updateActiveUsersBalance.bind(this), {
      timezone: this.timeZone
    });
  }

  async updateCronSchedule(time: string, timeZone: string, userId: string) {
    try {
      // Validate time format
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw new Error('Invalid time format. Use HH:mm (e.g., 06:00)');
      }

      // Parse the time
      const [hours, minutes] = time.split(':').map(Number);
      
      // Update settings
      await Settings.findOneAndUpdate(
        {},
        { 
          cronScheduleTime: time, 
          timeZone,
          updatedBy: userId 
        },
        { upsert: true, new: true }
      );
      
      // Reschedule the job
      this.scheduleJob(hours, minutes);
      this.timeZone = timeZone;
      
      console.log(`Cron schedule updated to run daily at ${time} ${timeZone}`);
      return { success: true, message: `Cron schedule updated to ${time} ${timeZone}` };
    } catch (error: any) {
      console.error('Error updating cron schedule:', error);
      return { success: false, message: error.message };
    }
  }

  async getCurrentSchedule() {
    try {
      const settings = await Settings.findOne().sort({ createdAt: -1 });
      return {
        time: settings?.cronScheduleTime || '06:00',
        timeZone: settings?.timeZone || 'Asia/Dhaka'
      };
    } catch (error) {
      console.error('Error getting current schedule:', error);
      return {
        time: '06:00',
        timeZone: 'Asia/Dhaka'
      };
    }
  }

  async updateActiveUsersBalance() {
    try {
      const now = moment().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss');
      console.log(`[${now}] Starting daily balance update for active AI users`);

      // Find all users with active AI status
      const activeUsers = await User.find({ aiStatus: true });

      if (activeUsers.length === 0) {
        console.log('No active users found for balance update');
        return;
      }

      console.log(`Found ${activeUsers.length} users with active AI status`);

      let totalProfitDistributed = 0;
      let usersUpdated = 0;

      // Process each user individually to calculate custom profit based on their balance
      for (const user of activeUsers) {
        try {
          const { profit, ruleId } = await this.calculateProfit(user.balance);
          
          // Allow both positive and negative values
          if (profit !== 0) {
            // Determine transaction type based on profit value
            const transactionType = profit > 0 ? 'credit' : 'debit';
            const description = profit > 0 
              ? 'Daily AI trading profit' 
              : 'Daily AI trading loss';

            // Prepare transaction data
            const transactionData: any = {
              amount: Math.abs(profit),
              type: transactionType,
              description: description,
              createdAt: new Date()
            };

            if (ruleId) {
              transactionData.ruleId = new mongoose.Types.ObjectId(ruleId);
            }

            // Update user's balance and add transaction record
            const updatedUser = await User.findByIdAndUpdate(
              user._id,
              {
                $inc: { balance: profit },
                $push: { transactions: transactionData }
              },
              { new: true }
            );

            if (updatedUser) {
              usersUpdated++;
              totalProfitDistributed += profit;
              console.log(`User ${updatedUser.email}: Balance $${user.balance} -> ${profit > 0 ? 'Profit' : 'Loss'} $${Math.abs(profit)} -> New Balance $${updatedUser.balance}`);
            }
          } else {
            console.log(`User ${user.email}: Balance $${user.balance} -> No profit/loss (no matching rule)`);
          }
        } catch (userError) {
          console.error(`Error updating user ${user._id}:`, userError);
        }
      }

      const resultMessage = totalProfitDistributed >= 0 
        ? `Total $${totalProfitDistributed} profit distributed to users`
        : `Total $${Math.abs(totalProfitDistributed)} loss applied to users`;
        
      console.log(`Successfully updated balances for ${usersUpdated} users`);
      console.log(resultMessage);
    } catch (error) {
      console.error('Error in updateActiveUsersBalance:', error);
    }
  }

  // Method to manually trigger balance update (for testing)
  async manualBalanceUpdate() {
    console.log('Manual balance update triggered');
    await this.updateActiveUsersBalance();
  }
}

export const cronService = new CronService();