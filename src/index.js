
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;

    this.players = new Map();
    this.pack = null;
    this.ready = new Set();
    this.secretCharacters = new Map();

    this.currentTurn = null;
    this.pending = null;
    this.ended = false;

    this.roomId = null;
    this.gameId = "who-is-it";
    this.roomName = "Комната";
    this.access = "private";
    this.maxPlayers = 2;
    this.hostPlayerId = null;
    this.createdAt = null;
    this.timerSeconds = 0;
    this.turnDeadline = null;

    this.isDirectory =
      ctx.id.toString() ===
      env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY").toString();
  }

  send(socket, event, data = {}) {
    try {
      socket.send(JSON.stringify({ event, data }));
    } catch {}
  }

  reply(socket, requestId, result) {
    if (!requestId) return;

    try {
      socket.send(JSON.stringify({
        ackId: requestId,
        result
      }));
    } catch {}
  }

  broadcast(event, data = {}, except = null) {
    for (const socket of this.players.values()) {
      if (socket !== except) {
        this.send(socket, event, data);
      }
    }
  }

  async directoryRequest(path, method = "GET", body = null) {
    try {
      const id = this.env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY");
      const stub = this.env.GAME_ROOM.get(id);

      return await stub.fetch("https://directory.internal" + path, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      return null;
    }
  }

  async updateDirectory() {
    if (!this.roomId) return;

    if (this.access !== "public" || this.players.size === 0 || this.ended) {
      await this.directoryRequest(
        "/internal/room-delete/" + this.gameId + "/" + this.roomId,
        "DELETE"
      );
      return;
    }

    await this.directoryRequest("/internal/room-upsert", "POST", {
      roomId: this.roomId,
      gameId: this.gameId,
      name: this.roomName,
      access: this.access,
      playersCount: this.players.size,
      maxPlayers: this.maxPlayers,
      cardCount: this.pack?.characters?.length || 0,
      packName: this.pack?.name || "Пак",
      timerSeconds: this.timerSeconds,
      createdAt: this.createdAt || Date.now()
    });
  }

  async clearTurnTimer() {
    this.turnDeadline = null;

    try {
      await this.ctx.storage.deleteAlarm();
    } catch {}
  }

  async startTurnTimer() {
    await this.clearTurnTimer();

    if (
      !this.timerSeconds ||
      this.timerSeconds <= 0 ||
      !this.currentTurn ||
      this.ended ||
      this.pending
    ) {
      return;
    }

    this.turnDeadline = Date.now() + this.timerSeconds * 1000;

    try {
      await this.ctx.storage.setAlarm(this.turnDeadline);
    } catch {}
  }

  async sendTurn() {
    await this.startTurnTimer();

    this.broadcast("online-turn", {
      currentTurn: this.currentTurn,
      deadline: this.turnDeadline,
      timerSeconds: this.timerSeconds
    });
  }

  async alarm() {
    if (
      !this.currentTurn ||
      this.ended ||
      this.pending ||
      !this.turnDeadline
    ) {
      return;
    }

    if (Date.now() < this.turnDeadline) {
      await this.ctx.storage.setAlarm(this.turnDeadline);
      return;
    }

    const previousTurn = this.currentTurn;
    const opponentId = [...this.players.keys()].find(
      id => id !== previousTurn
    );

    this.turnDeadline = null;

    if (!opponentId || this.players.size !== 2) {
      this.currentTurn = null;
      this.broadcast("online-turn", {
        currentTurn: null,
        deadline: null,
        timerSeconds: this.timerSeconds
      });
      return;
    }

    this.currentTurn = opponentId;

    this.broadcast("turn-timeout", {
      previousTurn,
      currentTurn: opponentId,
      message: "Время на ход закончилось. Ход переходит сопернику."
    });

    await this.sendTurn();
  }

  async removePlayer(playerId) {
    if (!this.players.has(playerId)) return;

    this.players.delete(playerId);

    this.ready.clear();
    this.secretCharacters.clear();

    this.currentTurn = null;
    this.pending = null;
    this.ended = false;

    await this.clearTurnTimer();

    this.broadcast("player-left");

    if (this.players.size === 0) {
      await this.updateDirectory();
      this.pack = null;
      this.roomId = null;
      this.createdAt = null;
      this.hostPlayerId = null;
    } else {
      if (this.hostPlayerId && !this.players.has(this.hostPlayerId)) {
        this.hostPlayerId = this.players.keys().next().value;
      }
      await this.updateDirectory();
    }
  }

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  async directoryFetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/public-rooms" && request.method === "GET") {
      const rooms = await this.ctx.storage.get("publicRooms") || [];

      return this.json(
        rooms.filter(room =>
          room.playersCount < (Number(room.maxPlayers) || 2) &&
          (!url.searchParams.get("game") || room.gameId === url.searchParams.get("game")) &&
          Date.now() - room.createdAt < 12 * 60 * 60 * 1000
        )
      );
    }

    if (path === "/api/packs" && request.method === "GET") {
      const packs = await this.ctx.storage.get("publishedPacks") || [];

      return this.json(
        packs.map(pack => ({
          id: pack.id,
          name: pack.name,
          author: pack.author,
          characters: pack.characters,
          createdAt: pack.createdAt
        }))
      );
    }

    if (path === "/api/packs" && request.method === "POST") {
      let body;

      try {
        body = await request.json();
      } catch {
        return this.json({ ok: false, message: "Неверный формат данных." }, 400);
      }

      const pack = body?.pack;
      const author = String(body?.author || "Игрок").trim().slice(0, 40);

      if (
        !pack ||
        !Array.isArray(pack.characters) ||
        pack.characters.length < 2 ||
        pack.characters.length > 60
      ) {
        return this.json({
          ok: false,
          message: "В паке должно быть от 2 до 60 персонажей."
        }, 400);
      }

      const cleanCharacters = [];

      for (let i = 0; i < pack.characters.length; i++) {
        const character = pack.characters[i] || {};
        const name = String(character.name || "").trim().slice(0, 60);
        const id = String(character.id || "character_" + i).slice(0, 100);
        const emoji = String(character.emoji || "").slice(0, 16);
        const image = character.image == null
          ? null
          : String(character.image);

        if (!name) {
          return this.json({
            ok: false,
            message: "У каждого персонажа должно быть имя."
          }, 400);
        }

        if (image && (
          !image.startsWith("data:image/") ||
          image.length > 500000
        )) {
          return this.json({
            ok: false,
            message: "Одно из изображений слишком большое или имеет неверный формат."
          }, 400);
        }

        cleanCharacters.push({
          id,
          name,
          emoji,
          image
        });
      }

      const cleanPack = {
        name: String(pack.name || "Пользовательский пак")
          .trim()
          .slice(0, 60),
        characters: cleanCharacters
      };

      const serialized = JSON.stringify(cleanPack);

      if (serialized.length > 1800000) {
        return this.json({
          ok: false,
          message: "Размер пака превышает допустимый лимит."
        }, 413);
      }

      const packs = await this.ctx.storage.get("publishedPacks") || [];

      const entry = {
        id: "published_" + crypto.randomUUID(),
        name: cleanPack.name,
        author: author || "Игрок",
        characters: cleanCharacters,
        createdAt: Date.now()
      };

      packs.unshift(entry);

      await this.ctx.storage.put(
        "publishedPacks",
        packs.slice(0, 300)
      );

      return this.json({
        ok: true,
        id: entry.id
      });
    }

    if (path.startsWith("/api/packs/") && request.method === "DELETE") {
      const id = decodeURIComponent(path.slice("/api/packs/".length));
      const packs = await this.ctx.storage.get("publishedPacks") || [];
      const updated = packs.filter(pack => pack.id !== id);

      await this.ctx.storage.put("publishedPacks", updated);

      return this.json({ ok: true });
    }

    if (path === "/internal/room-upsert" && request.method === "POST") {
      let room;

      try {
        room = await request.json();
      } catch {
        return this.json({ ok: false }, 400);
      }

      if (!room?.roomId || !/^[A-Z0-9_-]{3,16}$/.test(room.roomId) || !["who-is-it","who-am-i","alias","codenames","spy","imaginarium"].includes(room.gameId)) {
        return this.json({ ok: false }, 400);
      }

      const rooms = await this.ctx.storage.get("publicRooms") || [];
      const updated = rooms.filter(item => !(item.roomId === room.roomId && item.gameId === room.gameId));

      updated.push(room);

      await this.ctx.storage.put("publicRooms", updated.slice(-200));

      return this.json({ ok: true });
    }

    if (
      path.startsWith("/internal/room-delete/") &&
      request.method === "DELETE"
    ) {
      const key = path.slice("/internal/room-delete/".length).split("/");
      const gameId = key[0];
      const roomId = key[1];
      const rooms = await this.ctx.storage.get("publicRooms") || [];

      await this.ctx.storage.put(
        "publicRooms",
        rooms.filter(room => !(room.roomId === roomId && room.gameId === gameId))
      );

      return this.json({ ok: true });
    }

    return this.json({ ok: false, message: "Маршрут не найден." }, 404);
  }

  async fetch(request) {
    if (this.isDirectory) {
      return this.directoryFetch(request);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket connection required", {
        status: 426
      });
    }

    const url = new URL(request.url);
    this.roomId = url.searchParams.get("id");
    this.gameId = url.searchParams.get("game") || "who-is-it";

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    const playerId = crypto.randomUUID();

    server.send(JSON.stringify({
      event: "connected",
      data: { playerId }
    }));

    server.addEventListener("message", event => {
      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      this.handleMessage(server, playerId, message);
    });

    const remove = () => {
      this.removePlayer(playerId);
    };

    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async handleMessage(socket, playerId, message) {
    const event = message.event;
    const data = message.data ?? {};
    const requestId = message.requestId;

    const reply = result => {
      this.reply(socket, requestId, result);
    };

    if (event === "create-room" || event === "create-lobby") {
      const isGameWithPack = event === "create-room";
      const pack = data.pack;
      const settings = data.settings || {};

      const requestedMaxPlayers = this.gameId === "who-is-it" ? 2 : Number(settings.maxPlayers || 2);
      const allowedTimers = [0, 15, 30, 45, 60, 90, 120];
      const timerSeconds = Number(settings.timerSeconds ?? 0);
      const requestedCode = String(settings.roomCode || this.roomId || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,16}$/.test(requestedCode) || requestedCode !== this.roomId || ![2,3,4,5,6].includes(requestedMaxPlayers) || !allowedTimers.includes(timerSeconds)) {
        reply({ ok: false, message: "Проверь код комнаты, количество игроков и время на вопрос." });
        return;
      }
      if (isGameWithPack && (!pack || !Array.isArray(pack.characters) || pack.characters.length < 2 || pack.characters.length > 60)) {
        reply({ ok: false, message: "Не удалось создать комнату или неверный набор персонажей." });
        return;
      }
      if (!isGameWithPack && this.gameId === "who-is-it") {
        reply({ ok: false, message: "Для игры «Кто это?» нужен выбранный пак." });
        return;
      }

      if (this.players.size !== 0 || this.createdAt) {
        reply({
          ok: false,
          message: "Не удалось создать комнату или неверный набор персонажей."
        });
        return;
      }

      const requestedCount = isGameWithPack ? Number(settings.cardCount || pack.characters.length) : 0;
      const allowedCounts = [20, 30, 40, 50, 60];

      if (isGameWithPack && (
        !allowedCounts.includes(requestedCount) ||
        pack.characters.length < requestedCount
      )) {
        reply({
          ok: false,
          message: "В выбранном паке недостаточно карточек."
        });
        return;
      }

      if (isGameWithPack && ![0, 15, 30, 45, 60, 90, 120].includes(timerSeconds)) {
        reply({
          ok: false,
          message: "Неверное значение таймера."
        });
        return;
      }

      const access = settings.access === "public" ? "public" : "private";

      this.pack = isGameWithPack ? {
        name: String(pack.name || "Пак").slice(0, 60),
        characters: pack.characters.slice(0, requestedCount)
      } : null;

      this.roomName = String(settings.roomName || "Комната")
        .trim()
        .slice(0, 50) || "Комната";

      this.access = access;
      this.maxPlayers = requestedMaxPlayers;
      this.timerSeconds = timerSeconds;
      this.roomId = requestedCode;
      this.createdAt = Date.now();
      this.hostPlayerId = playerId;
      this.players.set(playerId, socket);

      await this.updateDirectory();

      reply({
        ok: true,
        settings: {
          roomName: this.roomName,
          roomCode: this.roomId,
          access: this.access,
          maxPlayers: this.maxPlayers,
          timerSeconds: this.timerSeconds,
          cardCount: this.pack?.characters?.length || 0
        }
      });

      return;
    }

    if (event === "join-room") {
      if (!this.createdAt) {
        reply({ ok: false, message: "Комната не найдена." });
        return;
      }

      if (this.access === "private" && data.accessByCode !== true) {
        // Private rooms are joinable only when the player supplies the exact code.
      }

      if (this.players.size >= this.maxPlayers) {
        reply({
          ok: false,
          message: "В комнате уже достигнут лимит игроков."
        });
        return;
      }

      if (this.ended) {
        reply({
          ok: false,
          message: "Эта игра уже завершена."
        });
        return;
      }

      this.players.set(playerId, socket);

      reply({
        ok: true,
        pack: this.pack,
        settings: {
          roomName: this.roomName,
          roomCode: this.roomId,
          access: this.access,
          maxPlayers: this.maxPlayers,
          timerSeconds: this.timerSeconds,
          cardCount: this.pack?.characters?.length || 0
        }
      });

      this.broadcast("player-joined", {
        playersCount: this.players.size
      }, socket);

      await this.updateDirectory();
      return;
    }

    if (!this.players.has(playerId)) {
      reply({
        ok: false,
        message: "Сначала войдите в комнату."
      });
      return;
    }

    if (event === "update-room-settings") {
      if (playerId !== this.hostPlayerId || this.ready.size > 0) {
        reply({ ok: false, message: "Настройки может менять создатель до начала игры." });
        return;
      }
      const next = data.settings || {};
      const nextName = String(next.roomName || "").trim().slice(0, 50);
      const nextAccess = next.access === "public" ? "public" : "private";
      const nextMax = this.gameId === "who-is-it" ? 2 : Number(next.maxPlayers || this.maxPlayers);
      const nextTimer = Number(next.timerSeconds ?? this.timerSeconds);
      if (!nextName || ![2,3,4,5,6].includes(nextMax) || ![0,15,30,45,60,90,120].includes(nextTimer) || this.players.size > nextMax) {
        reply({ ok: false, message: "Некорректные настройки комнаты." });
        return;
      }
      this.roomName = nextName;
      this.access = nextAccess;
      this.maxPlayers = nextMax;
      this.timerSeconds = nextTimer;
      await this.updateDirectory();
      const settings = { roomName:this.roomName, roomCode:this.roomId, access:this.access, maxPlayers:this.maxPlayers, timerSeconds:this.timerSeconds };
      this.broadcast("room-settings-updated", settings);
      reply({ ok:true, settings });
      return;
    }

    if (event === "update-room-settings") {
      if (playerId !== this.hostPlayerId || this.ready.size > 0) {
        reply({ ok: false, message: "Настройки может менять создатель до начала игры." });
        return;
      }
      const next = data.settings || {};
      const nextName = String(next.roomName || "").trim().slice(0, 50);
      const nextAccess = next.access === "public" ? "public" : "private";
      const nextMax = this.gameId === "who-is-it" ? 2 : Number(next.maxPlayers || this.maxPlayers);
      const nextTimer = Number(next.timerSeconds ?? this.timerSeconds);
      if (!nextName || ![2,3,4,5,6].includes(nextMax) || ![0,15,30,45,60,90,120].includes(nextTimer) || this.players.size > nextMax) {
        reply({ ok: false, message: "Некорректные настройки комнаты." });
        return;
      }
      this.roomName = nextName;
      this.access = nextAccess;
      this.maxPlayers = nextMax;
      this.timerSeconds = nextTimer;
      await this.updateDirectory();
      const settings = { roomName:this.roomName, roomCode:this.roomId, access:this.access, maxPlayers:this.maxPlayers, timerSeconds:this.timerSeconds };
      this.broadcast("room-settings-updated", settings);
      reply({ ok:true, settings });
      return;
    }

    if (event === "player-ready") {
      const secretCharacterId = String(
        data.secretCharacterId || ""
      );

      const characterExists = this.pack?.characters?.some(
        character => String(character.id) === secretCharacterId
      );

      if (
        this.ended ||
        this.players.size !== 2 ||
        !this.pack ||
        !secretCharacterId ||
        !characterExists
      ) {
        reply({
          ok: false,
          message: this.players.size !== 2
            ? "Подожди, пока подключится второй игрок."
            : "Не удалось сохранить выбранного персонажа."
        });
        return;
      }

      if (this.ready.has(playerId)) {
        reply({
          ok: false,
          message: "Ты уже выбрал персонажа."
        });
        return;
      }

      this.secretCharacters.set(playerId, secretCharacterId);
      this.ready.add(playerId);

      this.broadcast("player-ready", {}, socket);

      if (this.players.size === 2 && this.ready.size === 2) {
        const ids = [...this.players.keys()];

        this.currentTurn = ids[
          Math.floor(Math.random() * ids.length)
        ];

        this.pending = null;
        this.ended = false;

        this.broadcast("online-start");
        await this.sendTurn();
      } else {
        reply({
          ok: true,
          waiting: true
        });
        return;
      }

      reply({ ok: true });
      return;
    }

    if (event === "ask-question") {
      const question = String(data.question || "")
        .trim()
        .slice(0, 250);

      if (
        this.ended ||
        this.ready.size !== 2 ||
        this.currentTurn !== playerId ||
        this.pending ||
        !question
      ) {
        reply({
          ok: false,
          message: "Сейчас нельзя задать вопрос."
        });
        return;
      }

      await this.clearTurnTimer();

      this.pending = {
        type: "question",
        from: playerId
      };

      this.broadcast("online-question", {
        question
      }, socket);

      reply({ ok: true });
      return;
    }

    if (event === "answer-question") {
      if (
        this.ended ||
        !this.pending ||
        this.pending.type !== "question" ||
        this.pending.from === playerId
      ) {
        reply({
          ok: false,
          message: "Нет вопроса для ответа."
        });
        return;
      }

      const asker = this.players.get(this.pending.from);

      if (asker) {
        this.send(asker, "online-answer", {
          answer: !!data.answer
        });
      }

      this.pending = null;
      this.currentTurn = playerId;

      await this.sendTurn();

      reply({ ok: true });
      return;
    }

    if (event === "make-guess") {
      const guessId = String(data.guessId || "").trim();

      if (
        this.ended ||
        this.ready.size !== 2 ||
        this.currentTurn !== playerId ||
        this.pending ||
        !guessId
      ) {
        reply({
          ok: false,
          message: "Сейчас нельзя угадывать."
        });
        return;
      }

      const opponentId = [...this.players.keys()].find(
        id => id !== playerId
      );

      if (!opponentId || !this.secretCharacters.has(opponentId)) {
        reply({
          ok: false,
          message: "Соперник ещё не выбрал персонажа."
        });
        return;
      }

      await this.clearTurnTimer();

      const correct =
        this.secretCharacters.get(opponentId) === guessId;

      const guesser = this.players.get(playerId);

      if (guesser) {
        this.send(guesser, "online-guess-result", {
          correct
        });
      }

      this.broadcast("online-guess-made", {
        correct
      }, guesser);

      if (correct) {
        this.ended = true;
        this.pending = null;
        this.currentTurn = null;

        this.broadcast("online-ended", {
          message: "Игра окончена! Персонаж угадан."
        });

        await this.updateDirectory();
      } else {
        this.currentTurn = opponentId;
        this.pending = null;
        await this.sendTurn();
      }

      reply({ ok: true, correct });
      return;
    }

    if (event === "leave-room") {
      await this.removePlayer(playerId);
      reply({ ok: true });
      return;
    }

    reply({
      ok: false,
      message: "Неизвестное действие."
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/room") {
      const roomId = String(url.searchParams.get("id") || "").trim().toUpperCase();
      const gameId = url.searchParams.get("game") || "who-is-it";

      if (!/^[A-Z0-9_-]{3,16}$/.test(roomId) || !["who-is-it","who-am-i","alias","codenames","spy","imaginarium"].includes(gameId)) {
        return new Response("Неверный код комнаты", {
          status: 400
        });
      }

      const room = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName(gameId + ":" + roomId)
      );

      return room.fetch(request);
    }

    if (
      url.pathname === "/api/public-rooms" ||
      url.pathname === "/api/packs" ||
      url.pathname.startsWith("/api/packs/")
    ) {
      const directory = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY")
      );

      return directory.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
