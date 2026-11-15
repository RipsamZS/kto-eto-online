
(() => {
  "use strict";

  const API = {
    socket: null,
    roomCode: null,
    gameId: "who-is-it",
    playerId: null,
    currentTurn: null,
    opponentConnected: false,
    opponentReady: false,
    readySent: false,
    roomActive: false,
    roomSettings: null,
    pack: null,
    requestCounter: 0,
    pending: new Map(),
    timerInterval: null,
    timerDeadline: null,
    connectedPromise: null,
    intentionalLeave: false,
    isRoomHost: false
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function getSocketUrl(code, gameId = "who-is-it") {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/room?id=${encodeURIComponent(code)}&game=${encodeURIComponent(gameId)}`;
  }

  function randomRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function setStatus(message) {
    const element = document.getElementById("onlineStatus");
    if (element) element.textContent = message;
  }

  function setTimerDisplay(text) {
    const element = document.getElementById("onlineTimer");
    if (element) element.textContent = text;
  }

  function updateRoomCodeDisplay() {
    const code = API.roomCode;
    if (!code) return;

    const value = document.getElementById("onlineRoomCodeValue");
    const frame = document.getElementById("onlineRoomCodeFrame");

    if (value) value.textContent = code;
    if (frame) frame.style.display = "block";

    const pickerValue = document.getElementById("pickerRoomCodeValue");
    const pickerFrame = document.getElementById("pickerRoomCode");

    if (pickerValue) pickerValue.textContent = code;
    if (pickerFrame) pickerFrame.style.display = "block";
  }

  function clearTimer() {
    if (API.timerInterval) {
      clearInterval(API.timerInterval);
      API.timerInterval = null;
    }

    API.timerDeadline = null;
    setTimerDisplay("Без ограничения времени");
  }

  function startTimer(deadline, seconds) {
    clearTimer();

    if (!seconds || seconds <= 0 || !deadline) {
      setTimerDisplay("Без ограничения времени");
      return;
    }

    API.timerDeadline = deadline;

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((API.timerDeadline - Date.now()) / 1000)
      );

      const minutes = Math.floor(remaining / 60);
      const secs = remaining % 60;

      setTimerDisplay(
        `⏱ Осталось: ${minutes}:${String(secs).padStart(2, "0")}`
      );

      if (remaining <= 0 && API.timerInterval) {
        clearInterval(API.timerInterval);
        API.timerInterval = null;
        setTimerDisplay("⏱ Время вышло");
      }
    };

    update();
    API.timerInterval = setInterval(update, 250);
  }

  function clearPending(message = "Соединение закрыто.") {
    for (const [, item] of API.pending) {
      clearTimeout(item.timeout);
      item.resolve({
        ok: false,
        message
      });
    }

    API.pending.clear();
  }

  function send(event, data = {}) {
    if (
      !API.socket ||
      API.socket.readyState !== WebSocket.OPEN
    ) {
      return Promise.resolve({
        ok: false,
        message: "Нет соединения с комнатой."
      });
    }

    const requestId = String(++API.requestCounter);

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        API.pending.delete(requestId);

        resolve({
          ok: false,
          message: "Сервер не ответил вовремя."
        });
      }, 12000);

      API.pending.set(requestId, {
        resolve,
        timeout
      });

      try {
        API.socket.send(JSON.stringify({
          event,
          data,
          requestId
        }));
      } catch {
        clearTimeout(timeout);
        API.pending.delete(requestId);

        resolve({
          ok: false,
          message: "Не удалось отправить запрос."
        });
      }
    });
  }

  function resetConnectionState() {
    clearTimer();
    clearPending();

    API.socket = null;
    API.roomCode = null;
    API.playerId = null;
    API.currentTurn = null;
    API.opponentConnected = false;
    API.opponentReady = false;
    API.readySent = false;
    API.roomActive = false;
    API.roomSettings = null;
    API.pack = null;
    API.isRoomHost = false;
    API.connectedPromise = null;

    window.onlineRoomActive = false;

    dispatch("online-state-change");
  }

  function handleMessage(message) {
    if (!message || typeof message !== "object") return;

    if (message.ackId) {
      const pending = API.pending.get(String(message.ackId));

      if (pending) {
        clearTimeout(pending.timeout);
        API.pending.delete(String(message.ackId));

        const result = message.result || {
          ok: false,
          message: "Пустой ответ сервера."
        };

        pending.resolve(result);
      }

      return;
    }

    const event = message.event;
    const data = message.data || {};

    switch (event) {
      case "connected": {
        API.playerId = data.playerId || null;

        dispatch("online-connected", data);
        break;
      }

      case "player-joined": {
        API.opponentConnected = true;

        setStatus("Соперник подключился. Теперь оба игрока могут выбрать персонажей.");

        dispatch("online-opponent-connected", data);
        dispatch("online-state-change");
        break;
      }

      case "player-ready": {
        API.opponentReady = true;

        setStatus("Соперник выбрал персонажа. Ожидаем начала игры.");

        dispatch("online-opponent-ready", data);
        dispatch("online-state-change");
        break;
      }

      case "online-start": {
        API.currentTurn = null;

        setStatus("Оба игрока готовы. Игра начинается!");

        dispatch("online-start", data);
        dispatch("online-state-change");
        break;
      }

      case "online-turn": {
        API.currentTurn = data.currentTurn || null;

        startTimer(
          data.deadline,
          Number(data.timerSeconds || 0)
        );

        const myTurn = isMyTurn();

        setStatus(
          myTurn
            ? "Твой ход! Задай вопрос или попробуй угадать персонажа."
            : "Ход соперника. Ожидай его вопрос."
        );

        dispatch("online-turn", {
          ...data,
          isMyTurn: myTurn
        });

        dispatch("online-state-change");
        break;
      }

      case "turn-timeout": {
        API.currentTurn = data.currentTurn || null;

        clearTimer();

        setStatus(
          data.message ||
          "Время на ход закончилось. Ход переходит сопернику."
        );

        dispatch("online-turn-timeout", data);
        dispatch("online-state-change");
        break;
      }

      case "online-question": {
        setStatus("Соперник задал вопрос. Ответь на него.");

        dispatch("online-question", data);
        break;
      }

      case "online-answer": {
        setStatus(
          data.answer
            ? "Соперник ответил: Да."
            : "Соперник ответил: Нет."
        );

        dispatch("online-answer", data);
        break;
      }

      case "online-guess-result": {
        dispatch("online-guess-result", data);
        break;
      }

      case "online-guess-made": {
        dispatch("online-guess-made", data);
        break;
      }

      case "online-ended": {
        API.currentTurn = null;
        clearTimer();

        setStatus(data.message || "Игра завершена.");

        dispatch("online-ended", data);
        dispatch("online-state-change");
        break;
      }

      case "player-left": {
        API.opponentConnected = false;
        API.opponentReady = false;
        API.readySent = false;

        API.currentTurn = null;

        clearTimer();

        setStatus(
          "Соперник покинул комнату. Ожидаем нового игрока."
        );

        dispatch("online-opponent-left", data);
        dispatch("online-state-change");
        break;
      }

      case "room-roster":
      case "room-host-changed": {
        if (event === "room-host-changed") API.isRoomHost = !!data.isHost;
        dispatch(event, data);
        dispatch("online-state-change");
        break;
      }

      case "who-am-i-chat-history":
      case "who-am-i-chat-message":
      case "party-state":
      case "party-private":
      case "party-message":
        dispatch(event, data);
        break;

      case "word-round-reset":
      case "word-round-start":
      case "word-entry-turn":
      case "word-submitted":
      case "word-submission-progress":
      case "your-secret-word":
      case "word-round-complete":
      case "who-am-i-turn":
      case "who-am-i-question":
      case "who-am-i-answer":
      case "who-am-i-guess-result":
      case "who-am-i-finished":
      case "who-am-i-turn-timeout": {
        dispatch(event, data);
        break;
      }

      case "room-settings-updated": {
        API.roomSettings = data;
        dispatch("online-room-settings-updated", data);
        break;
      }

      default:
        dispatch("online-unknown-event", message);
    }
  }

  function connect(code, gameId = "who-is-it") {
    if (API.socket) {
      try {
        API.intentionalLeave = true;
        API.socket.close();
      } catch {}
    }

    clearTimer();
    clearPending();

    API.roomCode = code;
    API.gameId = gameId;
    API.playerId = null;
    API.currentTurn = null;
    API.opponentConnected = false;
    API.opponentReady = false;
    API.readySent = false;
    API.roomActive = false;
    API.roomSettings = null;
    API.pack = null;
    API.isRoomHost = false;
    API.intentionalLeave = false;

    window.onlineRoomActive = false;

    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (success, value) => {
        if (settled) return;
        settled = true;

        if (success) resolve(value);
        else reject(value);
      };

      let socket;

      try {
        socket = new WebSocket(getSocketUrl(code, gameId));
      } catch (error) {
        finish(false, error);
        return;
      }

      API.socket = socket;

      const connectionTimeout = setTimeout(() => {
        finish(false, new Error("Время подключения истекло."));
        try {
          socket.close();
        } catch {}
      }, 12000);

      socket.addEventListener("open", () => {
        setStatus("Соединение установлено. Проверяем комнату.");
      });

      socket.addEventListener("message", event => {
        let message;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        handleMessage(message);

        if (
          message.event === "connected" &&
          message.data?.playerId
        ) {
          clearTimeout(connectionTimeout);
          finish(true, message.data);
        }
      });

      socket.addEventListener("error", () => {
        clearTimeout(connectionTimeout);
        finish(false, new Error("Не удалось подключиться к серверу."));
      });

      socket.addEventListener("close", () => {
        clearTimeout(connectionTimeout);

        if (!settled) {
          finish(false, new Error("Соединение было закрыто."));
        }

        if (!API.intentionalLeave && API.socket === socket) {
          clearTimer();
          clearPending("Соединение с комнатой потеряно.");

          API.roomActive = false;
          window.onlineRoomActive = false;

          setStatus("Соединение с комнатой потеряно.");

          dispatch("online-disconnected");
          dispatch("online-state-change");
        }
      });
    });
  }

  async function createRoom(pack, settings = {}) {
    if (!pack || !Array.isArray(pack.characters)) {
      return {
        ok: false,
        message: "Неверный набор персонажей."
      };
    }

    const characters = pack.characters;

    if (characters.length < 2 || characters.length > 60) {
      return {
        ok: false,
        message: "В паке должно быть от 2 до 60 персонажей."
      };
    }

    const code = String(settings.roomCode || randomRoomCode()).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,16}$/.test(code)) {
      return { ok:false, message:"Код комнаты: от 3 до 16 символов — латинские буквы, цифры, дефис или подчёркивание." };
    }

    try {
      await connect(code, "who-is-it");
    } catch (error) {
      return {
        ok: false,
        message: error.message
      };
    }

    const result = await send("create-room", {
      pack: {
        name: String(pack.name || "Пак").slice(0, 60),
        characters
      },
      settings: {
        roomName: String(settings.roomName || "Комната").slice(0, 50),
        roomCode: code,
        maxPlayers: 2,
        cardCount: Number(settings.cardCount || characters.length),
        timerSeconds: Number(settings.timerSeconds ?? 0),
        access: settings.access === "public" ? "public" : "private"
      }
    });

    if (!result.ok) {
      leaveRoom();
      return result;
    }

    API.roomActive = true;
    API.isRoomHost = true;
    API.pack = pack;
    API.roomSettings = result.settings || settings;

    window.onlineRoomActive = true;

    updateRoomCodeDisplay();

    setStatus(
      "Комната создана. Отправь код другу. Выбор персонажа откроется после его подключения."
    );

    dispatch("online-room-created", {
      code,
      settings: API.roomSettings
    });

    dispatch("online-state-change");

    return {
      ok: true,
      code,
      settings: API.roomSettings
    };
  }

  async function joinRoom(code, gameId = "who-is-it", profile = {}) {
    code = String(code || "").trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,16}$/.test(code)) {
      return { ok:false, message:"Введи код длиной от 3 до 16 символов." };
    }

    try {
      await connect(code, gameId);
    } catch (error) {
      return {
        ok: false,
        message: error.message
      };
    }

    const result = await send("join-room", { profile: { nickname: String(profile.nickname || "Игрок").trim().slice(0,20), avatar: profile.avatar || "🙂" } });

    if (!result.ok) {
      leaveRoom();
      return result;
    }

    API.roomActive = true;
    API.isRoomHost = false;
    API.pack = result.pack;
    API.roomSettings = result.settings || null;
    API.opponentConnected = true;

    window.onlineRoomActive = true;

    updateRoomCodeDisplay();

    dispatch("online-pack-received", result.pack);
    dispatch("online-room-joined", {
      code,
      settings: result.settings || null
    });

    dispatch("online-state-change");

    setStatus("Ты подключился к комнате. Выбери персонажа.");

    return {
      ok: true,
      pack: result.pack,
      settings: result.settings || null
    };
  }

  async function playerReady(secretCharacterId) {
    if (!canChooseCharacter()) {
      return {
        ok: false,
        message: "Подожди, пока подключится второй игрок."
      };
    }

    const result = await send("player-ready", {
      secretCharacterId
    });

    if (result.ok) {
      API.readySent = true;

      setStatus(
        "Персонаж выбран. Ожидаем, пока соперник подтвердит свой выбор."
      );

      dispatch("online-local-ready", {
        secretCharacterId
      });

      dispatch("online-state-change");
    }

    return result;
  }

  async function askQuestion(question) {
    question = String(question || "").trim();

    if (!question) {
      return {
        ok: false,
        message: "Введи вопрос."
      };
    }

    if (!isMyTurn()) {
      return {
        ok: false,
        message: "Сейчас не твой ход."
      };
    }

    return send("ask-question", {
      question
    });
  }

  async function answerQuestion(answer) {
    return send("answer-question", {
      answer: !!answer
    });
  }

  async function makeGuess(guessId) {
    if (!isMyTurn()) {
      return {
        ok: false,
        message: "Сейчас не твой ход."
      };
    }

    return send("make-guess", {
      guessId: String(guessId)
    });
  }

  async function createLobby(settings = {}, gameId = "who-am-i") {
    const code = String(settings.roomCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,16}$/.test(code)) return { ok:false, message:"Код комнаты должен содержать от 3 до 16 символов: латинские буквы, цифры, дефис или подчёркивание." };
    try { await connect(code, gameId); }
    catch (error) { return { ok:false, message:error.message }; }
    const result = await send("create-lobby", { settings:{
      roomCode:code,
      roomName:String(settings.roomName || "Комната").trim().slice(0,50),
      access:settings.access === "public" ? "public" : "private",
      maxPlayers:gameId === "who-is-it" ? 2 : Number(settings.maxPlayers || 2),
      timerSeconds:Number(settings.timerSeconds ?? 0),
      nickname:String(settings.nickname || "Игрок").trim().slice(0,20),
      avatar:settings.avatar || "🙂"
    }});
    if (!result.ok) { leaveRoom(); return result; }
    API.roomActive = true;
    API.isRoomHost = true;
    API.roomSettings = result.settings || settings;
    window.onlineRoomActive = true;
    updateRoomCodeDisplay();
    dispatch("online-room-created",{code,settings:API.roomSettings});
    dispatch("online-state-change");
    return {ok:true,code,settings:API.roomSettings};
  }

  async function updateRoomSettings(settings = {}) {
    const result = await send("update-room-settings",{settings});
    if (result.ok) API.roomSettings = result.settings || settings;
    return result;
  }

  function selectSeat(seatIndex) { return send("select-seat", { seatIndex:Number(seatIndex) }); }
  function startWordRound() { return send("start-word-round"); }
  function submitPlayerWord(word) { return send("submit-player-word", {word}); }
  function askWhoAmIQuestion(question) { return send("who-am-i-question", {question}); }
  function answerWhoAmIQuestion(answer) { return send("who-am-i-answer", {answer}); }
  function guessWhoAmI(guess) { return send("who-am-i-guess", {guess}); }
  function passWhoAmITurn() { return send("who-am-i-pass"); }
  function sendWhoAmIChat(message) { return send("who-am-i-chat", {message:String(message||"").trim().slice(0,300)}); }
  function sendGameAction(action, payload = {}) { return send("party-action", {action, payload}); }
  function startGame() { return send("party-start", {}); }

  async function listPublicRooms(gameId = "who-is-it") {
    try {
      const response = await fetch("/api/public-rooms?game=" + encodeURIComponent(gameId), {
        cache: "no-store"
      });

      if (!response.ok) {
        return {
          ok: false,
          rooms: []
        };
      }

      const rooms = await response.json();

      return {
        ok: true,
        rooms: Array.isArray(rooms) ? rooms : []
      };
    } catch {
      return {
        ok: false,
        rooms: []
      };
    }
  }

  async function listPacks() {
    try {
      const response = await fetch("/api/packs", {
        cache: "no-store"
      });

      if (!response.ok) {
        return {
          ok: false,
          packs: []
        };
      }

      const packs = await response.json();

      return {
        ok: true,
        packs: Array.isArray(packs) ? packs : []
      };
    } catch {
      return {
        ok: false,
        packs: []
      };
    }
  }

  async function publishPack(pack, author) {
    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pack,
          author
        })
      });

      const result = await response.json();

      return {
        ok: response.ok && !!result.ok,
        ...result
      };
    } catch {
      return {
        ok: false,
        message: "Не удалось опубликовать пак."
      };
    }
  }

  async function deletePublishedPack(id) {
    try {
      const response = await fetch(
        "/api/packs/" + encodeURIComponent(id),
        {
          method: "DELETE"
        }
      );

      return {
        ok: response.ok
      };
    } catch {
      return {
        ok: false
      };
    }
  }

  function isMyTurn() {
    return !!(
      API.roomActive &&
      API.playerId &&
      API.currentTurn === API.playerId
    );
  }

  function canChooseCharacter() {
    return !!(
      API.roomActive &&
      API.opponentConnected &&
      !API.readySent &&
      API.socket &&
      API.socket.readyState === WebSocket.OPEN
    );
  }

  function getRoomCode() {
    return API.roomCode;
  }

  function getSettings() {
    return API.roomSettings;
  }

  function isRoomHost() {
    return API.isRoomHost;
  }

  function getPlayerId() {
    return API.playerId;
  }

  function getPack() {
    return API.pack;
  }

  function leaveRoom() {
    if (API.socket) {
      const socket = API.socket;

      API.intentionalLeave = true;

      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({
            event: "leave-room",
            data: {}
          }));
        } catch {}
      }

      try {
        socket.close();
      } catch {}
    }

    resetConnectionState();

    setStatus("Ты покинул комнату.");
    dispatch("online-room-left");
  }

  function createPanel() {
    const existingPanel = document.getElementById("onlineGamePanel");
    if (existingPanel) {
      if (!document.getElementById("onlineRoomCodeFrame")) {
        const codeFrame = document.createElement("div");
        codeFrame.id = "onlineRoomCodeFrame";
        codeFrame.style.cssText = "display:none;padding:12px;margin:8px 0;border:1px solid #a78bfa;border-radius:12px";
        codeFrame.innerHTML = '<div style="font-size:12px;color:#d4c8ff">КОД КОМНАТЫ</div><strong id="onlineRoomCodeValue" style="font-size:24px;letter-spacing:2px"></strong><button id="onlineCopyCodeButton" type="button" class="secondary small" style="margin-left:10px">Скопировать</button>';
        existingPanel.appendChild(codeFrame);
        document.getElementById("onlineCopyCodeButton").onclick = () => {
          if (API.roomCode && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(API.roomCode);
            setStatus("Код комнаты скопирован.");
          }
        };
      }
      if (!document.getElementById("onlineEditRoomButton")) {
        const editButton = document.createElement("button");
        editButton.id = "onlineEditRoomButton";
        editButton.type = "button";
        editButton.className = "secondary small";
        editButton.textContent = "Изменить настройки комнаты";
        editButton.style.cssText = "display:none;margin:10px auto";
        existingPanel.appendChild(editButton);
        const editModal = document.createElement("div");
        editModal.id = "onlineEditRoomModal";
        editModal.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:#080612dd;align-items:center;justify-content:center;padding:16px";
        editModal.innerHTML = `<div style="width:min(440px,100%);padding:22px;border:1px solid #a78bfa;border-radius:18px;background:#1c1732;color:#fff">
          <h3 style="margin-top:0">Настройки комнаты</h3>
          <label>Название</label><input id="onlineEditRoomName" maxlength="50" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30">
          <label>Доступ</label><select id="onlineEditRoomAccess" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
          <label>Время на вопрос</label><select id="onlineEditRoomTimer" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
          <div style="display:flex;gap:8px;margin-top:16px"><button id="onlineSaveRoomSettings" type="button">Сохранить</button><button id="onlineCancelRoomSettings" type="button">Отмена</button></div>
        </div>`;
        document.body.appendChild(editModal);
        editButton.onclick = () => {
          const settings = API.roomSettings || {};
          document.getElementById("onlineEditRoomName").value = settings.roomName || "Комната";
          document.getElementById("onlineEditRoomAccess").value = settings.access || "private";
          document.getElementById("onlineEditRoomTimer").value = String(settings.timerSeconds ?? 60);
          editModal.style.display = "flex";
        };
        document.getElementById("onlineCancelRoomSettings").onclick = () => { editModal.style.display = "none"; };
        document.getElementById("onlineSaveRoomSettings").onclick = async () => {
          const result = await updateRoomSettings({
            roomName: document.getElementById("onlineEditRoomName").value.trim(),
            access: document.getElementById("onlineEditRoomAccess").value,
            timerSeconds: Number(document.getElementById("onlineEditRoomTimer").value),
            maxPlayers: 2
          });
          if (result.ok) editModal.style.display = "none";
          setStatus(result.ok ? "Настройки комнаты сохранены." : (result.message || "Не удалось сохранить настройки."));
        };
      }
      return;
    }

    const panel = document.createElement("div");

    panel.id = "onlineGamePanel";
    panel.style.cssText = [
      "max-width:900px",
      "margin:12px auto",
      "padding:15px",
      "border:1px solid #a98aff",
      "border-radius:16px",
      "background:#ffffff12",
      "text-align:center"
    ].join(";");

    panel.innerHTML = `
      <div id="onlineRoomCodeFrame" class="room-code-frame">
        <div style="font-size:12px;color:#d4c8ff">КОД КОМНАТЫ</div>
        <strong id="onlineRoomCodeValue"></strong>
        <button id="onlineEditRoomButton" class="small secondary" type="button" style="display:none;margin-left:8px">Изменить настройки</button>
        <button id="onlineCopyCodeButton" class="small secondary" type="button">
          Скопировать код
        </button>
      </div>

      <div id="onlineStatus" class="note">
        Онлайн-игра
      </div>

      <div id="onlineTimer" class="info-pill" style="display:inline-block;margin-top:10px">
        Без ограничения времени
      </div>

      <div id="onlineTurnLabel" style="margin-top:10px;font-weight:bold"></div>

      <div id="onlineQuestionPanel" style="display:none;margin-top:15px">
        <p id="onlineQuestionText"></p>
        <div class="card-actions">
          <button id="onlineAnswerYes" type="button">Да</button>
          <button id="onlineAnswerNo" class="secondary" type="button">Нет</button>
        </div>
      </div>

      <div id="onlineAskPanel" style="display:none;margin-top:15px">
        <input
          id="onlineQuestionInput"
          type="text"
          maxlength="250"
          placeholder="Напиши вопрос сопернику"
        >
        <button id="onlineAskButton" type="button">Отправить вопрос</button>
      </div>

      <div style="margin-top:12px">
        <button id="onlineLeaveButton" class="danger small" type="button">
          Покинуть комнату
        </button>
      </div>
    `;

    const game = document.getElementById("game");

    if (game) {
      const info = game.querySelector(".game-info");

      if (info) {
        info.insertAdjacentElement("afterend", panel);
      } else {
        game.prepend(panel);
      }
    }

    const editModal = document.createElement("div");
    editModal.id = "onlineEditRoomModal";
    editModal.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:#080612dd;align-items:center;justify-content:center;padding:16px";
    editModal.innerHTML = `
      <div style="width:min(440px,100%);padding:22px;border:1px solid #a78bfa;border-radius:18px;background:#1c1732;color:#fff">
        <h3 style="margin-top:0">Настройки комнаты</h3>
        <label style="display:block;margin:10px 0 5px">Название</label>
        <input id="onlineEditRoomName" maxlength="50" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30">
        <label style="display:block;margin:10px 0 5px">Доступ</label>
        <select id="onlineEditRoomAccess" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
        <label style="display:block;margin:10px 0 5px">Время на вопрос</label>
        <select id="onlineEditRoomTimer" style="width:100%;padding:11px;border-radius:9px;background:#100d20;color:white;border:1px solid #ffffff30"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
        <div style="display:flex;gap:8px;margin-top:16px"><button id="onlineSaveRoomSettings" type="button">Сохранить</button><button id="onlineCancelRoomSettings" class="secondary" type="button">Отмена</button></div>
      </div>`;
    document.body.appendChild(editModal);
    document.getElementById("onlineEditRoomButton").onclick = () => {
      const settings = API.roomSettings || {};
      document.getElementById("onlineEditRoomName").value = settings.roomName || "Комната";
      document.getElementById("onlineEditRoomAccess").value = settings.access || "private";
      document.getElementById("onlineEditRoomTimer").value = String(settings.timerSeconds ?? 60);
      editModal.style.display = "flex";
    };
    document.getElementById("onlineCancelRoomSettings").onclick = () => { editModal.style.display = "none"; };
    document.getElementById("onlineSaveRoomSettings").onclick = async () => {
      const result = await updateRoomSettings({
        roomName: document.getElementById("onlineEditRoomName").value.trim(),
        access: document.getElementById("onlineEditRoomAccess").value,
        timerSeconds: Number(document.getElementById("onlineEditRoomTimer").value),
        maxPlayers: 2
      });
      if (result.ok) {
        editModal.style.display = "none";
        setStatus("Настройки комнаты сохранены.");
      } else setStatus(result.message || "Не удалось сохранить настройки.");
    };

    document.getElementById("onlineCopyCodeButton").onclick = () => {
      if (API.roomCode && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(API.roomCode);
        setStatus("Код комнаты скопирован.");
      }
    };

    document.getElementById("onlineLeaveButton").onclick = () => {
      leaveRoom();

      if (typeof returnToMenu === "function") {
        returnToMenu();
      }
    };

    document.getElementById("onlineAskButton").onclick = async () => {
      const input = document.getElementById("onlineQuestionInput");
      const question = input.value.trim();

      if (!question) {
        setStatus("Сначала напиши вопрос.");
        return;
      }

      const result = await askQuestion(question);

      if (result.ok) {
        input.value = "";
        setStatus("Вопрос отправлен. Ждём ответ.");
      } else {
        setStatus(result.message || "Не удалось отправить вопрос.");
      }
    };

    document.getElementById("onlineAnswerYes").onclick = () => {
      answerQuestion(true);
      document.getElementById("onlineQuestionPanel").style.display = "none";
    };

    document.getElementById("onlineAnswerNo").onclick = () => {
      answerQuestion(false);
      document.getElementById("onlineQuestionPanel").style.display = "none";
    };
  }

  function updateTurnControls() {
    const askPanel = document.getElementById("onlineAskPanel");
    const turnLabel = document.getElementById("onlineTurnLabel");

    if (!askPanel || !turnLabel) return;

    const myTurn = isMyTurn();

    askPanel.style.display = myTurn ? "block" : "none";

    turnLabel.textContent = myTurn
      ? "Твой ход"
      : "Ход соперника";
  }

  document.addEventListener("online-turn", updateTurnControls);

  document.addEventListener("online-question", event => {
    const panel = document.getElementById("onlineQuestionPanel");
    const text = document.getElementById("onlineQuestionText");

    if (!panel || !text) return;

    text.textContent = "Вопрос соперника: " + event.detail.question;
    panel.style.display = "block";
  });

  document.addEventListener("online-answer", event => {
    const panel = document.getElementById("onlineQuestionPanel");

    if (panel) panel.style.display = "none";

    dispatch("online-answer-visible", event.detail);
  });

  document.addEventListener("online-state-change", () => {
    updateTurnControls();
    const editButton = document.getElementById("onlineEditRoomButton");
    if (editButton) editButton.style.display = API.isRoomHost ? "inline-block" : "none";
  });

  // Старую панель используем только на страницах классической игры с #game.
  // Страница «Кто я?» создаёт собственный интерфейс через room-system.js.
  if (document.getElementById("game")) createPanel();

  window.onlineGame = {
    createRoom,
    createLobby,
    updateRoomSettings,
    startWordRound,
    selectSeat,
    submitPlayerWord,
    askWhoAmIQuestion,
    answerWhoAmIQuestion,
    guessWhoAmI,
    passWhoAmITurn,
    sendWhoAmIChat,
    sendGameAction,
    startGame,
    joinRoom,
    playerReady,
    askQuestion,
    answerQuestion,
    makeGuess,
    listPublicRooms,
    listPacks,
    publishPack,
    deletePublishedPack,
    isMyTurn,
    canChooseCharacter,
    getRoomCode,
    getSettings,
    isRoomHost,
    getPlayerId,
    getPack,
    leaveRoom
  };

  window.onlineRoomActive = false;
})();
