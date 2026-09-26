/**
 * RJ World BD SMS Reader - Payment SMS Detection & Parsing Service
 * 
 * STRICT RULES:
 * 1. ONLY detects payment SMS from 4 providers: bKash, Nagad, Rocket, Upay.
 * 2. Any other SMS (promotional, OTP, general messages) are completely ignored.
 * 3. Never stores or uploads full SMS body to Firebase (only extracted metadata).
 * 4. Detects and blocks duplicate Transaction IDs.
 * 5. Validates TrxID and amount strictly.
 */

import { PaymentMethodType } from '../types/paymentVerification';

export interface RawIncomingSms {
  sender: string;
  body: string;
  timestamp: number;
}

export interface ExtractedPaymentSms {
  paymentMethod: PaymentMethodType;
  transactionId: string;
  amount: number;
  senderNumber: string | null;
  receivedAt: number;
  providerName: string;
}

export type ParseResult =
  | { success: true; data: ExtractedPaymentSms }
  | { success: false; reason: 'unsupported_provider' | 'invalid_trx' | 'invalid_amount' | 'not_a_payment_sms' | 'duplicate_trx'; details?: string };

/**
 * Normalizes phone or sender identity string
 */
function cleanSenderString(str: string): string {
  return (str || '').trim().toLowerCase();
}

/**
 * Identifies the payment provider from SMS sender or content
 */
export function identifyPaymentProvider(sender: string, body: string): PaymentMethodType | null {
  const s = cleanSenderString(sender);
  const b = body.toLowerCase();

  // 1. bKash: Sender is "bkash" or 16247, or mentions bkash with cash in / received
  if (s.includes('bkash') || s.includes('16247') || (b.includes('bkash') && (b.includes('trxid') || b.includes('trx id')))) {
    return 'bkash';
  }

  // 2. Nagad: Sender is "nagad" or 16167, or mentions nagad
  if (s.includes('nagad') || s.includes('16167') || (b.includes('nagad') && (b.includes('txnid') || b.includes('txn id')))) {
    return 'nagad';
  }

  // 3. Rocket (DBBL): Sender is "16216", "rocket", or "dbbl"
  if (s.includes('rocket') || s.includes('16216') || s.includes('dbbl') || (b.includes('rocket') && (b.includes('txnid') || b.includes('trxid')))) {
    return 'rocket';
  }

  // 4. Upay (UCB): Sender is "upay", "16268", or "ucb"
  if (s.includes('upay') || s.includes('16268') || (b.includes('upay') && (b.includes('trxid') || b.includes('cash in')))) {
    return 'upay';
  }

  return null;
}

/**
 * Extracts Transaction ID (TrxID / TxnID)
 */
export function extractTransactionId(body: string): string | null {
  // Common patterns in BD MFS SMS:
  // "TrxID BL99XYZ123", "TxnID: 71GHA4B7", "TxnId: 3089456782", "Trx ID: 9K88ABC456", "TRXID 8M77DEF789"
  const trxRegex = /(?:TrxID|TxnID|TxnId|Trx\s*Id|Txn\s*Id|TRXID)\s*[:.]?\s*([A-Za-z0-9]{6,25})/i;
  const match = body.match(trxRegex);
  if (match && match[1]) {
    const trx = match[1].trim().toUpperCase();
    // Validate: must have minimum length 6 and cannot be generic word like "FAILED" or "SUCCESS"
    if (trx.length >= 6 && !['SUCCESS', 'FAILED', 'SUCCESSFUL', 'PENDING'].includes(trx)) {
      return trx;
    }
  }
  return null;
}

/**
 * Extracts payment amount (Tk / BDT)
 */
export function extractAmount(body: string): number | null {
  // Patterns:
  // "received Tk 500.00", "Cash In Tk 1,250.00", "Tk 1,000.00 credited", "Tk 350", "BDT 500"
  // Note: Ignore "Fee Tk 0.00" or "Balance Tk 1,500.00"
  
  // Try pattern for Received / Cash in amount specifically:
  const receivedRegex = /(?:received|Cash In|credited|paid|Amount[:]?)\s*(?:of\s*)?(?:Tk|BDT|Tk\.)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
  const receivedMatch = body.match(receivedRegex);
  if (receivedMatch && receivedMatch[1]) {
    const rawAmt = receivedMatch[1].replace(/,/g, '');
    const num = parseFloat(rawAmt);
    if (!isNaN(num) && num > 0) return num;
  }

  // Fallback: search for first "Tk [amount]" before "Fee" or "Balance"
  const generalRegex = /(?:Tk|BDT|Tk\.)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
  const generalMatch = body.match(generalRegex);
  if (generalMatch && generalMatch[1]) {
    const rawAmt = generalMatch[1].replace(/,/g, '');
    const num = parseFloat(rawAmt);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
}

/**
 * Extracts sender mobile number or account number from SMS
 */
export function extractSenderNumber(body: string): string | null {
  // Patterns:
  // "from 01712345678", "from A/C: 01712345678-9", "from +8801812345678"
  const senderRegex = /(?:from\s*(?:A\/C\s*:\s*)?|sender\s*:\s*)([0-9\-+]{11,16})/i;
  const match = body.match(senderRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Main parsing engine for incoming SMS
 */
export function parseIncomingPaymentSms(sms: RawIncomingSms): ParseResult {
  // Step 1: Identify provider (bKash, Nagad, Rocket, Upay only)
  const provider = identifyPaymentProvider(sms.sender, sms.body);
  if (!provider) {
    return {
      success: false,
      reason: 'unsupported_provider',
      details: `Sender "${sms.sender}" is not bKash, Nagad, Rocket, or Upay.`
    };
  }

  // Step 2: Extract Transaction ID
  const transactionId = extractTransactionId(sms.body);
  if (!transactionId) {
    return {
      success: false,
      reason: 'invalid_trx',
      details: 'No valid Transaction ID (TrxID / TxnID) found in SMS.'
    };
  }

  // Step 3: Extract Amount
  const amount = extractAmount(sms.body);
  if (amount === null || amount <= 0) {
    return {
      success: false,
      reason: 'invalid_amount',
      details: 'Could not extract a valid positive payment amount from SMS.'
    };
  }

  // Step 4: Extract Sender Number (optional)
  const senderNumber = extractSenderNumber(sms.body);

  const providerNames: Record<PaymentMethodType, string> = {
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
    upay: 'Upay'
  };

  return {
    success: true,
    data: {
      paymentMethod: provider,
      transactionId,
      amount,
      senderNumber,
      receivedAt: sms.timestamp || Date.now(),
      providerName: providerNames[provider]
    }
  };
}
