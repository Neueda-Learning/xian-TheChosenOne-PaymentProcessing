package org.tco.safepay.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.common.Result;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<Object> handleBusinessException(BusinessException e) {
        return Result.error(e.getHttpStatus(), e.getMessage());
    }

    // DB unique constraint violation → idempotency key already exists (concurrent request)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public Result<Object> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        return Result.error(
                ErrorCode.DUPLICATE_PAYMENT.getHttpStatus(),
                ErrorCode.DUPLICATE_PAYMENT.getDefaultMessage()
        );
    }

    // Fallback handler for all uncaught exceptions
    @ExceptionHandler(Exception.class)
    public Result<Object> handleException(Exception e) {
        return Result.error(
                ErrorCode.PROCESSING_ERROR.getHttpStatus(),
                ErrorCode.PROCESSING_ERROR.getDefaultMessage()
        );
    }
}
