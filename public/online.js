
(() => {
  let socket = null;
  let roomCode = "";

  const panel = document.createElement("div");

  panel.innerHTML = `
    <div style="
      position:fixed; inset:0; z-index:99999;
      background:#090b18dd; display:none;
      align-items:center; justify-content:center;
      font-family:Arial,sans-serif;
    " id="online-overlay">
      <div style="
        background:#20213d; color:white; padding:28px;
        border-radius:20px; width:min(360px,85%);
        text-align:center;
      ">
        <h2>🌐 Онлайн-игра</h2>
        <p>Создай комнату или введи код друга</p>
        <button id="create-room">Создать комнату</button>
        <p>Или</p>
        <input id="room-code" placeholder="Код комнаты"
          maxlength="6" style="padding:12px;width:80%;text-align:center">
        <button id="join-room">Присоединиться</button>
        <p id="online-status">Не подключено</p>
        <button id="close-online">Закрыть</button>
      </div>
    </div>
    <button id="open-online" style="
      position:fixed; right:18px; bottom:18px; z-index:9999;
      padding:14px 20px; border:0; border-radius:14px;
      background:#7655e8; color:white; font-weight:bold;
      cursor:pointer;
    ">🌐 Онлайн</button>
  `;

  document.body.appendChild(panel);

  const overlay = document.getElementById("online-overlay");
  const status = document.getElementById("online-status");

  document.getElementById("open-online").onclick = () => {
    overlay.style.display = "flex";
  };

  document.getElementById("close-online").onclick = () => {
    overlay.style.display = "none";
  };

  function connect(code) {
    if (socket) socket.close();

    roomCode = code;
    status.textContent = "Подключаемся...";

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(
      `${protocol}//${location.host}/room?id=${encodeURIComponent(code)}`
    );

    socket.onopen = () => {
      status.textContent = "Соединение установлено!";
    };

    socket.onmessage = event => {
      const data = JSON.parse(event.data);

      if (data.type === "connected") {
        status.textContent =
          `Ты подключился! Игроков: ${data.players}. Код: ${roomCode}`;
      }

      if (data.type === "players") {
        status.textContent = `Игроков в комнате: ${data.players}`;
      }

      if (data.type === "player-left") {
        status.textContent = "Другой игрок отключился";
      }
    };

    socket.onerror = () => {
      status.textContent = "Ошибка подключения";
    };

    socket.onclose = () => {
      status.textContent = "Соединение закрыто";
    };
  }

  document.getElementById("create-room").onclick = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    connect(code);
    status.textContent = `Код твоей комнаты: ${code}. Отправь его другу!`;
  };

  document.getElementById("join-room").onclick = () => {
    const code = document.getElementById("room-code").value.trim();

    if (!/^\d{6}$/.test(code)) {
      status.textContent = "Введи шестизначный код";
      return;
    }

    connect(code);
  };
})();
