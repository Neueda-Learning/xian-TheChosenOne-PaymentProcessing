package org.tco.safepay.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Account {
    private String accountNo;
    private BigDecimal balance;
    private LocalDateTime updatedAt;
}

