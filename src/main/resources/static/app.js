function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function setResult(el, payload, ok) {
  el.textContent = pretty(payload);
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
      setResult(result, data, data.code === 200);
      await loadPayments();
    } catch (err) {
      setResult(result, { error: String(err) }, false);
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
      + "<td>" + (p.status || "") + "</td>"
      + "<td>" + (p.errorCode || "") + "</td>"
      + "<td>" + (p.createdAt || "") + "</td>";

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
      setResult(result, { code: 400, msg: "Payment ID is required" }, false);
      return;
    }

    try {
      const data = await api("/api/payments/" + encodeURIComponent(id));
      setResult(result, data, data.code === 200);
    } catch (err) {
      setResult(result, { error: String(err) }, false);
    }
  });
}

function renderHistory(list) {
  const tbody = document.querySelector("#history-table tbody");
  tbody.innerHTML = "";
  list.forEach((h) => {
    const tr = document.createElement("tr");
    tr.innerHTML = ""
      + "<td>" + (h.fromStatus || "-") + "</td>"
      + "<td>" + (h.toStatus || "") + "</td>"
      + "<td>" + (h.errorCode || "") + "</td>"
      + "<td>" + (h.note || "") + "</td>"
      + "<td>" + (h.createdAt || "") + "</td>";
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
      setResult(result, { code: 400, msg: "AccountNo is required" }, false);
      return;
    }

    try {
      const data = await api("/api/accounts/" + encodeURIComponent(accountNo) + "/balance");
      setResult(result, data, data.code === 200);
    } catch (err) {
      setResult(result, { error: String(err) }, false);
    }
  });
}

async function init() {
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

