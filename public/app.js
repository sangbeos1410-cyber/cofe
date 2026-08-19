let MENU = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let submitting = false;
let authReadyPromise = null;

const money = n => new Intl.NumberFormat("vi-VN").format(Number(n)) + "đ";

if (!firebase.apps.length) {
  firebase.initializeApp(self.FIREBASE_CONFIG);
}

const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions(
  self.FIREBASE_FUNCTIONS_REGION || "asia-southeast1"
);

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

const createOrderFn = functions.httpsCallable("createOrder");

function waitForAuthState() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Firebase Authentication phản hồi quá lâu."));
    }, 12000);

    unsubscribe = auth.onAuthStateChanged(
      user => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      },
      error => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function ensureCustomerAuth() {
  if (auth.currentUser) {
    await auth.currentUser.getIdToken(true);
    return auth.currentUser;
  }

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      const restored = await waitForAuthState();

      if (restored) {
        await restored.getIdToken(true);
        return restored;
      }

      const credential = await auth.signInAnonymously();
      const user = credential.user;

      if (!user) {
        throw new Error("Không tạo được tài khoản khách Anonymous.");
      }

      await user.getIdToken(true);
      return user;
    })().finally(() => {
      authReadyPromise = null;
    });
  }

  return authReadyPromise;
}

function loadMenu() {
  const status = document.getElementById("menuStatus");
  status.textContent = "Đang tải menu...";

  db.collection("menu")
    .where("active", "==", true)
    .onSnapshot(
      snapshot => {
        MENU = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "vi")
          );

        status.textContent = "";
        renderMenu();
        renderCart();
      },
      error => {
        console.error("Menu error:", error);
        status.textContent =
          "Không tải được menu: " +
          (error.message || error.code || "Lỗi Firestore");
      }
    );
}

function renderMenu() {
  const el = document.getElementById("menu");
  el.innerHTML =
    MENU.map(item => `
      <article class="card">
        <h3>${esc(item.name)}</h3>
        <div class="price">${money(item.price)}</div>
        <button class="primary" onclick="add('${attr(item.id)}')">+ Thêm món</button>
      </article>
    `).join("") || "<p>Chưa có món đang bán.</p>";
}

function add(id) {
  const found = cart.find(x => x.id === id);
  if (found) found.qty = Math.min(20, found.qty + 1);
  else cart.push({ id, qty: 1 });
  save();
}

function change(id, delta) {
  const found = cart.find(x => x.id === id);
  if (!found) return;
  found.qty += delta;
  if (found.qty <= 0) cart = cart.filter(x => x.id !== id);
  save();
}

function save() {
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  cart = cart.filter(c => MENU.some(m => m.id === c.id));
  const el = document.getElementById("cartItems");
  let total = 0;

  if (!cart.length) {
    el.innerHTML = "<p>Chưa có món nào.</p>";
    document.getElementById("total").textContent = "0đ";
    return;
  }

  el.innerHTML = cart.map(c => {
    const item = MENU.find(m => m.id === c.id);
    const subtotal = Number(item.price) * c.qty;
    total += subtotal;

    return `
      <div class="cart-item">
        <div>
          <strong>${esc(item.name)}</strong><br>
          <small>${money(item.price)} × ${c.qty} = ${money(subtotal)}</small>
        </div>
        <div class="qty">
          <button onclick="change('${attr(item.id)}', -1)">−</button>
          <span>${c.qty}</span>
          <button onclick="change('${attr(item.id)}', 1)">+</button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("total").textContent = money(total);
}

async function submitOrder() {
  const msg = document.getElementById("message");
  const btn = document.getElementById("orderBtn");

  if (submitting) return;
  if (!cart.length) {
    msg.textContent = "Vui lòng chọn món.";
    return;
  }

  try {
    submitting = true;
    btn.disabled = true;
    msg.textContent = "Đang xác thực thiết bị...";

    const user = await ensureCustomerAuth();
    const idToken = await user.getIdToken(true);

    if (!idToken) {
      throw new Error("Không lấy được Firebase ID token.");
    }

    msg.textContent = "Đang gửi đơn...";

    const items = cart.map(c => ({
      menuId: c.id,
      quantity: Number(c.qty)
    }));

    const clientRequestId = crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(36).slice(2);

    const result = await createOrderFn({
      table: document.getElementById("tableNumber").value.trim().slice(0, 20),
      items,
      clientRequestId
    });

    cart = [];
    save();
    document.getElementById("tableNumber").value = "";

    msg.textContent =
      "Đặt món thành công! Mã đơn: " + (result.data.orderId || "");
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    const code = error.code || "";
    let friendly = error.message || "Không gửi được đơn.";

    if (
      code.includes("unauthenticated") ||
      friendly.toLowerCase().includes("unauthenticated")
    ) {
      friendly =
        "Firebase chưa nhận Anonymous Auth. Hãy tải lại trang rồi thử lại.";
    } else if (
      code.includes("failed-precondition") &&
      friendly.toLowerCase().includes("app check")
    ) {
      friendly =
        "App Check đang được bắt buộc nhưng website chưa cấu hình App Check.";
    } else if (code.includes("permission-denied")) {
      friendly =
        "Không có quyền tạo đơn. Kiểm tra Firebase Authentication và Security Rules.";
    }

    msg.textContent = friendly;
  } finally {
    submitting = false;
    btn.disabled = false;
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attr(value) {
  return String(value ?? "").replaceAll("'", "\\'");
}

document.getElementById("orderBtn").addEventListener("click", submitOrder);

ensureCustomerAuth()
  .then(user => console.log("Anonymous Auth OK:", user.uid))
  .catch(error => console.error("Anonymous Auth startup error:", error))
  .finally(loadMenu);
