
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

  function addLog(message) {
    const el = document.getElementById("onlineLog");
    if (!el) return;

    const line = document.createElement("div");
    line.textContent = message;

    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
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
        border-radius:12px;
        margin:15px auto;
        max-width:1100px;
        font-family:Arial,sans-serif;
      `;

      panel.innerHTML = `
        <h3>🌐 Онлайн-игра</h3>
        <p id="onlineStatus">Подключение...</p>
        <p>Код комнаты: <strong id="onlineRoomCode"></strong></p>
        <p id="onlineTurn"></p>
        <div id="onlineAction"></div>
        <div
          id="onlineLog"
          style="max-height:150px;overflow:auto;margin:10px 0;padding:8px;background:#ffffff10;border-radius:8px"
        ></div>
        <button id="onlineLeave" class="secondary" type="button">
          Выйти из комнаты
        </button>
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
      <p><strong>Твой ход. Что хочешь сделать?</strong></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="onlineAskButton" type="button">❓ Задать вопрос</button>
        <button id="onlineGuessButton" type="button">🎯 Угадать персонажа</button>
      </div>
      <p class="note">Для угадывания нажми правой кнопкой мыши на карточку или удерживай её на телефоне.</p>
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

    const guessButton = document.getElementById("onlineGuessButton");

    if (guessButton) {
      guessButton.onclick = () => {
        setStatus("Выбери карточку персонажа правой кнопкой мыши или удержанием.");
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

      addLog("Второй игрок вошёл в комнату.");
    }

    if (event === "player-ready") {
      addLog("Соперник выбрал персонажа.");
    }

    if (event === "online-start") {
      setStatus("Игра началась!");
      addLog("Оба игрока готовы.");
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
      addLog("Вопрос соперника: " + data.question);

      showAction(`
        <p><strong>${escapeHtml(data.question || "Вопрос")}</strong></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
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
      addLog(
        "Ответ на ваш вопрос: " +
        (data.answer ? "Да" : "Нет")
      );

      setStatus("Получен ответ от соперника.");
      showAction("");
    }

    if (event === "online-guess") {
      setStatus("Соперник пытается угадать персонажа.");
      addLog("Догадка соперника: " + data.guess);

      showAction(`
        <p>Соперник угадывает: <strong>${escapeHtml(data.guess || "")}</strong></p>
        <p>Это твой загаданный персонаж?</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="guessYes" type="button">Угадал</button>
          <button id="guessNo" type="button">Не угадал</button>
        </div>
      `);

      const yes = document.getElementById("guessYes");
      const no = document.getElementById("guessNo");

      if (yes) yes.onclick = () => answerGuess(true);
      if (no) no.onclick = () => answerGuess(false);
    }

    if (event === "online-guess-result") {
      addLog(
        data.correct
          ? "Вы угадали персонажа!"
          : "Вы не угадали."
      );

      setStatus(
        data.correct ? "Победа! Вы угадали персонажа." : "Догадка неверная."
      );

      showAction("");
    }

    if (event === "online-ended") {
      setStatus(data.message || "Игра окончена.");
      addLog("Игра завершена.");
      currentTurn = null;
      showAction("");
    }

    if (event === "player-left") {
      setStatus("Соперник покинул комнату.");
      addLog("Соперник отключился.");
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

  async function answerGuess(correct) {
    const result = await send("answer-guess", { correct });

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
      setStatus("Комната создана. Отправь код другу и выбери своего персонажа.");

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

  async function playerReady() {
    if (!window.onlineRoomActive || readySent) return;

    readySent = true;

    const result = await send("player-ready");

    if (!result.ok) {
      readySent = false;
      setStatus(result.message || "Не удалось подтвердить готовность.");
    } else if (result.waiting) {
      setStatus("Вы готовы. Ожидаем подключения и готовности соперника.");
    } else {
      setStatus("Вы готовы. Ожидаем начала игры.");
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
      addLog("Вы спросили: " + value);
      setStatus("Ожидаем ответ соперника.");
      showAction("");
    }
  }

  async function makeGuess(guess) {
    if (!isMyTurn()) {
      setStatus("Сейчас не твой ход.");
      return;
    }

    const value = String(guess || "").trim();

    if (!value) return;

    const result = await send("make-guess", {
      guess: value
    });

    if (!result.ok) {
      setStatus(result.message || "Не удалось отправить догадку.");
    } else {
      addLog("Ваша догадка: " + value);
      setStatus("Ожидаем ответ соперника.");
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
