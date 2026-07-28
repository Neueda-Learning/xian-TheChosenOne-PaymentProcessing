package org.tco.safepay.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.common.Result;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public Result<Object> handleBusinessException(BusinessException e) {
        log.warn("Business exception: {}", e.getMessage());
        return Result.error(e.getHttpStatus(), e.getMessage());
    }

    // DB unique constraint violation → idempotency key already exists (concurrent request)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public Result<Object> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        log.error("Data integrity violation", e);
        return Result.error(
                ErrorCode.DUPLICATE_PAYMENT.getHttpStatus(),
                ErrorCode.DUPLICATE_PAYMENT.getDefaultMessage()
        );
    }

    @ExceptionHandler(DataAccessException.class)
    public Result<Object> handleDataAccessException(DataAccessException e) {
        log.error("Database access exception", e);
        return Result.error(
                ErrorCode.PROCESSING_ERROR.getHttpStatus(),
                ErrorCode.PROCESSING_ERROR.getDefaultMessage()
        );
    }

    // Fallback handler for all uncaught exceptions
    @ExceptionHandler(Exception.class)
    public Result<Object> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return Result.error(
                ErrorCode.PROCESSING_ERROR.getHttpStatus(),
                ErrorCode.PROCESSING_ERROR.getDefaultMessage()
        );
    }
}
