
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
