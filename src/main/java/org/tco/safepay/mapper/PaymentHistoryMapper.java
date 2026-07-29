package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.PaymentHistory;

import java.util.List;
import java.util.UUID;

public interface PaymentHistoryMapper {

    int insert(PaymentHistory paymentHistory);

    PaymentHistory selectById(@Param("id") UUID id);

    List<PaymentHistory> selectByPaymentId(@Param("paymentId") UUID paymentId);
}
