require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Define a simple user schema for testing
const testUserSchema = new mongoose.Schema({
  userId: String,
  email: String,
  firstName: String,
  lastName: String,
  password: String,
  balance: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  aiStatus: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  referralCode: String,
  referralCount: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  tier: { type: Number, default: 3 },
  commissionUnlocked: { type: Boolean, default: false },
  algoProfitAmount: { type: Number, default: 0 },
  algoProfitPercentage: { type: Number, default: 0 },
  lastProfitCalculation: Date,
  transactions: { type: Array, default: [] }
}, { timestamps: true });

// Add pre-save hook to generate userId and referralCode
testUserSchema.pre('save', async function(next) {
  const user = this;
  
  if (user.isNew) {
    console.log('🔧 Creating new user...');
    
    // Generate userId
    if (!user.userId) {
      let isUnique = false;
      let userId = '';
      while (!isUnique) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        userId = randomNum.toString();
        const existingUser = await mongoose.model('TestUser').findOne({ userId });
        if (!existingUser) isUnique = true;
      }
      user.userId = userId;
      console.log(`✅ Generated userId: ${user.userId}`);
    }
    
    // Generate referralCode
    if (!user.referralCode) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let isUnique = false;
      let code = '';
      while (!isUnique) {
        code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existingUser = await mongoose.model('TestUser').findOne({ referralCode: code });
        if (!existingUser) isUnique = true;
      }
      user.referralCode = code;
      console.log(`✅ Generated referralCode: ${user.referralCode}`);
    }
    
    // Ensure all fields have defaults
    user.balance = user.balance || 0;
    user.algoProfitAmount = user.algoProfitAmount || 0;
    user.algoProfitPercentage = user.algoProfitPercentage || 0;
    user.transactions = user.transactions || [];
    
    console.log('✅ All fields initialized');
  }
  
  next();
});

const TestUser = mongoose.model('TestUser', testUserSchema);

async function testDirectDB() {
  try {
    console.log('🧪 Direct database test...');
    
    // Create test user
    const testEmail = `directtest${Date.now()}@test.com`;
    
    console.log(`\n📧 Creating user: ${testEmail}`);
    
    const user = new TestUser({
      firstName: 'Direct',
      lastName: 'Test',
      email: testEmail,
      password: 'password123'
    });
    
    console.log('\n📝 BEFORE SAVE:');
    console.log(`userId: ${user.userId || 'Will be generated'}`);
    console.log(`referralCode: ${user.referralCode || 'Will be generated'}`);
    console.log(`algoProfitAmount: ${user.algoProfitAmount}`);
    console.log(`algoProfitPercentage: ${user.algoProfitPercentage}`);
    console.log(`transactions: ${user.transactions.length} records`);
    
    // Save user
    await user.save();
    
    console.log('\n✅ AFTER SAVE:');
    console.log(`userId: ${user.userId}`);
    console.log(`referralCode: ${user.referralCode}`);
    console.log(`balance: ${user.balance}`);
    console.log(`algoProfitAmount: ${user.algoProfitAmount}`);
    console.log(`algoProfitPercentage: ${user.algoProfitPercentage}`);
    console.log(`lastProfitCalculation: ${user.lastProfitCalculation || 'null'}`);
    console.log(`transactions: ${user.transactions.length} records`);
    console.log(`level: ${user.level}, tier: ${user.tier}`);
    console.log(`commissionUnlocked: ${user.commissionUnlocked}`);
    
    // Check existing users in your actual User collection
    console.log('\n🔍 Checking your actual User collection...');
    
    // Try to access your actual User model
    try {
      const existingUsers = await mongoose.connection.db.collection('users').find().limit(10).toArray();
      console.log(`\n📊 Found ${existingUsers.length} existing users`);
      
      existingUsers.forEach((u, i) => {
        console.log(`\nUser ${i + 1}: ${u.email}`);
        console.log(`  userId: ${u.userId || 'MISSING'}`);
        console.log(`  referralCode: ${u.referralCode || 'MISSING'}`);
        console.log(`  algoProfitAmount: ${u.algoProfitAmount || 'MISSING/0'}`);
        console.log(`  algoProfitPercentage: ${u.algoProfitPercentage || 'MISSING/0'}`);
      });
    } catch (err) {
      console.log('⚠️ Could not access users collection:', err.message);
    }
    
    // Clean up
    await TestUser.deleteOne({ _id: user._id });
    console.log('\n🧹 Test user deleted');
    
    await mongoose.disconnect();
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

testDirectDB();