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
    
    @Transactional
    public Payment createPayment(PaymentRequest request) {

        
        String rawIdempotencyKey = request.getIdempotencyKey();
        if (rawIdempotencyKey != null
                && !rawIdempotencyKey.isBlank()
                && rawIdempotencyKey.length() <= 64) {
            Payment existing = paymentMapper.selectByIdempotencyKey(rawIdempotencyKey);
            if (existing != null) {
                return existing;
            }
        }

        
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
        pauseForHistoryVisibility();
        

       
        updateStatus(payment, "VALIDATED", null, null);
        writeHistory(payment.getId(), "CREATED", "VALIDATED", null, null);
        pauseForHistoryVisibility();

       
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

       
        updateStatus(payment, "SENT", null, null);
        writeHistory(payment.getId(), "VALIDATED", "SENT", null, null);
        pauseForHistoryVisibility();

        
        updateStatus(payment, "COMPLETED", null, null);
        writeHistory(payment.getId(), "SENT", "COMPLETED", null, null);
        pauseForHistoryVisibility();

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

    private void pauseForHistoryVisibility() {
        try {
            Thread.sleep(1100L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
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
