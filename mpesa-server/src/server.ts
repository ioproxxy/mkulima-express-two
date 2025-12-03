import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const MPESA_BASE_URL = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Supabase service client (server-side only)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('Missing M-Pesa consumer key/secret');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return res.data.access_token as string;
}

app.post('/mpesa/stk-push', async (req, res) => {
  try {
    const { amount, phoneNumber, accountReference, description } = req.body;

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortcode || !passkey || !callbackUrl) {
      return res.status(500).json({ error: 'Mpesa not configured on server' });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const token = await getAccessToken();

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference || 'MKULIMA_WALLET',
      TransactionDesc: description || 'Wallet top up'
    };

    const mpesaRes = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.json({
      success: true,
      data: mpesaRes.data
    });
  } catch (err: any) {
    console.error('STK error', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

app.post('/mpesa/callback', (req, res) => {
  console.log('M-Pesa callback:', JSON.stringify(req.body, null, 2));

  const body = req.body;
  const stkCallback = body?.Body?.stkCallback;
  const resultCode = stkCallback?.ResultCode;

  if (resultCode === 0 && supabase) {
    const metaItems = stkCallback.CallbackMetadata?.Item || [];
    const amountItem = metaItems.find((i: any) => i.Name === 'Amount');
    const refItem = metaItems.find((i: any) => i.Name === 'AccountReference');

    const amount = amountItem?.Value as number | undefined;
    const accountReference = refItem?.Value as string | undefined;

    // Expect AccountReference in format WALLET_<userId>
    if (amount && accountReference && accountReference.startsWith('WALLET_')) {
      const userId = accountReference.replace('WALLET_', '');

      (async () => {
        try {
          const { data: wallet, error: fetchErr } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

          if (fetchErr) {
            console.error('Fetch wallet error:', fetchErr.message);
            return;
          }

          const newBalance = (wallet?.balance || 0) + amount;

          const { error: updateErr } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

          if (updateErr) {
            console.error('Update wallet error:', updateErr.message);
          } else {
            console.log(`Wallet for user ${userId} credited with ${amount}. New balance: ${newBalance}`);
          }
        } catch (e: any) {
          console.error('Callback processing error:', e.message);
        }
      })();
    }
  }

  // Always respond with success to Safaricom
  res.json({ ResultCode: 0, ResultDesc: 'Received successfully' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`M-Pesa server listening on port ${PORT}`);
});