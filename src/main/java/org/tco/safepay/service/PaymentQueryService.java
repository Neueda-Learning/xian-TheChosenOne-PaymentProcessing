package org.tco.safepay.service;

import org.springframework.stereotype.Service;
import org.tco.safepay.common.ErrorCode;
import org.tco.safepay.exception.BusinessException;
import org.tco.safepay.mapper.AccountMapper;
import org.tco.safepay.mapper.PaymentHistoryMapper;
import org.tco.safepay.mapper.PaymentMapper;
import org.tco.safepay.model.entity.Account;
import org.tco.safepay.model.entity.Payment;
import org.tco.safepay.model.entity.PaymentHistory;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentQueryService {

    private final PaymentMapper paymentMapper;
    private final PaymentHistoryMapper paymentHistoryMapper;
    private final AccountMapper accountMapper;

    public PaymentQueryService(PaymentMapper paymentMapper,
                               PaymentHistoryMapper paymentHistoryMapper,
                               AccountMapper accountMapper) {
        this.paymentMapper = paymentMapper;
        this.paymentHistoryMapper = paymentHistoryMapper;
        this.accountMapper = accountMapper;
    }

    /**
     * Get a single payment by ID. Throws PAYMENT_NOT_FOUND if not found.
     */
    public Payment getPaymentById(UUID id) {
        Payment payment = paymentMapper.selectById(id);
        if (payment == null) {
            throw new BusinessException(ErrorCode.PAYMENT_NOT_FOUND);
        }
        return payment;
    }

    /**
     * List payments. If status is null or blank, returns all payments.
     */
    public List<Payment> getPayments(String status) {
        if (status == null || status.isBlank()) {
            return paymentMapper.selectAll();
        }
        return paymentMapper.selectByStatus(status.toUpperCase());
    }

    /**
     * Get status history for a payment. Validates payment existence first.
     */
    public List<PaymentHistory> getPaymentHistory(UUID id) {
        getPaymentById(id);
        return paymentHistoryMapper.selectByPaymentId(id);
    }

    /**
     * Get account balance by account number. Throws INVALID_ACCOUNT if not found.
     */
    public BigDecimal getAccountBalance(String accountNo) {
        Account account = accountMapper.selectByAccountNo(accountNo);
        if (account == null) {
            throw new BusinessException(ErrorCode.INVALID_ACCOUNT);
        }
        return account.getBalance();
    }
}
