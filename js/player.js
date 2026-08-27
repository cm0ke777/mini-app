/* Плеер: blob-загрузка (рабочий seek), кроссфейд, режимы, радио-автодогрузка */
const Player = {
  queue: [], idx: -1, hist: [],
  shuffle: false, repeat: 0, // 0 обычн, 1 плейлист, 2 один
  loading: false, seekAfter: null,
  cache: new Map(), radioSeed: null,
  audio: new Audio(),
  blobReady: false,

  init(){
    const a = this.audio;
    a.addEventListener('timeupdate', () => this.onTime());
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('error', () => { if(this.queue[this.idx]) toast('⚠️ Ошибка воспроизведения'); this.setLoading(false); });
    a.addEventListener('canplay', () => {
      if(this.seekAfter != null){ a.currentTime = this.seekAfter; this.seekAfter = null; }
    });
  },

  playQueue(tracks, startIdx, radioSeed){
    this.queue = tracks.slice(); this.idx = startIdx; this.hist = [];
    this.radioSeed = radioSeed || null;
    this.loadCurrent();
  },

  current(){ return this.queue[this.idx]; },

  async loadCurrent(){
    const t = this.current();
    if(!t) return;
    haptic('medium');
    Store.pushRecent(t);
    UIPlayer.meta(t);
    document.getElementById('miniBar').classList.remove('hidden');
    this.blobReady = false;

    const url = Api.proxyUrl(t);
    // 1) если есть в кэше — играем blob сразу (мгновенно + seek)
    if(this.cache.has(t.id)){
      this.audio.src = this.cache.get(t.id);
      this.audio.play().catch(()=>{});
      this.blobReady = true;
      this.setLoading(false);
    } else {
      // 2) стрим для мгновенного старта + blob в фоне для seek/кроссфейда
      this.setLoading(true);
      this.audio.src = url;
      this.audio.play().catch(()=>{});
      this.loadBlob(url, t.id);
    }
    UIPlayer.highlight(t);
    this.prefetchNext();
  },

  async loadBlob(url, id){
    try{
      const res = await fetch(url);
      if(!res.ok) throw 0;
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      this.cache.set(id, obj);
      if(this.cache.size > 8){ const k = this.cache.keys().next().value; URL.revokeObjectURL(this.cache.get(k)); this.cache.delete(k); }
      // бесшовная подмена на blob (сохраняя позицию)
      if(this.current() && this.current().id === id){
        const pos = this.audio.currentTime, was = !this.audio.paused;
        this.audio.src = obj; this.audio.currentTime = pos;
        if(was) this.audio.play().catch(()=>{});
        this.blobReady = true;
        this.setLoading(false);
      }
    }catch(e){ /* остаёмся на стриме */ this.setLoading(false); }
  },

  prefetchNext(){
    const n = this.queue[this.idx + 1];
    if(n && !this.cache.has(n.id)){
      fetch(Api.proxyUrl(n)).then(r => r.ok ? r.blob() : null).then(b => {
        if(b && !this.cache.has(n.id)) this.cache.set(n.id, URL.createObjectURL(b));
      }).catch(()=>{});
    }
  },

  setLoading(v){
    this.loading = v;
    ['miniPlay','fpPlay'].forEach(id => document.getElementById(id).classList.toggle('loading', v));
  },

  toggle(){
    if(!this.current()) return;
    haptic('light');
    if(this.audio.paused) this.audio.play().catch(()=>{}); else this.audio.pause();
  },

  next(auto){
    let ni;
    if(this.shuffle && this.queue.length > 1){
      do{ ni = Math.floor(Math.random() * this.queue.length); }while(ni === this.idx);
    } else ni = this.idx + 1;
    if(ni >= this.queue.length){
      if(this.repeat === 1) ni = 0;
      else if(auto && this.radioSeed){ this.extendRadio(); return; }
      else if(!auto) ni = this.queue.length - 1;
      else { this.audio.pause(); return; }
    }
    this.hist.push(this.idx); this.idx = ni; this.loadCurrent();
  },

  prev(){
    if(this.audio.currentTime > 3){ this.audio.currentTime = 0; return; }
    if(this.hist.length){ this.idx = this.hist.pop(); this.loadCurrent(); }
    else if(this.idx > 0){ this.idx--; this.loadCurrent(); }
  },

  async extendRadio(){
    toast('📻 Радио: подбираю похожие...');
    const more = await Api.suggestions(this.radioSeed);
    const fresh = more.filter(t => !this.queue.some(q => q.id === t.id));
    if(fresh.length){ this.queue = this.queue.concat(fresh); this.next(true); }
    else toast('Радио завершено');
  },

  seek(sec){
    if(!isFinite(this.audio.duration) || this.audio.seekable.length === 0){
      this.seekAfter = sec; toast('⏳ Буферизация для перемотки...');
      const t = this.current();
      if(t && !this.cache.has(t.id)) this.loadBlob(Api.proxyUrl(t), t.id);
      return;
    }
    this.audio.currentTime = sec;
  },

  onEnded(){
    if(this.repeat === 2){ this.audio.currentTime = 0; this.audio.play(); return; }
    const cf = +Store.settings().crossfade || 0;
    this.next(true);
  },

  onTime(){
    const a = this.audio, d = a.duration || 0;
    const pct = d ? (a.currentTime / d) * 100 : 0;
    document.getElementById('miniProg').style.width = pct + '%';
    const r = document.getElementById('fpRange');
    if(document.activeElement !== r) r.value = Math.round(pct * 10);
    document.getElementById('fpCur').textContent = fmt(a.currentTime);
    document.getElementById('fpDur').textContent = fmt(d);
    UIPlayer.playIcon(!a.paused);
    // кроссфейд
    const cf = +Store.settings().crossfade || 0;
    if(cf && d && (d - a.currentTime) <= cf && !this._fading && !a.paused){
      this._fading = true; this.crossfadeNext(cf);
    }
  },

  async crossfadeNext(cf){
    let ni = this.shuffle ? Math.floor(Math.random() * this.queue.length) : this.idx + 1;
    if(ni >= this.queue.length) ni = this.repeat === 1 ? 0 : -1;
    if(ni < 0){ this._fading = false; return; }
    const nt = this.queue[ni];
    let url = this.cache.get(nt.id);
    if(!url){ try{ const b = await (await fetch(Api.proxyUrl(nt))).blob(); url = URL.createObjectURL(b); this.cache.set(nt.id, url); }catch(e){ this._fading = false; return; } }
    const old = this.audio;
    const nw = new Audio(url); nw.volume = 0;
    await nw.play().catch(()=>{});
    const step = setInterval(() => {
      nw.volume = Math.min(1, nw.volume + 0.1);
      old.volume = Math.max(0, old.volume - 0.1);
      if(nw.volume >= 1){
        clearInterval(step);
        old.pause(); old.volume = 1; old.src = '';
        this.audio = nw; this.bindNew();
        this.hist.push(this.idx); this.idx = ni;
        Store.pushRecent(nt); UIPlayer.meta(nt); UIPlayer.highlight(nt);
        this.blobReady = true; this._fading = false;
        this.prefetchNext();
      }
    }, cf * 100);
  },

  bindNew(){
    const a = this.audio;
    a.addEventListener('timeupdate', () => this.onTime());
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('error', () => this.setLoading(false));
  }
};

/* Обновление UI плеера */
const UIPlayer = {
  meta(t){
    document.getElementById('miniTitle').textContent = t.name;
    document.getElementById('miniArtist').textContent = t.artist;
    document.getElementById('fpTitle').textContent = t.name;
    document.getElementById('fpArtist').textContent = t.artist;
    if(t.img){ document.getElementById('miniImg').src = t.img; document.getElementById('fpImg').src = t.img; }
  },
  playIcon(playing){
    document.getElementById('miniPlay').innerHTML = playing ? I.pause : I.play;
    document.getElementById('fpPlay').innerHTML = playing ? I.pause : I.play;
  },
  highlight(t){
    document.querySelectorAll('.trk.playing').forEach(el => el.classList.remove('playing'));
    document.querySelectorAll('.trk[data-tid="' + t.id + '"]').forEach(el => el.classList.add('playing'));
  },
  modes(){
    document.getElementById('fpShuffle').classList.toggle('on', Player.shuffle);
    const rp = document.getElementById('fpRepeat');
    rp.classList.toggle('on', Player.repeat > 0);
    rp.innerHTML = Player.repeat === 2 ? I.repeat1 : I.repeat;
  }
};