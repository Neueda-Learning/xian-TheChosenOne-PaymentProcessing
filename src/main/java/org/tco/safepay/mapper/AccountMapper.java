package org.tco.safepay.mapper;

import org.apache.ibatis.annotations.Param;
import org.tco.safepay.model.entity.Account;

import java.math.BigDecimal;

public interface AccountMapper {

    int insert(Account account);

    Account selectByAccountNo(@Param("accountNo") String accountNo);

    int updateBalance(@Param("accountNo") String accountNo,
                       @Param("balance") BigDecimal balance);

    /**
     * Conditional deduction: only succeeds if balance >= amount (avoids negative balance under concurrency).
     */
    int deductBalance(@Param("accountNo") String accountNo,
                       @Param("amount") BigDecimal amount);

    int increaseBalance(@Param("accountNo") String accountNo,
                         @Param("amount") BigDecimal amount);
}

