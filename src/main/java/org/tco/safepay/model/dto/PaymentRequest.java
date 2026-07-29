package org.tco.safepay.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PaymentRequest {

    @Schema(description = "Client-provided idempotency key (max 64 chars)", example = "order-20260728-001")
    private String idempotencyKey;

    @Schema(description = "Source account number", example = "ACC10001")
    private String sourceAccount;

    @Schema(description = "Destination account number", example = "ACC20002")
    private String destinationAccount;

    @Schema(description = "Payment amount (> 0, <= 1,000,000, max 2 decimal places)", example = "120.50")
    private BigDecimal amount;

    @Schema(description = "ISO 4217 currency code (USD / EUR / GBP / CNY ...)", example = "USD")
    private String currency;

    @Schema(description = "Optional reference or description", example = "Invoice #2026-001")
    private String reference;
}
