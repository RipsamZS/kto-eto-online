
(() => {
  let socket = null;
  let roomCode = null;
  let playerId = null;
  let requestCounter = 0;
  const pending = new Map();

  function connect(code) {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${location.host}/room?id=${encodeURIComponent(code)}`
      );

      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Не удалось подключиться.")), { once: true });

      socket.addEventListener("message", event => {
        let message;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.ackId) {
          const item = pending.get(message.ackId);
          if (item) {
            pending.delete(message.ackId);
            item(message.result);
          }
          return;
        }

        if (message.event === "connected") {
          playerId = message.data.playerId;
          return;
        }

        handleServerEvent(message.event, message.data || {});
      });

      socket.addEventListener("close", () => {
        pending.forEach(resolve => resolve({
          ok: false,
          message: "Соединение закрыто."
        }));
        pending.clear();

        if (roomCode) {
          setStatus("Соединение потеряно.");
          roomCode = null;
        }
      });
    });
  }

  function send(event, data = {}) {
    return new Promise(resolve => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        resolve({ ok: false, message: "Нет соединения с сервером." });
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
          resolve({ ok: false, message: "Сервер не ответил." });
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
      panel.style.cssText = "background:#202b3d;color:white;padding:16px;border-radius:12px;margin:15px 0;font-family:Arial";

      panel.innerHTML = `
        <h3>🌐 Онлайн-игра</h3>
        <p id="onlineStatus">Подключение...</p>
        <p>Код комнаты: <strong id="onlineRoomCode"></strong></p>
        <p id="onlineTurn"></p>
        <div id="onlineAction"></div>
        <div id="onlineLog" style="max-height:150px;overflow:auto;margin:10px 0"></div>
        <button id="onlineLeave" type="button">Выйти из комнаты</button>
      `;

      const game = document.getElementById("game");
      if (game) game.prepend(panel);

      document.getElementById("onlineLeave").onclick = leaveRoom;
    }

    document.getElementById("onlineRoomCode").textContent = roomCode || "";
  }

  function showAction(html) {
    const el = document.getElementById("onlineAction");
    if (el) el.innerHTML = html;
  }

  function handleServerEvent(event, data) {
    if (event === "player-joined") {
      setStatus("Второй игрок подключился. Выберите персонажа.");
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
      const myTurn = data.currentTurn === playerId;
      const el = document.getElementById("onlineTurn");
      if (el) el.textContent = myTurn ? "Ваш ход" : "Ход соперника";
    }

    if (event === "online-question") {
      setStatus("Соперник задал вопрос.");
      addLog("Вопрос соперника: " + data.question);

      showAction(`
        <p>${escapeHtml(data.question)}</p>
        <button id="answerYes" type="button">Да</button>
        <button id="answerNo" type="button">Нет</button>
      `);

      document.getElementById("answerYes").onclick = () => answerQuestion(true);
      document.getElementById("answerNo").onclick = () => answerQuestion(false);
    }

    if (event === "online-answer") {
      addLog("Ответ на ваш вопрос: " + (data.answer ? "Да" : "Нет"));
      setStatus("Получен ответ.");
      showAction("");
    }

    if (event === "online-guess") {
      setStatus("Соперник пытается угадать персонажа.");
      addLog("Догадка соперника: " + data.guess);

      showAction(`
        <p>Соперник угадывает: <strong>${escapeHtml(data.guess)}</strong></p>
        <button id="guessYes" type="button">Угадал</button>
        <button id="guessNo" type="button">Не угадал</button>
      `);

      document.getElementById("guessYes").onclick = () => answerGuess(true);
      document.getElementById("guessNo").onclick = () => answerGuess(false);
    }

    if (event === "online-guess-result") {
      addLog(data.correct ? "Вы угадали персонажа!" : "Вы не угадали.");
      setStatus(data.correct ? "Победа!" : "Неверная догадка.");
      showAction("");
    }

    if (event === "online-ended") {
      setStatus(data.message || "Игра окончена.");
      addLog("Игра завершена.");
      showAction("");
    }

    if (event === "player-left") {
      setStatus("Соперник покинул комнату.");
      addLog("Соперник отключился.");
    }
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

  async function answerQuestion(answer) {
    const result = await send("answer-question", { answer });
    if (!result.ok) setStatus(result.message);
    else showAction("");
  }

  async function answerGuess(correct) {
    const result = await send("answer-guess", { correct });
    if (!result.ok) setStatus(result.message);
    else showAction("");
  }

  async function createRoom(pack) {
    if (!pack || !Array.isArray(pack.characters)) {
      alert("Не удалось получить набор персонажей.");
      return { ok: false };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    try {
      await connect(code);
      const result = await send("create-room", { pack });

      if (!result.ok) {
        alert(result.message);
        socket.close();
        return { ok: false };
      }

      roomCode = code;
      showPanel();
      setStatus("Комната создана. Ожидаем второго игрока.");

      return { ok: true, code };
    } catch (error) {
      alert(error.message);
      return { ok: false };
    }
}

  async function playerReady() {
    const result = await send("player-ready");
    if (!result.ok) setStatus(result.message);
    else setStatus("Вы готовы. Ожидаем соперника.");
  }

  async function askQuestion(question) {
    const result = await send("ask-question", { question });
    if (!result.ok) setStatus(result.message);
    else {
      addLog("Вы спросили: " + question);
      setStatus("Ожидаем ответ соперника.");
    }
  }

  async function makeGuess(guess) {
    const result = await send("make-guess", { guess });
    if (!result.ok) setStatus(result.message);
    else {
      addLog("Ваша догадка: " + guess);
      setStatus("Ожидаем ответ соперника.");
    }
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

    const panel = document.getElementById("onlineGamePanel");
    if (panel) panel.remove();
  }

  window.onlineGame = {
    createRoom,
    joinRoom,
    playerReady,
    askQuestion,
    makeGuess,
    leaveRoom
  };
})();
