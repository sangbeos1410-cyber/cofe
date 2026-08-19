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


initializeApp();


const db =
  getFirestore();


const REGION =
  "asia-southeast1";


const ADMIN_EMAIL =
  "sangbeos1410@gmail.com";


function isAdmin(req) {

  return (
    !!req.auth
    &&
    String(
      req.auth.token.email || ""
    ).toLowerCase()
    ===
    ADMIN_EMAIL.toLowerCase()
  );

}


function dateKeyVN(
  date = new Date()
) {

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
    .format(date);

}


function cleanTable(value) {

  return String(
    value || ""
  )
  .trim()
  .slice(0, 20);

}


// =========================================
// CREATE ORDER
// =========================================


exports.createOrder =
  onCall(

    {

      region:
        REGION,

      // Tạm để false.
      // Khi App Check chạy ổn
      // mới đổi lại true.
      enforceAppCheck:
        false,

      timeoutSeconds:
        10,

      memory:
        "256MiB"

    },


    async req => {

      if (
        !req.auth
      ) {

        throw new HttpsError(
          "unauthenticated",
          "Thiết bị chưa xác thực."
        );

      }


      const {

        table,

        items,

        clientRequestId

      } =
        req.data || {};


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


      if (
        typeof clientRequestId
        !== "string"
        ||
        clientRequestId.length < 8
        ||
        clientRequestId.length > 100
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Mã yêu cầu không hợp lệ."
        );

      }


      for (
        const item
        of items
      ) {

        if (
          typeof item.menuId
          !== "string"
        ) {

          throw new HttpsError(
            "invalid-argument",
            "Mã món không hợp lệ."
          );

        }


        if (
          typeof item.sizeId
          !== "string"
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

      }


      // chống gửi trùng đơn

      const requestHash =
        crypto
          .createHash("sha256")
          .update(
            req.auth.uid
            +
            ":"
            +
            clientRequestId
          )
          .digest("hex");


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


      const result =
        await db
          .runTransaction(

            async transaction => {

              const oldRequest =
                await transaction
                  .get(
                    requestRef
                  );


              if (
                oldRequest.exists
              ) {

                return {

                  orderId:
                    oldRequest
                      .data()
                      .orderId,

                  total:
                    oldRequest
                      .data()
                      .total || 0,

                  duplicated:
                    true

                };

              }


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
                    id =>

                      transaction.get(

                        db
                          .collection(
                            "menu"
                          )
                          .doc(id)

                      )

                  )

                );


              const menuMap =
                new Map();


              menuSnapshots
                .forEach(
                  snapshot => {

                    if (
                      !snapshot.exists
                      ||
                      snapshot
                        .data()
                        .active
                        !== true
                    ) {

                      throw new HttpsError(
                        "failed-precondition",
                        "Có món đã ngừng bán."
                      );

                    }


                    menuMap.set(

                      snapshot.id,

                      snapshot.data()

                    );

                  }
                );


              let total = 0;

              let cups = 0;


              const safeItems =
                items.map(
                  item => {

                    const menuItem =
                      menuMap.get(
                        item.menuId
                      );


                    const sizes =
                      Array.isArray(
                        menuItem.sizes
                      )

                        ? menuItem.sizes

                        : [];


                    const toppings =
                      Array.isArray(
                        menuItem.toppings
                      )

                        ? menuItem.toppings

                        : [];


                    const size =
                      sizes.find(
                        size =>
                          String(size.id)
                          ===
                          String(
                            item.sizeId
                          )
                      );


                    if (!size) {

                      throw new HttpsError(
                        "failed-precondition",
                        "Size không còn bán."
                      );

                    }


                    const selectedToppings =
                      [];


                    const toppingIds =
                      [
                        ...new Set(

                          item
                            .toppingIds
                            .map(String)

                        )
                      ];


                    for (
                      const toppingId
                      of toppingIds
                    ) {

                      const topping =
                        toppings.find(
                          topping =>
                            String(
                              topping.id
                            )
                            ===
                            toppingId
                        );


                      if (!topping) {

                        throw new HttpsError(
                          "failed-precondition",
                          "Có topping không còn bán."
                        );

                      }


                      selectedToppings
                        .push({

                          id:
                            String(
                              topping.id
                            ),

                          name:
                            String(
                              topping.name
                            )
                            .slice(
                              0,
                              80
                            ),

                          price:
                            Number(
                              topping.price
                            )
                            || 0

                        });

                    }


                    const sizePrice =
                      Number(
                        size.price
                      )
                      || 0;


                    const toppingPrice =
                      selectedToppings
                        .reduce(
                          (
                            sum,
                            topping
                          ) =>

                            sum
                            +
                            topping.price,

                          0
                        );


                    const unitPrice =
                      sizePrice
                      +
                      toppingPrice;


                    const subtotal =
                      unitPrice
                      *
                      item.quantity;


                    total +=
                      subtotal;


                    cups +=
                      item.quantity;


                    return {

                      menuId:
                        item.menuId,

                      name:
                        String(
                          menuItem.name
                        )
                        .slice(
                          0,
                          100
                        ),

                      sizeId:
                        String(
                          size.id
                        ),

                      sizeName:
                        String(
                          size.name ||
                          size.id
                        ),

                      sizePrice,

                      toppings:
                        selectedToppings,

                      unitPrice,

                      quantity:
                        item.quantity,

                      subtotal

                    };

                  }
                );


              if (
                total < 0
                ||
                total >
                100000000
              ) {

                throw new HttpsError(
                  "invalid-argument",
                  "Tổng tiền không hợp lệ."
                );

              }


              const now =
                FieldValue
                  .serverTimestamp();


              const cleanTableValue =
                cleanTable(table);


              transaction.create(

                orderRef,

                {

                  table:
                    cleanTableValue,

                  items:
                    safeItems,

                  total,

                  cups,

                  status:
                    "new",

                  dateKey,

                  customerUid:
                    req.auth.uid,

                  createdAt:
                    now,

                  updatedAt:
                    now

                }

              );


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
                      .increment(cups),

                  revenue:
                    FieldValue
                      .increment(total),

                  updatedAt:
                    now

                },

                {
                  merge: true
                }

              );


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

                table:
                  cleanTableValue,

                items:
                  safeItems,

                duplicated:
                  false

              };

            }

          );


      // Không gửi push lần nữa
      // nếu đây là request retry

      if (
        !result.duplicated
      ) {

        try {

          await sendOrderNotification(

            result.orderId,

            result

          );

        } catch (error) {

          // push lỗi vẫn giữ đơn

          console.error(
            "Push error:",
            error
          );

        }

      }


      return {

        orderId:
          result.orderId,

        total:
          result.total

      };

    }

  );


// =========================================
// PUSH ĐƠN MỚI
// =========================================


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
    return;
  }


  const itemText =

    order.items

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


          return text;

        }
      )

      .join(", ")

      .slice(
        0,
        500
      );


  const body =

    (
      order.table

        ? "Bàn "
          +
          order.table
          +
          " • "

        : ""
    )

    +

    itemText

    +

    " • "

    +

    new Intl
      .NumberFormat(
        "vi-VN"
      )
      .format(
        order.total
      )

    +

    "đ";


  await getMessaging()
    .sendEachForMulticast({

      tokens,

      data: {

        title:

          "🔔 ĐƠN MỚI"

          +

          (
            order.table

              ? " - Bàn "
                +
                order.table

              : ""
          ),

        body,

        orderId:
          String(orderId),

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

}


// =========================================
// TEST PUSH ADMIN
// =========================================


exports.testAdminPush =
  onCall(

    {

      region:
        REGION,

      enforceAppCheck:
        false

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
              "Thông báo Firebase hoạt động bình thường.",

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
        ok: true
      };

    }

  );