import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment-timezone';
import mongoose from 'mongoose';
import User from '../models/User';
import ProfitRule, { IProfitRule } from '../models/ProfitRule';
import Settings from '../models/Settings';

class CronService {
  private balanceUpdateJob: ScheduledTask | null = null;
  private deactivationJob: ScheduledTask | null = null;
  private timeZone = 'Asia/Dhaka';
  private marketOffDays: number[] = [0, 6]; // Default: Sunday (0) and Saturday (6)

  // Helper function to check if today is a market off day
  private isMarketOffDay(): boolean {
    const today = moment().tz(this.timeZone).day(); // 0 = Sunday, 6 = Saturday
    return this.marketOffDays.includes(today);
  }

  // Helper function to calculate profit based on active rules
  private async calculateProfit(balance: number): Promise<{ profit: number; ruleId?: string }> {
    try {
      const activeRule = await ProfitRule.findOne({
        minBalance: { $lte: balance },
        maxBalance: { $gte: balance },
        isActive: true
      }).sort({ minBalance: 1 });

      if (activeRule) {
        const rule = activeRule as IProfitRule & { _id: mongoose.Types.ObjectId };
        return { profit: rule.profit, ruleId: rule._id.toString() };
      }

      return { profit: 0 };
    } catch (error) {
      console.error('Error calculating profit:', error);
      return { profit: 0 };
    }
  }

  // Helper function to calculate profit percentage
  private calculateProfitPercentage(profitAmount: number, previousBalance: number): number {
    if (previousBalance === 0) {
      return profitAmount > 0 ? 100 : (profitAmount < 0 ? -100 : 0);
    }

    const percentage = (profitAmount / previousBalance) * 100;
    return Number(percentage.toFixed(2));
  }

  async initScheduledJobs() {
    try {
      // Get the schedule time from settings
      const settings = await Settings.findOne().sort({ createdAt: -1 });
      const scheduleTime = settings?.cronScheduleTime || '06:00';
      this.timeZone = settings?.timeZone || 'Asia/Dhaka';
      this.marketOffDays = settings?.marketOffDays || [0, 6];

      // Parse the time
      const [hours, minutes] = scheduleTime.split(':').map(Number);

      // Schedule the balance update job
      this.scheduleBalanceUpdateJob(hours, minutes);

      // Schedule the AI deactivation job 1 minute after balance update
      this.scheduleDeactivationJob(hours, minutes);

      console.log(`Cron jobs initialized - Balance update at ${scheduleTime}, Deactivation at ${this.formatTime(hours, minutes + 1)} ${this.timeZone}`);
      console.log(`Market off days: ${this.marketOffDays.map(day => this.getDayName(day)).join(', ')}`);
    } catch (error) {
      console.error('Error initializing cron jobs:', error);
      // Fallback to default schedules
      this.scheduleBalanceUpdateJob(6, 0);
      this.scheduleDeactivationJob(6, 0);
      console.log('Cron jobs initialized with fallback');
    }
  }

  private getDayName(dayNumber: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
  }

  private formatTime(hours: number, minutes: number): string {
    const totalMinutes = hours * 60 + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }

  private scheduleBalanceUpdateJob(hours: number, minutes: number) {
    // Stop existing job if any
    if (this.balanceUpdateJob) {
      this.balanceUpdateJob.stop();
    }

    // Schedule new job
    this.balanceUpdateJob = cron.schedule(`${minutes} ${hours} * * *`, async () => {
      if (this.isMarketOffDay()) {
        const today = moment().tz(this.timeZone).format('dddd');
        console.log(`[${moment().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss')}] Skipping balance update - ${today} is a market off day`);
        return;
      }
      await this.updateActiveUsersBalance();
    }, {
      timezone: this.timeZone
    });
  }

  private scheduleDeactivationJob(hours: number, minutes: number) {
    // Stop existing job if any
    if (this.deactivationJob) {
      this.deactivationJob.stop();
    }

    // Calculate deactivation time (1 minute after balance update)
    const deactivationMinutes = minutes + 1;
    const deactivationHours = deactivationMinutes >= 60 ? hours + 1 : hours;
    const finalMinutes = deactivationMinutes % 60;
    const finalHours = deactivationHours % 24;

    // Schedule deactivation job
    this.deactivationJob = cron.schedule(`${finalMinutes} ${finalHours} * * *`, async () => {
      if (this.isMarketOffDay()) {
        console.log(`[${moment().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss')}] Skipping AI deactivation - Market off day`);
        return;
      }
      await this.deactivateAllAIStatus();
    }, {
      timezone: this.timeZone
    });
  }

  async updateCronSchedule(time: string, timeZone: string, userId: string, marketOffDays?: number[]) {
    try {
      // Validate time format
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw new Error('Invalid time format. Use HH:mm (e.g., 06:00)');
      }

      // Validate market off days if provided
      if (marketOffDays) {
        const invalidDays = marketOffDays.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          throw new Error('Market off days must be numbers between 0 (Sunday) and 6 (Saturday)');
        }
      }

      // Update settings
      const updateData: any = {
        cronScheduleTime: time,
        timeZone,
        updatedBy: userId
      };

      if (marketOffDays !== undefined) {
        updateData.marketOffDays = marketOffDays;
      }

      const settings = await Settings.findOneAndUpdate(
        {},
        updateData,
        { upsert: true, new: true }
      );

      // Update local variables
      this.marketOffDays = settings.marketOffDays || [0, 6];
      this.timeZone = timeZone;

      // Parse the time
      const [hours, minutes] = time.split(':').map(Number);

      // Reschedule both jobs
      this.scheduleBalanceUpdateJob(hours, minutes);
      this.scheduleDeactivationJob(hours, minutes);

      const marketOffDaysText = this.marketOffDays.map(day => this.getDayName(day)).join(', ');
      console.log(`Cron schedule updated - Balance update at ${time}, Deactivation at ${this.formatTime(hours, minutes + 1)} ${timeZone}`);
      console.log(`Market off days: ${marketOffDaysText}`);

      return { 
        success: true, 
        message: `Cron schedule updated to ${time} ${timeZone}`,
        marketOffDays: this.marketOffDays 
      };
    } catch (error: any) {
      console.error('Error updating cron schedule:', error);
      return { success: false, message: error.message };
    }
  }

  async getCurrentSchedule() {
    try {
      const settings = await Settings.findOne().sort({ createdAt: -1 });
      const scheduleTime = settings?.cronScheduleTime || '06:00';
      const timeZone = settings?.timeZone || 'Asia/Dhaka';
      const marketOffDays = settings?.marketOffDays || [0, 6];

      // Calculate deactivation time
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      const deactivationTime = this.formatTime(hours, minutes + 1);

      // Convert day numbers to names
      const marketOffDayNames = marketOffDays.map(day => this.getDayName(day));

      return {
        balanceUpdateTime: scheduleTime,
        deactivationTime: deactivationTime,
        timeZone: timeZone,
        marketOffDays: marketOffDays,
        marketOffDayNames: marketOffDayNames
      };
    } catch (error) {
      console.error('Error getting current schedule:', error);
      return {
        balanceUpdateTime: '06:00',
        deactivationTime: '06:01',
        timeZone: 'Asia/Dhaka',
        marketOffDays: [0, 6],
        marketOffDayNames: ['Sunday', 'Saturday']
      };
    }
  }

  async updateActiveUsersBalance() {
    try {
      const now = moment().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss');
      console.log(`[${now}] Starting daily balance update for active AI users`);

      // Check if today is market off day (double check)
      if (this.isMarketOffDay()) {
        const today = moment().tz(this.timeZone).format('dddd');
        console.log(`[${now}] Skipping balance update - ${today} is a market off day`);
        return;
      }

      // Find all users with active AI status
      const activeUsers = await User.find({ aiStatus: true });

      if (activeUsers.length === 0) {
        console.log('No active users found for balance update');
        return;
      }

      console.log(`Found ${activeUsers.length} users with active AI status`);

      let totalProfitDistributed = 0;
      let usersUpdated = 0;

      // Process each user individually
      for (const user of activeUsers) {
        try {
          const previousBalance = user.balance;
          const { profit, ruleId } = await this.calculateProfit(previousBalance);

          if (profit !== 0) {
            const profitPercentage = this.calculateProfitPercentage(profit, previousBalance);
            const currentAlgoProfitAmount = user.algoProfitAmount || 0;
            const currentAlgoProfitPercentage = user.algoProfitPercentage || 0;
            const newAlgoProfitAmount = currentAlgoProfitAmount + profit;
            const totalProfitEvents = (user.lastProfitCalculation ? 1 : 0) + 1;
            const newAlgoProfitPercentage = ((currentAlgoProfitPercentage * (totalProfitEvents - 1)) + profitPercentage) / totalProfitEvents;

            const transactionType = profit > 0 ? 'credit' : 'debit';
            const description = profit > 0 ? 'Daily AI trading profit' : 'Daily AI trading loss';

            const transactionData: any = {
              amount: Math.abs(profit),
              type: transactionType,
              description: description,
              createdAt: new Date()
            };

            if (ruleId) {
              transactionData.ruleId = new mongoose.Types.ObjectId(ruleId);
            }

            const updatedUser = await User.findByIdAndUpdate(
              user._id,
              {
                $inc: { balance: profit },
                $set: {
                  algoProfitAmount: newAlgoProfitAmount,
                  algoProfitPercentage: newAlgoProfitPercentage,
                  lastProfitCalculation: new Date()
                },
                $push: { transactions: transactionData }
              },
              { new: true }
            );

            if (updatedUser) {
              usersUpdated++;
              totalProfitDistributed += profit;
              console.log(`User ${updatedUser.email}: Balance $${previousBalance} -> ${profit > 0 ? 'Profit' : 'Loss'} $${Math.abs(profit)} (${profitPercentage}%) -> New Balance $${updatedUser.balance}, Total Profit: $${newAlgoProfitAmount}`);
            }
          } else {
            await User.findByIdAndUpdate(
              user._id,
              {
                $set: {
                  lastProfitCalculation: new Date()
                }
              }
            );
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

  async deactivateAllAIStatus() {
    try {
      const now = moment().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss');
      console.log(`[${now}] Starting AI status deactivation for all users`);

      // Find all users with active AI status
      const activeUsers = await User.find({ aiStatus: true });

      if (activeUsers.length === 0) {
        console.log('No active users found for AI deactivation');
        return;
      }

      console.log(`Found ${activeUsers.length} users with active AI status to deactivate`);

      const result = await User.updateMany(
        { aiStatus: true },
        {
          $set: { aiStatus: false },
          $push: {
            transactions: {
              amount: 0,
              type: 'system',
              description: 'AI auto-deactivated after daily balance update',
              createdAt: new Date()
            }
          }
        }
      );

      console.log(`Successfully deactivated AI status for ${result.modifiedCount} users at ${now}`);

    } catch (error) {
      console.error('Error in deactivateAllAIStatus:', error);
    }
  }

  // Method to manually trigger balance update (for testing)
  async manualBalanceUpdate() {
    console.log('Manual balance update triggered');
    await this.updateActiveUsersBalance();
  }

  // Method to manually trigger AI deactivation (for testing)
  async manualAIDeactivation() {
    console.log('Manual AI deactivation triggered');
    await this.deactivateAllAIStatus();
  }

  // Stop all cron jobs
  stopAllJobs() {
    if (this.balanceUpdateJob) {
      this.balanceUpdateJob.stop();
      this.balanceUpdateJob = null;
    }
    if (this.deactivationJob) {
      this.deactivationJob.stop();
      this.deactivationJob = null;
    }
  }
}

export const cronService = new CronService();