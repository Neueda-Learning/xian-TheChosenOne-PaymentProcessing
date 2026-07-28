create database paymentDB;
use paymentDB;


CREATE TABLE payments (
    id                  CHAR(36) NOT NULL,
    idempotency_key     VARCHAR(64) NOT NULL,
    source_account      VARCHAR(64) NOT NULL,
    destination_account VARCHAR(64) NOT NULL,
    amount              DECIMAL(18,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL,
    reference           VARCHAR(255) NULL,
    status              VARCHAR(32) NOT NULL,
    error_code          VARCHAR(64) NULL,
    error_message       VARCHAR(255) NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payments_idempotency_key (idempotency_key),
    KEY idx_payments_status (status),
    KEY idx_payments_created_at (created_at),
    KEY idx_payments_source_account (source_account),
    KEY idx_payments_destination_account (destination_account)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE accounts (
    account_no      VARCHAR(64) NOT NULL,
    balance         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (account_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE payment_history (
    id              CHAR(36) NOT NULL,
    payment_id      CHAR(36) NOT NULL,
    from_status     VARCHAR(32) NULL,
    to_status       VARCHAR(32) NOT NULL,
    note            VARCHAR(255) NULL,
    error_code      VARCHAR(64) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payment_history_payment_id (payment_id),
    KEY idx_payment_history_created_at (created_at),
    CONSTRAINT fk_payment_history_payment
        FOREIGN KEY (payment_id) REFERENCES payments(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE balance_ledger (
    id              CHAR(36) NOT NULL,
    account_no      VARCHAR(64) NOT NULL,
    payment_id      CHAR(36) NULL,
    direction       VARCHAR(16) NOT NULL,
    amount          DECIMAL(18,2) NOT NULL,
    balance_before  DECIMAL(18,2) NOT NULL,
    balance_after   DECIMAL(18,2) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_balance_ledger_account_no (account_no),
    KEY idx_balance_ledger_payment_id (payment_id),
    KEY idx_balance_ledger_created_at (created_at),
    CONSTRAINT fk_balance_ledger_payment
        FOREIGN KEY (payment_id) REFERENCES payments(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



