# PaymentService 实现详解（中文）

> 文件位置：`src/main/java/org/tco/safepay/service/PaymentService.java`  
> 本文档按“接近逐行”的粒度解释实现逻辑，并补充设计意图、事务行为、边界场景与可优化点。

---

## 1. 类职责总览

`PaymentService` 是支付核心业务服务，负责：

1. 校验支付请求参数。
2. 做幂等检查（避免重复创建）。
3. 写入支付主表 `payments`。
4. 驱动支付状态流转（`CREATED -> VALIDATED -> SENT -> COMPLETED`）。
5. 在失败场景写入 `FAILED`。
6. 写 `payment_history` 审计轨迹。
7. 写 `balance_ledger` 余额流水并更新账户余额。
8. 在同一个数据库事务内保证一致性（`@Transactional`）。

---

## 2. 代码结构与逐段解释

## 2.1 包与导入（1-20 行）

- **1 行** `package org.tco.safepay.service;`
  - 声明类所在包。
- **3-4 行** Spring 组件与事务注解。
- **5 行** `ErrorCode` 枚举，统一错误码。
- **6-9 行** 四个 Mapper（账户、流水、历史、支付主表）。
- **10-14 行** DTO 与实体模型。
- **16-20 行** JDK 类型：金额、时间、本地化、集合、UUID。

## 2.2 类声明与常量（22-33 行）

- **22 行** `@Service`
  - Spring 托管的业务 Bean。
- **23 行** 类定义。
- **25-27 行** `SUPPORTED_CURRENCIES`
  - 支持币种白名单：USD/EUR/GBP/CNY/JPY/AUD/CAD/CHF/HKD/SGD。
- **28 行** `MAX_AMOUNT = 1000000`
  - 金额上限。
- **30-33 行** 四个 `final` Mapper 依赖。

## 2.3 构造注入（35-43 行）

- 通过构造函数注入 `paymentMapper/paymentHistoryMapper/accountMapper/balanceLedgerMapper`。
- 使用构造注入而不是字段注入，便于测试与不可变依赖管理。

---

## 3. 核心方法 `createPayment` 详解（61-198 行）

## 3.1 事务边界与入口（61-64 行）

- **61 行** `@Transactional`
  - 方法内数据库操作在一个事务中提交。
  - 这保证主表、历史、余额流水的一致性。
- **64 行** `validateRequest(request)`
  - 注意：这里不是直接抛异常，而是返回 `ValidationFailure` 对象（或 `null`）。

## 3.2 幂等检查（66-75 行）

- **67 行** 提取 `rawIdempotencyKey`。
- **68-70 行** 仅在 key 非空且长度 <= 64 时进行幂等查询。
- **71 行** `selectByIdempotencyKey` 查重。
- **72-74 行** 若已存在，直接返回已有支付对象，不重复创建。

## 3.3 先写支付主记录（77-92 行）

- **78 行** `now = LocalDateTime.now()`。
- **79 行** 创建 `Payment` 对象。
- **80 行** 生成支付 UUID。
- **81 行** `normalizeIdempotencyKey`：
  - 合法 key 原样保存；
  - 非法 key 用 `INVALID-<uuid>` 兜底，保证主表 `NOT NULL` + `UNIQUE` 约束可落库。
- **82-83 行** 源/目标账号归一化（空值填占位字符串）。
- **84 行** 金额空值兜底为 `0`。
- **85 行** 币种归一化（空值 `UNK`，并裁剪至最多 3 位）。
- **86 行** 设置备注。
- **87 行** 初始状态 `CREATED`。
- **88-89 行** 设置创建/更新时间。
- **90 行** 插入 `payments`。
- **91 行** 写第一条历史：`null -> CREATED`。
- **92 行** `pauseForHistoryVisibility()`：
  - 主动 sleep 约 1.1 秒，避免历史时间戳落在同一秒。
  - 这是当前“**不改数据库结构**”前提下解决同秒时间问题的手段。

## 3.4 统一处理校验失败（94-102 行）

- **95-98 行** 将主记录更新为 `FAILED`，写错误码/错误信息。
- **99-100 行** 写历史 `CREATED -> FAILED`。
- **101 行** 返回 `payment`（由 Controller 决定响应码）。

## 3.5 账户存在性检查（104-124 行）

- **105 行** 查源账户。
- **106-113 行** 源账户不存在：
  - 更新状态 `FAILED` + `INVALID_ACCOUNT`；
  - 写历史；
  - 返回。
- **114 行** sleep，拉开历史时间。
- **115 行** 查目标账户。
- **116-122 行** 目标账户不存在：同样失败落库。
- **123 行** 再 sleep。

## 3.6 余额检查（125-134 行）

- **126 行** `sourceBalance < amount` 判定余额不足。
- **127-133 行** 余额不足：
  - 更新 `FAILED` + `INSUFFICIENT_FUNDS`；
  - 写历史；
  - 返回。
- **134 行** sleep。

## 3.7 状态迁移：CREATED -> VALIDATED（136-140 行）

- **137 行** `updateStatus(..., VALIDATED)`。
- **138 行** 写历史 `CREATED -> VALIDATED`。
- **139 行** sleep。

## 3.8 余额预留（141-158 行）

- **144 行** `sourceBefore`，扣款前余额快照。
- **145 行** `sourceAfterReserve`，扣款后余额快照。
- **146 行** 执行 `deductBalance(source, amount)`。
  - SQL 层通常带 `balance >= amount` 条件，防并发超扣。
- **147-155 行** 若影响行数 0：
  - 判定并发导致余额不足；
  - 更新状态 `FAILED`；
  - 写历史 `VALIDATED -> FAILED`；
  - 返回。
- **156-157 行** 写余额流水 `RESERVE`。

## 3.9 状态迁移：VALIDATED -> SENT（159-163 行）

- **160 行** 更新状态 `SENT`。
- **161 行** 写历史 `VALIDATED -> SENT`。
- **162 行** sleep。

## 3.10 状态迁移：SENT -> COMPLETED（164-168 行）

- **165 行** 更新状态 `COMPLETED`。
- **166 行** 写历史 `SENT -> COMPLETED`。
- **167 行** sleep。

## 3.11 写 DEBIT 流水（169-172 行）

- 对源账户写 `DEBIT` 流水。
- `before/after` 都是 `sourceAfterReserve`，表示已在预留阶段扣减，记账上再记一次“正式扣款动作”。

## 3.12 目标账户入账（173-195 行）

- **174 行** 重新查目标账户，避免处理过程中的并发删除。
- **175-182 行** 若查不到：
  - 更新 `FAILED` + `INVALID_ACCOUNT`；
  - 写历史 `COMPLETED -> FAILED`（注意这是业务上的补救失败轨迹）；
  - 返回。
- **183-184 行** 计算目标账户入账前后余额。
- **185 行** 执行 `increaseBalance`。
- **186-193 行** 若影响 0 行：
  - 更新失败并写历史。
- **194-195 行** 写 `CREDIT` 流水。

## 3.13 返回结果（197 行）

- 返回最新 `payment` 对象（状态可能是 `COMPLETED` 或 `FAILED`）。

---

## 4. 私有方法详解（202-295 行）

## 4.1 `validateRequest`（202-231 行）

逐项规则：

1. 幂等键：不能为空、不能全空白、长度 <= 64。
2. 源账号不能为空。
3. 目标账号不能为空。
4. 源与目标不能相同。
5. 金额必须 > 0。
6. 金额不能超过 `MAX_AMOUNT`。
7. 金额最多两位小数。
8. 币种必须在白名单中。

返回值：
- 通过返回 `null`。
- 失败返回 `ValidationFailure(errorCode, note)`。

## 4.2 `normalizeIdempotencyKey`（233-238 行）

- 合法 key 原样返回。
- 不合法返回 `INVALID-<uuid去横杠>`。
- 目的：保证失败请求也能落库，满足“每个错误都记录”的审计诉求。

## 4.3 `normalizeRequiredText`（240-242 行）

- 为空时用 `fallback` 填充，避免空值落库失败。

## 4.4 `normalizeCurrency`（244-250 行）

- 空币种映射为 `UNK`。
- 否则转大写，并裁剪到 3 字符。

## 4.5 `ValidationFailure` 记录类型（252-253 行）

- Java Record，简洁携带 `errorCode` 与 `note`。

## 4.6 `updateStatus`（255-260 行）

- 先更新数据库状态。
- 再同步更新内存中的 `payment` 对象字段，确保返回对象与 DB 一致。

## 4.7 `writeHistory`（262-273 行）

- 构建 `PaymentHistory` 实体并插入。
- 关键字段：`fromStatus/toStatus/note/errorCode/createdAt`。
- `createdAt` 使用 `LocalDateTime.now()`。

## 4.8 `pauseForHistoryVisibility`（275-281 行）

- `Thread.sleep(1100)`，强制跨秒。
- 处理中断时恢复线程中断标记。
- 设计目的：在数据库只有秒级时间戳时，历史记录也能“看起来按步骤变化”。

## 4.9 `writeLedger`（283-295 行）

- 写账户流水，包括方向、金额、变更前后余额、时间。
- 对审计与对账非常关键。

---

## 5. 关键设计点与行为说明

## 5.1 为什么先插入 `payments` 再做后续失败判断

这样即使后续失败，也有主记录和历史轨迹，满足“错误可追踪”。

## 5.2 为什么 Controller 还会返回 400

`PaymentService` 返回 `FAILED` 的 payment；`PaymentController` 根据 `errorCode` 映射成 `Result.error(...)`，对外仍是 HTTP 语义上的失败。

## 5.3 为什么当前会变慢

`pauseForHistoryVisibility()` 每次 sleep 1.1 秒，完整成功链路会有多次等待，吞吐下降明显。这个是“不要改库结构”下的折中方案。

---

## 6. 你现在这版 PaymentService 的优点与风险

### 优点

1. 审计完整：成功与失败都写入主表/历史。
2. 幂等可用：重复 key 直接返回已有支付。
3. 并发保护：扣款 SQL 影响行数判断可防超扣。
4. 错误码统一：便于前端展示与自动化测试。

### 风险

1. 性能：sleep 跨秒策略会拉长响应时间。
2. 事务时长增加：更容易占用连接与锁。
3. `COMPLETED -> FAILED` 分支表示“后置失败补偿”，业务语义需团队统一。
4. 如果未来去掉 sleep 而又不改库结构，历史时间仍可能同秒。

---

## 7. 阅读建议（给组内同学）

建议按下面顺序读源码：

1. 先看 `createPayment` 主流程（61-198）。
2. 再看 `validateRequest` 校验规则（202-231）。
3. 最后看 `writeHistory`、`writeLedger`、`updateStatus` 三个核心辅助方法。

这样最容易理解“状态机 + 审计 + 资金流水”的三条主线。

---

## 8. 快速索引

- 主流程入口：`createPayment(...)`
- 请求校验：`validateRequest(...)`
- 状态更新：`updateStatus(...)`
- 历史写入：`writeHistory(...)`
- 历史可见性等待：`pauseForHistoryVisibility()`
- 账本写入：`writeLedger(...)`

---

*文档生成时间：2026-07-28*
