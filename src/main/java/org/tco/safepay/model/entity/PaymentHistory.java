package org.tco.safepay.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PaymentHistory {
    private UUID id;
    private UUID paymentId;
    private String fromStatus;
    private String toStatus;
    private String note;
    private String errorCode;
    private LocalDateTime createdAt;
}

