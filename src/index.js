import { GameRoom } from "./durable-objects/GameRoom.js";

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
      url.pathname.startsWith("/api/packs/") ||
      url.pathname.startsWith("/api/images/")
    ) {
      const directory = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY")
      );

      return directory.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
