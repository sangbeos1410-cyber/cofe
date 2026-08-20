/* =========================================================
   CHENG COFFEE ADMIN - V7
========================================================= */

const ADMIN_EMAIL =
  "sangbeos1410@gmail.com";


const $ = id =>
  document.getElementById(id);


const money = value =>
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


/* =========================================================
   FIREBASE
========================================================= */

if (!firebase.apps.length) {

  firebase.initializeApp(
    self.FIREBASE_CONFIG
  );

}


const auth =
  firebase.auth();


const db =
  firebase.firestore();


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
)
.catch(
  console.error
);


/* =========================================================
   AUTH HELPERS
========================================================= */

function isAdminUser(user) {

  return (
    !!user
    &&
    String(
      user.email || ""
    ).toLowerCase()
    ===
    ADMIN_EMAIL.toLowerCase()
  );

}


/* =========================================================
   SHOW LOGIN / ADMIN
========================================================= */

function showLogin() {

  $("loginPanel").hidden =
    false;

  $("loginPanel").style.display =
    "grid";


  $("adminApp").hidden =
    true;

  $("adminApp").style.display =
    "none";


  $("logoutBtn").hidden =
    true;

  $("logoutBtn").style.display =
    "none";

}


function showAdmin() {

  $("loginPanel").hidden =
    true;

  $("loginPanel").style.display =
    "none";


  $("adminApp").hidden =
    false;

  $("adminApp").style.display =
    "block";


  $("logoutBtn").hidden =
    false;

  $("logoutBtn").style.display =
    "inline-block";

}


/* =========================================================
   AUTH STATE
========================================================= */

auth.onAuthStateChanged(
  async user => {

    stopAdmin();


    if (
      isAdminUser(user)
    ) {

      try {

        await user
          .getIdToken(true);

      } catch (error) {

        console.error(
          "Refresh token:",
          error
        );

      }


      showAdmin();

      startAdmin();

    } else {

      showLogin();

    }

  }
);


/* =========================================================
   LOGIN
========================================================= */

$("loginForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const password =
        $("password").value;


      $("loginMessage")
        .textContent =
        "Đang đăng nhập...";


      try {

        const credential =
          await auth
            .signInWithEmailAndPassword(
              ADMIN_EMAIL,
              password
            );


        if (
          !isAdminUser(
            credential.user
          )
        ) {

          await auth.signOut();


          throw new Error(
            "Tài khoản không có quyền Admin."
          );

        }


        await credential.user
          .getIdToken(true);


        $("password").value =
          "";


        $("loginMessage")
          .textContent =
          "";


        showAdmin();

      } catch (error) {

        console.error(
          "Login:",
          error
        );


        if (
          error.code ===
            "auth/invalid-credential"
          ||
          error.code ===
            "auth/wrong-password"
        ) {

          $("loginMessage")
            .textContent =
            "Mật khẩu không đúng.";

        } else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          $("loginMessage")
            .textContent =
            "Bạn thử quá nhiều lần. Vui lòng chờ rồi thử lại.";

        } else {

          $("loginMessage")
            .textContent =
            error.message ||
            "Không đăng nhập được.";

        }

      }

    }
  );


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        stopAdmin();

        await auth.signOut();

        showLogin();

      } catch (error) {

        console.error(
          error
        );

      }

    }
  );


/* =========================================================
   START / STOP
========================================================= */

function startAdmin() {

  loadMenu();

  loadOrders();

  loadStats();

  loadStoreSettings();

  loadPaymentSettings();

  updatePushUI();

}


function stopAdmin() {

  const unsubscribers = [

    unsubscribeMenu,

    unsubscribeOrders,

    unsubscribeStats,

    unsubscribeStore,

    unsubscribePayment

  ];


  unsubscribers
    .forEach(
      unsubscribe => {

        if (
          typeof unsubscribe ===
          "function"
        ) {

          try {

            unsubscribe();

          } catch (_) {}

        }

      }
    );


  unsubscribeMenu = null;
  unsubscribeOrders = null;
  unsubscribeStats = null;
  unsubscribeStore = null;
  unsubscribePayment = null;


  MENU = [];
  ORDERS = [];

}


/* =========================================================
   TABS
========================================================= */

document
  .querySelectorAll(
    ".tab-button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const tab =
            button.dataset.tab;


          document
            .querySelectorAll(
              ".tab-button"
            )
            .forEach(
              item =>
                item.classList
                  .remove(
                    "active"
                  )
            );


          button.classList
            .add(
              "active"
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


          const target =
            $(
              "tab-" + tab
            );


          if (target) {

            target.classList
              .add(
                "active"
              );

          }

        }
      );

    }
  );


/* =========================================================
   MENU LOAD
========================================================= */

function normalizeMenu(doc) {

  const data =
    doc.data() || {};


  return {

    id:
      doc.id,


    name:
      String(
        data.name || ""
      ),


    category:
      String(
        data.category || "Khác"
      ),


    description:
      String(
        data.description || ""
      ),


    sizes:
      Array.isArray(
        data.sizes
      )
      ?
      data.sizes
      :
      [],


    toppings:
      Array.isArray(
        data.toppings
      )
      ?
      data.toppings
      :
      [],


    active:
      data.active === true

  };

}


function loadMenu() {

  if (
    unsubscribeMenu
  ) {

    unsubscribeMenu();

  }


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
                normalizeMenu
              )
              .sort(
                (a, b) => {

                  const categoryCompare =
                    String(
                      a.category
                    )
                    .localeCompare(
                      String(
                        b.category
                      ),
                      "vi"
                    );


                  if (
                    categoryCompare !==
                    0
                  ) {

                    return categoryCompare;

                  }


                  return String(
                    a.name
                  )
                  .localeCompare(
                    String(
                      b.name
                    ),
                    "vi"
                  );

                }
              );


          renderMenuTable();

        },


        error => {

          console.error(
            "Menu:",
            error
          );


          $("menuTable")
            .innerHTML = `

              <tr>

                <td colspan="7">

                  Không tải được menu:

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
   RENDER MENU
========================================================= */

function renderMenuTable() {

  if (
    !MENU.length
  ) {

    $("menuTable")
      .innerHTML = `

        <tr>

          <td colspan="7">
            Chưa có món trong menu.
          </td>

        </tr>

      `;

    return;

  }


  $("menuTable")
    .innerHTML =

    MENU.map(
      item => {


        const sizeText =
          item.sizes
            .map(
              size =>

                `${escapeHtml(
                  size.name ||
                  size.id
                )}: ${money(
                  size.price
                )}`

            )
            .join("<br>");


        const toppingText =
          item.toppings.length

          ?

          item.toppings
            .map(
              topping =>

                `${escapeHtml(
                  topping.name
                )} (+${money(
                  topping.price
                )})`

            )
            .join("<br>")

          :

          "—";


        return `

          <tr>

            <td>

              <strong>
                ${escapeHtml(
                  item.id
                )}
              </strong>

            </td>


            <td>

              <strong>
                ${escapeHtml(
                  item.name
                )}
              </strong>


              ${
                item.description

                ?

                `

                  <div class="muted">

                    ${escapeHtml(
                      item.description
                    )}

                  </div>

                `

                :

                ""
              }

            </td>


            <td>
              ${escapeHtml(
                item.category
              )}
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

                ?

                `

                  <span class="status-pill online">
                    Đang bán
                  </span>

                `

                :

                `

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
                  onclick="
                    editMenuItem(
                      '${escapeJs(
                        item.id
                      )}'
                    )
                  "
                >
                  Sửa
                </button>


                <button
                  class="secondary"
                  type="button"
                  onclick="
                    toggleMenuItem(
                      '${escapeJs(
                        item.id
                      )}'
                    )
                  "
                >

                  ${
                    item.active
                    ?
                    "Ẩn"
                    :
                    "Bật"
                  }

                </button>


                <button
                  class="danger"
                  type="button"
                  onclick="
                    deleteMenuItem(
                      '${escapeJs(
                        item.id
                      )}'
                    )
                  "
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


/* =========================================================
   MENU SIZES
========================================================= */

function buildSizes() {

  const result =
    [];


  const values = [

    [
      "S",
      $("sizeS").value
    ],

    [
      "M",
      $("sizeM").value
    ],

    [
      "L",
      $("sizeL").value
    ]

  ];


  values.forEach(
    (
      [
        id,
        rawValue
      ]
    ) => {

      if (
        String(
          rawValue
        ).trim() === ""
      ) {

        return;

      }


      const price =
        Number(
          rawValue
        );


      if (
        !Number.isInteger(
          price
        )
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


/* =========================================================
   TOPPINGS
========================================================= */

function buildToppings() {

  const lines =
    String(
      $("toppingsText").value ||
      ""
    )
    .split("\n")
    .map(
      line =>
        line.trim()
    )
    .filter(Boolean);


  return lines.map(
    (
      line,
      index
    ) => {

      const parts =
        line
          .split("|")
          .map(
            value =>
              value.trim()
          );


      if (
        parts.length !== 2
      ) {

        throw new Error(
          `Topping dòng ${index + 1} phải có dạng: Tên | Giá`
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
        !Number.isInteger(
          price
        )
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
          )
          .slice(
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


/* =========================================================
   SAVE MENU
========================================================= */

$("menuForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

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
            "Mã món chỉ được dùng chữ, số, dấu - hoặc _."
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


        const description =
          $("itemDescription")
            .value
            .trim();


        if (!name) {

          throw new Error(
            "Vui lòng nhập tên món."
          );

        }


        if (!category) {

          throw new Error(
            "Vui lòng nhập danh mục."
          );

        }


        const sizes =
          buildSizes();


        if (
          !sizes.length
        ) {

          throw new Error(
            "Món phải có ít nhất một size."
          );

        }


        const toppings =
          buildToppings();


        $("saveBtn")
          .disabled =
          true;


        $("message")
          .textContent =
          "Đang lưu...";


        const data = {

          name:
            name.slice(
              0,
              100
            ),


          category:
            category.slice(
              0,
              80
            ),


          description:
            description.slice(
              0,
              300
            ),


          sizes,


          toppings,


          active:
            $("itemActive")
              .checked,


          updatedAt:
            firebase
              .firestore
              .FieldValue
              .serverTimestamp()

        };


        if (
          !editingId
        ) {

          const oldDoc =
            await db
              .collection(
                "menu"
              )
              .doc(id)
              .get();


          if (
            oldDoc.exists
          ) {

            throw new Error(
              "Mã món này đã tồn tại."
            );

          }

        }


        /*
          Không merge để loại bỏ
          field price của cấu trúc cũ.
        */

        await db
          .collection(
            "menu"
          )
          .doc(id)
          .set(data);


        resetMenuForm();


        $("message")
          .textContent =
          editingId
          ?
          "Đã cập nhật món."
          :
          "Đã lưu món.";


      } catch (error) {

        console.error(
          "Save menu:",
          error
        );


        $("message")
          .textContent =
          error.message ||
          "Không lưu được món.";

      } finally {

        $("saveBtn")
          .disabled =
          false;

      }

    }
  );


/* =========================================================
   EDIT MENU
========================================================= */

window.editMenuItem =
  function (id) {

    const item =
      MENU.find(
        menuItem =>
          menuItem.id === id
      );


    if (!item) {
      return;
    }


    editingId =
      item.id;


    $("formTitle")
      .textContent =
      "Sửa món";


    $("saveBtn")
      .textContent =
      "Lưu thay đổi";


    $("cancelBtn")
      .hidden =
      false;


    $("itemId")
      .value =
      item.id;


    $("itemId")
      .disabled =
      true;


    $("itemName")
      .value =
      item.name;


    $("itemCategory")
      .value =
      item.category;


    $("itemDescription")
      .value =
      item.description || "";


    $("sizeS").value = "";
    $("sizeM").value = "";
    $("sizeL").value = "";


    item.sizes
      .forEach(
        size => {

          const sizeId =
            String(
              size.id || ""
            )
            .toUpperCase();


          if (
            sizeId === "S"
          ) {

            $("sizeS")
              .value =
              Number(
                size.price
              ) || 0;

          }


          if (
            sizeId === "M"
          ) {

            $("sizeM")
              .value =
              Number(
                size.price
              ) || 0;

          }


          if (
            sizeId === "L"
          ) {

            $("sizeL")
              .value =
              Number(
                size.price
              ) || 0;

          }

        }
      );


    $("toppingsText")
      .value =

      item.toppings
        .map(
          topping =>

            `${topping.name} | ${Number(
              topping.price
            ) || 0}`

        )
        .join("\n");


    $("itemActive")
      .checked =
      item.active;


    $("message")
      .textContent =
      `Đang sửa ${item.name}`;


    window.scrollTo({

      top:
        $("menuForm")
          .getBoundingClientRect()
          .top
        +
        window.scrollY
        -
        120,


      behavior:
        "smooth"

    });

  };


function resetMenuForm() {

  editingId =
    null;


  $("menuForm")
    .reset();


  $("itemId")
    .disabled =
    false;


  $("itemActive")
    .checked =
    true;


  $("formTitle")
    .textContent =
    "Thêm món mới";


  $("saveBtn")
    .textContent =
    "Thêm món";


  $("cancelBtn")
    .hidden =
    true;

}


$("cancelBtn")
  .addEventListener(
    "click",
    () => {

      resetMenuForm();

      $("message")
        .textContent =
        "";

    }
  );


/* =========================================================
   TOGGLE MENU
========================================================= */

window.toggleMenuItem =
  async function (id) {

    const item =
      MENU.find(
        menuItem =>
          menuItem.id === id
      );


    if (!item) {
      return;
    }


    try {

      await db
        .collection(
          "menu"
        )
        .doc(id)
        .update({

          active:
            !item.active,


          updatedAt:
            firebase
              .firestore
              .FieldValue
              .serverTimestamp()

        });

    } catch (error) {

      console.error(
        error
      );


      alert(
        "Không thay đổi được trạng thái món: "
        +
        error.message
      );

    }

  };


/* =========================================================
   DELETE MENU
========================================================= */

window.deleteMenuItem =
  async function (id) {

    const item =
      MENU.find(
        menuItem =>
          menuItem.id === id
      );


    if (!item) {
      return;
    }


    if (
      !confirm(
        `Xóa món "${item.name}"?\n\nĐơn cũ sẽ không bị mất.`
      )
    ) {

      return;

    }


    try {

      await db
        .collection(
          "menu"
        )
        .doc(id)
        .delete();


      if (
        editingId === id
      ) {

        resetMenuForm();

      }

    } catch (error) {

      console.error(
        error
      );


      alert(
        "Không xóa được món: "
        +
        error.message
      );

    }

  };


/* =========================================================
   ORDERS
========================================================= */

function loadOrders() {

  if (
    unsubscribeOrders
  ) {

    unsubscribeOrders();

  }


  const today =
    dateKeyVN();


  unsubscribeOrders =
    db
      .collection(
        "orders"
      )
      .where(
        "dateKey",
        "==",
        today
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

          console.error(
            "Orders:",
            error
          );


          $("ordersList")
            .innerHTML = `

              <div class="empty-admin">

                Không tải được đơn:

                ${escapeHtml(
                  error.message
                )}

              </div>

            `;

        }

      );

}


/* =========================================================
   ORDER FULFILLMENT HELPERS
========================================================= */

function fulfillmentLabel(
  order
) {

  if (
    order.fulfillmentType ===
    "delivery"
  ) {

    return "🛵 Giao tận nơi";

  }


  return "☕ Tại quán";

}


function paymentLabel(
  order
) {

  if (
    order.paymentMethod ===
    "bank_transfer"
  ) {

    return "🏦 Chuyển khoản";

  }


  return "💵 Tiền mặt";

}


function paymentStatusLabel(
  order
) {

  return (
    order.paymentStatus ===
    "paid"
  )
  ?
  "Đã thanh toán"
  :
  "Chưa thanh toán";

}


/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders() {

  if (
    !ORDERS.length
  ) {

    $("ordersList")
      .innerHTML = `

        <div class="empty-admin">
          Hôm nay chưa có đơn nào.
        </div>

      `;

    return;

  }


  $("ordersList")
    .innerHTML =

    ORDERS.map(
      order => {


        const items =
          Array.isArray(
            order.items
          )
          ?
          order.items
          :
          [];


        const customer =
          order.customer &&
          typeof order.customer ===
            "object"
          ?
          order.customer
          :
          {};


        const isDelivery =
          order.fulfillmentType ===
          "delivery";


        const isBank =
          order.paymentMethod ===
          "bank_transfer";


        const isPaid =
          order.paymentStatus ===
          "paid";


        const itemsHtml =
          items
            .map(
              item => {


                const toppings =
                  Array.isArray(
                    item.toppings
                  )
                  ?
                  item.toppings
                  :
                  [];


                const toppingText =
                  toppings.length

                  ?

                  toppings
                    .map(
                      topping =>
                        topping.name
                    )
                    .join(", ")

                  :

                  "Không topping";


                return `

                  <div class="order-item">

                    <div>

                      <div class="order-item-name">

                        ${
                          Number(
                            item.quantity
                          ) || 1
                        }

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

                        ?

                        `

                          <div class="item-note-admin">

                            <strong>
                              Ghi chú món:
                            </strong>

                            ${escapeHtml(
                              item.note
                            )}

                          </div>

                        `

                        :

                        ""
                      }

                    </div>


                    <strong>
                      ${money(
                        item.subtotal
                      )}
                    </strong>

                  </div>

                `;

              }
            )
            .join("");


        const customerHtml =
          isDelivery

          ?

          `

            <div class="delivery-info">

              <div class="delivery-info-grid">

                <div class="info-row">

                  <span>
                    Người nhận
                  </span>

                  <strong>
                    ${escapeHtml(
                      customer.name || ""
                    )}
                  </strong>

                </div>


                <div class="info-row">

                  <span>
                    Điện thoại
                  </span>

                  <strong>
                    ${escapeHtml(
                      customer.phone || ""
                    )}
                  </strong>

                </div>


                <div class="info-row">

                  <span>
                    Địa chỉ
                  </span>

                  <strong>
                    ${escapeHtml(
                      customer.address || ""
                    )}
                  </strong>

                </div>


                <div class="info-row">

                  <span>
                    Ghi chú giao hàng
                  </span>

                  <strong>
                    ${escapeHtml(
                      order.deliveryNote ||
                      "Không có"
                    )}
                  </strong>

                </div>

              </div>

            </div>

          `

          :

          `

            <div class="dinein-info">

              <div class="info-row">

                <span>
                  Số bàn
                </span>

                <strong>
                  ${
                    escapeHtml(
                      order.table || "?"
                    )
                  }
                </strong>

              </div>

            </div>

          `;


        return `

          <article class="order-card">

            <div class="order-head">

              <div>

                <div class="order-title-row">

                  <div class="order-id">

                    ${
                      isDelivery

                      ?

                      escapeHtml(
                        customer.name ||
                        "Khách giao hàng"
                      )

                      :

                      "Bàn "
                      +
                      escapeHtml(
                        order.table || "?"
                      )
                    }

                  </div>


                  <span
                    class="
                      status-pill
                      ${
                        isDelivery
                        ?
                        "delivery"
                        :
                        "dine-in"
                      }
                    "
                  >

                    ${
                      fulfillmentLabel(
                        order
                      )
                    }

                  </span>

                </div>


                <div class="order-time">

                  ${formatDateTime(
                    order.createdAt
                  )}

                  •

                  ${
                    Number(
                      order.cups || 0
                    )
                  }

                  món

                </div>

              </div>


              <div class="order-total">

                ${money(
                  order.total
                )}

              </div>

            </div>


            ${customerHtml}


            ${itemsHtml}


            ${
              order.orderNote

              ?

              `

                <div class="order-note-admin">

                  <strong>
                    Ghi chú đơn:
                  </strong>

                  ${escapeHtml(
                    order.orderNote
                  )}

                </div>

              `

              :

              ""
            }


            <div class="order-payment-box">

              <div class="order-payment-head">

                <strong>
                  ${paymentLabel(
                    order
                  )}
                </strong>


                <div>

                  <span
                    class="
                      status-pill
                      ${
                        isBank
                        ?
                        "bank"
                        :
                        "cash"
                      }
                    "
                  >

                    ${
                      isBank
                      ?
                      "Chuyển khoản"
                      :
                      "Tiền mặt"
                    }

                  </span>


                  <span
                    class="
                      status-pill
                      ${
                        isPaid
                        ?
                        "paid"
                        :
                        "pending"
                      }
                    "
                  >

                    ${
                      paymentStatusLabel(
                        order
                      )
                    }

                  </span>

                </div>

              </div>


              <div class="payment-status-actions">

                <button
                  class="
                    ${
                      !isPaid
                      ?
                      "primary"
                      :
                      "secondary"
                    }
                  "
                  type="button"
                  onclick="
                    changePaymentStatus(
                      '${escapeJs(
                        order.id
                      )}',
                      'pending'
                    )
                  "
                >
                  Chưa thanh toán
                </button>


                <button
                  class="
                    ${
                      isPaid
                      ?
                      "primary"
                      :
                      "secondary"
                    }
                  "
                  type="button"
                  onclick="
                    changePaymentStatus(
                      '${escapeJs(
                        order.id
                      )}',
                      'paid'
                    )
                  "
                >
                  Đã thanh toán
                </button>

              </div>

            </div>


            <div class="actions">

              <button
                class="
                  ${
                    order.status ===
                    "new"
                    ?
                    "primary"
                    :
                    "secondary"
                  }
                "
                type="button"
                onclick="
                  changeOrderStatus(
                    '${escapeJs(
                      order.id
                    )}',
                    'new'
                  )
                "
              >
                Mới
              </button>


              <button
                class="
                  ${
                    order.status ===
                    "preparing"
                    ?
                    "primary"
                    :
                    "secondary"
                  }
                "
                type="button"
                onclick="
                  changeOrderStatus(
                    '${escapeJs(
                      order.id
                    )}',
                    'preparing'
                  )
                "
              >
                Đang làm
              </button>


              <button
                class="
                  ${
                    order.status ===
                    "done"
                    ?
                    "primary"
                    :
                    "secondary"
                  }
                "
                type="button"
                onclick="
                  changeOrderStatus(
                    '${escapeJs(
                      order.id
                    )}',
                    'done'
                  )
                "
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


/* =========================================================
   ORDER STATUS
========================================================= */

window.changeOrderStatus =
  async function (
    orderId,
    status
  ) {

    if (
      ![
        "new",
        "preparing",
        "done"
      ].includes(status)
    ) {

      return;

    }


    try {

      await db
        .collection(
          "orders"
        )
        .doc(
          orderId
        )
        .update({

          status,


          updatedAt:
            firebase
              .firestore
              .FieldValue
              .serverTimestamp()

        });

    } catch (error) {

      console.error(
        error
      );


      alert(
        "Không cập nhật được trạng thái đơn: "
        +
        error.message
      );

    }

  };


/* =========================================================
   PAYMENT STATUS
========================================================= */

window.changePaymentStatus =
  async function (
    orderId,
    paymentStatus
  ) {

    if (
      ![
        "pending",
        "paid"
      ].includes(
        paymentStatus
      )
    ) {

      return;

    }


    try {

      await db
        .collection(
          "orders"
        )
        .doc(
          orderId
        )
        .update({

          paymentStatus,


          updatedAt:
            firebase
              .firestore
              .FieldValue
              .serverTimestamp()

        });

    } catch (error) {

      console.error(
        error
      );


      alert(
        "Không cập nhật được thanh toán: "
        +
        error.message
      );

    }

  };


/* =========================================================
   STATS
========================================================= */

function loadStats() {

  if (
    unsubscribeStats
  ) {

    unsubscribeStats();

  }


  unsubscribeStats =
    db
      .collection(
        "dailyStats"
      )
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


          renderStats(
            stats
          );

        },


        error => {

          console.error(
            "Stats:",
            error
          );


          $("historyTable")
            .innerHTML = `

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


function renderStats(
  stats
) {

  const today =
    dateKeyVN();


  const todayData =
    stats.find(
      item =>
        item.date === today
        ||
        item.id === today
    )
    ||
    {};


  $("todayOrders")
    .textContent =
    Number(
      todayData.orders ||
      0
    );


  $("todayCups")
    .textContent =
    Number(
      todayData.cups ||
      0
    );


  $("todayRevenue")
    .textContent =
    money(
      todayData.revenue ||
      0
    );


  if (
    !stats.length
  ) {

    $("historyTable")
      .innerHTML = `

        <tr>

          <td colspan="4">
            Chưa có dữ liệu.
          </td>

        </tr>

      `;

    return;

  }


  $("historyTable")
    .innerHTML =

    stats.map(
      item => `

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
                item.revenue ||
                0
              )}

            </strong>

          </td>

        </tr>

      `
    )
    .join("");

}


/* =========================================================
   STORE SETTINGS
========================================================= */

function loadStoreSettings() {

  if (
    unsubscribeStore
  ) {

    unsubscribeStore();

  }


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

          const data =
            doc.exists
            ?
            doc.data() || {}
            :
            {};


          $("storeName")
            .value =
            data.name ||
            "CHENG COFFEE";


          $("storePhone")
            .value =
            data.phone ||
            "";


          $("storeHours")
            .value =
            data.openingHours ||
            "07:00 - 22:00";


          $("storeAddress")
            .value =
            data.address ||
            "";


          $("storeFacebook")
            .value =
            data.facebook ||
            "";


          $("storeZalo")
            .value =
            data.zalo ||
            "";


          $("storeTagline")
            .value =
            data.tagline ||
            "Một chút cà phê, một chút bình yên.";

        },


        error => {

          console.error(
            "Store:",
            error
          );


          $("storeMessage")
            .textContent =
            "Không tải được thông tin quán: "
            +
            error.message;

        }

      );

}


/* =========================================================
   SAVE STORE
========================================================= */

$("storeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

        const name =
          $("storeName")
            .value
            .trim();


        if (!name) {

          throw new Error(
            "Vui lòng nhập tên quán."
          );

        }


        const facebook =
          normalizeOptionalUrl(
            $("storeFacebook")
              .value
          );


        const zalo =
          normalizeOptionalUrl(
            $("storeZalo")
              .value
          );


        if (
          $("storeFacebook")
            .value
            .trim()
          &&
          !facebook
        ) {

          throw new Error(
            "Link Facebook phải bắt đầu bằng http:// hoặc https://"
          );

        }


        if (
          $("storeZalo")
            .value
            .trim()
          &&
          !zalo
        ) {

          throw new Error(
            "Link Zalo phải bắt đầu bằng http:// hoặc https://"
          );

        }


        $("storeMessage")
          .textContent =
          "Đang lưu...";


        await db
          .collection(
            "storeSettings"
          )
          .doc(
            "contact"
          )
          .set({

            name:
              name.slice(
                0,
                100
              ),


            phone:
              $("storePhone")
                .value
                .trim()
                .slice(
                  0,
                  30
                ),


            openingHours:
              $("storeHours")
                .value
                .trim()
                .slice(
                  0,
                  100
                ),


            address:
              $("storeAddress")
                .value
                .trim()
                .slice(
                  0,
                  200
                ),


            facebook:
              facebook.slice(
                0,
                300
              ),


            zalo:
              zalo.slice(
                0,
                300
              ),


            tagline:
              $("storeTagline")
                .value
                .trim()
                .slice(
                  0,
                  180
                ),


            updatedAt:
              firebase
                .firestore
                .FieldValue
                .serverTimestamp()

          });


        $("storeMessage")
          .textContent =
          "Đã lưu thông tin quán.";

      } catch (error) {

        console.error(
          "Store save:",
          error
        );


        $("storeMessage")
          .textContent =
          error.message ||
          "Không lưu được.";

      }

    }
  );


/* =========================================================
   PAYMENT SETTINGS
========================================================= */

function loadPaymentSettings() {

  if (
    unsubscribePayment
  ) {

    unsubscribePayment();

  }


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

          const data =
            doc.exists
            ?
            doc.data() || {}
            :
            {};


          $("paymentBankName")
            .value =
            data.bankName ||
            "";


          $("paymentAccountName")
            .value =
            data.accountName ||
            "";


          $("paymentAccountNumber")
            .value =
            data.accountNumber ||
            "";


          $("paymentQrImageUrl")
            .value =
            data.qrImageUrl ||
            "";


          $("paymentInstructions")
            .value =
            data.instructions ||
            "Vui lòng chuyển đúng số tiền của đơn.";


          updatePaymentPreview();

        },


        error => {

          console.error(
            "Payment settings:",
            error
          );


          $("paymentMessage")
            .textContent =
            "Không tải được cấu hình thanh toán: "
            +
            error.message;

        }

      );

}


/* =========================================================
   QR PREVIEW
========================================================= */

function updatePaymentPreview() {

  const url =
    normalizeOptionalUrl(
      $("paymentQrImageUrl")
        .value
    );


  if (url) {

    $("paymentQrPreview")
      .src =
      url;


    $("paymentQrPreview")
      .hidden =
      false;


    $("paymentQrPreviewEmpty")
      .hidden =
      true;

  } else {

    $("paymentQrPreview")
      .src =
      "";


    $("paymentQrPreview")
      .hidden =
      true;


    $("paymentQrPreviewEmpty")
      .hidden =
      false;

  }

}


$("paymentQrImageUrl")
  .addEventListener(
    "input",
    updatePaymentPreview
  );


$("paymentQrPreview")
  .addEventListener(
    "error",
    () => {

      $("paymentQrPreview")
        .hidden =
        true;


      $("paymentQrPreviewEmpty")
        .hidden =
        false;


      $("paymentQrPreviewEmpty")
        .textContent =
        "Không tải được ảnh QR";

    }
  );


$("paymentQrPreview")
  .addEventListener(
    "load",
    () => {

      $("paymentQrPreviewEmpty")
        .textContent =
        "Chưa có ảnh QR";

    }
  );


/* =========================================================
   SAVE PAYMENT SETTINGS
========================================================= */

$("paymentForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


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


        const qrImageUrl =
          normalizeOptionalUrl(
            $("paymentQrImageUrl")
              .value
          );


        const instructions =
          $("paymentInstructions")
            .value
            .trim();


        if (
          $("paymentQrImageUrl")
            .value
            .trim()
          &&
          !qrImageUrl
        ) {

          throw new Error(
            "Link ảnh QR phải bắt đầu bằng http:// hoặc https://"
          );

        }


        if (
          !bankName
          &&
          !accountName
          &&
          !accountNumber
          &&
          !qrImageUrl
        ) {

          throw new Error(
            "Vui lòng nhập thông tin tài khoản ngân hàng."
          );

        }


        $("paymentMessage")
          .textContent =
          "Đang lưu...";


        await db
          .collection(
            "storeSettings"
          )
          .doc(
            "payment"
          )
          .set({

            bankName:
              bankName.slice(
                0,
                100
              ),


            accountName:
              accountName.slice(
                0,
                120
              ),


            accountNumber:
              accountNumber.slice(
                0,
                50
              ),


            qrImageUrl:
              qrImageUrl.slice(
                0,
                500
              ),


            instructions:
              instructions.slice(
                0,
                300
              ),


            updatedAt:
              firebase
                .firestore
                .FieldValue
                .serverTimestamp()

          });


        $("paymentMessage")
          .textContent =
          "Đã lưu thông tin thanh toán.";


        updatePaymentPreview();

      } catch (error) {

        console.error(
          "Payment save:",
          error
        );


        $("paymentMessage")
          .textContent =
          error.message ||
          "Không lưu được thanh toán.";

      }

    }
  );


/* =========================================================
   PUSH
========================================================= */

function getSavedPushToken() {

  return localStorage
    .getItem(
      "chengAdminPushToken"
    )
    ||
    "";

}


function updatePushUI() {

  const permission =
    "Notification" in window
    ?
    Notification.permission
    :
    "unsupported";


  const token =
    getSavedPushToken();


  $("pushStatusBadge")
    .classList
    .remove(
      "online"
    );


  if (
    permission ===
      "granted"
    &&
    token
  ) {

    $("pushStatusBadge")
      .textContent =
      "Đã bật";


    $("pushStatusBadge")
      .classList
      .add(
        "online"
      );

  } else if (
    permission ===
    "denied"
  ) {

    $("pushStatusBadge")
      .textContent =
      "Đã chặn";

  } else {

    $("pushStatusBadge")
      .textContent =
      "Chưa bật";

  }

}


/* =========================================================
   ENABLE PUSH
========================================================= */

$("enablePushBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        if (
          !(
            "Notification"
            in window
          )
        ) {

          throw new Error(
            "Thiết bị không hỗ trợ thông báo."
          );

        }


        if (
          !(
            "serviceWorker"
            in navigator
          )
        ) {

          throw new Error(
            "Thiết bị không hỗ trợ Service Worker."
          );

        }


        $("pushMessage")
          .textContent =
          "Đang bật thông báo...";


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


        const messaging =
          firebase.messaging();


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
          await messaging
            .getToken(
              options
            );


        if (!token) {

          throw new Error(
            "Không lấy được token thông báo."
          );

        }


        const user =
          auth.currentUser;


        if (
          !isAdminUser(user)
        ) {

          throw new Error(
            "Admin chưa đăng nhập."
          );

        }


        const deviceId =
          await sha256(
            token
          );


        await db
          .collection(
            "adminDevices"
          )
          .doc(
            deviceId
          )
          .set({

            token,


            uid:
              user.uid,


            updatedAt:
              firebase
                .firestore
                .FieldValue
                .serverTimestamp()

          });


        localStorage
          .setItem(
            "chengAdminPushToken",
            token
          );


        $("pushMessage")
          .textContent =
          "Đã bật thông báo đơn mới.";


        updatePushUI();

      } catch (error) {

        console.error(
          "Push:",
          error
        );


        $("pushMessage")
          .textContent =
          error.message ||
          "Không bật được thông báo.";


        updatePushUI();

      }

    }
  );


/* =========================================================
   DISABLE PUSH
========================================================= */

$("disablePushBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        const token =
          getSavedPushToken();


        if (token) {

          const deviceId =
            await sha256(
              token
            );


          await db
            .collection(
              "adminDevices"
            )
            .doc(
              deviceId
            )
            .delete()
            .catch(
              () => {}
            );


          try {

            const messaging =
              firebase.messaging();


            await messaging
              .deleteToken();

          } catch (error) {

            console.warn(
              error
            );

          }

        }


        localStorage
          .removeItem(
            "chengAdminPushToken"
          );


        $("pushMessage")
          .textContent =
          "Đã tắt thông báo trên thiết bị này.";


        updatePushUI();

      } catch (error) {

        $("pushMessage")
          .textContent =
          error.message ||
          "Không tắt được thông báo.";

      }

    }
  );


/* =========================================================
   TEST PUSH
========================================================= */

$("testPushBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        $("pushMessage")
          .textContent =
          "Đang gửi thử...";


        if (
          !isAdminUser(
            auth.currentUser
          )
        ) {

          throw new Error(
            "Admin chưa đăng nhập."
          );

        }


        await auth
          .currentUser
          .getIdToken(true);


        await testAdminPush();


        $("pushMessage")
          .textContent =
          "Đã gửi thông báo thử.";

      } catch (error) {

        console.error(
          error
        );


        $("pushMessage")
          .textContent =
          error.message ||
          "Không gửi được thông báo.";

      }

    }
  );


/* =========================================================
   PASSWORD
========================================================= */

$("changePasswordForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const currentPassword =
        $("currentPassword")
          .value;


      const newPassword =
        $("newPassword")
          .value;


      const confirmPassword =
        $("confirmPassword")
          .value;


      if (
        newPassword.length <
        8
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


      if (
        !isAdminUser(user)
      ) {

        $("passwordMessage")
          .textContent =
          "Admin chưa đăng nhập.";

        return;

      }


      try {

        $("passwordMessage")
          .textContent =
          "Đang đổi mật khẩu...";


        const credential =
          firebase
            .auth
            .EmailAuthProvider
            .credential(
              ADMIN_EMAIL,
              currentPassword
            );


        await user
          .reauthenticateWithCredential(
            credential
          );


        await user
          .updatePassword(
            newPassword
          );


        $("changePasswordForm")
          .reset();


        $("passwordMessage")
          .textContent =
          "Đổi mật khẩu thành công.";

      } catch (error) {

        console.error(
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
   DATE
========================================================= */

function dateKeyVN() {

  const parts =
    new Intl
      .DateTimeFormat(
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


  const values = {};


  parts.forEach(
    part => {

      values[
        part.type
      ] =
      part.value;

    }
  );


  return (
    values.year
    +
    "-"
    +
    values.month
    +
    "-"
    +
    values.day
  );

}


function formatDateKey(
  value
) {

  const parts =
    String(
      value || ""
    )
    .split("-");


  if (
    parts.length !==
    3
  ) {

    return String(
      value || ""
    );

  }


  return (
    parts[2]
    +
    "/"
    +
    parts[1]
    +
    "/"
    +
    parts[0]
  );

}


function timestampMs(
  timestamp
) {

  if (
    !timestamp
  ) {

    return 0;

  }


  if (
    typeof timestamp.toMillis ===
    "function"
  ) {

    return timestamp
      .toMillis();

  }


  return 0;

}


function formatDateTime(
  timestamp
) {

  if (
    !timestamp
    ||
    typeof timestamp.toDate !==
      "function"
  ) {

    return "Vừa đặt";

  }


  return new Intl
    .DateTimeFormat(
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
    )
    .format(
      timestamp.toDate()
    );

}


/* =========================================================
   URL
========================================================= */

function normalizeOptionalUrl(
  value
) {

  const text =
    String(
      value || ""
    )
    .trim();


  if (!text) {

    return "";

  }


  if (
    /^https?:\/\//i
      .test(text)
  ) {

    return text;

  }


  return "";

}


/* =========================================================
   SLUGIFY
========================================================= */

function slugify(value) {

  return String(
    value || ""
  )
  .normalize(
    "NFD"
  )
  .replace(
    /[\u0300-\u036f]/g,
    ""
  )
  .toLowerCase()
  .replace(
    /đ/g,
    "d"
  )
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
   SHA256
========================================================= */

async function sha256(
  value
) {

  const data =
    new TextEncoder()
      .encode(
        value
      );


  const hash =
    await crypto.subtle
      .digest(
        "SHA-256",
        data
      );


  return Array
    .from(
      new Uint8Array(
        hash
      )
    )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(
  value
) {

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


function escapeJs(
  value
) {

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
   INITIAL UI
========================================================= */

showLogin();

updatePushUI();