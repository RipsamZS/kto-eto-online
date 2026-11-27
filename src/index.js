
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;

    this.players = new Map();
    this.playerProfiles = new Map();
    this.pack = null;
    this.ready = new Set();
    this.secretCharacters = new Map();
    this.wordAssignments = new Map();
    this.wordSubmitted = new Set();
    this.wordWriterOrder = [];
    this.wordRecipients = new Map();
    this.chatMessages = [];
    this.gamePhase = "lobby";
    this.partyState = null;

    this.currentTurn = null;
    this.pending = null;
    this.ended = false;

    this.roomId = null;
    this.gameId = "who-is-it";
    this.roomName = "Комната";
    this.access = "private";
    this.maxPlayers = 2;
    this.hostPlayerId = null;
    this.createdAt = null;
    this.timerSeconds = 0;
    this.turnDeadline = null;

    this.isDirectory =
      ctx.id.toString() ===
      env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY").toString();
  }

  send(socket, event, data = {}) {
    try {
      socket.send(JSON.stringify({ event, data }));
    } catch {}
  }

  reply(socket, requestId, result) {
    if (!requestId) return;

    try {
      socket.send(JSON.stringify({
        ackId: requestId,
        result
      }));
    } catch {}
  }

  broadcast(event, data = {}, except = null) {
    for (const socket of this.players.values()) {
      if (socket !== except) {
        this.send(socket, event, data);
      }
    }
  }

  async directoryRequest(path, method = "GET", body = null) {
    try {
      const id = this.env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY");
      const stub = this.env.GAME_ROOM.get(id);

      return await stub.fetch("https://directory.internal" + path, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      return null;
    }
  }

  async updateDirectory() {
    if (!this.roomId) return;

    if (this.access !== "public" || this.players.size === 0 || this.ended) {
      await this.directoryRequest(
        "/internal/room-delete/" + this.gameId + "/" + this.roomId,
        "DELETE"
      );
      return;
    }

    await this.directoryRequest("/internal/room-upsert", "POST", {
      roomId: this.roomId,
      gameId: this.gameId,
      name: this.roomName,
      access: this.access,
      playersCount: this.players.size,
      maxPlayers: this.maxPlayers,
      cardCount: this.pack?.characters?.length || 0,
      packName: this.pack?.name || "Пак",
      timerSeconds: this.timerSeconds,
      createdAt: this.createdAt || Date.now()
    });
  }

  rosterData() {
    const players = [...this.players.keys()].map((id, index) => {
      const profile = this.playerProfiles.get(id) || {};
      return { id, number: index + 1, nickname: profile.nickname || "Игрок " + (index + 1), avatar: profile.avatar || "", seatIndex: Number.isInteger(profile.seatIndex) ? profile.seatIndex : null, team: this.aliasTeams?.[id] || null, isHost: id === this.hostPlayerId, testBot: profile.testBot === true };
    });
    return { players, playersCount: players.length, maxPlayers: this.maxPlayers, hostPlayerId: this.hostPlayerId };
  }

  broadcastRoster() {
    this.broadcast("room-roster", this.rosterData());
  }

  async clearTurnTimer() {
    this.turnDeadline = null;

    try {
      await this.ctx.storage.deleteAlarm();
    } catch {}
  }

  async startTurnTimer() {
    await this.clearTurnTimer();

    if (
      !this.timerSeconds ||
      this.timerSeconds <= 0 ||
      !this.currentTurn ||
      this.ended ||
      this.pending
    ) {
      return;
    }

    this.turnDeadline = Date.now() + this.timerSeconds * 1000;

    try {
      await this.ctx.storage.setAlarm(this.turnDeadline);
    } catch {}
  }

  async sendTurn() {
    await this.startTurnTimer();

    this.broadcast("online-turn", {
      currentTurn: this.currentTurn,
      deadline: this.turnDeadline,
      timerSeconds: this.timerSeconds
    });
  }

  async alarm() {
    if (this.gameId === "alias" && this.partyState?.phase === "playing" && this.partyState.deadline) {
      if (Date.now() < this.partyState.deadline) {
        await this.ctx.storage.setAlarm(this.partyState.deadline);
        return;
      }
      this.partyAliasFinishTurn();
      return;
    }

    if (
      !this.currentTurn ||
      this.ended ||
      (this.pending && this.gameId !== "who-am-i") ||
      !this.turnDeadline
    ) {
      return;
    }

    if (Date.now() < this.turnDeadline) {
      await this.ctx.storage.setAlarm(this.turnDeadline);
      return;
    }

    const previousTurn = this.currentTurn;
    if (this.gameId === "who-am-i" && this.gamePhase === "playing") {
      this.turnDeadline = null;
      this.pending = null;
      this.broadcast("who-am-i-turn-timeout", {message:"Время хода закончилось. Ход переходит следующему игроку."});
      await this.advanceWhoAmITurn();
      return;
    }
    const opponentId = [...this.players.keys()].find(
      id => id !== previousTurn
    );

    this.turnDeadline = null;

    if (!opponentId || this.players.size !== 2) {
      this.currentTurn = null;
      this.broadcast("online-turn", {
        currentTurn: null,
        deadline: null,
        timerSeconds: this.timerSeconds
      });
      return;
    }

    this.currentTurn = opponentId;

    this.broadcast("turn-timeout", {
      previousTurn,
      currentTurn: opponentId,
      message: "Время на ход закончилось. Ход переходит сопернику."
    });

    await this.sendTurn();
  }

  async broadcastWhoAmITurn() {
    const ids = [...this.players.keys()];
    await this.clearTurnTimer();
    if (this.timerSeconds > 0 && this.currentTurn && this.gamePhase === "playing") {
      this.turnDeadline = Date.now() + this.timerSeconds * 1000;
      await this.ctx.storage.setAlarm(this.turnDeadline);
    }
    ids.forEach((id,i) => this.send(this.players.get(id), "who-am-i-turn", {
      playerNumber:i+1,
      totalPlayers:ids.length,
      isYourTurn:id===this.currentTurn,
      timerSeconds:this.timerSeconds,
      deadline:this.turnDeadline
    }));
  }
  async advanceWhoAmITurn() {
    const ids = [...this.players.keys()];
    if (!ids.length) return;
    let nextIndex=ids.indexOf(this.currentTurn);
    for(let step=0;step<ids.length;step++){nextIndex=(nextIndex+1)%ids.length;if(!this.playerProfiles.get(ids[nextIndex])?.testBot){this.currentTurn=ids[nextIndex];break;}}
    this.pending = null;
    await this.broadcastWhoAmITurn();
  }

  partySendState() {
    if (!this.partyState) return;
    const s = this.partyState;
    for (const [id, socket] of this.players) {
      let view = JSON.parse(JSON.stringify(s));
      if (this.gameId === "alias") {
        view.secretWord = id === s.activePlayerId ? s.currentWord : null;
        view.currentWord = null; delete view.words;
      } else if (this.gameId === "codenames") {
        const captain = s.captains?.[s.teams?.[id]];
        view.grid = s.grid.map(cell => ({...cell, color: (captain === id || cell.revealed || s.phase === "finished") ? cell.color : null}));
        view.myRole = captain === id ? "captain" : "operative";
        view.myTeam = s.teams[id];
      } else if (this.gameId === "spy") {
        delete view.spyId;
        view.location = s.spyId === id && s.phase !== "finished" ? null : s.location;
        view.isSpy = s.spyId === id;
        view.myVote = s.votes?.[id] || null;
      } else if (this.gameId === "imaginarium") {
        delete view.hands;
        view.submissionCount = Object.keys(s.submissions || {}).length;
        const publicCards = {};
        for (const [owner, card] of Object.entries(s.submissions || {})) {
          const cardId = s.submissionIds?.[owner];
          if (cardId) publicCards[cardId] = card;
        }
        view.submissions = (s.phase === "vote" || s.phase === "result") ? publicCards : {};
        if (s.phase === "result") view.cardOwners = Object.fromEntries(Object.entries(s.submissionIds || {}).map(([owner, cardId]) => [cardId, owner]));
        if (s.phase !== "result") view.storyCard = null;
        view.myHand = s.hands?.[id] || [];
        view.mySubmission = s.submissions?.[id] || null;
        view.mySubmissionId = s.submissionIds?.[id] || null;
        view.myVote = s.votes?.[id] || null;
      }
      if (this.gameId === "mafia") {
        const role = s.roles?.[id] || "Мирный житель";
        view.myRole = role;
        view.isAlive = (s.alive || []).includes(id);
        view.alive = [...(s.alive || [])];
        view.mafiaTeammates = role === "Мафия"
          ? (s.alive || []).filter(other => other !== id && s.roles?.[other] === "Мафия")
          : [];
        view.nightActionDone = !!s.nightActions?.[id];
        view.myVote = s.votes?.[id] || null;
        view.votes = s.phase === "voting" ? {...(s.votes || {})} : {};
        view.investigation = s.investigations?.[id] || null;
        view.revealedRoles = s.phase === "finished" ? {...(s.roles || {})} : {};
        delete view.roles;
        delete view.nightActions;
        delete view.investigations;
      } else if (this.gameId === "battleship") {
        const opponentId = s.order?.find(other => other !== id);
        view.myShip = [...(s.fleets?.[id] || [])];
        view.myReady = !!s.placementReady?.[id];
        view.opponentReady = !!s.placementReady?.[opponentId];
        view.placementReadyCount = Object.values(s.placementReady || {}).filter(Boolean).length;
        view.myShots = [...(s.shotsByPlayer?.[id] || [])];
        view.myHits = [...(s.hitsByPlayer?.[id] || [])];
        view.incoming = [...(s.incomingByPlayer?.[id] || [])];
        view.fleetSize = view.myShip.length;
        delete view.fleets;
        delete view.shotsByPlayer;
        delete view.hitsByPlayer;
        delete view.incomingByPlayer;
      }
      this.send(socket, "party-state", view);
    }
  }

  partyPrivate(id, data) {
    const socket = this.players.get(id);
    if (socket) this.send(socket, "party-private", data);
  }

  partyShuffle(items) {
    const a = [...items];
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  partyStart() {
    const ids = [...this.players.keys()];
    const profiles = Object.fromEntries(ids.map(id => [id, this.playerProfiles.get(id) || {nickname:"Игрок",avatar:"🙂"}]));
    if (this.gameId === "alias") {
      if (ids.length < 1) return {ok:false,message:"В комнате нет игроков."};
      const words = this.aliasWords?.length ? [...this.aliasWords] : ["Астроном","Велосипед","Крокодил","Библиотека","Парашют","Мороженое","Телескоп","Самолёт","Подводная лодка","Фонарик","Муравей","Чемодан","Клавиатура","Вулкан","Скейтборд","Пингвин","Аквариум","Робот","Космонавт","Пианино","Маяк","Черепаха","Компас","Карусель","Снеговик","Микроскоп","Гитара","Попкорн","Пылесос","Динозавр"];
      const teams = Object.fromEntries(ids.map((id,i)=>[id,this.aliasTeams?.[id] || (i%2===0?"A":"B")]));
      // В одиночном режиме игрок автоматически играет за команду A.
      this.partyState={phase:"playing",players:profiles,teams,scores:{A:0,B:0},round:1,turnIndex:0,order:ids,currentWord:null,words:this.partyShuffle(words),wordIndex:0,turnWords:[],seconds:Math.max(15,Math.min(180,this.timerSeconds||60)),deadline:null};
      this.partyAliasNextWord();
    } else if (this.gameId === "codenames") {
      if (ids.length < 4) return {ok:false,message:"Для Code Names нужно минимум 4 игрока — по капитану и оперативнику в каждой команде."};
      const shuffledIds = this.partyShuffle(ids);
      const teams = Object.fromEntries(shuffledIds.map((id,i)=>[id,i%2===0?"red":"blue"]));
      const redCaptain=ids.find(id=>teams[id]==="red"), blueCaptain=ids.find(id=>teams[id]==="blue");
      const words=this.partyShuffle(["ЛУНА","МОСТ","КОШКА","БАНК","КЛЮЧ","ЗВЕЗДА","КРАН","ОРЁЛ","ПИРАТ","ШКОЛА","КОСМОС","СТЕКЛО","МЫШЬ","КОРЕНЬ","БАТАРЕЯ","ПАРК","ЛИСТ","РУЧКА","КРЕСТ","СНЕГ","КОД","ЗАМОК","ТЕАТР","МЕДЬ","ТЕНЬ","МОРЕ","ПЕРО","СЕТЬ","ГРИБ","КОМЕТА","РОБОТ","ПОЛЕ","ШАХТА","ЛАВА","ЧАСЫ"]);
      const colors=this.partyShuffle([...Array(9).fill("red"),...Array(8).fill("blue"),...Array(7).fill("neutral"),"assassin"]);
      this.partyState={phase:"clue",players:profiles,teams,captains:{red:redCaptain,blue:blueCaptain},currentTeam:"red",grid:words.slice(0,25).map((word,i)=>({id:i,word,color:colors[i],revealed:false})),clue:null,remaining:{red:9,blue:8},winner:null};
      for(const id of ids)this.partyPrivate(id,{role:this.partyState.captains[teams[id]]===id?"captain":"operative",team:teams[id]});
    } else if (this.gameId === "spy") {
      if(ids.length<3)return {ok:false,message:"Для игры «Шпион» нужно минимум 3 игрока."};
      const places=["Школа","Аэропорт","Космическая станция","Больница","Пляж","Ресторан","Музей","Поезд","Цирк","Отель","Пиратский корабль","Стадион","Библиотека","Полицейский участок","Горнолыжный курорт","Супермаркет"];
      const spyId=ids[Math.floor(Math.random()*ids.length)];
      this.partyState={phase:"discussion",players:profiles,spyId,location:places[Math.floor(Math.random()*places.length)],votes:{},turnIndex:0,order:this.partyShuffle(ids),winner:null};
    } else if (this.gameId === "imaginarium") {
      if(ids.length<3)return {ok:false,message:"Для Имаджинариума нужно минимум 3 игрока."};
      const deck=this.partyShuffle(["🌙","🚀","🦋","🏰","🌊","🗝️","🎭","🌲","🔥","🪞","🐈","🎈","⏳","🌈","🕯️","🧩","🦉","🍄","🌋","🎻","🧸","⚡","🪐","🦚","🧭","💎","🌧️","🎠","📚","🪁"]);
      const hands={}; for(const id of ids)hands[id]=deck.splice(0,6);
      this.partyState={phase:"story",players:profiles,order:this.partyShuffle(ids),turnIndex:0,storyteller:null,hands,submissions:{},submissionIds:{},votes:{},scores:Object.fromEntries(ids.map(id=>[id,0])),deck,round:1,clue:"",storyCard:null};
      this.partyImaginariumBegin();
    } else if (this.gameId === "mafia") {
      if (ids.length < 4) return {ok:false,message:"Для Мафии нужно минимум 4 игрока."};
      const shuffled = this.partyShuffle(ids);
      const roles = {};
      let cursor = 0;
      const mafiaCount = ids.length >= 6 ? 2 : 1;
      for (let i = 0; i < mafiaCount; i++) roles[shuffled[cursor++]] = "Мафия";
      if (ids.length >= 5) roles[shuffled[cursor++]] = "Комиссар";
      if (ids.length >= 6) roles[shuffled[cursor++]] = "Доктор";
      while (cursor < shuffled.length) roles[shuffled[cursor++]] = "Мирный житель";
      this.partyState = {
        phase:"night", players:profiles, roles, alive:[...ids], votes:{}, nightActions:{},
        investigations:{}, round:1, winner:null, eliminated:[], lastNight:null, lastVote:null
      };
    } else if (this.gameId === "battleship") {
      if (ids.length !== 2) return {ok:false,message:"Для Морского боя нужны ровно 2 игрока."};
      this.partyState = {
        phase:"placement", players:profiles, order:[...ids], activeId:null, turn:0,
        fleets:{[ids[0]]:[],[ids[1]]:[]}, placementReady:{[ids[0]]:false,[ids[1]]:false},
        shotsByPlayer:{[ids[0]]:[],[ids[1]]:[]},
        hitsByPlayer:{[ids[0]]:[],[ids[1]]:[]},
        incomingByPlayer:{[ids[0]]:[],[ids[1]]:[]},
        winner:null, lastShot:null
      };
    } else return {ok:false,message:"Эта игра пока не поддерживает общий запуск."};
    this.gamePhase="playing"; this.ended=false;
    this.partySendState();
    return {ok:true};
  }

  partyAliasNextWord() {
    const s=this.partyState;
    if(!s || this.gameId!=="alias" || s.phase!=="playing")return;
    if(s.wordIndex>=s.words.length){s.words=this.partyShuffle(s.words);s.wordIndex=0;}
    s.currentWord=s.words[s.wordIndex++];
    s.turnWords.push({word:s.currentWord,status:"pending"});
    s.activePlayerId=s.order[s.turnIndex%s.order.length];
    if (!s.deadline) {
      s.deadline = Date.now() + s.seconds * 1000;
      this.ctx.storage.setAlarm(s.deadline).catch(()=>{});
    }
    this.partySendState();
  }

  partyAliasFinishTurn() {
    const s=this.partyState;
    if(!s || this.gameId!=="alias" || s.phase!=="playing")return;
    s.phase="review";
    s.currentWord=null;
    s.deadline=null;
    this.ctx.storage.deleteAlarm().catch(()=>{});
    this.partySendState();
  }

  partyImaginariumBegin() {
    const s=this.partyState; if(!s)return;
    s.storyteller=s.order[(s.round-1)%s.order.length];
    s.phase="story";s.submissions={};s.submissionIds={};s.votes={};s.clue="";s.storyCard=null;
    for(const id of s.order){if(s.hands[id].length<6&&s.deck.length)s.hands[id].push(...s.deck.splice(0,Math.min(6-s.hands[id].length,s.deck.length)));}
    this.partySendState();
  }

  partyHandleAction(playerId, action, payload) {
    const s=this.partyState, ids=[...this.players.keys()];
    if (action === "test-bots-add") {
      if (playerId !== this.hostPlayerId || this.partyState || this.gamePhase !== "lobby") return {ok:false,message:"Добавлять тестовых ботов может только создатель до начала игры."};
      const required = this.gameId === "codenames" ? 4 : (this.gameId === "spy" || this.gameId === "imaginarium" ? 3 : 2);
      const requested = Math.max(1, Math.min(5, Number(payload.count) || required - this.players.size));
      const limit = this.gameId === "who-am-i" ? Math.min(6,this.maxPlayers) : this.maxPlayers;
      const amount = Math.min(requested, limit - this.players.size, 6 - this.players.size);
      if (amount <= 0) return {ok:false,message:"В комнате больше нет свободных мест."};
      for (let i=0;i<amount;i++) {
        const id = "test-bot-" + crypto.randomUUID();
        this.players.set(id, null);
        const profile = {nickname:"Бот "+([...this.playerProfiles.values()].filter(p=>p.testBot).length+1),avatar:"🤖",seatIndex:null,testBot:true};
        if (this.gameId === "who-am-i") {
          const occupied = new Set([...this.playerProfiles.values()].map(p=>p.seatIndex).filter(Number.isInteger));
          profile.seatIndex = Array.from({length:limit},(_,n)=>n).find(n=>!occupied.has(n));
        }
        this.playerProfiles.set(id, profile);
        if (this.gameId === "alias") {
          this.aliasTeams = this.aliasTeams || {};
          const currentIds=[...this.players.keys()].filter(x=>x!==id);
          const countA=currentIds.filter((x,index)=>(this.aliasTeams[x] || (index%2===0?"A":"B"))==="A").length;
          const countB=currentIds.filter((x,index)=>(this.aliasTeams[x] || (index%2===0?"A":"B"))==="B").length;
          this.aliasTeams[id]=countA<=countB?"A":"B";
        }
        if (this.gameId === "who-is-it" && this.pack?.characters?.length) {
          const choices=this.pack.characters;
          this.secretCharacters.set(id,String(choices[Math.floor(Math.random()*choices.length)].id));
          this.ready.add(id);
        }
      }
      this.broadcastRoster();
      this.broadcast("player-joined",{playersCount:this.players.size,maxPlayers:this.maxPlayers,hostPlayerId:this.hostPlayerId});
      if(this.gameId==="who-is-it"&&amount>0)this.broadcast("player-ready",{});
      this.updateDirectory();
      return {ok:true,added:amount};
    }
    if(this.gameId==="alias" && action==="alias-pack-default" && (!s || s.phase==="finished")){if(playerId!==this.hostPlayerId)return {ok:false,message:"Выбирать набор слов может только создатель комнаты."};this.aliasWords=null;this.aliasPackName="Стандартный набор";return {ok:true};}
    if(this.gameId==="alias" && action==="alias-pack-select" && (!s || s.phase==="finished")){if(playerId!==this.hostPlayerId)return {ok:false,message:"Выбирать набор слов может только создатель комнаты."};const words=Array.isArray(payload.words)?[...new Set(payload.words.map(w=>String(w).trim().slice(0,60)).filter(w=>w.length>=2))]:[];if(words.length!==500&&words.length!==1500&&words.length!==2500)return {ok:false,message:"Словарь должен содержать 500, 1500 или 2500 уникальных слов."};this.aliasPackName=String(payload.name||"Общий словарь").slice(0,40);this.aliasWords=words;this.broadcast("party-message",{message:"Выбран пак: "+this.aliasPackName});return {ok:true};}
    if(this.gameId==="alias" && (action==="alias-team" || action==="alias-set-team") && (!s || s.phase==="finished")){if(this.aliasTeamLocked && playerId!==this.hostPlayerId)return {ok:false,message:"Создатель комнаты временно закрыл выбор команд."};const team=["A","B","C","D"].includes(payload.team)?payload.team:null;this.aliasTeams=this.aliasTeams||{};if(team)this.aliasTeams[playerId]=team;else delete this.aliasTeams[playerId];this.broadcastRoster();return {ok:true,team};}
    if(this.gameId==="alias" && action==="alias-toggle-team-lock" && (!s || s.phase==="finished")){if(playerId!==this.hostPlayerId)return {ok:false,message:"Закрывать выбор команд может только создатель комнаты."};this.aliasTeamLocked=!!payload.locked;this.broadcastRoster();return {ok:true,locked:this.aliasTeamLocked};}
    if(!s || s.phase==="finished")return {ok:false,message:"Партия не активна."};
    if(this.gameId==="alias"){
      if(playerId!==s.activePlayerId)return {ok:false,message:"Сейчас ход другого игрока."};
      if(action==="alias-correct"||action==="alias-skip"){
        if(s.phase!=="playing")return {ok:false,message:"Раунд уже завершён."};
        const current=s.turnWords[s.turnWords.length-1];
        if(current)current.status=action==="alias-correct"?"guessed":"skipped";
        this.partyAliasNextWord();
      } else if(action==="alias-review"){
        if(s.phase!=="review")return {ok:false,message:"Сначала дождись окончания таймера."};
        if(!Array.isArray(payload.guessed))return {ok:false,message:"Отметь отгаданные слова."};
        const guessed=new Set(payload.guessed.map(Number));
        s.turnWords.forEach((item,index)=>{item.status=guessed.has(index)?"guessed":item.status==="skipped"?"skipped":"missed";});
        const points=s.turnWords.filter(item=>item.status==="guessed").length;
        s.scores[s.teams[playerId]]=(s.scores[s.teams[playerId]]||0)+points;
        s.lastTurn={playerId,team:s.teams[playerId],words:s.turnWords.map(item=>({...item})),points};
        s.turnIndex++;
        s.turnWords=[];
        s.deadline=null;
        s.phase="playing";
        this.partyAliasNextWord();
      } else return {ok:false,message:"Неизвестное действие."};
    } else if(this.gameId==="codenames"){
      const team=s.teams[playerId], captain=s.captains[team];
      if(action==="codenames-clue"){
        if(playerId!==captain||s.phase!=="clue"||team!==s.currentTeam)return {ok:false,message:"Подсказку даёт капитан своей команды."};
        const clue=String(payload.clue||"").trim().slice(0,40), count=Math.max(1,Math.min(9,Number(payload.count)||1));
        if(!clue)return {ok:false,message:"Введи слово-подсказку."};
        s.clue={word:clue,count,remaining:count};s.phase="guess";
      } else if(action==="codenames-guess"){
        if(s.phase!=="guess"||team!==s.currentTeam||playerId===captain)return {ok:false,message:"Сейчас нельзя выбирать слово."};
        const cell=s.grid[Number(payload.index)];if(!cell||cell.revealed)return {ok:false,message:"Эта карточка недоступна."};
        cell.revealed=true;
        if(cell.color==="assassin"){s.winner=team==="red"?"blue":"red";s.phase="finished";}
        else if(cell.color==="red"||cell.color==="blue"){s.remaining[cell.color]--;if(s.remaining[cell.color]<=0){s.winner=cell.color;s.phase="finished";}else if(cell.color!==team){s.currentTeam=cell.color;s.phase="clue";s.clue=null;}}
        else {s.currentTeam=team==="red"?"blue":"red";s.phase="clue";s.clue=null;}
        if(s.phase==="guess"&&s.clue){s.clue.remaining--;if(s.clue.remaining<=0){s.currentTeam=team==="red"?"blue":"red";s.phase="clue";s.clue=null;}}
      } else if(action==="codenames-end"){if(s.phase!=="guess"||team!==s.currentTeam||playerId===captain)return {ok:false,message:"Сейчас нельзя завершить ход."};s.currentTeam=team==="red"?"blue":"red";s.phase="clue";s.clue=null;}
      else return {ok:false,message:"Неизвестное действие."};
      if(s.phase==="finished")this.ended=true;
    } else if(this.gameId==="spy"){
      if(action==="spy-vote"){
        if(s.phase!=="discussion")return {ok:false,message:"Голосование сейчас закрыто."};
        const target=String(payload.target||"");if(!ids.includes(target)||target===playerId)return {ok:false,message:"Выбери другого игрока."};
        s.votes[playerId]=target;
        if(Object.keys(s.votes).length===ids.length){
          const tally={};Object.values(s.votes).forEach(id=>tally[id]=(tally[id]||0)+1);
          const top=Object.entries(tally).sort((a,b)=>b[1]-a[1]);
          s.accused=top[0][0];s.phase=s.accused===s.spyId?"spy-guess":"finished";s.winner=s.accused===s.spyId?"players":"spy";
        }
      } else if(action==="spy-guess"){
        if(playerId!==s.spyId||s.phase!=="spy-guess")return {ok:false,message:"Только шпион может назвать место."};
        const guess=String(payload.location||"").trim().toLocaleLowerCase("ru");
        s.winner=guess===s.location.toLocaleLowerCase("ru")?"spy":"players";s.phase="finished";this.ended=true;
      } else return {ok:false,message:"Неизвестное действие."};
      if(s.phase==="finished")this.ended=true;
    } else if(this.gameId==="imaginarium"){
      if(action==="imaginarium-story"){
        if(s.phase!=="story"||playerId!==s.storyteller)return {ok:false,message:"Сейчас не твоя очередь быть рассказчиком."};
        const card=String(payload.card||"");if(!s.hands[playerId].includes(card))return {ok:false,message:"Выбери карту из своей руки."};
        const clue=String(payload.clue||"").trim().slice(0,120);if(!clue)return {ok:false,message:"Добавь ассоциацию."};
        s.storyCard=card;s.clue=clue;s.submissions[playerId]=card;s.submissionIds[playerId]="card_"+crypto.randomUUID();s.phase="submit";
      } else if(action==="imaginarium-submit"){
        if(s.phase!=="submit"||playerId===s.storyteller||s.submissions[playerId])return {ok:false,message:"Сейчас нельзя положить карту."};
        const card=String(payload.card||"");if(!s.hands[playerId].includes(card))return {ok:false,message:"Такой карты нет в руке."};
        s.submissions[playerId]=card;s.submissionIds[playerId]="card_"+crypto.randomUUID();
        if(Object.keys(s.submissions).length===ids.length)s.phase="vote";
      } else if(action==="imaginarium-vote"){
        if(s.phase!=="vote"||playerId===s.storyteller||s.votes[playerId])return {ok:false,message:"Сейчас нельзя голосовать."};
        const targetCardId=String(payload.target||"");
        const target=Object.keys(s.submissionIds).find(owner=>s.submissionIds[owner]===targetCardId);
        if(!target||target===playerId)return {ok:false,message:"Нельзя голосовать за свою карту."};
        s.votes[playerId]=target;
        if(Object.keys(s.votes).length===ids.length-1){
          const votes={};Object.values(s.votes).forEach(id=>votes[id]=(votes[id]||0)+1);
          for(const [id,n] of Object.entries(votes))s.scores[id]=(s.scores[id]||0)+n*2;
          s.scores[s.storyteller]=(s.scores[s.storyteller]||0)+2;
          s.phase="result";s.correctVotes=votes[s.storyteller]||0;
        }
      } else if(action==="imaginarium-next"){
        if(playerId!==this.hostPlayerId||s.phase!=="result")return {ok:false,message:"Следующий раунд запускает создатель комнаты."};
        for(const [id,card] of Object.entries(s.submissions)){const hand=s.hands[id];const i=hand.indexOf(card);if(i>=0)hand.splice(i,1);}
        s.round++;this.partyImaginariumBegin();
      } else return {ok:false,message:"Неизвестное действие."};
    }
    if (this.gameId === "mafia") {
      const alive = s.alive || [];
      if (action === "mafia-night-action") {
        if (s.phase !== "night" || !alive.includes(playerId)) return {ok:false,message:"Сейчас нельзя действовать ночью."};
        const role = s.roles?.[playerId];
        if (!["Мафия","Доктор","Комиссар"].includes(role)) return {ok:false,message:"У твоей роли нет ночного действия."};
        if (s.nightActions[playerId]) return {ok:false,message:"Ты уже сделал ночной выбор."};
        const target = String(payload.target || "");
        if (!alive.includes(target) || (role === "Мафия" && s.roles[target] === "Мафия") || (role === "Комиссар" && target === playerId)) return {ok:false,message:"Выбери допустимого игрока."};
        s.nightActions[playerId] = {target};
        if (role === "Комиссар") s.investigations[playerId] = {target, isMafia:s.roles[target] === "Мафия", round:s.round};
        const nightRoles = alive.filter(id => ["Мафия","Доктор","Комиссар"].includes(s.roles?.[id]));
        if (nightRoles.every(id => !!s.nightActions[id])) {
          const mafiaTargets = alive.filter(id => s.roles?.[id] === "Мафия").map(id => s.nightActions[id]?.target).filter(Boolean);
          const tally = {};
          mafiaTargets.forEach(id => tally[id] = (tally[id] || 0) + 1);
          const ranked = Object.entries(tally).sort((a,b) => b[1] - a[1]);
          const victim = ranked.length && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
          const doctor = alive.find(id => s.roles?.[id] === "Доктор");
          const saved = doctor ? s.nightActions[doctor]?.target : null;
          const eliminatedId = victim && victim !== saved ? victim : null;
          if (eliminatedId) { s.alive = alive.filter(id => id !== eliminatedId); s.eliminated.push(eliminatedId); }
          s.lastNight = {eliminatedId, saved:!!victim && victim === saved, round:s.round};
          const mafiaAlive = s.alive.filter(id => s.roles?.[id] === "Мафия").length;
          const townAlive = s.alive.length - mafiaAlive;
          if (mafiaAlive === 0) { s.phase = "finished"; s.winner = "town"; this.ended = true; }
          else if (mafiaAlive >= townAlive) { s.phase = "finished"; s.winner = "mafia"; this.ended = true; }
          else { s.phase = "discussion"; s.votes = {}; s.nightActions = {}; }
        }
      } else if (action === "mafia-begin-vote") {
        if (playerId !== this.hostPlayerId || s.phase !== "discussion") return {ok:false,message:"Голосование может начать ведущий после ночи."};
        s.phase = "voting";
        s.votes = {};
      } else if (action === "mafia-vote") {
        if (s.phase !== "voting" || !alive.includes(playerId) || s.votes[playerId]) return {ok:false,message:"Сейчас нельзя голосовать."};
        const target = String(payload.target || "");
        if (!alive.includes(target) || target === playerId) return {ok:false,message:"Выбери другого живого игрока."};
        s.votes[playerId] = target;
        if (Object.keys(s.votes).length === alive.length) {
          const tally = {};
          Object.values(s.votes).forEach(id => tally[id] = (tally[id] || 0) + 1);
          const ranked = Object.entries(tally).sort((a,b) => b[1] - a[1]);
          const eliminatedId = ranked.length && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
          if (eliminatedId) { s.alive = alive.filter(id => id !== eliminatedId); s.eliminated.push(eliminatedId); }
          s.lastVote = {eliminatedId, tied:!eliminatedId, round:s.round};
          const mafiaAlive = s.alive.filter(id => s.roles?.[id] === "Мафия").length;
          const townAlive = s.alive.length - mafiaAlive;
          if (mafiaAlive === 0) { s.phase = "finished"; s.winner = "town"; this.ended = true; }
          else if (mafiaAlive >= townAlive) { s.phase = "finished"; s.winner = "mafia"; this.ended = true; }
          else { s.phase = "night"; s.round++; s.votes = {}; s.nightActions = {}; }
        }
      } else return {ok:false,message:"Неизвестное действие."};
    } else if (this.gameId === "battleship") {
      if (action === "battleship-place-fleet") {
        if (s.phase !== "placement" || s.placementReady?.[playerId]) return {ok:false,message:"Расстановка уже подтверждена или недоступна."};
        const cells = Array.isArray(payload.cells) ? payload.cells.map(Number) : [];
        const required=[4,3,3,2,2,2,1,1,1,1];
        if (cells.length!==20 || cells.some(x=>!Number.isInteger(x)||x<0||x>=100) || new Set(cells).size!==20) return {ok:false,message:"Нужно разместить ровно 10 кораблей на 20 клетках."};
        const remaining=new Set(cells),lengths=[];
        while(remaining.size){
          const start=[...remaining][0],stack=[start],component=[];remaining.delete(start);
          while(stack.length){const cur=stack.pop();component.push(cur);const r=Math.floor(cur/10),c=cur%10;for(const next of [r>0?cur-10:-1,r<9?cur+10:-1,c>0?cur-1:-1,c<9?cur+1:-1])if(next>=0&&remaining.has(next)){remaining.delete(next);stack.push(next);}}
          const rows=component.map(x=>Math.floor(x/10)),cols=component.map(x=>x%10);
          const straight=rows.every(x=>x===rows[0])||cols.every(x=>x===cols[0]);
          if(!straight)return {ok:false,message:"Каждый корабль должен стоять одной прямой линией."};
          const span=rows.every(x=>x===rows[0])?Math.max(...cols)-Math.min(...cols)+1:Math.max(...rows)-Math.min(...rows)+1;
          if(span!==component.length)return {ok:false,message:"В корабле есть разрыв между клетками."};
          lengths.push(component.length);
        }
        lengths.sort((a,b)=>b-a);const sortedRequired=[...required].sort((a,b)=>b-a);
        if(lengths.length!==10||lengths.some((x,i)=>x!==sortedRequired[i]))return {ok:false,message:"Флот должен состоять из кораблей: 4, 3, 3, 2, 2, 2, 1, 1, 1, 1."};
        const occupied=new Set(cells);
        for(const cell of cells){const r=Math.floor(cell/10),c=cell%10;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const rr=r+dr,cc=c+dc,other=rr*10+cc;if(rr>=0&&rr<10&&cc>=0&&cc<10&&occupied.has(other)&&other!==cell){const sameShip=lengths.length===0;let connected=false;for(const n of [cell-10,cell+10,cell-1,cell+1])if(n===other&&((Math.floor(n/10)===r)||(n%10===c)))connected=true;if(!connected)return {ok:false,message:"Корабли не должны соприкасаться, даже по диагонали."};}}}
        s.fleets[playerId]=cells;s.placementReady[playerId]=true;
        if(s.order.every(id=>s.placementReady[id])){s.phase="playing";s.activeId=s.order[0];s.turn=1;}
      } else if (action === "battleship-shot") {
        if (s.phase !== "playing" || playerId !== s.activeId) return {ok:false,message:"Сейчас не твой ход."};
        const index = Number(payload.index);
        if (!Number.isInteger(index) || index < 0 || index >= 100) return {ok:false,message:"Выбери координату на поле 10×10."};
        if (s.shotsByPlayer[playerId].includes(index)) return {ok:false,message:"Эту клетку ты уже проверял."};
        const opponentId = s.order.find(id => id !== playerId);
        if (!opponentId) return {ok:false,message:"Соперник не найден."};
        s.shotsByPlayer[playerId].push(index);
        const hit = s.fleets[opponentId].includes(index);
        s.incomingByPlayer[opponentId].push(index);
        if (hit) {
          s.hitsByPlayer[playerId].push(index);
          s.lastShot = {playerId,index,hit:true};
          if (s.hitsByPlayer[playerId].length >= s.fleets[opponentId].length) {
            s.phase = "finished"; s.winner = playerId; this.ended = true;
          }
        } else {
          s.lastShot = {playerId,index,hit:false}; s.activeId = opponentId; s.turn++;
        }
      } else return {ok:false,message:"Неизвестное действие."};
    } else return {ok:false,message:"Неизвестное действие."};
    this.partySendState();
    return {ok:true};
  }

  async removePlayer(playerId) {
    if (!this.players.has(playerId)) return;

    this.players.delete(playerId);
    this.playerProfiles.delete(playerId);
    for (const [id, profile] of [...this.playerProfiles.entries()]) {
      if (profile.testBot) { this.players.delete(id); this.playerProfiles.delete(id); this.secretCharacters.delete(id); this.ready.delete(id); }
    }

    const wordRoundWasActive = this.gameId === "who-am-i" && this.gamePhase !== "lobby";
    this.ready.clear();
    this.secretCharacters.clear();
    this.wordAssignments.clear();
    this.wordSubmitted.clear();
    this.wordWriterOrder = [];
    this.wordRecipients.clear();
    this.gamePhase = "lobby";
    this.partyState = null;

    this.currentTurn = null;
    this.pending = null;
    this.ended = false;

    await this.clearTurnTimer();

    this.broadcast("player-left", {
      playersCount: this.players.size,
      maxPlayers: this.maxPlayers
    });
    this.broadcastRoster();
    if (wordRoundWasActive) {
      this.broadcast("word-round-reset", {
        message: "Игрок покинул комнату. Раздачу слов нужно начать заново."
      });
    }

    if (this.players.size === 0) {
      await this.updateDirectory();
      this.pack = null;
      this.roomId = null;
      this.createdAt = null;
      this.hostPlayerId = null;
    } else {
      if (this.hostPlayerId && !this.players.has(this.hostPlayerId)) {
        this.hostPlayerId = [...this.players.keys()].find(id => !this.playerProfiles.get(id)?.testBot) || null;
        for (const [id, socket] of this.players) {
          this.send(socket, "room-host-changed", {
            hostPlayerId: this.hostPlayerId,
            isHost: id === this.hostPlayerId
          });
        }
      }
      await this.updateDirectory();
    }
  }

  json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...extraHeaders
      }
    });
  }

  async directoryFetch(request) {
    const url = new URL(request.url);

    const path = url.pathname;

    if (path === "/api/public-rooms" && request.method === "GET") {
      const rooms = await this.ctx.storage.get("publicRooms") || [];

      return this.json(
        rooms.filter(room =>
          room.playersCount < (Number(room.maxPlayers) || 2) &&
          (!url.searchParams.get("game") || room.gameId === url.searchParams.get("game")) &&
          Date.now() - room.createdAt < 12 * 60 * 60 * 1000
        )
      );
    }

    if (path.startsWith("/api/images/") && request.method === "GET") {
      const imageId = path.slice("/api/images/".length);
      if (!/^[a-f0-9]{32}$/.test(imageId)) return new Response("Not found", { status: 404 });
      const image = await this.ctx.storage.get("pack-image:" + imageId);
      if (!image) return new Response("Not found", { status: 404 });
      const contentType = await this.ctx.storage.get("pack-image-type:" + imageId) || "image/webp";
      return new Response(image, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (path === "/api/packs" && request.method === "GET") {
      const packs = await this.ctx.storage.get("publishedPacks") || [];
      let migrated = false;

      // Старые изображения, сохранённые прямо в JSON, переносим в отдельные объекты.
      for (const pack of packs) {
        for (const character of (pack.characters || [])) {
          const image = character?.image;
          if (typeof image !== "string" || !image.startsWith("data:image/")) continue;
          const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
          if (!match) {
            character.image = "";
            migrated = true;
            continue;
          }
          const imageId = crypto.randomUUID().replace(/-/g, "");
          const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
          await this.ctx.storage.put("pack-image:" + imageId, bytes);
          await this.ctx.storage.put("pack-image-type:" + imageId, match[1]);
          character.image = "/api/images/" + imageId;
          migrated = true;
        }
      }
      if (migrated) await this.ctx.storage.put("publishedPacks", packs);

      return this.json(
        packs.map(pack => ({
          id: pack.id,
          name: pack.name,
          author: pack.author,
          characters: pack.characters,
          createdAt: pack.createdAt
        })),
        200,
        { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" }
      );
    }

    if (path === "/api/packs" && request.method === "POST") {
      let body;

      try {
        body = await request.json();
      } catch {
        return this.json({ ok: false, message: "Неверный формат данных." }, 400);
      }

      const pack = body?.pack;
      const author = String(body?.author || "Игрок").trim().slice(0, 40);

      if (
        !pack ||
        !Array.isArray(pack.characters) ||
        pack.characters.length < 2 ||
        pack.characters.length > 60
      ) {
        return this.json({
          ok: false,
          message: "В паке должно быть от 2 до 60 персонажей."
        }, 400);
      }

      const cleanCharacters = [];

      for (let i = 0; i < pack.characters.length; i++) {
        const character = pack.characters[i] || {};
        const name = String(character.name || "").trim().slice(0, 60);
        const id = String(character.id || "character_" + i).slice(0, 100);
        const emoji = String(character.emoji || "").slice(0, 16);
        const image = character.image == null
          ? null
          : String(character.image);

        if (!name) {
          return this.json({
            ok: false,
            message: "У каждого персонажа должно быть имя."
          }, 400);
        }

        if (image && (
          (!image.startsWith("data:image/") && !/^\/api\/images\/[a-f0-9]{32}$/.test(image)) ||
          image.length > 500000
        )) {
          return this.json({
            ok: false,
            message: "Одно из изображений слишком большое или имеет неверный формат."
          }, 400);
        }

        cleanCharacters.push({
          id,
          name,
          emoji,
          image
        });
      }

      const cleanPack = {
        name: String(pack.name || "Пользовательский пак")
          .trim()
          .slice(0, 60),
        characters: cleanCharacters
      };

      const serialized = JSON.stringify(cleanPack);

      if (serialized.length > 1800000) {
        return this.json({
          ok: false,
          message: "Размер пака превышает допустимый лимит."
        }, 413);
      }

      const packs = await this.ctx.storage.get("publishedPacks") || [];

      // Бинарные изображения храним отдельно от списка паков.
      for (const character of cleanCharacters) {
        if (typeof character.image !== "string" || !character.image.startsWith("data:image/")) continue;
        const match = character.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          character.image = "";
          continue;
        }
        const imageId = crypto.randomUUID().replace(/-/g, "");
        const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
        await this.ctx.storage.put("pack-image:" + imageId, bytes);
        await this.ctx.storage.put("pack-image-type:" + imageId, match[1]);
        character.image = "/api/images/" + imageId;
      }

      const entry = {
        id: "published_" + crypto.randomUUID(),
        name: cleanPack.name,
        author: author || "Игрок",
        characters: cleanCharacters,
        createdAt: Date.now()
      };

      packs.unshift(entry);

      await this.ctx.storage.put(
        "publishedPacks",
        packs.slice(0, 300)
      );

      return this.json({
        ok: true,
        id: entry.id
      });
    }

    if (path.startsWith("/api/packs/") && request.method === "DELETE") {
      const id = decodeURIComponent(path.slice("/api/packs/".length));
      const packs = await this.ctx.storage.get("publishedPacks") || [];
      const updated = packs.filter(pack => pack.id !== id);

      await this.ctx.storage.put("publishedPacks", updated);

      return this.json({ ok: true });
    }

    if (path === "/internal/room-upsert" && request.method === "POST") {
      let room;

      try {
        room = await request.json();
      } catch {
        return this.json({ ok: false }, 400);
      }

      if (!room?.roomId || !/^[A-Z0-9_-]{3,16}$/.test(room.roomId) || !["who-is-it","who-am-i","alias","codenames","spy","imaginarium","mafia"].includes(room.gameId)) {
        return this.json({ ok: false }, 400);
      }

      const rooms = await this.ctx.storage.get("publicRooms") || [];
      const updated = rooms.filter(item => !(item.roomId === room.roomId && item.gameId === room.gameId));

      updated.push(room);

      await this.ctx.storage.put("publicRooms", updated.slice(-200));

      return this.json({ ok: true });
    }

    if (
      path.startsWith("/internal/room-delete/") &&
      request.method === "DELETE"
    ) {
      const key = path.slice("/internal/room-delete/".length).split("/");
      const gameId = key[0];
      const roomId = key[1];
      const rooms = await this.ctx.storage.get("publicRooms") || [];

      await this.ctx.storage.put(
        "publicRooms",
        rooms.filter(room => !(room.roomId === roomId && room.gameId === gameId))
      );

      return this.json({ ok: true });
    }

    return this.json({ ok: false, message: "Маршрут не найден." }, 404);
  }

  async fetch(request) {
    if (this.isDirectory) {
      return this.directoryFetch(request);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket connection required", {
        status: 426
      });
    }

    const url = new URL(request.url);
    this.roomId = url.searchParams.get("id");
    this.gameId = url.searchParams.get("game") || "who-is-it";

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    const playerId = crypto.randomUUID();

    server.send(JSON.stringify({
      event: "connected",
      data: { playerId }
    }));

    server.addEventListener("message", event => {
      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      this.handleMessage(server, playerId, message);
    });

    const remove = () => {
      this.removePlayer(playerId);
    };

    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async handleMessage(socket, playerId, message) {
    const event = message.event;
    const data = message.data ?? {};
    const requestId = message.requestId;

    const reply = result => {
      this.reply(socket, requestId, result);
    };

    if (event === "create-room" || event === "create-lobby") {
      const isGameWithPack = event === "create-room";
      const pack = data.pack;
      const settings = data.settings || {};

      const requestedMaxPlayers = this.gameId === "who-is-it" ? 2 : Number(settings.maxPlayers || 2);
      const allowedTimers = [0, 15, 30, 45, 60, 90, 120];
      const timerSeconds = Number(settings.timerSeconds ?? 0);
      const requestedCode = String(settings.roomCode || this.roomId || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,16}$/.test(requestedCode) || requestedCode !== this.roomId || ![2,3,4,5,6].includes(requestedMaxPlayers) || !allowedTimers.includes(timerSeconds)) {
        reply({ ok: false, message: "Проверь код комнаты, количество игроков и время на вопрос." });
        return;
      }
      if (isGameWithPack && (!pack || !Array.isArray(pack.characters) || pack.characters.length < 2 || pack.characters.length > 60)) {
        reply({ ok: false, message: "Не удалось создать комнату или неверный набор персонажей." });
        return;
      }
      if (!isGameWithPack && this.gameId === "who-is-it") {
        reply({ ok: false, message: "Для игры «Кто это?» нужен выбранный пак." });
        return;
      }

      if (this.players.size !== 0 || this.createdAt) {
        reply({
          ok: false,
          message: "Не удалось создать комнату или неверный набор персонажей."
        });
        return;
      }

      const requestedCount = isGameWithPack ? Number(settings.cardCount || pack.characters.length) : 0;
      const allowedCounts = [20, 30, 40, 50, 60];

      if (isGameWithPack && (
        !allowedCounts.includes(requestedCount) ||
        pack.characters.length < requestedCount
      )) {
        reply({
          ok: false,
          message: "В выбранном паке недостаточно карточек."
        });
        return;
      }

      if (isGameWithPack && ![0, 15, 30, 45, 60, 90, 120].includes(timerSeconds)) {
        reply({
          ok: false,
          message: "Неверное значение таймера."
        });
        return;
      }

      const access = settings.access === "public" ? "public" : "private";

      if (this.players.size === 0) this.chatMessages = [];
      this.pack = isGameWithPack ? {
        name: String(pack.name || "Пак").slice(0, 60),
        characters: pack.characters.slice(0, requestedCount)
      } : null;

      this.roomName = String(settings.roomName || "Комната")
        .trim()
        .slice(0, 50) || "Комната";

      this.access = access;
      this.maxPlayers = requestedMaxPlayers;
      this.timerSeconds = timerSeconds;
      this.roomId = requestedCode;
      this.createdAt = Date.now();
      this.hostPlayerId = playerId;
      this.players.set(playerId, socket);
      this.playerProfiles.set(playerId, {
        nickname: String(settings.nickname || "Игрок").trim().slice(0, 20) || "Игрок",
        avatar: typeof settings.avatar === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(settings.avatar) && settings.avatar.length <= 700000 ? settings.avatar : "🙂",
        seatIndex: this.gameId === "mafia" ? 0 : null
      });

      await this.updateDirectory();

      reply({
        ok: true,
        settings: {
          roomName: this.roomName,
          roomCode: this.roomId,
          access: this.access,
          maxPlayers: this.maxPlayers,
          timerSeconds: this.timerSeconds,
          cardCount: this.pack?.characters?.length || 0
        }
      });
      this.broadcastRoster();

      return;
    }

    if (event === "join-room") {
      if (!this.createdAt) {
        reply({ ok: false, message: "Комната не найдена." });
        return;
      }

      if (this.access === "private" && data.accessByCode !== true) {
        // Private rooms are joinable only when the player supplies the exact code.
      }

      if (this.partyState || (this.gameId === "who-am-i" && this.gamePhase !== "lobby")) {
        reply({ ok:false, message:"Игра уже началась. Для следующей партии создай новую комнату." });
        return;
      }

      if (this.players.size >= this.maxPlayers) {
        reply({
          ok: false,
          message: "В комнате уже достигнут лимит игроков."
        });
        return;
      }

      if (this.ended) {
        reply({
          ok: false,
          message: "Эта игра уже завершена."
        });
        return;
      }

      this.players.set(playerId, socket);
      const profile = data.profile || {};
      this.playerProfiles.set(playerId, {
        nickname: String(profile.nickname || "Игрок").trim().slice(0, 20) || "Игрок",
        avatar: typeof profile.avatar === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(profile.avatar) && profile.avatar.length <= 700000 ? profile.avatar : "🙂",
        seatIndex: this.gameId === "mafia" ? Array.from({length:this.maxPlayers},(_,i)=>i).find(i=>![...this.playerProfiles.values()].some(p=>p.seatIndex===i)) ?? null : null
      });
      reply({
        ok: true,
        pack: this.pack,
        settings: {
          roomName: this.roomName,
          roomCode: this.roomId,
          access: this.access,
          maxPlayers: this.maxPlayers,
          timerSeconds: this.timerSeconds,
          cardCount: this.pack?.characters?.length || 0
        }
      });

      this.broadcast("player-joined", {
        playersCount: this.players.size,
        maxPlayers: this.maxPlayers,
        hostPlayerId: this.hostPlayerId
      }, socket);
      this.broadcastRoster();
      if (this.gameId === "alias" && !this.aliasTeams) this.aliasTeams = {};
      if (this.gameId === "who-am-i") this.send(socket, "who-am-i-chat-history", {messages:this.chatMessages.slice(-100)});

      await this.updateDirectory();
      if (this.gameId === "mafia" && this.players.size >= this.maxPlayers && this.players.size >= 4) {
        this.partyStart();
      }
      return;
    }

    if (!this.players.has(playerId)) {
      reply({
        ok: false,
        message: "Сначала войдите в комнату."
      });
      return;
    }

    if (event === "who-am-i-chat" && this.gameId === "who-am-i") {
      const message = String(data.message || "").trim().replace(/\s+/g," ").slice(0,300);
      if (!message) { reply({ok:false,message:"Напиши сообщение."}); return; }
      const profile = this.playerProfiles.get(playerId) || {};
      const entry = {
        nickname:String(profile.nickname || "Игрок").slice(0,20),
        message,
        timestamp:Date.now()
      };
      this.chatMessages.push(entry);
      this.chatMessages = this.chatMessages.slice(-100);
      this.broadcast("who-am-i-chat-message", entry);
      reply({ok:true});
      return;
    }

    if (event === "select-seat" && (this.gameId === "who-am-i" || this.gameId === "mafia")) {
      if (this.gamePhase !== "lobby") {
        reply({ ok:false, message:"Место можно выбрать только до начала игры." });
        return;
      }
      const seatIndex = Number(data.seatIndex);
      if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= this.maxPlayers) {
        reply({ ok:false, message:"Это место недоступно." });
        return;
      }
      const occupied = [...this.playerProfiles.entries()].find(([id, profile]) => id !== playerId && profile.seatIndex === seatIndex);
      if (occupied) {
        reply({ ok:false, message:"Это место уже занято. Выбери другое." });
        return;
      }
      const profile = this.playerProfiles.get(playerId) || { nickname:"Игрок", avatar:"🙂" };
      profile.seatIndex = seatIndex;
      this.playerProfiles.set(playerId, profile);
      this.broadcastRoster();
      reply({ ok:true, seatIndex });
      return;
    }

    if (event === "update-room-settings") {
      if (playerId !== this.hostPlayerId || this.ready.size > 0 || (this.gameId === "who-am-i" && this.gamePhase !== "lobby")) {
        reply({ ok: false, message: "Настройки может менять создатель до начала игры." });
        return;
      }
      const next = data.settings || {};
      const nextName = String(next.roomName || "").trim().slice(0, 50);
      const nextAccess = next.access === "public" ? "public" : "private";
      const nextMax = this.gameId === "who-is-it" ? 2 : Number(next.maxPlayers || this.maxPlayers);
      const nextTimer = Number(next.timerSeconds ?? this.timerSeconds);
      if (!nextName || ![2,3,4,5,6].includes(nextMax) || ![0,15,30,45,60,90,120].includes(nextTimer) || this.players.size > nextMax) {
        reply({ ok: false, message: "Некорректные настройки комнаты." });
        return;
      }
      this.roomName = nextName;
      this.access = nextAccess;
      this.maxPlayers = nextMax;
      this.timerSeconds = nextTimer;
      for (const profile of this.playerProfiles.values()) {
        if (Number.isInteger(profile.seatIndex) && profile.seatIndex >= nextMax) profile.seatIndex = null;
      }
      await this.updateDirectory();
      const settings = { roomName:this.roomName, roomCode:this.roomId, access:this.access, maxPlayers:this.maxPlayers, timerSeconds:this.timerSeconds };
      this.broadcast("room-settings-updated", settings);
      this.broadcastRoster();
      reply({ ok:true, settings });
      return;
    }

    if (this.gameId === "who-am-i" && event === "start-word-round") {
      if (playerId !== this.hostPlayerId) {
        reply({ ok:false, message:"Начать игру может только создатель комнаты." });
        return;
      }
      const seatsReady = [...this.playerProfiles.values()].filter(profile => Number.isInteger(profile.seatIndex)).length === this.players.size;
      if (!seatsReady) {
        reply({ ok:false, message:"Каждый игрок должен выбрать своё место за столом." });
        return;
      }
      if (this.gamePhase !== "lobby" || this.players.size < 2) {
        reply({ ok:false, message:"Для начала игры должны подключиться все игроки." });
        return;
      }
      this.gamePhase = "writing";
      this.wordAssignments.clear();
      this.wordSubmitted.clear();
      const ids = [...this.players.keys()];
      // Keep the writing turn in the original player order; only randomize recipients.
      this.wordWriterOrder = [...ids];
      this.wordRecipients.clear();
      const shuffledRecipients = [...ids];
      let hasSelfAssignment = true;
      while (hasSelfAssignment) {
        for (let i = shuffledRecipients.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledRecipients[i], shuffledRecipients[j]] = [shuffledRecipients[j], shuffledRecipients[i]];
        }
        hasSelfAssignment = ids.some((writerId, index) => writerId === shuffledRecipients[index]);
      }
      for (let i = 0; i < ids.length; i++) {
        this.wordRecipients.set(ids[i], shuffledRecipients[i]);
      }
      for (const botId of ids.filter(id=>this.playerProfiles.get(id)?.testBot)) {
        const targetId=this.wordRecipients.get(botId);
        this.wordAssignments.set(targetId,["Космонавт","Пингвин","Телескоп","Вулкан","Библиотека","Пианино"][Math.floor(Math.random()*6)]);
        this.wordSubmitted.add(botId);
      }
      const firstWriter = this.wordWriterOrder.find(id=>!this.wordSubmitted.has(id));
      const firstRecipient = this.wordRecipients.get(firstWriter);
      this.send(this.players.get(firstWriter), "word-entry-turn", {
        playerNumber:ids.indexOf(firstWriter)+1,
        targetPlayerNumber:ids.indexOf(firstRecipient)+1,
        targetPlayerId:firstRecipient,
        totalPlayers:ids.length
      });
      this.broadcast("word-round-start", { playersCount:ids.length, totalPlayers:ids.length });
      reply({ok:true});
      return;
    }

    if (this.gameId === "who-am-i" && event === "submit-player-word") {
      if (this.gamePhase !== "writing" || this.wordSubmitted.has(playerId)) {
        reply({ok:false, message:"Сейчас нельзя отправить слово."});
        return;
      }
      const word = String(data.word || "").trim().replace(/\s+/g," ").slice(0,40);
      if (!word || word.length < 2) {
        reply({ok:false, message:"Введи слово длиной хотя бы 2 символа."});
        return;
      }
      const ids = [...this.players.keys()];
      const index = this.wordWriterOrder.indexOf(playerId);
      const submittedHumanCount=[...this.wordSubmitted].filter(id=>!this.playerProfiles.get(id)?.testBot).length;
      if (index < 0 || ids.length < 2 || index !== submittedHumanCount) {
        reply({ok:false, message:"Сейчас очередь другого игрока."});
        return;
      }
      const recipientId = this.wordRecipients.get(playerId);
      if (!recipientId || recipientId === playerId || this.wordAssignments.has(recipientId)) {
        reply({ok:false, message:"Не удалось назначить получателя слова. Перезапусти раздачу."});
        return;
      }
      this.wordAssignments.set(recipientId, word);
      // Reveal each assigned word to every player except its recipient.
      for (const viewerId of ids) {
        if (viewerId === recipientId) continue;
        const visibleWords = Object.fromEntries(
          [...this.wordAssignments.entries()].filter(([targetId]) => targetId !== viewerId)
        );
        this.send(this.players.get(viewerId), "who-am-i-visible-words", {words:visibleWords});
      }
      this.wordSubmitted.add(playerId);
      reply({ok:true, waiting:true});
      this.send(this.players.get(playerId), "word-submitted", {message:"Слово принято. Оно скрыто от тебя и будет показано адресату."});
      if (this.wordSubmitted.size === ids.length) {
        this.gamePhase = "playing";
        for (const id of ids) {
          this.send(this.players.get(id), "your-secret-word", {
            hasSecretWord:true,
            playerNumber:ids.indexOf(id)+1
          });
          const visibleWords = Object.fromEntries(
            [...this.wordAssignments.entries()].filter(([targetId]) => targetId !== id)
          );
          this.send(this.players.get(id), "who-am-i-visible-words", {words:visibleWords});
        }
        this.gamePhase = "playing";
        this.currentTurn = ids[0];
        this.pending = null;
        this.broadcast("word-round-complete", {playersCount:ids.length});
        await this.broadcastWhoAmITurn();
      } else {
        this.broadcast("word-submission-progress", {submitted:this.wordSubmitted.size,total:ids.length});
        const nextWriterId = this.wordWriterOrder.find(id=>!this.wordSubmitted.has(id));
        const nextRecipientId = this.wordRecipients.get(nextWriterId);
        this.send(this.players.get(nextWriterId), "word-entry-turn", {
          playerNumber:ids.indexOf(nextWriterId)+1,
          targetPlayerNumber:ids.indexOf(nextRecipientId)+1,
          targetPlayerId:nextRecipientId,
          totalPlayers:ids.length
        });
      }
      return;
    }

    if (this.gameId === "who-am-i" && event === "who-am-i-question") {
      const question = String(data.question || "").trim().slice(0,180);
      if (this.gamePhase !== "playing" || this.currentTurn !== playerId || this.pending || !question) { reply({ok:false,message:"Сейчас нельзя задать вопрос."}); return; }
      this.pending = {type:"who-am-i-question",from:playerId};
      const askerNumber=[...this.players.keys()].indexOf(playerId)+1;
      const opponents=[...this.players.keys()].filter(id=>id!==playerId);
      if(opponents.every(id=>this.playerProfiles.get(id)?.testBot)){
        this.broadcast("who-am-i-question",{question,askerNumber,isYourQuestion:true});
        this.broadcast("who-am-i-answer",{answer:"unknown",responderNumber:2});
        this.pending=null;
      }else{
        for (const [id,socket] of this.players) this.send(socket,"who-am-i-question",{question,askerNumber,isYourQuestion:id===playerId});
      }
      reply({ok:true}); return;
    }
    if (this.gameId === "who-am-i" && event === "who-am-i-answer") {
      if (this.playerProfiles.get(playerId)?.testBot) { reply({ok:false,message:"Тестовые боты не принимают действия."}); return; }
      if (this.gamePhase !== "playing" || !this.pending || this.pending.type !== "who-am-i-question" || this.pending.from === playerId) { reply({ok:false,message:"Сейчас нельзя ответить."}); return; }
      const answer = ["yes","no","unknown"].includes(data.answer) ? data.answer : null;
      if (!answer) { reply({ok:false,message:"Выбери ответ."}); return; }
      this.broadcast("who-am-i-answer",{answer,responderNumber:[...this.players.keys()].indexOf(playerId)+1});
      await this.advanceWhoAmITurn(); reply({ok:true}); return;
    }
    if (this.gameId === "who-am-i" && event === "who-am-i-guess") {
      const guess = String(data.guess || "").trim().replace(/\\s+/g," ").slice(0,40);
      if (this.gamePhase !== "playing" || this.currentTurn !== playerId || this.pending || guess.length < 2) { reply({ok:false,message:"Сейчас нельзя проверить догадку."}); return; }
      const norm = v => String(v||"").toLocaleLowerCase("ru").replace(/[ё]/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim();
      const correct = norm(guess) === norm(this.wordAssignments.get(playerId));
      if (correct) {
        this.gamePhase="finished"; this.ended=true; this.currentTurn=null;
        const winnerNumber=[...this.players.keys()].indexOf(playerId)+1;
        this.broadcast("who-am-i-finished",{winnerNumber,winnerId:playerId,message:"Игрок №"+winnerNumber+" угадал своё слово!"});
        await this.updateDirectory();
      } else {
        this.send(this.players.get(playerId),"who-am-i-guess-result",{correct:false,message:"Пока не угадал. Ход переходит дальше."});
        await this.advanceWhoAmITurn();
      }
      reply({ok:true,correct}); return;
    }
    if (this.gameId === "who-am-i" && event === "who-am-i-pass") {
      if (this.gamePhase !== "playing" || this.currentTurn !== playerId || (this.pending && !(this.pending.type === "who-am-i-question" && this.pending.from === playerId))) { reply({ok:false,message:"Сейчас нельзя передать ход."}); return; }
      await this.advanceWhoAmITurn(); reply({ok:true}); return;
    }

    if (event === "party-start") {
      const minimum = this.gameId === "alias" ? 1 : (this.gameId === "codenames" || this.gameId === "mafia" ? 4 : (this.gameId === "spy" || this.gameId === "imaginarium" ? 3 : 2));
      if (playerId !== this.hostPlayerId || this.gamePhase !== "lobby" || this.players.size < minimum) {
        reply({ok:false,message:"Для запуска нужно минимум " + minimum + " игрока(ов)."}); return;
      }
      const result=this.partyStart(); reply(result); return;
    }
    if (event === "party-action") {
      const action=String(data.action||"");
      const payload=data.payload&&typeof data.payload==="object"?data.payload:{};
      const result=this.partyHandleAction(playerId,action,payload);
      reply(result); return;
    }
    if (event === "player-ready") {
      const secretCharacterId = String(
        data.secretCharacterId || ""
      );

      const characterExists = this.pack?.characters?.some(
        character => String(character.id) === secretCharacterId
      );

      if (
        this.ended ||
        this.players.size !== 2 ||
        !this.pack ||
        !secretCharacterId ||
        !characterExists
      ) {
        reply({
          ok: false,
          message: this.players.size !== 2
            ? "Подожди, пока подключится второй игрок."
            : "Не удалось сохранить выбранного персонажа."
        });
        return;
      }

      if (this.ready.has(playerId)) {
        reply({
          ok: false,
          message: "Ты уже выбрал персонажа."
        });
        return;
      }

      this.secretCharacters.set(playerId, secretCharacterId);
      this.ready.add(playerId);

      this.broadcast("player-ready", {}, socket);

      if (this.players.size === 2 && this.ready.size === 2) {
        const ids = [...this.players.keys()];

        this.currentTurn = ids.find(id => !this.playerProfiles.get(id)?.testBot) || ids[0];

        this.pending = null;
        this.ended = false;

        this.broadcast("online-start");
        await this.sendTurn();
      } else {
        reply({
          ok: true,
          waiting: true
        });
        return;
      }

      reply({ ok: true });
      return;
    }

    if (event === "ask-question") {
      const question = String(data.question || "")
        .trim()
        .slice(0, 250);

      if (
        this.ended ||
        this.ready.size !== 2 ||
        this.currentTurn !== playerId ||
        this.pending ||
        !question
      ) {
        reply({
          ok: false,
          message: "Сейчас нельзя задать вопрос."
        });
        return;
      }

      await this.clearTurnTimer();

      this.pending = {
        type: "question",
        from: playerId
      };

      const opponentId = [...this.players.keys()].find(id => id !== playerId);
      if (opponentId && this.playerProfiles.get(opponentId)?.testBot) {
        this.send(socket, "online-answer", {answer:false});
        this.pending = null;
        this.currentTurn = playerId;
        await this.sendTurn();
      } else {
        this.broadcast("online-question", {question}, socket);
      }

      reply({ ok: true });
      return;
    }

    if (event === "answer-question") {
      if (
        this.ended ||
        !this.pending ||
        this.pending.type !== "question" ||
        this.pending.from === playerId
      ) {
        reply({
          ok: false,
          message: "Нет вопроса для ответа."
        });
        return;
      }

      const asker = this.players.get(this.pending.from);

      if (asker) {
        this.send(asker, "online-answer", {
          answer: !!data.answer
        });
      }

      this.pending = null;
      this.currentTurn = playerId;

      await this.sendTurn();

      reply({ ok: true });
      return;
    }

    if (event === "make-guess") {
      const guessId = String(data.guessId || "").trim();

      if (
        this.ended ||
        this.ready.size !== 2 ||
        this.currentTurn !== playerId ||
        this.pending ||
        !guessId
      ) {
        reply({
          ok: false,
          message: "Сейчас нельзя угадывать."
        });
        return;
      }

      const opponentId = [...this.players.keys()].find(
        id => id !== playerId
      );

      if (!opponentId || !this.secretCharacters.has(opponentId)) {
        reply({
          ok: false,
          message: "Соперник ещё не выбрал персонажа."
        });
        return;
      }

      await this.clearTurnTimer();

      const correct =
        this.secretCharacters.get(opponentId) === guessId;

      const guesser = this.players.get(playerId);

      if (guesser) {
        this.send(guesser, "online-guess-result", {
          correct
        });
      }

      this.broadcast("online-guess-made", {
        correct
      }, guesser);

      if (correct) {
        this.ended = true;
        this.pending = null;
        this.currentTurn = null;

        this.broadcast("online-ended", {
          message: "Игра окончена! Персонаж угадан."
        });

        await this.updateDirectory();
      } else {
        this.currentTurn = this.playerProfiles.get(opponentId)?.testBot ? playerId : opponentId;
        this.pending = null;
        await this.sendTurn();
      }

      reply({ ok: true, correct });
      return;
    }

    if (event === "leave-room") {
      await this.removePlayer(playerId);
      reply({ ok: true });
      return;
    }

    reply({
      ok: false,
      message: "Неизвестное действие."
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/room") {
      const roomId = String(url.searchParams.get("id") || "").trim().toUpperCase();
      const gameId = url.searchParams.get("game") || "who-is-it";

      if (!/^[A-Z0-9_-]{3,16}$/.test(roomId) || !["who-is-it","who-am-i","alias","codenames","spy","imaginarium","mafia"].includes(gameId)) {
        return new Response("Неверный код комнаты", {
          status: 400
        });
      }

      const room = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName(gameId + ":" + roomId)
      );

      return room.fetch(request);
    }

    if (
      url.pathname === "/api/public-rooms" ||
      url.pathname === "/api/packs" ||
      url.pathname.startsWith("/api/packs/") ||
      url.pathname.startsWith("/api/images/")
    ) {
      const directory = env.GAME_ROOM.get(
        env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY")
      );

      return directory.fetch(request);
    }

    // Static site files are stored in the KAZO_STATIC KV namespace.
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response("Bad request", { status: 400 }); }
    if (pathname.includes("\\\\") || pathname.split("/").some(part => part === "..")) {
      return new Response("Bad request", { status: 400 });
    }
    const candidates = [pathname];
    if (pathname.endsWith("/")) candidates.push(pathname + "index.html");
    else if (!pathname.split("/").pop().includes(".")) candidates.push(pathname + "/index.html", pathname + ".html");
    let asset = null;
    for (const key of candidates) {
      const found = await env.KAZO_STATIC.getWithMetadata(key, { type: "arrayBuffer" });
      if (found && found.value) { asset = found; break; }
    }
    if (!asset) return new Response("Not found", { status: 404 });
    const meta = asset.metadata || {};
    const foundKey = candidates.find(key => key === pathname && key.includes(".")) || candidates.find(key => key.endsWith(".html")) || (pathname.endsWith("/") ? "index.html" : pathname);
    const ext = foundKey.split(".").pop().toLowerCase();
    const types = { html:"text/html; charset=utf-8", js:"application/javascript; charset=utf-8", css:"text/css; charset=utf-8", json:"application/json; charset=utf-8", svg:"image/svg+xml", png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", gif:"image/gif", ico:"image/x-icon", woff:"font/woff", woff2:"font/woff2", mp3:"audio/mpeg", mp4:"video/mp4" };
    const headers = new Headers();
    headers.set("Content-Type", meta.contentType || types[ext] || "application/octet-stream");
    headers.set("Cache-Control", meta.cacheControl || (ext === "html" ? "no-store" : "public, max-age=3600"));
    headers.set("X-Content-Type-Options", "nosniff");
    if (pathname.startsWith("/games/") && ext === "html" && pathname !== "/games/alias" && pathname !== "/games/alias/" && pathname !== "/games/alias/index.html" && !pathname.startsWith("/games/mafia") && !pathname.startsWith("/games/battleship")) {
      let gamePage = await new Response(asset.value).text();
      const fullscreenScript = '<style id="kazo-game-fullscreen">:fullscreen body{padding-top:0!important}:fullscreen .page{padding-top:0!important}</style><script>(function(){var busy=false;function goFullscreen(){if(document.fullscreenElement||busy)return;var root=document.documentElement;if(!root.requestFullscreen)return;busy=true;try{var result=root.requestFullscreen();if(result&&result.then)result.then(function(){busy=false;}).catch(function(){busy=false;});else busy=false;}catch(_){busy=false;}}document.addEventListener("pointerdown",goFullscreen,{capture:true,passive:true});document.addEventListener("touchstart",goFullscreen,{capture:true,passive:true});document.addEventListener("keydown",goFullscreen,true);})();</script>';
      gamePage = gamePage.replace('</head>', fullscreenScript+'</head>');
      return new Response(request.method === "HEAD" ? null : gamePage, { status: 200, headers });
    }
    if ((pathname === "/games/alias" || pathname === "/games/alias/" || pathname === "/games/alias/index.html") && ext === "html") {
      let page = await new Response(asset.value).text();
      const fullscreenScript = '<style id="kazo-game-fullscreen">:fullscreen body{padding-top:0!important}:fullscreen .page{padding-top:0!important}</style><script>(function(){var busy=false;function goFullscreen(){if(document.fullscreenElement||busy)return;var root=document.documentElement;if(!root.requestFullscreen)return;busy=true;try{var result=root.requestFullscreen();if(result&&result.then)result.then(function(){busy=false;}).catch(function(){busy=false;});else busy=false;}catch(_){busy=false;}}document.addEventListener("pointerdown",goFullscreen,{capture:true,passive:true});document.addEventListener("touchstart",goFullscreen,{capture:true,passive:true});document.addEventListener("keydown",goFullscreen,true);})();</script>';
      page = page.replace('</head>', fullscreenScript+'</head>');
      page = page.replace('const words=window.ALIAS_DIFFICULTY_PACKS?.[difficulty]||[];if(words.length!==1500)throw new Error("Словарь не загрузился полностью.");','const words=(window.ALIAS_DIFFICULTY_PACKS?.[difficulty]||[]).slice(0,2500);if(words.length!==2500)throw new Error("Словарь не загрузился полностью.");');
      page = page.replace(
        'const playing=!!state&&state.phase==="playing",review=!!state&&state.phase==="review";',
        'const playing=!!state&&state.phase==="playing",review=!!state&&state.phase==="review";if(!state||!["playing","review","finished"].includes(state.phase)){$("playBtn").classList.remove("hidden");$("playBtn").disabled=!host||roster.length<1;$("playBtn").textContent=host?"Начать игру":"Ожидаем запуска";return;}'
      );
      page = page.replace(
        'if(!state||state.phase==="finished"){const r=await act("alias-ready");if(r?.ok)status(r.started?"Все готовы. Начинается новая игра!":r.ready?"Ты готов. Ждём остальных игроков.":"Готовность отменена.");return;}',
        'if(!state||!["playing","review","finished"].includes(state.phase)){const r=await window.onlineGame.startGame();if(!r?.ok)status(r?.message||"Не удалось начать игру.");else status("Игра началась.");return;}if(state.phase==="finished"){const r=await act("alias-ready");if(r?.ok)status(r.started?"Все готовы. Начинается новая игра!":r.ready?"Ты готов. Ждём остальных игроков.":"Готовность отменена.");return;}'
      );
      page = page.replace("const current=revealed&&state.phase===\"playing\"?'<div class=\"wordLine current\">'+esc(state.currentWord||\"\")+'</div>':\"\";", "const current=revealed&&state.phase===\"playing\"?'<div class=\"wordLine current\">'+esc(state.secretWord||state.currentWord||\"\")+'</div>':\"\";");
      page = page.replace('const r=await act("word-guessed");if(r?.ok){revealed=true;draw();}', 'const r=await act("alias-correct");if(r?.ok){revealed=true;draw();}');
      page = page.replace('const words=state.lastTurn?.words||[];', 'const words=state.turnWords?.length?state.turnWords:(state.lastTurn?.words||[]);');
      page = page.replace('reviewMarks=(state.lastTurn?.words||[]).map(w=>w.status!=="unreviewed"&&w.status!=="skipped");', 'reviewMarks=(state.turnWords?.length?state.turnWords:(state.lastTurn?.words||[])).map(w=>w.status!=="unreviewed"&&w.status!=="skipped");');
      page = page.replace('const r=await act("alias-review-submit",{statuses});if(r?.ok){reviewMarks=[];draw();}return;', 'const r=await act("alias-review",{guessed:reviewMarks.map((ok,i)=>ok?i:-1).filter(i=>i>=0)});if(r?.ok){reviewMarks=[];draw();}else status(r?.message||"Не удалось подтвердить слова.");return;');
      page = page.replace('</style></head><body>', '.wordLine.current{border:1px solid #ffffff24;border-radius:12px;background:linear-gradient(180deg,#ffffff08,#ffffff03);padding:10px 16px;box-shadow:inset 0 1px #ffffff08,0 4px 14px #0002}\n</style></head><body>');
      page = page.replace('status("Загружено 1500 слов · "','status("Загружено 2500 слов · "');
      page = page.replace(
        'const mark=teamLocked?"":mine?.team===t?"−":"+";',
        'const mark=teamLocked||mine?.team===t?"":"+";'
      );
      return new Response(request.method === "HEAD" ? null : page, { status: 200, headers });
    }
    return new Response(request.method === "HEAD" ? null : asset.value, { status: 200, headers });
  }
};
