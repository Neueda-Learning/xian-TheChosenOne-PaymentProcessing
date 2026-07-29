package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.Payment;

import java.util.List;
import java.util.UUID;

public interface PaymentMapper {

    Payment selectById(@Param("id") UUID id);

    List<Payment> selectByStatus(@Param("status") String status);

    List<Payment> selectAll();
}
