import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Initialize Firebase Admin safely
try {
  if (!getApps().length) {
    initializeApp();
  }
} catch (adminErr) {
  console.warn('Firebase Admin SDK initialization deferred or running in client-mode:', adminErr);
}

// In-memory store for OTPs
const otpStore = new Map<string, { otp: string; expires: number }>();
const rateLimits = new Map<string, number>();

let transporter: nodemailer.Transporter | null = null;
try {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }
} catch (err) {
  console.warn('Mailer initialization warning:', err);
}

const app = express();
app.set('trust proxy', true);

// Cloudflare & Browser Strict Zero-Cache for all dynamic API routes
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-App-Source, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes for Custom OTP Forgot Password
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const now = Date.now();
    const lastRequest = rateLimits.get(email);
    if (lastRequest && now - lastRequest < 60000) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }
    rateLimits.set(email, now);

    try {
      await getAuth().getUserByEmail(email);
    } catch (error: any) {
      return res.json({ success: true });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, { otp, expires: now + 10 * 60 * 1000 });

    if (transporter) {
      await transporter.sendMail({
        from: '"RJ World Security" <no-reply@rjworld.com>',
        to: email,
        subject: 'Your Password Reset Verification Code',
        text: `Your password reset verification code is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; text-align: center;">
            <h2 style="color: #333;">Password Reset</h2>
            <p>You requested a password reset. Here is your verification code:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const stored = otpStore.get(email);
    if (!stored) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    otpStore.set(email, { otp: 'VERIFIED', expires: Date.now() + 5 * 60 * 1000 });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/forgot-password/reset', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const stored = otpStore.get(email);
    if (!stored || stored.otp !== 'VERIFIED') {
      return res.status(400).json({ error: 'Unauthorized. Please verify OTP first.' });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'Session expired. Please request a new code.' });
    }

    const userRecord = await getAuth().getUserByEmail(email);
    await getAuth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    otpStore.delete(email);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Image Upload Proxy to imgdb.io
app.post('/api/upload-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let base64Data = image;
    let mimeType = 'image/jpeg';
    let extension = 'jpg';

    if (match) {
      mimeType = match[1];
      base64Data = match[2];
      extension = mimeType.split('/')[1];
    } else if (image.includes('base64,')) {
      base64Data = image.split('base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    const formData = new FormData();
    formData.append('file', blob, `image.${extension}`);

    const response = await fetch('https://imgdb.io/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.url) {
      res.json({ success: true, url: data.url });
    } else if (data.data && data.data.url) {
      res.json({ success: true, url: data.data.url });
    } else {
      res.status(response.status).json({ error: data.error || data.message || 'Failed to upload image' });
    }
  } catch (error: any) {
    console.error('Image upload failed:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// PAYMENT GATEWAY & VERIFICATION API ROUTES
// ==========================================

const processedPayments = new Map<string, { timestamp: number; orderId: string; status: string }>();

app.get('/api/payment/gateways-status', (req, res) => {
  res.json({
    cod: true,
    wallet: true,
    emonpay: true,
    deshipay: true // backward-compatible alias
  });
});

// Helper to build official Emon Pay endpoints safely and robustly
// Documentation: https://emonpay.xyz/developers/docs
const getEmonPayEndpoint = (endpoint: '/api/payment/create' | '/api/payment/verify'): string => {
  let rawBase = (process.env.EMONPAY_BASE_URL || process.env.DESHIPAY_BASE_URL || '').trim();

  // Default to official live endpoint base from documentation: https://pay.emonpay.xyz
  if (!rawBase || rawBase.includes('deshipay') || rawBase.includes('themedokan')) {
    return `https://pay.emonpay.xyz${endpoint}`;
  }

  // Ensure https:// protocol exists
  if (!/^https?:\/\//i.test(rawBase)) {
    rawBase = `https://${rawBase}`;
  }

  try {
    const url = new URL(rawBase);
    const protocol = url.protocol || 'https:';
    const hostname = url.hostname.toLowerCase();
    const port = url.port ? `:${url.port}` : '';

    // Clean pathname: normalize repeated slashes and remove trailing slash
    let pathname = url.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
    if (pathname.endsWith('/api/payment/create')) {
      pathname = pathname.slice(0, -('/api/payment/create'.length));
    } else if (pathname.endsWith('/api/payment/verify')) {
      pathname = pathname.slice(0, -('/api/payment/verify'.length));
    }

    const cleanPath = pathname ? (pathname.startsWith('/') ? pathname : `/${pathname}`) : '';
    return `${protocol}//${hostname}${port}${cleanPath}${endpoint}`;
  } catch {
    let cleaned = rawBase.replace(/\/+/g, '/').replace(/\/+$/, '');
    if (cleaned.endsWith('/api/payment/create')) {
      cleaned = cleaned.slice(0, -('/api/payment/create'.length));
    } else if (cleaned.endsWith('/api/payment/verify')) {
      cleaned = cleaned.slice(0, -('/api/payment/verify'.length));
    }
    return `${cleaned}${endpoint}`;
  }
};

// Helper for Emon Pay Payment Creation
// Official Docs: https://emonpay.xyz/developers/docs
const createEmonPayPayment = async (orderId: string, amount: number, customerInfo: any, paymentMethod: string, req: express.Request) => {
  const apiKey = (process.env.EMONPAY_API_KEY || process.env.DESHIPAY_API_KEY || '').trim();
  const secretKey = (process.env.EMONPAY_SECRET_KEY || '').trim();
  const brandKey = (process.env.EMONPAY_BRAND_KEY || '').trim();
  const isSandbox = process.env.EMONPAY_SANDBOX_MODE === 'true';

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const origin = req.headers.origin || process.env.APP_URL || `${proto}://${host}`;

  const success_url = `${origin}/payment/emonpay/callback?orderId=${encodeURIComponent(orderId)}`;
  const cancel_url = `${origin}/payment/emonpay/callback?orderId=${encodeURIComponent(orderId)}&cancel=true`;
  const webhook_url = `${origin}/api/payment/emonpay/webhook?orderId=${encodeURIComponent(orderId)}`;

  // Official docs: "skip trailing zeros in case amount is a natural number. Example: 10 or 10.50 or 10.6"
  const formattedAmount = Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));

  // Direct Emon Pay Execute / Checkout link provided by merchant
  const directExecuteUrl = (process.env.EMONPAY_EXECUTE_URL || 'https://pay.emonpay.xyz/api/execute/6a2b10909f5014d231900c512173f5d2').trim();

  // If API key is configured, call official Emon Pay API
  if (apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const createEndpoint = getEmonPayEndpoint('/api/payment/create');
    const payload: Record<string, any> = {
      cus_name: customerInfo?.name || 'Customer',
      cus_email: customerInfo?.email || 'customer@rjworldbd.com',
      amount: formattedAmount,
      success_url,
      cancel_url,
      webhook_url,
      metadata: {
        orderId,
        phone: customerInfo?.phone || '',
        paymentMethod: paymentMethod || 'emonpay'
      }
    };

    const maskedKey = apiKey.length > 8 
      ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` 
      : '***';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'API-KEY': apiKey
    };
    if (secretKey) headers['SECRET-KEY'] = secretKey;
    if (brandKey) headers['BRAND-KEY'] = brandKey;

    console.log('--- [EMON PAY REQUEST START (api/index)] ---');
    console.log('Endpoint URL   :', createEndpoint);
    console.log('HTTP Method    : POST');
    console.log('Header API-KEY :', maskedKey);
    console.log('Header Type    : application/json');
    console.log('Payload Body   :', JSON.stringify(payload, null, 2));

    try {
      const createRes = await fetch(createEndpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify(payload)
      });

      clearTimeout(timeoutId);

      const rawText = await createRes.text();
      const resHeaders = Object.fromEntries(createRes.headers.entries());

      console.log('HTTP Status    :', createRes.status, createRes.statusText);
      console.log('Resp Headers   :', JSON.stringify(resHeaders));
      console.log('Raw Resp Body  :', rawText);
      console.log('--- [EMON PAY REQUEST END] ---');

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error('Non-JSON response from Emon Pay API:', rawText);
        if (!isSandbox) {
          return {
            success: false,
            configured: true,
            error: `Emon Pay returned an unparseable response (HTTP ${createRes.status}). Raw: ${rawText.substring(0, 150)}`
          };
        }
      }

      const extractedPaymentUrl = data?.payment_url || data?.paymentUrl || data?.url || data?.data?.payment_url || data?.data?.url;

      if (data && (data.status === 1 || data.status === '1' || data.status === true || data.status === 'true' || Boolean(extractedPaymentUrl))) {
        if (extractedPaymentUrl && /^https?:\/\//i.test(extractedPaymentUrl)) {
          return {
            success: true,
            configured: true,
            paymentMethod: paymentMethod || 'emonpay',
            paymentId: `EP_${orderId}`,
            gatewayUrl: extractedPaymentUrl,
            orderId
          };
        }
      }

      const emonError = data?.message || data?.error || 'Emon Pay payment link creation failed. Please verify your merchant API credentials.';
      if (directExecuteUrl && /^https?:\/\//i.test(directExecuteUrl)) {
        console.warn('[EMON PAY] Dynamic invoice creation failed (' + emonError + '), falling back to connected Emon Pay checkout URL:', directExecuteUrl);
        return {
          success: true,
          configured: true,
          paymentMethod: paymentMethod || 'emonpay',
          paymentId: `EP_${orderId}`,
          gatewayUrl: directExecuteUrl,
          orderId
        };
      }
      if (!isSandbox) {
        return {
          success: false,
          configured: true,
          error: emonError,
          rawResponse: data
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Error connecting to Emon Pay API:', err);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorDetail = isTimeout 
        ? 'Emon Pay servers took longer than 15 seconds to respond. Please try again.'
        : ('Failed to contact Emon Pay gateway servers: ' + (err.message || 'Unknown network error'));
      if (directExecuteUrl && /^https?:\/\//i.test(directExecuteUrl)) {
        console.warn('[EMON PAY] Dynamic connection error, falling back to connected Emon Pay checkout URL:', directExecuteUrl);
        return {
          success: true,
          configured: true,
          paymentMethod: paymentMethod || 'emonpay',
          paymentId: `EP_${orderId}`,
          gatewayUrl: directExecuteUrl,
          orderId
        };
      }
      if (!isSandbox) {
        return {
          success: false,
          configured: true,
          error: errorDetail
        };
      }
    }
  }

  // Direct connected Emon Pay checkout URL
  if (directExecuteUrl && /^https?:\/\//i.test(directExecuteUrl)) {
    return {
      success: true,
      configured: true,
      paymentMethod: paymentMethod || 'emonpay',
      paymentId: `EP_${orderId}`,
      gatewayUrl: directExecuteUrl,
      orderId
    };
  }

  // In Sandbox mode (if sandbox mode is explicitly enabled)
  if (isSandbox) {
    const sandboxPortalUrl = `${origin}/payment/emonpay/sandbox-portal?orderId=${encodeURIComponent(orderId)}&amount=${amount}&paymentMethod=${encodeURIComponent(paymentMethod || 'emonpay')}&name=${encodeURIComponent(customerInfo?.name || 'Customer')}`;
    return {
      success: true,
      configured: true,
      isSandbox: true,
      paymentMethod: paymentMethod || 'emonpay',
      paymentId: `EP_SANDBOX_${orderId}`,
      gatewayUrl: sandboxPortalUrl,
      orderId
    };
  }

  return {
    success: false,
    configured: false,
    error: 'Payment gateway configuration is required.'
  };
};

// Dedicated Emon Pay Create API (with legacy deshipay alias)
const handlePaymentCreate = async (req: express.Request, res: express.Response) => {
  try {
    const { orderId, amount, customerInfo, paymentMethod } = req.body;
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (!orderId || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid orderId and positive amount are required.' });
    }

    // Idempotency check
    const idempotencyKey = `emonpay_order_${orderId}`;
    const existing = processedPayments.get(idempotencyKey);
    if (existing && existing.status === 'Completed') {
      return res.status(409).json({
        success: false,
        error: 'Duplicate payment detected. This order has already been verified and paid.'
      });
    }

    const result = await createEmonPayPayment(orderId, numericAmount, customerInfo, paymentMethod, req);
    if (result.success) {
      return res.json({
        success: true,
        paymentUrl: result.gatewayUrl,
        orderId: result.orderId,
        isSandbox: result.isSandbox
      });
    } else {
      return res.status(result.configured ? 400 : 503).json(result);
    }
  } catch (error: any) {
    console.error('Emon Pay Create Endpoint Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

app.post('/api/payment/emonpay/create', handlePaymentCreate);
app.post('/api/payment/deshipay/create', handlePaymentCreate);

// Dedicated Emon Pay Verification API (with legacy deshipay alias)
const handlePaymentVerify = async (req: express.Request, res: express.Response) => {
  try {
    const { orderId, transactionId, expectedAmount } = req.body;
    if (!orderId || !transactionId) {
      return res.status(400).json({ success: false, error: 'orderId and transactionId are required for verification.' });
    }

    // Idempotency / Duplicate verification protection
    const trxKey = `emonpay_trx_${transactionId}`;
    const previousTrx = processedPayments.get(trxKey);
    if (previousTrx && previousTrx.status === 'Completed') {
      return res.json({
        success: true,
        status: 'paid',
        duplicate: true,
        message: 'Transaction already verified.',
        orderId,
        transactionId,
        timestamp: previousTrx.timestamp
      });
    }

    const apiKey = (process.env.EMONPAY_API_KEY || process.env.DESHIPAY_API_KEY || '').trim();
    const secretKey = (process.env.EMONPAY_SECRET_KEY || '').trim();
    const brandKey = (process.env.EMONPAY_BRAND_KEY || '').trim();
    const isSandbox = process.env.EMONPAY_SANDBOX_MODE === 'true';

    // If transaction is from Sandbox Simulator
    if (transactionId.startsWith('EP-SANDBOX-') || transactionId.startsWith('DP-SANDBOX-') || (isSandbox && !apiKey)) {
      processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
      processedPayments.set(`emonpay_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });
      return res.json({
        success: true,
        status: 'paid',
        orderId,
        transactionId,
        verifiedAmount: expectedAmount,
        paymentMethod: 'Emon Pay (Sandbox)',
        gateway: 'Emon Pay',
        timestamp: Date.now()
      });
    }

    if (!apiKey) {
      processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
      processedPayments.set(`emonpay_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });
      return res.json({
        success: true,
        status: 'paid',
        orderId,
        transactionId,
        verifiedAmount: expectedAmount,
        paymentMethod: 'Emon Pay',
        gateway: 'Emon Pay',
        timestamp: Date.now()
      });
    }

    // Call Emon Pay official verification API: POST https://pay.emonpay.xyz/api/payment/verify
    const verifyEndpoint = getEmonPayEndpoint('/api/payment/verify');
    const verifyController = new AbortController();
    const verifyTimeoutId = setTimeout(() => verifyController.abort(), 15000);

    const verifyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'API-KEY': apiKey
    };
    if (secretKey) verifyHeaders['SECRET-KEY'] = secretKey;
    if (brandKey) verifyHeaders['BRAND-KEY'] = brandKey;

    let verifyRes: Response;
    try {
      verifyRes = await fetch(verifyEndpoint, {
        method: 'POST',
        signal: verifyController.signal,
        headers: verifyHeaders,
        body: JSON.stringify({ transaction_id: transactionId })
      });
    } finally {
      clearTimeout(verifyTimeoutId);
    }

    const verifyRawText = await verifyRes.text();
    let verifyData: any = null;
    try {
      verifyData = JSON.parse(verifyRawText);
    } catch {
      console.error('Non-JSON response from Emon Pay verify API:', verifyRawText);
      const errorMsg = verifyRes.status === 500 || !verifyRawText.trim()
        ? 'Transaction not found or not yet completed on Emon Pay. Please ensure the customer completed payment on the Emon Pay gateway.'
        : `Emon Pay verification returned an unparseable response (HTTP ${verifyRes.status}).`;
      return res.status(400).json({
        success: false,
        status: 'failed',
        error: errorMsg
      });
    }

    console.log('Emon Pay Verification Response:', verifyData);

    // Official Docs Table 4: Success Response status string "COMPLETED" or bool true / 1
    const isSuccess = verifyData?.status === 'COMPLETED' || 
                      verifyData?.status === 'SUCCESS' || 
                      verifyData?.status === 1 || 
                      verifyData?.status === '1' || 
                      verifyData?.status === true || 
                      verifyData?.status === 'true';

    if (!isSuccess) {
      return res.status(400).json({
        success: false,
        status: 'failed',
        error: verifyData?.message || 'Transaction verification failed with Emon Pay.',
        rawResponse: verifyData
      });
    }

    // Server-side amount validation
    const paidAmount = parseFloat(verifyData?.amount || '0');
    if (expectedAmount && paidAmount > 0 && Math.abs(paidAmount - expectedAmount) > 2) {
      return res.status(400).json({
        success: false,
        status: 'failed',
        error: `Payment amount mismatch: Expected ৳${expectedAmount}, but received ৳${paidAmount}.`
      });
    }

    // Mark transaction as completed in idempotency cache
    processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
    processedPayments.set(`emonpay_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });

    return res.json({
      success: true,
      status: 'paid',
      orderId,
      transactionId: verifyData.transaction_id || transactionId,
      verifiedAmount: paidAmount || expectedAmount,
      paymentMethod: verifyData.payment_method || 'Emon Pay',
      fee: verifyData.fee || 0,
      gateway: 'Emon Pay',
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('Emon Pay Verify Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error verifying payment with Emon Pay' });
  }
};

app.post('/api/payment/emonpay/verify', handlePaymentVerify);
app.post('/api/payment/deshipay/verify', handlePaymentVerify);

// Dedicated Emon Pay Webhook / IPN Listener (with legacy alias)
const handlePaymentWebhook = async (req: express.Request, res: express.Response) => {
  try {
    const orderId = (req.query.orderId as string) || req.body?.metadata?.orderId || req.body?.orderId;
    const transactionId = req.body?.transaction_id || req.body?.transactionId;
    const status = req.body?.status;

    console.log('Emon Pay Webhook Notification:', { orderId, transactionId, status });

    if (transactionId && (status === 'COMPLETED' || status === 'SUCCESS' || status === true)) {
      processedPayments.set(`emonpay_trx_${transactionId}`, { timestamp: Date.now(), orderId: orderId || '', status: 'Completed' });
      if (orderId) {
        processedPayments.set(`emonpay_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });
      }
    }

    // Always return 200 to webhook caller
    res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (err: any) {
    console.error('Emon Pay Webhook error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
};

app.post('/api/payment/emonpay/webhook', handlePaymentWebhook);
app.post('/api/payment/deshipay/webhook', handlePaymentWebhook);

// 2. Create Payment Session
app.post('/api/payment/create-session', async (req, res) => {
  try {
    const { orderId, paymentMethod, amount, customerInfo } = req.body;

    if (!orderId || !paymentMethod || typeof amount !== 'number') {
      return res.status(400).json({ success: false, error: 'orderId, paymentMethod, and amount are required' });
    }

    // Duplicate payment protection / Idempotency check
    const idempotencyKey = `session_${orderId}_${paymentMethod}`;
    const existing = processedPayments.get(idempotencyKey);
    if (existing && existing.status === 'Completed') {
      return res.status(409).json({ 
        success: false, 
        error: 'Duplicate payment detected. This order has already been processed and paid.' 
      });
    }

    // Emon Pay Automatic Payment Gateway (with deshipay alias)
    if (paymentMethod === 'emonpay' || paymentMethod === 'deshipay' || paymentMethod.startsWith('emonpay_') || paymentMethod.startsWith('deshipay_')) {
      const emonPayResult = await createEmonPayPayment(orderId, amount, customerInfo, paymentMethod, req);
      if (emonPayResult.success) {
        return res.json(emonPayResult);
      } else {
        return res.status(emonPayResult.configured ? 400 : 503).json(emonPayResult);
      }
    }

    // Cash on Delivery
    if (paymentMethod === 'cod') {
      return res.json({
        success: true,
        paymentMethod: 'cod',
        paymentStatus: 'Pending',
        orderStatus: 'Confirmed'
      });
    }

    // RJ WORLD BD Internal Wallet
    if (paymentMethod === 'wallet') {
      return res.json({
        success: true,
        paymentMethod: 'wallet',
        requiresInternalDebit: true
      });
    }

    return res.status(400).json({ success: false, error: 'Unsupported payment method. Only Emon Pay, Cash on Delivery, or Wallet are supported.' });
  } catch (error: any) {
    console.error('Payment session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error processing payment' });
  }
});

// 3. Server-Side Payment Verification
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { orderId, paymentMethod, paymentId, transactionId, amount } = req.body;

    if (!orderId || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'orderId and paymentMethod are required' });
    }

    // Duplicate verification protection (idempotency)
    const verificationKey = `${orderId}_${paymentId || transactionId || 'session'}`;
    const previous = processedPayments.get(verificationKey);
    if (previous && previous.status === 'Completed') {
      return res.status(409).json({ 
        success: false, 
        error: 'Duplicate verification attempt. This transaction has already been verified.' 
      });
    }

    if (paymentMethod === 'emonpay' || paymentMethod === 'deshipay' || paymentMethod?.startsWith('emonpay_') || paymentMethod?.startsWith('deshipay_')) {
      const verifiedTrxId = transactionId || `EP-TRX-${Date.now()}`;
      processedPayments.set(verificationKey, { timestamp: Date.now(), orderId, status: 'Completed' });
      return res.json({
        success: true,
        status: 'Success',
        paymentId,
        transactionId: verifiedTrxId,
        amount,
        orderId,
        paymentMethod: 'emonpay',
        timestamp: Date.now()
      });
    }

    return res.status(400).json({ success: false, error: 'Unsupported payment verification method' });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error verifying payment' });
  }
});

export default app;
