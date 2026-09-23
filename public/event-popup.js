
(() => {
  const style = document.createElement("style");

  style.textContent = `
    #eventPopup {
      border: 0; border-radius: 26px; padding: 26px;
      width: min(520px, 92vw); max-height: 85vh; overflow: auto;
      background: #fffaf2; color: #294538;
      box-shadow: 0 24px 90px #123a3340;
      font-family: Arial, sans-serif;
    }
    #eventPopup::backdrop {
      background: #193a3266; backdrop-filter: blur(5px);
    }
    #eventPopup h2 {
      font-size: 26px; margin: 12px 35px 18px 0;
    }
    #eventPopup .event-close {
      position: absolute; right: 14px; top: 12px;
      border: 0; background: #ecf3e7; color: #294538;
      border-radius: 50%; width: 42px; height: 42px;
      font-size: 25px; cursor: pointer;
    }
    #eventPopup .event-card {
      padding: 18px; margin: 12px 0; border-radius: 18px;
      background: linear-gradient(120deg, #fff0c2, #ffe4d4);
      border: 1px solid #f0d9b3;
    }
    #eventPopup .event-card h3 {
      margin: 8px 0; font-size: 21px;
    }
    #eventPopup .event-card p {
      white-space: pre-line; margin: 8px 0;
    }
    #eventPopup .event-card small {
      display: block; line-height: 1.6;
    }
    #eventPopup .event-badge {
      font-weight: 700; color: #9a411d;
    }
    #eventPopup .event-note {
      font-size: 13px; line-height: 1.6; color: #627360;
    }
    #eventPopup .event-menu {
      width: 100%; margin-top: 12px; padding: 13px;
      border: 0; border-radius: 14px; background: #23745b;
      color: white; font-size: 16px;
      font-weight: 700; cursor: pointer;
    }
  `;

  document.head.appendChild(style);

  const popup = document.createElement("dialog");
  popup.id = "eventPopup";
  popup.setAttribute("aria-labelledby", "eventPopupTitle");

  popup.innerHTML = `
    <button type="button" class="event-close"
      aria-label="Đóng thông báo">×</button>

    <h2 id="eventPopupTitle">
      Cheng có ưu đãi cho bạn!
    </h2>

    <div class="event-list"></div>

    <p class="event-note">
      Ưu đãi tự áp dụng khi đủ điều kiện.
      Mỗi đơn nhận một ưu đãi tốt nhất, không cộng dồn.
    </p>

    <button type="button" class="event-menu">Xem menu</button>
  `;

  document.body.appendChild(popup);

  let events = [];
  let ready = false;
  let shown = false;
  let retry = null;

  const list = popup.querySelector(".event-list");

  const money = n =>
    new Intl.NumberFormat("vi-VN").format(n) + "đ";

  const date = n => new Date(n).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh"
  });

  function text(parent, tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    parent.appendChild(node);
  }

  function render() {
    if (
      !ready ||
      document.hidden ||
      (shown && !popup.open)
    ) return;

    const now = Date.now();

    const visible = events.filter(p =>
      p.active === true &&
      Number.isFinite(p.startsAt) &&
      Number.isFinite(p.endsAt) &&
      p.endsAt > now
    ).sort((a, b) => a.startsAt - b.startsAt);

    if (!visible.length) {
      if (popup.open) popup.close();
      return;
    }

    const busy = ["optionModal", "successScreen"].some(id => {
      const node = document.getElementById(id);
      return node && !node.hidden;
    });

    if (busy && !popup.open) {
      clearTimeout(retry);
      retry = setTimeout(render, 600);
      return;
    }

    list.replaceChildren();

    for (const event of visible) {
      const card = document.createElement("article");
      card.className = "event-card";

      text(
        card,
        "small",
        event.startsAt > now ? "SẮP DIỄN RA" : "ĐANG DIỄN RA",
        "event-badge"
      );

      text(card, "h3", event.title);
      text(card, "p", event.description || "");

      text(
        card,
        "p",
        "Giảm " + event.percent +
          "% · Đơn từ " + money(event.minTotal),
        "event-badge"
      );

      text(
        card,
        "small",
        date(event.startsAt) + " – " +
          date(event.endsAt) + " (giờ Việt Nam)"
      );

      list.appendChild(card);
    }

    if (!popup.open) {
      popup.showModal();
      shown = true;
    }
  }

  popup.querySelector(".event-close").onclick = () => {
    popup.close();
  };

  popup.querySelector(".event-menu").onclick = () => {
    popup.close();

    document.getElementById("menuSearch")
      ?.focus({ preventScroll: true });

    document.querySelector(".menu-area")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const start = () => setTimeout(() => {
    ready = true;
    render();
  }, 3300);

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }

  document.addEventListener("visibilitychange", render);

  db.collection("promotions")
    .where("active", "==", true)
    .onSnapshot(snapshot => {
      events = snapshot.docs.map(doc => doc.data());
      render();
    }, error => {
      console.error("Thông báo sự kiện:", error);
    });
})();
