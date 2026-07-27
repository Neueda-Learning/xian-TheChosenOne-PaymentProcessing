package org.tco.safepay.exception;

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

    // Fallback handler for all uncaught exceptions.
    @ExceptionHandler(Exception.class)
    public Result<Object> handleException(Exception e) {
        return Result.error(
                ErrorCode.PROCESSING_ERROR.getHttpStatus(),
                ErrorCode.PROCESSING_ERROR.getDefaultMessage()
        );
    }
}
