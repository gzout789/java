package com.fenglin.springboottest.common;

/**
 * 统一返回结构：{ success, message, data }
 * 前端所有接口都按这个形状解析，字段名不可改。
 */
public class ApiResult<T> {

    private boolean success;
    private String message;
    private T data;

    public ApiResult() {
    }

    public ApiResult(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResult<T> ok(T data) {
        return new ApiResult<>(true, "success", data);
    }

    public static <T> ApiResult<T> ok(String message, T data) {
        return new ApiResult<>(true, message, data);
    }

    public static <T> ApiResult<T> fail(String message) {
        return new ApiResult<>(false, message, null);
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
