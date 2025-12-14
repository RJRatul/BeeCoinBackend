// fix-dates-direct.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixDatesDirect() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const users = await usersCollection.find({}).toArray();
    console.log(`📊 Found ${users.length} users to fix`);
    
    let fixedCount = 0;
    
    for (const user of users) {
      const updateOperations = {};
      
      // Fix createdAt (convert {$date: "...} to Date object)
      if (user.createdAt && typeof user.createdAt === 'object' && user.createdAt.$date) {
        updateOperations.createdAt = new Date(user.createdAt.$date);
      }
      
      // Fix updatedAt
      if (user.updatedAt && typeof user.updatedAt === 'object' && user.updatedAt.$date) {
        updateOperations.updatedAt = new Date(user.updatedAt.$date);
      }
      
      // Fix lastProfitCalculation
      if (user.lastProfitCalculation && typeof user.lastProfitCalculation === 'object' && user.lastProfitCalculation.$date) {
        updateOperations.lastProfitCalculation = new Date(user.lastProfitCalculation.$date);
      }
      
      // Fix transaction dates
      if (user.transactions && Array.isArray(user.transactions)) {
        updateOperations.transactions = user.transactions.map(transaction => {
          const newTransaction = { ...transaction };
          if (newTransaction.createdAt && typeof newTransaction.createdAt === 'object' && newTransaction.createdAt.$date) {
            newTransaction.createdAt = new Date(newTransaction.createdAt.$date);
          }
          return newTransaction;
        });
      }
      
      // Only update if there are changes
      if (Object.keys(updateOperations).length > 0) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: updateOperations }
        );
        fixedCount++;
        console.log(`✅ Fixed user: ${user.email || user._id}`);
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} users out of ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

fixDatesDirect();