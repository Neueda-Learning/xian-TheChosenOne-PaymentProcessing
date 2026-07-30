package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.Payment;

import java.util.List;
import java.util.UUID;

public interface PaymentMapper {

    int insert(Payment payment);

    int updateStatus(@Param("id") UUID id,
                     @Param("status") String status,
                     @Param("errorCode") String errorCode,
                     @Param("errorMessage") String errorMessage);

    Payment selectById(@Param("id") UUID id);

    Payment selectByIdempotencyKey(@Param("idempotencyKey") String idempotencyKey);

    List<Payment> selectByStatus(@Param("status") String status);

    List<Payment> selectByAccountNo(@Param("accountNo") String accountNo);

    List<Payment> selectAll();
}
