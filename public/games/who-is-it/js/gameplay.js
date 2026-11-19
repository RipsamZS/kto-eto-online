/* Игровой процесс, карточки, выбор и события игры */
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
