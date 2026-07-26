(() => {
  const STORAGE_KEY = 'hyojuMemo.v2';
  const consonants = ['g','n','d','r','m','b','s','ng','j','ch','k','t','p','h'];
  const vowels = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  const MAX_BATCHIM = 2;

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

  function normalizeToken(token) {
    if (!token || token.type !== 'glyph') return token;

    // 예전 버전의 단일 받침 문자열도 자동으로 새 배열 형식으로 변환한다.
    if (typeof token.batchim === 'string') {
      token.batchims = [{ name: token.batchim, ssang: false }];
      delete token.batchim;
    } else if (!Array.isArray(token.batchims)) {
      token.batchims = [];
    } else {
      token.batchims = token.batchims
        .slice(0, MAX_BATCHIM)
        .map(item => typeof item === 'string'
          ? { name: item, ssang: false }
          : { name: item.name, ssang: Boolean(item.ssang) });
    }

    token.ssang = Boolean(token.ssang);
    return token;
  }

  function normalizeState(saved) {
    saved.pages.forEach(p => {
      p.title ||= '';
      p.tokens = Array.isArray(p.tokens) ? p.tokens.map(normalizeToken) : [];
    });
    return saved;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length) {
        parsed.current = Math.max(0, Math.min(parsed.current || 0, parsed.pages.length - 1));
        parsed.colors ||= { bg:'#ffb6cf', keyboard:'#bfe8ff' };
        return normalizeState(parsed);
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.colors.bg);
    els.bg.value = state.colors.bg;
    els.keyboardColor.value = state.colors.keyboard;
  }

  function updateModeButtons() {
    els.batchim.classList.toggle('active', batchimMode);
    els.ssang.classList.toggle('active', ssangMode);
  }

  function resetModes() {
    batchimMode = false;
    ssangMode = false;
    updateModeButtons();
  }

  function makeKey(name, container) {
    const btn = document.createElement('button');
    btn.className = 'glyph-key';
    btn.type = 'button';
    btn.dataset.name = name;
    btn.setAttribute('aria-label', name);
    btn.innerHTML = `<img src="letters/${name}.png" alt="${name}">`;
    btn.addEventListener('click', () => pressGlyph(name, consonants.includes(name)));
    container.appendChild(btn);
  }

  consonants.forEach(x => makeKey(x, els.consonants));
  vowels.forEach(x => makeKey(x, els.vowels));

  function findLastGlyph() {
    return [...page().tokens].reverse().find(token => token.type === 'glyph');
  }

  function pressGlyph(name, isConsonant) {
    const tokens = page().tokens;

    if (batchimMode) {
      if (!isConsonant) return;

      const last = findLastGlyph();
      if (!last) return;

      normalizeToken(last);
      if (last.batchims.length >= MAX_BATCHIM) {
        resetModes();
        return;
      }

      last.batchims.push({ name, ssang: ssangMode });
      resetModes();
      renderMemo();
      scheduleSave();
      return;
    }

    tokens.push({
      type: 'glyph',
      name,
      ssang: isConsonant && ssangMode,
      batchims: []
    });

    resetModes();
    renderMemo();
    scheduleSave();
    scrollMemoBottom();
  }

  function makeGlyphImage(name, className, alt) {
    const image = document.createElement('img');
    image.className = className;
    image.src = `letters/${name}.png`;
    image.alt = alt;
    return image;
  }

  function tokenCell(token) {
    const cell = document.createElement('div');
    if (token.type === 'space') {
      cell.className = 'space-cell';
      return cell;
    }

    normalizeToken(token);
    cell.className = 'glyph-cell';
    cell.appendChild(makeGlyphImage(token.name, 'base', token.name));

    if (token.ssang || token.batchims.length) {
      const strip = document.createElement('div');
      strip.className = 'modifier-strip';

      // 본글자의 쌍자음 표시도 같은 줄에서 겹치지 않게 배치한다.
      if (token.ssang) {
        const baseSsang = makeGlyphImage('ssang', 'modifier-symbol base-ssang', '쌍자음');
        strip.appendChild(baseSsang);
      }

      token.batchims.forEach((batchim, index) => {
        const unit = document.createElement('span');
        unit.className = 'batchim-unit';
        unit.dataset.index = String(index);
        unit.appendChild(makeGlyphImage(batchim.name, 'modifier-symbol batchim-symbol', `받침 ${index + 1}`));

        // 쌍받침은 받침 자음 바로 옆에 같은 크기의 쌍자음 기호로 표시한다.
        if (batchim.ssang) {
          unit.appendChild(makeGlyphImage('ssang', 'modifier-symbol batchim-ssang', '쌍받침 기호'));
        }
        strip.appendChild(unit);
      });

      cell.appendChild(strip);
    }

    return cell;
  }

  function renderMemo() {
    els.memo.innerHTML = '';
    const tokens = page().tokens;

    if (!tokens.length) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = '아래 효주어 키보드로 입력하세요.';
      els.memo.appendChild(hint);
      return;
    }

    let row = [];
    const flush = () => {
      const rowEl = document.createElement('div');
      rowEl.className = 'memo-row';
      row.forEach(token => rowEl.appendChild(tokenCell(token)));
      els.memo.appendChild(rowEl);
      row = [];
    };

    for (const token of tokens) {
      if (token.type === 'newline') {
        flush();
        continue;
      }
      row.push(token);
      if (row.length === 18) flush();
    }

    if (row.length || tokens[tokens.length - 1]?.type === 'newline') flush();
  }

  function renderPage() {
    els.title.value = page().title || '';
    els.pageLabel.textContent = `${state.current + 1} / ${state.pages.length}`;
    els.prev.disabled = state.current === 0;
    renderMemo();
  }

  function scrollMemoBottom() {
    requestAnimationFrame(() => {
      els.memo.scrollTop = els.memo.scrollHeight;
    });
  }

  els.title.addEventListener('input', () => {
    page().title = els.title.value;
    scheduleSave();
  });

  els.prev.addEventListener('click', () => {
    if (state.current > 0) {
      saveNow();
      state.current--;
      resetModes();
      renderPage();
      scheduleSave();
    }
  });

  els.next.addEventListener('click', () => {
    saveNow();
    if (state.current === state.pages.length - 1) state.pages.push(blankPage());
    state.current++;
    resetModes();
    renderPage();
    scheduleSave();
  });

  // 받침 버튼은 켜진 쌍자음 모드를 유지한다.
  // 따라서 '쌍자음 → 받침 → 자음' 순서로 쌍받침을 만들 수 있다.
  els.batchim.addEventListener('click', () => {
    batchimMode = !batchimMode;
    if (!batchimMode) ssangMode = false;
    updateModeButtons();
  });

  // 쌍자음은 다음에 입력하는 자음에 적용된다.
  // 받침 모드와 함께 켜면 쌍받침으로 저장된다.
  els.ssang.addEventListener('click', () => {
    ssangMode = !ssangMode;
    updateModeButtons();
  });

  els.space.addEventListener('click', () => {
    page().tokens.push({ type:'space' });
    resetModes();
    renderMemo();
    scheduleSave();
  });

  els.enter.addEventListener('click', () => {
    page().tokens.push({ type:'newline' });
    resetModes();
    renderMemo();
    scheduleSave();
    scrollMemoBottom();
  });

  els.backspace.addEventListener('click', () => {
    const tokens = page().tokens;
    const last = tokens[tokens.length - 1];
    if (!last) return;

    if (last.type === 'glyph') {
      normalizeToken(last);

      if (last.batchims.length) {
        const finalBatchim = last.batchims[last.batchims.length - 1];
        if (finalBatchim.ssang) {
          // 쌍받침에서는 먼저 쌍자음 기호만 삭제한다.
          finalBatchim.ssang = false;
        } else {
          // 그다음 마지막 받침 자음을 하나씩 삭제한다.
          last.batchims.pop();
        }
      } else if (last.ssang) {
        last.ssang = false;
      } else {
        tokens.pop();
      }
    } else {
      tokens.pop();
    }

    resetModes();
    renderMemo();
    scheduleSave();
  });

  els.clear.addEventListener('click', () => {
    if (confirm('현재 페이지의 제목과 효주어 메모를 모두 지울까요?')) {
      state.pages[state.current] = blankPage();
      resetModes();
      renderPage();
      scheduleSave();
    }
  });

  els.settings.addEventListener('click', () => els.dialog.showModal());
  els.bg.addEventListener('input', () => {
    state.colors.bg = els.bg.value;
    setColors();
    scheduleSave();
  });
  els.keyboardColor.addEventListener('input', () => {
    state.colors.keyboard = els.keyboardColor.value;
    setColors();
    scheduleSave();
  });
  els.resetColors.addEventListener('click', () => {
    state.colors = { bg:'#ffb6cf', keyboard:'#bfe8ff' };
    setColors();
    scheduleSave();
  });
  els.hideKeyboard.addEventListener('click', () => {
    els.keyboardPanel.classList.add('hidden');
    els.showKeyboard.classList.remove('hidden');
  });
  els.showKeyboard.addEventListener('click', () => {
    els.keyboardPanel.classList.remove('hidden');
    els.showKeyboard.classList.add('hidden');
  });

  window.addEventListener('pagehide', saveNow);
  setColors();
  renderPage();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
