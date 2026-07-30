const statusMeta = {
  CREATED: {
    label: "Created",
    tone: "info",
    description: "The order has been submitted and is queued for validation."
  },
  VALIDATED: {
    label: "Validated",
    tone: "warning",
    description: "Payment details are validated and moving to the next stage."
  },
  SENT: {
    label: "Processing",
    tone: "progress",
    description: "The order is being processed. Please check back shortly."
  },
  COMPLETED: {
    label: "Completed",
    tone: "success",
    description: "Payment completed successfully and funds were posted."
  },
  FAILED: {
    label: "Needs Attention",
    tone: "danger",
    description: "The payment failed. Review details and retry if needed."
  }
};

const errorTextMap = {
  VALIDATION_FAILED: "Order data is incomplete or invalid. Please review and submit again.",
  INVALID_AMOUNT: "Invalid amount. Use a value greater than 0 with up to two decimals.",
  INVALID_ACCOUNT: "Source or destination account was not found. Please verify both accounts.",
  INVALID_CURRENCY: "This currency is not supported. Please choose a valid currency.",
  INSUFFICIENT_FUNDS: "Insufficient balance in the source account.",
  INVALID_STATUS_TRANSITION: "Order status update failed. Please retry in a moment.",
  DUPLICATE_PAYMENT: "A payment with the same idempotency key already exists.",
  PAYMENT_NOT_FOUND: "Order not found. Please select a valid order from the list.",
  PROCESSING_ERROR: "A processing error occurred. Please try again later.",
  NETWORK_ERROR: "Network issue detected. Please refresh and try again."
};

let paymentCache = [];
let paymentRawCache = [];
let selectedPaymentId = "";
let activeView = "overview";
let currentSort = "createdAtDesc";
let currentUserFilter = "";

const viewMeta = {
  overview: {
    title: "Overview",
    description: "Track platform activity and navigate quickly to key workflows."
  },
  create: {
    title: "Create Payment",
    description: "Enter payment details and submit a new order in seconds."
  },
  balance: {
    title: "Check Balance",
    description: "Verify account funds before sending a payment."
  },
  orders: {
    title: "Order List",
    description: "Review payment status and open any order for full details."
  },
  detail: {
    title: "Order Details",
    description: "Inspect summary, failure reasons, timeline, and technical IDs."
  }
};

function updateTopbar() {
  const meta = viewMeta[activeView] || viewMeta.overview;
  const titleEl = document.getElementById("current-view-title");
  const descEl = document.getElementById("current-view-desc");
  const breadcrumbEl = document.getElementById("breadcrumb");

  if (titleEl) {
    titleEl.textContent = meta.title;
  }
  if (descEl) {
    descEl.textContent = meta.description;
  }
  if (breadcrumbEl) {
    breadcrumbEl.textContent = "SafePay / " + meta.title;
  }
}

function setActiveView(viewName) {
  activeView = viewName || "overview";

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === activeView);
  });

  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === "view-" + activeView);
  });

  updateTopbar();
}

function renderOverviewRecent(list) {
  const container = document.getElementById("overview-recent");
  if (!container) {
    return;
  }

  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><strong>No recent orders</strong><p>Recent payments will appear here once transactions are created.</p></div>';
    return;
  }

  container.innerHTML = list.slice(0, 4).map((payment) => {
    return ''
      + '<button type="button" class="recent-order-item" data-payment-id="' + escapeHtml(payment.id || "") + '">'
      + '  <div class="recent-order-top">'
      + '    <strong>' + escapeHtml(buildOrderNumber(payment)) + '</strong>'
      + '    ' + renderStatusBadge(payment.status)
      + '  </div>'
      + '  <div class="recent-order-route">' + escapeHtml(payment.sourceAccount || "—") + ' → ' + escapeHtml(payment.destinationAccount || "—") + '</div>'
      + '  <div class="recent-order-bottom">'
      + '    <span class="recent-order-meta">' + escapeHtml(formatDate(payment.createdAt)) + '</span>'
      + '    <strong>' + escapeHtml(formatAmount(payment.amount, payment.currency)) + '</strong>'
      + '  </div>'
      + '</button>';
  }).join("");

  container.querySelectorAll("[data-payment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      loadPaymentDetail(button.dataset.paymentId, { openView: true });
    });
  });
}

function renderOverviewHealth(list) {
  const container = document.getElementById("overview-health");
  if (!container) {
    return;
  }

  const failed = list.filter((item) => item.status === "FAILED").length;
  const processing = list.filter((item) => item.status !== "FAILED" && item.status !== "COMPLETED").length;
  const completed = list.filter((item) => item.status === "COMPLETED").length;

  const tips = [
    {
      title: "Order Health",
      tone: failed ? "danger" : "success",
      text: failed ? "Failed orders detected. Open Order Details to review specific causes." : "No failed orders right now. Payment flow is healthy."
    },
    {
      title: "Orders in Progress",
      tone: processing ? "progress" : "info",
      text: processing ? processing + " orders are still processing. Keep monitoring from the Order List." : "No orders are currently processing. You can create new payments."
    },
    {
      title: "Completion",
      tone: completed ? "success" : "warning",
      text: completed ? completed + " orders completed successfully." : "No successful orders yet. You can submit a test payment first."
    }
  ];

  container.innerHTML = tips.map((tip) => {
    return ''
      + '<div class="health-item">'
      + '  <div class="health-item-head">'
      + '    <strong>' + escapeHtml(tip.title) + '</strong>'
      +      renderStatusBadge(tip.tone === "danger" ? "FAILED" : tip.tone === "success" ? "COMPLETED" : tip.tone === "progress" ? "SENT" : "CREATED")
      + '  </div>'
      + '  <p>' + escapeHtml(tip.text) + '</p>'
      + '</div>';
  }).join("");
}

function updateSidebarSummary(list) {
  const totalEl = document.getElementById("sidebar-total-orders");
  const statusEl = document.getElementById("sidebar-status-text");
  if (!totalEl || !statusEl) {
    return;
  }

  totalEl.textContent = String(list.length) + " orders";

  const failed = list.filter((item) => item.status === "FAILED").length;
  const processing = list.filter((item) => item.status !== "FAILED" && item.status !== "COMPLETED").length;

  if (!list.length) {
    statusEl.textContent = "No orders available yet";
  } else if (failed) {
    statusEl.textContent = failed + " order(s) need attention. Open details to investigate.";
  } else if (processing) {
    statusEl.textContent = processing + " order(s) are in progress.";
  } else {
    statusEl.textContent = "All orders look stable. Ready for new payments.";
  }
}

function bindWorkspaceNav() {
  document.querySelectorAll("[data-view-target]").forEach((element) => {
    element.addEventListener("click", () => {
      const target = element.dataset.viewTarget;
      if (target) {
        if (target === "detail" && !selectedPaymentId) {
          renderEmptyDetail();
        }
        setActiveView(target);
      }
    });
  });

}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function api(url, options) {
  const res = await fetch(url, options);
  const raw = await res.text();

  if (!raw) {
    return {
      code: res.ok ? 200 : res.status,
      msg: res.ok ? "OK" : res.statusText,
      data: null
    };
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("The API returned an unreadable response format.");
  }
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) {
    return value ? String(value) : "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatAmount(amount, currency) {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);
  if (Number.isNaN(number)) {
    return escapeHtml(amount) + (currency ? " " + escapeHtml(currency) : "");
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  } catch (err) {
    return number.toFixed(2) + (currency ? " " + currency : "");
  }
}

function formatNumber(amount) {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);
  return Number.isNaN(number)
    ? String(amount)
    : new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
}

function generateOrderKey() {
  return "order-" + Date.now();
}

function buildOrderNumber(payment) {
  const date = parseDate(payment && payment.createdAt);
  const datePart = date
    ? [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("")
    : String(new Date().getFullYear()) + "0000";

  const raw = String((payment && (payment.id || payment.idempotencyKey)) || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const suffix = raw.slice(-6).padStart(6, "0");
  return "SP-" + datePart + "-" + suffix;
}

function getStatusMeta(status) {
  return statusMeta[String(status || "").toUpperCase()] || {
    label: status || "Unknown",
    tone: "info",
    description: "Order status is recorded. Open details for more context."
  };
}

function renderStatusBadge(status) {
  const meta = getStatusMeta(status);
  return '<span class="status-badge ' + meta.tone + '">' + escapeHtml(meta.label) + "</span>";
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });
}

function dateScore(value) {
  const date = parseDate(value);
  return date ? date.getTime() : 0;
}

function sortPayments(list, sortMode) {
  const sorted = Array.isArray(list) ? list.slice() : [];
  sorted.sort((left, right) => {
    if (sortMode === "createdAtAsc") {
      return dateScore(left.createdAt) - dateScore(right.createdAt);
    }
    if (sortMode === "idAsc") {
      return compareText(left.id, right.id);
    }
    if (sortMode === "idDesc") {
      return compareText(right.id, left.id);
    }
    if (sortMode === "keyAsc") {
      return compareText(left.idempotencyKey, right.idempotencyKey);
    }
    if (sortMode === "keyDesc") {
      return compareText(right.idempotencyKey, left.idempotencyKey);
    }
    return dateScore(right.createdAt) - dateScore(left.createdAt);
  });
  return sorted;
}

function renderUserFilter(list) {
  const select = document.getElementById("userFilter");
  if (!select) {
    return;
  }

  const previous = select.value;
  const accounts = Array.from(new Set(
    (Array.isArray(list) ? list : [])
      .map((item) => item && item.sourceAccount ? String(item.sourceAccount).trim() : "")
      .filter((value) => value)
  )).sort((a, b) => compareText(a, b));

  const options = ['<option value="">Select user account (required for details)</option>'];
  accounts.forEach((account) => {
    options.push('<option value="' + escapeHtml(account) + '">' + escapeHtml(account) + "</option>");
  });
  select.innerHTML = options.join("");

  if (previous && accounts.includes(previous)) {
    select.value = previous;
  }
}

function isUserSelectedForDetails() {
  const select = document.getElementById("userFilter");
  return !!(select && select.value);
}

function translateErrorCode(code, fallbackMessage) {
  if (code && errorTextMap[code]) {
    return errorTextMap[code];
  }

  if (!fallbackMessage) {
    return "This request has been recorded. Check Order Details for diagnosis and next steps.";
  }

  const message = String(fallbackMessage);
  if (/duplicate/i.test(message)) {
    return errorTextMap.DUPLICATE_PAYMENT;
  }
  if (/insufficient/i.test(message)) {
    return errorTextMap.INSUFFICIENT_FUNDS;
  }
  if (/currency/i.test(message)) {
    return errorTextMap.INVALID_CURRENCY;
  }
  if (/account/i.test(message)) {
    return errorTextMap.INVALID_ACCOUNT;
  }
  if (/amount/i.test(message)) {
    return errorTextMap.INVALID_AMOUNT;
  }
  return message;
}

function translateHistoryNote(note, errorCode) {
  if (errorCode) {
    return translateErrorCode(errorCode, note);
  }
  if (!note) {
    return "This stage has been processed successfully.";
  }

  const lower = String(note).toLowerCase();
  if (lower.includes("source account not found")) {
    return "Source account not found. Please verify the source account number.";
  }
  if (lower.includes("destination account not found")) {
    return "Destination account not found. Please verify the destination account number.";
  }
  if (lower.includes("insufficient balance")) {
    return "Insufficient source balance. The order was stopped.";
  }
  if (lower.includes("balance deduction failed")) {
    return "Balance changed during debit. The payment was not completed.";
  }
  if (lower.includes("credit update affected 0 rows") || lower.includes("destination account missing before credit")) {
    return "An issue occurred during crediting. Funds were not posted.";
  }
  if (lower.includes("invalid idempotency key")) {
    return "Invalid idempotency key. Generate a new key and retry.";
  }
  if (lower.includes("source and destination are same")) {
    return "Source and destination accounts cannot be the same.";
  }
  if (lower.includes("unsupported currency")) {
    return "Unsupported currency. Please choose a supported option.";
  }
  if (lower.includes("amount is zero or negative")) {
    return "Amount must be greater than 0.";
  }
  if (lower.includes("amount exceeds max limit")) {
    return "Amount exceeds the single-transfer limit. Split the payment and retry.";
  }
  if (lower.includes("amount has more than 2 decimals")) {
    return "Amount supports up to two decimal places.";
  }
  return String(note);
}

function renderInfoItems(items) {
  return items
    .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
    .map((item) => {
      return ''
        + '<div class="result-item">'
        + '<span>' + escapeHtml(item.label) + '</span>'
        + '<strong>' + escapeHtml(item.value) + '</strong>'
        + '</div>';
    })
    .join("");
}

function renderPanel(element, options) {
  element.className = "result-panel " + (options.tone || "neutral");
  element.innerHTML = ''
    + '<div class="result-header">'
    + '  <div>'
    + '    <h3>' + escapeHtml(options.title) + '</h3>'
    + '    <p>' + escapeHtml(options.description || "") + '</p>'
    + '  </div>'
    + '  ' + (options.badgeHtml || "")
    + '</div>'
    + '<div class="result-grid">' + renderInfoItems(options.items || []) + '</div>';
}

function renderCreatePlaceholder() {
  const result = document.getElementById("create-result");
  result.className = "result-panel neutral";
  result.innerHTML = ''
    + '<div class="result-empty">'
    + '  <strong>Waiting for payment submission</strong>'
    + '  <p>After submission, a clear payment summary will appear here.</p>'
    + '</div>';
}

function renderBalancePlaceholder() {
  const result = document.getElementById("balance-result");
  result.className = "result-panel neutral";
  result.innerHTML = ''
    + '<div class="result-empty">'
    + '  <strong>No balance query yet</strong>'
    + '  <p>Enter an account number to view the latest available balance.</p>'
    + '</div>';
}

function renderEmptyDetail() {
  const detail = document.getElementById("order-detail");
  detail.className = "detail-shell is-empty";
  detail.innerHTML = ''
    + '<div class="empty-state">'
    + '  <strong>Select a user, then click an order row</strong>'
    + '  <p>Order Details is available only from Order List row clicks after a user account is selected.</p>'
    + '</div>';
}

function renderLoadingDetail() {
  const detail = document.getElementById("order-detail");
  detail.className = "detail-shell";
  detail.innerHTML = ''
    + '<div class="empty-state">'
    + '  <strong>Loading order details</strong>'
    + '  <p>Please wait while we gather timeline and summary information.</p>'
    + '</div>';
}

function renderDetailError(message) {
  const detail = document.getElementById("order-detail");
  detail.className = "detail-shell";
  detail.innerHTML = ''
    + '<div class="empty-state">'
    + '  <strong>Unable to display order details</strong>'
    + '  <p>' + escapeHtml(message) + '</p>'
    + '</div>';
}

function updateStats(list) {
  const stats = list.reduce((acc, item) => {
    acc.total += 1;
    if (item.status === "COMPLETED") {
      acc.completed += 1;
    } else if (item.status === "FAILED") {
      acc.failed += 1;
    } else {
      acc.processing += 1;
    }
    return acc;
  }, {
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0
  });

  document.getElementById("stat-total").textContent = String(stats.total);
  document.getElementById("stat-processing").textContent = String(stats.processing);
  document.getElementById("stat-completed").textContent = String(stats.completed);
  document.getElementById("stat-failed").textContent = String(stats.failed);

  updateSidebarSummary(list);
  renderOverviewRecent(list);
  renderOverviewHealth(list);
}

function renderPayments(list) {
  const tbody = document.querySelector("#payment-table tbody");

  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No orders found</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  list.forEach((payment) => {
    const tr = document.createElement("tr");
    if (payment.id === selectedPaymentId) {
      tr.classList.add("is-selected");
    }

    tr.innerHTML = ''
      + '<td>'
      + '  <div class="order-main">'
      + '    <strong>' + escapeHtml(buildOrderNumber(payment)) + '</strong>'
      + '    <span class="order-subtle">Idempotency Key: ' + escapeHtml(payment.idempotencyKey || "Not provided") + '</span>'
      + '  </div>'
      + '</td>'
      + '<td>'
      + '  <div class="route-cell">'
      + '    <span>' + escapeHtml(payment.sourceAccount || "—") + '</span>'
      + '    <span class="route-arrow">→</span>'
      + '    <span>' + escapeHtml(payment.destinationAccount || "—") + '</span>'
      + '  </div>'
      + '</td>'
      + '<td><span class="order-note">' + escapeHtml(payment.reference || "No reference") + '</span></td>'
      + '<td><span class="amount-strong">' + escapeHtml(formatAmount(payment.amount, payment.currency)) + '</span></td>'
      + '<td>' + renderStatusBadge(payment.status) + '</td>'
      + '<td>' + escapeHtml(formatDate(payment.createdAt)) + '</td>'
      + '<td><button type="button" class="ghost-button">View details</button></td>';

    tr.addEventListener("click", () => {
      if (!isUserSelectedForDetails()) {
        setActiveView("orders");
        renderDetailError("Please select a user account in Order List before opening details.");
        return;
      }
      loadPaymentDetail(payment.id, { openView: true });
    });

    const actionButton = tr.querySelector("button");
    actionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!isUserSelectedForDetails()) {
        setActiveView("orders");
        renderDetailError("Please select a user account in Order List before opening details.");
        return;
      }
      loadPaymentDetail(payment.id, { openView: true });
    });

    tbody.appendChild(tr);
  });
}

function renderTimeline(history) {
  if (!history.length) {
    return ''
      + '<div class="empty-state">'
      + '  <strong>No timeline records yet</strong>'
      + '  <p>No additional status transitions are available for this order yet.</p>'
      + '</div>';
  }

  return '<ol class="timeline">' + history.map((item) => {
    const toStatus = getStatusMeta(item.toStatus);
    const fromStatus = item.fromStatus ? getStatusMeta(item.fromStatus).label : "Processing started";
    return ''
      + '<li class="timeline-item">'
      + '  <strong>' + escapeHtml(toStatus.label) + '</strong>'
      + '  <p>' + escapeHtml(translateHistoryNote(item.note, item.errorCode) || toStatus.description) + '</p>'
      + '  <div class="timeline-meta">'
      + '    <span>' + escapeHtml(fromStatus) + ' → ' + escapeHtml(toStatus.label) + '</span>'
      + '    <span>' + escapeHtml(formatDate(item.createdAt)) + '</span>'
      + '  </div>'
      + '</li>';
  }).join("") + '</ol>';
}

function renderDetail(payment, history) {
  const detail = document.getElementById("order-detail");
  const status = getStatusMeta(payment.status);
  const issueText = payment.status === "FAILED"
    ? translateErrorCode(payment.errorCode, payment.errorMessage)
    : status.description;
  const errorBlock = payment.status === "FAILED"
    ? ''
      + '<div class="error-detail">'
      + '  <strong>Failure Reason</strong>'
      + '  <div>' + escapeHtml(issueText) + '</div>'
      + '  <code>ErrorCode: ' + escapeHtml(payment.errorCode || "UNKNOWN") + '</code>'
      + (payment.errorMessage ? '<div style="margin-top: 6px;">Raw message: ' + escapeHtml(payment.errorMessage) + '</div>' : '')
      + '</div>'
    : "";

  detail.className = "detail-shell";
  detail.innerHTML = ''
    + '<div class="detail-hero">'
    + '  <div>'
    + '    <h3>' + escapeHtml(buildOrderNumber(payment)) + '</h3>'
    + '    <p>' + escapeHtml(issueText) + '</p>'
    + '  </div>'
    + '  <div class="detail-side">'
    + '    ' + renderStatusBadge(payment.status)
    + '    <span class="metric">' + escapeHtml(formatAmount(payment.amount, payment.currency)) + '</span>'
    + '  </div>'
    + '</div>'
    + '<div class="detail-grid">'
    + '  <div class="detail-item"><span>Source Account</span><strong>' + escapeHtml(payment.sourceAccount || "—") + '</strong></div>'
    + '  <div class="detail-item"><span>Destination Account</span><strong>' + escapeHtml(payment.destinationAccount || "—") + '</strong></div>'
    + '  <div class="detail-item"><span>Created At</span><strong>' + escapeHtml(formatDate(payment.createdAt)) + '</strong></div>'
    + '  <div class="detail-item"><span>Updated At</span><strong>' + escapeHtml(formatDate(payment.updatedAt)) + '</strong></div>'
    + '  <div class="detail-item"><span>Idempotency Key</span><strong>' + escapeHtml(payment.idempotencyKey || "Not provided") + '</strong></div>'
    + '  <div class="detail-item"><span>Error Code</span><strong>' + escapeHtml(payment.errorCode || "None") + '</strong></div>'
    + '</div>'
    + '<div class="detail-note"><strong>Reference</strong><p>' + escapeHtml(payment.reference || "No reference was provided for this order.") + '</p></div>'
    + errorBlock
    + '<div class="history-block"><h4>Processing Timeline</h4>' + renderTimeline(history) + '</div>'
    + '<details class="technical-panel">'
    + '  <summary>View technical order ID</summary>'
    + '  <p>' + escapeHtml(payment.id || "—") + '</p>'
    + '</details>';
}


async function loadPaymentDetail(paymentId, options = {}) {
  if (!paymentId) {
    renderEmptyDetail();
    return;
  }

  if (!isUserSelectedForDetails()) {
    renderDetailError("Please select a user account in Order List before opening details.");
    return;
  }

  selectedPaymentId = paymentId;
  renderPayments(paymentCache);
  renderLoadingDetail();

  try {
    const [paymentResp, historyResp] = await Promise.all([
      api("/api/payments/" + encodeURIComponent(paymentId)),
      api("/api/payments/" + encodeURIComponent(paymentId) + "/history")
    ]);

    if (paymentResp.code !== 200) {
      renderDetailError(translateErrorCode(paymentResp.errorCode, paymentResp.msg));
      return;
    }

    renderDetail(paymentResp.data || {}, Array.isArray(historyResp.data) ? historyResp.data : []);
    renderPayments(paymentCache);
    if (options.openView) {
      setActiveView("detail");
    }
  } catch (err) {
    console.error(err);
    renderDetailError("Failed to load order details. Please try again shortly.");
  }
}

async function loadPayments(preferredSelectionId) {
  const status = document.getElementById("statusFilter").value;
  const userFilterSelect = document.getElementById("userFilter");
  const sortSelect = document.getElementById("orderSort");
  currentSort = sortSelect && sortSelect.value ? sortSelect.value : currentSort;
  const url = status ? "/api/payments?status=" + encodeURIComponent(status) : "/api/payments";
  const data = await api(url);

  if (data.code !== 200) {
    throw new Error(translateErrorCode(data.errorCode, data.msg));
  }

  paymentRawCache = Array.isArray(data.data) ? data.data : [];
  renderUserFilter(paymentRawCache);
  currentUserFilter = userFilterSelect && userFilterSelect.value ? userFilterSelect.value : "";

  const filteredByUser = currentUserFilter
    ? paymentRawCache.filter((item) => String(item.sourceAccount || "") === currentUserFilter)
    : paymentRawCache;

  updateStats(filteredByUser);
  paymentCache = sortPayments(filteredByUser, currentSort);
  renderPayments(paymentCache);

  if (!paymentCache.length || !selectedPaymentId || !paymentCache.some((item) => item.id === selectedPaymentId)) {
    selectedPaymentId = "";
    renderEmptyDetail();
    return;
  }

  if (preferredSelectionId && paymentCache.some((item) => item.id === preferredSelectionId)) {
    selectedPaymentId = preferredSelectionId;
  }

  renderPayments(paymentCache);
}

function bindCreatePayment() {
  const form = document.getElementById("payment-form");
  const result = document.getElementById("create-result");
  const keyInput = document.getElementById("idempotencyKey");

  document.getElementById("gen-key").addEventListener("click", () => {
    keyInput.value = generateOrderKey();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      idempotencyKey: keyInput.value.trim(),
      sourceAccount: document.getElementById("sourceAccount").value.trim(),
      destinationAccount: document.getElementById("destinationAccount").value.trim(),
      amount: Number(document.getElementById("amount").value),
      currency: document.getElementById("currency").value,
      reference: document.getElementById("reference").value.trim() || null
    };

    try {
      const data = await api("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (data.code === 200 && data.data) {
        const payment = data.data;
        renderPanel(result, {
          tone: payment.status === "FAILED" ? "error" : payment.status === "COMPLETED" ? "success" : "info",
          title: "Submitted",
          description: payment.status === "FAILED"
            ? translateErrorCode(payment.errorCode, payment.errorMessage)
            : getStatusMeta(payment.status).description,
          badgeHtml: renderStatusBadge(payment.status),
          items: [
            { label: "Order No.", value: buildOrderNumber(payment) },
            { label: "Amount", value: formatAmount(payment.amount, payment.currency) },
            { label: "Source Account", value: payment.sourceAccount || "—" },
            { label: "Destination Account", value: payment.destinationAccount || "—" }
          ]
        });

        document.getElementById("statusFilter").value = "";
        document.getElementById("reference").value = "";
        document.getElementById("amount").value = "";
        keyInput.value = generateOrderKey();

        await loadPayments(payment.id);
        setActiveView("orders");
        return;
      }

      renderPanel(result, {
        tone: "error",
        title: "Submission failed",
        badgeHtml: '<span class="status-badge danger">Failed</span>',
        items: [
          { label: "Source Account", value: payload.sourceAccount || "—" }
        ]
      });
    } catch (err) {
      console.error(err);
      renderPanel(result, {
        tone: "error",
        title: "Unexpected error",
        badgeHtml: '<span class="status-badge danger">Error</span>',
        items: []
      });
    }
  });
}

function bindPaymentList() {
  const form = document.getElementById("payment-list-form");
  const sortSelect = document.getElementById("orderSort");
  const userFilterSelect = document.getElementById("userFilter");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setActiveView("orders");
      await loadPayments();
    } catch (err) {
      console.error(err);
      renderDetailError("Failed to refresh the order list. Please try again.");
    }
  });

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value || "createdAtDesc";
      const filteredByUser = currentUserFilter
        ? paymentRawCache.filter((item) => String(item.sourceAccount || "") === currentUserFilter)
        : paymentRawCache;
      paymentCache = sortPayments(filteredByUser, currentSort);
      renderPayments(paymentCache);
    });
  }

  if (userFilterSelect) {
    userFilterSelect.addEventListener("change", async () => {
      currentUserFilter = userFilterSelect.value || "";
      selectedPaymentId = "";
      renderEmptyDetail();
      try {
        await loadPayments();
      } catch (err) {
        console.error(err);
        renderDetailError("Failed to refresh the order list. Please try again.");
      }
    });
  }
}

function bindBalance() {
  const form = document.getElementById("balance-form");
  const result = document.getElementById("balance-result");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const accountNo = document.getElementById("accountNo").value.trim();

    if (!accountNo) {
      renderPanel(result, {
        tone: "error",
        title: "Unable to check balance",
        description: "Please enter an account number.",
        badgeHtml: '<span class="status-badge danger">Missing input</span>',
        items: []
      });
      return;
    }

    try {
      const data = await api("/api/accounts/" + encodeURIComponent(accountNo) + "/balance");

       if (data.code !== 200) {
         renderPanel(result, {
           tone: "error",
           title: "Balance query failed",
           badgeHtml: '<span class="status-badge danger">Failed</span>',
           items: []
         });
         return;
       }

       renderPanel(result, {
         tone: "info",
         title: "Balance updated",
         badgeHtml: '<span class="status-badge info">Updated</span>',
         items: [
           { label: "Available Balance", value: formatNumber(data.data) }
         ]
       });
    } catch (err) {
      console.error(err);
      renderPanel(result, {
        tone: "error",
        title: "Unable to check balance",
        description: "A network or service error occurred. Please try again later.",
        badgeHtml: '<span class="status-badge danger">Error</span>',
        items: [{ label: "Account Number", value: accountNo }]
      });
    }
  });
}

async function init() {
  bindWorkspaceNav();
  setActiveView("overview");
  renderCreatePlaceholder();
  renderBalancePlaceholder();
  renderEmptyDetail();
  bindCreatePayment();
  bindPaymentList();
  bindBalance();
  document.getElementById("idempotencyKey").value = generateOrderKey();
  await loadPayments();
}

init().catch((err) => {
  console.error(err);
  renderDetailError("Page initialization failed. Please refresh and try again.");
});

