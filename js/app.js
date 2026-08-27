const GENRES = [[132,'Pop','🎤'],[116,'Hip-Hop','🎧'],[113,'Dance','⚡'],[165,'R&B','🎹'],[152,'Rock','🎸']];

const App = {
  homeCache: {},
  searchResults: [],

  init(){
    Player.init();
    this.staticIcons();
    this.bindNav();
    this.bindPlayer();
    this.bindSearch();
    this.bindGlobal();
    this.bindProfile();
    Nav.go('home', {});
    this.loadHome();
  },

  staticIcons(){
    document.getElementById('backBtn').innerHTML = I.back;
    document.getElementById('searchOpenBtn').innerHTML = I.search;
    document.getElementById('profileBtn').innerHTML = I.user;
    document.getElementById('miniPrev').innerHTML = I.prev;
    document.getElementById('miniNext').innerHTML = I.next;
    document.getElementById('fpClose').innerHTML = I.close;
    document.getElementById('fpPrev').innerHTML = I.prev;
    document.getElementById('fpNext').innerHTML = I.next;
    document.getElementById('fpShuffle').innerHTML = I.shuffle;
    document.getElementById('fpRepeat').innerHTML = I.repeat;
    document.querySelector('.sico').innerHTML = I.search;
    document.querySelectorAll('.fp-acts .i')[0].innerHTML = I.plus;
    document.querySelectorAll('.fp-acts .i')[1].innerHTML = I.radio;
    document.querySelectorAll('.fp-acts .i')[2].innerHTML = I.share;
    document.querySelectorAll('.fp-acts .i')[3].innerHTML = I.send;
    UIPlayer.modes();
  },

  onView(view){
    if(view === 'playlists') this.renderPlaylists();
    if(view === 'profile') this.renderProfile();
    if(view === 'search') setTimeout(() => document.getElementById('searchInput').focus(), 250);
    if(view === 'home') this.renderRecent();
  },

  /* ══════════ ГЛАВНЫЙ ЭКРАН ══════════ */
  loadHome(){
    this.renderPicks();
    this.renderRecent();
    this.loadPopular();
    this.loadNew();
    this.loadArtists();
    this.loadGenres();
  },

  renderPicks(){
    const p = [
      ['🌍','Мировой', () => this.openGlobal()],
      ['🇷🇺','Россия', () => this.openCountry('ru', '🇷🇺 Топ России')],
      ['🇺🇸','США', () => this.openCountry('us', '🇺 Топ США')],
      ['🇬','UK', () => this.openCountry('gb', '🇬🇧 Топ UK')],
      ['🆕','Релизы', () => this.openNewFull()],
      ['❤️','Плейлисты', () => Nav.go('playlists')],
      ['🕘','Недавнее', () => this.openRecent()]
    ];
    document.getElementById('picksRow').innerHTML = p.map((x, i) =>
      '<div class="pick" data-pick="' + i + '"><div class="ring"><div class="emo">' + x[0] + '</div></div><span>' + x[1] + '</span></div>').join('');
    this._picks = p;
  },

  renderRecent(){
    const r = Store.recent();
    document.getElementById('recentWrap').classList.toggle('hidden', !r.length);
    document.getElementById('recentRow').innerHTML = r.map((t, i) =>
      '<div class="card" data-recent="' + i + '"><img src="' + esc(t.img) + '" loading="lazy" onload="this.classList.add(\'ld\')"><div class="cn">' + esc(t.name) + '</div><div class="ca">' + esc(t.artist) + '</div></div>').join('');
    this._recent = r;
  },

  async loadPopular(){
    const el = document.getElementById('popularList');
    el.innerHTML = skeletons(4);
    try{
      let metas = this.homeCache.global;
      if(!metas){ metas = await Meta.globalChart(); if(metas.length) this.homeCache.global = metas; }
      if(!metas || !metas.length) throw 0;
      this.resolveInto(el, metas.slice(0, 12), 'Популярное сейчас');
    }catch(e){
      try{
        const t = await Api.trending();
        this.renderTracks(el, t.slice(0, 10), { title: 'Популярное сейчас' });
      }catch(e2){ el.innerHTML = errBox('Не удалось загрузить', 'popular'); }
    }
  },

  async loadNew(){
    const el = document.getElementById('newList');
    el.innerHTML = skeletons(3);
    try{
      let albums = this.homeCache.albums;
      if(!albums){ albums = await Meta.newAlbums(); if(albums.length) this.homeCache.albums = albums; }
      if(!albums || !albums.length) throw 0;
      this._albums = albums;
      el.innerHTML = '<div class="hscroll">' + albums.slice(0, 10).map((a, i) =>
        '<div class="card" data-album="' + i + '"><img src="' + esc(a.img) + '" loading="lazy" onload="this.classList.add(\'ld\')"><div class="cn">' + esc(a.title) + '</div><div class="ca">' + esc(a.artist) + '</div></div>').join('') + '</div>';
    }catch(e){ el.innerHTML = errBox('Не удалось загрузить релизы', 'new'); }
  },

  /* НОВЫЙ РАЗДЕЛ: артисты из мирового чарта */
  async loadArtists(){
    if(!document.getElementById('artistsSect')){
      document.getElementById('picksCharts').closest('.sect').insertAdjacentHTML('beforebegin',
        '<div class="sect" id="artistsSect"><div class="sect-h"><h3>🎤 Артисты в фокусе</h3></div><div id="artistsRow" class="hscroll"></div></div>');
    }
    const row = document.getElementById('artistsRow');
    try{
      const arts = await Meta.topArtists();
      this._artists = arts;
      row.innerHTML = arts.slice(0, 10).map((a, i) =>
        '<div class="card" data-artist="' + i + '"><img src="' + esc(a.img) + '" loading="lazy" onload="this.classList.add(\'ld\')"><div class="cn">' + esc(a.name) + '</div><div class="ca">Артист</div></div>').join('');
    }catch(e){ row.innerHTML = '<div class="errbox">Артисты недоступны</div>'; }
  },

  async loadGenres(){
    const el = document.getElementById('picksCharts');
    el.innerHTML = GENRES.map((g, i) =>
      '<div class="card gcard" data-genre="' + i + '" style="background:linear-gradient(135deg,hsl(' + (g[0]*7)%360 + ',60%,25%),hsl(' + (g[0]*3)%360 + ',70%,12%))"><div class="gemo">' + g[2] + '</div><div class="cn">' + g[1] + '</div></div>').join('');
  },

  /* ══ Универсальный резолвер списка ══ */
  resolveInto(container, metas, title){
    container.innerHTML = '<div class="mstat">⏳ Сопоставляю с библиотекой… 0/' + metas.length + '</div><div class="tracks rlist"></div>';
    this.runResolve(container, metas, title);
  },

  runResolve(body, metas, title){
    const stat = body.querySelector('.mstat'), list = body.querySelector('.rlist');
    if(!stat || !list) return;
    list._tracks = []; list._ctx = { title };
    this.setListMeta(title, 0);
    const q = metas.slice(0, 30);
    let done = 0;
    stat.textContent = '⏳ Сопоставляю… 0/' + q.length;
    pool(q, async m => {
      const j = await Resolve.meta(m);
      done++;
      stat.textContent = '⏳ ' + done + '/' + q.length + ' · найдено ' + list._tracks.length;
      if(j && !list._tracks.some(x => x.id === j.id)){
        list._tracks.push(j);
        this.appendRow(list, j, list._tracks.length - 1);
        this.setListMeta(title, list._tracks.length);
      }
    }, 4).then(() => {
      stat.textContent = list._tracks.length
        ? '✅ Доступно в iWavee: ' + list._tracks.length + ' из ' + q.length + ' (остальное пропущено)'
        : '😔 В библиотеке ничего не найдено';
    });
  },

  /* ══ Открытие списков ══ */
  async openGlobal(){
    try{
      let metas = this.homeCache.global || await Meta.globalChart();
      this.homeCache.global = metas;
      Nav.go('list', { title: '🌍 Мировой чарт' });
      const body = document.getElementById('listBody');
      body.innerHTML = '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
      this.runResolve(body, metas, '🌍 Мировой чарт');
    }catch(e){ toast('❌ Чарт недоступен'); }
  },

  async openCountry(cc, title){
    toast('⏳ Загружаю чарт…');
    try{
      let metas;
      try{ metas = await Meta.countryChart(cc); }
      catch(e){ if(cc === 'ru') metas = await Meta.ruFallback(); else throw 0; }
      if(!metas || !metas.length) throw 0;
      Nav.go('list', { title });
      const body = document.getElementById('listBody');
      body.innerHTML = '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
      this.runResolve(body, metas, title);
    }catch(e){ toast('❌ ' + title + ': чарт временно недоступен'); }
  },

  /* Релизы: автоподбор альбома, в котором есть играбельные треки */
  async openNewFull(){
    toast('⏳ Подбираю доступный релиз…');
    try{
      const albums = this.homeCache.albums || await Meta.newAlbums();
      this.homeCache.albums = albums;
      if(!albums.length) throw 0;
      this._albums = albums;
      for(let i = 0; i < Math.min(4, albums.length); i++){
        const metas = await Meta.albumTracks(albums[i].dzId, albums[i].img).catch(() => []);
        if(!metas.length) continue;
        let hits = 0;
        await pool(metas.slice(0, 4), async m => { if(await Resolve.meta(m)) hits++; }, 4);
        if(hits > 0){ this.openAlbumView(albums[i], metas); return; }
      }
      const m0 = await Meta.albumTracks(albums[0].dzId, albums[0].img).catch(() => []);
      this.openAlbumView(albums[0], m0);
    }catch(e){ toast('❌ Релизы недоступны'); }
  },

  openAlbumByDz(a){
    Nav.go('list', { title: '💿 ' + a.title });
    const body = document.getElementById('listBody');
    body.innerHTML = skeletons(6);
    Meta.albumTracks(a.dzId, a.img).then(metas => {
      body.innerHTML = '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
      this.runResolve(body, metas, '💿 ' + a.title);
    }).catch(() => { body.innerHTML = errBox('Ошибка альбома', 'new'); });
  },

  openAlbumView(a, metas){
    Nav.go('list', { title: '💿 ' + a.title });
    const body = document.getElementById('listBody');
    body.innerHTML = '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
    this.runResolve(body, metas, '💿 ' + a.title);
  },

  /* НОВОЕ: страница артиста (топ + похожие) */
  async openArtist(a){
    Nav.go('list', { title: '🎤 ' + a.name });
    const body = document.getElementById('listBody');
    body.innerHTML = skeletons(6);
    try{
      const rel = await Meta.artistRelated(a.dzId).catch(() => []);
      this._rel = rel;
      const relHtml = rel.length
        ? '<div class="hscroll" style="margin-bottom:14px">' + rel.map((r, i) =>
          '<div class="card" data-rel="' + i + '"><img src="' + esc(r.img) + '" loading="lazy" onload="this.classList.add(\'ld\')"><div class="cn">' + esc(r.name) + '</div><div class="ca">Похожий артист</div></div>').join('') + '</div>'
        : '';
      const metas = await Meta.artistTop(a.dzId);
      body.innerHTML = relHtml + '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
      this.runResolve(body, metas, '🎤 ' + a.name);
    }catch(e){ body.innerHTML = errBox('Артист недоступен', 'genres'); }
  },

  async openGenre(i){
    const g = GENRES[i]; if(!g) return;
    Nav.go('list', { title: g[2] + ' ' + g[1] });
    const body = document.getElementById('listBody');
    body.innerHTML = skeletons(6);
    try{
      const metas = await Meta.genreChart(g[0]);
      body.innerHTML = '<div class="mstat">⏳ Сопоставляю…</div><div class="tracks rlist"></div>';
      this.runResolve(body, metas, g[2] + ' ' + g[1]);
    }catch(e){ body.innerHTML = errBox('Жанр временно недоступен', 'genres'); }
  },

  openRecent(){
    const r = Store.recent();
    if(!r.length){ toast('Пока пусто'); return; }
    Nav.go('list', { title: '🕘 Недавнее' });
    this.renderTracks(document.getElementById('listBody'), r, { title: 'Недавнее' });
    this.setListMeta('🕘 Недавнее', r.length);
  },

  setListMeta(title, count){
    document.getElementById('listTitle').textContent = title;
    document.getElementById('listCount').textContent = count + ' трек(ов)';
  },

  openList(title, tracks){
    Nav.go('list', { title });
    this.renderTracks(document.getElementById('listBody'), tracks, { title });
    this.setListMeta(title, tracks.length);
  },

  /* ══ Треки ══ */
  rowHTML(t, i){
    return '<div class="trk" data-i="' + i + '" data-tid="' + esc(t.id) + '">' +
      '<img src="' + esc(t.img) + '" loading="lazy" onload="this.classList.add(\'ld\')" onerror="this.style.visibility=\'hidden\'">' +
      '<div class="inf"><div class="tn">' + esc(t.name) + '</div><div class="ta">' + esc(t.artist) + (t.album ? ' · ' + esc(t.album) : '') + '</div></div>' +
      '<span class="dur">' + fmt(t.dur) + '</span>' +
      '<button class="tb" data-act="add">' + I.plus + '</button>' +
      '<button class="tb" data-act="menu">' + I.dots + '</button></div>';
  },
  appendRow(container, t, i){
    container.insertAdjacentHTML('beforeend', this.rowHTML(t, i));
    if(Player.current()) UIPlayer.highlight(Player.current());
  },
  renderTracks(container, tracks, ctx){
    container._tracks = tracks; container._ctx = ctx;
    container.innerHTML = tracks.map((t, i) => this.rowHTML(t, i)).join('');
    if(Player.current()) UIPlayer.highlight(Player.current());
  },

  /* ══ SEARCH ══ */
  bindSearch(){
    const inp = document.getElementById('searchInput');
    let tm;
    inp.addEventListener('input', () => {
      document.getElementById('searchClear').classList.toggle('hidden', !inp.value);
      clearTimeout(tm);
      const q = inp.value.trim();
      if(q.length < 2){ document.getElementById('suggBox').classList.add('hidden'); return; }
      tm = setTimeout(() => this.suggest(q), 300);
    });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ this.doSearch(inp.value.trim()); } });
    document.getElementById('searchClear').onclick = () => { inp.value = ''; document.getElementById('suggBox').classList.add('hidden'); document.getElementById('searchClear').classList.add('hidden'); inp.focus(); };
    this.renderHistory();
  },

  renderHistory(){
    const h = Store.history();
    document.getElementById('historyBox').innerHTML = h.map((x, i) =>
      '<button class="chip" data-hist="' + i + '">' + I.clock + esc(x) + '</button>').join('');
    this._hist = h;
  },

  async suggest(q){
    const box = document.getElementById('suggBox');
    try{
      const d = await Meta.autocomplete(q);
      const sugg = [];
      ((d.tracks || {}).data || []).slice(0, 3).forEach(t => sugg.push({ v: t.title + ' — ' + t.artist.name, type: 'song' }));
      ((d.artists || {}).data || []).slice(0, 2).forEach(a => sugg.push({ v: a.name, type: 'artist' }));
      ((d.albums || {}).data || []).slice(0, 2).forEach(a => sugg.push({ v: a.title, type: 'album' }));
      if(!sugg.length){ box.classList.add('hidden'); return; }
      box.innerHTML = sugg.slice(0, 7).map((s, i) =>
        '<div data-sugg="' + i + '">' + (s.type === 'artist' ? I.user : s.type === 'album' ? I.music : I.search) + '<span>' + esc(s.v) + '</span></div>').join('');
      box._s = sugg; box.classList.remove('hidden');
    }catch(e){ box.classList.add('hidden'); }
  },

  async doSearch(q){
    if(!q) return;
    haptic('light');
    Store.pushHistory(q); this.renderHistory();
    document.getElementById('suggBox').classList.add('hidden');
    document.getElementById('searchInput').value = q;
    const el = document.getElementById('searchResults');
    el.innerHTML = skeletons(6);
    try{
      const res = await Api.search(q, 1, 40);
      this.searchResults = res;
      if(!res.length) el.innerHTML = '<div class="errbox">Ничего не найдено по запросу «' + esc(q) + '»</div>';
      else this.renderTracks(el, res, { title: 'Поиск: ' + q });
    }catch(e){ el.innerHTML = errBox('Ошибка поиска', 'search'); }
  },

  /* ══ Sheets ══ */
  openAddSheet(t){
    const pls = Store.playlists();
    let html = '<h4>Добавить в плейлист</h4>';
    html += pls.map(p => '<button class="sh-item" data-shadd="' + p.id + '">' + I.music + '<span>' + esc(p.name) + ' (' + p.tracks.length + ')</span></button>').join('');
    html += '<button class="sh-item" data-shnew="1">' + I.plus + '<span>Создать новый плейлист</span></button>';
    const s = sheet(html); s._track = t;
  },

  openNewPlaylistSheet(){
    const s = sheet('<h4>Новый плейлист</h4><input class="sh-input" id="npName" placeholder="Название плейлиста" maxlength="40"><button class="sh-save" id="npSave">Создать</button>');
    s.querySelector('#npSave').onclick = () => {
      const name = s.querySelector('#npName').value.trim();
      const pl = Store.createPlaylist(name);
      toast('✅ Плейлист «' + pl.name + '» создан');
      if(s._track){ Store.addToPlaylist(pl.id, s._track); toast('➕ Добавлено в «' + pl.name + '»'); }
      closeSheet();
      if(Nav.current().view === 'playlists') this.renderPlaylists();
    };
    s._track = this._menuTrack;
  },

  openMenuSheet(t, ctx){
    this._menuTrack = t;
    let html = '<h4>' + esc(t.name) + '</h4>';
    html += '<button class="sh-item" data-m="add">' + I.plus + '<span>Добавить в плейлист</span></button>';
    html += '<button class="sh-item" data-m="radio">' + I.radio + '<span>Радио по треку</span></button>';
    html += '<button class="sh-item" data-m="share">' + I.share + '<span>Поделиться</span></button>';
    html += '<button class="sh-item" data-m="send">' + I.send + '<span>Скачать (отправить в бот)</span></button>';
    html += '<button class="sh-item" data-m="lyr">' + I.lyrics + '<span>Текст песни</span></button>';
    if(ctx && ctx.plId) html += '<button class="sh-item danger" data-m="rmpl">' + I.trash + '<span>Убрать из плейлиста</span></button>';
    const s = sheet(html); s._ctx = ctx;
  },

  async openRadio(t){
    closeSheet();
    toast('📻 Запускаю радио по «' + t.name + '»...');
    Nav.go('list', { title: '📻 Радио' });
    const el = document.getElementById('listBody');
    el.innerHTML = skeletons(6);
    try{
      const sug = await Api.suggestions(t);
      const q = [t].concat(sug.filter(x => x.id !== t.id));
      this.renderTracks(el, q, { title: 'Радио' });
      this.setListMeta('📻 Радио • ' + t.name, q.length);
      Player.playQueue(q, 0, t);
    }catch(e){ el.innerHTML = errBox('Радио недоступно', 'radio'); }
  },

  share(t){
    const text = '🎵 ' + t.name + ' — ' + t.artist + '\n🎧 Слушай бесплатно в iWavee: https://t.me/iWavee_Bot';
    const url = 'https://t.me/iWavee_Bot';
    if(navigator.share){ navigator.share({ title: 'iWavee', text, url }).catch(()=>{}); }
    else{
      try{ navigator.clipboard.writeText(text); toast('📋 Скопировано! Вставь в любой чат'); }catch(e){}
      setTimeout(() => { try{ tg && tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text)); }catch(e){} }, 600);
    }
  },

  sendToBot(t){
    const webhook = new URLSearchParams(location.search).get('webhook');
    if(webhook){
      fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'play', name: t.name, artist: t.artist, id: t.id }) })
        .then(() => toast('📨 Бот пришлёт трек в чат!'))
        .catch(() => this.fallbackSend(t));
    } else this.fallbackSend(t);
  },
  fallbackSend(t){
    try{ navigator.clipboard.writeText(t.name + ' ' + t.artist); }catch(e){}
    toast('📋 Название скопировано — вставь в чат с ботом');
    setTimeout(() => { try{ tg && tg.openTelegramLink('https://t.me/iWavee_Bot'); }catch(e){} }, 800);
  },

  async openLyrics(t){
    const s = sheet('<h4>' + esc(t.name) + '</h4><div class="lyr">Загрузка...</div>');
    const l = await Api.lyrics(t);
    s.querySelector('.lyr').textContent = l || 'Текст не найден для этого трека 😔';
  },

  /* ══ Playlists ══ */
  renderPlaylists(){
    const pls = Store.playlists();
    const el = document.getElementById('plBody');
    if(!pls.length){
      el.innerHTML = '<div class="errbox">У тебя пока нет плейлистов.<br>Создай первый! <br><button data-retry="newpl">+ Создать</button></div>';
      return;
    }
    el.innerHTML = pls.map((p, i) =>
      '<div class="trk" data-pl="' + i + '"><img src="' + esc(p.tracks[0] ? p.tracks[0].img : '') + '" onload="this.classList.add(\'ld\')" onerror="this.style.visibility=\'hidden\'">' +
      '<div class="inf"><div class="tn">' + esc(p.name) + '</div><div class="ta">' + p.tracks.length + ' трек(ов)</div></div>' +
      '<button class="tb" data-act="plmenu">' + I.dots + '</button></div>').join('');
    this._pls = pls;
  },

  openPlaylist(i){
    const p = this._pls[i]; if(!p) return;
    Nav.go('list', { title: p.name, plId: p.id });
    const el = document.getElementById('listBody');
    if(!p.tracks.length) el.innerHTML = '<div class="errbox">Плейлист пуст</div>';
    else this.renderTracks(el, p.tracks, { title: p.name, plId: p.id });
    this.setListMeta(p.name, p.tracks.length);
  },

  openPlMenu(i){
    const p = this._pls[i]; if(!p) return;
    const s = sheet('<h4>' + esc(p.name) + '</h4>' +
      '<button class="sh-item" data-plm="play">' + I.play + '<span>Слушать весь</span></button>' +
      '<button class="sh-item" data-plm="ren">' + I.edit + '<span>Переименовать</span></button>' +
      '<button class="sh-item danger" data-plm="del">' + I.trash + '<span>Удалить плейлист</span></button>');
    s._pl = p; s._i = i;
  },

  /* ══ Profile ══ */
  renderProfile(){
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if(u){
      const nm = (u.first_name || '') + ' ' + (u.last_name || '');
      document.getElementById('pfName').textContent = nm.trim() || 'Гость';
      document.getElementById('pfUser').textContent = u.username ? '@' + u.username : 'Telegram';
      document.getElementById('pfAva').textContent = (u.first_name || '🎵')[0].toUpperCase();
    }
    const pls = Store.playlists();
    document.getElementById('pfStats').innerHTML =
      '<div><b>' + pls.length + '</b><span>плейлистов</span></div>' +
      '<div><b>' + pls.reduce((a, p) => a + p.tracks.length, 0) + '</b><span>треков</span></div>' +
      '<div><b>' + Store.recent().length + '</b><span>недавних</span></div>';
    const st = Store.settings();
    document.querySelectorAll('#qSeg button').forEach(b => b.classList.toggle('on', b.dataset.q === st.quality));
    document.querySelectorAll('#cfSeg button').forEach(b => b.classList.toggle('on', +b.dataset.cf === +st.crossfade));
  },

  bindProfile(){
    document.getElementById('qSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      const s = Store.settings(); s.quality = b.dataset.q; Store.saveSettings(s);
      this.renderProfile(); toast('🎧 Качество: ' + b.dataset.q);
    });
    document.getElementById('cfSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      const s = Store.settings(); s.crossfade = +b.dataset.cf; Store.saveSettings(s);
      this.renderProfile(); toast(+b.dataset.cf ? '🔀 Кроссфейд: ' + b.dataset.cf + 'с' : 'Кроссфейд выкл');
    });
    document.getElementById('btnClearHist').onclick = () => { Store.clearHistory(); this.renderHistory(); toast('🗑 История очищена'); };
    document.getElementById('btnClearRecent').onclick = () => { Store.clearRecent(); this.renderRecent(); toast('🗑 Недавние очищены'); };
    document.getElementById('btnClearCache').onclick = () => { localStorage.clear(); location.reload(); };
  },

  /* ══ Бинды ══ */
  bindNav(){
    document.getElementById('backBtn').onclick = () => { haptic('light'); Nav.back(); };
    try{ tg && tg.BackButton.onClick(() => Nav.back()); }catch(e){}
    document.getElementById('searchOpenBtn').onclick = () => Nav.go('search');
    document.getElementById('profileBtn').onclick = () => Nav.go('profile');
  },

  bindPlayer(){
    const openFull = () => { if(Player.current()) document.getElementById('fullOverlay').classList.remove('hidden'); };
    document.getElementById('miniInfo').onclick = openFull;
    document.getElementById('miniImg').onclick = openFull;
    document.getElementById('fpClose').onclick = () => document.getElementById('fullOverlay').classList.add('hidden');
    document.getElementById('miniPlay').onclick = e => { e.stopPropagation(); Player.toggle(); };
    document.getElementById('fpPlay').onclick = () => Player.toggle();
    document.getElementById('miniNext').onclick = e => { e.stopPropagation(); Player.next(false); };
    document.getElementById('fpNext').onclick = () => Player.next(false);
    document.getElementById('miniPrev').onclick = e => { e.stopPropagation(); Player.prev(); };
    document.getElementById('fpPrev').onclick = () => Player.prev();
    document.getElementById('fpShuffle').onclick = () => { Player.shuffle = !Player.shuffle; UIPlayer.modes(); haptic('light'); toast(Player.shuffle ? '🔀 Перемешивание вкл' : '➡️ Обычный порядок'); };
    document.getElementById('fpRepeat').onclick = () => { Player.repeat = (Player.repeat + 1) % 3; UIPlayer.modes(); haptic('light'); toast(['➡️ Обычный порядок','🔁 Повтор плейлиста','🔂 Повтор трека'][Player.repeat]); };
    const r = document.getElementById('fpRange');
    r.addEventListener('input', () => {
      const d = Player.audio.duration; if(!d) return;
      Player.seek((r.value / 1000) * d);
    });
    document.getElementById('fpAdd').onclick = () => Player.current() && this.openAddSheet(Player.current());
    document.getElementById('fpRadio').onclick = () => Player.current() && this.openRadio(Player.current());
    document.getElementById('fpShare').onclick = () => Player.current() && this.share(Player.current());
    document.getElementById('fpSend').onclick = () => Player.current() && this.sendToBot(Player.current());
    document.getElementById('plCreate').onclick = () => { this._menuTrack = null; this.openNewPlaylistSheet(); };
  },

  bindGlobal(){
    document.addEventListener('click', e => {
      const $ = s => e.target.closest(s);
      let el;

      if(el = $('[data-pick]')){ haptic('light'); this._picks[+el.dataset.pick][2](); return; }
      if(el = $('[data-recent]')){ Player.playQueue(this._recent, +el.dataset.recent); return; }
      if(el = $('[data-artist]')){ this.openArtist(this._artists[+el.dataset.artist]); return; }
      if(el = $('[data-rel]')){ this.openArtist(this._rel[+el.dataset.rel]); return; }
      if(el = $('[data-album]')){ this.openAlbumByDz(this._albums[+el.dataset.album]); return; }
      if(el = $('[data-genre]')){ this.openGenre(+el.dataset.genre); return; }
      if(el = $('[data-hist]')){ this.doSearch(this._hist[+el.dataset.hist]); return; }
      if(el = $('[data-sugg]')){ const s = document.getElementById('suggBox')._s[+el.dataset.sugg]; this.doSearch(s.v); return; }
      if(el = $('[data-go]')){
        const k = el.dataset.go;
        if(k === 'popular') this.openGlobal();
        if(k === 'new') this.openNewFull();
        return;
      }
      if(el = $('[data-retry]')){
        const k = el.dataset.retry;
        if(k === 'popular') this.loadPopular();
        if(k === 'new') this.loadNew();
        if(k === 'genres') this.loadGenres();
        if(k === 'newpl') this.openNewPlaylistSheet();
        if(k === 'search') this.doSearch(document.getElementById('searchInput').value.trim());
        return;
      }
      if(el = $('[data-pl]')){
        if(e.target.closest('[data-act="plmenu"]')){ this.openPlMenu(+el.dataset.pl); return; }
        this.openPlaylist(+el.dataset.pl); return;
      }

      const trk = $('[data-i]');
      if(trk){
        const cont = trk.parentElement;
        const tracks = cont._tracks || [];
        const t = tracks[+trk.dataset.i];
        if(!t) return;
        const act = e.target.closest('[data-act]');
        if(act){
          if(act.dataset.act === 'add') this.openAddSheet(t);
          if(act.dataset.act === 'menu') this.openMenuSheet(t, cont._ctx);
          return;
        }
        Player.playQueue(tracks, +trk.dataset.i, cont._ctx && cont._ctx.radio ? t : null);
        return;
      }

      const sh = document.getElementById('sheet');
      if(!document.getElementById('sheetWrap').classList.contains('hidden')){
        let b;
        if(b = $('[data-shadd]')){
          const ok = Store.addToPlaylist(b.dataset.shadd, sh._track);
          toast(ok ? '➕ Добавлено в плейлист' : 'ℹ️ Уже в этом плейлисте');
          closeSheet(); return;
        }
        if(b = $('[data-shnew]')){ const t = sh._track; this.openNewPlaylistSheet(); document.getElementById('sheet')._track = t; return; }
        if(b = $('[data-m]')){
          const t = this._menuTrack, ctx = sh._ctx, m = b.dataset.m;
          if(m === 'add') this.openAddSheet(t);
          if(m === 'radio') this.openRadio(t);
          if(m === 'share') this.share(t);
          if(m === 'send') this.sendToBot(t);
          if(m === 'lyr') this.openLyrics(t);
          if(m === 'rmpl' && ctx && ctx.plId){ Store.removeFromPlaylist(ctx.plId, t.id); toast('🗑 Убрано из плейлиста'); closeSheet(); if(Nav.current().view === 'list') this.openPlaylistById(ctx.plId); }
          return;
        }
        if(b = $('[data-plm]')){
          const p = sh._pl, m = b.dataset.plm;
          if(m === 'play' && p.tracks.length){ closeSheet(); Player.playQueue(p.tracks, 0); }
          if(m === 'ren'){
            const nn = prompt('Новое название:', p.name);
            if(nn && nn.trim()){ Store.renamePlaylist(p.id, nn.trim()); this.renderPlaylists(); toast('✏️ Переименовано'); }
            closeSheet();
          }
          if(m === 'del'){ if(confirm('Удалить плейлист «' + p.name + '»?')){ Store.deletePlaylist(p.id); this.renderPlaylists(); toast('🗑 Плейлист удалён'); } closeSheet(); }
          return;
        }
      }
    });
  },

  openPlaylistById(id){
    const i = Store.playlists().findIndex(p => p.id === id);
    if(i >= 0){ this._pls = Store.playlists(); this.openPlaylist(i); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());