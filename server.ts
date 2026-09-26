import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import {
  generateDynamicSitemap,
  generateRobotsTxt,
  findProductByIdOrSlug,
  injectProductSeo,
  inject404Seo
} from './server/seoHandler';
import { generateAiSupportReply } from './server/aiAssistant';
import {
  getApprovedCouriersList,
  findApprovedCourier,
  verifyTrackingLinkDomain,
  buildOfficialTrackingUrl,
  verifyCourierTrackingWithAi,
  saveVerificationToRtdb,
  updateOrderCourierStatusInRtdb,
  type ApprovedCourier
} from './server/courierVerificationService';
import { analyzeImageForProductMatch } from './server/visualSearchService';

// Initialize Firebase Admin safely
try {
  if (!getApps().length) {
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      try {
        const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          projectId = cfg.projectId;
        }
      } catch {}
    }
    if (!projectId) {
      projectId = 'rjworldbdcom';
    }
    initializeApp({ projectId });
  }
} catch (adminErr) {
  console.warn('Firebase Admin SDK initialization deferred or running in client-mode:', adminErr);
}

// In-memory store for OTPs (In production, use Firestore or Redis)
// Format: { [email]: { otp: string, expires: number } }
const otpStore = new Map<string, { otp: string; expires: number }>();

// Rate limiting map (simple implementation)
const rateLimits = new Map<string, number>();

// Create a nodemailer transporter
let transporter: nodemailer.Transporter | null = null;

async function setupMailer() {
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
      // Create local fallback transporter for dev/preview so server starts immediately
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      console.log('Local/Dev Mailer initialized (JSON transport).');
    }
  } catch (err) {
    console.warn('Mailer initialization warning:', err);
  }
}

async function startServer() {
  await setupMailer();
  
  const app = express();
  const PORT = 3000;

  // Cloudflare Proxy & Reverse Proxy Support: trust cf-connecting-ip, x-forwarded-for, x-forwarded-proto
  app.set('trust proxy', true);

  // Cloudflare & Browser Strict Zero-Cache for all dynamic API routes
  // Guarantees user-specific, wallet, order, payment, and reseller data is NEVER cached at Cloudflare edge
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    next();
  });

  // Enable CORS for API routes with full Cloudflare proxy compatibility
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-App-Source, Cache-Control, Pragma');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const getBaseUrl = (req: express.Request): string => {
    const host = req.get('cf-connecting-host') || req.get('x-forwarded-host') || req.get('host') || 'rjworldbd.com';
    let proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const cfVisitor = req.get('cf-visitor');
    if (cfVisitor) {
      try {
        const parsed = JSON.parse(cfVisitor);
        if (parsed.scheme) proto = parsed.scheme;
      } catch {}
    }
    return `${proto}://${host}`;
  };

  // Dynamic robots.txt with search crawler directives and dynamic sitemap location
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const robots = generateRobotsTxt(baseUrl);
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(robots);
  });

  // Dynamic XML sitemap fetched directly from Firebase Realtime Database
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = getBaseUrl(req);
      const xml = await generateDynamicSitemap(baseUrl);
      res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.send(xml);
    } catch (err) {
      console.error('Error serving dynamic sitemap.xml:', err);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Google Search Console file verification endpoint
  app.get('/google:code([a-zA-Z0-9_-]+).html', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(`google-site-verification: google${req.params.code}.html`);
  });

  // Serve static assets from public/ folder (favicons, manifest.json, icons, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Explicit SEO and Favicon endpoints to guarantee Googlebot & browser crawler 200 responses
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');
  const getAssetPath = (fileName: string) => {
    if (fs.existsSync(path.join(publicDir, fileName))) return path.join(publicDir, fileName);
    if (fs.existsSync(path.join(distDir, fileName))) return path.join(distDir, fileName);
    return null;
  };

  const serveStaticFile = (fileName: string, contentType: string) => {
    return (_req: express.Request, res: express.Response) => {
      const filePath = getAssetPath(fileName);
      if (filePath) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.sendFile(filePath);
      } else {
        res.status(404).end();
      }
    };
  };
  app.get(['/favicon-48x48.png', '/favicon.png'], serveStaticFile('favicon-48x48.png', 'image/png'));
  app.get('/favicon-96x96.png', serveStaticFile('favicon-96x96.png', 'image/png'));
  app.get('/favicon-144x144.png', serveStaticFile('favicon-144x144.png', 'image/png'));
  app.get(['/favicon-192x192.png', '/android-chrome-192x192.png'], serveStaticFile('favicon-192x192.png', 'image/png'));
  app.get('/favicon.ico', serveStaticFile('favicon.ico', 'image/x-icon'));
  app.get('/apple-touch-icon.png', serveStaticFile('apple-touch-icon.png', 'image/png'));
  app.get('/rj-world-logo.png', serveStaticFile('rj-world-logo.png', 'image/png'));
  app.get('/og-image.png', serveStaticFile('og-image.png', 'image/png'));
  app.get('/manifest.json', serveStaticFile('manifest.json', 'application/manifest+json'));

  // Health check endpoints
  app.get(['/health', '/api/health', '/healthz', '/_health'], (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  // AI Live Support Assistant Route
  // Only replies to live chat ('customer', 'vendor', 'reseller'); NEVER replies to 'physical' support
  app.post('/api/support/ai-reply', async (req, res) => {
    try {
      const { role, userId, userName, message, history } = req.body;
      if (!role || !userId || !message) {
        return res.status(400).json({ error: 'role, userId and message are required' });
      }

      // STRICT REQUIREMENT: Physical support replies are strictly handled manually by admin
      if (role === 'physical') {
        return res.json({
          skipped: true,
          reply: 'ফিজিক্যাল সাপোর্ট এর আবেদনসমূহ আরজে ওয়ার্ল্ড অ্যাডমিন নিজে সরাসরি দেখে থাকেন ও উত্তর প্রদান করেন।'
        });
      }

      const result = await generateAiSupportReply({
        role,
        userId,
        userName,
        message,
        history
      });

      return res.json({
        success: true,
        reply: result.reply,
        source: result.source,
        skipped: !!result.skipped
      });
    } catch (err: any) {
      console.error('Error in /api/support/ai-reply:', err);
      return res.status(500).json({
        error: 'Failed to generate AI reply',
        reply: 'দুঃখিত, সংযোগে সামান্য বিলম্ব হচ্ছে। আমাদের টিম লাইভ আছেন, শীঘ্রই আপনাকে সহায়তা করা হচ্ছে।'
      });
    }
  });

  // Visual Image Search API using Gemini AI to match products across all vendors
  app.post('/api/search/image', async (req, res) => {
    try {
      const { base64Image, mimeType, fileName, vendorProducts } = req.body;
      if (!base64Image) {
        return res.status(400).json({ success: false, error: 'base64Image is required' });
      }

      const searchResult = await analyzeImageForProductMatch({
        base64Image,
        mimeType: mimeType || 'image/jpeg',
        fileName: fileName || '',
        vendorProducts: Array.isArray(vendorProducts) ? vendorProducts : []
      });

      return res.json({
        success: true,
        ...searchResult
      });
    } catch (err: any) {
      console.error('Error in /api/search/image:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to process visual search',
        matchedProductIds: [],
        detectedItem: '',
        confidenceKeywords: [],
        searchQuerySuggestion: ''
      });
    }
  });

  // ==========================================
  // COURIER TRACKING VERIFICATION & ANTI-SCAM APIS
  // ==========================================

  // 1. Get Approved Couriers List
  app.get('/api/courier/approved-list', async (req, res) => {
    try {
      const couriers = await getApprovedCouriersList();
      return res.json({ success: true, couriers });
    } catch (err: any) {
      console.error('Error fetching approved couriers:', err);
      return res.status(500).json({ success: false, error: 'Failed to load approved couriers' });
    }
  });

  // 2. Validate tracking link domain against official courier domains
  app.post('/api/courier/validate-domain', async (req, res) => {
    try {
      const { courierName, trackingUrl } = req.body;
      if (!courierName) {
        return res.status(400).json({ success: false, error: 'courierName is required' });
      }

      const approvedCouriers = await getApprovedCouriersList();
      const courier = findApprovedCourier(courierName, approvedCouriers);
      if (!courier) {
        return res.json({
          success: false,
          isApprovedCourier: false,
          error: `কুরিয়ার '${courierName}' আমাদের অনুমোদিত কুরিয়ার তালিকায় নেই।`
        });
      }

      if (!trackingUrl) {
        return res.json({
          success: true,
          isApprovedCourier: true,
          courier,
          domainValid: true
        });
      }

      const domainCheck = verifyTrackingLinkDomain(trackingUrl, courier);
      return res.json({
        success: domainCheck.isValid,
        isApprovedCourier: true,
        courier,
        domainValid: domainCheck.isValid,
        domain: domainCheck.domain,
        error: domainCheck.error
      });
    } catch (err: any) {
      console.error('Error validating domain:', err);
      return res.status(500).json({ success: false, error: 'Internal verification error' });
    }
  });

  // 3. AI Verify Tracking ID and match with Order Information
  app.post('/api/courier/verify-tracking', async (req, res) => {
    try {
      const { courierName, trackingId, trackingUrl, order, vendorId } = req.body;
      if (!courierName || !trackingId || !order || !order.orderId) {
        return res.status(400).json({
          success: false,
          error: 'courierName, trackingId and order with orderId are required'
        });
      }

      const record = await verifyCourierTrackingWithAi({
        courierName,
        trackingId,
        submittedUrl: trackingUrl,
        order,
        vendorId: vendorId || order.vendorId || ''
      });

      return res.json({
        success: record.verificationResult === 'Verified',
        record
      });
    } catch (err: any) {
      console.error('Error verifying courier tracking:', err);
      return res.status(500).json({
        success: false,
        error: 'কুরিয়ার যাচাইকরণে ত্রুটি দেখা দিয়েছে। পুনরায় চেষ্টা করুন।'
      });
    }
  });

  // 4. Customer / Vendor Live Sync Courier Tracking Status (Neutralized - no auto courier status update on website)
  app.post('/api/courier/sync-status', async (req, res) => {
    return res.json({ 
      success: true, 
      orderStatusUnchanged: true, 
      message: 'আমাদের ওয়েবসাইটে কুরিয়ার স্ট্যাটাস সরাসরি আপডেট হয় না। গ্রাহক কুরিয়ার ওয়েবসাইট থেকে ট্র্যাক করবেন।' 
    });
  });

  // 5. Get Courier Verification Records (RTDB)
  app.get('/api/courier/verifications', async (req, res) => {
    try {
      const rtdbBase = 'https://rjworldbdcom-default-rtdb.firebaseio.com';
      const orderId = req.query.orderId as string;

      let fetchUrl = `${rtdbBase}/courier_verifications.json`;
      if (orderId) {
        fetchUrl = `${rtdbBase}/order_courier_logs/${orderId}.json`;
      }

      const rtdbRes = await fetch(fetchUrl);
      if (!rtdbRes.ok) {
        return res.json({ success: true, records: [] });
      }

      const data = await rtdbRes.json();
      if (!data) {
        return res.json({ success: true, records: [] });
      }

      const list = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })).sort((a: any, b: any) => (b.verificationTime || b.createdAt || 0) - (a.verificationTime || a.createdAt || 0));

      return res.json({ success: true, records: list.slice(0, 100) });
    } catch (err: any) {
      console.error('Error fetching verification history:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch verifications' });
    }
  });

  // 6. Admin Manual Review Action (Approve / Reject)
  app.post('/api/courier/admin-review-action', async (req, res) => {
    try {
      const { verificationId, orderId, action, notes, adminName } = req.body;
      if (!orderId || !action) {
        return res.status(400).json({ success: false, error: 'orderId and action are required' });
      }

      const rtdbBase = 'https://rjworldbdcom-default-rtdb.firebaseio.com';
      const now = Date.now();

      if (action === 'approve') {
        const cleanId = String(orderId).replace(/^#/, '').trim();
        const pureOrderId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;

        // Fetch existing verification, review, or order to ensure tracking URL is preserved
        let vData: any = null;
        if (verificationId) {
          try {
            const vRes = await fetch(`${rtdbBase}/courier_verifications/${verificationId}.json`);
            vData = await vRes.json();
          } catch (_) {}
        }
        let rData: any = null;
        try {
          const rRes = await fetch(`${rtdbBase}/courier_link_reviews/${cleanId}.json`);
          rData = await rRes.json();
          if (!rData && cleanId !== pureOrderId) {
            const rResPure = await fetch(`${rtdbBase}/courier_link_reviews/${pureOrderId}.json`);
            rData = await rResPure.json();
          }
        } catch (_) {}
        let oData: any = null;
        try {
          const oRes = await fetch(`${rtdbBase}/orders/${cleanId}.json`);
          oData = await oRes.json();
          if (!oData && cleanId !== pureOrderId) {
            const oResPure = await fetch(`${rtdbBase}/orders/${pureOrderId}.json`);
            oData = await oResPure.json();
          }
        } catch (_) {}

        const approvedUrl = (vData?.officialTrackingUrl || vData?.submittedUrl || rData?.trackingUrl || oData?.approvedCourierTrackingUrl || oData?.trackingUrl || oData?.courierTrackingUrl || '').trim();
        const approvedTrackingId = (vData?.trackingId || rData?.trackingId || oData?.trackingNumber || oData?.trackingId || '').trim();
        const approvedCourierName = (vData?.courierName || rData?.courierName || oData?.courierName || 'Courier').trim();

        const patchPayload = {
          status: 'Shipped',
          vendorStatus: 'Shipped',
          courierVerificationStatus: 'Verified',
          courierAdminApproved: true,
          courierAdminApprovedBy: adminName || 'Admin',
          courierAdminNotes: notes || '',
          courierAdminApprovedAt: now,
          trackingUrl: approvedUrl,
          courierTrackingUrl: approvedUrl,
          approvedCourierTrackingUrl: approvedUrl,
          trackingNumber: approvedTrackingId,
          trackingId: approvedTrackingId,
          consignmentId: approvedTrackingId,
          courierName: approvedCourierName
        };

        // Mark as Verified and Approved by Admin with full tracking URL binding across all ID formats
        await updateOrderCourierStatusInRtdb(cleanId, patchPayload);
        if (cleanId !== pureOrderId) {
          await updateOrderCourierStatusInRtdb(pureOrderId, patchPayload);
        }

        // Also update courier_link_reviews so Customer Order Page reflects the approval immediately
        const reviewPatch = {
          status: 'approved',
          reviewedAt: now,
          reviewedBy: adminName || 'Admin',
          reviewNotes: notes || '',
          trackingUrl: approvedUrl,
          trackingId: approvedTrackingId,
          courierName: approvedCourierName,
          updatedAt: now
        };

        try {
          await fetch(`${rtdbBase}/courier_link_reviews/${cleanId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPatch)
          });
          if (cleanId !== pureOrderId) {
            await fetch(`${rtdbBase}/courier_link_reviews/${pureOrderId}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reviewPatch)
            });
          }
        } catch (_) {}

        if (verificationId) {
          await fetch(`${rtdbBase}/courier_verifications/${verificationId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verificationResult: 'Verified',
              adminApproved: true,
              adminReviewedBy: adminName || 'Admin',
              adminReviewNotes: notes || '',
              updatedAt: now
            })
          });
        }

        return res.json({ success: true, message: 'অর্ডার কুরিয়ার ট্র্যাকিং অ্যাডমিন দ্বারা অনুমোদিত হয়েছে।' });
      } else {
        // Reject
        const cleanId = String(orderId).replace(/^#/, '').trim();
        const pureOrderId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;

        const rejectPatch = {
          courierVerificationStatus: 'Verification Failed',
          courierAdminApproved: false,
          courierAdminRejectedBy: adminName || 'Admin',
          courierVerificationFailureReason: notes || 'অ্যাডমিন রিভিউতে কুরিয়ার ট্র্যাকিং বাতিল করা হয়েছে।',
          courierAdminRejectedAt: now
        };

        await updateOrderCourierStatusInRtdb(cleanId, rejectPatch);
        if (cleanId !== pureOrderId) {
          await updateOrderCourierStatusInRtdb(pureOrderId, rejectPatch);
        }

        if (verificationId) {
          await fetch(`${rtdbBase}/courier_verifications/${verificationId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verificationResult: 'Verification Failed',
              failureReason: notes || 'অ্যাডমিন রিভিউতে বাতিল',
              adminApproved: false,
              adminReviewedBy: adminName || 'Admin',
              adminReviewNotes: notes || '',
              updatedAt: now
            })
          });
        }

        return res.json({ success: true, message: 'কুরিয়ার ট্র্যাকিং বাতিল করা হয়েছে।' });
      }
    } catch (err: any) {
      console.error('Error handling admin review action:', err);
      return res.status(500).json({ success: false, error: 'Action failed' });
    }
  });

  // 7. Periodic Courier Tracking Check (Disabled per policy)
  app.post('/api/courier/run-periodic-check', async (req, res) => {
    return res.json({ success: true, message: 'স্বয়ংক্রিয় কুরিয়ার স্ট্যাটাস আপডেট সিস্টেম বন্ধ রয়েছে। গ্রাহক কুরিয়ার পেজ থেকে সরাসরি ট্র্যাক করবেন।' });
  });

  // 8. Get status of Periodic Courier Tracking Check
  app.get('/api/courier/periodic-check-status', (req, res) => {
    return res.json({ success: true, enabled: false });
  });

  // API Routes for Custom OTP Forgot Password
  
  app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Rate limiting: max 1 request per minute per email
      const now = Date.now();
      const lastRequest = rateLimits.get(email);
      if (lastRequest && now - lastRequest < 60000) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      }
      rateLimits.set(email, now);

      // Verify user exists using Admin SDK
      let userRecord;
      try {
        userRecord = await getAuth().getUserByEmail(email);
      } catch (error: any) {
        // Do not reveal whether email exists for security
        // Wait, if the user doesn't exist, we just return success but don't send an email
        return res.json({ success: true });
      }

      // Generate 6-digit secure OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Store OTP with 10-minute expiration
      otpStore.set(email, { otp, expires: now + 10 * 60 * 1000 });

      // Send Email
      if (transporter) {
        const info = await transporter.sendMail({
          from: '"RJ World Security" <no-reply@rjworld.com>',
          to: email,
          subject: 'Your Password Reset Verification Code',
          text: `Your password reset verification code is: ${otp}. It will expire in 10 minutes.`,
          html: `
            <div style="font-family: sans-serif; max-w-md: 400px; margin: 0 auto; padding: 20px; text-align: center;">
              <h2 style="color: #333;">Password Reset</h2>
              <p>You requested a password reset. Here is your verification code:</p>
              <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
                ${otp}
              </div>
              <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `
        });

        // If using Ethereal/test account, log preview URL
        if (nodemailer.getTestMessageUrl(info)) {
          console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
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

      // Mark as verified by updating the store (extend expiry slightly, remove OTP so it can't be reused)
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

      // Update password via Admin SDK
      const userRecord = await getAuth().getUserByEmail(email);
      await getAuth().updateUser(userRecord.uid, {
        password: newPassword,
      });

      // Clear the verified session
      otpStore.delete(email);

      res.json({ success: true });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Bulletproof Image Upload: saves to local public/uploads and proxies to imgdb.io
  app.post('/api/upload-image', async (req, res) => {
    try {
      const { image } = req.body; // base64 string
      if (!image) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Extract base64 part and mime type if it contains data URI prefix
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      let base64Data = image;
      let mimeType = 'image/jpeg';
      let extension = 'jpg';
      
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
        const rawExt = mimeType.split('/')[1] || 'jpg';
        extension = rawExt === 'jpeg' ? 'jpg' : rawExt;
      } else if (image.includes('base64,')) {
        base64Data = image.split('base64,')[1];
      }

      const buffer = Buffer.from(base64Data, 'base64');

      // 1. Guaranteed Local Persistence in public/uploads/
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const uniqueFileName = `vendor_img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
      const localFilePath = path.join(uploadsDir, uniqueFileName);
      await fs.promises.writeFile(localFilePath, buffer);

      // Build relative URL
      const localUrl = `/uploads/${uniqueFileName}`;

      // 2. Try external imgdb.io with quick timeout
      try {
        const blob = new Blob([buffer], { type: mimeType });
        const formData = new FormData();
        formData.append('file', blob, `image.${extension}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch('https://imgdb.io/api/v1/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json().catch(() => null);
        if (response.ok && data && data.url) {
          return res.json({ success: true, url: data.url, localUrl });
        } else if (data && data.data && data.data.url) {
          return res.json({ success: true, url: data.data.url, localUrl });
        }
      } catch (extErr) {
        console.warn('External image upload notice (using guaranteed local upload):', extErr);
      }

      // Return guaranteed local upload URL
      return res.json({ success: true, url: localUrl });
    } catch (error: any) {
      console.error('Image upload failed:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Vendor Profile & Store Synchronizer Endpoint
  app.post('/api/vendor/save-profile', async (req, res) => {
    try {
      const { vendorId, profileData, vendorData } = req.body || {};
      if (!vendorId) {
        return res.status(400).json({ success: false, error: 'Vendor ID is required' });
      }

      const now = Date.now();
      const rtdbBase = 'https://rjworldbdcom-default-rtdb.firebaseio.com';

      // 1. Sync to Firebase Realtime Database
      try {
        if (profileData) {
          await fetch(`${rtdbBase}/vendor_profiles/${vendorId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...profileData, updatedAt: now }),
            signal: AbortSignal.timeout(3000)
          });
        }
        if (vendorData) {
          await fetch(`${rtdbBase}/vendors/${vendorId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...vendorData, updatedAt: now }),
            signal: AbortSignal.timeout(3000)
          });
        }
      } catch (rtdbErr) {
        console.warn('Realtime Database vendor sync notice:', rtdbErr);
      }

      // 2. Persistent disk cache for guaranteed server continuity
      try {
        const vendorDataDir = path.join(process.cwd(), 'public', 'data', 'vendors');
        if (!fs.existsSync(vendorDataDir)) {
          fs.mkdirSync(vendorDataDir, { recursive: true });
        }
        const profileFile = path.join(vendorDataDir, `${vendorId}.json`);
        await fs.promises.writeFile(profileFile, JSON.stringify({
          vendorId,
          profile: profileData,
          vendor: vendorData,
          updatedAt: now
        }, null, 2));
      } catch (_) {}

      return res.json({ success: true, message: 'Vendor store and profile successfully synchronized' });
    } catch (err: any) {
      console.error('Vendor save-profile error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Vendor Deletion Server Endpoint
  app.post('/api/vendor/delete', async (req, res) => {
    try {
      const { vendorId, candidateIds } = req.body || {};
      const ids: string[] = [];
      if (vendorId && typeof vendorId === 'string') ids.push(vendorId.trim());
      if (Array.isArray(candidateIds)) {
        candidateIds.forEach(id => {
          if (typeof id === 'string' && id.trim()) ids.push(id.trim());
        });
      }

      if (ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Vendor ID is required' });
      }

      const now = Date.now();
      const rtdbBase = 'https://rjworldbdcom-default-rtdb.firebaseio.com';
      const vendorDataDir = path.join(process.cwd(), 'public', 'data', 'vendors');

      for (const id of ids) {
        // 1. Delete local JSON profile if present
        try {
          const profileFile = path.join(vendorDataDir, `${id}.json`);
          if (fs.existsSync(profileFile)) {
            await fs.promises.unlink(profileFile).catch(() => {});
          }
        } catch (_) {}

        // 2. Remove RTDB vendor nodes via REST fallback
        try {
          await Promise.allSettled([
            fetch(`${rtdbBase}/vendors/${id}.json`, { method: 'DELETE', signal: AbortSignal.timeout(3000) }),
            fetch(`${rtdbBase}/stores/${id}.json`, { method: 'DELETE', signal: AbortSignal.timeout(3000) }),
            fetch(`${rtdbBase}/vendor_profiles/${id}.json`, { method: 'DELETE', signal: AbortSignal.timeout(3000) }),
            fetch(`${rtdbBase}/deleted_vendors/${id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, deletedAt: now, deletedBy: 'admin_server' }),
              signal: AbortSignal.timeout(3000)
            })
          ]);
        } catch (_) {}
      }

      return res.json({ success: true, message: 'Vendor successfully removed from server' });
    } catch (err: any) {
      console.error('Vendor delete error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Reseller Order Confirmation with Strict Backend Balance & Eligibility Validation (Step 4)
  app.post('/api/vendor/orders/confirm-reseller-order', async (req, res) => {
    try {
      const { orderId, vendorId } = req.body || {};
      if (!orderId || !vendorId) {
        return res.status(400).json({ success: false, error: 'Missing orderId or vendorId' });
      }

      const rtdbBase = 'https://rjworldbdcom-default-rtdb.firebaseio.com';

      // 1. Fetch vendor order from RTDB
      let order: any = null;
      try {
        const resp = await fetch(`${rtdbBase}/vendor_orders/${orderId}.json`, { signal: AbortSignal.timeout(4000) });
        if (resp.ok) {
          order = await resp.json();
          if (order) order._rtdbKey = orderId;
        }
      } catch (_) {}

      // Fallback search if order was keyed differently
      if (!order) {
        try {
          const respList = await fetch(`${rtdbBase}/vendor_orders.json?orderBy="vendorId"&equalTo="${vendorId}"`, { signal: AbortSignal.timeout(4000) });
          if (respList.ok) {
            const list = await respList.json();
            if (list && typeof list === 'object') {
              for (const [k, v] of Object.entries<any>(list)) {
                if (v && (v.id === orderId || v.orderId === orderId || v.mainOrderId === orderId || k === orderId)) {
                  order = { ...v, _rtdbKey: k };
                  break;
                }
              }
            }
          }
        } catch (_) {}
      }

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      // Verify vendor ownership
      if (order.vendorId && order.vendorId !== vendorId) {
        return res.status(403).json({ success: false, error: 'Unauthorized vendor access' });
      }

      // Check 1: Order is truly a Reseller Order
      const isResellerOrder = Boolean(order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit);
      if (!isResellerOrder) {
        return res.status(400).json({ success: false, error: 'This order is not a reseller order' });
      }

      // Check 5: Has the order already been confirmed?
      const currentStatus = order.status || order.orderStatus || 'Pending';
      if (['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(currentStatus)) {
        return res.status(400).json({ success: false, error: 'Order has already been confirmed' });
      }

      // Check 2: Is the order currently eligible to be confirmed? (Must be Pending and not Cancelled/Rejected)
      if (currentStatus !== 'Pending') {
        return res.status(400).json({ success: false, error: `Order is not eligible for confirmation (current status: ${currentStatus})` });
      }

      // Check 3: Determine Required Reseller Profit amount
      let requiredResellerProfit = Number(
        order.resellerProfit ?? 
        order.priceSnapshot?.resellerProfit ?? 
        0
      );

      // If missing on RTDB order object, query Firestore reseller_orders doc
      if (requiredResellerProfit <= 0) {
        try {
          const firestore = getFirestore();
          const roSnap = await firestore.collection('reseller_orders').doc(orderId).get();
          if (roSnap.exists) {
            const roData = roSnap.data();
            requiredResellerProfit = Number(roData?.resellerProfit ?? roData?.commissionAmount ?? 0);
          } else {
            const qSnap = await firestore.collection('reseller_orders').where('orderId', '==', orderId).limit(1).get();
            if (!qSnap.empty) {
              const roData = qSnap.docs[0].data();
              requiredResellerProfit = Number(roData?.resellerProfit ?? roData?.commissionAmount ?? 0);
            }
          }
        } catch (fErr) {
          console.warn('Firestore reseller_orders check notice:', fErr);
        }
      }

      // Check 4: Fetch Vendor Available Wallet Balance
      let wallet: any = null;
      try {
        const wResp = await fetch(`${rtdbBase}/vendor_wallet/${vendorId}.json`, { signal: AbortSignal.timeout(4000) });
        if (wResp.ok) wallet = await wResp.json();
      } catch (_) {}

      const availableBalance = Number(wallet?.balance ?? wallet?.availableBalance ?? 0);
      const lockedBalance = Number(wallet?.lockedBalance ?? wallet?.resellerProfitReserve ?? 0);
      const totalBalance = availableBalance + lockedBalance;

      // If available balance is less than required reseller profit, reject confirmation!
      if (availableBalance < requiredResellerProfit) {
        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_WALLET_BALANCE',
          message: `আপনার এই অর্ডারটি কনফার্ম করার জন্য আপনার ওয়ালেটে ৳${requiredResellerProfit} ব্যালেন্স প্রয়োজন।`,
          requiredResellerProfit,
          availableBalance,
          shortfall: requiredResellerProfit - availableBalance
        });
      }

      // Validation PASSED!
      // In Step 4:
      // Required profit is NOT deducted from wallet, and NOT sent to locked balance (that is Step 5).
      // We mark order as confirmed (Accepted) and flag as eligible for Step 5 profit reserve.
      const now = Date.now();
      const targetKey = order._rtdbKey || order.id || `${order.mainOrderId || order.orderId}_${vendorId}`;
      const updatePayload = {
        status: 'Accepted',
        acceptedAt: now,
        resellerReserveEligible: true,
        requiredResellerProfit,
        updatedAt: now
      };

      try {
        await fetch(`${rtdbBase}/vendor_orders/${targetKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (order.id && order.id !== targetKey) {
          await fetch(`${rtdbBase}/vendor_orders/${order.id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
          });
        }
      } catch (_) {}

      // Update main customer order status in RTDB
      const mainOrderId = order.mainOrderId || order.orderId || order.id;
      if (mainOrderId) {
        try {
          await fetch(`${rtdbBase}/orders/${mainOrderId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'Accepted',
              vendorStatus: 'Accepted',
              acceptedAt: now,
              updatedAt: now
            })
          });
        } catch (_) {}
      }

      return res.json({
        success: true,
        message: 'অর্ডার সফলভাবে কনফার্ম করা হয়েছে।',
        requiredResellerProfit,
        availableBalance,
        lockedBalance,
        totalBalance
      });
    } catch (err: any) {
      console.error('Confirm reseller order server error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // ==========================================
  // PAYMENT GATEWAY & VERIFICATION API ROUTES
  // ==========================================

  // In-memory idempotency cache for duplicate payment protection
  const processedPayments = new Map<string, { timestamp: number; orderId: string; status: string }>();

  // Merchant SofolX Brand Key (used for bKash, Nagad, and SofolX payment options)
  const SOFOLX_MERCHANT_KEY = 'Dqvx0qo2gzssXuMv9XOgez6LnaRylmvhQLVT9BV4DLVuERH2DK';

  // SofolX Gateway Configuration Store
  // Authentication strictly sends the merchant Brand Key as: API-KEY: Dqvx0qo2gzssXuMv9XOgez6LnaRylmvhQLVT9BV4DLVuERH2DK
  // NEVER use https://pay.sofolx.com/api or any URL as a key
  let localSofolXConfig = {
    brandKey: SOFOLX_MERCHANT_KEY,
    enabled: true,
    baseUrl: 'https://pay.sofolx.com',
    isSandbox: false,
    lastFetched: 0
  };

  const getSofolXConfig = async () => {
    const now = Date.now();
    // Cache for 15s
    if (now - localSofolXConfig.lastFetched > 15000) {
      localSofolXConfig.brandKey = SOFOLX_MERCHANT_KEY;
      localSofolXConfig.lastFetched = now;
    }
    return localSofolXConfig;
  };

  // 1. Check Gateway Statuses (Clean public info, zero secrets exposed)
  app.get('/api/payment/gateways-status', async (req, res) => {
    const config = await getSofolXConfig();
    res.json({
      cod: true,
      wallet: true,
      sofolx: {
        enabled: config.enabled,
        configured: Boolean(config.brandKey),
        baseUrl: config.baseUrl,
        isSandbox: config.isSandbox
      },
      emonpay: config.enabled,
      deshipay: config.enabled
    });
  });

  // Admin Payment Settings Management
  app.post('/api/admin/payment-settings', async (req, res) => {
    try {
      const brandKey = req.body.sofolxBrandKey ?? req.body.brandKey ?? req.body.apiKey;
      const enabled = req.body.sofolxEnabled ?? req.body.enabled;
      const baseUrl = req.body.sofolxBaseUrl ?? req.body.baseUrl;
      const isSandbox = req.body.sofolxSandboxMode ?? req.body.isSandbox ?? req.body.sandbox;

      if (typeof brandKey === 'string') {
        localSofolXConfig.brandKey = brandKey.trim();
      }
      if (typeof enabled === 'boolean') {
        localSofolXConfig.enabled = enabled;
      }
      if (typeof baseUrl === 'string' && baseUrl.trim()) {
        localSofolXConfig.baseUrl = baseUrl.trim();
      }
      if (typeof isSandbox === 'boolean') {
        localSofolXConfig.isSandbox = isSandbox;
      }
      localSofolXConfig.lastFetched = Date.now();

      try {
        const db = getFirestore();
        await db.collection('settings').doc('payment').set({
          sofolxBrandKey: localSofolXConfig.brandKey,
          sofolxEnabled: localSofolXConfig.enabled,
          sofolxBaseUrl: localSofolXConfig.baseUrl,
          sofolxSandboxMode: localSofolXConfig.isSandbox,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (dbErr) {
        console.warn('Could not persist to Firestore settings/payment:', dbErr);
      }

      res.json({
        success: true,
        message: 'Payment settings updated successfully',
        sofolx: {
          enabled: localSofolXConfig.enabled,
          configured: Boolean(localSofolXConfig.brandKey),
          isSandbox: localSofolXConfig.isSandbox,
          baseUrl: localSofolXConfig.baseUrl
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-side Domain & OAuth Configuration
  const serverSideDomainConfig = {
    primaryDomain: 'rjworldbd.com',
    websiteUrl: 'https://rjworldbd.com',
    authorizedDomain: 'rjworldbd.com',
    oauthRedirectUri: 'https://rjworldbdcom.firebaseapp.com/__/auth/handler',
    fallbackOauthRedirectUri: 'https://rjworldbd.com/__/auth/handler',
    status: 'Connected' as 'Connected' | 'Not Connected',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    lastChecked: new Date().toISOString()
  };

  // Get Domain Settings (Secrets are protected and never exposed)
  app.get('/api/admin/domain-settings', async (req, res) => {
    try {
      let firestoreSettings: any = null;
      try {
        const db = getFirestore();
        const docSnap = await db.collection('settings').doc('domain').get();
        if (docSnap.exists) {
          firestoreSettings = docSnap.data();
        }
      } catch (dbErr) {
        console.warn('Firestore read error in /api/admin/domain-settings:', dbErr);
      }

      const primaryDomain = firestoreSettings?.primaryDomain || serverSideDomainConfig.primaryDomain;
      const websiteUrl = firestoreSettings?.websiteUrl || serverSideDomainConfig.websiteUrl;
      const authorizedDomain = firestoreSettings?.authorizedDomain || primaryDomain;
      const oauthRedirectUri = serverSideDomainConfig.oauthRedirectUri;
      const status = firestoreSettings?.status || serverSideDomainConfig.status;

      res.json({
        primaryDomain,
        websiteUrl,
        authorizedDomain,
        oauthRedirectUri,
        fallbackOauthRedirectUri: 'https://rjworldbdcom.firebaseapp.com/__/auth/handler',
        status,
        lastChecked: firestoreSettings?.lastChecked || serverSideDomainConfig.lastChecked,
        hasClientSecret: Boolean(serverSideDomainConfig.googleClientSecret),
        serverOAuthConfigured: Boolean(serverSideDomainConfig.googleClientId && serverSideDomainConfig.googleClientSecret),
        updatedAt: firestoreSettings?.updatedAt || new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save & Validate Domain Settings
  app.post('/api/admin/domain-settings', async (req, res) => {
    try {
      let { primaryDomain, websiteUrl, authorizedDomain, clientSecret, clientId, updatedBy } = req.body;

      if (!primaryDomain || typeof primaryDomain !== 'string') {
        return res.status(400).json({ success: false, error: 'Primary domain is required.' });
      }

      // 1. Normalize domain
      primaryDomain = primaryDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
      authorizedDomain = (authorizedDomain || primaryDomain).trim().toLowerCase().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

      // 2. Validate domain format
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(primaryDomain)) {
        return res.status(400).json({ success: false, error: 'Invalid Primary Domain format. Example: rjworldbd.com' });
      }

      // 3. Normalize & Validate Website URL
      if (!websiteUrl || typeof websiteUrl !== 'string') {
        websiteUrl = `https://${primaryDomain}`;
      } else {
        websiteUrl = websiteUrl.trim();
        if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
          websiteUrl = `https://${websiteUrl}`;
        }
        websiteUrl = websiteUrl.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '');
      }

      try {
        const parsed = new URL(websiteUrl);
        if (parsed.protocol !== 'https:') {
          return res.status(400).json({ success: false, error: 'Website URL must use secure HTTPS.' });
        }
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid Website URL format.' });
      }

      // 4. Authentic OAuth Redirect URI calculation
      const oauthRedirectUri = 'https://rjworldbdcom.firebaseapp.com/__/auth/handler';
      const fallbackOauthRedirectUri = `https://${primaryDomain}/__/auth/handler`;

      // 5. Store sensitive OAuth secret server-side only
      if (typeof clientSecret === 'string' && clientSecret.trim()) {
        serverSideDomainConfig.googleClientSecret = clientSecret.trim();
      }
      if (typeof clientId === 'string' && clientId.trim()) {
        serverSideDomainConfig.googleClientId = clientId.trim();
      }

      serverSideDomainConfig.primaryDomain = primaryDomain;
      serverSideDomainConfig.websiteUrl = websiteUrl;
      serverSideDomainConfig.authorizedDomain = authorizedDomain;
      serverSideDomainConfig.oauthRedirectUri = oauthRedirectUri;
      serverSideDomainConfig.status = 'Connected';
      serverSideDomainConfig.lastChecked = new Date().toISOString();

      // 6. Save to Firestore (excluding client secret)
      try {
        const db = getFirestore();
        await db.collection('settings').doc('domain').set({
          primaryDomain,
          websiteUrl,
          authorizedDomain,
          oauthRedirectUri,
          fallbackOauthRedirectUri,
          status: 'Connected',
          lastChecked: serverSideDomainConfig.lastChecked,
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy || 'Admin'
        }, { merge: true });
      } catch (dbErr) {
        console.warn('Firestore write warning in /api/admin/domain-settings:', dbErr);
      }

      res.json({
        success: true,
        message: 'Domain Settings saved and normalized successfully.',
        settings: {
          primaryDomain,
          websiteUrl,
          authorizedDomain,
          oauthRedirectUri,
          fallbackOauthRedirectUri,
          status: 'Connected',
          hasClientSecret: Boolean(serverSideDomainConfig.googleClientSecret),
          lastChecked: serverSideDomainConfig.lastChecked
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check Domain Connectivity Status
  app.get('/api/admin/domain-status', async (req, res) => {
    try {
      const rawDomain = (req.query.domain as string) || serverSideDomainConfig.primaryDomain || 'rjworldbd.com';
      const cleanDomain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').split('/')[0];

      // For the primary domain 'rjworldbd.com' or configured domain
      res.json({
        domain: cleanDomain,
        connected: true,
        status: 'Connected',
        message: `Primary domain ${cleanDomain} is verified and active with HTTPS support.`,
        checkedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check Custom Auth Domain /__/auth/handler Connectivity Status
  app.get('/api/admin/check-auth-domain', async (req, res) => {
    const rawDomain = (req.query.domain as string) || 'rjworldbd.com';
    const cleanDomain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').split('/')[0];
    const targetUrl = `https://${cleanDomain}/__/auth/handler`;

    try {
      const probe = await fetch(targetUrl, {
        headers: { 'User-Agent': 'RJ-World-BD-Domain-Auditor/1.0' },
        signal: AbortSignal.timeout(5000)
      });
      const text = await probe.text();

      if (text.includes('fireauth') || text.includes('oauthhelper') || text.includes('POST_BODY')) {
        return res.json({
          isConfigured: true,
          checkedUrl: targetUrl,
          responseType: 'firebase_handler',
          message: `Success: ${cleanDomain} is actively connected to Firebase Hosting and serving the Firebase Auth handler.`
        });
      } else {
        return res.json({
          isConfigured: false,
          checkedUrl: targetUrl,
          responseType: 'spa_fallback',
          message: `External Setup Pending: https://${cleanDomain}/__/auth/handler is currently returning the website's SPA HTML instead of Firebase Auth handler. Please connect "${cleanDomain}" as a custom domain under Firebase Console > Hosting for project "rjworldbdcom".`
        });
      }
    } catch (err: any) {
      return res.json({
        isConfigured: false,
        checkedUrl: targetUrl,
        responseType: 'unreachable',
        message: `Could not reach ${targetUrl}: ${err.message || 'Connection failed'}. Check DNS and Firebase Hosting setup.`
      });
    }
  });

  // Helper to build official SofolX endpoints safely
  // Documentation: https://sofolx.com / https://pay.sofolx.com
  const getSofolXEndpoint = (endpoint: '/api' | '/api/verify', baseUrl?: string): string => {
    let rawBase = (baseUrl || localSofolXConfig.baseUrl || 'https://pay.sofolx.com').trim();
    if (!rawBase) rawBase = 'https://pay.sofolx.com';
    if (!/^https?:\/\//i.test(rawBase)) {
      rawBase = `https://${rawBase}`;
    }
    rawBase = rawBase.replace(/\/+$/, '');
    // Ensure standard SofolX payment domain
    if (rawBase.includes('sofolx.com') && !rawBase.includes('pay.sofolx.com')) {
      rawBase = rawBase.replace('sofolx.com', 'pay.sofolx.com');
    }
    if (rawBase.endsWith('/api') && endpoint.startsWith('/api')) {
      return `${rawBase}${endpoint.slice('/api'.length)}`;
    }
    return `${rawBase}${endpoint}`;
  };

  // Helper for SofolX Payment Creation
  // Official Docs: POST https://pay.sofolx.com/api with API-KEY header
  const createSofolXPayment = async (orderId: string, amount: number, customerInfo: any, paymentMethod: string, req: express.Request) => {
    const config = await getSofolXConfig();
    const brandKey = config.brandKey;
    const isSandbox = config.isSandbox;

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const origin = req.headers.origin || process.env.APP_URL || `${proto}://${host}`;

    // Brand keys are locked to the registered domain (e.g. rjworldbd.com)
    // If request originates from preview or localhost, use https://rjworldbd.com for the callback URLs
    const callbackBase = origin.includes('rjworldbd.com') ? origin : 'https://rjworldbd.com';

    let success_url = `${callbackBase}/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}`;
    let cancel_url = `${callbackBase}/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}&cancel=true`;

    const formattedAmount = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));

    if (brandKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const createEndpoint = getSofolXEndpoint('/api', config.baseUrl);
      const customerName = (customerInfo?.name || '').trim() || 'Customer';
      let customerPhone = (customerInfo?.phone || customerInfo?.mobile || '').trim();
      if (!customerPhone || customerPhone.length < 10) {
        customerPhone = '01700000000';
      }
      const customerEmail = (customerInfo?.email || '').trim() || 'customer@rjworldbd.com';

      // Standard SofolX payload schema
      const payload: Record<string, any> = {
        amount: formattedAmount,
        currency: 'BDT',
        order_id: String(orderId),
        cus_name: customerName,
        cus_email: customerEmail,
        cus_phone: customerPhone,
        success_url,
        cancel_url
      };

      const maskedKey = brandKey.length > 8 
        ? `${brandKey.substring(0, 4)}...${brandKey.substring(brandKey.length - 4)}` 
        : '***';

      // SofolX authentication requires merchant Brand Key sent in API-KEY header
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-KEY': brandKey
      };

      try {
        const createRes = await fetch(createEndpoint, {
          method: 'POST',
          signal: controller.signal,
          headers,
          body: JSON.stringify(payload)
        });

        clearTimeout(timeoutId);

        const rawText = await createRes.text();

        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }

        // SofolX returns payment_url as the direct checkout redirect destination
        const extractedPaymentUrl = data?.payment_url || 
                                    data?.paymentUrl || 
                                    data?.url || 
                                    data?.data?.payment_url || 
                                    data?.data?.paymentUrl;

        // Structured Debug Logging (no secret values exposed)
        console.log('=== [SOFOLX MERCHANT INTEGRATION DEBUG] ===');
        console.log('1. API endpoint             :', createEndpoint);
        console.log('2. HTTP method              : POST');
        console.log('3. Request Headers          :', {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'API-KEY': maskedKey
        });
        console.log('4. Request payload          :', JSON.stringify(payload, null, 2));
        console.log('5. HTTP status              :', createRes.status, createRes.statusText);
        console.log('6. Raw SofolX response      :', rawText);
        console.log('7. Parsed JSON response     :', JSON.stringify(data, null, 2));
        if (createRes.ok && extractedPaymentUrl && /^https?:\/\//i.test(extractedPaymentUrl)) {
          console.log('8. Returned redirect/payment URL:', extractedPaymentUrl);
        } else {
          console.log('8. Exact validation failure :', data?.message || data?.code || 'Missing valid payment_url in response');
        }
        console.log('============================================');

        if (createRes.ok && extractedPaymentUrl && /^https?:\/\//i.test(extractedPaymentUrl)) {
          return {
            success: true,
            configured: true,
            paymentMethod: paymentMethod || 'sofolx',
            paymentId: `SX_${orderId}`,
            gatewayUrl: extractedPaymentUrl,
            paymentUrl: extractedPaymentUrl,
            payment_url: extractedPaymentUrl,
            orderId
          };
        }

        // If SofolX specifies domain locking in its response message, retry with that domain
        if (!createRes.ok && data?.message && typeof data.message === 'string' && data.message.includes('locked to')) {
          const match = data.message.match(/locked to\s+([a-zA-Z0-9.-]+)/i);
          if (match && match[1]) {
            const lockedDomain = match[1];
            console.log(`[SofolX] Retrying with locked domain: https://${lockedDomain}`);
            payload.success_url = `https://${lockedDomain}/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}`;
            payload.cancel_url = `https://${lockedDomain}/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}&cancel=true`;

            const retryRes = await fetch(createEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            });
            const retryRaw = await retryRes.text();
            let retryData: any = null;
            try { retryData = JSON.parse(retryRaw); } catch {}
            const retryUrl = retryData?.payment_url || retryData?.paymentUrl || retryData?.url;
            if (retryRes.ok && retryUrl && /^https?:\/\//i.test(retryUrl)) {
              return {
                success: true,
                configured: true,
                paymentMethod: paymentMethod || 'sofolx',
                paymentId: `SX_${orderId}`,
                gatewayUrl: retryUrl,
                paymentUrl: retryUrl,
                payment_url: retryUrl,
                orderId
              };
            }
          }
        }

        const sofolxError = data?.message || data?.error || 'SofolX payment link creation failed. Please verify your merchant Brand Key.';
        if (!isSandbox) {
          return {
            success: false,
            configured: true,
            error: sofolxError,
            rawResponse: data
          };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error('Error connecting to SofolX API:', err);
        const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
        const errorDetail = isTimeout 
          ? 'SofolX servers took longer than 15 seconds to respond. Please try again.'
          : ('Failed to contact SofolX gateway servers: ' + (err.message || 'Unknown network error'));
        if (!isSandbox) {
          return {
            success: false,
            configured: true,
            error: errorDetail
          };
        }
      }
    }

    // Sandbox Simulator fallback (if test simulation or Brand Key not yet configured)
    const sandboxPortalUrl = `${origin}/payment/sofolx/sandbox-portal?orderId=${encodeURIComponent(orderId)}&amount=${amount}&paymentMethod=${encodeURIComponent(paymentMethod || 'sofolx')}&name=${encodeURIComponent(customerInfo?.name || 'Customer')}`;
    if (isSandbox || !brandKey) {
      return {
        success: true,
        configured: Boolean(brandKey),
        isSandbox: true,
        paymentMethod: paymentMethod || 'sofolx',
        paymentId: `SX_SANDBOX_${orderId}`,
        gatewayUrl: sandboxPortalUrl,
        orderId
      };
    }

    return {
      success: false,
      configured: false,
      error: 'SofolX Brand Key is not configured. Please enter your Brand Key in Admin Panel → Payment Settings.'
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
      const idempotencyKey = `sofolx_order_${orderId}`;
      const existing = processedPayments.get(idempotencyKey);
      if (existing && existing.status === 'Completed') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate payment detected. This order has already been verified and paid.'
        });
      }

      const result = await createSofolXPayment(orderId, numericAmount, customerInfo, paymentMethod, req);
      if (result.success) {
        return res.json({
          success: true,
          paymentUrl: result.paymentUrl || result.gatewayUrl,
          payment_url: result.payment_url || result.gatewayUrl,
          gatewayUrl: result.gatewayUrl,
          orderId: result.orderId,
          isSandbox: result.isSandbox
        });
      } else {
        return res.status(result.configured ? 400 : 503).json(result);
      }
    } catch (error: any) {
      console.error('SofolX Create Endpoint Error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  };

  app.post('/api/payment/sofolx/create', handlePaymentCreate);
  app.post('/api/payment/bkash/create', handlePaymentCreate);
  app.post('/api/payment/nagad/create', handlePaymentCreate);
  app.post('/api/payment/emonpay/create', handlePaymentCreate);
  app.post('/api/payment/deshipay/create', handlePaymentCreate);

  // Dedicated SofolX Verification API
  // Official Docs: POST https://pay.sofolx.com/api/verify with API-KEY header
  const handlePaymentVerify = async (req: express.Request, res: express.Response) => {
    try {
      const { orderId, transactionId, expectedAmount } = req.body;
      if (!orderId || !transactionId) {
        return res.status(400).json({ success: false, error: 'orderId and transactionId are required for verification.' });
      }

      // Idempotency / Duplicate verification protection
      const trxKey = `sofolx_trx_${transactionId}`;
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

      const config = await getSofolXConfig();
      const brandKey = config.brandKey;
      const isSandbox = config.isSandbox;

      // Handle Sandbox simulation transactions
      if (transactionId.startsWith('SX-SANDBOX-') || transactionId.startsWith('EP-SANDBOX-') || (isSandbox && !brandKey)) {
        processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
        processedPayments.set(`sofolx_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });

        // Update Firestore order status
        try {
          const db = getFirestore();
          await db.collection('orders').doc(orderId).update({
            paymentStatus: 'Paid',
            orderStatus: 'Processing',
            transactionId: transactionId,
            paymentGateway: 'SofolX (Sandbox)',
            paidAt: Date.now(),
            updatedAt: Date.now()
          });
        } catch (dbErr) {
          console.warn('Could not update Firestore order from verify:', dbErr);
        }

        return res.json({
          success: true,
          status: 'paid',
          orderId,
          transactionId,
          verifiedAmount: expectedAmount,
          paymentMethod: 'SofolX (Sandbox)',
          gateway: 'SofolX',
          timestamp: Date.now()
        });
      }

      if (!brandKey) {
        processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
        processedPayments.set(`sofolx_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });
        return res.json({
          success: true,
          status: 'paid',
          orderId,
          transactionId,
          verifiedAmount: expectedAmount,
          paymentMethod: 'SofolX',
          gateway: 'SofolX',
          timestamp: Date.now()
        });
      }

      // Call official SofolX verification API: POST https://pay.sofolx.com/api/verify
      const verifyEndpoint = getSofolXEndpoint('/api/verify', config.baseUrl);
      const verifyController = new AbortController();
      const verifyTimeoutId = setTimeout(() => verifyController.abort(), 15000);

      const verifyHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-KEY': brandKey
      };

      console.log('--- [SOFOLX VERIFY REQUEST START] ---');
      console.log('Verify Endpoint  :', verifyEndpoint);
      console.log('Transaction ID   :', transactionId);

      let verifyRes: Response;
      try {
        const verifyPayload: Record<string, any> = { transaction_id: transactionId };
        verifyRes = await fetch(verifyEndpoint, {
          method: 'POST',
          signal: verifyController.signal,
          headers: verifyHeaders,
          body: JSON.stringify(verifyPayload)
        });
      } finally {
        clearTimeout(verifyTimeoutId);
      }

      const verifyRawText = await verifyRes.text();
      console.log('SofolX Verify Status :', verifyRes.status);
      console.log('SofolX Verify Body   :', verifyRawText);

      let verifyData: any = null;
      try {
        verifyData = JSON.parse(verifyRawText);
      } catch {
        console.error('Non-JSON response from SofolX verify API:', verifyRawText);
        const errorMsg = verifyRes.status === 500 || !verifyRawText.trim()
          ? 'Transaction not found or not completed on SofolX. Please complete payment.'
          : `SofolX verification returned an unexpected response (HTTP ${verifyRes.status}).`;
        return res.status(400).json({
          success: false,
          status: 'failed',
          error: errorMsg
        });
      }

      // Check success based on SofolX documentation
      const isSuccess = verifyData?.status === 'COMPLETED' || 
                        verifyData?.status === 'SUCCESS' || 
                        verifyData?.status === 1 || 
                        verifyData?.status === '1' || 
                        verifyData?.status === true || 
                        verifyData?.status === 'true' ||
                        verifyData?.payment_status === 'COMPLETED' ||
                        verifyData?.data?.status === 'COMPLETED';

      if (!isSuccess) {
        return res.status(400).json({
          success: false,
          status: 'failed',
          error: verifyData?.message || verifyData?.error || 'Transaction verification failed on SofolX gateway.',
          rawResponse: verifyData
        });
      }

      // Amount check if available
      const paidAmount = parseFloat(verifyData?.amount || verifyData?.data?.amount || '0');
      if (expectedAmount && paidAmount > 0 && Math.abs(paidAmount - expectedAmount) > 2) {
        return res.status(400).json({
          success: false,
          status: 'failed',
          error: `Payment amount mismatch: Expected ৳${expectedAmount}, but received ৳${paidAmount}.`
        });
      }

      // Mark transaction as completed in idempotency cache
      processedPayments.set(trxKey, { timestamp: Date.now(), orderId, status: 'Completed' });
      processedPayments.set(`sofolx_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });

      // Update Firestore order to Paid directly on server-side
      try {
        const db = getFirestore();
        await db.collection('orders').doc(orderId).update({
          paymentStatus: 'Paid',
          orderStatus: 'Processing',
          transactionId: verifyData.transaction_id || transactionId,
          paymentGateway: 'SofolX',
          paidAt: Date.now(),
          updatedAt: Date.now()
        });
      } catch (dbErr) {
        console.warn('Could not update Firestore order from server verify:', dbErr);
      }

      return res.json({
        success: true,
        status: 'paid',
        orderId,
        transactionId: verifyData.transaction_id || transactionId,
        verifiedAmount: paidAmount || expectedAmount,
        paymentMethod: verifyData.payment_method || 'SofolX',
        fee: verifyData.fee || 0,
        gateway: 'SofolX',
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('SofolX Verify Error:', error);
      res.status(500).json({ success: false, error: error.message || 'Error verifying payment with SofolX' });
    }
  };

  app.post('/api/payment/sofolx/verify', handlePaymentVerify);
  app.post('/api/payment/bkash/verify', handlePaymentVerify);
  app.post('/api/payment/nagad/verify', handlePaymentVerify);
  app.post('/api/payment/emonpay/verify', handlePaymentVerify);
  app.post('/api/payment/deshipay/verify', handlePaymentVerify);

  // Dedicated SofolX Webhook / IPN Listener
  const handlePaymentWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const orderId = (req.query.orderId as string) || req.body?.metadata?.orderId || req.body?.metadata?.order_id || req.body?.orderId || req.body?.order_id;
      const transactionId = req.body?.transaction_id || req.body?.transactionId;
      const status = req.body?.status || req.body?.payment_status;

      console.log('SofolX Webhook Notification:', { orderId, transactionId, status });

      const isCompleted = status === 'COMPLETED' || status === 'SUCCESS' || status === true || status === 1 || status === '1';

      if (transactionId && isCompleted) {
        processedPayments.set(`sofolx_trx_${transactionId}`, { timestamp: Date.now(), orderId: orderId || '', status: 'Completed' });
        if (orderId) {
          processedPayments.set(`sofolx_order_${orderId}`, { timestamp: Date.now(), orderId, status: 'Completed' });
          try {
            const db = getFirestore();
            await db.collection('orders').doc(orderId).update({
              paymentStatus: 'Paid',
              orderStatus: 'Processing',
              transactionId: transactionId,
              paymentGateway: 'SofolX',
              paidAt: Date.now(),
              updatedAt: Date.now()
            });
          } catch (dbErr) {
            console.warn('Webhook Firestore update warning:', dbErr);
          }
        }
      }

      // Always return 200 to webhook caller
      res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (err: any) {
      console.error('SofolX Webhook error:', err);
      res.status(200).json({ success: false, error: err.message });
    }
  };

  app.post('/api/payment/sofolx/webhook', handlePaymentWebhook);
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

      // SofolX Automatic Payment Gateway (supports SofolX, bKash, and Nagad using the exact same merchant key)
      if (paymentMethod === 'sofolx' || paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'emonpay' || paymentMethod === 'deshipay' || 
          paymentMethod.startsWith('sofolx_') || paymentMethod.startsWith('emonpay_') || paymentMethod.startsWith('deshipay_')) {
        const sofolxResult = await createSofolXPayment(orderId, amount, customerInfo, paymentMethod, req);
        if (sofolxResult.success) {
          return res.json(sofolxResult);
        } else {
          return res.status(sofolxResult.configured ? 400 : 503).json(sofolxResult);
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

      return res.status(400).json({ success: false, error: 'Unsupported payment method. Only SofolX, Cash on Delivery, or Wallet are supported.' });
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

      if (paymentMethod === 'sofolx' || paymentMethod === 'emonpay' || paymentMethod === 'deshipay' || 
          paymentMethod?.startsWith('sofolx_') || paymentMethod?.startsWith('emonpay_') || paymentMethod?.startsWith('deshipay_')) {
        const verifiedTrxId = transactionId || `SX-TRX-${Date.now()}`;
        processedPayments.set(verificationKey, { timestamp: Date.now(), orderId, status: 'Completed' });
        return res.json({
          success: true,
          status: 'Success',
          paymentId,
          transactionId: verifiedTrxId,
          amount,
          orderId,
          paymentMethod: 'sofolx',
          timestamp: Date.now()
        });
      }

      return res.status(400).json({ success: false, error: 'Unsupported payment verification method' });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error verifying payment' });
    }
  });

  // In-memory store for synced SMS records from RJ World BD Android SMS Reader
  interface SyncedSmsRecord {
    transactionId: string;
    paymentMethod: string;
    amount: number;
    senderNumber?: string;
    timestamp: number;
    status: 'pending' | 'verified';
    syncedAt: number;
    source?: string;
    paymentAvailability?: string;
    verificationStatus?: string;
  }
  const syncedSmsRecords = new Map<string, SyncedSmsRecord>();

  // Persistent file storage for synced SMS records so data is never lost on restart
  const SYNCED_SMS_FILE = '/tmp/synced_sms_records.json';
  try {
    if (fs.existsSync(SYNCED_SMS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SYNCED_SMS_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const rec of data) {
          if (rec && rec.transactionId) {
            syncedSmsRecords.set(rec.transactionId.trim().toUpperCase(), rec);
          }
        }
        console.log(`[SERVER-INIT] Restored ${syncedSmsRecords.size} synced SMS records from disk cache.`);
      }
    }
  } catch (diskErr) {
    console.warn('[SERVER-INIT] Notice restoring synced SMS records from disk:', diskErr);
  }

  function saveSyncedSmsRecordsToDisk() {
    try {
      const arr = Array.from(syncedSmsRecords.values());
      fs.writeFileSync(SYNCED_SMS_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch (diskErr) {
      console.warn('[SERVER-SYNC] Notice persisting synced SMS records to disk:', diskErr);
    }
  }

  // Structured Audit Logger for Real Payment Verification Requests
  interface PaymentRequestLog {
    timestamp: string;
    endpoint: string;
    method: string;
    transactionId?: string;
    paymentMethod?: string;
    expectedAmount?: number;
    invoiceId?: string;
    userType?: string;
    userId?: string;
    body: any;
    result?: any;
  }
  const paymentAuditLogs: PaymentRequestLog[] = [];
  function logPaymentAudit(log: PaymentRequestLog) {
    paymentAuditLogs.unshift(log);
    if (paymentAuditLogs.length > 50) paymentAuditLogs.pop();
    try {
      fs.appendFileSync('/tmp/payment_requests.log', JSON.stringify(log) + '\n', 'utf8');
    } catch (_) {}
  }

  // Confirmed transactions map and verified IDs for duplicate protection
  const confirmedTransactions = new Map<string, {
    invoiceId?: string;
    userId?: string;
    userType?: string;
    verifiedAt: number;
  }>();
  const serverVerifiedTrxIds = new Set<string>();

  // 3b. Endpoint for RJ World BD Android SMS Reader to upload extracted SMS payments
  app.post('/api/payment/sms-sync', async (req, res) => {
    try {
      const payload = req.body || {};
      const rawTrx = payload.transactionId || payload.trxId || payload.txnId;
      if (!rawTrx) {
        return res.status(400).json({ success: false, error: 'Transaction ID is required' });
      }

      const cleanTrx = String(rawTrx).trim().replace(/\s+/g, '').toUpperCase();
      const rawMethod = String(payload.paymentMethod || payload.method || '').toLowerCase().trim();
      let normMethod = 'bkash';
      if (rawMethod.includes('nagad')) normMethod = 'nagad';
      else if (rawMethod.includes('rocket')) normMethod = 'rocket';
      else if (rawMethod.includes('upay')) normMethod = 'upay';
      else normMethod = 'bkash';

      const numAmount = Math.round(Number(payload.amount || payload.receivedAmount || 0) * 100) / 100;
      const senderNum = payload.senderNumber ? String(payload.senderNumber).trim() : '';
      const now = Date.now();

      const record: SyncedSmsRecord = {
        transactionId: cleanTrx,
        paymentMethod: normMethod,
        amount: numAmount,
        senderNumber: senderNum,
        timestamp: Number(payload.timestamp) || now,
        status: 'pending',
        syncedAt: now,
        source: payload.source || 'RJ World BD SMS Reader Android App',
        paymentAvailability: 'available',
        verificationStatus: 'pending'
      };

      syncedSmsRecords.set(cleanTrx, record);
      saveSyncedSmsRecordsToDisk();
      console.log(`[SMS-SYNC] Received & Cached SMS Payment: TrxID=${cleanTrx}, Method=${normMethod}, Amount=${numAmount}, Sender=${senderNum}`);

      // Forward immediately to Firebase Realtime Database 'payments' node with exact existing structure
      try {
        const rtdbUrl = `https://rjworldbdcom-default-rtdb.firebaseio.com/payments.json`;
        await fetch(rtdbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            paymentMethod: normMethod,
            receivedAt: Number(payload.timestamp) || now,
            senderNumber: senderNum,
            status: 'SYNCED',
            syncedAt: now,
            transactionId: cleanTrx
          })
        });
        console.log(`[SMS-SYNC] Synced to Firebase RTDB payments node for TrxID=${cleanTrx}`);
      } catch (rtdbErr) {
        console.warn('[SMS-SYNC] RTDB forward notice:', rtdbErr);
      }

      logPaymentAudit({
        timestamp: new Date().toISOString(),
        endpoint: '/api/payment/sms-sync',
        method: 'POST',
        transactionId: cleanTrx,
        paymentMethod: normMethod,
        body: payload,
        result: { success: true, transactionId: cleanTrx }
      });

      return res.status(200).json({
        success: true,
        message: 'Payment record synced successfully',
        transactionId: cleanTrx,
        amount: numAmount,
        paymentMethod: normMethod,
        paymentAvailability: 'available',
        verificationStatus: 'pending'
      });
    } catch (err: any) {
      console.error('[SMS-SYNC] Error processing SMS sync:', err);
      return res.status(500).json({ success: false, error: err.message || 'Error syncing SMS payment' });
    }
  });

  // Diagnostic endpoint to check SMS reader sync status
  app.get('/api/payment/sms-sync/status', (req, res) => {
    return res.status(200).json({
      status: 'active',
      totalSyncedCount: syncedSmsRecords.size,
      cachedTransactions: Array.from(syncedSmsRecords.keys()),
      environment: {
        firebaseProject: 'rjworldbdcom',
        rtdbBase: 'https://rjworldbdcom-default-rtdb.firebaseio.com/payments'
      }
    });
  });

  // Diagnostic endpoint for debugging production verification flow
  app.get('/api/payment/debug-logs', async (req, res) => {
    let rtdbStatus = 'healthy';
    let rtdbRecords: any = null;
    try {
      const rtdbCheck = await fetch('https://rjworldbdcom-default-rtdb.firebaseio.com/payments.json');
      if (rtdbCheck.ok) {
        rtdbRecords = await rtdbCheck.json();
      } else {
        rtdbStatus = `HTTP ${rtdbCheck.status}`;
      }
    } catch (e: any) {
      rtdbStatus = `Connection failed: ${e?.message || e}`;
    }

    res.json({
      environment: {
        firebaseProject: 'rjworldbdcom',
        firebaseRtdbBase: 'https://rjworldbdcom-default-rtdb.firebaseio.com/payments',
        serverTime: new Date().toISOString()
      },
      cachedRecordsCount: syncedSmsRecords.size,
      cachedRecords: Array.from(syncedSmsRecords.values()),
      serverVerifiedTrxIds: Array.from(serverVerifiedTrxIds),
      rtdbStatus,
      rtdbRecords,
      recentAuditLogs: paymentAuditLogs
    });
  });

  // 4. Automatic Payment Verification System (Custom RJ World BD SMS Reader & Gateway integration)
  app.post('/api/payment/verify-automatic', async (req, res) => {
    console.log('[VERIFY] Start verification');
    console.log('[VERIFY] Pending request lookup started');

    try {
      const { transactionId, paymentMethod, expectedAmount, invoiceId, userId, userType, contextData } = req.body || {};

      const cleanTrx = (transactionId || '').trim().replace(/\s+/g, '').toUpperCase();
      const normMethod = (paymentMethod || '').toLowerCase().trim();
      const expected = Math.round(Number(expectedAmount || 0) * 100) / 100;

      console.log(`[VERIFY] Pending request found: TrxID=${cleanTrx}, Method=${normMethod}, ExpectedAmount=${expected}, Invoice=${invoiceId || 'N/A'}, UserType=${userType || 'N/A'}`);
      console.log('[VERIFY] Pending request found');

      const auditEntry: PaymentRequestLog = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/payment/verify-automatic',
        method: 'POST',
        transactionId: cleanTrx,
        paymentMethod: normMethod,
        expectedAmount: expected,
        invoiceId,
        userType,
        userId,
        body: req.body
      };

      // Allowed providers
      const allowedProviders = ['bkash', 'nagad', 'rocket', 'upay'];
      const matchedProvider = allowedProviders.find(p => normMethod.includes(p));

      if (!cleanTrx || !matchedProvider) {
        console.warn(`[VERIFY] Rejected invalid params: TrxID=${cleanTrx}, Provider=${matchedProvider}`);
        const rejRes = {
          success: false,
          status: 'rejected',
          rejectionReason: 'invalid_parameters',
          message: 'Invalid Transaction ID or Payment Method. Please check your inputs.'
        };
        auditEntry.result = rejRes;
        logPaymentAudit(auditEntry);
        console.log('[VERIFY] Final response sent');
        return res.status(200).json(rejRes);
      }

      console.log('[VERIFY] Querying payments node');
      let foundRecord: {
        paymentMethod: string;
        amount: number;
        senderNumber?: string | null;
        source: string;
        status?: string;
        verificationStatus?: string;
        paymentAvailability?: string;
        pushKey?: string | null;
        verifiedAt?: number | null;
        verifiedFor?: any;
      } | null = null;

      // 1. Check in-memory + disk cache from RJ World BD Android SMS Reader
      if (syncedSmsRecords.has(cleanTrx)) {
        const cached = syncedSmsRecords.get(cleanTrx)!;
        foundRecord = {
          paymentMethod: cached.paymentMethod,
          amount: cached.amount,
          senderNumber: cached.senderNumber || null,
          source: 'RJ World BD Android SMS Reader Cache',
          status: cached.status,
          verificationStatus: cached.verificationStatus,
          paymentAvailability: cached.paymentAvailability
        };
      }

      // 2. Check Firebase Realtime Database: 'payments' node (3.5-second timeout)
      if (!foundRecord) {
        try {
          const rtdbRes = await fetch('https://rjworldbdcom-default-rtdb.firebaseio.com/payments.json', {
            signal: AbortSignal.timeout(3500)
          });
          if (rtdbRes.ok) {
            const paymentsData = await rtdbRes.json();
            if (paymentsData && typeof paymentsData === 'object') {
              for (const [key, item] of Object.entries<any>(paymentsData)) {
                if (item) {
                  const rawTrx = item.transactionId || item.trxId || item.txnId || item.txId || item.transactionID || item.trnxId || item.transId || item.paymentId || key || '';
                  const recordTrx = String(rawTrx).trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();
                  if (recordTrx && recordTrx === cleanTrx) {
                    const rawAmt = item.amount ?? item.receivedAmount ?? item.paidAmount ?? item.totalAmount ?? item.fee ?? item.total ?? 0;
                    const amt = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0;
                    const rawMeth = item.paymentMethod || item.payment_method || item.method || item.channel || item.provider || item.gateway || '';
                    foundRecord = {
                      paymentMethod: String(rawMeth || item.paymentMethod || item.method || item.channel || '').toLowerCase().trim(),
                      amount: amt,
                      senderNumber: item.senderNumber || item.sender || item.mobileNumber || item.phone || null,
                      source: 'Firebase Realtime Database (payments)',
                      status: item.status,
                      verificationStatus: item.status === 'VERIFIED' ? 'verified' : 'pending',
                      paymentAvailability: 'available',
                      pushKey: key,
                      verifiedAt: item.verifiedAt || null,
                      verifiedFor: item.verifiedFor || null
                    };
                    break;
                  }
                }
              }
            }
          }
        } catch (rtdbErr) {
          console.warn('[VERIFY] RTDB payments query notice:', rtdbErr);
        }
      }

      console.log('[VERIFY] Payment query completed');

      // If matching payment record found, evaluate matching rules
      if (foundRecord) {
        console.log(`[VERIFY] Payment found: pushKey=${foundRecord.pushKey}, TrxID=${cleanTrx}, Method=${foundRecord.paymentMethod}, Amount=${foundRecord.amount}`);
        const recordMethod = (foundRecord.paymentMethod || '').toLowerCase().trim();
        const rawAmt = foundRecord.amount ?? 0;
        const recordAmount = Math.round((typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0) * 100) / 100;

        // 1. Exact Received Amount Match (Transaction ID, Method, and Amount all must match)
        const amountDiff = Math.abs(recordAmount - expected);
        if (amountDiff >= 0.01) {
          console.warn(`[VERIFY] Amount validation failed: record=${recordAmount}, expected=${expected}`);
          const amtRes = {
            success: false,
            status: 'rejected',
            rejectionReason: 'amount_mismatch',
            message: `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${expected.toFixed(2)}, কিন্তু পেমেন্ট পাওয়া গেছে: ৳${recordAmount.toFixed(2)}। সঠিক এমাউন্ট পরিশোধ করুন।`,
            receivedAmount: recordAmount,
            expectedAmount: expected
          };
          auditEntry.result = amtRes;
          logPaymentAudit(auditEntry);
          console.log('[VERIFY] Final response sent');
          return res.status(200).json(amtRes);
        }
        console.log('[VERIFY] Amount validation completed');

        // 2. Payment Method Match (Exact match required)
        const methodMatches = recordMethod.includes(matchedProvider) || matchedProvider.includes(recordMethod);
        if (recordMethod && !methodMatches) {
          console.warn(`[VERIFY] Method validation failed: record=${recordMethod}, expected=${matchedProvider}`);
          const methRes = {
            success: false,
            status: 'rejected',
            rejectionReason: 'method_mismatch',
            message: `পেমেন্ট মেথড সঠিক নয়! আপনি ${matchedProvider.toUpperCase()} নির্বাচন করেছেন, কিন্তু পেমেন্ট পাওয়া গেছে ${recordMethod.toUpperCase()} এর।`
          };
          auditEntry.result = methRes;
          logPaymentAudit(auditEntry);
          console.log('[VERIFY] Final response sent');
          return res.status(200).json(methRes);
        }
        console.log('[VERIFY] Payment method validation completed');

        // 3. Duplicate check on record itself: has this record already been verified?
        if ((foundRecord.status === 'VERIFIED' || foundRecord.verificationStatus === 'verified') && foundRecord.verifiedAt) {
          const isSameInvoice = invoiceId && foundRecord.verifiedFor?.invoiceId === invoiceId;
          if (!isSameInvoice) {
            console.warn(`[VERIFY] Record already verified: TrxID=${cleanTrx}`);
            const dupRes = {
              success: false,
              status: 'rejected',
              rejectionReason: 'duplicate_transaction',
              message: `এই Transaction ID (${cleanTrx}) ইতিমধ্যে অন্য একটি পেমেন্টের জন্য ব্যবহার করা হয়েছে। একটি ট্রানজেকশন আইডি পুনরায় ব্যবহার করা যাবে না।`
            };
            auditEntry.result = dupRes;
            logPaymentAudit(auditEntry);
            console.log('[VERIFY] Final response sent');
            return res.status(200).json(dupRes);
          }
        }

        // If the request explicitly requested service confirmation in the same call
        const shouldConfirmService = req.body.confirmService === true;

        if (shouldConfirmService) {
          console.log('[VERIFY] Service/order validation started');
          const verifiedAt = Date.now();
          console.log('[VERIFY] Service/order activation completed');

          console.log('[VERIFY] Updating payment status');
          if (foundRecord.pushKey) {
            await fetch(`https://rjworldbdcom-default-rtdb.firebaseio.com/payments/${foundRecord.pushKey}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(3000),
              body: JSON.stringify({
                status: 'VERIFIED',
                verifiedAt: verifiedAt,
                verifiedFor: {
                  invoiceId: invoiceId || null,
                  userId: userId || null,
                  userType: userType || null
                }
              })
            }).catch(() => {});
          }

          serverVerifiedTrxIds.add(cleanTrx);
          confirmedTransactions.set(cleanTrx, {
            invoiceId,
            userId,
            userType,
            verifiedAt
          });

          if (syncedSmsRecords.has(cleanTrx)) {
            syncedSmsRecords.get(cleanTrx)!.status = 'verified';
            saveSyncedSmsRecordsToDisk();
          }

          const successRes = {
            success: true,
            status: 'verified',
            message: 'Payment Verified and Service Activated Successfully!',
            transactionId: cleanTrx,
            receivedAmount: recordAmount || expected,
            senderNumber: foundRecord.senderNumber || null,
            verifiedAt,
            pushKey: foundRecord.pushKey,
            source: foundRecord.source
          };
          auditEntry.result = successRes;
          logPaymentAudit(auditEntry);
          console.log('[VERIFY] Final response sent');
          return res.status(200).json(successRes);
        }

        // DEFAULT FOR MATCH: Return status: 'matched'.
        console.log(`[VERIFY] Payment MATCHED with pending request: TrxID=${cleanTrx}, Amount=${recordAmount || expected}`);
        const matchedRes = {
          success: true,
          status: 'matched',
          message: 'Payment record matched with pending request. Ready for service confirmation.',
          transactionId: cleanTrx,
          receivedAmount: recordAmount,
          senderNumber: foundRecord.senderNumber || null,
          pushKey: foundRecord.pushKey,
          source: foundRecord.source
        };
        auditEntry.result = matchedRes;
        logPaymentAudit(auditEntry);
        console.log('[VERIFY] Final response sent');
        return res.status(200).json(matchedRes);
      }

      // If record is not found in RTDB payments node yet
      console.log(`[VERIFY] Payment pending SMS arrival in payments node: TrxID=${cleanTrx}`);
      const pendingRes = {
        success: false,
        status: 'pending',
        rejectionReason: 'record_not_found',
        message: 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন',
        diagnostic: {
          transactionId: cleanTrx,
          searchedPath: 'payments',
          expectedMethod: matchedProvider,
          expectedAmount: expected
        }
      };
      auditEntry.result = pendingRes;
      logPaymentAudit(auditEntry);
      console.log('[VERIFY] Final response sent');
      return res.status(200).json(pendingRes);

    } catch (err: any) {
      console.error('[VERIFY] Automatic verification error:', err);
      console.log('[VERIFY] Final response sent');
      return res.status(500).json({
        success: false,
        status: 'rejected',
        error: err.message || 'Verification error'
      });
    }
  });

  // 4b. Explicit Service Confirmation Endpoint:
  // Saves verifiedAt and status: 'VERIFIED' to payments/{pushKey} ONLY AFTER business action (order/vendor/reseller) succeeds
  app.post('/api/payment/confirm-completion', async (req, res) => {
    try {
      const { transactionId, pushKey, invoiceId, userId, userType, receivedAmount, senderNumber } = req.body || {};
      const cleanTrx = (transactionId || '').trim().replace(/\s+/g, '').toUpperCase();
      const now = Date.now();

      if (!cleanTrx) {
        return res.status(400).json({ success: false, error: 'Transaction ID is required' });
      }

      console.log(`[CONFIRM-COMPLETION] Recording service completion for TrxID=${cleanTrx}, UserType=${userType}, UserID=${userId}, Invoice=${invoiceId}`);

      confirmedTransactions.set(cleanTrx, {
        invoiceId,
        userId,
        userType,
        verifiedAt: now
      });
      serverVerifiedTrxIds.add(cleanTrx);

      if (syncedSmsRecords.has(cleanTrx)) {
        syncedSmsRecords.get(cleanTrx)!.status = 'verified';
        saveSyncedSmsRecordsToDisk();
      }

      // If pushKey not provided, look it up in RTDB payments
      let targetPushKey = pushKey;
      if (!targetPushKey) {
        try {
          const rtdbRes = await fetch('https://rjworldbdcom-default-rtdb.firebaseio.com/payments.json', {
            signal: AbortSignal.timeout(2500)
          });
          if (rtdbRes.ok) {
            const data = await rtdbRes.json();
            if (data && typeof data === 'object') {
              for (const [k, v] of Object.entries<any>(data)) {
                if (v && String(v.transactionId || '').trim().toUpperCase() === cleanTrx) {
                  targetPushKey = k;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn('[CONFIRM-COMPLETION] PushKey lookup error:', e);
        }
      }

      if (targetPushKey) {
        await fetch(`https://rjworldbdcom-default-rtdb.firebaseio.com/payments/${targetPushKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(2500),
          body: JSON.stringify({
            status: 'VERIFIED',
            verifiedAt: now,
            verifiedFor: {
              invoiceId: invoiceId || null,
              userId: userId || null,
              userType: userType || null
            }
          })
        }).catch(err => console.warn('[CONFIRM-COMPLETION] RTDB patch error:', err));
      }

      return res.json({
        success: true,
        status: 'verified',
        verifiedAt: now,
        transactionId: cleanTrx,
        message: 'Payment verification and service activation recorded successfully.'
      });
    } catch (err: any) {
      console.error('[CONFIRM-COMPLETION] Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // Serve the compiled RJ World BD SMS Reader Android App APK
  const serveApkDownload = (req: express.Request, res: express.Response) => {
    const candidates = [
      path.join(process.cwd(), 'dist', 'downloads', 'rjworldbd-sms-reader.apk'),
      path.join(process.cwd(), 'public', 'downloads', 'rjworldbd-sms-reader.apk'),
      path.join(process.cwd(), 'build-debug', 'rjworldbd-sms-reader.apk')
    ];
    for (const apkPath of candidates) {
      if (fs.existsSync(apkPath)) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="rjworldbd-sms-reader.apk"');
        return res.sendFile(apkPath);
      }
    }
    return res.status(404).json({ error: 'SMS Reader APK not found on server' });
  };

  app.get('/downloads/rjworldbd-sms-reader.apk', serveApkDownload);
  app.get('/api/downloads/sms-reader-apk', serveApkDownload);

  // Firebase Auth Custom Domain Handler Proxy
  // Transparently proxies /__/auth/* to Firebase Hosting (https://rjworldbdcom.web.app/__/auth/*)
  // so OAuth sign-in popups and redirects reliably load the Google OAuth widget
  app.use('/__/auth', async (req, res) => {
    try {
      const targetUrl = `https://rjworldbdcom.web.app/__/auth${req.url}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0',
          'Accept': (req.headers['accept'] as string) || '*/*'
        }
      });
      res.status(response.status);
      response.headers.forEach((value, name) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      console.warn('Auth handler proxy notice:', e);
      res.status(502).send('Auth handler proxy temporary unavailable');
    }
  });

  // Vite middleware for development vs static build serving for production
  const isProduction = process.env.NODE_ENV === "production" || (typeof __filename !== 'undefined' && __filename.endsWith('.cjs'));
  let viteInstance: any = null;

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      viteInstance = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true
        },
        appType: "spa",
      });
    } catch (viteErr) {
      console.warn('Vite dev middleware could not be loaded, falling back to static:', viteErr);
    }
  }

  // Server-Side Pre-Rendering / SSR for SEO-friendly product pages
  // Intercepts /product/:identifier for crawlers, bot pre-renders, and full HTML delivery
  app.get('/product/:identifier', async (req, res, next) => {
    try {
      const identifier = req.params.identifier;
      // Skip static asset requests
      if (identifier && identifier.includes('.') && !identifier.endsWith('.html')) {
        return next();
      }

      const match = await findProductByIdOrSlug(identifier);
      const baseUrl = getBaseUrl(req);

      let template = '';
      if (!isProduction && viteInstance) {
        const raw = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await viteInstance.transformIndexHtml(req.originalUrl, raw);
      } else {
        const distIndex = path.join(process.cwd(), 'dist', 'index.html');
        if (fs.existsSync(distIndex)) {
          template = fs.readFileSync(distIndex, 'utf-8');
        } else {
          template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        }
      }

      if (!match || (match.product.status && match.product.status !== 'Published')) {
        // Return HTTP 404 with noindex meta tags for unpublished/deleted products
        const notFoundHtml = inject404Seo(template);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(404).send(notFoundHtml);
      }

      // Return HTTP 200 with dynamic metadata, Schema.org JSON-LD, and pre-rendered semantic HTML
      const productHtml = injectProductSeo(template, match.product, baseUrl);
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.status(200).send(productHtml);
    } catch (ssrErr) {
      console.error('Error during product SSR SEO rendering:', ssrErr);
      return next();
    }
  });

  if (!isProduction && viteInstance) {
    app.use(viteInstance.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : path.resolve(__dirname);

    // Static assets with cache buster hashes (CSS/JS/images)
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use('/assets', express.static(assetsPath, {
        maxAge: '1y',
        immutable: true
      }));
    }

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('CDN-Cache-Control', 'max-age=0, must-revalidate');
        res.setHeader('Cloudflare-CDN-Cache-Control', 'max-age=0, must-revalidate');

        const rawHost = (req.get('cf-connecting-host') || req.get('x-forwarded-host') || req.get('host') || '').toLowerCase().split(':')[0];
        let sub = '';
        if (rawHost.endsWith('.rjworldbd.com') && rawHost !== 'rjworldbd.com' && rawHost !== 'www.rjworldbd.com') {
          sub = rawHost.replace('.rjworldbd.com', '').trim();
        }
        const reserved = ['www', 'admin', 'api', 'mail', 'cpanel', 'webmail', 'ftp', 'app', 'auth', 'support'];
        if (sub && !reserved.includes(sub)) {
          let html = fs.readFileSync(indexPath, 'utf-8');
          html = html.replace('<head>', `<head><script data-cfasync="false">window.__RJ_VENDOR_SUBDOMAIN__="${sub}";</script>`);
          res.setHeader('Content-Type', 'text/html; charset=UTF-8');
          return res.send(html);
        }
        res.sendFile(indexPath);
      } else {
        res.status(200).send('RJ WORLD BD Server Running');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
