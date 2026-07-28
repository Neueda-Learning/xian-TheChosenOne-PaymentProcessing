package org.tco.safepay.common;

public class Result<T> {

    private int code;
    private String msg;
    private T data;

    public static <T> Result<T> success(T data) {
        Result<T> resp = new Result<>();
        resp.code = 200;
        resp.msg = "Request processed successfully";
        resp.data = data;
        return resp;
    }

    public static <T> Result<T> error(int code, String message) {
        Result<T> resp = new Result<>();
        resp.code = code;
        resp.msg = message;
        resp.data = null;
        return resp;
    }


    public int getCode() {
        return code;
    }

    public String getMsg() {
        return msg;
    }

    public T getData() {
        return data;
    }
}
