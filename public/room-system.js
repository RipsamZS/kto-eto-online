(() => {
  "use strict";
  const gameId = window.ROOM_GAME_ID || "who-am-i";
  const root = document.getElementById("sharedRoomSystem");
  if (!root || !window.onlineGame) return;

  root.innerHTML = `
    <style>
      .srs{max-width:760px;margin:28px auto;padding:22px;border:1px solid #ffffff24;border-radius:22px;background:#211a38;color:#f6f2ff;font-family:Arial,sans-serif}
      .srs h2{margin:0 0 8px}.srs p{color:#c4b8d8;line-height:1.5}.srs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
      .srs-card{padding:16px;border:1px solid #ffffff20;border-radius:16px;background:#171329}.srs label{display:block;margin:10px 0 6px;color:#c4b8d8;font-size:13px}
      .srs input,.srs select{width:100%;padding:11px;border-radius:10px;border:1px solid #ffffff25;background:#100d20;color:#fff;font:inherit}
      .srs button{padding:11px 14px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:bold;cursor:pointer;margin-top:12px}
      .srs button.alt{background:#35294f;border:1px solid #ffffff24}.srs .wide{width:100%}.srs .status{margin-top:14px;padding:12px;border-radius:10px;background:#ffffff0d;color:#ddd2f2;white-space:pre-wrap}
      .srs .hidden{display:none}.srs .muted{color:#b8accf;font-size:13px}.srs .room-row{padding:12px;border:1px solid #ffffff20;border-radius:12px;margin-top:9px}
    </style>
    <section class="srs">
      <h2>Комнаты</h2>
      <p>Общие настройки комнаты для этой игры. Создатель задаёт код и может изменить настройки до начала партии.</p>
      <div class="srs-grid">
        <div class="srs-card">
          <strong>Создать комнату</strong>
          <label for="srsName">Название комнаты</label><input id="srsName" maxlength="50" placeholder="Например, Вечерняя игра">
          <label for="srsCode">Код комнаты (придумай сам)</label><input id="srsCode" maxlength="16" placeholder="Например, FRIENDS7">
          <div class="muted">3–16 символов: латинские буквы, цифры, дефис или _</div>
          <label for="srsAccess">Доступ</label><select id="srsAccess"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
          <label for="srsPlayers">Количество игроков</label><select id="srsPlayers"><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option><option value="5">5 игроков</option><option value="6">6 игроков</option></select>
          <label for="srsTimer">Время на вопрос</label><select id="srsTimer"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60" selected>60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
          <button id="srsCreate" class="wide">Создать комнату</button>
        </div>
        <div class="srs-card">
          <strong>Подключиться</strong>
          <label for="srsJoinCode">Код комнаты</label><input id="srsJoinCode" maxlength="16" placeholder="Введи код от создателя">
          <button id="srsJoin" class="wide">Войти по коду</button>
          <button id="srsRefresh" class="wide alt">Найти открытые комнаты</button>
          <div id="srsPublicList"></div>
        </div>
      </div>
      <div id="srsStatus" class="status">Комната ещё не создана.</div>
      <div id="srsEdit" class="srs-card hidden" style="margin-top:14px">
        <strong>Редактирование комнаты</strong>
        <label for="srsEditName">Название</label><input id="srsEditName" maxlength="50">
        <label for="srsEditAccess">Доступ</label><select id="srsEditAccess"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
        <label for="srsEditPlayers">Количество игроков</label><select id="srsEditPlayers"><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option><option value="5">5 игроков</option><option value="6">6 игроков</option></select>
        <label for="srsEditTimer">Время на вопрос</label><select id="srsEditTimer"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
        <button id="srsSave">Сохранить настройки</button>
      </div>
    </section>`;

  const $ = id => root.querySelector("#" + id);
  const status = message => { $("srsStatus").textContent = message; };
  const settingsFrom = prefix => ({
    roomName: $(prefix+"Name").value.trim(),
    access: $(prefix+"Access").value,
    maxPlayers: Number($(prefix+"Players").value),
    timerSeconds: Number($(prefix+"Timer").value)
  });
  function syncEdit() {
    const settings = window.onlineGame.getSettings() || {};
    $("srsEditName").value = settings.roomName || "";
    $("srsEditAccess").value = settings.access || "private";
    $("srsEditPlayers").value = String(settings.maxPlayers || 2);
    $("srsEditTimer").value = String(settings.timerSeconds ?? 60);
    $("srsEdit").classList.toggle("hidden", !window.onlineGame.isRoomHost?.());
  }
  $("srsCreate").onclick = async () => {
    const settings = settingsFrom("srs");
    settings.roomCode = $("srsCode").value.trim().toUpperCase();
    if (!settings.roomName) return status("Введи название комнаты.");
    if (!settings.roomCode) return status("Придумай код комнаты.");
    $("srsCreate").disabled = true;
    const result = await window.onlineGame.createLobby(settings, gameId);
    $("srsCreate").disabled = false;
    if (!result.ok) return status(result.message || "Не удалось создать комнату.");
    status("Комната создана! Код: " + result.code + "\nИгроков: 1/" + (result.settings.maxPlayers || settings.maxPlayers));
    syncEdit();
  };
  $("srsJoin").onclick = async () => {
    const code = $("srsJoinCode").value.trim().toUpperCase();
    const result = await window.onlineGame.joinRoom(code, gameId);
    if (!result.ok) return status(result.message || "Не удалось подключиться.");
    const settings = result.settings || {};
    status("Ты подключился к комнате «" + (settings.roomName || "Комната") + "». Код: " + code + "\nИгроков: " + (settings.maxPlayers || 2));
    syncEdit();
  };
  $("srsRefresh").onclick = async () => {
    const result = await window.onlineGame.listPublicRooms(gameId);
    const list = $("srsPublicList");
    list.innerHTML = "";
    const rooms = result.rooms || [];
    if (!rooms.length) { list.textContent = "Открытых комнат пока нет."; return; }
    rooms.forEach(room => {
      const item = document.createElement("div"); item.className = "room-row";
      const title = document.createElement("strong"); title.textContent = room.name || "Комната";
      const info = document.createElement("div"); info.className = "muted";
      info.textContent = room.roomId + " · " + room.playersCount + "/" + room.maxPlayers + " игроков";
      const join = document.createElement("button"); join.textContent = "Войти";
      join.onclick = async () => {
        const joined = await window.onlineGame.joinRoom(room.roomId, gameId);
        status(joined.ok ? "Подключение к комнате «" + (joined.settings?.roomName || room.name) + "» выполнено." : (joined.message || "Не удалось войти."));
        syncEdit();
      };
      item.append(title, info, join); list.appendChild(item);
    });
  };
  $("srsSave").onclick = async () => {
    const settings = settingsFrom("srsEdit");
    const result = await window.onlineGame.updateRoomSettings(settings);
    status(result.ok ? "Настройки комнаты сохранены." : (result.message || "Не удалось сохранить настройки."));
    syncEdit();
  };
  document.addEventListener("online-room-settings-updated", syncEdit);
  document.addEventListener("online-player-joined", syncEdit);
  document.addEventListener("online-room-created", event => {
    if (event.detail?.code) status("Комната создана! Код: " + event.detail.code);
  });
  document.addEventListener("online-room-joined", syncEdit);
})();