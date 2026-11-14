export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async getRoom() {
    return await this.ctx.storage.get("room");
  }

  async saveRoom(room) {
    await this.ctx.storage.put("room", room);
  }

  getPlayerId(socket) {
    return socket.deserializeAttachment()?.playerId;
  }

  send(socket, event, data = {}, requestId = null) {
    try {
      socket.send(JSON.stringify({
        event,
        data,
        requestId
      }));
    } catch {}
  }

  broadcast(event, data = {}) {
    for (const socket of this.ctx.getWebSockets()) {
      this.send(socket, event, data);
    }
  }

  sendTo(playerId, event, data = {}) {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.getPlayerId(socket) === playerId) {
        this.send(socket, event, data);
      }
    }
  }

  sendTurn(room) {
    this.broadcast("online-turn", {
      currentTurn: room.currentTurn
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Инициализация новой комнаты
    if (url.pathname === "/init" && request.method === "POST") {
      const existing = await this.getRoom();

      if (existing) {
        return new Response("Комната уже существует", {
          status: 409
        });
      }

      const pack = await request.json();

      await this.saveRoom({
        pack,
        players: [],
        ready: [],
        currentTurn: null,
        pending: null,
        ended: false
      });

      return Response.json({ ok: true });
    }

    // Подключение игрока
    if (
      url.pathname === "/room" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const room = await this.getRoom();

      if (!room) {
        return new Response("Комната не найдена", {
          status: 404
        });
      }

      if (room.players.length >= 2) {
        return new Response("Комната уже заполнена", {
          status: 403
        });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      server.accept();

      const playerId = crypto.randomUUID();

      server.serializeAttachment({ playerId });

      room.players.push(playerId);
      await this.saveRoom(room);

      this.send(server, "connected", {
        playerId,
        players: room.players.length
      });

      if (room.players.length === 2) {
        this.send(server, "room-joined", {
          code: url.searchParams.get("id"),
          pack: room.pack
        });

        this.broadcast("player-joined");
      }

      server.addEventListener("message", event => {
        this.handleMessage(server, event.data);
      });

      server.addEventListener("close", () => {
        this.removePlayer(server);
      });

      server.addEventListener("error", () => {
        this.removePlayer(server);
      });

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleMessage(socket, rawMessage) {
    let message;

    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    const event = message.event;
    const data = message.data || {};
    const requestId = message.requestId;
    const playerId = this.getPlayerId(socket);

    const ack = (result) => {
      this.send(socket, "ack", result, requestId);
    };

    const room = await this.getRoom();

    if (!room || !room.players.includes(playerId)) {
      ack({
        ok: false,
        message: "Комната не найдена."
      });
      return;
    }

    // Игрок выбрал тайного персонажа
    if (event === "player-ready") {
      if (room.players.length !== 2 || room.ended) {
        ack({
          ok: false,
          message: "Ожидаем второго игрока."
        });
        return;
      }

      if (!room.ready.includes(playerId)) {
        room.ready.push(playerId);
      }

      await this.saveRoom(room);

      for (const id of room.players) {
        if (id !== playerId) {
          this.sendTo(id, "player-ready");
        }
      }

      if (room.ready.length === 2) {
        room.currentTurn =
          room.players[Math.floor(Math.random() * 2)];

        this.broadcast("online-start");
        this.sendTurn(room);
      }

      ack({ ok: true });
      return;
    }

    // Задать вопрос
    if (event === "ask-question") {
      const question = String(data.question || "")
        .trim()
        .slice(0, 250);

      if (
        room.ended ||
        room.currentTurn !== playerId ||
        room.pending ||
        !question
      ) {
        ack({
          ok: false,
          message: "Сейчас нельзя задать вопрос."
        });
        return;
      }

      room.pending = {
        type: "question",
        from: playerId
      };

      await this.saveRoom(room);

      const opponent = room.players.find(id => id !== playerId);

      this.sendTo(opponent, "online-question", {
        question
      });

      ack({ ok: true });
      return;
    }

    // Ответить на вопрос
    if (event === "answer-question") {
      if (
        !room.pending ||
        room.pending.type !== "question" ||
        room.pending.from === playerId
      ) {
        ack({
          ok: false,
          message: "Нет вопроса для ответа."
        });
        return;
      }

      const asker = room.pending.from;

      this.sendTo(asker, "online-answer", {
        answer: !!data.answer
      });

      room.pending = null;
      room.currentTurn = playerId;

      await this.saveRoom(room);
      this.sendTurn(room);

      ack({ ok: true });
      return;
    }

    // Попытка угадать персонажа
    if (event === "make-guess") {
      const guess = String(data.guess || "")
        .trim()
        .slice(0, 120);

      if (
        room.ended ||
        room.currentTurn !== playerId ||
        room.pending ||
        !guess
      ) {
        ack({
          ok: false,
          message: "Сейчас нельзя угадывать."
        });
        return;
      }

      room.pending = {
        type: "guess",
        from: playerId
      };

      await this.saveRoom(room);

      const opponent = room.players.find(id => id !== playerId);

      this.sendTo(opponent, "online-guess", {
        guess
      });

      ack({ ok: true });
      return;
    }

    // Ответить на попытку угадать
    if (event === "answer-guess") {
      if (
        !room.pending ||
        room.pending.type !== "guess" ||
        room.pending.from === playerId
      ) {
        ack({
          ok: false,
          message: "Нет догадки для ответа."
        });
        return;
      }

      const guesser = room.pending.from;
      const correct = !!data.correct;

      this.sendTo(guesser, "online-guess-result", {
        correct
      });

      room.pending = null;

      if (correct) {
        room.ended = true;
      } else {
        room.currentTurn = playerId;
      }

      await this.saveRoom(room);

      if (correct) {
        this.broadcast("online-ended", {
          message: "Игра окончена! Персонаж угадан."
        });
      } else {
        this.sendTurn(room);
      }

      ack({ ok: true });
      return;
    }

    // Выход из комнаты
    if (event === "leave-room") {
      await this.removePlayer(socket);
      ack({ ok: true });
      return;
    }

    ack({
      ok: false,
      message: "Неизвестная команда."
    });
  }

  async removePlayer(socket) {
    const playerId = this.getPlayerId(socket);
    const room = await this.getRoom();

    if (!room || !room.players.includes(playerId)) {
      return;
    }

    room.players = room.players.filter(id => id !== playerId);
    room.ready = room.ready.filter(id => id !== playerId);

    if (room.players.length === 0) {
      await this.ctx.storage.delete("room");
      return;
    }

    if (room.currentTurn === playerId) {
      room.currentTurn = null;
    }

    room.pending = null;

    await this.saveRoom(room);

    this.broadcast("player-left");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Создание комнаты
    if (url.pathname === "/create-room" && request.method === "POST") {
      let pack;

      try {
        pack = await request.json();
      } catch {
        return Response.json({
          ok: false,
          message: "Некорректные данные."
        }, { status: 400 });
      }

      if (
        !pack ||
        !Array.isArray(pack.characters) ||
        pack.characters.length < 2 ||
        pack.characters.length > 100
      ) {
        return Response.json({
          ok: false,
          message: "В паке должно быть от 2 до 100 персонажей."
        }, { status: 400 });
      }

      let code;
      let room;

      for (let attempt = 0; attempt < 5; attempt++) {
        code = String(
          Math.floor(100000 + Math.random() * 900000)
        );

        room = env.GAME_ROOM.get(
          env.GAME_ROOM.idFromName(code)
        );

        const response = await room.fetch(
          "https://internal/init",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(pack)
          }
        );

        if (response.ok) {
          return Response.json({
            ok: true,
            code
          });
        }
      }

      return Response.json({
        ok: false,
        message: "Не удалось создать комнату. Попробуй ещё раз."
      }, { status: 500 });
    }

    // Подключение к комнате
    if (url.pathname === "/room") {
      const code = url.searchParams.get("id");

      if (!code || !/^\d{6}$/.test(code)) {
        return new Response("Укажи шестизначный код комнаты", {
          status: 400
        });
      }

      const room = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName(code)
      );

      const roomUrl = new URL(request.url);
      roomUrl.pathname = "/room";

      return room.fetch(new Request(roomUrl, request));
    }

    return env.ASSETS.fetch(request);
  }
};
