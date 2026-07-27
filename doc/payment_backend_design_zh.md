# SafePay 支付系统后端设计文档

[TOC]

---

## 1. 文档目标

本文档基于 `payment_processing.md` 的训练项目需求，给出**仅后端范围**的完整设计方案，包含：

- 系统建设范围界定
- 分层架构与模块划分
- 核心数据模型（含账户余额域）
- 支付状态机与业务流程
- REST API 设计
- 错误码、幂等、审计规范
- 4 人团队端到端协作方案

---

## 2. 项目范围

### 2.1 本阶段包含

| 能力域 | 具体内容 |
|--------|---------|
| 支付管理 | 创建、查询、按状态筛选、历史追踪 |
| 账户余额 | 账户信息、余额查询、余额预留/扣减/释放 |
| 状态流转 | 支付生命周期管理、状态机校验 |
| 质量保障 | 幂等处理、错误码规范、统一异常响应 |
| 审计轨迹 | 每次状态变更完整记录 |
| 测试 | 单元测试 + 集成测试 |

### 2.2 本阶段不包含

- 前端页面 / 前后端联调
- 登录、认证、授权、多用户管理
- 真实支付网关 / 银行网络接入
- 消息通知（邮件、短信、Webhook）
- 汇率服务、定时调度、批量支付
- 多租户 / 授信 / 清结算等复杂账户域

> **说明**：本阶段不做认证，但引入最小账户余额域以支持支付前余额校验，这是支付系统的基本业务完整性要求。

### 2.3 技术栈

| 技术 | 说明 |
|------|------|
| Java 17 | 编程语言 |
| Spring Boot | 应用框架 |
| Spring MVC | REST API 层 |
| MyBatis | 数据访问层（Mapper 接口 + XML） |
| H2 / MySQL / PostgreSQL |
| Maven | 构建工具 |

---

## 3. 支付生命周期

```text
CREATED → VALIDATED → SENT → COMPLETED
    ↓            ↓         ↓
  FAILED       FAILED    FAILED
```

| 状态 | 含义 |
|------|------|
| CREATED | 支付已创建，尚未校验 |
| VALIDATED | 已通过全部业务校验，准备发送 |
| SENT | 已发送到目标系统（本项目内部模拟） |
| COMPLETED | 处理成功，终态 |
| FAILED | 处理失败，终态（附错误码） |

### 3.1 合法状态迁移规则

| 当前状态 | 可流转到 | 不可流转到 |
|----------|----------|-----------|
| CREATED | VALIDATED, FAILED | 其他 |
| VALIDATED | SENT, FAILED | 其他 |
| SENT | COMPLETED, FAILED | 其他 |
| COMPLETED | 无（终态） | 任何状态 |
| FAILED | 无（终态） | 任何状态 |

> 任何不在合法规则内的迁移请求，均返回 `INVALID_STATUS_TRANSITION`。

---

## 4. 总体架构设计

### 4.1 分层架构

```text
┌──────────────────────────────────────┐
│          Controller 层                │
│  接收 HTTP 请求 / 参数格式校验 / 响应    │
└─────────────────┬────────────────────┘
                  │
┌─────────────────▼────────────────────┐
│           Service 层                  │
│  业务逻辑 / 状态流转 / 幂等 / 余额处理   │
└─────────────────┬────────────────────┘
                  │
┌─────────────────▼────────────────────┐
│          Mapper 层                    │
│  MyBatis Mapper 接口 + XML SQL         │
└─────────────────┬────────────────────┘
                  │
┌─────────────────▼────────────────────┐
│            Database                   │
│  payments / payment_history           │
│  accounts / balance_ledger            │
└──────────────────────────────────────┘
```

**分层职责边界：**

| 层 | 负责 | 不负责 |
|----|------|--------|
| Controller | HTTP 路由、请求/响应 DTO 转换 | 业务规则、数据库操作 |
| Service | 校验、状态流转、幂等、余额 | HTTP 细节、SQL 细节 |
| Mapper | 数据库读写、SQL 编写（XML） | 业务判断 |

### 4.2 推荐包结构

```text
org.tco.safepay
├── controller          # REST 接口
│   ├── PaymentController.java
│   └── AccountController.java
├── service             # 业务逻辑
│   ├── PaymentService.java
│   ├── AccountService.java
│   └── PaymentStateMachine.java
├── mapper              # 数据访问（MyBatis Mapper 接口）
│   ├── PaymentMapper.java
│   ├── PaymentHistoryMapper.java
│   ├── AccountMapper.java
│   └── BalanceLedgerMapper.java
├── model
│   ├── entity          # 数据库实体
│   ├── dto             # 请求/响应对象
│   └── enums           # 枚举（状态、错误码、方向）
├── exception           # 自定义异常 + GlobalExceptionHandler
└── config              # Spring / MyBatis 配置
```

> Mapper 接口对应的 SQL 映射文件存放在 `src/main/resources/mapper/*.xml`，与包结构中的 `mapper` 接口一一对应。

---

## 5. 数据模型设计

### 5.1 Payment（支付）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 支付唯一标识 |
| idempotencyKey | String(64) | UNIQUE, NOT NULL | 幂等键，由客户端提供 |
| sourceAccount | String | NOT NULL | 源账户号 |
| destinationAccount | String | NOT NULL | 目标账户号 |
| amount | Decimal(18,2) | NOT NULL | 支付金额 |
| currency | String(3) | NOT NULL | 币种（ISO 4217） |
| reference | String | NULL | 备注/说明（可选） |
| status | Enum | NOT NULL | 当前支付状态 |
| errorCode | String | NULL | 失败时的错误码 |
| errorMessage | String | NULL | 失败时的错误描述 |
| createdAt | Timestamp | NOT NULL | 创建时间 |
| updatedAt | Timestamp | NOT NULL | 最后更新时间 |

### 5.2 PaymentHistory（支付状态历史）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 历史记录 ID |
| paymentId | UUID | FK, NOT NULL | 关联支付 |
| fromStatus | Enum | NULL | 迁移前状态（首次创建为 null） |
| toStatus | Enum | NOT NULL | 迁移后状态 |
| note | String | NULL | 补充说明 |
| errorCode | String | NULL | 失败时的错误码 |
| createdAt | Timestamp | NOT NULL | 状态变更时间 |

### 5.3 Account（账户）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| accountNo | String | PK | 账户号 |
| balance | Decimal(18,2) | NOT NULL | 当前余额 |
| updatedAt | Timestamp | NOT NULL | 最后更新时间 |

### 5.4 BalanceLedger（余额流水）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 流水 ID |
| accountNo | String | NOT NULL | 账户号 |
| paymentId | UUID | NULL | 关联支付 |
| direction | Enum | NOT NULL | RESERVE / RELEASE / DEBIT / CREDIT |
| amount | Decimal(18,2) | NOT NULL | 变动金额 |
| balanceBefore | Decimal(18,2) | NOT NULL | 变更前余额快照 |
| balanceAfter | Decimal(18,2) | NOT NULL | 变更后余额快照 |
| createdAt | Timestamp | NOT NULL | 流水创建时间 |

**余额流水方向说明：**

| 方向 | 时机 | 余额变化 |
|------|------|---------|
| RESERVE | 校验通过，预留金额 | 余额暂时冻结/占用 |
| RELEASE | 支付失败，释放预留 | 余额恢复 |
| DEBIT | 支付完成，正式扣款 | 余额减少 |
| CREDIT | 收款方到账 | 余额增加 |

**数据库索引建议：**

```sql
UNIQUE INDEX ON payments(idempotency_key)
INDEX ON payments(status)
INDEX ON payments(created_at)
INDEX ON payment_history(payment_id)
INDEX ON balance_ledger(account_no, created_at)
```

---

## 6. 业务流程设计

### 6.1 创建支付流程

```text
POST /api/payments
  │
  ├─ Step 1：请求字段格式校验（非空、格式、范围）
  │           失败 → 400 返回具体错误码
  │
  ├─ Step 2：幂等检查：idempotencyKey 是否已存在
  │           已存在 → 直接返回已有支付（200）
  │
  ├─ Step 3：账户校验（存在 & 余额充足）
  │           失败 → 400 INVALID_ACCOUNT / INSUFFICIENT_FUNDS
  │
  ├─ Step 4：余额校验（balance >= amount）
  │           不足 → 400 INSUFFICIENT_FUNDS
  │
  ├─ Step 5：创建 Payment（status = CREATED）
  │           写 PaymentHistory: null → CREATED
  │
  ├─ Step 6：业务规则校验
  │           通过 → CREATED → VALIDATED，写历史
  │           失败 → CREATED → FAILED，写历史，返回
  │
  ├─ Step 7：预留余额
  │           写 BalanceLedger: RESERVE
  │
  ├─ Step 8：模拟发送 → VALIDATED → SENT，写历史
  │
  └─ Step 9：模拟完成
              成功 → SENT → COMPLETED，写历史
                     写 BalanceLedger: DEBIT（源账户）
                     写 BalanceLedger: CREDIT（目标账户）
              失败 → SENT → FAILED，写历史
                     写 BalanceLedger: RELEASE（释放预留）
```

> **MVP 阶段采用同步处理**：一次请求内完成全部步骤，返回最终状态。

### 6.2 查询流程

| 操作 | 接口 |
|------|------|
| 查询单笔支付详情 | `GET /api/payments/{id}` |
| 按状态筛选支付列表 | `GET /api/payments?status=FAILED` |
| 查询支付状态历史 | `GET /api/payments/{id}/history` |
| 查询账户余额 | `GET /api/accounts/{accountNo}/balance` |

---

## 7. REST API 设计

### 7.1 接口汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/payments` | 创建支付 |
| GET | `/api/payments/{id}` | 查询单笔支付 |
| GET | `/api/payments` | 查询支付列表（可按 status 筛选） |
| GET | `/api/payments/{id}/history` | 查询支付状态历史 |
| GET | `/api/accounts/{accountNo}/balance` | 查询账户余额 |

### 7.2 创建支付示例

**POST** `/api/payments`

请求体：

```json
{
  "idempotencyKey": "order-20260727-001",
  "sourceAccount": "ACC10001",
  "destinationAccount": "ACC20002",
  "amount": 120.50,
  "currency": "USD",
  "reference": "Invoice #2026-001"
}
```

成功响应（200）：

```json
{
  "code": "SUCCESS",
  "message": "Payment processed successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "amount": 120.50,
    "currency": "USD",
    "sourceAccount": "ACC10001",
    "destinationAccount": "ACC20002",
    "createdAt": "2026-07-27T10:00:00Z",
    "updatedAt": "2026-07-27T10:00:01Z"
  }
}
```

余额不足（400）：

```json
{
  "code": "INSUFFICIENT_FUNDS",
  "message": "Source account does not have sufficient available balance",
  "data": null
}
```

### 7.3 统一响应结构

```json
{
  "code": "SUCCESS | 错误码",
  "message": "描述信息",
  "data": "业务数据，失败时为 null"
}
```

---

## 8. 校验规则

| 规则类型 | 校验内容 | 失败错误码 |
|----------|---------|-----------|
| 金额 | > 0，≤ 1,000,000，最多 2 位小数 | INVALID_AMOUNT |
| 账户 | 不为空；sourceAccount ≠ destinationAccount | INVALID_ACCOUNT |
| 币种 | 支持的 ISO 4217 代码（USD / EUR / GBP 等） | INVALID_CURRENCY |
| 幂等键 | 不为空，长度 ≤ 64 | VALIDATION_FAILED |
| 余额 | balance >= amount | INSUFFICIENT_FUNDS |

---

## 9. 错误码规范

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| VALIDATION_FAILED | 400 | 通用字段格式校验失败 |
| INVALID_AMOUNT | 400 | 金额无效 |
| INVALID_ACCOUNT | 400 | 账户不存在、状态无效或格式非法 |
| INVALID_CURRENCY | 400 | 不支持的币种或账户币种不匹配 |
| INSUFFICIENT_FUNDS | 400 | 余额不足 |
| INVALID_STATUS_TRANSITION | 400 | 非法状态迁移 |
| DUPLICATE_PAYMENT | 409 | 幂等键重复，已有支付存在 |
| PAYMENT_NOT_FOUND | 404 | 支付 ID 不存在 |
| PROCESSING_ERROR | 500 | 系统处理异常 |
| NETWORK_ERROR | 503 | 模拟网络异常 |

使用 `@RestControllerAdvice` + `GlobalExceptionHandler` 统一捕获并转换，避免暴露堆栈信息。

---

## 10. 幂等设计

**目标：** 防止超时重试或重复提交导致同一笔支付被多次创建。

**方案：**

1. 客户端创建支付时必须传入 `idempotencyKey`
2. 数据库对 `idempotency_key` 设置 UNIQUE 约束
3. Service 层逻辑：
   - 若 key 首次出现 → 正常创建
   - 若 key 已存在 → 直接返回已有支付（不报错，不重复创建）
4. 并发场景：依赖数据库唯一约束兜底，捕获约束异常后转换为幂等响应

---

## 11. 审计轨迹

每次状态变更必须向 `payment_history` 写入记录：

| 触发时机 | fromStatus | toStatus |
|----------|------------|----------|
| 创建支付 | null | CREATED |
| 校验通过 | CREATED | VALIDATED |
| 校验失败 | CREATED | FAILED |
| 模拟发送 | VALIDATED | SENT |
| 发送失败 | VALIDATED | FAILED |
| 处理完成 | SENT | COMPLETED |
| 处理失败 | SENT | FAILED |

---

## 12. 测试设计

### 12.1 单元测试重点

| 测试对象 | 测试场景 |
|----------|---------|
| 金额校验 | 零值、负数、超上限、超精度 |
| 账户校验 | 空值、同源同目标账户 |
| 余额校验 | 恰好等于金额（通过）、小于金额（不足） |
| 状态机 | 所有合法迁移路径、所有非法迁移路径 |
| 幂等逻辑 | 首次创建成功、重复 key 返回已有数据 |

### 12.2 集成测试重点

| 测试场景 | 预期结果 |
|----------|---------|
| 创建支付成功全流程 | status = COMPLETED，余额已扣减，历史 7 条 |
| 余额不足 | 返回 INSUFFICIENT_FUNDS，无支付记录 |
| 重复 idempotencyKey | 返回已有支付，无重复记录 |
| 查询不存在的支付 | 404 PAYMENT_NOT_FOUND |
| 非法状态迁移 | 400 INVALID_STATUS_TRANSITION |
| 按状态筛选支付 | 仅返回匹配状态的支付 |

### 12.3 边界测试

- 金额 = 0、金额 = -1、金额 = 1,000,001
- sourceAccount = destinationAccount
- currency = "XXX"（不支持的币种）
- 并发发送相同 idempotencyKey

---

## 13. 4 人团队协作方案

### 13.1 分工原则

每位成员**独立认领 1 个及以上功能模块**，端到端负责该模块的 API + 业务 + 数据 + 测试，不做技术分层切分。  
脚手架搭建、文档生成等**公共基础性工作**不归属于某个功能，单独列出后**平均拆分给 4 人**，确保没有人只做重复性杂活，也没有人只做核心功能而不管公共交付物。

### 13.2 四个功能模块（按人分配，端到端负责）

| 模块 | 核心功能 | 涉及接口 | 负责人 |
|------|---------|---------|--------|
| **模块 A：支付创建与状态机** | 创建支付、CREATED→VALIDATED→SENT→COMPLETED 全流程 | POST /api/payments（成功路径） | 成员 A |
| **模块 B：失败处理与余额回滚** | 字段/余额/状态校验失败分支、错误码返回、余额释放 | POST /api/payments（失败路径） | 成员 B |
| **模块 C：查询与账户余额** | 单笔查询、状态筛选、历史轨迹、余额查询 | GET 系列接口 | 成员 C |
| **模块 D：幂等与并发保护** | 重复提交检测、唯一约束、并发冲突处理 | POST /api/payments（幂等场景） | 成员 D |

每个模块负责人需要交付：**Controller + Service + Mapper（接口 + XML） + 单元测试 + 至少 1 个集成测试**。

> 模块之间有依赖（如模块 B/D 都基于模块 A 的 Payment 创建逻辑），建议先集体对齐 `PaymentService` 的方法签名，再各自并行开发，减少后期合并冲突。

### 13.3 公共基础性任务（平均拆分给 4 人）

以下任务不属于任何单一功能模块，是团队公共交付物，需要拆开平均分配，每人认领 1-2 项：

| 任务 | 内容 | 建议认领人 |
|------|------|-----------|
| 项目脚手架搭建 | 包结构、枚举定义（`PaymentStatus`/`ErrorCode`/`BalanceDirection`）、统一响应类 `ApiResponse<T>` | 成员 A |
| 数据库与建表脚本 | `payments`/`payment_history`/`accounts`/`balance_ledger` 建表、索引、初始化测试数据 | 成员 B |
| 全局异常处理与错误码维护 | `GlobalExceptionHandler`、错误码枚举维护、统一异常响应格式 | 成员 C |
| API 文档与测试脚手架 | Swagger/OpenAPI 配置或手写 API 文档、集成测试基础类/工具方法 | 成员 D |

> 认领人负责该任务的**初版搭建**，但产出对全员开放，其他人开发过程中可以直接修改和补充，不是"谁的地盘谁独占"。

### 13.4 协作约定（Day 1 必须对齐）

开始编码前 4 人必须共同确认（由脚手架负责人牵头，全员参与）：

1. Entity 字段命名（驼峰）与数据库字段命名（下划线）
2. 错误码枚举类 `ErrorCode` 的初始清单
3. 状态枚举类 `PaymentStatus` 的定义
4. 统一响应类 `ApiResponse<T>` 的结构
5. `PaymentService` 核心方法签名（供模块 A/B/D 共同依赖）

### 13.5 日常协作方式

- 每天 15 分钟站会：同步各模块进度、暴露接口/字段变更
- 涉及多模块共用的代码（如 `PaymentService`、`Payment` 实体）修改前先在群里通知，避免相互覆盖
- 每个模块 PR 由**至少 1 位其他成员**评审后合并，交叉学习彼此的功能实现

---

## 14. 开发阶段计划

### 第一阶段：脚手架与公共基础（Day 1）

- 4 人并行完成各自认领的公共基础性任务（见 13.3）
- 集体对齐 Entity、枚举、`PaymentService` 方法签名等公共约定（见 13.4）

### 第二阶段：核心功能开发（Day 2–4，4 个模块并行）

- 模块 A：创建支付 + 状态机 + 余额预留/扣减
- 模块 B：失败分支 + 错误码处理 + 余额回滚
- 模块 C：查询接口 + 历史接口 + 余额查询
- 模块 D：幂等保障 + 并发测试

### 第三阶段：联调与收尾（Day 5）

- 4 个模块联调
- 补充边界测试
- MVP 验收清单自检
- 整理 API 文档（在模块 D 搭建的文档脚手架基础上补全）

---

## 15. Git 分支策略

```text
main
└── develop
    ├── feature/module-a-payment-creation
    ├── feature/module-b-failure-handling
    ├── feature/module-c-query-balance
    └── feature/module-d-idempotency
```

- 每个功能模块独立分支，完成后 PR 合入 `develop`
- PR 至少 1 人 Code Review 通过才能合并
- 不允许直接 push 到 `develop` / `main`


---

## 16. MVP 验收标准

- [ ] 能成功创建支付并推进到 COMPLETED
- [ ] 余额不足时返回 INSUFFICIENT_FUNDS，不产生支付记录
- [ ] 重复 idempotencyKey 返回已有支付，不重复创建
- [ ] 非法状态迁移请求返回 INVALID_STATUS_TRANSITION
- [ ] 支付不存在时返回 PAYMENT_NOT_FOUND
- [ ] 所有错误返回统一 JSON 结构，不暴露堆栈
- [ ] 支持按状态筛选支付列表
- [ ] 查询历史接口返回完整状态变更记录
- [ ] 单元测试覆盖所有校验规则和状态机规则
- [ ] 关键流程有集成测试覆盖

---

## 17. 后续增强方向

| 方向 | 说明 |
|------|------|
| 数据库迁移 | 引入 Flyway 或 Liquibase 管理表结构版本 |
| API 文档 | 引入 SpringDoc / Swagger UI |
| 异步处理 | 模拟发送改为异步，引入消息队列 |
| 分页排序 | 支付列表支持 page / size / sort 参数 |
| 取消支付 | CREATED / VALIDATED 状态下允许取消 |
| 批量支付 | 一次提交多笔，统一状态追踪 |
| 并发锁 | 余额更新引入乐观锁或悲观锁 |
