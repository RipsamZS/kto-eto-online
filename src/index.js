
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
    this.state = {
      pack: [],
      secretCharacters: {},
      turn: null,
      question: null,
      answers: {}
    };
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Game room is ready");
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const playerId = crypto.randomUUID();

    this.players.set(playerId, server);

    server.send(JSON.stringify({
      type: "connected",
      playerId,
      players: this.players.size
    }));

    server.addEventListener("message", event => {
      this.handleMessage(playerId, event.data);
    });

    server.addEventListener("close", () => {
      this.players.delete(playerId);
      this.broadcast({
        type: "player-left",
        players: this.players.size
      });
    });

    this.broadcast({
      type: "players",
      players: this.players.size
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  handleMessage(playerId, raw) {
    let message;

    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.type === "start" && this.players.size === 2) {
      this.state.pack = message.pack || [];

      this.broadcast({
        type: "game-started",
        pack: this.state.pack
      });
      return;
    }

    if (message.type === "question") {
      this.broadcast({
        type: "question",
        playerId,
        question: message.question
      });
      return;
    }

    if (message.type === "answer") {
      this.broadcast({
        type: "answer",
        playerId,
        answer: message.answer
      });
      return;
    }

    if (message.type === "guess") {
      this.broadcast({
        type: "guess",
        playerId,
        character: message.character
      });
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);

    for (const socket of this.players.values()) {
      try {
        socket.send(message);
      } catch {}
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Кто это? Онлайн-сервер работает!");
    }

    if (url.pathname === "/room") {
      const roomId = url.searchParams.get("id");

      if (!roomId) {
        return new Response("Укажи код комнаты", { status: 400 });
      }

      const room = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName(roomId)
      );

      return room.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
