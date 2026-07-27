package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.BalanceLedger;

import java.util.List;
import java.util.UUID;

public interface BalanceLedgerMapper {

    int insert(BalanceLedger balanceLedger);

    BalanceLedger selectById(@Param("id") UUID id);

    List<BalanceLedger> selectByAccountNo(@Param("accountNo") String accountNo);

    List<BalanceLedger> selectByPaymentId(@Param("paymentId") UUID paymentId);
}

