package org.tco.safepay.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.tco.safepay.common.Result;
import org.tco.safepay.model.entity.Account;
import org.tco.safepay.service.PaymentQueryService;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "Account", description = "Account balance APIs")
@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final PaymentQueryService paymentQueryService;

    public AccountController(PaymentQueryService paymentQueryService) {
        this.paymentQueryService = paymentQueryService;
    }

    @Operation(summary = "List all accounts")
    @GetMapping
    public Result<List<Account>> getAccounts() {
        return Result.success(paymentQueryService.getAllAccounts());
    }

    @Operation(summary = "Get account detail by account number")
    @GetMapping("/{accountNo}")
    public Result<Account> getAccount(@PathVariable String accountNo) {
        return Result.success(paymentQueryService.getAccountByAccountNo(accountNo));
    }

    @Operation(summary = "Get account balance by account number")
    @GetMapping("/{accountNo}/balance")
    public Result<BigDecimal> getBalance(@PathVariable String accountNo) {
        return Result.success(paymentQueryService.getAccountBalance(accountNo));
    }
}
