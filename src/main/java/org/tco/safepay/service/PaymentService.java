package org.tco.safepay.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.mapper.AccountMapper;
import org.tco.safepay.mapper.BalanceLedgerMapper;
import org.tco.safepay.mapper.PaymentHistoryMapper;
import org.tco.safepay.mapper.PaymentMapper;
import org.tco.safepay.model.dto.PaymentRequest;
import org.tco.safepay.model.entity.Account;
import org.tco.safepay.model.entity.BalanceLedger;
import org.tco.safepay.model.entity.Payment;
import org.tco.safepay.model.entity.PaymentHistory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PaymentService {

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of(
            "USD", "EUR", "GBP", "CNY", "JPY", "AUD", "CAD", "CHF", "HKD", "SGD"
    );
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000");

    private final PaymentMapper paymentMapper;
    private final PaymentHistoryMapper paymentHistoryMapper;
    private final AccountMapper accountMapper;
    private final BalanceLedgerMapper balanceLedgerMapper;

    public PaymentService(PaymentMapper paymentMapper,
                          PaymentHistoryMapper paymentHistoryMapper,
                          AccountMapper accountMapper,
                          BalanceLedgerMapper balanceLedgerMapper) {
        this.paymentMapper = paymentMapper;
        this.paymentHistoryMapper = paymentHistoryMapper;
        this.accountMapper = accountMapper;
        this.balanceLedgerMapper = balanceLedgerMapper;
    }

    /**
     * Create a payment and drive it synchronously through the full lifecycle.
     * Returns the payment in its final state (COMPLETED or FAILED).
     *
     * Steps:
     *   1. Validate request fields
     *   2. Idempotency check  → return existing if key already seen
     *   3. Persist Payment (CREATED) + write history
     *   4. Account existence check
     *   5. Balance check  (balance >= amount)
     *   6. CREATED → VALIDATED + write history
     *   7. Reserve balance (RESERVE ledger + deduct account balance)
     *   8. VALIDATED → SENT + write history
     *   9. SENT → COMPLETED + DEBIT / CREDIT ledger entries
     *      or SENT → FAILED + RELEASE ledger entry
     */
    @Transactional
    public Payment createPayment(PaymentRequest request) {

        ValidationFailure validationFailure = validateRequest(request);

        // ── Step 2: idempotency check ─────────────────────────────────────────
        String rawIdempotencyKey = request.getIdempotencyKey();
        if (rawIdempotencyKey != null
                && !rawIdempotencyKey.isBlank()
                && rawIdempotencyKey.length() <= 64) {
            Payment existing = paymentMapper.selectByIdempotencyKey(rawIdempotencyKey);
            if (existing != null) {
                return existing;
            }
        }

        // ── Step 3: persist Payment (CREATED) ────────────────────────────────
        LocalDateTime now = LocalDateTime.now();
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setIdempotencyKey(normalizeIdempotencyKey(rawIdempotencyKey));
        payment.setSourceAccount(normalizeRequiredText(request.getSourceAccount(), "INVALID_SOURCE"));
        payment.setDestinationAccount(normalizeRequiredText(request.getDestinationAccount(), "INVALID_DEST"));
        payment.setAmount(request.getAmount() == null ? BigDecimal.ZERO : request.getAmount());
        payment.setCurrency(normalizeCurrency(request.getCurrency()));
        payment.setReference(request.getReference());
        payment.setStatus("CREATED");
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentMapper.insert(payment);
        writeHistory(payment.getId(), null, "CREATED", null, null);

        // Persist all validation failures as FAILED attempts.
        if (validationFailure != null) {
            updateStatus(payment, "FAILED",
                    validationFailure.errorCode().name(),
                    validationFailure.errorCode().getDefaultMessage());
            writeHistory(payment.getId(), "CREATED", "FAILED",
                    validationFailure.note(), validationFailure.errorCode().name());
            return payment;
        }

        // ── Step 4: account existence ─────────────────────────────────────────
        Account sourceAccount = accountMapper.selectByAccountNo(request.getSourceAccount());
        if (sourceAccount == null) {
            updateStatus(payment, "FAILED",
                    ErrorCode.INVALID_ACCOUNT.name(),
                    ErrorCode.INVALID_ACCOUNT.getDefaultMessage());
            writeHistory(payment.getId(), "CREATED", "FAILED",
                    "Source account not found", ErrorCode.INVALID_ACCOUNT.name());
            return payment;
        }
        if (accountMapper.selectByAccountNo(request.getDestinationAccount()) == null) {
            updateStatus(payment, "FAILED",
                    ErrorCode.INVALID_ACCOUNT.name(),
                    ErrorCode.INVALID_ACCOUNT.getDefaultMessage());
            writeHistory(payment.getId(), "CREATED", "FAILED",
                    "Destination account not found", ErrorCode.INVALID_ACCOUNT.name());
            return payment;
        }

        // ── Step 5: balance check ─────────────────────────────────────────────
        if (sourceAccount.getBalance().compareTo(request.getAmount()) < 0) {
            updateStatus(payment, "FAILED",
                    ErrorCode.INSUFFICIENT_FUNDS.name(),
                    ErrorCode.INSUFFICIENT_FUNDS.getDefaultMessage());
            writeHistory(payment.getId(), "CREATED", "FAILED",
                    "Insufficient balance at pre-check", ErrorCode.INSUFFICIENT_FUNDS.name());
            return payment;
        }

        // ── Step 6: CREATED → VALIDATED ──────────────────────────────────────
        updateStatus(payment, "VALIDATED", null, null);
        writeHistory(payment.getId(), "CREATED", "VALIDATED", null, null);

        // ── Step 7: reserve balance ───────────────────────────────────────────
        // Deduct source account balance; the WHERE balance >= amount guard
        // protects against concurrent over-spend.
        BigDecimal sourceBefore = sourceAccount.getBalance();
        BigDecimal sourceAfterReserve = sourceBefore.subtract(request.getAmount());
        int affected = accountMapper.deductBalance(request.getSourceAccount(), request.getAmount());
        if (affected == 0) {
            // Concurrent insufficient funds – mark FAILED and commit
            updateStatus(payment, "FAILED",
                    ErrorCode.INSUFFICIENT_FUNDS.name(),
                    ErrorCode.INSUFFICIENT_FUNDS.getDefaultMessage());
            writeHistory(payment.getId(), "VALIDATED", "FAILED",
                    "Balance deduction failed (concurrent)", ErrorCode.INSUFFICIENT_FUNDS.name());
            return payment;
        }
        writeLedger(payment.getId(), request.getSourceAccount(), "RESERVE",
                request.getAmount(), sourceBefore, sourceAfterReserve);

        // ── Step 8: VALIDATED → SENT ──────────────────────────────────────────
        updateStatus(payment, "SENT", null, null);
        writeHistory(payment.getId(), "VALIDATED", "SENT", null, null);

        // ── Step 9: SENT → COMPLETED ──────────────────────────────────────────
        updateStatus(payment, "COMPLETED", null, null);
        writeHistory(payment.getId(), "SENT", "COMPLETED", null, null);

        // DEBIT ledger entry for source (balance already deducted at RESERVE)
        writeLedger(payment.getId(), request.getSourceAccount(), "DEBIT",
                request.getAmount(), sourceAfterReserve, sourceAfterReserve);

        // CREDIT ledger entry for destination + increase destination balance
        Account destFresh = accountMapper.selectByAccountNo(request.getDestinationAccount());
        if (destFresh == null) {
            updateStatus(payment, "FAILED",
                    ErrorCode.INVALID_ACCOUNT.name(),
                    ErrorCode.INVALID_ACCOUNT.getDefaultMessage());
            writeHistory(payment.getId(), "COMPLETED", "FAILED",
                    "Destination account missing before credit", ErrorCode.INVALID_ACCOUNT.name());
            return payment;
        }
        BigDecimal destBefore = destFresh.getBalance();
        BigDecimal destAfter = destBefore.add(request.getAmount());
        int creditAffected = accountMapper.increaseBalance(request.getDestinationAccount(), request.getAmount());
        if (creditAffected == 0) {
            updateStatus(payment, "FAILED",
                    ErrorCode.INVALID_ACCOUNT.name(),
                    ErrorCode.INVALID_ACCOUNT.getDefaultMessage());
            writeHistory(payment.getId(), "COMPLETED", "FAILED",
                    "Credit update affected 0 rows", ErrorCode.INVALID_ACCOUNT.name());
            return payment;
        }
        writeLedger(payment.getId(), request.getDestinationAccount(), "CREDIT",
                request.getAmount(), destBefore, destAfter);

        return payment;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ValidationFailure validateRequest(PaymentRequest request) {
        if (request.getIdempotencyKey() == null
                || request.getIdempotencyKey().isBlank()
                || request.getIdempotencyKey().length() > 64) {
            return new ValidationFailure(ErrorCode.VALIDATION_FAILED, "Invalid idempotency key");
        }
        if (request.getSourceAccount() == null || request.getSourceAccount().isBlank()) {
            return new ValidationFailure(ErrorCode.INVALID_ACCOUNT, "Source account is blank");
        }
        if (request.getDestinationAccount() == null || request.getDestinationAccount().isBlank()) {
            return new ValidationFailure(ErrorCode.INVALID_ACCOUNT, "Destination account is blank");
        }
        if (request.getSourceAccount().equals(request.getDestinationAccount())) {
            return new ValidationFailure(ErrorCode.INVALID_ACCOUNT, "Source and destination are same");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return new ValidationFailure(ErrorCode.INVALID_AMOUNT, "Amount is zero or negative");
        }
        if (request.getAmount().compareTo(MAX_AMOUNT) > 0) {
            return new ValidationFailure(ErrorCode.INVALID_AMOUNT, "Amount exceeds max limit");
        }
        if (request.getAmount().stripTrailingZeros().scale() > 2) {
            return new ValidationFailure(ErrorCode.INVALID_AMOUNT, "Amount has more than 2 decimals");
        }
        if (request.getCurrency() == null
                || !SUPPORTED_CURRENCIES.contains(request.getCurrency().toUpperCase(Locale.ROOT))) {
            return new ValidationFailure(ErrorCode.INVALID_CURRENCY, "Unsupported currency");
        }
        return null;
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank() && idempotencyKey.length() <= 64) {
            return idempotencyKey;
        }
        return "INVALID-" + UUID.randomUUID().toString().replace("-", "");
    }

    private String normalizeRequiredText(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "UNK";
        }
        String upper = currency.toUpperCase(Locale.ROOT);
        return upper.length() <= 3 ? upper : upper.substring(0, 3);
    }

    private record ValidationFailure(ErrorCode errorCode, String note) {
    }

    private void updateStatus(Payment payment, String status, String errorCode, String errorMessage) {
        paymentMapper.updateStatus(payment.getId(), status, errorCode, errorMessage);
        payment.setStatus(status);
        payment.setErrorCode(errorCode);
        payment.setErrorMessage(errorMessage);
    }

    private void writeHistory(UUID paymentId, String fromStatus, String toStatus,
                               String note, String errorCode) {
        PaymentHistory history = new PaymentHistory();
        history.setId(UUID.randomUUID());
        history.setPaymentId(paymentId);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setNote(note);
        history.setErrorCode(errorCode);
        history.setCreatedAt(LocalDateTime.now());
        paymentHistoryMapper.insert(history);
    }

    private void writeLedger(UUID paymentId, String accountNo, String direction,
                              BigDecimal amount, BigDecimal before, BigDecimal after) {
        BalanceLedger ledger = new BalanceLedger();
        ledger.setId(UUID.randomUUID());
        ledger.setAccountNo(accountNo);
        ledger.setPaymentId(paymentId);
        ledger.setDirection(direction);
        ledger.setAmount(amount);
        ledger.setBalanceBefore(before);
        ledger.setBalanceAfter(after);
        ledger.setCreatedAt(LocalDateTime.now());
        balanceLedgerMapper.insert(ledger);
    }
}
