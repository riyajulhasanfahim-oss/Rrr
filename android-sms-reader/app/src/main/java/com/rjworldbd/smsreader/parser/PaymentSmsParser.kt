package com.rjworldbd.smsreader.parser

import java.util.regex.Pattern

data class ParsedPayment(
    val paymentMethod: String, // "bkash", "nagad", "rocket", "upay"
    val transactionId: String,
    val amount: Double,
    val senderNumber: String?,
    val timestamp: Long
)

object PaymentSmsParser {

    /**
     * Strictly identifies supported MFS provider (bKash, Nagad, Rocket, Upay).
     * Returns null for ANY other SMS (OTP, promotional, personal, banking non-MFS).
     */
    fun identifyProvider(sender: String, body: String): String? {
        val s = sender.trim().lowercase()
        val b = body.lowercase()

        // 1. bKash (Official shortcodes: 16247, bKash)
        if (s.contains("bkash") || s == "16247" || (b.contains("bkash") && (b.contains("trxid") || b.contains("trx id")))) {
            return "bkash"
        }

        // 2. Nagad (Official shortcodes: 16167, Nagad)
        if (s.contains("nagad") || s == "16167" || (b.contains("nagad") && (b.contains("txnid") || b.contains("txn id")))) {
            return "nagad"
        }

        // 3. Rocket (DBBL) (Official shortcodes: 16216, Rocket, DBBL)
        if (s.contains("rocket") || s == "16216" || s.contains("dbbl") || (b.contains("rocket") && (b.contains("txnid") || b.contains("trxid")))) {
            return "rocket"
        }

        // 4. Upay (UCB) (Official shortcodes: 16268, upay, UCB)
        if (s.contains("upay") || s == "16268" || s.contains("ucb") || (b.contains("upay") && (b.contains("trxid") || b.contains("txnid")))) {
            return "upay"
        }

        // Strictly reject any other SMS
        return null
    }

    /**
     * Extracts Transaction ID from SMS body
     */
    fun extractTransactionId(body: String): String? {
        val pattern = Pattern.compile(
            "(?:TrxID|TxnID|TxnId|Trx\\s*Id|Txn\\s*Id|TRXID|Transaction\\s*ID|Txn)\\s*[:.]?\\s*([A-Za-z0-9]{6,25})",
            Pattern.CASE_INSENSITIVE
        )
        val matcher = pattern.matcher(body)
        if (matcher.find()) {
            val trx = matcher.group(1)?.trim()?.uppercase()
            if (!trx.isNullOrEmpty() && trx.length >= 6 && trx !in listOf("SUCCESS", "FAILED", "SUCCESSFUL", "PENDING")) {
                return trx
            }
        }
        return null
    }

    /**
     * Extracts received amount (Tk / BDT)
     */
    fun extractAmount(body: String): Double? {
        // Pattern 1: e.g., "received Tk 1,500.00", "Cash In of Tk 500.00", "deposit of Tk 1,200.00"
        val pattern1 = Pattern.compile(
            "(?:received|Cash\\s*In|credited|deposit\\s*of|paid|Amount[:]?)\\s*(?:of\\s*)?(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
        val matcher1 = pattern1.matcher(body)
        if (matcher1.find()) {
            val raw = matcher1.group(1)?.replace(",", "")
            val parsed = raw?.toDoubleOrNull()
            if (parsed != null && parsed > 0.0) return parsed
        }

        // Pattern 2: e.g., "Tk 2,500.00 credited to A/C"
        val pattern2 = Pattern.compile(
            "(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:credited|received|deposit|Cash\\s*In)",
            Pattern.CASE_INSENSITIVE
        )
        val matcher2 = pattern2.matcher(body)
        if (matcher2.find()) {
            val raw = matcher2.group(1)?.replace(",", "")
            val parsed = raw?.toDoubleOrNull()
            if (parsed != null && parsed > 0.0) return parsed
        }

        // Pattern 3: General fallback for "Tk 500.00"
        val pattern3 = Pattern.compile("(?:Tk|BDT|Tk\\.)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE)
        val matcher3 = pattern3.matcher(body)
        if (matcher3.find()) {
            val raw = matcher3.group(1)?.replace(",", "")
            val parsed = raw?.toDoubleOrNull()
            if (parsed != null && parsed > 0.0) return parsed
        }

        return null
    }

    /**
     * Extracts sender mobile number or account from SMS
     */
    fun extractSenderNumber(body: String): String? {
        val pattern = Pattern.compile(
            "(?:from\\s*(?:A/C\\s*:\\s*)?|sender\\s*:\\s*|from\\s+A/C\\s+)([0-9\\-+]{11,18})",
            Pattern.CASE_INSENSITIVE
        )
        val matcher = pattern.matcher(body)
        if (matcher.find()) {
            return matcher.group(1)?.trim()
        }
        return null
    }

    /**
     * Parses raw incoming SMS.
     * Returns null if non-payment SMS or unsupported provider.
     * SECURITY: Never stores raw SMS text.
     */
    fun parse(sender: String, body: String, timestamp: Long): ParsedPayment? {
        val provider = identifyProvider(sender, body) ?: return null
        val trxId = extractTransactionId(body) ?: return null
        val amount = extractAmount(body) ?: return null
        val senderNumber = extractSenderNumber(body)

        return ParsedPayment(
            paymentMethod = provider,
            transactionId = trxId,
            amount = amount,
            senderNumber = senderNumber,
            timestamp = timestamp
        )
    }
}
