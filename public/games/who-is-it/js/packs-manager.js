/* Управление пользовательскими и встроенными паками */
function openUploadPackPicker(){
  if(!myPacks.length){
    toast('Сначала создай собственный пак в разделе «Мои паки».');
    return;
  }
  const backdrop=document.createElement('div');
  backdrop.className='modal-backdrop open';
  const modal=document.createElement('div');
  modal.className='modal';
  const heading=document.createElement('h2');
  heading.textContent='Загрузить пак в общий доступ';
  const description=document.createElement('p');
  description.className='muted';
  description.textContent='Выбери один из своих паков. После публикации другие игроки смогут его скачать.';
  const grid=document.createElement('div');
  grid.className='cards-grid';

  myPacks.forEach(pack=>{
    const card=document.createElement('div');
    card.className='pack-card';
    const title=document.createElement('h3');
    title.textContent=`${pack.emoji||'🗂️'} ${pack.name}`;
    const info=document.createElement('p');
    info.className='muted small';
    info.textContent=`${(pack.characters||[]).length} карточек`;
    const publish=document.createElement('button');
    publish.className='primary full';
    publish.textContent='Опубликовать';
    publish.onclick=async()=>{
      publish.disabled=true;
      publish.textContent='Публикуем...';
      try{
        await publishMyPack(pack.id);
        backdrop.remove();
      }catch(error){
        publish.disabled=false;
        publish.textContent='Опубликовать';
      }
    };
    card.append(title,info,publish);
    grid.appendChild(card);
  });

  const close=document.createElement('button');
  close.className='secondary full';
  close.style.marginTop='15px';
  close.textContent='Отмена';
  close.onclick=()=>backdrop.remove();
  modal.append(heading,description,grid,close);
  backdrop.appendChild(modal);
  backdrop.addEventListener('click',event=>{
    if(event.target===backdrop)backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

async function publishMyPack(id){
  const pack=myPacks.find(p=>String(p.id)===String(id));
  if(!pack)throw new Error('Пак не найден.');
  if(!Array.isArray(pack.characters)||pack.characters.length<2){
    toast('В паке должно быть хотя бы 2 персонажа.');
    throw new Error('Недостаточно персонажей');
  }
  if(!window.onlineGame?.publishPack){
    toast('Публикация сейчас недоступна.');
    throw new Error('Публикация недоступна');
  }
  try{
    const result=await window.onlineGame.publishPack(pack);
    if(result?.ok===false)throw new Error(result.error||'Не удалось опубликовать пак');
    toast('Пак отправлен в общий каталог!');
    await loadOnlinePacks();
    return result;
  }catch(error){
    toast(error.message||'Не удалось опубликовать пак.');
    throw error;
  }
}

function renderPackManager(){
  const root=document.getElementById('packManagerContent');
  root.innerHTML='';
  if(currentPackTab==='builtins'){
    const intro=document.createElement('p');
    intro.className='muted';
    intro.textContent='Встроенные наборы доступны сразу. В каждом наборе можно выбрать 20, 30, 40, 50 или 60 карточек.';
    root.appendChild(intro);
    root.appendChild(renderPackGrid(builtInPacks,'builtin'));
    return;
  }
  if(currentPackTab==='mine'){
    const intro=document.createElement('p');
    intro.className='muted';
    intro.textContent='Здесь находятся созданные тобой наборы. Их можно редактировать, удалять и публиковать.';
    root.appendChild(intro);
    if(!myPacks.length)root.appendChild(emptyMessage('Ты ещё не создал ни одного пака.'));
    else root.appendChild(renderPackGrid(myPacks,'mine'));
    return;
  }
  const intro=document.createElement('div');
  intro.className='row';
  const text=document.createElement('p');
  text.className='muted';
  text.textContent='Паки, которые ты скачал из общего каталога.';
  const refresh=document.createElement('button');
  refresh.className='secondary fit';
  refresh.textContent='Открыть онлайн-паки';
  refresh.onclick=openOnlinePacks;
  intro.append(text,refresh);
  root.appendChild(intro);
  if(!downloadedPacks.length)root.appendChild(emptyMessage('Скачанных паков пока нет. Открой онлайн-паки, чтобы найти наборы.'));
  else root.appendChild(renderPackGrid(downloadedPacks,'downloaded'));
}
function emptyMessage(message){
  const div=document.createElement('div');
  div.className='empty';
  div.textContent=message;
  return div;
}
function renderPackGrid(packs,type){
  const grid=document.createElement('div');
  grid.className='cards-grid';
  packs.forEach(pack=>{
    const card=document.createElement('div');
    card.className='pack-card';
    const title=document.createElement('h3');
    title.textContent=`${pack.emoji||'🗂️'} ${pack.name||'Без названия'}`;
    const description=document.createElement('p');
    description.className='muted small';
    description.textContent=pack.description||'';
    const preview=document.createElement('div');
    preview.className='preview';
    preview.textContent=(pack.characters||[]).slice(0,7).map(c=>c.emoji||'🖼️').join(' ');
    const count=document.createElement('span');
    count.className='badge';
    count.textContent=`${(pack.characters||[]).length} карточек`;
    const actions=document.createElement('div');
    actions.className='actions';
    const use=document.createElement('button');
    use.className='primary';
    use.textContent='Играть';
    use.onclick=()=>openLocalPack(pack);
    actions.appendChild(use);

    if(type==='mine'){
      const edit=document.createElement('button');
      edit.className='secondary';
      edit.textContent='Изменить';
      edit.onclick=()=>editPack(pack.id);
      const publish=document.createElement('button');
      publish.className='secondary';
      publish.textContent='Опубликовать';
      publish.onclick=()=>publishMyPack(pack.id).catch(()=>{});
      const del=document.createElement('button');
      del.className='secondary danger';
      del.textContent='Удалить';
      del.onclick=()=>deletePack(pack.id);
      actions.append(edit,publish,del);
    }
    if(type==='downloaded'){
      const remove=document.createElement('button');
      remove.className='secondary danger';
      remove.textContent='Убрать';
      remove.onclick=()=>removeDownloadedPack(pack.id);
      actions.appendChild(remove);
    }
    card.append(title,description,preview,count,actions);
    grid.appendChild(card);
  });
  return grid;
}
function openLocalPack(pack){
  if(!pack||!Array.isArray(pack.characters)||pack.characters.length<2){
    toast('В этом паке должно быть хотя бы 2 персонажа.');
    return;
  }
  selectedLocalPack=pack;
  startGameFromCharacters(pack.characters,pack.name||'Игра','local');
}
function removeDownloadedPack(id){
  downloadedPacks=downloadedPacks.filter(p=>String(p.id)!==String(id));
  persistPacks();
  renderPackManager();
}

/* -------------------------------------------------------
   РЕДАКТОР ПАКОВ
------------------------------------------------------- */

function newPack(){
  editingPackId=null;editorCharacters=[];
  document.getElementById('editorTitle').textContent='Создать пак';
  document.getElementById('packName').value='';
  document.getElementById('packDescription').value='';
  renderEditor();showScreen('editorScreen');
}
function editPack(id){
  const pack=myPacks.find(p=>String(p.id)===String(id));
  if(!pack)return;
  editingPackId=pack.id;
  editorCharacters=JSON.parse(JSON.stringify(pack.characters||[]));
  document.getElementById('editorTitle').textContent='Редактировать пак';
  document.getElementById('packName').value=pack.name||'';
  document.getElementById('packDescription').value=pack.description||'';
  renderEditor();showScreen('editorScreen');
}
function addPlaceholder(){
  const nameInput=document.getElementById('characterName');
  const emojiInput=document.getElementById('characterEmoji');
  const name=nameInput.value.trim();
  if(!name){toast('Введи имя персонажа.');return}
  editorCharacters.push({
    id:`custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,emoji:emojiInput.value.trim()||'❔',image:''
  });
  nameInput.value='';emojiInput.value='';renderEditor();
}
async function addFiles(event){
  const files=Array.from(event.target.files||[]);
  event.target.value='';
  for(const file of files){
    if(!file.type.startsWith('image/'))continue;
    if(file.size>12*1024*1024){toast(`Файл ${file.name} слишком большой. Максимум 12 МБ.`);continue}
    try{
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d',{alpha:false});
      context.fillStyle='#f3f0e9';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close?.();
      let compressed=canvas.toDataURL('image/webp',0.78);
      if(compressed.length>500000)compressed=canvas.toDataURL('image/jpeg',0.66);
      if(compressed.length>500000){toast(`Не удалось сжать ${file.name} до нужного размера.`);continue}
      editorCharacters.push({
        id:`image-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name:file.name.replace(/\.[^.]+$/,''),
        emoji:'🖼️',image:compressed
      });
      renderEditor();
    }catch(error){toast(`Не удалось обработать изображение ${file.name}.`)}
  }
}
function renderEditor(){
  document.getElementById('editorCount').textContent=editorCharacters.length;
  const root=document.getElementById('editorCharacters');
  root.innerHTML='';
  editorCharacters.forEach((character,index)=>{
    const card=document.createElement('div');
    card.className='character-card';
    if(character.image){
      const img=document.createElement('img');
      img.className='character-image';img.src=character.image;img.alt=character.name;
      img.loading='lazy';img.decoding='async';
      card.appendChild(img);
    }else{
      const face=document.createElement('span');
      face.className='face';face.textContent=character.emoji||'❔';card.appendChild(face);
    }
    const name=document.createElement('div');name.textContent=character.name;
    const remove=document.createElement('button');
    remove.className='secondary danger';remove.style.marginTop='8px';remove.textContent='Удалить';
    remove.onclick=()=>{editorCharacters.splice(index,1);renderEditor()};
    card.append(name,remove);root.appendChild(card);
  });
}
function clearEditorCharacters(){
  if(!editorCharacters.length)return;
  if(!confirm('Очистить весь список персонажей?'))return;
  editorCharacters=[];renderEditor();
}
function savePack(){
  const name=document.getElementById('packName').value.trim();
  const description=document.getElementById('packDescription').value.trim();
  if(!name){toast('Укажи название пака.');return}
  if(editorCharacters.length<2){toast('Добавь хотя бы двух персонажей.');return}
  const pack={
    id:editingPackId||`pack-${Date.now()}`,name,description,emoji:'🗂️',
    characters:JSON.parse(JSON.stringify(editorCharacters))
  };
  if(editingPackId){
    const index=myPacks.findIndex(p=>String(p.id)===String(editingPackId));
    if(index>=0)myPacks[index]=pack;else myPacks.push(pack);
  }else myPacks.push(pack);
  persistPacks();editingPackId=pack.id;
  toast('Пак сохранён.');renderPackManager();
}
function savePackAndReturn(){
  const before=editingPackId;
  savePack();
  if(editingPackId){showScreen('packManagerScreen');setPackTab('mine')}
}
function deletePack(id){
  if(!confirm('Удалить этот пак?'))return;
  myPacks=myPacks.filter(p=>String(p.id)!==String(id));
  persistPacks();renderPackManager();
}

/* -------------------------------------------------------
   ВЫБОР ПАКА И РАЗМЕРА
------------------------------------------------------- */

function getPackById(id){
  return [...builtInPacks,...myPacks,...downloadedPacks].find(p=>String(p.id)===String(id));
}
