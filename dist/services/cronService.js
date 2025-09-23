"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const ProfitRule_1 = __importDefault(require("../models/ProfitRule"));
const Settings_1 = __importDefault(require("../models/Settings"));
class CronService {
    constructor() {
        this.cronJob = null;
        this.timeZone = 'Asia/Dhaka';
    }
    // Helper function to calculate profit based on active rules
    async calculateProfit(balance) {
        try {
            const activeRule = await ProfitRule_1.default.findOne({
                minBalance: { $lte: balance },
                maxBalance: { $gte: balance },
                isActive: true
            }).sort({ minBalance: 1 });
            if (activeRule) {
                // Properly type cast to IProfitRule and handle the _id
                const rule = activeRule;
                return { profit: rule.profit, ruleId: rule._id.toString() };
            }
            return { profit: 0 };
        }
        catch (error) {
            console.error('Error calculating profit:', error);
            return { profit: 0 };
        }
    }
    async initScheduledJobs() {
        try {
            // Get the schedule time from settings
            const settings = await Settings_1.default.findOne().sort({ createdAt: -1 });
            const scheduleTime = (settings === null || settings === void 0 ? void 0 : settings.cronScheduleTime) || '06:00';
            this.timeZone = (settings === null || settings === void 0 ? void 0 : settings.timeZone) || 'Asia/Dhaka';
            // Parse the time
            const [hours, minutes] = scheduleTime.split(':').map(Number);
            // Schedule the job
            this.scheduleJob(hours, minutes);
            console.log(`Cron jobs initialized - Will run daily at ${scheduleTime} ${this.timeZone}`);
        }
        catch (error) {
            console.error('Error initializing cron jobs:', error);
            // Fallback to default schedule
            this.scheduleJob(6, 0);
            console.log('Cron jobs initialized with fallback - Will run daily at 06:00 Asia/Dhaka');
        }
    }
    scheduleJob(hours, minutes) {
        // Stop existing job if any
        if (this.cronJob) {
            this.cronJob.stop();
        }
        // Schedule new job
        this.cronJob = node_cron_1.default.schedule(`${minutes} ${hours} * * *`, this.updateActiveUsersBalance.bind(this), {
            timezone: this.timeZone
        });
    }
    async updateCronSchedule(time, timeZone, userId) {
        try {
            // Validate time format
            if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                throw new Error('Invalid time format. Use HH:mm (e.g., 06:00)');
            }
            // Parse the time
            const [hours, minutes] = time.split(':').map(Number);
            // Update settings
            await Settings_1.default.findOneAndUpdate({}, {
                cronScheduleTime: time,
                timeZone,
                updatedBy: userId
            }, { upsert: true, new: true });
            // Reschedule the job
            this.scheduleJob(hours, minutes);
            this.timeZone = timeZone;
            console.log(`Cron schedule updated to run daily at ${time} ${timeZone}`);
            return { success: true, message: `Cron schedule updated to ${time} ${timeZone}` };
        }
        catch (error) {
            console.error('Error updating cron schedule:', error);
            return { success: false, message: error.message };
        }
    }
    async getCurrentSchedule() {
        try {
            const settings = await Settings_1.default.findOne().sort({ createdAt: -1 });
            return {
                time: (settings === null || settings === void 0 ? void 0 : settings.cronScheduleTime) || '06:00',
                timeZone: (settings === null || settings === void 0 ? void 0 : settings.timeZone) || 'Asia/Dhaka'
            };
        }
        catch (error) {
            console.error('Error getting current schedule:', error);
            return {
                time: '06:00',
                timeZone: 'Asia/Dhaka'
            };
        }
    }
    async updateActiveUsersBalance() {
        try {
            const now = (0, moment_timezone_1.default)().tz(this.timeZone).format('YYYY-MM-DD HH:mm:ss');
            console.log(`[${now}] Starting daily balance update for active AI users`);
            // Find all users with active AI status
            const activeUsers = await User_1.default.find({ aiStatus: true });
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
                        const transactionData = {
                            amount: Math.abs(profit),
                            type: transactionType,
                            description: description,
                            createdAt: new Date()
                        };
                        if (ruleId) {
                            transactionData.ruleId = new mongoose_1.default.Types.ObjectId(ruleId);
                        }
                        // Update user's balance and add transaction record
                        const updatedUser = await User_1.default.findByIdAndUpdate(user._id, {
                            $inc: { balance: profit },
                            $push: { transactions: transactionData }
                        }, { new: true });
                        if (updatedUser) {
                            usersUpdated++;
                            totalProfitDistributed += profit;
                            console.log(`User ${updatedUser.email}: Balance $${user.balance} -> ${profit > 0 ? 'Profit' : 'Loss'} $${Math.abs(profit)} -> New Balance $${updatedUser.balance}`);
                        }
                    }
                    else {
                        console.log(`User ${user.email}: Balance $${user.balance} -> No profit/loss (no matching rule)`);
                    }
                }
                catch (userError) {
                    console.error(`Error updating user ${user._id}:`, userError);
                }
            }
            const resultMessage = totalProfitDistributed >= 0
                ? `Total $${totalProfitDistributed} profit distributed to users`
                : `Total $${Math.abs(totalProfitDistributed)} loss applied to users`;
            console.log(`Successfully updated balances for ${usersUpdated} users`);
            console.log(resultMessage);
        }
        catch (error) {
            console.error('Error in updateActiveUsersBalance:', error);
        }
    }
    // Method to manually trigger balance update (for testing)
    async manualBalanceUpdate() {
        console.log('Manual balance update triggered');
        await this.updateActiveUsersBalance();
    }
}
exports.cronService = new CronService();
