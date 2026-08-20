const {
  onCall,
  HttpsError
} = require(
  "firebase-functions/v2/https"
);

const {
  initializeApp
} = require(
  "firebase-admin/app"
);

const {
  getFirestore,
  FieldValue
} = require(
  "firebase-admin/firestore"
);

const {
  getMessaging
} = require(
  "firebase-admin/messaging"
);

const crypto =
  require("crypto");


/* =========================================================
   FIREBASE ADMIN
========================================================= */

initializeApp();

const db =
  getFirestore();


const REGION =
  "asia-southeast1";


const ADMIN_EMAIL =
  "sangbeos1410@gmail.com";


/* =========================================================
   ADMIN CHECK
========================================================= */

function isAdmin(req) {

  return !!req.auth
    &&
    String(
      req.auth.token.email || ""
    ).toLowerCase()
    ===
    ADMIN_EMAIL.toLowerCase();

}


/* =========================================================
   DATE VN
========================================================= */

function dateKeyVN(
  date = new Date()
) {

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
    .formatToParts(date);


  const map = {};


  for (const part of parts) {

    map[part.type] =
      part.value;

  }


  return (
    map.year
    +
    "-"
    +
    map.month
    +
    "-"
    +
    map.day
  );

}


/* =========================================================
   CLEAN HELPERS
========================================================= */

function cleanText(
  value,
  maxLength
) {

  return String(
    value || ""
  )
  .trim()
  .slice(
    0,
    maxLength
  );

}


function cleanTable(value) {

  return cleanText(
    value,
    20
  );

}


function cleanItemNote(value) {

  return cleanText(
    value,
    160
  );

}


function cleanOrderNote(value) {

  return cleanText(
    value,
    240
  );

}


function cleanDeliveryNote(value) {

  return cleanText(
    value,
    200
  );

}


function cleanCustomerName(value) {

  return cleanText(
    value,
    100
  );

}


function cleanPhone(value) {

  return cleanText(
    value,
    20
  );

}


function cleanAddress(value) {

  return cleanText(
    value,
    300
  );

}


/* =========================================================
   PHONE VALIDATION
========================================================= */

function isValidPhone(value) {

  const phone =
    String(
      value || ""
    )
    .replace(
      /[\s.-]/g,
      ""
    );


  return /^\+?\d{8,15}$/
    .test(phone);

}


/* =========================================================
   CREATE ORDER
========================================================= */

exports.createOrder =
  onCall(

    {

      region:
        REGION,

      enforceAppCheck:
        false,

      timeoutSeconds:
        20,

      memory:
        "256MiB"

    },


    async req => {


      /* -----------------------------
         AUTH
      ----------------------------- */

      if (!req.auth) {

        throw new HttpsError(
          "unauthenticated",
          "Thiết bị chưa xác thực."
        );

      }


      const {

        fulfillmentType,

        table,

        customer,

        deliveryNote,

        paymentMethod,

        orderNote,

        items,

        clientRequestId

      } =
        req.data || {};


      /* -----------------------------
         FULFILLMENT
      ----------------------------- */

      const safeFulfillmentType =
        fulfillmentType ===
          "delivery"
        ?
        "delivery"
        :
        fulfillmentType ===
          "dine_in"
        ?
        "dine_in"
        :
        null;


      if (!safeFulfillmentType) {

        throw new HttpsError(
          "invalid-argument",
          "Hình thức nhận món không hợp lệ."
        );

      }


      /* -----------------------------
         PAYMENT METHOD
      ----------------------------- */

      const safePaymentMethod =
        paymentMethod ===
          "bank_transfer"
        ?
        "bank_transfer"
        :
        paymentMethod ===
          "cash"
        ?
        "cash"
        :
        null;


      if (!safePaymentMethod) {

        throw new HttpsError(
          "invalid-argument",
          "Phương thức thanh toán không hợp lệ."
        );

      }


      /* -----------------------------
         DINE IN
      ----------------------------- */

      let safeTable =
        "";


      let safeCustomer = {

        name:
          "",

        phone:
          "",

        address:
          ""

      };


      let safeDeliveryNote =
        "";


      if (
        safeFulfillmentType ===
        "dine_in"
      ) {

        safeTable =
          cleanTable(
            table
          );


        if (!safeTable) {

          throw new HttpsError(
            "invalid-argument",
            "Vui lòng nhập số bàn."
          );

        }

      }


      /* -----------------------------
         DELIVERY
      ----------------------------- */

      if (
        safeFulfillmentType ===
        "delivery"
      ) {

        if (
          !customer
          ||
          typeof customer !==
          "object"
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Thông tin người nhận không hợp lệ."
          );

        }


        safeCustomer = {

          name:
            cleanCustomerName(
              customer.name
            ),

          phone:
            cleanPhone(
              customer.phone
            ),

          address:
            cleanAddress(
              customer.address
            )

        };


        safeDeliveryNote =
          cleanDeliveryNote(
            deliveryNote
          );


        if (
          !safeCustomer.name
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Vui lòng nhập tên người nhận."
          );

        }


        if (
          !isValidPhone(
            safeCustomer.phone
          )
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Số điện thoại không hợp lệ."
          );

        }


        if (
          !safeCustomer.address
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Vui lòng nhập địa chỉ giao hàng."
          );

        }

      }


      /* -----------------------------
         ORDER NOTE
      ----------------------------- */

      if (
        typeof orderNote !==
          "undefined"
        &&
        typeof orderNote !==
          "string"
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Ghi chú đơn không hợp lệ."
        );

      }


      if (
        String(
          orderNote || ""
        ).length > 240
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Ghi chú đơn quá dài."
        );

      }


      const safeOrderNote =
        cleanOrderNote(
          orderNote
        );


      /* -----------------------------
         REQUEST ID
      ----------------------------- */

      if (
        typeof clientRequestId !==
          "string"
        ||
        clientRequestId.length < 8
        ||
        clientRequestId.length > 120
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Mã yêu cầu không hợp lệ."
        );

      }


      /* -----------------------------
         ITEMS
      ----------------------------- */

      if (
        !Array.isArray(items)
        ||
        items.length === 0
        ||
        items.length > 30
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Danh sách món không hợp lệ."
        );

      }


      for (
        const item
        of items
      ) {

        if (
          typeof item.menuId !==
            "string"
          ||
          !/^[A-Za-z0-9_-]{1,30}$/
            .test(
              item.menuId
            )
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Mã món không hợp lệ."
          );

        }


        if (
          typeof item.sizeId !==
            "string"
          ||
          item.sizeId.length > 20
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Size không hợp lệ."
          );

        }


        if (
          !Array.isArray(
            item.toppingIds
          )
          ||
          item.toppingIds.length > 20
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Topping không hợp lệ."
          );

        }


        if (
          !Number.isInteger(
            item.quantity
          )
          ||
          item.quantity < 1
          ||
          item.quantity > 20
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Số lượng không hợp lệ."
          );

        }


        if (
          typeof item.note !==
            "undefined"
          &&
          typeof item.note !==
            "string"
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Ghi chú món không hợp lệ."
          );

        }


        if (
          String(
            item.note || ""
          ).length > 160
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Ghi chú món quá dài."
          );

        }

      }


      /* =====================================================
         CHỐNG GỬI TRÙNG
      ===================================================== */

      const requestHash =
        crypto
          .createHash(
            "sha256"
          )
          .update(
            req.auth.uid
            +
            ":"
            +
            clientRequestId
          )
          .digest(
            "hex"
          );


      const requestRef =
        db
          .collection(
            "requestIds"
          )
          .doc(
            requestHash
          );


      const orderRef =
        db
          .collection(
            "orders"
          )
          .doc();


      const dateKey =
        dateKeyVN();


      const statsRef =
        db
          .collection(
            "dailyStats"
          )
          .doc(
            dateKey
          );


      /* =====================================================
         TRANSACTION
      ===================================================== */

      const result =
        await db
          .runTransaction(

            async transaction => {


              /* -------------------------
                 REQUEST CŨ
              ------------------------- */

              const previousRequest =
                await transaction
                  .get(
                    requestRef
                  );


              if (
                previousRequest.exists
              ) {

                const oldData =
                  previousRequest
                    .data();


                return {

                  orderId:
                    oldData.orderId,

                  total:
                    oldData.total || 0,

                  deduplicated:
                    true

                };

              }


              /* -------------------------
                 LOAD MENU
              ------------------------- */

              const menuIds =
                [
                  ...new Set(

                    items.map(
                      item =>
                        item.menuId
                    )

                  )
                ];


              const menuSnapshots =
                await Promise.all(

                  menuIds.map(
                    menuId =>

                      transaction.get(

                        db
                          .collection(
                            "menu"
                          )
                          .doc(
                            menuId
                          )

                      )

                  )

                );


              const menuMap =
                new Map();


              for (
                const snapshot
                of menuSnapshots
              ) {

                if (
                  !snapshot.exists
                ) {

                  throw new HttpsError(
                    "failed-precondition",
                    "Có món không tồn tại."
                  );

                }


                const menuItem =
                  snapshot.data();


                if (
                  menuItem.active !==
                  true
                ) {

                  throw new HttpsError(
                    "failed-precondition",
                    `Món "${menuItem.name || snapshot.id}" đã ngừng bán.`
                  );

                }


                menuMap.set(
                  snapshot.id,
                  menuItem
                );

              }


              /* -------------------------
                 TÍNH GIÁ SERVER
              ------------------------- */

              let total =
                0;


              let cups =
                0;


              const safeItems =
                [];


              for (
                const item
                of items
              ) {

                const menuItem =
                  menuMap.get(
                    item.menuId
                  );


                if (!menuItem) {

                  throw new HttpsError(
                    "failed-precondition",
                    "Không tìm thấy món."
                  );

                }


                const sizes =
                  Array.isArray(
                    menuItem.sizes
                  )
                  ?
                  menuItem.sizes
                  :
                  [];


                const toppings =
                  Array.isArray(
                    menuItem.toppings
                  )
                  ?
                  menuItem.toppings
                  :
                  [];


                /* SIZE */

                const selectedSize =
                  sizes.find(
                    size =>

                      String(
                        size.id
                      )

                      ===

                      String(
                        item.sizeId
                      )
                  );


                if (
                  !selectedSize
                ) {

                  throw new HttpsError(
                    "failed-precondition",
                    `Size của "${menuItem.name}" không còn bán.`
                  );

                }


                const sizePrice =
                  Number(
                    selectedSize.price
                  );


                if (
                  !Number.isFinite(
                    sizePrice
                  )
                  ||
                  sizePrice < 0
                ) {

                  throw new HttpsError(
                    "failed-precondition",
                    "Giá size không hợp lệ."
                  );

                }


                /* TOPPING */

                const uniqueToppingIds =
                  [
                    ...new Set(

                      item.toppingIds
                        .map(
                          String
                        )

                    )
                  ];


                const selectedToppings =
                  [];


                for (
                  const toppingId
                  of uniqueToppingIds
                ) {

                  const topping =
                    toppings.find(
                      value =>

                        String(
                          value.id
                        )

                        ===

                        toppingId
                    );


                  if (
                    !topping
                  ) {

                    throw new HttpsError(
                      "failed-precondition",
                      `Có topping của "${menuItem.name}" không còn bán.`
                    );

                  }


                  const toppingPrice =
                    Number(
                      topping.price
                    );


                  if (
                    !Number.isFinite(
                      toppingPrice
                    )
                    ||
                    toppingPrice < 0
                  ) {

                    throw new HttpsError(
                      "failed-precondition",
                      "Giá topping không hợp lệ."
                    );

                  }


                  selectedToppings
                    .push({

                      id:
                        cleanText(
                          topping.id,
                          40
                        ),

                      name:
                        cleanText(
                          topping.name,
                          80
                        ),

                      price:
                        toppingPrice

                    });

                }


                const toppingTotal =
                  selectedToppings
                    .reduce(
                      (
                        sum,
                        topping
                      ) =>
                        sum +
                        topping.price,
                      0
                    );


                const unitPrice =
                  sizePrice +
                  toppingTotal;


                const quantity =
                  item.quantity;


                const subtotal =
                  unitPrice *
                  quantity;


                total +=
                  subtotal;


                cups +=
                  quantity;


                safeItems.push({

                  menuId:
                    item.menuId,

                  name:
                    cleanText(
                      menuItem.name,
                      100
                    ),

                  category:
                    cleanText(
                      menuItem.category,
                      80
                    ),

                  sizeId:
                    cleanText(
                      selectedSize.id,
                      20
                    ),

                  sizeName:
                    cleanText(
                      selectedSize.name ||
                      selectedSize.id,
                      30
                    ),

                  sizePrice,

                  toppings:
                    selectedToppings,

                  unitPrice,

                  quantity,

                  note:
                    cleanItemNote(
                      item.note
                    ),

                  subtotal

                });

              }


              /* -------------------------
                 LIMIT TOTAL
              ------------------------- */

              if (
                !Number.isFinite(
                  total
                )
                ||
                total < 0
                ||
                total > 100000000
              ) {

                throw new HttpsError(
                  "invalid-argument",
                  "Tổng tiền không hợp lệ."
                );

              }


              if (
                cups < 1
                ||
                cups > 600
              ) {

                throw new HttpsError(
                  "invalid-argument",
                  "Số lượng món không hợp lệ."
                );

              }


              const now =
                FieldValue
                  .serverTimestamp();


              /*
                Tiền mặt / chuyển khoản
                ban đầu đều để pending.
                Admin xác nhận sau.
              */
              const paymentStatus =
                "pending";


              /* -------------------------
                 CREATE ORDER
              ------------------------- */

              transaction.create(

                orderRef,

                {

                  fulfillmentType:
                    safeFulfillmentType,

                  table:
                    safeTable,

                  customer:
                    safeCustomer,

                  deliveryNote:
                    safeDeliveryNote,

                  paymentMethod:
                    safePaymentMethod,

                  paymentStatus,

                  items:
                    safeItems,

                  total,

                  cups,

                  status:
                    "new",

                  dateKey,

                  orderNote:
                    safeOrderNote,

                  customerUid:
                    req.auth.uid,

                  createdAt:
                    now,

                  updatedAt:
                    now

                }

              );


              /* -------------------------
                 DAILY STATS
              ------------------------- */

              transaction.set(

                statsRef,

                {

                  date:
                    dateKey,

                  orders:
                    FieldValue
                      .increment(1),

                  cups:
                    FieldValue
                      .increment(
                        cups
                      ),

                  revenue:
                    FieldValue
                      .increment(
                        total
                      ),

                  updatedAt:
                    now

                },

                {
                  merge:
                    true
                }

              );


              /* -------------------------
                 REQUEST ID
              ------------------------- */

              transaction.create(

                requestRef,

                {

                  orderId:
                    orderRef.id,

                  total,

                  createdAt:
                    now

                }

              );


              return {

                orderId:
                  orderRef.id,

                total,

                fulfillmentType:
                  safeFulfillmentType,

                table:
                  safeTable,

                customer:
                  safeCustomer,

                deliveryNote:
                  safeDeliveryNote,

                paymentMethod:
                  safePaymentMethod,

                paymentStatus,

                orderNote:
                  safeOrderNote,

                items:
                  safeItems,

                deduplicated:
                  false

              };

            }

          );


      /* =====================================================
         PUSH ADMIN
      ===================================================== */

      if (
        !result.deduplicated
      ) {

        try {

          await sendOrderNotification(
            result.orderId,
            result
          );

        } catch (error) {

          console.error(
            "Push notification:",
            error
          );

        }

      }


      return {

        orderId:
          result.orderId,

        total:
          result.total,

        deduplicated:
          !!result.deduplicated

      };

    }

  );


/* =========================================================
   PUSH ORDER
========================================================= */

async function sendOrderNotification(
  orderId,
  order
) {

  const devices =
    await db
      .collection(
        "adminDevices"
      )
      .get();


  if (
    devices.empty
  ) {

    return;

  }


  const tokenDocs =
    devices.docs

      .map(
        doc => ({

          ref:
            doc.ref,

          token:
            doc.data().token

        })
      )

      .filter(
        item =>
          item.token
      );


  if (
    !tokenDocs.length
  ) {

    return;

  }


  const itemText =
    (
      order.items || []
    )
    .map(
      item => {

        let text =

          item.quantity
          +
          " × "
          +
          item.name
          +
          " ("
          +
          item.sizeName
          +
          ")";


        if (
          item.toppings
          &&
          item.toppings.length
        ) {

          text +=

            " + "

            +

            item.toppings
              .map(
                topping =>
                  topping.name
              )
              .join(", ");

        }


        if (
          item.note
        ) {

          text +=

            " ["

            +

            item.note

            +

            "]";

        }


        return text;

      }
    )
    .join(", ")
    .slice(
      0,
      450
    );


  let title =
    "🔔 ĐƠN MỚI";


  let body =
    "";


  if (
    order.fulfillmentType ===
    "delivery"
  ) {

    title +=
      " - 🛵 Giao tận nơi";


    body +=

      (
        order.customer?.name
        ||
        "Khách"
      )

      +

      " • "

      +

      (
        order.customer?.phone
        ||
        ""
      )

      +

      " • "

      +

      (
        order.customer?.address
        ||
        ""
      )

      +

      " • ";

  } else {

    title +=
      " - ☕ Bàn "
      +
      (
        order.table ||
        "?"
      );


    body +=

      "Bàn "

      +

      (
        order.table ||
        "?"
      )

      +

      " • ";

  }


  body +=
    itemText;


  body +=

    " • "

    +

    (
      order.paymentMethod ===
      "bank_transfer"
      ?
      "Chuyển khoản"
      :
      "Tiền mặt"
    );


  if (
    order.orderNote
  ) {

    body +=

      " • Ghi chú: "

      +

      order.orderNote;

  }


  body +=

    " • "

    +

    new Intl.NumberFormat(
      "vi-VN"
    )
    .format(
      order.total || 0
    )

    +

    "đ";


  body =
    body.slice(
      0,
      900
    );


  const response =
    await getMessaging()
      .sendEachForMulticast({

        tokens:
          tokenDocs.map(
            item =>
              item.token
          ),

        data: {

          title,

          body,

          orderId:
            String(
              orderId
            ),

          url:
            "/admin.html"

        },

        webpush: {

          headers: {

            Urgency:
              "high"

          }

        }

      });


  /* -------------------------
     XÓA TOKEN HẾT HẠN
  ------------------------- */

  const batch =
    db.batch();


  let dirty =
    false;


  response.responses
    .forEach(
      (
        item,
        index
      ) => {

        if (
          item.success
        ) {

          return;

        }


        const code =
          item.error?.code;


        if (
          code ===
            "messaging/registration-token-not-registered"
          ||
          code ===
            "messaging/invalid-registration-token"
        ) {

          batch.delete(
            tokenDocs[
              index
            ].ref
          );


          dirty =
            true;

        }

      }
    );


  if (dirty) {

    await batch.commit();

  }

}


/* =========================================================
   TEST ADMIN PUSH
========================================================= */

exports.testAdminPush =
  onCall(

    {

      region:
        REGION,

      enforceAppCheck:
        false,

      timeoutSeconds:
        10,

      memory:
        "256MiB"

    },


    async req => {

      if (
        !isAdmin(req)
      ) {

        throw new HttpsError(
          "permission-denied",
          "Không có quyền Admin."
        );

      }


      const devices =
        await db
          .collection(
            "adminDevices"
          )
          .get();


      const tokens =
        devices.docs

          .map(
            doc =>
              doc.data().token
          )

          .filter(Boolean);


      if (
        !tokens.length
      ) {

        throw new HttpsError(
          "failed-precondition",
          "Chưa có thiết bị nhận thông báo."
        );

      }


      await getMessaging()
        .sendEachForMulticast({

          tokens,

          data: {

            title:
              "🔔 Cheng Coffee",

            body:
              "Thông báo Firebase đang hoạt động bình thường.",

            orderId:
              "TEST",

            url:
              "/admin.html"

          },

          webpush: {

            headers: {

              Urgency:
                "high"

            }

          }

        });


      return {

        ok:
          true

      };

    }

  );