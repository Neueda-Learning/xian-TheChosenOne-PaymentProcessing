package org.tco.safepay.service;

import org.springframework.stereotype.Service;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.model.dto.PaymentRequest;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;

@Service
public class PaymentService {

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of(
            "USD", "EUR", "GBP", "CNY", "JPY", "AUD", "CAD", "CHF", "HKD", "SGD"
    );
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000");

    public ValidationFailure validateRequest(PaymentRequest request) {
        if (request == null) {
            return new ValidationFailure(ErrorCode.VALIDATION_FAILED, "Request body is null");
        }
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

    public String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "CNY";
        }
        String upper = currency.toUpperCase(Locale.ROOT);
        return upper.length() <= 3 ? upper : upper.substring(0, 3);
    }

    public record ValidationFailure(ErrorCode errorCode, String note) {
    }
}
