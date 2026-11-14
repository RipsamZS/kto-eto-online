
(() => {
  let socket = null;
  let roomCode = null;
  let playerId = null;
  let currentTurn = null;
  let requestCounter = 0;
  let readySent = false;
  let opponentConnected = false;
  let opponentReady = false;

  const pending = new Map();

  function dispatchState() {
    document.dispatchEvent(new CustomEvent("online-state-change", {
      detail: {
        opponentConnected,
        opponentReady,
        readySent
      }
    }));
  }

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
          opponentConnected = false;
          opponentReady = false;
          window.onlineRoomActive = false;
          dispatchState();
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
        background:#202b3d;
        color:white;
        padding:16px;
        border-radius:16px;
        margin:15px auto;
        max-width:1100px;
        font-family:Arial,sans-serif;
        border:1px solid #ffffff25;
      `;

      panel.innerHTML = `
        <h3 style="margin-top:0">🌐 Онлайн-игра</h3>

        <div style="
          max-width:350px;
          margin:12px auto;
          padding:14px 18px;
          text-align:center;
          border:2px solid #a98aff;
          border-radius:15px;
          background:linear-gradient(135deg,#7654d933,#a04de022);
          box-shadow:0 0 20px #9870ff33;
        ">
          <div style="font-size:12px;color:#d4c8ff;margin-bottom:6px">
            КОД КОМНАТЫ
          </div>
          <div id="onlineRoomCode" style="
            font-size:30px;
            font-weight:bold;
            letter-spacing:7px;
            color:#ffe477;
          "></div>
          <div style="font-size:12px;color:#c6c1e5;margin-top:6px">
            Отправь код другу
          </div>
        </div>

        <p id="onlineStatus" style="text-align:center">
          Подключение...
        </p>

        <p id="onlineTurn" style="
          text-align:center;
          font-weight:bold;
        "></p>

        <div id="onlineAction" style="text-align:center"></div>

        <div style="text-align:center;margin-top:12px">
          <button id="onlineLeave" class="secondary" type="button">
            Выйти из комнаты
          </button>
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
    }

    const codeElement = document.getElementById("onlineRoomCode");

    if (codeElement) {
      codeElement.textContent = roomCode || "";
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
      <p><strong>Твой ход!</strong></p>

      <div style="
        display:flex;
        gap:8px;
        justify-content:center;
        flex-wrap:wrap;
        margin:12px 0;
      ">
        <input
          id="onlineQuestionInput"
          type="text"
          maxlength="250"
          placeholder="Например: Твой персонаж человек?"
          style="
            flex:1;
            min-width:200px;
            max-width:450px;
            padding:12px;
            border-radius:10px;
            border:1px solid #777;
            background:#211e42;
            color:white;
          "
        >

        <button id="onlineAskButton" type="button">
          ❓ Отправить вопрос
        </button>
      </div>

      <p class="note">
        Чтобы угадать персонажа, нажми правой кнопкой мыши на его карточку
        или удерживай карточку на телефоне.
      </p>
    `);

    const askButton = document.getElementById("onlineAskButton");
    const input = document.getElementById("onlineQuestionInput");

    if (askButton && input) {
      const submit = async () => {
        const value = input.value.trim();

        if (!value) {
          setStatus("Сначала введи вопрос.");
          return;
        }

        await askQuestion(value);
      };

      askButton.onclick = submit;

      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          submit();
        }
      });
    }
  }

  function handleServerEvent(event, data) {
    if (event === "player-joined") {
      opponentConnected = true;
      opponentReady = false;

      setStatus("Второй игрок подключился! Теперь можно выбрать персонажа.");
      dispatchState();

      document.dispatchEvent(new CustomEvent("online-opponent-connected"));
    }

    if (event === "player-ready") {
      opponentReady = true;
      setStatus("Соперник выбрал персонажа. Ожидаем твоего выбора.");
      dispatchState();
    }

    if (event === "online-start") {
      setStatus("Оба игрока выбрали персонажей. Игра началась!");
    }

    if (event === "online-turn") {
      currentTurn = data.currentTurn || null;

      const myTurn = currentTurn === playerId;
      const turnElement = document.getElementById("onlineTurn");

      if (turnElement) {
        turnElement.textContent = myTurn ? "Ваш ход" : "Ход соперника";
      }

      if (myTurn) {
        setStatus("Твой ход. Задай вопрос или попробуй угадать персонажа.");
        showMyTurnActions();
      } else {
        setStatus("Сейчас ход соперника. Ожидаем его действие.");
        showAction("");
      }
    }

    if (event === "online-question") {
      setStatus("Соперник задал вопрос.");

      showAction(`
        <p><strong>${escapeHtml(data.question || "Вопрос")}</strong></p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button id="answerYes" type="button">Да</button>
          <button id="answerNo" type="button">Нет</button>
        </div>
      `);

      const yes = document.getElementById("answerYes");
      const no = document.getElementById("answerNo");

      if (yes) yes.onclick = () => answerQuestion(true);
      if (no) no.onclick = () => answerQuestion(false);
    }

    if (event === "online-answer") {
      setStatus(
        "Ответ на ваш вопрос: " + (data.answer ? "Да" : "Нет")
      );

      showAction("");
    }

    if (event === "online-guess-result") {
      setStatus(
        data.correct
          ? "Победа! Ты угадал персонажа!"
          : "Неверная догадка. Теперь ход соперника."
      );

      showAction("");
    }

    if (event === "online-guess-made") {
      setStatus(
        data.correct
          ? "Соперник угадал твоего персонажа!"
          : "Соперник не угадал. Теперь твой ход."
      );

      showAction("");
    }

    if (event === "online-ended") {
      setStatus(data.message || "Игра окончена.");
      currentTurn = null;
      showAction("");
    }

    if (event === "player-left") {
      opponentConnected = false;
      opponentReady = false;
      readySent = false;
      currentTurn = null;

      setStatus("Соперник покинул комнату. Ожидаем нового игрока.");
      showAction("");
      dispatchState();

      document.dispatchEvent(new CustomEvent("online-opponent-left"));
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
      setStatus("В паке должно быть хотя бы два персонажа.");
      return { ok: false };
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    try {
      await connect(code);

      const result = await send("create-room", { pack });

      if (!result || !result.ok) {
        setStatus(result?.message || "Не удалось создать комнату.");

        if (socket) socket.close();

        return { ok: false };
      }

      roomCode = code;
      readySent = false;
      opponentConnected = false;
      opponentReady = false;
      currentTurn = null;
      window.onlineRoomActive = true;

      showPanel();
      setStatus("Комната создана! Отправь код другу. Выбор персонажа откроется после его подключения.");

      dispatchState();

      return {
        ok: true,
        code
      };
    } catch (error) {
      setStatus(error.message || "Ошибка подключения.");
      return { ok: false };
    }
  }

  async function joinRoom(code) {
    code = String(code).trim();

    if (!/^\d{6}$/.test(code)) {
      setStatus("Код должен состоять из 6 цифр.");
      return { ok: false };
    }

    try {
      await connect(code);

      const result = await send("join-room");

      if (!result || !result.ok) {
        setStatus(result?.message || "Не удалось войти в комнату.");

        if (socket) socket.close();

        return { ok: false };
      }

      roomCode = code;
      readySent = false;
      opponentConnected = true;
      opponentReady = false;
      currentTurn = null;
      window.onlineRoomActive = true;
      window.onlinePack = result.pack;

      showPanel();
      setStatus("Вы подключились к комнате. Выберите персонажа.");

      dispatchState();

      document.dispatchEvent(
        new CustomEvent("online-pack-received", {
          detail: result.pack
        })
      );

      return { ok: true };
    } catch (error) {
      setStatus(error.message || "Ошибка подключения.");
      return { ok: false };
    }
  }

  async function playerReady(secretCharacterId) {
    if (!window.onlineRoomActive || readySent) {
      return { ok: false };
    }

    if (!opponentConnected) {
      setStatus("Подожди, пока подключится второй игрок.");
      return { ok: false };
    }

    if (!secretCharacterId) {
      setStatus("Сначала выбери персонажа.");
      return { ok: false };
    }

    readySent = true;
    dispatchState();

    const result = await send("player-ready", {
      secretCharacterId: String(secretCharacterId)
    });

    if (!result.ok) {
      readySent = false;
      setStatus(result.message || "Не удалось подтвердить готовность.");
      dispatchState();
      return result;
    }

    if (result.waiting) {
      setStatus("Ты готов! Ожидаем выбора персонажа соперником.");
    } else {
      setStatus("Вы оба готовы. Игра начинается!");
    }

    return result;
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

    const value = String(guessId || "").trim();

    if (!value) return;

    const result = await send("make-guess", {
      guessId: value
    });

    if (!result.ok) {
      setStatus(result.message || "Не удалось отправить догадку.");
    } else {
      setStatus(
        result.correct
          ? "Ты угадал персонажа!"
          : "Неверная догадка. Теперь ход соперника."
      );

      showAction("");
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

  function canChooseCharacter() {
    return !!(
      window.onlineRoomActive &&
      opponentConnected &&
      !readySent
    );
  }

  function getRoomCode() {
    return roomCode;
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
    opponentConnected = false;
    opponentReady = false;
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

    dispatchState();
  }

  window.onlineGame = {
    createRoom,
    joinRoom,
    playerReady,
    askQuestion,
    makeGuess,
    isMyTurn,
    canChooseCharacter,
    getRoomCode,
    leaveRoom
  };
})();
