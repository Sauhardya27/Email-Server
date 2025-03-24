import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import mailSender from "./utils/SendMail.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import bodyParser from "body-parser";

import admin from "firebase-admin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Import transaction routes (we'll create this file after)
import transactionRoutes from "./transactionAPI.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin with your project credentials
try {
    const serviceAccount = require("./serviceAccountKey.json");

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "shoppinessmart" // Your Firebase project ID from frontend config
    });

    console.log("Firebase Admin initialized successfully");
} catch (error) {
    console.error("Failed to initialize Firebase Admin:", error.message);
    console.log("Please make sure you have a valid serviceAccountKey.json file");
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.send("Shoppinessmart Server Running!");
});

app.post("/send-email", async (req, res) => {
    try {
        const { email, title, body } = req.body;
        const response = await mailSender(email, title, body);
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/inrdeals/coupons", async (req, res) => {
    try {
        const { data } = await axios.get("https://inrdeals.com/api/v1/coupon-feed", {
            params: {
                token: process.env.INRDEALS_COUPON_TOKEN,
                id: process.env.INRDEALS_USERNAME,
            },
        });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.response?.data || error.message,
        });
    }
});

app.get("/inrdeals/stores", async (req, res) => {
    try {
        const { data } = await axios.get("https://inrdeals.com/fetch/stores", {
            params: {
                token: process.env.INRDEALS_STORE_TOKEN,
                id: process.env.INRDEALS_USERNAME,
            },
        });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.response?.data || error.message,
        });
    }
});

// INRDeals transaction callback endpoint
app.post('/inrdeals/callback', async (req, res) => {
    try {
        const { transaction_id, sale_amount, status, store_name, sale_date, sub_id1 } = req.body;
        
        if (!sub_id1) {
            return res.status(400).json({ success: false, message: 'Missing user ID (sub_id1)' });
        }
        
        if (!admin.apps.length) {
            return res.status(500).json({ success: false, message: 'Firebase Admin not initialized' });
        }
        
        // Find the transaction in Firebase by subId and update it
        const db = admin.firestore();
        const transactionsRef = db.collection('transactions');
        
        // Query for transactions with this userId that are in pending status
        const querySnapshot = await transactionsRef
            .where('subId', '==', sub_id1)
            .where('storeName', '==', store_name)
            .where('status', '==', 'pending')
            .get();
        
        if (querySnapshot.empty) {
            // Create a new transaction record if none exists
            await transactionsRef.add({
                userId: sub_id1,
                storeId: store_name, // Using store_name as ID since we don't have the actual ID
                storeName: store_name,
                saleAmount: parseFloat(sale_amount),
                status: status,
                transactionId: transaction_id,
                saleDate: new Date(sale_date),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            return res.status(200).json({ success: true, message: 'Transaction created' });
        }
        
        // Update the existing transaction
        const batch = db.batch();
        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, {
                saleAmount: parseFloat(sale_amount),
                status: status,
                transactionId: transaction_id,
                saleDate: new Date(sale_date),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        
        await batch.commit();
        
        return res.status(200).json({ success: true, message: 'Transaction updated' });
    } catch (error) {
        console.error('Error processing transaction callback:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// INRDeals transactions report endpoint
// Not working
// app.get('/inrdeals/transactions', async (req, res) => {
//     try {
//         console.log('1. Request received with params:', req.query);
//         const { token, startdate, enddate } = req.query;
        
//         if (!token || !startdate || !enddate) {
//             return res.status(400).json({ success: false, message: 'Missing required parameters' });
//         }

//         console.log('2. About to call INRDeals API');
        
//         // Call the INRDeals API to get transactions report
//         const response = await axios.get(
//             "https://inrdeals.com/fetch/reports", {
//                 params: {
//                     token: token,
//                     id: 'inrdeals',
//                     startdate: startdate,
//                     enddate: enddate
//                 },
//                 headers: {
//                     'Content-Type': 'application/json',
//                 }
//             }
//         );
        
//         const data = response.data;
//         console.log('3. INRDeals API response received');
        
//         if (!data || !data.result) {
//             return res.status(400).json({ success: false, message: 'Invalid response from INRDeals API' });
//         }
        
//         if (!admin.apps.length) {
//             return res.status(500).json({ success: false, message: 'Firebase Admin not initialized' });
//         }
        
//         console.log('4. Starting Firebase operations');
//         // Process transactions and update Firebase
//         const db = admin.firestore();
//         const transactionsRef = db.collection('transactions');
        
//         // For each transaction in the report
//         for (const transaction of data.result.data) {
//             const { transaction_id, sale_amount, status, store_name, sale_date, sub_id1, user_commission } = transaction;
            
//             if (!sub_id1) continue; // Skip if no user ID
            
//             // Find if transaction exists
//             const querySnapshot = await transactionsRef
//                 .where('subId', '==', sub_id1)
//                 .where('transactionId', '==', transaction_id)
//                 .get();
            
//             if (querySnapshot.empty) {
//                 // Create new transaction
//                 await transactionsRef.add({
//                     userId: sub_id1,
//                     storeName: store_name,
//                     saleAmount: parseFloat(sale_amount),
//                     commission: parseFloat(user_commission),
//                     status: status,
//                     transactionId: transaction_id,
//                     saleDate: new Date(sale_date),
//                     lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
//                 });
//             } else {
//                 // Update existing transaction
//                 querySnapshot.forEach(async (doc) => {
//                     await doc.ref.update({
//                         saleAmount: parseFloat(sale_amount),
//                         commission: parseFloat(user_commission),
//                         status: status,
//                         lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
//                     });
//                 });
//             }
//         }
        
//         return res.status(200).json({ 
//             success: true, 
//             message: 'Transactions processed',
//             data: data.result
//         });
//     } catch (error) {
//         console.error('Error processing transactions report:', error);
//         return res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// });

// Use transaction routes
app.use('/api', transactionRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});