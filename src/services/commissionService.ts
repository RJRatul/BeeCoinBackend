// services/commissionService.ts
import User, { IUser } from '../models/User';
import Deposit, { IDeposit } from '../models/Deposit';

export class CommissionService {
  // Process commission when a deposit is approved
  static async processReferralCommission(deposit: IDeposit): Promise<void> {
    try {
      // Get the user who made the deposit
      const depositingUser = await User.findById(deposit.userId);
      if (!depositingUser || !depositingUser.referredBy) {
        return; // No referrer, no commission
      }

      // Get the referrer
      const referrer = await User.findById(depositingUser.referredBy);
      if (!referrer || !referrer.commissionUnlocked) {
        return; // Referrer not found or commission not unlocked
      }

      // Calculate commission based on referrer's current level and tier
      const commissionRate = referrer.getCommissionRate();
      const commissionAmount = (deposit.amount * commissionRate) / 100;

      if (commissionAmount > 0) {
        // Add commission to referrer's balance and earnings
        referrer.balance += commissionAmount;
        referrer.referralEarnings += commissionAmount;
        
        await referrer.save();

        // You might want to create a commission record here for history
        console.log(`Commission processed: $${commissionAmount} for referrer ${referrer.email} from deposit ${deposit._id}`);
      }
    } catch (error) {
      console.error('Error processing referral commission:', error);
    }
  }

  // Get commission rate info for display
  static getCommissionStructure() {
    return {
      0: { 3: 3, 2: 8, 1: 12, label: 'Base' },
      1: { 3: 5, 2: 10, 1: 15, label: 'Level 1' },
      2: { 3: 6, 2: 12, 1: 18, label: 'Level 2' },
      3: { 3: 7, 2: 14, 1: 21, label: 'Level 3' },
      4: { 3: 9, 2: 16, 1: 25, label: 'Level 4' },
      5: { 3: 12, 2: 18, 1: 30, label: 'Level 5' }
    };
  }

  // Get upgrade requirements
  static getUpgradeRequirements() {
    return {
      0: { tier3: 5, tier2: 6, tier1: 7, nextLevel: 8 },
      1: { tier3: 8, tier2: 9, tier1: 10, nextLevel: 11 },
      2: { tier3: 11, tier2: 12, tier1: 13, nextLevel: 14 },
      3: { tier3: 14, tier2: 15, tier1: 16, nextLevel: 17 },
      4: { tier3: 17, tier2: 18, tier1: 19, nextLevel: 20 },
      5: { tier3: 20, tier2: 21, tier1: 22, nextLevel: 1000 }
    };
  }
}