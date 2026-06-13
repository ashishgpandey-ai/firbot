require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/firbot")
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ DB Error:", err));

// Schema
const FIR = mongoose.model('FIR', {
name: String,
phone: String,
incident: String,
location: String,
firNumber: String,
});

const userState = {};
const ADMIN_ID = 7273415925;

// START
bot.onText(//start/, (msg) => {
bot.sendMessage(chatId, 
`👋 Welcome to FIR Registration Bot

📄 You can file your FIR easily here.

👉 Click below to start`,
{
    reply_markup: {
        keyboard: [["📝 Start FIR"]],
        resize_keyboard: true
    }
});

// START FIR BUTTON
bot.on("message", async (msg) => {
const chatId = msg.chat.id;

if (msg.text === "📝 Start FIR") {
    userState[chatId] = { step: "payment" };

    bot.sendPhoto(chatId, "qr.png", {
        caption:
        "💰 FIR Fee ₹50\n\nSend Screenshot after payment"
    });
    return;
}

if (!userState[chatId]) return;

const step = userState[chatId].step;

// STEP 1: PAYMENT SCREENSHOT
if (step === "payment") {
    if (msg.photo) {
        userState[chatId].screenshot = msg.photo.pop().file_id;

        bot.sendMessage(chatId, "⏳ Waiting for admin approval...");

        bot.sendMessage(ADMIN_ID,

`💰 PAYMENT REQUEST

User ID: ${chatId}

✅ Approve: /approve_${chatId}
❌ Reject: /reject_${chatId}`
);
}
}

// STEP 2: NAME
else if (step === "name") {
    userState[chatId].name = msg.text;
    userState[chatId].step = "phone";
    bot.sendMessage(chatId, "Enter phone:");
}

// STEP 3: PHONE
else if (step === "phone") {
    userState[chatId].phone = msg.text;
    userState[chatId].step = "incident";
    bot.sendMessage(chatId, "Describe incident:");
}

// STEP 4: INCIDENT
else if (step === "incident") {
    userState[chatId].incident = msg.text;
    userState[chatId].step = "location";
    bot.sendMessage(chatId, "Enter location:");
}

// STEP 5: LOCATION → GENERATE PDF
else if (step === "location") {
    userState[chatId].location = msg.text;

    const firNumber = "FIR-" + Date.now();

    const filePath = path.join(__dirname, `FIR_${chatId}.pdf`);

    generateFIR({
        firNumber,
        ...userState[chatId],
        date: new Date().toLocaleString()
    }, filePath);

    await new FIR({
        ...userState[chatId],
        firNumber
    }).save();

    bot.sendDocument(chatId, filePath);

    bot.sendMessage(chatId, `✅ FIR Registered\nNumber: ${firNumber}`);

    delete userState[chatId];
}

});

// ✅ APPROVE
bot.onText(//approve_(\d+)/, (msg, match) => {
const adminId = msg.chat.id;
const chatId = match[1];

if (adminId != ADMIN_ID) {
    bot.sendMessage(adminId, "❌ Not authorized");
    return;
}

if (!userState[chatId]) {
    bot.sendMessage(adminId, "❌ User not found");
    return;
}

userState[chatId].step = "name";

bot.sendMessage(chatId, "✅ Payment Approved\nEnter your name:");
bot.sendMessage(adminId, "✅ Approved");

});

// ❌ REJECT
bot.onText(//reject_(\d+)/, (msg, match) => {
const adminId = msg.chat.id;
const chatId = match[1];

if (adminId != ADMIN_ID) return;

bot.sendMessage(chatId, "❌ Payment rejected. Try again.");
delete userState[chatId];

bot.sendMessage(adminId, "❌ Rejected");

});

// PDF FUNCTION
function generateFIR(data, filePath) {
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream(filePath));

doc.fontSize(18).text('FIR REPORT', { align: 'center' });
doc.moveDown();

doc.fontSize(12)
.text(`FIR Number: ${data.firNumber}`)
.text(`Name: ${data.name}`)
.text(`Phone: ${data.phone}`)
.text(`Incident: ${data.incident}`)
.text(`Location: ${data.location}`)
.text(`Date: ${data.date}`);

doc.end();

}