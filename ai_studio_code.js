const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// CONFIGURATION
const PORT = process.env.PORT || 3000;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FACEBOOK_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN; // You pick this (e.g., "my_secret_token")
const GEMINI_API_KEY = process.env.API_KEY;

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = "gemini-3-pro-preview";

// SYSTEM INSTRUCTIONS (COPIED FROM YOUR APP)
const SYSTEM_INSTRUCTION = `You are a support agent for a Chime and CashApp trading service covering the night shift.
CRITICAL: Replies must be SHORT, HUMAN, and CASUAL (Facebook Messenger style).
1-2 sentences max.

[KNOWLEDGE BASE]
CASHAPP QUESTIONS: "Weekly sending limit? Verified or unverified? Physical card active? How old is your account? Any owed/overdraft?"
CHIME QUESTIONS: "How old is your Chime account? Is the physical debit card activated? Can I change the Chime sign? Is it under your name? Any loan/borrowed balance?"

[LOGIN & PROCESS]
- CashApp Link: Forward to cashappbuyers@gmail.com. Do NOT click.
- Chime: Need Email, Password, SSN, DOB.
- Important: If email/number changed today, login fails. Need SSN.
- Logout: Require screen recording of logout.

[BEHAVIOR]
- If user wants to sell CashApp, ask CashApp questions.
- If user wants to sell Chime, ask Chime questions.
- Be casual.`;

// 1. Facebook Webhook Verification (One-time setup)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === FACEBOOK_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// 2. Handle Incoming Messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    for (const entry of body.entry) {
      // Get the webhook event. entry.messaging is an array, but 
      // will only contain one event, so we get index 0
      const webhook_event = entry.messaging[0];
      
      const sender_psid = webhook_event.sender.id;
      
      if (webhook_event.message && webhook_event.message.text) {
        await handleMessage(sender_psid, webhook_event.message.text);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function handleMessage(sender_psid, received_message) {
  try {
    // 1. Get response from Gemini
    const response = await ai.models.generateContent({
        model: model,
        contents: received_message,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7
        }
    });
    
    const botReply = response.text;

    // 2. Send response back to Facebook
    await callSendAPI(sender_psid, botReply);
  } catch (error) {
    console.error("Error generating response", error);
  }
}

async function callSendAPI(sender_psid, response_text) {
  const request_body = {
    "recipient": { "id": sender_psid },
    "message": { "text": response_text }
  };

  try {
    await axios.post(`https://graph.facebook.com/v22.0/me/messages?access_token=${FACEBOOK_PAGE_ACCESS_TOKEN}`, request_body);
  } catch (error) {
    console.error("Unable to send message:", error.response ? error.response.data : error);
  }
}

app.listen(PORT, () => console.log('webhook is listening on port ' + PORT));