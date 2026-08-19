let MENU = [];

let cart =
  JSON.parse(
    localStorage.getItem("cartV5") || "[]"
  );

let configItem = null;
let submitting = false;

const $ = id =>
  document.getElementById(id);

const money = n =>
  new Intl.NumberFormat("vi-VN")
    .format(Number(n) || 0) + "đ";


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

const createOrder =
  functions.httpsCallable(
    "createOrder"
  );


auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
);


async function ensureAuth() {

  if (auth.currentUser) {

    await auth.currentUser
      .getIdToken(true);

    return auth.currentUser;

  }

  const credential =
    await auth.signInAnonymously();

  await credential.user
    .getIdToken(true);

  return credential.user;

}


function normalizeMenu(doc) {

  const item = {
    id: doc.id,
    ...doc.data()
  };

  item.sizes =
    Array.isArray(item.sizes) &&
    item.sizes.length

      ? item.sizes

      : [
          {
            id: "M",
            name: "M",
            price:
              Number(item.price || 0)
          }
        ];


  item.toppings =
    Array.isArray(item.toppings)
      ? item.toppings
      : [];


  return item;

}


function loadMenu() {

  db
    .collection("menu")
    .where(
      "active",
      "==",
      true
    )
    .onSnapshot(

      snapshot => {

        MENU =
          snapshot.docs.map(
            normalizeMenu
          );

        $("menuStatus")
          .textContent = "";

        renderMenu();

        renderCart();

      },

      error => {

        $("menuStatus")
          .textContent =
          error.message;

      }

    );

}


function renderMenu() {

  const query =
    $("menuSearch")
      .value
      .toLowerCase()
      .trim();


  const filtered =
    MENU.filter(item =>
      item.name
        .toLowerCase()
        .includes(query)
    );


  $("menu").innerHTML =

    filtered.map(item => {

      const minPrice =
        Math.min(
          ...item.sizes.map(
            size =>
              Number(size.price)
          )
        );


      return `

        <div class="card">

          <small>
            ${escapeHtml(
              item.category ||
              "ĐỒ UỐNG"
            )}
          </small>

          <h3>
            ${escapeHtml(item.name)}
          </h3>

          <p>
            ${escapeHtml(
              item.description || ""
            )}
          </p>

          <div class="price">
            Từ ${money(minPrice)}
          </div>

          <button
            class="primary"
            onclick="
              openOptions(
                '${escapeAttr(item.id)}'
              )
            "
          >
            Chọn món
          </button>

        </div>

      `;

    }).join("")

    ||

    "<p>Không tìm thấy món.</p>";

}


function openOptions(id) {

  configItem =
    MENU.find(
      item => item.id === id
    );


  $("optionItemName")
    .textContent =
    configItem.name;


  $("sizeOptions")
    .innerHTML =

    configItem.sizes
      .map(
        (size, index) => `

          <label class="choice">

            <input
              type="radio"
              name="size"
              value="${escapeHtml(size.id)}"
              ${index === 0
                ? "checked"
                : ""}
            >

            <b>
              ${escapeHtml(
                size.name ||
                size.id
              )}
            </b>

            <br>

            ${money(size.price)}

          </label>

        `
      )
      .join("");


  $("toppingOptions")
    .innerHTML =

    configItem.toppings.length

      ? configItem.toppings
          .map(
            topping => `

              <label class="topping">

                <span>

                  <input
                    type="checkbox"
                    name="tp"
                    value="${escapeHtml(
                      topping.id
                    )}"
                  >

                  ${escapeHtml(
                    topping.name
                  )}

                </span>

                <b>
                  +${money(
                    topping.price
                  )}
                </b>

              </label>

            `
          )
          .join("")

      : "<p>Không có topping.</p>";


  $("optionModal")
    .hidden = false;


  document
    .querySelectorAll(
      'input[name="size"], input[name="tp"]'
    )
    .forEach(input => {

      input.onchange =
        calculateOptionTotal;

    });


  calculateOptionTotal();

}


function getSelectedConfig() {

  const sizeId =
    document
      .querySelector(
        'input[name="size"]:checked'
      )
      ?.value;


  const size =
    configItem.sizes.find(
      size =>
        String(size.id) ===
        String(sizeId)
    );


  const toppingIds =
    [
      ...document.querySelectorAll(
        'input[name="tp"]:checked'
      )
    ].map(
      input =>
        input.value
    );


  const toppings =
    configItem.toppings.filter(
      topping =>
        toppingIds.includes(
          String(topping.id)
        )
    );


  const unitPrice =

    Number(size?.price || 0)

    +

    toppings.reduce(
      (total, topping) =>
        total +
        Number(topping.price || 0),

      0
    );


  return {
    size,
    toppings,
    unitPrice
  };

}


function calculateOptionTotal() {

  const config =
    getSelectedConfig();

  $("optionTotal")
    .textContent =
    money(config.unitPrice);

}


function closeOptions() {

  $("optionModal")
    .hidden = true;

  configItem = null;

}


function addConfiguredItem() {

  const config =
    getSelectedConfig();


  const key = [

    configItem.id,

    config.size.id,

    ...config.toppings
      .map(t => t.id)
      .sort()

  ].join("|");


  const existing =
    cart.find(
      item =>
        item.key === key
    );


  if (existing) {

    existing.qty++;

  } else {

    cart.push({

      key,

      menuId:
        configItem.id,

      name:
        configItem.name,

      sizeId:
        config.size.id,

      sizeName:
        config.size.name ||
        config.size.id,

      toppingIds:
        config.toppings
          .map(t => t.id),

      toppingNames:
        config.toppings
          .map(t => t.name),

      unitPrice:
        config.unitPrice,

      qty: 1

    });

  }


  saveCart();

  closeOptions();

}


function saveCart() {

  localStorage.setItem(
    "cartV5",
    JSON.stringify(cart)
  );

  renderCart();

}


function changeQty(key, amount) {

  const item =
    cart.find(
      item =>
        item.key === key
    );


  if (!item) return;


  item.qty += amount;


  if (item.qty <= 0) {

    cart =
      cart.filter(
        item =>
          item.key !== key
      );

  }


  saveCart();

}


function removeLine(key) {

  cart =
    cart.filter(
      item =>
        item.key !== key
    );

  saveCart();

}


function renderCart() {

  let total = 0;


  $("cartCount")
    .textContent =

    cart.reduce(
      (sum, item) =>
        sum + item.qty,
      0
    )

    + " món";


  $("cartItems")
    .innerHTML =

    cart.length

      ? cart.map(item => {

          const subtotal =
            item.unitPrice *
            item.qty;


          total += subtotal;


          return `

            <div class="cart-line">

              <div class="line-top">

                <div>

                  <b>
                    ${escapeHtml(
                      item.name
                    )}
                  </b>

                  <div class="meta">

                    Size
                    ${escapeHtml(
                      item.sizeName
                    )}

                    ${
                      item.toppingNames.length

                        ? " • " +
                          escapeHtml(
                            item
                              .toppingNames
                              .join(", ")
                          )

                        : ""
                    }

                  </div>

                </div>


                <button
                  class="remove"
                  onclick="
                    removeLine(
                      '${escapeAttr(
                        item.key
                      )}'
                    )
                  "
                >
                  Xóa
                </button>

              </div>


              <div class="line-bottom">

                <div class="qty">

                  <button
                    onclick="
                      changeQty(
                        '${escapeAttr(
                          item.key
                        )}',
                        -1
                      )
                    "
                  >
                    −
                  </button>

                  <b>
                    ${item.qty}
                  </b>

                  <button
                    onclick="
                      changeQty(
                        '${escapeAttr(
                          item.key
                        )}',
                        1
                      )
                    "
                  >
                    +
                  </button>

                </div>


                <b>
                  ${money(subtotal)}
                </b>

              </div>

            </div>

          `;

        }).join("")

      : "<p>Chưa có món nào.</p>";


  $("total")
    .textContent =
    money(total);

}


async function submitOrder() {

  if (
    submitting ||
    !cart.length
  ) {
    return;
  }


  try {

    submitting = true;

    $("orderBtn")
      .disabled = true;

    $("message")
      .textContent =
      "Đang gửi đơn...";


    const user =
      await ensureAuth();

    await user
      .getIdToken(true);


    const response =
      await createOrder({

        table:
          $("tableNumber")
            .value
            .trim()
            .slice(0, 20),

        items:
          cart.map(item => ({

            menuId:
              item.menuId,

            sizeId:
              item.sizeId,

            toppingIds:
              item.toppingIds,

            quantity:
              item.qty

          })),

        clientRequestId:
          crypto.randomUUID

            ? crypto.randomUUID()

            : String(Date.now())

      });


    cart = [];

    saveCart();


    $("tableNumber")
      .value = "";


    $("message")
      .textContent =

      "Đặt món thành công! Mã đơn: "

      +

      response.data.orderId;

  } catch (error) {

    console.error(error);

    $("message")
      .textContent =

      error.message ||
      "Không gửi được đơn.";

  } finally {

    submitting = false;

    $("orderBtn")
      .disabled = false;

  }

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


function escapeAttr(value) {

  return String(value ?? "")
    .replaceAll(
      "'",
      "\\'"
    );

}


$("menuSearch")
  .oninput =
  renderMenu;


$("closeOptionModal")
  .onclick =
  closeOptions;


$("addConfiguredItemBtn")
  .onclick =
  addConfiguredItem;


$("orderBtn")
  .onclick =
  submitOrder;


ensureAuth()
  .catch(console.error)
  .finally(loadMenu);
 window.addEventListener(
  "load",
  () => {

    const welcome =
      document.getElementById(
        "welcomeScreen"
      );


    if (!welcome) {
      return;
    }


    /*
      Splash chạy khoảng 2.7 giây.

      Sau đó fade + trượt lên.
    */

    setTimeout(
      () => {

        welcome
          .classList
          .add("hide");

      },
      2700
    );


    /*
      Sau animation
      thì xóa hẳn splash
      khỏi DOM.
    */

    setTimeout(
      () => {

        welcome.remove();

      },
      3500
    );

  }
);