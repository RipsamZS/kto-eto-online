(() => {
  "use strict";
  const gameId = window.ROOM_GAME_ID || "who-am-i";
  const root = document.getElementById("sharedRoomSystem");
  if (!root || !window.onlineGame || gameId !== "who-am-i") return;
  const isWhoAmI = gameId === "who-am-i";
  root.innerHTML = `
  <style>
  .srs{max-width:760px;margin:24px auto;padding:22px;border:1px solid #ffffff24;border-radius:22px;background:#211a38;color:#f6f2ff;font-family:Arial,sans-serif}\n  .srs.lobby-active{position:fixed;inset:0;z-index:50;width:100vw;height:100vh;max-width:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;overflow:hidden}\n  .srs.lobby-active #srsLobby{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0}\n  .srs.lobby-active #srsRoomTitle,.srs.lobby-active #srsRoomInfo,.srs.lobby-active #srsRoomCode,.srs.lobby-active #srsHostMenu,.srs.lobby-active #srsEdit,.srs.lobby-active #srsWordStage,.srs.lobby-active #srsLobbyActions,.srs.lobby-active #srsStatus{display:none!important}\n  .srs.lobby-active #srsSeating{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0}\n  .srs.lobby-active .srs-table-wrap{position:absolute;inset:0;width:100%;height:100%;min-height:100vh;margin:0}\n  .srs.lobby-active .srs-seat{width:clamp(82px,14vw,132px);min-height:74px}
  .srs h2,.srs h3{margin-top:0}.srs p{color:#c4b8d8;line-height:1.5}.srs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
  .srs-card{padding:17px;border:1px solid #ffffff20;border-radius:16px;background:#171329;margin-top:14px}.srs label{display:block;margin:10px 0 6px;color:#c4b8d8;font-size:13px}
  .srs input,.srs select{width:100%;padding:11px;border-radius:10px;border:1px solid #ffffff25;background:#100d20;color:#fff;font:inherit}
  .srs button{padding:12px 16px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:bold;cursor:pointer;margin-top:12px}
  .srs button:disabled{opacity:.5;cursor:not-allowed}.srs button.alt{background:#35294f;border:1px solid #ffffff24}.srs .wide{width:100%}.srs .hidden{display:none!important}
  .srs .status{margin-top:14px;padding:12px;border-radius:10px;background:#ffffff0d;color:#ddd2f2;white-space:pre-wrap}.srs .muted{color:#b8accf;font-size:13px}
  .srs .room-row{padding:12px;border:1px solid #ffffff20;border-radius:12px;margin-top:9px}.srs-menu{position:relative;display:inline-block}
  .srs-menu-panel{position:absolute;right:0;top:100%;z-index:20;min-width:230px;padding:8px;border:1px solid #ffffff30;border-radius:12px;background:#171329;box-shadow:0 12px 32px #0008}
  .srs-menu-panel button{width:100%;margin:0;text-align:left;background:#35294f}.srs-word{font-size:clamp(28px,7vw,48px);font-weight:800;letter-spacing:1px;text-align:center;padding:24px 8px}
  .srs-code-field{margin-top:8px}.srs-code-field.hidden{display:none!important}\n  #srsLobby{position:relative;padding-top:48px}\n  #srsHostMenu{position:absolute;top:0;left:0;right:auto;z-index:30}\n  #srsSeating{padding:0;border:0;border-radius:0;background:transparent;margin:0}\n  #srsSeating h3,#srsSeating>p{display:none}\n  #srsLobbyActions{margin-top:auto;padding-top:18px}\n  #srsLobbyActions button{display:block;width:100%}
  .srs-table-wrap{position:relative;min-height:350px;margin:8px 0;border:0;border-radius:0;background:transparent;overflow:visible}
  .srs-seat{position:absolute;transform:translate(-50%,-50%);width:clamp(88px,24%,150px);min-height:76px;padding:8px 5px!important;margin:0!important;border:1px solid #ffffff30!important;border-radius:14px!important;background:#35294f!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;white-space:normal}
  .srs-seat .avatar{font-size:27px;line-height:1.1}.srs-seat .nickname{font-size:12px;max-width:100%;overflow-wrap:anywhere}.srs-seat .seat-note{font-size:10px;color:#d6c8f4;font-weight:400}
  .srs-seat.occupied{background:#4b3470!important;border-color:#a78bfa!important}.srs-seat.mine{outline:2px solid #c4b5fd;outline-offset:2px}.srs-seat:disabled{opacity:1;cursor:default}
  .srs-seat-0{left:50%;top:12%}.srs-seat-1{left:82%;top:28%}.srs-seat-2{left:82%;top:72%}.srs-seat-3{left:50%;top:88%}.srs-seat-4{left:18%;top:72%}.srs-seat-5{left:18%;top:28%}
  @media(max-width:480px){.srs-table-wrap{min-height:320px}.srs-seat{width:27%;min-height:68px}.srs-code-field{margin-top:8px}}
  </style>
  <section class="srs">
    <div id="srsHome">
      <p>Создай свою комнату или подключись к друзьям по коду.</p>
      
      <div class="srs-grid">
        <button id="srsShowCreate" class="wide">Создать комнату</button>
        <button id="srsShowJoin" class="wide alt">Подключиться</button>
      </div>
    </div>
    <div id="srsCreateView" class="hidden">
      <button id="srsBackCreate" class="alt">← Назад</button><h2>Создать комнату</h2>
      <label for="srsName">Название комнаты</label><input id="srsName" maxlength="50" placeholder="Например, Вечерняя игра">
      <div id="srsCodeField" class="srs-code-field"><label for="srsCode">Код комнаты</label><input id="srsCode" maxlength="16" placeholder="Придумай свой код"><div class="muted">3–16 символов: латинские буквы, цифры, дефис или подчёркивание</div></div>
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
      <div id="srsSeating"><div id="srsTable" class="srs-table-wrap"></div><div id="srsSeatStatus" class="muted"></div></div>
      <div id="srsHostMenu" class="srs-menu hidden">
        <button id="srsMenuToggle" class="alt" type="button" aria-expanded="false">☰ Меню</button>
        <div id="srsMenuPanel" class="srs-menu-panel hidden"><button id="srsEditAction" type="button">⚙ Редактировать комнату</button></div>
      </div>
      <div id="srsEdit" class="srs-card hidden"><h3>Редактирование комнаты</h3>
        <label for="srsEditName">Название</label><input id="srsEditName" maxlength="50">
        <label for="srsEditAccess">Доступ</label><select id="srsEditAccess"><option value="private">Закрытая</option><option value="public">Открытая</option></select>
        <label for="srsEditPlayers">Количество игроков</label><select id="srsEditPlayers"><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option><option value="5">5 игроков</option><option value="6">6 игроков</option></select>
        <label for="srsEditTimer">Время на вопрос</label><select id="srsEditTimer"><option value="15">15 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option><option value="0">Без ограничения</option></select>
        <button id="srsSave">Сохранить настройки</button><button id="srsCancelEdit" class="alt">Отмена</button>
      </div>
      <div id="srsWordStage" class="srs-card hidden"><h3 id="srsWordHeading">Раздача слов</h3><p id="srsWordInstruction"></p>
        <div id="srsWordEntry" class="hidden"><label for="srsWordInput">Придумай слово для следующего игрока</label><input id="srsWordInput" maxlength="40" autocomplete="off" placeholder="Напиши слово…"><button id="srsSubmitWord" class="wide">Отправить слово</button></div>
        <div id="srsWordWaiting" class="hidden status">Слово отправлено. Ждём остальных игроков. Ты не увидишь слово, которое отправил.</div>
        <div id="srsSecretWord" class="hidden"><p>Твоё слово:</p><div class="srs-word" id="srsSecretWordValue"></div><p>Не показывай экран другим игрокам. Теперь можно начинать угадывать!</p></div>
        <div id="srsPlayPanel" class="hidden">
          <div class="status" id="srsTurnStatus">Ожидаем ход…</div>
          <div id="srsQuestionForm" class="hidden"><label for="srsQuestionInput">Задай вопрос всем игрокам</label><input id="srsQuestionInput" maxlength="180" placeholder="Например: Я живое существо?"><button id="srsAskQuestion" class="wide">Задать вопрос</button></div>
          <div id="srsAnswerPanel" class="hidden"><p id="srsQuestionText"></p><button data-answer="yes">Да</button><button data-answer="no" class="alt">Нет</button><button data-answer="unknown" class="alt">Не знаю</button></div>
          <div id="srsGuessForm" class="hidden"><label for="srsGuessInput">Попробуй угадать своё слово</label><input id="srsGuessInput" maxlength="40" placeholder="Твоя догадка"><button id="srsGuessButton">Проверить</button></div>
          <button id="srsPassTurn" class="alt">Передать ход</button>
        </div>
        <div id="srsFinished" class="hidden status"><h3>Игра завершена</h3><p id="srsFinishedText"></p><button id="srsPlayAgain" class="alt">В меню</button></div>
      </div>
      <div id="srsLobbyActions"><button id="srsStart" class="wide hidden">Начать игру</button><button id="srsLeave" class="wide alt">Покинуть комнату</button></div>
    </div>
    <div id="srsStatus" class="status">Выбери действие, чтобы продолжить.</div>
  </section>`;
  const $ = id => root.querySelector("#"+id);
  const status = message => $("srsStatus").textContent = message;
  let playersCount=0,maxPlayers=2,started=false,roster=[];
  const show = id => { ["srsHome","srsCreateView","srsJoinView","srsLobby"].forEach(x=>$(x).classList.toggle("hidden",x!==id)); root.querySelector(".srs").classList.toggle("lobby-active",id==="srsLobby"); };
  function getProfile(){try{const profile=JSON.parse(localStorage.getItem("kto-eto-profile-v1")||"null");if(profile&&typeof profile.nickname==="string"&&profile.nickname.trim())return {nickname:profile.nickname.trim().slice(0,20),avatar:profile.avatar||"🙂"};}catch{}window.location.replace("/");return {nickname:"Игрок",avatar:"🙂"};}
  const profile=getProfile();
  const settingsFrom = prefix => ({roomName:$(prefix+"Name").value.trim(),access:$(prefix+"Access").value,maxPlayers:Number($(prefix+"Players").value),timerSeconds:Number($(prefix+"Timer").value),nickname:profile.nickname,avatar:profile.avatar});
  function syncRoom(settings){
    settings=settings||window.onlineGame.getSettings()||{};
    $("srsRoomTitle").textContent=settings.roomName||"Комната";
    $("srsRoomCode").textContent="Код комнаты: "+(window.onlineGame.getRoomCode()||settings.roomCode||"—");
    maxPlayers=Number(settings.maxPlayers||maxPlayers||2);
    $("srsRoomInfo").textContent="Игроков в комнате: "+playersCount+"/"+maxPlayers+(started?" · Игра началась":" · Ожидаем подключения");
    const host=!!window.onlineGame.isRoomHost();
    $("srsHostMenu").classList.toggle("hidden",!host);
    $("srsStart").classList.toggle("hidden",!host||started);
    const allSeated=roster.length===playersCount&&roster.every(player=>Number.isInteger(player.seatIndex));
    $("srsStart").disabled=playersCount!==maxPlayers||!allSeated;
    if(host){
      $("srsEditName").value=settings.roomName||"";
      $("srsEditAccess").value=settings.access||"private";
      $("srsEditPlayers").value=String(maxPlayers);
      $("srsEditTimer").value=String(settings.timerSeconds??60);
    }
  }
  function renderSeats(){
    const table=$("srsTable");if(!table)return;
    table.querySelectorAll(".srs-seat").forEach(node=>node.remove());
    const me=window.onlineGame.getPlayerId();
    const seats=Array.from({length:Math.min(6,maxPlayers)},(_,i)=>i);
    seats.forEach(index=>{
      const player=roster.find(item=>item.seatIndex===index);
      const button=document.createElement("button");button.type="button";button.className="srs-seat";const angle=-Math.PI/2+index*(2*Math.PI/seats.length);button.style.left=(50+45*Math.cos(angle))+"%";button.style.top=(50+43*Math.sin(angle))+"%";
      if(player){button.classList.add("occupied");if(player.id===me)button.classList.add("mine");button.disabled=player.id!==me||started;const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=player.avatar||"🙂";const nick=document.createElement("span");nick.className="nickname";nick.textContent=player.nickname||"Игрок";const note=document.createElement("span");note.className="seat-note";note.textContent=player.id===me?"Твоё место":(player.isHost?"Создатель":"Игрок");button.append(avatar,nick,note);}
      else{button.disabled=started;const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent="＋";const nick=document.createElement("span");nick.className="nickname";nick.textContent="Свободно";const note=document.createElement("span");note.className="seat-note";note.textContent="Нажми, чтобы сесть";button.append(avatar,nick,note);button.onclick=async()=>{button.disabled=true;const result=await window.onlineGame.selectSeat(index);if(!result.ok){status(result.message||"Не удалось занять место.");button.disabled=false;}};}
      table.append(button);
    });
    const mySeat=roster.find(player=>player.id===me&&Number.isInteger(player.seatIndex));
    $("srsSeatStatus").textContent="";
  }
  function enterLobby(result,host){
    show("srsLobby");playersCount=host?1:Math.max(1,Number(result.playersCount||1));
    maxPlayers=Number(result.settings?.maxPlayers||2);started=false;
    syncRoom(result.settings);renderSeats();status("");
  }
  $("srsShowCreate").onclick=()=>show("srsCreateView");
  $("srsAccess").addEventListener("change",()=>{$("srsCodeField").classList.toggle("hidden",$("srsAccess").value==="public");});
  $("srsShowJoin").onclick=()=>show("srsJoinView");
  $("srsBackCreate").onclick=()=>show("srsHome");
  $("srsBackJoin").onclick=()=>show("srsHome");
  $("srsCreate").onclick=async()=>{
    const settings=settingsFrom("srs");settings.roomCode=settings.access==="public"?("PUB"+Math.random().toString(36).slice(2,9).toUpperCase()):$("srsCode").value.trim().toUpperCase();
    if(!settings.roomName)return status("Введи название комнаты.");
    if(!settings.roomCode)return status("Придумай код комнаты.");
    $("srsCreate").disabled=true;const result=await window.onlineGame.createLobby(settings,gameId);$("srsCreate").disabled=false;
    if(!result.ok)return status(result.message||"Не удалось создать комнату.");
    enterLobby(result,true);
  };
  async function join(code){
    const result=await window.onlineGame.joinRoom(code,gameId,profile);
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
  $("srsLeave").onclick=()=>window.onlineGame.leaveRoom();
  $("srsStart").onclick=async()=>{const result=await window.onlineGame.startWordRound();if(!result.ok)status(result.message||"Не удалось начать игру.");};
  $("srsSubmitWord").onclick=async()=>{const word=$("srsWordInput").value.trim();const result=await window.onlineGame.submitPlayerWord(word);if(!result.ok)return status(result.message||"Не удалось отправить слово.");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.remove("hidden");$("srsWordInput").value="";};
  $("srsAskQuestion").onclick=async()=>{const result=await window.onlineGame.askWhoAmIQuestion($("srsQuestionInput").value.trim());if(!result.ok)return status(result.message||"Не удалось задать вопрос.");$("srsQuestionForm").classList.add("hidden");$("srsGuessForm").classList.add("hidden");$("srsPassTurn").classList.add("hidden");$("srsQuestionInput").value="";status("Вопрос отправлен. Ждём ответ.");};
  $("srsAnswerPanel").querySelectorAll("[data-answer]").forEach(b=>b.onclick=async()=>{const result=await window.onlineGame.answerWhoAmIQuestion(b.dataset.answer);if(!result.ok)return status(result.message||"Не удалось ответить.");$("srsAnswerPanel").classList.add("hidden");});
  $("srsGuessButton").onclick=async()=>{const result=await window.onlineGame.guessWhoAmI($("srsGuessInput").value.trim());if(!result.ok)return status(result.message||"Не удалось проверить.");$("srsGuessInput").value="";if(!result.correct)status("Неверно. Ход переходит дальше.");};
  $("srsPassTurn").onclick=async()=>{const result=await window.onlineGame.passWhoAmITurn();if(!result.ok)status(result.message||"Не удалось передать ход.");};
  $("srsPlayAgain").onclick=()=>{window.onlineGame.leaveRoom();show("srsHome");};
  document.addEventListener("room-roster",e=>{roster=Array.isArray(e.detail.players)?e.detail.players:roster;playersCount=Number(e.detail.playersCount??playersCount);maxPlayers=Number(e.detail.maxPlayers||maxPlayers);syncRoom();renderSeats();});
  document.addEventListener("online-opponent-connected",e=>{playersCount=Number(e.detail.playersCount||playersCount+1);syncRoom();});
  document.addEventListener("online-opponent-left",e=>{playersCount=Number(e.detail.playersCount||Math.max(1,playersCount-1));syncRoom();});
  document.addEventListener("room-host-changed",()=>syncRoom());
  document.addEventListener("room-settings-updated",e=>syncRoom(e.detail));
  document.addEventListener("word-round-start",()=>{started=true;$("srsStart").classList.add("hidden");$("srsWordStage").classList.remove("hidden");$("srsWordInstruction").textContent="Все игроки по очереди отправляют слово следующему по кругу. Получатель не увидит его до завершения раздачи.";syncRoom();});
  document.addEventListener("word-entry-turn",e=>{$("srsWordStage").classList.remove("hidden");$("srsWordEntry").classList.remove("hidden");$("srsWordWaiting").classList.add("hidden");$("srsSecretWord").classList.add("hidden");$("srsWordHeading").textContent="Твой ход — игрок "+e.detail.playerNumber+" из "+e.detail.totalPlayers;$("srsWordInstruction").textContent="Придумай одно слово для игрока №"+e.detail.targetPlayerNumber+". Не вводи своё имя.";});
  document.addEventListener("word-submitted",e=>status(e.detail.message||"Слово принято."));
  document.addEventListener("word-submission-progress",e=>status("Слова отправили "+e.detail.submitted+" из "+e.detail.total+" игроков."));
  document.addEventListener("your-secret-word",e=>{$("srsWordStage").classList.remove("hidden");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.add("hidden");$("srsSecretWord").classList.remove("hidden");$("srsSecretWordValue").textContent=e.detail.word;status("Раздача завершена. Твоё слово готово!");});
  document.addEventListener("word-round-complete",()=>{status("Все слова розданы. Игра начинается!");$("srsPlayPanel").classList.remove("hidden");});
  document.addEventListener("who-am-i-turn",e=>{$("srsPlayPanel").classList.remove("hidden");$("srsAnswerPanel").classList.add("hidden");$("srsTurnStatus").textContent=e.detail.isYourTurn?"Твой ход — игрок №"+e.detail.playerNumber:"Ход игрока №"+e.detail.playerNumber+" из "+e.detail.totalPlayers;$("srsQuestionForm").classList.toggle("hidden",!e.detail.isYourTurn);$("srsGuessForm").classList.toggle("hidden",!e.detail.isYourTurn);$("srsPassTurn").classList.toggle("hidden",!e.detail.isYourTurn);});
  document.addEventListener("who-am-i-question",e=>{$("srsAnswerPanel").classList.remove("hidden");$("srsQuestionText").textContent="Игрок №"+e.detail.askerNumber+" спрашивает: "+e.detail.question;$("srsQuestionForm").classList.add("hidden");$("srsGuessForm").classList.add("hidden");$("srsPassTurn").classList.add("hidden");});
  document.addEventListener("who-am-i-answer",e=>{status("Ответ игрока №"+e.detail.responderNumber+": "+({yes:"Да",no:"Нет",unknown:"Не знаю"}[e.detail.answer]));$("srsAnswerPanel").classList.add("hidden");});
  document.addEventListener("who-am-i-guess-result",e=>status(e.detail.message));
  document.addEventListener("who-am-i-turn-timeout",e=>status(e.detail.message));
  document.addEventListener("who-am-i-finished",e=>{$("srsPlayPanel").classList.add("hidden");$("srsFinished").classList.remove("hidden");$("srsFinishedText").textContent=e.detail.message;status("Партия завершена.");});
  document.addEventListener("word-round-reset",e=>{started=false;$("srsPlayPanel").classList.add("hidden");$("srsFinished").classList.add("hidden");$("srsWordStage").classList.add("hidden");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.add("hidden");$("srsSecretWord").classList.add("hidden");syncRoom();status(e.detail.message||"Раздача слов сброшена.");});
  document.addEventListener("online-room-left",()=>{show("srsHome");started=false;});
})();
(() => {
  "use strict";
  const gameId = window.ROOM_GAME_ID || "who-am-i";
  const root = document.getElementById("sharedRoomSystem");
  if (!root || !window.onlineGame || gameId === "who-am-i") return;

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