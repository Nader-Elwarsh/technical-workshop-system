/* =========================================================
   الورشة الفنية - app-core.js
   Core Layer V1
   الهدف: توحيد البيانات والربط بين وحدات النظام قبل تعديل
   الواجهات النهائية.
   ========================================================= */

(function (window) {
  "use strict";

  const CORE_VERSION = "1.0.0";

  const KEYS = {
    settings: "systemSettings",
    audit: "auditLog",
    customers: "customers",
    devices: "devices",
    requests: "maintenanceRequests",
    technicians: "technicians",
    visits: "visits",
    routes: "routes",
    inventory: "inventory",
    inventoryTransactions: "inventory_transactions",
    suppliers: "suppliers",
    purchaseOrders: "purchaseOrders",
    invoices: "invoices",
    payments: "payments",
    warranties: "warranties",
    contracts: "contracts",
    notifications: "notifications",
    loyaltyAccounts: "loyaltyAccounts",
    loyaltyTransactions: "loyaltyTransactions",
    technicalLibrary: "technicalLibrary",
    users: "users"
  };

  const DEFAULT_SETTINGS = {
    workshopName: "الورشة الفنية لصيانة الأجهزة المنزلية والتكييف",
    shortName: "الورشة الفنية",
    currency: "جنيه",
    invoicePrefix: "INV-",
    pointValue: 1,
    vipPoints: 1000,
    warrantyDays: 30,
    audit: "on",
    notifications: "on",
    defaultWarehouse: "المخزن الرئيسي",
    negativeStock: "no"
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function list(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function now() {
    return new Date().toISOString();
  }

  function today() {
    return now().slice(0, 10);
  }

  function idOf(obj) {
    if (!obj) return "";
    return String(
      obj.id ??
      obj.customerId ??
      obj.deviceId ??
      obj.requestId ??
      obj.technicianId ??
      obj.visitId ??
      obj.routeId ??
      obj.invoiceId ??
      obj.paymentId ??
      obj.supplierId ??
      obj.code ??
      ""
    );
  }

  function numberPart(prefix, id) {
    const m = String(id || "").match(new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$"));
    return m ? Number(m[1]) : 0;
  }

  function nextId(prefix, key, width) {
    const items = list(key);
    let max = 0;
    items.forEach(item => {
      max = Math.max(max, numberPart(prefix, idOf(item)));
    });
    return prefix + String(max + 1).padStart(width || 5, "0");
  }

  function saveSettings(patch) {
    const current = Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
    const merged = Object.assign(current, patch || {}, { updatedAt: now() });
    write(KEYS.settings, merged);
    return merged;
  }

  function settings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
  }

  function find(key, id) {
    return list(key).find(x => String(idOf(x)) === String(id)) || null;
  }

  function findCustomer(id) {
    return find(KEYS.customers, id);
  }

  function findDevice(id) {
    return find(KEYS.devices, id);
  }

  function findRequest(id) {
    return find(KEYS.requests, id);
  }

  function findTechnician(id) {
    return find(KEYS.technicians, id);
  }

  function findVisit(id) {
    return find(KEYS.visits, id);
  }

  function findInvoice(id) {
    return find(KEYS.invoices, id);
  }

  function findPayment(id) {
    return find(KEYS.payments, id);
  }

  function customerName(customer) {
    if (!customer) return "";
    return customer.name || customer.fullName || customer.customerName || "";
  }

  function technicianName(tech) {
    if (!tech) return "";
    return tech.name || tech.fullName || tech.technicianName || "";
  }

  function requestCustomerId(request) {
    return request && (request.customerId || request.clientId || "");
  }

  function requestDeviceId(request) {
    return request && (request.deviceId || request.applianceId || "");
  }

  function customerDevices(customerId) {
    return list(KEYS.devices).filter(d =>
      String(d.customerId || d.clientId || "") === String(customerId)
    );
  }

  function customerRequests(customerId) {
    return list(KEYS.requests).filter(r =>
      String(requestCustomerId(r)) === String(customerId)
    );
  }

  function customerVisits(customerId) {
    return list(KEYS.visits).filter(v =>
      String(v.customerId || v.clientId || "") === String(customerId)
    );
  }

  function customerInvoices(customerId) {
    return list(KEYS.invoices).filter(i =>
      String(i.customerId || i.clientId || "") === String(customerId)
    );
  }

  function customerPayments(customerId) {
    return list(KEYS.payments).filter(p =>
      String(p.customerId || p.clientId || "") === String(customerId)
    );
  }

  function requestVisits(requestId) {
    return list(KEYS.visits).filter(v =>
      String(v.requestId || "") === String(requestId)
    );
  }

  function requestInvoices(requestId) {
    return list(KEYS.invoices).filter(i =>
      String(i.requestId || "") === String(requestId)
    );
  }

  function requestPayments(requestId) {
    return list(KEYS.payments).filter(p =>
      String(p.requestId || "") === String(requestId)
    );
  }

  function requestWarranties(requestId) {
    return list(KEYS.warranties).filter(w =>
      String(w.requestId || "") === String(requestId)
    );
  }

  function technicianVisits(technicianId, date) {
    return list(KEYS.visits).filter(v =>
      String(v.technicianId || "") === String(technicianId) &&
      (!date || String(v.date || "") === String(date))
    );
  }

  function routeVisits(routeId) {
    const route = find(KEYS.routes, routeId);
    if (!route) return [];
    return (route.stops || [])
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map(stop => findVisit(stop.visitId))
      .filter(Boolean);
  }

  function invoiceTotal(invoice) {
    if (!invoice) return 0;
    return Number(
      invoice.grandTotal ??
      invoice.total ??
      invoice.finalTotal ??
      invoice.amount ??
      0
    ) || 0;
  }

  function paymentsForInvoice(invoiceId, includeCancelled) {
    return list(KEYS.payments).filter(p =>
      String(p.invoiceId || "") === String(invoiceId) &&
      (includeCancelled || p.status !== "ملغاة")
    );
  }

  function invoicePaid(invoiceId) {
    return paymentsForInvoice(invoiceId)
      .filter(p => p.status === "مؤكدة" && p.type !== "استرداد")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }

  function invoiceRefunded(invoiceId) {
    return paymentsForInvoice(invoiceId)
      .filter(p => p.status === "مؤكدة" && p.type === "استرداد")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }

  function invoiceBalance(invoiceId) {
    const invoice = findInvoice(invoiceId);
    if (!invoice) return 0;
    return Math.max(0, invoiceTotal(invoice) - invoicePaid(invoiceId) + invoiceRefunded(invoiceId));
  }

  function customerFinancialSummary(customerId) {
    const invoices = customerInvoices(customerId);
    const payments = customerPayments(customerId).filter(p => p.status === "مؤكدة");
    const total = invoices.reduce((s, i) => s + invoiceTotal(i), 0);
    const paid = payments.filter(p => p.type !== "استرداد").reduce((s, p) => s + Number(p.amount || 0), 0);
    const refunded = payments.filter(p => p.type === "استرداد").reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      invoices: invoices.length,
      total,
      paid,
      refunded,
      balance: Math.max(0, total - paid + refunded)
    };
  }

  function inventoryItem(itemId) {
    return find(KEYS.inventory, itemId);
  }

  function inventoryQuantity(itemId) {
    const item = inventoryItem(itemId);
    return item ? Number(item.quantity || 0) : 0;
  }

  function addInventoryTransaction(itemId, quantity, type, reference, notes) {
    const items = list(KEYS.inventory);
    const itemIndex = items.findIndex(x => String(idOf(x)) === String(itemId));
    if (itemIndex < 0) throw new Error("الصنف غير موجود في المخزون.");

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("الكمية غير صحيحة.");

    const item = items[itemIndex];
    const before = Number(item.quantity || 0);
    const after = before + qty;

    items[itemIndex] = Object.assign({}, item, {
      quantity: after,
      updatedAt: now()
    });

    write(KEYS.inventory, items);

    const transactions = list(KEYS.inventoryTransactions);
    transactions.unshift({
      id: nextId("TR-", KEYS.inventoryTransactions, 7),
      itemId,
      itemName: item.name || "",
      type: type || "تسوية",
      qty,
      before,
      after,
      reference: reference || "",
      notes: notes || "",
      date: now()
    });
    write(KEYS.inventoryTransactions, transactions);

    return items[itemIndex];
  }

  function consumeInventory(itemId, quantity, type, reference, notes) {
    const items = list(KEYS.inventory);
    const itemIndex = items.findIndex(x => String(idOf(x)) === String(itemId));
    if (itemIndex < 0) throw new Error("الصنف غير موجود في المخزون.");

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("الكمية غير صحيحة.");

    const item = items[itemIndex];
    const before = Number(item.quantity || 0);
    const allowNegative = settings().negativeStock === "yes";

    if (!allowNegative && qty > before) {
      throw new Error("الكمية المطلوبة أكبر من الرصيد المتاح.");
    }

    const after = before - qty;

    items[itemIndex] = Object.assign({}, item, {
      quantity: after,
      updatedAt: now()
    });

    write(KEYS.inventory, items);

    const transactions = list(KEYS.inventoryTransactions);
    transactions.unshift({
      id: nextId("TR-", KEYS.inventoryTransactions, 7),
      itemId,
      itemName: item.name || "",
      type: type || "صرف",
      qty: -qty,
      before,
      after,
      reference: reference || "",
      notes: notes || "",
      date: now()
    });
    write(KEYS.inventoryTransactions, transactions);

    return items[itemIndex];
  }

  function getOrCreateLoyalty(customerId) {
    const accounts = list(KEYS.loyaltyAccounts);
    let account = accounts.find(x => String(x.customerId) === String(customerId));
    if (account) return account;

    const customer = findCustomer(customerId);
    account = {
      id: nextId("LOY-", KEYS.loyaltyAccounts, 5),
      customerId,
      customerName: customerName(customer),
      points: 0,
      createdAt: now()
    };
    accounts.push(account);
    write(KEYS.loyaltyAccounts, accounts);
    return account;
  }

  function loyaltyPoints(customerId) {
    return Number(getOrCreateLoyalty(customerId).points || 0);
  }

  function changeLoyalty(customerId, points, type, reference, notes) {
    const amount = Number(points);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error("عدد النقاط غير صحيح.");
    }

    const accounts = list(KEYS.loyaltyAccounts);
    const index = accounts.findIndex(x => String(x.customerId) === String(customerId));
    const account = index >= 0 ? accounts[index] : getOrCreateLoyalty(customerId);
    const before = Number(account.points || 0);
    const delta = type === "earn" ? Math.abs(amount) : -Math.abs(amount);
    const after = before + delta;

    if (after < 0) throw new Error("رصيد النقاط غير كافٍ.");

    const updated = Object.assign({}, account, {
      points: after,
      updatedAt: now()
    });

    const refreshed = list(KEYS.loyaltyAccounts);
    const i = refreshed.findIndex(x => String(x.customerId) === String(customerId));
    if (i >= 0) refreshed[i] = updated;
    else refreshed.push(updated);
    write(KEYS.loyaltyAccounts, refreshed);

    const transactions = list(KEYS.loyaltyTransactions);
    transactions.unshift({
      id: nextId("LP-", KEYS.loyaltyTransactions, 6),
      customerId,
      customerName: updated.customerName || "",
      type: type || (delta > 0 ? "earn" : "redeem"),
      points: Math.abs(delta),
      before,
      after,
      reference: reference || "",
      notes: notes || "",
      date: now()
    });
    write(KEYS.loyaltyTransactions, transactions);

    return updated;
  }

  function warrantyForRequest(requestId) {
    return requestWarranties(requestId).sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )[0] || null;
  }

  function log(action, module, recordId, description, user) {
    if (settings().audit === "off") return null;

    const logs = list(KEYS.audit);
    const entry = {
      id: nextId("AUD-", KEYS.audit, 6),
      user: user || settings().adminName || "النظام",
      module: module || "النظام",
      action: action || "أخرى",
      recordId: recordId || "",
      description: description || "",
      date: now(),
      source: "core"
    };
    logs.unshift(entry);
    write(KEYS.audit, logs);
    return entry;
  }

  /*
   * ربط/تحديث البيانات المشتقة بدون حذف أي بيانات.
   * يمكن تشغيله قبل تحديث لوحة التحكم النهائية.
   */
  function syncRelations() {
    const customers = list(KEYS.customers);
    const customerMap = {};
    customers.forEach(c => {
      customerMap[idOf(c)] = {
        name: customerName(c),
        phone: c.phone || c.mobile || "",
        address: c.address || ""
      };
    });

    // الأجهزة
    const devices = list(KEYS.devices).map(d => {
      const cid = d.customerId || d.clientId || "";
      const c = customerMap[cid];
      return Object.assign({}, d, {
        customerId: cid,
        customerName: d.customerName || (c && c.name) || ""
      });
    });
    write(KEYS.devices, devices);

    // طلبات الصيانة
    const requests = list(KEYS.requests).map(r => {
      const cid = requestCustomerId(r);
      const did = requestDeviceId(r);
      const c = customerMap[cid];
      const device = findDevice(did);
      return Object.assign({}, r, {
        customerId: cid,
        customerName: r.customerName || (c && c.name) || "",
        deviceId: did,
        deviceName: r.deviceName || (device && (device.name || device.deviceName || device.type)) || ""
      });
    });
    write(KEYS.requests, requests);

    // الزيارات
    const visits = list(KEYS.visits).map(v => {
      const r = findRequest(v.requestId);
      const cid = v.customerId || (r && requestCustomerId(r)) || "";
      const tech = findTechnician(v.technicianId);
      const c = customerMap[cid];
      return Object.assign({}, v, {
        customerId: cid,
        customerName: v.customerName || (c && c.name) || (r && r.customerName) || "",
        requestId: v.requestId || "",
        technicianName: v.technicianName || technicianName(tech)
      });
    });
    write(KEYS.visits, visits);

    // الفواتير
    const invoices = list(KEYS.invoices).map(i => {
      const r = findRequest(i.requestId);
      const cid = i.customerId || (r && requestCustomerId(r)) || "";
      const c = customerMap[cid];
      return Object.assign({}, i, {
        customerId: cid,
        customerName: i.customerName || (c && c.name) || "",
        requestId: i.requestId || ""
      });
    });
    write(KEYS.invoices, invoices);

    // المدفوعات
    const payments = list(KEYS.payments).map(p => {
      const invoice = findInvoice(p.invoiceId);
      const cid = p.customerId || (invoice && (invoice.customerId || invoice.clientId)) || "";
      const c = customerMap[cid];
      return Object.assign({}, p, {
        customerId: cid,
        customerName: p.customerName || (c && c.name) || "",
        requestId: p.requestId || (invoice && invoice.requestId) || ""
      });
    });
    write(KEYS.payments, payments);

    return {
      customers: customers.length,
      devices: devices.length,
      requests: requests.length,
      visits: visits.length,
      invoices: invoices.length,
      payments: payments.length,
      syncedAt: now()
    };
  }

  function customer360(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return null;

    const devices = customerDevices(customerId);
    const requests = customerRequests(customerId);
    const visits = customerVisits(customerId);
    const invoices = customerInvoices(customerId);
    const payments = customerPayments(customerId);
    const loyalty = getOrCreateLoyalty(customerId);
    const warranties = requests.flatMap(r => requestWarranties(idOf(r)));

    return {
      customer,
      devices,
      requests,
      visits,
      invoices,
      payments,
      warranties,
      loyalty,
      financial: customerFinancialSummary(customerId)
    };
  }

  function systemSummary() {
    return {
      version: CORE_VERSION,
      date: today(),
      customers: list(KEYS.customers).length,
      devices: list(KEYS.devices).length,
      requests: list(KEYS.requests).length,
      technicians: list(KEYS.technicians).length,
      visits: list(KEYS.visits).length,
      routes: list(KEYS.routes).length,
      inventory: list(KEYS.inventory).length,
      suppliers: list(KEYS.suppliers).length,
      purchaseOrders: list(KEYS.purchaseOrders).length,
      invoices: list(KEYS.invoices).length,
      payments: list(KEYS.payments).length,
      warranties: list(KEYS.warranties).length,
      contracts: list(KEYS.contracts).length,
      notifications: list(KEYS.notifications).length,
      loyaltyAccounts: list(KEYS.loyaltyAccounts).length,
      library: list(KEYS.technicalLibrary).length
    };
  }

  window.WorkshopCore = {
    VERSION: CORE_VERSION,
    KEYS,
    DEFAULT_SETTINGS,
    read,
    write,
    list,
    now,
    today,
    idOf,
    nextId,
    settings,
    saveSettings,
    find,
    findCustomer,
    findDevice,
    findRequest,
    findTechnician,
    findVisit,
    findInvoice,
    findPayment,
    customerName,
    technicianName,
    customerDevices,
    customerRequests,
    customerVisits,
    customerInvoices,
    customerPayments,
    requestVisits,
    requestInvoices,
    requestPayments,
    requestWarranties,
    technicianVisits,
    routeVisits,
    invoiceTotal,
    paymentsForInvoice,
    invoicePaid,
    invoiceRefunded,
    invoiceBalance,
    customerFinancialSummary,
    inventoryItem,
    inventoryQuantity,
    addInventoryTransaction,
    consumeInventory,
    getOrCreateLoyalty,
    loyaltyPoints,
    changeLoyalty,
    warrantyForRequest,
    log,
    syncRelations,
    customer360,
    systemSummary
  };

})(window);
