const DB = {
  get(k, d){ try{ const v = localStorage.getItem('iw_' + k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('iw_' + k, JSON.stringify(v)); }catch(e){} },
  del(k){ localStorage.removeItem('iw_' + k); }
};

const Store = {
  settings(){ return Object.assign({ quality: '160kbps', crossfade: 0 }, DB.get('settings', {})); },
  saveSettings(s){ DB.set('settings', s); },

  history(){ return DB.get('history', []); },
  pushHistory(q){
    let h = this.history().filter(x => x !== q);
    h.unshift(q); h = h.slice(0, 8);
    DB.set('history', h);
  },
  clearHistory(){ DB.set('history', []); },

  recent(){ return DB.get('recent', []); },
  pushRecent(t){
    let r = this.recent().filter(x => x.id !== t.id);
    r.unshift(t); r = r.slice(0, 12);
    DB.set('recent', r);
  },
  clearRecent(){ DB.set('recent', []); },

  playlists(){ return DB.get('playlists', []); },
  save(p){ DB.set('playlists', p); },
  createPlaylist(name){
    const p = this.playlists();
    const pl = { id: 'pl' + Date.now(), name: name || ('Плейлист ' + (p.length + 1)), tracks: [], created: Date.now() };
    p.unshift(pl); this.save(p); return pl;
  },
  renamePlaylist(id, name){
    const p = this.playlists(); const f = p.find(x => x.id === id);
    if(f){ f.name = name; this.save(p); }
  },
  deletePlaylist(id){ this.save(this.playlists().filter(x => x.id !== id)); },
  addToPlaylist(id, t){
    const p = this.playlists(); const f = p.find(x => x.id === id);
    if(!f) return false;
    if(f.tracks.some(x => x.id === t.id)) return false;
    f.tracks.unshift(t); this.save(p); return true;
  },
  removeFromPlaylist(id, tid){
    const p = this.playlists(); const f = p.find(x => x.id === id);
    if(f){ f.tracks = f.tracks.filter(x => x.id !== tid); this.save(p); }
  }
};