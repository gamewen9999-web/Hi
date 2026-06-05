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
  };

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
    return `<img class="crest-img" src="${url}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('crest');this.parentNode.style.background='${hex(club.color)}';this.parentNode.style.color='${textOn(club.color)}';this.replaceWith(document.createTextNode('${init}'))">`;
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
    const slots = listSaves();
    const latest = slots[0];
    let html = '';
    if (latest) {
      html += `<button class="btn-primary btn-lg home-btn" id="hm-continue">▶ Continue — ${esc(latest.clubName)} S${latest.season}</button>`;
    }
    html += `<button class="btn-secondary btn-lg home-btn" id="hm-new">⚽ New Save</button>`;
    html += `<button class="btn-secondary btn-lg home-btn" id="hm-load" ${!slots.length ? 'disabled' : ''}>📂 Load Save</button>`;
    $('home-menu').innerHTML = html;
    if (latest) $('hm-continue').addEventListener('click', () => loadSave(latest.id));
    $('hm-new').addEventListener('click', showClubSelector);
    if (slots.length) $('hm-load').addEventListener('click', () => openSaves('load'));
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
        <div class="club-card-rep">${[1,2,3,4,5].map(i => `<span class="rep-star ${i <= c.rep ? 'lit' : ''}">★</span>`).join('')}</div>
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
    $('confirm-rep').textContent = '★'.repeat(c.rep);
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
      currentDate: new Date(2025, 7, 9),
      fixtures: [],
      transferLog: [],
      season: 1,
      tactics: { formation: '4-3-3', mentality: 'balanced', lineup: [] },
    };

    ENGINE.setupEuropean(gameState);
    ENGINE.setupCups(gameState);
    Object.values(gameState.european).forEach(comp => comp.koDate = KO_DATE);
    gameState.fixtures = ENGINE.generateSchedule(gameState);
    gameState.tactics.lineup = autoPickXI(gameState.myClub, gameState.tactics.formation);
    gameState.market = ENGINE.getTransferMarket(gameState);
    ui.tableLeague = gameState.myClub.league;
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';

    initGameChrome();
    showScreen('game');
    updateSidebar();
    renderView('dashboard');
  }

  let chromeReady = false;
  function initGameChrome() {
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
        running = false;
        runSimulation();
      });
      $('btn-continue-after-match').addEventListener('click', advanceAfterMatch);
      $('btn-exit-match').addEventListener('click', exitMatch);

      // Save / Main-menu controls injected into the sidebar footer
      const sb = document.querySelector('.sidebar-bottom');
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;margin-top:4px';
      actions.innerHTML = `
        <button id="sb-save" class="btn-secondary" style="flex:1;padding:7px 4px;font-size:11px">💾 Save</button>
        <button id="sb-menu" class="btn-secondary" style="flex:1;padding:7px 4px;font-size:11px">☰ Menu</button>`;
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
    document.querySelector('.sidebar-club').style.background = `linear-gradient(180deg, ${col}18 0%, #080c14 100%)`;
    $('sb-badge').style.boxShadow = `0 0 0 3px #080c14, 0 0 0 5px ${col}50, 0 8px 24px ${col}28`;
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
  function autoPickXI(club, formationKey) {
    const form = DATA.FORMATIONS[formationKey];
    const used = new Set();
    const xi = [];
    form.positions.forEach(slot => {
      let best = null, bestScore = -1;
      club.players.forEach(p => {
        if (used.has(p.id)) return;
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
    ({
      dashboard: renderDashboard, squad: renderSquad, tactics: renderTactics,
      fixtures: renderFixtures, table: renderTable, transfers: renderTransfers,
      european: renderEuropean, finances: renderFinances,
    }[v] || renderDashboard)(m);
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
      nextHtml = `<div class="next-match-card"><div class="empty-state"><div class="empty-state-icon">🏁</div><div class="empty-state-text">Season complete — no fixtures remaining.</div></div></div>`;
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
    const filters = [['all','All'],['GK','Goalkeepers'],['DEF','Defenders'],['MID','Midfielders'],['ATT','Attackers']];
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
            <td><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span></td>
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
    const club = gameState.myClub;
    const form = DATA.FORMATIONS[gameState.tactics.formation];
    const lineup = gameState.tactics.lineup;
    const lineupSet = new Set(lineup);
    const mentalities = ['defensive','balanced','attacking'];

    const players = form.positions.map((slot, i) => {
      const p = club.players.find(x => x.id === lineup[i]);
      if (!p) return '';
      return `<div class="pitch-player" data-id="${p.id}" style="left:${slot.x}%;top:${slot.y}%">
        <div class="pitch-player-circle ${slot.pos === 'GK' ? 'gk' : ''}">${p.ovr}</div>
        <div class="pitch-player-name">${esc(p.lastName)}</div></div>`;
    }).join('');

    const bench = club.players.filter(p => !lineupSet.has(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 12);

    // Scout panel — live xG reacts to mentality changes
    const next = ENGINE.getNextFixture(gameState);
    let scoutHtml = '';
    if (next) {
      const myIsHome = next.home === gameState.myClubId;
      const opp = gameState.clubs[myIsHome ? next.away : next.home];
      if (opp) {
        const xg = myIsHome
          ? ENGINE.calcMatchXG(club, opp, gameState.tactics.mentality, 'balanced')
          : ENGINE.calcMatchXG(opp, club, 'balanced', gameState.tactics.mentality);
        const myXG  = myIsHome ? xg.homeXG : xg.awayXG;
        const oppXG = myIsHome ? xg.awayXG : xg.homeXG;
        const myPct = Math.round(myXG / (myXG + oppXG) * 100);
        const favoured = myXG >= oppXG;
        const oppTop = [...opp.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
        const formDots = (opp.form || []).map(f =>
          `<span class="form-dot ${f === 'W' ? 'win' : f === 'D' ? 'draw' : 'loss'}">${f}</span>`).join('');
        scoutHtml = `
          <div class="tactics-section scout-panel">
            <div class="scout-top">
              <span class="scout-venue ${myIsHome ? 'home' : 'away'}">${myIsHome ? 'HOME' : 'AWAY'}</span>
              <span class="scout-comp">${compName(next)}</span>
              <span class="scout-dt">${fmtDate(next.date)}</span>
            </div>
            <div class="scout-opp-row">
              ${badge(opp, 'scout-badge')}
              <div class="scout-opp-info">
                <span class="scout-opp-name">${esc(opp.shortName)}</span>
                <div class="scout-form">${formDots || '<span style="font-size:10px;color:var(--text-muted)">No data</span>'}</div>
              </div>
              <div class="scout-ovr-block">
                <span class="scout-ovr-val">${opp.sqRating}</span>
                <span class="scout-ovr-label">OVR</span>
              </div>
            </div>
            <div class="scout-xg-block">
              <div class="scout-xg-row">
                <span class="scout-xg-num ${favoured ? 'good' : ''}">${myXG.toFixed(2)}</span>
                <div class="scout-xg-bar"><div class="scout-xg-mine" style="width:${myPct}%"></div></div>
                <span class="scout-xg-num ${!favoured ? 'bad' : ''}">${oppXG.toFixed(2)}</span>
              </div>
              <div class="scout-xg-sub"><span>You</span><span>xG</span><span>Opp</span></div>
            </div>
            <div class="scout-key">
              <span class="scout-key-label">Key Players</span>
              ${oppTop.map(p => `
                <div class="scout-player">
                  <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
                  <span class="scout-player-name">${esc(p.name)}</span>
                  <span class="bench-ovr">${p.ovr}</span>
                </div>`).join('')}
            </div>
          </div>`;
      }
    }

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Tactics</div><div class="view-subtitle">${form.name} · ${cap(gameState.tactics.mentality)}</div></div></div>
      <div class="tactics-layout">
        <div class="tactics-pitch-container">
          <div class="tactics-pitch">
            <div class="tactics-pitch-lines">
              <div class="tp-center-line"></div><div class="tp-center-circle"></div>
              <div class="tp-penalty-top"></div><div class="tp-penalty-bottom"></div>
            </div>
            ${players}
          </div>
        </div>
        <div class="tactics-options-panel">
          <div class="tactics-section"><h3>Formation</h3>
            <div class="formation-grid">${Object.keys(DATA.FORMATIONS).map(f =>
              `<button class="formation-btn ${f===gameState.tactics.formation?'selected':''}" data-f="${f}">${DATA.FORMATIONS[f].name}</button>`).join('')}</div></div>
          <div class="tactics-section"><h3>Mentality</h3>
            <div class="mentality-btns">${mentalities.map(mt =>
              `<button class="mentality-btn ${mt===gameState.tactics.mentality?'selected':''}" data-m="${mt}">${cap(mt)}</button>`).join('')}</div></div>
          <div class="tactics-section"><h3>Bench</h3>
            <div class="bench-list">${bench.map(p =>
              `<div class="bench-player" data-id="${p.id}"><span class="bench-pos pos-badge ${posClass(p.pos)}">${p.pos}</span><span class="bench-name">${esc(p.name)}</span><span class="bench-ovr">${p.ovr}</span></div>`).join('')}</div></div>
          ${scoutHtml}
        </div>
      </div>`;

    m.querySelectorAll('.formation-btn').forEach(b => b.addEventListener('click', () => {
      gameState.tactics.formation = b.dataset.f;
      gameState.tactics.lineup = autoPickXI(club, b.dataset.f);
      renderTactics(m);
    }));
    m.querySelectorAll('.mentality-btn').forEach(b => b.addEventListener('click', () => {
      gameState.tactics.mentality = b.dataset.m; renderTactics(m);
    }));
    m.querySelectorAll('.pitch-player, .bench-player').forEach(el => el.addEventListener('click', () => showPlayerModal(el.dataset.id)));
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
    const lid = ui.tableLeague || gameState.myClub.league;
    const league = DATA.LEAGUES[lid];
    const table = ENGINE.getLeagueTable(gameState, lid);
    const myLeagues = [...new Set([gameState.myClub.league, ...Object.keys(DATA.LEAGUES)])];

    const zone = (i) => {
      if (i < league.championsLeague) return 'championsleague';
      if (i < league.championsLeague + league.europaLeague) return 'europe';
      if (i < league.championsLeague + league.europaLeague + (league.conferenceLeague || 0)) return 'conference';
      if (i >= table.length - league.relegation) return 'relegation';
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
        <div class="tz"><span class="tz-dot rel"></span>Relegation</div>
      </div>`;

    m.querySelectorAll('.transfer-tab').forEach(b => b.addEventListener('click', () => { ui.tableLeague = b.dataset.l; renderTable(m); }));
  }

  /* ---------------------------------------------
     TRANSFERS
     --------------------------------------------- */
  function renderTransfers(m) {
    const open = ENGINE.isTransferWindowOpen(gameState);
    const club = gameState.myClub;
    const banner = open
      ? `<div class="tw-banner">🟢 Transfer window is OPEN</div>`
      : `<div class="tw-banner closed">🔴 Transfer window is closed (opens Jul–Aug & Jan)</div>`;

    let listHtml;
    if (ui.transferTab === 'market') {
      let market = gameState.market || [];
      if (ui.transferSearch) market = market.filter(p => p.name.toLowerCase().includes(ui.transferSearch));
      if (ui.transferPos !== 'all') market = market.filter(p => group(p.pos) === ui.transferPos);
      listHtml = market.slice(0, 80).map(p => `
        <div class="transfer-player-item" data-buy="${p.id}" data-club="${p.clubId}">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info"><div class="tp-name">${esc(p.name)}</div><div class="tp-club">${esc(p.clubName)} · Age ${p.age}</div></div>
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
                `<div class="transfer-log-item"><span class="tlog-icon">${t.in ? '🟢' : '🔴'}</span><div class="tlog-info">${t.in ? 'IN' : 'OUT'}: ${esc(t.name)}</div><span class="tlog-fee">${money(t.fee)}</span></div>`).join('')
              : `<div class="stat-label">No transfers yet this save.</div>`}</div>
          </div>
        </div>
      </div>`;

    m.querySelectorAll('.transfer-tab').forEach(b => b.addEventListener('click', () => { ui.transferTab = b.dataset.t; renderTransfers(m); }));
    const search = $('tr-search');
    if (search) search.addEventListener('input', (e) => { ui.transferSearch = e.target.value.trim().toLowerCase(); renderTransfers(m); search.focus(); });
    const sel = $('tr-pos');
    if (sel) sel.addEventListener('change', (e) => { ui.transferPos = e.target.value; renderTransfers(m); });
    m.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => openNegotiation(el.dataset.buy, el.dataset.club)));
    m.querySelectorAll('[data-sell]').forEach(el => el.addEventListener('click', () => confirmSell(el.dataset.sell)));
  }
  function emptyList(text) { return `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">${text}</div></div>`; }

  /* ---- TRANSFER NEGOTIATION ---- */
  function openNegotiation(playerId, clubId) {
    if (!ENGINE.isTransferWindowOpen(gameState)) return notify('Transfer window is closed.', 'error');
    if (clubId === gameState.myClubId) return;
    const seller = gameState.clubs[clubId];
    const p = seller && seller.players.find(x => x.id === playerId);
    if (!p) return;
    ui.negotiation = {
      playerId, clubId, stage: 'fee',
      neg: ENGINE.startNegotiation(p, seller),
      agreedFee: null, agreedWage: null, lastFee: null, lastWage: null,
      msg: `${seller.shortName} are willing to listen to offers for ${p.name}.`,
      tone: 'info',
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
        <div class="neg-row"><span>Club asking price</span><span class="fw-700 text-gold">${money(neg.asking)}</span></div>
        <div class="neg-row"><span>Your transfer budget</span><span class="${budget >= neg.minFee ? '' : 'red'}">${money(budget)}</span></div>
        <div class="neg-field"><label>Your bid (£m)</label>
          <input id="neg-input" type="number" step="0.5" min="0" value="${N.lastFee != null ? N.lastFee : Math.min(budget, Math.round(p.value * 10) / 10)}"></div>
        <div class="neg-actions">
          <button class="btn-secondary" id="neg-walk">Walk Away</button>
          <button class="btn-primary" id="neg-submit">Submit Bid</button>
        </div>`;
    } else if (N.stage === 'terms') {
      body = `
        <div class="neg-row"><span>Agreed fee</span><span class="fw-700 text-accent">${money(N.agreedFee)}</span></div>
        <div class="neg-row"><span>Player wants</span><span class="fw-700 text-gold">${money(neg.wageDemand / 1000)}/wk</span></div>
        <div class="neg-field"><label>Your wage offer (£k/wk)</label>
          <input id="neg-input" type="number" step="5" min="0" value="${N.lastWage != null ? N.lastWage : p.wage}"></div>
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
        <div class="neg-msg ${N.tone}">${N.msg}</div>
        ${body}
      </div>`);

    const submit = $('neg-submit'), walk = $('neg-walk'), input = $('neg-input');
    if (walk) walk.addEventListener('click', () => { ui.negotiation = null; closeModal(); notify('You walked away from the table.', 'info'); });
    if (submit) submit.addEventListener('click', () => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) return notify('Enter a valid amount.', 'error');
      if (N.stage === 'fee') handleFeeOffer(val); else handleWageOffer(val);
    });
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && submit) submit.click(); });
  }

  function handleFeeOffer(offer) {
    const N = ui.negotiation, seller = gameState.clubs[N.clubId];
    N.lastFee = offer;
    if (offer > gameState.myClub.budget) {
      N.msg = `You can't afford a ${money(offer)} bid — budget is ${money(gameState.myClub.budget)}.`; N.tone = 'bad';
      return renderNegotiation();
    }
    const r = ENGINE.evaluateFeeOffer(N.neg, offer);
    if (r.decision === 'accept') { N.agreedFee = offer; N.stage = 'terms'; N.msg = `${seller.shortName} accept ${money(offer)}! Now agree personal terms with the player.`; N.tone = 'good'; }
    else if (r.decision === 'counter') { N.msg = `${seller.shortName} reject ${money(offer)}, but would accept ${money(r.counter)}.`; N.tone = 'info'; }
    else if (r.decision === 'reject') { N.msg = `${seller.shortName} dismiss your ${money(offer)} bid as far too low.`; N.tone = 'bad'; }
    else { ui.negotiation = null; closeModal(); return notify(`${seller.shortName} have ended negotiations.`, 'warning'); }
    renderNegotiation();
  }

  function handleWageOffer(offer) {
    const N = ui.negotiation, seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    N.lastWage = offer;
    const r = ENGINE.evaluateWageOffer(N.neg, offer);
    if (r.decision === 'accept') { N.agreedWage = offer; return completeTransfer(); }
    else if (r.decision === 'counter') { N.msg = `${p.name} rejects ${money(offer / 1000)}/wk but would sign for ${money(N.neg.wageDemand / 1000)}/wk.`; N.tone = 'info'; }
    else if (r.decision === 'reject') { N.msg = `${p.name} is insulted by an offer of just ${money(offer / 1000)}/wk.`; N.tone = 'bad'; }
    else { ui.negotiation = null; closeModal(); return notify(`${p.name} rejected your contract terms.`, 'warning'); }
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
    p.contract = rand(3, 5);
    gameState.myClub.players.push(p);
    gameState.myClub.budget = Math.round((gameState.myClub.budget - N.agreedFee) * 10) / 10;
    gameState.market = (gameState.market || []).filter(x => x.id !== N.playerId);
    gameState.transferLog.unshift({ in: true, name: p.name, fee: N.agreedFee });
    notify(`✍️ Signed ${p.name} for ${money(N.agreedFee)} on ${money(N.agreedWage / 1000)}/wk!`, 'success');
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
    if (gameState.tactics.lineup.length < 11) gameState.tactics.lineup = autoPickXI(gameState.myClub, gameState.tactics.formation);
    gameState.transferLog.unshift({ in: false, name: p.name, fee: p.value });
    notify(`Sold ${p.name} for ${money(p.value)}.`, 'success');
    updateSidebar();
    renderTransfers($('main-content'));
  }

  /* ---------------------------------------------
     EUROPEAN
     --------------------------------------------- */
  function renderEuropean(m) {
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
        ${comp.winner ? `<div class="knockout-round" style="text-align:center"><div class="knockout-round-title">🏆 Winner</div><div class="stat-big" style="font-size:24px">${esc(gameState.clubs[comp.winner].name)}</div></div>` : ''}
      </div>`;
    }

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">European Competitions</div>
        <div class="view-subtitle">${gameState.myEuropeanComp ? 'You are in the ' + gameState.european[gameState.myEuropeanComp].name : 'Not qualified for Europe this season'}</div></div></div>
      <div class="table-tabs">${Object.keys(gameState.european).map(k =>
        `<button class="transfer-tab ${k===tab?'active':''}" data-e="${k}">${gameState.european[k].name}</button>`).join('')}</div>
      ${body}`;

    m.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { ui.euroTab = b.dataset.e; renderEuropean(m); }));
  }
  function noEuro() { return `<div class="view-header"><div class="view-title">European Competitions</div></div><div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-text">No European competitions configured.</div></div>`; }
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
    let p = null;
    for (const cid in gameState.clubs) { const f = gameState.clubs[cid].players.find(x => x.id === playerId); if (f) { p = f; break; } }
    if (!p) return;
    const isGK = p.pos === 'GK';
    const attrs = isGK
      ? [['Reflexes', p.attrs.gkReflexes], ['Positioning', p.attrs.gkPositioning], ['Passing', p.attrs.passing], ['Physical', p.attrs.physical], ['Pace', p.attrs.pace]]
      : [['Pace', p.attrs.pace], ['Shooting', p.attrs.shooting], ['Passing', p.attrs.passing], ['Dribbling', p.attrs.dribbling], ['Defending', p.attrs.defending], ['Physical', p.attrs.physical]];

    showModal(`
      <div class="player-modal">
        <div class="pm-header">
          <div class="pm-avatar" style="background:${hex(gameState.myClub.color)};color:${textOn(gameState.myClub.color)}">${DATA.getInitials(p.name)}</div>
          <div class="pm-info"><h2>${esc(p.name)}</h2><p>${esc(p.nationality)} · Age ${p.age}</p>
            <div class="pm-badges"><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span></div></div>
        </div>
        <div class="pm-stats-grid">
          <div class="pm-stat"><span class="pm-stat-name">Value</span><span class="pm-stat-val">${money(p.value)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Wage</span><span class="pm-stat-val">${money(p.wage)}/wk</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Potential</span><span class="pm-stat-val">${p.pot}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Contract</span><span class="pm-stat-val">${p.contract}y</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${p.goals}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${p.assists}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${p.appearances}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Morale</span><span class="pm-stat-val">${p.morale}%</span></div>
        </div>
        <div class="pm-attr-bar-list">${attrs.map(([n, v]) => `
          <div class="pm-attr-row"><span class="pm-attr-label">${n}</span>
            <div class="pm-attr-track"><div class="pm-attr-fill ${attrClass(v)}" style="width:${v}%"></div></div>
            <span class="pm-attr-val">${v}</span></div>`).join('')}</div>
      </div>`);
  }

  /* =============================================
     MATCH FLOW
     ============================================= */
  function playNextMatch() {
    const fixture = ENGINE.getNextFixture(gameState);
    if (!fixture) return;
    const home = gameState.clubs[fixture.home], away = gameState.clubs[fixture.away];
    const myIsHome = fixture.home === gameState.myClubId;
    const homeFormation = myIsHome ? gameState.tactics.formation : '4-3-3';
    const awayFormation = myIsHome ? '4-3-3' : gameState.tactics.formation;
    const homeXI = myIsHome ? gameState.tactics.lineup : autoPickXI(home, homeFormation);
    const awayXI = myIsHome ? autoPickXI(away, awayFormation) : gameState.tactics.lineup;
    const homeMentality = myIsHome ? gameState.tactics.mentality : 'balanced';
    const awayMentality = myIsHome ? 'balanced' : gameState.tactics.mentality;
    const result = ENGINE.simulateMatch(home, away, { homeXI, awayXI, homeMentality, awayMentality });
    ui.match = {
      fixture, home, away, myIsHome, result, homeFormation, awayFormation,
      homeXI, awayXI,
      sim: { min: 0, idx: 0, hs: 0, as: 0, swapped: false },
      simTimer: null, players: []
    };

    $('match-home-name').textContent = home.shortName;
    $('match-away-name').textContent = away.shortName;
    setBadge('match-home-badge', home);
    setBadge('match-away-badge', away);
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
    $('btn-simulate').disabled = false;
    running = false;
    initPlayerDots();
    resetBall();
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
    const depth = slot.y / 100;
    const width = slot.x / 100;
    if (isHome) {
      return { bx: 5 + depth * 42, by: 8 + width * 84 };
    } else {
      return { bx: 95 - depth * 42, by: 8 + (1 - width) * 84 };
    }
  }

  function initPlayerDots() {
    const container = $('pitch-players');
    if (!container) return;
    container.innerHTML = '';
    ui.match.players = [];
    const m = ui.match;
    const homeColor = teamDotColor(m.home, null);
    const awayColor = teamDotColor(m.away, m.home);
    const homeSlots = (DATA.FORMATIONS[m.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
    const awaySlots = (DATA.FORMATIONS[m.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;

    const lblHome = $('pitch-team-label-home');
    const lblAway = $('pitch-team-label-away');
    if (lblHome) lblHome.textContent = m.home.shortName;
    if (lblAway) lblAway.textContent = m.away.shortName;

    const addDots = (slots, xi, club, color, isHome) => {
      slots.forEach((slot, i) => {
        const pid = xi ? xi[i] : null;
        const player = pid ? club.players.find(p => p.id === pid) : null;
        const name = player ? shortName(player.name) : '';
        const pos = slotToXY(slot, isHome);

        const el = document.createElement('div');
        el.className = 'player-dot';
        el.innerHTML = `<div class="dot-circle" style="background:${color}"></div><div class="dot-name">${esc(name)}</div>`;
        el.style.left = pos.bx + '%';
        el.style.top  = pos.by + '%';
        container.appendChild(el);

        ui.match.players.push({ el, bx: pos.bx, by: pos.by, slot, slotIdx: i, isHome });
      });
    };

    addDots(homeSlots, m.homeXI, m.home, homeColor, true);
    addDots(awaySlots, m.awayXI, m.away, awayColor, false);
  }

  function updatePlayerDots(tickMs) {
    if (!ui.match?.players?.length) return;
    const mag  = tickMs <= 1200 ? 7 : tickMs <= 2000 ? 4 : 2;
    const tSec = (tickMs * 0.85 / 1000).toFixed(2);
    ui.match.players.forEach(p => {
      const tx = clamp(p.bx + (Math.random() - 0.5) * mag * 2, 5, 95);
      const ty = clamp(p.by + (Math.random() - 0.5) * mag,     5, 95);
      p.el.style.transition = `left ${tSec}s ease, top ${tSec}s ease`;
      p.el.style.left = tx + '%';
      p.el.style.top  = ty + '%';
    });
  }

  function swapSides() {
    if (!ui.match?.players) return;
    ui.match.sim.swapped = true;
    const lblHome = $('pitch-team-label-home');
    const lblAway = $('pitch-team-label-away');
    if (lblHome) lblHome.textContent = ui.match.away.shortName;
    if (lblAway) lblAway.textContent = ui.match.home.shortName;

    const homeSlots = (DATA.FORMATIONS[ui.match.homeFormation] || DATA.FORMATIONS['4-3-3']).positions;
    const awaySlots = (DATA.FORMATIONS[ui.match.awayFormation] || DATA.FORMATIONS['4-3-3']).positions;
    ui.match.players.forEach(p => {
      const slots = p.isHome ? homeSlots : awaySlots;
      const newPos = slotToXY(slots[p.slotIdx], !p.isHome);
      p.bx = newPos.bx; p.by = newPos.by;
      p.el.style.transition = 'left 2s ease, top 2s ease';
      p.el.style.left = newPos.bx + '%';
      p.el.style.top  = newPos.by + '%';
    });
  }

  function resetBall() {
    const b = $('pitch-ball');
    if (!b) return;
    b.style.transition = 'none';
    b.style.left = '50%'; b.style.top = '50%';
    setTimeout(() => { b.style.transition = ''; }, 60);
  }

  function moveBall(events, tickMs) {
    const b = $('pitch-ball');
    if (!b) return;
    const tSec = (tickMs * 0.8 / 1000).toFixed(2);
    b.style.transition = `left ${tSec}s ease, top ${tSec}s ease`;
    const swapped = ui.match.sim.swapped;
    const goalEv = events.find(e => e.type === 'goal');
    let x, y;
    if (goalEv) {
      const homeScored = goalEv.team === 'home';
      const attacksRight = homeScored ? !swapped : swapped;
      x = attacksRight ? 90 + Math.random() * 5 : 5 + Math.random() * 5;
      y = 35 + Math.random() * 30;
    } else {
      x = 20 + Math.random() * 60;
      y = 15 + Math.random() * 70;
    }
    b.style.left = x + '%'; b.style.top = y + '%';
  }

  function showCard(events) {
    const cardEv = events.find(e => e.type === 'yellow' || e.type === 'red');
    if (!cardEv) return;
    const card = $('pitch-card');
    if (!card) return;
    const swapped = ui.match.sim.swapped;
    const homeLeft = !swapped;
    const x = (cardEv.team === 'home') === homeLeft ? 15 + Math.random() * 30 : 55 + Math.random() * 30;
    const y = 15 + Math.random() * 70;
    card.style.left = x + '%'; card.style.top = y + '%';
    card.className = '';
    card.offsetHeight;
    card.className = 'card-visible card-' + cardEv.type;
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease'; card.style.opacity = '0';
      setTimeout(() => { card.className = ''; card.style.opacity = ''; card.style.transition = ''; }, 500);
    }, 2200);
  }

  /* ============ COMMENTARY ============ */
  const CMNT_QUIET = [
    'Play continues in midfield.','Possession changes hands.',
    'Patient build-up from the back.','A long ball is headed clear.',
    'The keeper collects with ease.','Midfield battle in the centre.',
    'Both teams probing for an opening.','A foul out near the touchline.',
    'The crowd urges their team forward.','Nothing clear-cut from either side.',
    'A corner cleared at the near post.','The referee waves play on.',
    'Comfortable passing in midfield.','A throw-in in the middle third.',
  ];
  const CMNT_PRESS = [
    'Great save from the keeper!','Off the post! So close!',
    'A thunderous shot — just over the bar!','The striker fires wide!',
    'Powerful header — straight at the keeper!','Chance! Not taken!',
    'A dangerous cross headed out for a corner!',
  ];
  const CMNT_BUILD = [
    'Things are getting exciting here...','Tension building in the stadium!',
    'The crowd can sense something is coming!','Both benches are on their feet!',
  ];
  function addCommentary(min, events) {
    if (events.length > 0) {
      events.forEach(e => {
        const club = e.team === 'home' ? ui.match.home : ui.match.away;
        let text = '';
        if (e.type === 'goal') {
          const s = ['GOAL! What a finish!','GOAL! Back of the net!','GOAL! The keeper had no chance!','GOAL! Unstoppable!'];
          text = s[rand(0, s.length - 1)] + (e.player ? ` ${esc(e.player.name)} scores for ${esc(club.shortName)}!` : '');
        } else if (e.type === 'yellow') {
          text = `Booked! ${e.player ? esc(e.player.name) + ' (' + esc(club.shortName) + ')' : esc(club.shortName)} is shown a yellow card.`;
        } else if (e.type === 'red') {
          text = `RED CARD! ${e.player ? esc(e.player.name) : 'A player'} is off! ${esc(club.shortName)} down to ten men!`;
        }
        if (!text) return;
        const div = document.createElement('div');
        div.className = 'match-event commentary ' + e.type;
        div.innerHTML = `<span class="event-min">${min}'</span><span class="event-desc">${text}</span>`;
        $('match-events-list').prepend(div);
      });
    } else if (min % 3 === 0) {
      const pool = Math.random() < 0.22 ? CMNT_PRESS : CMNT_QUIET;
      const div = document.createElement('div');
      div.className = 'match-event commentary';
      div.innerHTML = `<span class="event-min">${min}'</span><span class="event-desc">${pool[rand(0, pool.length - 1)]}</span>`;
      $('match-events-list').prepend(div);
    }
  }
  function addBuildUp(min) {
    const div = document.createElement('div');
    div.className = 'match-event commentary';
    div.innerHTML = `<span class="event-min">${min}'</span><span class="event-desc">${CMNT_BUILD[rand(0, CMNT_BUILD.length - 1)]}</span>`;
    $('match-events-list').prepend(div);
  }

  /* ============ SIMULATION LOOP ============ */
  function runSimulation() {
    if (running || !ui.match) return;
    running = true;
    $('btn-simulate').disabled = true;
    $('match-status').textContent = 'LIVE';

    const ev = ui.match.result.events;
    const sim = ui.match.sim;

    function minsToNextEvent() {
      for (let i = sim.idx; i < ev.length; i++) {
        if (ev[i].min > sim.min) return ev[i].min - sim.min;
      }
      return 999;
    }

    function getDelay() {
      const m = minsToNextEvent();
      if (m <= 1) return 3000;
      if (m <= 2) return 1800;
      return 1000;
    }

    function tick() {
      if (!running || !ui.match) return;
      sim.min++;
      const eventsThisMin = [];
      while (sim.idx < ev.length && ev[sim.idx].min <= sim.min) {
        const e = ev[sim.idx++];
        if (e.type === 'goal') { if (e.team === 'home') sim.hs++; else sim.as++; }
        addMatchEvent(e);
        eventsThisMin.push(e);
      }

      $('match-score').textContent = `${sim.hs} – ${sim.as}`;
      $('match-time').textContent = sim.min + "'";

      eventsThisMin.forEach(e => addPitchDot(e));
      if (eventsThisMin.some(e => e.type === 'yellow' || e.type === 'red')) showCard(eventsThisMin);
      addCommentary(sim.min, eventsThisMin);

      let bonus = 0;
      if (eventsThisMin.some(e => e.type === 'goal')) bonus = 2500;
      else if (eventsThisMin.some(e => e.type === 'red')) bonus = 1800;
      else if (eventsThisMin.some(e => e.type === 'yellow')) bonus = 1000;

      const nextDelay = getDelay();
      moveBall(eventsThisMin, nextDelay);
      updatePlayerDots(nextDelay);

      if (eventsThisMin.length === 0 && minsToNextEvent() === 1) addBuildUp(sim.min);

      if (sim.min === 45) {
        running = false;
        ui.match.simTimer = null;
        $('match-status').textContent = 'HALF TIME';
        $('match-time').textContent = "45'";
        $('btn-halftime').classList.remove('hidden');
        setTimeout(swapSides, 800);
        return;
      }
      if (sim.min >= 90) {
        ui.match.simTimer = null;
        finishMatch();
        return;
      }
      ui.match.simTimer = setTimeout(tick, nextDelay + bonus);
    }

    ui.match.simTimer = setTimeout(tick, getDelay());
  }

  function addMatchEvent(e) {
    const club = e.team === 'home' ? ui.match.home : ui.match.away;
    const icon = e.type === 'goal' ? '⚽' : e.type === 'yellow' ? '🟨' : e.type === 'red' ? '🟥' : '🔁';
    let desc = e.player ? esc(e.player.name) : '';
    if (e.type === 'goal' && e.assist) desc += ` <span class="text-muted">(${esc(e.assist.name)})</span>`;
    const div = document.createElement('div');
    div.className = 'match-event ' + e.type;
    div.innerHTML = `<span class="event-min">${e.min}'</span><span class="event-icon">${icon}</span><span class="event-desc">${desc}</span><span class="event-team">${esc(club.shortName)}</span>`;
    $('match-events-list').prepend(div);
  }
  function addPitchDot(e) {
    if (!['goal','yellow','red'].includes(e.type)) return;
    const dot = document.createElement('div');
    dot.className = 'pitch-event-dot ' + e.type;
    const swapped = ui.match.sim.swapped;
    const homeLeft = !swapped;
    const x = (e.team === 'home') === homeLeft ? rand(10, 45) : rand(55, 90);
    const y = rand(10, 90);
    dot.style.left = x + '%'; dot.style.top = y + '%';
    $('pitch-events').appendChild(dot);
  }

  function finishMatch() {
    running = false;
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
      ? goals.map(g => `<div class="result-scorer-item"><span>${g.min}'</span><span class="scorer-name">${esc(g.player.name)}</span><span class="scorer-team">${esc((g.team === 'home' ? home : away).shortName)}</span></div>`).join('')
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
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (comp.stage === 'league') {
          // Any fixtures still unplayed up to date (safety net — engine handles most)
          comp.fixtures.filter(f => !f.played && f.date <= date).forEach(f => simEuroFixture(comp, f));
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
      if (comp.winner === myId) notify(`🏆 You won the ${comp.name}!`, 'success');
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
    if (myIn) notify(cup.winner === myId ? `🏆 You won the ${cup.name}!` : `${cup.name}: knocked out.`, cup.winner === myId ? 'success' : 'info');
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

    const table = ENGINE.getLeagueTable(gameState, gameState.myClub.league);
    const pos = ENGINE.getMyPosition(gameState);
    const champ = table[0];
    const topScorer = [...gameState.myClub.players].sort((a, b) => b.goals - a.goals)[0];
    const league = DATA.LEAGUES[gameState.myClub.league];
    let outcome = '';
    if (pos === 1) outcome = `🏆 Champions of the ${league.name}!`;
    else if (pos <= league.championsLeague) outcome = '⭐ Qualified for the Champions League!';
    else if (pos <= league.championsLeague + league.europaLeague) outcome = '🌟 Qualified for the Europa League!';
    else if (pos <= league.championsLeague + league.europaLeague + (league.conferenceLeague || 0)) outcome = '✨ Qualified for the Conference League!';
    else if (pos > table.length - league.relegation) outcome = '⚠️ Relegated!';
    else outcome = 'A solid mid-table finish.';

    showModal(`
      <div style="text-align:center">
        <h2 style="font-size:22px;margin-bottom:4px">Season ${gameState.season} Complete</h2>
        <p class="text-muted" style="margin-bottom:18px">${esc(gameState.myClub.name)}</p>
        <div class="stat-big" style="font-size:40px;margin-bottom:6px">${ordinal(pos)}</div>
        <p class="text-accent fw-700" style="margin-bottom:16px">${outcome}</p>
        <div class="pm-stats-grid" style="text-align:left;margin-bottom:18px">
          <div class="pm-stat"><span class="pm-stat-name">Champions</span><span class="pm-stat-val">${esc(champ.shortName)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Points</span><span class="pm-stat-val">${gameState.myClub.tableStats.points}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Top Scorer</span><span class="pm-stat-val">${topScorer ? esc(topScorer.lastName) : '—'}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${topScorer ? topScorer.goals : 0}</span></div>
        </div>
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
        if (p.age <= 23 && p.ovr < p.pot) p.ovr = Math.min(p.pot, p.ovr + rand(0, 3));
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
    gameState.tactics.lineup = autoPickXI(gameState.myClub, gameState.tactics.formation);
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';

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
  function autoSave() { if (gameState) writeSave('auto', 'Autosave'); }
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
    showScreen('game');
    updateSidebar();
    renderView('dashboard');
    notify('Game loaded.', 'success');
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
    let html = `<div class="player-modal"><h2 style="margin-bottom:6px">${mode === 'save' ? '💾 Save Game' : '📂 Load Game'}</h2>`;
    html += `<p class="text-muted" style="font-size:11px;margin-bottom:12px">${manualCount}/${MAX_SLOTS} save slots used</p>`;
    if (mode === 'save') {
      html += manualCount < MAX_SLOTS
        ? `<button class="btn-primary" id="save-new" style="width:100%;margin-bottom:12px">＋ New Save Slot</button>`
        : `<p class="text-gold" style="font-size:11px;margin-bottom:12px">All ${MAX_SLOTS} slots full — overwrite or delete one below.</p>`;
    }
    if (!slots.length) {
      html += `<div class="empty-state"><div class="empty-state-icon">💾</div><div class="empty-state-text">No saved games yet.</div></div>`;
    } else {
      html += slots.map(s => `
        <div class="inbox-item">
          <div class="inbox-icon">${s.id === 'auto' ? '⏱️' : '🎮'}</div>
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
