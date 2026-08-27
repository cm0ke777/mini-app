const API = 'https://myprojectformusicbot.vercel.app';
const AUDIUS = 'https://discoveryprovider.audius.co';

const hq = u => (u || '').replace(/50x50/g, '500x500').replace(/150x150/g, '500x500');
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = s => { s = Math.max(0, s|0); return (s/60|0) + ':' + String(s%60).padStart(2,'0'); };

async function jget(path){
  const r = await fetch(API + path);
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function pickQ(dls, pref){
  if(!Array.isArray(dls) || !dls.length) return '';
  const order = pref === '96kbps' ? ['96kbps','160kbps','48kbps']
              : pref === '320kbps' ? ['320kbps','160kbps','96kbps']
              : ['160kbps','320kbps','96kbps'];
  for(const q of order){ const f = dls.find(d => d.quality === q && d.url); if(f) return f.url; }
  for(let i = dls.length-1; i >= 0; i--) if(dls[i].url) return dls[i].url;
  return '';
}

function normJio(t, pref){
  try{
    if(!t || !t.id) return null;
    const imgs = t.image || [];
    const dl = pickQ(t.downloadUrl || [], pref);
    if(!dl) return null;
    return {
      id: String(t.id), src: 'jio',
      name: String(t.name || 'Unknown'),
      artist: (t.artists && t.artists.primary && t.artists.primary[0] && t.artists.primary[0].name) || 'Unknown',
      album: (t.album && t.album.name) || '',
      dur: +t.duration || 0,
      img: hq(imgs.length ? imgs[imgs.length-1].url : ''),
      dl
    };
  }catch(e){ return null; }
}

function normAud(t, host){
  try{
    return {
      id: 'au_' + t.id, src: 'audius',
      name: t.title || 'Unknown',
      artist: (t.user && t.user.name) || 'Unknown',
      album: '', dur: +t.duration || 0,
      img: (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) || '',
      dl: host + '/v1/tracks/' + t.id + '/stream?app_name=iWaveeBot'
    };
  }catch(e){ return null; }
}

let AUD_HOST = AUDIUS;
async function audiusHost(){
  try{
    const r = await fetch('https://api.audius.co'); const d = await r.json();
    if(d.data && d.data[0]) AUD_HOST = d.data[0];
  }catch(e){}
  return AUD_HOST;
}

/* ══ JSON с обходом CORS (для Apple RSS) ══ */
async function fetchJSONCors(url){
  const chain = [
    url,
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    'https://corsproxy.io/?url=' + encodeURIComponent(url)
  ];
  for(const u of chain){
    try{
      const r = await fetch(u);
      if(r.ok) return await r.json();
    }catch(e){}
  }
  throw new Error('net');
}

/* ══════════ DEEZER (JSONP, без ключа) ══════════ */
function dz(path){
  return new Promise((res, rej) => {
    const cb = 'dzcb_' + Date.now() + '_' + Math.floor(Math.random()*1e5);
    const s = document.createElement('script');
    const tm = setTimeout(() => { cleanup(); rej(new Error('timeout')); }, 12000);
    function cleanup(){ try{ delete window[cb]; }catch(e){} s.remove(); clearTimeout(tm); }
    window[cb] = data => { cleanup(); (data && data.error) ? rej(new Error('dz')) : res(data); };
    s.src = 'https://api.deezer.com' + path + (path.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
    s.onerror = () => { cleanup(); rej(new Error('net')); };
    document.head.appendChild(s);
  });
}

const dzImg = t => (t.album && (t.album.cover_xl || t.album.cover_big || t.album.cover_medium)) || (t.artist && (t.artist.picture_xl || t.artist.picture_medium)) || '';
const dzTrack = t => ({ key: 'dz_'+t.id, title: t.title, artist: (t.artist && t.artist.name) || 'Unknown', img: dzImg(t), dur: t.duration });

const Meta = {
  _chart: null,
  async fullChart(){
    if(this._chart) return this._chart;
    this._chart = await dz('/chart?limit=30');
    return this._chart;
  },
  async globalChart(){
    const d = await this.fullChart();
    return (d.tracks.data || []).map(dzTrack);
  },
  async topArtists(){
    const d = await this.fullChart();
    return (d.artists.data || []).map(a => ({ dzId: a.id, name: a.name, img: a.picture_xl || a.picture_big || a.picture_medium || '' }));
  },
  async newAlbums(){
    const d = await this.fullChart();
    return (d.albums.data || []).map(a => ({ dzId: a.id, title: a.title, artist: a.artist.name, img: a.cover_xl || a.cover_big || '' }));
  },
  /* ЖАНРЫ: пробуем оба правильных эндпоинта */
  async genreChart(id){
    let tr = [];
    for(const p of ['/chart/genre/' + id + '?limit=30', '/genre/' + id + '/charts?limit=30']){
      try{
        const d = await dz(p);
        tr = ((d.tracks || {}).data) || [];
        if(tr.length) break;
      }catch(e){}
    }
    if(!tr.length) throw new Error('genre');
    return tr.map(dzTrack);
  },
  async albumTracks(id, cover){
    const d = await dz('/album/' + id + '/tracks?limit=30');
    return (d.data || []).map(t => {
      const m = dzTrack(t);
      if(!m.img) m.img = cover || '';
      return m;
    });
  },
  async artistTop(id){
    const d = await dz('/artist/' + id + '/top?limit=20');
    return (d.data || []).map(t => dzTrack(t));
  },
  async artistRelated(id){
    const d = await dz('/artist/' + id + '/related?limit=10');
    return (d.data || []).map(a => ({ dzId: a.id, name: a.name, img: a.picture_xl || a.picture_medium || '' }));
  },
  async autocomplete(q){
    return await dz('/search/autocomplete?q=' + encodeURIComponent(q));
  },
  /* ══ ЧАРТЫ СТРАН: Apple RSS + CORS-прокси ══ */
  async countryChart(cc){
    const url = 'https://rss.applemarketingtools.com/api/v2/' + cc + '/music/most-played/30/songs.json';
    const d = await fetchJSONCors(url);
    const arr = (d && d.feed && d.feed.results) || [];
    if(!arr.length) throw new Error('empty');
    return arr.map((s, i) => ({
      key: 'ap_' + cc + '_' + (s.id || i),
      title: s.name || s.title || 'Unknown',
      artist: s.artistName || 'Unknown',
      img: (s.artworkUrl100 || '').replace('100x100bb', '400x400bb').replace('100x100', '400x400'),
      dur: 0
    }));
  },
  /* ══ Фолбэк для России (если Apple убрал RU) ══ */
  async ruFallback(){
    const artists = ['Miyagi', 'Zivert', 'Anna Asti', 'Morgenshtern', 'Skriptonit', 'Tri Dnya Dozhdya'];
    let out = [];
    for(const q of artists){
      try{
        const d = await dz('/search/track?q=' + encodeURIComponent(q) + '&limit=5');
        out = out.concat((d.data || []).map(dzTrack));
      }catch(e){}
    }
    return out;
  }
};

/* ══════════ УМНОЕ СОПОСТАВЛЕНИЕ Meta → JioSaavn ══════════ */
const STOP = new Set(['remastered','remaster','version','ver','edit','single','feat','ft','featuring','live','demo','bonus','explicit','clean','mix','radio','extended','official','video','audio']);
const cleanT = s => String(s || '').replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ').replace(/feat\.?|ft\.?/gi, ' ');
const toks = s => cleanT(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').split(' ').filter(t => t && t.length > 1 && !STOP.has(t));
function overlap(a, b){
  const A = toks(a), B = toks(b);
  if(!A.length || !B.length) return 0;
  const set = new Set(A); let m = 0;
  B.forEach(t => { if(set.has(t)) m++; });
  return m / Math.min(A.length, B.length);
}

const Resolve = {
  cache(){ return DB.get('rcache2', {}); },   // новый кэш — старые «∅» не мешают
  save(c){ if(Object.keys(c).length > 600) c = {}; DB.set('rcache2', c); },
  score(m, j){
    const to = overlap(m.title, j.name), ao = overlap(m.artist, j.artist);
    if((to >= .55 && ao >= .35) || to >= .8) return to + ao;
    return 0;
  },
  async meta(m){
    const c = this.cache();
    if(c[m.key] !== undefined) return c[m.key] === '∅' ? null : c[m.key];
    let out = null, bs = 0;
    try{
      let cands = await Api.search(m.artist + ' ' + cleanT(m.title), 1, 5);
      for(const j of cands){ const s = this.score(m, j); if(s > bs){ bs = s; out = j; } }
      if(!out){ // вторая попытка — только по названию
        cands = await Api.search(cleanT(m.title), 1, 5);
        for(const j of cands){ const s = this.score(m, j); if(s > bs){ bs = s; out = j; } }
      }
    }catch(e){}
    c[m.key] = out || '∅'; this.save(c);
    return out;
  }
};

function pool(items, worker, conc){
  let i = 0; const run = [];
  for(let r = 0; r < Math.min(conc, items.length); r++){
    run.push((async () => { while(i < items.length){ const my = i++; await worker(items[my]); } })());
  }
  return Promise.all(run);
}

/* ══════════ ТЕКУЩИЙ API (аудио) ══════════ */
const Api = {
  async search(q, page = 1, limit = 30){
    const d = await jget('/api/search/songs?query=' + encodeURIComponent(q) + '&page=' + page + '&limit=' + limit);
    const res = (d.data && d.data.results) || [];
    const pref = Store.settings().quality;
    return res.map(t => normJio(t, pref)).filter(Boolean);
  },
  async trending(){
    const host = await audiusHost();
    const r = await fetch(host + '/v1/tracks/trending?limit=30&app_name=iWaveeBot');
    const d = await r.json();
    return (d.data || []).map(t => normAud(t, host)).filter(Boolean);
  },
  async suggestions(song){
    try{
      const d = await jget('/api/songs/' + song.id + '/suggestions');
      const arr = (d.data && (d.data.songs || d.data)) || [];
      if(Array.isArray(arr) && arr.length){
        const pref = Store.settings().quality;
        const out = arr.map(t => normJio(t, pref)).filter(Boolean).filter(t => t.id !== song.id);
        if(out.length) return out;
      }
    }catch(e){}
    return await this.search(song.artist, 1, 25);
  },
  async lyrics(song){
    try{
      const d = await jget('/api/songs/' + song.id + '/lyrics');
      const l = d.data && (d.data.lyrics || d.data.text);
      if(typeof l === 'string' && l.trim()) return l;
    }catch(e){}
    return '';
  },
  proxyUrl(song){
    if(song.src === 'audius') return song.dl;
    const safe = song.name.replace(/[^\wа-яА-ЯёЁ]+/g, '_').slice(0, 40);
    return API + '/api/proxy?url=' + encodeURIComponent(song.dl) + '&name=' + encodeURIComponent(safe) + '.mp3';
  }
};