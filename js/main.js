/* =============================================
   MAIN.JS — UI controller, game state, views
   ============================================= */

const APP = (() => {

  /* ---------------------------------------------
     STATE
     --------------------------------------------- */
  let gameState = null;
  let selectedClubId = null;
  let running = false;        // match simulation in progress
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const ui = {
    view: 'dashboard',
    squadFilter: 'all',
    squadSort: 'ovr',
    transferTab: 'market',
    transferSearch: '',
    transferPos: 'all',
    tableLeague: null,
    euroTab: null,
    match: null,
    clubCountry: 'England',
    clubLeague: 'premier_league',
    scoutTab: 'opponent',
    scoutHireLevel: null,
    scoutActiveId: null,
    tacticsTab: 'tactics',
    tacSquadFilter: 'all',
    tacSquadSort: 'ovr',
  };

  const SCOUT_TIERS = [
    { level: 1, label: 'Basic',    hireCost: 0.2, weeklyWage:  5, reportEvery: 4, findMin: 2, findMax: 3,  ovrNoise: 8, desc: 'Limited range, rough assessments' },
    { level: 2, label: 'Standard', hireCost: 0.5, weeklyWage: 12, reportEvery: 3, findMin: 4, findMax: 6,  ovrNoise: 3, desc: 'Good coverage, reliable reports' },
    { level: 3, label: 'Elite',    hireCost: 1.2, weeklyWage: 25, reportEvery: 2, findMin: 7, findMax: 11, ovrNoise: 1, desc: 'Global reach, precise assessments' },
  ];

  const COUNTRY_LEAGUES = [
    { country: 'England', leagues: ['premier_league','championship','league_one','league_two','national_league'] },
    { country: 'Spain',   leagues: ['la_liga'] },
    { country: 'Germany', leagues: ['bundesliga'] },
    { country: 'Italy',   leagues: ['serie_a'] },
    { country: 'France',  leagues: ['ligue_1'] },
  ];

  const KO_DATE = new Date(2026, 1, 17);   // European knockout resolves after this

  /* ---------------------------------------------
     UTIL
     --------------------------------------------- */
  const $  = (id) => document.getElementById(id);
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  function hex(color) { return color && color.startsWith('#') ? color : '#' + (color || '888888'); }
  function textOn(color) {
    const c = hex(color).slice(1);
    const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
    const lum = (0.299*r + 0.587*g + 0.114*b);
    return lum > 170 ? '#0d1321' : '#ffffff';
  }
  function crestURL(club) { return (club && DATA.CLUB_BADGES && DATA.CLUB_BADGES[club.id]) || null; }
  // Inner contents of a circular badge: the real crest if we have one, with the
  // club's initials as an automatic fallback if the image fails to load.
  function crestImg(club) {
    const url = crestURL(club);
    const init = DATA.getInitials(club.name);
    const scale = (DATA.CLUB_BADGE_SCALE && DATA.CLUB_BADGE_SCALE[club.id]) || 1;
    const filter = (DATA.CLUB_BADGE_FILTER && DATA.CLUB_BADGE_FILTER[club.id]) || '';
    const styles = [scale !== 1 ? `transform:scale(${scale})` : '', filter ? `filter:${filter}` : ''].filter(Boolean).join(';');
    const styleAttr = styles ? ` style="${styles}"` : '';
    return `<img class="crest-img"${styleAttr} src="${url}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('crest');this.parentNode.style.background='${hex(club.color)}';this.parentNode.style.color='${textOn(club.color)}';this.replaceWith(document.createTextNode('${init}'))">`;
  }
  function badge(club, cls) {
    if (crestURL(club)) return `<div class="${cls} crest">${crestImg(club)}</div>`;
    return `<div class="${cls}" style="background:${hex(club.color)};color:${textOn(club.color)}">${DATA.getInitials(club.name)}</div>`;
  }
  // Apply a club badge (crest or initials) to an existing DOM element.
  function setBadgeEl(el, club) {
    if (!el) return;
    if (crestURL(club)) {
      el.classList.add('crest');
      el.style.background = '';
      el.style.color = '';
      el.innerHTML = crestImg(club);
    } else {
      el.classList.remove('crest');
      el.style.background = hex(club.color);
      el.style.color = textOn(club.color);
      el.textContent = DATA.getInitials(club.name);
    }
  }
  function repStars(rep) {
    const r = Math.round((rep || 1) * 2) / 2;
    const full = Math.floor(r);
    const hasHalf = (r % 1) === 0.5;
    return [1,2,3,4,5].map(i => {
      const cls = i <= full ? 'lit' : (hasHalf && i === full + 1 ? 'half' : '');
      return `<span class="rep-star${cls ? ' '+cls : ''}">★</span>`;
    }).join('');
  }

  function money(m) {
    if (m == null) return '£0';
    const abs = Math.abs(m);
    if (abs >= 1) return '£' + (Math.round(m * 10) / 10) + 'm';
    return '£' + Math.round(m * 1000) + 'k';
  }
  function ovrClass(o) {
    return o >= 90 ? 'ovr-90plus' : o >= 80 ? 'ovr-80plus' : o >= 70 ? 'ovr-70plus' : 'ovr-below70';
  }
  function posClass(pos) { return 'pos-' + pos; }
  function group(pos) {
    if (pos === 'GK') return 'GK';
    if (['CB','RB','LB','RWB','LWB'].includes(pos)) return 'DEF';
    if (['CDM','CM','CAM','RM','LM'].includes(pos)) return 'MID';
    return 'ATT';
  }
  function attrClass(v) {
    return v >= 88 ? 'attr-elite' : v >= 80 ? 'attr-high' : v >= 70 ? 'attr-good'
         : v >= 60 ? 'attr-mid' : v >= 50 ? 'attr-mid-low' : 'attr-low';
  }

  /* ---------------------------------------------
     TOAST (queued)
     --------------------------------------------- */
  let toastQueue = [], toastBusy = false;
  function notify(msg, type = 'info') { toastQueue.push({ msg, type }); if (!toastBusy) nextToast(); }
  function nextToast() {
    if (!toastQueue.length) { toastBusy = false; return; }
    toastBusy = true;
    const { msg, type } = toastQueue.shift();
    const t = $('toast');
    t.className = 'toast ' + type;
    t.textContent = msg;
    setTimeout(() => { t.classList.add('hidden'); setTimeout(nextToast, 200); }, 2200);
  }

  /* ---------------------------------------------
     MODAL
     --------------------------------------------- */
  function showModal(html) {
    $('modal-content').innerHTML = html;
    $('modal-overlay').classList.remove('hidden');
  }
  function closeModal() { $('modal-overlay').classList.add('hidden'); }

  /* ---------------------------------------------
     SCREENS
     --------------------------------------------- */
  function showScreen(name) {
    ['screen-start','screen-game','screen-match'].forEach(id => {
      const s = $(id);
      const on = id === 'screen-' + name;
      s.classList.toggle('active', on);
      s.classList.toggle('hidden', !on);
    });
  }

  /* =============================================
     START SCREEN
     ============================================= */
  function initStartScreen() {
    renderHomeMenu();
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });
    $('btn-back-home').addEventListener('click', showHomeView);
    $('btn-back-select').addEventListener('click', () => {
      $('club-confirm-panel').classList.add('hidden');
      $('club-selector-panel').classList.remove('hidden');
    });
    $('btn-start-game').addEventListener('click', () => { if (selectedClubId) startGame(selectedClubId); });
    $('club-search').addEventListener('input', (e) => {
      renderClubGrid(ui.clubLeague, e.target.value.trim().toLowerCase());
    });
  }

  function renderHomeMenu() {
    const slots = listSaves().filter(s => s.id.startsWith('career_'));
    const latest = slots[0];
    let html = '';
    if (latest) {
      html += `<button class="btn-primary btn-lg home-btn" id="hm-continue">▶ Continue — ${esc(latest.clubName)} S${latest.season}</button>`;
    }
    html += `<button class="btn-secondary btn-lg home-btn" id="hm-new">New Career</button>`;
    html += `<button class="btn-secondary btn-lg home-btn" id="hm-load">Load Save</button>`;
    $('home-menu').innerHTML = html;
    if (latest) $('hm-continue').addEventListener('click', () => loadSave(latest.id));
    $('hm-new').addEventListener('click', showSlotPicker);
    $('hm-load').addEventListener('click', () => openSaves('load'));
  }

  function showHomeView() {
    $('home-view').classList.remove('hidden');
    $('club-selector-panel').classList.add('hidden');
    $('club-confirm-panel').classList.add('hidden');
    renderHomeMenu();
  }

  function showClubSelector() {
    $('home-view').classList.add('hidden');
    $('club-confirm-panel').classList.add('hidden');
    $('club-selector-panel').classList.remove('hidden');
    $('club-search').value = '';
    renderCountryTabs();
  }

  function renderCountryTabs() {
    $('country-tabs').innerHTML = COUNTRY_LEAGUES.map(c =>
      `<button class="ltab ${c.country === ui.clubCountry ? 'active' : ''}" data-country="${c.country}">${c.country}</button>`
    ).join('');
    $('country-tabs').querySelectorAll('.ltab').forEach(tab => {
      tab.addEventListener('click', () => {
        ui.clubCountry = tab.dataset.country;
        const entry = COUNTRY_LEAGUES.find(x => x.country === ui.clubCountry);
        ui.clubLeague = entry.leagues[0];
        renderCountryTabs();
      });
    });
    renderLeagueTabs();
    renderClubGrid(ui.clubLeague, $('club-search').value.trim().toLowerCase());
  }

  function renderLeagueTabs() {
    const entry = COUNTRY_LEAGUES.find(x => x.country === ui.clubCountry);
    const tabs = $('league-tabs');
    if (!entry || entry.leagues.length <= 1) { tabs.innerHTML = ''; return; }
    tabs.innerHTML = entry.leagues.map(l =>
      `<button class="ltab ${l === ui.clubLeague ? 'active' : ''}" data-league="${l}">${DATA.LEAGUES[l].name}</button>`
    ).join('');
    tabs.querySelectorAll('.ltab').forEach(tab => {
      tab.addEventListener('click', () => {
        ui.clubLeague = tab.dataset.league;
        renderLeagueTabs();
        renderClubGrid(ui.clubLeague, $('club-search').value.trim().toLowerCase());
      });
    });
  }

  function renderClubGrid(league, search) {
    const grid = $('clubs-grid');
    const clubs = DATA.CLUBS_DATA
      .filter(c => !c.european && c.league === league)
      .filter(c => !search || c.name.toLowerCase().includes(search))
      .sort((a, b) => b.rep - a.rep || b.sqRating - a.sqRating);

    grid.innerHTML = clubs.map(c => `
      <div class="club-card" data-id="${c.id}">
        ${crestURL(c) ? `<div class="club-card-badge crest">${crestImg(c)}</div>` : `<div class="club-card-badge" style="background:${hex(c.color)};color:${textOn(c.color)}">${DATA.getInitials(c.name)}</div>`}
        <div class="club-card-name">${esc(c.name)}</div>
        <div class="club-card-rep">${repStars(c.rep)}</div>
      </div>`).join('') || `<div class="empty-state"><div class="empty-state-text">No clubs found</div></div>`;

    grid.querySelectorAll('.club-card').forEach(card => {
      card.addEventListener('click', () => selectClub(card.dataset.id));
    });
  }

  function selectClub(id) {
    selectedClubId = id;
    const c = DATA.CLUBS_DATA.find(x => x.id === id);
    const league = DATA.LEAGUES[c.league];
    setBadgeEl($('confirm-badge'), c);
    $('confirm-name').textContent = c.name;
    $('confirm-league').textContent = league.name + ' · ' + league.country;
    $('confirm-rep').innerHTML = repStars(c.rep);
    $('confirm-budget').textContent = money(c.budget);
    $('confirm-wage').textContent = money(c.wage) + '/wk';
    $('confirm-rating').textContent = c.sqRating;
    $('club-selector-panel').classList.add('hidden');
    $('club-confirm-panel').classList.remove('hidden');
  }

  /* =============================================
     GAME INITIALISATION
     ============================================= */
  function startGame(clubId) {
    const clubs = {};
    DATA.CLUBS_DATA.forEach(d => { clubs[d.id] = DATA.buildClub(d); });

    gameState = {
      clubs,
      myClubId: clubId,
      myClub: clubs[clubId],
      slotId: ui.pendingSlotId || 'career_1',
      currentDate: new Date(2025, 7, 9),
      fixtures: [],
      transferLog: [],
      season: 1,
      tactics: { formation: '4-3-3', mentality: 'balanced', pressing: 'medium', style: 'balanced', lineup: [], customFormation: null, excluded: [] },
      scouts: [],
      scoutBlocked: {},
    };

    ENGINE.setupEuropean(gameState);
    ENGINE.setupCups(gameState);
    Object.values(gameState.european).forEach(comp => comp.koDate = KO_DATE);
    gameState.fixtures = ENGINE.generateSchedule(gameState);
    gameState.tactics.lineup = autoPickXI(gameState.myClub, gameState.tactics.formation);
    gameState.market = ENGINE.getTransferMarket(gameState);
    setBoardObjective(gameState);
    ui.tableLeague = gameState.myClub.league;
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';

    initGameChrome();
    showScreen('game');
    updateSidebar();
    renderView('dashboard');
  }

  let chromeReady = false;
  let autoSaveInterval = null;
  function setAutoSaveRunning(on) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = on ? setInterval(autoSave, 1000) : null;
  }
  function initGameChrome() {
    setAutoSaveRunning(true);
    if (!chromeReady) {
      document.querySelectorAll('.snav-btn').forEach(btn => {
        btn.addEventListener('click', () => renderView(btn.dataset.view));
      });
      $('modal-close').addEventListener('click', closeModal);
      $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });
      $('btn-simulate').addEventListener('click', () => runSimulation());
      $('btn-halftime').addEventListener('click', () => {
        if (!ui.match) return;
        $('btn-halftime').classList.add('hidden');
        $('btn-pause').classList.remove('hidden');
        $('btn-speed').classList.remove('hidden');
        running = false;
        runSimulation();
      });
      $('btn-pause').addEventListener('click', () => {
        if (!ui.match) return;
        if (running) {
          running = false;
          if (ui.match.simTimer) { clearTimeout(ui.match.simTimer); ui.match.simTimer = null; }
          $('btn-pause').textContent = '▶ Resume';
          $('match-status').textContent = 'PAUSED';
        } else {
          $('btn-pause').textContent = '⏸ Pause';
          runSimulation();
        }
      });
      $('btn-speed').addEventListener('click', () => {
        if (!ui.match) return;
        ui.match.speed = ui.match.speed === 2 ? 1 : 2;
        $('btn-speed').textContent = ui.match.speed === 2 ? '1×' : '2×';
        $('btn-speed').classList.toggle('active', ui.match.speed === 2);
      });
      $('btn-continue-after-match').addEventListener('click', advanceAfterMatch);

      // Save / Main-menu controls injected into the sidebar footer
      const sb = document.querySelector('.sidebar-bottom');
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;margin-top:4px';
      actions.innerHTML = `
        <button id="sb-save" class="btn-secondary" style="flex:1;padding:7px 4px;font-size:11px">Save</button>
        <button id="sb-menu" class="btn-secondary" style="flex:1;padding:7px 4px;font-size:11px">Menu</button>`;
      sb.appendChild(actions);
      $('sb-save').addEventListener('click', () => openSaves('save'));
      $('sb-menu').addEventListener('click', goToMenu);

      chromeReady = true;
    }
    const c = gameState.myClub;
    setBadgeEl($('sb-badge'), c);
    $('sb-club-name').textContent = c.shortName;
    $('sb-league-name').textContent = DATA.LEAGUES[c.league].name;
    const col = hex(c.color);
    $('sb-badge').style.boxShadow = `0 4px 16px ${col}40`;
  }

  function updateSidebar() {
    const d = gameState.currentDate;
    $('sb-date').textContent = MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
    $('sb-budget').textContent = money(gameState.myClub.budget);
    const pos = ENGINE.getMyPosition(gameState);
    $('sb-position').textContent = pos ? ordinal(pos) : '—';
  }

  function ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ---------------------------------------------
     LINEUP
     --------------------------------------------- */
  function posScore(playerPos, slotPos) {
    const gp = group(playerPos), gs = group(slotPos);
    if (gp === 'GK' || gs === 'GK') return gp === gs ? 100 : 0;
    if (playerPos === slotPos) return 100;
    if (gp === gs) return 60;
    return 20;
  }
  function activeTacticForm() {
    const tac = gameState.tactics;
    if (tac.formation === 'custom' && tac.customFormation) return tac.customFormation;
    return DATA.FORMATIONS[tac.formation] || DATA.FORMATIONS['4-3-3'];
  }

  function autoPickXI(club, formationKey, excludedIds = []) {
    const form = typeof formationKey === 'object'
      ? formationKey
      : (DATA.FORMATIONS[formationKey] || DATA.FORMATIONS['4-3-3']);
    const excluded = new Set(excludedIds);
    const used = new Set();
    const xi = [];
    form.positions.forEach(slot => {
      let best = null, bestScore = -1;
      club.players.forEach(p => {
        if (used.has(p.id) || excluded.has(p.id)) return;
        const sc = posScore(p.pos, slot.pos) * 1000 + p.ovr;
        if (sc > bestScore) { bestScore = sc; best = p; }
      });
      if (best) { used.add(best.id); xi.push(best.id); }
    });
    return xi;
  }

  /* =============================================
     VIEW DISPATCH
     ============================================= */
  function renderView(v) {
    ui.view = v;
    document.querySelectorAll('.snav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    const m = $('main-content');
    try {
      const renderer = ({
        dashboard: renderDashboard, squad: renderSquad, tactics: renderTactics,
        fixtures: renderFixtures, table: renderTable, transfers: renderTransfers,
        european: renderEuropean, finances: renderFinances, scout: renderScout,
      }[v] || renderDashboard);
      renderer(m);
    } catch (err) {
      console.error('Error rendering view', v, err);
      notify('An error occurred while opening the view. See console for details.', 'error');
      m.innerHTML = `<div class="card"><div class="card-title">Error</div><div class="stat-label">Unable to open view "${esc(v)}". The developer console contains details.</div></div>`;
    }
    m.scrollTop = 0;
  }

  /* ---------------------------------------------
     DASHBOARD
     --------------------------------------------- */
  function renderDashboard(m) {
    const club = gameState.myClub;
    const ts = club.tableStats;
    const pos = ENGINE.getMyPosition(gameState);
    const next = ENGINE.getNextFixture(gameState);

    let nextHtml = '';
    if (next) {
      const home = gameState.clubs[next.home], away = gameState.clubs[next.away];
      const myIsHome = next.home === gameState.myClubId;
      nextHtml = `
        <div class="next-match-card">
          <div class="next-match-header">
            <span class="next-match-comp">${compName(next)}</span>
            <span class="next-match-date">${fmtDate(next.date)}</span>
          </div>
          <div class="next-match-teams">
            <div class="nm-team">${badge(home,'nm-badge')}<span class="nm-name">${esc(home.shortName)}</span><span class="nm-rating">OVR ${home.sqRating}</span></div>
            <div class="nm-vs">VS</div>
            <div class="nm-team">${badge(away,'nm-badge')}<span class="nm-name">${esc(away.shortName)}</span><span class="nm-rating">OVR ${away.sqRating}</span></div>
          </div>
          <div class="nm-venue">${myIsHome ? 'Home fixture' : 'Away fixture'}</div>
          <div class="nm-actions"><button class="btn-primary btn-lg" id="dash-play" style="flex:1">▶ Play Match</button></div>
        </div>`;
    } else {
      nextHtml = `<div class="next-match-card"><div class="empty-state"><div class="empty-state-text">Season complete — no fixtures remaining.</div></div></div>`;
    }

    const topScorer = [...club.players].sort((a, b) => b.goals - a.goals)[0];

    m.innerHTML = `
      <div class="view-header">
        <div><div class="view-title">Dashboard</div><div class="view-subtitle">${esc(club.name)} · Season ${gameState.season}</div></div>
        <div class="form-guide">${formGuide(club.form)}</div>
      </div>
      ${nextHtml}
      <div class="dashboard-grid">
        <div class="card"><div class="card-title">League Position</div><div class="stat-big">${pos ? ordinal(pos) : '—'}</div><div class="stat-label">${DATA.LEAGUES[club.league].name}</div></div>
        <div class="card"><div class="card-title">Points</div><div class="stat-big">${ts.points}</div><div class="stat-label">${ts.played} played · ${ts.won}W ${ts.drawn}D ${ts.lost}L</div></div>
        <div class="card"><div class="card-title">Goal Difference</div><div class="stat-big">${gd(ts) >= 0 ? '+' : ''}${gd(ts)}</div><div class="stat-label">${ts.gf} scored · ${ts.ga} conceded</div></div>
      </div>
      ${(() => {
        const obj = gameState.boardObjective;
        if (!obj) return '';
        const onTrack = pos ? pos <= obj.targetPosMax : true;
        const statusCls = onTrack ? 'obj-on-track' : 'obj-off-track';
        const statusTxt = onTrack ? '✓ On track' : '✗ Behind target';
        return `<div class="card board-obj-card">
          <div class="card-title">Board Objective</div>
          <div class="obj-label">${esc(obj.label)}</div>
          <div class="obj-status ${statusCls}">${statusTxt}${pos ? ` · Currently ${ordinal(pos)} of ${obj.n}` : ''}</div>
        </div>`;
      })()}
      <div class="dashboard-grid-2">
        <div class="card">
          <div class="card-title">Recent Results</div>
          <div class="results-list">${recentResults(club)}</div>
        </div>
        <div class="card">
          <div class="card-title">Top Scorer</div>
          ${topScorer && topScorer.goals > 0
            ? `<div class="stat-big">${topScorer.goals}</div><div class="stat-label">${esc(topScorer.name)} · ${topScorer.assists} assists</div>`
            : `<div class="stat-label">No goals scored yet.</div>`}
          <div class="card-title" style="margin-top:18px">Transfer Budget</div>
          <div class="stat-big" style="font-size:26px">${money(club.budget)}</div>
        </div>
      </div>`;

    if (next) $('dash-play').addEventListener('click', playNextMatch);
  }

  function gd(ts) { return ts.gf - ts.ga; }
  function formGuide(form) {
    const cells = [...form];
    while (cells.length < 5) cells.unshift(null);
    return cells.slice(-5).map(f => `<div class="form-dot ${f || 'empty'}">${f || '–'}</div>`).join('');
  }
  function recentResults(club) {
    if (!club.results.length) return `<div class="stat-label">No matches played yet.</div>`;
    return club.results.slice(0, 6).map(r => {
      const opp = gameState.clubs[r.opp];
      const res = r.gf > r.ga ? 'W' : r.gf === r.ga ? 'D' : 'L';
      return `<div class="result-item">
        <div class="result-teams-mini">${badge(opp,'table-badge')}<span>${r.home ? 'vs' : '@'} ${esc(opp.shortName)}</span></div>
        <span class="result-score-mini ${res}">${r.gf} – ${r.ga}</span></div>`;
    }).join('');
  }

  /* ---------------------------------------------
     SQUAD
     --------------------------------------------- */
  function renderSquad(m) {
    const _st = m.scrollTop;
    const filters = [['all','All'],['GK','Goalkeepers'],['DEF','Defenders'],['MID','Midfielders'],['ATT','Attackers']];

    if (!gameState || !gameState.myClub || !Array.isArray(gameState.myClub.players)) {
      m.innerHTML = `<div class="card"><div class="card-title">Squad</div><div class="stat-label">No squad data available.</div></div>`;
      return;
    }

    let players = [...gameState.myClub.players];
    if (ui.squadFilter !== 'all') players = players.filter(p => group(p.pos) === ui.squadFilter);
    players.sort(squadSorter(ui.squadSort));

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Squad</div><div class="view-subtitle">${players.length} players</div></div></div>
      <div class="squad-filters">${filters.map(([k,l]) =>
        `<button class="squad-filter-btn ${ui.squadFilter===k?'active':''}" data-f="${k}">${l}</button>`).join('')}</div>
      <table class="squad-table">
        <thead><tr>
          <th>#</th>
          <th class="sortable" data-s="name">Name</th>
          <th>Pos</th>
          <th class="sortable" data-s="ovr">OVR</th>
          <th class="sortable" data-s="age">Age</th>
          <th class="sortable" data-s="goals">Gls</th>
          <th>Ast</th><th>Apps</th>
          <th class="sortable" data-s="value">Value</th>
        </tr></thead>
        <tbody>${players.map((p, i) => `
          <tr data-id="${p.id}">
            <td class="player-num">${i + 1}</td>
            <td class="player-name-cell">${esc(p.name)}<span class="player-nat">${esc(p.nationality)}</span></td>
            <td><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span></td>
            <td><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>${p.pot > p.ovr ? `<span class="squad-pot-tag">${p.pot}</span>` : ''}</td>
            <td class="stat-mini">${p.age}</td>
            <td class="stat-mini">${p.goals}</td>
            <td class="stat-mini">${p.assists}</td>
            <td class="stat-mini">${p.appearances}</td>
            <td class="value-cell">${money(p.value)}</td>
          </tr>`).join('')}</tbody>
      </table>`;

    m.querySelectorAll('.squad-filter-btn').forEach(b => b.addEventListener('click', () => { ui.squadFilter = b.dataset.f; renderSquad(m); }));
    m.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => { ui.squadSort = th.dataset.s; renderSquad(m); }));
    m.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => showPlayerModal(tr.dataset.id)));
    m.scrollTop = _st;
  }
  function squadSorter(key) {
    if (key === 'name') return (a, b) => a.name.localeCompare(b.name);
    if (key === 'age') return (a, b) => a.age - b.age;
    return (a, b) => (b[key] || 0) - (a[key] || 0);
  }

  /* ---------------------------------------------
     TACTICS
     --------------------------------------------- */
  function renderTactics(m) {
    const _st = m.scrollTop;
    const club = gameState.myClub;
    const tac  = gameState.tactics;
    const activeForm = tac.formation === 'custom' && tac.customFormation
      ? tac.customFormation
      : (DATA.FORMATIONS[tac.formation] || DATA.FORMATIONS['4-3-3']);
    const lineup = tac.lineup;
    const lineupSet = new Set(lineup);

    if (!tac.excluded) tac.excluded = [];
    const excluded = new Set(tac.excluded);
    const slotMap = {};
    lineup.forEach((id, i) => { slotMap[id] = activeForm.positions[i]?.pos; });

    const pressLabels = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const styleLabels = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession', counter: 'Counter', gegenpressing: 'Gegenpressing', longball: 'Long Ball' };

    const swapMode = !!ui.swapMode;
    const swapSel  = ui.swapSel || null;

    const pitchPlayers = activeForm.positions.map((slot, i) => {
      const p = club.players.find(x => x.id === lineup[i]);
      if (!p) return `<div class="pitch-player pitch-empty" data-slot="${i}" style="left:${slot.x}%;top:${slot.y}%">
        <div class="pitch-player-circle empty-slot">${slot.pos}</div></div>`;
      const sel = swapSel === p.id ? ' swap-sel' : '';
      const dim = swapMode && swapSel && swapSel !== p.id ? ' swap-dim' : '';
      return `<div class="pitch-player${sel}${dim}" data-id="${p.id}" style="left:${slot.x}%;top:${slot.y}%">
        <div class="pitch-player-circle ${slot.pos === 'GK' ? 'gk' : ''}">${p.ovr}</div>
        <div class="pitch-player-name">${esc(p.lastName)}</div></div>`;
    }).join('');

    const benchPlayers = club.players.filter(p => !lineupSet.has(p.id));
    const benchChips = benchPlayers.map(p => {
      const sel = swapSel === p.id ? ' swap-sel' : '';
      const dim = swapMode && swapSel && swapSel !== p.id ? ' swap-dim' : '';
      return `<div class="bench-chip${sel}${dim}" data-id="${p.id}">
        <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
        <span class="bench-chip-name">${esc(p.lastName)}</span>
        <span class="bench-chip-ovr">${p.ovr}</span>
      </div>`;
    }).join('');

    const innerTab = ui.tacticsTab || 'tactics';
    const swapHint = swapMode ? (swapSel ? 'Pick who to swap with' : 'Pick a player') : '';

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Tactics</div><div class="view-subtitle">${activeForm.name} · ${cap(tac.mentality)} · ${pressLabels[tac.pressing]} · ${styleLabels[tac.style]}</div></div></div>
      <div class="tactics-layout">
        <div class="tactics-pitch-container">
          <div class="pitch-swap-bar">
            <span class="pitch-swap-hint">${swapHint}</span>
            <button id="pitch-swap-btn" class="${swapMode ? 'btn-warning' : 'btn-secondary'}">${swapMode ? 'Cancel' : 'Swap'}</button>
          </div>
          <div class="tactics-pitch">
            <div class="tactics-pitch-lines">
              <div class="tp-center-line"></div><div class="tp-center-circle"></div>
              <div class="tp-penalty-top"></div><div class="tp-penalty-bottom"></div>
            </div>
            ${pitchPlayers}
          </div>
          <div class="bench-row">${benchChips || '<span class="bench-empty">No bench players</span>'}</div>
        </div>
        <div class="tactics-options-panel">
          <div class="tac-inner-tab-row">
            <button class="tac-inner-tab-btn ${innerTab==='tactics'?'active':''}" data-inner="tactics">Tactics</button>
            <button class="tac-inner-tab-btn ${innerTab==='squad'?'active':''}" data-inner="squad">Squad</button>
          </div>
          <div id="tac-inner-body"></div>
        </div>
      </div>`;

    // Swap button
    $('pitch-swap-btn').addEventListener('click', () => {
      ui.swapMode = !ui.swapMode; ui.swapSel = null; renderTactics(m);
    });

    // Click handler for any player (pitch or bench)
    function handlePlayerClick(pid) {
      if (!ui.swapMode && lineupSet.has(pid)) {
        // clicking on-field player outside swap mode → enter swap mode and select
        ui.swapMode = true; ui.swapSel = pid; renderTactics(m); return;
      }
      if (!ui.swapMode) { showPlayerModal(pid); return; }
      if (!ui.swapSel) { ui.swapSel = pid; renderTactics(m); return; }
      if (ui.swapSel === pid) { ui.swapSel = null; renderTactics(m); return; }
      // perform swap
      const idxA = tac.lineup.indexOf(ui.swapSel);
      const idxB = tac.lineup.indexOf(pid);
      if (idxA >= 0 && idxB >= 0) { tac.lineup[idxA] = pid; tac.lineup[idxB] = ui.swapSel; }
      else if (idxA >= 0) { tac.lineup[idxA] = pid; tac.excluded = (tac.excluded||[]).filter(id=>id!==pid); }
      else if (idxB >= 0) { tac.lineup[idxB] = ui.swapSel; tac.excluded = (tac.excluded||[]).filter(id=>id!==ui.swapSel); }
      ui.swapSel = null; ui.swapMode = false; renderTactics(m);
    }

    m.querySelectorAll('.pitch-player:not(.pitch-empty)').forEach(el => el.addEventListener('click', () => handlePlayerClick(el.dataset.id)));
    m.querySelectorAll('.bench-chip').forEach(el => el.addEventListener('click', () => handlePlayerClick(el.dataset.id)));
    m.querySelectorAll('.pitch-empty').forEach(el => el.addEventListener('click', () => {
      if (!ui.swapSel) return;
      const slot = parseInt(el.dataset.slot);
      tac.lineup[slot] = ui.swapSel;
      tac.excluded = (tac.excluded||[]).filter(id => id !== ui.swapSel);
      ui.swapSel = null; ui.swapMode = false; renderTactics(m);
    }));

    if (innerTab === 'tactics') renderTacticsInner($('tac-inner-body'), m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    else renderTacticsSquad($('tac-inner-body'), m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    m.scrollTop = _st;
  }

  function renderTacticsInner(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap) {
    const mentalities = ['defensive','balanced','attacking'];
    const pressings   = ['high','medium','low'];
    const styles      = ['direct','balanced','possession','counter','gegenpressing','longball'];
    const pressLabels = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const pressDesc   = { high: 'Win ball high (+12% xG), leaves space (+8% vs counters)', medium: 'Balanced approach', low: 'Compact shape (+14% def), limited attack (-10% xG)' };
    const styleLabels = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession', counter: 'Counter', gegenpressing: 'Gegenpressing', longball: 'Long Ball' };
    const styleDesc   = { direct: 'Quick transitions (+8% xG)', balanced: 'Balanced approach', possession: 'Sustained pressure (+5% xG)', counter: 'Sit deep, explode on the break (great vs high press)', gegenpressing: 'Win ball high, instant transitions (+10% xG, risky)', longball: 'Aerial threat, bypass the press (+6% xG, beats low blocks)' };

    const formBtns = Object.keys(DATA.FORMATIONS).map(f =>
      `<button class="formation-btn ${f===tac.formation?'selected':''}" data-f="${f}">${DATA.FORMATIONS[f].name}</button>`
    ).join('');

    if (!gameState.savedCustomFormations) gameState.savedCustomFormations = [];
    const cfLines = tac._cfLines || 3;
    const dfltCounts = cfLines === 3 ? [4, 3, 3] : [4, 1, 4, 1];
    const cfCounts = (tac._cfCounts && tac._cfCounts.length === cfLines) ? tac._cfCounts : dfltCounts;
    const cfTotal = cfCounts.reduce((a, b) => a + b, 0);
    const cfOk = cfTotal === 10;
    const lineLabels = cfLines === 3 ? ['DEF','MID','ATT'] : ['DEF','DM','AM','ATT'];
    const savedBtns = gameState.savedCustomFormations.map(cf =>
      `<div class="cf-saved-item">` +
      `<button class="formation-btn ${tac.formation==='custom'&&tac.customFormation&&tac.customFormation.id===cf.id?'selected':''}" data-cf-sel="${cf.id}">${esc(cf.name)}</button>` +
      `<button class="cf-delete-btn" data-cf-del="${cf.id}">✕</button></div>`
    ).join('');
    const cfBuilder = `
      <div class="tactics-section">
        <h3>Custom Formations</h3>
        ${savedBtns ? `<div class="cf-saved-row">${savedBtns}</div>` : ''}
        <div class="cf-lines-toggle">
          <button class="cf-lines-btn ${cfLines===3?'selected':''}" data-lines="3">3 Lines</button>
          <button class="cf-lines-btn ${cfLines===4?'selected':''}" data-lines="4">4 Lines</button>
        </div>
        <div class="cf-builder">
          ${cfCounts.map((n, i) =>
            `<div class="cf-row">` +
            `<span class="cf-label">${lineLabels[i]}</span>` +
            `<div class="cf-stepper">` +
            `<button class="cf-step-btn" data-si="${i}" data-sd="-1"${n<=1?' disabled':''}>−</button>` +
            `<span class="cf-step-val">${n}</span>` +
            `<button class="cf-step-btn" data-si="${i}" data-sd="1"${n>=5?' disabled':''}>+</button>` +
            `</div></div>`
          ).join('')}
          <div class="cf-footer">
            <span class="cf-total">${cfCounts.join('-')} = ${cfTotal}/10</span>
            <button class="btn-primary cf-save"${cfOk?'':' disabled'}>Save</button>
          </div>
        </div>
      </div>`;

    // Scout panel
    const next = ENGINE.getNextFixture(gameState);
    let scoutHtml = '';
    if (next) {
      const myIsHome = next.home === gameState.myClubId;
      const opp = gameState.clubs[myIsHome ? next.away : next.home];
      if (opp) {
        const myTac = { ...tac, customFormation: tac.formation === 'custom' ? tac.customFormation : null };
        const oppTac = ENGINE.deriveAITactics(opp);
        const xg = myIsHome ? ENGINE.calcMatchXG(club, opp, myTac, oppTac) : ENGINE.calcMatchXG(opp, club, oppTac, myTac);
        const myXG  = myIsHome ? xg.homeXG : xg.awayXG;
        const oppXG = myIsHome ? xg.awayXG : xg.homeXG;
        const myPct = Math.round(myXG / (myXG + oppXG) * 100);
        const favoured = myXG >= oppXG;
        const myFA  = ENGINE.FORM_ATTRS[tac.formation] || (tac.customFormation?.attrs) || { att: 2, def: 2 };
        const oppFA = ENGINE.FORM_ATTRS[oppTac.formation] || { att: 2, def: 2 };
        const fmAdv = myFA.att - (oppFA?.def ?? 2);
        const fmDef = myFA.def - (oppFA?.att ?? 2);
        const fmAtkTxt = fmAdv > 0 ? `<span class="tac-good">+${fmAdv} atk</span>` : fmAdv < 0 ? `<span class="tac-bad">${fmAdv} atk</span>` : `<span class="tac-neutral">even</span>`;
        const fmDefTxt = fmDef > 0 ? `<span class="tac-good">+${fmDef} def</span>` : fmDef < 0 ? `<span class="tac-bad">${fmDef} def</span>` : `<span class="tac-neutral">even</span>`;
        const oppAIPress = oppTac.pressing === 'high' ? 'High Press' : oppTac.pressing === 'low' ? 'Low Block' : 'Medium';
        const oppTop = [...opp.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
        const formDots = (opp.form || []).map(f => `<span class="form-dot ${f==='W'?'win':f==='D'?'draw':'loss'}">${f}</span>`).join('');
        scoutHtml = `
          <div class="tactics-section scout-panel">
            <div class="scout-top">
              <span class="scout-venue ${myIsHome?'home':'away'}">${myIsHome?'HOME':'AWAY'}</span>
              <span class="scout-comp">${compName(next)}</span>
              <span class="scout-dt">${fmtDate(next.date)}</span>
            </div>
            <div class="scout-opp-row">
              ${badge(opp, 'scout-badge')}
              <div class="scout-opp-info">
                <span class="scout-opp-name">${esc(opp.shortName)}</span>
                <div class="scout-form">${formDots || '<span style="font-size:10px;color:var(--text-muted)">No data</span>'}</div>
              </div>
              <div class="scout-ovr-block"><span class="scout-ovr-val">${opp.sqRating}</span><span class="scout-ovr-label">OVR</span></div>
            </div>
            <div class="scout-xg-block">
              <div class="scout-xg-row">
                <span class="scout-xg-num ${favoured?'good':''}">${myXG.toFixed(2)}</span>
                <div class="scout-xg-bar"><div class="scout-xg-mine" style="width:${myPct}%"></div></div>
                <span class="scout-xg-num ${!favoured?'bad':''}">${oppXG.toFixed(2)}</span>
              </div>
              <div class="scout-xg-sub"><span>You</span><span>xG</span><span>Opp</span></div>
            </div>
            <div class="tac-matchup">
              <div class="tac-matchup-row"><span class="tac-label">Formation</span>${fmAtkTxt} · ${fmDefTxt}</div>
              <div class="tac-matchup-row"><span class="tac-label">They play</span><span class="tac-info">${oppAIPress} · ${cap(oppTac.style)}</span></div>
            </div>
            <div class="scout-key"><span class="scout-key-label">Key Players</span>
              ${oppTop.map(p => `<div class="scout-player"><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span><span class="scout-player-name">${esc(p.name)}</span><span class="bench-ovr">${p.ovr}</span></div>`).join('')}
            </div>
          </div>`;
      }
    }

    el.innerHTML = `
      <div class="tactics-section"><h3>Formation</h3><div class="formation-grid">${formBtns}</div></div>
      ${cfBuilder}
      <div class="tactics-section"><h3>Mentality</h3>
        <div class="tac-btn-row">${mentalities.map(mt =>
          `<button class="tac-opt-btn ${mt===tac.mentality?'selected':''}" data-tac="mentality" data-v="${mt}">${cap(mt)}</button>`).join('')}</div>
      </div>
      <div class="tactics-section"><h3>Pressing</h3>
        <div class="tac-btn-col">${pressings.map(pr =>
          `<button class="tac-opt-btn wide ${pr===tac.pressing?'selected':''}" data-tac="pressing" data-v="${pr}">
            <span class="tac-opt-label">${pressLabels[pr]}</span>
            <span class="tac-opt-desc">${pressDesc[pr]}</span>
          </button>`).join('')}</div>
      </div>
      <div class="tactics-section"><h3>Style</h3>
        <div class="tac-btn-col">${styles.map(st =>
          `<button class="tac-opt-btn wide ${st===tac.style?'selected':''}" data-tac="style" data-v="${st}">
            <span class="tac-opt-label">${styleLabels[st]}</span>
            <span class="tac-opt-desc">${styleDesc[st]}</span>
          </button>`).join('')}</div>
      </div>
      ${scoutHtml}`;

    el.querySelectorAll('.formation-btn[data-f]').forEach(b => b.addEventListener('click', () => {
      tac.formation = b.dataset.f; tac.lineup = Array(11).fill(null);
      renderTactics(m);
    }));
    el.querySelectorAll('[data-tac]').forEach(b => b.addEventListener('click', () => { tac[b.dataset.tac] = b.dataset.v; renderTactics(m); }));
    el.querySelectorAll('[data-cf-sel]').forEach(b => b.addEventListener('click', () => {
      const cf = gameState.savedCustomFormations.find(x => x.id === b.dataset.cfSel);
      if (!cf) return;
      tac.customFormation = cf; tac.formation = 'custom'; tac.lineup = Array(11).fill(null);
      renderTactics(m);
    }));
    el.querySelectorAll('[data-cf-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.cfDel;
      gameState.savedCustomFormations = gameState.savedCustomFormations.filter(x => x.id !== id);
      if (tac.customFormation && tac.customFormation.id === id) {
        tac.formation = '4-3-3'; tac.customFormation = null; tac.lineup = Array(11).fill(null);
      }
      renderTactics(m);
    }));
    el.querySelectorAll('.cf-lines-btn').forEach(b => b.addEventListener('click', () => {
      tac._cfLines = parseInt(b.dataset.lines);
      tac._cfCounts = tac._cfLines === 3 ? [4, 3, 3] : [4, 1, 4, 1];
      renderTactics(m);
    }));
    el.querySelectorAll('.cf-step-btn').forEach(b => b.addEventListener('click', () => {
      const lines = tac._cfLines || 3;
      const dflt = lines === 3 ? [4, 3, 3] : [4, 1, 4, 1];
      const counts = (tac._cfCounts && tac._cfCounts.length === lines) ? [...tac._cfCounts] : [...dflt];
      counts[parseInt(b.dataset.si)] = Math.max(1, Math.min(5, counts[parseInt(b.dataset.si)] + parseInt(b.dataset.sd)));
      tac._cfCounts = counts;
      renderTactics(m);
    }));
    const saveBtn = el.querySelector('.cf-save');
    if (saveBtn && !saveBtn.disabled) saveBtn.addEventListener('click', () => {
      const lines = tac._cfLines || 3;
      const dflt = lines === 3 ? [4, 3, 3] : [4, 1, 4, 1];
      const counts = (tac._cfCounts && tac._cfCounts.length === lines) ? tac._cfCounts : dflt;
      const cf = ENGINE.buildCustomFormation(counts);
      if (!cf) return;
      cf.id = 'cf_' + Date.now();
      if (!gameState.savedCustomFormations) gameState.savedCustomFormations = [];
      gameState.savedCustomFormations.push(cf);
      tac.customFormation = cf; tac.formation = 'custom'; tac.lineup = autoPickXI(club, cf);
      renderTactics(m);
    });
  }

  function renderTacticsSquad(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap) {
    const filterKey = ui.tacSquadFilter || 'all';
    const sortKey   = ui.tacSquadSort   || 'ovr';
    const filters = [['all','All'],['GK','GK'],['DEF','DEF'],['MID','MID'],['ATT','ATT']];

    let players = [...club.players];
    if (filterKey !== 'all') players = players.filter(p => group(p.pos) === filterKey);
    players.sort(squadSorter(sortKey));

    const xiCount = lineup.filter(id => club.players.find(p => p.id === id)).length;

    const rows = players.map(p => {
      const inXI = lineupSet.has(p.id);
      const isExcluded = excluded.has(p.id);
      const slotPos = slotMap[p.id];
      const isOOP = inXI && slotPos && ENGINE.posGroup(p.pos) !== ENGINE.posGroup(slotPos) && slotPos !== p.pos;
      const oopF = isOOP ? ENGINE.oopFactor(p.pos, slotPos) : 1.0;
      const oopBadge = isOOP ? `<span class="oop-badge">${Math.round(oopF*100)}%</span>` : '';
      const potStr = p.pot > p.ovr ? `<span class="squad-pot">${p.pot}↑</span>` : '';
      let cbClass = inXI ? 'checked' : (isExcluded ? 'excluded-mark' : '');
      return `<tr class="${inXI?'in-xi':''} ${isExcluded?'excluded':''}" data-pid="${p.id}">
        <td><div class="tac-cb ${cbClass}" data-pid="${p.id}"></div></td>
        <td><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span></td>
        <td class="player-name-cell">${esc(p.name)}<span class="player-nat">${esc(p.nationality)}</span></td>
        <td><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>${potStr}${oopBadge}</td>
        <td class="stat-mini">${p.age}</td>
        <td class="stat-mini">${p.goals}</td>
        <td class="stat-mini">${p.assists}</td>
        <td class="stat-mini">${p.appearances}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="tactics-section">
        <div class="tac-squad-toolbar">
          <div class="tac-squad-filters">${filters.map(([k,l]) =>
            `<button class="tac-squad-filter-btn ${filterKey===k?'active':''}" data-f="${k}">${l}</button>`).join('')}</div>
          <span style="font-size:11px;color:var(--text-muted)">${xiCount}/11</span>
          <button class="btn-secondary auto-xi-btn">Auto XI</button>
        </div>
        <table class="tac-squad-table">
          <thead><tr>
            <th class="th-cb"></th>
            <th>Pos</th>
            <th class="sortable" data-s="name">Name</th>
            <th class="sortable" data-s="ovr">OVR</th>
            <th class="sortable" data-s="age">Age</th>
            <th class="sortable" data-s="goals">Gls</th>
            <th>Ast</th>
            <th>Apps</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    // Filter buttons
    el.querySelectorAll('.tac-squad-filter-btn').forEach(b => b.addEventListener('click', () => {
      ui.tacSquadFilter = b.dataset.f; renderTacticsSquad(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    }));
    // Sort headers
    el.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
      ui.tacSquadSort = th.dataset.s; renderTacticsSquad(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    }));

    // Click on row → open player modal (but not when clicking checkbox)
    el.querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', (e) => {
      if (e.target.closest('.tac-cb')) return;
      showPlayerModal(row.dataset.pid);
    }));

    // Checkbox toggle
    el.querySelectorAll('.tac-cb').forEach(cb => cb.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = cb.dataset.pid;
      const form = activeTacticForm();
      const idx  = tac.lineup.indexOf(pid);
      if (idx >= 0) {
        tac.lineup.splice(idx, 1);
        tac.excluded = [...new Set([...(tac.excluded || []), pid])];
        const slotPos = form.positions[idx]?.pos;
        const inXI = new Set(tac.lineup), excl = new Set(tac.excluded);
        let best = null, bestScore = -1;
        club.players.forEach(p => {
          if (inXI.has(p.id) || excl.has(p.id)) return;
          const sc = posScore(p.pos, slotPos) * 1000 + p.ovr;
          if (sc > bestScore) { bestScore = sc; best = p; }
        });
        if (best) tac.lineup.splice(idx, 0, best.id);
      } else if (excluded.has(pid)) {
        tac.excluded = (tac.excluded || []).filter(id => id !== pid);
        tac.lineup   = autoPickXI(club, form, tac.excluded);
      } else {
        const player = club.players.find(p => p.id === pid);
        if (!player) return;
        let worstIdx = 0, worstScore = Infinity;
        form.positions.forEach((slot, i) => {
          const cur = club.players.find(p => p.id === tac.lineup[i]);
          const sc  = cur ? posScore(cur.pos, slot.pos) * 1000 + cur.ovr : 0;
          if (sc < worstScore) { worstScore = sc; worstIdx = i; }
        });
        const displaced = tac.lineup[worstIdx];
        tac.lineup[worstIdx] = pid;
        if (displaced) tac.excluded = [...new Set([...(tac.excluded || []), displaced])];
      }
      renderTactics(m);
    }));

    el.querySelector('.auto-xi-btn').addEventListener('click', () => {
      tac.excluded = [];
      tac.lineup   = autoPickXI(club, activeTacticForm(), []);
      renderTactics(m);
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------------------------------------
     FIXTURES
     --------------------------------------------- */
  function renderFixtures(m) {
    const myId = gameState.myClubId;
    let mine = gameState.fixtures.filter(f => f.home === myId || f.away === myId);
    // Include European league-phase fixtures
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        comp.fixtures.forEach(f => {
          if ((f.home === myId || f.away === myId) && !mine.find(x => x.id === f.id))
            mine.push(f);
        });
      });
    }
    mine.sort((a, b) => a.date - b.date);
    const next = ENGINE.getNextFixture(gameState);
    const byMonth = {};
    mine.forEach(f => {
      const key = MONTHS[f.date.getMonth()] + ' ' + f.date.getFullYear();
      (byMonth[key] = byMonth[key] || []).push(f);
    });

    let html = `<div class="view-header"><div><div class="view-title">Fixtures</div><div class="view-subtitle">${DATA.LEAGUES[gameState.myClub.league].name}</div></div></div>`;
    Object.keys(byMonth).forEach(month => {
      html += `<div class="fixtures-month"><div class="fixtures-month-header">${month}</div>`;
      byMonth[month].forEach(f => {
        const home = gameState.clubs[f.home], away = gameState.clubs[f.away];
        const myIsHome = f.home === myId;
        const isNext = next && f.id === next.id;
        let scoreCls = 'fixture-score upcoming', scoreTxt = 'v';
        if (f.played) {
          const myGf = myIsHome ? f.homeScore : f.awayScore;
          const myGa = myIsHome ? f.awayScore : f.homeScore;
          const res = myGf > myGa ? 'W' : myGf === myGa ? 'D' : 'L';
          scoreCls = `fixture-score played ${res}`;
          scoreTxt = `${f.homeScore} – ${f.awayScore}`;
        }
        const isEuro = f.type === 'european';
        html += `<div class="fixture-row ${isNext ? 'next-fixture' : ''} ${f.played ? 'played' : ''} ${isEuro ? 'euro-fixture' : ''}" ${isNext ? 'data-play="1"' : ''}>
          <div class="fixture-date">${fmtDate(f.date)}</div>
          <div class="fixture-comp">${compName(f)}</div>
          <div class="fixture-teams">
            <span class="fixture-team-name">${esc(home.shortName)}</span>
            <span class="${scoreCls}">${scoreTxt}</span>
            <span class="fixture-team-name">${esc(away.shortName)}</span>
          </div>
          <div class="fixture-venue">${myIsHome ? 'H' : 'A'}</div>
        </div>`;
      });
      html += `</div>`;
    });
    m.innerHTML = html;
    m.querySelectorAll('[data-play]').forEach(r => r.addEventListener('click', playNextMatch));
  }

  /* ---------------------------------------------
     LEAGUE TABLE
     --------------------------------------------- */
  function renderTable(m) {
    const _st = m.scrollTop;
    const lid = ui.tableLeague || gameState.myClub.league;
    const league = DATA.LEAGUES[lid];
    const table = ENGINE.getLeagueTable(gameState, lid);
    const myLeagues = [...new Set([gameState.myClub.league, ...Object.keys(DATA.LEAGUES)])];

    const zone = (i) => {
      if (i < league.championsLeague) return 'championsleague';
      if (i < league.championsLeague + league.europaLeague) return 'europe';
      if (i < league.championsLeague + league.europaLeague + (league.conferenceLeague || 0)) return 'conference';
      const ap = league.autoPromotion || 0;
      const ps = league.playoffSpots  || 0;
      if (ap > 0 && i < ap) return 'promotion';
      if (ps > 0 && i < ap + ps) return 'playoff';
      if (i >= table.length - (league.relegation || 0)) return 'relegation';
      return '';
    };

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">League Table</div><div class="view-subtitle">${league.name}</div></div></div>
      <div class="table-tabs">${myLeagues.map(l =>
        `<button class="transfer-tab ${l===lid?'active':''}" data-l="${l}">${DATA.LEAGUES[l].name}</button>`).join('')}</div>
      <table class="league-table">
        <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${table.map((c, i) => {
          const t = c.tableStats;
          return `<tr class="${c.id===gameState.myClubId?'my-club':''}" data-club="${c.id}">
            <td class="table-pos-cell ${zone(i)}"><span class="table-pos">${i + 1}</span></td>
            <td><div class="table-club">${badge(c,'table-badge')}<span class="table-club-name">${esc(c.name)}</span></div></td>
            <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
            <td>${t.gf}</td><td>${t.ga}</td><td>${gd(t) >= 0 ? '+' : ''}${gd(t)}</td>
            <td class="pts-cell">${t.points}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="table-zone-indicator">
        ${league.championsLeague ? `<div class="tz"><span class="tz-dot cl"></span>Champions League</div>` : ''}
        ${league.europaLeague ? `<div class="tz"><span class="tz-dot el"></span>Europa League</div>` : ''}
        ${league.conferenceLeague ? `<div class="tz"><span class="tz-dot conf"></span>Conference League</div>` : ''}
        ${(league.autoPromotion||0) > 0 ? `<div class="tz"><span class="tz-dot prom"></span>Promotion</div>` : ''}
        ${(league.playoffSpots||0) > 0 ? `<div class="tz"><span class="tz-dot po"></span>Playoff</div>` : ''}
        ${(league.relegation||0) > 0 ? `<div class="tz"><span class="tz-dot rel"></span>Relegation</div>` : ''}
      </div>`;

    m.querySelectorAll('.transfer-tab').forEach(b => b.addEventListener('click', () => { ui.tableLeague = b.dataset.l; renderTable(m); }));
    m.scrollTop = _st;
  }

  /* ---------------------------------------------
     TRANSFERS
     --------------------------------------------- */
  function renderTransfers(m) {
    const _st = m.scrollTop;
    const open = ENGINE.isTransferWindowOpen(gameState);
    const club = gameState.myClub;
    const banner = open
      ? `<div class="tw-banner"><span class="tw-dot open-dot"></span> Transfer window is OPEN</div>`
      : `<div class="tw-banner closed"><span class="tw-dot closed-dot"></span> Transfer window is closed (opens Jul–Aug & Jan)</div>`;

    let listHtml;
    if (ui.transferTab === 'market') {
      let market = gameState.market || [];
      if (ui.transferSearch) market = market.filter(p => p.name.toLowerCase().includes(ui.transferSearch));
      if (ui.transferPos !== 'all') market = market.filter(p => group(p.pos) === ui.transferPos);
      listHtml = market.slice(0, 80).map(p => `
        <div class="transfer-player-item" data-buy="${p.id}" data-club="${p.clubId}">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info">
            <div class="tp-name">${esc(p.name)}${p.expiring ? '<span class="tp-tag exp">Expiring</span>' : p.wantsMove ? '<span class="tp-tag listed">Listed</span>' : ''}</div>
            <div class="tp-club">${esc(p.clubName)} · Age ${p.age}</div>
          </div>
          <span class="tp-ovr">${p.ovr}</span><span class="tp-value">${money(p.value)}</span>
        </div>`).join('') || emptyList('No players match your filters.');
    } else {
      listHtml = [...club.players].sort((a, b) => b.ovr - a.ovr).map(p => `
        <div class="transfer-player-item" data-sell="${p.id}">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info"><div class="tp-name">${esc(p.name)}</div><div class="tp-club">Age ${p.age} · ${money(p.wage)}/wk wage</div></div>
          <span class="tp-ovr">${p.ovr}</span><span class="tp-value">${money(p.value)}</span>
        </div>`).join('');
    }

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Transfers</div><div class="view-subtitle">${cap(ui.transferTab)}</div></div></div>
      ${banner}
      <div class="transfers-layout">
        <div>
          <div class="transfer-tabs">
            <button class="transfer-tab ${ui.transferTab==='market'?'active':''}" data-t="market">Transfer Market</button>
            <button class="transfer-tab ${ui.transferTab==='sell'?'active':''}" data-t="sell">My Squad</button>
          </div>
          ${ui.transferTab === 'market' ? `
          <div class="transfer-search">
            <input type="text" id="tr-search" placeholder="Search players..." value="${esc(ui.transferSearch)}">
            <select id="tr-pos">
              ${['all','GK','DEF','MID','ATT'].map(p => `<option value="${p}" ${ui.transferPos===p?'selected':''}>${p==='all'?'All positions':p}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="transfer-player-list">${listHtml}</div>
        </div>
        <div>
          <div class="budget-panel">
            <div class="card-title">Finances</div>
            <div class="budget-grid">
              <div class="budget-item"><div class="budget-item-label">Transfer Budget</div><div class="budget-item-val">${money(club.budget)}</div></div>
              <div class="budget-item"><div class="budget-item-label">Squad Size</div><div class="budget-item-val">${club.players.length}</div></div>
              <div class="budget-item"><div class="budget-item-label">Squad Value</div><div class="budget-item-val">${money(club.players.reduce((s, p) => s + p.value, 0))}</div></div>
              <div class="budget-item"><div class="budget-item-label">Wage Bill</div><div class="budget-item-val red">${money(club.players.reduce((s, p) => s + p.wage, 0) / 1000)}/wk</div></div>
            </div>
          </div>
          <div class="budget-panel">
            <div class="card-title">Transfer Activity</div>
            <div class="transfer-log">${gameState.transferLog.length
              ? gameState.transferLog.slice(0, 12).map(t =>
                `<div class="transfer-log-item"><span class="tlog-dot" style="background:${t.in ? 'var(--accent)' : 'var(--accent-red)'}"></span><div class="tlog-info">${t.in ? 'IN' : 'OUT'}: ${esc(t.name)}</div><span class="tlog-fee">${money(t.fee)}</span></div>`).join('')
              : `<div class="stat-label">No transfers yet this save.</div>`}</div>
          </div>
        </div>
      </div>`;

    m.querySelectorAll('.transfer-tab').forEach(b => b.addEventListener('click', () => { ui.transferTab = b.dataset.t; renderTransfers(m); }));
    const search = $('tr-search');
    if (search) search.addEventListener('input', (e) => { ui.transferSearch = e.target.value.trim().toLowerCase(); renderTransfers(m); search.focus(); });
    const sel = $('tr-pos');
    if (sel) sel.addEventListener('change', (e) => { ui.transferPos = e.target.value; renderTransfers(m); });
    m.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => showMarketPlayerModal(el.dataset.buy, el.dataset.club)));
    m.querySelectorAll('[data-sell]').forEach(el => el.addEventListener('click', () => confirmSell(el.dataset.sell)));
    m.scrollTop = _st;
  }
  function emptyList(text) { return `<div class="empty-state"><div class="empty-state-text">${text}</div></div>`; }

  /* ---- TRANSFER NEGOTIATION ---- */
  // Continuous 1-5 prestige from OVR: 55→1, 63.5→2, 72→3, 80.5→4, 89→5
  function playerPrestige(ovr) {
    return Math.max(1, Math.min(5, 1 + (ovr - 55) / 8.5));
  }
  // Smooth sigmoid: 0% at gap≤0, ~20% at 0.5, ~50% at 1.0, ~80% at 2.0, caps at 90%
  function prestigeRejectChance(p, myClub) {
    const gap = playerPrestige(p.ovr) - (myClub.rep || 1);
    if (gap <= 0) return 0;
    return 1 - 1 / (1 + gap * gap);
  }

  function openNegotiation(playerId, clubId) {
    if (!ENGINE.isTransferWindowOpen(gameState)) return notify('Transfer window is closed.', 'error');
    if (clubId === gameState.myClubId) return;
    const seller = gameState.clubs[clubId];
    const p = seller && seller.players.find(x => x.id === playerId);
    if (!p) return;
    const rejectChance = prestigeRejectChance(p, gameState.myClub);
    if (rejectChance > 0 && Math.random() < rejectChance) {
      const reason = rejectChance >= 0.65
        ? `doesn't see ${gameState.myClub.shortName || gameState.myClub.name} as a suitable destination.`
        : `isn't convinced your club is the right move for their career.`;
      return notify(`${p.name} ${reason}`, 'warning');
    }
    ui.negotiation = {
      playerId, clubId, stage: 'fee',
      neg: ENGINE.startNegotiation(p, seller),
      agreedFee: null, agreedWage: null, lastFee: null, lastWage: null,
      msg: `${seller.shortName} are willing to listen to offers for ${p.name}.`,
      tone: 'info',
      msgLog: [{ text: `${seller.shortName} are willing to listen to offers for ${p.name}.`, tone: 'info' }],
    };
    renderNegotiation();
  }

  function renderNegotiation() {
    const N = ui.negotiation; if (!N) return;
    const seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    if (!p) { ui.negotiation = null; return closeModal(); }
    const neg = N.neg;
    const budget = gameState.myClub.budget;
    const steps = ['fee', 'terms', 'done'];
    const labels = { fee: 'Transfer Fee', terms: 'Personal Terms', done: 'Done' };
    const stepBar = steps.map((s, i) =>
      `<span class="neg-step ${N.stage === s ? 'active' : ''} ${i < steps.indexOf(N.stage) ? 'done' : ''}">${labels[s]}</span>`
    ).join('<span class="neg-arrow">›</span>');

    let body = '';
    if (N.stage === 'fee') {
      body = `
        <div class="neg-row"><span>Market value</span><span class="fw-700 text-gold">${money(p.value)}</span></div>
        <div class="neg-row"><span>Your transfer budget</span><span class="${budget >= neg.minFee ? '' : 'red'}">${money(budget)}</span></div>
        <div class="neg-field"><label>Your bid (£m)</label>
          <input id="neg-input" type="number" step="0.5" min="0" value="${N.lastFee != null ? N.lastFee : Math.min(budget, p.value)}"></div>
        <div class="neg-actions">
          <button class="btn-secondary" id="neg-walk">Walk Away</button>
          <button class="btn-primary" id="neg-submit">Submit Bid</button>
        </div>`;
    } else if (N.stage === 'terms') {
      const contractLen = N.contractLength || 3;
      body = `
        <div class="neg-row"><span>Agreed fee</span><span class="fw-700 text-accent">${money(N.agreedFee)}</span></div>
        <div class="neg-row"><span>Player wants</span><span class="fw-700 text-gold">${money(neg.wageDemand / 1000)}/wk</span></div>
        <div class="neg-field"><label>Your wage offer (£k/wk)</label>
          <input id="neg-input" type="number" step="5" min="0" value="${N.lastWage != null ? N.lastWage : p.wage}"></div>
        <div class="neg-field"><label>Contract length</label>
          <select id="neg-contract-len">
            ${[1,2,3,4,5].map(y => `<option value="${y}"${y === contractLen ? ' selected' : ''}>${y} year${y > 1 ? 's' : ''}</option>`).join('')}
          </select></div>
        <div class="neg-actions">
          <button class="btn-secondary" id="neg-walk">Walk Away</button>
          <button class="btn-primary" id="neg-submit">Offer Contract</button>
        </div>`;
    }

    showModal(`
      <div class="negotiation">
        <div class="neg-head">
          <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="neg-id"><h2>${esc(p.name)}</h2><p>${esc(seller.name)} · Age ${p.age} · ${money(p.value)} value</p></div>
          <span class="neg-ovr">${p.ovr}</span>
        </div>
        <div class="neg-steps">${stepBar}</div>
        <div class="neg-log">${(N.msgLog || [{ text: N.msg, tone: N.tone }]).map((m, i, arr) =>
          `<div class="neg-msg ${m.tone}${i === arr.length - 1 ? ' latest' : ''}">${m.text}</div>`
        ).join('')}</div>
        ${body}
      </div>`);

    const submit = $('neg-submit'), walk = $('neg-walk'), input = $('neg-input');
    if (walk) walk.addEventListener('click', () => { ui.negotiation = null; closeModal(); notify('You walked away from the table.', 'info'); });
    const contractSel = $('neg-contract-len');
    if (contractSel) contractSel.addEventListener('change', () => { ui.negotiation.contractLength = parseInt(contractSel.value); });
    if (submit) submit.addEventListener('click', () => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) return notify('Enter a valid amount.', 'error');
      if (contractSel) ui.negotiation.contractLength = parseInt(contractSel.value);
      if (N.stage === 'fee') handleFeeOffer(val); else handleWageOffer(val);
    });
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && submit) submit.click(); });
    const log = document.querySelector('.neg-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function handleFeeOffer(offer) {
    const N = ui.negotiation, seller = gameState.clubs[N.clubId];
    N.lastFee = offer;
    N.msgLog.push({ text: `You bid ${money(offer)}.`, tone: 'you' });
    if (offer > gameState.myClub.budget) {
      N.msg = `You can't afford a ${money(offer)} bid — budget is ${money(gameState.myClub.budget)}.`; N.tone = 'bad';
      N.msgLog.push({ text: N.msg, tone: N.tone });
      return renderNegotiation();
    }
    const r = ENGINE.evaluateFeeOffer(N.neg, offer);
    if (r.decision === 'accept') { N.agreedFee = offer; N.stage = 'terms'; N.msg = `${seller.shortName} accept ${money(offer)}! Now agree personal terms with the player.`; N.tone = 'good'; }
    else if (r.decision === 'counter') { N.msg = `${seller.shortName} reject ${money(offer)}, but would accept ${money(r.counter)}.`; N.tone = 'info'; }
    else if (r.decision === 'reject') { N.msg = `${seller.shortName} dismiss your ${money(offer)} bid as far too low.`; N.tone = 'bad'; }
    else { ui.negotiation = null; closeModal(); return notify(`${seller.shortName} have ended negotiations.`, 'warning'); }
    N.msgLog.push({ text: N.msg, tone: N.tone });
    renderNegotiation();
  }

  function handleWageOffer(offer) {
    const N = ui.negotiation, seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    N.lastWage = offer;
    N.msgLog.push({ text: `You offer ${money(offer / 1000)}/wk.`, tone: 'you' });
    const r = ENGINE.evaluateWageOffer(N.neg, offer);
    if (r.decision === 'accept') { N.agreedWage = offer; return completeTransfer(); }
    else if (r.decision === 'counter') { N.msg = `${p.name} rejects ${money(offer / 1000)}/wk but would sign for ${money(N.neg.wageDemand / 1000)}/wk.`; N.tone = 'info'; }
    else if (r.decision === 'reject') { N.msg = `${p.name} is insulted by an offer of just ${money(offer / 1000)}/wk.`; N.tone = 'bad'; }
    else { ui.negotiation = null; closeModal(); return notify(`${p.name} rejected your contract terms.`, 'warning'); }
    N.msgLog.push({ text: N.msg, tone: N.tone });
    renderNegotiation();
  }

  function completeTransfer() {
    const N = ui.negotiation; if (!N) return;
    const seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    if (!p) { ui.negotiation = null; return closeModal(); }
    if (N.agreedFee > gameState.myClub.budget) { ui.negotiation = null; closeModal(); return notify(`Can't afford the ${money(N.agreedFee)} fee.`, 'error'); }
    seller.players = seller.players.filter(x => x.id !== N.playerId);
    p.wage = N.agreedWage;
    p.contract = N.contractLength || 3;
    gameState.myClub.players.push(p);
    gameState.myClub.budget = Math.round((gameState.myClub.budget - N.agreedFee) * 10) / 10;
    gameState.market = (gameState.market || []).filter(x => x.id !== N.playerId);
    gameState.transferLog.unshift({ in: true, name: p.name, fee: N.agreedFee });
    notify(`Signed ${p.name} for ${money(N.agreedFee)} on ${money(N.agreedWage / 1000)}/wk!`, 'success');
    ui.negotiation = null;
    closeModal();
    updateSidebar();
    renderTransfers($('main-content'));
  }
  function confirmSell(playerId) {
    const p = gameState.myClub.players.find(x => x.id === playerId);
    if (!p) return;
    showModal(`
      <div style="text-align:center">
        <h2 style="margin-bottom:8px">Sell ${esc(p.name)}?</h2>
        <p class="text-muted" style="margin-bottom:18px">Estimated fee: <span class="text-gold fw-700">${money(p.value)}</span></p>
        <div class="pm-actions" style="justify-content:center">
          <button class="btn-secondary" id="sell-cancel">Cancel</button>
          <button class="btn-gold" id="sell-confirm">Confirm Sale</button>
        </div>
      </div>`);
    $('sell-cancel').addEventListener('click', closeModal);
    $('sell-confirm').addEventListener('click', () => { sellPlayer(playerId); closeModal(); });
  }
  function sellPlayer(playerId) {
    if (!ENGINE.isTransferWindowOpen(gameState)) return notify('Transfer window is closed.', 'error');
    const idx = gameState.myClub.players.findIndex(x => x.id === playerId);
    if (idx < 0) return;
    const p = gameState.myClub.players[idx];
    if (gameState.myClub.players.length <= 16) return notify('Squad too small to sell more players.', 'error');
    gameState.myClub.players.splice(idx, 1);
    gameState.myClub.budget = Math.round((gameState.myClub.budget + p.value) * 10) / 10;
    gameState.tactics.lineup = gameState.tactics.lineup.filter(id => id !== playerId);
    if (gameState.tactics.lineup.length < 11) gameState.tactics.lineup = autoPickXI(gameState.myClub, activeTacticForm());
    gameState.transferLog.unshift({ in: false, name: p.name, fee: p.value });
    notify(`Sold ${p.name} for ${money(p.value)}.`, 'success');
    updateSidebar();
    renderTransfers($('main-content'));
  }

  /* ---------------------------------------------
     EUROPEAN
     --------------------------------------------- */
  function renderEuropean(m) {
    const _st = m.scrollTop;
    if (!gameState.european) { m.innerHTML = noEuro(); return; }
    const tab = ui.euroTab || 'champions_league';
    const comp = gameState.european[tab];

    let body;
    if (comp.stage !== 'knockout' && comp.stage !== 'done') {
      body = leaguePhaseTable(comp);
    } else {
      body = `<div class="knockout-bracket">${(comp.knockout?.rounds || []).map(r => `
        <div class="knockout-round"><div class="knockout-round-title">${r.name}</div>
          <div class="knockout-ties">${r.ties.map(t => {
            const A = gameState.clubs[t.a], B = gameState.clubs[t.b];
            const mine = t.a === gameState.myClubId || t.b === gameState.myClubId;
            return `<div class="knockout-tie ${mine ? 'my-match' : ''}">
              <span class="${t.winner===t.a?'fw-700 text-accent':''}">${A ? esc(A.shortName) : '?'}</span>
              <span>${t.sa} – ${t.sb}</span>
              <span class="${t.winner===t.b?'fw-700 text-accent':''}">${B ? esc(B.shortName) : '?'}</span></div>`;
          }).join('')}</div></div>`).join('')}
        ${comp.winner ? `<div class="knockout-round" style="text-align:center"><div class="knockout-round-title">★ Winner</div><div class="stat-big" style="font-size:24px">${esc(gameState.clubs[comp.winner].name)}</div></div>` : ''}
      </div>`;
    }

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">European Competitions</div>
        <div class="view-subtitle">${gameState.myEuropeanComp ? 'You are in the ' + gameState.european[gameState.myEuropeanComp].name : 'Not qualified for Europe this season'}</div></div></div>
      <div class="table-tabs">${Object.keys(gameState.european).map(k =>
        `<button class="transfer-tab ${k===tab?'active':''}" data-e="${k}">${gameState.european[k].name}</button>`).join('')}</div>
      ${body}`;

    m.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { ui.euroTab = b.dataset.e; renderEuropean(m); }));
    m.scrollTop = _st;
  }
  function noEuro() { return `<div class="view-header"><div class="view-title">European Competitions</div></div><div class="empty-state"><div class="empty-state-text">No European competitions configured.</div></div>`; }
  function leaguePhaseTable(comp) {
    const sorted = euTable(comp);
    const R = euBracketSize(comp);
    const directCut = R / 2, playoffCut = R / 2 + R;     // top R/2 direct, next R into playoff
    const rows = sorted.map((id, i) => {
      const c = gameState.clubs[id], s = comp.groupStats[id] || {};
      const zone = i < directCut ? 'ko-direct' : i < playoffCut ? 'ko-playoff' : '';
      const gd = euGd(comp, id);
      return `<tr class="${id===gameState.myClubId?'my-club':''}">
        <td class="lp-pos ${zone}">${i + 1}</td>
        <td class="lp-club">${c ? esc(c.name) : '?'}</td>
        <td>${s.p || 0}</td><td>${s.w || 0}</td><td>${s.d || 0}</td><td>${s.l || 0}</td>
        <td>${gd >= 0 ? '+' : ''}${gd}</td><td class="fw-700">${s.pts || 0}</td></tr>`;
    }).join('');
    return `<div class="lp-legend">
        <span class="lp-key"><span class="lp-dot ko-direct"></span>Round of 16</span>
        <span class="lp-key"><span class="lp-dot ko-playoff"></span>Knockout playoff</span>
      </div>
      <table class="lp-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }
  function euPts(comp, id) { return comp.groupStats[id]?.pts || 0; }
  function euGd(comp, id) { const s = comp.groupStats[id]; return s ? s.gf - s.ga : 0; }

  /* ---------------------------------------------
     FINANCES
     --------------------------------------------- */
  function renderFinances(m) {
    const club = gameState.myClub;
    const rep = club.rep;
    const wageBill = club.players.reduce((s, p) => s + p.wage, 0) / 1000;   // £m/season approx
    const matchday = rep * 1.4;
    const sponsor = rep * 3.5;
    const tv = rep * 6;
    const prize = rep * 2;
    const income = matchday + sponsor + tv + prize;
    const wages = wageBill * 12;
    const other = rep * 1.5;
    const expense = wages + other;
    const profit = income - expense;
    const maxV = Math.max(income, expense, 1);
    const bar = (label, val, cls) => `<div class="fin-bar-row"><span class="fin-bar-label">${label}</span>
      <div class="fin-bar-track"><div class="fin-bar-fill ${cls}" style="width:${Math.min(100, val / maxV * 100)}%"></div></div>
      <span class="fin-bar-val ${cls === 'income' ? 'pos' : 'neg'}">${money(val)}</span></div>`;

    const topEarners = [...club.players].sort((a, b) => b.wage - a.wage).slice(0, 8);

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Finances</div><div class="view-subtitle">Season ${gameState.season} projection</div></div></div>
      <div class="finances-grid">
        <div class="card"><div class="card-title">Transfer Budget</div><div class="stat-big" style="font-size:28px">${money(club.budget)}</div></div>
        <div class="card"><div class="card-title">Projected Profit</div><div class="stat-big" style="font-size:28px;color:${profit >= 0 ? 'var(--accent)' : 'var(--accent-red)'}">${money(profit)}</div><div class="stat-label">Income ${money(income)} · Costs ${money(expense)}</div></div>
      </div>
      <div class="finances-grid">
        <div class="card"><div class="card-title">Income</div><div class="finances-chart-bar">
          ${bar('TV Rights', tv, 'income')}${bar('Sponsorship', sponsor, 'income')}${bar('Matchday', matchday, 'income')}${bar('Prize Money', prize, 'income')}</div></div>
        <div class="card"><div class="card-title">Expenditure</div><div class="finances-chart-bar">
          ${bar('Player Wages', wages, 'expense')}${bar('Other Costs', other, 'expense')}</div></div>
      </div>
      <div class="card"><div class="card-title">Top Earners</div><div class="wage-breakdown">
        ${topEarners.map(p => `<div class="wage-item"><span class="wage-item-name">${esc(p.name)} <span class="text-muted">(${p.pos})</span></span><span class="wage-item-amount">${money(p.wage)}/wk</span></div>`).join('')}
      </div></div>`;
  }

  /* ---------------------------------------------
     PLAYER MODAL
     --------------------------------------------- */
  function showPlayerModal(playerId) {
    let p = null, club = null;
    for (const cid in gameState.clubs) {
      const f = gameState.clubs[cid].players.find(x => x.id === playerId);
      if (f) { p = f; club = gameState.clubs[cid]; break; }
    }
    if (!p) return;

    const isGK = p.pos === 'GK';
    const attrDefs = isGK
      ? [['Reflexes','gkReflexes'],['Positioning','gkPositioning'],['Passing','passing'],['Physical','physical'],['Pace','pace']]
      : [['Pace','pace'],['Shooting','shooting'],['Passing','passing'],['Dribbling','dribbling'],['Defending','defending'],['Physical','physical']];

    const potRatio = p.ovr > 0 ? p.pot / p.ovr : 1;
    const potVal = (key) => Math.min(99, Math.round((p.attrs[key] || 0) * potRatio));
    const contractEnd = gameState.currentDate.getFullYear() + (p.contract || 1);
    const potGap = p.pot - p.ovr;
    const potColor = potGap >= 10 ? 'var(--accent)' : potGap >= 5 ? 'var(--accent-gold)' : 'var(--text-muted)';

    const barsHtml = attrDefs.map(([name, key]) => {
      const v = p.attrs[key] || 0, pv = potVal(key);
      return `<div class="pm-attr-row">
        <span class="pm-attr-label">${name}</span>
        <div class="pm-attr-track">
          <div class="pm-attr-pot-fill" style="width:${pv}%"></div>
          <div class="pm-attr-fill ${attrClass(v)}" style="width:${v}%"></div>
        </div>
        <span class="pm-attr-val">${v}</span>
        <span class="pm-pot-stat-val">${pv > v ? pv : ''}</span>
      </div>`;
    }).join('');

    const spiderSvg = buildSpiderChart(
      attrDefs.map(([,k]) => p.attrs[k] || 0),
      attrDefs.map(([,k]) => potVal(k)),
      attrDefs.map(([n]) => n)
    );

    const clubColor = club ? hex(club.color) : '#333';
    const clubText  = club ? textOn(club.color) : '#fff';

    showModal(`<div class="player-modal">
      <div class="pm-header">
        <div class="pm-avatar" style="background:${clubColor};color:${clubText}">${DATA.getInitials(p.name)}</div>
        <div class="pm-info">
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.nationality)} · Age ${p.age}${club && club.id !== gameState.myClubId ? ' · ' + esc(club.shortName || club.name) : ''}</p>
          <div class="pm-badges">
            <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
            <span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>
            ${potGap > 0 ? `<span class="pm-pot-tag" style="color:${potColor}">&#9650;${p.pot}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="pm-tab-row">
        <button class="pm-tab-btn active" id="pm-btn-ratings">Ratings</button>
        <button class="pm-tab-btn" id="pm-btn-stats">Stats</button>
      </div>

      <div id="pm-pane-ratings">
        <div class="pm-attr-bar-list">${barsHtml}</div>
        <div class="pm-spider-wrap">
          ${spiderSvg}
          <div class="pm-spider-legend">
            <span class="pm-legend-item"><span class="pm-legend-dot current"></span>Current</span>
            <span class="pm-legend-item"><span class="pm-legend-dot potential"></span>Potential</span>
          </div>
        </div>
      </div>

      <div id="pm-pane-stats" class="hidden">
        <div class="pm-stats-grid">
          <div class="pm-stat"><span class="pm-stat-name">Market Value</span><span class="pm-stat-val text-gold">${money(p.value)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Wage</span><span class="pm-stat-val">${money(p.wage)}/wk</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Contract Until</span><span class="pm-stat-val">${contractEnd}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Potential</span><span class="pm-stat-val" style="color:${potColor}">${p.pot}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${p.goals}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${p.assists}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${p.appearances}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Morale</span><span class="pm-stat-val">${p.morale}%</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Yellow Cards</span><span class="pm-stat-val">${p.yellowCards || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Red Cards</span><span class="pm-stat-val">${p.redCards || 0}</span></div>
        </div>
      </div>
    </div>`);

    $('pm-btn-ratings').addEventListener('click', () => {
      $('pm-btn-ratings').classList.add('active');
      $('pm-btn-stats').classList.remove('active');
      $('pm-pane-ratings').classList.remove('hidden');
      $('pm-pane-stats').classList.add('hidden');
    });
    $('pm-btn-stats').addEventListener('click', () => {
      $('pm-btn-stats').classList.add('active');
      $('pm-btn-ratings').classList.remove('active');
      $('pm-pane-stats').classList.remove('hidden');
      $('pm-pane-ratings').classList.add('hidden');
    });
  }

  function showMarketPlayerModal(playerId, clubId) {
    const seller = gameState.clubs[clubId];
    if (!seller) return;
    const mkt = (gameState.market || []).find(x => x.id === playerId && x.clubId === clubId);
    const p = mkt || seller.players.find(x => x.id === playerId);
    if (!p) return;

    const myClub = gameState.myClub;
    const rejectChance = prestigeRejectChance(p, myClub);

    const isGK = p.pos === 'GK';
    const attrDefs = isGK
      ? [['Reflexes','gkReflexes'],['Positioning','gkPositioning'],['Passing','passing'],['Physical','physical'],['Pace','pace']]
      : [['Pace','pace'],['Shooting','shooting'],['Passing','passing'],['Dribbling','dribbling'],['Defending','defending'],['Physical','physical']];
    const potRatio = p.ovr > 0 ? p.pot / p.ovr : 1;
    const potVal = (key) => Math.min(99, Math.round((p.attrs[key] || 0) * potRatio));
    const contractEnd = gameState.currentDate.getFullYear() + (p.contract || 1);
    const potGap = p.pot - p.ovr;
    const potColor = potGap >= 10 ? 'var(--accent)' : potGap >= 5 ? 'var(--accent-gold)' : 'var(--text-muted)';

    const barsHtml = attrDefs.map(([name, key]) => {
      const v = p.attrs[key] || 0, pv = potVal(key);
      return `<div class="pm-attr-row">
        <span class="pm-attr-label">${name}</span>
        <div class="pm-attr-track">
          <div class="pm-attr-pot-fill" style="width:${pv}%"></div>
          <div class="pm-attr-fill ${attrClass(v)}" style="width:${v}%"></div>
        </div>
        <span class="pm-attr-val">${v}</span>
        <span class="pm-pot-stat-val">${pv > v ? pv : ''}</span>
      </div>`;
    }).join('');

    const spiderSvg = buildSpiderChart(
      attrDefs.map(([,k]) => p.attrs[k] || 0),
      attrDefs.map(([,k]) => potVal(k)),
      attrDefs.map(([n]) => n)
    );

    const statusTag = p.expiring
      ? `<span class="market-tag expiring">Contract expiring</span>`
      : (p.wantsMove || p.transferListed)
        ? `<span class="market-tag transfer-listed">Transfer listed</span>`
        : '';

    showModal(`<div class="player-modal">
      <div class="pm-header">
        <div class="pm-avatar" style="background:${hex(seller.color)};color:${textOn(seller.color)}">${DATA.getInitials(p.name)}</div>
        <div class="pm-info">
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.nationality)} · Age ${p.age} · ${esc(seller.shortName || seller.name)}</p>
          <div class="pm-badges">
            <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
            <span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>
            ${potGap > 0 ? `<span class="pm-pot-tag" style="color:${potColor}">&#9650;${p.pot}</span>` : ''}
          </div>
          ${statusTag}
        </div>
      </div>

      <div class="pm-tab-row">
        <button class="pm-tab-btn active" id="pm-btn-ratings">Ratings</button>
        <button class="pm-tab-btn" id="pm-btn-stats">Stats</button>
      </div>

      <div id="pm-pane-ratings">
        <div class="pm-attr-bar-list">${barsHtml}</div>
        <div class="pm-spider-wrap">
          ${spiderSvg}
          <div class="pm-spider-legend">
            <span class="pm-legend-item"><span class="pm-legend-dot current"></span>Current</span>
            <span class="pm-legend-item"><span class="pm-legend-dot potential"></span>Potential</span>
          </div>
        </div>
      </div>

      <div id="pm-pane-stats" class="hidden">
        <div class="pm-stats-grid">
          <div class="pm-stat"><span class="pm-stat-name">Market Value</span><span class="pm-stat-val text-gold">${money(p.value)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Wage</span><span class="pm-stat-val">${money(p.wage)}/wk</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Contract Until</span><span class="pm-stat-val">${contractEnd}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Potential</span><span class="pm-stat-val" style="color:${potColor}">${p.pot}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${p.goals}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${p.assists}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${p.appearances}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Morale</span><span class="pm-stat-val">${p.morale}%</span></div>
        </div>
      </div>

      <div class="pm-offer-footer">
        ${rejectChance >= 0.60 ? `<div class="pm-prestige-warn">Very unlikely to join — club not prestigious enough</div>` : rejectChance >= 0.30 ? `<div class="pm-prestige-warn">May be reluctant to join a club of your stature</div>` : rejectChance >= 0.10 ? `<div class="pm-prestige-warn pm-prestige-mild">Might take some convincing</div>` : ''}
        <div class="pm-value-row"><span>Market Value</span><span class="text-gold fw-700">${money(p.value)}</span></div>
        <button class="btn-primary pm-offer-btn" id="pm-make-offer">Make Offer</button>
      </div>
    </div>`);

    $('pm-btn-ratings').addEventListener('click', () => {
      $('pm-btn-ratings').classList.add('active');
      $('pm-btn-stats').classList.remove('active');
      $('pm-pane-ratings').classList.remove('hidden');
      $('pm-pane-stats').classList.add('hidden');
    });
    $('pm-btn-stats').addEventListener('click', () => {
      $('pm-btn-stats').classList.add('active');
      $('pm-btn-ratings').classList.remove('active');
      $('pm-pane-stats').classList.remove('hidden');
      $('pm-pane-ratings').classList.add('hidden');
    });
    const offerBtn = $('pm-make-offer');
    if (offerBtn) offerBtn.addEventListener('click', () => {
      closeModal();
      openNegotiation(playerId, clubId);
    });
  }

  function buildSpiderChart(vals, potVals, labels) {
    const n = labels.length;
    const cx = 100, cy = 100, r = 66;
    const angle = (i) => (i / n) * Math.PI * 2 - Math.PI / 2;
    const pt = (val, i) => {
      const a = angle(i), d = (Math.max(0, val) / 99) * r;
      return [cx + d * Math.cos(a), cy + d * Math.sin(a)];
    };
    const polyStr = (pts) => pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    const grid = [0.25, 0.5, 0.75, 1].map(s => {
      const pts = labels.map((_, i) => { const a = angle(i); return [cx + s*r*Math.cos(a), cy + s*r*Math.sin(a)]; });
      return `<polygon points="${polyStr(pts)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`;
    }).join('');

    const axes = labels.map((_, i) => {
      const a = angle(i);
      return `<line x1="${cx}" y1="${cy}" x2="${(cx+r*Math.cos(a)).toFixed(1)}" y2="${(cy+r*Math.sin(a)).toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }).join('');

    const lbls = labels.map((name, i) => {
      const a = angle(i), d = r + 17;
      return `<text x="${(cx+d*Math.cos(a)).toFixed(1)}" y="${(cy+d*Math.sin(a)).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.45)" font-size="9" font-family="Inter,sans-serif">${name}</text>`;
    }).join('');

    const potPts = labels.map((_, i) => pt(potVals[i], i));
    const curPts = labels.map((_, i) => pt(vals[i], i));
    const dots = curPts.map(([x,y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#00d084"/>`).join('');

    return `<svg viewBox="0 0 200 200" style="width:176px;height:176px;display:block;margin:0 auto">
      ${grid}${axes}${lbls}
      <polygon points="${polyStr(potPts)}" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="3,2"/>
      <polygon points="${polyStr(curPts)}" fill="rgba(0,208,132,0.12)" stroke="#00d084" stroke-width="2"/>
      ${dots}
    </svg>`;
  }

  /* =============================================
     SCOUT
     ============================================= */
  function renderScout(m) {
    const _st = m.scrollTop;
    const tab = ui.scoutTab || 'opponent';
    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Scouting</div><div class="view-subtitle">${tab === 'opponent' ? 'Opponent Analysis' : 'My Scouts'}</div></div></div>
      <div class="scout-tab-row">
        <button class="scout-tab-btn ${tab==='opponent'?'active':''}" data-t="opponent">Opponent Analysis</button>
        <button class="scout-tab-btn ${tab==='scouts'?'active':''}" data-t="scouts">My Scouts <span class="scout-count-badge">${gameState.scouts.length}/5</span></button>
      </div>
      <div id="scout-body"></div>`;
    m.querySelectorAll('.scout-tab-btn').forEach(b => b.addEventListener('click', () => { ui.scoutTab = b.dataset.t; renderScout(m); }));
    if (tab === 'opponent') renderScoutOpponent($('scout-body'));
    else renderScoutPlayers($('scout-body'), m);
    m.scrollTop = _st;
  }

  function renderScoutOpponent(el) {
    const next = ENGINE.getNextFixture(gameState);
    if (!next) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No upcoming fixtures.</div></div>`; return; }
    const myIsHome = next.home === gameState.myClubId;
    const oppId = myIsHome ? next.away : next.home;
    const opp = gameState.clubs[oppId];
    if (!opp) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">Opponent data unavailable.</div></div>`; return; }

    const aiTac = ENGINE.deriveAITactics(opp);
    const formKeys = Object.keys(DATA.FORMATIONS);
    const h = opp.id.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    const oppFormKey = formKeys[h % formKeys.length];
    const oppForm = DATA.FORMATIONS[oppFormKey] || DATA.FORMATIONS['4-3-3'];
    const oppXI = autoPickXI(opp, oppFormKey);
    const oppXISet = new Set(oppXI);

    const pressLabel = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const styleLabel = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession' };

    const myTac = { ...gameState.tactics, customFormation: gameState.tactics.customFormation };
    const myForm = activeTacticForm();
    const myXI   = gameState.tactics.lineup;
    const mySlot = myForm.positions.map(p => p.pos);
    const xgRes = ENGINE.calcMatchXG(
      myIsHome ? gameState.myClub : opp,
      myIsHome ? opp : gameState.myClub,
      myIsHome ? myTac : aiTac,
      myIsHome ? aiTac : myTac
    );
    const myXG  = myIsHome ? xgRes.homeXG : xgRes.awayXG;
    const oppXG = myIsHome ? xgRes.awayXG : xgRes.homeXG;
    const total = myXG + oppXG || 1;
    const myPct = Math.round(myXG / total * 100);
    const favoured = myXG >= oppXG;

    const topPlayers = [...opp.players].sort((a, b) => b.ovr - a.ovr).slice(0, 11);

    // Mini pitch dots for opponent formation
    const pitchDots = oppForm.positions.map((slot, i) => {
      const pid = oppXI[i];
      const p = pid ? opp.players.find(x => x.id === pid) : null;
      const label = p ? p.ovr : slot.pos;
      return `<div class="scout-mini-dot${pid ? ' scout-mini-dot-clickable' : ''}" style="left:${slot.x}%;top:${slot.y}%"${pid ? ` data-pid="${pid}"` : ''}><span>${label}</span></div>`;
    }).join('');

    el.innerHTML = `
      <div class="scout-opp-layout">
        <div class="scout-opp-left">
          <div class="card scout-opp-card">
            <div class="scout-opp-hdr">
              ${badge(opp, 'scout-opp-badge')}
              <div>
                <div class="scout-opp-name">${esc(opp.name)}</div>
                <div class="scout-opp-meta">${myIsHome ? 'HOME' : 'AWAY'} · ${fmtDate(next.date)}</div>
              </div>
              <div class="scout-opp-ovr-pill">${opp.sqRating} <span>OVR</span></div>
            </div>
            <div class="scout-xg-block" style="margin-top:12px">
              <div class="scout-xg-row">
                <span class="scout-xg-num ${favoured ? 'good' : ''}">${myXG.toFixed(2)}</span>
                <div class="scout-xg-bar"><div class="scout-xg-mine" style="width:${myPct}%"></div></div>
                <span class="scout-xg-num ${!favoured ? 'bad' : ''}">${oppXG.toFixed(2)}</span>
              </div>
              <div class="scout-xg-sub"><span>You</span><span>xG</span><span>Opp</span></div>
            </div>
            <div class="scout-tac-pills">
              <div class="scout-tac-pill"><span class="scout-tac-label">Formation</span><span class="scout-tac-val">${oppForm.name}</span></div>
              <div class="scout-tac-pill"><span class="scout-tac-label">Pressing</span><span class="scout-tac-val">${pressLabel[aiTac.pressing] || aiTac.pressing}</span></div>
              <div class="scout-tac-pill"><span class="scout-tac-label">Style</span><span class="scout-tac-val">${styleLabel[aiTac.style] || aiTac.style}</span></div>
              <div class="scout-tac-pill"><span class="scout-tac-label">Mentality</span><span class="scout-tac-val">${cap(aiTac.mentality || 'balanced')}</span></div>
            </div>
          </div>

          <div class="card" style="margin-top:12px">
            <div class="card-title">Top Players <span class="scout-click-hint">click to view</span></div>
            ${topPlayers.map(p => `
              <div class="scout-squad-row scout-squad-row-clickable" data-pid="${p.id}">
                <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
                <span class="scout-squad-name">${esc(p.name)}</span>
                <span class="text-muted" style="font-size:11px">Age ${p.age}</span>
                <span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="scout-opp-right">
          <div class="card">
            <div class="card-title">${opp.shortName || opp.name} Formation <span class="scout-click-hint">click player</span></div>
            <div class="scout-mini-pitch">
              ${pitchDots}
            </div>
            <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px">${oppForm.name}</div>
          </div>
        </div>
      </div>`;

    el.querySelectorAll('.scout-squad-row-clickable').forEach(row => {
      row.addEventListener('click', () => showPlayerModal(row.dataset.pid));
    });
    el.querySelectorAll('.scout-mini-dot-clickable').forEach(dot => {
      dot.addEventListener('click', () => showPlayerModal(dot.dataset.pid));
    });
  }

  function renderScoutPlayers(el, parentM) {
    if (!gameState.scouts) gameState.scouts = [];
    const scouts = gameState.scouts;
    const canHire = scouts.length < 5;

    const scoutCards = scouts.map(s => {
      const tier = SCOUT_TIERS[s.level - 1];
      const hasReport = s.findings && s.findings.length > 0;
      const reportStatus = s.matchesUntilReport > 0
        ? `<span class="scout-status-chip pending">Report in ${s.matchesUntilReport} match${s.matchesUntilReport > 1 ? 'es' : ''}</span>`
        : (hasReport
          ? `<span class="scout-status-chip ready">Report ready</span>`
          : (s.assignment ? `<span class="scout-status-chip scouting">Scouting…</span>` : `<span class="scout-status-chip idle">No assignment</span>`));

      const posOptions = ['any','GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'].map(p =>
        `<option value="${p}" ${(s.assignment?.pos||'any')===p?'selected':''}>${p==='any'?'Any position':p}</option>`).join('');
      const ageOptions = [99,30,28,26,25,23,21,20].map(a =>
        `<option value="${a}" ${(s.assignment?.maxAge||99)===a?'selected':''}>${a===99?'Any age':'Under '+a}</option>`).join('');
      const ovrOptions = [0,60,65,70,75,80,85].map(o =>
        `<option value="${o}" ${(s.assignment?.minOVR||0)===o?'selected':''}>${o===0?'Any OVR':'OVR '+o+'+'}</option>`).join('');

      const reportRows = hasReport ? s.findings.map(f => {
        const blocked = (gameState.scoutBlocked || {})[f.id];
        return `
          <div class="scout-report-player" data-pid="${f.id}">
            <span class="pos-badge ${posClass(f.pos)}">${f.pos}</span>
            <div class="scout-rp-info">
              <span class="scout-rp-name">${esc(f.name)}</span>
              <span class="text-muted" style="font-size:11px">${esc(f.clubName)} · Age ${f.age}</span>
            </div>
            <span class="scout-rp-conf scout-conf-${(f.confidence||'').toLowerCase()}">${f.confidence || ''}</span>
            <span class="scout-rp-ovr ${ovrClass(f.reportedOVR)}">${f.reportedOVR}${tier.ovrNoise > 3 ? '?' : ''}</span>
            <span class="scout-rp-val">${money(f.value)}</span>
            ${blocked ? `<span class="scout-rp-blocked">Rejected</span>` : `<button class="btn-primary scout-rp-bid" data-pid="${f.id}" data-cid="${f.clubId}">Bid</button>`}
          </div>`;
      }).join('') : '';

      return `
        <div class="scout-card">
          <div class="scout-card-head">
            <span class="scout-level-badge lv${s.level}">${tier.label}</span>
            <span class="scout-card-name">${esc(s.name)}</span>
            <span class="text-muted" style="font-size:11px">${money(tier.weeklyWage / 1000)}/wk</span>
            <button class="scout-fire-btn" data-sid="${s.id}" title="Release scout">✕</button>
          </div>
          ${reportStatus}
          <div class="scout-assignment-section">
            <div class="scout-assignment-label">Assignment</div>
            <div class="scout-filter-grid">
              <div class="scout-filter-col">
                <label class="scout-filter-lbl">Position</label>
                <select class="scout-filter-sel" data-sid="${s.id}" data-f="pos">${posOptions}</select>
              </div>
              <div class="scout-filter-col">
                <label class="scout-filter-lbl">Max Age</label>
                <select class="scout-filter-sel" data-sid="${s.id}" data-f="maxAge">${ageOptions}</select>
              </div>
              <div class="scout-filter-col">
                <label class="scout-filter-lbl">Min OVR</label>
                <select class="scout-filter-sel" data-sid="${s.id}" data-f="minOVR">${ovrOptions}</select>
              </div>
              <div class="scout-filter-col scout-filter-col-btn">
                <button class="btn-primary scout-assign-btn" data-sid="${s.id}">Assign</button>
              </div>
            </div>
          </div>
          ${hasReport ? `
            <div class="scout-report-section">
              <div class="scout-report-header">
                <span class="scout-report-title">Scout Report <span class="scout-click-hint">click to view player</span></span>
                <button class="btn-secondary scout-clear-btn" data-sid="${s.id}">Clear</button>
              </div>
              <div class="scout-report-list">${reportRows}</div>
            </div>` : ''}
        </div>`;
    }).join('');

    const hireSection = canHire ? `
      <div class="card scout-hire-card">
        <div class="card-title">Hire a Scout (${scouts.length}/5 slots used)</div>
        <div class="scout-hire-tiers">
          ${SCOUT_TIERS.map(t => `
            <div class="scout-tier-card ${ui.scoutHireLevel === t.level ? 'selected' : ''}" data-level="${t.level}">
              <div class="scout-tier-name">${t.label}</div>
              <div class="scout-tier-cost">${money(t.hireCost)} hire</div>
              <div class="scout-tier-wage">${money(t.weeklyWage / 1000)}/wk</div>
              <div class="scout-tier-desc">${t.desc}</div>
              <div class="scout-tier-report">Report every ${t.reportEvery} matches · Finds ${t.findMin}–${t.findMax} players</div>
            </div>`).join('')}
        </div>
        <button class="btn-primary scout-hire-btn" style="margin-top:12px" ${ui.scoutHireLevel ? '' : 'disabled'}>
          Hire ${ui.scoutHireLevel ? SCOUT_TIERS[ui.scoutHireLevel-1].label + ' Scout for ' + money(SCOUT_TIERS[ui.scoutHireLevel-1].hireCost) : 'Scout'}
        </button>
      </div>` : `<div class="card scout-hire-card"><div class="card-title">All Scout Slots Full</div><p class="text-muted" style="font-size:13px">Release a scout to hire a replacement.</p></div>`;

    el.innerHTML = `
      <div class="scout-players-layout">
        <div class="scout-hired-list">${scoutCards || `<div class="empty-state" style="margin:0"><div class="empty-state-text">No scouts hired yet.</div></div>`}</div>
        ${hireSection}
      </div>`;

    // Tier selection
    el.querySelectorAll('.scout-tier-card').forEach(c => c.addEventListener('click', () => {
      ui.scoutHireLevel = parseInt(c.dataset.level);
      renderScoutPlayers(el, parentM);
    }));

    // Hire button
    const hireBtn = el.querySelector('.scout-hire-btn');
    if (hireBtn) hireBtn.addEventListener('click', () => {
      const level = ui.scoutHireLevel;
      if (!level) return;
      const tier = SCOUT_TIERS[level - 1];
      if (gameState.myClub.budget < tier.hireCost) return notify(`Not enough budget to hire this scout (need ${money(tier.hireCost)}).`, 'error');
      if (gameState.scouts.length >= 5) return notify('Scout slots full.', 'error');
      gameState.myClub.budget = Math.round((gameState.myClub.budget - tier.hireCost) * 10) / 10;
      const scoutNames = ['James Hargreaves','Marco Vitelli','Luis Peralta','Andrei Stanescu','Yusuf Okafor','Tomás Čermák','Roberto Figueiredo','Niall Dempsey','Søren Lund','Franz Köhler'];
      gameState.scouts.push({
        id: 'sc_' + Date.now(),
        level, name: scoutNames[rand(0, scoutNames.length - 1)],
        assignment: { pos: 'any', maxAge: 99, minOVR: 0 },
        findings: [],
        matchesUntilReport: tier.reportEvery,
      });
      ui.scoutHireLevel = null;
      notify(`Hired a ${tier.label} Scout for ${money(tier.hireCost)}.`, 'success');
      updateSidebar();
      renderScoutPlayers(el, parentM);
    });

    // Filter selects
    el.querySelectorAll('.scout-filter-sel').forEach(sel => sel.addEventListener('change', () => {
      const sid = sel.dataset.sid, field = sel.dataset.f;
      const scout = gameState.scouts.find(s => s.id === sid);
      if (!scout) return;
      if (!scout.assignment) scout.assignment = { pos: 'any', maxAge: 99, minOVR: 0 };
      const val = sel.value;
      scout.assignment[field] = (field === 'pos') ? val : parseInt(val);
    }));

    // Assign buttons
    el.querySelectorAll('.scout-assign-btn').forEach(btn => btn.addEventListener('click', () => {
      const sid = btn.dataset.sid;
      const scout = gameState.scouts.find(s => s.id === sid);
      if (!scout) return;
      const tier = SCOUT_TIERS[scout.level - 1];
      scout.findings = [];
      scout.matchesUntilReport = tier.reportEvery;
      notify(`${scout.name} is now scouting for targets.`, 'info');
      renderScoutPlayers(el, parentM);
    }));

    // Fire buttons
    el.querySelectorAll('.scout-fire-btn').forEach(btn => btn.addEventListener('click', () => {
      const sid = btn.dataset.sid;
      gameState.scouts = gameState.scouts.filter(s => s.id !== sid);
      renderScoutPlayers(el, parentM);
    }));

    // Clear report buttons
    el.querySelectorAll('.scout-clear-btn').forEach(btn => btn.addEventListener('click', () => {
      const sid = btn.dataset.sid;
      const scout = gameState.scouts.find(s => s.id === sid);
      if (scout) { scout.findings = []; const tier = SCOUT_TIERS[scout.level-1]; scout.matchesUntilReport = tier.reportEvery; }
      renderScoutPlayers(el, parentM);
    }));

    // Bid buttons from reports
    el.querySelectorAll('.scout-rp-bid').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNegotiation(btn.dataset.pid, btn.dataset.cid);
    }));

    // Click report player row to open modal
    el.querySelectorAll('.scout-report-player[data-pid]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.scout-rp-bid')) return;
        showPlayerModal(row.dataset.pid);
      });
    });
  }

  function advanceScouts() {
    if (!gameState.scouts || !gameState.scouts.length) return;
    const scoutWages = gameState.scouts.reduce((s, sc) => s + SCOUT_TIERS[sc.level - 1].weeklyWage, 0) / 1000;
    gameState.myClub.budget = Math.max(0, Math.round((gameState.myClub.budget - scoutWages) * 1000) / 1000);
    gameState.scouts.forEach(scout => {
      if (!scout.assignment || !scout.assignment.pos) return;
      scout.matchesUntilReport = Math.max(0, (scout.matchesUntilReport || 1) - 1);
      if (scout.matchesUntilReport === 0 && (!scout.findings || scout.findings.length === 0)) {
        scout.findings = generateScoutFindings(scout);
        if (scout.findings.length) notify(`${scout.name} filed a scouting report!`, 'info');
      }
    });
  }

  function generateScoutFindings(scout) {
    const tier = SCOUT_TIERS[scout.level - 1];
    const a = scout.assignment || {};
    const blocked = gameState.scoutBlocked || {};
    const candidates = [];
    Object.values(gameState.clubs).forEach(club => {
      if (club.id === gameState.myClubId) return;
      club.players.forEach(p => {
        if (blocked[p.id]) return;
        if (a.pos && a.pos !== 'any' && p.pos !== a.pos) return;
        if (a.maxAge && a.maxAge !== 99 && p.age > a.maxAge) return;
        if (a.minOVR && a.minOVR > 0 && p.ovr < a.minOVR) return;
        candidates.push({ ...p, clubId: club.id, clubName: club.shortName || club.name });
      });
    });
    candidates.sort(() => Math.random() - 0.5);
    const count = rand(tier.findMin, tier.findMax);
    return candidates.slice(0, count).map(p => ({
      ...p,
      reportedOVR: Math.max(40, Math.min(99, p.ovr + rand(-tier.ovrNoise, tier.ovrNoise))),
      confidence: tier.level === 3 ? 'High' : tier.level === 2 ? 'Medium' : 'Low',
    }));
  }

  /* =============================================
     MATCH FLOW
     ============================================= */
  function playNextMatch() {
    const fixture = ENGINE.getNextFixture(gameState);
    if (!fixture) return;
    const home = gameState.clubs[fixture.home], away = gameState.clubs[fixture.away];
    const myIsHome = fixture.home === gameState.myClubId;
    // Give each club a consistent formation based on their id
    const formKeys = Object.keys(DATA.FORMATIONS);
    const clubFormation = (club) => {
      const h = club.id.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
      return formKeys[h % formKeys.length];
    };
    const homeFormation = myIsHome ? gameState.tactics.formation : clubFormation(home);
    const awayFormation = myIsHome ? clubFormation(away) : gameState.tactics.formation;
    const myForm = homeFormation === 'custom' ? gameState.tactics.customFormation : null;
    const homeXI = myIsHome ? gameState.tactics.lineup : autoPickXI(home, homeFormation);
    const awayXI = myIsHome ? autoPickXI(away, awayFormation) : gameState.tactics.lineup;
    const myTactics = { ...gameState.tactics, customFormation: myForm };
    const aiTactics = myIsHome ? ENGINE.deriveAITactics(away) : ENGINE.deriveAITactics(home);
    const myFormObj  = myIsHome ? activeTacticForm() : null;
    const mySlotPos  = myFormObj ? myFormObj.positions.map(p => p.pos) : null;
    const result = ENGINE.simulateMatch(home, away, {
      homeXI, awayXI,
      homeTactics: myIsHome ? myTactics : aiTactics,
      awayTactics: myIsHome ? aiTactics : myTactics,
      homeSlotPositions: myIsHome ? mySlotPos : null,
      awaySlotPositions: myIsHome ? null : mySlotPos,
    });
    ui.match = {
      fixture, home, away, myIsHome, result, homeFormation, awayFormation,
      homeXI, awayXI,
      sim: { min: 0, idx: 0, hs: 0, as: 0 },
      simTimer: null, speed: 1,
    };

    $('match-home-name').textContent = home.name;
    $('match-away-name').textContent = away.name;
    setBadge('match-home-badge', home);
    setBadge('match-away-badge', away);
    const homeDotColor = teamDotColor(home, null);
    const awayDotColor = teamDotColor(away, home);
    const hSwatch = $('match-home-color'), aSwatch = $('match-away-color');
    if (hSwatch) hSwatch.style.background = homeDotColor;
    if (aSwatch) aSwatch.style.background = awayDotColor;
    // Stat bars: home color on fill, away color on track background
    ['stat-possession','stat-shots','stat-sot'].forEach(id => {
      const fill = $(id); if (!fill) return;
      fill.style.background = homeDotColor;
      fill.parentElement.style.background = awayDotColor;
    });
    $('match-score').textContent = '0 – 0';
    $('match-time').textContent = "0'";
    $('match-status').textContent = 'PRE-MATCH';
    $('match-events-list').innerHTML = '';
    $('pitch-events').innerHTML = '';
    ['s-possession-h','s-possession-a'].forEach(id => $(id).textContent = '50%');
    ['s-shots-h','s-shots-a','s-sot-h','s-sot-a'].forEach(id => $(id).textContent = '0');
    ['stat-possession','stat-shots','stat-sot'].forEach(id => $(id).style.width = '50%');
    $('match-result-overlay').classList.add('hidden');
    $('btn-halftime').classList.add('hidden');
    $('btn-simulate').classList.remove('hidden');
    running = false;
    showScreen('match');
  }
  function setBadge(id, club) { setBadgeEl($(id), club); }

  /* ============ PITCH: PLAYERS, BALL, CARDS ============ */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function colorDist(c1, c2) {
    const p = c => { const h = hex(c).slice(1); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
    const [r1,g1,b1] = p(c1), [r2,g2,b2] = p(c2);
    return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
  }
  function teamDotColor(club, vsClub) {
    const primary = hex(club.color);
    if (!vsClub) return primary;
    if (colorDist(primary, hex(vsClub.color)) < 70) return club.color2 ? hex(club.color2) : '#ffffff';
    return primary;
  }
  function shortName(name) {
    if (!name) return '';
    const parts = name.trim().split(' ');
    const last = parts[parts.length - 1];
    return last.length <= 10 ? last : parts[0].charAt(0) + '. ' + last;
  }

  /* Map a formation slot to pitch % coords on a horizontal pitch.
     isHome=true  → attacks right (GK near x≈5%, strikers near x≈47%)
     isHome=false → attacks left  (GK near x≈95%, strikers near x≈53%)
     slot.y=0 = GK depth end, slot.y=100 = striker end
     slot.x=0..100 = width across pitch */
  function slotToXY(slot, isHome) {
    // slot.y: 92=GK end, 22=striker end → invert so depth 0=GK, 1=striker
    const depth = (100 - slot.y) / 100;
    const width = slot.x / 100;
    if (isHome) {
      // GK pinned near goal; outfield spans into opp half (striker ~55%)
      const bx = depth < 0.10 ? 6 : 8 + depth * 60;
      return { bx, by: 8 + width * 84 };
    } else {
      const bx = depth < 0.10 ? 94 : 92 - depth * 60;
      return { bx, by: 8 + (1 - width) * 84 };
    }
  }

  function initPlayerDots() {
    const container = $('pitch-players');
    if (!container) return;
    container.innerHTML = '';
    ui.match.players = [];
    ui.match.gamePhase = 1;
    const m = ui.match;
    const homeColor = teamDotColor(m.home, null);
    const awayColor = teamDotColor(m.away, m.home);
    const homeSlots = (DATA.FORMATIONS[m.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
    const awaySlots = (DATA.FORMATIONS[m.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;

    const lblHome = $('pitch-team-label-home');
    const lblAway = $('pitch-team-label-away');
    if (lblHome) lblHome.textContent = m.home.name;
    if (lblAway) lblAway.textContent = m.away.name;

    const addDots = (slots, xi, club, color, isHome) => {
      slots.forEach((slot, i) => {
        const pid = xi ? xi[i] : null;
        const player = pid ? club.players.find(p => p.id === pid) : null;
        const name = player ? shortName(player.name) : '';
        const pos = slotToXY(slot, isHome);
        // Clamp to own half at kick-off (home left of 50%, away right of 50%)
        const koBx = isHome ? Math.min(pos.bx, 48) : Math.max(pos.bx, 52);
        const el = document.createElement('div');
        el.className = 'player-dot';
        el.style.cssText = `left:${koBx}%;top:${pos.by}%;transition:none`;
        el.innerHTML = `<div class="dot-circle" style="background:${color}"></div><div class="dot-name">${esc(name)}</div>`;
        container.appendChild(el);
        ui.match.players.push({
          el, slot, slotIdx: i, isHome, attacksRight: isHome, player,
          cx: koBx, cy: pos.by, tx: koBx, ty: pos.by, lerpF: 0.22,
        });
      });
    };
    addDots(homeSlots, m.homeXI, m.home, homeColor, true);
    addDots(awaySlots, m.awayXI, m.away, awayColor, false);

    const ballEl = $('pitch-ball');
    if (ballEl) { ballEl.style.transition = 'none'; ballEl.style.left = '50%'; ballEl.style.top = '50%'; }
    ui.match.ball = { cx: 50, cy: 50, tx: 50, ty: 50, speed: 0.18, el: ballEl };
    ui.match.carrier = null;
    ui.match.runner  = null;
    ui.match.holder  = null;
    ui.match.presser = null;
    ui.match.marker  = null;
    ui.match.passTimer = 0;
    startMatchRaf();
  }

  /* ── rAF LOOP: lerp every frame at 60 fps ────────────────── */
  function startMatchRaf() {
    if (!ui.match) return;
    ui.match.rafTime = performance.now();
    ui.match.roleTimer = 0; // triggers first role assignment immediately
    ui.match.players.forEach(p => {
      p.ptimer = Math.random() * 160; // staggered start, never in sync
      p.stx = p.cx; p.sty = p.cy;    // smooth-target starts at current pos
      p.holdTimer = 0;                // time remaining in "hold position" state
      p.role = null;
      p.markTarget = null;
    });
    function loop(ts) {
      if (!ui.match) return;
      const dt = Math.min(ts - ui.match.rafTime, 50);
      ui.match.rafTime = ts;
      const f16 = dt / 16.67;

      ui.match.players.forEach(p => {
        // Smooth target glides toward committed target — smooth arcs at 2x speed
        const sg = Math.min(1, 0.12 * f16);
        p.stx += (p.tx - p.stx) * sg;
        p.sty += (p.ty - p.sty) * sg;
        // Player chases smooth target at stat-scaled 1x-speed pace
        const s = Math.min(1, p.lerpF * f16);
        p.cx += (p.stx - p.cx) * s;
        p.cy += (p.sty - p.cy) * s;
        p.el.style.left = p.cx.toFixed(1) + '%';
        p.el.style.top  = p.cy.toFixed(1) + '%';
      });

      const b = ui.match.ball;
      if (b?.el) {
        // ── Shot resolution: ball near goal line → save or post bounce ──
        if (!ui.match.carrier && b.kickType === 'shot') {
          const atRight = b.tx > 90 && b.cx > 86;
          const atLeft  = b.tx < 10 && b.cx < 14;
          if (atRight || atLeft) {
            // Find GK defending this goal: attacksRight=true → defends left, false → defends right
            const defGK = atRight
              ? [ui.match.homeGKp, ui.match.awayGKp].find(p => p && !p.attacksRight)
              : [ui.match.homeGKp, ui.match.awayGKp].find(p => p && p.attacksRight);
            b.kickType = 'pass'; // no longer a shot
            if (Math.random() < 0.22) {
              // Post or crossbar — ball bounces back into play
              b.tx    = atRight ? 76+Math.random()*8 : 16+Math.random()*8;
              b.ty    = 35+Math.random()*30;
              b.speed = 0.18;
            } else if (defGK) {
              // GK saves — becomes carrier
              b.speed = 0.45;
              ui.match.carrier   = defGK;
              ui.match.passTimer = 400+Math.random()*400;
            } else {
              b.tx = atRight ? 78 : 22; b.ty = 50; b.speed = 0.18;
            }
          }
        }

        // ── Ball tracks carrier so it's always in sync with the player ──
        const car = ui.match.carrier;
        if (car) {
          const distToCarrier = Math.hypot(b.cx - car.cx, b.cy - car.cy);
          if (b.kickType === 'through' && distToCarrier > 10) {
            // Through ball: aim slightly ahead of running player so they run onto it
            const dir = car.attacksRight ? 1 : -1;
            b.tx = clamp(car.cx + dir * 7, 3, 97);
            b.ty = car.cy + (Math.random()-0.5)*0.5;
          } else {
            // All other kicks: ball finds the carrier wherever they move
            b.tx = car.cx + (Math.random()-0.5)*0.6;
            b.ty = car.cy + (Math.random()-0.5)*0.6;
            if (distToCarrier < 5) b.speed = 0.5; // snap to feet once close
          }
        }
        const s = Math.min(1, b.speed * f16);
        b.cx += (b.tx - b.cx) * s;
        b.cy += (b.ty - b.cy) * s;
        b.el.style.left = b.cx.toFixed(1) + '%';
        b.el.style.top  = b.cy.toFixed(1) + '%';
        const dist = Math.hypot(b.tx - b.cx, b.ty - b.cy);
        const sc   = 1 + Math.min(dist / 28, 1) * (b.kickType === 'shot' ? 1.1 : b.kickType === 'through' ? 0.7 : b.kickType === 'lob' ? 0.5 : 0.3);
        b.el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(2)})`;
        b.el.className = 'ball-' + (b.kickType || 'pass');
      }

      if (running) {
        updatePlayerTargets(dt);
        updatePassCarrier(dt);
      }
      ui.match.raf = requestAnimationFrame(loop);
    }
    ui.match.raf = requestAnimationFrame(loop);
  }

  function stopMatchRaf() {
    if (ui.match?.raf) { cancelAnimationFrame(ui.match.raf); ui.match.raf = null; }
  }

  /* ── PER-PLAYER TARGET UPDATE — team-block, 1x speed ────────────────── */
  // The whole team moves as a shape: the block centre shifts with ball position
  // so defenders naturally push up in possession and track back when defending.
  // No player is pinned to one spot — everyone floats within their zone.
  function updatePlayerTargets(dt) {
    if (!ui.match?.players?.length) return;

    // Possession flip (~every 500ms, weighted by dribbling vs defending)
    if (Math.random() < 0.002 * dt) {
      const avg = (isH, attr) => {
        const ps = ui.match.players.filter(p => p.isHome === isH && (100-p.slot.y)/100 > 0.08)
          .map(p => p.player?.attrs?.[attr] || 62);
        return ps.length ? ps.reduce((s,v) => s+v, 0) / ps.length : 62;
      };
      const ph = ui.match.gamePhase;
      if (ph >= 0) {
        const r = Math.min(0.74, Math.max(0.26, 0.5 + (avg(true,'dribbling') - avg(false,'defending')) / 200));
        ui.match.gamePhase = Math.random() < r ? 1 : -1;
      } else {
        const r = Math.min(0.74, Math.max(0.26, 0.5 + (avg(false,'dribbling') - avg(true,'defending')) / 200));
        ui.match.gamePhase = Math.random() < r ? -1 : 1;
      }
    }

    const swapped      = ui.match.sim.swapped;
    const homeAttRight = !swapped;
    const possAttRight = ui.match.gamePhase >= 0 ? homeAttRight : !homeAttRight;
    const bx = ui.match.ball?.cx || 50;
    const by = ui.match.ball?.cy || 50;
    const latOff = (by - 50) / 50;

    // Team block centre: the geometric midpoint of the whole shape shifts
    // with the ball. In possession the block rides forward; defending it drops back.
    // Formula: blockCtr(home attacks right, in poss) = 22 + bx*0.46  (ranges ~22–68)
    //          blockCtr(home attacks right, defending) = 12 + bx*0.36 (ranges ~12–48)
    const blockCtr = (attacksRight, inPoss) => {
      const raw = inPoss
        ? 22 + bx * 0.46   // pushes forward with ball
        : 14 + bx * 0.34;  // sits behind ball
      return attacksRight ? raw : 100 - raw;
    };

    // Each player's depth offset within the block:
    // depth 0.05 (GK) → –36  (way behind centre = near own goal)
    // depth 0.25 (CB) → –22
    // depth 0.50 (CM) → –3
    // depth 0.75 (CAM/ST support) → +17
    // depth 0.90 (ST) → +28
    const depthOffset = (depth) => (depth - 0.55) * 62;

    // Pick 1 runner and 1 holder from possession team (refreshed every ~400ms)
    ui.match.roleTimer = (ui.match.roleTimer || 0) - dt;
    if (ui.match.roleTimer <= 0) {
      ui.match.roleTimer = 360 + Math.random() * 120;
      const attTeam = ui.match.players.filter(p => p.attacksRight === possAttRight && (100-p.slot.y)/100 > 0.38 && (100-p.slot.y)/100 < 0.92 && p !== ui.match.carrier);
      // runner: fastest available attacker/mid
      const runnerCand = attTeam.sort((a,b) => (b.player?.attrs?.pace||65)-(a.player?.attrs?.pace||65));
      ui.match.runner = runnerCand[0] || null;
      // holder: a midfielder who isn't the runner
      ui.match.holder = attTeam.find(p => p !== ui.match.runner && (100-p.slot.y)/100 < 0.65) || null;
      // closest defender to ball = presser
      const defTeam = ui.match.players.filter(p => p.attacksRight !== possAttRight && (100-p.slot.y)/100 > 0.10 && (100-p.slot.y)/100 < 0.92);
      ui.match.presser = defTeam.reduce((best, p) => {
        const d = Math.hypot(p.cx-bx, p.cy-by);
        return (!best || d < Math.hypot(best.cx-bx,best.cy-by)) ? p : best;
      }, null);
      // marker: tracks the runner
      const marker = defTeam.find(p => p !== ui.match.presser && (100-p.slot.y)/100 < 0.60);
      ui.match.marker = marker || null;
      if (ui.match.marker) ui.match.marker.markTarget = ui.match.runner;
    }

    // One GK per team: deepest player by slot.y (y=92 in all formations)
    const homeGKp = ui.match.players.filter(p => p.isHome) .reduce((b,p) => p.slot.y > (b?.slot.y||0) ? p : b, null);
    const awayGKp = ui.match.players.filter(p => !p.isHome).reduce((b,p) => p.slot.y > (b?.slot.y||0) ? p : b, null);
    ui.match.homeGKp = homeGKp;
    ui.match.awayGKp = awayGKp;

    // Offside line: last outfield defender (excl. GK)
    const gkRef = possAttRight ? awayGKp : homeGKp;
    const defOutfield = ui.match.players.filter(p => p.attacksRight !== possAttRight && p !== gkRef);
    const offsideLine = possAttRight
      ? (defOutfield.length ? Math.max(...defOutfield.map(p => p.cx)) : 92)
      : (defOutfield.length ? Math.min(...defOutfield.map(p => p.cx)) : 8);

    // Tackle resolution: presser close enough to carrier → physical contest
    const car = ui.match.carrier, prs = ui.match.presser;
    if (car && prs && car.attacksRight !== prs.attacksRight) {
      const tackleDist = Math.hypot(prs.cx - car.cx, prs.cy - car.cy);
      if (tackleDist < 5) {
        const atkStr = ((car.player?.attrs?.physical||65) + (car.player?.attrs?.dribbling||65)) / 2;
        const defStr = ((prs.player?.attrs?.physical||65) + (prs.player?.attrs?.defending||65)) / 2;
        const defWinP = defStr / (defStr + atkStr);
        if (Math.random() < defWinP) {
          // Defender wins — loose ball or defender takes possession
          const b = ui.match.ball;
          if (b) {
            b.tx = clamp(b.cx + (Math.random()-0.5)*22, 8, 92);
            b.ty = clamp(b.cy + (Math.random()-0.5)*16, 8, 92);
            b.speed = 0.14;
            b.kickType = 'pass';
          }
          ui.match.carrier = Math.random() < 0.55 ? prs : null; // 55% defender takes it, 45% loose
          ui.match.passTimer = 500 + Math.random()*400;
        }
        prs.ptimer = 350 + Math.random()*200; // cooldown after tackle
      }
    }

    // Block drift updates on a shared timer so the whole team shifts together
    ui.match.blockDriftTimer = (ui.match.blockDriftTimer || 0) - dt;
    if (ui.match.blockDriftTimer <= 0) {
      ui.match.blockDriftTimer = 380 + Math.random() * 180;
      ui.match.players.forEach(p => {
        p.blockDriftX = (Math.random()-0.5) * 7;
        p.blockDriftY = (Math.random()-0.5) * 7;
      });
    }

    ui.match.players.forEach(p => {
      const depth  = (100 - p.slot.y) / 100;
      const width  = p.slot.x / 100;
      const pace   = p.player?.attrs?.pace      || 65;
      const def    = p.player?.attrs?.defending || 65;
      const drib   = p.player?.attrs?.dribbling || 65;
      const phys   = p.player?.attrs?.physical  || 65;
      const inPoss = p.attacksRight === possAttRight;

      p.lerpF = 0.076 + (pace/100)*0.110 + (phys/100)*0.024;

      // ── GK: ptimer-gated (slow reactions are fine) ────────────────
      if (p === homeGKp || p === awayGKp) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        const gkPos    = p.player?.attrs?.gkPositioning || 68;
        const gkReflex = p.player?.attrs?.gkReflexes    || 68;
        const goalLine  = p.attacksRight ? 6 : 94;
        const ballInBox = p.attacksRight ? bx > 76 : bx < 24;
        const opps = ui.match.players.filter(q => q.isHome !== p.isHome && (100-q.slot.y)/100 < 0.55);
        const is1v1 = p.attacksRight
          ? (bx > 62 && opps.filter(q => q.cx > 55).length < 2)
          : (bx < 38 && opps.filter(q => q.cx < 45).length < 2);
        if (is1v1) {
          const rushX = p.attacksRight ? clamp(goalLine+(bx-goalLine)*0.35, goalLine, 22) : clamp(goalLine-(goalLine-bx)*0.35, 78, goalLine);
          p.tx = rushX;
          p.ty = clamp(by + (Math.random()-0.5)*4, 28, 72);
          p.lerpF = 0.040 + (gkPos/100)*0.025;
        } else if (ballInBox) {
          p.tx = clamp(goalLine+(p.attacksRight?3:-3), p.attacksRight?6:88, p.attacksRight?12:94);
          p.ty = clamp(by + (Math.random()-0.5)*8, 22, 78);
          p.lerpF = 0.030 + (gkReflex/100)*0.020;
        } else {
          p.tx = goalLine;
          p.ty = clamp(50 + latOff*(8+(gkPos/100)*10) + (Math.random()-0.5)*2, 28, 72);
          p.lerpF = 0.016 + (gkPos/100)*0.010;
        }
        p.ptimer = 220 + Math.random()*180;
        return;
      }

      // ── CARRIER: ptimer-gated dribble decisions ───────────────────
      if (p === ui.match.carrier) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        const presserDist = ui.match.presser
          ? Math.hypot(ui.match.presser.cx-p.cx, ui.match.presser.cy-p.cy) : 100;
        if (presserDist < 16) {
          const r = Math.random();
          if (r < 0.38 + (drib/100)*0.15) {
            const burst = 2.5 + (drib/100)*4;
            p.tx = clamp(p.cx+(p.attacksRight?burst:-burst), 5, 93);
            p.ty = clamp(p.cy+(Math.random()-0.5)*3, 5, 95);
            p.lerpF = 0.20+(drib/100)*0.18+(pace/100)*0.10;
          } else if (r < 0.68) {
            const cutDir = (by > 50) ? -1 : 1;
            p.tx = clamp(p.cx+(p.attacksRight?1:-1), 5, 93);
            p.ty = clamp(p.cy+cutDir*(5+(drib/100)*7), 5, 95);
            p.lerpF = 0.12+(drib/100)*0.10;
          } else {
            p.tx = clamp(p.cx+(Math.random()-0.5)*0.6, 5, 93);
            p.ty = clamp(p.cy+(Math.random()-0.5)*0.6, 5, 95);
            p.lerpF = 0.036;
          }
        } else {
          const fwd   = 1.4+(drib/100)*3;
          const weave = (Math.random()-0.5)*(Math.random()<0.25?4:0.8);
          p.tx = clamp(p.cx+(p.attacksRight?fwd:-fwd), 5, 93);
          p.ty = clamp(p.cy+weave, 5, 95);
          p.lerpF = 0.14+(pace/100)*0.12+(drib/100)*0.08;
        }
        p.ptimer = 30 + Math.random()*35;
        return;
      }

      // ── RUNNER: ptimer-gated, capped at offside line ─────────────
      if (p === ui.match.runner) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        const runDir = p.attacksRight ? 1 : -1;
        const rawTx  = clamp(bx + runDir*(16+(pace/100)*16), 8, 92);
        p.tx = p.attacksRight ? Math.min(rawTx, offsideLine-1) : Math.max(rawTx, offsideLine+1);
        p.ty = clamp(by+(Math.random()<0.5?1:-1)*(8+Math.random()*14), 10, 90);
        p.lerpF = 0.18+(pace/100)*0.16;
        p.ptimer = 55+Math.random()*55;
        return;
      }

      // ── HOLDER: ptimer-gated ──────────────────────────────────────
      if (p === ui.match.holder) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        p.tx = clamp(p.cx+(Math.random()-0.5)*1.5, 5, 95);
        p.ty = clamp(p.cy+(Math.random()-0.5)*1.5, 5, 95);
        p.lerpF = 0.044;
        p.ptimer = 140+Math.random()*100;
        return;
      }

      // ── PRESSER: ptimer-gated ─────────────────────────────────────
      if (p === ui.match.presser) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        p.tx = clamp(bx+(p.attacksRight?6:-6), 5, 95);
        p.ty = clamp(by+(Math.random()-0.5)*5, 5, 95);
        p.lerpF = 0.16+(phys/100)*0.14+(def/100)*0.08;
        p.ptimer = 35+Math.random()*35;
        return;
      }

      // ── MARKER: ptimer-gated ─────────────────────────────────────
      if (p === ui.match.marker && p.markTarget) {
        p.ptimer -= dt;
        if (p.ptimer > 0) return;
        const tgt = p.markTarget;
        const gx  = p.attacksRight ? 5 : 95;
        p.tx = clamp(tgt.cx*0.55+gx*0.45, 5, 95);
        p.ty = clamp(tgt.cy+(Math.random()-0.5)*4, 8, 92);
        p.lerpF = 0.12+(def/100)*0.12;
        p.ptimer = 55+Math.random()*50;
        return;
      }

      // ── TEAM BLOCK: updates every frame so whole team shifts together ──
      // Attacking block rides forward aggressively with ball position.
      // Defending block drops back. Width slot guarantees no clumping.
      const ctr    = blockCtr(p.attacksRight, inPoss);
      const offset = p.attacksRight ? depthOffset(depth) : -depthOffset(depth);
      p.tx = clamp(ctr + offset + (p.blockDriftX||0), 5, 95);
      const baseY = p.attacksRight ? 8+width*84 : 8+(1-width)*84;
      p.ty = clamp(baseY + latOff*5 + (p.blockDriftY||0), 5, 95);
      p.lerpF = inPoss
        ? 0.060+(pace/100)*0.080+(phys/100)*0.040
        : 0.090+(pace/100)*0.085+(def/100)*0.065;
      // No ptimer reset — block players execute every frame for full team cohesion
    });
  }

  /* ── PASSING SYSTEM: regular pass, through ball, cross ────────── */
  function updatePassCarrier(dt) {
    if (!ui.match) return;
    ui.match.passTimer -= dt;
    if (ui.match.passTimer > 0) return;

    const swapped      = ui.match.sim.swapped;
    const homeAttRight = !swapped;
    const possAttRight = ui.match.gamePhase >= 0 ? homeAttRight : !homeAttRight;
    const poss = ui.match.players.filter(p => p.attacksRight === possAttRight && (100-p.slot.y)/100 < 0.95);
    if (!poss.length) return;

    const cur  = (ui.match.carrier?.attacksRight === possAttRight) ? ui.match.carrier : null;
    const bx   = ui.match.ball?.cx || 50;
    const by   = ui.match.ball?.cy || 50;
    const passStat = cur?.player?.attrs?.passing   || 65;
    const dribStat = cur?.player?.attrs?.dribbling || 65;

    // ── SHOT: carrier near/in box shoots — high chance so players actually shoot ──
    if (cur) {
      const shootStat = cur.player?.attrs?.shooting || 65;
      const dir       = cur.attacksRight ? 1 : -1;
      const distToGoal = cur.attacksRight
        ? Math.hypot(cur.cx - 97, cur.cy - 50)
        : Math.hypot(cur.cx - 3,  cur.cy - 50);
      const centreY   = Math.abs(cur.cy - 50) < 24;
      // Shoot chance rises steeply inside the box; very good shooters try from range
      const shootChance = distToGoal < 18
        ? 0.45 + (shootStat/100)*0.35          // in/near box: 45-80% per tick
        : (distToGoal < 28 && centreY
          ? 0.08 + (shootStat/100)*0.14         // medium range: 8-22%
          : 0);
      if (shootChance > 0 && Math.random() < shootChance) {
        // Aim at goal mouth — slight inaccuracy based on shooting stat
        const accuracy = (shootStat / 100) * 6; // low stat = more scatter
        const goalY = 47 + (Math.random()-0.5) * (12 - accuracy);
        if (ui.match.ball) {
          ui.match.ball.tx       = cur.attacksRight ? 98 : 2;
          ui.match.ball.ty       = goalY;
          ui.match.ball.speed    = 0.30 + (shootStat/100)*0.24;
          ui.match.ball.kickType = 'shot';
        }
        ui.match.carrier   = null;
        ui.match.passTimer = 700 + Math.random() * 600;
        return;
      }
    }

    // ── THROUGH BALL: 20% chance — fast ball into space ahead of runner ──
    const runner = ui.match.runner;
    if (runner && runner !== cur && poss.includes(runner) && Math.random() < 0.20) {
      const runDir = runner.attacksRight ? 1 : -1;
      const leadX  = clamp(runner.cx + runDir * (10 + (passStat/100)*16), 8, 92);
      const leadY  = clamp(runner.cy + (Math.random()-0.5)*7, 8, 92);
      if (ui.match.ball) {
        ui.match.ball.tx       = leadX;
        ui.match.ball.ty       = leadY;
        ui.match.ball.speed    = 0.30;
        ui.match.ball.kickType = 'through';
      }
      ui.match.carrier = runner;
      ui.match.passTimer = 500 + Math.random() * 300;
      return;
    }

    // ── LOB: 8% chance when under pressure — floated ball over the press ──
    if (cur && ui.match.presser) {
      const presserDist = Math.hypot(ui.match.presser.cx-cur.cx, ui.match.presser.cy-cur.cy);
      if (presserDist < 18 && Math.random() < 0.09) {
        // Lob to the furthest forward teammate
        const lobTarget = poss.filter(p => p !== cur)
          .sort((a,b) => (cur.attacksRight ? b.cx-a.cx : a.cx-b.cx))[0];
        if (lobTarget && ui.match.ball) {
          ui.match.ball.tx       = clamp(lobTarget.cx + (Math.random()-0.5)*6, 3, 97);
          ui.match.ball.ty       = clamp(lobTarget.cy + (Math.random()-0.5)*6, 3, 97);
          ui.match.ball.speed    = 0.16; // floaty
          ui.match.ball.kickType = 'lob';
          ui.match.carrier       = lobTarget;
          ui.match.passTimer     = 600 + Math.random() * 400;
          return;
        }
      }
    }

    // ── CROSS: 12% chance when wide near byline ────────────────────
    if (cur) {
      const isWide     = Math.abs(cur.cy - 50) > 26;
      const nearByline = cur.attacksRight ? cur.cx > 58 : cur.cx < 42;
      if (isWide && nearByline && Math.random() < 0.13) {
        const crossX = cur.attacksRight
          ? clamp(86 + Math.random()*8, 85, 97)
          : clamp(6  + Math.random()*8, 3, 15);
        if (ui.match.ball) {
          ui.match.ball.tx       = crossX;
          ui.match.ball.ty       = 28 + Math.random()*44;
          ui.match.ball.speed    = 0.22;
          ui.match.ball.kickType = 'cross';
        }
        const boxAtts = poss.filter(p => {
          const inBox = cur.attacksRight ? p.cx > 72 : p.cx < 28;
          return inBox && (100-p.slot.y)/100 > 0.50;
        });
        if (boxAtts.length > 0) ui.match.carrier = boxAtts[rand(0, boxAtts.length-1)];
        ui.match.passTimer = 600 + Math.random() * 400;
        return;
      }
    }

    // ── BOOT: 5% chance — long kick upfield when deep ─────────────
    if (cur && (cur.attacksRight ? cur.cx < 30 : cur.cx > 70) && Math.random() < 0.06) {
      // Boot it long to the forwards
      const fwdPlayers = poss.filter(p => {
        const d = (100-p.slot.y)/100;
        return d > 0.65 && p !== cur;
      });
      const bootTarget = fwdPlayers.length > 0 ? fwdPlayers[rand(0, fwdPlayers.length-1)] : null;
      if (bootTarget && ui.match.ball) {
        ui.match.ball.tx       = clamp(bootTarget.cx + (Math.random()-0.5)*12, 3, 97);
        ui.match.ball.ty       = clamp(bootTarget.cy + (Math.random()-0.5)*12, 3, 97);
        ui.match.ball.speed    = 0.36; // fast long ball
        ui.match.ball.kickType = 'boot';
        ui.match.carrier       = bootTarget;
        ui.match.passTimer     = 700 + Math.random() * 500;
        return;
      }
    }

    // ── REGULAR PASS ──────────────────────────────────────────────
    const others  = cur ? poss.filter(p => p !== cur) : poss;
    if (!others.length) return;
    const maxDist = 18 + (passStat / 100) * 38;
    let best = others[0], bestScore = -Infinity;
    others.forEach(p => {
      const dx   = cur ? p.cx - cur.cx : 0;
      const dy   = cur ? p.cy - cur.cy : 0;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > maxDist) return;
      const fwd   = (p.attacksRight ? dx : -dx) * 0.50;
      const bonus = p === ui.match.runner ? 14 : 0;
      const score = Math.max(0, 32 - dist) + fwd + bonus + Math.random() * 7;
      if (score > bestScore) { bestScore = score; best = p; }
    });

    ui.match.carrier = best;
    if (ui.match.ball) {
      ui.match.ball.tx       = clamp(best.cx + (Math.random()-0.5)*3, 3, 97);
      ui.match.ball.ty       = clamp(best.cy + (Math.random()-0.5)*3, 3, 97);
      ui.match.ball.speed    = 0.22 + (passStat/100)*0.06; // better passers hit crisper passes
      ui.match.ball.kickType = 'pass';
    }
    ui.match.passTimer = Math.max(400, 700 + (dribStat-65)*4 + Math.random()*500);
  }

  /* ── HIGHLIGHT HELPERS ───────────────────────────────────── */
  function setBall(tx, ty, speed) {
    if (!ui.match?.ball) return;
    ui.match.ball.tx = clamp(tx, 2, 98);
    ui.match.ball.ty = clamp(ty, 2, 98);
    ui.match.ball.speed = speed || 0.18;
  }

  function applyPositions(getPosFn, attRight, lerpF) {
    if (!ui.match?.players) return;
    ui.match.players.forEach(p => {
      const depth = (100 - p.slot.y) / 100, width = p.slot.x / 100;
      const isAtt = p.attacksRight === attRight;
      let tx;
      if (depth < 0.12) {
        tx = p.attacksRight ? 7 : 93;
      } else if (getPosFn === 'buildup') {
        if (isAtt) {
          if (depth < 0.42) tx = attRight ? 38 + depth * 14 : 48 + depth * 14;
          else if (depth < 0.68) tx = attRight ? 54 + Math.random() * 18 : 28 + Math.random() * 18;
          else tx = attRight ? 68 + Math.random() * 16 : 16 + Math.random() * 16;
        } else {
          if (depth < 0.42) tx = attRight ? 10 + depth * 20 : 70 + depth * 20;
          else if (depth < 0.68) tx = attRight ? 24 + Math.random() * 20 : 56 + Math.random() * 20;
          else tx = attRight ? 38 + Math.random() * 18 : 44 + Math.random() * 18;
        }
      } else {
        if (isAtt) {
          if (depth < 0.42) tx = attRight ? 44 + Math.random() * 14 : 42 + Math.random() * 14;
          else if (depth < 0.68) tx = attRight ? 62 + Math.random() * 18 : 20 + Math.random() * 18;
          else tx = attRight ? 76 + Math.random() * 14 : 10 + Math.random() * 14;
        } else {
          if (depth < 0.42) tx = attRight ? 12 + Math.random() * 16 : 72 + Math.random() * 16;
          else if (depth < 0.68) tx = attRight ? 28 + Math.random() * 18 : 54 + Math.random() * 18;
          else tx = attRight ? 40 + Math.random() * 14 : 46 + Math.random() * 14;
        }
      }
      p.tx = clamp(tx, 4, 96);
      p.ty = clamp(10 + width * 80 + (Math.random() - 0.5) * 12, 5, 95);
      // Snap smooth-target to current tx/ty so highlight transitions don't lag
      p.stx = p.tx; p.sty = p.ty;
      p.lerpF = lerpF;
    });
  }

  /* ── GOAL HIGHLIGHT (~2.4s) ─────────────────────────────── */
  function runGoalHighlight(ev, onDone) {
    ui.match.inHighlight = true;
    const attRight = ev.team === 'home' ? !ui.match.sim.swapped : ui.match.sim.swapped;
    const shotX = attRight ? 74 + Math.random() * 10 : 16 + Math.random() * 10;
    const shotY = 20 + Math.random() * 60;

    // 1) Build-up
    applyPositions('buildup', attRight, 0.06);
    setBall(attRight ? 56 + Math.random() * 16 : 28 + Math.random() * 16, 22 + Math.random() * 56, 0.14);

    // 2) Attack shape (800ms)
    setTimeout(() => { if (!ui.match) return;
      applyPositions('attack', attRight, 0.09);
      setBall(shotX, shotY, 0.44);
    }, 800);

    // 3) Shot at goal (1440ms)
    setTimeout(() => { if (!ui.match) return;
      setBall(attRight ? 97 : 3, 34 + Math.random() * 32, 0.68);
      const gk = ui.match.players.find(p => p.slot.y > 85 && p.attacksRight !== attRight);
      if (gk) { gk.tx = gk.attacksRight ? 6 : 94; gk.ty = 62 + Math.random() * 20; gk.lerpF = 0.18; }
    }, 1440);

    // 4) Kickoff reset (1900ms) — straight back to play, no celebration or replay
    setTimeout(() => { if (!ui.match) return;
      ui.match.ball.tx = 50; ui.match.ball.ty = 50; ui.match.ball.speed = 0.12;
      ui.match.gamePhase = ev.team === 'home' ? -1 : 1;
      ui.match.carrier = null;
      ui.match.runner  = null;
      ui.match.holder  = null;
      ui.match.presser = null;
      ui.match.marker  = null;
      const hSlots = (DATA.FORMATIONS[ui.match.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
      const aSlots = (DATA.FORMATIONS[ui.match.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;
      ui.match.players.forEach(p => {
        const np = slotToXY((p.isHome ? hSlots : aSlots)[p.slotIdx], p.attacksRight);
        p.tx = p.attacksRight ? Math.min(np.bx, 48) : Math.max(np.bx, 52);
        p.ty = np.by; p.stx = p.cx; p.sty = p.cy; p.lerpF = 0.030;
      });
    }, 1900);

    setTimeout(() => { if (!ui.match) return; ui.match.inHighlight = false; onDone(); }, 2400);
  }

  /* ── SHOT HIGHLIGHT (~3.2s) ──────────────────────────────── */
  function runShotHighlight(ev, onDone) {
    ui.match.inHighlight = true;
    const attRight = ev.team === 'home' ? !ui.match.sim.swapped : ui.match.sim.swapped;
    const shotX = attRight ? 74 + Math.random() * 10 : 16 + Math.random() * 10;
    const shotY = 22 + Math.random() * 56;

    applyPositions('attack', attRight, 0.10);
    setBall(shotX, shotY, 0.36);

    // Ball fired at goal (600ms)
    setTimeout(() => { if (!ui.match) return;
      if (ev.type === 'shot_wide') {
        setBall(attRight ? 99 : 1, 4 + Math.random() * 14, 0.80);
      } else {
        const gkY = 30 + Math.random() * 40;
        setBall(attRight ? 95 + Math.random() * 2 : 3 + Math.random() * 2, gkY, 0.72);
        const gk = ui.match.players.find(p => p.slot.y > 85 && p.attacksRight !== attRight);
        if (gk) {
          // GK dives — reflexes stat scales how quick/far they move
          const reflex = gk.player?.attrs?.gkReflexes || 65;
          gk.tx = gk.attacksRight ? 6 : 94;
          gk.ty = clamp(gkY + (Math.random() - 0.5) * (20 + (reflex / 100) * 30), 10, 90);
          gk.lerpF = 0.20 + (reflex / 100) * 0.20;
        }
        if (ev.type !== 'shot_post') {
          setTimeout(() => { if (!ui.match) return;
            setBall(attRight ? 86 + Math.random() * 8 : 6 + Math.random() * 8,
                    10 + Math.random() * 80, 0.22);
          }, 360);
        }
      }
    }, 600);

    setTimeout(() => { if (!ui.match) return; ui.match.inHighlight = false; onDone(); }, 3200);
  }

  /* ── SWAP / RESET ────────────────────────────────────────── */
  function swapSides() {
    if (!ui.match?.players) return;
    ui.match.sim.swapped = true;
    ui.match.carrier = null;
    ui.match.runner  = null;
    ui.match.holder  = null;
    ui.match.presser = null;
    ui.match.marker  = null;
    const lblHome = $('pitch-team-label-home');
    const lblAway = $('pitch-team-label-away');
    if (lblHome) lblHome.textContent = ui.match.away.name;
    if (lblAway) lblAway.textContent = ui.match.home.name;
    const hSlots = (DATA.FORMATIONS[ui.match.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
    const aSlots = (DATA.FORMATIONS[ui.match.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;
    ui.match.players.forEach(p => {
      p.attacksRight = !p.attacksRight;
      const np = slotToXY((p.isHome ? hSlots : aSlots)[p.slotIdx], p.attacksRight);
      // Clamp to own half at kickoff — attacksRight=true means own half is left (<50)
      p.tx = p.attacksRight ? Math.min(np.bx, 48) : Math.max(np.bx, 52);
      p.ty = np.by; p.lerpF = 0.020;
    });
  }

  function resetBall() {
    if (!ui.match?.ball) return;
    ui.match.ball.tx = 50; ui.match.ball.ty = 50;
    ui.match.ball.cx = 50; ui.match.ball.cy = 50;
    ui.match.ball.speed = 0.35;
    if (ui.match.ball.el) { ui.match.ball.el.style.left = '50%'; ui.match.ball.el.style.top = '50%'; }
  }

  /* ── CARD FLASH ──────────────────────────────────────────── */
  function showCard(events) {
    const cardEv = events.find(e => e.type === 'yellow' || e.type === 'red');
    if (!cardEv) return;
    const card = $('pitch-card');
    if (!card) return;
    const homeLeft = !ui.match.sim.swapped;
    const x = (cardEv.team === 'home') === homeLeft ? 15 + Math.random() * 30 : 55 + Math.random() * 30;
    const y = 15 + Math.random() * 70;
    card.style.left = x + '%'; card.style.top = y + '%';
    card.className = '';
    card.offsetHeight;
    card.className = 'card-visible card-' + cardEv.type;
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease'; card.style.opacity = '0';
      setTimeout(() => {
        card.className = ''; card.style.opacity = ''; card.style.transition = '';
        // Leave a persistent dot where the card was shown
        const container = $('pitch-events');
        if (container) {
          const dot = document.createElement('div');
          dot.className = 'pitch-event-dot ' + cardEv.type;
          dot.style.left = x + '%';
          dot.style.top  = y + '%';
          container.appendChild(dot);
        }
      }, 500);
    }, 2200);
  }

  /* ── COMMENTARY ──────────────────────────────────────────── */
  const CMNT_QUIET = [
    'Play continues in midfield.', 'Possession changes hands.',
    'Patient build-up from the back.', 'A long ball is headed clear.',
    'The keeper collects with ease.', 'Midfield battle in the centre.',
    'Both teams probing for an opening.', 'A foul out near the touchline.',
    'The crowd urges their team forward.', 'Nothing clear-cut from either side.',
    'A corner cleared at the near post.', 'The referee waves play on.',
    'Comfortable passing in midfield.', 'A throw-in in the middle third.',
  ];
  const CMNT_PRESS = [
    'Great save from the keeper!', 'Off the post! So close!',
    'A thunderous shot — just over the bar!', 'The striker fires wide!',
    'Powerful header — straight at the keeper!', 'Chance! Not taken!',
    'A dangerous cross headed out for a corner!',
  ];

  function addCommentary(min, events) {
    events.forEach(e => {
      const club = e.team === 'home' ? ui.match.home : ui.match.away;
      const nm = e.player ? esc(e.player.name) + ' (' + esc(club.name) + ')' : esc(club.name);
      let text = '';
      if (e.type === 'goal') {
        const opts = ['GOAL! What a finish!', 'GOAL! Back of the net!', 'GOAL! The keeper had no chance!', 'GOAL! Unstoppable!'];
        text = opts[rand(0, opts.length - 1)] + (e.player ? ` ${esc(e.player.name)} scores for ${esc(club.name)}!` : '');
      } else if (e.type === 'shot_saved') {
        const opts = ['Great save!', 'What a stop from the keeper!', 'Denied! Brilliant save!', 'Keeper to the rescue!'];
        text = nm + ' — ' + opts[rand(0, opts.length - 1)];
      } else if (e.type === 'shot_wide') {
        const opts = ['Just wide!', 'Goes narrowly wide!', 'Across the face of goal!', 'So close, but over the bar!'];
        text = nm + ' — ' + opts[rand(0, opts.length - 1)];
      } else if (e.type === 'shot_post') {
        const opts = ['Off the post!', 'Strikes the woodwork!', 'Rattles the crossbar — incredible luck!'];
        text = nm + ' — ' + opts[rand(0, opts.length - 1)];
      } else if (e.type === 'yellow') {
        text = `Booked! ${e.player ? esc(e.player.name) + ' (' + esc(club.name) + ')' : esc(club.name)} is shown a yellow card.`;
      } else if (e.type === 'red') {
        text = `RED CARD! ${e.player ? esc(e.player.name) : 'A player'} is off! ${esc(club.name)} down to ten men!`;
      } else if (e.type === 'offside') {
        const opts = ['Flag is up! Offside!', 'Caught offside — the linesman raises the flag.', 'Offside! The move comes to nothing.', 'It\'s offside, no goal.'];
        text = (e.player ? esc(e.player.name) : 'A player') + ' — ' + opts[rand(0, opts.length-1)];
      } else if (e.type === 'tackle') {
        const nm2 = e.player ? esc(e.player.name) : esc(club.name);
        if (e.slide && !e.success) {
          text = nm2 + ' — Slide tackle misses! Lucky not to give away more.';
        } else if (e.slide && e.success) {
          text = nm2 + ' — Brilliant sliding tackle wins it cleanly!';
        } else if (e.success) {
          const opts = ['Wins the ball — great defending!', 'Timed to perfection, ball won!', 'Strong challenge wins possession.'];
          text = nm2 + ' — ' + opts[rand(0, opts.length-1)];
        } else {
          const opts = ['Caught in possession.', 'Battles but can\'t win the ball.', 'Physical duel in midfield.'];
          text = nm2 + ' — ' + opts[rand(0, opts.length-1)];
        }
      } else if (e.type === 'corner') {
        text = `Corner kick for ${esc(club.name)}.`;
      } else if (e.type === 'var_check') {
        text = `VAR CHECK — Referee reviewing the decision... Goal stands!`;
      }
      if (!text) return;
      const div = document.createElement('div');
      div.className = 'match-event commentary ' + e.type;
      div.innerHTML = `<span class="event-min">${min}'</span><span class="event-desc">${text}</span>`;
      $('match-events-list').prepend(div);
    });
    if (!events.length && min % 3 === 0) {
      const pool = Math.random() < 0.22 ? CMNT_PRESS : CMNT_QUIET;
      const div = document.createElement('div');
      div.className = 'match-event commentary';
      div.innerHTML = `<span class="event-min">${min}'</span><span class="event-desc">${pool[rand(0, pool.length - 1)]}</span>`;
      $('match-events-list').prepend(div);
    }
  }

  /* ── SIMULATION LOOP: 1 real-second = 1 game-minute (1:60) ─ */
  function runSimulation() {
    if (running || !ui.match) return;
    running = true;
    $('btn-simulate').classList.add('hidden');
    $('btn-pause').classList.remove('hidden');
    $('btn-speed').classList.remove('hidden');
    $('btn-pause').textContent = '⏸ Pause';
    $('match-status').textContent = 'LIVE';

    const ev = ui.match.result.events;
    const sim = ui.match.sim;

    function scheduleNext() {
      if (!running || !ui.match) return;
      if (sim.min >= 90) { finishMatch(); return; }
      ui.match.simTimer = setTimeout(tick, ui.match.speed === 2 ? 250 : 500);
    }

    function tick() {
      if (!running || !ui.match) return;
      sim.min++;

      const eventsThisMin = [];
      while (sim.idx < ev.length && ev[sim.idx].min <= sim.min) {
        const e = ev[sim.idx++];
        if (e.type === 'goal') { if (e.team === 'home') sim.hs++; else sim.as++; }
        if (['goal', 'yellow', 'red'].includes(e.type)) addMatchEvent(e);
        addPitchDot(e);
        eventsThisMin.push(e);
      }

      $('match-score').textContent = `${sim.hs} – ${sim.as}`;
      $('match-time').textContent = sim.min + "'";

      // Live stats — interpolate toward final pre-computed values (which reflect tactics + overalls)
      const r = ui.match.result;
      const pct = sim.min / 90;
      const [ph]   = r.stats.possession;
      const [fsh, fsa] = r.stats.shots;
      const [fth, fta] = r.stats.shotsOnTarget;
      const hPossLive  = Math.round(50 + (ph - 50) * pct);
      const hShotsLive = Math.round(fsh * pct);
      const aShotsLive = Math.round(fsa * pct);
      const hSoTLive   = Math.round(fth * pct);
      const aSoTLive   = Math.round(fta * pct);
      $('s-possession-h').textContent = hPossLive + '%';
      $('s-possession-a').textContent = (100 - hPossLive) + '%';
      $('stat-possession').style.width = hPossLive + '%';
      $('s-shots-h').textContent = hShotsLive;
      $('s-shots-a').textContent = aShotsLive;
      $('stat-shots').style.width = (hShotsLive / Math.max(1, hShotsLive + aShotsLive) * 100) + '%';
      $('s-sot-h').textContent = hSoTLive;
      $('s-sot-a').textContent = aSoTLive;
      $('stat-sot').style.width = (hSoTLive / Math.max(1, hSoTLive + aSoTLive) * 100) + '%';

      if (eventsThisMin.some(e => e.type === 'yellow' || e.type === 'red')) showCard(eventsThisMin);
      addCommentary(sim.min, eventsThisMin);

      if (sim.min === 45) {
        running = false;
        $('match-status').textContent = 'HALF TIME';
        $('match-time').textContent = "45'";
        $('btn-halftime').classList.remove('hidden');
        $('btn-pause').classList.add('hidden');
        $('btn-speed').classList.add('hidden');
        setTimeout(swapSides, 800);
        return;
      }

      const goalEv = eventsThisMin.find(e => e.type === 'goal');
      if (goalEv) {
        // Instant kickoff reset — no highlight, no replay
        if (ui.match.ball) { ui.match.ball.tx = 50; ui.match.ball.ty = 50; ui.match.ball.speed = 0.18; }
        ui.match.gamePhase = goalEv.team === 'home' ? -1 : 1;
        ui.match.carrier = null; ui.match.runner = null;
        ui.match.holder = null; ui.match.presser = null; ui.match.marker = null;
        const hSl = (DATA.FORMATIONS[ui.match.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
        const aSl = (DATA.FORMATIONS[ui.match.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;
        ui.match.players?.forEach(p => {
          const np = slotToXY((p.isHome ? hSl : aSl)[p.slotIdx], p.attacksRight);
          p.tx = p.attacksRight ? Math.min(np.bx, 48) : Math.max(np.bx, 52);
          p.ty = np.by; p.stx = p.cx; p.sty = p.cy; p.lerpF = 0.035;
        });
      }
      scheduleNext();
    }

    ui.match.simTimer = setTimeout(tick, ui.match.speed === 2 ? 250 : 500);
  }

  function addMatchEvent(e) {
    const club = e.team === 'home' ? ui.match.home : ui.match.away;
    const icon = e.type === 'goal' ? '●' : e.type === 'yellow' ? '■' : e.type === 'red' ? '■' : '⇄';
    let desc = e.player ? esc(e.player.name) : '';
    if (e.type === 'goal' && e.assist) desc += ` <span class="text-muted">(${esc(e.assist.name)})</span>`;
    const div = document.createElement('div');
    div.className = 'match-event ' + e.type;
    div.innerHTML = `<span class="event-min">${e.min}'</span><span class="event-icon">${icon}</span><span class="event-desc">${desc}</span><span class="event-team">${esc(club.name)}</span>`;
    $('match-events-list').prepend(div);
  }
  function addPitchDot(e) {
    const container = $('pitch-events');
    if (!container || !ui.match) return;
    // card dots are left by showCard after the animation; skip here
    if (e.type === 'yellow' || e.type === 'red') return;

    const swapped = ui.match.sim?.swapped;
    let x, y, cls;

    if (e.type === 'goal') {
      const attRight = (e.team === 'home') ? !swapped : swapped;
      x = attRight ? 76 + Math.random() * 10 : 14 + Math.random() * 10;
      y = 30 + Math.random() * 40;
      cls = 'goal';
    } else if (['shot_saved', 'shot_wide', 'shot_post'].includes(e.type)) {
      const attRight = (e.team === 'home') ? !swapped : swapped;
      x = attRight ? 72 + Math.random() * 14 : 14 + Math.random() * 14;
      y = 25 + Math.random() * 50;
      cls = 'shot';
    } else if (e.type === 'tackle' && !e.success) {
      const homeLeft = !swapped;
      x = (e.team === 'home') === homeLeft ? 15 + Math.random() * 40 : 45 + Math.random() * 40;
      y = 15 + Math.random() * 70;
      cls = 'foul';
    } else {
      return;
    }

    const dot = document.createElement('div');
    dot.className = 'pitch-event-dot ' + cls;
    dot.style.left = x + '%';
    dot.style.top = y + '%';
    container.appendChild(dot);
  }

  function finishMatch() {
    running = false;
    stopMatchRaf();
    $('btn-pause').classList.add('hidden');
    $('btn-speed').classList.add('hidden');
    const r = ui.match.result;
    const home = ui.match.home, away = ui.match.away;
    $('match-status').textContent = 'FULL TIME';
    $('match-time').textContent = "90'";

    // stats bar
    const [ph, pa] = r.stats.possession;
    $('s-possession-h').textContent = ph + '%'; $('s-possession-a').textContent = pa + '%';
    $('stat-possession').style.width = ph + '%';
    const [sh, sa] = r.stats.shots;
    $('s-shots-h').textContent = sh; $('s-shots-a').textContent = sa;
    $('stat-shots').style.width = (sh / Math.max(1, sh + sa) * 100) + '%';
    const [th, ta] = r.stats.shotsOnTarget;
    $('s-sot-h').textContent = th; $('s-sot-a').textContent = ta;
    $('stat-sot').style.width = (th / Math.max(1, th + ta) * 100) + '%';

    // overlay
    $('result-score-big').textContent = `${r.homeScore} – ${r.awayScore}`;
    $('result-teams').textContent = `${home.name}  vs  ${away.name}`;
    const goals = r.events.filter(e => e.type === 'goal');
    $('result-scorers').innerHTML = goals.length
      ? goals.map(g => `<div class="result-scorer-item"><span>${g.min}'</span><span class="scorer-name">${esc(g.player.name)}</span><span class="scorer-team">${esc((g.team === 'home' ? home : away).name)}</span></div>`).join('')
      : `<div class="result-scorer-item">No goals.</div>`;

    const myRatings = (ui.match.myIsHome ? r.homeRatings : r.awayRatings).slice().sort((a, b) => b.rating - a.rating);
    $('player-ratings-section').innerHTML = `<h4>Your Player Ratings</h4>` + myRatings.map(pr => {
      const cls = pr.rating >= 8 ? 'excellent' : pr.rating >= 7 ? 'good' : pr.rating >= 6 ? 'average' : 'poor';
      return `<div class="player-rating-item"><span class="pr-name">${esc(pr.player.name)} <span class="text-muted">${pr.player.pos}</span></span><span class="pr-rating ${cls}">${pr.rating.toFixed(1)}</span></div>`;
    }).join('');

    $('match-result-overlay').classList.remove('hidden');
  }

  function exitMatch() {
    if (!ui.match) { showScreen('game'); renderView(ui.view); return; }

    stopMatchRaf();
    if (ui.match.simTimer) { clearTimeout(ui.match.simTimer); ui.match.simTimer = null; }
    $('btn-halftime').classList.add('hidden');

    if (ui.match.sim && ui.match.sim.min > 0) {
      // Fast-forward any remaining events and show the final score
      running = false;
      const ev = ui.match.result.events;
      const sim = ui.match.sim;
      const startMin = sim.min;
      while (sim.idx < ev.length) {
        const e = ev[sim.idx++];
        if (e.type === 'goal') { if (e.team === 'home') sim.hs++; else sim.as++; }
        if (e.min > startMin) { addMatchEvent(e); addPitchDot(e); }
      }
      sim.min = 90;
      $('match-score').textContent = `${sim.hs} – ${sim.as}`;
      $('match-time').textContent = "90'";
      if ($('match-result-overlay').classList.contains('hidden')) finishMatch();
      // Stay on match screen — user clicks Continue ➔ to advance
      return;
    }

    // No simulation ran yet — exit cleanly
    running = false;
    ui.match = null;
    showScreen('game');
    renderView(ui.view);
  }

  function advanceAfterMatch() {
    const { fixture, result } = ui.match;
    fixture.played = true;
    fixture.homeScore = result.homeScore;
    fixture.awayScore = result.awayScore;
    fixture.events = result.events;
    ENGINE.recordResult(gameState, fixture, result.homeScore, result.awayScore);
    ENGINE.simulateSameDay(gameState, fixture);
    ENGINE.continueToNextFixture(gameState);
    simulateCompetitionsUpTo(gameState.currentDate);

    ui.match = null;
    delete gameState.matchSave;
    $('btn-simulate').textContent = '▶ Start Match';
    advanceScouts();
    if (!ENGINE.getNextFixture(gameState)) { endSeason(); return; }

    showScreen('game');
    updateSidebar();
    renderView(ui.view === 'tactics' ? 'dashboard' : ui.view);
    autoSave();
  }

  /* =============================================
     EUROPEAN / CUP PROGRESSION
     ============================================= */
  function simulateCompetitionsUpTo(date) {
    const myId = gameState.myClubId;
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (comp.stage === 'league') {
          // Auto-sim fixtures up to date, but skip player's own matches — those must be played manually
          comp.fixtures.filter(f => !f.played && f.date <= date && f.home !== myId && f.away !== myId).forEach(f => simEuroFixture(comp, f));
          if (comp.fixtures.every(f => f.played)) startEuroKnockout(comp);
        }
        if (comp.stage === 'knockout' && date >= comp.koDate) resolveKnockout(comp);
      });
    }
    if (gameState.cups) {
      Object.values(gameState.cups).forEach(cup => {
        const start = cup.fixtures[0] ? cup.fixtures[0].date : null;
        if (!cup.winner && start && date >= start) resolveCup(cup);
      });
    }
  }

  function simEuroFixture(comp, f) {
    if (f.played) return;
    const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
    if (!h || !a) { f.played = true; return; }
    const r = ENGINE.simulateMatch(h, a);
    f.played = true; f.homeScore = r.homeScore; f.awayScore = r.awayScore; f.events = r.events;
    ENGINE.recordResult(gameState, f, r.homeScore, r.awayScore);
    if (f.home === gameState.myClubId || f.away === gameState.myClubId) {
      const opp = f.home === gameState.myClubId ? a : h;
      const my = f.home === gameState.myClubId ? r.homeScore : r.awayScore;
      const og = f.home === gameState.myClubId ? r.awayScore : r.homeScore;
      notify(`${comp.short}: ${gameState.myClub.shortName} ${my}–${og} ${opp.shortName}`, my > og ? 'success' : my === og ? 'info' : 'warning');
    }
  }

  // Sort the league-phase table (points, then goal difference, then squad rating).
  function euTable(comp) {
    return comp.clubs.slice().sort((a, b) =>
      euPts(comp, b) - euPts(comp, a) ||
      euGd(comp, b) - euGd(comp, a) ||
      (gameState.clubs[b]?.sqRating || 0) - (gameState.clubs[a]?.sqRating || 0));
  }
  // New-format qualification: top R/2 go straight to the bracket, the next R
  // teams meet in a knockout playoff for the remaining spots, the rest are out.
  // Knockout bracket size: largest power of two (≤16) the pool can cleanly fill,
  // needing the top R/2 seeds plus a playoff field of R teams (so N ≥ 1.5·R).
  function euBracketSize(comp) {
    const N = comp.clubs.length;
    let R = 16; while (R > 2 && R * 1.5 > N) R /= 2;
    return R;
  }

  function startEuroKnockout(comp) {
    const table = euTable(comp);
    const R = euBracketSize(comp);
    const direct = table.slice(0, R / 2);                 // top 8 → straight to Round of 16
    const playoffField = table.slice(R / 2, R / 2 + R);   // 9th–24th → knockout playoff
    comp.knockout = { direct, playoffField, rounds: [] };
    comp.stage = 'knockout';
  }

  function resolveKnockout(comp) {
    const myId = gameState.myClubId;
    const k = comp.knockout;
    const rounds = [];

    // Knockout playoff round: contested for the last bracket spots.
    let playoffWinners = [];
    if (k.playoffField && k.playoffField.length) {
      const ties = [], pf = k.playoffField.slice();
      for (let i = 0; i + 1 < pf.length; i += 2) {
        const tie = simKO(pf[i], pf[i + 1]);
        ties.push(tie); playoffWinners.push(tie.winner);
      }
      if (pf.length % 2 === 1) playoffWinners.push(pf[pf.length - 1]);
      if (ties.length) rounds.push({ name: 'Knockout Playoff', ties });
    }

    // Seed the bracket: each top-8 club faces a playoff winner where possible.
    let teams = [];
    const seeded = k.direct.slice(), n = Math.max(seeded.length, playoffWinners.length);
    for (let i = 0; i < n; i++) {
      if (seeded[i]) teams.push(seeded[i]);
      if (playoffWinners[i]) teams.push(playoffWinners[i]);
    }

    while (teams.length > 1) {
      const ties = [], next = [];
      for (let i = 0; i + 1 < teams.length; i += 2) {
        const tie = simKO(teams[i], teams[i + 1]);
        ties.push(tie); next.push(tie.winner);
      }
      if (teams.length % 2 === 1) next.push(teams[teams.length - 1]);
      rounds.push({ name: roundName(teams.length), ties });
      teams = next;
    }
    comp.knockout.rounds = rounds;
    comp.winner = teams[0];
    comp.stage = 'done';
    if (comp.clubs.includes(myId)) {
      if (comp.winner === myId) notify(`You won the ${comp.name}!`, 'success');
      else notify(`${comp.name}: your European run has ended.`, 'info');
    }
  }
  function roundName(n) {
    return n >= 16 ? 'Round of 16' : n === 8 ? 'Quarter-finals' : n === 4 ? 'Semi-finals' : n === 2 ? 'Final' : 'Round of ' + n;
  }
  function simKO(aId, bId) {
    const A = gameState.clubs[aId], B = gameState.clubs[bId];
    if (!A) return { a: aId, b: bId, sa: 0, sb: 1, winner: bId };
    if (!B) return { a: aId, b: bId, sa: 1, sb: 0, winner: aId };
    const aStr = (A.sqRating || 70) + rand(-7, 7);
    const bStr = (B.sqRating || 70) + rand(-7, 7);
    let sa = rand(0, 3), sb = rand(0, 3);
    if (sa === sb) { if (aStr >= bStr) sa++; else sb++; }       // no draws in knockout
    const winner = sa > sb ? aId : bId;
    return { a: aId, b: bId, sa, sb, winner };
  }

  function resolveCup(cup) {
    let teams = cup.remaining.slice().filter(id => gameState.clubs[id]);
    const myId = gameState.myClubId;
    const myIn = teams.includes(myId);
    while (teams.length > 1) {
      const next = [];
      for (let i = 0; i + 1 < teams.length; i += 2) next.push(simKO(teams[i], teams[i + 1]).winner);
      if (teams.length % 2 === 1) next.push(teams[teams.length - 1]);
      teams = next;
    }
    cup.winner = teams[0];
    cup.fixtures.forEach(f => f.played = true);
    if (myIn) {
      if (cup.winner === myId) {
        gameState.myClub.rep = Math.min(5, Math.round(((gameState.myClub.rep || 1) + 0.3) * 10) / 10);
        notify(`You won the ${cup.name}! Club prestige has grown.`, 'success');
      } else {
        notify(`${cup.name}: knocked out.`, 'info');
      }
    }
  }


  /* ---- BOARD OBJECTIVE ---- */
  function setBoardObjective(gameState) {
    const myClub = gameState.myClub;
    const league = DATA.LEAGUES[myClub.league];
    if (!league) return;
    const leagueClubs = Object.values(gameState.clubs)
      .filter(c => c.league === myClub.league)
      .sort((a, b) => b.sqRating - a.sqRating);
    const n = leagueClubs.length || 20;
    const expectedPos = leagueClubs.findIndex(c => c.id === myClub.id) + 1 || Math.ceil(n / 2);
    const rep = myClub.rep || 1;
    const repAdj = rep >= 4.5 ? -2 : rep >= 3.5 ? -1 : rep <= 1.5 ? 1 : 0;
    const rel = league.relegation || 0;
    const targetPos = Math.max(1, Math.min(n - rel, expectedPos + repAdj));
    const cl = league.championsLeague || 0;
    const el = league.europaLeague || 0;
    const conf = league.conferenceLeague || 0;
    const ap = league.autoPromotion || 0;
    const ps = league.playoffSpots || 0;
    let type, label, targetPosMax;
    if (ap > 0) {
      if (targetPos <= ap)              { type = 'promotion'; label = 'Win automatic promotion';        targetPosMax = ap; }
      else if (ps > 0 && targetPos <= ap + ps) { type = 'playoffs'; label = 'Reach the promotion playoffs'; targetPosMax = ap + ps; }
      else if (targetPos > n - rel)    { type = 'survive';   label = 'Avoid relegation';               targetPosMax = n - rel; }
      else                              { type = 'midtable';  label = 'Finish in the top half';         targetPosMax = Math.floor(n / 2); }
    } else {
      if (targetPos === 1)              { type = 'title';     label = 'Win the league title';           targetPosMax = 1; }
      else if (cl > 0 && targetPos <= cl) { type = 'cl';     label = `Champions League qualification (top ${cl})`; targetPosMax = cl; }
      else if (targetPos <= cl + el)   { type = 'euro';      label = 'Europa League qualification';    targetPosMax = cl + el; }
      else if (conf > 0 && targetPos <= cl + el + conf) { type = 'conf'; label = 'European football';  targetPosMax = cl + el + conf; }
      else if (targetPos > n - rel)    { type = 'survive';   label = 'Avoid relegation';               targetPosMax = n - rel; }
      else                              { type = 'midtable';  label = 'Top-half finish';                targetPosMax = Math.floor(n / 2); }
    }
    gameState.boardObjective = { type, label, targetPosMax, n };
  }

  function evalBoardObjective(pos, myTransfer, league) {
    const obj = gameState.boardObjective;
    if (!obj) return { verdict: 'success', msg: '' };
    const relegated = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level > league.level);
    const promoted  = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level);
    if (obj.type === 'survive') {
      return relegated
        ? { verdict: 'sacked',     msg: 'The board cannot accept relegation. You have been dismissed.' }
        : { verdict: 'success',    msg: 'Objective met — survival secured.' };
    }
    if (obj.type === 'promotion' || obj.type === 'playoffs') {
      if (promoted || pos <= obj.targetPosMax) return { verdict: 'success', msg: 'Promotion objective achieved!' };
      const gap = pos - obj.targetPosMax;
      if (gap <= 3) return { verdict: 'budget_cut', msg: 'Just short of the promotion target. The board are disappointed — transfer budget cut by 30%.' };
      return { verdict: 'sacked', msg: 'Falling well short of promotion targets. You have been dismissed.' };
    }
    if (relegated) return { verdict: 'sacked', msg: 'Relegation is unacceptable for a club of this stature. You have been sacked.' };
    if (pos <= obj.targetPosMax) return { verdict: 'success', msg: `Objective met — finished ${ordinal(pos)}.` };
    const gap = pos - obj.targetPosMax;
    if (gap <= 4) return { verdict: 'budget_cut', msg: `Missed the board's target by ${gap} places. Transfer budget cut by 25% for next season.` };
    return { verdict: 'sacked', msg: 'A season to forget. The board have lost confidence and dismissed you.' };
  }

  /* =============================================
     SEASON END
     ============================================= */
  function endSeason() {
    // finish any remaining league fixtures
    gameState.fixtures.filter(f => !f.played).forEach(f => {
      const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
      if (!h || !a) { f.played = true; return; }
      const r = ENGINE.simulateMatch(h, a);
      f.played = true; f.homeScore = r.homeScore; f.awayScore = r.awayScore; f.events = r.events;
      ENGINE.recordResult(gameState, f, r.homeScore, r.awayScore);
    });
    // wrap up competitions
    if (gameState.european) Object.values(gameState.european).forEach(comp => {
      if (comp.stage === 'league') { comp.fixtures.filter(f => !f.played).forEach(f => simEuroFixture(comp, f)); startEuroKnockout(comp); }
      if (comp.stage === 'knockout') resolveKnockout(comp);
    });
    if (gameState.cups) Object.values(gameState.cups).forEach(cup => { if (!cup.winner) resolveCup(cup); });

    // ── English promotion / relegation / playoffs ──────────────────
    const engLeagues = ['premier_league','championship','league_one','league_two','national_league'];
    const engTables  = {};
    engLeagues.forEach(lid => { engTables[lid] = ENGINE.getLeagueTable(gameState, lid); });

    const playoffResults = {}; // lid → promoted club id

    engLeagues.forEach(lid => {
      const lg  = DATA.LEAGUES[lid];
      const tbl = engTables[lid];
      if (!tbl.length) return;
      const ap = lg.autoPromotion || 0;
      const ps = lg.playoffSpots  || 0;
      // Simulate playoffs: 3rd vs 6th, 4th vs 5th, then final
      if (ap > 0 && ps >= 4 && tbl.length >= ap + ps) {
        const seeds = tbl.slice(ap, ap + ps); // e.g. indices 2-5
        const simPO  = (a, b) => {
          const r = ENGINE.simulateMatch(a, b);
          return r.homeScore > r.awayScore ? a : r.awayScore > r.homeScore ? b : (Math.random() < 0.5 ? a : b);
        };
        const sf1 = simPO(seeds[0], seeds[3]);
        const sf2 = simPO(seeds[1], seeds[2]);
        playoffResults[lid] = simPO(sf1, sf2).id;
      }
    });

    // Move clubs between English leagues
    const transfers = []; // { clubId, from, to }
    for (let i = 0; i < engLeagues.length; i++) {
      const lid  = engLeagues[i];
      const lg   = DATA.LEAGUES[lid];
      const tbl  = engTables[lid];
      if (!tbl.length) continue;
      const higherLid = engLeagues[i - 1]; // league above
      const lowerLid  = engLeagues[i + 1]; // league below

      // Auto-promotions → league above
      if (higherLid && (lg.autoPromotion || 0) > 0) {
        tbl.slice(0, lg.autoPromotion).forEach(c => transfers.push({ clubId: c.id, from: lid, to: higherLid }));
      }
      // Playoff winner → league above
      if (higherLid && playoffResults[lid]) {
        transfers.push({ clubId: playoffResults[lid], from: lid, to: higherLid });
      }
      // Relegations → league below
      if (lowerLid && (lg.relegation || 0) > 0) {
        tbl.slice(-lg.relegation).forEach(c => transfers.push({ clubId: c.id, from: lid, to: lowerLid }));
      }
    }

    // Capture old position before applying transfers
    const myOldLeague = gameState.myClub.league;
    const table = ENGINE.getLeagueTable(gameState, myOldLeague);
    const pos = table.findIndex(c => c.id === gameState.myClubId) + 1;
    const champ = table[0];

    // Apply: change club.league
    transfers.forEach(({ clubId, to }) => {
      const c = gameState.clubs[clubId];
      if (c) c.league = to;
    });

    const topScorer = [...gameState.myClub.players].sort((a, b) => b.goals - a.goals)[0];
    const league = DATA.LEAGUES[myOldLeague];
    const myTransfer = transfers.find(t => t.clubId === gameState.myClubId);
    const myClub = gameState.myClub;

    // Club reputation changes based on season outcome
    if (myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level) {
      myClub.rep = Math.min(5, Math.round(((myClub.rep || 1) + 0.3) * 10) / 10); // promoted
    } else if (myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level > league.level) {
      myClub.rep = Math.max(1, Math.round(((myClub.rep || 1) - 0.4) * 10) / 10); // relegated
    } else if (pos === 1) {
      myClub.rep = Math.min(5, Math.round(((myClub.rep || 1) + 0.4) * 10) / 10); // champions
    } else if (pos <= (league.championsLeague || 0) && Math.random() < 0.40) {
      myClub.rep = Math.min(5, Math.round(((myClub.rep || 1) + 0.2) * 10) / 10); // CL finish
    }
    // Prestige erosion from poor seasons
    if (!myTransfer) {
      const halfway = Math.ceil(table.length / 2);
      if (pos > halfway && Math.random() < 0.25) {
        myClub.rep = Math.max(1, Math.round(((myClub.rep || 1) - 0.2) * 10) / 10); // bottom half
      } else if ((myClub.rep || 1) >= 4 && pos > (league.championsLeague || 0) && Math.random() < 0.30) {
        myClub.rep = Math.max(1, Math.round(((myClub.rep || 1) - 0.25) * 10) / 10); // big club missing CL
      }
    }
    let outcome = '';
    if (pos === 1) outcome = `Champions of the ${league.name}!`;
    else if (myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level) {
      const ap = league.autoPromotion || 0;
      outcome = pos <= ap ? 'Promoted!' : 'Promoted via the playoffs!';
    }
    else if (myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level > league.level) outcome = 'Relegated!';
    else if (pos <= league.championsLeague) outcome = 'Qualified for the Champions League!';
    else if (pos <= league.championsLeague + league.europaLeague) outcome = 'Qualified for the Europa League!';
    else if (pos <= league.championsLeague + league.europaLeague + (league.conferenceLeague || 0)) outcome = 'Qualified for the Conference League!';
    else {
      const ap = league.autoPromotion || 0, ps = league.playoffSpots || 0;
      if (ap > 0 && pos <= ap + ps) outcome = 'Just missed out on the playoffs.';
      else outcome = 'A solid mid-table finish.';
    }

    // Show playoff results in the modal
    const poLines = engLeagues
      .filter(lid => playoffResults[lid])
      .map(lid => {
        const winner = gameState.clubs[playoffResults[lid]];
        const higher = engLeagues[engLeagues.indexOf(lid) - 1];
        return winner ? `${esc(winner.name)} promoted to ${DATA.LEAGUES[higher]?.name}` : '';
      }).filter(Boolean).join('<br>');

    // Board objective evaluation
    const boardResult = evalBoardObjective(pos, myTransfer, league);
    const boardObj = gameState.boardObjective;
    const boardObjLabel = boardObj ? boardObj.label : '';

    if (boardResult.verdict === 'sacked') {
      showModal(`
        <div style="text-align:center">
          <h2 style="font-size:22px;margin-bottom:4px;color:var(--accent-red)">You've Been Sacked</h2>
          <p class="text-muted" style="margin-bottom:18px">${esc(gameState.myClub.name)} · Season ${gameState.season}</p>
          <div class="stat-big" style="font-size:40px;margin-bottom:6px">${ordinal(pos)}</div>
          <p style="margin-bottom:8px;font-weight:600">${outcome}</p>
          <div class="board-verdict-box sacked" style="margin-bottom:20px">
            <div class="bv-label">Board Objective</div>
            <div class="bv-target">${esc(boardObjLabel)}</div>
            <div class="bv-msg">${boardResult.msg}</div>
          </div>
          <button class="btn-secondary btn-lg" id="next-season-btn">Return to Main Menu</button>
        </div>`);
      $('next-season-btn').addEventListener('click', () => {
        closeModal();
        setAutoSaveRunning(false);
        gameState = null;
        showScreen('start');
      });
      return;
    }

    // Apply budget cut before continuing
    if (boardResult.verdict === 'budget_cut') {
      const cut = boardObj?.type === 'promotion' || boardObj?.type === 'playoffs' ? 0.30 : 0.25;
      myClub.budget = Math.round(myClub.budget * (1 - cut) * 10) / 10;
    }

    const boardHtml = boardObj ? `
      <div class="board-verdict-box ${boardResult.verdict}" style="margin-bottom:18px">
        <div class="bv-label">Board Objective</div>
        <div class="bv-target">${esc(boardObjLabel)}</div>
        ${boardResult.msg ? `<div class="bv-msg">${boardResult.msg}</div>` : ''}
      </div>` : '';

    showModal(`
      <div style="text-align:center">
        <h2 style="font-size:22px;margin-bottom:4px">Season ${gameState.season} Complete</h2>
        <p class="text-muted" style="margin-bottom:18px">${esc(gameState.myClub.name)}</p>
        <div class="stat-big" style="font-size:40px;margin-bottom:6px">${ordinal(pos)}</div>
        <p class="text-accent fw-700" style="margin-bottom:16px">${outcome}</p>
        ${boardHtml}
        <div class="pm-stats-grid" style="text-align:left;margin-bottom:18px">
          <div class="pm-stat"><span class="pm-stat-name">Champions</span><span class="pm-stat-val">${esc(champ.shortName)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Points</span><span class="pm-stat-val">${gameState.myClub.tableStats.points}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Top Scorer</span><span class="pm-stat-val">${topScorer ? esc(topScorer.lastName) : '—'}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${topScorer ? topScorer.goals : 0}</span></div>
        </div>
        ${poLines ? `<div style="margin-bottom:16px;font-size:13px;color:#86efac;line-height:1.8">${poLines}</div>` : ''}
        <button class="btn-primary btn-lg" id="next-season-btn">Start Season ${gameState.season + 1} ➔</button>
      </div>`);
    $('next-season-btn').addEventListener('click', () => { closeModal(); startNextSeason(); });
  }

  function startNextSeason() {
    gameState.season++;
    Object.values(gameState.clubs).forEach(club => {
      let totalOvr = 0;
      club.players.forEach(p => {
        p.age++;
        if (p.ovr < p.pot) {
          const grow = p.age <= 19 ? rand(2, 5) : p.age <= 22 ? rand(1, 4) : p.age <= 25 ? rand(0, 3) : p.age <= 27 ? rand(0, 1) : 0;
          if (grow > 0) p.ovr = Math.min(p.pot, p.ovr + grow);
        }
        if (p.age >= 33) p.ovr = Math.max(45, p.ovr - rand(1, 3));
        else if (p.age >= 31) p.ovr = Math.max(45, p.ovr - rand(0, 2));
        p.value = DATA.calcValue(p.ovr, p.age);
        p.contract = Math.max(1, p.contract - 1);
        p.goals = p.assists = p.appearances = p.yellowCards = p.redCards = 0;
        p.seasonRating = 0; p.ratingCount = 0;
        totalOvr += p.ovr;
      });
      club.sqRating = Math.round(totalOvr / club.players.length);
      club.tableStats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      club.europeanStats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      club.form = []; club.results = [];
    });

    gameState.currentDate = new Date(2025, 7, 9);
    ENGINE.setupEuropean(gameState);
    ENGINE.setupCups(gameState);
    Object.values(gameState.european).forEach(comp => comp.koDate = KO_DATE);
    gameState.fixtures = ENGINE.generateSchedule(gameState);
    gameState.market = ENGINE.getTransferMarket(gameState);
    setBoardObjective(gameState);
    gameState.tactics.lineup = autoPickXI(gameState.myClub, activeTacticForm());
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';

    ui.tableLeague = gameState.myClub.league;
    notify(`Welcome to Season ${gameState.season}!`, 'success');
    updateSidebar();
    renderView('dashboard');
    autoSave();
  }

  /* ---------------------------------------------
     DATE HELPER
     --------------------------------------------- */
  function fmtDate(d) {
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }
  function compName(f) {
    if (f.type === 'european' && f.comp && gameState.european && gameState.european[f.comp])
      return gameState.european[f.comp].name;
    if (f.leagueId && DATA.LEAGUES[f.leagueId]) return DATA.LEAGUES[f.leagueId].name;
    return '';
  }

  function restoreMatchFromSave() {
    const ms = gameState.matchSave;
    if (!ms) return false;
    const home = gameState.clubs[ms.homeId], away = gameState.clubs[ms.awayId];
    if (!home || !away) { delete gameState.matchSave; return false; }
    const result = { homeScore: ms.result.homeScore, awayScore: ms.result.awayScore, events: ms.result.matchEvents || [], stats: ms.result.stats || { possession:[50,50], shots:[0,0], shotsOnTarget:[0,0] }, homeRatings: ms.result.homeRatings || [], awayRatings: ms.result.awayRatings || [] };
    const fixture = gameState.fixtures.find(f => !f.played && f.home === ms.homeId && f.away === ms.awayId)
      || { home: ms.homeId, away: ms.awayId, played: false };
    ui.match = {
      fixture, home, away, myIsHome: ms.myIsHome, result,
      homeFormation: ms.homeFormation, awayFormation: ms.awayFormation,
      homeXI: ms.homeXI, awayXI: ms.awayXI,
      sim: { ...ms.sim }, simTimer: null, speed: 1, gamePhase: ms.gamePhase || 1,
    };
    showScreen('match');
    $('match-home-name').textContent = home.name;
    $('match-away-name').textContent = away.name;
    setBadge('match-home-badge', home);
    setBadge('match-away-badge', away);
    $('match-score').textContent = `${ms.sim.hs} – ${ms.sim.as}`;
    $('match-time').textContent = ms.sim.min + "'";
    $('match-status').textContent = ms.atHalfTime ? 'HALF TIME' : 'PAUSED';
    $('match-events-list').innerHTML = '';
    $('pitch-events').innerHTML = '';
    const ev = result.events;
    for (let i = 0; i < ms.sim.idx && i < ev.length; i++) addMatchEvent(ev[i]);
    $('btn-simulate').classList.add('hidden');
    $('btn-pause').classList.add('hidden');
    $('btn-speed').classList.add('hidden');
    $('match-result-overlay').classList.add('hidden');
    if (ms.atHalfTime) {
      $('btn-halftime').classList.remove('hidden');
    } else {
      $('btn-halftime').classList.add('hidden');
      $('btn-simulate').textContent = '▶ Resume';
      $('btn-simulate').classList.remove('hidden');
    }
    updateSidebar();
    return true;
  }

  function showSlotPicker() {
    const saves = listSaves().filter(s => s.id.startsWith('career_'));
    if (saves.length >= 5) {
      showModal(`<div class="player-modal" style="text-align:center">
        <h2 style="margin-bottom:10px">All Save Slots Full</h2>
        <p class="text-muted" style="margin-bottom:18px">Delete a save from <strong>Load Save</strong> to start a new career.</p>
        <button class="btn-secondary" id="ssp-close">OK</button>
      </div>`);
      $('ssp-close').addEventListener('click', closeModal);
      return;
    }
    const slots = [1,2,3,4,5];
    let html = '<div class="player-modal"><h2 style="margin-bottom:14px">Choose a Save Slot</h2>';
    slots.forEach(n => {
      const id = 'career_' + n;
      const s = saves.find(x => x.id === id);
      html += `<div class="save-slot-pick ${s ? 'occ' : 'empty'}" data-slot="${id}">
        <span class="ssp-num">${n}</span>
        <div class="ssp-info">
          ${s ? `<div class="ssp-name">${esc(s.clubName)}</div><div class="ssp-meta">Season ${s.season} · ${fmtSavedAt(s.savedAt)}</div>`
              : `<div class="ssp-name">Empty slot</div>`}
        </div>
        ${s ? '<span class="ssp-warn">Overwrite</span>' : ''}
      </div>`;
    });
    html += '</div>';
    showModal(html);
    document.querySelectorAll('.save-slot-pick').forEach(el => {
      el.addEventListener('click', () => {
        const slotId = el.dataset.slot;
        const s = saves.find(x => x.id === slotId);
        if (s && !confirm('Overwrite ' + s.clubName + ' (Season ' + s.season + ')?')) return;
        if (s) deleteSave(slotId);
        ui.pendingSlotId = slotId;
        closeModal();
        showClubSelector();
      });
    });
  }

  /* =============================================
     SAVE / LOAD  (localStorage)
     ============================================= */
  const SAVE_INDEX = 'fm_saves_v1';
  const SLOT_PREFIX = 'fm_slot_';

  // Dates serialise to ISO strings by default; tag + revive them so the engine
  // keeps real Date objects. `this[k]` is the raw value (pre-toJSON). We also
  // drop fixture `events` (full player-object copies) — they're only consumed
  // at play-time and are never re-read after a save is loaded, so omitting them
  // hugely shrinks the payload.
  function saveReplacer(k, v) {
    if (k === 'events') return undefined;
    return this[k] instanceof Date ? { __d: this[k].getTime() } : v;
  }
  function dateReviver(k, v) { return (v && typeof v === 'object' && v.__d != null) ? new Date(v.__d) : v; }

  // Inlined LZ-string (UTF-16) codec — compresses JSON ~6-8x so multiple
  // saves fit inside the localStorage quota. (pieroxy/lz-string, MIT.)
  const LZString = (function () {
    const f = String.fromCharCode;
    function _compress(uncompressed, bitsPerChar, getCharFromInt) {
      if (uncompressed == null) return '';
      let i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = '',
          context_wc = '', context_w = '', context_enlargeIn = 2, context_dictSize = 3,
          context_numBits = 2, context_data = [], context_data_val = 0, context_data_position = 0, ii;
      for (ii = 0; ii < uncompressed.length; ii += 1) {
        context_c = uncompressed.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) { context_dictionary[context_c] = context_dictSize++; context_dictionaryToCreate[context_c] = true; }
        context_wc = context_w + context_c;
        if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) { context_w = context_wc; }
        else {
          if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
            if (context_w.charCodeAt(0) < 256) {
              for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 8; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
            } else {
              value = 1;
              for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | value; if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = 0; }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 16; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
            }
            context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
            delete context_dictionaryToCreate[context_w];
          } else {
            value = context_dictionary[context_w];
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
          }
          context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
          context_dictionary[context_wc] = context_dictSize++; context_w = String(context_c);
        }
      }
      if (context_w !== '') {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | value; if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = 0; }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
          }
          context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
        }
        context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
      }
      value = 2;
      for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else context_data_position++; value = value >> 1; }
      while (true) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data.push(getCharFromInt(context_data_val)); break; } else context_data_position++; }
      return context_data.join('');
    }
    function _decompress(length, resetValue, getNextValue) {
      let dictionary = [], enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', result = [], i, w,
          bits, resb, maxpower, power, c, data = { val: getNextValue(0), position: resetValue, index: 1 }, next;
      for (i = 0; i < 3; i += 1) dictionary[i] = i;
      bits = 0; maxpower = Math.pow(2, 2); power = 1;
      while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
      switch (next = bits) {
        case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } c = f(bits); break;
        case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } c = f(bits); break;
        case 2: return '';
      }
      dictionary[3] = c; w = c; result.push(c);
      while (true) {
        if (data.index > length) return '';
        bits = 0; maxpower = Math.pow(2, numBits); power = 1;
        while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
        switch (c = bits) {
          case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } dictionary[dictSize++] = f(bits); c = dictSize - 1; enlargeIn--; break;
          case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } dictionary[dictSize++] = f(bits); c = dictSize - 1; enlargeIn--; break;
          case 2: return result.join('');
        }
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
        if (dictionary[c]) entry = dictionary[c];
        else { if (c === dictSize) entry = w + w.charAt(0); else return null; }
        result.push(entry);
        dictionary[dictSize++] = w + entry.charAt(0); enlargeIn--;
        w = entry;
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      }
    }
    return {
      compressToUTF16: (input) => input == null ? '' : _compress(input, 15, (a) => f(a + 32)) + ' ',
      decompressFromUTF16: (compressed) => compressed == null ? '' : compressed == '' ? null
        : _decompress(compressed.length, 16384, (index) => compressed.charCodeAt(index) - 32),
    };
  })();

  function readIndex() { try { return JSON.parse(localStorage.getItem(SAVE_INDEX)) || {}; } catch (e) { return {}; } }
  function writeIndex(idx) { try { localStorage.setItem(SAVE_INDEX, JSON.stringify(idx)); } catch (e) {} }
  function listSaves() {
    const idx = readIndex();
    return Object.keys(idx).map(id => ({ id, ...idx[id] })).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  function saveMeta(label) {
    return {
      label,
      clubName: gameState.myClub.name,
      leagueName: DATA.LEAGUES[gameState.myClub.league].name,
      season: gameState.season,
      gameDate: MONTHS_SHORT[gameState.currentDate.getMonth()] + ' ' + gameState.currentDate.getFullYear(),
      pos: ENGINE.getMyPosition(gameState),
      savedAt: Date.now(),
    };
  }
  function writeSave(slotId, label) {
    try {
      const payload = LZString.compressToUTF16(JSON.stringify(gameState, saveReplacer));
      localStorage.setItem(SLOT_PREFIX + slotId, payload);
      const idx = readIndex(); idx[slotId] = saveMeta(label); writeIndex(idx);
      return true;
    } catch (e) {
      notify('Save failed — storage is full. Delete an old save and retry.', 'error');
      return false;
    }
  }
  function autoSave() {
    if (!gameState) return;
    if (ui.match && ui.match.sim && ui.match.sim.min > 0) {
      const mr = ui.match.result;
      gameState.matchSave = {
        homeId: ui.match.home.id, awayId: ui.match.away.id,
        myIsHome: ui.match.myIsHome,
        homeFormation: ui.match.homeFormation, awayFormation: ui.match.awayFormation,
        homeXI: ui.match.homeXI, awayXI: ui.match.awayXI,
        result: {
          homeScore: mr.homeScore, awayScore: mr.awayScore,
          matchEvents: mr.events,
          stats: mr.stats,
          homeRatings: mr.homeRatings, awayRatings: mr.awayRatings,
        },
        sim: { ...ui.match.sim },
        gamePhase: ui.match.gamePhase || 1,
        atHalfTime: ui.match.sim.min === 45,
      };
    } else {
      delete gameState.matchSave;
    }
    writeSave(gameState.slotId || 'career_1', 'Autosave');
  }
  function deleteSave(slotId) {
    try { localStorage.removeItem(SLOT_PREFIX + slotId); } catch (e) {}
    const idx = readIndex(); delete idx[slotId]; writeIndex(idx);
  }

  function loadSave(slotId) {
    let raw = null;
    try { raw = localStorage.getItem(SLOT_PREFIX + slotId); } catch (e) {}
    if (!raw) { notify('Save not found.', 'error'); return; }
    let state;
    try {
      state = JSON.parse(LZString.decompressFromUTF16(raw), dateReviver);
      state.myClub = state.clubs[state.myClubId];                 // re-link reference identity
      state.fixtures.forEach(fx => { if (!fx.events) fx.events = []; });   // events stripped on save
    } catch (e) { notify('Save file is corrupted.', 'error'); return; }
    if (!state.myClub) { notify('Save file is invalid.', 'error'); return; }
    if (!state.slotId) state.slotId = slotId;   // migrate old saves
    gameState = state;
    running = false;
    ui.match = null;
    ui.view = 'dashboard';
    ui.squadFilter = 'all'; ui.squadSort = 'ovr';
    ui.transferTab = 'market'; ui.transferSearch = ''; ui.transferPos = 'all';
    ui.tableLeague = gameState.myClub.league;
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';
    closeModal();
    initGameChrome();
    if (gameState.matchSave && restoreMatchFromSave()) {
      notify('Game loaded — match restored.', 'success');
    } else {
      showScreen('game');
      updateSidebar();
      renderView('dashboard');
      notify('Game loaded.', 'success');
    }
  }

  function fmtSavedAt(ts) {
    if (!ts) return 'unknown';
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function defaultLabel() { return gameState.myClub.shortName + ' · S' + gameState.season; }

  const MAX_SLOTS = 5;   // manual save slots (the 'auto' slot is separate)

  function openSaves(mode) {
    const slots = listSaves();
    const manualCount = slots.filter(s => s.id !== 'auto').length;
    let html = `<div class="player-modal"><h2 style="margin-bottom:6px">${mode === 'save' ? 'Save Game' : 'Load Game'}</h2>`;
    html += `<p class="text-muted" style="font-size:11px;margin-bottom:12px">${manualCount}/${MAX_SLOTS} save slots used</p>`;
    if (mode === 'save') {
      html += manualCount < MAX_SLOTS
        ? `<button class="btn-primary" id="save-new" style="width:100%;margin-bottom:12px">＋ New Save Slot</button>`
        : `<p class="text-gold" style="font-size:11px;margin-bottom:12px">All ${MAX_SLOTS} slots full — overwrite or delete one below.</p>`;
    }
    if (!slots.length) {
      html += `<div class="empty-state"><div class="empty-state-text">No saved games yet.</div></div>`;
    } else {
      html += slots.map(s => `
        <div class="inbox-item">
          <div class="inbox-icon" style="font-size:14px;color:var(--text-muted)">${s.id === 'auto' ? '↻' : '▸'}</div>
          <div class="inbox-content">
            <div class="inbox-subject">${esc(s.label || s.clubName)}</div>
            <div class="inbox-preview">${esc(s.clubName)} · ${esc(s.leagueName)} · Season ${s.season} · ${esc(s.gameDate)}${s.pos ? ' · ' + ordinal(s.pos) : ''}<br>Saved ${fmtSavedAt(s.savedAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            <button class="${mode === 'save' ? 'btn-gold' : 'btn-primary'}" data-act="${mode}" data-slot="${s.id}" style="padding:5px 10px;font-size:11px">${mode === 'save' ? 'Overwrite' : 'Load'}</button>
            <button class="btn-danger" data-act="delete" data-slot="${s.id}" style="padding:5px 10px;font-size:11px">Delete</button>
          </div>
        </div>`).join('');
    }
    html += `</div>`;
    showModal(html);

    const nb = $('save-new');
    if (nb) nb.addEventListener('click', () => { if (writeSave('s' + Date.now(), defaultLabel())) { notify('Game saved.', 'success'); openSaves('save'); } });
    document.querySelectorAll('#modal-content [data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.slot, act = b.dataset.act;
      if (act === 'delete') { deleteSave(id); openSaves(mode); }
      else if (act === 'save') { const idx = readIndex(); if (writeSave(id, (idx[id] && idx[id].label) || defaultLabel())) { notify('Game saved.', 'success'); openSaves('save'); } }
      else if (act === 'load') { loadSave(id); }
    }));
  }

  function goToMenu() {
    showScreen('start');
    showHomeView();
  }

  /* ---------------------------------------------
     BOOT
     --------------------------------------------- */
  function init() { initStartScreen(); }

  return { init };
})();

APP.init();
