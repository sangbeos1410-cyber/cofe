(() => {

  "use strict";


  const $ = id =>
    document.getElementById(id);


  const money = n =>
    new Intl.NumberFormat("vi-VN")
      .format(Number(n) || 0) + "đ";


  let MENU = [];

  let editingId = null;

  let realtimeListeners = [];

  let messaging = null;

  let currentFcmToken =
    localStorage.getItem("fcmToken") || "";


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


  auth.setPersistence(
    firebase.auth.Auth.Persistence.LOCAL
  );


  function isAdmin(user) {

    return (
      user &&
      String(
        user.email || ""
      ).toLowerCase()
      ===
      String(
        self.ADMIN_EMAIL || ""
      ).toLowerCase()
    );

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

    return String(value ?? "")

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
      );

  }


  function showLogin() {

    $("loginPanel")
      .hidden = false;

    $("adminApp")
      .hidden = true;

    $("logoutBtn")
      .hidden = true;

  }


  function showAdmin() {

    $("loginPanel")
      .hidden = true;

    $("adminApp")
      .hidden = false;

    $("logoutBtn")
      .hidden = false;

  }


  function stopRealtime() {

    realtimeListeners
      .forEach(listener => {

        try {

          listener();

        } catch (_) {}

      });


    realtimeListeners = [];

  }


  // =============================
  // TABS
  // =============================


  document
    .querySelectorAll(".tab")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab")
            .forEach(x =>
              x.classList
                .remove("active")
            );


          document
            .querySelectorAll(
              ".tab-page"
            )
            .forEach(x =>
              x.classList
                .remove("active")
            );


          button.classList
            .add("active");


          $(
            "tab-" +
            button.dataset.tab
          )
          .classList
          .add("active");

        }
      );

    });


  // =============================
  // LOGIN
  // =============================


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

                self.ADMIN_EMAIL,

                $("password")
                  .value

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

        } catch (error) {

          console.error(error);


          if (
            error.code ===
            "auth/invalid-credential"
          ) {

            $("loginMessage")
              .textContent =
              "Sai mật khẩu.";

          } else {

            $("loginMessage")
              .textContent =
              error.message ||
              "Không đăng nhập được.";

          }

        }

      }
    );


  $("logoutBtn")
    .addEventListener(
      "click",
      () => {

        auth.signOut();

      }
    );


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


  // =============================
  // REALTIME
  // =============================


  function startRealtime() {

    loadMenuRealtime();

    loadOrdersRealtime();

    loadTodayStats();

    loadHistory();

  }


  function loadMenuRealtime() {

    const unsubscribe =
      db
        .collection("menu")
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

                        ? data.sizes

                        : [],

                    toppings:
                      Array.isArray(
                        data.toppings
                      )

                        ? data.toppings

                        : []

                  };

                }
              );


            renderMenuTable();

          },

          error => {

            $("message")
              .textContent =

              "Không đọc được menu: "

              +

              error.message;

          }

        );


    realtimeListeners
      .push(
        unsubscribe
      );

  }


  function loadOrdersRealtime() {

    const unsubscribe =
      db
        .collection("orders")

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

            $("ordersList")
              .textContent =

              "Không tải được đơn: "

              +

              error.message;

          }

        );


    realtimeListeners
      .push(
        unsubscribe
      );

  }


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
                ? doc.data()
                : {};


            $("todayCups")
              .textContent =
              data.cups || 0;


            $("todayRevenue")
              .textContent =
              money(
                data.revenue || 0
              );

          }
        );


    realtimeListeners
      .push(
        unsubscribe
      );

  }


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
                              data.date ||
                              doc.id
                            )
                          }
                        </td>

                        <td>
                          ${
                            data.orders || 0
                          }
                        </td>

                        <td>
                          ${
                            data.cups || 0
                          }
                        </td>

                        <td>
                          ${
                            money(
                              data.revenue ||
                              0
                            )
                          }
                        </td>

                      </tr>

                    `;

                  }
                )
                .join("");

          }
        );


    realtimeListeners
      .push(
        unsubscribe
      );

  }


  // =============================
  // ORDERS
  // =============================


  function renderOrders(
    orders
  ) {

    if (
      !orders.length
    ) {

      $("ordersList")
        .innerHTML =
        "Chưa có đơn hôm nay.";

      return;

    }


    $("ordersList")
      .innerHTML =

      orders.map(
        order => `

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
                      ? "Bàn " +
                        escapeHtml(
                          order.table
                        ) +
                        " • "
                      : ""
                  }

                  ${
                    order.createdAt
                      ?.toDate

                      ? order
                          .createdAt
                          .toDate()
                          .toLocaleTimeString(
                            "vi-VN"
                          )

                      : ""
                  }

                </div>

              </div>


              <div class="order-total">

                ${
                  money(
                    order.total || 0
                  )
                }

              </div>

            </div>


            <div>

              ${
                (
                  order.items || []
                )
                .map(
                  item => `

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
                              item.sizeName ||
                              item.sizeId ||
                              ""
                            )
                          }

                        </div>


                        <div class="order-item-info">

                          ${
                            item.quantity || 0
                          }

                          ×

                          ${
                            money(
                              item.unitPrice ||
                              item.price ||
                              0
                            )
                          }


                          ${
                            (
                              item.toppings ||
                              []
                            ).length

                              ? " • " +
                                escapeHtml(
                                  item
                                    .toppings
                                    .map(
                                      topping =>
                                        topping.name
                                    )
                                    .join(", ")
                                )

                              : ""
                          }

                        </div>

                      </div>


                      <strong>

                        ${
                          money(
                            item.subtotal ||
                            0
                          )
                        }

                      </strong>

                    </div>

                  `
                )
                .join("")
              }

            </div>


            <div class="actions">

              <button
                class="secondary"
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
                  order.status === "done"

                    ? "Hoàn thành"

                    : order.status ===
                      "preparing"

                      ? "Đang làm"

                      : "Mới"
                }

              </span>

            </div>

          </article>

        `
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


  // =============================
  // MENU
  // =============================


  function renderMenuTable() {

    $("menuTable")
      .innerHTML =

      MENU.map(
        item => `

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
                  item.sizes

                    .map(
                      size =>

                        (
                          size.name ||
                          size.id
                        )

                        +

                        ": "

                        +

                        money(
                          size.price
                        )
                    )

                    .join(" • ")
                )
              }

            </td>


            <td>

              ${
                escapeHtml(

                  item.toppings.length

                    ? item.toppings

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

                        .join(" • ")

                    : "Không"

                )
              }

            </td>


            <td>

              ${
                item.active
                  ? "Đang bán"
                  : "Đã ẩn"
              }

            </td>


            <td>

              <div class="actions">

                <button
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
                      ? "Ẩn"
                      : "Hiện"
                  }

                </button>


                <button
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

        `
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
                  x =>
                    x.id ===
                    button.dataset
                      .menuId
                );


              if (!item) return;


              const action =
                button.dataset
                  .menuAction;


              if (
                action === "edit"
              ) {

                fillMenuForm(
                  item
                );

              }


              if (
                action === "toggle"
              ) {

                await db
                  .collection("menu")
                  .doc(item.id)
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
                action === "delete"
              ) {

                if (
                  confirm(
                    `Xóa món "${item.name}"?`
                  )
                ) {

                  await db
                    .collection("menu")
                    .doc(item.id)
                    .delete();

                }

              }

            }
          );

        }
      );

  }


  function fillMenuForm(
    item
  ) {

    editingId =
      item.id;


    $("itemId")
      .value =
      item.id;


    $("itemId")
      .disabled = true;


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
            String(size.id) ===
            id
        );


    $("sizeS")
      .value =
      getSize("S")
        ?.price ?? "";


    $("sizeM")
      .value =
      getSize("M")
        ?.price ?? "";


    $("sizeL")
      .value =
      getSize("L")
        ?.price ?? "";


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
      .hidden = false;

  }


  function resetMenuForm() {

    editingId = null;

    $("menuForm")
      .reset();

    $("itemId")
      .disabled = false;

    $("itemActive")
      .checked = true;

    $("formTitle")
      .textContent =
      "Thêm món mới";

    $("saveBtn")
      .textContent =
      "Thêm món";

    $("cancelBtn")
      .hidden = true;

  }


  function parseSizes() {

    const result = [];


    [
      ["S", $("sizeS").value],
      ["M", $("sizeM").value],
      ["L", $("sizeL").value]

    ].forEach(
      ([id, value]) => {

        if (
          String(value).trim() !== ""
        ) {

          const price =
            Number(value);


          if (
            !Number.isInteger(price) ||
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
        "Phải có ít nhất 1 size."
      );

    }


    return result;

  }


  function makeId(
    value
  ) {

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
      );

  }


  function parseToppings() {

    const lines =
      $("toppingsText")
        .value
        .split("\n")
        .map(
          line =>
            line.trim()
        )
        .filter(Boolean);


    return lines.map(
      (line, index) => {

        const [
          name,
          rawPrice
        ] =
          line
            .split("|")
            .map(
              x =>
                x.trim()
            );


        const price =
          Number(rawPrice);


        if (
          !name ||
          !Number.isInteger(price) ||
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


          if (!name) {

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


          await db
            .collection("menu")
            .doc(id)
            .set(
              data,
              {
                merge: true
              }
            );


          resetMenuForm();


          $("message")
            .textContent =
            "Đã lưu menu.";

        } catch (error) {

          $("message")
            .textContent =
            error.message;

        }

      }
    );


  $("cancelBtn")
    .addEventListener(
      "click",
      resetMenuForm
    );


  // =============================
  // PASSWORD
  // =============================


  $("changePasswordForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        try {

          if (
            $("newPassword")
              .value
              .length < 8
          ) {

            throw new Error(
              "Mật khẩu mới phải có ít nhất 8 ký tự."
            );

          }


          if (
            $("newPassword").value
            !==
            $("confirmPassword").value
          ) {

            throw new Error(
              "Hai mật khẩu mới không khớp."
            );

          }


          const user =
            auth.currentUser;


          const credential =
            firebase
              .auth
              .EmailAuthProvider
              .credential(

                user.email,

                $("currentPassword")
                  .value

              );


          await user
            .reauthenticateWithCredential(
              credential
            );


          await user
            .updatePassword(
              $("newPassword")
                .value
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


  // =============================
  // PUSH NOTIFICATION
  // =============================


  async function sha256(
    text
  ) {

    const buffer =
      await crypto.subtle.digest(

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
      x =>
        x
          .toString(16)
          .padStart(2, "0")
    )

    .join("");

  }


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
              "Thiết bị không hỗ trợ Service Worker."
            );

          }


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


          messaging =
            firebase.messaging();


          const registration =
            await navigator
              .serviceWorker
              .register(
                "/firebase-messaging-sw.js"
              );


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


          const token =
            await messaging
              .getToken({

                vapidKey:
                  self
                    .FIREBASE_VAPID_KEY,

                serviceWorkerRegistration:
                  registration

              });


          currentFcmToken =
            token;


          localStorage.setItem(
            "fcmToken",
            token
          );


          await db
            .collection(
              "adminDevices"
            )
            .doc(
              await sha256(token)
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
            "Thiết bị đã đăng ký nhận thông báo.";

        } catch (error) {

          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


  $("disablePushBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          if (
            currentFcmToken
          ) {

            await db
              .collection(
                "adminDevices"
              )
              .doc(
                await sha256(
                  currentFcmToken
                )
              )
              .delete();

          }


          if (
            messaging
          ) {

            await messaging
              .deleteToken();

          }


          currentFcmToken = "";


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

          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


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

          $("pushMessage")
            .textContent =
            error.message;

        }

      }
    );


  function refreshPushStatus() {

    if (
      "Notification" in window &&
      Notification.permission ===
        "granted"
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


  showLogin();

})();