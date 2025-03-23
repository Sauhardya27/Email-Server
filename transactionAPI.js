import express from 'express';
import admin from 'firebase-admin';

const transactionRoutes = express.Router();

// Get all transactions for a user
transactionRoutes.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const db = admin.firestore();
    const transactionsRef = db.collection('transactions');
    
    const querySnapshot = await transactionsRef
      .where('userId', '==', userId)
      .orderBy('saleDate', 'desc')
      .get();
    
    const transactions = [];
    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get transaction statistics for a user
transactionRoutes.get('/transactions/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const db = admin.firestore();
    const transactionsRef = db.collection('transactions');
    
    const querySnapshot = await transactionsRef
      .where('userId', '==', userId)
      .get();
    
    let totalTransactions = 0;
    let pendingAmount = 0;
    let confirmedAmount = 0;
    let cancelledAmount = 0;
    let totalCommission = 0;
    
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      totalTransactions++;
      
      if (transaction.status === 'pending') {
        pendingAmount += transaction.saleAmount || 0;
      } else if (transaction.status === 'confirmed') {
        confirmedAmount += transaction.saleAmount || 0;
        totalCommission += transaction.commission || 0;
      } else if (transaction.status === 'cancelled') {
        cancelledAmount += transaction.saleAmount || 0;
      }
    });
    
    return res.status(200).json({
      success: true,
      stats: {
        totalTransactions,
        pendingAmount,
        confirmedAmount,
        cancelledAmount,
        totalCommission
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get store-wise transaction summary for a user
transactionRoutes.get('/transactions/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const db = admin.firestore();
    const transactionsRef = db.collection('transactions');
    
    const querySnapshot = await transactionsRef
      .where('userId', '==', userId)
      .get();
    
    const storesSummary = {};
    
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      const { storeName, saleAmount, status, commission } = transaction;
      
      if (!storesSummary[storeName]) {
        storesSummary[storeName] = {
          totalTransactions: 0,
          pendingAmount: 0,
          confirmedAmount: 0,
          totalCommission: 0
        };
      }
      
      storesSummary[storeName].totalTransactions++;
      
      if (status === 'pending') {
        storesSummary[storeName].pendingAmount += saleAmount || 0;
      } else if (status === 'confirmed') {
        storesSummary[storeName].confirmedAmount += saleAmount || 0;
        storesSummary[storeName].totalCommission += commission || 0;
      }
    });
    
    return res.status(200).json({
      success: true,
      storesSummary
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default transactionRoutes;