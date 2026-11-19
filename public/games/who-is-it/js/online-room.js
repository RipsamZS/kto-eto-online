/* Создание комнат, подключение и выбор онлайн-пака */
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

