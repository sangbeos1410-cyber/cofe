const ADMIN_EMAIL =
  "sangbeos1410@gmail.com";


const $ =
  id =>
    document.getElementById(id);


const money =
  value =>
    new Intl.NumberFormat(
      "vi-VN"
    ).format(
      Number(value) || 0
    ) + "đ";


let MENU = [];
let ORDERS = [];

let editingId = null;

let unsubscribeMenu = null;
let unsubscribeOrders = null;
let unsubscribeStats = null;
let unsubscribeStore = null;
let unsubscribePayment = null;

let currentQrImageUrl = "";
let currentQrStoragePath = "";


/* =====================================
   FIREBASE
===================================== */

if (!firebase.apps.length) {

  firebase.initializeApp(
    self.FIREBASE_CONFIG
  );

}


const auth =
  firebase.auth();


const db =
  firebase.firestore();


const storage =
  firebase.storage();


const functions =
  firebase
    .app()
    .functions(
      self.FIREBASE_FUNCTIONS_REGION ||
      "asia-southeast1"
    );


const testAdminPush =
  functions.httpsCallable(
    "testAdminPush"
  );


auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
);


/* =====================================
   AUTH
===================================== */

function isAdminUser(user) {

  return !!user
    &&
    String(
      user.email || ""
    ).toLowerCase()
    ===
    ADMIN_EMAIL.toLowerCase();

}


function showLogin() {

  $("loginPanel").hidden =
    false;

  $("adminApp").hidden =
    true;

  $("logoutBtn").hidden =
    true;

}


function showAdmin() {

  $("loginPanel").hidden =
    true;

  $("adminApp").hidden =
    false;

  $("logoutBtn").hidden =
    false;

}


auth.onAuthStateChanged(
  async user => {

    stopAdmin();


    if (
      isAdminUser(user)
    ) {

      await user
        .getIdToken(true)
        .catch(console.error);


      showAdmin();

      startAdmin();

    } else {

      showLogin();

    }

  }
);


/* =====================================
   LOGIN
===================================== */

$("loginForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      $("loginMessage")
        .textContent =
        "Đang đăng nhập...";


      try {

        const credential =
          await auth
            .signInWithEmailAndPassword(
              ADMIN_EMAIL,
              $("password").value
            );


        if (
          !isAdminUser(
            credential.user
          )
        ) {

          await auth.signOut();

          throw new Error(
            "Không có quyền Admin."
          );

        }


        await credential.user
          .getIdToken(true);


        $("password").value =
          "";


        $("loginMessage")
          .textContent =
          "";

      } catch (error) {

        console.error(error);


        $("loginMessage")
          .textContent =

          error.code ===
            "auth/invalid-credential"

          ?

          "Mật khẩu không đúng."

          :

          (
            error.message ||
            "Không đăng nhập được."
          );

      }

    }
  );


$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      stopAdmin();

      await auth.signOut();

    }
  );


/* =====================================
   START
===================================== */

function startAdmin() {

  loadMenu();

  loadOrders();

  loadStats();

  loadStoreSettings();

  loadPaymentSettings();

  updatePushUI();

}


function stopAdmin() {

  [
    unsubscribeMenu,
    unsubscribeOrders,
    unsubscribeStats,
    unsubscribeStore,
    unsubscribePayment
  ]
  .forEach(
    fn => {

      if (
        typeof fn ===
        "function"
      ) {

        fn();

      }

    }
  );


  unsubscribeMenu = null;
  unsubscribeOrders = null;
  unsubscribeStats = null;
  unsubscribeStore = null;
  unsubscribePayment = null;

}


/* =====================================
   TABS
===================================== */

document
  .querySelectorAll(
    ".tab-button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".tab-button"
            )
            .forEach(
              b =>
                b.classList
                  .remove(
                    "active"
                  )
            );


          document
            .querySelectorAll(
              ".tab-page"
            )
            .forEach(
              page =>
                page.classList
                  .remove(
                    "active"
                  )
            );


          button.classList
            .add(
              "active"
            );


          const page =
            $(
              "tab-" +
              button.dataset.tab
            );


          if (page) {

            page.classList
              .add(
                "active"
              );

          }

        }
      );

    }
  );


/* =====================================
   MENU
===================================== */

function loadMenu() {

  unsubscribeMenu =
    db
      .collection(
        "menu"
      )
      .onSnapshot(
        snapshot => {

          MENU =
            snapshot.docs
              .map(
                doc => ({

                  id:
                    doc.id,

                  ...doc.data()

                })
              )
              .sort(
                (a, b) =>

                  String(
                    a.category || ""
                  )
                  .localeCompare(
                    String(
                      b.category || ""
                    ),
                    "vi"
                  )

                  ||

                  String(
                    a.name || ""
                  )
                  .localeCompare(
                    String(
                      b.name || ""
                    ),
                    "vi"
                  )
              );


          renderMenuTable();

        },

        error => {

          $("menuTable")
            .innerHTML =
            `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;

        }
      );

}


function renderMenuTable() {

  if (!MENU.length) {

    $("menuTable")
      .innerHTML =
      `<tr><td colspan="7">Chưa có món.</td></tr>`;

    return;

  }


  $("menuTable")
    .innerHTML =
    MENU.map(
      item => {

        const sizes =
          Array.isArray(
            item.sizes
          )
          ?
          item.sizes
          :
          [];


        const toppings =
          Array.isArray(
            item.toppings
          )
          ?
          item.toppings
          :
          [];


        return `

          <tr>

            <td>
              <strong>${escapeHtml(item.id)}</strong>
            </td>

            <td>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="muted">${escapeHtml(item.description || "")}</div>
            </td>

            <td>
              ${escapeHtml(item.category || "")}
            </td>

            <td>
              ${
                sizes.map(
                  x =>
                    `${escapeHtml(x.name || x.id)}: ${money(x.price)}`
                ).join("<br>")
                ||
                "—"
              }
            </td>

            <td>
              ${
                toppings.map(
                  x =>
                    `${escapeHtml(x.name)} (+${money(x.price)})`
                ).join("<br>")
                ||
                "—"
              }
            </td>

            <td>
              ${
                item.active
                ?
                '<span class="status-pill online">Đang bán</span>'
                :
                '<span class="status-pill">Đã ẩn</span>'
              }
            </td>

            <td>

              <div class="actions">

                <button
                  class="secondary"
                  onclick="editMenuItem('${escapeJs(item.id)}')"
                >
                  Sửa
                </button>

                <button
                  class="secondary"
                  onclick="toggleMenuItem('${escapeJs(item.id)}')"
                >
                  ${item.active ? "Ẩn" : "Bật"}
                </button>

                <button
                  class="danger"
                  onclick="deleteMenuItem('${escapeJs(item.id)}')"
                >
                  Xóa
                </button>

              </div>

            </td>

          </tr>

        `;

      }
    )
    .join("");

}


/* =====================================
   BUILD SIZE
===================================== */

function buildSizes() {

  const values = [
    ["S", $("sizeS").value],
    ["M", $("sizeM").value],
    ["L", $("sizeL").value]
  ];


  const result = [];


  values.forEach(
    ([id, raw]) => {

      if (
        String(raw).trim() ===
        ""
      ) {

        return;

      }


      const price =
        Number(raw);


      if (
        !Number.isInteger(price)
        ||
        price < 0
      ) {

        throw new Error(
          `Giá size ${id} không hợp lệ.`
        );

      }


      result.push({

        id,

        name:
          id,

        price

      });

    }
  );


  return result;

}


/* =====================================
   TOPPING
===================================== */

function slugify(value) {

  return String(
    value || ""
  )
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


function buildToppings() {

  const lines =
    $("toppingsText")
      .value
      .split("\n")
      .map(
        x =>
          x.trim()
      )
      .filter(Boolean);


  return lines.map(
    (line, index) => {

      const parts =
        line
          .split("|")
          .map(
            x =>
              x.trim()
          );


      if (
        parts.length !==
        2
      ) {

        throw new Error(
          `Topping dòng ${index + 1} phải là: Tên | Giá`
        );

      }


      const name =
        parts[0];


      const price =
        Number(
          parts[1]
        );


      if (
        !name
        ||
        !Number.isInteger(price)
        ||
        price < 0
      ) {

        throw new Error(
          `Topping dòng ${index + 1} không hợp lệ.`
        );

      }


      return {

        id:
          (
            slugify(name)
            ||
            `topping-${index + 1}`
          ).slice(
            0,
            40
          ),

        name:
          name.slice(
            0,
            80
          ),

        price

      };

    }
  );

}


/* =====================================
   SAVE MENU
===================================== */

$("menuForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

        const wasEditing =
          !!editingId;


        const id =
          (
            editingId
            ||
            $("itemId")
              .value
              .trim()
              .toUpperCase()
          );


        if (
          !/^[A-Z0-9_-]{1,30}$/
            .test(id)
        ) {

          throw new Error(
            "Mã món không hợp lệ."
          );

        }


        const name =
          $("itemName")
            .value
            .trim();


        const category =
          $("itemCategory")
            .value
            .trim();


        if (
          !name ||
          !category
        ) {

          throw new Error(
            "Tên món và danh mục không được để trống."
          );

        }


        const sizes =
          buildSizes();


        if (!sizes.length) {

          throw new Error(
            "Món phải có ít nhất một size."
          );

        }


        const toppings =
          buildToppings();


        if (!wasEditing) {

          const existing =
            await db
              .collection("menu")
              .doc(id)
              .get();


          if (existing.exists) {

            throw new Error(
              "Mã món đã tồn tại."
            );

          }

        }


        $("saveBtn").disabled =
          true;


        await db
          .collection(
            "menu"
          )
          .doc(id)
          .set({

            name:
              name.slice(0, 100),

            category:
              category.slice(0, 80),

            description:
              $("itemDescription")
                .value
                .trim()
                .slice(0, 300),

            sizes,

            toppings,

            active:
              $("itemActive").checked,

            updatedAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()

          });


        resetMenuForm();


        $("message")
          .textContent =
          wasEditing
          ?
          "Đã cập nhật món."
          :
          "Đã thêm món mới.";

      } catch (error) {

        $("message")
          .textContent =
          error.message;

      } finally {

        $("saveBtn").disabled =
          false;

      }

    }
  );


function resetMenuForm() {

  editingId = null;

  $("menuForm").reset();

  $("itemId").disabled =
    false;

  $("itemActive").checked =
    true;

  $("formTitle").textContent =
    "Thêm món mới";

  $("saveBtn").textContent =
    "Thêm món";

  $("cancelBtn").hidden =
    true;

}


window.editMenuItem =
  function(id) {

    const item =
      MENU.find(
        x =>
          x.id === id
      );


    if (!item) {
      return;
    }


    editingId =
      id;


    $("formTitle").textContent =
      "Sửa món";

    $("saveBtn").textContent =
      "Lưu thay đổi";

    $("cancelBtn").hidden =
      false;


    $("itemId").value =
      id;

    $("itemId").disabled =
      true;


    $("itemName").value =
      item.name || "";

    $("itemCategory").value =
      item.category || "";

    $("itemDescription").value =
      item.description || "";


    $("sizeS").value = "";
    $("sizeM").value = "";
    $("sizeL").value = "";


    (
      item.sizes || []
    )
    .forEach(
      size => {

        const key =
          "size" +
          String(
            size.id
          ).toUpperCase();


        if ($(key)) {

          $(key).value =
            size.price;

        }

      }
    );


    $("toppingsText").value =
      (
        item.toppings || []
      )
      .map(
        x =>
          `${x.name} | ${x.price}`
      )
      .join("\n");


    $("itemActive").checked =
      item.active === true;

  };


$("cancelBtn")
  .addEventListener(
    "click",
    resetMenuForm
  );


window.toggleMenuItem =
  async function(id) {

    const item =
      MENU.find(
        x =>
          x.id === id
      );


    if (!item) {
      return;
    }


    await db
      .collection("menu")
      .doc(id)
      .update({

        active:
          !item.active,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()

      });

  };


window.deleteMenuItem =
  async function(id) {

    const item =
      MENU.find(
        x =>
          x.id === id
      );


    if (!item) {
      return;
    }


    if (
      !confirm(
        `Xóa món "${item.name}"?`
      )
    ) {

      return;

    }


    await db
      .collection("menu")
      .doc(id)
      .delete();

  };


/* =====================================
   ORDERS
===================================== */

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
    )
    .formatToParts(
      new Date()
    );


  const map = {};


  parts.forEach(
    x =>
      map[x.type] =
        x.value
  );


  return `${map.year}-${map.month}-${map.day}`;

}


function timestampMs(value) {

  return value
    &&
    typeof value.toMillis ===
      "function"

    ?

    value.toMillis()

    :

    0;

}


function formatDateTime(value) {

  if (
    !value
    ||
    typeof value.toDate !==
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
        "2-digit"
    }
  )
  .format(
    value.toDate()
  );

}


function loadOrders() {

  unsubscribeOrders =
    db
      .collection("orders")
      .where(
        "dateKey",
        "==",
        dateKeyVN()
      )
      .onSnapshot(
        snapshot => {

          ORDERS =
            snapshot.docs
              .map(
                doc => ({

                  id:
                    doc.id,

                  ...doc.data()

                })
              )
              .sort(
                (a, b) =>
                  timestampMs(
                    b.createdAt
                  )
                  -
                  timestampMs(
                    a.createdAt
                  )
              );


          renderOrders();

        },

        error => {

          $("ordersList")
            .innerHTML =
            `<div class="empty-admin">${escapeHtml(error.message)}</div>`;

        }
      );

}


function renderOrders() {

  if (!ORDERS.length) {

    $("ordersList")
      .innerHTML =
      '<div class="empty-admin">Hôm nay chưa có đơn.</div>';

    return;

  }


  $("ordersList").innerHTML =
    ORDERS.map(
      order => {

        const delivery =
          order.fulfillmentType ===
          "delivery";


        const customer =
          order.customer || {};


        const items =
          Array.isArray(
            order.items
          )
          ?
          order.items
          :
          [];


        return `

          <article class="order-card">

            <div class="order-head">

              <div>

                <div class="order-title-row">

                  <div class="order-id">

                    ${
                      delivery
                      ?
                      escapeHtml(
                        customer.name ||
                        "Khách ship"
                      )
                      :
                      "Bàn " +
                      escapeHtml(
                        order.table || "?"
                      )
                    }

                  </div>

                  <span class="status-pill ${delivery ? "delivery" : "dine-in"}">

                    ${
                      delivery
                      ?
                      "🛵 Giao tận nơi"
                      :
                      "☕ Tại quán"
                    }

                  </span>

                </div>

                <div class="order-time">

                  ${formatDateTime(order.createdAt)}

                  • ${Number(order.cups || 0)} món

                </div>

              </div>

              <div class="order-total">
                ${money(order.total)}
              </div>

            </div>


            ${
              delivery
              ?

              `

                <div class="delivery-info">

                  <div class="delivery-info-grid">

                    <div class="info-row">
                      <span>Người nhận</span>
                      <strong>${escapeHtml(customer.name || "")}</strong>
                    </div>

                    <div class="info-row">
                      <span>Điện thoại</span>
                      <strong>${escapeHtml(customer.phone || "")}</strong>
                    </div>

                    <div class="info-row">
                      <span>Địa chỉ</span>
                      <strong>${escapeHtml(customer.address || "")}</strong>
                    </div>

                    <div class="info-row">
                      <span>Ghi chú giao hàng</span>
                      <strong>${escapeHtml(order.deliveryNote || "Không có")}</strong>
                    </div>

                  </div>

                </div>

              `

              :

              ""
            }


            ${
              items.map(
                item => `

                  <div class="order-item">

                    <div>

                      <div class="order-item-name">

                        ${item.quantity} ×
                        ${escapeHtml(item.name)}

                      </div>

                      <div class="order-item-info">

                        Size:
                        ${escapeHtml(item.sizeName || item.sizeId)}

                        <br>

                        Topping:
                        ${
                          (
                            item.toppings || []
                          )
                          .map(
                            t =>
                              escapeHtml(t.name)
                          )
                          .join(", ")
                          ||
                          "Không topping"
                        }

                      </div>

                      ${
                        item.note
                        ?
                        `<div class="item-note-admin"><strong>Ghi chú:</strong> ${escapeHtml(item.note)}</div>`
                        :
                        ""
                      }

                    </div>

                    <strong>
                      ${money(item.subtotal)}
                    </strong>

                  </div>

                `
              ).join("")
            }


            ${
              order.orderNote
              ?
              `<div class="order-note-admin"><strong>Ghi chú đơn:</strong> ${escapeHtml(order.orderNote)}</div>`
              :
              ""
            }


            <div class="order-payment-box">

              <div class="order-payment-head">

                <strong>

                  ${
                    order.paymentMethod ===
                    "bank_transfer"
                    ?
                    "🏦 Chuyển khoản"
                    :
                    "💵 Tiền mặt"
                  }

                </strong>

                <span class="status-pill ${order.paymentStatus === "paid" ? "paid" : "pending"}">

                  ${
                    order.paymentStatus ===
                    "paid"
                    ?
                    "Đã thanh toán"
                    :
                    "Chưa thanh toán"
                  }

                </span>

              </div>

              <div class="payment-status-actions">

                <button
                  class="secondary"
                  onclick="changePaymentStatus('${escapeJs(order.id)}','pending')"
                >
                  Chưa thanh toán
                </button>

                <button
                  class="primary"
                  onclick="changePaymentStatus('${escapeJs(order.id)}','paid')"
                >
                  Đã thanh toán
                </button>

              </div>

            </div>


            <div class="actions">

              <button
                class="secondary"
                onclick="changeOrderStatus('${escapeJs(order.id)}','new')"
              >
                Mới
              </button>

              <button
                class="secondary"
                onclick="changeOrderStatus('${escapeJs(order.id)}','preparing')"
              >
                Đang làm
              </button>

              <button
                class="primary"
                onclick="changeOrderStatus('${escapeJs(order.id)}','done')"
              >
                Hoàn thành
              </button>

            </div>

          </article>

        `;

      }
    )
    .join("");

}


window.changeOrderStatus =
  async function(
    id,
    status
  ) {

    await db
      .collection("orders")
      .doc(id)
      .update({

        status,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()

      });

  };


window.changePaymentStatus =
  async function(
    id,
    paymentStatus
  ) {

    await db
      .collection("orders")
      .doc(id)
      .update({

        paymentStatus,

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()

      });

  };


/* =====================================
   STATS
===================================== */

function loadStats() {

  unsubscribeStats =
    db
      .collection("dailyStats")
      .orderBy(
        "date",
        "desc"
      )
      .limit(31)
      .onSnapshot(
        snapshot => {

          const stats =
            snapshot.docs
              .map(
                doc => ({

                  id:
                    doc.id,

                  ...doc.data()

                })
              );


          const today =
            dateKeyVN();


          const current =
            stats.find(
              x =>
                x.date === today
                ||
                x.id === today
            )
            ||
            {};


          $("todayOrders").textContent =
            Number(
              current.orders || 0
            );


          $("todayCups").textContent =
            Number(
              current.cups || 0
            );


          $("todayRevenue").textContent =
            money(
              current.revenue || 0
            );


          $("historyTable").innerHTML =
            stats.length
            ?
            stats.map(
              x => `

                <tr>

                  <td>
                    ${escapeHtml(x.date || x.id)}
                  </td>

                  <td>
                    ${Number(x.orders || 0)}
                  </td>

                  <td>
                    ${Number(x.cups || 0)}
                  </td>

                  <td>
                    ${money(x.revenue || 0)}
                  </td>

                </tr>

              `
            ).join("")
            :
            '<tr><td colspan="4">Chưa có dữ liệu.</td></tr>';

        }
      );

}


/* =====================================
   STORE CONTACT
===================================== */

function loadStoreSettings() {

  unsubscribeStore =
    db
      .collection(
        "storeSettings"
      )
      .doc(
        "contact"
      )
      .onSnapshot(
        doc => {

          const x =
            doc.exists
            ?
            doc.data()
            :
            {};


          $("storeName").value =
            x.name ||
            "CHENG COFFEE";

          $("storePhone").value =
            x.phone || "";

          $("storeHours").value =
            x.openingHours ||
            "07:00 - 22:00";

          $("storeAddress").value =
            x.address || "";

          $("storeFacebook").value =
            x.facebook || "";

          $("storeZalo").value =
            x.zalo || "";

          $("storeTagline").value =
            x.tagline ||
            "Một chút cà phê, một chút bình yên.";

        }
      );

}


$("storeForm")
  .addEventListener(
    "submit",
    async event => {

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


      await db
        .collection(
          "storeSettings"
        )
        .doc(
          "contact"
        )
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
            $("storeFacebook")
              .value
              .trim()
              .slice(0, 300),

          zalo:
            $("storeZalo")
              .value
              .trim()
              .slice(0, 300),

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

    }
  );


/* =====================================
   PAYMENT LOAD
===================================== */

function loadPaymentSettings() {

  unsubscribePayment =
    db
      .collection(
        "storeSettings"
      )
      .doc(
        "payment"
      )
      .onSnapshot(
        doc => {

          const x =
            doc.exists
            ?
            doc.data()
            :
            {};


          $("paymentBankName").value =
            x.bankName || "";

          $("paymentAccountName").value =
            x.accountName || "";

          $("paymentAccountNumber").value =
            x.accountNumber || "";

          $("paymentInstructions").value =
            x.instructions ||
            "Vui lòng chuyển đúng số tiền của đơn.";


          currentQrImageUrl =
            x.qrImageUrl || "";


          currentQrStoragePath =
            x.qrStoragePath || "";


          renderQrPreview(
            currentQrImageUrl
          );

        }
      );

}


/* =====================================
   QR PREVIEW
===================================== */

function renderQrPreview(url) {

  if (url) {

    $("paymentQrPreview").src =
      url;

    $("paymentQrPreview").hidden =
      false;

    $("paymentQrPreviewEmpty").hidden =
      true;

    $("deleteQrBtn").disabled =
      false;

  } else {

    $("paymentQrPreview").src =
      "";

    $("paymentQrPreview").hidden =
      true;

    $("paymentQrPreviewEmpty").hidden =
      false;

    $("deleteQrBtn").disabled =
      true;

  }

}


$("paymentQrFile")
  .addEventListener(
    "change",
    () => {

      const file =
        $("paymentQrFile")
          .files[0];


      if (!file) {

        renderQrPreview(
          currentQrImageUrl
        );

        return;

      }


      if (
        ![
          "image/png",
          "image/jpeg",
          "image/webp"
        ]
        .includes(
          file.type
        )
      ) {

        $("paymentMessage").textContent =
          "Ảnh phải là PNG, JPG hoặc WEBP.";

        $("paymentQrFile").value =
          "";

        return;

      }


      if (
        file.size >
        5 * 1024 * 1024
      ) {

        $("paymentMessage").textContent =
          "Ảnh không được lớn hơn 5MB.";

        $("paymentQrFile").value =
          "";

        return;

      }


      $("paymentQrPreview").src =
        URL.createObjectURL(
          file
        );


      $("paymentQrPreview").hidden =
        false;


      $("paymentQrPreviewEmpty").hidden =
        true;


      $("paymentMessage").textContent =
        "Ảnh đã chọn. Bấm Lưu thanh toán.";

    }
  );


/* =====================================
   UPLOAD QR
===================================== */

async function uploadBankQr(file) {

  if (!file) {

    return {

      url:
        currentQrImageUrl,

      path:
        currentQrStoragePath

    };

  }


  const ext =
    file.type === "image/jpeg"
    ?
    "jpg"
    :
    file.type === "image/webp"
    ?
    "webp"
    :
    "png";


  const path =
    `bank-qr/cheng-coffee-payment.${ext}`;


  if (
    currentQrStoragePath
    &&
    currentQrStoragePath !==
    path
  ) {

    await storage
      .ref()
      .child(
        currentQrStoragePath
      )
      .delete()
      .catch(
        () => {}
      );

  }


  const ref =
    storage
      .ref()
      .child(
        path
      );


  const snapshot =
    await ref.put(
      file,
      {
        contentType:
          file.type
      }
    );


  return {

    url:
      await snapshot.ref
        .getDownloadURL(),

    path

  };

}


/* =====================================
   SAVE PAYMENT
===================================== */

$("paymentForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const button =
        $("savePaymentBtn");


      try {

        const bankName =
          $("paymentBankName")
            .value
            .trim();


        const accountName =
          $("paymentAccountName")
            .value
            .trim();


        const accountNumber =
          $("paymentAccountNumber")
            .value
            .trim();


        if (
          !bankName
          ||
          !accountName
          ||
          !accountNumber
        ) {

          throw new Error(
            "Vui lòng nhập đầy đủ thông tin ngân hàng."
          );

        }


        const file =
          $("paymentQrFile")
            .files[0];


        if (
          !file
          &&
          !currentQrImageUrl
        ) {

          throw new Error(
            "Vui lòng chọn ảnh QR."
          );

        }


        button.disabled =
          true;


        $("paymentMessage").textContent =
          file
          ?
          "Đang upload QR..."
          :
          "Đang lưu...";


        const qr =
          await uploadBankQr(
            file
          );


        await db
          .collection(
            "storeSettings"
          )
          .doc(
            "payment"
          )
          .set({

            bankName:
              bankName.slice(0, 100),

            accountName:
              accountName.slice(0, 120),

            accountNumber:
              accountNumber.slice(0, 50),

            qrImageUrl:
              String(
                qr.url || ""
              ).slice(
                0,
                1000
              ),

            qrStoragePath:
              String(
                qr.path || ""
              ).slice(
                0,
                300
              ),

            instructions:
              $("paymentInstructions")
                .value
                .trim()
                .slice(
                  0,
                  300
                ),

            updatedAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()

          });


        currentQrImageUrl =
          qr.url;


        currentQrStoragePath =
          qr.path;


        $("paymentQrFile").value =
          "";


        renderQrPreview(
          currentQrImageUrl
        );


        $("paymentMessage").textContent =
          "Đã lưu thanh toán và QR.";

      } catch (error) {

        console.error(error);


        $("paymentMessage").textContent =
          error.message ||
          "Không lưu được.";

      } finally {

        button.disabled =
          false;

      }

    }
  );


/* =====================================
   DELETE QR
===================================== */

$("deleteQrBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        !currentQrImageUrl
      ) {

        return;

      }


      if (
        !confirm(
          "Xóa ảnh QR ngân hàng?"
        )
      ) {

        return;

      }


      try {

        if (
          currentQrStoragePath
        ) {

          await storage
            .ref()
            .child(
              currentQrStoragePath
            )
            .delete()
            .catch(
              () => {}
            );

        }


        await db
          .collection(
            "storeSettings"
          )
          .doc(
            "payment"
          )
          .update({

            qrImageUrl:
              "",

            qrStoragePath:
              "",

            updatedAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()

          });


        currentQrImageUrl =
          "";

        currentQrStoragePath =
          "";


        renderQrPreview(
          ""
        );


        $("paymentMessage").textContent =
          "Đã xóa QR.";

      } catch (error) {

        $("paymentMessage").textContent =
          error.message;

      }

    }
  );


/* =====================================
   PUSH
===================================== */

function getSavedPushToken() {

  return localStorage
    .getItem(
      "chengAdminPushToken"
    )
    ||
    "";

}


function updatePushUI() {

  const active =
    "Notification" in window
    &&
    Notification.permission ===
      "granted"
    &&
    !!getSavedPushToken();


  $("pushStatusBadge")
    .textContent =
    active
    ?
    "Đã bật"
    :
    "Chưa bật";


  $("pushStatusBadge")
    .classList
    .toggle(
      "online",
      active
    );

}


async function sha256(value) {

  const data =
    new TextEncoder()
      .encode(value);


  const hash =
    await crypto.subtle
      .digest(
        "SHA-256",
        data
      );


  return Array.from(
    new Uint8Array(hash)
  )
  .map(
    x =>
      x.toString(16)
        .padStart(
          2,
          "0"
        )
  )
  .join("");

}


$("enablePushBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        const permission =
          await Notification
            .requestPermission();


        if (
          permission !==
          "granted"
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


        const options = {
          serviceWorkerRegistration:
            registration
        };


        if (
          self.FIREBASE_VAPID_KEY
        ) {

          options.vapidKey =
            self.FIREBASE_VAPID_KEY;

        }


        const token =
          await firebase
            .messaging()
            .getToken(
              options
            );


        const id =
          await sha256(
            token
          );


        await db
          .collection(
            "adminDevices"
          )
          .doc(id)
          .set({

            token,

            uid:
              auth.currentUser.uid,

            updatedAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()

          });


        localStorage.setItem(
          "chengAdminPushToken",
          token
        );


        $("pushMessage").textContent =
          "Đã bật thông báo.";


        updatePushUI();

      } catch (error) {

        $("pushMessage").textContent =
          error.message;

      }

    }
  );


$("disablePushBtn")
  .addEventListener(
    "click",
    async () => {

      const token =
        getSavedPushToken();


      if (token) {

        const id =
          await sha256(
            token
          );


        await db
          .collection(
            "adminDevices"
          )
          .doc(id)
          .delete()
          .catch(
            () => {}
          );

      }


      localStorage.removeItem(
        "chengAdminPushToken"
      );


      $("pushMessage").textContent =
        "Đã tắt thông báo.";


      updatePushUI();

    }
  );


$("testPushBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await auth.currentUser
          .getIdToken(true);


        await testAdminPush();


        $("pushMessage").textContent =
          "Đã gửi thông báo thử.";

      } catch (error) {

        $("pushMessage").textContent =
          error.message;

      }

    }
  );


/* =====================================
   PASSWORD
===================================== */

$("changePasswordForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const oldPassword =
        $("currentPassword")
          .value;


      const newPassword =
        $("newPassword")
          .value;


      if (
        newPassword !==
        $("confirmPassword")
          .value
      ) {

        $("passwordMessage").textContent =
          "Hai mật khẩu mới không giống nhau.";

        return;

      }


      try {

        const credential =
          firebase.auth
            .EmailAuthProvider
            .credential(
              ADMIN_EMAIL,
              oldPassword
            );


        await auth.currentUser
          .reauthenticateWithCredential(
            credential
          );


        await auth.currentUser
          .updatePassword(
            newPassword
          );


        $("changePasswordForm")
          .reset();


        $("passwordMessage").textContent =
          "Đổi mật khẩu thành công.";

      } catch (error) {

        $("passwordMessage").textContent =
          error.message;

      }

    }
  );


/* =====================================
   ESCAPE
===================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

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


showLogin();

updatePushUI();