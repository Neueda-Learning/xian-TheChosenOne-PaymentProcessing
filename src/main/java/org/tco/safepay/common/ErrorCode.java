package org.tco.safepay.common;

public enum ErrorCode {


    VALIDATION_FAILED(400, "Payment failed validation checks"),

    INVALID_AMOUNT(400, "Amount is zero, negative, or invalid"),

    INVALID_ACCOUNT(400, "Account number is invalid or doesn't exist"),

    INVALID_CURRENCY(400, "Currency code is not supported"),

    INSUFFICIENT_FUNDS(400, "Source account has insufficient funds"),

    INVALID_STATUS_TRANSITION(400, "Cannot transition from current status to requested status"),

    DUPLICATE_PAYMENT(409, "Payment with same idempotency key exists"),

    PAYMENT_NOT_FOUND(404, "Payment ID does not exist"),

    PROCESSING_ERROR(500, "Internal error during payment processing"),

    NETWORK_ERROR(503, "Communication failure with payment network");


    private final int httpStatus;
    private final String defaultMessage;

    ErrorCode(int httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
