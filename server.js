import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import mailSender from "./utils/SendMail.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Email-Server Running!");
})

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
