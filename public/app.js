let MENU = [];

let cart =
  JSON.parse(
    localStorage.getItem(
      "cartV5"
    )
    ||
    "[]"
  );

let configItem =
  null;

let submitting =
  false;

let activeCategory =
  "all";


const $ = id =>
  document.getElementById(id);


const money = value =>
  new Intl
    .NumberFormat(
      "vi-VN"
    )
    .format(
      Number(value)
      ||
      0
    )
  +
  "đ";


if (
  !firebase.apps.length
) {

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


const createOrder =
  functions
    .httpsCallable(
      "createOrder"
    );


auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
)
.catch(
  console.error
);


// ==============================
// AUTH KHÁCH
// ==============================

async function ensureAuth() {

  if (
    auth.currentUser
  ) {

    await auth
      .currentUser
      .getIdToken(true);


    return auth.currentUser;

  }


  const credential =
    await auth
      .signInAnonymously();


  if (
    !credential.user
  ) {

    throw new Error(
      "Không tạo được phiên khách."
    );

  }


  await credential
    .user
    .getIdToken(true);


  return credential.user;

}


// ==============================
// MENU DATA
// ==============================

function normalizeMenu(
  doc
) {

  const item = {

    id:
      doc.id,

    ...doc.data()

  };


  item.category =
    String(
      item.category
      ||
      "Khác"
    )
    .trim()
    ||
    "Khác";


  item.sizes =

    Array.isArray(
      item.sizes
    )
    &&
    item.sizes.length

    ?

    item.sizes

    :

    [
      {

        id:
          "M",

        name:
          "M",

        price:
          Number(
            item.price
            ||
            0
          )

      }
    ];


  item.toppings =

    Array.isArray(
      item.toppings
    )

    ?

    item.toppings

    :

    [];


  return item;

}


// ==============================
// LOAD MENU
// ==============================

function loadMenu() {

  $("menuStatus")
    .textContent =
    "Đang tải menu...";


  db
    .collection(
      "menu"
    )

    .where(
      "active",
      "==",
      true
    )

    .onSnapshot(

      snapshot => {

        MENU =
          snapshot.docs

            .map(
              normalizeMenu
            )

            .sort(
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


        $("menuStatus")
          .textContent =

          MENU.length

          ?

          `${MENU.length} món đang phục vụ`

          :

          "Chưa có món đang bán";


        renderCategoryNav();

        renderMenu();

        renderCart();

      },


      error => {

        console.error(
          error
        );


        $("menuStatus")
          .textContent =
          "Không tải được menu.";

      }

    );

}


// ==============================
// CATEGORY
// ==============================

function getCategories() {

  return [
    ...new Set(

      MENU.map(
        item =>
          item.category
      )

    )
  ]

  .sort(
    (a, b) =>
      a.localeCompare(
        b,
        "vi"
      )
  );

}


function renderCategoryNav() {

  const categories =
    getCategories();


  $("categoryNav")
    .innerHTML =

    `

    <button
      class="
        category-button
        ${
          activeCategory
          ===
          "all"
          ?
          "active"
          :
          ""
        }
      "
      data-category="all"
      type="button"
    >
      Tất cả
    </button>

    `

    +

    categories
      .map(
        category => `

          <button
            class="
              category-button
              ${
                activeCategory
                ===
                category
                ?
                "active"
                :
                ""
              }
            "
            data-category="${
              escapeHtml(
                category
              )
            }"
            type="button"
          >
            ${
              escapeHtml(
                category
              )
            }
          </button>

        `
      )
      .join("");


  $("categoryNav")
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            activeCategory =
              button.dataset
                .category;


            renderCategoryNav();

            renderMenu();

          }
        );

      }
    );

}


// ==============================
// RENDER MENU
// ==============================

function renderMenu() {

  const query =
    $("menuSearch")
      .value
      .trim()
      .toLowerCase();


  let filtered =
    MENU.filter(
      item => {

        const searchText =
          [

            item.name,

            item.category,

            item.description

          ]

          .join(" ")

          .toLowerCase();


        return searchText
          .includes(query);

      }
    );


  if (
    activeCategory
    !==
    "all"
  ) {

    filtered =
      filtered.filter(
        item =>
          item.category
          ===
          activeCategory
      );

  }


  if (
    !filtered.length
  ) {

    $("menu")
      .innerHTML = `

        <div class="empty-cart">

          <div>
            ☕
          </div>

          <strong>
            Không tìm thấy món
          </strong>

          <span>
            Thử chọn danh mục khác.
          </span>

        </div>

      `;

    return;

  }


  const groups = {};


  filtered.forEach(
    item => {

      if (
        !groups[
          item.category
        ]
      ) {

        groups[
          item.category
        ] = [];

      }


      groups[
        item.category
      ]
      .push(item);

    }
  );


  const categories =
    Object
      .keys(groups)

      .sort(
        (a, b) =>
          a.localeCompare(
            b,
            "vi"
          )
      );


  $("menu")
    .innerHTML =

    categories.map(
      category => {

        const items =
          groups[
            category
          ];


        return `

          <section class="menu-category">

            <div class="category-heading">

              <div class="category-heading-left">

                <div class="category-line">
                </div>

                <h2>
                  ${
                    escapeHtml(
                      category
                    )
                  }
                </h2>

              </div>


              <span>
                ${items.length} món
              </span>

            </div>


            <div class="menu-grid">

              ${
                items.map(
                  item =>
                    renderMenuCard(
                      item
                    )
                )
                .join("")
              }

            </div>

          </section>

        `;

      }
    )
    .join("");

}


// ==============================
// CARD
// ==============================

function renderMenuCard(
  item
) {

  const minPrice =
    Math.min(

      ...item.sizes.map(
        size =>
          Number(
            size.price
          )
          ||
          0
      )

    );


  return `

    <article class="menu-card">

      <div class="menu-category-name">

        ${
          escapeHtml(
            item.category
          )
        }

      </div>


      <h3>

        ${
          escapeHtml(
            item.name
          )
        }

      </h3>


      <p class="menu-description">

        ${
          escapeHtml(
            item.description
            ||
            "Chọn size và topping theo sở thích của bạn."
          )
        }

      </p>


      <div class="menu-card-footer">

        <div class="price-box">

          <span>
            Giá từ
          </span>

          <strong>
            ${
              money(
                minPrice
              )
            }
          </strong>

        </div>


        <button
          class="choose-button"
          type="button"
          onclick="
            openOptions(
              '${escapeAttr(
                item.id
              )}'
            )
          "
        >
          Chọn món
        </button>

      </div>

    </article>

  `;

}


// ==============================
// OPEN MODAL
// ==============================

function openOptions(id) {

  configItem =
    MENU.find(
      item =>
        item.id === id
    );


  if (
    !configItem
  ) {
    return;
  }


  $("optionItemName")
    .textContent =
    configItem.name;


  $("optionItemDescription")
    .textContent =

    configItem.description

    ||

    "Chọn size và topping phù hợp với bạn.";


  // SIZE

  $("sizeOptions")
    .innerHTML =

    configItem.sizes

      .map(
        (
          size,
          index
        ) => `

          <div class="size-choice">

            <label>

              <input
                type="radio"
                name="size"
                value="${
                  escapeHtml(
                    size.id
                  )
                }"
                ${
                  index === 0
                  ?
                  "checked"
                  :
                  ""
                }
              >

              ${
                escapeHtml(
                  size.name
                  ||
                  size.id
                )
              }

              <strong>

                ${
                  money(
                    size.price
                  )
                }

              </strong>

            </label>

          </div>

        `
      )
      .join("");


  // TOPPING

  $("toppingOptions")
    .innerHTML =

    configItem
      .toppings
      .length

    ?

    configItem.toppings
      .map(
        topping => `

          <div class="topping-choice">

            <label>

              <input
                type="checkbox"
                name="topping"
                value="${
                  escapeHtml(
                    topping.id
                  )
                }"
              >

              ${
                escapeHtml(
                  topping.name
                )
              }

            </label>


            <strong>

              +${
                money(
                  topping.price
                )
              }

            </strong>

          </div>

        `
      )
      .join("")

    :

    `

      <div class="empty-cart">

        <strong>
          Không có topping
        </strong>

        <span>
          Món này hiện chưa có topping.
        </span>

      </div>

    `;


  $("optionModal")
    .hidden =
    false;


  document.body
    .classList
    .add(
      "modal-open"
    );


  document
    .querySelectorAll(
      'input[name="size"], input[name="topping"]'
    )
    .forEach(
      input => {

        input.addEventListener(
          "change",
          updateOptionTotal
        );

      }
    );


  updateOptionTotal();

}


// ==============================
// CLOSE MODAL
// ==============================

function closeOptions() {

  $("optionModal")
    .hidden =
    true;


  document.body
    .classList
    .remove(
      "modal-open"
    );


  configItem =
    null;

}


// ==============================
// GET CONFIG
// ==============================

function getSelectedConfig() {

  if (
    !configItem
  ) {
    return null;
  }


  const sizeId =
    document
      .querySelector(
        'input[name="size"]:checked'
      )
      ?.value;


  const size =
    configItem
      .sizes
      .find(
        size =>
          String(
            size.id
          )
          ===
          String(
            sizeId
          )
      );


  const toppingIds =
    [
      ...document
        .querySelectorAll(
          'input[name="topping"]:checked'
        )
    ]

    .map(
      input =>
        input.value
    );


  const toppings =
    configItem
      .toppings
      .filter(
        topping =>
          toppingIds
            .includes(
              String(
                topping.id
              )
            )
      );


  const unitPrice =

    Number(
      size?.price || 0
    )

    +

    toppings.reduce(
      (
        total,
        topping
      ) =>

        total
        +
        Number(
          topping.price
          ||
          0
        ),

      0
    );


  return {

    size,

    toppings,

    unitPrice

  };

}


function updateOptionTotal() {

  const config =
    getSelectedConfig();


  $("optionTotal")
    .textContent =
    money(
      config?.unitPrice
      ||
      0
    );

}


// ==============================
// ADD CART
// ==============================

function addConfiguredItem() {

  const config =
    getSelectedConfig();


  if (
    !config
    ||
    !config.size
    ||
    !configItem
  ) {

    return;

  }


  const key = [

    configItem.id,

    config.size.id,

    ...config
      .toppings
      .map(
        topping =>
          topping.id
      )
      .sort()

  ]
  .join("|");


  const existing =
    cart.find(
      item =>
        item.key === key
    );


  if (
    existing
  ) {

    existing.qty =
      Math.min(
        20,
        existing.qty + 1
      );

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
        config.size.name
        ||
        config.size.id,

      toppingIds:
        config.toppings
          .map(
            topping =>
              topping.id
          ),

      toppingNames:
        config.toppings
          .map(
            topping =>
              topping.name
          ),

      unitPrice:
        config.unitPrice,

      qty:
        1

    });

  }


  saveCart();

  closeOptions();

}


// ==============================
// CART
// ==============================

function saveCart() {

  localStorage.setItem(

    "cartV5",

    JSON.stringify(
      cart
    )

  );


  renderCart();

}


function changeQty(
  key,
  value
) {

  const item =
    cart.find(
      item =>
        item.key === key
    );


  if (!item) {
    return;
  }


  item.qty +=
    value;


  if (
    item.qty <= 0
  ) {

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

  const count =
    cart.reduce(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          item.qty
          ||
          0
        ),
      0
    );


  $("cartCount")
    .textContent =
    `${count} món`;


  if (
    !cart.length
  ) {

    $("cartItems")
      .innerHTML = `

        <div class="empty-cart">

          <div>
            🧋
          </div>

          <strong>
            Chưa có món nào
          </strong>

          <span>
            Chọn một món từ menu để bắt đầu.
          </span>

        </div>

      `;


    $("total")
      .textContent =
      "0đ";


    return;

  }


  let total =
    0;


  $("cartItems")
    .innerHTML =

    cart.map(
      item => {

        const subtotal =

          Number(
            item.unitPrice
          )

          *

          Number(
            item.qty
          );


        total +=
          subtotal;


        const toppingText =

          item.toppingNames
          &&
          item.toppingNames.length

          ?

          " • "
          +
          item.toppingNames
            .join(", ")

          :

          "";


        return `

          <div class="cart-line">


            <div class="cart-line-top">

              <div>

                <div class="cart-name">

                  ${
                    escapeHtml(
                      item.name
                    )
                  }

                </div>


                <div class="cart-options">

                  Size
                  ${
                    escapeHtml(
                      item.sizeName
                    )
                  }

                  ${
                    escapeHtml(
                      toppingText
                    )
                  }

                </div>

              </div>


              <button
                class="remove-button"
                type="button"
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


            <div class="cart-line-bottom">

              <div class="qty">

                <button
                  type="button"
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


                <strong>
                  ${
                    item.qty
                  }
                </strong>


                <button
                  type="button"
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


              <strong>

                ${
                  money(
                    subtotal
                  )
                }

              </strong>

            </div>

          </div>

        `;

      }
    )
    .join("");


  $("total")
    .textContent =
    money(total);

}


// ==============================
// ĐẶT MÓN
// ==============================

async function submitOrder() {

  if (
    submitting
  ) {
    return;
  }


  if (
    !cart.length
  ) {

    $("message")
      .textContent =
      "Bạn chưa chọn món.";

    return;

  }


  const table =
    $("tableNumber")
      .value
      .trim();


  if (!table) {

    $("message")
      .textContent =
      "Vui lòng nhập số bàn.";


    $("tableNumber")
      .focus();


    return;

  }


  try {

    submitting =
      true;


    $("orderBtn")
      .disabled =
      true;


    $("message")
      .textContent =
      "Đang gửi đơn...";


    const user =
      await ensureAuth();


    await user
      .getIdToken(true);


    await createOrder({

      table:
        table.slice(
          0,
          20
        ),


      items:

        cart.map(
          item => ({

            menuId:
              item.menuId,

            sizeId:
              item.sizeId,

            toppingIds:
              item.toppingIds,

            quantity:
              Number(
                item.qty
              )

          })
        ),


      clientRequestId:

        crypto.randomUUID

        ?

        crypto.randomUUID()

        :

        Date.now()
        +
        "-"
        +
        Math.random()
          .toString(36)
          .slice(2)

    });


    cart =
      [];


    saveCart();


    $("tableNumber")
      .value =
      "";


    $("message")
      .textContent =
      "Đặt món thành công! Cảm ơn bạn ☕";


  } catch (error) {

    console.error(
      error
    );


    $("message")
      .textContent =

      error.message

      ||

      "Không gửi được đơn.";

  } finally {

    submitting =
      false;


    $("orderBtn")
      .disabled =
      false;

  }

}


// ==============================
// ESCAPE
// ==============================

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


function escapeAttr(value) {

  return String(
    value ?? ""
  )
  .replaceAll(
    "'",
    "\\'"
  );

}


// ==============================
// EVENTS
// ==============================

$("menuSearch")
  .addEventListener(
    "input",
    renderMenu
  );


$("closeOptionModal")
  .addEventListener(
    "click",
    closeOptions
  );


$("optionModal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target
        ===
        $("optionModal")
      ) {

        closeOptions();

      }

    }
  );


$("addConfiguredItemBtn")
  .addEventListener(
    "click",
    addConfiguredItem
  );


$("orderBtn")
  .addEventListener(
    "click",
    submitOrder
  );


// ==============================
// WELCOME
// ==============================

window.addEventListener(
  "load",
  () => {

    const welcome =
      $("welcomeScreen");


    if (
      !welcome
    ) {

      return;

    }


    setTimeout(
      () => {

        welcome
          .classList
          .add(
            "hide"
          );

      },
      2300
    );


    setTimeout(
      () => {

        welcome.remove();

      },
      3100
    );

  }
);


// ==============================
// START
// ==============================

ensureAuth()

  .catch(
    error =>
      console.error(
        "Anonymous Auth:",
        error
      )
  )

  .finally(
    loadMenu
  );