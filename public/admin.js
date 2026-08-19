(() => {

  "use strict";


  // =========================================
  // DOM
  // =========================================

  const $ = id =>
    document.getElementById(id);


  const money = n =>
    new Intl.NumberFormat(
      "vi-VN"
    ).format(
      Number(n) || 0
    ) + "đ";


  let MENU = [];

  let editingId = null;

  let realtimeListeners = [];

  let messaging = null;

  let currentFcmToken =
    localStorage.getItem(
      "fcmToken"
    ) || "";


  // =========================================
  // FIREBASE
  // =========================================

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
        self.FIREBASE_FUNCTIONS_REGION
        ||
        "asia-southeast1"
      );


  auth.setPersistence(
    firebase.auth.Auth.Persistence.LOCAL
  )
  .catch(
    console.error
  );


  // =========================================
  // HELPER
  // =========================================

  function isAdmin(user) {

    if (!user) {
      return false;
    }


    return String(
      user.email || ""
    )
    .toLowerCase()

    ===

    String(
      self.ADMIN_EMAIL || ""
    )
    .toLowerCase();

  }


  function todayKey() {

    return new Intl
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
      .format(
        new Date()
      );

  }


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


  function makeId(value) {

    return String(value)

      .normalize("NFD")

      .replace(
        /[\u0300-\u036f]/g,
        ""
      )

      .toLowerCase()

      .replace(
        /[^a-z0-9]+/g,
        "-"
      )

      .replace(
        /^-|-$/g,
        ""
      )

      .slice(
        0,
        40
      );

  }


  function showMessage(text) {

    const el =
      $("message");

    if (el) {
      el.textContent =
        text || "";
    }

  }


  // =========================================
  // HIỆN / ẨN LOGIN
  // =========================================

  function showLogin() {

    const loginPanel =
      $("loginPanel");

    const adminApp =
      $("adminApp");

    const logoutBtn =
      $("logoutBtn");


    if (loginPanel) {

      loginPanel.hidden =
        false;

      loginPanel.style.display =
        "grid";

    }


    if (adminApp) {

      adminApp.hidden =
        true;

      adminApp.style.display =
        "none";

    }


    if (logoutBtn) {

      logoutBtn.hidden =
        true;

      logoutBtn.style.display =
        "none";

    }

  }


  function showAdmin() {

    const loginPanel =
      $("loginPanel");

    const adminApp =
      $("adminApp");

    const logoutBtn =
      $("logoutBtn");


    if (loginPanel) {

      loginPanel.hidden =
        true;

      loginPanel.style.display =
        "none";

    }


    if (adminApp) {

      adminApp.hidden =
        false;

      adminApp.style.display =
        "block";

    }


    if (logoutBtn) {

      logoutBtn.hidden =
        false;

      logoutBtn.style.display =
        "inline-block";

    }

  }


  // =========================================
  // REALTIME CLEANUP
  // =========================================

  function stopRealtime() {

    realtimeListeners
      .forEach(
        unsubscribe => {

          try {

            unsubscribe();

          } catch (_) {}

        }
      );


    realtimeListeners = [];

  }


  // =========================================
  // TABS
  // =========================================

  document
    .querySelectorAll(
      ".tab"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".tab"
              )
              .forEach(
                tab => {

                  tab.classList
                    .remove(
                      "active"
                    );

                }
              );


            document
              .querySelectorAll(
                ".tab-page"
              )
              .forEach(
                page => {

                  page.classList
                    .remove(
                      "active"
                    );

                }
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


  // =========================================
  // LOGIN ADMIN
  // =========================================

  const loginForm =
    $("loginForm");


  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        $("loginMessage")
          .textContent =
          "Đang đăng nhập...";


        try {

          const password =
            $("password")
              .value;


          const credential =
            await auth
              .signInWithEmailAndPassword(

                self.ADMIN_EMAIL,

                password

              );


          if (
            !isAdmin(
              credential.user
            )
          ) {

            await auth.signOut();


            throw new Error(
              "Không có quyền Admin."
            );

          }


          $("password")
            .value = "";


          $("loginMessage")
            .textContent = "";


          showAdmin();

        } catch (error) {

          console.error(
            "Login error:",
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
              "Sai mật khẩu.";

          } else {

            $("loginMessage")
              .textContent =
              error.message
              ||
              "Không đăng nhập được.";

          }

        }

      }
    );

  }


  // =========================================
  // LOGOUT
  // =========================================

  const logoutBtn =
    $("logoutBtn");


  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      async () => {

        stopRealtime();


        await auth.signOut();


        showLogin();

      }
    );

  }


  // =========================================
  // AUTH STATE
  // =========================================

  auth.onAuthStateChanged(
    user => {

      stopRealtime();


      if (
        isAdmin(user)
      ) {

        showAdmin();

        startRealtime();

        refreshPushStatus();

      } else {

        showLogin();

      }

    }
  );


  // =========================================
  // REALTIME START
  // =========================================

  function startRealtime() {

    loadMenuRealtime();

    loadOrdersRealtime();

    loadTodayStats();

    loadHistory();

  }


  // =========================================
  // MENU REALTIME
  // =========================================

  function loadMenuRealtime() {

    const unsubscribe =
      db
        .collection(
          "menu"
        )
        .onSnapshot(

          snapshot => {

            MENU =
              snapshot.docs.map(
                doc => {

                  const data =
                    doc.data();


                  return {

                    id:
                      doc.id,

                    ...data,

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
                      []

                  };

                }
              );


            MENU.sort(
              (a, b) =>
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

            console.error(
              "Menu realtime error:",
              error
            );


            showMessage(
              "Không đọc được menu: "
              +
              error.message
            );

          }

        );


    realtimeListeners.push(
      unsubscribe
    );

  }


  // =========================================
  // ORDERS REALTIME
  // =========================================

  function loadOrdersRealtime() {

    const unsubscribe =
      db
        .collection(
          "orders"
        )

        .where(
          "dateKey",
          "==",
          todayKey()
        )

        .orderBy(
          "createdAt",
          "desc"
        )

        .limit(100)

        .onSnapshot(

          snapshot => {

            const orders =
              snapshot.docs.map(
                doc => ({

                  orderId:
                    doc.id,

                  ...doc.data()

                })
              );


            $("todayOrders")
              .textContent =
              orders.length;


            renderOrders(
              orders
            );

          },

          error => {

            console.error(
              "Orders realtime error:",
              error
            );


            $("ordersList")
              .innerHTML =
              `
              <p>
                Không tải được đơn:
                ${escapeHtml(
                  error.message
                )}
              </p>
              `;

          }

        );


    realtimeListeners.push(
      unsubscribe
    );

  }


  // =========================================
  // TODAY STATS
  // =========================================

  function loadTodayStats() {

    const unsubscribe =
      db
        .collection(
          "dailyStats"
        )

        .doc(
          todayKey()
        )

        .onSnapshot(

          doc => {

            const data =
              doc.exists
              ?
              doc.data()
              :
              {};


            $("todayCups")
              .textContent =
              Number(
                data.cups
                || 0
              );


            $("todayRevenue")
              .textContent =
              money(
                data.revenue
                || 0
              );

          },

          error => {

            console.error(
              "Stats error:",
              error
            );

          }

        );


    realtimeListeners.push(
      unsubscribe
    );

  }


  // =========================================
  // HISTORY
  // =========================================

  function loadHistory() {

    const unsubscribe =
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

            if (
              snapshot.empty
            ) {

              $("historyTable")
                .innerHTML =
                `
                <tr>
                  <td colspan="4">
                    Chưa có lịch sử.
                  </td>
                </tr>
                `;

              return;

            }


            $("historyTable")
              .innerHTML =

              snapshot.docs
                .map(
                  doc => {

                    const data =
                      doc.data();


                    return `

                      <tr>

                        <td>
                          ${
                            escapeHtml(
                              data.date
                              ||
                              doc.id
                            )
                          }
                        </td>

                        <td>
                          ${
                            Number(
                              data.orders
                              ||
                              0
                            )
                          }
                        </td>

                        <td>
                          ${
                            Number(
                              data.cups
                              ||
                              0
                            )
                          }
                        </td>

                        <td>
                          ${
                            money(
                              data.revenue
                              ||
                              0
                            )
                          }
                        </td>

                      </tr>

                    `;

                  }
                )
                .join("");

          },

          error => {

            console.error(
              "History error:",
              error
            );

          }

        );


    realtimeListeners.push(
      unsubscribe
    );

  }


  // =========================================
  // RENDER ORDERS
  // =========================================

  function renderOrders(
    orders
  ) {

    if (
      !orders.length
    ) {

      $("ordersList")
        .innerHTML =
        "<p>Chưa có đơn hôm nay.</p>";

      return;

    }


    $("ordersList")
      .innerHTML =

      orders.map(
        order => {

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

                  <div class="order-id">
                    ${
                      escapeHtml(
                        order.orderId
                      )
                    }
                  </div>

                  <div class="order-time">

                    ${
                      order.table
                      ?
                      "Bàn "
                      +
                      escapeHtml(
                        order.table
                      )
                      +
                      " • "
                      :
                      ""
                    }

                    ${
                      order.createdAt
                      &&
                      order.createdAt
                        .toDate
                      ?
                      order.createdAt
                        .toDate()
                        .toLocaleTimeString(
                          "vi-VN"
                        )
                      :
                      ""
                    }

                  </div>

                </div>


                <div class="order-total">

                  ${
                    money(
                      order.total
                      ||
                      0
                    )
                  }

                </div>

              </div>


              <div>

                ${
                  items.map(
                    item => {

                      const toppings =
                        Array.isArray(
                          item.toppings
                        )
                        ?
                        item.toppings
                        :
                        [];


                      return `

                        <div class="order-item">

                          <div>

                            <div class="order-item-name">

                              ${
                                escapeHtml(
                                  item.name
                                )
                              }

                              • Size

                              ${
                                escapeHtml(
                                  item.sizeName
                                  ||
                                  item.sizeId
                                  ||
                                  ""
                                )
                              }

                            </div>


                            <div class="order-item-info">

                              ${
                                Number(
                                  item.quantity
                                  ||
                                  0
                                )
                              }

                              ×

                              ${
                                money(
                                  item.unitPrice
                                  ||
                                  item.price
                                  ||
                                  0
                                )
                              }

                              ${
                                toppings.length
                                ?
                                " • "
                                +
                                escapeHtml(
                                  toppings
                                    .map(
                                      topping =>
                                        topping.name
                                    )
                                    .join(
                                      ", "
                                    )
                                )
                                :
                                ""
                              }

                            </div>

                          </div>


                          <strong>

                            ${
                              money(
                                item.subtotal
                                ||
                                0
                              )
                            }

                          </strong>

                        </div>

                      `;

                    }
                  )
                  .join("")
                }

              </div>


              <div class="actions">

                <button
                  class="secondary"
                  type="button"
                  data-order-id="${
                    escapeHtml(
                      order.orderId
                    )
                  }"
                  data-status="preparing"
                >
                  Đang làm
                </button>


                <button
                  class="primary"
                  type="button"
                  data-order-id="${
                    escapeHtml(
                      order.orderId
                    )
                  }"
                  data-status="done"
                >
                  Hoàn thành
                </button>


                <span class="badge">

                  ${
                    order.status ===
                    "done"
                    ?
                    "Hoàn thành"
                    :
                    order.status ===
                    "preparing"
                    ?
                    "Đang làm"
                    :
                    "Mới"
                  }

                </span>

              </div>

            </article>

          `;

        }
      )
      .join("");


    $("ordersList")
      .querySelectorAll(
        "[data-order-id]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              try {

                await db
                  .collection(
                    "orders"
                  )
                  .doc(
                    button.dataset
                      .orderId
                  )
                  .update({

                    status:
                      button.dataset
                        .status,

                    updatedAt:
                      firebase
                        .firestore
                        .FieldValue
                        .serverTimestamp()

                  });

              } catch (error) {

                alert(
                  error.message
                );

              }

            }
          );

        }
      );

  }


  // =========================================
  // MENU TABLE
  // =========================================

  function renderMenuTable() {

    if (
      !MENU.length
    ) {

      $("menuTable")
        .innerHTML =
        `
        <tr>
          <td colspan="6">
            Chưa có món.
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

                  (
                    size.name
                    ||
                    size.id
                  )

                  +

                  ": "

                  +

                  money(
                    size.price
                  )
              )
              .join(
                " • "
              );


          const toppingText =
            item.toppings.length
            ?
            item.toppings
              .map(
                topping =>

                  topping.name

                  +

                  ": "

                  +

                  money(
                    topping.price
                  )
              )
              .join(
                " • "
              )
            :
            "Không";


          return `

            <tr>

              <td>
                <strong>
                  ${
                    escapeHtml(
                      item.id
                    )
                  }
                </strong>
              </td>

              <td>
                ${
                  escapeHtml(
                    item.name
                  )
                }
              </td>

              <td>
                ${
                  escapeHtml(
                    sizeText
                  )
                }
              </td>

              <td>
                ${
                  escapeHtml(
                    toppingText
                  )
                }
              </td>

              <td>

                ${
                  item.active
                  ?
                  "Đang bán"
                  :
                  "Đã ẩn"
                }

              </td>

              <td>

                <div class="actions">

                  <button
                    type="button"
                    class="secondary"
                    data-menu-action="edit"
                    data-menu-id="${
                      escapeHtml(
                        item.id
                      )
                    }"
                  >
                    Sửa
                  </button>


                  <button
                    type="button"
                    class="secondary"
                    data-menu-action="toggle"
                    data-menu-id="${
                      escapeHtml(
                        item.id
                      )
                    }"
                  >

                    ${
                      item.active
                      ?
                      "Ẩn"
                      :
                      "Hiện"
                    }

                  </button>


                  <button
                    type="button"
                    class="danger"
                    data-menu-action="delete"
                    data-menu-id="${
                      escapeHtml(
                        item.id
                      )
                    }"
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


    $("menuTable")
      .querySelectorAll(
        "[data-menu-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const item =
                MENU.find(
                  item =>
                    item.id ===
                    button.dataset
                      .menuId
                );


              if (!item) {
                return;
              }


              const action =
                button.dataset
                  .menuAction;


              try {

                if (
                  action ===
                  "edit"
                ) {

                  fillMenuForm(
                    item
                  );

                }


                if (
                  action ===
                  "toggle"
                ) {

                  await db
                    .collection(
                      "menu"
                    )
                    .doc(
                      item.id
                    )
                    .update({

                      active:
                        !item.active,

                      updatedAt:
                        firebase
                          .firestore
                          .FieldValue
                          .serverTimestamp()

                    });

                }


                if (
                  action ===
                  "delete"
                ) {

                  const confirmed =
                    confirm(
                      `Xóa món "${item.name}"?`
                    );


                  if (
                    confirmed
                  ) {

                    await db
                      .collection(
                        "menu"
                      )
                      .doc(
                        item.id
                      )
                      .delete();

                  }

                }

              } catch (error) {

                showMessage(
                  error.message
                );

              }

            }
          );

        }
      );

  }


  // =========================================
  // EDIT MENU
  // =========================================

  function fillMenuForm(
    item
  ) {

    editingId =
      item.id;


    $("itemId")
      .value =
      item.id;


    $("itemId")
      .disabled =
      true;


    $("itemName")
      .value =
      item.name || "";


    $("itemCategory")
      .value =
      item.category || "";


    $("itemDescription")
      .value =
      item.description || "";


    const getSize =
      id =>
        item.sizes.find(
          size =>
            String(size.id)
            ===
            String(id)
        );


    $("sizeS")
      .value =
      getSize("S")
        ?.price
        ??
        "";


    $("sizeM")
      .value =
      getSize("M")
        ?.price
        ??
        "";


    $("sizeL")
      .value =
      getSize("L")
        ?.price
        ??
        "";


    $("toppingsText")
      .value =

      item.toppings
        .map(
          topping =>

            `${topping.name} | ${topping.price}`

        )
        .join("\n");


    $("itemActive")
      .checked =
      !!item.active;


    $("formTitle")
      .textContent =
      "Sửa món";


    $("saveBtn")
      .textContent =
      "Lưu thay đổi";


    $("cancelBtn")
      .hidden =
      false;

  }


  // =========================================
  // RESET FORM
  // =========================================

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


    showMessage("");

  }


  $("cancelBtn")
    .addEventListener(
      "click",
      resetMenuForm
    );


  // =========================================
  // SIZE PARSER
  // =========================================

  function parseSizes() {

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
      ([id, value]) => {

        if (
          String(value)
            .trim()
          !== ""
        ) {

          const price =
            Number(value);


          if (
            !Number.isInteger(
              price
            )
            ||
            price < 0
          ) {

            throw new Error(
              "Giá size không hợp lệ."
            );

          }


          result.push({

            id,

            name:
              id,

            price

          });

        }

      }
    );


    if (
      !result.length
    ) {

      throw new Error(
        "Phải có ít nhất một size."
      );

    }


    return result;

  }


  // =========================================
  // TOPPING PARSER
  // =========================================

  function parseToppings() {

    const text =
      $("toppingsText")
        .value;


    const lines =
      text
        .split("\n")

        .map(
          line =>
            line.trim()
        )

        .filter(Boolean);


    return lines.map(
      (line, index) => {

        const parts =
          line
            .split("|")
            .map(
              part =>
                part.trim()
            );


        if (
          parts.length !== 2
        ) {

          throw new Error(
            `Topping dòng ${
              index + 1
            } phải có dạng: Tên | Giá`
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
            `Topping dòng ${
              index + 1
            } không hợp lệ.`
          );

        }


        return {

          id:
            makeId(name)
            ||
            "tp-" + index,

          name,

          price

        };

      }
    );

  }


  // =========================================
  // SAVE MENU
  // =========================================

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


          const name =
            $("itemName")
              .value
              .trim();


          if (
            !/^[A-Z0-9_-]{1,30}$/
              .test(id)
          ) {

            throw new Error(
              "Mã món không hợp lệ."
            );

          }


          if (
            !name
          ) {

            throw new Error(
              "Tên món không được để trống."
            );

          }


          const data = {

            name,

            category:
              $("itemCategory")
                .value
                .trim(),

            description:
              $("itemDescription")
                .value
                .trim(),

            sizes:
              parseSizes(),

            toppings:
              parseToppings(),

            active:
              $("itemActive")
                .checked,

            updatedAt:
              firebase
                .firestore
                .FieldValue
                .serverTimestamp()

          };


          /*
            Không dùng merge:true.

            Mục đích:
            xóa field price cũ
            của menu V4.
          */

          await db
            .collection(
              "menu"
            )
            .doc(id)
            .set(
              data
            );


          resetMenuForm();


          showMessage(
            "Đã lưu menu thành công."
          );

        } catch (error) {

          console.error(
            "Save menu error:",
            error
          );


          showMessage(
            error.message
          );

        }

      }
    );


  // =========================================
  // PASSWORD
  // =========================================

  $("changePasswordForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try {

          const oldPassword =
            $("currentPassword")
              .value;


          const newPassword =
            $("newPassword")
              .value;


          const confirmPassword =
            $("confirmPassword")
              .value;


          if (
            newPassword.length
            < 8
          ) {

            throw new Error(
              "Mật khẩu mới phải có ít nhất 8 ký tự."
            );

          }


          if (
            newPassword
            !==
            confirmPassword
          ) {

            throw new Error(
              "Hai mật khẩu mới không khớp."
            );

          }


          const user =
            auth.currentUser;


          if (!user) {

            throw new Error(
              "Chưa đăng nhập Admin."
            );

          }


          const credential =
            firebase
              .auth
              .EmailAuthProvider
              .credential(

                user.email,

                oldPassword

              );


          await user
            .reauthenticateWithCredential(
              credential
            );


          await user
            .updatePassword(
              newPassword
            );


          $("currentPassword")
            .value = "";


          $("newPassword")
            .value = "";


          $("confirmPassword")
            .value = "";


          $("passwordMessage")
            .textContent =
            "Đổi mật khẩu thành công.";

        } catch (error) {

          $("passwordMessage")
            .textContent =
            error.message;

        }

      }
    );


  // =========================================
  // TOKEN HASH
  // =========================================

  async function sha256(
    text
  ) {

    const buffer =
      await crypto.subtle
        .digest(

          "SHA-256",

          new TextEncoder()
            .encode(text)

        );


    return [
      ...new Uint8Array(
        buffer
      )
    ]
    .map(
      value =>
        value
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");

  }


  // =========================================
  // PUSH STATUS
  // =========================================

  function refreshPushStatus() {

    if (
      "Notification"
      in window
      &&
      Notification.permission
      === "granted"
      &&
      currentFcmToken
    ) {

      $("pushStatusBadge")
        .textContent =
        "Đã bật";

    } else {

      $("pushStatusBadge")
        .textContent =
        "Chưa bật";

    }

  }


  // =========================================
  // ENABLE PUSH
  // =========================================

  $("enablePushBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          if (
            !(
              "serviceWorker"
              in navigator
            )
          ) {

            throw new Error(
              "Trình duyệt không hỗ trợ Service Worker."
            );

          }


          if (
            !(
              "Notification"
              in window
            )
          ) {

            throw new Error(
              "Trình duyệt không hỗ trợ thông báo."
            );

          }


          if (
            !self.FIREBASE_VAPID_KEY
          ) {

            throw new Error(
              "Chưa cấu hình FIREBASE_VAPID_KEY."
            );

          }


          const permission =
            await Notification
              .requestPermission();


          if (
            permission
            !== "granted"
          ) {

            throw new Error(
              "Bạn chưa cho phép thông báo."
            );

          }


          messaging =
            firebase.messaging();


          const registration =
            await navigator
              .serviceWorker
              .register(
                "/firebase-messaging-sw.js"
              );


          const token =
            await messaging
              .getToken({

                vapidKey:
                  self
                    .FIREBASE_VAPID_KEY,

                serviceWorkerRegistration:
                  registration

              });


          if (!token) {

            throw new Error(
              "Không lấy được FCM token."
            );

          }


          currentFcmToken =
            token;


          localStorage.setItem(
            "fcmToken",
            token
          );


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
                auth.currentUser.uid,

              updatedAt:
                firebase
                  .firestore
                  .FieldValue
                  .serverTimestamp()

            });


          $("pushStatusBadge")
            .textContent =
            "Đã bật";


          $("pushMessage")
            .textContent =
            "Đã bật thông báo trên thiết bị này.";

        } catch (error) {

          console.error(
            "Enable push error:",
            error
          );


          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


  // =========================================
  // DISABLE PUSH
  // =========================================

  $("disablePushBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          if (
            currentFcmToken
          ) {

            const deviceId =
              await sha256(
                currentFcmToken
              );


            await db
              .collection(
                "adminDevices"
              )
              .doc(
                deviceId
              )
              .delete();

          }


          if (
            messaging
          ) {

            try {

              await messaging
                .deleteToken();

            } catch (_) {}

          }


          currentFcmToken =
            "";


          localStorage.removeItem(
            "fcmToken"
          );


          $("pushStatusBadge")
            .textContent =
            "Đã tắt";


          $("pushMessage")
            .textContent =
            "Đã tắt thông báo.";

        } catch (error) {

          console.error(
            "Disable push error:",
            error
          );


          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


  // =========================================
  // TEST PUSH
  // =========================================

  $("testPushBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          $("pushMessage")
            .textContent =
            "Đang gửi thử...";


          await functions
            .httpsCallable(
              "testAdminPush"
            )({});


          $("pushMessage")
            .textContent =
            "Đã gửi thông báo thử.";

        } catch (error) {

          console.error(
            "Test push error:",
            error
          );


          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


  // =========================================
  // KHỞI ĐỘNG
  // =========================================

  /*
    Ban đầu bắt buộc ẩn Admin,
    hiện Login.

    Firebase Auth sau đó sẽ
    kiểm tra phiên đăng nhập.
  */

  showLogin();


})();