package org.tco.safepay.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.common.Result;
import org.tco.safepay.model.dto.PaymentRequest;
import org.tco.safepay.model.entity.Payment;
import org.tco.safepay.model.entity.PaymentHistory;
import org.tco.safepay.service.PaymentQueryService;
import org.tco.safepay.service.PaymentService;

import java.util.List;
import java.util.UUID;

@Tag(name = "Payment", description = "Payment management APIs")
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentQueryService paymentQueryService;

    public PaymentController(PaymentService paymentService,
                             PaymentQueryService paymentQueryService) {
        this.paymentService = paymentService;
        this.paymentQueryService = paymentQueryService;
    }

    @Operation(summary = "Create a new payment and process it synchronously")
    @PostMapping
    public Result<Payment> createPayment(@RequestBody PaymentRequest request) {
        Payment payment = paymentService.createPayment(request);
        if ("FAILED".equals(payment.getStatus()) && payment.getErrorCode() != null) {
            try {
                ErrorCode errorCode = ErrorCode.valueOf(payment.getErrorCode());
                return Result.error(errorCode.getHttpStatus(), errorCode.getDefaultMessage());
            } catch (IllegalArgumentException ignored) {
                return Result.error(ErrorCode.PROCESSING_ERROR.getHttpStatus(),
                        ErrorCode.PROCESSING_ERROR.getDefaultMessage());
            }
        }
        return Result.success(payment);
    }

    @Operation(summary = "Get payment by ID")
    @GetMapping("/{id}")
    public Result<Payment> getPaymentById(@PathVariable UUID id) {
        return Result.success(paymentQueryService.getPaymentById(id));
    }

    @Operation(summary = "List payments, optionally filtered by status")
    @GetMapping
    public Result<List<Payment>> getPayments(
            @RequestParam(required = false) String status) {
        return Result.success(paymentQueryService.getPayments(status));
    }

    @Operation(summary = "Get payment status history")
    @GetMapping("/{id}/history")
    public Result<List<PaymentHistory>> getPaymentHistory(@PathVariable UUID id) {
        return Result.success(paymentQueryService.getPaymentHistory(id));
    }
}
