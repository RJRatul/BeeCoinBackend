import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User';

class CronService {
  private timeZone = 'Asia/Dhaka'; // Bangladesh time zone

  initScheduledJobs() {
    // Schedule daily balance update at 5:05 AM Bangladesh time
    cron.schedule('5 5 * * *', this.updateActiveUsersBalance.bind(this), {
      timezone: this.timeZone
    });

    console.log('Cron jobs initialized - Will run daily at 5:05 AM Bangladesh time');
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

      // Use bulk operations for better performance
      const bulkOps = activeUsers.map(user => ({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $inc: { balance: 100 },
            $push: {
              transactions: {
                amount: 100,
                type: 'credit',
                description: 'Daily AI trading reward',
                createdAt: new Date()
              }
            }
          }
        }
      }));

      // Execute bulk operation
      const result = await User.bulkWrite(bulkOps);
      
      console.log(`Successfully updated balances for ${result.modifiedCount} users`);
      console.log(`Total $${activeUsers.length * 100} distributed to users`);
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