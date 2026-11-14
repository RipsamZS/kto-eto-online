(() => {
  let socket = null;
  let roomCode = null;
  let playerId = null;
  let currentTurn = null;
  let requestCounter = 0;
  let readySent = false;

  const pending = new Map();

  function connect(code) {
    return new Promise((resolve, reject) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${location.host}/room?id=${encodeURIComponent(code)}`
      );

      socket = ws;

      ws.addEventListener("open", () => resolve(), { once: true });

      ws.addEventListener("error", () => {
        reject(new Error("Не удалось подключиться к серверу."));
      }, { once: true });

      ws.addEventListener("message", event => {
        if (socket !== ws) return;

        let message;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.ackId) {
          const callback = pending.get(String(message.ackId));

          if (callback) {
            pending.delete(String(message.ackId));
            callback(message.result || { ok: false });
          }

          return;
        }

        if (message.event === "connected") {
          playerId = message.data?.playerId || null;
          return;
        }

        handleServerEvent(message.event, message.data || {});
      });

      ws.addEventListener("close", () => {
        if (socket !== ws) return;

        pending.forEach(callback => {
          callback({
            ok: false,
            message: "Соединение закрыто."
          });
        });

        pending.clear();

        socket = null;
        currentTurn = null;

        if (roomCode) {
          setStatus("Соединение с комнатой потеряно.");
          roomCode = null;
          playerId = null;
          readySent = false;
          window.onlineRoomActive = false;
        }
      });
    });
  }

  function send(event, data = {}) {
    return new Promise(resolve => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        resolve({
          ok: false,
          message: "Нет соединения с сервером."
        });
        return;
      }

      const requestId = String(++requestCounter);
      pending.set(requestId, resolve);

      socket.send(JSON.stringify({
        event,
        data,
        requestId
      }));

      setTimeout(() => {
        if (pending.has(requestId)) {
          pending.delete(requestId);

          resolve({
            ok: false,
            message: "Сервер не ответил. Попробуй ещё раз."
          });
        }
      }, 10000);
    });
  }

  function setStatus(message) {
    const el = document.getElementById("onlineStatus");
    if (el) el.textContent = message;
  }

  function showPanel() {
    let panel = document.getElementById("onlineGamePanel");

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "onlineGamePanel";

      panel.style.cssText = `
        background:linear-gradient(135deg,#202b43,#29234c);
        color:white;
        padding:18px;
        border:1px solid #a58af0;
        border-radius:18px;
        margin:15px auto;
        max-width:1100px;
        font-family:Arial,sans-serif;
        box-shadow:0 8px 30px #0004;
      `;

      panel.innerHTML = `
        <h3 style="margin:0 0 15px">🌐 Онлайн-игра</h3>

        <div style="
          background:#ffffff0c;
          border:2px solid #a58af0;
          border-radius:15px;
          padding:14px;
          text-align:center;
          margin-bottom:14px;
        ">
          <div style="
            font-size:12px;
            color:#c9c0f4;
            margin-bottom:6px;
          ">КОД КОМНАТЫ</div>

          <div id="onlineRoomCode" style="
            font-size:30px;
            font-weight:bold;
            letter-spacing:7px;
            color:#ffe477;
            margin-bottom:10px;
          "></div>

          <button
            id="onlineCopyCode"
            type="button"
            class="small"
          >📋 Скопировать код</button>
        </div>

        <p id="onlineStatus" style="text-align:center">
          Подключение...
        </p>

        <p
          id="onlineTurn"
          style="text-align:center;font-weight:bold"
        ></p>

        <div id="onlineAction"></div>

        <div style="text-align:center;margin-top:12px">
          <button
            id="onlineLeave"
            class="secondary"
            type="button"
          >Выйти из комнаты</button>
        </div>
      `;

      const game = document.getElementById("game");

      if (game) {
        game.insertBefore(panel, game.children[1] || null);
      }

      const leaveButton = document.getElementById("onlineLeave");

      if (leaveButton) {
        leaveButton.addEventListener("click", leaveRoom);
      }

      const copyButton = document.getElementById("onlineCopyCode");

      if (copyButton) {
        copyButton.addEventListener("click", copyRoomCode);
      }
    }

    const codeElement = document.getElementById("onlineRoomCode");

    if (codeElement) {
      codeElement.textContent = roomCode || "";
    }
  }

  async function copyRoomCode() {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      setStatus("Код комнаты скопирован!");
    } catch {
      const input = document.createElement("textarea");
      input.value = roomCode;
      document.body.appendChild(input);
      input.select();

      try {
        document.execCommand("copy");
        setStatus("Код комнаты скопирован!");
      } catch {
        setStatus("Не удалось скопировать код. Запиши его вручную.");
      }

      input.remove();
    }
  }

  function showAction(html) {
    const el = document.getElementById("onlineAction");
    if (el) el.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showMyTurnActions() {
    showAction(`
      <div style="text-align:center">
        <p><strong>Твой ход!</strong></p>
        <button id="onlineAskButton" type="button">
          ❓ Задать вопрос
        </button>
        <p class="note">
          Чтобы угадать персонажа, нажми правой кнопкой мыши
          на его карточку или удерживай карточку на телефоне.
        </p>
      </div>
    `);

    const askButton = document.getElementById("onlineAskButton");

    if (askButton) {
      askButton.onclick = async () => {
        const question = prompt(
          "Задай вопрос сопернику. Например: «Твой персонаж человек?»"
        );

        if (question === null) return;

        const value = question.trim();

        if (!value) {
          alert("Введи вопрос.");
          return;
        }

        await askQuestion(value);
      };
    }
  }

  function handleServerEvent(event, data) {
    if (event === "player-joined") {
      setStatus(
        readySent
          ? "Второй игрок подключился. Ожидаем его готовности."
          : "Второй игрок подключился. Выберите персонажа."
      );
    }

    if (event === "player-ready") {
      setStatus("Соперник выбрал персонажа.");
    }

    if (event === "online-start") {
      setStatus("Игра началась!");
    }

    if (event === "online-turn") {
      currentTurn = data.currentTurn || null;

      const myTurn = currentTurn === playerId;
      const turnElement = document.getElementById("onlineTurn");

      if (turnElement) {
        turnElement.textContent = myTurn
          ? "⭐ Твой ход"
          : "Ход соперника";
      }

      if (myTurn) {
        setStatus("Твой ход. Задай вопрос или угадай персонажа.");
        showMyTurnActions();
      } else {
        setStatus("Сейчас ход соперника.");
        showAction("");
      }
    }

    if (event === "online-question") {
      setStatus("Соперник задал вопрос.");

      showAction(`
        <div style="text-align:center">
          <p><strong>${escapeHtml(data.question || "Вопрос")}</strong></p>

          <div style="display:flex;gap:8px;justify-content:center">
            <button id="answerYes" type="button">Да</button>
            <button id="answerNo" type="button">Нет</button>
          </div>
        </div>
      `);

      const yes = document.getElementById("answerYes");
      const no = document.getElementById("answerNo");

      if (yes) yes.onclick = () => answerQuestion(true);
      if (no) no.onclick = () => answerQuestion(false);
    }

    if (event === "online-answer") {
      setStatus(
        data.answer
          ? "Соперник ответил: Да."
          : "Соперник ответил: Нет."
      );

      showAction("");
    }

    if (event === "online-guess-result") {
      if (data.correct) {
        setStatus("🎉 Ты угадал персонажа!");
      } else {
        setStatus("Не угадал! Теперь ход соперника.");
      }

      showAction("");
    }

    if (event === "online-ended") {
      currentTurn = null;

      if (data.winnerId === playerId) {
        setStatus("🏆 Победа! Ты угадал персонажа!");
      } else {
        setStatus("Игра окончена. Соперник угадал твоего персонажа.");
      }

      showAction("");
    }

    if (event === "player-left") {
      setStatus("Соперник покинул комнату.");
      currentTurn = null;
      showAction("");
    }
  }

  async function answerQuestion(answer) {
    const result = await send("answer-question", { answer });

    if (!result.ok) {
      setStatus(result.message || "Не удалось отправить ответ.");
    } else {
      showAction("");
      setStatus("Ответ отправлен.");
    }
  }

  async function createRoom(pack) {
    if (!pack || !Array.isArray(pack.characters) || pack.characters.length < 2) {
      alert("В паке должно быть хотя бы два персонажа.");
      return { ok: false };
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    try {
      await connect(code);

      const result = await send("create-room", { pack });

      if (!result || !result.ok) {
        alert(result?.message || "Не удалось создать комнату.");

        if (socket) socket.close();

        return { ok: false };
      }

      roomCode = code;
      readySent = false;
      currentTurn = null;
      window.onlineRoomActive = true;

      showPanel();

      setStatus("Комната создана. Отправь код другу и выбери персонажа.");

      return {
        ok: true,
        code
      };
    } catch (error) {
      alert(error.message || "Ошибка подключения.");
      return { ok: false };
    }
  }

  async function joinRoom(code) {
    code = String(code).trim();

    if (!/^\d{6}$/.test(code)) {
      alert("Код должен состоять из 6 цифр.");
      return { ok: false };
    }

    try {
      await connect(code);

      const result = await send("join-room");

      if (!result || !result.ok) {
        alert(result?.message || "Не удалось войти в комнату.");

        if (socket) socket.close();

        return { ok: false };
      }

      roomCode = code;
      readySent = false;
      currentTurn = null;
      window.onlineRoomActive = true;
      window.onlinePack = result.pack;

      showPanel();
      setStatus("Вы подключились к комнате. Выберите персонажа.");

      document.dispatchEvent(
        new CustomEvent("online-pack-received", {
          detail: result.pack
        })
      );

      return { ok: true };
    } catch (error) {
      alert(error.message || "Ошибка подключения.");
      return { ok: false };
    }
  }

  async function playerReady(secretCharacterId) {
    if (!window.onlineRoomActive || readySent) return;

    if (!secretCharacterId) {
      setStatus("Сначала выбери персонажа.");
      return;
    }

    readySent = true;

    const result = await send("player-ready", {
      secretCharacterId
    });

    if (!result.ok) {
      readySent = false;
      setStatus(result.message || "Не удалось подтвердить готовность.");
    } else if (result.waiting) {
      setStatus("Ты готов! Ожидаем готовности соперника.");
    } else {
      setStatus("Вы оба готовы. Игра начинается!");
    }
  }

  async function askQuestion(question) {
    if (!isMyTurn()) {
      setStatus("Сейчас не твой ход.");
      return;
    }

    const value = String(question || "").trim();

    if (!value) return;

    const result = await send("ask-question", {
      question: value
    });

    if (!result.ok) {
      setStatus(result.message || "Не удалось отправить вопрос.");
    } else {
      setStatus("Ожидаем ответ соперника.");
      showAction("");
    }
  }

  async function makeGuess(guessId) {
    if (!isMyTurn()) {
      setStatus("Сейчас не твой ход.");
      return;
    }

    const result = await send("make-guess", {
      guessId: String(guessId)
    });

    if (!result.ok) {
      setStatus(result.message || "Не удалось отправить догадку.");
    }
  }

  function isMyTurn() {
    return !!(
      window.onlineRoomActive &&
      playerId &&
      currentTurn &&
      currentTurn === playerId
    );
  }

  function leaveRoom() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        event: "leave-room",
        data: {}
      }));

      socket.close();
    }

    socket = null;
    roomCode = null;
    playerId = null;
    currentTurn = null;
    readySent = false;
    window.onlineRoomActive = false;

    pending.forEach(callback => {
      callback({
        ok: false,
        message: "Вы вышли из комнаты."
      });
    });

    pending.clear();

    const panel = document.getElementById("onlineGamePanel");

    if (panel) {
      panel.remove();
    }
  }

  window.onlineGame = {
    createRoom,
    joinRoom,
    playerReady,
    askQuestion,
    makeGuess,
    isMyTurn,
    leaveRoom
  };
})();
