require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

const FIR = mongoose.model('FIR', {
name: String,
phone: String,
incident: String,
location: String,
firNumber: String
});

const userState = {};
const ADMIN_ID = 7273415925;

// START
bot.onText(/\/start/, (msg) => {
bot.sendMessage(msg.chat.id,
`👋 Welcome to FIR Bot

Click below to start`,
{
reply_markup: {
keyboard: [["📝 Start FIR"]],
resize_keyboard: true
}
});
});

// MAIN HANDLER
bot.on("message", async (msg) => {
const chatId = msg.chat.id;

```
if (msg.text === "📝 Start FIR") {
    userState[chatId] = { step: "payment" };

    bot.sendPhoto(chatId, "qr.png", {
        caption: "💰 Pay ₹50 and send screenshot"
    });
    return;
}

if (!userState[chatId]) return;
});

const step = userState[chatId].step;

// PAYMENT
if (step === "payment") {
    if (msg.photo) {
    bot.sendMessage(chatId, "⏳ Waiting for admin approval...");

    bot.sendMessage(ADMIN_ID,
        `💰 PAYMENT REQUEST

User ID: ${chatId}

Approve: /approve_${chatId}
Reject: /reject_${chatId}`
    );
}
}

```
// NAME
else if (step === "name") {
    userState[chatId].name = msg.text;
    userState[chatId].step = "phone";
    bot.sendMessage(chatId, "Enter phone:");
}

// PHONE
else if (step === "phone") {
    userState[chatId].phone = msg.text;
    userState[chatId].step = "incident";
    bot.sendMessage(chatId, "Describe incident:");
}

// INCIDENT
else if (step === "incident") {
    userState[chatId].incident = msg.text;
    userState[chatId].step = "location";
    bot.sendMessage(chatId, "Enter location:");
}

// LOCATION
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
    bot.sendMessage(chatId, `✅ FIR Registered\n${firNumber}`);

    delete userState[chatId];
}
```

});

// APPROVE
bot.onText(//approve_(\d+)/, (msg, match) => {
if (msg.chat.id != ADMIN_ID) return;

```
const chatId = match[1];

if (!userState[chatId]) return;

userState[chatId].step = "name";

bot.sendMessage(chatId, "✅ Payment Approved\nEnter your name:");
bot.sendMessage(msg.chat.id, "Approved");
```

});

// REJECT
bot.onText(//reject_(\d+)/, (msg, match) => {
if (msg.chat.id != ADMIN_ID) return;

```
const chatId = match[1];

bot.sendMessage(chatId, "❌ Payment Rejected");
delete userState[chatId];

bot.sendMessage(msg.chat.id, "Rejected");
```

});

// PDF
function generateFIR(data, filePath) {
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream(filePath));

```
doc.fontSize(18).text("FIR REPORT", { align: "center" });
doc.moveDown();

doc.fontSize(12)
    .text(`FIR Number: ${data.firNumber}`)
    .text(`Name: ${data.name}`)
    .text(`Phone: ${data.phone}`)
    .text(`Incident: ${data.incident}`)
    .text(`Location: ${data.location}`)
    .text(`Date: ${data.date}`);

doc.end();
```

}
