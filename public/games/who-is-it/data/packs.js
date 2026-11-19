/* Данные встроенных паков игры «Кто это?» */
const STORAGE_MY_PACKS='guessWhoPacks';
const STORAGE_DOWNLOADED='guessWhoDownloadedPacks';

const makeCharacters=(names,emoji)=>names.map((name,i)=>({
  id:`${name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-')}-${i}`,
  name,emoji,image:''
}));
window.KAZO_BUILTIN_PACKS = window.KAZO_BUILTIN_PACKS || [];
