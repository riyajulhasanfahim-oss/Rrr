package com.rjworldbd.smsreader.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Robust parser for Bangladeshi Mobile Financial Services (MFS) SMS.
 * Strictly supports: bKash (16247), Nagad (16167), Rocket (16216), Upay (16268).
 * Never stores or transmits raw SMS message body.
 */
public class PaymentSmsParser {

    public static class ParsedPayment {
        public final String paymentMethod;
        public final String transactionId;
        public final double amount;
        public final String senderNumber;
        public final long timestamp;

        public ParsedPayment(String paymentMethod, String transactionId, double amount, String senderNumber, long timestamp) {
            this.paymentMethod = paymentMethod;
            this.transactionId = transactionId;
            this.amount = amount;
            this.senderNumber = senderNumber;
            this.timestamp = timestamp;
        }
    }

    private static final Pattern TRX_PATTERN = Pattern.compile(
        "(?:TrxID|TxnID|TxnId|Trx\\s*Id|Txn\\s*Id|TRXID|Transaction\\s*(?:Id|ID|Hash)|Txn|Trx)\\s*(?:is|:|=|-|\\.)?\\s*([A-Za-z0-9]{6,30})",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern AMOUNT_PATTERN_1 = Pattern.compile(
        "(?:received|Cash\\s*In|credited|deposit\\s*of|paid|Amount[:]?)\\s*(?:of\\s*)?(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern AMOUNT_PATTERN_2 = Pattern.compile(
        "(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:credited|received|deposit|Cash\\s*In)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern AMOUNT_PATTERN_3 = Pattern.compile(
        "(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SENDER_PATTERN = Pattern.compile(
        "(?:from\\s*(?:A/C\\s*:\\s*)?|sender\\s*:\\s*|from\\s+A/C\\s+)([0-9\\-+]{11,18})",
        Pattern.CASE_INSENSITIVE
    );

    public static String identifyProvider(String sender, String body) {
        if (sender == null || body == null) return null;
        String s = sender.trim().toLowerCase();
        String b = body.toLowerCase();

        // 1. bKash (16247, bKash)
        if (s.contains("bkash") || s.equals("16247") || (b.contains("bkash") && (b.contains("trxid") || b.contains("trx id")))) {
            return "bkash";
        }
        // 2. Nagad (16167, Nagad)
        if (s.contains("nagad") || s.equals("16167") || (b.contains("nagad") && (b.contains("txnid") || b.contains("txn id")))) {
            return "nagad";
        }
        // 3. Rocket / DBBL (16216, Rocket, DBBL)
        if (s.contains("rocket") || s.equals("16216") || s.contains("dbbl") || (b.contains("rocket") && (b.contains("txnid") || b.contains("trxid")))) {
            return "rocket";
        }
        // 4. Upay / UCB (16268, upay, UCB)
        if (s.contains("upay") || s.equals("16268") || s.contains("ucb") || (b.contains("upay") && (b.contains("trxid") || b.contains("txnid")))) {
            return "upay";
        }
        return null;
    }

    public static String extractTransactionId(String body) {
        if (body == null) return null;
        Matcher matcher = TRX_PATTERN.matcher(body);
        if (matcher.find()) {
            String trx = matcher.group(1);
            if (trx != null) {
                trx = trx.trim().toUpperCase();
                if (trx.length() >= 6 && !trx.equals("SUCCESS") && !trx.equals("FAILED") && !trx.equals("SUCCESSFUL") && !trx.equals("PENDING")) {
                    return trx;
                }
            }
        }
        return null;
    }

    public static Double extractAmount(String body) {
        if (body == null) return null;
        Matcher m1 = AMOUNT_PATTERN_1.matcher(body);
        if (m1.find()) {
            try {
                String raw = m1.group(1).replace(",", "");
                double val = Double.parseDouble(raw);
                if (val > 0) return val;
            } catch (Exception ignored) {}
        }
        Matcher m2 = AMOUNT_PATTERN_2.matcher(body);
        if (m2.find()) {
            try {
                String raw = m2.group(1).replace(",", "");
                double val = Double.parseDouble(raw);
                if (val > 0) return val;
            } catch (Exception ignored) {}
        }
        Matcher m3 = AMOUNT_PATTERN_3.matcher(body);
        if (m3.find()) {
            try {
                String raw = m3.group(1).replace(",", "");
                double val = Double.parseDouble(raw);
                if (val > 0) return val;
            } catch (Exception ignored) {}
        }
        return null;
    }

    public static String extractSenderNumber(String body) {
        if (body == null) return null;
        Matcher matcher = SENDER_PATTERN.matcher(body);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    public static ParsedPayment parse(String sender, String body, long timestamp) {
        String provider = identifyProvider(sender, body);
        if (provider == null) return null;
        String trxId = extractTransactionId(body);
        if (trxId == null) return null;
        Double amount = extractAmount(body);
        if (amount == null) return null;
        String senderNumber = extractSenderNumber(body);
        return new ParsedPayment(provider, trxId, amount, senderNumber, timestamp);
    }
}
