function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function setResult(el, payload, ok) {
  el.textContent = typeof payload === "string" ? payload : pretty(payload);
  el.classList.remove("ok", "err");
  el.classList.add(ok ? "ok" : "err");
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  return data;
}

function money(amount) {
  if (amount === null || amount === undefined) {
    return "";
  }
  const num = Number(amount);
  return Number.isNaN(num) ? String(amount) : num.toFixed(2);
}

function textOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("en-GB", { hour12: false });
}

function statusText(status) {
  const map = {
    CREATED: "Created",
    VALIDATED: "Validated",
    SENT: "Sent",
    COMPLETED: "Completed",
    FAILED: "Failed"
  };
  return map[status] || textOrDash(status);
}

function firstDefined(obj, keys) {
  if (!obj) {
    return "";
  }
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (obj[key] !== null && obj[key] !== undefined && obj[key] !== "") {
      return obj[key];
    }
  }
  return "";
}

function formatPaymentDetail(payment, title) {
  return [
    title,
    "----------------",
    "Payment ID: " + textOrDash(payment.id),
    "Idempotency Key: " + textOrDash(payment.idempotencyKey),
    "From Account: " + textOrDash(payment.sourceAccount),
    "To Account: " + textOrDash(payment.destinationAccount),
    "Amount: " + textOrDash(money(payment.amount)) + " " + textOrDash(payment.currency),
    "Status: " + statusText(payment.status),
    "Error Code: " + textOrDash(payment.errorCode),
    "Reference: " + textOrDash(payment.reference),
    "Created At: " + formatTime(payment.createdAt)
  ].join("\n");
}

function formatApiMessage(resp, successTitle) {
  if (resp && resp.code === 200 && resp.data) {
    return formatPaymentDetail(resp.data, successTitle);
  }
  if (resp && typeof resp === "object") {
    return [
      "Request Failed",
      "----------------",
      "Message: " + textOrDash(resp.msg || resp.message),
      "Code: " + textOrDash(resp.code),
      "Error Code: " + textOrDash(resp.errorCode)
    ].join("\n");
  }
  return "Request Failed: " + String(resp);
}

function formatBalanceMessage(resp) {
  if (!resp || resp.code !== 200) {
    return formatApiMessage(resp, "Success");
  }
  const data = resp.data || {};
  const accountNo = firstDefined(data, ["accountNo", "account", "accountId"]);
  const amount = firstDefined(data, ["availableBalance", "balance", "amount"]);
  const currency = firstDefined(data, ["currency"]);
  const updatedAt = firstDefined(data, ["updatedAt", "lastUpdatedAt", "createTime", "createdAt"]);

  return [
    "Account Balance",
    "----------------",
    "Account No: " + textOrDash(accountNo),
    "Balance: " + textOrDash(money(amount)) + (currency ? " " + currency : ""),
    "Updated At: " + formatTime(updatedAt)
  ].join("\n");
}

function bindNavigation() {
  const pages = ["create-payment", "payment-by-id", "payment-list", "payment-history", "account-balance"];
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const pageSections = Array.from(document.querySelectorAll(".page"));

  function normalizePage(hashValue) {
    const value = hashValue.replace(/^#/, "");
    return pages.indexOf(value) >= 0 ? value : "create-payment";
  }

  function showPage(page) {
    navItems.forEach((item) => {
      const active = item.dataset.page === page;
      item.classList.toggle("active", active);
      item.setAttribute("aria-current", active ? "page" : "false");
    });

    pageSections.forEach((section) => {
      section.classList.toggle("active", section.dataset.page === page);
    });
  }

  function syncFromHash() {
    showPage(normalizePage(window.location.hash));
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page || "create-payment";
      if (window.location.hash !== "#" + page) {
        window.location.hash = page;
        return;
      }
      showPage(page);
    });
  });

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash();
}

function bindCreatePayment() {
  const form = document.getElementById("payment-form");
  const result = document.getElementById("create-result");
  const keyInput = document.getElementById("idempotencyKey");

  document.getElementById("gen-key").addEventListener("click", () => {
    keyInput.value = "order-" + Date.now();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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
      setResult(result, formatApiMessage(data, "Payment Created"), data.code === 200);
      await loadPayments();
    } catch (err) {
      setResult(result, "Request Failed: " + String(err), false);
    }
  });
}

function renderPayments(list) {
  const tbody = document.querySelector("#payment-table tbody");
  tbody.innerHTML = "";

  list.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = ""
      + "<td>" + (p.id || "") + "</td>"
      + "<td>" + (p.idempotencyKey || "") + "</td>"
      + "<td>" + (p.sourceAccount || "") + "</td>"
      + "<td>" + (p.destinationAccount || "") + "</td>"
      + "<td>" + money(p.amount) + "</td>"
      + "<td>" + (p.currency || "") + "</td>"
      + "<td>" + statusText(p.status) + "</td>"
      + "<td>" + textOrDash(p.errorCode) + "</td>"
      + "<td>" + formatTime(p.createdAt) + "</td>";

    tr.addEventListener("click", () => {
      document.getElementById("paymentIdInput").value = p.id || "";
      document.getElementById("historyPaymentId").value = p.id || "";
    });
    tbody.appendChild(tr);
  });
}

async function loadPayments() {
  const status = document.getElementById("statusFilter").value;
  const url = status ? "/api/payments?status=" + encodeURIComponent(status) : "/api/payments";
  const data = await api(url);
  renderPayments(data.data || []);
}

function bindPaymentList() {
  const form = document.getElementById("payment-list-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadPayments();
  });
}

function bindPaymentById() {
  const form = document.getElementById("payment-by-id-form");
  const result = document.getElementById("payment-by-id-result");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("paymentIdInput").value.trim();
    if (!id) {
      setResult(result, "Please enter Payment ID.", false);
      return;
    }

    try {
      const data = await api("/api/payments/" + encodeURIComponent(id));
      setResult(result, formatApiMessage(data, "Payment Details"), data.code === 200);
    } catch (err) {
      setResult(result, "Request Failed: " + String(err), false);
    }
  });
}

function renderHistory(list) {
  const tbody = document.querySelector("#history-table tbody");
  tbody.innerHTML = "";
  list.forEach((h) => {
    const tr = document.createElement("tr");
    tr.innerHTML = ""
      + "<td>" + statusText(h.fromStatus || "-") + "</td>"
      + "<td>" + statusText(h.toStatus) + "</td>"
      + "<td>" + textOrDash(h.errorCode) + "</td>"
      + "<td>" + textOrDash(h.note) + "</td>"
      + "<td>" + formatTime(h.createdAt) + "</td>";
    tbody.appendChild(tr);
  });
}

function bindHistory() {
  const form = document.getElementById("payment-history-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("historyPaymentId").value.trim();
    if (!id) {
      return;
    }

    try {
      const data = await api("/api/payments/" + encodeURIComponent(id) + "/history");
      renderHistory(data.data || []);
    } catch (err) {
      renderHistory([]);
      console.error(err);
    }
  });
}

function bindBalance() {
  const form = document.getElementById("balance-form");
  const result = document.getElementById("balance-result");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const accountNo = document.getElementById("accountNo").value.trim();
    if (!accountNo) {
      setResult(result, "Please enter Account No.", false);
      return;
    }

    try {
      const data = await api("/api/accounts/" + encodeURIComponent(accountNo) + "/balance");
      setResult(result, formatBalanceMessage(data), data.code === 200);
    } catch (err) {
      setResult(result, "Request Failed: " + String(err), false);
    }
  });
}

async function init() {
  bindNavigation();
  bindCreatePayment();
  bindPaymentById();
  bindPaymentList();
  bindHistory();
  bindBalance();
  document.getElementById("idempotencyKey").value = "order-" + Date.now();
  await loadPayments();
}

init().catch((err) => {
  console.error(err);
});
