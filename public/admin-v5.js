
const CCAdmin = (() => {
  const el = id => document.getElementById(id);

  const esc = value => String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

  const cash = n =>
    new Intl.NumberFormat("vi-VN").format(n) + "đ";

  const field = (id, title, type = "text", extra = "") =>
    `<label>${title}
      <input id="${id}" type="${type}" ${extra}>
    </label>`;

  let off = [];
  let reportOff = null;
  let catalog = [];
  let extras = [];
  let promotions = [];
  let eventId = null;
  let toppingId = null;
  let choices = [];
  let costsReady = true;
  let editVersion = 0;
  let eventsReady = false;

  const moneyValue = id => {
    const raw = el(id).value.trim();
    const value = Number(raw);

    if (!raw || !CCPricing.validMoney(value)) {
      throw new Error(
        "Nhập giá bán/giá vốn nguyên từ 0 đến 100.000.000đ."
      );
    }

    return value;
  };

  const notice = (id, error) => {
    el(id).textContent = error.message || String(error);
  };

  const stamp = () =>
    firebase.firestore.FieldValue.serverTimestamp();

  document.querySelector(".admin-tabs")
    .insertAdjacentHTML("beforeend", `
      <button type="button" class="tab-button"
        data-tab="promotions">✦ Khuyến mãi</button>
    `);

  el("adminApp").insertAdjacentHTML("beforeend", `
    <section id="tab-promotions" class="tab-page">
      <section class="panel">
        <div class="section-label">SỰ KIỆN & ƯU ĐÃI</div>
        <h2>Tạo khoảnh khắc đặc biệt</h2>

        <p class="muted">
          Giảm theo phần trăm toàn đơn, gồm topping.
          Không cộng dồn; khách nhận mức giảm tốt nhất.
        </p>

        <form id="eventForm">
          <div class="v5-grid">
            ${field("eventTitle", "Tên sự kiện", "text",
              'required maxlength="100"')}
            ${field("eventPercent", "Giảm giá (%)", "number",
              'required min="1" max="100" step="1"')}
            ${field("eventStart", "Bắt đầu (giờ Việt Nam)",
              "datetime-local", "required")}
            ${field("eventEnd", "Kết thúc (giờ Việt Nam)",
              "datetime-local", "required")}
            ${field("eventMin", "Đơn tối thiểu (đ)", "number",
              'required min="0" step="1" value="0"')}

            <label class="checkbox-row">
              <input id="eventActive" type="checkbox" checked>
              Hiển thị sự kiện
            </label>
          </div>

          <label>
            Mô tả
            <textarea id="eventDescription"
              maxlength="500" rows="3"></textarea>
          </label>

          <div class="actions">
            <button class="primary" id="eventSave">
              Lưu sự kiện
            </button>
            <button class="secondary" type="button"
              id="eventReset">Tạo sự kiện mới</button>
          </div>
        </form>

        <p id="eventMessage" role="status"></p>
      </section>

      <div id="eventList" class="v5-grid"></div>
    </section>
  `);

  el("tab-stats").insertAdjacentHTML("afterbegin", `
    <section class="panel profit-panel">
      <div class="section-label">HIỆU QUẢ KINH DOANH</div>
      <h2>Lợi nhuận thực thu</h2>

      <p class="muted">
        Theo ngày đặt đơn, chỉ tính đơn đã thanh toán.
        Lãi gộp = tiền sau giảm giá − giá vốn món và topping,
        chưa trừ chi phí vận hành.
      </p>

      <form id="reportForm" class="v5-grid">
        ${field("reportFrom", "Từ ngày", "date", "required")}
        ${field("reportTo", "Đến ngày", "date", "required")}
        <button class="primary">Xem báo cáo</button>
      </form>

      <p id="reportMessage" role="status"></p>
      <div id="profitCards" class="v5-grid"></div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Đơn đã trả</th>
              <th>Thực thu</th>
              <th>Giá vốn đã biết</th>
              <th>Lãi gộp đã biết</th>
              <th>Thiếu giá vốn</th>
            </tr>
          </thead>
          <tbody id="profitRows"></tbody>
        </table>
      </div>
    </section>
  `);

  for (const size of ["S", "M", "L"]) {
    el("size" + size).insertAdjacentHTML(
      "afterend",
      field(
        "cost" + size,
        "Giá vốn size " + size + " (đ)",
        "number",
        'min="0" step="1" placeholder="Bắt buộc nếu bán size này"'
      )
    );
  }

  const oldBox = el("toppingsText").closest(".config-box");
  oldBox.hidden = true;

  oldBox.insertAdjacentHTML("afterend", `
    <div class="config-box">
      <h3>Topping của món</h3>
      <p class="muted">
        Tích topping được phép bán kèm và nhập giá vốn.
        Bỏ tích để không bán kèm.
      </p>
      <div id="toppingChoices"></div>
    </div>
  `);

  el("tab-menu").insertAdjacentHTML("beforeend", `
    <section class="panel">
      <h2>Danh sách topping dùng chung</h2>

      <p class="muted">
        Tạo topping ở đây rồi tích chọn khi thêm/sửa món.
        Thay đổi danh sách này áp dụng khi bạn chọn topping
        và lưu lại món.
      </p>

      <form id="toppingForm">
        <div class="v5-grid">
          ${field("toppingName", "Tên topping", "text",
            'required maxlength="80"')}
          ${field("toppingPrice", "Giá bán (đ)", "number",
            'required min="0" step="1"')}
          ${field("toppingCost", "Giá vốn (đ)", "number",
            'required min="0" step="1"')}
        </div>

        <div class="actions">
          <button class="primary" id="toppingSave">
            Lưu topping
          </button>
          <button type="reset" class="secondary">Tạo mới</button>
        </div>
      </form>

      <p id="toppingMessage" role="status"></p>
      <div id="toppingLibrary"></div>
    </section>
  `);

  function renderChoices(selected, costs) {
    const old = [
      ...el("toppingChoices").querySelectorAll(
        'input[type="checkbox"]'
      )
    ];

    selected ??= old.filter(x => x.checked).map(x => x.value);

    costs ??= Object.fromEntries(
      old.map(x => [x.value, el("tc" + x.dataset.i).value])
    );

    choices = [
      ...new Map(
        [...extras, ...catalog].map(t => [t.id, t])
      ).values()
    ];

    el("toppingChoices").innerHTML = choices.map((t, i) => `
      <div class="topping-choice">
        <label class="checkbox-row">
          <input type="checkbox"
            value="${esc(t.id)}"
            data-i="${i}"
            ${selected.includes(t.id) ? "checked" : ""}>
          ${esc(t.name)} · +${cash(t.price)}
        </label>

        <label>
          Giá vốn (đ)
          <input id="tc${i}" type="number" min="0" step="1"
            value="${esc(costs[t.id] ?? t.cost ?? "")}">
        </label>
      </div>
    `).join("") || `
      <p class="muted">
        Chưa có topping. Thêm trong danh sách topping phía dưới.
      </p>
    `;
  }

  function resetMenu() {
    editVersion++;
    costsReady = true;
    extras = [];

    for (const s of ["S", "M", "L"]) {
      el("cost" + s).value = "";
    }

    renderChoices([], {});
  }

  async function editMenu(id) {
    const version = ++editVersion;
    costsReady = false;
    el("message").textContent = "Đang tải giá vốn...";

    for (const s of ["S", "M", "L"]) {
      el("cost" + s).value = "";
    }

    const item = MENU.find(x => x.id === id);
    extras = (item?.toppings || []).map(t => ({ ...t }));
    renderChoices(extras.map(t => t.id), {});

    try {
      const doc = await db.collection("menuCosts").doc(id).get();
      if (version !== editVersion) return;

      const data = doc.exists ? doc.data() : {};

      for (const s of ["S", "M", "L"]) {
        el("cost" + s).value = data.sizes?.[s] ?? "";
      }

      renderChoices(
        extras.map(t => t.id),
        data.toppings || {}
      );

      costsReady = true;
      el("message").textContent = doc.exists ? "" :
        "Món cũ chưa có giá vốn. Vui lòng nhập trước khi lưu.";
    } catch (error) {
      if (version === editVersion) notice("message", error);
    }
  }

  async function saveMenu(event) {
    event.preventDefault();

    if (el("saveBtn").disabled) return;
    el("saveBtn").disabled = true;

    try {
      if (!costsReady) {
        throw new Error(
          "Chưa tải được giá vốn. Mở lại món để thử lại."
        );
      }

      const id = editingId ||
        el("itemId").value.trim().toUpperCase();

      if (!/^[A-Z0-9_-]{1,30}$/.test(id)) {
        throw new Error("Mã món không hợp lệ.");
      }

      const sizes = buildSizes();
      const name = el("itemName").value.trim();
      const category = el("itemCategory").value.trim();

      if (!name || !category || !sizes.length) {
        throw new Error(
          "Nhập tên, danh mục và ít nhất một size."
        );
      }

      const costs = {
        sizes: {},
        toppings: {},
        updatedAt: stamp()
      };

      for (const size of sizes) {
        if (!CCPricing.validMoney(size.price)) {
          throw new Error("Giá bán không hợp lệ.");
        }

        costs.sizes[size.id] = moneyValue("cost" + size.id);
      }

      const toppings = [
        ...el("toppingChoices").querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ].map(input => {
        const topping = choices[Number(input.dataset.i)];

        costs.toppings[topping.id] =
          moneyValue("tc" + input.dataset.i);

        return {
          id: topping.id,
          name: topping.name,
          price: topping.price
        };
      });

      if (toppings.length > 20) {
        throw new Error("Tối đa 20 topping cho một món.");
      }

      const ref = db.collection("menu").doc(id);
      const wasEditing = !!editingId;

      await db.runTransaction(async tx => {
        const current = await tx.get(ref);

        if (!wasEditing && current.exists) {
          throw new Error("Mã món đã tồn tại.");
        }

        if (wasEditing && !current.exists) {
          throw new Error("Món đã bị xóa.");
        }

        tx.set(ref, {
          name: name.slice(0, 100),
          category: category.slice(0, 80),
          description: el("itemDescription")
            .value.trim().slice(0, 300),
          sizes,
          toppings,
          active: el("itemActive").checked,
          updatedAt: stamp()
        });

        tx.set(db.collection("menuCosts").doc(id), costs);
      });

      resetMenuForm();
      notice("message", "Đã lưu món, topping và giá vốn.");
    } catch (error) {
      notice("message", error);
    } finally {
      el("saveBtn").disabled = false;
    }
  }

  el("toppingForm").addEventListener("reset", () => {
    toppingId = null;
  });

  el("toppingForm").addEventListener("submit", async event => {
    event.preventDefault();
    el("toppingSave").disabled = true;

    try {
      const name = el("toppingName").value.trim();
      if (!name) throw new Error("Nhập tên topping.");

      const collection = db.collection("toppingCatalog");
      const ref = toppingId
        ? collection.doc(toppingId)
        : collection.doc();

      await ref.set({
        name,
        price: moneyValue("toppingPrice"),
        cost: moneyValue("toppingCost"),
        updatedAt: stamp()
      });

      el("toppingForm").reset();
      notice("toppingMessage", "Đã lưu topping.");
    } catch (error) {
      notice("toppingMessage", error);
    } finally {
      el("toppingSave").disabled = false;
    }
  });

  el("toppingLibrary").addEventListener("click", async event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;

    const topping = catalog.find(t =>
      t.id === button.dataset.id
    );
    if (!topping) return;

    if (button.dataset.action === "edit") {
      toppingId = topping.id;
      el("toppingName").value = topping.name;
      el("toppingPrice").value = topping.price;
      el("toppingCost").value = topping.cost;
    } else if (confirm(
      "Xóa topping khỏi danh sách dùng chung? " +
      "Các món đã lưu vẫn giữ topping này."
    )) {
      try {
        await db.collection("toppingCatalog")
          .doc(topping.id).delete();
      } catch (error) {
        notice("toppingMessage", error);
      }
    }
  });

  const localVN = ms =>
    new Date(ms + 7 * 3600000).toISOString().slice(0, 16);

  function resetEvent() {
    eventId = null;
    el("eventForm").reset();
    el("eventSave").textContent = "Lưu sự kiện";
  }

  el("eventReset").onclick = resetEvent;

  el("eventForm").addEventListener("submit", async event => {
    event.preventDefault();
    el("eventSave").disabled = true;

    try {
      if (!eventsReady) {
        throw new Error("Chưa tải được danh sách sự kiện.");
      }

      const startsAt = Date.parse(
        el("eventStart").value + ":00+07:00"
      );
      const endsAt = Date.parse(
        el("eventEnd").value + ":00+07:00"
      );
      const percent = Number(el("eventPercent").value);
      const title = el("eventTitle").value.trim();

      if (
        !title ||
        !Number.isFinite(startsAt) ||
        !Number.isFinite(endsAt) ||
        endsAt <= startsAt ||
        !Number.isInteger(percent) ||
        percent < 1 ||
        percent > 100
      ) {
        throw new Error(
          "Kiểm tra tên, thời gian bắt đầu/kết thúc " +
          "và mức giảm 1–100%."
        );
      }

      const collection = db.collection("promotions");
      const ref = eventId
        ? collection.doc(eventId)
        : collection.doc();

      await ref.set({
        title,
        description: el("eventDescription").value.trim(),
        startsAt,
        endsAt,
        percent,
        minTotal: moneyValue("eventMin"),
        active: el("eventActive").checked,
        updatedAt: stamp()
      });

      resetEvent();
      notice(
        "eventMessage",
        "Đã lưu. Trang khách tự cập nhật sự kiện."
      );
    } catch (error) {
      notice("eventMessage", error);
    } finally {
      el("eventSave").disabled = false;
    }
  });

  function renderEvents() {
    el("eventList").innerHTML = promotions.map(p => {
      const status = !p.active ? "ĐÃ ẨN" :
        Date.now() < p.startsAt ? "SẮP DIỄN RA" :
        Date.now() >= p.endsAt ? "ĐÃ KẾT THÚC" :
        "ĐANG DIỄN RA";

      return `
        <article class="panel">
          <span class="eyebrow">${status}</span>
          <h2>${esc(p.title)} · ${p.percent}%</h2>
          <p>${esc(p.description)}</p>

          <p class="muted">
            ${localVN(p.startsAt).replace("T", " ")} →
            ${localVN(p.endsAt).replace("T", " ")} (VN)
            <br>Đơn từ ${cash(p.minTotal)}
          </p>

          <div class="actions">
            <button class="secondary"
              data-action="edit"
              data-id="${esc(p.id)}">Sửa</button>

            <button class="secondary"
              data-action="toggle"
              data-id="${esc(p.id)}">
              ${p.active ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </article>
      `;
    }).join("") || `
      <p class="muted">
        Chưa có sự kiện. Tạo ưu đãi đầu tiên ở trên.
      </p>
    `;
  }

  el("eventList").addEventListener("click", async event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;

    const p = promotions.find(x => x.id === button.dataset.id);
    if (!p) return;

    if (button.dataset.action === "toggle") {
      try {
        await db.collection("promotions").doc(p.id).update({
          active: !p.active,
          updatedAt: stamp()
        });
      } catch (error) {
        notice("eventMessage", error);
      }
    } else {
      eventId = p.id;
      el("eventTitle").value = p.title;
      el("eventDescription").value = p.description;
      el("eventPercent").value = p.percent;
      el("eventMin").value = p.minTotal;
      el("eventActive").checked = p.active;
      el("eventStart").value = localVN(p.startsAt);
      el("eventEnd").value = localVN(p.endsAt);
      el("eventSave").textContent = "Cập nhật sự kiện";

      el("eventForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  });

  function report() {
    if (!el("reportPayment")) {
      const label = document.createElement("label");

      label.innerHTML = `
        Phạm vi báo cáo
        <select id="reportPayment">
          <option value="paid">Đơn đã thanh toán</option>
          <option value="all">
            Tất cả đơn — lãi dự kiến
          </option>
        </select>
      `;

      el("reportForm").appendChild(label);
      el("reportPayment").addEventListener("change", report);
    }

    const from = el("reportFrom").value;
    const to = el("reportTo").value;
    const all = el("reportPayment").value === "all";
    const duration = Date.parse(to) - Date.parse(from);

    if (
      !from || !to ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > 366 * 86400000
    ) {
      notice(
        "reportMessage",
        "Chọn khoảng ngày hợp lệ, tối đa 367 ngày."
      );
      return;
    }

    if (reportOff) reportOff();
    reportOff = null;

    el("profitCards").innerHTML = "";
    el("profitRows").innerHTML = "";
    notice("reportMessage", "Đang tải báo cáo...");

    const panel = el("reportForm").closest(".profit-panel");

    panel.querySelector("h2").textContent = all
      ? "Lợi nhuận dự kiến theo đơn"
      : "Lợi nhuận thực thu";

    panel.querySelector("p.muted").textContent = all
      ? "Theo ngày đặt đơn, gồm đơn chưa thanh toán. " +
        "Đây là lãi dự kiến, chưa trừ chi phí vận hành."
      : "Theo ngày đặt đơn, chỉ tính đơn đã thanh toán. " +
        "Lãi gộp chưa trừ chi phí vận hành.";

    panel.querySelectorAll("th")[1].textContent =
      all ? "Số đơn" : "Đơn đã trả";

    function fail(error) {
      console.error("Báo cáo:", error);

      const code = String(error.code || "");
      let message = error.message || "Không tải được báo cáo.";

      if (code.includes("permission-denied")) {
        message =
          "Firebase từ chối quyền đọc đơn hàng. " +
          "Hãy triển khai firestore.rules đúng dự án, " +
          "rồi đăng xuất và đăng nhập lại Admin.";
      } else if (code.includes("unauthenticated")) {
        message =
          "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại Admin.";
      } else if (code.includes("unavailable")) {
        message =
          "Chưa kết nối được Firebase. Kiểm tra mạng " +
          "và bấm Xem báo cáo để thử lại.";
      }

      el("profitCards").innerHTML = "";
      el("profitRows").innerHTML = `
        <tr><td colspan="6">Không tải được dữ liệu.</td></tr>
      `;

      notice(
        "reportMessage",
        message + (code ? " [" + code + "]" : "")
      );
    }

    try {
      reportOff = db.collection("orders")
        .where("dateKey", ">=", from)
        .where("dateKey", "<=", to)
        .onSnapshot(snapshot => {
          try {
            const orders = snapshot.docs.map(d => d.data());
            const paid = orders.filter(
              order => order.paymentStatus === "paid"
            );
            const selected = all ? orders : paid;

            const empty = () => ({
              count: 0,
              revenue: 0,
              cost: 0,
              knownRevenue: 0,
              missing: 0,
              discount: 0
            });

            const sum = empty();
            const rows = new Map();

            const number = value =>
              Number.isFinite(Number(value))
                ? Number(value)
                : 0;

            for (const order of selected) {
              const row = rows.get(order.dateKey) || empty();

              const complete =
                order.costComplete === true &&
                Number.isFinite(order.totalCost) &&
                order.totalCost >= 0;

              for (const target of [sum, row]) {
                target.count++;
                target.revenue += number(order.total);
                target.discount += number(order.discount);

                if (complete) {
                  target.cost += order.totalCost;
                  target.knownRevenue += number(order.total);
                } else {
                  target.missing++;
                }
              }

              rows.set(order.dateKey, row);
            }

            const profit = sum.knownRevenue - sum.cost;
            const covered = selected.length - sum.missing;

            const rate = base => base > 0
              ? (100 * profit / base).toFixed(1) + "%"
              : "—";

            const cards = [
              ["Tổng đơn trong khoảng ngày", orders.length],
              ["Đơn đã thanh toán", paid.length],
              ["Đơn chưa thanh toán", orders.length - paid.length],
              [
                all ? "Giá trị tất cả đơn" : "Thực thu",
                cash(sum.revenue)
              ],
              ["Giảm giá", cash(sum.discount)],
              ["Giá vốn đã biết", covered ? cash(sum.cost) : "—"],
              [
                all ? "Lãi gộp dự kiến đã biết" : "Lãi gộp đã biết",
                covered ? cash(profit) : "—"
              ],
              ["Lãi / giá vốn", covered ? rate(sum.cost) : "—"],
              [
                "Biên lãi / doanh thu đủ giá vốn",
                covered ? rate(sum.knownRevenue) : "—"
              ]
            ];

            el("profitCards").innerHTML = cards.map(
              ([label, value]) => `
                <article class="profit-card">
                  <span>${label}</span>
                  <strong>${value}</strong>
                </article>
              `
            ).join("");

            let message = snapshot.metadata?.fromCache
              ? "Dữ liệu lưu tạm; đang chờ đồng bộ Firebase. "
              : "";

            if (!orders.length) {
              message +=
                "Không có đơn trong khoảng ngày đã chọn. " +
                "Thử mở rộng khoảng ngày.";
            } else if (!selected.length) {
              message +=
                "Có " + orders.length +
                " đơn nhưng chưa có đơn đã thanh toán. " +
                "Chọn Tất cả đơn để xem lãi dự kiến.";
            } else if (sum.missing) {
              message +=
                sum.missing +
                " đơn thiếu giá vốn bị loại khỏi phép tính " +
                "lãi và tỷ suất; vẫn được tính trong giá trị đơn.";
            } else {
              message +=
                "Đã hiển thị " + selected.length +
                " đơn. Giá vốn lấy tại thời điểm đặt đơn.";
            }

            notice("reportMessage", message);

            el("profitRows").innerHTML = [...rows]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, row]) => `
                <tr>
                  <td>${esc(date)}</td>
                  <td>${row.count}</td>
                  <td>${cash(row.revenue)}</td>
                  <td>${row.count > row.missing
                    ? cash(row.cost)
                    : "—"}</td>
                  <td>${row.count > row.missing
                    ? cash(row.knownRevenue - row.cost)
                    : "—"}</td>
                  <td>${row.missing}</td>
                </tr>
              `).join("") || `
                <tr><td colspan="6">
                  Không có đơn phù hợp với bộ lọc.
                </td></tr>
              `;
          } catch (error) {
            fail(error);
          }
        }, fail);
    } catch (error) {
      fail(error);
    }
  }

  el("reportForm").addEventListener("submit", event => {
    event.preventDefault();
    report();
  });

  function start() {
    resetMenuForm();
    resetEvent();
    el("toppingForm").reset();

    off.push(
      db.collection("toppingCatalog").onSnapshot(snapshot => {
        catalog = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        }));

        renderChoices();

        el("toppingLibrary").innerHTML = catalog.map(t => `
          <div class="topping-choice">
            <span>
              ${esc(t.name)} · ${cash(t.price)}
              / vốn ${cash(t.cost)}
            </span>

            <div class="actions">
              <button class="secondary"
                data-id="${esc(t.id)}"
                data-action="edit">Sửa</button>

              <button class="secondary"
                data-id="${esc(t.id)}"
                data-action="delete">Xóa</button>
            </div>
          </div>
        `).join("");
      }, error => notice("toppingMessage", error))
    );

    off.push(
      db.collection("promotions").onSnapshot(snapshot => {
        eventsReady = true;
        promotions = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        }));
        renderEvents();
      }, error => {
        eventsReady = false;
        notice("eventMessage", error);
      })
    );

    const today = dateKeyVN();
    el("reportFrom").value = today.slice(0, 8) + "01";
    el("reportTo").value = today;
    report();

    const timer = setInterval(renderEvents, 30000);
    off.push(() => clearInterval(timer));
  }

  function stop() {
    off.forEach(fn => fn());
    off = [];

    if (reportOff) reportOff();

    reportOff = null;
    eventsReady = false;
    editVersion++;
    eventId = null;
    toppingId = null;
    catalog = [];
    extras = [];
    promotions = [];
  }

  return {
    start,
    stop,
    saveMenu,
    editMenu,
    resetMenu
  };
})();
