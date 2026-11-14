
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
    this.pack = null;
    this.ready = new Set();
    this.currentTurn = null;
    this.pending = null;
    this.ended = false;
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

  sendTurn() {
    this.broadcast("online-turn", {
      currentTurn: this.currentTurn
    });
  }

  removePlayer(playerId) {
    if (!this.players.has(playerId)) return;

    this.players.delete(playerId);
    this.ready.delete(playerId);

    this.broadcast("player-left");

    if (this.players.size === 0) {
      this.pack = null;
      this.pending = null;
      this.currentTurn = null;
      this.ended = false;
      this.ready.clear();
    } else {
      this.currentTurn = null;
      this.pending = null;
      this.ended = false;
    }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket connection required", {
        status: 426
      });
    }

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

  handleMessage(socket, playerId, message) {
    const event = message.event;
    const data = message.data ?? {};
    const requestId = message.requestId;

    const reply = result => {
      this.reply(socket, requestId, result);
    };

    if (event === "create-room") {
      const pack = data.pack;

      if (
        this.players.size !== 0 ||
        !pack ||
        !Array.isArray(pack.characters) ||
        pack.characters.length < 2 ||
        pack.characters.length > 100
      ) {
        reply({
          ok: false,
          message: "Не удалось создать комнату или неверный набор персонажей."
        });
        return;
      }

      this.pack = pack;
      this.players.set(playerId, socket);

      reply({ ok: true });
      return;
    }

    if (event === "join-room") {
      if (!this.pack) {
        reply({
          ok: false,
          message: "Комната не найдена."
        });
        return;
      }

      if (this.players.size >= 2) {
        reply({
          ok: false,
          message: "В комнате уже два игрока."
        });
        return;
      }

      this.players.set(playerId, socket);

      reply({
        ok: true,
        pack: this.pack
      });

      this.broadcast("player-joined", {}, socket);
      return;
    }

    if (!this.players.has(playerId)) {
      reply({
        ok: false,
        message: "Сначала войдите в комнату."
      });
      return;
    }

    if (event === "player-ready") {
      if (this.ended || !this.pack) {
        reply({
          ok: false,
          message: "Сейчас нельзя начать игру."
        });
        return;
      }

      // Готовность сохраняется даже тогда, когда второй игрок
      // ещё не подключился. Это исправляет проблему хоста.
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
        this.sendTurn();
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

      this.pending = {
        type: "question",
        from: playerId
      };

      this.broadcast("online-question", { question }, socket);
      reply({ ok: true });
      return;
    }

    if (event === "answer-question") {
      if (
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
      this.sendTurn();

      reply({ ok: true });
      return;
    }

    if (event === "make-guess") {
      const guess = String(data.guess || "")
        .trim()
        .slice(0, 120);

      if (
        this.ended ||
        this.currentTurn !== playerId ||
        this.pending ||
        !guess
      ) {
        reply({
          ok: false,
          message: "Сейчас нельзя угадывать."
        });
        return;
      }

      this.pending = {
        type: "guess",
        from: playerId
      };

      this.broadcast("online-guess", { guess }, socket);
      reply({ ok: true });
      return;
    }

    if (event === "answer-guess") {
      if (
        !this.pending ||
        this.pending.type !== "guess" ||
        this.pending.from === playerId
      ) {
        reply({
          ok: false,
          message: "Нет догадки для ответа."
        });
        return;
      }

      const guesser = this.players.get(this.pending.from);

      if (guesser) {
        this.send(guesser, "online-guess-result", {
          correct: !!data.correct
        });
      }

      this.pending = null;

      if (data.correct) {
        this.ended = true;

        this.broadcast("online-ended", {
          message: "Игра окончена! Персонаж угадан."
        });
      } else {
        this.currentTurn = playerId;
        this.sendTurn();
      }

      reply({ ok: true });
      return;
    }

    if (event === "leave-room") {
      this.removePlayer(playerId);
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
      const roomId = url.searchParams.get("id");

      if (!roomId || !/^\d{6}$/.test(roomId)) {
        return new Response("Неверный код комнаты", {
          status: 400
        });
      }

      const room = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName(roomId)
      );

      return room.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
