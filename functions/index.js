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


/* =====================================
   FIREBASE ADMIN
===================================== */

initializeApp();

const db =
  getFirestore();


const REGION =
  "asia-southeast1";


/*
  Email Admin của bạn.
  Không điền mật khẩu ở đây.
*/
const ADMIN_EMAIL =
  "sangbeos1410@gmail.com";


/* =====================================
   ADMIN CHECK
===================================== */

function isAdmin(req) {

  return !!req.auth
    &&
    String(
      req.auth.token.email || ""
    )
    .toLowerCase()
    ===
    ADMIN_EMAIL.toLowerCase();

}


/* =====================================
   DATE VIETNAM
===================================== */

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


/* =====================================
   CLEAN TABLE
===================================== */

function cleanTable(value) {

  return String(
    value || ""
  )
  .trim()
  .slice(
    0,
    20
  );

}


/* =====================================
   CLEAN NOTE
===================================== */

function cleanItemNote(
  value
) {

  return String(
    value || ""
  )
  .trim()
  .slice(
    0,
    160
  );

}


function cleanOrderNote(
  value
) {

  return String(
    value || ""
  )
  .trim()
  .slice(
    0,
    240
  );

}


/* =====================================
   CREATE ORDER
===================================== */

exports.createOrder =
  onCall(

    {

      region:
        REGION,


      /*
        Hiện tại để false
        vì App Check của website
        chưa cấu hình hoàn chỉnh.

        Sau này App Check chạy ổn
        mới đổi lại true.
      */
      enforceAppCheck:
        false,


      timeoutSeconds:
        15,


      memory:
        "256MiB"

    },


    async req => {


      /* -----------------------------
         AUTH
      ----------------------------- */

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

        orderNote,

        clientRequestId

      } =
        req.data || {};


      /* -----------------------------
         TABLE
      ----------------------------- */

      const safeTable =
        cleanTable(table);


      if (
        !safeTable
      ) {

        throw new HttpsError(
          "invalid-argument",
          "Vui lòng nhập số bàn."
        );

      }


      /* -----------------------------
         REQUEST ID
      ----------------------------- */

      if (
        typeof clientRequestId
        !==
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
          typeof item.menuId
          !==
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
          typeof item.sizeId
          !==
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


      /* =================================
         CHỐNG ĐẶT TRÙNG ĐƠN
      ================================= */

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


      /* =================================
         TRANSACTION
      ================================= */

      const result =
        await db
          .runTransaction(

            async transaction => {


              /* -------------------------
                 KIỂM TRA REQUEST CŨ
              ------------------------- */

              const previousRequest =
                await transaction
                  .get(
                    requestRef
                  );


              if (
                previousRequest.exists
              ) {

                const data =
                  previousRequest
                    .data();


                return {

                  orderId:
                    data.orderId,

                  total:
                    data.total || 0,

                  deduplicated:
                    true

                };

              }


              /* -------------------------
                 ĐỌC MENU
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
                    ) {

                      throw new HttpsError(
                        "failed-precondition",
                        "Có món không tồn tại."
                      );

                    }


                    const menuData =
                      snapshot.data();


                    if (
                      menuData.active !==
                      true
                    ) {

                      throw new HttpsError(
                        "failed-precondition",
                        "Có món đã ngừng bán."
                      );

                    }


                    menuMap.set(
                      snapshot.id,
                      menuData
                    );

                  }
                );


              /* -------------------------
                 TÍNH GIÁ SERVER
              ------------------------- */

              let total = 0;

              let cups = 0;


              const safeItems =
                items.map(
                  item => {


                    const menuItem =
                      menuMap.get(
                        item.menuId
                      );


                    if (
                      !menuItem
                    ) {

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

                          item
                            .toppingIds
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
                          topping =>

                            String(
                              topping.id
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
                            String(
                              topping.id
                            )
                            .slice(
                              0,
                              40
                            ),

                          name:
                            String(
                              topping.name || ""
                            )
                            .slice(
                              0,
                              80
                            ),

                          price:
                            toppingPrice

                        });

                    }


                    /* TÍNH GIÁ */

                    const toppingsPrice =
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
                      toppingsPrice;


                    const quantity =
                      item.quantity;


                    const subtotal =
                      unitPrice
                      *
                      quantity;


                    total +=
                      subtotal;


                    cups +=
                      quantity;


                    return {

                      menuId:
                        item.menuId,


                      name:
                        String(
                          menuItem.name || ""
                        )
                        .slice(
                          0,
                          100
                        ),


                      category:
                        String(
                          menuItem.category || ""
                        )
                        .slice(
                          0,
                          80
                        ),


                      sizeId:
                        String(
                          selectedSize.id
                        )
                        .slice(
                          0,
                          20
                        ),


                      sizeName:
                        String(
                          selectedSize.name
                          ||
                          selectedSize.id
                        )
                        .slice(
                          0,
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

                    };

                  }
                );


              /* -------------------------
                 TOTAL VALIDATION
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


              /* -------------------------
                 CREATE ORDER
              ------------------------- */

              transaction.create(

                orderRef,

                {

                  table:
                    safeTable,


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
                 SAVE REQUEST ID
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


                table:
                  safeTable,


                orderNote:
                  safeOrderNote,


                items:
                  safeItems,


                deduplicated:
                  false

              };

            }

          );


      /* =================================
         PUSH NOTIFICATION
      ================================= */

      if (
        !result.deduplicated
      ) {

        try {

          await sendOrderNotification(
            result.orderId,
            result
          );

        } catch (error) {

          /*
            Push lỗi không được
            làm mất đơn hàng.
          */

          console.error(
            "Push notification error:",
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


/* =====================================
   SEND ORDER PUSH
===================================== */

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
      500
    );


  let body = "";


  if (
    order.table
  ) {

    body +=

      "Bàn "

      +

      order.table

      +

      " • ";

  }


  body +=
    itemText;


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

    new Intl
      .NumberFormat(
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

          title:

            "🔔 ĐƠN MỚI"

            +

            (
              order.table

              ?

              " - Bàn "
              +
              order.table

              :

              ""
            ),


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


  /* =================================
     XÓA TOKEN HẾT HẠN
  ================================= */

  const batch =
    db.batch();


  let hasInvalidToken =
    false;


  response.responses
    .forEach(
      (
        result,
        index
      ) => {


        if (
          result.success
        ) {

          return;

        }


        const code =
          result.error
            ?.code;


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


          hasInvalidToken =
            true;

        }

      }
    );


  if (
    hasInvalidToken
  ) {

    await batch.commit();

  }

}


/* =====================================
   TEST ADMIN PUSH
===================================== */

exports.testAdminPush =
  onCall(

    {

      region:
        REGION,


      /*
        Cũng để false trong giai đoạn
        chưa hoàn thiện App Check.
      */
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