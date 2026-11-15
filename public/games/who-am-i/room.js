(() => {
  "use strict";
  const gameId = window.ROOM_GAME_ID || "who-am-i";
  const root = document.getElementById("sharedRoomSystem");
  if (!root || !window.onlineGame || gameId !== "who-am-i") return;
  const isWhoAmI = gameId === "who-am-i";
  root.innerHTML = `
  <style>
  .srs{max-width:760px;margin:24px auto;padding:22px;border:1px solid #ffffff24;border-radius:22px;background:#211a38;color:#f6f2ff;font-family:Arial,sans-serif}
  .srs.lobby-active{position:fixed;inset:0;z-index:50;width:100vw;height:100vh;max-width:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;overflow:hidden}
  .srs.lobby-active #srsLobby{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0}
  .srs.lobby-active #srsRoomTitle,.srs.lobby-active #srsRoomInfo,.srs.lobby-active #srsRoomCode,.srs.lobby-active #srsEdit,.srs.lobby-active #srsWordStage,.srs.lobby-active #srsLobbyActions,.srs.lobby-active #srsStatus{display:none!important}
  .srs.lobby-active #srsSeating{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0}
  .srs.lobby-active .srs-table-wrap{position:absolute;inset:0;width:100%;height:100%;min-height:100vh;margin:0}
  .srs.lobby-active .srs-seat{width:clamp(112px,16vw,166px);min-height:90px}
  .srs-answer-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.srs-answer-actions button{flex:1;min-width:100px;background:#6546a5;color:#fff;border-radius:12px;padding:12px}.srs-answer-actions button:hover{filter:brightness(1.08)}
  .srs h2,.srs h3{margin-top:0}.srs p{color:#c4b8d8;line-height:1.5}.srs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
  .srs-card{padding:17px;border:1px solid #ffffff20;border-radius:16px;background:#171329;margin-top:14px}.srs label{display:block;margin:10px 0 6px;color:#c4b8d8;font-size:13px}
  .srs input,.srs select{width:100%;padding:11px;border-radius:10px;border:1px solid #ffffff25;background:#100d20;color:#fff;font:inherit}
  .srs button{padding:12px 16px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:bold;cursor:pointer;margin-top:12px}
  .srs button:disabled{opacity:.5;cursor:not-allowed}.srs button.alt{background:#35294f;border:1px solid #ffffff24}.srs .wide{width:100%}.srs .hidden{display:none!important}
  .srs .status{margin-top:14px;padding:12px;border-radius:10px;background:#ffffff0d;color:#ddd2f2;white-space:pre-wrap}.srs .muted{color:#b8accf;font-size:13px}
  .srs .room-row{padding:12px;border:1px solid #ffffff20;border-radius:12px;margin-top:9px}.srs-menu{position:relative;display:inline-block}
  .srs-menu-panel{position:absolute;right:0;top:100%;z-index:20;min-width:230px;padding:8px;border:1px solid #ffffff30;border-radius:12px;background:#171329;box-shadow:0 12px 32px #0008}
  .srs-menu-panel button{width:100%;margin:0;text-align:left;background:#35294f}.srs-word{font-size:clamp(28px,7vw,48px);font-weight:800;letter-spacing:1px;text-align:center;padding:24px 8px}
  .srs-code-field{margin-top:8px}.srs-code-field.hidden{display:none!important}
  #srsLobby{position:relative;padding-top:48px}
  #srsHostMenu{position:absolute;top:50%;left:50%;right:auto;z-index:60;transform:translate(-50%,-50%)}
  .srs.lobby-active #srsHostMenu{display:block!important}
  .srs.lobby-active.writing-active #srsWordStage{display:block!important;position:fixed;left:50%!important;top:50%!important;z-index:75;width:min(360px,calc(100vw - 36px));max-height:75vh;overflow:auto;margin:0;padding:18px;transform:translate(-50%,-50%);box-shadow:0 8px 28px #000b}
  .srs.lobby-active.writing-active #srsWordStage h3,.srs.lobby-active.writing-active #srsWordStage>p{display:none}
  #srsWriterTag{position:absolute;z-index:64;transform:translate(-50%,-100%);padding:5px 8px;border:1px solid #c4b5fd;border-radius:7px;background:#171329;color:#f4eaff;font-size:11px;white-space:nowrap;pointer-events:none}
  #srsMenuToggle{width:clamp(76px,11vw,108px);height:clamp(76px,11vw,108px);padding:8px;margin:0;border:2px solid #c4b5fd;border-radius:50%;background:#7c3aed;box-shadow:0 8px 30px #0008;font-size:15px}
  #srsMenuToggle:hover{background:#8b5cf6}
  .srs-menu-panel{top:calc(100% + 12px);left:50%;right:auto;transform:translateX(-50%)}
  #srsSeating{padding:0;border:0;border-radius:0;background:transparent;margin:0}
  #srsSeating h3,#srsSeating>p{display:none}
  #srsLobbyActions{margin-top:auto;padding-top:18px}
  #srsLobbyActions button{display:block;width:100%}
  .srs-table-wrap{position:relative;min-height:350px;margin:8px 0;border:0;border-radius:0;background:transparent;overflow:visible}
  .srs-seat{position:absolute;transform:translate(-50%,-50%);width:clamp(112px,27%,166px);min-height:90px;padding:8px 5px!important;margin:0!important;border:1px solid #ffffff30!important;border-radius:14px!important;background:#35294f!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;white-space:normal}
  .srs-player-word{position:absolute;z-index:45;transform:translate(-50%,-100%);min-width:54px;max-width:min(180px,30vw);padding:4px 8px;border:1px solid #c4b5fd;border-radius:7px;background:#171329;color:#f4eaff;font-size:12px;line-height:1.2;font-weight:800;overflow-wrap:anywhere;text-align:center;box-shadow:0 3px 12px #0008;pointer-events:none}.srs-seat .avatar{font-size:27px;line-height:1.1}.srs-seat .avatar.avatar-image{width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #c4b5fd}.srs-seat .nickname{font-size:12px;max-width:100%;overflow-wrap:anywhere}.srs-seat .seat-note{font-size:10px;color:#d6c8f4;font-weight:400}
  .srs-seat.occupied{background:#4b3470!important;border-color:#a78bfa!important}.srs-seat.mine{outline:2px solid #c4b5fd;outline-offset:2px}.srs-seat:disabled{opacity:1!important;filter:none!important;cursor:default}.srs-seat.winner{border:2px solid #f6c453!important;background:linear-gradient(135deg,#76521b,#49320f)!important;box-shadow:0 0 10px #fbbf2477,0 0 26px #f59e0b99,inset 0 0 18px #fbbf2433!important;animation:srs-winner-glow 1.8s ease-in-out infinite alternate}@keyframes srs-winner-glow{from{box-shadow:0 0 7px #fbbf2455,0 0 15px #f59e0b55}to{box-shadow:0 0 15px #fbbf24cc,0 0 32px #f59e0baa}}
  .srs-turn-ring{position:absolute;top:50%;left:50%;z-index:55;width:clamp(170px,24vmin,220px);height:clamp(170px,24vmin,220px);transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 4px 12px #0009)}
  .srs-turn-ring svg{display:block;width:100%;height:100%;overflow:visible}
  .srs-turn-ring circle{fill:none;stroke-width:7}
  .srs-turn-ring-track{stroke:#ffffff28}
  .srs-turn-ring-progress{stroke:#a78bfa;stroke-linecap:round;stroke-dasharray:572.6;stroke-dashoffset:0;transform:rotate(-90deg);transform-origin:100px 100px;transition:stroke-dashoffset .22s linear,stroke .2s}
  .srs-turn-ring strong{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);padding:3px 8px;border:1px solid #a78bfa;border-radius:8px;background:#171329;color:#f4eaff;font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:.5px;box-shadow:0 2px 8px #0008}
  .srs-turn-ring.warning .srs-turn-ring-progress{stroke:#f59e0b}.srs-turn-ring.warning strong{border-color:#f59e0b;color:#fbbf24}
  .srs-turn-ring.urgent .srs-turn-ring-progress{stroke:#ef4444}.srs-turn-ring.urgent strong{border-color:#ef4444;color:#fca5a5}
  .srs.lobby-active.playing-active #srsWordStage{display:none!important}
  .srs.lobby-active.playing-active #srsPlayPanel:not(.hidden){display:block!important;position:fixed;left:50%;top:50%;bottom:auto;z-index:77;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 36px));max-height:70vh;overflow:auto;margin:0;padding:18px;border:1px solid #a78bfa;border-radius:16px;background:#171329;box-shadow:0 12px 36px #000b}
  #srsPassTurn{position:fixed;left:50%;bottom:18px;z-index:78;transform:translateX(-50%);width:min(260px,calc(100vw - 36px));margin:0;padding:14px 20px;border:1px solid #c4b5fd;background:#7c3aed;box-shadow:0 5px 22px #0008;font-size:15px}
  #srsHelpToggle{position:fixed;right:18px;bottom:18px;z-index:80;margin:0;padding:11px 16px;border:1px solid #c4b5fd;background:#211a38;box-shadow:0 5px 22px #0008}
  #srsHelpPanel{position:fixed;right:18px;bottom:72px;z-index:81;width:min(390px,calc(100vw - 36px));max-height:min(70vh,620px);overflow:auto;padding:18px;border:1px solid #a78bfa;border-radius:16px;background:#171329;color:#f6f2ff;box-shadow:0 12px 36px #000b}
  #srsHelpPanel h3{margin:0 0 10px}#srsHelpPanel ol{padding-left:21px;margin:8px 0}#srsHelpPanel li{margin:8px 0;line-height:1.4}#srsHelpPanel p{margin:8px 0}#srsHelpClose{margin-top:8px}
  .srs-side-toggle{position:fixed;top:50%;z-index:82;transform:translateY(-50%);margin:0;padding:13px 12px;border:1px solid #c4b5fd;background:#211a38;box-shadow:0 5px 22px #0008}
  #srsNotebookToggle{left:12px}#srsChatToggle{right:12px}
  .srs-side-panel{position:fixed;top:50%;z-index:83;width:min(300px,calc(100vw - 64px));max-height:70vh;overflow:auto;padding:14px;border:1px solid #a78bfa;border-radius:15px;background:#171329;color:#f6f2ff;box-shadow:0 12px 36px #000b;transform:translateY(-50%)}
  #srsNotebookPanel{left:58px}#srsChatPanel{right:58px}
  @media(min-width:601px){#srsChatPanel{transform:translateY(-100%)}}
  .srs-side-panel h3{margin:0 0 10px}.srs-side-panel textarea{box-sizing:border-box;width:100%;min-height:220px;resize:vertical;padding:10px;border:1px solid #ffffff30;border-radius:10px;background:#100d20;color:#fff;font:14px/1.45 Arial,sans-serif}
  #srsChatMessages{display:flex;flex-direction:column;gap:8px;max-height:42vh;overflow:auto;margin:8px 0}
  .srs-chat-message{padding:8px 10px;border-radius:10px;background:#ffffff0d;overflow-wrap:anywhere}
  .srs-chat-message strong{display:block;margin-bottom:3px;color:#c4b5fd;font-size:12px}
  .srs-chat-message.question-highlight{position:relative;border:1px solid #f6c453;background:linear-gradient(135deg,#6b4a12aa,#3b2a12dd 55%,#241b12);box-shadow:0 0 8px #fbbf2466,0 0 20px #f59e0b55,inset 0 0 14px #fbbf2422;color:#fff3c4;animation:srs-question-glow 2.4s ease-in-out infinite alternate}
  .srs-chat-message.question-highlight strong{color:#ffdf86;text-shadow:0 0 8px #f59e0b99}
  @keyframes srs-question-glow{from{box-shadow:0 0 6px #fbbf2455,0 0 14px #f59e0b33,inset 0 0 10px #fbbf2418}to{box-shadow:0 0 12px #fbbf24aa,0 0 28px #f59e0b88,inset 0 0 18px #fbbf2433}}
  #srsChatInput{box-sizing:border-box;width:100%;padding:10px;border:1px solid #ffffff30;border-radius:9px;background:#100d20;color:#fff;font:inherit}
  .srs-side-panel .srs-panel-close{margin-top:10px;width:100%;background:#35294f}
  @media(max-width:600px){.srs-side-toggle{top:auto;bottom:84px;transform:none;padding:11px 9px;font-size:12px}#srsNotebookToggle{left:8px}#srsChatToggle{right:8px}.srs-side-panel{top:auto;bottom:132px;transform:none;max-height:55vh;width:min(310px,calc(100vw - 54px))}#srsNotebookPanel{left:8px}#srsChatPanel{right:8px}#srsNotebookPanel textarea{min-height:140px}}
  .srs-seat-0{left:50%;top:14%}.srs-seat-1{left:81%;top:32%}.srs-seat-2{left:81%;top:68%}.srs-seat-3{left:50%;top:86%}.srs-seat-4{left:19%;top:68%}.srs-seat-5{left:19%;top:32%}
  @media(max-width:480px){#srsPassTurn{bottom:14px;width:calc(100vw - 36px)}.srs-table-wrap{min-height:320px}.srs-seat{width:29%;min-height:78px}.srs.lobby-active .srs-seat{width:clamp(94px,29vw,124px);min-height:78px}#srsMenuToggle{width:72px;height:72px;font-size:13px}#srsHostMenu{left:13%}.srs-turn-ring{left:60%}.srs-code-field{margin-top:8px}}
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
      <div id="srsTurnTimer" class="srs-turn-ring hidden" aria-label="Оставшееся время хода">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="srs-turn-ring-track" cx="100" cy="100" r="91"></circle>
          <circle id="srsTurnTimerProgress" class="srs-turn-ring-progress" cx="100" cy="100" r="91"></circle>
        </svg>
        <strong id="srsTurnTimerValue">01:00</strong>
      </div>
      <div id="srsHostMenu" class="srs-menu hidden">
        <button id="srsMenuToggle" class="alt" type="button" aria-expanded="false">☰ Меню</button>
        <div id="srsMenuPanel" class="srs-menu-panel hidden"><button id="srsStart" class="wide hidden" type="button">▶ Начать игру</button><button id="srsAddBots" class="wide alt hidden" type="button">🤖 Добавить тестового бота</button><button id="srsEditAction" type="button">⚙ Редактировать комнату</button><button id="srsLeave" class="wide alt" type="button">Выйти из игры</button></div>
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
        
      </div>
      <div id="srsPlayPanel" class="srs-card hidden">
        <div class="status hidden" id="srsTurnStatus">Твой ход</div>
        <div id="srsActionButtons" class="hidden" style="display:flex;gap:10px;align-items:center"><button id="srsAskQuestion" style="flex:1;margin:0">Задать вопрос</button><button id="srsGuessButton" style="flex:1;margin:0">Попытаться отгадать</button></div>
        <input id="srsQuestionInput" class="hidden" maxlength="180" placeholder="Например: Я живое существо?">
        <input id="srsGuessInput" class="hidden" maxlength="40" placeholder="Напиши свою догадку…">
        <div id="srsQuestionWaiting" class="hidden status">Вопрос отправлен в общий чат. Ждём ответы остальных игроков. Когда будешь готов, нажми «Завершить ход».</div>
        <div id="srsAnswerControls" class="hidden status"><strong>Ответь на вопрос игрока:</strong><div class="srs-answer-actions"><button type="button" data-answer="yes">Да</button><button type="button" data-answer="no">Нет</button><button type="button" data-answer="unknown">Не знаю</button></div></div>
      </div>
      <button id="srsNotebookToggle" class="srs-side-toggle" type="button">📓 Блокнот</button>
      <section id="srsNotebookPanel" class="srs-side-panel hidden" aria-label="Личный блокнот">
        <h3>📓 Мой блокнот</h3>
        <p class="muted">Записывай сюда свои вопросы и догадки. Эти заметки видишь только ты.</p>
        <textarea id="srsNotebookText" maxlength="5000" placeholder="Например:
— Я живое?
— Я существую сейчас?"></textarea>
        <button id="srsNotebookClose" class="srs-panel-close" type="button">Закрыть</button>
      </section>
      <button id="srsChatToggle" class="srs-side-toggle" type="button">💬 Чат</button>
      <section id="srsChatPanel" class="srs-side-panel hidden" aria-label="Общий чат комнаты">
        <h3>💬 Общий чат</h3>
        <div id="srsChatMessages" aria-live="polite"><div class="muted">Сообщений пока нет.</div></div>
        <input id="srsChatInput" maxlength="300" autocomplete="off" placeholder="Напиши сообщение…">
        <button id="srsChatSend" class="wide" type="button">Отправить</button>
        <button id="srsChatClose" class="srs-panel-close" type="button">Закрыть</button>
      </section>
      <button id="srsPassTurn" class="alt hidden" type="button">Завершить ход</button>
      <div id="srsFinished" class="hidden status"><h3>Игра завершена</h3><p id="srsFinishedText"></p><button id="srsPlayAgain" class="alt">В меню</button></div>
      <div id="srsLobbyActions"></div>
    </div>
    <div id="srsStatus" class="status">Выбери действие, чтобы продолжить.</div>
    <button id="srsHelpToggle" type="button" aria-expanded="false">? Справка</button>
    <section id="srsHelpPanel" class="hidden" role="dialog" aria-label="Правила игры">
      <h3>Как играть в «Кто я?»</h3>
      <p><strong>Цель:</strong> угадать слово, которое досталось тебе, задавая вопросы остальным игрокам.</p>
      <ol>
        <li>Соберите от 2 до 6 игроков. Каждый занимает своё место, а создатель комнаты запускает игру.</li>
        <li>Сервер случайно распределяет игроков: каждый придумывает слово для одного другого игрока, и каждый получает ровно одно слово. Себе слово не достаётся.</li>
        <li>Вводите слова по очереди. Не подсказывайте адресату и не раскрывайте своё слово. После раздачи своё слово увидишь ты, а над своим местом будут звёздочки.</li>
        <li>Когда начнётся игра, в свой ход задай всем вопрос, на который можно ответить «Да», «Нет» или «Не знаю».</li>
        <li>Используй ответы, чтобы сузить варианты, и введи догадку. Если пока не готов — передай ход следующему игроку.</li>
        <li>Учитывай таймер комнаты: если время на ход закончится, ход перейдёт дальше.</li>
      </ol>
      <p><strong>Совет:</strong> задавай вопросы, которые постепенно исключают целые группы вариантов.</p>
      <button id="srsHelpClose" class="alt wide" type="button">Понятно</button>
    </section>
  </section>`;
  const $ = id => root.querySelector("#"+id);
  const status = message => $("srsStatus").textContent = message;
  let playersCount=0,maxPlayers=2,started=false,autoStartPending=false,roster=[],visibleWords={},hasSecretWord=false,winnerId=null;
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
    $("srsHostMenu").classList.remove("hidden");
    $("srsStart").classList.toggle("hidden",!host||started);
    $("srsEditAction").classList.toggle("hidden",!host);\n    $("srsAddBots").classList.toggle("hidden",!host||started||playersCount>=maxPlayers);
    const allSeated=roster.length===playersCount&&roster.every(player=>Number.isInteger(player.seatIndex));
    $("srsStart").disabled=playersCount<2||!allSeated;
    if(host){
      $("srsEditName").value=settings.roomName||"";
      $("srsEditAccess").value=settings.access||"private";
      $("srsEditPlayers").value=String(maxPlayers);
      $("srsEditTimer").value=String(settings.timerSeconds??60);
    }
  }
  async function tryAutoStart(){if(autoStartPending||started||!window.onlineGame.isRoomHost()||playersCount<2||roster.length!==playersCount||!roster.every(player=>Number.isInteger(player.seatIndex)))return;autoStartPending=true;const result=await window.onlineGame.startWordRound();if(!result.ok){autoStartPending=false;status(result.message||"Не удалось начать игру.");}}
  function renderSeats(){
    const table=$("srsTable");if(!table)return;
    table.querySelectorAll(".srs-seat").forEach(node=>node.remove());
    const me=window.onlineGame.getPlayerId();
    const seats=Array.from({length:Math.min(6,maxPlayers)},(_,i)=>i);
    seats.forEach(index=>{
      const player=roster.find(item=>item.seatIndex===index);
      const button=document.createElement("button");button.type="button";button.className="srs-seat";const angle=-Math.PI/2+index*(2*Math.PI/seats.length);const seatLeft=50+27*Math.cos(angle),seatTop=50+27*Math.sin(angle);button.style.left=seatLeft+"%";button.style.top=seatTop+"%";
      if(player){button.classList.add("occupied");if(player.id===me)button.classList.add("mine");if(player.id===winnerId)button.classList.add("winner");button.disabled=player.id!==me||started;const wordTag=document.createElement("div");wordTag.className="srs-player-word";wordTag.textContent=player.id===me?(hasSecretWord?"******":""):(Object.prototype.hasOwnProperty.call(visibleWords,player.id)?visibleWords[player.id]:"");wordTag.classList.toggle("hidden",!wordTag.textContent);wordTag.style.left=seatLeft+"%";wordTag.style.top=Math.max(4,seatTop-7)+"%";const avatar=player.avatar&&String(player.avatar).startsWith("data:image/")?document.createElement("img"):document.createElement("span");avatar.className="avatar"+(avatar.tagName==="IMG"?" avatar-image":"");if(avatar.tagName==="IMG"){avatar.src=player.avatar;avatar.alt="";}else avatar.textContent=player.avatar||"🙂";const nick=document.createElement("span");nick.className="nickname";nick.textContent=player.nickname||"Игрок";const note=document.createElement("span");note.className="seat-note";note.textContent=player.testBot?"Тестовый бот":(player.id===me?"Твоё место":(player.isHost?"Создатель":"Игрок"));button.append(avatar,nick,note);table.append(wordTag);}
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
  $("srsHelpToggle").onclick=()=>{const open=$("srsHelpPanel").classList.contains("hidden");$("srsHelpPanel").classList.toggle("hidden",!open);$("srsHelpToggle").setAttribute("aria-expanded",String(open));};
  const setSidePanel=(panel,button,open)=>{ $(panel).classList.toggle("hidden",!open); $(button).setAttribute("aria-expanded",String(open)); };
  $("srsNotebookToggle").onclick=()=>setSidePanel("srsNotebookPanel","srsNotebookToggle",$("srsNotebookPanel").classList.contains("hidden"));
  $("srsNotebookClose").onclick=()=>setSidePanel("srsNotebookPanel","srsNotebookToggle",false);
  $("srsChatToggle").onclick=()=>setSidePanel("srsChatPanel","srsChatToggle",$("srsChatPanel").classList.contains("hidden"));
  $("srsChatClose").onclick=()=>setSidePanel("srsChatPanel","srsChatToggle",false);
  function appendChatMessage(item,isQuestion=false){
    const list=$("srsChatMessages");
    if(list.querySelector(".muted"))list.innerHTML="";
    const row=document.createElement("div");row.className="srs-chat-message"+(isQuestion?" question-highlight":"");
    const name=document.createElement("strong");name.textContent=String(item.nickname||"Игрок");
    const body=document.createElement("span");body.textContent=String(item.message||"");
    row.append(name,body);list.append(row);list.scrollTop=list.scrollHeight;
    while(list.children.length>100)list.firstElementChild.remove();
  }
  function sendChatMessage(){
    const message=$("srsChatInput").value.trim();if(!message)return;
    $("srsChatSend").disabled=true;
    window.onlineGame.sendWhoAmIChat(message).then(result=>{
      $("srsChatSend").disabled=false;
      if(!result.ok){status(result.message||"Не удалось отправить сообщение.");return;}
      $("srsChatInput").value="";
    });
  }
  $("srsChatSend").onclick=sendChatMessage;
  $("srsChatInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sendChatMessage();}});
  $("srsHelpClose").onclick=()=>{$("srsHelpPanel").classList.add("hidden");$("srsHelpToggle").setAttribute("aria-expanded","false");};
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
  $("srsStart").onclick=async()=>{const result=await window.onlineGame.startWordRound();if(!result.ok)status(result.message||"Не удалось начать игру.");};\n  $("srsAddBots").onclick=async()=>{const result=await window.onlineGame.sendGameAction("test-bots-add",{count:1});if(!result.ok)status(result.message||"Не удалось добавить бота.");else status("Тестовый бот добавлен. Раздача начнётся автоматически.");};
  $("srsSubmitWord").onclick=async()=>{const word=$("srsWordInput").value.trim();const result=await window.onlineGame.submitPlayerWord(word);if(!result.ok)return status(result.message||"Не удалось отправить слово.");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.remove("hidden");$("srsWordInput").value="";};
  $("srsAskQuestion").onclick=async()=>{const field=$("srsQuestionInput");if(field.classList.contains("hidden")){field.classList.remove("hidden");field.focus();return;}const result=await window.onlineGame.askWhoAmIQuestion(field.value.trim());if(!result.ok)return status(result.message||"Не удалось задать вопрос.");field.value="";field.classList.add("hidden");$("srsActionButtons").classList.add("hidden");$("srsQuestionWaiting").classList.remove("hidden");$("srsPassTurn").classList.remove("hidden");status("Вопрос отправлен. Ответы будут в общем чате.");};
  $("srsGuessButton").onclick=async()=>{const field=$("srsGuessInput");if(field.classList.contains("hidden")){field.classList.remove("hidden");field.focus();return;}const result=await window.onlineGame.guessWhoAmI(field.value.trim());if(!result.ok)return status(result.message||"Не удалось отправить догадку.");field.value="";field.classList.add("hidden");if(!result.correct)status("Пока не угадал. Ход переходит дальше.");};
  $("srsPassTurn").textContent="Завершить ход";$("srsPassTurn").onclick=async()=>{const result=await window.onlineGame.passWhoAmITurn();if(!result.ok)status(result.message||"Не удалось передать ход.");};
  root.querySelectorAll("[data-answer]").forEach(button=>button.onclick=async()=>{button.disabled=true;const result=await window.onlineGame.answerWhoAmIQuestion(button.dataset.answer);if(!result.ok){button.disabled=false;status(result.message||"Не удалось отправить ответ.");return;}$("srsAnswerControls").classList.add("hidden");status("Ответ отправлен.");});
  $("srsPlayAgain").onclick=()=>{window.onlineGame.leaveRoom();show("srsHome");};
  document.addEventListener("who-am-i-chat-history",e=>{const list=$("srsChatMessages");list.innerHTML="";(Array.isArray(e.detail.messages)?e.detail.messages:[]).forEach(appendChatMessage);if(!list.children.length)list.innerHTML='<div class="muted">Сообщений пока нет.</div>';});
  document.addEventListener("who-am-i-chat-message",e=>appendChatMessage(e.detail));
  document.addEventListener("room-roster",e=>{roster=Array.isArray(e.detail.players)?e.detail.players:roster;playersCount=Number(e.detail.playersCount??playersCount);maxPlayers=Number(e.detail.maxPlayers||maxPlayers);syncRoom();renderSeats();tryAutoStart();});
  document.addEventListener("online-opponent-connected",e=>{playersCount=Number(e.detail.playersCount||playersCount+1);syncRoom();});
  document.addEventListener("online-opponent-left",e=>{playersCount=Number(e.detail.playersCount||Math.max(1,playersCount-1));syncRoom();});
  document.addEventListener("room-host-changed",()=>syncRoom());
  document.addEventListener("room-settings-updated",e=>syncRoom(e.detail));
  document.addEventListener("word-round-start",()=>{autoStartPending=false;visibleWords={};hasSecretWord=false;renderSeats();started=true;$("srsStart").classList.add("hidden");$("srsWordStage").classList.remove("hidden");$("srsWordInstruction").textContent="Игроки по очереди отправляют слова случайно назначенным игрокам. Каждый получит ровно одно слово. Получатель не увидит его до завершения раздачи.";syncRoom();});
  document.addEventListener("word-entry-turn",e=>{
    $("srsWordStage").classList.remove("hidden");$("srsWordEntry").classList.remove("hidden");$("srsWordWaiting").classList.add("hidden");
    const me=roster.find(p=>p.id===window.onlineGame.getPlayerId());const target=roster.find(p=>p.id===e.detail.targetPlayerId);
    const place=player=>{const seat=Number.isInteger(player?.seatIndex)?player.seatIndex:0;const angle=-Math.PI/2+seat*(2*Math.PI/Math.max(2,maxPlayers));return {left:50+27*Math.cos(angle),top:50+27*Math.sin(angle)};};
    const targetPos=place(target),myPos=place(me);$("srsWordStage").style.left=targetPos.left+"%";$("srsWordStage").style.top=Math.max(8,targetPos.top-12)+"%";
    $("srsWordHeading").textContent="Слово для игрока №"+e.detail.targetPlayerNumber;$("srsWordInstruction").textContent="Введи слово, которое получит этот игрок.";$("srsWordInput").placeholder="Слово для соперника…";
    let tag=$("srsWriterTag");if(!tag){tag=document.createElement("div");tag.id="srsWriterTag";$("srsLobby").append(tag);}tag.textContent="Ты придумываешь слово";tag.style.left=myPos.left+"%";tag.style.top=Math.max(8,myPos.top-10)+"%";root.querySelector(".srs").classList.add("writing-active");
  });
  document.addEventListener("word-submitted",e=>{root.querySelector(".srs").classList.remove("writing-active");$("srsWordStage").classList.add("hidden");$("srsWriterTag")?.remove();status(e.detail.message||"Слово принято.");});
  document.addEventListener("word-submission-progress",e=>status("Слова отправили "+e.detail.submitted+" из "+e.detail.total+" игроков."));
  document.addEventListener("who-am-i-visible-words",e=>{visibleWords=e.detail.words&&typeof e.detail.words==="object"?e.detail.words:{};renderSeats();});
  document.addEventListener("your-secret-word",()=>{hasSecretWord=true;renderSeats();$("srsWordStage").classList.add("hidden");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.add("hidden");status("Слова розданы. Теперь угадывай своё слово!");});
  document.addEventListener("word-round-complete",()=>{root.querySelector(".srs").classList.remove("writing-active");root.querySelector(".srs").classList.add("playing-active");$("srsWordStage").classList.add("hidden");$("srsWriterTag")?.remove();status("Все слова розданы. Игра начинается!");$("srsPlayPanel").classList.remove("hidden");$("srsPassTurn").textContent="Завершить ход";});
  let turnTimerInterval=null;
  const turnTimerDuration=2*Math.PI*91;
  $("srsTurnTimerProgress").style.strokeDasharray=String(turnTimerDuration);
  function stopTurnCountdown(){if(turnTimerInterval!==null){cancelAnimationFrame(turnTimerInterval);turnTimerInterval=null;}$("srsTurnTimer").classList.add("hidden");$("srsTurnTimer").classList.remove("warning","urgent");$("srsTurnTimerProgress").style.strokeDashoffset="0";}
  function startTurnCountdown(deadline,timerSeconds){
    stopTurnCountdown();
    const total=Number(timerSeconds);
    const endAt=Number(deadline);
    if(!total||total<=0||!endAt)return;
    let lastDisplayedSecond=-1;
    $("srsTurnTimer").classList.remove("hidden");
    const update=()=>{
      const millisecondsLeft=Math.max(0,endAt-Date.now());
      const remaining=Math.ceil(millisecondsLeft/1000);
      if(remaining!==lastDisplayedSecond){
        lastDisplayedSecond=remaining;
        const minutes=String(Math.floor(remaining/60)).padStart(2,"0");
        const seconds=String(remaining%60).padStart(2,"0");
        $("srsTurnTimerValue").textContent=minutes+":"+seconds;
      }
      const progress=Math.min(1,millisecondsLeft/(total*1000));
      $("srsTurnTimerProgress").style.strokeDashoffset=String(turnTimerDuration*(1-progress));
      $("srsTurnTimer").classList.toggle("warning",remaining<=15&&remaining>5);
      $("srsTurnTimer").classList.toggle("urgent",remaining<=5);
      if(millisecondsLeft>0){turnTimerInterval=requestAnimationFrame(update);}
      else{turnTimerInterval=null;}
    };
    update();
  }
  document.addEventListener("who-am-i-turn",e=>{$("srsAnswerControls").classList.add("hidden");$("srsPlayPanel").classList.toggle("hidden",!e.detail.isYourTurn);$("srsQuestionWaiting").classList.add("hidden");$("srsTurnStatus").classList.toggle("hidden",!e.detail.isYourTurn);$("srsTurnStatus").textContent="Твой ход";$("srsActionButtons").classList.toggle("hidden",!e.detail.isYourTurn);$("srsQuestionInput").classList.add("hidden");$("srsGuessInput").classList.add("hidden");$("srsPassTurn").classList.toggle("hidden",!e.detail.isYourTurn);startTurnCountdown(e.detail.deadline,e.detail.timerSeconds);});
  document.addEventListener("who-am-i-question",e=>{appendChatMessage({nickname:"Вопрос • Игрок №"+e.detail.askerNumber,message:e.detail.question},true);$("srsChatPanel").classList.remove("hidden");$("srsChatToggle").setAttribute("aria-expanded","true");const isAsker=e.detail.isYourQuestion===true;if(isAsker){$("srsPlayPanel").classList.remove("hidden");$("srsActionButtons").classList.add("hidden");$("srsQuestionInput").classList.add("hidden");$("srsGuessInput").classList.add("hidden");$("srsAnswerControls").classList.add("hidden");$("srsQuestionWaiting").classList.remove("hidden");$("srsPassTurn").classList.remove("hidden");$("srsTurnStatus").textContent="Твой ход";}else{$("srsPlayPanel").classList.remove("hidden");$("srsActionButtons").classList.add("hidden");$("srsAnswerControls").classList.remove("hidden");$("srsQuestionWaiting").classList.add("hidden");$("srsPassTurn").classList.add("hidden");}});
  document.addEventListener("who-am-i-answer",e=>{const answer={yes:"Да",no:"Нет",unknown:"Не знаю"}[e.detail.answer]||"—";appendChatMessage({nickname:"Ответ • Игрок №"+e.detail.responderNumber,message:answer});});
  document.addEventListener("who-am-i-guess-result",e=>status(e.detail.message));
  document.addEventListener("who-am-i-turn-timeout",e=>status(e.detail.message));
  document.addEventListener("who-am-i-finished",e=>{stopTurnCountdown();winnerId=e.detail.winnerId||null;renderSeats();$("srsPlayPanel").classList.add("hidden");$("srsPassTurn").classList.add("hidden");$("srsFinished").classList.remove("hidden");$("srsFinishedText").textContent=e.detail.message;status("Партия завершена.");});
  document.addEventListener("word-round-reset",e=>{autoStartPending=false;root.querySelector(".srs").classList.remove("playing-active");stopTurnCountdown();visibleWords={};hasSecretWord=false;winnerId=null;renderSeats();started=false;$("srsPlayPanel").classList.add("hidden");$("srsFinished").classList.add("hidden");$("srsWordStage").classList.add("hidden");$("srsWordEntry").classList.add("hidden");$("srsWordWaiting").classList.add("hidden");syncRoom();status(e.detail.message||"Раздача слов сброшена.");});
  document.addEventListener("online-room-left",()=>{root.querySelector(".srs").classList.remove("playing-active");stopTurnCountdown();root.querySelector(".srs").classList.remove("writing-active");$("srsWriterTag")?.remove();$("srsNotebookPanel").classList.add("hidden");$("srsChatPanel").classList.add("hidden");$("srsChatMessages").innerHTML='<div class="muted">Сообщений пока нет.</div>';$("srsNotebookText").value="";show("srsHome");started=false;});
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