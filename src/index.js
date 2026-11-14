
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.players = new Map();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket connection required", {
        status: 426
      });
    }

    if (this.players.size >= 2) {
      return new Response("Комната заполнена", { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    const playerId = crypto.randomUUID();
    this.players.set(playerId, server);

    server.send(JSON.stringify({
      type: "connected",
      playerId,
      players: this.players.size
    }));

    server.addEventListener("message", event => {
      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      this.broadcast({
        ...message,
        playerId
      });
    });

    const removePlayer = () => {
      this.players.delete(playerId);
      this.broadcast({
        type: "player-left",
        players: this.players.size
      });
    };

    server.addEventListener("close", removePlayer);
    server.addEventListener("error", removePlayer);

    this.broadcast({
      type: "players",
      players: this.players.size
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
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

    return env.ASSETS.fetch(request);
  }
};
