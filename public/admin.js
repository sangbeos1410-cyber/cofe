/* =========================================================
   CHENG COFFEE - ADMIN.JS
========================================================= */

const ADMIN_EMAIL = "sangbeos1410@gmail.com";

const $ = (id) => document.getElementById(id);

const money = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";

let MENU = [];
let ORDERS = [];

let editingId = null;
let unsubscribeMenu = null;
let unsubscribeOrders = null;
let unsubscribeStats = null;
let unsubscribeStore = null;


/* =========================================================
   FIREBASE
========================================================= */

if (!firebase.apps.length) {
  firebase.initializeApp(self.FIREBASE_CONFIG);
}

const auth = firebase.auth();
const db = firebase.firestore();

const functions = firebase
  .app()
  .functions(
    self.FIREBASE_FUNCTIONS_REGION ||
    "asia-southeast1"
  );

const testAdminPush =
  functions.httpsCallable("testAdminPush");


/* =========================================================
   AUTH
========================================================= */

auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
).catch(console.error);


function isAdminUser(user) {
  return (
    !!user &&
    String(user.email || "").toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
  );
}


auth.onAuthStateChanged(async (user) => {
  if (isAdminUser(user)) {
    $("loginPanel").hidden = true;
    $("adminApp").hidden = false;
    $("logoutBtn").hidden = false;

    try {
      await user.getIdToken(true);
    } catch (error) {
      console.error(error);
    }

    startAdmin();
  } else {
    stopAdmin();

    $("loginPanel").hidden = false;
    $("adminApp").hidden = true;
    $("logoutBtn").hidden = true;
  }
});


/* =========================================================
   LOGIN
========================================================= */

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = $("password").value;

  $("loginMessage").textContent =
    "Đang đăng nhập...";

  try {
    const credential =
      await auth.signInWithEmailAndPassword(
        ADMIN_EMAIL,
        password
      );

    if (!isAdminUser(credential.user)) {
      await auth.signOut();

      throw new Error(
        "Tài khoản này không có quyền Admin."
      );
    }

    await credential.user.getIdToken(true);

    $("password").value = "";

    $("loginMessage").textContent = "";
  } catch (error) {
    console.error("Login:", error);

    let message = "Không đăng nhập được.";

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    ) {
      message = "Mật khẩu không đúng.";
    }

    if (error.code === "auth/too-many-requests") {
      message =
        "Bạn thử quá nhiều lần. Vui lòng chờ rồi thử lại.";
    }

    $("loginMessage").textContent = message;
  }
});


$("logoutBtn").addEventListener("click", async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error(error);
  }
});


/* =========================================================
   START / STOP ADMIN
========================================================= */

function startAdmin() {
  loadMenu();
  loadOrders();
  loadStats();
  loadStoreSettings();

  updatePushUI();
}


function stopAdmin() {
  if (unsubscribeMenu) {
    unsubscribeMenu();
    unsubscribeMenu = null;
  }

  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }

  if (unsubscribeStats) {
    unsubscribeStats();
    unsubscribeStats = null;
  }

  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }

  MENU = [];
  ORDERS = [];
}


/* =========================================================
   TABS
========================================================= */

document
  .querySelectorAll(".tab-button")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      document
        .querySelectorAll(".tab-button")
        .forEach((item) =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      document
        .querySelectorAll(".tab-page")
        .forEach((page) =>
          page.classList.remove("active")
        );

      const target = $("tab-" + tab);

      if (target) {
        target.classList.add("active");
      }
    });
  });


/* =========================================================
   MENU
========================================================= */

function normalizeMenu(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,

    name: String(data.name || ""),

    category: String(
      data.category || "Khác"
    ),

    description: String(
      data.description || ""
    ),

    sizes: Array.isArray(data.sizes)
      ? data.sizes
      : [],

    toppings: Array.isArray(data.toppings)
      ? data.toppings
      : [],

    active: data.active === true,

    ...data
  };
}


function loadMenu() {
  if (unsubscribeMenu) {
    unsubscribeMenu();
  }

  unsubscribeMenu = db
    .collection("menu")
    .onSnapshot(
      (snapshot) => {
        MENU = snapshot.docs
          .map(normalizeMenu)
          .sort((a, b) =>
            String(a.category).localeCompare(
              String(b.category),
              "vi"
            ) ||
            String(a.name).localeCompare(
              String(b.name),
              "vi"
            )
          );

        renderMenuTable();
      },

      (error) => {
        console.error("Menu:", error);

        $("menuTable").innerHTML = `
          <tr>
            <td colspan="7">
              Không tải được menu:
              ${escapeHtml(error.message)}
            </td>
          </tr>
        `;
      }
    );
}


/* =========================================================
   RENDER MENU TABLE
========================================================= */

function renderMenuTable() {
  if (!MENU.length) {
    $("menuTable").innerHTML = `
      <tr>
        <td colspan="7">
          Chưa có món trong menu.
        </td>
      </tr>
    `;

    return;
  }

  $("menuTable").innerHTML = MENU.map((item) => {
    const sizeText = item.sizes
      .map((size) => {
        return `${escapeHtml(
          size.name || size.id
        )}: ${money(size.price)}`;
      })
      .join("<br>");

    const toppingText = item.toppings.length
      ? item.toppings
          .map(
            (topping) =>
              `${escapeHtml(
                topping.name
              )} (+${money(topping.price)})`
          )
          .join("<br>")
      : "—";

    return `
      <tr>

        <td>
          <strong>
            ${escapeHtml(item.id)}
          </strong>
        </td>

        <td>
          <strong>
            ${escapeHtml(item.name)}
          </strong>

          ${
            item.description
              ? `
                <div class="muted">
                  ${escapeHtml(
                    item.description
                  )}
                </div>
              `
              : ""
          }
        </td>

        <td>
          ${escapeHtml(item.category)}
        </td>

        <td>
          ${sizeText || "—"}
        </td>

        <td>
          ${toppingText}
        </td>

        <td>
          ${
            item.active
              ? `
                <span class="status-pill online">
                  Đang bán
                </span>
              `
              : `
                <span class="status-pill">
                  Đã ẩn
                </span>
              `
          }
        </td>

        <td>

          <div class="actions">

            <button
              class="secondary"
              type="button"
              onclick="editMenuItem(
                '${escapeJs(item.id)}'
              )"
            >
              Sửa
            </button>

            <button
              class="secondary"
              type="button"
              onclick="toggleMenuItem(
                '${escapeJs(item.id)}'
              )"
            >
              ${
                item.active
                  ? "Ẩn"
                  : "Bật"
              }
            </button>

            <button
              class="danger"
              type="button"
              onclick="deleteMenuItem(
                '${escapeJs(item.id)}'
              )"
            >
              Xóa
            </button>

          </div>

        </td>

      </tr>
    `;
  }).join("");
}


/* =========================================================
   PARSE SIZE
========================================================= */

function buildSizes() {
  const result = [];

  const sizeS =
    Number($("sizeS").value);

  const sizeM =
    Number($("sizeM").value);

  const sizeL =
    Number($("sizeL").value);

  if (
    $("sizeS").value !== "" &&
    Number.isFinite(sizeS) &&
    sizeS >= 0
  ) {
    result.push({
      id: "S",
      name: "S",
      price: sizeS
    });
  }

  if (
    $("sizeM").value !== "" &&
    Number.isFinite(sizeM) &&
    sizeM >= 0
  ) {
    result.push({
      id: "M",
      name: "M",
      price: sizeM
    });
  }

  if (
    $("sizeL").value !== "" &&
    Number.isFinite(sizeL) &&
    sizeL >= 0
  ) {
    result.push({
      id: "L",
      name: "L",
      price: sizeL
    });
  }

  return result;
}


/* =========================================================
   PARSE TOPPINGS
========================================================= */

function buildToppings() {
  const lines = String(
    $("toppingsText").value || ""
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const toppings = [];

  lines.forEach((line, index) => {
    const parts = line.split("|");

    const name =
      String(parts[0] || "").trim();

    const price =
      Number(
        String(parts[1] || "0")
          .replace(/[^\d.-]/g, "")
      );

    if (!name) {
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return;
    }

    const id =
      slugify(name) ||
      `topping-${index + 1}`;

    toppings.push({
      id: id.slice(0, 40),
      name: name.slice(0, 80),
      price
    });
  });

  return toppings;
}


/* =========================================================
   SAVE MENU
========================================================= */

$("menuForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const id = String(
      $("itemId").value || ""
    )
      .trim()
      .toUpperCase();

    const name = String(
      $("itemName").value || ""
    ).trim();

    const category = String(
      $("itemCategory").value || ""
    ).trim();

    const description = String(
      $("itemDescription").value || ""
    ).trim();

    if (
      !/^[A-Za-z0-9_-]{1,30}$/.test(id)
    ) {
      $("message").textContent =
        "Mã món chỉ được dùng chữ, số, dấu - hoặc _.";

      return;
    }

    if (!name) {
      $("message").textContent =
        "Vui lòng nhập tên món.";

      return;
    }

    if (!category) {
      $("message").textContent =
        "Vui lòng nhập danh mục.";

      return;
    }

    const sizes = buildSizes();

    if (!sizes.length) {
      $("message").textContent =
        "Món phải có ít nhất một size.";

      return;
    }

    const toppings = buildToppings();

    $("saveBtn").disabled = true;

    $("message").textContent =
      "Đang lưu...";

    try {
      const data = {
        name: name.slice(0, 100),

        category:
          category.slice(0, 80),

        description:
          description.slice(0, 300),

        sizes,

        toppings,

        active:
          $("itemActive").checked,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      };

      if (editingId) {
        await db
          .collection("menu")
          .doc(editingId)
          .set(data, {
            merge: false
          });

        $("message").textContent =
          "Đã cập nhật món.";
      } else {
        const existing = await db
          .collection("menu")
          .doc(id)
          .get();

        if (existing.exists) {
          throw new Error(
            "Mã món này đã tồn tại."
          );
        }

        await db
          .collection("menu")
          .doc(id)
          .set(data);

        $("message").textContent =
          "Đã thêm món mới.";
      }

      resetMenuForm();
    } catch (error) {
      console.error(
        "Save menu:",
        error
      );

      $("message").textContent =
        error.message ||
        "Không lưu được món.";
    } finally {
      $("saveBtn").disabled = false;
    }
  }
);


/* =========================================================
   EDIT MENU
========================================================= */

window.editMenuItem = function (id) {
  const item = MENU.find(
    (menuItem) =>
      menuItem.id === id
  );

  if (!item) {
    return;
  }

  editingId = item.id;

  $("formTitle").textContent =
    "Sửa món";

  $("saveBtn").textContent =
    "Lưu thay đổi";

  $("cancelBtn").hidden = false;

  $("itemId").value =
    item.id;

  $("itemId").disabled =
    true;

  $("itemName").value =
    item.name;

  $("itemCategory").value =
    item.category;

  $("itemDescription").value =
    item.description || "";

  $("sizeS").value = "";
  $("sizeM").value = "";
  $("sizeL").value = "";

  item.sizes.forEach((size) => {
    const id =
      String(size.id || "")
        .toUpperCase();

    if (id === "S") {
      $("sizeS").value =
        Number(size.price) || 0;
    }

    if (id === "M") {
      $("sizeM").value =
        Number(size.price) || 0;
    }

    if (id === "L") {
      $("sizeL").value =
        Number(size.price) || 0;
    }
  });

  $("toppingsText").value =
    item.toppings
      .map(
        (topping) =>
          `${topping.name} | ${Number(
            topping.price
          ) || 0}`
      )
      .join("\n");

  $("itemActive").checked =
    item.active;

  $("message").textContent =
    `Đang sửa ${item.name}`;

  window.scrollTo({
    top:
      $("menuForm")
        .getBoundingClientRect()
        .top +
      window.scrollY -
      120,

    behavior: "smooth"
  });
};


/* =========================================================
   RESET MENU FORM
========================================================= */

function resetMenuForm() {
  editingId = null;

  $("menuForm").reset();

  $("itemId").disabled = false;

  $("itemActive").checked = true;

  $("formTitle").textContent =
    "Thêm món mới";

  $("saveBtn").textContent =
    "Thêm món";

  $("cancelBtn").hidden = true;
}


$("cancelBtn").addEventListener(
  "click",
  () => {
    resetMenuForm();

    $("message").textContent = "";
  }
);


/* =========================================================
   TOGGLE MENU
========================================================= */

window.toggleMenuItem =
  async function (id) {
    const item = MENU.find(
      (menuItem) =>
        menuItem.id === id
    );

    if (!item) {
      return;
    }

    try {
      await db
        .collection("menu")
        .doc(id)
        .update({
          active: !item.active,

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });
    } catch (error) {
      console.error(error);

      alert(
        "Không thay đổi được trạng thái món: " +
        error.message
      );
    }
  };


/* =========================================================
   DELETE MENU
========================================================= */

window.deleteMenuItem =
  async function (id) {
    const item = MENU.find(
      (menuItem) =>
        menuItem.id === id
    );

    if (!item) {
      return;
    }

    const confirmed = confirm(
      `Xóa món "${item.name}"?\n\n` +
      "Đơn hàng cũ sẽ không bị mất."
    );

    if (!confirmed) {
      return;
    }

    try {
      await db
        .collection("menu")
        .doc(id)
        .delete();

      if (editingId === id) {
        resetMenuForm();
      }
    } catch (error) {
      console.error(error);

      alert(
        "Không xóa được món: " +
        error.message
      );
    }
  };


/* =========================================================
   ORDERS
========================================================= */

function loadOrders() {
  if (unsubscribeOrders) {
    unsubscribeOrders();
  }

  const today = dateKeyVN();

  unsubscribeOrders = db
    .collection("orders")
    .where(
      "dateKey",
      "==",
      today
    )
    .onSnapshot(
      (snapshot) => {
        ORDERS = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort(
            (a, b) =>
              timestampMs(b.createdAt) -
              timestampMs(a.createdAt)
          );

        renderOrders();
      },

      (error) => {
        console.error(
          "Orders:",
          error
        );

        $("ordersList").innerHTML = `
          <div class="empty-admin">
            Không tải được đơn:
            ${escapeHtml(error.message)}
          </div>
        `;
      }
    );
}


/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders() {
  if (!ORDERS.length) {
    $("ordersList").innerHTML = `
      <div class="empty-admin">
        Hôm nay chưa có đơn nào.
      </div>
    `;

    return;
  }

  $("ordersList").innerHTML =
    ORDERS.map((order) => {
      const items =
        Array.isArray(order.items)
          ? order.items
          : [];

      const itemsHtml =
        items.map((item) => {
          const toppings =
            Array.isArray(item.toppings)
              ? item.toppings
              : [];

          const toppingText =
            toppings.length
              ? toppings
                  .map(
                    (topping) =>
                      topping.name
                  )
                  .join(", ")
              : "Không topping";

          return `
            <div class="order-item">

              <div>

                <div class="order-item-name">
                  ${Number(
                    item.quantity
                  ) || 1}
                  ×
                  ${escapeHtml(
                    item.name || ""
                  )}
                </div>

                <div class="order-item-info">

                  Size:
                  ${escapeHtml(
                    item.sizeName ||
                    item.sizeId ||
                    ""
                  )}

                  <br>

                  Topping:
                  ${escapeHtml(
                    toppingText
                  )}

                  <br>

                  Đơn giá:
                  ${money(
                    item.unitPrice
                  )}

                </div>

                ${
                  item.note
                    ? `
                      <div class="item-note-admin">
                        <strong>
                          Ghi chú món:
                        </strong>
                        ${escapeHtml(
                          item.note
                        )}
                      </div>
                    `
                    : ""
                }

              </div>

              <strong>
                ${money(
                  item.subtotal
                )}
              </strong>

            </div>
          `;
        }).join("");

      return `
        <article class="order-card">

          <div class="order-head">

            <div>

              <div class="order-id">
                Bàn
                ${escapeHtml(
                  order.table || "?"
                )}
              </div>

              <div class="order-time">
                ${formatDateTime(
                  order.createdAt
                )}

                • ${Number(
                  order.cups || 0
                )} món
              </div>

            </div>

            <div class="order-total">
              ${money(order.total)}
            </div>

          </div>

          ${itemsHtml}

          ${
            order.orderNote
              ? `
                <div class="order-note-admin">
                  <strong>
                    Ghi chú đơn:
                  </strong>

                  ${escapeHtml(
                    order.orderNote
                  )}
                </div>
              `
              : ""
          }

          <div class="actions">

            <button
              class="${
                order.status === "new"
                  ? "primary"
                  : "secondary"
              }"
              type="button"
              onclick="changeOrderStatus(
                '${escapeJs(order.id)}',
                'new'
              )"
            >
              Mới
            </button>

            <button
              class="${
                order.status ===
                "preparing"
                  ? "primary"
                  : "secondary"
              }"
              type="button"
              onclick="changeOrderStatus(
                '${escapeJs(order.id)}',
                'preparing'
              )"
            >
              Đang làm
            </button>

            <button
              class="${
                order.status === "done"
                  ? "primary"
                  : "secondary"
              }"
              type="button"
              onclick="changeOrderStatus(
                '${escapeJs(order.id)}',
                'done'
              )"
            >
              Hoàn thành
            </button>

          </div>

        </article>
      `;
    }).join("");
}


/* =========================================================
   CHANGE ORDER STATUS
========================================================= */

window.changeOrderStatus =
  async function (
    orderId,
    status
  ) {
    try {
      await db
        .collection("orders")
        .doc(orderId)
        .update({
          status,

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });
    } catch (error) {
      console.error(error);

      alert(
        "Không cập nhật được đơn: " +
        error.message
      );
    }
  };


/* =========================================================
   STATS
========================================================= */

function loadStats() {
  if (unsubscribeStats) {
    unsubscribeStats();
  }

  unsubscribeStats = db
    .collection("dailyStats")
    .orderBy("date", "desc")
    .limit(31)
    .onSnapshot(
      (snapshot) => {
        const stats =
          snapshot.docs.map(
            (doc) => ({
              id: doc.id,
              ...doc.data()
            })
          );

        renderStats(stats);
      },

      (error) => {
        console.error(
          "Stats:",
          error
        );

        $("historyTable").innerHTML = `
          <tr>
            <td colspan="4">
              Không tải được thống kê:
              ${escapeHtml(
                error.message
              )}
            </td>
          </tr>
        `;
      }
    );
}


/* =========================================================
   RENDER STATS
========================================================= */

function renderStats(stats) {
  const today =
    dateKeyVN();

  const todayData =
    stats.find(
      (item) =>
        item.date === today ||
        item.id === today
    ) || {};

  $("todayOrders").textContent =
    Number(
      todayData.orders || 0
    );

  $("todayCups").textContent =
    Number(
      todayData.cups || 0
    );

  $("todayRevenue").textContent =
    money(
      todayData.revenue || 0
    );

  if (!stats.length) {
    $("historyTable").innerHTML = `
      <tr>
        <td colspan="4">
          Chưa có dữ liệu doanh thu.
        </td>
      </tr>
    `;

    return;
  }

  $("historyTable").innerHTML =
    stats.map((item) => `
      <tr>

        <td>
          <strong>
            ${escapeHtml(
              formatDateKey(
                item.date ||
                item.id
              )
            )}
          </strong>
        </td>

        <td>
          ${Number(
            item.orders || 0
          )}
        </td>

        <td>
          ${Number(
            item.cups || 0
          )}
        </td>

        <td>
          <strong>
            ${money(
              item.revenue || 0
            )}
          </strong>
        </td>

      </tr>
    `).join("");
}


/* =========================================================
   STORE SETTINGS
========================================================= */

function loadStoreSettings() {
  if (unsubscribeStore) {
    unsubscribeStore();
  }

  unsubscribeStore = db
    .collection("storeSettings")
    .doc("contact")
    .onSnapshot(
      (doc) => {
        if (!doc.exists) {
          setDefaultStoreForm();
          return;
        }

        const data =
          doc.data() || {};

        $("storeName").value =
          data.name ||
          "CHENG COFFEE";

        $("storePhone").value =
          data.phone || "";

        $("storeHours").value =
          data.openingHours || "";

        $("storeAddress").value =
          data.address || "";

        $("storeFacebook").value =
          data.facebook || "";

        $("storeZalo").value =
          data.zalo || "";

        $("storeTagline").value =
          data.tagline ||
          "Một chút cà phê, một chút bình yên.";
      },

      (error) => {
        console.error(
          "Store settings:",
          error
        );

        $("storeMessage").textContent =
          "Không tải được thông tin quán: " +
          error.message;
      }
    );
}


function setDefaultStoreForm() {
  $("storeName").value =
    "CHENG COFFEE";

  $("storePhone").value = "";

  $("storeHours").value =
    "07:00 - 22:00";

  $("storeAddress").value = "";

  $("storeFacebook").value = "";

  $("storeZalo").value = "";

  $("storeTagline").value =
    "Một chút cà phê, một chút bình yên.";
}


/* =========================================================
   SAVE STORE SETTINGS
========================================================= */

$("storeForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const name =
      $("storeName")
        .value
        .trim();

    if (!name) {
      $("storeMessage").textContent =
        "Vui lòng nhập tên quán.";

      return;
    }

    const facebook =
      normalizeOptionalUrl(
        $("storeFacebook").value
      );

    const zalo =
      normalizeOptionalUrl(
        $("storeZalo").value
      );

    if (
      $("storeFacebook")
        .value
        .trim() &&
      !facebook
    ) {
      $("storeMessage").textContent =
        "Link Facebook phải bắt đầu bằng http:// hoặc https://";

      return;
    }

    if (
      $("storeZalo")
        .value
        .trim() &&
      !zalo
    ) {
      $("storeMessage").textContent =
        "Link Zalo phải bắt đầu bằng http:// hoặc https://";

      return;
    }

    $("storeMessage").textContent =
      "Đang lưu...";

    try {
      await db
        .collection("storeSettings")
        .doc("contact")
        .set({
          name:
            name.slice(0, 100),

          phone:
            $("storePhone")
              .value
              .trim()
              .slice(0, 30),

          openingHours:
            $("storeHours")
              .value
              .trim()
              .slice(0, 100),

          address:
            $("storeAddress")
              .value
              .trim()
              .slice(0, 200),

          facebook:
            facebook.slice(0, 300),

          zalo:
            zalo.slice(0, 300),

          tagline:
            $("storeTagline")
              .value
              .trim()
              .slice(0, 180),

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      $("storeMessage").textContent =
        "Đã lưu thông tin quán.";
    } catch (error) {
      console.error(
        "Save store:",
        error
      );

      $("storeMessage").textContent =
        "Không lưu được: " +
        error.message;
    }
  }
);


/* =========================================================
   PUSH NOTIFICATION
========================================================= */

function messagingSupported() {
  return (
    typeof firebase.messaging ===
    "function"
  );
}


async function getMessagingInstance() {
  if (!messagingSupported()) {
    throw new Error(
      "Trình duyệt không hỗ trợ Firebase Messaging."
    );
  }

  return firebase.messaging();
}


function getSavedPushToken() {
  return localStorage.getItem(
    "chengAdminPushToken"
  ) || "";
}


function setPushMessage(message) {
  $("pushMessage").textContent =
    message;
}


function updatePushUI() {
  const permission =
    "Notification" in window
      ? Notification.permission
      : "unsupported";

  const hasToken =
    !!getSavedPushToken();

  if (
    permission === "granted" &&
    hasToken
  ) {
    $("pushStatusBadge").textContent =
      "Đã bật";

    $("pushStatusBadge")
      .classList.add("online");

    return;
  }

  $("pushStatusBadge")
    .classList.remove("online");

  if (permission === "denied") {
    $("pushStatusBadge").textContent =
      "Đã chặn";
  } else {
    $("pushStatusBadge").textContent =
      "Chưa bật";
  }
}


/* =========================================================
   ENABLE PUSH
========================================================= */

$("enablePushBtn").addEventListener(
  "click",
  async () => {
    try {
      if (
        !("Notification" in window)
      ) {
        throw new Error(
          "Thiết bị này không hỗ trợ thông báo."
        );
      }

      setPushMessage(
        "Đang bật thông báo..."
      );

      const permission =
        await Notification
          .requestPermission();

      if (
        permission !== "granted"
      ) {
        throw new Error(
          "Bạn chưa cho phép thông báo."
        );
      }

      const registration =
        await navigator
          .serviceWorker
          .register(
            "/firebase-messaging-sw.js"
          );

      const messaging =
        await getMessagingInstance();

      /*
        Nếu firebase-config.js của bạn
        có FIREBASE_VAPID_KEY thì sử dụng.
      */

      const options = {
        serviceWorkerRegistration:
          registration
      };

      if (self.FIREBASE_VAPID_KEY) {
        options.vapidKey =
          self.FIREBASE_VAPID_KEY;
      }

      const token =
        await messaging.getToken(
          options
        );

      if (!token) {
        throw new Error(
          "Không lấy được token thông báo."
        );
      }

      const user =
        auth.currentUser;

      if (!isAdminUser(user)) {
        throw new Error(
          "Admin chưa đăng nhập."
        );
      }

      const deviceId =
        await sha256(token);

      await db
        .collection("adminDevices")
        .doc(deviceId)
        .set({
          token,

          uid:
            user.uid,

          updatedAt:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      localStorage.setItem(
        "chengAdminPushToken",
        token
      );

      setPushMessage(
        "Đã bật thông báo đơn mới."
      );

      updatePushUI();
    } catch (error) {
      console.error(
        "Enable push:",
        error
      );

      setPushMessage(
        error.message ||
        "Không bật được thông báo."
      );

      updatePushUI();
    }
  }
);


/* =========================================================
   DISABLE PUSH
========================================================= */

$("disablePushBtn").addEventListener(
  "click",
  async () => {
    try {
      const token =
        getSavedPushToken();

      if (token) {
        const deviceId =
          await sha256(token);

        await db
          .collection("adminDevices")
          .doc(deviceId)
          .delete()
          .catch(() => {});

        try {
          const messaging =
            await getMessagingInstance();

          await messaging.deleteToken();
        } catch (error) {
          console.warn(
            "Delete FCM token:",
            error
          );
        }
      }

      localStorage.removeItem(
        "chengAdminPushToken"
      );

      setPushMessage(
        "Đã tắt nhận thông báo trên thiết bị này."
      );

      updatePushUI();
    } catch (error) {
      console.error(
        "Disable push:",
        error
      );

      setPushMessage(
        error.message ||
        "Không tắt được thông báo."
      );
    }
  }
);


/* =========================================================
   TEST PUSH
========================================================= */

$("testPushBtn").addEventListener(
  "click",
  async () => {
    try {
      setPushMessage(
        "Đang gửi thông báo thử..."
      );

      const user =
        auth.currentUser;

      if (!isAdminUser(user)) {
        throw new Error(
          "Admin chưa đăng nhập."
        );
      }

      await user.getIdToken(true);

      await testAdminPush();

      setPushMessage(
        "Đã gửi thông báo thử."
      );
    } catch (error) {
      console.error(
        "Test push:",
        error
      );

      setPushMessage(
        error.message ||
        "Không gửi được thông báo thử."
      );
    }
  }
);


/* =========================================================
   CHANGE PASSWORD
========================================================= */

$("changePasswordForm")
  .addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const currentPassword =
        $("currentPassword").value;

      const newPassword =
        $("newPassword").value;

      const confirmPassword =
        $("confirmPassword").value;

      if (
        newPassword.length < 8
      ) {
        $("passwordMessage")
          .textContent =
          "Mật khẩu mới phải có ít nhất 8 ký tự.";

        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        $("passwordMessage")
          .textContent =
          "Hai mật khẩu mới không giống nhau.";

        return;
      }

      const user =
        auth.currentUser;

      if (!isAdminUser(user)) {
        $("passwordMessage")
          .textContent =
          "Admin chưa đăng nhập.";

        return;
      }

      $("passwordMessage")
        .textContent =
        "Đang đổi mật khẩu...";

      try {
        const credential =
          firebase.auth
            .EmailAuthProvider
            .credential(
              ADMIN_EMAIL,
              currentPassword
            );

        await user
          .reauthenticateWithCredential(
            credential
          );

        await user.updatePassword(
          newPassword
        );

        $("changePasswordForm")
          .reset();

        $("passwordMessage")
          .textContent =
          "Đổi mật khẩu thành công.";
      } catch (error) {
        console.error(
          "Password:",
          error
        );

        if (
          error.code ===
          "auth/invalid-credential"
        ) {
          $("passwordMessage")
            .textContent =
            "Mật khẩu hiện tại không đúng.";
        } else {
          $("passwordMessage")
            .textContent =
            error.message ||
            "Không đổi được mật khẩu.";
        }
      }
    }
  );


/* =========================================================
   DATE HELPERS
========================================================= */

function dateKeyVN() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    ).formatToParts(
      new Date()
    );

  const map = {};

  parts.forEach((part) => {
    map[part.type] =
      part.value;
  });

  return (
    map.year +
    "-" +
    map.month +
    "-" +
    map.day
  );
}


function formatDateKey(value) {
  const text =
    String(value || "");

  const parts =
    text.split("-");

  if (parts.length !== 3) {
    return text;
  }

  return (
    parts[2] +
    "/" +
    parts[1] +
    "/" +
    parts[0]
  );
}


function timestampMs(timestamp) {
  if (!timestamp) {
    return 0;
  }

  if (
    typeof timestamp.toMillis ===
    "function"
  ) {
    return timestamp.toMillis();
  }

  return 0;
}


function formatDateTime(timestamp) {
  if (
    !timestamp ||
    typeof timestamp.toDate !==
      "function"
  ) {
    return "Vừa đặt";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      timeZone:
        "Asia/Ho_Chi_Minh",

      hour:
        "2-digit",

      minute:
        "2-digit",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  ).format(
    timestamp.toDate()
  );
}


/* =========================================================
   URL
========================================================= */

function normalizeOptionalUrl(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  if (
    /^https?:\/\//i.test(text)
  ) {
    return text;
  }

  return "";
}


/* =========================================================
   SLUG
========================================================= */

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}


/* =========================================================
   HASH
========================================================= */

async function sha256(value) {
  const data =
    new TextEncoder()
      .encode(value);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function escapeJs(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      "'",
      "\\'"
    );
}


/* =========================================================
   START UI
========================================================= */

updatePushUI();