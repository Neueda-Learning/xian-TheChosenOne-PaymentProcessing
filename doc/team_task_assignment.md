# SafePay 项目小组分工文档

> **项目名称：** SafePay 支付处理系统  
> **技术栈：** Java 17 · Spring Boot 4 · MyBatis · MySQL · HTML / CSS / JS  
> **团队人数：** 4 人  
> **分工原则：** 每人负责量相当的后端 + 前端 + 测试 + 文档工作，不做单纯的"后端 / 前端"割裂分配。

---

## 一、项目整体功能地图

```text
┌─────────────────────────────────────────────────┐
│                  SafePay 系统                    │
├─────────┬──────────────┬───────────┬────────────┤
│ 模块 A  │    模块 B    │  模块 C   │   模块 D   │
│ 支付创建 │  失败与错误   │  查询与   │  幂等与    │
│ 与状态机 │  处理 & 审计 │ 账户余额  │  测试保障  │
└─────────┴──────────────┴───────────┴────────────┘
```

---

## 二、各成员职责详表

### 成员 A — 支付创建与状态机（Payment Creation & State Machine）

**负责范围：整个支付成功路径的端到端实现 + 项目公共基础搭建**

#### 后端任务

| 编号 | 任务 | 涉及文件 | 完成标准 |
|------|------|---------|---------|
| A-1 | 项目脚手架搭建 | `SafepayApplication.java`、`pom.xml`、包结构 | 项目能启动，端口 8080 可访问 |
| A-2 | 公共枚举与响应类 | `ErrorCode.java`、`Result.java` | 全组统一使用，不允许重复定义 |
| A-3 | 支付创建核心流程 | `PaymentService.createPayment()` 成功路径 | CREATED→VALIDATED→SENT→COMPLETED 全部走通 |
| A-4 | Payment 实体与 Mapper | `Payment.java`、`PaymentMapper.java`、`PaymentMapper.xml` | insert、selectById、selectAll、selectByStatus、selectByIdempotencyKey 均可用 |
| A-5 | 余额预留与 RESERVE 分录 | `AccountMapper.deductBalance()`、`BalanceLedger` 写入 | 支付成功后源账户余额正确扣减，balance_ledger 有 RESERVE + DEBIT + CREDIT 三条记录 |
| A-6 | PaymentController（POST 接口） | `PaymentController.java` | `POST /api/payments` 返回完整 Payment 对象 |

#### 前端任务

| 编号 | 任务 | 涉及文件 |
|------|------|---------|
| A-7 | 创建支付表单（含幂等键自动生成按钮） | `index.html`（Create Payment 区块）、`app.js`（`bindCreatePayment()`） |
| A-8 | 提交成功后自动刷新支付列表 | `app.js`（`loadPayments()` 调用） |

#### 测试任务

| 编号 | 测试场景 |
|------|---------|
| A-T1 | 正常支付全流程：POST → 返回 `status=COMPLETED`，余额已扣减 |
| A-T2 | 检查 `balance_ledger` 有 RESERVE + DEBIT + CREDIT 三条记录 |

---

### 成员 B — 失败处理、错误码与审计轨迹（Failure Handling & Audit Trail）

**负责范围：所有失败分支 + 审计历史记录 + 数据库脚本**

#### 后端任务

| 编号 | 任务 | 涉及文件 | 完成标准 |
|------|------|---------|---------|
| B-1 | 数据库建表脚本与测试数据 | `doc/payment.sql` | 4 张表建好，含索引；至少插入 5 个测试账户 |
| B-2 | 输入校验失败路径 | `PaymentService.validateRequest()` → 写 `payment_history` CREATED→FAILED | 金额为零/负/超精度、币种不支持、源=目标账户，均返回 400 + 正确错误码，且 DB 有记录 |
| B-3 | 账户不存在失败路径 | `PaymentService` 账户检查分支 | `INVALID_ACCOUNT` 返回 400，DB 有 FAILED 记录 |
| B-4 | 余额不足失败路径 | `PaymentService` 余额检查分支 | `INSUFFICIENT_FUNDS` 返回 400，DB 有 FAILED 记录 |
| B-5 | 并发余额保护（`deductBalance` 0 行影响）| `PaymentService` Step 7 失败分支 | VALIDATED→FAILED，RELEASE 分录写入 `balance_ledger` |
| B-6 | PaymentHistory 实体与 Mapper | `PaymentHistory.java`、`PaymentHistoryMapper.java`、`PaymentHistoryMapper.xml` | insert、selectByPaymentId（按 created_at ASC + id ASC 排序）均可用 |
| B-7 | 全局异常处理器 | `GlobalExceptionHandler.java`、`BusinessException.java` | 所有 BusinessException、DataAccessException、Exception 均统一格式响应，不暴露堆栈 |
| B-8 | writeHistory 写历史（每步时间间隔） | `PaymentService.writeHistory()` + `pauseForHistoryVisibility()` | 每条历史 `created_at` 不同秒，查询历史可看到清晰时间线 |

#### 前端任务

| 编号 | 任务 | 涉及文件 |
|------|------|---------|
| B-9 | 错误响应时红色显示错误信息 | `app.js`（`setResult()` 的 `.err` 样式）、`styles.css`（`--err` 颜色） |
| B-10 | 支付列表中 FAILED 行高亮展示 Error Code 列 | `app.js`（`renderPayments()`） |

#### 测试任务

| 编号 | 测试场景 |
|------|---------|
| B-T1 | 金额为 0 → 400 + `INVALID_AMOUNT`，DB 有 FAILED 记录 |
| B-T2 | 账户不存在 → 400 + `INVALID_ACCOUNT`，DB 有 FAILED 记录 |
| B-T3 | 余额不足 → 400 + `INSUFFICIENT_FUNDS`，DB 有 FAILED 记录 |
| B-T4 | 所有失败情况历史记录时间戳均不相同 |

---

### 成员 C — 查询接口与账户余额（Query APIs & Account Balance）

**负责范围：所有 GET 接口 + 账户模块 + 前端展示**

#### 后端任务

| 编号 | 任务 | 涉及文件 | 完成标准 |
|------|------|---------|---------|
| C-1 | 查询单笔支付 | `PaymentQueryService.getPaymentById()`、`PaymentMapper.selectById()` | `GET /api/payments/{id}` 返回完整 Payment，不存在返回 404 |
| C-2 | 支付列表（全部 + 按状态筛选） | `PaymentQueryService.getPayments()`、`PaymentMapper.selectAll/selectByStatus()` | `GET /api/payments?status=FAILED` 只返回 FAILED 的记录 |
| C-3 | 支付历史查询 | `PaymentQueryService.getPaymentHistory()` | `GET /api/payments/{id}/history` 按时间顺序返回所有状态迁移 |
| C-4 | 账户余额查询 | `AccountController.java`、`PaymentQueryService.getAccountBalance()`、`AccountMapper.selectByAccountNo()` | `GET /api/accounts/{accountNo}/balance` 返回余额数字，账户不存在返回 400 |
| C-5 | Account 实体与 Mapper | `Account.java`、`AccountMapper.java`、`AccountMapper.xml` | selectByAccountNo、deductBalance、increaseBalance 均可用 |
| C-6 | PaymentQueryService 完整实现 | `PaymentQueryService.java` | 包含 getPaymentById、getPayments、getPaymentHistory、getAccountBalance |

#### 前端任务

| 编号 | 任务 | 涉及文件 |
|------|------|---------|
| C-7 | 支付列表表格（含状态筛选下拉） | `index.html`（List Payments 区块）、`app.js`（`renderPayments()`、`loadPayments()`、`bindPaymentList()`） |
| C-8 | 点击表格行自动填充 Payment ID | `app.js`（行点击事件） |
| C-9 | 按 ID 查询单笔支付 | `index.html`（Get Payment By ID 区块）、`app.js`（`bindPaymentById()`） |
| C-10 | 账户余额查询面板 | `index.html`（Account Balance 区块）、`app.js`（`bindBalance()`） |

#### 测试任务

| 编号 | 测试场景 |
|------|---------|
| C-T1 | 按状态 COMPLETED 筛选，只返回 COMPLETED 的支付 |
| C-T2 | 查询不存在的 Payment ID → 404 |
| C-T3 | 查询历史接口返回完整的状态迁移列表，顺序正确 |
| C-T4 | 查询不存在的账户余额 → 400 |

---

### 成员 D — 幂等保障、Swagger 文档与集成测试（Idempotency & Testing）

**负责范围：幂等机制 + API 文档配置 + 整套集成测试**

#### 后端任务

| 编号 | 任务 | 涉及文件 | 完成标准 |
|------|------|---------|---------|
| D-1 | 幂等检查逻辑 | `PaymentService.createPayment()` Step 2 | 相同 idempotencyKey 第二次请求返回已有 Payment，不创建新记录 |
| D-2 | idempotency_key 唯一约束 | `doc/payment.sql`（UNIQUE KEY） | 并发同 key 请求，数据库层兜底防重复 |
| D-3 | MyBatis 配置（UUID TypeHandler） | `MyBatisConfig.java`、`UuidTypeHandler.java` | 所有 UUID 字段正确序列化/反序列化，无类型映射报错 |
| D-4 | Swagger / OpenAPI 配置 | `SwaggerConfig.java`、`application.yml`（springdoc 配置） | 访问 `http://localhost:8080/swagger-ui.html` 可看到所有接口文档 |
| D-5 | 日志配置 | `logback-spring.xml`、`application.yml`（logging 配置） | 控制台和 `logs/safepay.log` 均有结构化日志输出 |
| D-6 | BalanceLedger 实体与 Mapper | `BalanceLedger.java`、`BalanceLedgerMapper.java`、`BalanceLedgerMapper.xml` | insert、selectByPaymentId 可用 |

#### 前端任务

| 编号 | 任务 | 涉及文件 |
|------|------|---------|
| D-7 | 支付历史时间线面板 | `index.html`（Payment History 区块）、`app.js`（`renderHistory()`、`bindHistory()`） |
| D-8 | 整体页面样式与主题 | `styles.css`（暗色主题、表格、卡片、按钮样式） |

#### 测试任务

| 编号 | 测试场景 |
|------|---------|
| D-T1 | 同一 idempotencyKey 提交两次 → 第二次返回与第一次完全相同的 Payment，DB 无新增记录 |
| D-T2 | 幂等键为空白字符串 → 400 `VALIDATION_FAILED`，DB 有 FAILED 记录 |
| D-T3 | 幂等键超过 64 字符 → 400 `VALIDATION_FAILED` |
| D-T4 | 源账户与目标账户相同 → 400 `INVALID_ACCOUNT` |
| D-T5 | 金额超过 1,000,000 → 400 `INVALID_AMOUNT` |
| D-T6 | 不支持的币种（如 "XXX"）→ 400 `INVALID_CURRENCY` |
| D-T7 | 小数位超过 2 位（如 10.001）→ 400 `INVALID_AMOUNT` |
| D-T8 | 并发场景：两个线程同时用相同 key 创建支付，最终只有一笔 |

---

## 三、工作量对比（一览表）

| 维度 | 成员 A | 成员 B | 成员 C | 成员 D |
|------|--------|--------|--------|--------|
| 后端任务数 | 6 | 8 | 6 | 6 |
| 前端任务数 | 2 | 2 | 4 | 2 |
| 测试用例数 | 2 | 4 | 4 | 8 |
| 代码复杂度 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **综合量** | **均等** | **均等** | **均等** | **均等** |

> 成员 A 核心逻辑最重，公共基础搭建占用量对应减少了功能任务数；成员 D 测试用例最多，弥补了功能代码相对较少的部分。

---

## 四、已完成的模块（现有代码中已实现）

当前代码库已完成的内容可作为参考/基础，各成员认领时根据现有代码情况决定是否重写、优化或直接复用：

| 文件 / 模块 | 状态 | 建议认领人 |
|-------------|------|-----------|
| `PaymentService.createPayment()` 成功路径 | ✅ 已实现 | 成员 A 负责维护 |
| `PaymentService` 失败路径 | ✅ 已实现 | 成员 B 负责维护 |
| `GlobalExceptionHandler.java` | ✅ 已实现 | 成员 B 负责维护 |
| `PaymentQueryService.java` | ✅ 已实现 | 成员 C 负责维护 |
| `AccountController.java` | ✅ 已实现 | 成员 C 负责维护 |
| `PaymentController.java` | ✅ 已实现 | 成员 A 负责维护 |
| 所有 Mapper XML（4 个） | ✅ 已实现 | 各成员按模块维护 |
| `index.html` / `app.js` / `styles.css` | ✅ 已实现 | 按前端任务表分工 |
| `SwaggerConfig.java` | ✅ 已实现 | 成员 D 负责维护 |
| `UuidTypeHandler.java` | ✅ 已实现 | 成员 D 负责维护 |

---

## 五、Day 1 必须共同对齐的内容

开始各自开发前，4 人必须一起确认以下约定（建议由成员 A 主持，30 分钟内完成）：

| 序号 | 约定内容 | 当前状态 |
|------|---------|---------|
| 1 | `ErrorCode` 枚举清单（10 个错误码） | ✅ 已定义在 `ErrorCode.java` |
| 2 | `Payment` 实体字段命名 | ✅ 已定义 |
| 3 | 统一响应类 `Result<T>` 结构（code / msg / data） | ✅ 已定义在 `Result.java` |
| 4 | 数据库表结构（4 张表） | ✅ 已定义在 `doc/payment.sql` |
| 5 | `PaymentService` 方法签名 | ✅ 已定义，各成员不得随意修改签名 |
| 6 | Git 分支策略（见下文） | 🔲 待团队确认 |
| 7 | 本地开发环境（JDK 版本 / MySQL 版本） | 🔲 待团队确认 |

---

## 六、Git 分支策略

```text
main
└── develop
    ├── feature/member-a-payment-creation
    ├── feature/member-b-failure-handling
    ├── feature/member-c-query-balance
    └── feature/member-d-idempotency-testing
```

**规则：**
- 每人在自己的 `feature/` 分支开发
- 完成一个完整功能后提 Pull Request 合入 `develop`
- PR 必须至少由 **1 位其他成员 Code Review** 通过后才能合并
- 不允许直接 push 到 `develop` 或 `main`
- 涉及公共文件（`PaymentService.java`、`Result.java`、`ErrorCode.java` 等）修改前，先在群里通知

---

## 七、每日站会模板（每天 15 分钟）

```
1. 我昨天完成了什么？
2. 我今天计划做什么？
3. 有什么阻塞或需要其他人配合的？
```

---

## 八、开发阶段计划

| 阶段 | 内容 | 时间 |
|------|------|------|
| **Day 1** | 环境搭建 + 分工对齐 + 熟悉现有代码 | 第 1 天 |
| **Day 2–3** | 各自核心后端任务（4 模块并行） | 第 2–3 天 |
| **Day 4** | 前端任务 + 单元测试 | 第 4 天 |
| **Day 5** | 4 模块联调 + 集成测试 + Bug 修复 | 第 5 天 |
| **Day 6** | 准备项目展示 PPT + 代码整理 + README | 第 6 天 |

---

## 九、MVP 验收清单（每人自检后打勾）

- [ ] `POST /api/payments` 成功返回 `status=COMPLETED`（成员 A）
- [ ] 失败情况（账户不存在、余额不足、金额无效）返回正确 400 错误码（成员 B）
- [ ] 所有失败情况 DB 有 FAILED 记录（成员 B）
- [ ] `payment_history` 历史记录时间戳各不相同（成员 B）
- [ ] `GET /api/payments?status=FAILED` 只返回失败支付（成员 C）
- [ ] `GET /api/payments/{id}/history` 按时间顺序返回完整历史（成员 C）
- [ ] `GET /api/accounts/{accountNo}/balance` 返回正确余额（成员 C）
- [ ] 相同 `idempotencyKey` 提交两次，第二次返回已有支付（成员 D）
- [ ] `swagger-ui.html` 可正常访问所有接口文档（成员 D）
- [ ] 所有 400/404/500 错误返回统一 `Result` JSON 格式（全员）
- [ ] 前端页面能创建支付、查看列表、查看历史、查询余额（全员）

---

## 十、联系与协作约定

| 事项 | 约定 |
|------|------|
| 代码存放 | 统一 Git 仓库，分支开发 |
| 日常沟通 | 微信 / 群聊，遇到阻塞立即告知 |
| 文档维护 | 各人负责自己模块的注释与 Swagger 注解 |
| 代码规范 | 驼峰命名，Service 不写 SQL，Controller 不写业务逻辑 |
| 问题记录 | 遇到无法解决的问题记录在 `doc/issues.md`（可自建） |

---

*文档版本：v1.0 — 2026-07-28*

