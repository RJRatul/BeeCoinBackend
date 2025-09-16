import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User';

class CronService {
  private timeZone = 'Asia/Dhaka'; // Bangladesh time zone

  // Helper function to calculate profit based on balance
  private calculateProfit(balance: number): number {
    if (balance >= 0 && balance <= 25) return 0;
    if (balance > 25 && balance <= 60) return 1;
    if (balance > 60 && balance <= 200) return 3;
    if (balance > 200 && balance <= 500) return 10;
    if (balance > 500 && balance <= 900) return 18;
    if (balance > 900 && balance <= 1500) return 30;
    if (balance > 1500 && balance <= 2000) return 50;
    
    // For balances above $2000, you might want to define a rule
    // For now, let's return 0 for balances above $2000
    return 0;
  }

  initScheduledJobs() {
    // Schedule daily balance update at 4:10 AM Bangladesh time
    cron.schedule('10 4 * * *', this.updateActiveUsersBalance.bind(this), {
      timezone: this.timeZone
    });

    console.log('Cron jobs initialized - Will run daily at 4:10 AM Bangladesh time');
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
          const profit = this.calculateProfit(user.balance);
          
          if (profit > 0) {
            // Update user's balance and add transaction record
            const updatedUser = await User.findByIdAndUpdate(
              user._id,
              {
                $inc: { balance: profit },
                $push: {
                  transactions: {
                    amount: profit,
                    type: 'credit',
                    description: 'Daily AI trading profit',
                    createdAt: new Date()
                  }
                }
              },
              { new: true }
            );

            if (updatedUser) {
              usersUpdated++;
              totalProfitDistributed += profit;
              console.log(`User ${updatedUser.email}: Balance $${user.balance} -> Profit $${profit} -> New Balance $${updatedUser.balance}`);
            }
          } else {
            console.log(`User ${user.email}: Balance $${user.balance} -> No profit (below threshold)`);
          }
        } catch (userError) {
          console.error(`Error updating user ${user._id}:`, userError);
        }
      }

      console.log(`Successfully updated balances for ${usersUpdated} users`);
      console.log(`Total $${totalProfitDistributed} profit distributed to users`);
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