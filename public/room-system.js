(() => {
  "use strict";
  const gameId = window.ROOM_GAME_ID || "who-am-i";
  const root = document.getElementById("sharedRoomSystem");
  if (!root || !window.onlineGame) return;
  const isWhoAmI = gameId === "who-am-i";
  root.innerHTML = `
  <style>
  .srs{max-width:760px;margin:24px auto;padding:22px;border:1px solid #ffffff24;border-radius:22px;background:#211a38;color:#f6f2ff;font-family:Arial,sans-serif}
  .srs h2,.srs h3{margin-top:0}.srs p{color:#c4b8d8;line-height:1.5}.srs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
  .srs-card{padding:17px;border:1px solid #ffffff20;border-radius:16px;background:#171329;margin-top:14px}.srs label{display:block;margin:10px 0 6px;color:#c4b8d8;font-size:13px}
  .srs input,.srs select{width:100%;padding:11px;border-radius:10px;border:1px solid #ffffff25;background:#100d20;color:#fff;font:inherit}
  .srs button{padding:12px 16px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:bold;cursor:pointer;margin-top:12px}
  .srs button:disabled{opacity:.5;cursor:not-allowed}.srs button.alt{background:#35294f;border:1px solid #ffffff24}.srs .wide{width:100%}.srs .hidden{display:none!important}
  .srs .status{margin-top:14px;padding:12px;border-radius:10px;background:#ffffff0d;color:#ddd2f2;white-space:pre-wrap}.srs .muted{color:#b8accf;font-size:13px}
  .srs .room-row{padding:12px;border:1px solid #ffffff20;border-radius:12px;margin-top:9px}.srs-menu{position:relative;display:inline-block}
  .srs-menu-panel{position:absolute;right:0;top:100%;z-index:20;min-width:230px;padding:8px;border:1px solid #ffffff30;border-radius:12px;background:#171329;box-shadow:0 12px 32px #0008}
  .srs-menu-panel button{width:100%;margin:0;text-align:left;background:#35294f}.srs-word{font-size:clamp(28px,7vw,48px);font-weight:800;letter-spacing:1px;text-align:center;padding:24px 8px}
  </style>
  <section class="srs">
    <div id="srsHome">
      <h2>Кто я?</h2><p>Создай свою комнату или подключись к друзьям по коду.</p>
      <div class="srs-grid">
        <button id="srsShowCreate" class="wide">Создать комнату</button>
        <button id="srsShowJoin" class="wide alt">Подключиться</button>
      </div>
    </div>
    <div id="srsCreateView" class="hidden">
      <button id="srsBackCreate" class="alt">← Назад</button><h2>Создать комнату</h2>
      <label for="srsName">Название комнаты</label><input id="srsName" maxlength="50" placeholder="Например, Вечерняя игра">
      <label for="srsCode">Код комнаты</label><input id="srsCode" maxlength="16" placeholder="Придумай свой код">
      <div class="muted">3–16 символов: латинские буквы, цифры, дефис или подчёркивание</div>
      <label for="srsAccess">Доступ</label><select id="srsAccess"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
      <label for="srsPlayers">Количество игроков</label><select id="srsPlayers"><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option><option value="5">5 игроков</option><option value="6">6 игроков</option></select>
      <label for="srsTimer">Время на вопрос</label><select id="srsTimer"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60" selected>60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
      <button id="srsCreate" class="wide">Создать комнату</button>
    </div>
    <div id="srsJoinView" class="hidden">
      <button id="srsBackJoin" class="alt">← Назад</button><h2>Подключиться</h2>
      <label for="srsJoinCode">Код комнаты</label><input id="srsJoinCode" maxlength="16" placeholder="Введи код от создателя">
      <button id="srsJoin" class="wide">Войти по коду</button><button id="srsRefresh" class="wide alt">Найти открытые комнаты</button><div id="srsPublicList"></div>
    </div>
    <div id="srsLobby" class="hidden">
      <h2 id="srsRoomTitle">Комната</h2><p id="srsRoomInfo">Ожидаем игроков…</p>
      <div class="status" id="srsRoomCode">Код комнаты: —</div>
      <div id="srsHostMenu" class="srs-menu hidden">
        <button id="srsMenuToggle" class="alt" type="button" aria-expanded="false">☰ Меню</button>
        <div id="srsMenuPanel" class="srs-menu-panel hidden"><button id="srsEditAction" type="button">⚙ Редактировать комнату</button></div>
      </div>
      <button id="srsStart" class="wide hidden">Начать игру</button>
      <div id="srsEdit" class="srs-card hidden"><h3>Редактирование комнаты</h3>
        <label for="srsEditName">Название</label><input id="srsEditName" maxlength="50">
        <label for="srsEditAccess">Доступ</label><select id="srsEditAccess"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
        <label for="srsEditPlayers">Количество игроков</label><select id="srsEditPlayers"><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option><option value="5">5 игроков</option><option value="6">6 игроков</option></select>
        <label for="srsEditTimer">Время на вопрос</label><select id="srsEditTimer"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
        <button id="srsSave">Сохранить настройки</button><button id="srsCancelEdit" class="alt">Отмена</button>
      </div>
      <div id="srsWordStage" class="srs-card hidden"><h3 id="srsWordHeading">Раздача слов</h3><p id="srsWordInstruction"></p>
        <div id="srsWordEntry"><label for="srsWordInput">Придумай слово для следующего игрока</label><input id="srsWordInput" maxlength="40" autocomplete="off" placeholder="Напиши слово…"><button id="srsSubmitWord" class="wide">Отправить слово</button></div>
        <div id="srsWordWaiting" class="hidden status">Слово отправлено. Ждём остальных игроков. Ты не увидишь слово, которое отправил.</div>
        <div id="srsSecretWord" class="hidden"><p>Твоё слово:</p><div class="srs-word" id="srsSecretWordValue"></div><p>Не показывай экран другим игрокам. Теперь можно начинать угадывать!</p></div>
      </div>
    </div>
    <div id="srsStatus" class="status">Выбери действие, чтобы продолжить.</div>
  </section>`;
  const $ = id => root.querySelector("#"+id);
  const status = message => $("srsStatus").textContent = message;
  let playersCount=0,maxPlayers=2,started=false;
  const show = id => ["srsHome","srsCreateView","srsJoinView","srsLobby"].forEach(x=>$(x).classList.toggle("hidden",x!==id));
  const settingsFrom = prefix => ({roomName:$(prefix+"Name").value.trim(),access:$(prefix+"Access").value,maxPlayers:Number($(prefix+"Players").value),timerSeconds:Number($(prefix+"Timer").value)});
  function syncRoom(settings){
    settings=settings||window.onlineGame.getSettings()||{};
    $("srsRoomTitle").textContent=settings.roomName||"Комната";
    $("srsRoomCode").textContent="Код комнаты: "+(window.onlineGame.getRoomCode()||settings.roomCode||"—");
    maxPlayers=Number(settings.maxPlayers||maxPlayers||2);
    $("srsRoomInfo").textContent="Игроков в комнате: "+playersCount+"/"+maxPlayers+(started?" · Игра началась":" · Ожидаем подключения");
    const host=!!window.onlineGame.isRoomHost();
    $("srsHostMenu").classList.toggle("hidden",!host);
    $("srsStart").classList.toggle("hidden",!host||started);
    $("srsStart").disabled=playersCount!==maxPlayers;
    if(host){
      $("srsEditName").value=settings.roomName||"";
      $("srsEditAccess").value=settings.access||"private";
      $("srsEditPlayers").value=String(maxPlayers);
      $("srsEditTimer").value=String(settings.timerSeconds??60);
    }
  }
  function enterLobby(result,host){
    show("srsLobby");playersCount=host?1:Math.max(2,Number(result.playersCount||2));
    maxPlayers=Number(result.settings?.maxPlayers||2);started=false;
    syncRoom(result.settings);status(host?"Комната создана. Отправь код друзьям.":"Ты подключился к комнате. Ожидаем начала игры.");
  }
  $("srsShowCreate").onclick=()=>show("srsCreateView");
  $("srsShowJoin").onclick=()=>show("srsJoinView");
  $("srsBackCreate").onclick=()=>show("srsHome");
  $("srsBackJoin").onclick=()=>show("srsHome");
  $("srsCreate").onclick=async()=>{
    const settings=settingsFrom("srs");settings.roomCode=$("srsCode").value.trim().toUpperCase();
    if(!settings.roomName)return status("Введи название комнаты.");
    if(!settings.roomCode)return status("Придумай код комнаты.");
    $("srsCreate").disabled=true;const result=await window.onlineGame.createLobby(settings,gameId);$("srsCreate").disabled=false;
    if(!result.ok)return status(result.message||"Не удалось создать комнату.");
    enterLobby(result,true);
  };
  async function join(code){
    const result=await window.onlineGame.joinRoom(code,gameId);
    if(!result.ok){status(result.message||"Не удалось подключиться.");return;}
    enterLobby(result,false);
  }
  $("srsJoin").onclick=()=>join($("srsJoinCode").value.trim().toUpperCase());
  $("srsRefresh").onclick=async()=>{
    const result=await window.onlineGame.listPublicRooms(gameId),list=$("srsPublicList");list.innerHTML="";
    if(!result.rooms?.length){list.textContent="Открытых комнат пока нет.";return;}
    result.rooms.forEach(room=>{const item=document.createElement("div");item.className="room-row";const title=document.createElement("strong");title.textContent=room.name||"Комната";const info=document.createElement("div");info.className="muted";info.textContent=room.roomId+" · "+room.playersCount+"/"+room.maxPlayers+" игроков";const button=document.createElement("button");button.textContent="Войти";button.onclick=()=>join(room.roomId);item.append(title,info,button);list.append(item);});
  };
  $("srsMenuToggle").onclick=()=>{const open=!$("srsMenuPanel").classList.contains("hidden");$("srsMenuPanel").classList.toggle("hidden",open);$("srsMenuToggle").setAttribute("aria-expanded",String(!open));};
  $("srsEditAction").onclick=()=>{$("srsMenuPanel").classList.add("hidden");$("srsEdit").classList.remove("hidden");};
  $("srsCancelEdit").onclick=()=>$("srsEdit").classList.add("hidden");
  $("srsSave").onclick=async()=>{const result=await window.onlineGame.updateRoomSettings(settingsFrom("srsEdit"));if(!result.ok)return status(result.message||"Не удалось сохранить настройки.");$("srsEdit").classList.add("hidden");syncRoom(result.settings);status("Настройки комнаты сохранены.");};
  $("srsStart").onclick=async()=>{const result=await window.onlineGame.startWordRound();if(!result.ok)status(result.message||"Не удалось начать игру.");};
  $("srsSubmitWord").onclick=async()=>{const word=$("srsWordInput").value.trim();const result=await window.onlineGame.submitPlayerWord(word);if(!result.ok)return status(result.message||"Не удалось отправить слово.");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.remove("hidden");};
  document.addEventListener("room-roster",e=>{playersCount=Number(e.detail.playersCount||playersCount);maxPlayers=Number(e.detail.maxPlayers||maxPlayers);syncRoom();});
  document.addEventListener("online-opponent-connected",e=>{playersCount=Number(e.detail.playersCount||playersCount+1);syncRoom();});
  document.addEventListener("room-settings-updated",e=>syncRoom(e.detail));
  document.addEventListener("word-round-start",()=>{started=true;$("srsStart").classList.add("hidden");$("srsWordStage").classList.remove("hidden");$("srsWordInstruction").textContent="Все игроки по очереди отправляют слово следующему по кругу. Получатель не увидит его до завершения раздачи.";syncRoom();});
  document.addEventListener("word-entry-turn",e=>{$("srsWordStage").classList.remove("hidden");$("srsWordEntry").classList.remove("hidden");$("srsWordWaiting").classList.add("hidden");$("srsSecretWord").classList.add("hidden");$("srsWordHeading").textContent="Твой ход — игрок "+e.detail.playerNumber+" из "+e.detail.totalPlayers;$("srsWordInstruction").textContent="Придумай одно слово для игрока №"+e.detail.targetPlayerNumber+". Не вводи своё имя.";});
  document.addEventListener("word-submitted",e=>status(e.detail.message||"Слово принято."));
  document.addEventListener("word-submission-progress",e=>status("Слова отправили "+e.detail.submitted+" из "+e.detail.total+" игроков."));
  document.addEventListener("your-secret-word",e=>{$("srsWordStage").classList.remove("hidden");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.add("hidden");$("srsSecretWord").classList.remove("hidden");$("srsSecretWordValue").textContent=e.detail.word;status("Раздача завершена. Твоё слово готово!");});
  document.addEventListener("word-round-complete",()=>{status("Все слова розданы. Игра начинается!");});
  document.addEventListener("online-room-left",()=>{show("srsHome");started=false;});
})();