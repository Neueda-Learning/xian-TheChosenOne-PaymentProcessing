package org.tco.safepay.exception;

import org.tco.safepay.common.ErrorCode;

public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public int getHttpStatus(){
        return errorCode.getHttpStatus();
    }


}