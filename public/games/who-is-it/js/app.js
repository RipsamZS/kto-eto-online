
const builtInPacks = window.KAZO_BUILTIN_PACKS;
/* -------------------------------------------------------
   ДАННЫЕ ИГРЫ И ПАКОВ
------------------------------------------------------- */

/* Данные паков вынесены в отдельный файл */

let myPacks=loadStorage(STORAGE_MY_PACKS,[]);
let downloadedPacks=loadStorage(STORAGE_DOWNLOADED,[]);
let currentPackTab='downloaded';
let editorCharacters=[];
let editingPackId=null;
let selectedRoomPack=null;
let roomAccessDefault='private';
let currentCharacters=[];
let secretCharacter=null;
let pickerSelection=null;
let pendingGuess=null;
let currentGameMode='local';
let gameCrossed=new Set();
let selectedLocalPack=null;
let activeRoomSettings=null;
let autoAddTestBot=false;

function loadStorage(key,fallback){
  try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}
  catch{return fallback}
}
function saveStorage(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}
  catch{toast('Не удалось сохранить данные. Возможно, хранилище переполнено.')}
}
function persistPacks(){
  saveStorage(STORAGE_MY_PACKS,myPacks);
  saveStorage(STORAGE_DOWNLOADED,downloadedPacks);
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target=document.getElementById(id);
  if(target)target.classList.add('active');
}
function toast(message){
  const el=document.getElementById('toast');
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}
function showBotNotice(){openRoomSettings('private');autoAddTestBot=true;toast('Выбери пак персонажей и создай комнату — тестовый соперник добавится автоматически.')}

/* -------------------------------------------------------
   ГЛАВНОЕ МЕНЮ И ПАКИ
------------------------------------------------------- */

function openPlayMenu(){showScreen('playScreen')}
function openPacksMenu(){showScreen('packsScreen')}

function openPackManager(tab='downloaded'){
  showScreen('packManagerScreen');
  setPackTab(tab);
}
function setPackTab(tab){
  currentPackTab=tab;
  document.querySelectorAll('[data-pack-tab]').forEach(button=>{
    button.classList.toggle('active',button.dataset.packTab===tab);
  });
  renderPackManager();
}
function getAllBuiltins(){return builtInPacks}

function openOnlinePacks(){
  showScreen('onlinePacksScreen');
  loadOnlinePacks();
}

/* Онлайн-каталог игроков */
async function loadOnlinePacks(){
  const root=document.getElementById('onlinePacksList');
  root.innerHTML='<div class="empty">Загружаем каталог паков...</div>';
  try{
    if(!window.onlineGame?.listPacks)throw new Error('Онлайн-каталог недоступен');
    const result=await window.onlineGame.listPacks();
    const packs=Array.isArray(result)?result:(result?.packs||[]);
    renderOnlinePackCatalog(packs);
  }catch(error){
    root.innerHTML='';
    root.appendChild(emptyMessage('Не удалось загрузить каталог. Проверь подключение к интернету.'));
  }
}

function renderOnlinePackCatalog(packs){
  const root=document.getElementById('onlinePacksList');
  root.innerHTML='';
  if(!packs.length){
    root.appendChild(emptyMessage('В каталоге пока нет опубликованных паков. Ты можешь первым загрузить свой пак!'));
    return;
  }
  const grid=document.createElement('div');
  grid.className='cards-grid';
  packs.forEach(pack=>{
    const card=document.createElement('div');
    card.className='pack-card';
    const title=document.createElement('h3');
    title.textContent=`${pack.emoji||'🗂️'} ${pack.name||'Пак без названия'}`;
    const description=document.createElement('p');
    description.className='muted small';
    description.textContent=pack.description||'Без описания';
    const count=document.createElement('span');
    count.className='badge';
    count.textContent=`${(pack.characters||[]).length} карточек`;
    const preview=document.createElement('div');
    preview.className='preview';
    preview.textContent=(pack.characters||[]).slice(0,7).map(c=>c.emoji||'🖼️').join(' ');
    const download=document.createElement('button');
    download.className='primary full';
    download.style.marginTop='12px';
    download.textContent='Скачать пак';
    download.onclick=()=>{
      if(!Array.isArray(pack.characters)||pack.characters.length<2){
        toast('В этом опубликованном паке нет карточек для скачивания.');
        return;
      }
      const copy=JSON.parse(JSON.stringify(pack));
      if(downloadedPacks.some(p=>String(p.id)===String(copy.id))){
        toast('Этот пак уже находится в скачанных.');
        return;
      }
      downloadedPacks.push(copy);
      persistPacks();
      toast('Пак успешно добавлен в скачанные!');
      download.textContent='Уже скачан';
      download.disabled=true;
    };
    card.append(title,description,preview,count,download);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

/* Выбор одного из собственных паков для публикации */
function openRoomPackPicker(){
  openPackSelectionModal(pack=>{
    selectedRoomPack=pack;
    document.getElementById('selectedRoomPack').textContent=`${pack.name} — ${pack.characters.length} карточек`;
    updateRoomCardCount();
  });
}
function updateRoomCardCount(){
  const select=document.getElementById('roomCardCount');
  if(!selectedRoomPack)return;
  const available=selectedRoomPack.characters.length;
  Array.from(select.options).forEach(option=>option.disabled=Number(option.value)>available);
  if(Number(select.value)>available){
    const possible=[20,30,40,50,60].filter(n=>n<=available);
    if(possible.length)select.value=String(possible[possible.length-1]);
  }
}
function openPackSelectionModal(onChoose){
  const backdrop=document.createElement('div');
  backdrop.className='modal-backdrop open';
  const modal=document.createElement('div');modal.className='modal';
  const heading=document.createElement('h2');heading.textContent='Выбери пак';
  const tabs=document.createElement('div');tabs.className='tabs';
  const content=document.createElement('div');
  const sources=[
    ['builtins','Встроенные',builtInPacks],
    ['mine','Мои',myPacks],
    ['downloaded','Скачанные',downloadedPacks]
  ];
  function renderSource(source){
    content.innerHTML='';
    const packs=sources.find(s=>s[0]===source)[2];
    if(!packs.length){content.appendChild(emptyMessage('В этой категории пока нет паков.'));return}
    const grid=document.createElement('div');grid.className='cards-grid';
    packs.forEach(pack=>{
      const card=document.createElement('div');card.className='pack-card';
      const title=document.createElement('h3');title.textContent=pack.name;
      const count=document.createElement('p');count.className='muted small';count.textContent=`${(pack.characters||[]).length} карточек`;
      const choose=document.createElement('button');choose.className='primary full';choose.textContent='Выбрать';
      choose.onclick=()=>{onChoose(pack);backdrop.remove()};
      card.append(title,count,choose);grid.appendChild(card);
    });
    content.appendChild(grid);
  }
  sources.forEach((source,i)=>{
    const button=document.createElement('button');
    button.className=`tab${i===0?' active':''}`;
    button.textContent=source[1];
    button.onclick=()=>{
      tabs.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      button.classList.add('active');renderSource(source[0]);
    };
    tabs.appendChild(button);
  });
  const close=document.createElement('button');
  close.className='secondary full';close.style.marginTop='15px';close.textContent='Закрыть';
  close.onclick=()=>backdrop.remove();
  modal.append(heading,tabs,content,close);
  backdrop.appendChild(modal);document.body.appendChild(backdrop);
  renderSource('builtins');
}

/* -------------------------------------------------------
   СОЗДАНИЕ И ПОДКЛЮЧЕНИЕ К КОМНАТАМ
------------------------------------------------------- */

function openRoomSettings(access='private'){
  autoAddTestBot=false;roomAccessDefault=access;selectedRoomPack=null;
  document.getElementById('roomName').value='';
  document.getElementById('roomCode').value='';
  document.getElementById('selectedRoomPack').textContent='Пак не выбран';
  document.getElementById('roomAccess').value=access;
  document.getElementById('roomCardCount').value='20';
  document.getElementById('roomTimer').value='60';
  Array.from(document.getElementById('roomCardCount').options).forEach(o=>o.disabled=false);
  showScreen('roomSettingsScreen');
}
async function createConfiguredRoom(){
  if(!selectedRoomPack){toast('Сначала выбери пак.');return}
  const cardCount=Number(document.getElementById('roomCardCount').value);
  if(selectedRoomPack.characters.length<cardCount){toast(`В этом паке недостаточно карточек. Нужно минимум ${cardCount}.`);return}
  if(!window.onlineGame?.createRoom){toast('Онлайн-игра пока недоступна.');return}
  const roomName=document.getElementById('roomName').value.trim();
  const roomCode=document.getElementById('roomCode').value.trim().toUpperCase();
  if(!roomName){toast('Введи название комнаты.');return}
  if(!/^[A-Z0-9_-]{3,16}$/.test(roomCode)){toast('Придумай код длиной от 3 до 16 символов: латинские буквы, цифры, дефис или подчёркивание.');return}
  const settings={
    roomName,
    roomCode,
    maxPlayers:2,
    cardCount,
    timerSeconds:Number(document.getElementById('roomTimer').value),
    access:document.getElementById('roomAccess').value,
    isPublic:document.getElementById('roomAccess').value==='public'
  };
  const pack={...selectedRoomPack,characters:selectedRoomPack.characters.slice(0,cardCount)};
  activeRoomSettings=settings;
  try{
    await window.onlineGame.createRoom(pack,settings);
    if(autoAddTestBot){
      const botResult=await window.onlineGame.sendGameAction('test-bots-add',{count:1});
      if(!botResult.ok)throw new Error(botResult.message||'Не удалось добавить тестового соперника.');
      autoAddTestBot=false;
    }
    currentGameMode='online';toast('Комната создана.');
    startGameFromCharacters(pack.characters,pack.name,'online');
  }catch(error){autoAddTestBot=false;toast(error.message||'Не удалось создать комнату.')}
}
function openJoinPicker(type='private'){
  showScreen('joinScreen');document.getElementById('joinCode').value='';
}
async function submitJoinRoom(){
  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  if(!/^[A-Za-z0-9_-]{3,16}$/.test(code)){toast('Введи код длиной от 3 до 16 символов.');return}
  if(!window.onlineGame?.joinRoom){toast('Онлайн-игра пока недоступна.');return}
  try{
    await window.onlineGame.joinRoom(code,'who-is-it');currentGameMode='online';toast('Подключение выполнено.');
  }catch(error){toast(error.message||'Не удалось подключиться к комнате.')}
}
async function openPublicRooms(){
  showScreen('publicRoomsScreen');
  const root=document.getElementById('publicRoomsList');
  root.innerHTML='<div class="empty">Ищем доступные комнаты...</div>';
  try{
    if(!window.onlineGame?.listPublicRooms)throw new Error('Список комнат недоступен');
    const result=await window.onlineGame.listPublicRooms();
    const rooms=Array.isArray(result)?result:(result?.rooms||[]);
    root.innerHTML='';
    if(!rooms.length){root.appendChild(emptyMessage('Сейчас нет доступных публичных комнат.'));return}
    const grid=document.createElement('div');grid.className='cards-grid';
    rooms.forEach(room=>{
      const card=document.createElement('div');card.className='pack-card';
      const title=document.createElement('h3');title.textContent=room.name||'Публичная комната';
      const info=document.createElement('p');info.className='muted small';
      info.textContent=`Код: ${room.roomId||room.code||room.id||'—'} · Игроков: ${room.playersCount??room.players??1}/${room.maxPlayers||2}`;
      const join=document.createElement('button');join.className='primary full';join.textContent='Войти';
      join.onclick=async()=>{
        try{
          await window.onlineGame.joinRoom(String(room.roomId||room.code||room.id),'who-is-it');
          currentGameMode='online';toast('Подключение выполнено.');
        }catch(error){toast(error.message||'Не удалось войти в комнату.')}
      };
      card.append(title,info,join);grid.appendChild(card);
    });
    root.appendChild(grid);
  }catch(error){
    root.innerHTML='';root.appendChild(emptyMessage('Не удалось получить список комнат.'));
  }
}

/* -------------------------------------------------------
   ЗАПУСК ИГРЫ И ПОЛЕ КАРТОЧЕК
------------------------------------------------------- */

function startGameFromCharacters(characters,title='Игра',mode='local'){
  if(!Array.isArray(characters)||characters.length<2){toast('Для игры нужно минимум 2 персонажа.');return}
  currentCharacters=JSON.parse(JSON.stringify(characters));
  currentGameMode=mode;secretCharacter=null;pickerSelection=null;pendingGuess=null;gameCrossed=new Set();
  document.getElementById('gameTitle').textContent=title||'Игра';
  document.getElementById('gameSubtitle').textContent=`${currentCharacters.length} карточек`;
  document.getElementById('cardCountDisplay').textContent=`Карточек: ${currentCharacters.length}`;
  document.getElementById('timerDisplay').textContent='Время: —';
  document.getElementById('turnStatus').textContent=mode==='online'?'Ожидание подключения...':'Локальная тренировка';
  document.getElementById('questionInput').value='';
  document.getElementById('questionFeedback').textContent='';
  const onlinePanel=document.getElementById('onlineGamePanel');
  onlinePanel.classList.toggle('hidden',mode!=='online');
  onlinePanel.innerHTML=mode==='online'&&window.onlineGame?.isRoomHost?.()?'<div class="panel row" style="justify-content:space-between;gap:12px"><span class="muted small">Тестовый режим</span><button class="secondary fit" id="addWhoIsItBot">🤖 Добавить тестового соперника</button></div>':'';
  document.getElementById('addWhoIsItBot')?.addEventListener('click',async()=>{const result=await window.onlineGame.sendGameAction('test-bots-add',{count:1});if(!result.ok)toast(result.message||'Не удалось добавить бота.');else toast('Тестовый соперник добавлен.');});
  updateCharacterButton();renderGame();showScreen('gameScreen');
  if(mode==='online'){
    if(window.onlineGame?.canChooseCharacter?.())openPicker();
    else document.getElementById('turnStatus').textContent='Ожидаем второго игрока...';
  }else openPicker();
}
function renderGame(){
  const root=document.getElementById('characterBoard');root.innerHTML='';
  currentCharacters.forEach(character=>{
    const card=document.createElement('button');card.className='character-card';
    if(gameCrossed.has(character.id))card.classList.add('crossed');
    if(character.image){
      const img=document.createElement('img');img.className='character-image';img.src=character.image;img.alt=character.name;
      img.loading='lazy';img.decoding='async';
      card.appendChild(img);
    }else{
      const face=document.createElement('span');face.className='face';face.textContent=character.emoji||'❔';card.appendChild(face);
    }
    const name=document.createElement('div');name.textContent=character.name;card.appendChild(name);
    card.onclick=()=>toggleCrossed(character.id);
    card.oncontextmenu=event=>{event.preventDefault();requestGuess(character)};
    let holdTimer;
    card.addEventListener('touchstart',()=>{holdTimer=setTimeout(()=>requestGuess(character),600)},{passive:true});
    card.addEventListener('touchend',()=>clearTimeout(holdTimer));
    card.addEventListener('touchmove',()=>clearTimeout(holdTimer));
    root.appendChild(card);
  });
}
function toggleCrossed(id){
  if(gameCrossed.has(id))gameCrossed.delete(id);else gameCrossed.add(id);
  renderGame();
}
function updateCharacterButton(){
  const button=document.getElementById('chooseSecretButton');
  const label=document.getElementById('secretCharacter');
  label.textContent=secretCharacter?`${secretCharacter.emoji||'❔'} ${secretCharacter.name}`:'Ещё не выбран';
  if(currentGameMode==='online'){
    const canChoose=!!window.onlineGame?.canChooseCharacter?.();
    button.disabled=!canChoose||!!secretCharacter;
    button.textContent=secretCharacter?'Выбран':'Выбрать';
  }else{
    button.disabled=!!secretCharacter;button.textContent=secretCharacter?'Выбран':'Выбрать';
  }
}
function openPicker(){
  if(currentGameMode==='online'&&!window.onlineGame?.canChooseCharacter?.()){
    toast('Сначала дождись подключения второго игрока.');return;
  }
  if(secretCharacter){toast('Персонаж уже выбран.');return}
  pickerSelection=null;
  const root=document.getElementById('pickerCharacters');root.innerHTML='';
  currentCharacters.forEach(character=>{
    const card=document.createElement('button');card.className='character-card';
    if(character.image){
      const img=document.createElement('img');img.className='character-image';img.src=character.image;img.alt=character.name;
      img.loading='lazy';img.decoding='async';
      card.appendChild(img);
    }else{
      const face=document.createElement('span');face.className='face';face.textContent=character.emoji||'❔';card.appendChild(face);
    }
    const name=document.createElement('div');name.textContent=character.name;card.appendChild(name);
    card.onclick=()=>{
      pickerSelection=character;
      root.querySelectorAll('.character-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
    };
    root.appendChild(card);
  });
  document.getElementById('pickerModal').classList.add('open');
}
function closePicker(){document.getElementById('pickerModal').classList.remove('open')}
async function confirmCharacter(){
  if(!pickerSelection){toast('Выбери персонажа.');return}
  if(currentGameMode==='online'){
    if(!window.onlineGame?.canChooseCharacter?.()){toast('Нельзя выбрать персонажа до подключения соперника.');return}
    try{
      const result=await window.onlineGame.playerReady(pickerSelection.id);
      if(result?.ok===false)throw new Error(result.error||'Не удалось выбрать персонажа');
    }catch(error){toast(error.message||'Не удалось подтвердить выбор.');return}
  }
  secretCharacter=pickerSelection;closePicker();updateCharacterButton();toast('Персонаж выбран!');
}
function requestGuess(character){
  if(!character)return;
  if(currentGameMode==='online'&&!window.onlineGame?.isMyTurn?.()){toast('Сейчас не твой ход.');return}
  pendingGuess=character;
  document.getElementById('guessPrompt').textContent=`Ты хочешь угадать персонажа «${character.name}»?`;
  document.getElementById('guessModal').classList.add('open');
}
function closeGuess(){
  document.getElementById('guessModal').classList.remove('open');pendingGuess=null;
}
async function confirmGuess(){
  if(!pendingGuess)return;
  const character=pendingGuess;
  if(currentGameMode==='online'){
    try{await window.onlineGame.makeGuess(character.id);closeGuess()}
    catch(error){toast(error.message||'Не удалось отправить догадку.')}
    return;
  }
  if(secretCharacter&&character.id===secretCharacter.id){
    toast('Верно! Ты угадал персонажа.');
    document.getElementById('turnStatus').textContent='Победа!';
  }else toast('Это не тот персонаж. Продолжай игру.');
  closeGuess();
}

/* -------------------------------------------------------
   ЛОКАЛЬНЫЙ ЭКРАН ВОПРОСА
------------------------------------------------------- */

function sendLocalQuestion(){
  const input=document.getElementById('questionInput');
  const question=input.value.trim();
  if(!question){toast('Сначала напиши вопрос.');return}
  if(currentGameMode==='online'){
    if(!window.onlineGame?.isMyTurn?.()){toast('Сейчас не твой ход.');return}
    window.onlineGame.askQuestion(question).catch(error=>toast(error.message||'Не удалось отправить вопрос.'));
    input.value='';return;
  }
  document.getElementById('questionFeedback').textContent='Это локальная тренировка: для ответа соперника нужна вторая сторона игры.';
  toast('Вопрос записан.');input.value='';
}

/* -------------------------------------------------------
   ВЫХОД ИЗ ИГРЫ
------------------------------------------------------- */

function returnToMenu(){
  if(window.onlineGame?.leaveRoom&&window.onlineGame.getPlayerId?.())window.onlineGame.leaveRoom();
  secretCharacter=null;pickerSelection=null;pendingGuess=null;currentCharacters=[];selectedLocalPack=null;
  showScreen('homeScreen');
}

/* -------------------------------------------------------
   СОБЫТИЯ ОНЛАЙН-КЛИЕНТА
------------------------------------------------------- */

window.addEventListener('online-room-created',event=>{
  const data=event.detail||{};
  currentGameMode='online';
  document.getElementById('turnStatus').textContent='Комната создана. Ожидаем второго игрока...';
  if(data.code)toast(`Код комнаты: ${data.code}`);
});
window.addEventListener('online-room-joined',()=>{
  currentGameMode='online';showScreen('gameScreen');
});
window.addEventListener('online-opponent-connected',()=>{
  document.getElementById('turnStatus').textContent='Соперник подключился. Выбери персонажа.';
  updateCharacterButton();
  if(!secretCharacter)openPicker();
});
window.addEventListener('online-opponent-ready',()=>{
  document.getElementById('turnStatus').textContent='Соперник выбрал персонажа.';
});
window.addEventListener('online-start',()=>{
  document.getElementById('turnStatus').textContent='Игра началась!';
});
window.addEventListener('online-turn',event=>{
  const data=event.detail||{};
  document.getElementById('turnStatus').textContent=data.isMyTurn?'Твой ход':'Ход соперника';
  if(data.deadline){
    const update=()=>{
      const remaining=Math.max(0,Math.ceil((data.deadline-Date.now())/1000));
      document.getElementById('timerDisplay').textContent=`Время: ${remaining} сек.`;
    };
    update();clearInterval(window.turnTimerInterval);
    window.turnTimerInterval=setInterval(update,500);
  }else document.getElementById('timerDisplay').textContent='Время: без ограничения';
});
window.addEventListener('online-turn-timeout',()=>toast('Время на ход закончилось.'));
window.addEventListener('online-question',event=>{
  const data=event.detail||{};
  const question=data.question||'Соперник задал вопрос';
  const answer=confirm(`${question}\n\nОтветить «Да»? Нажми «Отмена», чтобы ответить «Нет».`);
  window.onlineGame?.answerQuestion(answer).catch(error=>toast(error.message||'Не удалось отправить ответ.'));
});
window.addEventListener('online-answer',event=>{
  const data=event.detail||{};
  document.getElementById('questionFeedback').textContent=
    `Ответ соперника: ${data.answer===true?'Да':data.answer===false?'Нет':(data.answer||'—')}`;
});
window.addEventListener('online-guess-result',event=>{
  const data=event.detail||{};
  if(data.correct){
    toast('Правильно! Ты угадал персонажа!');
    document.getElementById('turnStatus').textContent='Победа!';
  }else toast('Неверно. Игра продолжается.');
});
window.addEventListener('online-guess-made',event=>{
  const data=event.detail||{};toast(`Соперник пытается угадать: ${data.name||'персонаж'}`);
});
window.addEventListener('online-ended',event=>{
  const data=event.detail||{};
  document.getElementById('turnStatus').textContent=data.winner?'Игра завершена':'Игра окончена';
  toast(data.message||'Игра завершена.');
});
window.addEventListener('online-opponent-left',()=>{
  secretCharacter=null;pickerSelection=null;updateCharacterButton();closePicker();
  document.getElementById('turnStatus').textContent='Соперник вышел. Ожидаем нового игрока...';
  toast('Соперник покинул комнату. Когда подключится новый игрок, можно будет выбрать персонажа заново.');
});
window.addEventListener('online-pack-received',event=>{
  const data=event.detail||{};const pack=data.pack||data;
  if(Array.isArray(pack.characters)&&pack.characters.length>=2)
    startGameFromCharacters(pack.characters,pack.name||'Онлайн-игра','online');
});
window.addEventListener('online-disconnected',()=>toast('Соединение с сервером потеряно.'));
window.addEventListener('online-room-left',()=>toast('Ты вышел из комнаты.'));
window.addEventListener('online-state-change',()=>updateCharacterButton());
window.addEventListener('online-player-joined',()=>{
  updateCharacterButton();
  if(!secretCharacter&&window.onlineGame?.canChooseCharacter?.())openPicker();
});

/* -------------------------------------------------------
   СТАРТОВАЯ ИНИЦИАЛИЗАЦИЯ
------------------------------------------------------- */

document.getElementById('roomAccess').value=roomAccessDefault;
renderPackManager();
