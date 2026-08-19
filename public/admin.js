(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const els = {
    loginPanel: $("loginPanel"),
    loginForm: $("loginForm"),
    loginMessage: $("loginMessage"),
    password: $("password"),
    adminApp: $("adminApp"),
    logoutBtn: $("logoutBtn"),

    todayCups: $("todayCups"),
    todayRevenue: $("todayRevenue"),
    ordersList: $("ordersList"),

    menuForm: $("menuForm"),
    formTitle: $("formTitle"),
    itemId: $("itemId"),
    itemName: $("itemName"),
    itemPrice: $("itemPrice"),
    itemActive: $("itemActive"),
    saveBtn: $("saveBtn"),
    cancelBtn: $("cancelBtn"),
    message: $("message"),
    menuTable: $("menuTable"),
    historyTable: $("historyTable"),

    currentPassword: $("currentPassword"),
    newPassword: $("newPassword"),
    confirmPassword: $("confirmPassword"),
    changePasswordForm: $("changePasswordForm"),
    passwordMessage: $("passwordMessage"),

    enablePushBtn: $("enablePushBtn"),
    testPushBtn: $("testPushBtn"),
    disablePushBtn: $("disablePushBtn"),
    pushStatusBadge: $("pushStatusBadge"),
    pushMessage: $("pushMessage"),

    installPwaBtn: $("installPwaBtn"),
    installMessage: $("installMessage")
  };

  let MENU = [];
  let editingId = null;
  let unsubs = [];
  let firebaseMessaging = null;
  let currentFcmToken = localStorage.getItem("fcmToken") || "";
  let deferredInstallPrompt = null;

  const money = n =>
    new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ";

  if (!firebase.apps.length) {
    firebase.initializeApp(self.FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const functions = firebase.app().functions(
    self.FIREBASE_FUNCTIONS_REGION || "asia-southeast1"
  );

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(console.error);

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function attr(v) {
    return String(v ?? "").replaceAll("'", "\\'");
  }

  function msg(t) {
    els.message.textContent = t || "";
  }

  function isAdmin(user) {
    return !!user &&
      !!user.email &&
      String(user.email).toLowerCase() ===
        String(self.ADMIN_EMAIL || "").toLowerCase();
  }

  function showLogin() {
    els.loginPanel.hidden = false;
    els.adminApp.hidden = true;
    els.logoutBtn.hidden = true;
  }

  function showAdmin() {
    els.loginPanel.hidden = true;
    els.adminApp.hidden = false;
    els.logoutBtn.hidden = false;
  }

  function stopRealtime() {
    for (const unsub of unsubs) {
      try { unsub(); } catch (_) {}
    }
    unsubs = [];
  }

  function statusText(status) {
    if (status === "done") return "Hoàn thành";
    if (status === "preparing") return "Đang làm";
    return "Mới";
  }

  function formatTime(ts) {
    if (!ts || !ts.toDate) return "...";
    return ts.toDate().toLocaleTimeString("vi-VN");
  }

  function todayKey() {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(new Date());
  }

  async function login(e) {
    e.preventDefault();
    els.loginMessage.textContent = "Đang đăng nhập...";

    try {
      const credential =
        await auth.signInWithEmailAndPassword(
          self.ADMIN_EMAIL,
          els.password.value
        );

      if (!isAdmin(credential.user)) {
        await auth.signOut();
        throw new Error("Tài khoản này không có quyền Admin.");
      }

      els.password.value = "";
      els.loginMessage.textContent = "";
    } catch (error) {
      console.error(error);
      els.loginMessage.textContent =
        error.code === "auth/invalid-credential"
          ? "Sai mật khẩu."
          : (error.message || "Không đăng nhập được.");
    }
  }

  function startRealtime() {
    stopRealtime();

    // Menu
    unsubs.push(
      db.collection("menu")
        .onSnapshot(
          snapshot => {
            MENU = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .sort((a, b) =>
                String(a.name || "")
                  .localeCompare(String(b.name || ""), "vi")
              );

            renderMenuTable();
          },
          error => {
            console.error("menu realtime", error);
            msg("Không đọc được menu: " + error.message);
          }
        )
    );

    // Orders hôm nay
    unsubs.push(
      db.collection("orders")
        .where("dateKey", "==", todayKey())
        .orderBy("createdAt", "desc")
        .limit(100)
        .onSnapshot(
          snapshot => {
            const orders = snapshot.docs.map(doc => ({
              orderId: doc.id,
              ...doc.data()
            }));

            renderOrders(orders);
          },
          error => {
            console.error("orders realtime", error);
            els.ordersList.innerHTML =
              `<div class="empty-state">Không tải được đơn: ${esc(error.message)}</div>`;
          }
        )
    );

    // Stats hôm nay
    unsubs.push(
      db.collection("dailyStats")
        .doc(todayKey())
        .onSnapshot(
          doc => {
            const data = doc.exists ? doc.data() : {};
            els.todayCups.textContent = data.cups || 0;
            els.todayRevenue.textContent = money(data.revenue || 0);
          },
          error => {
            console.error("stats realtime", error);
          }
        )
    );

    // Lịch sử 31 ngày
    unsubs.push(
      db.collection("dailyStats")
        .orderBy("date", "desc")
        .limit(31)
        .onSnapshot(
          snapshot => {
            els.historyTable.innerHTML =
              snapshot.docs.map(doc => {
                const x = doc.data();
                return `
                  <tr>
                    <td>${esc(x.date || doc.id)}</td>
                    <td>${Number(x.cups) || 0}</td>
                    <td>${money(x.revenue || 0)}</td>
                  </tr>
                `;
              }).join("") ||
              `<tr><td colspan="3">Chưa có lịch sử.</td></tr>`;
          },
          error => {
            console.error("history realtime", error);
          }
        )
    );
  }

  function renderOrders(orders) {
    if (!orders.length) {
      els.ordersList.innerHTML =
        `<div class="empty-state">Chưa có đơn hàng nào hôm nay.</div>`;
      return;
    }

    els.ordersList.innerHTML =
      orders.map(order => `
        <article class="order-card">
          <div class="order-head">
            <div>
              <div class="order-id">${esc(order.orderId)}</div>
              <div class="order-meta">
                ${order.table ? "Bàn " + esc(order.table) + " • " : ""}
                ${formatTime(order.createdAt)}
              </div>
            </div>

            <div class="order-total">${money(order.total || 0)}</div>
          </div>

          <div class="order-items">
            ${(order.items || []).map(item => `
              <div class="order-item-row">
                <div>
                  <div class="order-item-name">${esc(item.name)}</div>
                  <div class="order-item-detail">
                    ${Number(item.quantity) || 0} × ${money(item.price || 0)}
                  </div>
                </div>
                <strong>${money(item.subtotal || 0)}</strong>
              </div>
            `).join("")}
          </div>

          <div class="actions">
            <button
              class="secondary"
              type="button"
              data-order-id="${esc(order.orderId)}"
              data-status="preparing"
            >Đang làm</button>

            <button
              class="primary"
              type="button"
              data-order-id="${esc(order.orderId)}"
              data-status="done"
            >Hoàn thành</button>

            <span class="status-badge">${esc(statusText(order.status))}</span>
          </div>
        </article>
      `).join("");

    els.ordersList
      .querySelectorAll("[data-order-id]")
      .forEach(button => {
        button.addEventListener("click", async () => {
          const orderId = button.dataset.orderId;
          const status = button.dataset.status;

          try {
            await db.collection("orders")
              .doc(orderId)
              .update({
                status,
                updatedAt:
                  firebase.firestore.FieldValue.serverTimestamp()
              });
          } catch (error) {
            msg("Không cập nhật được đơn: " + error.message);
          }
        });
      });
  }

  function renderMenuTable() {
    els.menuTable.innerHTML =
      MENU.map(item => `
        <tr>
          <td><strong>${esc(item.id)}</strong></td>
          <td>${esc(item.name)}</td>
          <td>${money(item.price)}</td>
          <td>${item.active ? "Đang bán" : "Đã ẩn"}</td>
          <td>
            <div class="row-actions">
              <button
                class="secondary"
                type="button"
                data-menu-action="edit"
                data-menu-id="${esc(item.id)}"
              >Sửa</button>

              <button
                class="secondary"
                type="button"
                data-menu-action="toggle"
                data-menu-id="${esc(item.id)}"
              >${item.active ? "Ẩn" : "Hiện"}</button>

              <button
                class="danger"
                type="button"
                data-menu-action="delete"
                data-menu-id="${esc(item.id)}"
              >Xóa</button>
            </div>
          </td>
        </tr>
      `).join("");

    els.menuTable
      .querySelectorAll("[data-menu-action]")
      .forEach(button => {
        button.addEventListener("click", async () => {
          const id = button.dataset.menuId;
          const action = button.dataset.menuAction;
          const item = MENU.find(x => x.id === id);
          if (!item) return;

          if (action === "edit") {
            editingId = id;
            els.itemId.value = item.id;
            els.itemName.value = item.name;
            els.itemPrice.value = item.price;
            els.itemActive.checked = !!item.active;
            els.itemId.disabled = true;
            els.formTitle.textContent = "Sửa món";
            els.saveBtn.textContent = "Lưu thay đổi";
            els.cancelBtn.hidden = false;
          }

          if (action === "toggle") {
            try {
              await db.collection("menu")
                .doc(id)
                .update({
                  active: !item.active,
                  updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
              msg(error.message);
            }
          }

          if (action === "delete") {
            if (!confirm(`Xóa món "${item.name}"?`)) return;

            try {
              await db.collection("menu").doc(id).delete();
            } catch (error) {
              msg(error.message);
            }
          }
        });
      });
  }

  function resetMenuForm() {
    editingId = null;
    els.menuForm.reset();
    els.itemActive.checked = true;
    els.itemId.disabled = false;
    els.formTitle.textContent = "Thêm món mới";
    els.saveBtn.textContent = "Thêm món";
    els.cancelBtn.hidden = true;
  }

  async function saveMenu(e) {
    e.preventDefault();

    try {
      const id =
        (editingId || els.itemId.value.trim().toUpperCase());

      const name = els.itemName.value.trim();
      const price = Number(els.itemPrice.value);
      const active = els.itemActive.checked;

      if (!/^[A-Z0-9_-]{1,30}$/.test(id)) {
        throw new Error("Mã món không hợp lệ.");
      }

      if (!name || name.length > 100) {
        throw new Error("Tên món không hợp lệ.");
      }

      if (!Number.isInteger(price) || price < 0 || price > 10000000) {
        throw new Error("Giá không hợp lệ.");
      }

      await db.collection("menu")
        .doc(id)
        .set(
          {
            name,
            price,
            active,
            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

      resetMenuForm();
      msg("Đã lưu món.");
    } catch (error) {
      console.error(error);
      msg(error.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    if (els.newPassword.value.length < 8) {
      els.passwordMessage.textContent =
        "Mật khẩu mới phải có ít nhất 8 ký tự.";
      return;
    }

    if (els.newPassword.value !== els.confirmPassword.value) {
      els.passwordMessage.textContent =
        "Hai mật khẩu mới không khớp.";
      return;
    }

    try {
      const user = auth.currentUser;

      const credential =
        firebase.auth.EmailAuthProvider.credential(
          user.email,
          els.currentPassword.value
        );

      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(els.newPassword.value);

      els.currentPassword.value = "";
      els.newPassword.value = "";
      els.confirmPassword.value = "";

      els.passwordMessage.textContent =
        "Đổi mật khẩu thành công.";
    } catch (error) {
      els.passwordMessage.textContent =
        error.message || "Không đổi được mật khẩu.";
    }
  }

  async function sha256(text) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );

    return [...new Uint8Array(digest)]
      .map(x => x.toString(16).padStart(2, "0"))
      .join("");
  }

  function firebasePushConfigured() {
    const c = self.FIREBASE_CONFIG || {};

    return c.apiKey &&
      self.FIREBASE_VAPID_KEY &&
      !String(c.apiKey).startsWith("DIEN_") &&
      !String(self.FIREBASE_VAPID_KEY).startsWith("DIEN_");
  }

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Thiết bị không hỗ trợ Service Worker.");
      }

      if (!("Notification" in window)) {
        throw new Error("Thiết bị không hỗ trợ thông báo.");
      }

      if (!firebasePushConfigured()) {
        throw new Error("Chưa cấu hình Firebase/VAPID.");
      }

      firebaseMessaging = firebase.messaging();

      const registration =
        await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Bạn chưa cho phép thông báo.");
      }

      const token =
        await firebaseMessaging.getToken({
          vapidKey: self.FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        });

      if (!token) {
        throw new Error("Không lấy được FCM token.");
      }

      await db.collection("adminDevices")
        .doc(await sha256(token))
        .set({
          token,
          uid: auth.currentUser.uid,
          updatedAt:
            firebase.firestore.FieldValue.serverTimestamp()
        });

      currentFcmToken = token;
      localStorage.setItem("fcmToken", token);

      els.pushStatusBadge.textContent = "Đã bật";
      els.pushMessage.textContent =
        "Thiết bị này đã đăng ký nhận thông báo.";
    } catch (error) {
      els.pushMessage.textContent = error.message;
    }
  }

  async function disablePush() {
    try {
      if (currentFcmToken) {
        await db.collection("adminDevices")
          .doc(await sha256(currentFcmToken))
          .delete();
      }

      if (firebaseMessaging) {
        await firebaseMessaging.deleteToken();
      }

      currentFcmToken = "";
      localStorage.removeItem("fcmToken");

      els.pushStatusBadge.textContent = "Đã tắt";
      els.pushMessage.textContent = "Đã tắt thông báo.";
    } catch (error) {
      els.pushMessage.textContent = error.message;
    }
  }

  async function testPush() {
    try {
      els.pushMessage.textContent = "Đang gửi thử...";

      await functions
        .httpsCallable("testAdminPush")({});

      els.pushMessage.textContent =
        "Đã yêu cầu gửi thông báo thử.";
    } catch (error) {
      els.pushMessage.textContent =
        error.message || "Không gửi thử được.";
    }
  }

  function refreshPushState() {
    if (!firebasePushConfigured()) {
      els.pushStatusBadge.textContent = "Chưa cấu hình";
      return;
    }

    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      currentFcmToken
    ) {
      els.pushStatusBadge.textContent = "Đã bật";
    } else {
      els.pushStatusBadge.textContent = "Chưa bật";
    }
  }

  // Events
  els.loginForm.addEventListener("submit", login);
  els.logoutBtn.addEventListener("click", () => auth.signOut());
  els.menuForm.addEventListener("submit", saveMenu);
  els.cancelBtn.addEventListener("click", resetMenuForm);
  els.changePasswordForm.addEventListener("submit", changePassword);
  els.enablePushBtn.addEventListener("click", enablePush);
  els.disablePushBtn.addEventListener("click", disablePush);
  els.testPushBtn.addEventListener("click", testPush);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installPwaBtn.hidden = false;
  });

  els.installPwaBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      els.installMessage.textContent =
        "iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính.";
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installPwaBtn.hidden = true;
  });

  // QUAN TRỌNG: không hiện Admin cho đến khi Auth xác nhận.
  showLogin();

  auth.onAuthStateChanged(user => {
    stopRealtime();

    if (isAdmin(user)) {
      showAdmin();
      startRealtime();
      refreshPushState();
    } else {
      showLogin();
    }
  });
})();
