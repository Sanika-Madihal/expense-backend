const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { simplifyDebts } = require('../utils/debtSimplifier');
const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
// Vercel allows async connection inside the function
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    try {
        // We will set this variable in Vercel Dashboard later
        const MONGODB_URI = process.env.MONGODB_URI; 
        if (!MONGODB_URI) throw new Error("MONGODB_URI is missing in env variables");
        
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log("MongoDB Connected");
    } catch (err) {
        console.error("DB Connection Error:", err);
    }
};

// --- Mongoose Models (Schemas) ---
// 1. Trip Schema
const tripSchema = new mongoose.Schema({
    name: String,
    currency: { type: String, default: 'USD' },
    participants: [String], // Array of names e.g., ['Alice', 'Bob']
    createdAt: { type: Date, default: Date.now }
});
const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);

// 2. Expense Schema
const expenseSchema = new mongoose.Schema({
    tripId: mongoose.Schema.Types.ObjectId,
    description: String,
    amount: Number,
    payer: String, // Who paid
    date: { type: Date, default: Date.now }
});
const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

// --- API Routes ---

// Health Check
app.get('/', (req, res) => {
    res.send('Cloud Native Expense Splitter API is Running!');
});

// 1. Create a Trip
app.post('/api/trips', async (req, res) => {
    await connectDB();
    try {
        const { name, currency, participants } = req.body;
        const newTrip = await Trip.create({ name, currency, participants });
        res.json(newTrip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get a Trip Details
app.get('/api/trips/:id', async (req, res) => {
    await connectDB();
    try {
        const trip = await Trip.findById(req.params.id);
        const expenses = await Expense.find({ tripId: req.params.id });
        res.json({ trip, expenses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Add Expense
app.post('/api/expenses', async (req, res) => {
    await connectDB();
    try {
        const { tripId, description, amount, payer } = req.body;
        const expense = await Expense.create({ tripId, description, amount, payer });
        res.json(expense);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get Settlement (The "Microservice" Logic)
app.get('/api/trips/:id/settle', async (req, res) => {
    await connectDB();
    try {
        const trip = await Trip.findById(req.params.id);
        const expenses = await Expense.find({ tripId: req.params.id });

        if (!trip) return res.status(404).json({ error: "Trip not found" });

        // Calculate net balances
        // Assuming equal split for simplicity (Total / Num Participants)
        // A real production app would handle uneven splits
        let balances = {};
        trip.participants.forEach(p => balances[p] = 0);

        expenses.forEach(exp => {
            const splitAmount = exp.amount / trip.participants.length;
            
            // The payer gets positive credit (they paid, so they are owed)
            // But wait, they also consumed their share. 
            // Payer paid 'amount'. Their share was 'splitAmount'.
            // So they are effectively owed: amount - splitAmount
            if (!balances[exp.payer]) balances[exp.payer] = 0;
            balances[exp.payer] += (exp.amount - splitAmount);

            // Everyone else owes 'splitAmount'
            trip.participants.forEach(person => {
                if (person !== exp.payer) {
                    balances[person] -= splitAmount;
                }
            });
        });

        // Run the simplification algorithm
        const settlements = simplifyDebts(balances);

        res.json({
            currency: trip.currency,
            balances,
            settlements
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export app for Vercel
module.exports = app;