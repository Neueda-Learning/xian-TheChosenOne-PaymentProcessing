package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.PaymentHistory;

import java.util.List;
import java.util.UUID;

public interface PaymentHistoryMapper {

    List<PaymentHistory> selectByPaymentId(@Param("paymentId") UUID paymentId);
}
