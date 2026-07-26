(() => {
  const STORAGE_KEY = 'hyojuMemo.v2';
  const consonants = ['g','n','d','r','m','b','s','ng','j','ch','k','t','p','h'];
  const vowels = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];

  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('titleInput'), memo: $('memoArea'), pageLabel: $('pageLabel'), saveState: $('saveState'),
    prev: $('prevPage'), next: $('nextPage'), consonants: $('consonants'), vowels: $('vowels'),
    batchim: $('batchimBtn'), ssang: $('ssangBtn'), space: $('spaceBtn'), enter: $('enterBtn'),
    backspace: $('backspaceBtn'), clear: $('clearBtn'), settings: $('settingsBtn'), dialog: $('settingsDialog'),
    bg: $('bgColor'), keyboardColor: $('keyboardColor'), resetColors: $('resetColors'),
    keyboardPanel: $('keyboardPanel'), hideKeyboard: $('hideKeyboard'), showKeyboard: $('showKeyboard')
  };

  let state = loadState();
  let batchimMode = false;
  let ssangMode = false;
  let saveTimer = null;

  function blankPage() { return { title: '', tokens: [] }; }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length) {
        parsed.current = Math.max(0, Math.min(parsed.current || 0, parsed.pages.length - 1));
        parsed.colors ||= { bg:'#ffb6cf', keyboard:'#bfe8ff' };
        return parsed;
      }
    } catch (_) {}
    return { current:0, pages:[blankPage()], colors:{ bg:'#ffb6cf', keyboard:'#bfe8ff' } };
  }
  function page() { return state.pages[state.current]; }
  function scheduleSave() {
    els.saveState.textContent = '저장 중…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveState.textContent = '저장됨';
    }, 180);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveState.textContent = '저장됨';
  }
  function setColors() {
    document.documentElement.style.setProperty('--bg', state.colors.bg);
    document.documentElement.style.setProperty('--keyboard', state.colors.keyboard);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', state.colors.bg);
    els.bg.value = state.colors.bg;
    els.keyboardColor.value = state.colors.keyboard;
  }
  function makeKey(name, container) {
    const btn = document.createElement('button');
    btn.className = 'glyph-key'; btn.type='button'; btn.dataset.name=name;
    btn.setAttribute('aria-label', name);
    btn.innerHTML = `<img src="letters/${name}.png" alt="${name}">`;
    btn.addEventListener('click', () => pressGlyph(name, consonants.includes(name)));
    container.appendChild(btn);
  }
  consonants.forEach(x => makeKey(x, els.consonants));
  vowels.forEach(x => makeKey(x, els.vowels));

  function pressGlyph(name, isConsonant) {
    const tokens = page().tokens;
    if (batchimMode) {
      if (!isConsonant) return;
      const last = [...tokens].reverse().find(t => t.type === 'glyph');
      if (!last) return;
      last.batchim = name;
      batchimMode = false;
      els.batchim.classList.remove('active');
      renderMemo(); scheduleSave();
      return;
    }

    tokens.push({ type:'glyph', name });
    renderMemo(); scheduleSave(); scrollMemoBottom();
  }

  function tokenCell(token) {
    const cell = document.createElement('div');
    if (token.type === 'space') { cell.className='space-cell'; return cell; }
    cell.className='glyph-cell';
    const base = document.createElement('img'); base.className='base'; base.src=`letters/${token.name}.png`; base.alt=token.name; cell.appendChild(base);
    if (token.batchim) { const b=document.createElement('img'); b.className='batchim'; b.src=`letters/${token.batchim}.png`; b.alt='받침'; cell.appendChild(b); }
    if (token.ssang) { const s=document.createElement('img'); s.className='ssang'; s.src='letters/ssang.png'; s.alt='쌍자음'; cell.appendChild(s); }
    return cell;
  }
  function renderMemo() {
    els.memo.innerHTML='';
    const tokens = page().tokens;
    if (!tokens.length) {
      const hint=document.createElement('div'); hint.className='empty-hint'; hint.textContent='아래 효주어 키보드로 입력하세요.'; els.memo.appendChild(hint); return;
    }
    let row=[];
    const flush = () => {
      const rowEl=document.createElement('div'); rowEl.className='memo-row';
      row.forEach(t=>rowEl.appendChild(tokenCell(t)));
      els.memo.appendChild(rowEl); row=[];
    };
    for (const token of tokens) {
      if (token.type==='newline') { flush(); continue; }
      row.push(token);
      if (row.length===18) flush();
    }
    if (row.length || tokens[tokens.length-1]?.type==='newline') flush();
  }
  function renderPage() {
    els.title.value=page().title || '';
    els.pageLabel.textContent=`${state.current+1} / ${state.pages.length}`;
    els.prev.disabled=state.current===0;
    renderMemo();
  }
  function scrollMemoBottom() { requestAnimationFrame(()=>{ els.memo.scrollTop=els.memo.scrollHeight; }); }

  els.title.addEventListener('input', () => { page().title=els.title.value; scheduleSave(); });
  els.prev.addEventListener('click', () => { if(state.current>0){ saveNow(); state.current--; resetModes(); renderPage(); scheduleSave(); } });
  els.next.addEventListener('click', () => { saveNow(); if(state.current===state.pages.length-1) state.pages.push(blankPage()); state.current++; resetModes(); renderPage(); scheduleSave(); });
  els.batchim.addEventListener('click', () => { batchimMode=!batchimMode; ssangMode=false; els.batchim.classList.toggle('active',batchimMode); els.ssang.classList.remove('active'); });
  els.ssang.addEventListener('click', () => {
    const tokens = page().tokens;
    const last = [...tokens].reverse().find(t => t.type === 'glyph');

    batchimMode = false;
    els.batchim.classList.remove('active');

    if (!last || !consonants.includes(last.name)) return;

    last.ssang = !last.ssang;
    renderMemo();
    scheduleSave();
  });
  els.space.addEventListener('click', () => { page().tokens.push({type:'space'}); renderMemo(); scheduleSave(); });
  els.enter.addEventListener('click', () => { page().tokens.push({type:'newline'}); renderMemo(); scheduleSave(); scrollMemoBottom(); });
  els.backspace.addEventListener('click', () => {
    const tokens=page().tokens; const last=tokens[tokens.length-1];
    if(!last) return;
    if (last.type === 'glyph' && last.batchim) delete last.batchim;
    else if (last.type === 'glyph' && last.ssang) delete last.ssang;
    else tokens.pop();
    renderMemo(); scheduleSave();
  });
  els.clear.addEventListener('click', () => {
    if(confirm('현재 페이지의 제목과 효주어 메모를 모두 지울까요?')) { state.pages[state.current]=blankPage(); renderPage(); scheduleSave(); }
  });
  function resetModes(){ batchimMode=false; ssangMode=false; els.batchim.classList.remove('active'); els.ssang.classList.remove('active'); }

  els.settings.addEventListener('click',()=>els.dialog.showModal());
  els.bg.addEventListener('input',()=>{ state.colors.bg=els.bg.value; setColors(); scheduleSave(); });
  els.keyboardColor.addEventListener('input',()=>{ state.colors.keyboard=els.keyboardColor.value; setColors(); scheduleSave(); });
  els.resetColors.addEventListener('click',()=>{ state.colors={bg:'#ffb6cf',keyboard:'#bfe8ff'}; setColors(); scheduleSave(); });
  els.hideKeyboard.addEventListener('click',()=>{ els.keyboardPanel.classList.add('hidden'); els.showKeyboard.classList.remove('hidden'); });
  els.showKeyboard.addEventListener('click',()=>{ els.keyboardPanel.classList.remove('hidden'); els.showKeyboard.classList.add('hidden'); });

  window.addEventListener('pagehide', saveNow);
  setColors(); renderPage();
  if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
