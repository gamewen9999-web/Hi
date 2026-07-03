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
    seasonReviewTab: null,
    tacticsTab: 'tactics',
    tacSquadFilter: 'all',
    tacSquadSort: 'ovr',
    facilitiesTab: 'academy',
  };

  const SCOUT_TIERS = [
    { level: 1, label: 'Basic',    hireCost: 0.2, weeklyWage:  5, reportEvery: 6, findMin: 1, findMax: 1, ovrNoise: 10, potNoise: 15, desc: 'Limited range, rough assessments' },
    { level: 2, label: 'Standard', hireCost: 0.5, weeklyWage: 12, reportEvery: 5, findMin: 1, findMax: 2, ovrNoise:  4, potNoise:  6, desc: 'Good coverage, reliable reports' },
    { level: 3, label: 'Elite',    hireCost: 1.2, weeklyWage: 25, reportEvery: 4, findMin: 2, findMax: 3, ovrNoise:  1, potNoise:  2, desc: 'Global reach, precise assessments' },
    // Appended (not inserted before Basic) so existing saves' level 1-3 scouts keep their tier; hire UI sorts by cost.
    { level: 4, label: 'Trainee',   hireCost: 0.05, weeklyWage: 2, reportEvery: 9, findMin: 0, findMax: 1, ovrNoise: 18, potNoise: 25, desc: 'Inexperienced, local contacts only — sometimes finds nothing' },
    { level: 5, label: 'Part-Time', hireCost: 0.1,  weeklyWage: 3, reportEvery: 7, findMin: 1, findMax: 1, ovrNoise: 13, potNoise: 19, desc: 'Works limited hours, occasional rough leads' },
  ];

  const COUNTRY_LEAGUES = [
    { country: 'England', leagues: ['premier_league','championship','league_one','league_two','national_league'] },
    { country: 'Spain',   leagues: ['la_liga'] },
    { country: 'Germany', leagues: ['bundesliga'] },
    { country: 'Italy',   leagues: ['serie_a'] },
    { country: 'France',  leagues: ['ligue_1'] },
  ];

  const INJURY_TYPES = ENGINE.INJURY_TYPES;
  const FITNESS_DRAIN_STARTER = 13;   // fitness lost per match for starters
  const FITNESS_DRAIN_SUB     = 7;    // fitness lost for players who came on as subs
  const FITNESS_RECOVER_REST  = 5;    // fitness gained by bench players per match
  const FITNESS_RECOVER_WEEK  = 10;   // fitness recovered per week of rest

  /* ----- FINANCIAL CONSTANTS ----- */
  // TV broadcast: per-league equal share from data.js tvEqualShare, with level-based fallback.
  const FIN_TV_LEVEL_FALLBACK = [0, 110, 9.5, 1.9, 1.3, 0.5];
  function leagueTV(club) {
    return DATA.LEAGUES[club.league]?.tvEqualShare ?? FIN_TV_LEVEL_FALLBACK[leagueLevel(club)] ?? 0;
  }
  const FIN_MATCHDAY_LEAGUE = [0, 32, 9, 2.8, 1.1, 0.35]; // £m/season gate income at standard prices, by league level
  const FIN_STADIUM_MULT = [0, 0.18, 0.45, 1.0, 1.60, 2.10]; // fanbase/stadium size multiplier by club rep
  const FIN_INIT_BAL    = [0,  0.8,  4,  12,   40, 100];  // starting bank balance £m (NL reduced to £800k — more realistic)
  const FIN_BASE_GRANT  = [0,  0.3,  2,   8,   30,  80];  // base board transfer grant £m
  // Merchandise/club shop income: replica kits, scarves, badges etc.
  // Varies weekly (seasonal demand, cup runs, transfer buzz) and gets a boost from good form.
  function weeklyMerchandise(club) {
    const base = matchdayBase(club) * 0.22 / 52;
    const formBonus = (club.form || []).slice(-3).filter(f => f === 'W').length * 0.06; // up to +18% on 3W run
    const variance = 0.70 + Math.random() * 0.60; // 70%–130% weekly swing (scarves sell out, quiet weeks, etc.)
    return base * (1 + formBonus) * variance;
  }
  // Merit payments: end-of-season TV merit money by final league position (level 1 values, scaled down per level)
  // PL winner ~£176m total TV (110 equal + 66 merit), bottom ~£115m — matches real distributions
  const PRIZE_BY_POS    = [66,62,58,54,50,47,44,41,38,35,32,29,26,23,20,17,14,11,8,5];
  const PRIZE_LEVEL_MULT= [1, 0.06, 0.015, 0.005, 0.0012];
  // Ticket pricing tiers. attEffect = attendance change; fans in lower leagues are more price-sensitive.
  const TICKET_TIERS = {
    cheap:    { label: 'Cheap',    mult: 0.75, attEffect: +0.10, desc: 'Low prices — packed stands, less income, fans love it.' },
    standard: { label: 'Standard', mult: 1.00, attEffect:  0,    desc: 'Balanced pricing — steady income and attendance.' },
    high:     { label: 'High',     mult: 1.25, attEffect: -0.06, desc: 'Pricey — more income per fan, some empty seats.' },
    premium:  { label: 'Premium',  mult: 1.50, attEffect: -0.14, desc: 'Top prices — maximum yield, attendance suffers (risky in lower leagues).' },
  };
  function ticketTier(fin) {
    const key = fin?.ticketPricing === 'budget' ? 'cheap' : (fin?.ticketPricing || 'standard');
    return TICKET_TIERS[key] ? { key, ...TICKET_TIERS[key] } : { key: 'standard', ...TICKET_TIERS.standard };
  }
  function leagueLevel(club) { return DATA.LEAGUES[club.league]?.level || 1; }
  // Effective matchday revenue multiplier for a tier: price × attendance response (stronger in lower leagues)
  function ticketRevenueMult(tierKey, level) {
    const t = TICKET_TIERS[tierKey] || TICKET_TIERS.standard;
    const elasticity = 1 + (level - 1) * 0.35;
    return t.mult * Math.max(0.4, 1 + t.attEffect * elasticity);
  }
  // Zone definitions: id → capacity share (must sum to 1)
  const STADIUM_ZONE_DEFS = [
    { id: 'north',   label: 'North Stand',   desc: 'Home End / Kop',           cap: 0.23 },
    { id: 'south',   label: 'South Stand',   desc: 'Away End',                  cap: 0.15, defaultPrice: 'cheap' },
    { id: 'east',    label: 'Main Stand',    desc: 'Corporate & Premium seats', cap: 0.30 },
    { id: 'west',    label: 'West Stand',    desc: 'Family & General Admission', cap: 0.22 },
    { id: 'corners', label: 'Corners',       desc: 'Corner block seating',      cap: 0.10 },
  ];

  function zoneDefaultPrices() {
    const out = {};
    STADIUM_ZONE_DEFS.forEach(z => { out[z.id] = z.defaultPrice || 'standard'; });
    return out;
  }

  function effectivePriceMult(club, fin, level) {
    const zones = club.stadiumZones;
    if (!zones) return ticketRevenueMult(ticketTier(fin).key, level);
    let weighted = 0, totalCap = 0;
    STADIUM_ZONE_DEFS.forEach(z => {
      weighted += z.cap * ticketRevenueMult(zones[z.id] || 'standard', level);
      totalCap += z.cap;
    });
    return totalCap > 0 ? weighted / totalCap : ticketRevenueMult('standard', level);
  }

  function matchdayBase(club) { // £m per season at standard prices
    const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
    return FIN_MATCHDAY_LEAGUE[leagueLevel(club)] * FIN_STADIUM_MULT[rep];
  }
  const SPONSORS = [
    { tier:1, names:['RegioMedia','CityFit Gym','LocalBank','TownBrew','MetroGas','CoastAir'] },
    { tier:2, names:['SportsBet Online','NationWide Auto','TelecomPlus','Premier Foods','BritAir','HealthFirst'] },
    { tier:3, names:['GlobalTech Corp','MegaAuto Group','Pinnacle Finance','CryptoX Global','AeroLine Intl','Nexus Energy'] },
  ];

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
    const r = Math.round((rep ?? 1) * 2) / 2;
    const full = Math.floor(r);
    const hasHalf = (r % 1) === 0.5;
    return [1,2,3,4,5].map(i => {
      const cls = i <= full ? 'lit' : (hasHalf && i === full + 1 ? 'half' : '');
      return `<span class="rep-star${cls ? ' '+cls : ''}">★</span>`;
    }).join('');
  }
  // Club prestige ranges 0-5 (0 = no reputation at all) and moves in tenths internally;
  // repStars() rounds that to the nearest half-star for display.
  function clampRep(v) { return Math.max(0, Math.min(5, Math.round(v * 10) / 10)); }

  function money(m) {
    if (m == null) return '£0';
    const abs = Math.abs(m);
    if (abs >= 1) return '£' + (Math.round(m * 10) / 10) + 'm';
    const k = m * 1000, ak = Math.abs(k);
    if (ak >= 100) return '£' + Math.round(k) + 'k';
    if (ak >= 1)   return '£' + (Math.round(k * 10) / 10) + 'k';
    return '£' + Math.round(k * 1000);
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
  function closeModal() {
    $('modal-overlay').classList.add('hidden');
    if (ui.match?.resumeOnModalClose) {
      ui.match.resumeOnModalClose = false;
      runSimulation();
    }
  }
  function pauseForModal() {
    if (!running || !ui.match) return;
    running = false;
    if (ui.match.simTimer) { clearTimeout(ui.match.simTimer); ui.match.simTimer = null; }
    $('btn-pause').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg> Resume';
    $('match-status').textContent = 'PAUSED';
    ui.match.resumeOnModalClose = true;
  }

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
        <div class="club-card-stats">
          <span class="club-card-stat"><span class="ccs-label">OVR</span><span class="ccs-val">${c.sqRating}</span></span>
          <span class="club-card-stat"><span class="ccs-label">Wage</span><span class="ccs-val">${money(c.wage)}/wk</span></span>
        </div>
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
    $('confirm-rep-stars').innerHTML = repStars(c.rep);
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
      currentDate: new Date(2025, 6, 1), // start in July pre-season
      fixtures: [],
      transferLog: [],
      season: 1,
      preseason: true,
      sacked: false,
      pendingOffers: [],
      negotiations: [],
      tactics: { formation: '4-3-3', mentality: 'balanced', pressing: 'medium', style: 'balanced', lineup: [], customFormation: null, excluded: [],
                 cornerTaking: 'far-post', freeKick: 'cross', cornerDefense: 'mixed',
                 timeWasting: false, playSetPieces: false },
      scouts: [],
      scoutBlocked: {},
      inbox: [],
      finances: null,
      freeAgents: [],
      preContracts: [],
      transferNews: [],
      staff: { coaches: [] }, // { id, role, name, level, weeklyWage }
    };
    gameState.finances = initFinances(clubs[clubId]);
    // Seed two identical entries so the graph always has a flat baseline from day 1.
    const _t0 = gameState.currentDate.getTime();
    gameState.finances.balanceHistory = [
      { t: _t0 - 7 * 24 * 3600 * 1000, v: gameState.finances.balance },
      { t: _t0, v: gameState.finances.balance },
    ];

    // Seed initial facility state based on club reputation
    Object.values(gameState.clubs).forEach(c => {
      const r = Math.round(c.rep || 3);
      if (!c.trainingUpgrades) c.trainingUpgrades = {};
      if (!c.renovations)      c.renovations      = {};
      if (!c.stadiumStands)    c.stadiumStands    = {};
      // Training upgrades pre-built by rep tier (max 7/10 so rep5 starts ~70/100)
      const TRN_KEYS = ['indoor_pitch','video_suite','altitude_chamber','sprint_track','gym_upgrade','nutrition_lab','biometric_lab','hydrotherapy','tactics_room','warm_weather'];
      const trCount  = [0,1,2,4,6,7][r] || 0;
      TRN_KEYS.slice(0, trCount).forEach(k => { c.trainingUpgrades[k] = true; });
      // Stadium renovations — always reset on new game, max 2 for rep5
      const RENO_KEYS = ['floodlights','vip_boxes','family_zone','pitch_heating','big_screen','concourse'];
      c.renovations = {};
      const renoCount = [0,0,1,1,1,2][r] || 0;
      RENO_KEYS.slice(0, renoCount).forEach(k => { c.renovations[k] = true; });
      // Stands pre-built by rep — rep5 gets east+north+west tier2, south/corners only tier1
      c.stadiumStands = {};
      c.stadiumStands.east = { type: 'seated', tier: r >= 4 ? 2 : 1 };
      if (r >= 2) c.stadiumStands.north   = { type: 'seated', tier: r >= 5 ? 2 : 1 };
      if (r >= 3) c.stadiumStands.west    = { type: 'seated', tier: r >= 4 ? 2 : 1 };
      if (r >= 4) c.stadiumStands.south   = { type: 'seated', tier: 1 };
      if (r >= 4) c.stadiumStands.corners = { type: 'seated', tier: 1 };
      // Sync derived levels
      if (!c.facilities) c.facilities = { academy: r, stadium: r, training: r, rehab: r };
      const tProg = Math.min(100, Object.keys(c.trainingUpgrades).filter(k=>c.trainingUpgrades[k]).length * 10);
      c.facilities.training = Math.max(1, Math.min(5, Math.ceil(tProg/20)||1));
      const sProg = calcStadiumProgress(c);
      c.facilities.stadium  = Math.max(1, Math.min(5, Math.ceil(sProg/20)||1));
    });

    gameState.tactics.lineup = autoPickXI(gameState.myClub, gameState.tactics.formation);
    Object.values(gameState.clubs).forEach(c => {
      if (c.id !== clubId) c.lineup = autoPickXI(c, c.tactics.formation);
      recalcSqRating(c);
    });
    gameState.market = ENGINE.getTransferMarket(gameState);
    gameState.freeAgents = DATA.generateFreeAgents(14);
    ui.tableLeague = gameState.myClub.league;
    ui.euroTab = 'champions_league';

    initGameChrome();
    showScreen('game');
    updateSidebar();
    renderView('dashboard');
  }

  let chromeReady = false;
  let autoSaveInterval = null;
  let autoWriteInterval = null;
  let writeSavePending = false;
  function setAutoSaveRunning(on) {
    clearInterval(autoSaveInterval);
    clearInterval(autoWriteInterval);
    if (on) {
      // Update matchSave in memory every second — cheap, no I/O.
      autoSaveInterval = setInterval(updateMatchSave, 1000);
      // Actually persist to localStorage every 10 seconds — deduped via writeSavePending flag.
      autoWriteInterval = setInterval(() => { if (gameState) writeSave(gameState.slotId || 'career_1', 'Autosave'); }, 10000);
    }
  }
  function updateMatchSave() {
    if (!gameState) return;
    if (ui.match && ui.match.sim && ui.match.sim.min > 0) {
      const mr = ui.match.result;
      gameState.matchSave = {
        homeId: ui.match.home.id, awayId: ui.match.away.id,
        myIsHome: ui.match.myIsHome,
        homeFormation: ui.match.homeFormation, awayFormation: ui.match.awayFormation,
        homeXI: ui.match.homeXI, awayXI: ui.match.awayXI,
        currentHomeXI: ui.match.currentHomeXI, currentAwayXI: ui.match.currentAwayXI,
        currentTactics: ui.match.currentTactics,
        subsUsed: ui.match.subsUsed, subsMax: ui.match.subsMax,
        result: {
          homeScore: mr.homeScore, awayScore: mr.awayScore,
          matchEvents: mr.events,
          stats: mr.stats,
          homeRatings: mr.homeRatings, awayRatings: mr.awayRatings,
          commentary: mr.commentary,
        },
        sim: { ...ui.match.sim },
        gamePhase: ui.match.gamePhase || 1,
        atHalfTime: ui.match.sim.min === 45 + ui.match.sim.stoppage1,
        fixtureType: ui.match.fixture?.type || 'league',
      };
    } else {
      delete gameState.matchSave;
    }
  }
  function writeSaveImmediate() {
    if (!gameState) return;
    try {
      const json = JSON.stringify(gameState, saveReplacer);
      const payload = LZString.compressToUTF16(json);
      localStorage.setItem(SLOT_PREFIX + (gameState.slotId || 'career_1'), payload);
      const idx = readIndex(); idx[gameState.slotId || 'career_1'] = saveMeta('Autosave'); writeIndex(idx);
    } catch (e) {}
  }
  function emergencySave() {
    if (!gameState) return;
    updateMatchSave();
    writeSaveImmediate();
  }
  function initGameChrome() {
    setAutoSaveRunning(true);
    if (!chromeReady) {
      window.addEventListener('beforeunload', emergencySave);
      document.addEventListener('visibilitychange', () => { if (document.hidden) emergencySave(); });
      document.querySelectorAll('.snav-btn').forEach(btn => {
        btn.addEventListener('click', () => renderView(btn.dataset.view));
      });
      $('modal-close').addEventListener('click', closeModal);
      $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });
      $('btn-simulate').addEventListener('click', () => runSimulation());
      $('btn-halftime').addEventListener('click', () => {
        if (!ui.match) return;
        applyHalftimeChanges();
        $('halftime-panel').classList.add('hidden');
        $('match-events-inner').classList.remove('hidden');
        $('btn-halftime').classList.add('hidden');
        $('btn-pause').classList.remove('hidden');
        $('btn-speed').classList.remove('hidden');
        $('btn-subs').classList.remove('hidden');
        $('btn-tactics').classList.remove('hidden');
        running = false;
        runSimulation();
      });
      $('btn-subs').addEventListener('click', () => {
        if (!ui.match) return;
        pauseForModal();
        showSubsModal();
      });
      $('btn-tactics').addEventListener('click', () => {
        if (!ui.match) return;
        pauseForModal();
        showLiveTacticsModal();
      });
      $('btn-pause').addEventListener('click', () => {
        if (!ui.match) return;
        if (running) {
          running = false;
          if (ui.match.simTimer) { clearTimeout(ui.match.simTimer); ui.match.simTimer = null; }
          $('btn-pause').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg> Resume';
          $('match-status').textContent = 'PAUSED';
        } else {
          $('btn-pause').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor"/><rect x="6" y="1" width="3" height="8" fill="currentColor"/></svg> Pause';
          runSimulation();
        }
      });
      $('btn-speed').addEventListener('click', () => {
        if (!ui.match) return;
        ui.match.speed = ui.match.speed === 2 ? 1 : 2;
        $('btn-speed').textContent = ui.match.speed === 2 ? '1×' : '2×';
        $('btn-speed').classList.toggle('active', ui.match.speed === 2);
        if (ui.match.simTimer && ui.match.tick) {
          clearTimeout(ui.match.simTimer);
          ui.match.simTimer = setTimeout(ui.match.tick, ui.match.speed === 2 ? 500 : 1000);
        }
      });
      $('btn-continue-after-match').addEventListener('click', advanceAfterMatch);

      // Inject balance + board confidence into sidebar
      const sb = document.querySelector('.sidebar-bottom');
      const finInfo = document.createElement('div');
      finInfo.style.cssText = 'margin-bottom:6px';
      finInfo.innerHTML = `
        <div class="sb-budget-block"><span class="sb-budget-label">Club Balance</span><span id="sb-balance" class="sb-budget-val">—</span></div>
        <div class="sb-budget-block" style="margin-top:3px"><span class="sb-budget-label">Board Confidence</span><span id="sb-confidence" class="sb-budget-val" style="color:var(--accent-gold)">—</span></div>`;
      sb.insertBefore(finInfo, sb.firstChild);
      // Save / Main-menu controls
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
    $('sb-club-name').textContent = c.name;
    $('sb-league-name').textContent = DATA.LEAGUES[c.league].name;
    const col = hex(c.color);
    $('sb-badge').style.boxShadow = `0 4px 16px ${col}40`;
  }

  // Team OVR is the starting XI's average, not the whole squad — bench depth shouldn't
  // inflate or dilute it. Uses the manager's actual lineup for the user's club, and the
  // best XI for the club's default formation for everyone else.
  function recalcSqRating(club) {
    if (!club || !club.players || !club.players.length) return;
    let xi = (club.id === gameState.myClubId) ? gameState.tactics?.lineup : club.lineup;
    if (!xi || xi.length < 11) xi = autoPickXI(club, club.tactics?.formation || '4-3-3');
    const xiPlayers = xi.map(id => club.players.find(p => p.id === id)).filter(Boolean);
    const pool = xiPlayers.length === 11 ? xiPlayers : club.players;
    club.sqRating = Math.round(pool.reduce((s, p) => s + (p.ovr || 60), 0) / pool.length);
  }

  function updateSidebar() {
    const d = gameState.currentDate;
    $('sb-date').textContent = MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
    const pos = ENGINE.getMyPosition(gameState);
    $('sb-position').textContent = pos ? ordinal(pos) : '—';
    const fin = gameState.finances;
    const balEl = $('sb-balance');
    if (balEl && fin) {
      balEl.textContent = money(fin.balance);
      balEl.style.color = fin.balance >= 0 ? 'var(--accent)' : 'var(--accent-red)';
    }
    const hapEl = $('sb-confidence');
    if (hapEl && fin) {
      const h = fin.boardConfidence;
      hapEl.textContent = h + '%';
      hapEl.style.color = h >= 70 ? 'var(--accent)' : h >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)';
    }
  }

  function ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ---------------------------------------------
     LINEUP
     --------------------------------------------- */
  // Mirrors the same depth-based adjacency the match engine uses for the live OOP
  // penalty (ENGINE.oopFactor), so auto-picked lineups prefer the player the engine
  // will actually rate highest in that slot — e.g. a CDM beats a CAM for a CDM-ish
  // slot, instead of both scoring identically just for sharing the "MID" bucket.
  function posScore(playerPos, slotPos) {
    const gp = group(playerPos), gs = group(slotPos);
    if (gp === 'GK' || gs === 'GK') return gp === gs ? 100 : 0;
    return Math.round(ENGINE.oopFactor(playerPos, slotPos) * 100);
  }
  function activeTacticForm() {
    const tac = gameState.tactics;
    if (tac.formation === 'custom' && tac.customFormation) return tac.customFormation;
    return DATA.FORMATIONS[tac.formation] || DATA.FORMATIONS['4-3-3'];
  }

  function rearrangeXI(playerIds, formationKey) {
    const form = typeof formationKey === 'object'
      ? formationKey
      : (DATA.FORMATIONS[formationKey] || DATA.FORMATIONS['4-3-3']);
    const players = playerIds.map(id => gameState.myClub.players.find(p => p.id === id)).filter(Boolean);
    const used = new Set();
    const xi = [];
    form.positions.forEach(slot => {
      let best = null, bestScore = -1;
      players.forEach(p => {
        if (used.has(p.id)) return;
        const sc = posScore(p.pos, slot.pos) * 1000 + p.ovr;
        if (sc > bestScore) { bestScore = sc; best = p; }
      });
      if (best) { used.add(best.id); xi.push(best.id); }
    });
    return xi;
  }

  function autoPickXI(club, formationKey, excludedIds = []) {
    const form = typeof formationKey === 'object'
      ? formationKey
      : (DATA.FORMATIONS[formationKey] || DATA.FORMATIONS['4-3-3']);
    const injured = new Set(club.players.filter(p => p.injured).map(p => p.id));
    const excluded = new Set([...excludedIds, ...injured]);
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
        european: renderEuropean, finances: renderFinances, scout: renderScout, facilities: renderFacilities,
        season_review: renderSeasonReview,
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
    if (ui.seasonReview) { renderSeasonReview(m); return; }
    const club = gameState.myClub;
    const ts = club.tableStats;
    const pos = ENGINE.getMyPosition(gameState);
    const next = ENGINE.getNextFixture(gameState);

    if (gameState.preseason) {
      const d = gameState.currentDate;
      const seasonYear = 2025 + gameState.season - 1;
      const seasonStart = new Date(seasonYear, 7, 9);
      const daysLeft = Math.max(0, Math.round((seasonStart - d) / 86400000));
      const canStart = d >= seasonStart;
      const isSacked = gameState.sacked;
      const sackedBanner = isSacked ? `<div class="sacked-banner" style="margin-bottom:14px"><span class="sacked-banner-icon">✗</span><div><div class="sacked-banner-title">Contract Terminated</div><div class="sacked-banner-msg">You have been sacked. You may browse the club but cannot progress.</div></div></div>` : '';
      m.innerHTML = `
        <div class="view-header">
          <div><div class="view-title">Pre-Season</div><div class="view-subtitle">${esc(club.name)} · Season ${gameState.season}</div></div>
        </div>
        ${sackedBanner}
        <div class="next-match-card" style="text-align:center">
          <div class="next-match-header" style="justify-content:center">
            <span class="next-match-comp" style="font-size:13px;letter-spacing:1px">SUMMER TRANSFER WINDOW OPEN</span>
          </div>
          <div style="margin:18px 0">
            <div class="stat-big" style="font-size:36px">${canStart ? 'Ready!' : daysLeft + ' days'}</div>
            <div class="stat-label">${canStart ? 'Season is ready to begin' : 'until season ' + gameState.season + ' kicks off'}</div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:18px">${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</div>
          <div class="nm-actions" style="gap:10px">
            ${isSacked
              ? `<button class="btn-secondary btn-lg" id="sr-menu" style="flex:1">Return to Main Menu</button>`
              : canStart
                ? `<button class="btn-primary btn-lg" id="dash-begin-season" style="flex:1">▶ Begin Season ${gameState.season}</button>`
                : `<button class="btn-secondary btn-lg" id="dash-advance-week" style="flex:1">⏩ Advance One Week</button>
                   <button class="btn-secondary btn-lg" id="dash-advance-day" style="flex:0 0 auto">+1 Day</button>`
            }
          </div>
        </div>
        <div class="dashboard-grid-2">
          <div class="card"><div class="card-title">Squad Value</div><div class="stat-big" style="font-size:24px">${money(club.players.reduce((s, p) => s + p.value, 0))}</div><div class="stat-label">${club.players.length} players</div></div>
          <div class="card"><div class="card-title">Club Balance</div><div class="stat-big" style="font-size:24px">${money(gameState.finances?.balance ?? club.budget)}</div><div class="stat-label">Available to spend</div></div>
        </div>`;
      if (isSacked) {
        m.querySelector('#sr-menu').addEventListener('click', () => { setAutoSaveRunning(false); gameState = null; showScreen('start'); });
      } else if (canStart) {
        m.querySelector('#dash-begin-season').addEventListener('click', beginSeasonFromPreseason);
      } else {
        m.querySelector('#dash-advance-week').addEventListener('click', advancePreseasonWeek);
        m.querySelector('#dash-advance-day').addEventListener('click', advanceOneDay);
      }
      return;
    }

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
            <div class="nm-team">${badge(home,'nm-badge')}<span class="nm-name">${esc(home.name)}</span><span class="nm-rating">OVR ${home.sqRating}</span></div>
            <div class="nm-vs">VS</div>
            <div class="nm-team">${badge(away,'nm-badge')}<span class="nm-name">${esc(away.name)}</span><span class="nm-rating">OVR ${away.sqRating}</span></div>
          </div>
          <div class="nm-venue">${myIsHome ? 'Home fixture' : 'Away fixture'}</div>
          <div class="nm-finance">${previewMatchIncome(next)}</div>
          <div class="nm-actions">${gameState.sacked
            ? `<button class="btn-secondary btn-lg" style="flex:1;opacity:0.5;cursor:not-allowed" disabled>▶ Play Match</button>
               <button class="btn-gold btn-lg" id="dash-return-menu">Return to Menu</button>`
            : next.date.getTime() <= gameState.currentDate.getTime()
              ? `<button class="btn-primary btn-lg" id="dash-play" style="flex:1">▶ Play Match</button>`
              : `${next.date.getTime() > gameState.currentDate.getTime() + DAY_MS ? `<button class="btn-secondary btn-lg" id="dash-advance-match" style="flex:1">⏩ Next Match</button>` : ''}
                 <button class="btn-secondary btn-lg" id="dash-advance-day" style="flex:0 0 auto">+1 Day</button>`
          }</div>
        </div>`;
    } else {
      // Reaching here with no pending review means the in-memory review was lost (e.g. an old
      // save written while stranded on the pre-fix season-review screen) — offer a direct way
      // to advance so the save isn't permanently stuck.
      nextHtml = `
        <div class="next-match-card" style="text-align:center">
          <div class="empty-state"><div class="empty-state-text">Season complete — no fixtures remaining.</div></div>
          <div class="nm-actions" style="margin-top:14px">
            <button class="btn-primary btn-lg" id="dash-continue-season" style="flex:1">Continue to Season ${gameState.season + 1} →</button>
          </div>
        </div>`;
    }

    const topScorer = [...club.players].sort((a, b) => b.goals - a.goals)[0];
    const inbox = gameState.inbox || [];
    const unreadCount = inbox.filter(x => !x.read).length;
    const inboxTypeIcon = { transfer_request: '↑', contract_expiry: '⚠', club_news: '◈' };

    const inboxHtml = inbox.length === 0 ? '' : `
      <div class="card inbox-card">
        <div class="inbox-header">
          <div class="card-title">Inbox</div>
          ${unreadCount > 0 ? `<span class="inbox-unread-badge">${unreadCount}</span>` : ''}
        </div>
        ${inbox.slice(0, 5).map(msg => `
          <div class="inbox-msg ${msg.read ? '' : 'unread'} ${msg.type}" data-msgid="${msg.id}">
            <span class="inbox-msg-icon">${inboxTypeIcon[msg.type] || '●'}</span>
            <div class="inbox-msg-body">
              <div class="inbox-msg-title">${esc(msg.title)}</div>
              <div class="inbox-msg-sub">${esc(msg.body)}</div>
              <div class="inbox-msg-date">${msg.date}</div>
            </div>
            <div class="inbox-msg-actions">
              ${msg.playerId ? `<button class="btn-secondary btn-sm inbox-view-btn" data-pid="${msg.playerId}">View</button>` : ''}
              <button class="btn-secondary btn-sm inbox-dismiss-btn" data-msgid="${msg.id}">✕</button>
            </div>
          </div>`).join('')}
        ${inbox.length > 5 ? `<div class="inbox-more">+${inbox.length - 5} older messages</div>` : ''}
      </div>`;

    m.innerHTML = `
      <div class="view-header">
        <div><div class="view-title">Dashboard</div><div class="view-subtitle">${esc(club.name)} · Season ${gameState.season}</div><div class="view-rep-stars">${repStars(club.rep)}</div></div>
        <div class="form-guide">${formGuide(club.form)}</div>
      </div>
      ${nextHtml}
      ${inboxHtml}
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
          <div class="card-title" style="margin-top:18px">Club Balance</div>
          <div class="stat-big" style="font-size:26px">${money(gameState.finances?.balance ?? club.budget)}</div>
        </div>
      </div>`;

    if (next && !gameState.sacked) $('dash-play')?.addEventListener('click', playNextMatch);
    if (next && !gameState.sacked) $('dash-advance-match')?.addEventListener('click', advanceToNextMatch);
    if (next && !gameState.sacked) $('dash-advance-day')?.addEventListener('click', advanceOneDay);
    if (gameState.sacked) $('dash-return-menu')?.addEventListener('click', () => { setAutoSaveRunning(false); gameState = null; showScreen('start'); });
    $('dash-continue-season')?.addEventListener('click', startNextSeason);

    // Inbox interactions
    m.querySelectorAll('.inbox-msg').forEach(el => {
      const msg = inbox.find(x => x.id === el.dataset.msgid);
      if (msg) msg.read = true;
    });
    m.querySelectorAll('.inbox-dismiss-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.inbox = (gameState.inbox || []).filter(x => x.id !== btn.dataset.msgid);
      renderDashboard(m);
    }));
    m.querySelectorAll('.inbox-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPlayerModal(btn.dataset.pid);
    }));
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
        <div class="result-teams-mini">${badge(opp,'table-badge')}<span>${r.home ? 'vs' : '@'} ${esc(opp.name)}</span></div>
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
          <th class="sortable th-c" data-s="ovr">OVR</th>
          <th class="sortable th-c" data-s="age">Age</th>
          <th class="sortable th-c" data-s="goals">Gls</th>
          <th class="th-c">Ast</th><th class="th-c">Apps</th>
          <th class="th-c">Fitness</th>
        </tr></thead>
        <tbody>${players.map((p, i) => {
          const fit = p.fitness ?? 80;
          const fitCls = fit >= 80 ? 'fit-high' : fit >= 55 ? 'fit-mid' : fit >= 30 ? 'fit-low' : 'fit-critical';
          const statusCell = p.injured
            ? (() => { const inj = INJURY_TYPES.find(t => t.id === p.injuryType); return `<span class="inj-badge inj-${inj?.severity || 'minor'}">${inj?.label || 'Injured'} ${p.injuryWeeks}w</span>`; })()
            : `<div class="fit-bar-wrap"><div class="fit-bar ${fitCls}" style="width:${fit}%"></div></div>`;
          const moUntil = monthsUntil(p.contractEnd, gameState.currentDate);
          const contractExpiring = moUntil <= 12;
          const ambition = playerAmbition(p, gameState.myClub);
          const unlikelyRenew = contractExpiring && (p.wantsMove || ambition >= 0.35);
          const contractIcon = contractExpiring
            ? `<span title="${unlikelyRenew ? 'Unlikely to renew' : 'Contract expiring'}" style="margin-left:4px;font-size:18px;line-height:1;color:${unlikelyRenew ? '#ef4444' : '#f59e0b'}">⚠&#xFE0E;</span>`
            : '';
          const transferIcon = p.wantsMove
            ? `<span title="Transfer request" style="margin-left:3px;font-size:18px;line-height:1;color:#f59e0b">↑</span>`
            : '';
          return `
          <tr data-id="${p.id}" class="${p.injured ? 'row-injured' : ''}">
            <td class="player-num">${i + 1}</td>
            <td class="player-name-cell">${esc(p.name)}${contractIcon}${transferIcon}<span class="player-nat">${esc(p.nationality)}</span></td>
            <td><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span></td>
            <td style="white-space:nowrap"><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>${p.pot > p.ovr ? `<span class="squad-pot-tag" title="Potential">▲${p.pot}</span>` : ''}</td>
            <td class="stat-mini">${p.age}</td>
            <td class="stat-mini">${p.goals}</td>
            <td class="stat-mini">${p.assists}</td>
            <td class="stat-mini">${p.appearances}</td>
            <td>${statusCell}</td>
          </tr>`;
        }).join('')}</tbody>
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
    const _panelSt = m.querySelector('.tactics-options-panel')?.scrollTop ?? 0;
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
    const pickSlot = ui.pickSlot != null ? ui.pickSlot : null;

    const pitchPlayers = activeForm.positions.map((slot, i) => {
      const p = club.players.find(x => x.id === lineup[i]);
      if (!p) {
        const selEmpty = pickSlot === i ? ' swap-sel' : '';
        return `<div class="pitch-player pitch-empty${selEmpty}" data-slot="${i}" style="left:${slot.x}%;top:${slot.y}%">
          <div class="pitch-player-circle empty-slot">${slot.pos}</div></div>`;
      }
      const sel = swapSel === p.id ? ' swap-sel' : '';
      const dim = swapMode && swapSel && swapSel !== p.id ? ' swap-dim' : '';
      const oopF  = ENGINE.oopFactor(p.pos, slot.pos);
      const oopLvl = oopF >= 1.0 ? '' : oopF >= 0.88 ? 'oop-minor' : oopF >= 0.70 ? 'oop-moderate' : oopF >= 0.48 ? 'oop-severe' : 'oop-extreme';
      const oopCls = oopLvl ? ` ${oopLvl}` : '';
      const effOvr  = oopLvl ? Math.round(p.ovr * oopF) : p.ovr;
      const oopTag  = oopLvl
        ? `<div class="pitch-player-oop ${oopLvl}">${slot.pos} &minus;${Math.round((1 - oopF) * 100)}%</div>`
        : '';
      return `<div class="pitch-player${sel}${dim}${oopCls}" data-id="${p.id}" style="left:${slot.x}%;top:${slot.y}%">
        <div class="pitch-player-circle ${slot.pos === 'GK' ? 'gk' : ''}${oopCls}" title="${p.name} (${p.pos}) playing ${slot.pos} · effective OVR ${effOvr}">${effOvr}</div>
        <div class="pitch-player-name">${esc(p.lastName)}</div>
        ${oopTag}</div>`;
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
    const pickActive = pickSlot != null;
    const barActive = swapMode || pickActive;
    const swapHint = pickActive ? 'Pick a player to fill this slot'
      : swapMode ? (swapSel ? 'Pick who to swap with' : 'Pick a player') : '';
    // Bench strip only shows up while picking a destination/source player — the pitch
    // itself has no player list, so clicking an empty circle needs somewhere to choose
    // a name from without forcing a trip to the Squad tab.
    const benchStrip = barActive
      ? `<div class="bench-row">${benchChips || '<span class="bench-empty">No bench players available</span>'}</div>`
      : '';

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Tactics</div><div class="view-subtitle">${activeForm.name} · ${cap(tac.mentality)} · ${pressLabels[tac.pressing]} · ${styleLabels[tac.style]}</div></div></div>
      <div class="tactics-layout">
        <div class="tactics-pitch-container">
          <div class="pitch-swap-bar">
            <span class="pitch-swap-hint">${swapHint}</span>
            <button id="pitch-auto-xi-btn" class="btn-secondary">Auto XI</button>
            <button id="pitch-swap-btn" class="${barActive ? 'btn-warning' : 'btn-secondary'}">${barActive ? 'Cancel' : 'Swap'}</button>
          </div>
          <div class="tactics-pitch">
            <div class="tactics-pitch-lines">
              <div class="tp-center-line"></div><div class="tp-center-circle"></div>
              <div class="tp-penalty-top"></div><div class="tp-penalty-bottom"></div>
            </div>
            ${pitchPlayers}
          </div>
          ${benchStrip}
        </div>
        <div class="tactics-options-panel">
          <div class="tac-inner-tab-row">
            <button class="tac-inner-tab-btn ${innerTab==='tactics'?'active':''}" data-inner="tactics">Tactics</button>
            <button class="tac-inner-tab-btn ${innerTab==='squad'?'active':''}" data-inner="squad">Squad</button>
          </div>
          <div id="tac-inner-body"></div>
        </div>
      </div>`;

    // Inner tab buttons (Tactics / Squad)
    m.querySelectorAll('.tac-inner-tab-btn').forEach(btn => btn.addEventListener('click', () => {
      ui.tacticsTab = btn.dataset.inner; renderTactics(m);
    }));

    // Auto XI button
    $('pitch-auto-xi-btn').addEventListener('click', () => {
      tac.excluded = []; tac.lineup = autoPickXI(club, activeTacticForm(), []);
      ui.swapSel = null; ui.swapMode = false; ui.pickSlot = null;
      recalcSqRating(club); renderTactics(m);
    });

    // Swap/Cancel button — also backs out of "pick a player for this slot" mode
    $('pitch-swap-btn').addEventListener('click', () => {
      if (pickActive) { ui.pickSlot = null; ui.swapMode = false; renderTactics(m); return; }
      ui.swapMode = !ui.swapMode; ui.swapSel = null; renderTactics(m);
    });

    // Move pid into the empty slot at lineup index `slot`, vacating wherever pid
    // currently sits in the lineup (if anywhere) so they don't end up duplicated.
    function fillSlot(slot, pid) {
      const oldIdx = tac.lineup.indexOf(pid);
      if (oldIdx >= 0) tac.lineup[oldIdx] = null;
      tac.lineup[slot] = pid;
      tac.excluded = (tac.excluded || []).filter(id => id !== pid);
      ui.swapSel = null; ui.swapMode = false; ui.pickSlot = null;
      recalcSqRating(club); renderTactics(m);
    }

    // Click handler for any player (pitch or bench)
    function handlePlayerClick(pid) {
      if (ui.pickSlot != null) { fillSlot(ui.pickSlot, pid); return; }
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
      ui.swapSel = null; ui.swapMode = false;
      recalcSqRating(club); renderTactics(m);
    }

    m.querySelectorAll('.pitch-player:not(.pitch-empty)').forEach(el => el.addEventListener('click', () => handlePlayerClick(el.dataset.id)));
    m.querySelectorAll('.bench-chip').forEach(el => el.addEventListener('click', () => handlePlayerClick(el.dataset.id)));
    m.querySelectorAll('.pitch-empty').forEach(el => el.addEventListener('click', () => {
      const slot = parseInt(el.dataset.slot);
      if (ui.swapSel) { fillSlot(slot, ui.swapSel); return; }
      // No player selected yet — clicking the empty circle itself now starts
      // "pick a player for this slot" instead of requiring Auto XI + a manual
      // swap afterwards. Clicking the same slot again cancels the pick.
      ui.pickSlot = ui.pickSlot === slot ? null : slot;
      ui.swapMode = ui.pickSlot != null;
      renderTactics(m);
    }));

    if (innerTab === 'tactics') renderTacticsInner($('tac-inner-body'), m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    else renderTacticsSquad($('tac-inner-body'), m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
    m.scrollTop = _st;
    const _panel = m.querySelector('.tactics-options-panel');
    if (_panel) _panel.scrollTop = _panelSt;
  }

  function renderTacticsInner(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap) {
    const mentalities = ['defensive','balanced','attacking'];
    const pressings   = ['high','medium','low'];
    const styles      = ['direct','balanced','possession','counter','gegenpressing','longball'];
    const pressLabels = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const pressDesc   = { high: 'Win ball high (+12% xG), leaves space (+8% vs counters)', medium: 'Balanced approach', low: 'Compact shape (+14% def), limited attack (-10% xG)' };
    const styleLabels = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession', counter: 'Counter', gegenpressing: 'Gegenpressing', longball: 'Long Ball' };
    const styleDesc   = { direct: 'Quick transitions (+8% xG)', balanced: 'Balanced approach', possession: 'Sustained pressure (+5% xG)', counter: 'Sit deep, explode on the break (great vs high press)', gegenpressing: 'Win ball high, instant transitions (+10% xG, risky)', longball: 'Aerial threat, bypass the press (+6% xG, beats low blocks)' };

    const cornerLabels = { 'near-post': 'Near Post', 'far-post': 'Far Post', 'short': 'Short Corner', 'drilled': 'Drilled Cross' };
    const cornerDesc   = { 'near-post': 'Quick delivery, harder to defend', 'far-post': 'Aerial threat for tall players (+15% SP xG)', 'short': 'Retain possession, draw defenders out', 'drilled': 'Low driven ball into the box' };
    const fkLabels     = { shoot: 'Shoot', cross: 'Cross', short: 'Short FK' };
    const fkDesc       = { shoot: 'Direct attempt on goal (+10% FK xG)', cross: 'Delivery into the box', short: 'Build play from the dead ball' };
    const spDefLabels  = { zonal: 'Zonal', man: 'Man Marking', mixed: 'Mixed' };
    const spDefDesc    = { zonal: 'Defenders hold zones — harder to beat (−18% opp SP xG)', man: 'Mark runners directly — high risk, high reward', mixed: 'Blend of both (−12% opp SP xG)' };

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
    let scoutHtml = '', myXG = 0, oppXG = 0, opp = null;
    if (next) {
      const myIsHome = next.home === gameState.myClubId;
      opp = gameState.clubs[myIsHome ? next.away : next.home];
      if (opp) {
        const myTac = { ...tac, customFormation: tac.formation === 'custom' ? tac.customFormation : null };
        const oppTac = opp.tactics || ENGINE.deriveAITactics(opp);
        const oppForm = DATA.FORMATIONS[oppTac.formation] || DATA.FORMATIONS['4-3-3'];
        const oppXI   = opp.lineup && opp.lineup.length === 11 ? opp.lineup : autoPickXI(opp, oppTac.formation);
        const oppSlot = oppForm.positions.map(p => p.pos);
        const mySlot  = activeForm.positions.map(p => p.pos);
        const xgPrev = myIsHome
          ? ENGINE.previewEffectiveXG(club, opp, myTac, oppTac, lineup, oppXI, mySlot, oppSlot)
          : ENGINE.previewEffectiveXG(opp, club, oppTac, myTac, oppXI, lineup, oppSlot, mySlot);
        myXG  = myIsHome ? xgPrev.hEff : xgPrev.aEff;
        oppXG = myIsHome ? xgPrev.aEff : xgPrev.hEff;
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
                <span class="scout-opp-name">${esc(opp.name)}</span>
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
      ${scoutHtml ? `<div class="tac-xg-preview">
        <span class="tac-xg-you">${myXG.toFixed(2)}</span>
        <div class="tac-xg-bar-wrap"><div class="tac-xg-bar-fill" style="width:${Math.round(myXG/(myXG+oppXG)*100)}%"></div></div>
        <span class="tac-xg-opp">${oppXG.toFixed(2)}</span>
        <span class="tac-xg-label">xG vs ${esc(opp?.name||'')}</span>
      </div>` : ''}
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
      <div class="tactics-section">
        <h3>Set Pieces — Attack</h3>
        <div class="tac-sp-group"><h4 class="tac-sp-sub">Corner Delivery</h4>
          <div class="tac-btn-col">${['near-post','far-post','short','drilled'].map(v =>
            `<button class="tac-opt-btn wide ${(tac.cornerTaking||'far-post')===v?'selected':''}" data-tac="cornerTaking" data-v="${v}">
              <span class="tac-opt-label">${cornerLabels[v]}</span>
              <span class="tac-opt-desc">${cornerDesc[v]}</span>
            </button>`).join('')}</div>
        </div>
        <div class="tac-sp-group"><h4 class="tac-sp-sub">Free Kick</h4>
          <div class="tac-btn-row">${['shoot','cross','short'].map(v =>
            `<button class="tac-opt-btn ${(tac.freeKick||'cross')===v?'selected':''}" data-tac="freeKick" data-v="${v}" title="${fkDesc[v]}">${fkLabels[v]}</button>`).join('')}</div>
        </div>
      </div>
      <div class="tactics-section">
        <h3>Defence</h3>
        <div class="tac-btn-col">${['zonal','man','mixed'].map(v =>
          `<button class="tac-opt-btn wide ${(tac.cornerDefense||'mixed')===v?'selected':''}" data-tac="cornerDefense" data-v="${v}">
            <span class="tac-opt-label">${spDefLabels[v]}</span>
            <span class="tac-opt-desc">${spDefDesc[v]}</span>
          </button>`).join('')}</div>
      </div>
      <div class="tactics-section">
        <h3>Tactical Instructions</h3>
        <div class="tac-toggle-row">
          <button class="tac-toggle-btn ${tac.playSetPieces?'active':''}" data-tac="playSetPieces" data-v="${!tac.playSetPieces}">
            <span class="tac-toggle-name">Play for Set Pieces</span>
            <span class="tac-toggle-desc">Win more dead balls, aerial focus (+50% SP xG, −5% open play)</span>
            <span class="tac-toggle-state">${tac.playSetPieces?'ON':'OFF'}</span>
          </button>
          <button class="tac-toggle-btn ${tac.timeWasting?'active':''}" data-tac="timeWasting" data-v="${!tac.timeWasting}">
            <span class="tac-toggle-name">Time Wasting</span>
            <span class="tac-toggle-desc">Slows tempo when winning — shields lead (opp −20% xG, you −8%)</span>
            <span class="tac-toggle-state">${tac.timeWasting?'ON':'OFF'}</span>
          </button>
        </div>
      </div>
      ${scoutHtml}`;

    el.querySelectorAll('.formation-btn[data-f]').forEach(b => b.addEventListener('click', () => {
      tac.formation = b.dataset.f; tac.lineup = Array(11).fill(null);
      renderTactics(m);
    }));
    el.querySelectorAll('[data-tac]').forEach(b => b.addEventListener('click', () => {
      const raw = b.dataset.v;
      tac[b.dataset.tac] = raw === 'true' ? true : raw === 'false' ? false : raw;
      renderTactics(m);
    }));
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
      recalcSqRating(club); renderTactics(m);
    });
  }

  function renderTacticsSquad(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap) {
    const filterKey = ui.tacSquadFilter || 'all';
    const sortKey   = ui.tacSquadSort   || 'ovr';
    const filters = [['all','All'],['GK','GK'],['DEF','DEF'],['MID','MID'],['ATT','ATT']];
    const swapSel = ui.swapSel || null;

    let players = [...club.players];
    if (filterKey !== 'all') players = players.filter(p => group(p.pos) === filterKey);
    players.sort(squadSorter(sortKey));

    const xiCount = lineup.filter(id => club.players.find(p => p.id === id)).length;

    const rows = players.map(p => {
      const inXI = lineupSet.has(p.id);
      const isExcluded = excluded.has(p.id);
      const isSel = swapSel === p.id;
      const slotPos = slotMap[p.id];
      const oopF    = inXI && slotPos ? ENGINE.oopFactor(p.pos, slotPos) : 1.0;
      const isOOP   = oopF < 1.0;
      const oopLvl  = !isOOP ? '' : oopF >= 0.88 ? 'oop-badge-minor' : oopF >= 0.70 ? 'oop-badge-moderate' : oopF >= 0.48 ? 'oop-badge-severe' : 'oop-badge-extreme';
      const oopBadge = isOOP ? `<span class="oop-badge ${oopLvl}" title="Playing ${slotPos}, effective OVR ${Math.round(p.ovr * oopF)}">${slotPos} &minus;${Math.round((1 - oopF) * 100)}%</span>` : '';
      const potStr = p.pot > p.ovr ? `<span class="squad-pot">${p.pot}↑</span>` : '';
      const rowClass = [inXI ? 'in-xi' : '', isExcluded ? 'excluded' : '', isSel ? 'swap-sel-row' : ''].filter(Boolean).join(' ');
      const fit = p.fitness ?? 80;
      const fitCls = fit >= 80 ? 'fit-high' : fit >= 55 ? 'fit-mid' : fit >= 30 ? 'fit-low' : 'fit-critical';
      const fitCell = p.injured
        ? (() => { const inj = INJURY_TYPES.find(t => t.id === p.injuryType); return `<span class="inj-badge inj-${inj?.severity||'minor'}">${inj?.label||'Inj'} ${p.injuryWeeks}w</span>`; })()
        : `<div class="fit-bar-wrap"><div class="fit-bar ${fitCls}" style="width:${fit}%"></div></div>`;
      return `<tr class="${rowClass}" data-pid="${p.id}" data-inxi="${inXI?'1':''}" data-excl="${isExcluded?'1':''}">
        <td><span class="pos-badge ${posClass(p.pos)}">${p.pos}</span></td>
        <td class="player-name-cell">${esc(p.name)}<span class="player-nat">${esc(p.nationality)}</span></td>
        <td><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>${potStr}${oopBadge}</td>
        <td class="stat-mini">${p.age}</td>
        <td class="stat-mini">${p.goals}</td>
        <td class="stat-mini">${p.assists}</td>
        <td class="stat-mini">${p.appearances || 0}</td>
        <td>${fitCell}</td>
      </tr>`;
    }).join('');

    const swapHint = swapSel
      ? `<span class="tac-swap-hint">Now pick a bench player to swap in</span>`
      : `<span class="tac-swap-hint muted">Click a starting player to swap them out</span>`;

    el.innerHTML = `
      <div class="tactics-section">
        <div class="tac-squad-toolbar">
          <div class="tac-squad-filters">${filters.map(([k,l]) =>
            `<button class="tac-squad-filter-btn ${filterKey===k?'active':''}" data-f="${k}">${l}</button>`).join('')}</div>
          <span style="font-size:11px;color:var(--text-muted)">${xiCount}/11</span>
          <button class="btn-secondary auto-xi-btn">Auto XI</button>
        </div>
        ${swapHint}
        <table class="tac-squad-table">
          <thead><tr>
            <th>Pos</th>
            <th class="sortable" data-s="name">Name</th>
            <th class="sortable" data-s="ovr">OVR</th>
            <th class="sortable" data-s="age">Age</th>
            <th class="sortable" data-s="goals">Gls</th>
            <th class="sortable" data-s="assists">Ast</th>
            <th class="sortable" data-s="appearances">Apps</th>
            <th>Fitness</th>
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

    // Row clicks — swap-first then bench-second interaction
    el.querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => {
      const pid = row.dataset.pid;
      const inXI = row.dataset.inxi === '1';
      const isExcl = row.dataset.excl === '1';

      if (inXI) {
        // Toggle selection of this starting player
        ui.swapSel  = (ui.swapSel === pid) ? null : pid;
        ui.swapMode = !!ui.swapSel;
        renderTacticsSquad(el, m, club, tac, activeForm, lineup, lineupSet, excluded, slotMap);
        return;
      }

      if (isExcl) {
        // Un-exclude so player becomes available on bench
        tac.excluded = (tac.excluded || []).filter(id => id !== pid);
        ui.swapSel = null; ui.swapMode = false;
        renderTactics(m); return;
      }

      // Bench player — complete swap if one is selected
      if (ui.swapSel) {
        const fromIdx = tac.lineup.indexOf(ui.swapSel);
        const toIdx   = tac.lineup.indexOf(pid);
        if (fromIdx >= 0 && toIdx >= 0) {
          // Both in XI — swap positions
          tac.lineup[fromIdx] = pid;
          tac.lineup[toIdx]   = ui.swapSel;
        } else if (fromIdx >= 0) {
          // Bench player comes on, starter goes to bench
          tac.lineup[fromIdx] = pid;
          tac.excluded = (tac.excluded || []).filter(id => id !== pid);
        }
        ui.swapSel = null; ui.swapMode = false;
        recalcSqRating(club); renderTactics(m); return;
      }

      // No swap pending — open player modal
      showPlayerModal(pid);
    }));

    el.querySelector('.auto-xi-btn').addEventListener('click', () => {
      tac.excluded = [];
      tac.lineup   = autoPickXI(club, activeTacticForm(), []);
      ui.swapSel = null; ui.swapMode = false;
      recalcSqRating(club); renderTactics(m);
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
            <span class="fixture-team-name">${esc(home.name)}</span>
            <span class="${scoreCls}">${scoreTxt}</span>
            <span class="fixture-team-name">${esc(away.name)}</span>
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
  function getLastSeasonTable(lid) {
    return Object.values(gameState.clubs)
      .filter(c => (c.lastSeasonLeague || c.league) === lid)
      .sort((a, b) => {
        const sa = a.lastSeasonStats || a.tableStats, sb = b.lastSeasonStats || b.tableStats;
        const dPts = sb.points - sa.points;
        if (dPts) return dPts;
        const dGD = (sb.gf - sb.ga) - (sa.gf - sa.ga);
        if (dGD) return dGD;
        return sb.gf - sa.gf;
      });
  }

  function renderTable(m) {
    const _st = m.scrollTop;
    const showLastSeason = !!gameState.preseason;
    const lid = ui.tableLeague || (showLastSeason ? (gameState.myClub.lastSeasonLeague || gameState.myClub.league) : gameState.myClub.league);
    const league = DATA.LEAGUES[lid];
    const table = showLastSeason ? getLastSeasonTable(lid) : ENGINE.getLeagueTable(gameState, lid);
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
      <div class="view-header"><div><div class="view-title">League Table</div><div class="view-subtitle">${league.name}${showLastSeason && gameState.lastCompletedSeason ? ` · Final standings, Season ${gameState.lastCompletedSeason}` : ''}</div></div></div>
      <div class="table-tabs">${myLeagues.map(l =>
        `<button class="transfer-tab ${l===lid?'active':''}" data-l="${l}">${DATA.LEAGUES[l].name}</button>`).join('')}</div>
      <table class="league-table">
        <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${table.map((c, i) => {
          const t = showLastSeason ? (c.lastSeasonStats || c.tableStats) : c.tableStats;
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
    const offers = (gameState.negotiations || []).filter(n => n.type === 'incoming');
    const preContracts = gameState.preContracts || [];
    const pendingNote = !open && preContracts.length ? ` · ${preContracts.length} pre-contract${preContracts.length > 1 ? 's' : ''} pending` : '';
    const banner = open
      ? `<div class="tw-banner"><span class="tw-dot open-dot"></span> Transfer window is OPEN</div>`
      : `<div class="tw-banner closed"><span class="tw-dot closed-dot"></span> Transfer window is closed (opens Jul–Aug & Jan)${pendingNote}</div>`;

    let listHtml;
    if (ui.transferTab === 'market') {
      const preSignedIds = new Set(preContracts.map(pc => pc.playerData.id));
      let market = (gameState.market || []).filter(p => !preSignedIds.has(p.id));
      if (ui.transferSearch) market = market.filter(p => p.name.toLowerCase().includes(ui.transferSearch));
      if (ui.transferPos !== 'all') market = market.filter(p => group(p.pos) === ui.transferPos);
      listHtml = market.slice(0, 250).map(p => `
        <div class="transfer-player-item" data-buy="${p.id}" data-club="${p.clubId}">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info">
            <div class="tp-name">${esc(p.name)}${p.expiring ? '<span class="tp-tag exp">Expiring</span>' : p.wantsMove ? '<span class="tp-tag listed">Listed</span>' : ''}</div>
            <div class="tp-club">${esc(p.clubName)} · Age ${p.age}</div>
          </div>
          <span class="tp-ovr">${p.ovr}</span><span class="tp-value">${money(p.value)}</span>
        </div>`).join('') || emptyList('No players match your filters.');
    } else if (ui.transferTab === 'free') {
      const agents = gameState.freeAgents || [];
      listHtml = agents.length
        ? agents.map(p => `
        <div class="transfer-player-item" data-fa="${p.id}">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info">
            <div class="tp-name">${esc(p.name)} <span class="tp-tag exp">Free</span></div>
            <div class="tp-club">Age ${p.age} · No club</div>
          </div>
          <span class="tp-ovr">${p.ovr}</span><span class="tp-value">Free</span>
        </div>`).join('')
        : emptyList('No free agents available right now.');
    } else if (ui.transferTab === 'offers') {
      if (!offers.length) {
        listHtml = emptyList(open ? 'No offers yet. List players for sale and wait for clubs to bid.' : 'Transfer window is closed — no incoming offers.');
      } else {
        listHtml = offers.map(o => {
          const waiting = o.awaiting === 'club';
          const daysLeft = waiting ? Math.max(1, Math.ceil((o.responseDue - gameState.currentDate) / DAY_MS)) : 0;
          return `
          <div class="transfer-player-item offer-item">
            <span class="tp-pos pos-badge ${posClass(o.playerPos)}">${o.playerPos}</span>
            <div class="tp-info">
              <div class="tp-name">${esc(o.playerName)} <span class="tp-tag listed">Offer</span></div>
              <div class="tp-club">${esc(o.clubName)} · ${o.date} · Market value ${money(o.marketValue || o.listingPrice)}</div>
            </div>
            <span class="tp-ovr">${o.playerOvr}</span>
            <span class="tp-value text-gold">${money(o.lastCounter || o.fee)}</span>
            ${waiting
              ? `<div class="offer-actions"><span class="neg-waiting-sub">Awaiting their response · ${daysLeft}d</span></div>`
              : `<div class="offer-actions">
                  <button class="btn-primary btn-sm offer-accept" data-oid="${o.id}">Accept</button>
                  <button class="btn-secondary btn-sm offer-counter" data-oid="${o.id}">Counter</button>
                  <button class="btn-secondary btn-sm offer-reject" data-oid="${o.id}">Reject</button>
                </div>`}
          </div>`;
        }).join('');
      }
    } else if (ui.transferTab === 'negotiations') {
      const negs = gameState.negotiations || [];
      if (!negs.length) {
        listHtml = emptyList('No negotiations in progress. Bid on a player on the Market, or list one of your own for sale.');
      } else {
        listHtml = negs.map(N => {
          const isOut = N.type === 'outgoing';
          const waiting = N.awaiting === 'club';
          const daysLeft = waiting ? Math.max(1, Math.ceil((N.responseDue - gameState.currentDate) / DAY_MS)) : 0;
          const key = N.stage === 'terms' ? money(N.agreedFee) : money(isOut ? (N.lastFee ?? N.neg.asking) : (N.lastCounter ?? N.fee));
          let statusHtml;
          if (N.stage === 'outbid') statusHtml = `<span class="tp-tag exp">Outbid!</span> <button class="btn-secondary btn-sm neg-dismiss" data-nid="${N.id}">Dismiss</button>`;
          else if (waiting) statusHtml = `<span class="neg-waiting-sub">Responds in ${daysLeft}d${N.rival ? ' · rival interest' : ''}</span>`;
          else statusHtml = `<button class="btn-primary btn-sm neg-respond" data-nid="${N.id}" data-type="${N.type}">Respond</button>`;
          return `
          <div class="transfer-player-item offer-item">
            <span class="tp-pos pos-badge ${posClass(N.playerPos)}">${N.playerPos}</span>
            <div class="tp-info">
              <div class="tp-name">${esc(N.playerName)} <span class="tp-tag listed">${isOut ? 'Buying' : 'Selling'}</span></div>
              <div class="tp-club">${esc(N.clubName)} · ${N.stage === 'terms' ? 'Personal terms' : 'Fee negotiation'}</div>
            </div>
            <span class="tp-ovr">${N.playerOvr}</span>
            <span class="tp-value text-gold">${key}</span>
            <div class="offer-actions">${statusHtml}</div>
          </div>`;
        }).join('');
      }
    } else {
      // My Squad — sell tab
      listHtml = [...club.players].sort((a, b) => b.ovr - a.ovr).map(p => {
        const isListed = p.listingPrice != null;
        return `
        <div class="transfer-player-item">
          <span class="tp-pos pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <div class="tp-info">
            <div class="tp-name">${esc(p.name)}${isListed ? `<span class="tp-tag listed">Listed ${money(p.listingPrice)}</span>` : ''}</div>
            <div class="tp-club">Age ${p.age} · ${money(p.wage/1000)}/wk</div>
          </div>
          <span class="tp-ovr">${p.ovr}</span>
          <span class="tp-value">${money(p.value)}</span>
          <button class="btn-sm ${isListed ? 'btn-secondary delist-btn' : 'btn-gold list-btn'}" data-pid="${p.id}">
            ${isListed ? 'Delist' : 'List'}
          </button>
        </div>`;
      }).join('');
    }

    const offerBadge = offers.some(o => o.awaiting === 'user') ? ` <span class="offer-badge">${offers.filter(o => o.awaiting === 'user').length}</span>` : '';
    const negCount = (gameState.negotiations || []).length;
    const negBadge = negCount ? ` <span class="offer-badge">${negCount}</span>` : '';
    const subtitles = { market: 'Transfer Market', sell: 'My Squad', free: 'Free Agents', offers: 'Incoming Offers', negotiations: 'Negotiations' };
    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Transfers</div><div class="view-subtitle">${subtitles[ui.transferTab] || ''}</div></div></div>
      ${banner}
      <div class="transfers-layout">
        <div>
          <div class="transfer-tabs">
            <button class="transfer-tab ${ui.transferTab==='market'?'active':''}" data-t="market">Market</button>
            <button class="transfer-tab ${ui.transferTab==='free'?'active':''}" data-t="free">Free Agents</button>
            <button class="transfer-tab ${ui.transferTab==='sell'?'active':''}" data-t="sell">My Squad</button>
            <button class="transfer-tab ${ui.transferTab==='offers'?'active':''}" data-t="offers">Offers${offerBadge}</button>
            <button class="transfer-tab ${ui.transferTab==='negotiations'?'active':''}" data-t="negotiations">Negotiations${negBadge}</button>
          </div>
          ${ui.transferTab === 'market' ? `
          <div class="transfer-search">
            <input type="text" id="tr-search" placeholder="Search players..." value="${esc(ui.transferSearch)}">
            <select id="tr-pos">
              ${['all','GK','DEF','MID','ATT'].map(p => `<option value="${p}" ${ui.transferPos===p?'selected':''}>${p==='all'?'All positions':p}</option>`).join('')}
            </select>
          </div>` : ''}
          ${ui.transferTab === 'free' ? `<div class="tp-hint">Free agents can be signed <b>any time</b> — no transfer window needed.</div>` : ''}
          ${!open && ui.transferTab === 'market' ? `<div class="tp-hint">Transfer window closed — offers made now are <b>pre-contracts</b> that activate at the next window.</div>` : ''}
          ${ui.transferTab === 'sell' ? `<div class="tp-hint">Click <b>List</b> to put a player on the market. Clubs will make offers over time.</div>` : ''}
          <div class="transfer-player-list">${listHtml}</div>
        </div>
        <div>
          <div class="budget-panel">
            <div class="card-title">Finances</div>
            <div class="budget-grid">
              <div class="budget-item"><div class="budget-item-label">Club Balance</div><div class="budget-item-val">${money(gameState.finances?.balance ?? club.budget)}</div></div>
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
          <div class="budget-panel">
            <div class="card-title">League Transfer News</div>
            <div class="transfer-log">${(gameState.transferNews || []).length
              ? gameState.transferNews.slice(0, 12).map(n =>
                `<div class="transfer-log-item"><div class="tlog-info">${esc(n.text)}</div><span class="tlog-fee text-muted">${esc(n.date)}</span></div>`).join('')
              : `<div class="stat-label">No transfer activity around the league yet.</div>`}</div>
          </div>
        </div>
      </div>`;

    m.querySelectorAll('.transfer-tab').forEach(b => b.addEventListener('click', () => { ui.transferTab = b.dataset.t; renderTransfers(m); }));
    const search = $('tr-search');
    if (search) { let _srchT; search.addEventListener('input', (e) => { ui.transferSearch = e.target.value.trim().toLowerCase(); clearTimeout(_srchT); _srchT = setTimeout(() => { renderTransfers(m); $('tr-search')?.focus(); }, 180); }); }
    const sel = $('tr-pos');
    if (sel) sel.addEventListener('change', (e) => { ui.transferPos = e.target.value; renderTransfers(m); });
    m.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => showMarketPlayerModal(el.dataset.buy, el.dataset.club)));
    m.querySelectorAll('[data-fa]').forEach(el => el.addEventListener('click', () => showFreeAgentModal(el.dataset.fa)));
    m.querySelectorAll('.list-btn').forEach(el => el.addEventListener('click', () => showListingModal(el.dataset.pid)));
    m.querySelectorAll('.delist-btn').forEach(el => el.addEventListener('click', () => delistPlayer(el.dataset.pid)));
    m.querySelectorAll('.offer-accept').forEach(el => el.addEventListener('click', () => acceptOffer(el.dataset.oid)));
    m.querySelectorAll('.offer-counter').forEach(el => el.addEventListener('click', () => showCounterModal(el.dataset.oid)));
    m.querySelectorAll('.offer-reject').forEach(el => el.addEventListener('click', () => rejectOffer(el.dataset.oid)));
    m.querySelectorAll('.neg-respond').forEach(el => el.addEventListener('click', () => {
      if (el.dataset.type === 'outgoing') { ui.activeNegotiationId = el.dataset.nid; renderNegotiation(); }
      else { ui.transferTab = 'offers'; renderTransfers(m); }
    }));
    m.querySelectorAll('.neg-dismiss').forEach(el => el.addEventListener('click', () => {
      gameState.negotiations = (gameState.negotiations || []).filter(n => n.id !== el.dataset.nid);
      renderTransfers(m);
    }));
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
    const gap = playerPrestige(p.ovr) - (myClub.rep ?? 1);
    if (gap <= 0) return 0;
    return 1 - 1 / (1 + gap * gap);
  }

  // How ambitious a player is to leave their current club (0 = content, 1 = desperate to move)
  // Driven by how far above the club's average they are, age, and potential remaining
  function playerAmbition(p, club) {
    const ovrGap = p.ovr - (club.sqRating || 70);
    const potGap = Math.max(0, (p.pot || p.ovr) - p.ovr);
    const ageBoost = p.age <= 22 ? 1.5 : p.age <= 26 ? 1.1 : p.age <= 29 ? 0.65 : 0.25;
    const loyaltyMod = p.loyal ? 0.5 : 1.0;
    const raw = (ovrGap * 0.045 + potGap * 0.025) * ageBoost * loyaltyMod;
    return Math.max(0, Math.min(1, raw));
  }

  function addInboxMsg(type, title, body, opts = {}) {
    if (!gameState.inbox) gameState.inbox = [];
    gameState.inbox.unshift({
      id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type, title, body,
      playerId:  opts.playerId  || null,
      playerPos: opts.playerPos || null,
      playerOvr: opts.playerOvr || null,
      date: fmtDate(gameState.currentDate),
      read: false,
    });
    if (gameState.inbox.length > 50) gameState.inbox.length = 50;
  }

  function generateClubNews() {
    if (!gameState || !gameState.myClub) return;
    const club = gameState.myClub;
    const pos = ENGINE.getMyPosition(gameState);
    const table = ENGINE.getLeagueTable(gameState, club.league);
    const total = table.length || 20;
    const form = (club.form || []).slice(-5);
    const wins = form.filter(f => f === 'W').length;
    const losses = form.filter(f => f === 'L').length;
    const leagueName = DATA.LEAGUES[club.league]?.name || 'the league';
    const cName = club.name || club.name;
    const pundits = ['Gary Neville','Alan Shearer','Micah Richards','Ian Wright','Roy Keane','Jamie Carragher','Thierry Henry','Joe Hart'];
    const pundit = pundits[Math.floor(Math.random() * pundits.length)];

    const items = [];

    // Win streak (4+ wins in last 5)
    if (wins >= 4 && form.length >= 4) {
      items.push({
        title: `${pundit}: "${cName} are flying right now"`,
        body: `"You can't ignore what ${cName} are doing — ${wins} wins in their last ${form.length} games. They look like genuine contenders in ${leagueName}." — ${pundit}`,
      });
    }
    // Terrible form (4+ losses in last 5)
    else if (losses >= 4 && form.length >= 4) {
      items.push({
        title: `${pundit} questions ${cName}'s direction`,
        body: `"Something's not right at ${cName}. ${losses} defeats in ${form.length} — the manager needs to find answers fast or this season could unravel." — ${pundit}`,
      });
    }
    // Top of the table
    if (pos === 1 && form.length >= 3) {
      items.push({
        title: `${cName} leading the way in ${leagueName}`,
        body: `"Top of ${leagueName} and looking comfortable. ${cName} have set the standard this season — it's everyone else's job to catch them." — ${pundit}`,
      });
    }
    // Bottom three (relegation zone)
    if (pos && pos >= total - 2 && form.length >= 3) {
      items.push({
        title: `Relegation fears growing at ${cName}`,
        body: `"${cName} are in real danger. Down in ${pos === total ? 'last' : ordinal(pos)} place — they need a response quickly or this could end badly." — ${pundit}`,
      });
    }
    // Pundit on squad quality vs league
    if (Math.random() < 0.25) {
      const avgOvr = Math.round(club.players.reduce((s, p) => s + p.ovr, 0) / (club.players.length || 1));
      const leagueAvg = table.reduce((s, c) => s + (c.sqRating || 60), 0) / (table.length || 1);
      if (avgOvr > leagueAvg + 5) {
        items.push({
          title: `${pundit}: "${cName} have quality to spare"`,
          body: `"Honestly ${cName} look too good for this level. Their squad OVR is well above the division average — if they don't go up, it's a missed opportunity." — ${pundit}`,
        });
      } else if (avgOvr < leagueAvg - 5) {
        items.push({
          title: `${pundit} worried about ${cName}'s depth`,
          body: `"${cName} are punching above their weight right now. On paper they're one of the weaker squads in ${leagueName} — the manager deserves credit for keeping them competitive." — ${pundit}`,
        });
      }
    }

    if (items.length === 0) return;
    const pick = items[Math.floor(Math.random() * items.length)];
    addInboxMsg('club_news', pick.title, pick.body);
  }

  function fileTransferRequest(p, reason, body) {
    p.transferListed = true;
    p.wantsMove = true;
    p.wantsMoveReason = reason;
    p.inboxedThisSeason = true;
    addInboxMsg('transfer_request', `${p.name} requests a transfer`, body,
      { playerId: p.id, playerPos: p.pos, playerOvr: p.ovr });
    notify(`${p.name} has requested a transfer!`, 'warning');
  }

  function generatePlayerEvents() {
    if (!gameState || !gameState.myClub) return;
    const myClub = gameState.myClub;
    myClub.players.forEach(p => {
      if (p.inboxedThisSeason || p.injured) return;
      const ambition = playerAmbition(p, myClub);
      const ovrGap   = p.ovr - (myClub.sqRating || 70);
      // Reason 1: feels too good for the club — meaningfully above squad average,
      // ambitious, not already listed.
      if (ambition >= 0.65 && ovrGap >= 8 && !p.loyal && !p.transferListed && Math.random() < 0.55) {
        fileTransferRequest(p, 'ability',
          `${p.name} (${p.pos}, OVR ${p.ovr}) believes he's outgrown the club and has handed in a transfer request. He's unlikely to sign a new contract while he feels this way.`);
      }
      // Reason 2: starved of game time — good enough to expect to start, but has
      // spent a long run out of the matchday XI.
      else if ((p.benchWeeks || 0) >= 6 && ovrGap >= -3 && ambition >= 0.30 && !p.loyal && !p.transferListed && Math.random() < 0.45) {
        fileTransferRequest(p, 'game_time',
          `${p.name} (${p.pos}, OVR ${p.ovr}) is unhappy with his lack of game time and has handed in a transfer request. He's unlikely to sign a new contract while he's frozen out of the side.`);
      }
      // Contract warning: deal expires within a year. Tone depends on how settled
      // the player is — ambitious/unhappy players are openly rejecting renewal;
      // others are just flagged as open to talks.
      else if (monthsUntil(p.contractEnd, gameState.currentDate) <= 12 && Math.random() < 0.65) {
        p.inboxedThisSeason = true;
        const reluctant = p.wantsMove || ambition >= 0.35;
        if (reluctant) {
          addInboxMsg('contract_expiry',
            `${p.name} is rejecting contract renewal`,
            `${p.name} (${p.pos}, OVR ${p.ovr}) is unlikely to renew. Act now or he walks on a free transfer when his deal expires in ${fmtContractEnd(p.contractEnd)}.`,
            { playerId: p.id, playerPos: p.pos, playerOvr: p.ovr });
          notify(`${p.name} is unlikely to renew his contract!`, 'warning');
        } else {
          addInboxMsg('contract_expiry',
            `${p.name}'s contract is winding down`,
            `${p.name} (${p.pos}, OVR ${p.ovr})'s deal runs out in ${fmtContractEnd(p.contractEnd)}. He's open to talks about a new contract — best to get it sorted before he can talk to other clubs.`,
            { playerId: p.id, playerPos: p.pos, playerOvr: p.ovr });
          notify(`${p.name}'s contract is entering its final year.`, 'info');
        }
      }
    });
  }

  function markTransferBan(playerId) {
    if (!gameState.transferBans) gameState.transferBans = {};
    gameState.transferBans[playerId] = true;
  }
  function isTransferBanned(playerId) {
    return !!(gameState.transferBans && gameState.transferBans[playerId]);
  }

  function hasPreContract(playerId) {
    return (gameState.preContracts || []).some(pc => pc.playerData.id === playerId);
  }

  const DAY_MS = 86400000;
  function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }

  function openNegotiation(playerId, clubId) {
    if (clubId === gameState.myClubId) return;
    if (isTransferBanned(playerId)) return notify('That player won\'t entertain a move to your club again this season.', 'warning');
    if (hasPreContract(playerId)) return notify('You\'ve already agreed a pre-contract with that player.', 'warning');
    const existing = (gameState.negotiations || []).find(n => n.type === 'outgoing' && n.playerId === playerId);
    if (existing) { ui.activeNegotiationId = existing.id; return renderNegotiation(); }
    const seller = gameState.clubs[clubId];
    const p = seller && seller.players.find(x => x.id === playerId);
    if (!p) return;
    const rejectChance = prestigeRejectChance(p, gameState.myClub);
    if (rejectChance > 0 && Math.random() < rejectChance) {
      const reason = rejectChance >= 0.65
        ? `doesn't see ${gameState.myClub.name || gameState.myClub.name} as a suitable destination.`
        : `isn't convinced your club is the right move for their career.`;
      markTransferBan(playerId);
      return notify(`${p.name} ${reason}`, 'warning');
    }
    // Closed window → this negotiation settles as a pre-contract that activates
    // at the next window instead of moving the player immediately.
    const preSign = !ENGINE.isTransferWindowOpen(gameState);
    const openMsg = preSign
      ? `Transfer window is closed — ${seller.name} will only agree a pre-contract for the next window.`
      : `${seller.name} are willing to listen to offers for ${p.name}.`;
    const N = {
      id: `neg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'outgoing', playerId, clubId, clubName: seller.name,
      playerName: p.name, playerPos: p.pos, playerOvr: p.ovr,
      stage: 'fee', awaiting: 'user', responseDue: null, preSign,
      neg: ENGINE.startNegotiation(p, seller),
      agreedFee: null, agreedWage: null, lastFee: null, lastWage: null, contractLength: 3,
      rival: null, lastTouch: new Date(gameState.currentDate),
      msgLog: [{ text: openMsg, tone: 'info' }],
    };
    if (!gameState.negotiations) gameState.negotiations = [];
    gameState.negotiations.push(N);
    ui.activeNegotiationId = N.id;
    renderNegotiation();
  }

  function renderNegotiation() {
    const N = (gameState.negotiations || []).find(n => n.id === ui.activeNegotiationId);
    if (!N) return;
    const seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    if (!p) { ui.activeNegotiationId = null; return closeModal(); }
    const neg = N.neg;
    const budget = gameState.finances?.balance ?? gameState.myClub.budget;
    const steps = ['fee', 'terms', 'done'];
    const labels = { fee: 'Transfer Fee', terms: 'Personal Terms', done: 'Done' };
    const stepBar = steps.map((s, i) =>
      `<span class="neg-step ${N.stage === s ? 'active' : ''} ${i < steps.indexOf(N.stage) ? 'done' : ''}">${labels[s]}</span>`
    ).join('<span class="neg-arrow">›</span>');

    let body = '';
    if (N.stage === 'outbid') {
      body = `<div class="neg-waiting"><div class="neg-waiting-icon">✗</div><div class="neg-waiting-text">You were outbid for ${esc(p.name)}.</div></div>
        <div class="neg-actions"><button class="btn-secondary" id="neg-close">Close</button></div>`;
    } else if (N.awaiting === 'club') {
      const daysLeft = Math.max(1, Math.ceil((N.responseDue - gameState.currentDate) / DAY_MS));
      body = `
        <div class="neg-waiting">
          <div class="neg-waiting-icon">⏳</div>
          <div class="neg-waiting-text">Awaiting ${esc(seller.name)}'s response${N.rival ? ` — <b>${esc(N.rival.clubName)}</b> are also in talks` : ''}</div>
          <div class="neg-waiting-sub">Expect a reply in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</div>
        </div>
        <div class="neg-actions"><button class="btn-secondary" id="neg-close">Close</button></div>`;
    } else if (N.stage === 'fee') {
      body = `
        <div class="neg-row"><span>Market value</span><span class="fw-700 text-gold">${money(p.value)}</span></div>
        <div class="neg-row"><span>Club asking price</span><span class="fw-700">${money(neg.asking)}</span></div>
        <div class="neg-row"><span>Club balance</span><span class="${budget >= neg.minFee ? '' : 'red'}">${money(budget)}</span></div>
        <div class="neg-field"><label>Your bid (£m)</label>
          <input id="neg-input" type="number" step="${p.value < 0.5 ? '0.01' : p.value < 2 ? '0.05' : '0.1'}" min="0" value="${N.lastFee != null ? N.lastFee : Math.min(budget, Math.round(p.value * 0.85 * 100) / 100)}"></div>
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
          <input id="neg-input" type="number" step="0.1" min="0" value="${N.lastWage != null ? N.lastWage : p.wage}"></div>
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
        <div class="neg-log">${(N.msgLog || []).map((m, i, arr) =>
          `<div class="neg-msg ${m.tone}${i === arr.length - 1 ? ' latest' : ''}">${m.text}</div>`
        ).join('')}</div>
        ${body}
      </div>`);

    const submit = $('neg-submit'), walk = $('neg-walk'), input = $('neg-input'), closeBtn = $('neg-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (N.stage === 'outbid') gameState.negotiations = gameState.negotiations.filter(n => n.id !== N.id);
      ui.activeNegotiationId = null; closeModal();
    });
    if (walk) walk.addEventListener('click', () => {
      markTransferBan(N.playerId);
      gameState.negotiations = gameState.negotiations.filter(n => n.id !== N.id);
      ui.activeNegotiationId = null; closeModal(); notify('You walked away from the table.', 'info');
    });
    const contractSel = $('neg-contract-len');
    if (contractSel) contractSel.addEventListener('change', () => { N.contractLength = parseInt(contractSel.value); });
    if (submit) submit.addEventListener('click', () => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) return notify('Enter a valid amount.', 'error');
      if (contractSel) N.contractLength = parseInt(contractSel.value);
      if (N.stage === 'fee') handleFeeOffer(N, val); else handleWageOffer(N, val);
    });
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && submit) submit.click(); });
    const log = document.querySelector('.neg-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // Submitting a bid/wage offer no longer resolves inline — it just records the
  // offer and puts the ball in the seller's court for a few days, mirroring how
  // an incoming offer already worked. resolveNegotiationResponses() (called from
  // every time-advance path) is what actually runs evaluateFeeOffer/evaluateWageOffer
  // once responseDue arrives.
  function handleFeeOffer(N, offer) {
    const seller = gameState.clubs[N.clubId];
    N.lastFee = offer;
    N.msgLog.push({ text: `You bid ${money(offer)}.`, tone: 'you' });
    const balance = gameState.finances?.balance ?? gameState.myClub.budget;
    if (offer > balance) {
      N.msgLog.push({ text: `Not enough funds — club balance is ${money(balance)}.`, tone: 'bad' });
      return renderNegotiation();
    }
    N.awaiting = 'club';
    N.responseDue = addDays(gameState.currentDate, rand(3, 10));
    N.lastTouch = new Date(gameState.currentDate);
    N.msgLog.push({ text: `${seller.name} will consider your offer.`, tone: 'info' });
    notify(`Bid of ${money(offer)} sent to ${seller.name} — expect a response within the week.`, 'info');
    renderNegotiation();
  }

  function handleWageOffer(N, offer) {
    const seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    N.lastWage = offer;
    N.msgLog.push({ text: `You offer ${money(offer / 1000)}/wk.`, tone: 'you' });
    N.awaiting = 'club';
    N.responseDue = addDays(gameState.currentDate, rand(3, 10));
    N.lastTouch = new Date(gameState.currentDate);
    N.msgLog.push({ text: `${p.name} will think it over.`, tone: 'info' });
    notify(`Contract offer sent to ${p.name} — expect a response within the week.`, 'info');
    renderNegotiation();
  }

  function completeTransfer(N) {
    const seller = gameState.clubs[N.clubId];
    const p = seller.players.find(x => x.id === N.playerId);
    if (!p) { gameState.negotiations = gameState.negotiations.filter(n => n.id !== N.id); return; }
    const balanceNow = gameState.finances?.balance ?? gameState.myClub.budget;
    if (N.agreedFee > balanceNow) {
      gameState.negotiations = gameState.negotiations.filter(n => n.id !== N.id);
      if (ui.activeNegotiationId === N.id) { ui.activeNegotiationId = null; closeModal(); }
      return notify(`Not enough funds to complete the ${p.name} deal — balance is ${money(balanceNow)}.`, 'error');
    }
    if (N.preSign) {
      if (!gameState.preContracts) gameState.preContracts = [];
      gameState.preContracts.push({
        id: `pre_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        playerData: { ...p },
        sellerClubId: N.clubId,
        sellerName: seller.name,
        agreedFee: N.agreedFee,
        agreedWage: N.agreedWage,
        agreedYears: N.contractLength || 3,
      });
      gameState.market = (gameState.market || []).filter(x => x.id !== N.playerId);
      notify(`Pre-contract agreed with ${p.name} — joins on ${money(N.agreedWage / 1000)}/wk when the window opens.`, 'success');
    } else {
      seller.players = seller.players.filter(x => x.id !== N.playerId);
      p.wage = N.agreedWage;
      p.contractEnd = DATA.contractEndAfterYears(gameState.currentDate, N.contractLength || 3);
      p.clubCareerGoals = p.clubCareerAssists = p.clubCareerApps = 0;
      gameState.myClub.players.push(p);
      recalcSqRating(gameState.myClub);
      recalcSqRating(seller);
      if (gameState.finances) gameState.finances.balance = Math.round((gameState.finances.balance - N.agreedFee) * 10) / 10;
      else gameState.myClub.budget = Math.round((gameState.myClub.budget - N.agreedFee) * 10) / 10;
      recordTransferExpense(N.agreedFee);
      gameState.market = (gameState.market || []).filter(x => x.id !== N.playerId);
      gameState.transferLog.unshift({ in: true, name: p.name, fee: N.agreedFee });
      notify(`Signed ${p.name} for ${money(N.agreedFee)} on ${money(N.agreedWage / 1000)}/wk!`, 'success');
    }
    gameState.negotiations = gameState.negotiations.filter(n => n.id !== N.id);
    if (ui.activeNegotiationId === N.id) { ui.activeNegotiationId = null; closeModal(); }
    updateSidebar();
    renderTransfers($('main-content'));
  }
  function showListingModal(playerId) {
    if (!ENGINE.isTransferWindowOpen(gameState)) return notify('Transfer window is closed.', 'error');
    const p = gameState.myClub.players.find(x => x.id === playerId);
    if (!p) return;
    const defaultPrice = p.value;
    showModal(`
      <div style="text-align:center">
        <h2 style="margin-bottom:4px">List ${esc(p.name)}</h2>
        <p class="text-muted" style="margin-bottom:16px">Market value: <span class="text-gold fw-700">${money(p.value)}</span></p>
        <div class="neg-field" style="margin-bottom:18px">
          <label>Asking price (£m)</label>
          <input id="listing-price-input" type="number" step="${p.value < 0.5 ? '0.01' : '0.1'}" min="0.01" value="${defaultPrice}">
        </div>
        <p class="text-muted" style="font-size:12px;margin-bottom:18px">Clubs will make offers over time. Higher prices may take longer to attract bids.</p>
        <div class="pm-actions" style="justify-content:center">
          <button class="btn-secondary" id="listing-cancel">Cancel</button>
          <button class="btn-gold" id="listing-confirm">List for Sale</button>
        </div>
      </div>`);
    $('listing-cancel').addEventListener('click', closeModal);
    $('listing-confirm').addEventListener('click', () => {
      const price = parseFloat($('listing-price-input').value);
      if (isNaN(price) || price <= 0) return notify('Enter a valid asking price.', 'error');
      listForSale(playerId, ENGINE.roundFee(price));
      closeModal();
    });
  }

  function listForSale(playerId, price) {
    const p = gameState.myClub.players.find(x => x.id === playerId);
    if (!p) return;
    p.listingPrice = price;
    notify(`${p.name} listed at ${money(price)}.`, 'success');
    renderTransfers($('main-content'));
  }

  function delistPlayer(playerId) {
    const p = gameState.myClub.players.find(x => x.id === playerId);
    if (!p) return;
    p.listingPrice = null;
    // Remove any pending incoming offers for this player
    gameState.negotiations = (gameState.negotiations || []).filter(n => !(n.type === 'incoming' && n.playerId === playerId));
    notify(`${p.name} removed from transfer list.`, 'info');
    renderTransfers($('main-content'));
  }

  // Actually moves the player to the buying club and settles the money — shared by
  // a direct Accept click and by resolveNegotiationResponses() once a counter the
  // AI club is willing to meet comes back.
  function completeIncomingSale(o) {
    const idx = gameState.myClub.players.findIndex(x => x.id === o.playerId);
    if (idx < 0) { gameState.negotiations = (gameState.negotiations || []).filter(n => n.id !== o.id); return notify('Player no longer in squad.', 'error'); }
    if (gameState.myClub.players.length <= 16) return notify('Squad too small to sell more players.', 'error');
    const p = gameState.myClub.players[idx];
    gameState.myClub.players.splice(idx, 1);
    recalcSqRating(gameState.myClub);
    if (!gameState.finances) gameState.myClub.budget = Math.round((gameState.myClub.budget + o.fee) * 10) / 10;
    recordTransferIncome(o.fee); // handles balance + seasonIncome.sales for the finances path
    gameState.tactics.lineup = gameState.tactics.lineup.filter(id => id !== o.playerId);
    if (gameState.tactics.lineup.length < 11) gameState.tactics.lineup = autoPickXI(gameState.myClub, activeTacticForm());
    // Actually move the player into the buying club's squad and spend their budget —
    // otherwise a player "sold to Chelsea" would just vanish from the league.
    const buyer = gameState.clubs[o.clubId];
    if (buyer) {
      p.clubId = buyer.id;
      p.transferListed = false;
      p.listingPrice = null;
      // Reset career-at-club stats — they start fresh at the new club
      p.clubCareerGoals = p.clubCareerAssists = p.clubCareerApps = 0;
      buyer.players.push(p);
      buyer.budget = Math.round(((buyer.budget || 0) - o.fee) * 10) / 10;
      recalcSqRating(buyer);
    }
    gameState.transferLog.unshift({ in: false, name: o.playerName, fee: o.fee });
    // Clear every other negotiation for this player too (e.g. a rival club's competing offer)
    gameState.negotiations = (gameState.negotiations || []).filter(n => n.playerId !== o.playerId);
    notify(`${o.playerName} sold to ${buyer ? buyer.name : o.clubName} for ${money(o.fee)}!`, 'success');
    updateSidebar();
    renderTransfers($('main-content'));
  }

  function acceptOffer(offerId) {
    const o = (gameState.negotiations || []).find(x => x.id === offerId);
    if (!o) return;
    completeIncomingSale(o);
  }

  function rejectOffer(offerId) {
    gameState.negotiations = (gameState.negotiations || []).filter(o => o.id !== offerId);
    notify('Offer rejected.', 'info');
    renderTransfers($('main-content'));
  }

  function showCounterModal(offerId) {
    const o = (gameState.negotiations || []).find(x => x.id === offerId);
    if (!o) return;
    // Opportunistic bids for an unlisted-but-expiring player have no listingPrice —
    // fall back to market value as the counter-offer baseline.
    const askingBase = o.listingPrice ?? o.marketValue ?? o.fee;
    const suggested = ENGINE.roundFee(askingBase);
    showModal(`
      <div style="text-align:center">
        <h2 style="margin-bottom:4px">Counter Offer</h2>
        <p class="text-muted" style="margin-bottom:6px">${esc(o.playerName)} · ${esc(o.clubName)}</p>
        <div class="pm-stats-grid" style="text-align:left;margin-bottom:16px">
          <div class="pm-stat"><span class="pm-stat-name">Their bid</span><span class="pm-stat-val text-gold">${money(o.fee)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Market value</span><span class="pm-stat-val">${money(o.marketValue || o.listingPrice)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">${o.listingPrice != null ? 'Your asking' : 'Suggested counter'}</span><span class="pm-stat-val">${money(askingBase)}</span></div>
        </div>
        <div class="neg-field" style="margin-bottom:18px">
          <label>Your counter (£m)</label>
          <input id="counter-price-input" type="number" step="${askingBase < 0.5 ? '0.01' : '0.1'}" min="0.01" value="${suggested}">
        </div>
        <div class="pm-actions" style="justify-content:center">
          <button class="btn-secondary" id="counter-cancel">Cancel</button>
          <button class="btn-primary" id="counter-submit">Send Counter</button>
        </div>
      </div>`);
    $('counter-cancel').addEventListener('click', closeModal);
    $('counter-submit').addEventListener('click', () => {
      const counter = parseFloat($('counter-price-input').value);
      if (isNaN(counter) || counter <= 0) return notify('Enter a valid price.', 'error');
      counterOffer(offerId, ENGINE.roundFee(counter));
      closeModal();
    });
  }

  // The AI club's actual accept/reject of this counter is decided later by
  // resolveNegotiationResponses() once responseDue arrives — no more instant
  // capitulate-or-walk in the same click.
  function counterOffer(offerId, counterFee) {
    const o = (gameState.negotiations || []).find(x => x.id === offerId);
    if (!o) return;
    if (counterFee <= o.fee) {
      return notify(`${o.clubName} won't accept less than their bid of ${money(o.fee)}.`, 'error');
    }
    o.lastCounter = counterFee;
    o.awaiting = 'club';
    o.responseDue = addDays(gameState.currentDate, rand(3, 10));
    o.lastTouch = new Date(gameState.currentDate);
    notify(`Counter of ${money(counterFee)} sent to ${o.clubName} — expect a response within the week.`, 'info');
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
    const hasKnockout = comp.knockout?.rounds?.length > 0;
    // default sub-tab: knockout view once in that stage, else table
    if (!ui.euroSubTab) ui.euroSubTab = (comp.stage === 'knockout' || comp.stage === 'done') ? 'knockout' : 'table';
    const subTab = ui.euroSubTab;

    const subTabs = `<div class="euro-sub-tabs">
      <button class="euro-sub-btn ${subTab==='table'?'active':''}" data-sub="table">Table</button>
      <button class="euro-sub-btn ${subTab==='knockout'&&hasKnockout?'active':''} ${hasKnockout?'':'disabled'}" data-sub="knockout" ${hasKnockout?'':'disabled'}>Knockout</button>
    </div>`;

    let body;
    if (subTab === 'knockout' && hasKnockout) {
      body = euKnockoutBracket(comp);
    } else {
      body = leaguePhaseTable(comp);
    }

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">European Competitions</div>
        <div class="view-subtitle">${gameState.myEuropeanComp ? 'You are in the ' + gameState.european[gameState.myEuropeanComp].name : 'Not qualified for Europe this season'}</div></div></div>
      <div class="table-tabs">${Object.keys(gameState.european).map(k =>
        `<button class="transfer-tab ${k===tab?'active':''}" data-e="${k}">${gameState.european[k].name}</button>`).join('')}</div>
      ${subTabs}
      ${body}`;

    m.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => {
      ui.euroTab = b.dataset.e;
      ui.euroSubTab = null; // reset sub-tab on competition switch
      renderEuropean(m);
    }));
    m.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      ui.euroSubTab = b.dataset.sub;
      renderEuropean(m);
    }));
    m.scrollTop = _st;
  }
  function noEuro() { return `<div class="view-header"><div class="view-title">European Competitions</div></div><div class="empty-state"><div class="empty-state-text">No European competitions configured.</div></div>`; }
  function leaguePhaseTable(comp) {
    const sorted = euTable(comp);
    const R = euBracketSize(comp);
    const directCut = R / 2, playoffCut = R / 2 + R;
    const rows = sorted.map((id, i) => {
      const c = gameState.clubs[id], s = comp.groupStats[id] || {};
      const zone = i < directCut ? 'ko-direct' : i < playoffCut ? 'ko-playoff' : '';
      const gd = euGd(comp, id);
      return `<tr class="${id===gameState.myClubId?'my-club':''}">
        <td class="lp-pos ${zone}">${i + 1}</td>
        <td class="lp-club">${c ? `${badge(c,'lp-badge')} <span>${esc(c.name)}</span>` : '?'}</td>
        <td>${s.p || 0}</td><td>${s.w || 0}</td><td>${s.d || 0}</td><td>${s.l || 0}</td>
        <td>${s.gf || 0}</td><td>${s.ga || 0}</td>
        <td>${gd >= 0 ? '+' : ''}${gd}</td><td class="fw-700">${s.pts || 0}</td></tr>`;
    }).join('');
    return `<div class="lp-legend">
        <span class="lp-key"><span class="lp-dot ko-direct"></span>Round of 16</span>
        <span class="lp-key"><span class="lp-dot ko-playoff"></span>Knockout playoff</span>
      </div>
      <table class="lp-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }
  function euKnockoutBracket(comp) {
    const rounds = (comp.knockout?.rounds || []).map(r => `
      <div class="knockout-round"><div class="knockout-round-title">${r.name}</div>
        <div class="knockout-ties">${r.ties.map(t => {
          const A = gameState.clubs[t.a], B = gameState.clubs[t.b];
          const mine = t.a === gameState.myClubId || t.b === gameState.myClubId;
          const aWon = t.winner === t.a, bWon = t.winner === t.b;
          if (t.twoLegged) {
            const pensNote = t.pens ? ' <span class="ko-pens">pens</span>' : t.aet ? ' <span class="ko-pens">aet</span>' : '';
            return `<div class="knockout-tie two-leg ${mine ? 'my-match' : ''}">
              <div class="ko-team ${aWon ? 'ko-winner' : ''}">${A ? badge(A,'ko-badge') : ''}<span>${A ? esc(A.name) : '?'}</span></div>
              <div class="ko-two-leg-scores">
                <span class="ko-agg">${t.aggA} – ${t.aggB}${pensNote}</span>
                <span class="ko-legs">${t.leg1.sa}–${t.leg1.sb} / ${t.leg2.sa}–${t.leg2.sb}</span>
              </div>
              <div class="ko-team ${bWon ? 'ko-winner' : ''}">${B ? badge(B,'ko-badge') : ''}<span>${B ? esc(B.name) : '?'}</span></div>
            </div>`;
          }
          const note = t.pens ? ' <span class="ko-pens">pens</span>' : t.aet ? ' <span class="ko-pens">aet</span>' : '';
          return `<div class="knockout-tie ${mine ? 'my-match' : ''}">
            <div class="ko-team ${aWon ? 'ko-winner' : ''}">${A ? badge(A,'ko-badge') : ''}<span>${A ? esc(A.name) : '?'}</span></div>
            <span class="ko-score">${t.sa} – ${t.sb}${note}</span>
            <div class="ko-team ${bWon ? 'ko-winner' : ''}">${B ? badge(B,'ko-badge') : ''}<span>${B ? esc(B.name) : '?'}</span></div>
          </div>`;
        }).join('')}</div></div>`).join('');
    const winner = comp.winner ? `<div class="knockout-round" style="text-align:center">
      <div class="knockout-round-title">★ Winner</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px">
        ${badge(gameState.clubs[comp.winner],'ko-badge-lg')}
        <span class="stat-big" style="font-size:22px">${esc(gameState.clubs[comp.winner].name)}</span>
      </div></div>` : '';
    return `<div class="knockout-bracket">${rounds}${winner}</div>`;
  }
  function euPts(comp, id) { return comp.groupStats[id]?.pts || 0; }
  function euGd(comp, id) { const s = comp.groupStats[id]; return s ? s.gf - s.ga : 0; }

  /* =============================================
     FINANCES — helpers
     ============================================= */

  function initFinances(club) {
    const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
    return {
      // Each club's own authored budget (already differentiated club-by-club in CLUBS_DATA),
      // not a flat per-reputation-star amount — a small National League club and the
      // division's best-funded side shouldn't start with an identical balance.
      balance:        club.budget != null ? club.budget : (FIN_INIT_BAL[rep] || 10),
      boardConfidence:50,
      sponsor:        _genSponsor(club, 50, false),
      sleeve:         null,   // sleeve sponsor slot — sold by the manager
      stadium:        null,   // stadium naming rights slot — sold by the manager
      kitDeal:        _genKitDeal(club),
      seasonIncome:   { tv:0, matchday:0, sponsorship:0, merchandise:0, prizes:0, sales:0 },
      seasonExpenses: { wages:0, transfers:0, agentFees:0, staff:0 },
      balanceHistory: [],
      weeksElapsed:   0,
      ffpRolling:     [],
      sponsorNeedsRenewal: false,
      kitNeedsRenewal: false,
      pendingGrant:   null,
      pendingSponsor: null,
      history:        [],
      ticketPricing:  'standard',
      boardFundsRequested: false,
      boardConfVoted: false,
      parachuteYears: 0,
    };
  }

  // Commercial sponsorship slots a club can sell. share = fraction of the shirt-front market rate.
  const SPONSOR_SLOTS = {
    shirt:   { label: 'Shirt Front',         share: 1.00, terms: [1, 2, 3] },
    sleeve:  { label: 'Sleeve',              share: 0.22, terms: [1, 2, 3] },
    stadium: { label: 'Stadium Naming Rights', share: 0.60, terms: [3, 5, 8] },
  };

  // Realistic shirt-front sponsorship market rate (£m/season), driven by division then club stature.
  // Sized so total commercial income (shirt + sleeve + stadium + kit) matches real club revenue:
  // PL £15-150m commercial, Championship £5-15m, L1 £1.5-4m, L2 £0.6-1.5m, NL £0.25-0.6m.
  function sponsorMarketAnnual(club) {
    const lvl = leagueLevel(club);
    const repFrac = (Math.max(1, Math.min(5, club.rep)) - 1) / 4;
    const base    = [0, 4, 2, 0.5, 0.2, 0.08][lvl];
    const repMult = 1 + repFrac * repFrac * [0, 14, 1.8, 1.0, 0.8, 0.6][lvl];
    return base * repMult;
  }

  function _genSponsor(club, confidence, goodSeason, slot = 'shirt') {
    const cfg = SPONSOR_SLOTS[slot] || SPONSOR_SLOTS.shirt;
    let annual = sponsorMarketAnnual(club) * cfg.share * (0.85 + Math.random() * 0.3);
    if (goodSeason) annual *= 1.10;
    if (confidence >= 65) annual *= 1.05;
    else if (confidence < 30) annual *= 0.88;
    const tier = annual >= 10 ? 3 : annual >= 0.5 ? 2 : 1;
    const pool = SPONSORS[tier - 1];
    const name = pool.names[Math.floor(Math.random() * pool.names.length)];
    const weeklyValue = Math.round(annual / 52 * 1e5) / 1e5;
    return { name, tier, slot, weeklyValue, seasonsLeft: Math.floor(Math.random() * 3) + 1,
             clauses: slot === 'shirt' ? _genSponsorClauses(club, weeklyValue) : [] };
  }

  // Performance clauses written into sponsor contracts — bonuses that pay out on results.
  function _genSponsorClauses(club, weeklyValue) {
    const r2 = (v) => Math.round(v * 100) / 100;
    const annual = weeklyValue * 52;
    const pool = [
      { type: 'win',       amount: r2(weeklyValue * 1.5) },   // per league win
      { type: 'title',     amount: r2(annual * 0.50) },        // win the league
      { type: 'topHalf',   amount: r2(annual * 0.15) },        // finish top half
    ];
    if (leagueLevel(club) > 1) pool.push({ type: 'promotion', amount: r2(annual * 0.40) });
    // Each deal carries 1-2 clauses
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    const picked = [];
    while (picked.length < n && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }

  function clauseLabel(c) {
    return { win: `${money(c.amount)} per league win`,
             title: `${money(c.amount)} for winning the league`,
             topHalf: `${money(c.amount)} for a top-half finish`,
             promotion: `${money(c.amount)} for promotion` }[c.type] || '';
  }

  function paySponsorClause(type, context) {
    const fin = gameState.finances;
    const c = fin?.sponsor?.clauses?.find(c => c.type === type);
    if (!c) return;
    fin.balance = Math.round((fin.balance + c.amount) * 100) / 100;
    fin.seasonIncome.sponsorship = Math.round((fin.seasonIncome.sponsorship + c.amount) * 100) / 100;
    if (type !== 'win') notify(`Sponsor clause triggered: ${money(c.amount)} from ${fin.sponsor.name} ${context}.`, 'success');
  }

  function _genKitDeal(club) {
    const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
    const makers = ['AdiSport','ProKit','StrikeX','NovaSport','EliteKit','AlphaWear'];
    const name = makers[Math.floor(Math.random() * makers.length)];
    // Annual kit deal in £m: club brand value (rep) or half the league shirt-market rate, whichever is higher.
    // Elite brands keep big kit deals even when relegated; ordinary clubs get paid for their division's exposure.
    const brandBase  = [0, 0.025, 0.2, 1.2, 10, 40][rep];
    const marketBase = sponsorMarketAnnual(club) * 0.5;
    const annualValue = Math.max(brandBase, marketBase) * (0.8 + Math.random() * 0.4);
    return { name, annualValue: Math.round(annualValue * 100) / 100, seasonsLeft: Math.floor(Math.random() * 3) + 2 };
  }

  function genSponsorOffers(club, confidence, goodSeason, slot = 'shirt') {
    const cfg = SPONSOR_SLOTS[slot] || SPONSOR_SLOTS.shirt;
    const offers = [];
    const usedNames = new Set();
    for (let i = 0; i < 3; i++) {
      const sp = _genSponsor(club, confidence - 10 + i * 12, goodSeason && i > 0, slot);
      if (usedNames.has(sp.name)) sp.name += ' Group';
      usedNames.add(sp.name);
      sp.seasonsLeft = cfg.terms[i]; // short/medium/long-term options
      sp.weeklyValue = Math.round(sp.weeklyValue * (1 + i * 0.06) * 1e5) / 1e5;
      offers.push(sp);
    }
    return offers;
  }

  function checkWageBudget() {
    const club = gameState.myClub;
    const balance = gameState.finances?.balance ?? club.budget;
    // Wage budget = 5% of current club balance
    const wageBudget = Math.round(balance * 0.05 * 100) / 100; // in £m/week
    const actualWages = club.players.reduce((s, p) => s + p.wage, 0) / 1000; // in £m/week
    if (actualWages > wageBudget) {
      if (!gameState.wageViolations) gameState.wageViolations = 0;
      gameState.wageViolations++;
      const excess = Math.round((actualWages - wageBudget) * 100) / 100;
      notify(`⚠ Wage warning: wage bill ${money(actualWages)}/wk exceeds budget (${money(wageBudget)}/wk). Reduce wages or sell players. [${gameState.wageViolations}/10]`, 'error');
      if (gameState.wageViolations >= 10) {
        // Deduct 10 league points
        const myStats = club.tableStats;
        if (myStats) myStats.points = myStats.points - 10;
        gameState.wageViolations = 0;
        notify('⛔ Financial Fair Play breach: 10 points deducted for sustained wage overspend!', 'error');
      }
    } else {
      // Back in compliance — reset counter
      if (gameState.wageViolations > 0) {
        gameState.wageViolations = 0;
        notify('✓ Wage bill back within budget limits.', 'success');
      }
    }
  }

  function recordBalanceSnapshot() {
    const fin = gameState?.finances;
    if (!fin) return;
    if (!fin.balanceHistory) fin.balanceHistory = [];
    const t = gameState.currentDate.getTime();
    const last = fin.balanceHistory[fin.balanceHistory.length - 1];
    if (last && last.t === t) { last.v = fin.balance; return; } // update same-day entry in place
    fin.balanceHistory.push({ t, v: fin.balance });
    if (fin.balanceHistory.length > 180) fin.balanceHistory.splice(0, fin.balanceHistory.length - 180);
  }

  // isGameweek: whether this tick corresponds to an actual league fixture round being
  // broadcast — TV equal-share money is real-world tied to league gameweeks, not to cup/
  // European fixtures (which carry their own separate prize-money model) or to preseason
  // weeks where no league football is being played at all.
  function tickFinances(weeks, isGameweek = true) {
    const fin = gameState.finances;
    if (!fin) return;
    const club = gameState.myClub;
    const rep  = Math.max(1, Math.min(5, Math.round(club.rep)));
    const weeklyTV      = isGameweek ? leagueTV(club) / 52 : 0;
    const weeklyKitDeal = (fin.kitDeal?.annualValue || 0) / 52;
    const formW = (club.form || []).slice(-3).filter(f => f === 'W').length;
    // Sponsorship gets a tiny form uplift (1-2% per recent win, brands want association with success).
    const sponsorFormMult = 1 + formW * 0.008;
    const weeklySponsor = ((fin.sponsor?.weeklyValue || 0) + (fin.sleeve?.weeklyValue || 0) + (fin.stadium?.weeklyValue || 0) + weeklyKitDeal) * sponsorFormMult;
    const weeklyMerch   = weeklyMerchandise(club);
    const weeklyWages   = club.players.reduce((s, p) => s + p.wage, 0) / 1000;
    const weeklyCoaches    = ((gameState.staff?.coaches) || []).reduce((s, c) => s + (c.weeklyWage || 0) / 1000, 0);
    const weeklyStaff      = [0, 0.002, 0.007, 0.055, 0.220, 0.700][rep] + (gameState.scouts || []).reduce((s, sc) => s + (sc.weeklyWage || 0) / 1000, 0) + weeklyCoaches;
    const acLvl  = club.facilities?.academy  || rep;
    const trLvl  = club.facilities?.training || rep;
    const rhLvl  = club.facilities?.rehab    || rep;
    const stLvl  = club.facilities?.stadium  || rep;
    const weeklyAcademy    = [0, 0.001, 0.003, 0.015, 0.050, 0.150][acLvl]
      + (club.youthPlayers || []).length * 0.0003; // £300/wk per youth player
    const weeklyFacilities = [0, 0.0005, 0.0015, 0.007, 0.022, 0.060][stLvl]
      + [0, 0.0003, 0.001,  0.005, 0.016, 0.045][trLvl]
      + [0, 0.0002, 0.0006, 0.003, 0.009, 0.025][rhLvl]
      + Object.values(club.trainingUpgrades || {}).filter(Boolean).length * 0.0015 // £1.5k/wk each upgrade
      + Object.values(club.renovations || {}).filter(Boolean).length * 0.002;      // £2k/wk each reno
    const weeklyRetraining = Object.keys(club.retraining || {}).length * 0.002;   // £2k/wk per player
    const income   = (weeklyTV + weeklySponsor + weeklyMerch) * weeks;
    const expenses = (weeklyWages + weeklyStaff + weeklyAcademy + weeklyFacilities + weeklyRetraining) * weeks;
    fin.balance            = Math.round((fin.balance + income - expenses) * 100) / 100;
    // Record balance history snapshot (~weekly); keep last 26 entries (≈6 months).
    recordBalanceSnapshot();
    fin.seasonIncome.tv          += Math.round(weeklyTV * weeks * 100) / 100;
    fin.seasonIncome.sponsorship += Math.round(weeklySponsor * weeks * 100) / 100;
    fin.seasonIncome.merchandise = Math.round(((fin.seasonIncome.merchandise || 0) + weeklyMerch * weeks) * 100) / 100;
    fin.seasonExpenses.wages     += Math.round(weeklyWages * weeks * 100) / 100;
    fin.seasonExpenses.staff     += Math.round(weeklyStaff * weeks * 100) / 100;
    fin.seasonExpenses.academy    = Math.round(((fin.seasonExpenses.academy   || 0) + weeklyAcademy    * weeks) * 100) / 100;
    fin.seasonExpenses.facilities = Math.round(((fin.seasonExpenses.facilities || 0) + weeklyFacilities * weeks) * 100) / 100;
    fin.seasonExpenses.retraining = Math.round(((fin.seasonExpenses.retraining || 0) + weeklyRetraining * weeks) * 100) / 100;
    fin.weeksElapsed += weeks;
    if (fin.balance < -10 && fin.balance > -11) {
      fin.boardConfidence = Math.max(0, fin.boardConfidence - 4);
      notify('Finances critical — club is deeply in the red! Board confidence falling.', 'error');
    } else if (fin.balance < 0 && fin.balance > -2) {
      notify('Club finances are in the red — expenses exceed all income.', 'warning');
    }

    // Wage cap: 5% of current balance. Track breach weeks and penalise if sustained.
    const wageCapNow = Math.max(0.01, fin.balance * 0.05);
    if (weeklyWages > wageCapNow) {
      fin.overWageCapWeeks = (fin.overWageCapWeeks || 0) + weeks;
      const w = fin.overWageCapWeeks;
      if (w >= 6 && w < 7) {
        addInboxMsg('club_news',
          'FFP Warning: wage cap breach',
          `Your weekly wage bill (${money(weeklyWages)}/wk) exceeds 5% of the club balance (${money(wageCapNow)}/wk cap). You have a few weeks to reduce it before points are deducted.`);
        notify('FFP warning — wages over 5% of club balance. Sort it out.', 'warning');
      } else if (w >= 10 && w % 4 < weeks) {
        const deduction = 10;
        gameState.myClub.tableStats.points = (gameState.myClub.tableStats.points || 0) - deduction;
        addInboxMsg('club_news',
          `${deduction}-point deduction: FFP breach`,
          `Your wage bill (${money(weeklyWages)}/wk) has exceeded the 5% balance cap for ${Math.round(w)} weeks. A ${deduction}-point deduction has been applied. Reduce wages to stop further penalties.`);
        notify(`${deduction}-point deduction for sustained FFP breach!`, 'error');
        fin.boardConfidence = Math.max(0, fin.boardConfidence - 12);
      }
    } else {
      if ((fin.overWageCapWeeks || 0) > 0) fin.overWageCapWeeks = 0;
    }
  }

  function awardMatchdayIncome(isHome) {
    const fin = gameState.finances;
    if (!fin || !isHome) return;
    const club = gameState.myClub;
    const base = matchdayBase(club) / 19; // ~19 home league games
    const formBonus = (club.form || []).slice(-3).filter(f => f === 'W').length * 0.04;
    const priceMult = effectivePriceMult(club, fin, leagueLevel(club));
    const income = Math.round(base * (1 + formBonus) * priceMult * 100) / 100;
    fin.balance += income;
    fin.seasonIncome.matchday += income;
  }

  // What this fixture is worth: TV share always lands this week regardless of
  // the game, plus matchday gate on home league fixtures or a UEFA per-win
  // bonus on European league-phase nights (cup fixtures carry no gate model).
  function previewMatchIncome(next) {
    const fin = gameState.finances;
    if (!fin || !next) return '';
    const club = gameState.myClub;
    const myIsHome = next.home === gameState.myClubId;
    const weeklyTV = leagueTV(club) / 52;
    const parts = [`TV <b>+${money(weeklyTV)}</b>`];
    if (next.type === 'european' && next.comp) {
      const scale = { champions_league: 1, europa_league: 0.38, conference_league: 0.16 }[next.comp] || 0;
      parts.push(`Win bonus <b>+${money(Math.round(1.8 * scale * 10) / 10)}</b>`);
    } else if (next.type !== 'cup' && myIsHome) {
      const base = matchdayBase(club) / 19;
      const priceMult = effectivePriceMult(club, fin, leagueLevel(club));
      parts.push(`Matchday <b>+${money(Math.round(base * priceMult * 100) / 100)}</b>`);
    }
    return parts.join(' &middot; ');
  }

  function recordTransferExpense(fee) {
    const fin = gameState.finances;
    if (!fin) return;
    const agentFee = Math.round(fee * 0.05 * 10) / 10; // 5% agent fee from balance
    fin.balance = Math.round((fin.balance - agentFee) * 100) / 100;
    fin.seasonExpenses.transfers += fee;
    fin.seasonExpenses.agentFees += agentFee;
  }

  function recordTransferIncome(fee) {
    const fin = gameState.finances;
    if (!fin) return;
    fin.balance = Math.round((fin.balance + fee) * 100) / 100;
    fin.seasonIncome.sales += fee;
  }

  // European prize money modelled on UEFA distributions: participation fee,
  // per-win money in the league phase, then escalating bonuses per knockout round reached.
  function calcEuroPrize(euroComp) {
    if (!euroComp) return 0;
    const comp = gameState.european?.[euroComp];
    const myId = gameState.myClubId;
    if (!comp || !(comp.clubs || []).includes(myId)) return 0;
    const scale = { champions_league: 1, europa_league: 0.38, conference_league: 0.16 }[euroComp] || 0;
    let prize = 16;                                              // participation (CL £16m base)
    prize += (gameState.myClub.europeanStats?.won || 0) * 1.8;   // per league-phase win
    const stageBonus = { 'Knockout Playoff': 1, 'Round of 16': 9.5, 'Quarter-finals': 11, 'Semi-finals': 13, 'Final': 16.5 };
    (comp.knockout?.rounds || []).forEach(r => {
      if ((r.ties || []).some(t => t.a === myId || t.b === myId)) prize += stageBonus[r.name] || 0;
    });
    if (comp.winner === myId) prize += 6;
    return Math.round(prize * scale * 10) / 10;
  }

  function totalSeasonIncome(fin)   { return Object.values(fin.seasonIncome).reduce((s,v) => s+(v||0), 0); }
  function totalSeasonExpenses(fin) { return Object.values(fin.seasonExpenses).reduce((s,v) => s+(v||0), 0); }

  function finaliseSeasonFinances(pos, league, euroComp) {
    const fin = gameState.finances;
    if (!fin) return { prize: 0, euroPrize: 0 };
    const posIdx    = Math.max(0, Math.min(pos - 1, PRIZE_BY_POS.length - 1));
    const levelMult = PRIZE_LEVEL_MULT[Math.min((league.level || 1) - 1, PRIZE_LEVEL_MULT.length - 1)];
    const prize     = Math.round(PRIZE_BY_POS[posIdx] * levelMult * 10) / 10;
    const euroPrize  = calcEuroPrize(euroComp);
    fin.seasonIncome.prizes += prize + euroPrize;
    fin.balance = Math.round((fin.balance + prize + euroPrize) * 100) / 100;
    // Sponsor performance clauses settled at season end
    const tableSize = ENGINE.getLeagueTable(gameState, gameState.myClub.league).length || 20;
    if (pos === 1) paySponsorClause('title', 'for winning the league');
    if (pos <= Math.ceil(tableSize / 2)) paySponsorClause('topHalf', 'for a top-half finish');
    const net = totalSeasonIncome(fin) - totalSeasonExpenses(fin);
    fin.ffpRolling.push(Math.round(net * 10) / 10);
    if (fin.ffpRolling.length > 3) fin.ffpRolling.shift();
    // Decrement sponsor/kit seasons
    if (fin.sponsor) { fin.sponsor.seasonsLeft--; if (fin.sponsor.seasonsLeft <= 0) fin.sponsorNeedsRenewal = true; }
    if (fin.kitDeal) { fin.kitDeal.seasonsLeft--; if (fin.kitDeal.seasonsLeft <= 0) fin.kitNeedsRenewal = true; }
    ['sleeve', 'stadium'].forEach(slot => {
      if (fin[slot]) {
        fin[slot].seasonsLeft--;
        if (fin[slot].seasonsLeft <= 0) {
          notify(`${SPONSOR_SLOTS[slot].label} deal with ${fin[slot].name} has expired — sell the slot again in Finances.`, 'warning');
          fin[slot] = null;
        }
      }
    });
    return { prize, euroPrize };
  }

  function updateBoardConfidence(verdict, pos, leagueSize) {
    const fin = gameState.finances;
    if (!fin) return;
    if (verdict === 'success')       fin.boardConfidence = Math.min(100, fin.boardConfidence + 18);
    else if (verdict === 'budget_cut') fin.boardConfidence = Math.max(0, fin.boardConfidence - 18);
    else if (verdict === 'sacked')   fin.boardConfidence = Math.max(0, fin.boardConfidence - 35);
    const posRatio = pos / leagueSize;
    if (pos === 1)             fin.boardConfidence = Math.min(100, fin.boardConfidence + 12);
    else if (posRatio <= 0.15) fin.boardConfidence = Math.min(100, fin.boardConfidence + 6);
    else if (posRatio >= 0.85) fin.boardConfidence = Math.max(0,  fin.boardConfidence - 8);
    if (fin.balance > 50)      fin.boardConfidence = Math.min(100, fin.boardConfidence + 5);
    else if (fin.balance < -5) fin.boardConfidence = Math.max(0,  fin.boardConfidence - 10);
    fin.boardConfidence = Math.round(fin.boardConfidence);
  }

  function calcBoardGrant(club, fin, pos, leagueSize) {
    const rep  = Math.max(1, Math.min(5, Math.round(club.rep)));
    const base = FIN_BASE_GRANT[rep] || 8;
    const h    = fin.boardConfidence;
    const confMult = h >= 85 ? 1.65 : h >= 70 ? 1.30 : h >= 55 ? 1.05 : h >= 35 ? 0.78 : h >= 20 ? 0.52 : 0.28;
    const posMult  = (pos / leagueSize) <= 0.05 ? 1.28 : (pos / leagueSize) <= 0.2 ? 1.12 : (pos / leagueSize) >= 0.8 ? 0.82 : 1.0;
    const balMult  = fin.balance > base * 1.5 ? 1.15 : fin.balance < 0 ? 0.62 : 1.0;
    return Math.max(0.5, Math.round(base * confMult * posMult * balMult * 10) / 10);
  }

  function recordFinancialHistory(season, pos, grant) {
    const fin = gameState.finances;
    if (!fin) return;
    fin.history.push({
      season, pos, grant,
      income:    Math.round(totalSeasonIncome(fin) * 10) / 10,
      expenses:  Math.round(totalSeasonExpenses(fin) * 10) / 10,
      profit:    Math.round((totalSeasonIncome(fin) - totalSeasonExpenses(fin)) * 10) / 10,
      balance:   Math.round(fin.balance * 10) / 10,
      confidence:fin.boardConfidence,
    });
  }

  function ffpStatus(fin) {
    if (!fin || !fin.ffpRolling.length) return { ok: true, rolling: 0, label: 'Compliant' };
    const rolling = fin.ffpRolling.reduce((s, v) => s + (v || 0), 0);
    const limit   = -105;
    return { ok: rolling >= limit, rolling: Math.round(rolling * 10) / 10,
      label: rolling >= 0 ? 'Profitable' : rolling >= -35 ? 'Monitoring' : rolling >= -70 ? 'Warning' : 'Breach Risk' };
  }

  function genKitOffers(club) {
    const offers = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      const kd = _genKitDeal(club);
      if (used.has(kd.name)) kd.name += ' Pro';
      used.add(kd.name);
      kd.seasonsLeft = i + 2; // 2/3/4-yr terms
      kd.annualValue = Math.round(kd.annualValue * (1 + i * 0.05) * 100) / 100;
      offers.push(kd);
    }
    return offers;
  }

  // Negotiate a sponsor/kit offer: success raises the value; failure may make them walk away.
  // Chance improves with board confidence and league position.
  function negotiateDeal(offer, valueKey) {
    const fin   = gameState.finances;
    const table = ENGINE.getLeagueTable(gameState, gameState.myClub.league);
    const pos   = ENGINE.getMyPosition(gameState) || Math.ceil(table.length / 2);
    const posBonus = (1 - pos / Math.max(table.length, 1)) * 0.25;
    const chance = 0.35 + (fin?.boardConfidence || 50) / 250 + posBonus;
    offer.negotiated = true;
    if (Math.random() < chance) {
      const uplift = 0.12 + Math.random() * 0.18;
      offer[valueKey] = Math.round(offer[valueKey] * (1 + uplift) * 1e5) / 1e5;
      return { ok: true, uplift };
    }
    if (Math.random() < 0.5) return { ok: false, withdrawn: false };
    offer.withdrawn = true;
    return { ok: false, withdrawn: true };
  }

  // Generic deal-picker modal with Accept + Negotiate per offer.
  // cfg: { title, blurb, offers, valueKey, valueFmt, subLine, onAccept }
  function showDealModal(cfg) {
    const render = () => {
      showModal(`
        <div class="sv-modal">
          <h2 style="margin-bottom:4px">${cfg.title}</h2>
          <p class="text-muted" style="font-size:12px;margin-bottom:16px">${cfg.blurb}</p>
          ${cfg.offers.map((o, i) => `
            <div class="deal-offer-card" style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px;${o.withdrawn ? 'opacity:.45' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div>
                  <div style="font-weight:700;font-size:14px">${esc(o.name)}${o.negotiated && !o.withdrawn ? ' <span style="font-size:10px;color:var(--accent-gold)">NEGOTIATED</span>' : ''}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${cfg.subLine(o)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;color:var(--accent);font-size:15px">${cfg.valueFmt(o)}</div>
                </div>
              </div>
              ${o.withdrawn
                ? `<div style="margin-top:8px;font-size:11px;color:var(--accent-red)">Offer withdrawn — they walked away from talks.</div>`
                : `<div style="display:flex;gap:8px;margin-top:10px">
                     <button class="deal-accept btn-primary btn-sm" data-idx="${i}" style="flex:1">Accept</button>
                     <button class="deal-negotiate btn-secondary btn-sm" data-idx="${i}" style="flex:1" ${o.negotiated ? 'disabled' : ''}>${o.negotiated ? 'Final Offer' : 'Negotiate ↑'}</button>
                   </div>`}
            </div>`).join('')}
          <p class="text-muted" style="font-size:11px">Negotiating can raise an offer 12–30%, but push too hard and they may walk away. One attempt per partner.</p>
        </div>`);
      document.querySelectorAll('.deal-accept').forEach(btn => btn.addEventListener('click', () => {
        cfg.onAccept(cfg.offers[parseInt(btn.dataset.idx)]);
        closeModal();
        updateSidebar();
      }));
      document.querySelectorAll('.deal-negotiate').forEach(btn => btn.addEventListener('click', () => {
        const o = cfg.offers[parseInt(btn.dataset.idx)];
        const res = negotiateDeal(o, cfg.valueKey);
        if (res.ok) notify(`${o.name} agreed to improve their offer by ${Math.round(res.uplift * 100)}%!`, 'success');
        else if (res.withdrawn) notify(`${o.name} pulled out of negotiations.`, 'error');
        else notify(`${o.name} held firm — this is their final offer.`, 'warning');
        render();
      }));
    };
    render();
  }

  function showSponsorRenewalModal() {
    const fin = gameState.finances;
    if (!fin || !fin.sponsorNeedsRenewal) return;
    const club   = gameState.myClub;
    const offers = genSponsorOffers(club, fin.boardConfidence, !!fin.lastSeasonGood);
    const tierLabels = ['', 'Regional', 'National', 'Global'];
    showDealModal({
      title: 'Shirt Sponsor Negotiation',
      blurb: 'Your shirt sponsor deal has expired. Pick a partner — and negotiate for more money if you dare.',
      offers,
      valueKey: 'weeklyValue',
      valueFmt: (o) => `${money(o.weeklyValue)}/wk <span style="font-size:11px;color:var(--text-muted)">(${money(o.weeklyValue * 52)}/season)</span>`,
      subLine:  (o) => `${tierLabels[o.tier]} sponsor · ${o.seasonsLeft} season contract` +
        (o.clauses?.length ? `<div style="margin-top:4px;color:var(--accent-gold)">Clauses: ${o.clauses.map(clauseLabel).join(' · ')}</div>` : ''),
      onAccept: (sp) => {
        fin.sponsor = sp;
        fin.sponsorNeedsRenewal = false;
        notify(`Signed ${sp.name} as shirt sponsor — ${money(sp.weeklyValue)}/wk for ${sp.seasonsLeft} season(s)!`, 'success');
      },
    });
  }

  function showKitRenewalModal() {
    const fin = gameState.finances;
    if (!fin || !fin.kitNeedsRenewal) return;
    const offers = genKitOffers(gameState.myClub);
    showDealModal({
      title: 'Kit Manufacturer Negotiation',
      blurb: 'Your kit deal has expired. Choose a manufacturer — longer terms pay slightly more per year.',
      offers,
      valueKey: 'annualValue',
      valueFmt: (o) => `${money(o.annualValue)}/season`,
      subLine:  (o) => `Kit manufacturer · ${o.seasonsLeft} season contract`,
      onAccept: (kd) => {
        fin.kitDeal = kd;
        fin.kitNeedsRenewal = false;
        notify(`Signed ${kd.name} kit deal — ${money(kd.annualValue)}/season for ${kd.seasonsLeft} seasons!`, 'success');
      },
    });
  }

  // Sell an open commercial slot (sleeve / stadium naming rights)
  function showSlotSponsorModal(slot) {
    const fin = gameState.finances;
    if (!fin || fin[slot]) return;
    const cfg = SPONSOR_SLOTS[slot];
    const offers = genSponsorOffers(gameState.myClub, fin.boardConfidence, !!fin.lastSeasonGood, slot);
    const tierLabels = ['', 'Regional', 'National', 'Global'];
    showDealModal({
      title: `${cfg.label} Sponsorship`,
      blurb: `Sell your ${cfg.label.toLowerCase()} to a commercial partner. Longer terms lock in today's rate — risky if you expect promotion.`,
      offers,
      valueKey: 'weeklyValue',
      valueFmt: (o) => `${money(o.weeklyValue)}/wk <span style="font-size:11px;color:var(--text-muted)">(${money(o.weeklyValue * 52)}/season)</span>`,
      subLine:  (o) => `${tierLabels[o.tier]} partner · ${o.seasonsLeft} season contract`,
      onAccept: (sp) => {
        fin[slot] = sp;
        notify(`${cfg.label} sold to ${sp.name} — ${money(sp.weeklyValue)}/wk for ${sp.seasonsLeft} season(s)!`, 'success');
      },
    });
  }

  // Buy out a sponsor contract early: costs 50% of the deal's remaining value.
  function terminateSponsorDeal(slot) {
    const fin  = gameState.finances;
    const deal = slot === 'shirt' ? fin?.sponsor : fin?.[slot];
    if (!deal) return;
    const penalty = Math.round(deal.weeklyValue * 52 * deal.seasonsLeft * 0.5 * 100) / 100;
    const cfg = SPONSOR_SLOTS[slot];
    showModal(`
      <div style="max-width:360px">
        <h2 style="margin-bottom:8px">Terminate ${cfg.label} Deal</h2>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Buy out the ${esc(deal.name)} contract early so you can re-sell the slot at current market rates.</p>
        <div style="background:var(--surface2);border-radius:8px;padding:14px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Remaining value</span><span>${money(deal.weeklyValue * 52 * deal.seasonsLeft)} (${deal.seasonsLeft} season${deal.seasonsLeft !== 1 ? 's' : ''})</span></div>
          <div style="display:flex;justify-content:space-between"><span>Buyout penalty (50%)</span><span style="color:var(--accent-red)">−${money(penalty)}</span></div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="spn-term-confirm" class="btn-primary" style="flex:1">Pay ${money(penalty)} &amp; Terminate</button>
          <button id="spn-term-cancel" class="btn-secondary" style="flex:1">Cancel</button>
        </div>
      </div>`);
    $('spn-term-cancel').addEventListener('click', closeModal);
    $('spn-term-confirm').addEventListener('click', () => {
      fin.balance = Math.round((fin.balance - penalty) * 100) / 100;
      if (slot === 'shirt') { fin.sponsor = null; fin.sponsorNeedsRenewal = true; }
      else fin[slot] = null;
      notify(`${cfg.label} deal with ${deal.name} terminated — ${money(penalty)} buyout paid.`, 'warning');
      closeModal();
      renderView('finances');
      updateSidebar();
    });
  }

  /* ---------------------------------------------
     FINANCES — view
     --------------------------------------------- */
  function renderFinances(m) {
    const club = gameState.myClub;
    const fin  = gameState.finances;

    // Legacy fallback: no finances object (old save)
    if (!fin) {
      const rep = club.rep;
      const tv = rep * 6, sponsor = rep * 3.5, matchday = rep * 1.4, prize = rep * 2;
      const income = tv + sponsor + matchday + prize;
      const wages = club.players.reduce((s,p) => s+p.wage,0)/1000 * 12;
      const profit = income - wages - rep * 1.5;
      m.innerHTML = `<div class="view-header"><div><div class="view-title">Finances</div><div class="view-subtitle">Season ${gameState.season} (estimate)</div></div></div>
        <div class="finances-grid">
          <div class="card"><div class="card-title">Club Balance</div><div class="stat-big" style="font-size:28px">${money(gameState.finances?.balance ?? club.budget)}</div></div>
          <div class="card"><div class="card-title">Est. Annual Profit</div><div class="stat-big" style="font-size:28px;color:${profit>=0?'var(--accent)':'var(--accent-red)'}">${money(profit)}</div></div>
        </div>`;
      return;
    }

    const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
    const level = leagueLevel(club);
    const weeklyWages   = club.players.reduce((s, p) => s + p.wage, 0) / 1000;
    const weeklyTV      = leagueTV(club) / 52;
    const weeklyKitDeal = (fin.kitDeal?.annualValue || 0) / 52;
    const weeklySponsor = (fin.sponsor?.weeklyValue || 0) + (fin.sleeve?.weeklyValue || 0) + (fin.stadium?.weeklyValue || 0) + weeklyKitDeal;
    const weeklyMerch   = matchdayBase(club) * 0.22 / 52; // use deterministic avg for projections
    const weeklyCoachesProj = ((gameState.staff?.coaches)||[]).reduce((s,c)=>s+(c.weeklyWage||0)/1000,0);
    const weeklyStaff   = [0, 0.002, 0.007, 0.055, 0.220, 0.700][rep]
      + (gameState.scouts||[]).reduce((s,sc)=>s+(sc.weeklyWage||0)/1000,0) + weeklyCoachesProj;
    // Matchday income: only show when there's actually a home league game within 7 days.
    const nextFix = ENGINE.getNextFixture(gameState);
    const thisWeekHomeGame = nextFix
      && (nextFix.home === gameState.myClubId)
      && (!nextFix.type || nextFix.type === 'league')
      && (nextFix.date - gameState.currentDate <= 7 * 24 * 3600 * 1000);
    const weeklyMatchdayAvg = matchdayBase(club) * effectivePriceMult(club, fin, level) / 19;
    const acLvlP  = club.facilities?.academy  || rep;
    const trLvlP  = club.facilities?.training || rep;
    const rhLvlP  = club.facilities?.rehab    || rep;
    const stLvlP  = club.facilities?.stadium  || rep;
    const weeklyAcademy    = [0, 0.001, 0.003, 0.015, 0.050, 0.150][acLvlP]
      + (club.youthPlayers||[]).length * 0.0003;
    const weeklyFacilities = [0, 0.0005, 0.0015, 0.007, 0.022, 0.060][stLvlP]
      + [0, 0.0003, 0.001, 0.005, 0.016, 0.045][trLvlP]
      + [0, 0.0002, 0.0006, 0.003, 0.009, 0.025][rhLvlP]
      + Object.values(club.trainingUpgrades||{}).filter(Boolean).length * 0.0015
      + Object.values(club.renovations||{}).filter(Boolean).length * 0.002;
    const weeklyRetraining = Object.keys(club.retraining||{}).length * 0.002;
    const weeklyIncome  = weeklyTV + weeklySponsor + weeklyMerch + (thisWeekHomeGame ? weeklyMatchdayAvg : 0);
    const weeklyExpense = weeklyWages + weeklyStaff + weeklyAcademy + weeklyFacilities + weeklyRetraining;
    const weeklyNet     = weeklyIncome - weeklyExpense;

    const projTV       = leagueTV(club);
    const projSponsor  = weeklySponsor * 52;
    const projMatchday = matchdayBase(club) * effectivePriceMult(club, fin, level);
    const projMerch    = weeklyMerch * 52;
    const projWages    = weeklyWages * 52;
    const projStaff    = weeklyStaff * 52;
    const projAcademy     = weeklyAcademy * 52;
    const projFacilities  = weeklyFacilities * 52;
    const projRetraining  = weeklyRetraining * 52;
    const projPrize    = PRIZE_BY_POS[9] * PRIZE_LEVEL_MULT[Math.min((DATA.LEAGUES[club.league]?.level||1)-1,4)];
    const projIncome   = projTV + projSponsor + projMatchday + projMerch + projPrize;
    const projExpenses = projWages + projStaff + projAcademy + projFacilities + projRetraining;
    const projProfit   = projIncome - projExpenses;

    const totalInc  = totalSeasonIncome(fin);
    const totalExp  = totalSeasonExpenses(fin);
    const seasonNet = totalInc - totalExp;
    const maxV      = Math.max(projIncome, projExpenses, 1);
    const bar = (label, val, cls) =>
      `<div class="fin-bar-row"><span class="fin-bar-label">${label}</span>
       <div class="fin-bar-track"><div class="fin-bar-fill ${cls}" style="width:${Math.min(100, val/maxV*100)}%"></div></div>
       <span class="fin-bar-val ${cls==='income'?'pos':'neg'}">${money(val)}</span></div>`;

    const balColor  = fin.balance >= 0 ? 'var(--accent)' : 'var(--accent-red)';
    const netColor  = seasonNet >= 0 ? 'var(--accent)' : 'var(--accent-red)';
    const h         = fin.boardConfidence;
    const hapColor  = h >= 70 ? 'var(--accent)' : h >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)';
    const hapLabel  = h >= 85 ? 'Delighted' : h >= 70 ? 'Satisfied' : h >= 50 ? 'Steady' : h >= 35 ? 'Concerned' : h >= 20 ? 'Angry' : 'Furious';
    const ffp       = ffpStatus(fin);
    const ffpColor  = ffp.ok ? (ffp.rolling >= 0 ? 'var(--accent)' : 'var(--accent-gold)') : 'var(--accent-red)';
    const tierLabels = ['','Regional','National','Global'];

    const grantNote = (() => {
      const grant = calcBoardGrant(club, fin, ENGINE.getMyPosition(gameState) || Math.ceil(ENGINE.getLeagueTable(gameState, club.league).length/2), ENGINE.getLeagueTable(gameState, club.league).length || 20);
      return h >= 70
        ? `Board pleased — next season's grant est. <strong>${money(grant)}</strong>`
        : h >= 40
          ? `Board neutral — next season's grant est. <strong>${money(grant)}</strong>`
          : `Board unhappy — next season's grant est. <strong>${money(grant)}</strong>. Results must improve.`;
    })();

    const wageCapWeekly = Math.max(0.01, (fin.balance || 0) * 0.05);
    const wageUsePct    = Math.min(100, Math.round(weeklyWages / Math.max(wageCapWeekly, 0.01) * 100));
    const wageBarColor  = wageUsePct >= 95 ? 'var(--accent-red)' : wageUsePct >= 80 ? 'var(--accent-gold)' : 'var(--accent)';

    const leagueTable = ENGINE.getLeagueTable(gameState, club.league);
    const myPos = ENGINE.getMyPosition(gameState) || Math.ceil(leagueTable.length / 2);
    const fundReqAmt  = Math.round(calcBoardGrant(club, fin, myPos, leagueTable.length || 20) * 0.38 * 10) / 10;
    const canRequestFunds = !fin.boardFundsRequested && h >= 25;
    const investableBalance = Math.max(0, Math.round(fin.balance * 10) / 10);

    const historyHtml = fin.history.length ? `
      <div class="card">
        <div class="card-title">Financial History</div>
        <div style="overflow-x:auto">
        <table class="league-table" style="font-size:11px;min-width:520px">
          <thead><tr>
            <th>Season</th><th>Pos</th><th>Income</th><th>Expenses</th><th>Net</th><th>Balance</th><th>Board Grant</th><th>Conf.</th>
          </tr></thead>
          <tbody>${fin.history.map(h => `<tr>
            <td>${h.season}</td>
            <td>${ordinal(h.pos)}</td>
            <td class="text-accent">${money(h.income)}</td>
            <td style="color:var(--accent-red)">${money(h.expenses)}</td>
            <td style="color:${h.profit>=0?'var(--accent)':'var(--accent-red)'}">${h.profit>=0?'+':''}${money(h.profit)}</td>
            <td style="color:${h.balance>=0?'var(--accent)':'var(--accent-red)'}">${money(h.balance)}</td>
            <td style="color:var(--accent-gold)">${money(h.grant)}</td>
            <td style="color:${h.confidence>=70?'var(--accent)':h.confidence>=40?'var(--accent-gold)':'var(--accent-red)'}">${h.confidence}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : '';

    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Finances</div><div class="view-subtitle">${esc(club.name)} · Season ${gameState.season}</div></div></div>

      <div class="finances-grid fin-3col">
        <div class="card">
          <div class="card-title">Club Balance</div>
          <div class="stat-big" style="font-size:26px;color:${balColor}">${money(fin.balance)}</div>
          <div class="stat-label">${fin.balance < 0 ? '⚠ Club is insolvent' : 'Running bank balance'}</div>
        </div>
        <div class="card">
          <div class="card-title">Available Funds</div>
          <div class="stat-big" style="font-size:26px">${money(fin.balance)}</div>
          <div class="stat-label" style="margin-bottom:10px">Use club balance for transfers</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="fin-btn-req-funds" class="btn-secondary btn-sm" ${canRequestFunds ? "" : "disabled"}>${fin.boardFundsRequested ? "Funds Requested" : h < 25 ? "Board Unwilling" : "Request Funds"}</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Wage Budget</div>
          <div class="fin-wage-cap">
            <div class="fin-wage-bar-track"><div class="fin-wage-bar-fill" style="width:${wageUsePct}%;background:${wageBarColor}"></div></div>
            <div class="fin-wage-cap-labels">
              <span style="color:${wageBarColor}">${money(weeklyWages)}/wk used</span>
              <span style="color:var(--text-muted)">${money(wageCapWeekly)}/wk cap</span>
            </div>
          </div>
        </div>
      </div>

      <div class="finances-grid">
        <div class="card">
          <div class="card-title">Weekly Cash Flow</div>
          <div class="fin-cashflow">
            <div class="fin-cf-row"><span class="fin-cf-label">TV Broadcast <span style="font-size:10px;color:var(--text-muted)">(${esc(DATA.LEAGUES[club.league]?.name || '')} equal share)</span></span><span class="fin-cf-pos">+${money(weeklyTV)}/wk</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Shirt Sponsor</span><span class="fin-cf-pos">+${money(fin.sponsor?.weeklyValue||0)}/wk</span></div>
            ${fin.sleeve ? `<div class="fin-cf-row"><span class="fin-cf-label">Sleeve Sponsor</span><span class="fin-cf-pos">+${money(fin.sleeve.weeklyValue)}/wk</span></div>` : ''}
            ${fin.stadium ? `<div class="fin-cf-row"><span class="fin-cf-label">Stadium Naming</span><span class="fin-cf-pos">+${money(fin.stadium.weeklyValue)}/wk</span></div>` : ''}
            <div class="fin-cf-row"><span class="fin-cf-label">Kit Manufacturer <span style="font-size:10px;color:var(--text-muted)">(they pay you to wear their brand)</span></span><span class="fin-cf-pos">+${money(weeklyKitDeal)}/wk</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Merchandise <span style="font-size:10px;color:var(--text-muted)">(club shop, replica kits)</span></span><span class="fin-cf-pos">+${money(weeklyMerch)}/wk</span></div>
            ${thisWeekHomeGame ? `<div class="fin-cf-row"><span class="fin-cf-label">Matchday <span style="font-size:10px;color:var(--text-muted)">(home league game this week)</span></span><span class="fin-cf-pos">+${money(weeklyMatchdayAvg)}</span></div>` : ''}
            <div class="fin-cf-divider"></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Player Wages</span><span class="fin-cf-neg">−${money(weeklyWages)}/wk</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Staff, Scouts &amp; Coaches</span><span class="fin-cf-neg">−${money(weeklyStaff)}/wk</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Youth Academy <span style="font-size:10px;color:var(--text-muted)">(${(club.youthPlayers||[]).length} scholars, Lv${acLvlP})</span></span><span class="fin-cf-neg">−${money(weeklyAcademy)}/wk</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Facilities Maintenance <span style="font-size:10px;color:var(--text-muted)">(stadium/training/rehab + upgrades)</span></span><span class="fin-cf-neg">−${money(weeklyFacilities)}/wk</span></div>
            ${weeklyRetraining > 0 ? `<div class="fin-cf-row"><span class="fin-cf-label">Player Retraining <span style="font-size:10px;color:var(--text-muted)">(${Object.keys(club.retraining||{}).length} active)</span></span><span class="fin-cf-neg">−${money(weeklyRetraining)}/wk</span></div>` : ''}
            <div class="fin-cf-divider"></div>
            <div class="fin-cf-row fin-cf-total"><span>Weekly Net (avg)</span><span style="color:${weeklyNet>=0?'var(--accent)':'var(--accent-red)'};font-weight:700">${weeklyNet>=0?'+':''}${money(weeklyNet)}/wk</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Season To Date</div>
          <div class="fin-cashflow">
            <div class="fin-cf-row"><span class="fin-cf-label">TV</span><span class="fin-cf-pos">+${money(fin.seasonIncome.tv)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Sponsorship</span><span class="fin-cf-pos">+${money(fin.seasonIncome.sponsorship)}</span></div>
            ${(fin.seasonIncome.matchday || 0) > 0 ? `<div class="fin-cf-row"><span class="fin-cf-label">Matchday</span><span class="fin-cf-pos">+${money(fin.seasonIncome.matchday)}</span></div>` : ''}
            <div class="fin-cf-row"><span class="fin-cf-label">Merchandise</span><span class="fin-cf-pos">+${money(fin.seasonIncome.merchandise || 0)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Prizes</span><span class="fin-cf-pos">+${money(fin.seasonIncome.prizes)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Player Sales</span><span class="fin-cf-pos">+${money(fin.seasonIncome.sales)}</span></div>
            <div class="fin-cf-divider"></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Wages</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.wages)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Transfers</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.transfers)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Agent Fees</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.agentFees)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Staff</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.staff)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Youth Academy</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.academy || 0)}</span></div>
            <div class="fin-cf-row"><span class="fin-cf-label">Facilities</span><span class="fin-cf-neg">−${money(fin.seasonExpenses.facilities || 0)}</span></div>
            <div class="fin-cf-divider"></div>
            <div class="fin-cf-row fin-cf-total"><span>Season Net</span><span style="color:${netColor};font-weight:700">${seasonNet>=0?'+':''}${money(seasonNet)}</span></div>
          </div>
        </div>
      </div>

      <div class="finances-grid">
        <div class="card">
          <div class="card-title">Commercial Partners</div>
          <div class="stat-label" style="margin-bottom:10px">Manage the club's sponsorship deals. Sell open slots, terminate deals early (50% buyout) to re-sell at better rates, and negotiate every contract.</div>

          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div>
                <div class="stat-label" style="color:var(--text-muted)">Shirt Front ${fin.sponsorNeedsRenewal ? '<span style="color:var(--accent-red);font-size:11px">EXPIRED</span>' : ''}</div>
                ${fin.sponsor && !fin.sponsorNeedsRenewal
                  ? `<div style="font-weight:600">${esc(fin.sponsor.name)} <span class="fin-sponsor-tier tier-${fin.sponsor.tier}" style="font-size:10px">${tierLabels[fin.sponsor.tier]}</span></div>
                     <div class="stat-label">${money(fin.sponsor.weeklyValue)}/wk · ${money(fin.sponsor.weeklyValue*52)}/season · ${fin.sponsor.seasonsLeft} season${fin.sponsor.seasonsLeft!==1?'s':''} left</div>
                     ${fin.sponsor.clauses?.length ? `<div class="stat-label" style="color:var(--accent-gold)">Clauses: ${fin.sponsor.clauses.map(clauseLabel).join(' · ')}</div>` : ''}`
                  : `<div class="stat-label" style="color:var(--accent-red)">Slot open — no shirt sponsor.</div>`}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                ${fin.sponsorNeedsRenewal || !fin.sponsor
                  ? `<button id="fin-btn-pick-sponsor" class="btn-primary btn-sm">Negotiate</button>`
                  : `<button class="fin-btn-terminate btn-secondary btn-sm" data-slot="shirt">Terminate</button>`}
              </div>
            </div>
          </div>

          ${['sleeve', 'stadium'].map(slot => {
            const deal = fin[slot];
            return `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div>
                  <div class="stat-label" style="color:var(--text-muted)">${SPONSOR_SLOTS[slot].label}</div>
                  ${deal
                    ? `<div style="font-weight:600">${esc(deal.name)} <span class="fin-sponsor-tier tier-${deal.tier}" style="font-size:10px">${tierLabels[deal.tier]}</span></div>
                       <div class="stat-label">${money(deal.weeklyValue)}/wk · ${money(deal.weeklyValue*52)}/season · ${deal.seasonsLeft} season${deal.seasonsLeft!==1?'s':''} left</div>`
                    : `<div class="stat-label">Slot open — est. market value ${money(sponsorMarketAnnual(club) * SPONSOR_SLOTS[slot].share)}/season.</div>`}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  ${deal
                    ? `<button class="fin-btn-terminate btn-secondary btn-sm" data-slot="${slot}">Terminate</button>`
                    : `<button class="fin-btn-sell-slot btn-primary btn-sm" data-slot="${slot}">Sell Slot</button>`}
                </div>
              </div>
            </div>`;
          }).join('')}

          <div style="padding:10px 0">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div>
                <div class="stat-label" style="color:var(--text-muted)">Kit Manufacturer <span style="font-size:10px">(pays you to wear their brand)</span>${fin.kitNeedsRenewal ? ' <span style="color:var(--accent-red);font-size:11px">EXPIRED</span>' : ''}</div>
                ${fin.kitDeal && !fin.kitNeedsRenewal
                  ? `<div style="font-weight:600">${esc(fin.kitDeal.name)}</div>
                     <div class="stat-label">${money(fin.kitDeal.annualValue)}/season · ${fin.kitDeal.seasonsLeft} season${fin.kitDeal.seasonsLeft!==1?'s':''} left</div>`
                  : `<div class="stat-label" style="color:var(--accent-red)">No kit deal — negotiate one now.</div>`}
              </div>
              ${fin.kitNeedsRenewal || !fin.kitDeal ? `<button id="fin-btn-pick-kit" class="btn-primary btn-sm" style="flex-shrink:0">Negotiate</button>` : ''}
            </div>
          </div>
        </div>
        ${(() => {
          const hist = (fin.balanceHistory || []).length >= 1
            ? fin.balanceHistory
            : [{ t: gameState.currentDate.getTime() - 7*24*3600*1000, v: fin.balance }, { t: gameState.currentDate.getTime(), v: fin.balance }];
          const W = 540, H = 128, PAD = { t: 14, r: 10, b: 14, l: 56 };
          const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
          const vals = hist.map(h => h.v);
          const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
          const pad = (rawMax - rawMin) * 0.1 || Math.abs(rawMax) * 0.1 || 1;
          const minV = rawMin - pad, maxV = rawMax + pad;
          const range = maxV - minV;
          const tMin = hist[0].t, tMax = hist[hist.length-1].t, tRange = tMax - tMin || 1;
          const px = t => PAD.l + ((t - tMin) / tRange) * iW;
          const py = v => PAD.t + (1 - (v - minV) / range) * iH;
          const coords = hist.map(h => [px(h.t), py(h.v)]);
          // S-curve Bézier: control points at midpoint X keep X monotone (no backtracking).
          const smoothD = coords.reduce((d, p, i) => {
            if (i === 0) return `M ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
            const prev = coords[i-1];
            const mx = ((prev[0] + p[0]) / 2).toFixed(1);
            return d + ` C ${mx},${prev[1].toFixed(1)} ${mx},${p[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
          }, '');
          const baseY = (PAD.t + iH).toFixed(1);
          const fillD = `${smoothD} L ${coords[coords.length-1][0].toFixed(1)},${baseY} L ${coords[0][0].toFixed(1)},${baseY} Z`;
          const pos = 'var(--accent)', neg = 'var(--accent-red)';
          const lineCol = hist[hist.length-1].v >= 0 ? pos : neg;
          const zeroY = rawMin < 0 && rawMax > 0 ? py(0) : null;
          const monthLabels = [];
          const seen = new Set();
          hist.forEach(h => {
            const d = new Date(h.t), key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!seen.has(key)) { seen.add(key); monthLabels.push({ x: px(h.t), label: d.toLocaleString('default',{month:'short'}) }); }
          });
          const yTicks = [rawMin, (rawMin+rawMax)/2, rawMax].map(v => ({ y: py(v), label: money(v) }));
          return `<div class="card" style="min-height:0">
            <div class="card-title">Balance History <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(last 6 months)</span></div>
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;max-height:130px">
              <defs><linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${lineCol}" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="${lineCol}" stop-opacity="0.02"/>
              </linearGradient></defs>
              <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t+iH}" stroke="var(--border)" stroke-width="1"/>
              <line x1="${PAD.l}" y1="${PAD.t+iH}" x2="${W-PAD.r}" y2="${PAD.t+iH}" stroke="var(--border)" stroke-width="1"/>
              ${zeroY!==null?`<line x1="${PAD.l}" y1="${zeroY.toFixed(1)}" x2="${W-PAD.r}" y2="${zeroY.toFixed(1)}" stroke="${neg}" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>` : ''}
              <path d="${fillD}" fill="url(#bG)"/>
              <path d="${smoothD}" fill="none" stroke="${lineCol}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              ${yTicks.map(l=>`<text x="${PAD.l-4}" y="${l.y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--text-muted)">${l.label}</text>`).join('')}
              ${monthLabels.map(l=>`<text x="${l.x.toFixed(1)}" y="${H-5}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${l.label}</text>`).join('')}
            </svg>
          </div>
          <div class="card" style="min-height:0;margin-top:0">
            <div class="card-title">Board Relations</div>
            <div class="fin-board-meter" style="margin-bottom:8px">
              <div class="fin-board-track"><div class="fin-board-fill" style="width:${h}%;background:${hapColor}"></div></div>
              <div class="fin-board-vals"><span>0</span><span style="color:${hapColor};font-weight:700">${hapLabel} · ${h}/100</span><span>100</span></div>
            </div>
            <div class="stat-label" style="margin-bottom:10px">${grantNote}</div>
            <button id="fin-btn-confidence" class="btn-secondary btn-sm" ${!fin.boardConfVoted && h >= 40 ? "" : "disabled"}>${fin.boardConfVoted ? "Vote Already Requested" : h < 40 ? "Board Won't Support" : "Request Vote of Confidence"}</button>
            ${!ffp.ok ? `<div style="margin-top:10px;padding:8px 10px;background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);border-radius:6px;font-size:12px;color:var(--accent-red)">⚠ FFP Warning: 3-year rolling loss ${money(Math.abs(ffp.rolling))} approaching limit.</div>` :
              ffp.rolling < -35 ? `<div style="margin-top:10px;padding:8px 10px;background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.25);border-radius:6px;font-size:12px;color:var(--accent-gold)">FFP: Under monitoring — 3yr rolling loss ${money(Math.abs(ffp.rolling))}.</div>` :
              `<div style="margin-top:10px;font-size:12px;color:var(--accent)">FFP: ${ffp.label} · 3yr rolling ${ffp.rolling>=0?'+':''}${money(ffp.rolling)}</div>`}
          </div>`;
        })()}
      </div>

      <div class="finances-grid">
        <div class="card"><div class="card-title">Projected Annual Income</div><div class="finances-chart-bar">
          ${bar('TV Equal Share', projTV, 'income')}
          ${bar('Sponsorship & Kit', projSponsor, 'income')}
          ${bar('Matchday', projMatchday, 'income')}
          ${bar('Merchandise', projMerch, 'income')}
          ${bar('TV Merit (est.)', projPrize, 'income')}
        </div></div>
        <div class="card"><div class="card-title">Projected Annual Costs</div><div class="finances-chart-bar">
          ${bar('Player Wages', projWages, 'expense')}
          ${bar('Staff &amp; Coaches', projStaff, 'expense')}
          ${bar('Youth Academy', projAcademy, 'expense')}
          ${bar('Facilities', projFacilities, 'expense')}
          <div class="fin-bar-row" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
            <span class="fin-bar-label">Profit</span>
            <div class="fin-bar-track"></div>
            <span class="fin-bar-val" style="color:${projProfit>=0?'var(--accent)':'var(--accent-red)'}">${projProfit>=0?'+':''}${money(projProfit)}</span>
          </div>
        </div></div>
      </div>

      ${historyHtml}

      <div class="card"><div class="card-title">Top Earners</div><div class="wage-breakdown">
        ${[...club.players].sort((a,b)=>b.wage-a.wage).slice(0,10).map(p =>
          `<div class="wage-item">
            <span class="wage-item-name">${esc(p.name)} <span class="text-muted">(${p.pos}, ${p.age})</span></span>
            <span class="wage-item-amount">${money(p.wage/1000)}/wk</span>
          </div>`).join('')}
      </div></div>`;

    // --- Interactive event listeners ---

    // Request board funds
    const reqFundsBtn = document.getElementById('fin-btn-req-funds');
    if (reqFundsBtn && canRequestFunds) {
      reqFundsBtn.addEventListener('click', () => {
        const confCost = 10;
        showModal(`
          <div style="max-width:340px">
            <h2 style="margin-bottom:8px">Request Board Funds</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Ask the board for a mid-season budget injection. Can only be done once per season.</p>
            <div style="background:var(--surface2);border-radius:8px;padding:14px;margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Amount granted</span><span style="color:var(--accent);font-weight:700">${money(fundReqAmt)}</span></div>
              <div style="display:flex;justify-content:space-between"><span>Board confidence cost</span><span style="color:var(--accent-red)">−${confCost}</span></div>
            </div>
            <div style="display:flex;gap:8px">
              <button id="fin-confirm-req" class="btn-primary" style="flex:1">Confirm Request</button>
              <button id="fin-cancel-req" class="btn-secondary" style="flex:1">Cancel</button>
            </div>
          </div>`);
        document.getElementById('fin-cancel-req').addEventListener('click', closeModal);
        document.getElementById('fin-confirm-req').addEventListener('click', () => {
          fin.balance = Math.round((fin.balance + fundReqAmt) * 100) / 100;
          fin.boardConfidence = Math.max(0, fin.boardConfidence - confCost);
          fin.boardFundsRequested = true;
          closeModal();
          updateSidebar();
          notify(`Board granted ${money(fundReqAmt)} — added to club balance.`, 'success');
          renderView('finances');
        });
      });
    }


    // Pick / renew sponsor
    const pickSponsorBtn = document.getElementById('fin-btn-pick-sponsor');
    if (pickSponsorBtn) {
      pickSponsorBtn.addEventListener('click', () => {
        fin.sponsorNeedsRenewal = true;
        showSponsorRenewalModal();
        // Re-render finances after modal closes
        const obs = new MutationObserver(() => {
          if (document.getElementById('modal-overlay').classList.contains('hidden')) {
            obs.disconnect();
            renderView('finances');
          }
        });
        obs.observe(document.getElementById('modal-overlay'), { attributes: true, attributeFilter: ['class'] });
      });
    }

    // Sell open commercial slots (sleeve / stadium)
    m.querySelectorAll('.fin-btn-sell-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        showSlotSponsorModal(btn.dataset.slot);
        const obs = new MutationObserver(() => {
          if (document.getElementById('modal-overlay').classList.contains('hidden')) {
            obs.disconnect();
            renderView('finances');
          }
        });
        obs.observe(document.getElementById('modal-overlay'), { attributes: true, attributeFilter: ['class'] });
      });
    });

    // Terminate active sponsor deals (50% buyout)
    m.querySelectorAll('.fin-btn-terminate').forEach(btn => {
      btn.addEventListener('click', () => terminateSponsorDeal(btn.dataset.slot));
    });

    // Negotiate kit deal
    const pickKitBtn = document.getElementById('fin-btn-pick-kit');
    if (pickKitBtn) {
      pickKitBtn.addEventListener('click', () => {
        fin.kitNeedsRenewal = true;
        showKitRenewalModal();
        const obs = new MutationObserver(() => {
          if (document.getElementById('modal-overlay').classList.contains('hidden')) {
            obs.disconnect();
            renderView('finances');
          }
        });
        obs.observe(document.getElementById('modal-overlay'), { attributes: true, attributeFilter: ['class'] });
      });
    }

    // Vote of confidence
    const confBtn = document.getElementById('fin-btn-confidence');
    if (confBtn && !fin.boardConfVoted && h >= 40) {
      confBtn.addEventListener('click', () => {
        showModal(`
          <div style="max-width:340px">
            <h2 style="margin-bottom:8px">Vote of Confidence</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Request a public show of support from the board. Boosts your confidence rating — but can only be done once per season.</p>
            <div style="background:var(--surface2);border-radius:8px;padding:14px;margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Confidence boost</span><span style="color:var(--accent);font-weight:700">+12</span></div>
              <div style="display:flex;justify-content:space-between"><span>New confidence</span><span style="color:var(--accent)">${Math.min(100, h + 12)}/100</span></div>
            </div>
            <div style="display:flex;gap:8px">
              <button id="fin-confirm-conf" class="btn-primary" style="flex:1">Request Vote</button>
              <button id="fin-cancel-conf" class="btn-secondary" style="flex:1">Cancel</button>
            </div>
          </div>`);
        document.getElementById('fin-cancel-conf').addEventListener('click', closeModal);
        document.getElementById('fin-confirm-conf').addEventListener('click', () => {
          fin.boardConfidence = Math.min(100, fin.boardConfidence + 12);
          fin.boardConfVoted = true;
          closeModal();
          updateSidebar();
          notify('Board publicly backs the manager — confidence improved!', 'success');
          renderView('finances');
        });
      });
    }
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
    const contractEndLabel = fmtContractEnd(p.contractEnd);
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
          <p>${esc(p.nationality)} · Age ${p.age}${club && club.id !== gameState.myClubId ? ' · ' + esc(club.name || club.name) : ''}</p>
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
          <div class="pm-stat"><span class="pm-stat-name">Wage</span><span class="pm-stat-val">${money(p.wage/1000)}/wk</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Contract Until</span><span class="pm-stat-val">${contractEndLabel}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Potential</span><span class="pm-stat-val" style="color:${potColor}">${p.pot}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Morale</span><span class="pm-stat-val">${p.morale}%</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Yellow Cards</span><span class="pm-stat-val">${p.yellowCards || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Red Cards</span><span class="pm-stat-val">${p.redCards || 0}</span></div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">This Season</div>
        <div class="pm-stats-grid" style="margin-top:4px">
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${p.goals || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${p.assists || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${p.appearances || 0}</span></div>
        </div>
        ${(p.clubCareerApps || 0) > 0 || (p.clubCareerGoals || 0) > 0 ? `
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Career at Club</div>
        <div class="pm-stats-grid" style="margin-top:4px">
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${(p.clubCareerGoals||0) + (p.goals||0)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${(p.clubCareerAssists||0) + (p.assists||0)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${(p.clubCareerApps||0) + (p.appearances||0)}</span></div>
        </div>` : ''}
        ${p.wantsMove ? `<div class="pm-prestige-warn" style="margin-top:10px">${esc(p.name)} has requested a transfer (${p.wantsMoveReason === 'game_time' ? 'unhappy with his game time' : 'feels he has outgrown the club'}) and is unlikely to sign a new contract.</div>` : ''}
        <div class="pm-offer-footer" style="margin-top:12px">
          <button class="btn-secondary" style="width:100%" id="pm-renegotiate-btn">Renegotiate Contract</button>
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

    const renego = $('pm-renegotiate-btn');
    if (renego) renego.addEventListener('click', () => {
      const curWage = p.wage;
      const firstName = p.name.split(' ')[0];

      // --- Context factors ---
      const avgRating = p.ratingCount >= 3 ? p.seasonRating / p.ratingCount : null;
      const underperformed = avgRating !== null && avgRating < 6.5;
      const prevLeague = club.lastSeasonLeague ? DATA.LEAGUES[club.lastSeasonLeague] : null;
      const curLeague  = DATA.LEAGUES[club.league];
      const clubRelegated = !!(prevLeague && curLeague && prevLeague.level < curLeague.level);
      const loyal   = p.morale >= 78 && !p.wantsMove;
      const agingDown = p.age >= 30 && p.pot <= p.ovr;

      // Determine wage floor (what they'll accept) and ask (what they want)
      let cutFactor, raiseFactor, contextNote;
      if (clubRelegated) {
        // Relegated — players take a division-level pay cut to stay
        cutFactor  = 0.78;
        raiseFactor = 0.88;
        contextNote = `The club's relegation means ${firstName} is willing to accept adjusted wages for the lower division.`;
      } else if (underperformed && !loyal) {
        // Poor season, no special loyalty — no leverage for a raise
        cutFactor  = 0.92;
        raiseFactor = 1.00;
        contextNote = `After a below-par season (${avgRating.toFixed(1)} avg rating), ${firstName} isn't in a position to demand more.`;
      } else if (agingDown && loyal) {
        // Veteran who loves the club — happy to sign at a modest rate
        cutFactor  = 0.88;
        raiseFactor = 1.03;
        contextNote = `${firstName} is loyal and realistic about where he is in his career — he'll sign for a modest rate.`;
      } else if (loyal) {
        // Happy, committed player — slight loyalty discount on demands
        cutFactor  = 0.95;
        raiseFactor = p.age < 28 && p.pot > p.ovr ? 1.12 : 1.06;
        contextNote = null;
      } else if (p.morale < 45) {
        // Unhappy — wants more to stay, won't take a cut
        cutFactor  = 1.00;
        raiseFactor = 1.18;
        contextNote = null;
      } else {
        // Normal case
        cutFactor  = 1.00;
        raiseFactor = p.age < 28 && p.pot > p.ovr ? 1.20 : 1.10;
        contextNote = null;
      }

      const minAccept  = Math.max(0.25, Math.round(curWage * cutFactor  * 100) / 100);
      const wantedWage = Math.max(minAccept, Math.round(curWage * raiseFactor * 100) / 100);
      const takingCut  = wantedWage < curWage;

      const ambition = playerAmbition(p, club);
      const reluctant = p.wantsMove || ambition >= 0.55;

      showModal(`
        <div style="max-width:360px">
          <h2 style="margin-bottom:4px">Renegotiate Contract</h2>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${esc(p.name)} · ${p.pos} · Age ${p.age}</p>
          ${contextNote ? `<div class="pm-prestige-warn" style="margin-bottom:10px;border-color:var(--accent-gold);color:var(--accent-gold)">${contextNote}</div>` : ''}
          ${reluctant && !contextNote ? `<div class="pm-prestige-warn" style="margin-bottom:10px">${p.wantsMove ? 'He has asked for a transfer and is unlikely to sign a new deal.' : 'He seems unsettled — there is a real chance he turns this down.'}</div>` : ''}
          <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>Current wage</span><span>${money(curWage/1000)}/wk</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>Contract expires</span><span>${contractEndLabel}</span></div>
            <div style="display:flex;justify-content:space-between"><span>${takingCut ? 'Will accept' : 'Player wants'}</span><span style="color:${takingCut ? 'var(--accent-green,#00d084)' : 'var(--accent-gold)'}">${money(wantedWage/1000)}/wk${takingCut ? ' ↓' : ''}</span></div>
            ${minAccept < wantedWage ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--text-muted)"><span>Will go as low as</span><span>${money(minAccept/1000)}/wk</span></div>` : ''}
          </div>
          <div style="margin-bottom:10px">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Offer wage (£k/wk)</label>
            <input id="rn-wage-input" type="number" step="0.1" min="0.1" value="${wantedWage}"
              style="width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px">
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Contract length</label>
            <div style="display:flex;gap:6px">
              ${[1,2,3,4,5].map(y => `<button class="btn-secondary btn-sm rn-years" data-y="${y}" style="flex:1">${y}yr</button>`).join('')}
            </div>
            <div id="rn-years-selected" style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center">Select contract length</div>
          </div>
          <div style="display:flex;gap:8px">
            <button id="rn-offer-btn" class="btn-primary" style="flex:1" disabled>Make Offer</button>
            <button id="rn-cancel-btn" class="btn-secondary" style="flex:1">Cancel</button>
          </div>
        </div>`);

      let chosenYears = null;
      document.querySelectorAll('.rn-years').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.rn-years').forEach(b => b.classList.remove('active', 'btn-primary'));
          document.querySelectorAll('.rn-years').forEach(b => b.classList.add('btn-secondary'));
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
          chosenYears = parseInt(btn.dataset.y);
          const newEnd = DATA.contractEndAfterYears(gameState.currentDate, chosenYears);
          document.getElementById('rn-years-selected').textContent = `${chosenYears}-year deal until ${fmtContractEnd(newEnd)}`;
          document.getElementById('rn-offer-btn').disabled = false;
        });
      });
      document.getElementById('rn-cancel-btn').addEventListener('click', closeModal);
      document.getElementById('rn-offer-btn').addEventListener('click', () => {
        const offeredWageUnits = parseFloat(document.getElementById('rn-wage-input').value) || curWage;
        if (!chosenYears) return;
        const meetsWage = offeredWageUnits >= minAccept;
        // Loyal/relegated players are more willing to commit; unsettled ones may still walk
        const eagerBonus = (loyal || clubRelegated) && !p.wantsMove ? 0.15 : 0;
        const renewChance = !meetsWage ? 0 : p.wantsMove ? 0.15 : reluctant ? 0.45 : Math.min(1.0, 0.85 + eagerBonus);
        const accepts = Math.random() < renewChance;
        if (!accepts) {
          const reason = !meetsWage
            ? `he won't go below ${money(minAccept/1000)}/wk.`
            : p.wantsMove ? `he has his heart set on a move elsewhere and won't sign a new deal.`
            : `he's unconvinced this is the right time to commit his future here.`;
          notify(`${p.name} rejected the offer — ${reason}`, 'error');
          closeModal();
          return;
        }
        p.wage = Math.round(offeredWageUnits * 100) / 100;
        p.contractEnd = DATA.contractEndAfterYears(gameState.currentDate, chosenYears);
        p.morale = Math.min(100, p.morale + 8);
        p.wantsMove = false;
        p.transferListed = false;
        p.wantsMoveReason = null;
        closeModal();
        notify(`${p.name} signed a new ${chosenYears}-year deal at ${money(p.wage/1000)}/wk.`, 'success');
        renderView('squad');
      });
    });
  }

  function showMarketPlayerModal(playerId, clubId) {
    if (isTransferBanned(playerId)) return notify('That player won\'t entertain a move to your club again this season.', 'warning');
    if (hasPreContract(playerId)) return notify('You\'ve already agreed a pre-contract with that player.', 'warning');
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
    const contractEndLabel = fmtContractEnd(p.contractEnd);
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
          <p>${esc(p.nationality)} · Age ${p.age} · ${esc(seller.name || seller.name)}</p>
          <div class="pm-badges">
            <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
            <span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>
            ${potGap > 0 ? `<span class="pm-pot-tag" style="color:${potColor}">&#9650;${p.pot}</span>` : ''}
          </div>
          ${statusTag}
          <div class="pm-prestige-stars">${repStars(playerPrestige(p.ovr))}</div>
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
          <div class="pm-stat"><span class="pm-stat-name">Wage</span><span class="pm-stat-val">${money(p.wage/1000)}/wk</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Contract Until</span><span class="pm-stat-val">${contractEndLabel}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Potential</span><span class="pm-stat-val" style="color:${potColor}">${p.pot}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Morale</span><span class="pm-stat-val">${p.morale}%</span></div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">This Season</div>
        <div class="pm-stats-grid" style="margin-top:4px">
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${p.goals || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${p.assists || 0}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${p.appearances || 0}</span></div>
        </div>
        ${(p.clubCareerApps || 0) > 0 || (p.clubCareerGoals || 0) > 0 ? `
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Career at Club</div>
        <div class="pm-stats-grid" style="margin-top:4px">
          <div class="pm-stat"><span class="pm-stat-name">Goals</span><span class="pm-stat-val">${(p.clubCareerGoals||0) + (p.goals||0)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Assists</span><span class="pm-stat-val">${(p.clubCareerAssists||0) + (p.assists||0)}</span></div>
          <div class="pm-stat"><span class="pm-stat-name">Apps</span><span class="pm-stat-val">${(p.clubCareerApps||0) + (p.appearances||0)}</span></div>
        </div>` : ''}
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

  function showFreeAgentModal(playerId) {
    if (isTransferBanned(playerId)) return notify('That player won\'t entertain a move to your club again this season.', 'warning');
    const agents = gameState.freeAgents || [];
    const p = agents.find(x => x.id === playerId);
    if (!p) return;

    const myClub = gameState.myClub;
    const rejectChance = prestigeRejectChance(p, myClub);
    const isGK = p.pos === 'GK';
    const attrDefs = isGK
      ? [['Reflexes','gkReflexes'],['Positioning','gkPositioning'],['Passing','passing'],['Physical','physical'],['Pace','pace']]
      : [['Pace','pace'],['Shooting','shooting'],['Passing','passing'],['Dribbling','dribbling'],['Defending','defending'],['Physical','physical']];
    const potRatio = p.ovr > 0 ? p.pot / p.ovr : 1;
    const potVal = (key) => Math.min(99, Math.round((p.attrs[key] || 0) * potRatio));
    const potGap = p.pot - p.ovr;
    const potColor = potGap >= 10 ? 'var(--accent)' : potGap >= 5 ? 'var(--accent-gold)' : 'var(--text-muted)';
    // Wage: player wants 10-25% above their current wage (no transfer fee)
    const wantedWage = Math.max(0.25, Math.round(p.wage * (1.12 + rand(0, 13) / 100) * 100) / 100);
    const minWage = Math.max(0.25, Math.round(p.wage * 0.95 * 100) / 100);

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

    showModal(`<div class="player-modal">
      <div class="pm-header">
        <div class="pm-avatar" style="background:#555;color:#fff">${DATA.getInitials(p.name)}</div>
        <div class="pm-info">
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.nationality)} · Age ${p.age} · Free Agent</p>
          <div class="pm-badges">
            <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
            <span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span>
            ${potGap > 0 ? `<span class="pm-pot-tag" style="color:${potColor}">&#9650;${p.pot}</span>` : ''}
          </div>
          <span class="market-tag expiring">Free Agent — sign any time</span>
        </div>
      </div>
      <div class="pm-attr-bar-list">${barsHtml}</div>
      <div class="pm-offer-footer">
        ${rejectChance >= 0.60 ? `<div class="pm-prestige-warn">Very unlikely to join — club not prestigious enough</div>` : rejectChance >= 0.30 ? `<div class="pm-prestige-warn">May be reluctant to join a club of your stature</div>` : ''}
        <div class="pm-value-row"><span>Wants</span><span class="text-gold fw-700">${money(wantedWage / 1000)}/wk</span></div>
        <div class="neg-field" style="margin:10px 0">
          <label>Your wage offer (£k/wk)</label>
          <input id="fa-wage-input" type="number" step="0.1" min="0" value="${wantedWage}">
        </div>
        <div class="neg-field" style="margin-bottom:14px">
          <label>Contract length</label>
          <select id="fa-contract-len">
            ${[1,2,3,4,5].map(y => `<option value="${y}"${y===3?' selected':''}>${y} year${y>1?'s':''}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary pm-offer-btn" id="fa-sign-btn">Sign Player</button>
      </div>
    </div>`);

    $('fa-sign-btn').addEventListener('click', () => {
      const offeredWage = parseFloat($('fa-wage-input').value);
      const years = parseInt($('fa-contract-len').value);
      if (isNaN(offeredWage) || offeredWage <= 0) return notify('Enter a valid wage.', 'error');
      if (offeredWage < minWage) return notify(`${p.name} won't accept less than ${money(minWage / 1000)}/wk.`, 'error');
      if (rejectChance > 0 && Math.random() < rejectChance) {
        markTransferBan(playerId);
        closeModal();
        return notify(`${p.name} rejected your approach — your club isn't prestigious enough.`, 'error');
      }
      if (offeredWage < wantedWage && Math.random() < 0.45) {
        markTransferBan(playerId);
        return notify(`${p.name} turned down ${money(offeredWage / 1000)}/wk — not interested this season.`, 'error');
      }
      signFreeAgent(playerId, offeredWage, years);
    });
  }

  function signFreeAgent(playerId, agreedWage, years) {
    const agents = gameState.freeAgents || [];
    const idx = agents.findIndex(x => x.id === playerId);
    if (idx === -1) return;
    const p = { ...agents[idx], wage: agreedWage, contractEnd: DATA.contractEndAfterYears(gameState.currentDate, years || 3), clubId: gameState.myClubId, clubName: gameState.myClub.name, clubCareerGoals: 0, clubCareerAssists: 0, clubCareerApps: 0 };
    gameState.myClub.players.push(p);
    gameState.freeAgents.splice(idx, 1);
    recalcSqRating(gameState.myClub);
    gameState.transferLog.unshift({ in: true, name: p.name, fee: 0 });
    notify(`${p.name} signed on a free transfer on ${money(agreedWage / 1000)}/wk!`, 'success');
    closeModal();
    updateSidebar();
    renderTransfers($('main-content'));
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
     FACILITIES
     ============================================= */

  const FAC_LABELS = ['','Basic','Amateur','Semi-Pro','Professional','Elite'];
  const FAC_UPGRADE_COSTS = {
    academy:  [null, 0.5, 1.5,  4.0, 10.0, null],
    stadium:  [null, 1.0, 3.0,  8.0, 20.0, null],
    training: [null, 0.4, 1.2,  3.5,  9.0, null],
    rehab:    [null, 0.3, 0.9,  2.5,  6.0, null],
  };

  // Coach definitions per role: [label, maxSlots, levels: [{hireCost, wage, bonus desc}]]
  const COACH_DEFS = {
    academy:   { label: 'Academy Coach',     icon: '🎓', maxSlots: 3,
      levels: [
        { hireCost: 0.08,  weeklyWage:  3, desc: '+0.2% youth dev/wk' },
        { hireCost: 0.20,  weeklyWage:  8, desc: '+0.5% youth dev/wk' },
        { hireCost: 0.50,  weeklyWage: 18, desc: '+1.0% youth dev/wk' },
      ]},
    fitness:   { label: 'Fitness Coach',     icon: '💪', maxSlots: 2,
      levels: [
        { hireCost: 0.10,  weeklyWage:  4, desc: '+0.5 fitness/wk recovery' },
        { hireCost: 0.25,  weeklyWage: 10, desc: '+1.0 fitness/wk recovery' },
        { hireCost: 0.60,  weeklyWage: 22, desc: '+2.0 fitness/wk recovery' },
      ]},
    setpiece:  { label: 'Set Piece Coach',   icon: '⚽', maxSlots: 1,
      levels: [
        { hireCost: 0.08,  weeklyWage:  3, desc: '+0.2% corners & free kicks' },
        { hireCost: 0.22,  weeklyWage:  8, desc: '+0.5% corners & free kicks' },
        { hireCost: 0.55,  weeklyWage: 18, desc: '+1.0% corners & free kicks' },
      ]},
    attacking: { label: 'Attacking Coach',   icon: '🗡️', maxSlots: 1,
      levels: [
        { hireCost: 0.10,  weeklyWage:  4, desc: '+0.2% att/mid dev/wk' },
        { hireCost: 0.28,  weeklyWage: 10, desc: '+0.5% att/mid dev/wk' },
        { hireCost: 0.65,  weeklyWage: 24, desc: '+1.0% att/mid dev/wk' },
      ]},
    defensive: { label: 'Defensive Coach',   icon: '🛡️', maxSlots: 1,
      levels: [
        { hireCost: 0.10,  weeklyWage:  4, desc: '+0.2% def/gk dev/wk' },
        { hireCost: 0.28,  weeklyWage: 10, desc: '+0.5% def/gk dev/wk' },
        { hireCost: 0.65,  weeklyWage: 24, desc: '+1.0% def/gk dev/wk' },
      ]},
    rehab:     { label: 'Rehab Specialist',  icon: '🏥', maxSlots: 2,
      levels: [
        { hireCost: 0.08,  weeklyWage:  3, desc: '+5% injury recovery speed' },
        { hireCost: 0.22,  weeklyWage:  8, desc: '+10% injury recovery speed' },
        { hireCost: 0.55,  weeklyWage: 18, desc: '+18% injury recovery speed' },
      ]},
  };

  // Which coach roles belong to which facility tab
  const FAC_COACH_ROLES = {
    academy:  ['academy'],
    training: ['fitness', 'setpiece', 'attacking', 'defensive'],
    rehab:    ['rehab', 'fitness'],
    stadium:  [],
  };

  function facEnsureInit(club) {
    const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
    if (!club.facilities) club.facilities = { academy: rep, stadium: rep, training: rep, rehab: rep };
    if (!gameState.staff) gameState.staff = { coaches: [] };
    if (!gameState.staff.coaches) gameState.staff.coaches = [];
    if (!club.youthPlayers) club.youthPlayers = [];
  }

  function facLevelBar(level) {
    return `<div class="fac-level-bar">${[1,2,3,4,5].map(i=>`<div class="fac-level-pip ${i<=level?'filled':''}"></div>`).join('')}</div>`;
  }

  function facProgressBar(pct, label) {
    const color = pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)';
    return `<div style="margin:8px 0 4px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:var(--text-muted)">${label||'Development'}</span>
        <span style="font-size:11px;font-weight:700;color:${color}">${Math.round(pct)}/100</span>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,pct)}%;background:${color};border-radius:3px;transition:width 0.3s"></div>
      </div>
    </div>`;
  }

  function calcAcademyProgress(club) {
    // Each academy coach = 15pts, each academy-tagged training upgrade = 10pts
    const coaches = (gameState.staff?.coaches || []).filter(c => c.role === 'academy');
    const coachPts = Math.min(45, coaches.length * 15);
    const u = club.trainingUpgrades || {};
    const ACADEMY_UPGRADE_KEYS = ['indoor_pitch','video_suite','nutrition_lab','biometric_lab','tactics_room'];
    const upgPts = ACADEMY_UPGRADE_KEYS.filter(k => u[k]).length * 10;
    return Math.min(100, coachPts + upgPts + (club.facilities?.academy || 1) * 5);
  }

  function calcTrainingProgress(club) {
    const u = club.trainingUpgrades || {};
    return Math.min(100, Object.keys(u).filter(k => u[k]).length * 10);
  }

  function calcStadiumProgress(club) {
    const r = club.renovations || {};
    const s = club.stadiumStands || {};
    let pts = STADIUM_RENOS.filter(rn => r[rn.key]).length * 6;
    Object.values(s).forEach(stand => {
      if (!stand) return;
      pts += stand.tier === 2 ? 12 : stand.type === 'terrace' ? 5 : 8;
    });
    return Math.min(100, pts);
  }

  function facUpgradeCostLabel(cost) { return cost != null ? `£${cost}M` : '—'; }

  function facHeaderCard(name, svgPath, lvl, fin, facKey, desc, progress) {
    const balance = fin?.balance ?? 0;
    // progress mode: show 0-100 bar driven by built items; no manual upgrade button
    if (progress !== undefined) {
      const derivedLvl = Math.max(1, Math.min(5, Math.ceil(progress / 20) || 1));
      return `
        <div class="card fac-main-card">
          <div class="fac-icon-header">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
            <div>
              <div class="fac-facility-name">${name}</div>
              <div class="fac-level-label">${FAC_LABELS[derivedLvl]} · Tier ${derivedLvl}/5</div>
            </div>
          </div>
          ${facProgressBar(progress, 'Overall Development')}
          <div class="fac-desc">${desc}</div>
        </div>`;
    }
    const cost = FAC_UPGRADE_COSTS[facKey][lvl];
    const canAfford = cost != null && balance >= cost;
    return `
      <div class="card fac-main-card">
        <div class="fac-icon-header">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
          <div>
            <div class="fac-facility-name">${name}</div>
            <div class="fac-level-label">${FAC_LABELS[lvl]} · Level ${lvl}/5</div>
          </div>
        </div>
        ${facLevelBar(lvl)}
        <div class="fac-desc">${desc}</div>
        <div class="fac-upgrade-row">
          ${lvl >= 5 ? `<span class="fac-level-max">MAX LEVEL</span>` :
            `<button class="fac-upgrade-btn btn-primary btn-sm${canAfford?'':' btn-disabled'}" data-fac="${facKey}" data-cost="${cost}" ${canAfford?'':'disabled'}>
              Upgrade → ${FAC_LABELS[lvl+1]} · ${facUpgradeCostLabel(cost)}
            </button>`}
          ${lvl < 5 ? `<span class="fac-upgrade-note">Balance: ${money(balance)}</span>` : ''}
        </div>
      </div>`;
  }

  function renderCoachPanel(el, roles, facTab) {
    // roles = array of role keys to show on this tab
    const coaches = (gameState.staff?.coaches || []);
    const balance = gameState.finances?.balance ?? 0;
    let html = `<div class="card"><div class="card-title">Coaching Staff</div>`;
    roles.forEach(role => {
      const def = COACH_DEFS[role];
      const hired = coaches.filter(c => c.role === role);
      const slots = def.maxSlots;
      html += `<div class="coach-role-section">
        <div class="coach-role-label">${def.icon} ${def.label} <span class="coach-slots-used">${hired.length}/${slots}</span></div>`;
      // Hired coaches
      hired.forEach(c => {
        const lvlDef = def.levels[c.level - 1];
        html += `<div class="coach-row">
          <div class="coach-row-info">
            <span class="coach-row-name">${esc(c.name)}</span>
            <span class="coach-row-meta">Lv${c.level} · £${c.weeklyWage}k/wk · ${lvlDef?.desc||''}</span>
          </div>
          <button class="fac-fire-btn btn-secondary btn-sm" data-cid="${c.id}">Release</button>
        </div>`;
      });
      // Hire slots
      if (hired.length < slots) {
        def.levels.forEach((lvlDef, li) => {
          const lvl = li + 1;
          const canAfford = balance >= lvlDef.hireCost;
          html += `<div class="coach-hire-row">
            <div class="coach-hire-info">
              <span class="coach-hire-label">Lv${lvl} ${def.label}</span>
              <span class="coach-hire-meta">${lvlDef.desc} · Hire: £${lvlDef.hireCost}M · £${lvlDef.weeklyWage}k/wk</span>
            </div>
            <button class="fac-hire-btn btn-primary btn-sm${canAfford?'':' btn-disabled'}" data-role="${role}" data-level="${lvl}" data-hire="${lvlDef.hireCost}" data-wage="${lvlDef.weeklyWage}" ${canAfford?'':'disabled'}>Hire</button>
          </div>`;
        });
      }
      html += `</div>`;
    });
    html += `</div>`;
    el.insertAdjacentHTML('beforeend', html);
    el.querySelectorAll('.fac-hire-btn').forEach(btn => btn.addEventListener('click', () => {
      const cost = parseFloat(btn.dataset.hire);
      const bal  = gameState.finances?.balance ?? 0;
      if (bal < cost) { notify('Insufficient funds.', 'error'); return; }
      if (gameState.finances) gameState.finances.balance = Math.round((gameState.finances.balance - cost) * 10) / 10;
      const def = COACH_DEFS[btn.dataset.role];
      const lvl = parseInt(btn.dataset.level);
      const lvlDef = def.levels[lvl - 1];
      const coach = { id: `coach_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, role: btn.dataset.role, name: randomCoachName(), level: lvl, weeklyWage: parseFloat(btn.dataset.wage) };
      if (!gameState.staff) gameState.staff = { coaches: [] };
      gameState.staff.coaches.push(coach);
      notify(`${def.label} (Lv${lvl}) hired!`, 'success');
      renderView('facilities');
    }));
    el.querySelectorAll('.fac-fire-btn').forEach(btn => btn.addEventListener('click', () => {
      gameState.staff.coaches = gameState.staff.coaches.filter(c => c.id !== btn.dataset.cid);
      notify('Coach released.', 'success');
      renderView('facilities');
    }));
  }

  function randomCoachName() {
    const first = ['Marco','Luis','David','Pedro','John','Carlos','Alan','Steve','Jorge','Mikel','Rui','Frank','Yann','Hans','Luca','Diego','Eric','Sven','Thierry','Phil'];
    const last  = ['Santos','Garcia','Moura','Lopes','Thompson','Diaz','Shearer','Bruce','Mendes','Arteta','Costa','Lampard','Brun','Müller','Rossi','Simeone','Cantona','Eriksson','Henry','Neville'];
    return `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
  }

  function renderFacilities(m) {
    const club = gameState.myClub;
    const fin  = gameState.finances;
    const tab  = ui.facilitiesTab || 'academy';
    facEnsureInit(club);

    const tabDefs = [
      { key: 'academy',  label: 'Academy' },
      { key: 'stadium',  label: 'Stadium' },
      { key: 'training', label: 'Training' },
      { key: 'rehab',    label: 'Rehab Centre' },
    ];
    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Facilities</div><div class="view-subtitle">${esc(club.name)}</div></div></div>
      <div class="fac-tab-row">${tabDefs.map(t=>`<button class="fac-tab-btn ${tab===t.key?'active':''}" data-t="${t.key}">${t.label}</button>`).join('')}</div>
      <div id="fac-body"></div>`;
    m.querySelectorAll('.fac-tab-btn').forEach(b => b.addEventListener('click', () => { ui.facilitiesTab = b.dataset.t; renderFacilities(m); }));

    const body = $('fac-body');
    if      (tab === 'academy')  renderFacAcademy(body, club, fin);
    else if (tab === 'stadium')  renderFacStadium(body, club, fin);
    else if (tab === 'training') renderFacTraining(body, club, fin);
    else if (tab === 'rehab')    renderFacRehab(body, club, fin);

    body.querySelectorAll('.fac-upgrade-btn').forEach(btn => btn.addEventListener('click', () => facDoUpgrade(btn.dataset.fac, parseFloat(btn.dataset.cost))));
  }

  function renderFacAcademy(el, club, fin) {
    const progress = calcAcademyProgress(club);
    const lvl = Math.max(1, Math.min(5, Math.ceil(progress / 20) || 1));
    club.facilities.academy = lvl;
    const youth = club.youthPlayers || [];
    const slotsByLvl = [0, 1, 2, 3, 5, 8];

    const INTAKE_COUNTS  = ['—','1/season','2/season','3/season','5/season','8/season'];
    const pendingCount = (club.pendingIntake || []).length;
    el.innerHTML = facHeaderCard(
      'Youth Academy',
      '<rect x="3" y="13" width="30" height="18" rx="2"/><path d="M12 13V9a6 6 0 0 1 12 0v4"/><line x1="18" y1="19" x2="18" y2="24"/><line x1="15" y1="21.5" x2="21" y2="21.5"/>',
      lvl, fin, 'academy',
      'Hire academy coaches and build training facilities to develop your youth system. Each coach and relevant facility raises the academy rating.',
      progress
    );

    // Benefit summary
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Academy Overview</div>
      <div class="fac-benefit-list">
        <div class="fac-benefit-row"><span class="fac-benefit-label">Annual Intake</span><span class="fac-benefit-val text-accent">${INTAKE_COUNTS[lvl]}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Incoming Prospects</span><span class="fac-benefit-val">${pendingCount > 0 ? `${pendingCount} arriving this season` : '—'}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Max Youth Squad</span><span class="fac-benefit-val">${slotsByLvl[lvl]} players</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Running Cost</span><span class="fac-benefit-val text-neg">£${[0,0.05,0.15,0.50,1.50,4.00][lvl]}M/yr</span></div>
      </div>
    </div>`);

    // Coach panel
    renderCoachPanel(el, ['academy'], 'academy');

    // Youth squad table
    const coachDevBonus = (gameState.staff?.coaches||[]).filter(c=>c.role==='academy').reduce((s,c)=>s+[0,0.2,0.5,1.0][c.level]||0,0);
    const pending = (club.pendingIntake || []).slice().sort((a,b) => new Date(a._arriveDate)-new Date(b._arriveDate));
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Youth Squad <span style="font-size:12px;color:var(--text-muted)">(${youth.length}/${slotsByLvl[lvl]})</span></span>
        ${lvl >= 1 && coachDevBonus > 0 ? `<span style="font-size:12px;color:var(--accent)">Dev bonus: +${coachDevBonus.toFixed(1)}%/wk</span>` : ''}
      </div>
      ${youth.length === 0 && pending.length === 0
        ? `<div class="stat-label" style="color:var(--text-muted);padding:10px 0">No youth players. Intake prospects arrive gradually through the season once academy is active.</div>`
        : `<table class="squad-table">
            <thead><tr><th>Name</th><th>Pos</th><th class="th-c">Age</th><th class="th-c">OVR</th><th class="th-c">POT</th><th class="th-c">Status</th><th></th></tr></thead>
            <tbody>${youth.map(p => {
              const contractLeft = p.contractEnd ? Math.round((new Date(p.contractEnd) - gameState.currentDate) / (30.44 * 24 * 3600 * 1000)) : null;
              const contractLabel = contractLeft != null ? (contractLeft <= 0 ? '<span style="color:var(--accent-red)">Expired</span>' : `${contractLeft}m`) : '—';
              return `<tr>
                <td style="font-weight:600">${esc(p.name)}</td>
                <td><span class="pos-badge">${p.pos}</span></td>
                <td class="text-center">${p.age}</td>
                <td class="text-center"><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span></td>
                <td class="text-center" style="color:var(--accent-gold);font-weight:700">${p.pot > p.ovr ? p.pot : '—'}</td>
                <td class="text-center" style="font-size:11px;color:var(--text-muted)">${contractLabel}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn-primary btn-sm fac-promote-btn" data-pid="${p.id}" style="margin-right:4px">Promote</button>
                  <button class="btn-secondary btn-sm fac-release-youth-btn" data-pid="${p.id}">Release</button>
                </td>
              </tr>`;
            }).join('')}
            ${pending.map(p => {
              const arrive = new Date(p._arriveDate);
              const daysLeft = Math.max(1, Math.round((arrive - gameState.currentDate) / 86400000));
              const weeksLeft = daysLeft >= 14 ? `~${Math.round(daysLeft/7)}w` : `${daysLeft}d`;
              return `<tr style="opacity:0.5">
                <td style="font-weight:600">${esc(p.name)}</td>
                <td><span class="pos-badge">${p.pos}</span></td>
                <td class="text-center">${p.age}</td>
                <td class="text-center" style="color:var(--text-muted)">?</td>
                <td class="text-center" style="color:var(--text-muted)">?</td>
                <td class="text-center"><span style="font-size:11px;color:var(--accent-gold)">Arriving in ${weeksLeft}</span></td>
                <td style="text-align:right"><button class="btn-secondary btn-sm fac-release-pending-btn" data-pid="${p.id}">Release</button></td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>`}
    </div>`);

    el.querySelectorAll('.fac-promote-btn').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const p   = (club.youthPlayers || []).find(y => y.id === pid);
      if (!p) return;
      if (club.players.length >= 40) { notify('First-team squad is full (40 max). Release a player first.', 'error'); return; }
      p.isYouth = false;
      club.players.push(p);
      club.youthPlayers = club.youthPlayers.filter(y => y.id !== pid);
      notify(`${p.name} promoted to the first team!`, 'success');
      renderView('facilities');
    }));
    el.querySelectorAll('.fac-release-youth-btn').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const p   = (club.youthPlayers || []).find(y => y.id === pid);
      if (!p) return;
      if (!confirm(`Release ${p.name} from the academy?`)) return;
      club.youthPlayers = club.youthPlayers.filter(y => y.id !== pid);
      notify(`${p.name} released from the academy.`, 'success');
      renderView('facilities');
    }));
    el.querySelectorAll('.fac-release-pending-btn').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const p   = (club.pendingIntake || []).find(y => y.id === pid);
      if (!p) return;
      if (!confirm(`Release ${p.name} before they join the academy?`)) return;
      club.pendingIntake = club.pendingIntake.filter(y => y.id !== pid);
      notify(`${p.name} rejected — they will not join the academy.`, 'info');
      renderView('facilities');
    }));
  }

  const ZONE_PRICE_COLORS = { cheap: '#4e9f6e', standard: '#00d084', high: '#f5a623', premium: '#e74c3c' };
  const STADIUM_RENOS = [
    { key: 'floodlights',   label: 'LED Floodlights',       cost: 0.3,  desc: 'Enables evening kick-offs, lifts atmosphere.' },
    { key: 'media_suite',   label: 'Media & Press Suite',   cost: 0.5,  desc: '+5% sponsorship value via brand exposure.' },
    { key: 'safe_standing', label: 'Safe Standing Rail',    cost: 0.6,  desc: 'Loudest atmosphere section, vocal home fans.' },
    { key: 'vip_boxes',     label: 'Executive Boxes',       cost: 0.8,  desc: '+8% matchday income from premium hospitality.' },
    { key: 'family_zone',   label: 'Family Zone',           cost: 0.4,  desc: 'Broadens fanbase, +3% attendance uplift.' },
    { key: 'pitch_heating', label: 'Undersoil Heating',     cost: 0.7,  desc: 'Prevents winter postponements.' },
    { key: 'big_screen',    label: 'HD Big Screen',         cost: 0.35, desc: 'Improves matchday experience and dwell time.' },
    { key: 'concourse',     label: 'Concourse Refurb',      cost: 0.45, desc: '+6% food & beverage matchday revenue.' },
  ];

  function renderFacStadium(el, club, fin) {
    if (!club.renovations) club.renovations = {};
    if (!club.stadiumStands) {
      const rep = Math.max(1, Math.min(5, Math.round(club.rep)));
      club.stadiumStands = {
        east:    { type: 'seated', tier: rep >= 5 ? 2 : 1 },
        north:   rep >= 2 ? { type: 'seated', tier: 1 } : null,
        west:    rep >= 3 ? { type: 'seated', tier: 1 } : null,
        south:   rep >= 4 ? { type: 'seated', tier: 1 } : null,
        corners: rep >= 4 ? { type: 'seated', tier: 1 } : null,
      };
    }
    const progress = calcStadiumProgress(club);
    const lvl   = Math.max(1, Math.min(5, Math.ceil(progress / 20) || 1));
    club.facilities.stadium = lvl;
    const level = leagueLevel(club);
    const atmoLabels = ['—','Modest','Lively','Passionate','Electric','Legendary'];
    if (!club.stadiumZones) club.stadiumZones = zoneDefaultPrices();
    const zones = club.stadiumZones;
    const mdBase = matchdayBase(club);
    const effMult = effectivePriceMult(club, fin, level);
    const selectedZone = ui._stadiumZone || null;

    // Total capacity from stands
    const standCapacity = { east: [0,12000,22000], north: [0,8000,16000], west: [0,10000,18000], south: [0,7000,13000], corners: [0,3000,6000] };
    const totalCap = Object.entries(club.stadiumStands).reduce((tot, [id, s]) => {
      if (!s) return tot;
      return tot + (standCapacity[id]?.[s.tier] || 5000);
    }, 0);

    el.innerHTML = facHeaderCard(
      'Stadium',
      '<ellipse cx="18" cy="21" rx="14" ry="7"/><path d="M4 21V15c0-3.9 6.3-7 14-7s14 3.1 14 7v6"/><line x1="10" y1="13" x2="10" y2="21"/><line x1="18" y1="11" x2="18" y2="21"/><line x1="26" y1="13" x2="26" y2="21"/>',
      lvl, fin, 'stadium',
      'Build stands and renovate the ground. Each stand added and renovation commissioned raises the overall stadium rating.',
      progress
    );

    // Quick stats bar
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="fac-benefit-list">
        <div class="fac-benefit-row"><span class="fac-benefit-label">Total Capacity</span><span class="fac-benefit-val">~${totalCap.toLocaleString()}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Atmosphere</span><span class="fac-benefit-val text-accent">${atmoLabels[lvl]}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Home XG Uplift</span><span class="fac-benefit-val text-accent">+${[0,1,2,4,6,9][lvl]}%</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Est. Matchday/Game</span><span class="fac-benefit-val text-accent">${money(Math.round(mdBase * effMult / 19 * 100)/100)}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Est. Matchday Season</span><span class="fac-benefit-val text-accent">${money(Math.round(mdBase * effMult * 100)/100)}</span></div>
      </div>
    </div>`);

    // Bird's-eye stadium view + zone panel
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Stadium Plan — Click a Zone to Set Prices</div>
      <div class="stadium-layout">
        <div class="stadium-svg-wrap">${buildStadiumSVG(zones, selectedZone, club)}</div>
        <div class="stadium-zone-panel" id="stadium-zone-panel">${selectedZone ? renderZonePanel(selectedZone, zones, mdBase, level) : renderZoneLegend(zones, mdBase, level)}</div>
      </div>
    </div>`);

    // Zone click handlers
    el.querySelectorAll('.sz-zone').forEach(z => z.addEventListener('click', () => {
      ui._stadiumZone = z.dataset.zone === ui._stadiumZone ? null : z.dataset.zone;
      renderView('facilities');
    }));
    // Zone price buttons
    el.querySelectorAll('.sz-price-btn').forEach(btn => btn.addEventListener('click', () => {
      zones[btn.dataset.zone] = btn.dataset.price;
      renderView('facilities');
    }));
    // Back to legend
    el.querySelector('#sz-back')?.addEventListener('click', () => { ui._stadiumZone = null; renderView('facilities'); });

    // Renovations
    const done = club.renovations || {};
    const bal  = fin?.balance ?? 0;
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Renovations & Infrastructure</div>
      <div class="fac-renovations-grid">
        ${STADIUM_RENOS.map(r => done[r.key]
          ? `<div class="fac-reno-card fac-reno-done"><div class="fac-reno-label">${r.label}</div><div class="fac-reno-desc">${r.desc}</div><div class="fac-reno-status">✓ Complete</div></div>`
          : `<div class="fac-reno-card"><div class="fac-reno-label">${r.label}</div><div class="fac-reno-desc">${r.desc}</div>
             <button class="fac-reno-btn btn-primary btn-sm${bal>=r.cost?'':' btn-disabled'}" data-reno="${r.key}" data-cost="${r.cost}" data-label="${r.label}" ${bal>=r.cost?'':'disabled'}>Build · £${r.cost}M</button>
             </div>`
        ).join('')}
      </div>
    </div>`);
    el.querySelectorAll('.fac-reno-btn').forEach(btn => btn.addEventListener('click', () => {
      const cost = parseFloat(btn.dataset.cost);
      if ((fin?.balance ?? 0) < cost) { notify('Insufficient funds.', 'error'); return; }
      if (fin) fin.balance = Math.round((fin.balance - cost) * 10) / 10;
      if (!club.renovations) club.renovations = {};
      club.renovations[btn.dataset.reno] = true;
      const newProg = calcStadiumProgress(club);
      club.facilities.stadium = Math.max(1, Math.min(5, Math.ceil(newProg/20)||1));
      notify(`${btn.dataset.label} complete!`, 'success');
      renderView('facilities');
    }));

    // === STAND MANAGEMENT ===
    const STAND_DEFS = [
      { id: 'east',    label: 'Main Stand (East)',   required: true,  desc: 'Long side — seats & corporate' },
      { id: 'north',   label: 'North End (Home)',    required: false, desc: 'Home supporters end' },
      { id: 'west',    label: 'West Stand',          required: false, desc: 'Long side — general admission' },
      { id: 'south',   label: 'South End (Away)',    required: false, desc: 'Away supporters section' },
      { id: 'corners', label: 'Corner Sections',     required: false, desc: 'Curved corner seating' },
    ];
    const STAND_CAPS = { east:[0,12000,22000], north:[0,8000,16000], west:[0,10000,18000], south:[0,7000,13000], corners:[0,3000,6000] };
    const STAND_COSTS = { build_terrace:0.8, build_seated:2.0, upgrade_upper:4.5, change_type:1.2, demolish_refund:0.3 };
    const ss = club.stadiumStands;

    const standRows = STAND_DEFS.map(def => {
      const s = ss[def.id];
      const cap = s ? (STAND_CAPS[def.id]?.[s.tier] || 0) : 0;
      const bal2 = fin?.balance ?? 0;
      let actions = '';
      if (!s) {
        const canBldT = bal2 >= STAND_COSTS.build_terrace;
        const canBldS = bal2 >= STAND_COSTS.build_seated;
        actions = `
          <button class="stand-act-btn btn-sm btn-secondary${canBldT?'':' btn-disabled'}" data-stand="${def.id}" data-action="build_terrace" data-cost="${STAND_COSTS.build_terrace}" ${canBldT?'':'disabled'}>Build Terrace · £${STAND_COSTS.build_terrace}M</button>
          <button class="stand-act-btn btn-sm btn-primary${canBldS?'':' btn-disabled'}" data-stand="${def.id}" data-action="build_seated" data-cost="${STAND_COSTS.build_seated}" ${canBldS?'':'disabled'}>Build Seated · £${STAND_COSTS.build_seated}M</button>`;
      } else {
        const canUp = !def.required && s.tier < 2 && s.type === 'seated' && bal2 >= STAND_COSTS.upgrade_upper;
        const canChange = s.type === 'terrace' && bal2 >= STAND_COSTS.change_type;
        actions = `
          ${s.tier < 2 && s.type === 'seated' ? `<button class="stand-act-btn btn-sm btn-primary${canUp?'':' btn-disabled'}" data-stand="${def.id}" data-action="upgrade_upper" data-cost="${STAND_COSTS.upgrade_upper}" ${canUp?'':'disabled'}>Add Upper Tier · £${STAND_COSTS.upgrade_upper}M</button>` : ''}
          ${s.type === 'terrace' ? `<button class="stand-act-btn btn-sm btn-secondary${canChange?'':' btn-disabled'}" data-stand="${def.id}" data-action="change_type" data-cost="${STAND_COSTS.change_type}" ${canChange?'':'disabled'}>Convert Seated · £${STAND_COSTS.change_type}M</button>` : ''}
          ${!def.required ? `<button class="stand-act-btn btn-sm btn-danger" data-stand="${def.id}" data-action="demolish" data-cost="0">Demolish (+£${STAND_COSTS.demolish_refund}M refund)</button>` : ''}`;
      }
      return `<tr>
        <td style="font-weight:600">${def.label}</td>
        <td>${s ? (s.type === 'terrace' ? 'Terrace' : s.tier === 2 ? 'Seated (2 tier)' : 'Seated') : '<span style="color:var(--text-muted)">Open / Not built</span>'}</td>
        <td>${cap ? cap.toLocaleString() : '—'}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 0">${actions}</td>
      </tr>`;
    }).join('');

    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Stadium Expansion</div>
      <div class="stat-label" style="margin-bottom:10px">Build, upgrade or demolish stands. Each stand adds capacity, match atmosphere, and raises the overall stadium rating.</div>
      <table class="squad-table" style="width:100%">
        <thead><tr><th>Stand</th><th>Type</th><th>Capacity</th><th>Actions</th></tr></thead>
        <tbody>${standRows}</tbody>
      </table>
    </div>`);

    el.querySelectorAll('.stand-act-btn').forEach(btn => btn.addEventListener('click', () => {
      const standId = btn.dataset.stand;
      const action  = btn.dataset.action;
      const cost    = parseFloat(btn.dataset.cost);
      const balance = fin?.balance ?? 0;
      if (cost > 0 && balance < cost) { notify('Insufficient funds.', 'error'); return; }
      if (fin && cost > 0) fin.balance = Math.round((fin.balance - cost) * 10) / 10;
      if (action === 'build_terrace') {
        club.stadiumStands[standId] = { type: 'terrace', tier: 1 };
        notify(`${standId} terrace built!`, 'success');
      } else if (action === 'build_seated') {
        club.stadiumStands[standId] = { type: 'seated', tier: 1 };
        notify(`${standId} seated stand built!`, 'success');
      } else if (action === 'upgrade_upper') {
        club.stadiumStands[standId].tier = 2;
        notify(`${standId} upper tier added!`, 'success');
      } else if (action === 'change_type') {
        club.stadiumStands[standId].type = 'seated';
        notify(`${standId} converted to seating!`, 'success');
      } else if (action === 'demolish') {
        if (fin) fin.balance = Math.round((fin.balance + STAND_COSTS.demolish_refund) * 10) / 10;
        club.stadiumStands[standId] = null;
        notify(`${standId} demolished. £${STAND_COSTS.demolish_refund}M salvage received.`, 'info');
      }
      const newProg2 = calcStadiumProgress(club);
      club.facilities.stadium = Math.max(1, Math.min(5, Math.ceil(newProg2/20)||1));
      renderView('facilities');
    }));
  }

  function buildStadiumSVG(zones, selectedZone, club) {
    const W = 500, H = 640;
    const rep = Math.max(1, Math.min(5, Math.round(club?.rep || 3)));
    const facLvl = club?.facilities?.stadium || rep;
    const stadiumName = (DATA.CLUB_STADIUMS && DATA.CLUB_STADIUMS[club?.id]) || ((club?.name || 'Stadium') + ' Park');

    // Use stadiumStands config; fall back to rep-based defaults for old saves
    let ss = club?.stadiumStands || {};
    if (!ss.east) {
      // Old save or uninitialised — build defaults from rep
      ss = {
        east:    { type: 'seated', tier: rep >= 4 ? 2 : 1 },
        north:   rep >= 2 ? { type: 'seated', tier: rep >= 5 ? 2 : 1 } : null,
        west:    rep >= 3 ? { type: 'seated', tier: rep >= 4 ? 2 : 1 } : null,
        south:   rep >= 4 ? { type: 'seated', tier: rep >= 5 ? 2 : 1 } : null,
        corners: rep >= 4 ? { type: 'seated', tier: rep >= 5 ? 2 : 1 } : null,
      };
      if (club) club.stadiumStands = ss; // persist so next visit is consistent
    }
    const hasNorth   = !!(ss.north);
    const hasSouth   = !!(ss.south);
    const hasEast    = true;
    const hasWest    = !!(ss.west);
    const hasCorners = !!(ss.corners);
    // Upper tier: shown for a stand only if its tier >= 2
    const northUpper = hasNorth   && (ss.north?.tier   || 0) >= 2;
    const southUpper = hasSouth   && (ss.south?.tier   || 0) >= 2;
    const eastUpper  =               (ss.east?.tier    || 0) >= 2;
    const westUpper  = hasWest    && (ss.west?.tier    || 0) >= 2;
    const hasUpper   = northUpper || southUpper || eastUpper || westUpper;

    // Portrait pitch — 200×308 ratio≈1.54:1 matching real pitch 105×68m
    // Goals at top (North) and bottom (South), long sides are East (Main) and West
    const PL=150, PT=166, PR=350, PB=474; // pitch
    const pw=PR-PL, ph=PB-PT, cx=(PL+PR)/2, cy=(PT+PB)/2;

    // Scale stand depth by facility level: level 1=thin, level 5=huge
    const scale = [0.48, 0.65, 0.82, 1.0, 1.22][facLvl-1] || 1.0;
    const LTH=Math.round(62*scale), LTW=Math.round(54*scale);
    const LN=PT-LTH, LS=PB+LTH, LW=PL-LTW, LE=PR+LTW;

    // Tier gap
    const GAP=5;

    // Upper tier boundaries
    const UTH=Math.round(44*scale), UTW=Math.round(38*scale);
    const UN=LN-GAP-UTH, US=LS+GAP+UTH, UW=LW-GAP-UTW, UE=LE+GAP+UTW;

    const renos = club?.renovations || {};

    const col = id => ZONE_PRICE_COLORS[zones[id]] || ZONE_PRICE_COLORS.standard;
    const isSel = id => selectedZone === id;
    const zAttr = id => `class="sz-zone" data-zone="${id}" style="cursor:pointer"`;

    // Helper: draw a stand (lower + optional upper tier) with seat rows
    function drawStand(id, isVertical, lx, ly, lw, lh, ux, uy, uw, uh, hasUp, label, rotLabel, gradId) {
      const c = col(id), sel = isSel(id);
      const baseOp = sel ? 1.0 : 0.82;
      const upperOp = sel ? 0.92 : 0.70;
      const selStroke = sel ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
      const selSW = sel ? 2 : 1;
      let s = '';

      // Upper tier (behind lower, drawn first)
      if (hasUp) {
        // Roof highlight on upper tier outer edge
        s += `<rect x="${ux-1}" y="${uy-1}" width="${uw+2}" height="${uh+2}" rx="3" fill="rgba(255,255,255,0.12)" ${zAttr(id)}/>`;
        s += `<rect x="${ux}" y="${uy}" width="${uw}" height="${uh}" rx="2" fill="${c}" fill-opacity="${upperOp * 0.85}" stroke="${selStroke}" stroke-width="${selSW}" ${zAttr(id)}/>`;
        // Row lines — tighter spacing in upper tier
        const rows = isVertical ? Math.floor(uh/8) : Math.floor(uw/10);
        for (let i=1;i<rows;i++) {
          if (isVertical) {
            const y=uy+i*(uh/rows);
            s+=`<line x1="${ux+2}" y1="${y}" x2="${ux+uw-2}" y2="${y}" stroke="rgba(0,0,0,0.18)" stroke-width="0.7" ${zAttr(id)}/>`;
          } else {
            const x=ux+i*(uw/rows);
            s+=`<line x1="${x}" y1="${uy+2}" x2="${x}" y2="${uy+uh-2}" stroke="rgba(0,0,0,0.18)" stroke-width="0.7" ${zAttr(id)}/>`;
          }
        }
        // Gap/concourse strip between tiers
        if (!isVertical) s+=`<rect x="${ux+2}" y="${ly+(lh<0?lh:0)-GAP}" width="${lw-4}" height="${GAP}" fill="#0d1220" opacity="0.9" ${zAttr(id)}/>`;
        else if (isVertical && lx > ux) s+=`<rect x="${lx+(lw<0?lw:0)-GAP}" y="${uy+2}" width="${GAP}" height="${uh-4}" fill="#0d1220" opacity="0.9" ${zAttr(id)}/>`;
        else s+=`<rect x="${lx+lw}" y="${uy+2}" width="${GAP}" height="${uh-4}" fill="#0d1220" opacity="0.9" ${zAttr(id)}/>`;
      }

      // Lower tier — main seating bowl (brighter, closer to pitch)
      s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="2"
        fill="${c}" fill-opacity="${baseOp}"
        stroke="${selStroke}" stroke-width="${selSW}" ${zAttr(id)}/>`;

      // Seat row lines in lower tier — denser, visible rows
      const lrows = isVertical ? Math.floor(lh/7) : Math.floor(lw/9);
      for (let i=1;i<lrows;i++) {
        if (isVertical) {
          const y=ly+i*(lh/lrows);
          s+=`<line x1="${lx+2}" y1="${y}" x2="${lx+lw-2}" y2="${y}" stroke="rgba(0,0,0,0.22)" stroke-width="0.8" ${zAttr(id)}/>`;
        } else {
          const x=lx+i*(lw/lrows);
          s+=`<line x1="${x}" y1="${ly+2}" x2="${x}" y2="${ly+lh-2}" stroke="rgba(0,0,0,0.22)" stroke-width="0.8" ${zAttr(id)}/>`;
        }
      }

      // 3D depth gradient overlay on lower tier
      if (gradId) {
        s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="2" fill="url(#${gradId})" pointer-events="none"/>`;
      }
      // Roof structure line on outer edge of lower tier
      const roofThick = Math.max(3, Math.round(LTH*0.08));
      if (!isVertical) {
        const ry = ly < cy ? ly : ly+lh-roofThick;
        s+=`<rect x="${lx}" y="${ry}" width="${lw}" height="${roofThick}" fill="rgba(200,220,255,0.12)" rx="1" pointer-events="none"/>`;
      } else {
        const rx2 = lx > cx ? lx : lx+lw-roofThick;
        s+=`<rect x="${rx2}" y="${ly}" width="${roofThick}" height="${lh}" fill="rgba(200,220,255,0.12)" rx="1" pointer-events="none"/>`;
      }

      // Advertising hoarding — thin bright strip at pitch edge
      const hoardW=3;
      if (!isVertical) {
        const hy = ly > cy ? ly : ly+lh-hoardW;
        s+=`<rect x="${lx+1}" y="${hy}" width="${lw-2}" height="${hoardW}" fill="rgba(255,255,255,0.55)" rx="1" ${zAttr(id)}/>`;
      } else {
        const hx = lx > cx ? lx : lx+lw-hoardW;
        s+=`<rect x="${hx}" y="${ly+1}" width="${hoardW}" height="${lh-2}" fill="rgba(255,255,255,0.55)" rx="1" ${zAttr(id)}/>`;
      }

      // Label
      const tlx = lx+lw/2, tly = ly+lh/2;
      const priceTier = (TICKET_TIERS[zones[id]]?.label||'Std').toUpperCase();
      if (rotLabel) {
        s+=`<text text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="800" fill="rgba(0,0,0,0.55)" transform="rotate(-90,${tlx},${tly})" ${zAttr(id)}>${label}</text>`;
        s+=`<text text-anchor="middle" dominant-baseline="middle" font-size="7" fill="rgba(0,0,0,0.4)" transform="rotate(-90,${tlx},${tly+10})" ${zAttr(id)}>${priceTier}</text>`;
      } else {
        s+=`<text x="${tlx}" y="${tly-5}" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(0,0,0,0.55)" ${zAttr(id)}>${label}</text>`;
        s+=`<text x="${tlx}" y="${tly+7}" text-anchor="middle" font-size="7" fill="rgba(0,0,0,0.4)" ${zAttr(id)}>${priceTier}</text>`;
      }
      return s;
    }

    // Helper: draw open bank/terracing (no stand, just grass bank outline)
    function drawBank(x, y, w, h, label, rot) {
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1a2a14" stroke="rgba(255,255,255,0.06)" stroke-width="1" rx="2"/>`;
      // sparse rows
      const rows = rot ? Math.floor(h/12) : Math.floor(w/14);
      for (let i=1;i<rows;i++) {
        if (rot) { const yy=y+i*(h/rows); s+=`<line x1="${x+2}" y1="${yy}" x2="${x+w-2}" y2="${yy}" stroke="rgba(255,255,255,0.05)" stroke-width="0.6"/>`; }
        else     { const xx=x+i*(w/rows); s+=`<line x1="${xx}" y1="${y+2}" x2="${xx}" y2="${y+h-2}" stroke="rgba(255,255,255,0.05)" stroke-width="0.6"/>`; }
      }
      const tx = x+w/2, ty = y+h/2;
      s+=`<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="rgba(255,255,255,0.15)" ${rot?`transform="rotate(-90,${tx},${ty})"`:''}>${label}</text>`;
      return s;
    }

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="stadium-svg">
      <defs>
        <pattern id="grass" x="0" y="0" width="20" height="1" patternUnits="userSpaceOnUse">
          <rect width="10" height="1" fill="#2d7a3c"/><rect x="10" width="10" height="1" fill="#267334"/>
        </pattern>
        <clipPath id="pitchClip"><rect x="${PL}" y="${PT}" width="${pw}" height="${ph}"/></clipPath>
        <!-- Stand depth gradients: pitch-side bright → outer-edge darker for 3D depth illusion -->
        <linearGradient id="grad-N" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0.28)"/></linearGradient>
        <linearGradient id="grad-S" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0.28)"/></linearGradient>
        <linearGradient id="grad-E" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0.28)"/></linearGradient>
        <linearGradient id="grad-W" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0.28)"/></linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.5)"/></filter>
      </defs>`;

    // Bounding box: outermost extent of stadium (including upper tiers where present)
    const outerX = (hasUpper && hasWest ? UW : LW) - 8;
    const outerY = hasNorth ? (northUpper ? UN : LN) - 8 : PT - 8;
    const outerR = (hasUpper ? UE : LE) + 8;
    const outerB = hasSouth ? (southUpper ? US : LS) + 8 : PB + 8;
    const outerW = outerR - outerX;
    const outerH = outerB - outerY;

    // Solid grass background — entire SVG is green, stands sit on top
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#2a6b35"/>`;
    // Slightly lighter grass for the immediate pitch surround (run-off)
    svg += `<rect x="${PL-10}" y="${PT-10}" width="${pw+20}" height="${ph+20}" fill="#2d7a3c"/>`;

    // ---- STANDS ----
    // East/West extend to fill gaps when no end stand is present
    const ewTop  = hasNorth ? LN+LTH : LN;
    const ewBot  = hasSouth ? LS-LTH : LS;
    const ewH    = ewBot - ewTop;
    const ewUTop = hasNorth ? UN+UTH : UN;
    const ewUBot = hasSouth ? US-UTH : US;
    const ewUH   = ewUBot - ewUTop;

    // West stand
    if (hasWest) {
      svg += drawStand('west', true,
        LW, ewTop, LTW, ewH,
        UW, ewUTop, UTW, ewUH, westUpper,
        'WEST', true, 'grad-W');
    }

    // East / Main stand (always present)
    svg += drawStand('east', true,
      LE-LTW, ewTop, LTW, ewH,
      UE-UTW, ewUTop, UTW, ewUH, eastUpper,
      'MAIN', true, 'grad-E');

    // North stand (drawn after sides so it sits on top at corners)
    if (hasNorth) {
      svg += drawStand('north', false,
        LW, LN, LE-LW, LTH,
        UW, UN, UE-UW, UTH, northUpper,
        'NORTH END', false, 'grad-N');
    }

    // South stand
    if (hasSouth) {
      svg += drawStand('south', false,
        LW, LS-LTH, LE-LW, LTH,
        UW, US-UTH, UE-UW, UTH, southUpper,
        'SOUTH END', false, 'grad-S');
    }

    // Corner sections — curved arc seating for large grounds, lamp towers for smaller ones
    if (hasCorners) {
      const cc = col('corners'), cSel = isSel('corners');
      const selStr  = cSel ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)';
      const selSW   = cSel ? 2 : 1;
      const selFill = cSel ? 1 : 0.82;
      // Four corners: [outerX, outerY, innerX, innerY, sweepFlag, lbl]
      // Arc from one stand edge to the other, concave toward pitch corner
      const cornerDefs = [
        // NW: arc from (LW, LN+LTH) to (LW+LTW, LN), center=(LW+LTW, LN+LTH)
        { path: `M${LW} ${LN+LTH} L${LW} ${LN} L${LW+LTW} ${LN} A${LTW} ${LTH} 0 0 0 ${LW} ${LN+LTH}Z`, cx: LW+LTW/2, cy: LN+LTH/2, upX:UW, upY:UN, upW:UTW, upH:UTH },
        // NE: arc from (LE-LTW, LN) to (LE, LN+LTH)
        { path: `M${LE-LTW} ${LN} L${LE} ${LN} L${LE} ${LN+LTH} A${LTW} ${LTH} 0 0 0 ${LE-LTW} ${LN}Z`, cx: LE-LTW/2, cy: LN+LTH/2, upX:UE-UTW, upY:UN, upW:UTW, upH:UTH },
        // SW: arc from (LW+LTW, LS) to (LW, LS-LTH)
        { path: `M${LW+LTW} ${LS} L${LW} ${LS} L${LW} ${LS-LTH} A${LTW} ${LTH} 0 0 0 ${LW+LTW} ${LS}Z`, cx: LW+LTW/2, cy: LS-LTH/2, upX:UW, upY:US-UTH, upW:UTW, upH:UTH },
        // SE: arc from (LE, LS-LTH) to (LE-LTW, LS)
        { path: `M${LE} ${LS-LTH} L${LE} ${LS} L${LE-LTW} ${LS} A${LTW} ${LTH} 0 0 0 ${LE} ${LS-LTH}Z`, cx: LE-LTW/2, cy: LS-LTH/2, upX:UE-UTW, upY:US-UTH, upW:UTW, upH:UTH },
      ];
      cornerDefs.forEach(cd => {
        svg += `<path d="${cd.path}" fill="${cc}" fill-opacity="${selFill}"
          stroke="${selStr}" stroke-width="${selSW}" ${zAttr('corners')}/>`;
        // Concentric arc row lines
        for (let t=0.25; t<1; t+=0.25) {
          const rwX = LTW*t, rwY = LTH*t;
          // mini arc to simulate seat rows — draw at scaled radius inside each corner
          // (approximate with line in upper/lower direction)
        }
        // Upper curved corner
        if (hasUpper) {
          svg += `<path d="M${cd.upX} ${cd.upY+cd.upH} L${cd.upX} ${cd.upY} L${cd.upX+cd.upW} ${cd.upY} A${cd.upW} ${cd.upH} 0 0 0 ${cd.upX} ${cd.upY+cd.upH}Z"
            fill="${cc}" fill-opacity="${cSel?0.85:0.62}"
            stroke="${selStr}" stroke-width="${selSW*0.7}" ${zAttr('corners')}/>`;
        }
      });
    } else {
      // Smaller grounds: open corners with lamp tower markers
      const lampCorners = [
        [LW-2, LN-2], [LE+2-8, LN-2], [LW-2, LS+2-8], [LE+2-8, LS+2-8]
      ];
      const ts = Math.max(5, Math.round(9*scale));
      lampCorners.forEach(([tx,ty]) => {
        svg += `<rect x="${tx}" y="${ty}" width="${ts}" height="${ts}" fill="#2a3a4a" rx="1" stroke="rgba(150,180,220,0.4)" stroke-width="1"/>`;
        svg += `<circle cx="${tx+ts/2}" cy="${ty+ts/2}" r="${ts*0.3}" fill="rgba(255,220,100,0.25)" stroke="rgba(255,220,100,0.5)" stroke-width="0.8"/>`;
      });
    }

    // ---- PITCH ----
    // Grass stripes (mowed alternating bands)
    svg += `<rect x="${PL}" y="${PT}" width="${pw}" height="${ph}" fill="#267334"/>`;
    const stripeW = 20;
    for (let sx=PL; sx<PR; sx+=stripeW*2) {
      svg += `<rect x="${sx}" y="${PT}" width="${Math.min(stripeW,PR-sx)}" height="${ph}" fill="#2d7a3c" clip-path="url(#pitchClip)"/>`;
    }

    // Pitch outline
    svg += `<rect x="${PL}" y="${PT}" width="${pw}" height="${ph}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>`;

    // Halfway line
    svg += `<line x1="${PL}" y1="${cy}" x2="${PR}" y2="${cy}" stroke="rgba(255,255,255,0.45)" stroke-width="1.2"/>`;

    // Centre circle
    const cr = Math.round(ph * 0.135);
    svg += `<circle cx="${cx}" cy="${cy}" r="${cr}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.2"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="rgba(255,255,255,0.6)"/>`;

    // Penalty areas (top & bottom)
    const paW=Math.round(pw*0.48), paH=Math.round(ph*0.22);
    const paX=cx-paW/2;
    svg += `<rect x="${paX}" y="${PT}" width="${paW}" height="${paH}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>`;
    svg += `<rect x="${paX}" y="${PB-paH}" width="${paW}" height="${paH}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>`;

    // Goal areas (6yd box)
    const gaW=Math.round(pw*0.26), gaH=Math.round(ph*0.09);
    const gaX=cx-gaW/2;
    svg += `<rect x="${gaX}" y="${PT}" width="${gaW}" height="${gaH}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>`;
    svg += `<rect x="${gaX}" y="${PB-gaH}" width="${gaW}" height="${gaH}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>`;

    // Penalty spots
    const psY = Math.round(ph*0.175);
    svg += `<circle cx="${cx}" cy="${PT+psY}" r="1.8" fill="rgba(255,255,255,0.55)"/>`;
    svg += `<circle cx="${cx}" cy="${PB-psY}" r="1.8" fill="rgba(255,255,255,0.55)"/>`;

    // Corner arcs
    const arc=8;
    svg += `<path d="M${PL+arc},${PT} A${arc},${arc} 0 0,0 ${PL},${PT+arc}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
    svg += `<path d="M${PR-arc},${PT} A${arc},${arc} 0 0,1 ${PR},${PT+arc}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
    svg += `<path d="M${PL+arc},${PB} A${arc},${arc} 0 0,1 ${PL},${PB-arc}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
    svg += `<path d="M${PR-arc},${PB} A${arc},${arc} 0 0,0 ${PR},${PB-arc}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;

    // Goals (thin rectangles at top/bottom)
    const gW=Math.round(pw*0.12), gD=5;
    svg += `<rect x="${cx-gW/2}" y="${PT-gD}" width="${gW}" height="${gD}" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>`;
    svg += `<rect x="${cx-gW/2}" y="${PB}" width="${gW}" height="${gD}" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>`;

    // ---- RENOVATION VISUAL OVERLAYS ----
    // Floodlight towers — tall pylons at each corner of the stadium
    if (renos.floodlights) {
      const twrSize = Math.max(5, Math.round(8 * scale));
      const tCorners = [
        [LW-twrSize-2, LN-twrSize-2], [LE+2, LN-twrSize-2],
        [LW-twrSize-2, LS+2],         [LE+2, LS+2],
      ];
      tCorners.forEach(([tx,ty]) => {
        svg += `<rect x="${tx}" y="${ty}" width="${twrSize}" height="${twrSize}" fill="#aac4e8" rx="1" opacity="0.9"/>`;
        // Pylon arm lines
        svg += `<line x1="${tx+twrSize/2}" y1="${ty+twrSize}" x2="${cx}" y2="${cy}" stroke="rgba(170,196,232,0.12)" stroke-width="0.7"/>`;
        // Light head
        svg += `<circle cx="${tx+twrSize/2}" cy="${ty+twrSize/2}" r="${twrSize*0.3}" fill="#ffe066" opacity="0.7"/>`;
      });
    }

    // Big Screen — board behind the south/home end
    if (renos.big_screen) {
      const bsW=Math.round(pw*0.32), bsH=Math.round(LTH*0.28);
      const bsX=cx-bsW/2, bsY=hasSouth ? LS-LTH*0.5-bsH/2 : PB+LTH*0.4;
      svg += `<rect x="${bsX}" y="${bsY}" width="${bsW}" height="${bsH}" fill="#1a3a5e" rx="2" stroke="#4a90d9" stroke-width="1.5" opacity="0.95"/>`;
      svg += `<rect x="${bsX+2}" y="${bsY+2}" width="${bsW-4}" height="${bsH-4}" fill="#0a1e38" rx="1" opacity="0.8"/>`;
      svg += `<text x="${cx}" y="${bsY+bsH/2+3}" text-anchor="middle" font-size="6" fill="#4a90d9" font-weight="700">HD</text>`;
    }

    // VIP Executive Boxes — windowed strip on main stand upper section
    if (renos.vip_boxes && hasEast) {
      const boxW=Math.round(LTW*0.6), boxH=Math.round((LS-LN-LTH*2)*0.25);
      const boxX=LE-boxW-2, boxY=cy-boxH/2;
      svg += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="#2a1a4a" rx="2" stroke="#9b59b6" stroke-width="1.2" opacity="0.92"/>`;
      const winCount=4;
      for (let i=0;i<winCount;i++) {
        const wx=boxX+4+i*(boxW-8)/winCount, ww=(boxW-8)/winCount-2;
        svg+=`<rect x="${wx}" y="${boxY+4}" width="${ww}" height="${boxH-8}" fill="rgba(180,120,255,0.35)" rx="1"/>`;
      }
    }

    // Safe Standing — diagonal hatching on north lower (home end)
    if (renos.safe_standing && hasNorth) {
      const ssX=LW+LTW*0.6, ssY=LN, ssW=Math.round((LE-LW)*0.35), ssH=LTH;
      svg += `<rect x="${ssX}" y="${ssY}" width="${ssW}" height="${ssH}" fill="rgba(40,160,80,0.25)" rx="1" stroke="rgba(40,200,80,0.5)" stroke-width="1"/>`;
      for (let i=0;i<6;i++) {
        const off=i*(ssW/5);
        svg+=`<line x1="${ssX+off}" y1="${ssY}" x2="${ssX+off-ssH*0.5}" y2="${ssY+ssH}" stroke="rgba(40,200,80,0.3)" stroke-width="1"/>`;
      }
      svg+=`<text x="${ssX+ssW/2}" y="${ssY+ssH/2+3}" text-anchor="middle" font-size="6" fill="rgba(80,255,120,0.7)" font-weight="700">STAND</text>`;
    }

    // Family Zone — coloured corner in west lower
    if (renos.family_zone && hasWest) {
      const fzX=LW, fzY=cy-LTH*0.6, fzW=LTW, fzH=Math.round(LTH*1.2);
      svg += `<rect x="${fzX}" y="${fzY}" width="${fzW}" height="${fzH}" fill="rgba(255,165,0,0.28)" rx="1" stroke="rgba(255,200,50,0.6)" stroke-width="1"/>`;
      svg+=`<text x="${fzX+fzW/2}" y="${fzY+fzH/2+3}" text-anchor="middle" font-size="6" fill="rgba(255,210,60,0.8)" font-weight="700" transform="rotate(-90,${fzX+fzW/2},${fzY+fzH/2})">FAM</text>`;
    }

    // Undersoil Heating — grid overlay on pitch corners
    if (renos.pitch_heating) {
      for (let gi=0;gi<4;gi++) {
        const gx=PL+gi*(pw/4), gy=PT;
        svg+=`<line x1="${gx}" y1="${PT}" x2="${gx}" y2="${PB}" stroke="rgba(255,140,0,0.18)" stroke-width="0.8" stroke-dasharray="3,8"/>`;
      }
      svg+=`<text x="${PL+8}" y="${PB-6}" font-size="7" fill="rgba(255,140,0,0.45)" font-weight="600">~</text>`;
    }

    // Media/press suite — satellite dish on main stand roof
    if (renos.media_suite && hasEast) {
      const mX=LE+LTW*0.15, mY=LN+LTH*0.3;
      svg += `<circle cx="${mX}" cy="${mY}" r="${Math.max(4,Math.round(5*scale))}" fill="none" stroke="#a0c0e8" stroke-width="1.5" opacity="0.8"/>`;
      svg += `<line x1="${mX}" y1="${mY}" x2="${mX+5}" y2="${mY+5}" stroke="#a0c0e8" stroke-width="1.2" opacity="0.8"/>`;
    }

    // Concourse refurb — subtle shaded ring just inside the stands
    if (renos.concourse) {
      const cRingW=Math.max(3,Math.round(6*scale));
      svg += `<rect x="${LW}" y="${LN}" width="${LE-LW}" height="${cRingW}" fill="rgba(100,160,255,0.15)" pointer-events="none"/>`;
      svg += `<rect x="${LW}" y="${LS-cRingW}" width="${LE-LW}" height="${cRingW}" fill="rgba(100,160,255,0.15)" pointer-events="none"/>`;
      svg += `<rect x="${LW}" y="${LN}" width="${cRingW}" height="${LS-LN}" fill="rgba(100,160,255,0.15)" pointer-events="none"/>`;
      svg += `<rect x="${LE-cRingW}" y="${LN}" width="${cRingW}" height="${LS-LN}" fill="rgba(100,160,255,0.15)" pointer-events="none"/>`;
    }

    // ---- LABELS ----
    // Stadium name centred at top of SVG
    svg += `<rect x="${cx-80}" y="${outerY+3}" width="160" height="16" fill="rgba(0,0,0,0.45)" rx="3"/>`;
    svg += `<text x="${cx}" y="${outerY+14}" text-anchor="middle" font-size="9.5" font-weight="700" fill="rgba(255,255,255,0.7)" font-family="sans-serif" letter-spacing="1">${esc(stadiumName).toUpperCase()}</text>`;

    // Compass N indicator
    svg += `<text x="${outerX+8}" y="${outerY+12}" font-size="8" font-weight="700" fill="rgba(255,255,255,0.25)">N↑</text>`;

    // Level indicator bottom-right
    const capList = [0, 4000, 12000, 25000, 48000, 80000];
    const capScale = Math.round(capList[facLvl] * scale);
    svg += `<text x="${outerX+outerW-8}" y="${outerY+outerH-6}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)">${capScale.toLocaleString()} cap · Lvl ${facLvl}</text>`;

    svg += `</svg>`;
    return svg;
  }

  function renderZoneLegend(zones, mdBase, level) {
    const effMult = () => {
      let w = 0, tc = 0;
      STADIUM_ZONE_DEFS.forEach(z => { w += z.cap * ticketRevenueMult(zones[z.id]||'standard', level); tc += z.cap; });
      return tc > 0 ? w / tc : 1;
    };
    return `<div class="sz-legend">
      <div class="sz-legend-title">Seating Zones</div>
      ${STADIUM_ZONE_DEFS.map(z => `
        <div class="sz-legend-row">
          <span class="sz-swatch" style="background:${ZONE_PRICE_COLORS[zones[z.id]]||ZONE_PRICE_COLORS.standard}"></span>
          <span class="sz-legend-name">${z.label}</span>
          <span class="sz-legend-price">${TICKET_TIERS[zones[z.id]]?.label||'Standard'}</span>
        </div>`).join('')}
      <div class="sz-legend-divider"></div>
      <div class="sz-legend-row"><span style="color:var(--text-muted);font-size:11px">Season income est.</span><span style="font-weight:700;color:var(--accent)">${money(Math.round(mdBase * effMult() * 100)/100)}</span></div>
      <div class="sz-hint">Click a zone on the plan to set its ticket price.</div>
    </div>`;
  }

  function renderZonePanel(zoneId, zones, mdBase, level) {
    const zDef = STADIUM_ZONE_DEFS.find(z => z.id === zoneId);
    if (!zDef) return renderZoneLegend(zones, mdBase, level);
    const current = zones[zoneId] || 'standard';
    return `<div class="sz-panel">
      <div class="sz-panel-title">${zDef.label}</div>
      <div class="sz-panel-desc">${zDef.desc} · ${Math.round(zDef.cap * 100)}% of capacity</div>
      <div class="sz-panel-section-title">Ticket Pricing</div>
      ${Object.entries(TICKET_TIERS).map(([key, t]) => {
        const mult = ticketRevenueMult(key, level);
        const income = Math.round(mdBase * zDef.cap * mult * 100) / 100;
        return `<button class="sz-price-btn ${current===key?'active':''}" data-zone="${zoneId}" data-price="${key}">
          <span class="sz-price-swatch" style="background:${ZONE_PRICE_COLORS[key]}"></span>
          <span class="sz-price-info">
            <span class="sz-price-label">${t.label}</span>
            <span class="sz-price-meta">${t.desc}</span>
            <span class="sz-price-income">${money(income)}/season from this zone</span>
          </span>
        </button>`;
      }).join('')}
      <button class="btn-secondary btn-sm" style="margin-top:8px;width:100%" id="sz-back">← All Zones</button>
    </div>`;
  }

  const TRAINING_UPGRADES = [
    { key: 'indoor_pitch',   label: 'Indoor 3G Pitch',        cost: 1.2, desc: 'Train in all weather; +0.3% dev chance, +1 fitness/wk.' },
    { key: 'video_suite',    label: 'Video Analysis Suite',   cost: 0.8, desc: 'Improves set-piece prep; +10% corner & free-kick XG.' },
    { key: 'altitude_chamber', label: 'Altitude Chamber',    cost: 1.5, desc: 'Builds stamina; +2 fitness/wk recovery for all players.' },
    { key: 'sprint_track',   label: 'Olympic Sprint Track',   cost: 0.5, desc: 'Pace-specific training; +0.2% dev for pacey players.' },
    { key: 'gym_upgrade',    label: 'Elite Strength & Conditioning', cost: 0.9, desc: '+0.3% dev for physical and defensive players.' },
    { key: 'nutrition_lab',  label: 'Nutrition Lab',          cost: 0.7, desc: 'Slows peak-age decline; players stay sharp longer.' },
    { key: 'biometric_lab',  label: 'Biometrics & Motion Lab',cost: 1.0, desc: '+0.4% dev for technically skilled players (CAM, LW, RW).' },
    { key: 'hydrotherapy',   label: 'Hydrotherapy Suite',     cost: 0.6, desc: '+1.5 fitness/wk recovery; integrates with rehab.' },
    { key: 'tactics_room',   label: 'Tactical Analysis Room', cost: 0.7, desc: 'AI opponent analysis; improves scouting report quality.' },
    { key: 'warm_weather',   label: 'Warm Weather Camp Access',cost: 0.4, desc: 'Pre-season fitness boosts; +3 fitness for all players.' },
  ];

  function renderFacTraining(el, club, fin) {
    if (!club.trainingUpgrades) club.trainingUpgrades = {};
    const trUpgrades = club.trainingUpgrades;
    const progress   = calcTrainingProgress(club);
    const lvl        = Math.max(1, Math.min(5, Math.ceil(progress / 20) || 1));
    club.facilities.training = lvl; // keep derived level in sync
    const coaches = gameState.staff?.coaches || [];
    const fitnessBonus = coaches.filter(c=>c.role==='fitness').reduce((s,c)=>s+[0,0.5,1.0,2.0][c.level]||0,0);
    const attackBonus  = coaches.filter(c=>c.role==='attacking').reduce((s,c)=>s+[0,0.2,0.5,1.0][c.level]||0,0);
    const defendBonus  = coaches.filter(c=>c.role==='defensive').reduce((s,c)=>s+[0,0.2,0.5,1.0][c.level]||0,0);
    const setPieceCoach = coaches.find(c=>c.role==='setpiece');
    const devLabels    = ['—','Basic drills','Structured sessions','Advanced coaching','Elite analysis','World-class methods'];
    const bal          = fin?.balance ?? 0;

    el.innerHTML = facHeaderCard(
      'Training Facilities',
      '<rect x="3" y="16" width="30" height="4" rx="2"/><circle cx="9" cy="18" r="5"/><circle cx="27" cy="18" r="5"/>',
      lvl, fin, 'training',
      'Build specialist facilities to develop your squad. Each facility you commission raises the overall development rating.',
      progress
    );

    // Overview summary
    const extraFitness = fitnessBonus + (trUpgrades.altitude_chamber ? 2 : 0) + (trUpgrades.hydrotherapy ? 1.5 : 0) + (trUpgrades.indoor_pitch ? 1 : 0);
    const extraDev     = [0,0,0.2,0.5,0.9,1.5][lvl] + attackBonus + defendBonus + (trUpgrades.indoor_pitch ? 0.3 : 0) + (trUpgrades.gym_upgrade ? 0.3 : 0) + (trUpgrades.biometric_lab ? 0.4 : 0) + (trUpgrades.sprint_track ? 0.2 : 0);
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Training Complex Overview</div>
      <div class="fac-benefit-list">
        <div class="fac-benefit-row"><span class="fac-benefit-label">Ground Level</span><span class="fac-benefit-val">${devLabels[lvl]} (Lv${lvl}/5)</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Total Dev Bonus</span><span class="fac-benefit-val text-accent">+${extraDev.toFixed(2)}% per tick</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Total Fitness Bonus</span><span class="fac-benefit-val text-accent">+${extraFitness.toFixed(1)}/wk</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Set Piece Analysis</span><span class="fac-benefit-val text-accent">${(trUpgrades.video_suite ? '+10%' : '—')}${setPieceCoach ? ` +coach bonus` : ''}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Running Cost</span><span class="fac-benefit-val text-neg">£${[0,0.04,0.10,0.35,1.00,3.00][lvl]}M/yr</span></div>
      </div>
    </div>`);

    // Training ground map
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Training Ground Plan</div>
      ${buildTrainingGroundSVG(trUpgrades, lvl)}
    </div>`);

    // Specialist facility upgrades grid
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Specialist Facilities</div>
      <div class="fac-renovations-grid fac-reno-3col">
        ${TRAINING_UPGRADES.map(u => trUpgrades[u.key]
          ? `<div class="fac-reno-card fac-reno-done"><div class="fac-reno-label">${u.label}</div><div class="fac-reno-desc">${u.desc}</div><div class="fac-reno-status">✓ Built</div></div>`
          : `<div class="fac-reno-card"><div class="fac-reno-label">${u.label}</div><div class="fac-reno-desc">${u.desc}</div>
             <button class="trn-build-btn btn-primary btn-sm${bal>=u.cost?'':' btn-disabled'}" data-key="${u.key}" data-cost="${u.cost}" data-label="${u.label}" ${bal>=u.cost?'':'disabled'}>Build · £${u.cost}M</button>
             </div>`
        ).join('')}
      </div>
    </div>`);
    el.querySelectorAll('.trn-build-btn').forEach(btn => btn.addEventListener('click', () => {
      const cost = parseFloat(btn.dataset.cost);
      if (bal < cost) { notify('Insufficient funds.', 'error'); return; }
      if (fin) fin.balance = Math.round((fin.balance - cost) * 10) / 10;
      if (!club.trainingUpgrades) club.trainingUpgrades = {};
      club.trainingUpgrades[btn.dataset.key] = true;
      // Sync derived level from progress
      const newProg = calcTrainingProgress(club);
      club.facilities.training = Math.max(1, Math.min(5, Math.ceil(newProg / 20) || 1));
      notify(`${btn.dataset.label} built! Development: ${newProg}/100`, 'success');
      renderView('facilities');
    }));

    // Coaches
    renderCoachPanel(el, ['fitness','setpiece','attacking','defensive'], 'training');

    // Development watchlist
    const u25 = (club.players||[]).filter(p => p.age < 25 && !p.injured && p.pot > p.ovr).sort((a,b)=>(b.pot-b.ovr)-(a.pot-a.ovr)).slice(0,8);
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Development Watchlist <span style="font-size:12px;font-weight:400;color:var(--text-muted)">under-25s with headroom</span></div>
      ${u25.length===0 ? `<div class="stat-label" style="color:var(--text-muted)">No under-25 players with growth headroom.</div>` :
      `<table class="squad-table"><thead><tr><th>Name</th><th>Pos</th><th class="th-c">Age</th><th class="th-c">OVR</th><th class="th-c">POT</th><th class="th-c">Gap</th></tr></thead>
        <tbody>${u25.map(p=>`<tr>
          <td style="font-weight:600">${esc(p.name)}</td>
          <td><span class="pos-badge">${p.pos}</span></td>
          <td class="text-center">${p.age}</td>
          <td class="text-center"><span class="ovr-badge ${ovrClass(p.ovr)}">${p.ovr}</span></td>
          <td class="text-center" style="color:var(--accent-gold);font-weight:700">${p.pot}</td>
          <td class="text-center" style="color:var(--accent)">+${p.pot-p.ovr}</td>
        </tr>`).join('')}</tbody>
      </table>`}
    </div>`);

    // Position retraining
    renderPositionRetraining(el, club);
  }

  // Position suitability: which positions a player's stats make them eligible to train into.
  // OVR and pot stay the same; only the listed position changes.
  function eligibleRetrain(p) {
    const a = p.attrs || {};
    const candidates = [];
    const pace = a.pace || 50, shoot = a.shooting || 50, pass = a.passing || 50,
          drib = a.dribbling || 50, def = a.defending || 50, phys = a.physical || 50,
          gkR = a.gkReflexes || 0;
    // GK: only if born a GK or very high gkReflexes
    if (p.pos !== 'GK' && gkR >= 60) candidates.push('GK');
    // Defensive positions: need def >= 60
    if (def >= 60) { if (p.pos !== 'CB') candidates.push('CB'); if (p.pos !== 'CDM') candidates.push('CDM'); }
    if (def >= 55 && pace >= 60) { if (p.pos !== 'LB') candidates.push('LB'); if (p.pos !== 'RB') candidates.push('RB'); }
    if (def >= 55 && pace >= 65) { if (p.pos !== 'LWB') candidates.push('LWB'); if (p.pos !== 'RWB') candidates.push('RWB'); }
    // Central midfield: need pass >= 62
    if (pass >= 62) { if (p.pos !== 'CM') candidates.push('CM'); }
    // Attacking mid: pass + drib
    if (pass >= 62 && drib >= 62) { if (p.pos !== 'CAM') candidates.push('CAM'); }
    // Wide mid/wingers: pace + drib
    if (pace >= 65 && drib >= 60) { if (p.pos !== 'LM') candidates.push('LM'); if (p.pos !== 'RM') candidates.push('RM'); }
    if (pace >= 68 && drib >= 65) { if (p.pos !== 'LW') candidates.push('LW'); if (p.pos !== 'RW') candidates.push('RW'); }
    // Striker: need shoot >= 62
    if (shoot >= 62) { if (p.pos !== 'ST') candidates.push('ST'); if (p.pos !== 'CF') candidates.push('CF'); }
    return candidates.slice(0, 4); // cap at 4 options
  }

  function renderPositionRetraining(el, club) {
    const retraining = club.retraining || {}; // { playerId: { targetPos, weeksLeft } }
    // Tick down any active retraining
    const rows = (club.players || []).map(p => {
      const rt = retraining[p.id];
      const eligible = eligibleRetrain(p);
      return { p, rt, eligible };
    }).filter(r => r.rt || r.eligible.length > 0);

    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Position Retraining</div>
      <div class="stat-label" style="margin-bottom:12px;color:var(--text-muted)">Retrain players into positions that suit their stats. OVR and potential are unchanged — only their listed position moves. Takes 6 weeks of dedicated work.</div>
      ${rows.length === 0
        ? `<div class="stat-label" style="color:var(--text-muted)">No players are eligible to retrain into alternative positions based on their current attributes.</div>`
        : `<table class="squad-table">
            <thead><tr><th>Name</th><th>Current Pos</th><th>Status</th><th>Eligible Positions</th></tr></thead>
            <tbody>${rows.map(({ p, rt, eligible }) => {
              const statusCell = rt
                ? `<td><span style="color:var(--accent-gold)">Training → ${rt.targetPos} (${rt.weeksLeft}w left)</span> <button class="trn-cancel-btn btn-secondary btn-sm" data-pid="${p.id}">Cancel</button></td>`
                : `<td style="color:var(--text-muted)">Available</td>`;
              const posButtons = !rt && eligible.length > 0
                ? `<td>${eligible.map(pos => `<button class="trn-retrain-btn btn-secondary btn-sm" data-pid="${p.id}" data-pos="${pos}" style="margin:2px">${pos}</button>`).join('')}</td>`
                : `<td>—</td>`;
              return `<tr>
                <td style="font-weight:600">${esc(p.name)}</td>
                <td><span class="pos-badge">${p.pos}</span></td>
                ${statusCell}
                ${posButtons}
              </tr>`;
            }).join('')}</tbody>
          </table>`}
    </div>`);

    el.querySelectorAll('.trn-retrain-btn').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.pid, pos = btn.dataset.pos;
      if (!club.retraining) club.retraining = {};
      club.retraining[pid] = { targetPos: pos, weeksLeft: 6 };
      notify(`Retraining started → ${pos}. Completes in 6 weeks.`, 'success');
      renderView('facilities');
    }));
    el.querySelectorAll('.trn-cancel-btn').forEach(btn => btn.addEventListener('click', () => {
      delete club.retraining[btn.dataset.pid];
      renderView('facilities');
    }));
  }

  function buildTrainingGroundSVG(upgrades, lvl) {
    const SLOTS = [
      { key: 'pitch_main',     x: 20,  y: 20,  w: 200, h: 120, label: 'Main Pitch',        always: true,   color: '#1a472a' },
      { key: 'pitch_b',        x: 230, y: 20,  w: 120, h: 120, label: 'B Pitch',           always: lvl>=2, color: '#1e5230' },
      { key: 'indoor_pitch',   x: 360, y: 20,  w: 120, h: 120, label: 'Indoor 3G',         upg: true },
      { key: 'gym_upgrade',    x: 20,  y: 155, w: 100, h: 80,  label: 'Gym',               always: true,   color: '#2a2a3e' },
      { key: 'video_suite',    x: 130, y: 155, w: 100, h: 80,  label: 'Video Suite',       upg: true },
      { key: 'altitude_chamber',x:240, y: 155, w: 100, h: 80,  label: 'Altitude Chamber',  upg: true },
      { key: 'hydrotherapy',   x: 350, y: 155, w: 130, h: 80,  label: 'Hydrotherapy',      upg: true },
      { key: 'nutrition_lab',  x: 20,  y: 250, w: 100, h: 70,  label: 'Nutrition Lab',     upg: true },
      { key: 'biometric_lab',  x: 130, y: 250, w: 110, h: 70,  label: 'Biometrics Lab',    upg: true },
      { key: 'sprint_track',   x: 250, y: 250, w: 110, h: 70,  label: 'Sprint Track',      upg: true },
      { key: 'tactics_room',   x: 370, y: 250, w: 110, h: 70,  label: 'Tactics Room',      upg: true },
    ];

    let svg = `<svg viewBox="0 0 500 340" class="training-svg">
      <rect x="0" y="0" width="500" height="340" fill="#0d1321" rx="8"/>`;

    SLOTS.forEach(s => {
      const built = s.always === true ? true : s.always === false ? false : Boolean(upgrades[s.key]);
      const isUpgradeable = s.upg;
      const fill = built
        ? (s.color || (isUpgradeable ? '#1d3a5c' : '#1a472a'))
        : 'rgba(255,255,255,0.04)';
      const stroke = built ? 'rgba(0,208,132,0.4)' : 'rgba(255,255,255,0.1)';

      svg += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;

      if (built && s.key === 'pitch_main') {
        // pitch markings
        svg += `<rect x="${s.x+8}" y="${s.y+8}" width="${s.w-16}" height="${s.h-16}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`;
        svg += `<line x1="${s.x+s.w/2}" y1="${s.y+8}" x2="${s.x+s.w/2}" y2="${s.y+s.h-8}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`;
        svg += `<circle cx="${s.x+s.w/2}" cy="${s.y+s.h/2}" r="18" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
      }

      const labelCol = built ? (s.color === '#1a472a' || s.color === '#1e5230' ? 'rgba(255,255,255,0.7)' : 'rgba(0,208,132,0.9)') : 'rgba(255,255,255,0.2)';
      svg += `<text x="${s.x+s.w/2}" y="${s.y+s.h/2-4}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="${labelCol}">${s.label}</text>`;
      if (!built) svg += `<text x="${s.x+s.w/2}" y="${s.y+s.h/2+10}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.18)">Not Built</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  function calcRehabProgress(club) {
    const coaches = (gameState.staff?.coaches || []).filter(c => c.role === 'rehab' || c.role === 'fitness');
    const coachPts = Math.min(50, coaches.length * 15);
    const u = club.trainingUpgrades || {};
    const REHAB_KEYS = ['hydrotherapy','nutrition_lab','biometric_lab','gym_upgrade','altitude_chamber'];
    const upgPts = REHAB_KEYS.filter(k => u[k]).length * 8;
    return Math.min(100, coachPts + upgPts + (club.facilities?.rehab || 1) * 5);
  }

  function renderFacRehab(el, club, fin) {
    const progress = calcRehabProgress(club);
    const lvl      = Math.max(1, Math.min(5, Math.ceil(progress / 20) || 1));
    club.facilities.rehab = lvl;
    const injured = (club.players || []).filter(p => p.injured);
    const rehabLabels = ['—','Basic physio','Sports clinic','Advanced rehab','High-performance unit','Cutting-edge medical centre'];
    const speedPct    = [0,0,10,20,33,50];
    const coaches = gameState.staff?.coaches || [];
    const rehabCoachBonus = Math.round(coaches.filter(c=>c.role==='rehab').reduce((s,c)=>s+[0,5,10,18][c.level]||0,0));
    const fitnessCoachBonus = coaches.filter(c=>c.role==='fitness').reduce((s,c)=>s+[0,0.5,1.0,2.0][c.level]||0,0);

    el.innerHTML = facHeaderCard(
      'Rehabilitation Centre',
      '<rect x="13" y="3" width="10" height="30" rx="2"/><rect x="3" y="13" width="30" height="10" rx="2"/>',
      lvl, fin, 'rehab',
      'Hire rehab and fitness coaches and build recovery facilities to upgrade your medical centre. Higher rating returns injured players faster.',
      progress
    );

    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Rehab Benefits</div>
      <div class="fac-benefit-list">
        <div class="fac-benefit-row"><span class="fac-benefit-label">Standard</span><span class="fac-benefit-val">${rehabLabels[lvl]}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Recovery Speed</span><span class="fac-benefit-val text-accent">+${speedPct[lvl]+rehabCoachBonus}% faster ${rehabCoachBonus>0?`(${speedPct[lvl]}% centre + ${rehabCoachBonus}% staff)`:''}</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Fitness Recovery</span><span class="fac-benefit-val text-accent">+${fitnessCoachBonus.toFixed(1)}/wk (fitness coaches)</span></div>
        <div class="fac-benefit-row"><span class="fac-benefit-label">Running Cost</span><span class="fac-benefit-val text-neg">£${[0,0.03,0.08,0.25,0.70,2.00][lvl]}M/yr</span></div>
      </div>
    </div>`);

    renderCoachPanel(el, ['rehab','fitness'], 'rehab');

    // Injured players
    const INJURY_TYPES_MAP = Object.fromEntries((ENGINE.INJURY_TYPES||[]).map(t=>[t.id,t]));
    el.insertAdjacentHTML('beforeend', `<div class="card">
      <div class="card-title">Treatment Room</div>
      ${injured.length === 0
        ? `<div class="stat-label" style="color:var(--accent)">No players in the treatment room.</div>`
        : `<table class="squad-table"><thead><tr><th>Name</th><th>Pos</th><th>Injury</th><th class="th-c">Weeks Left</th></tr></thead>
            <tbody>${injured.map(p => {
              const inj = INJURY_TYPES_MAP[p.injuryType];
              const sev = inj?.severity || 'minor';
              return `<tr>
                <td style="font-weight:600">${esc(p.name)}</td>
                <td><span class="pos-badge">${p.pos}</span></td>
                <td><span class="inj-badge inj-${sev}">${inj?.label||'Injured'}</span></td>
                <td class="text-center" style="color:var(--accent-red);font-weight:700">${Math.ceil(p.injuryWeeks||0)}w</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`}
    </div>`);
  }

  function facDoUpgrade(facKey, cost) {
    const club = gameState.myClub;
    const fin  = gameState.finances;
    facEnsureInit(club);
    const lvl = club.facilities[facKey];
    if (lvl >= 5) return;
    const balance = fin?.balance ?? 0;
    if (balance < cost) { notify('Insufficient funds to upgrade.', 'error'); return; }
    if (fin) fin.balance = Math.round((fin.balance - cost) * 10) / 10;
    else club.budget = Math.round((club.budget - cost) * 10) / 10;
    club.facilities[facKey] = lvl + 1;
    const names = { academy: 'Youth Academy', stadium: 'Stadium', training: 'Training Complex', rehab: 'Rehabilitation Centre' };
    notify(`${names[facKey]} upgraded to ${FAC_LABELS[lvl+1]} (Level ${lvl+1})!`, 'success');
    renderView('facilities');
  }

  /* =============================================
     SCOUT
     ============================================= */
  function renderScout(m) {
    const _st = m.scrollTop;
    const tab = ui.scoutTab || 'opponent';
    m.innerHTML = `
      <div class="view-header"><div><div class="view-title">Scouting</div><div class="view-subtitle">${tab === 'opponent' ? 'Opponent Analysis' : tab === 'youth' ? 'Youth Scouting' : 'My Scouts'}</div></div></div>
      <div class="scout-tab-row">
        <button class="scout-tab-btn ${tab==='opponent'?'active':''}" data-t="opponent">Opponent Analysis</button>
        <button class="scout-tab-btn ${tab==='scouts'?'active':''}" data-t="scouts">My Scouts <span class="scout-count-badge">${gameState.scouts.length}/5</span></button>
        <button class="scout-tab-btn ${tab==='youth'?'active':''}" data-t="youth">Youth Scouting</button>
      </div>
      <div id="scout-body"></div>`;
    m.querySelectorAll('.scout-tab-btn').forEach(b => b.addEventListener('click', () => { ui.scoutTab = b.dataset.t; renderScout(m); }));
    if (tab === 'opponent') renderScoutOpponent($('scout-body'));
    else if (tab === 'youth') renderYouthScouting($('scout-body'));
    else renderScoutPlayers($('scout-body'), m);
    m.scrollTop = _st;
  }

  function renderYouthScouting(el) {
    const club = gameState.myClub;
    const acLvl = club?.facilities?.academy || Math.round(club?.rep) || 1;
    const scopeLabel = ['','Local (Regional)', 'Regional', 'National', 'National+', 'International'][acLvl];
    const scopeDesc  = ['',
      'Your scouts can only find local talent. Upgrade the academy to widen the net.',
      'Regional coverage — solid lower-tier prospects.',
      'National scouting network — consistent good prospects.',
      'National+ network with international contacts.',
      'Global scouting network — best youth talent worldwide.'
    ][acLvl];

    if (!club.youthScoutResults) club.youthScoutResults = [];

    // Generate fresh prospects if empty or user re-scouts
    function generateProspects(n) {
      const POSITIONS = ['GK','CB','LB','RB','CM','CDM','CAM','LW','RW','ST'];
      const baseRating = Math.max(38, (club.sqRating || 60) - [0,25,20,15,10,5][acLvl]);
      const results = [];
      for (let i = 0; i < n; i++) {
        const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
        const age = 16 + Math.floor(Math.random() * 2);
        const gemChance = [0,0.02,0.05,0.10,0.18,0.30][acLvl];
        const isGem = Math.random() < gemChance;
        const rating = isGem ? Math.min(88, baseRating + 8 + Math.floor(Math.random()*10)) : baseRating + Math.floor(Math.random()*8);
        const p = DATA.generatePlayer(`yscout_${Date.now()}_${i}`, pos, rating, age, club.league);
        p.isYouth = true;
        p._scoutId = `yscout_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`;
        results.push(p);
      }
      return results;
    }

    if (club.youthScoutResults.length === 0) {
      club.youthScoutResults = generateProspects([0,2,3,4,5,6][acLvl]);
    }

    const prospects = club.youthScoutResults;
    const fin = gameState.finances[gameState.myClubId];
    const bal = fin?.balance ?? 0;
    const SIGN_COST = 0.05; // £50k signing fee per youth

    const rows = prospects.map(p => {
      const alreadySigned = (club.youthPlayers || []).some(y => y.id === p.id || y._scoutId === p._scoutId);
      const canAfford = bal >= SIGN_COST;
      return `<tr>
        <td>${p.name}</td>
        <td>${p.pos}</td>
        <td>${p.age}</td>
        <td>${p.nat || p.nation || '—'}</td>
        <td>${Math.round(p.rating)}</td>
        <td>${Math.round(p.potential || p.rating + Math.floor(Math.random()*12))}</td>
        <td>${alreadySigned
          ? `<span style="color:var(--accent);font-size:11px">Signed</span>`
          : `<button class="btn-primary btn-sm youth-sign-btn${canAfford?'':' btn-disabled'}" data-idx="${prospects.indexOf(p)}" ${canAfford?'':'disabled'}>Sign · £${(SIGN_COST*1000).toFixed(0)}k</button>`}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="card">
        <div class="card-title">Youth Scouting — ${scopeLabel}</div>
        <div class="stat-label" style="margin-bottom:10px">${scopeDesc}</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn-secondary btn-sm" id="rescout-btn">Re-scout Area</button>
          <span style="color:var(--text-muted);font-size:12px;align-self:center">Balance: ${money(bal)}</span>
        </div>
        <table class="squad-table" style="width:100%">
          <thead><tr><th>Name</th><th>Pos</th><th>Age</th><th>Nation</th><th>OVR</th><th>POT</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="stat-label" style="margin-top:8px">Signed youth players go into your Academy section in Facilities. They develop until age 22 then must be promoted to the first team or released.</div>
      </div>`;

    el.querySelector('#rescout-btn')?.addEventListener('click', () => {
      club.youthScoutResults = generateProspects([0,2,3,4,5,6][acLvl]);
      renderYouthScouting(el);
    });

    el.querySelectorAll('.youth-sign-btn').forEach(btn => btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const p = prospects[idx];
      if (!p) return;
      if (bal < SIGN_COST) { notify('Insufficient funds.', 'error'); return; }
      if (fin) fin.balance = Math.round((fin.balance - SIGN_COST) * 100) / 100;
      if (!club.youthPlayers) club.youthPlayers = [];
      p.contractEnd = new Date(new Date().getFullYear() + 2, 5, 30);
      club.youthPlayers.push(p);
      notify(`${p.name} (${p.pos}, age ${p.age}) signed to the academy!`, 'success');
      renderYouthScouting(el);
    }));
  }

  function renderScoutOpponent(el) {
    const next = ENGINE.getNextFixture(gameState);
    if (!next) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No upcoming fixtures.</div></div>`; return; }
    const myIsHome = next.home === gameState.myClubId;
    const oppId = myIsHome ? next.away : next.home;
    const opp = gameState.clubs[oppId];
    if (!opp) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">Opponent data unavailable.</div></div>`; return; }

    const aiTac = opp.tactics || ENGINE.deriveAITactics(opp);
    const oppForm = DATA.FORMATIONS[aiTac.formation] || DATA.FORMATIONS['4-3-3'];
    const oppXI = opp.lineup && opp.lineup.length === 11 ? opp.lineup : autoPickXI(opp, aiTac.formation);
    const oppXISet = new Set(oppXI);

    const pressLabel = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const styleLabel = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession' };

    const myTac = { ...gameState.tactics, customFormation: gameState.tactics.customFormation };
    const myForm = activeTacticForm();
    const myXI   = gameState.tactics.lineup;
    const mySlot = myForm.positions.map(p => p.pos);
    const oppSlot = oppForm.positions.map(p => p.pos);
    const xgRes = myIsHome
      ? ENGINE.previewEffectiveXG(gameState.myClub, opp, myTac, aiTac, myXI, oppXI, mySlot, oppSlot)
      : ENGINE.previewEffectiveXG(opp, gameState.myClub, aiTac, myTac, oppXI, myXI, oppSlot, mySlot);
    const myXG  = myIsHome ? xgRes.hEff : xgRes.aEff;
    const oppXG = myIsHome ? xgRes.aEff : xgRes.hEff;
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
            <div class="card-title">${opp.name || opp.name} Formation <span class="scout-click-hint">click player</span></div>
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
        `<option value="${a}" ${(s.assignment?.maxAge||99)===a?'selected':''}>${a===99?'Any age':'U'+a}</option>`).join('');
      const ovrOptions = [0,60,65,70,75,80,85].map(o =>
        `<option value="${o}" ${(s.assignment?.minOVR||0)===o?'selected':''}>${o===0?'Any OVR':'OVR '+o+'+'}</option>`).join('');
      const potOptions = [0,65,70,75,80,85,90].map(o =>
        `<option value="${o}" ${(s.assignment?.minPOT||0)===o?'selected':''}>${o===0?'Any POT':'POT '+o+'+'}</option>`).join('');

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
            ${f.reportedPOT > f.reportedOVR ? `<span class="scout-rp-pot">▲${f.reportedPOT}${tier.potNoise > 6 ? '?' : ''}</span>` : ''}
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
            <div class="scout-filter-form">
              <select class="scout-filter-sel" data-sid="${s.id}" data-f="pos">${posOptions}</select>
              <select class="scout-filter-sel" data-sid="${s.id}" data-f="maxAge">${ageOptions}</select>
              <select class="scout-filter-sel" data-sid="${s.id}" data-f="minOVR">${ovrOptions}</select>
              <select class="scout-filter-sel" data-sid="${s.id}" data-f="minPOT">${potOptions}</select>
              <button class="btn-primary scout-assign-btn" data-sid="${s.id}">Scout</button>
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
          ${[...SCOUT_TIERS].sort((a, b) => a.hireCost - b.hireCost).map(t => `
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

  function activatePreContracts() {
    const contracts = gameState.preContracts || [];
    if (!contracts.length) return;
    const activated = [];
    const remaining = [];
    contracts.forEach(pc => {
      const seller = pc.sellerClubId ? gameState.clubs[pc.sellerClubId] : null;
      const balance = gameState.finances?.balance ?? gameState.myClub.budget;
      if (pc.agreedFee > balance) {
        notify(`Can't complete pre-contract for ${pc.playerData.name} — insufficient funds. Will retry next window.`, 'error');
        remaining.push(pc);
        return;
      }
      if (seller) seller.players = seller.players.filter(x => x.id !== pc.playerData.id);
      const p = { ...pc.playerData, wage: pc.agreedWage, contractEnd: DATA.contractEndAfterYears(gameState.currentDate, pc.agreedYears), clubCareerGoals: 0, clubCareerAssists: 0, clubCareerApps: 0 };
      gameState.myClub.players.push(p);
      recalcSqRating(gameState.myClub);
      if (seller) recalcSqRating(seller);
      if (gameState.finances) gameState.finances.balance = Math.round((gameState.finances.balance - pc.agreedFee) * 10) / 10;
      else gameState.myClub.budget = Math.round((gameState.myClub.budget - pc.agreedFee) * 10) / 10;
      if (pc.agreedFee > 0) recordTransferExpense(pc.agreedFee);
      gameState.market = (gameState.market || []).filter(x => x.id !== p.id);
      gameState.transferLog.unshift({ in: true, name: p.name, fee: pc.agreedFee });
      activated.push(p.name);
    });
    gameState.preContracts = remaining;
    if (activated.length) notify(`Pre-contract${activated.length > 1 ? 's' : ''} activated: ${activated.join(', ')} joined the club!`, 'success');
  }

  function checkIncomingOffers() {
    if (!ENGINE.isTransferWindowOpen(gameState)) return;
    // Activate any pending pre-contracts when window opens (January or summer)
    if ((gameState.preContracts || []).length) activatePreContracts();
    const myId = gameState.myClubId;
    const listed = gameState.myClub.players.filter(p => p.listingPrice != null);
    // Clubs also circle players who AREN'T listed but whose deal runs out within a
    // year — better to buy now (cheap) than risk losing them for nothing later.
    const expiringUnlisted = gameState.myClub.players.filter(p =>
      p.listingPrice == null && !p.loyal && monthsUntil(p.contractEnd, gameState.currentDate) <= 12);
    if (!listed.length && !expiringUnlisted.length) return;
    if (!gameState.negotiations) gameState.negotiations = [];
    const aiClubs = Object.values(gameState.clubs).filter(c => c.id !== myId);
    const tryBid = (p, isListed) => {
      if (Math.random() > (isListed ? 0.30 : 0.12)) return;
      // Listed players draw fair bids (75-100% of value); an unlisted-but-expiring
      // player draws a cheeky lowball since the club hasn't put him up for sale.
      const frac = isListed ? (0.75 + Math.random() * 0.25) : (0.45 + Math.random() * 0.25);
      const fee = Math.max(0.01, ENGINE.roundFee(p.value * frac));
      // Don't let the same club bid twice while an offer from them is already outstanding —
      // but a second, different club bidding on the same player is exactly how an incoming
      // bidding war emerges now that offers sit around for days instead of resolving instantly.
      const alreadyBidding = new Set(gameState.negotiations.filter(n => n.type === 'incoming' && n.playerId === p.id).map(n => n.clubId));
      const affordable = aiClubs.filter(c => c.budget >= fee * 0.7 && !alreadyBidding.has(c.id));
      if (!affordable.length) return;
      const bidder = affordable[Math.floor(Math.random() * affordable.length)];
      // Club's max they'll pay: market value * 1.1-1.2 if listed; opportunistic bids
      // won't go much past value since they know you didn't ask to sell.
      const maxWilling = ENGINE.roundFee(p.value * (isListed ? (1.10 + Math.random() * 0.10) : (0.85 + Math.random() * 0.15)));
      gameState.negotiations.push({
        id: `neg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'incoming', stage: 'fee', awaiting: 'user', responseDue: null,
        playerId: p.id,
        playerName: p.name,
        playerPos: p.pos,
        playerOvr: p.ovr,
        clubId: bidder.id,
        clubName: bidder.name,
        clubShort: bidder.name,
        fee,
        maxWilling,
        lastCounter: null,
        marketValue: p.value,
        listingPrice: p.listingPrice,
        rival: null,
        lastTouch: new Date(gameState.currentDate),
        date: fmtDate(gameState.currentDate),
      });
      notify(isListed
        ? `${bidder.name} have bid ${money(fee)} for ${p.name}!`
        : `${bidder.name} have made an opportunistic bid of ${money(fee)} for ${p.name} — his contract expires in ${fmtContractEnd(p.contractEnd)}.`, 'info');
    };
    listed.forEach(p => tryBid(p, true));
    expiringUnlisted.forEach(p => tryBid(p, false));
  }

  // Resolves any negotiation whose responseDue has arrived (or that's been left
  // untouched too long) into an actual outcome. Cheap enough to run on every date
  // advance — a match-day jump of several days, a preseason week, or the explicit
  // Advance 1 Day control — so a response due mid-jump is never silently skipped.
  function resolveNegotiationResponses() {
    const now = gameState.currentDate;
    const all = gameState.negotiations || [];
    const keep = [];
    all.forEach(N => {
      if (N.stage === 'outbid') { keep.push(N); return; } // sits until the user dismisses it
      if (N.awaiting === 'user' && (now - new Date(N.lastTouch)) > 21 * DAY_MS) {
        if (N.type === 'outgoing') { markTransferBan(N.playerId); notify(`Talks with ${N.clubName} over ${N.playerName} lapsed.`, 'warning'); }
        else notify(`${N.clubName}'s offer for ${N.playerName} expired.`, 'info');
        return; // drop — stale, nobody acted on it
      }
      if (N.awaiting !== 'club' || !N.responseDue || N.responseDue > now) { keep.push(N); return; }
      if (N.type === 'outgoing') resolveOutgoingResponse(N, keep);
      else resolveIncomingResponse(N, keep);
    });
    gameState.negotiations = keep;
  }

  function resolveOutgoingResponse(N, keep) {
    const seller = gameState.clubs[N.clubId];
    const p = seller && seller.players.find(x => x.id === N.playerId);
    if (!seller || !p) return; // player moved on elsewhere (e.g. an AI-AI sale) — just drop the deal
    if (N.stage === 'fee') {
      const r = ENGINE.evaluateFeeOffer(N.neg, N.lastFee);
      if (r.decision === 'accept') {
        N.agreedFee = N.lastFee; N.stage = 'terms'; N.awaiting = 'user'; N.lastTouch = new Date(gameState.currentDate);
        N.msgLog.push({ text: `${seller.name} accept ${money(N.lastFee)}! Now agree personal terms with the player.`, tone: 'good' });
        notify(`${seller.name} accepted your ${money(N.lastFee)} bid for ${p.name}!`, 'success');
        keep.push(N);
      } else if (r.decision === 'counter') {
        N.awaiting = 'user'; N.lastTouch = new Date(gameState.currentDate);
        N.msgLog.push({ text: `${seller.name} reject ${money(N.lastFee)}, but would accept ${money(r.counter)}.`, tone: 'info' });
        notify(`${seller.name} countered your bid for ${p.name} at ${money(r.counter)}.`, 'info');
        keep.push(N);
      } else if (r.decision === 'reject') {
        N.awaiting = 'user'; N.lastTouch = new Date(gameState.currentDate);
        N.msgLog.push({ text: `${seller.name} dismiss your ${money(N.lastFee)} bid as far too low.`, tone: 'bad' });
        notify(`${seller.name} rejected your bid for ${p.name}.`, 'warning');
        keep.push(N);
      } else {
        markTransferBan(N.playerId);
        notify(`${seller.name} have ended negotiations over ${p.name}.`, 'warning');
      }
    } else if (N.stage === 'terms') {
      const r = ENGINE.evaluateWageOffer(N.neg, N.lastWage);
      if (r.decision === 'accept') {
        N.agreedWage = N.lastWage;
        completeTransfer(N); // removes itself from gameState.negotiations once done
      } else if (r.decision === 'counter') {
        N.awaiting = 'user'; N.lastTouch = new Date(gameState.currentDate);
        N.msgLog.push({ text: `${p.name} rejects ${money(N.lastWage / 1000)}/wk but would sign for ${money(N.neg.wageDemand / 1000)}/wk.`, tone: 'info' });
        notify(`${p.name} countered your contract offer.`, 'info');
        keep.push(N);
      } else if (r.decision === 'reject') {
        N.awaiting = 'user'; N.lastTouch = new Date(gameState.currentDate);
        N.msgLog.push({ text: `${p.name} is insulted by an offer of just ${money(N.lastWage / 1000)}/wk.`, tone: 'bad' });
        notify(`${p.name} rejected your wage offer.`, 'warning');
        keep.push(N);
      } else {
        markTransferBan(N.playerId);
        notify(`${p.name} rejected your contract terms.`, 'warning');
      }
    }
  }

  function resolveIncomingResponse(N, keep) {
    // The user sent a counter; the AI club now decides whether to meet it.
    const maxWilling = N.maxWilling || (N.marketValue || N.listingPrice) * 1.15;
    if (N.lastCounter <= maxWilling) {
      N.fee = N.lastCounter;
      completeIncomingSale(N); // removes itself (and rival offers for the player) from gameState.negotiations
    } else {
      notify(`${N.clubName} rejected your ${money(N.lastCounter)} counter — they walked away.`, 'warning');
    }
  }

  // Rival interest on a deal the user is trying to buy into — separate from the
  // due-date resolution above so it only rolls at the existing weekly tick cadence
  // (called alongside tickAITransfers), not on every single daily advance.
  function rollBiddingWars() {
    (gameState.negotiations || []).forEach(N => {
      if (N.type !== 'outgoing' || N.stage !== 'fee') return;
      if (!N.rival && Math.random() < 0.06) {
        const rivals = Object.values(gameState.clubs).filter(c => c.id !== gameState.myClubId && c.id !== N.clubId);
        if (!rivals.length) return;
        const rival = rivals[Math.floor(Math.random() * rivals.length)];
        const rivalOffer = ENGINE.roundFee(N.neg.minFee * (1 + rand(0, 15) / 100));
        N.rival = { clubId: rival.id, clubName: rival.name, offer: rivalOffer };
        N.neg.minFee = Math.max(N.neg.minFee, rivalOffer);
        N.neg.asking = Math.max(N.neg.asking, rivalOffer);
        N.msgLog.push({ text: `${rival.name} have also entered talks for ${N.playerName}.`, tone: 'bad' });
        notify(`${rival.name} have also entered talks for ${N.playerName} — expect the price to climb.`, 'warning');
      } else if (N.rival && Math.random() < 0.18) {
        const seller = gameState.clubs[N.clubId];
        const p = seller && seller.players.find(x => x.id === N.playerId);
        const rivalClub = gameState.clubs[N.rival.clubId];
        if (!seller || !p || !rivalClub) return;
        seller.players = seller.players.filter(x => x.id !== N.playerId);
        p.clubId = rivalClub.id; p.contractEnd = DATA.contractEndAfterYears(gameState.currentDate, rand(2, 4));
        rivalClub.players.push(p);
        recalcSqRating(rivalClub); recalcSqRating(seller);
        gameState.market = (gameState.market || []).filter(x => x.id !== N.playerId);
        pushTransferNews(`${N.rival.clubName} completed the signing of ${N.playerName} from ${N.clubName} for ${money(N.rival.offer)}`);
        N.stage = 'outbid'; N.awaiting = 'user';
        notify(`You've been outbid! ${N.rival.clubName} signed ${N.playerName}.`, 'error');
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
        if (a.minPOT && a.minPOT > 0 && (p.pot || p.ovr) < a.minPOT) return;
        candidates.push({ ...p, clubId: club.id, clubName: club.name || club.name });
      });
    });
    // Weight toward lower-rated players — top stars are never "discovered" by scouts
    const pool = candidates.map(p => ({ p, w: Math.max(1, 95 - p.ovr) }));
    const selected = [];
    const count = rand(tier.findMin, tier.findMax);
    while (selected.length < count && pool.length > 0) {
      let r = Math.random() * pool.reduce((s, x) => s + x.w, 0);
      let i = 0;
      for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
      selected.push(pool[i].p);
      pool.splice(i, 1);
    }
    return selected.map(p => ({
      ...p,
      reportedOVR: Math.max(40, Math.min(99, p.ovr + rand(-tier.ovrNoise, tier.ovrNoise))),
      reportedPOT: Math.max(40, Math.min(99, (p.pot || p.ovr) + rand(-tier.potNoise, tier.potNoise))),
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
    const aiClub = myIsHome ? away : home;
    const aiTactics = aiClub.tactics || ENGINE.deriveAITactics(aiClub);
    const aiFormKey = aiTactics.formation || '4-3-3';
    const aiForm = DATA.FORMATIONS[aiFormKey] || DATA.FORMATIONS['4-3-3'];
    const aiXI = aiClub.lineup && aiClub.lineup.length === 11 ? aiClub.lineup : autoPickXI(aiClub, aiFormKey);
    const aiSlotPos = aiForm.positions.map(p => p.pos);
    const homeFormation = myIsHome ? gameState.tactics.formation : aiFormKey;
    const awayFormation = myIsHome ? aiFormKey : gameState.tactics.formation;
    const myForm = gameState.tactics.formation === 'custom' ? gameState.tactics.customFormation : null;
    const homeXI = myIsHome ? gameState.tactics.lineup : aiXI;
    const awayXI = myIsHome ? aiXI : gameState.tactics.lineup;
    const myTactics = { ...gameState.tactics, customFormation: myForm };
    const mySlotPos = activeTacticForm().positions.map(p => p.pos);
    const result = ENGINE.simulateMatch(home, away, {
      homeXI, awayXI,
      homeTactics: myIsHome ? myTactics : aiTactics,
      awayTactics: myIsHome ? aiTactics : myTactics,
      homeSlotPositions: myIsHome ? mySlotPos : aiSlotPos,
      awaySlotPositions: myIsHome ? aiSlotPos : mySlotPos,
    });
    result.commentary = [];
    ui.match = {
      fixture, home, away, myIsHome, result, homeFormation, awayFormation,
      homeXI: [...homeXI], awayXI: [...awayXI],
      currentHomeXI: [...homeXI], currentAwayXI: [...awayXI],
      currentTactics: { ...gameState.tactics },
      subsUsed: 0, subsMax: 5,
      sim: { min: 0, idx: 0, hs: 0, as: 0, hSh: 0, aSh: 0, hSo: 0, aSo: 0, possHomeUnits: 0, possUnits: 0,
             stoppage1: result.stoppage1, stoppage2: result.stoppage2, matchEnd: result.matchEnd,
             homeManDown: false, awayManDown: false },
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
    // Color stat number labels with team colors
    ['s-possession-h','s-shots-h','s-sot-h'].forEach(id => { const el=$(id); if(el) el.style.color=homeDotColor; });
    ['s-possession-a','s-shots-a','s-sot-a'].forEach(id => { const el=$(id); if(el) el.style.color=awayDotColor; });
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
    $('btn-subs').classList.add('hidden');
    $('btn-tactics').classList.add('hidden');
    $('halftime-panel').classList.add('hidden');
    $('match-events-inner').classList.remove('hidden');
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
    let rafDomFrame = 0;
    function loop(ts) {
      if (!ui.match) return;
      const dt = Math.min(ts - ui.match.rafTime, 50);
      ui.match.rafTime = ts;
      const f16 = dt / 16.67;
      const writeDom = (++rafDomFrame & 1) === 0;

      ui.match.players.forEach(p => {
        // Smooth target glides toward committed target — smooth arcs at 2x speed
        const sg = Math.min(1, 0.12 * f16);
        p.stx += (p.tx - p.stx) * sg;
        p.sty += (p.ty - p.sty) * sg;
        // Player chases smooth target at stat-scaled 1x-speed pace
        const s = Math.min(1, p.lerpF * f16);
        p.cx += (p.stx - p.cx) * s;
        p.cy += (p.sty - p.cy) * s;
        if (writeDom) {
          p.el.style.left = p.cx.toFixed(1) + '%';
          p.el.style.top  = p.cy.toFixed(1) + '%';
        }
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
    'The ball is recycled patiently through midfield.',
    'A long diagonal finds the winger — the full-back recovers well.',
    'Both sides fighting for control in the centre of the park.',
    'The keeper organises his defence, commanding the area.',
    'A nervy challenge near the touchline — the referee waves play on.',
    'Solid defending from the back four; no way through.',
    'The midfield battle is fierce — neither side giving an inch.',
    'A cross swings in but is dealt with comfortably.',
    'Neat one-two in midfield, but the final ball goes astray.',
    'The goalkeeper spreads himself to narrow the angle.',
    'Play settles into a tighter midfield pattern.',
    'The winger tries to drive inside but loses possession.',
    'Patient pressure building — probing for a gap in the defence.',
    'A header back to the keeper under real pressure.',
    'The tempo drops as both teams look to catch their breath.',
    'Time ticking away — both sides hunting for the decisive moment.',
    'A scrappy passage of play — neither side able to find any rhythm.',
    'The captain gestures for his side to push higher up the pitch.',
    'A misplaced pass gifts possession straight back — sloppy from both sides.',
    'The manager is on his feet on the touchline, barking instructions.',
    'A heavy touch lets the defender step in and clear the danger.',
    'Possession shuffled along the back line, probing for an opening.',
    'A loose ball in midfield sparks a brief scramble before order returns.',
    'The fourth official holds up the board — a stoppage for treatment.',
    'Both benches are quiet — this game is settling into a pattern.',
  ];
  const CMNT_PRESS = [
    'CHANCE! The goalkeeper makes himself big and smothers the shot!',
    'Off the woodwork! The ball ricochets clear!',
    'A thunderous half-volley — inches over the crossbar!',
    'The striker cuts inside and fires — straight at the keeper!',
    'A rasping drive — tipped round the post by the fingertips!',
    'One-on-one with the keeper — shot blocked on the line!',
    'Dangerous cross whipped in — just cleared at the near post!',
    'Great pressing wins it back — the counter breaks but the defence holds!',
    'A defender throws himself in front of the shot to block it!',
    'The keeper races out to smother the through ball just in time!',
    'A driving run into the box ends with a desperate last-ditch tackle!',
    'The crowd rises as a long-range effort whistles just over the bar!',
  ];

  function addCommentary(min, events) {
    const displayMin = formatMatchMinute(min, ui.match.sim.stoppage1, ui.match.sim.et);
    events.forEach(e => {
      const club = e.team === 'home' ? ui.match.home : ui.match.away;
      const nm = e.player ? esc(e.player.name) + ' (' + esc(club.name) + ')' : esc(club.name);
      let text = '';
      if (e.type === 'goal') {
        if (e.isPenalty) {
          const opts = ['PENALTY SCORED! Calmly slotted away from twelve yards!', 'GOAL FROM THE SPOT! No way back for the keeper!', 'PENALTY CONVERTED! Ice cold under pressure!', 'SCORED! Sent the keeper the wrong way from the spot!'];
          text = opts[rand(0, opts.length - 1)] + (e.player ? ` ${esc(e.player.name)} makes no mistake for ${esc(club.name)}!` : '');
        } else {
          const opts = ['GOAL! What a finish!', 'GOAL! Back of the net!', 'GOAL! The keeper had no chance!', 'GOAL! Unstoppable!', 'GOAL! A moment of real quality!', 'GOAL! The net bulges and the home end erupts!', 'GOAL! Clinical finishing on full display!'];
          text = opts[rand(0, opts.length - 1)] + (e.player ? ` ${esc(e.player.name)} scores for ${esc(club.name)}!` : '');
        }
      } else if (e.type === 'shot_saved') {
        if (e.isPenalty) {
          text = nm + ' — PENALTY SAVED! Brilliant stop from the spot, guessed right and held firm!';
        } else {
          const opts = ['Great save!', 'What a stop from the keeper!', 'Denied! Brilliant save!', 'Keeper to the rescue!', 'Superbly turned away — fingertip stuff!', 'Pushed onto the bar and away — outstanding!', 'Smothered at the second attempt!'];
          text = nm + ' — ' + opts[rand(0, opts.length - 1)];
        }
      } else if (e.type === 'shot_wide') {
        if (e.isPenalty) {
          text = nm + ' — PENALTY MISSED! Blazes it over the bar — huge let-off!';
        } else {
          const opts = ['Just wide!', 'Goes narrowly wide!', 'Across the face of goal!', 'So close, but over the bar!', 'Drags it well off target!', 'Scuffed and well wide of the post!', 'Should have done better — fires into the stands!'];
          text = nm + ' — ' + opts[rand(0, opts.length - 1)];
        }
      } else if (e.type === 'shot_post') {
        const opts = ['Off the post!', 'Strikes the woodwork!', 'Rattles the crossbar — incredible luck!', 'Cannons back off the upright!', 'So close — clatters the frame of the goal!'];
        text = nm + ' — ' + opts[rand(0, opts.length - 1)];
      } else if (e.type === 'sub') {
        const onN  = e.playerOn  ? esc(e.playerOn.name)  : '?';
        const offN = e.playerOff ? esc(e.playerOff.name) : '?';
        text = `Substitution for ${esc(club.name)}: ${onN} comes on to replace ${offN}.`;
      } else if (e.type === 'yellow') {
        text = `Booked! ${e.player ? esc(e.player.name) + ' (' + esc(club.name) + ')' : esc(club.name)} is shown a yellow card.`;
      } else if (e.type === 'red') {
        const opts = [
          `RED CARD! ${e.player ? esc(e.player.name) : 'A player'} is off! ${esc(club.name)} down to ten men — a massive blow with the game still alive.`,
          `SENT OFF! ${e.player ? esc(e.player.name) : 'A player'} sees red and trudges off down the tunnel. ${esc(club.name)} face the rest of the match a man short.`,
          `RED CARD! The referee has no hesitation — straight off for ${e.player ? esc(e.player.name) : 'the player'}. ${esc(club.name)} will have to dig in with ten men.`,
        ];
        text = opts[rand(0, opts.length - 1)];
      } else if (e.type === 'penalty_awarded') {
        const opts = [
          `PENALTY! ${e.player ? esc(e.player.name) : 'The defender'} brings the attacker down inside the box — ${esc(club.name)} have a golden chance!`,
          `PENALTY AWARDED! Clumsy challenge in the area from ${e.player ? esc(e.player.name) : 'the defender'} — the referee points straight to the spot for ${esc(club.name)}!`,
          `IT'S A PENALTY! No arguing with that one — ${esc(club.name)} will step up from twelve yards.`,
        ];
        text = opts[rand(0, opts.length - 1)];
      } else if (e.type === 'free_kick') {
        const opts = [
          `Free kick to ${esc(club.name)} — a dangerous position just outside the box.`,
          `Free kick awarded to ${esc(club.name)} after a foul in midfield.`,
          `${esc(club.name)} will have a set-piece chance from the free kick.`,
          `Free kick given away — ${esc(club.name)} look to make the most of the set piece.`,
          `The whistle goes — free kick to ${esc(club.name)} in a useful area.`,
        ];
        text = opts[rand(0, opts.length - 1)];
      } else if (e.type === 'offside') {
        const opts = ['Flag is up! Offside!', 'Caught offside — the linesman raises the flag.', 'Offside! The move comes to nothing.', 'It\'s offside, no goal.', 'The flag goes up just as the shot is struck.', 'Marginal call, but offside is given.'];
        text = (e.player ? esc(e.player.name) : 'A player') + ' — ' + opts[rand(0, opts.length-1)];
      } else if (e.type === 'tackle') {
        const nm2 = e.player ? esc(e.player.name) : esc(club.name);
        if (e.slide && !e.success) {
          const opts = ['Slide tackle misses! Lucky not to give away more.', 'Goes to ground but comes away with nothing — risky challenge.', 'Mistimed slide — fortunate the referee lets it go.'];
          text = nm2 + ' — ' + opts[rand(0, opts.length - 1)];
        } else if (e.slide && e.success) {
          const opts = ['Brilliant sliding tackle wins it cleanly!', 'Perfectly timed slide — takes the ball and nothing else!', 'Last-ditch sliding challenge saves the day!'];
          text = nm2 + ' — ' + opts[rand(0, opts.length - 1)];
        } else if (e.success) {
          const opts = ['Wins the ball — great defending!', 'Timed to perfection, ball won!', 'Strong challenge wins possession.', 'Reads it well and nicks the ball away.', 'Stands firm and comes away with the ball.'];
          text = nm2 + ' — ' + opts[rand(0, opts.length-1)];
        } else {
          const opts = ['Caught in possession.', 'Battles but can\'t win the ball.', 'Physical duel in midfield.', 'Outmuscled and loses out in the challenge.', 'Beaten for pace in the challenge.'];
          text = nm2 + ' — ' + opts[rand(0, opts.length-1)];
        }
      } else if (e.type === 'corner') {
        text = `Corner kick for ${esc(club.name)}.`;
      } else if (e.type === 'var_check') {
        text = `VAR CHECK — Referee reviewing the decision... Goal stands!`;
      } else if (e.type === 'injury') {
        const inj = INJURY_TYPES.find(t => t.id === e.injuryType);
        const pn = e.player ? esc(e.player.name) : 'A player';
        if (inj?.severity === 'career') {
          text = `TERRIBLE NEWS — ${pn} is down and cannot continue. It looks like an ACL — that could be a career-threatening blow for ${esc(club.name)}.`;
        } else if (inj?.severity === 'serious') {
          text = `${pn} is down holding their ${inj.label.toLowerCase()}. The stretcher is coming on — this looks serious for ${esc(club.name)}.`;
        } else if (inj?.severity === 'moderate') {
          text = `${pn} goes off injured — ${inj?.label || 'injury'} suspected. ${esc(club.name)} will need to make a change.`;
        } else {
          text = `${pn} picks up a knock and needs to come off. A ${inj?.label || 'minor injury'} for ${esc(club.name)}.`;
        }
      }
      if (!text) return;
      if (ui.match.result.commentary) ui.match.result.commentary.push({ min, text, cls: e.type });
      const div = document.createElement('div');
      div.className = 'match-event commentary ' + e.type;
      div.innerHTML = `<span class="event-min">${displayMin}</span><span class="event-desc">${text}</span>`;
      $('match-events-list').prepend(div);
    });
    if (!events.length && min % 5 === 0) {
      const pool = Math.random() < 0.22 ? CMNT_PRESS : CMNT_QUIET;
      let idx; const last = ui.match._lastQuietIdx ?? -1;
      do { idx = rand(0, pool.length - 1); } while (pool.length > 1 && idx === last);
      ui.match._lastQuietIdx = idx;
      const text = pool[idx];
      const div = document.createElement('div');
      div.className = 'match-event commentary';
      div.innerHTML = `<span class="event-min">${displayMin}</span><span class="event-desc">${text}</span>`;
      $('match-events-list').prepend(div);
      if (ui.match.result.commentary) ui.match.result.commentary.push({ min, text, cls: '' });
    }
  }

  // Raw sim ticks run continuously past 45/90 to make room for stoppage time —
  // this converts a raw tick back into the "45+2'" / "90+4'" label a real broadcast
  // clock would show, given how many minutes of first-half stoppage were added.
  // et = { start, s1 }: raw minute extra time kicked off and its half-time stoppage,
  // so ET ticks map onto the 91'–105+X' / 106'–120+X' broadcast clock the same way.
  function formatMatchMinute(min, stoppage1, et) {
    if (et && min > et.start) {
      const etMin = min - et.start;
      if (etMin <= 15) return (90 + etMin) + "'";
      if (etMin <= 15 + et.s1) return `105+${etMin - 15}'`;
      const adj = etMin - et.s1;
      if (adj <= 30) return (90 + adj) + "'";
      return `120+${adj - 30}'`;
    }
    if (min <= 45) return min + "'";
    if (min <= 45 + stoppage1) return `45+${min - 45}'`;
    const adjusted = min - stoppage1;
    if (adjusted <= 90) return adjusted + "'";
    return `90+${adjusted - 90}'`;
  }

  /* ── SIMULATION LOOP: 1 real-second = 1 game-minute (1:60) ─ */
  function runSimulation() {
    if (running || !ui.match) return;
    running = true;
    $('btn-simulate').classList.add('hidden');
    $('btn-pause').classList.remove('hidden');
    $('btn-speed').classList.remove('hidden');
    $('btn-subs').classList.remove('hidden');
    $('btn-tactics').classList.remove('hidden');
    $('btn-pause').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor"/><rect x="6" y="1" width="3" height="8" fill="currentColor"/></svg> Pause';
    $('match-status').textContent = 'LIVE';

    const ev = ui.match.result.events;
    const sim = ui.match.sim;

    function scheduleNext() {
      if (!running || !ui.match) return;
      if (sim.min >= sim.matchEnd) { finishMatch(); return; }
      ui.match.simTimer = setTimeout(tick, ui.match.speed === 2 ? 500 : 1000);
    }

    function tick() {
      if (!running || !ui.match) return;
      sim.min++;

      const SHOT_TYPES = ['goal', 'shot_saved', 'shot_wide', 'shot_post'];
      const ON_TARGET_TYPES = ['goal', 'shot_saved'];
      const eventsThisMin = [];
      while (sim.idx < ev.length && ev[sim.idx].min <= sim.min) {
        const e = ev[sim.idx++];
        if (e.type === 'goal') { if (e.team === 'home') sim.hs++; else sim.as++; }
        // Track shots/SOT off the same events that drive the pitch dots below, so the
        // live stat numbers always tick up in lockstep with what's shown on the pitch.
        if (SHOT_TYPES.includes(e.type)) {
          const onTarget = ON_TARGET_TYPES.includes(e.type);
          if (e.team === 'home') { sim.hSh++; if (onTarget) sim.hSo++; }
          else { sim.aSh++; if (onTarget) sim.aSo++; }
        }
        if (['goal', 'yellow', 'red', 'sub', 'injury', 'penalty_awarded'].includes(e.type)) addMatchEvent(e);
        addPitchDot(e);
        eventsThisMin.push(e);
        // Injury handling — apply state and auto-pause for user's team
        if (e.type === 'injury' && e.player && !e.player.injured) {
          const inj = INJURY_TYPES.find(t => t.id === e.injuryType) || INJURY_TYPES[0];
          e.player.injured        = true;
          e.player.injuryType     = e.injuryType;
          e.player.injuryWeeks    = rand(inj.minWeeks, inj.maxWeeks);
          e.player.careerInjuries = (e.player.careerInjuries || 0) + 1;
          e.player.fitness        = Math.max(5, (e.player.fitness ?? 80) - 40);
          const myTeam = ui.match.myIsHome ? 'home' : 'away';
          if (e.team === myTeam) {
            running = false;
            clearTimeout(ui.match.simTimer);
            ui.match.simTimer = null;
            $('btn-pause').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg> Resume';
            $('match-status').textContent = 'INJURY';
            notify(`${e.player.name} is injured! (${inj.label}, ~${e.player.injuryWeeks} wks)`, 'warning');
            // Remove from XI and open sub modal with player pre-selected
            const myXIArr = ui.match.myIsHome ? ui.match.currentHomeXI : ui.match.currentAwayXI;
            if (myXIArr.includes(e.player.id) && ui.match.subsUsed < ui.match.subsMax) {
              setTimeout(() => showSubsModal(e.player.id), 150);
            }
          }
        }
      }

      $('match-score').textContent = `${sim.hs} – ${sim.as}`;
      $('match-time').textContent = formatMatchMinute(sim.min, sim.stoppage1, sim.et);

      // Live stats — possession has no discrete events, so each minute we draw a few
      // "who's got the ball" contests weighted toward the final tactics/overalls-driven
      // split and track the running share. With only a few contests played so far, early
      // minutes swing widely (small sample); the running share settles toward the true
      // split as the match goes on, same as a real live possession tracker. Shots and
      // shots-on-target are instead counted directly off the same events that just fed
      // the pitch dots above, so the numbers and the dots can never drift apart.
      const r = ui.match.result;
      const [ph]   = r.stats.possession;
      const POSS_CONTESTS_PER_MIN = 3;
      for (let i = 0; i < POSS_CONTESTS_PER_MIN; i++) {
        sim.possUnits = (sim.possUnits || 0) + 1;
        if (Math.random() * 100 < ph) sim.possHomeUnits = (sim.possHomeUnits || 0) + 1;
      }
      const hPossLive  = Math.round(sim.possHomeUnits / sim.possUnits * 100);
      const hShotsLive = sim.hSh, aShotsLive = sim.aSh;
      const hSoTLive   = sim.hSo, aSoTLive   = sim.aSo;
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

      // A red card obviously costs the side a man for the rest of the match — re-sim
      // the remainder with that team handicapped instead of letting it stay cosmetic.
      const newReds = eventsThisMin.filter(e => e.type === 'red');
      if (newReds.length) {
        newReds.forEach(e => { if (e.team === 'home') sim.homeManDown = true; else sim.awayManDown = true; });
        if (sim.min < sim.matchEnd) reSimFromMinute(sim.min);
      }

      // AI substitutions at 60', 72', 82'
      const m2 = ui.match;
      if ([60, 72, 82].includes(sim.min)) {
        const aiTeam    = m2.myIsHome ? 'away' : 'home';
        const aiClub    = m2.myIsHome ? m2.away : m2.home;
        const aiXIArr   = m2.myIsHome ? m2.currentAwayXI : m2.currentHomeXI;
        if (aiXIArr && m2.aiSubsUsed === undefined) m2.aiSubsUsed = 0;
        if (aiXIArr && (m2.aiSubsUsed || 0) < 3) {
          const xiPlayers  = aiXIArr.map(id => aiClub.players.find(p => p.id === id)).filter(Boolean);
          const benchPlayers = aiClub.players.filter(p => !aiXIArr.includes(p.id) && !p.injured);
          // Pick the most fatigued/lowest rated starter to replace
          const offP = xiPlayers.slice().sort((a, b) => (a.fitness ?? 80) - (b.fitness ?? 80))[0];
          // Pick the best bench player of a similar position group
          const onP = benchPlayers
            .filter(p => ENGINE.posGroup(p.pos) === ENGINE.posGroup(offP?.pos || 'MID'))
            .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0]
            || benchPlayers.sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0];
          if (offP && onP) {
            const idx = aiXIArr.indexOf(offP.id);
            if (idx >= 0) {
              aiXIArr[idx] = onP.id;
              m2.aiSubsUsed = (m2.aiSubsUsed || 0) + 1;
              const subEv = { min: sim.min, type: 'sub', team: aiTeam, playerOff: offP, playerOn: onP };
              ev.push(subEv);
              ev.sort((a, b) => a.min - b.min);
              if (sim.min < sim.matchEnd) reSimFromMinute(sim.min);
              addMatchEvent(subEv);
              eventsThisMin.push(subEv);
            }
          }
        }
      }

      addCommentary(sim.min, eventsThisMin);

      if (sim.min === 45 + sim.stoppage1) {
        $('match-status').textContent = 'HALF TIME';
        swapSides();
        running = false;
        if (ui.match.simTimer) { clearTimeout(ui.match.simTimer); ui.match.simTimer = null; }
        $('btn-halftime').classList.remove('hidden');
        $('btn-pause').classList.add('hidden');
        $('btn-speed').classList.add('hidden');
        $('btn-subs').classList.add('hidden');
        $('btn-tactics').classList.add('hidden');
        showHalftimePanel();
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

    ui.match.tick = tick;
    ui.match.simTimer = setTimeout(tick, ui.match.speed === 2 ? 500 : 1000);
  }

  function addMatchEvent(e) {
    const club = e.team === 'home' ? ui.match.home : ui.match.away;
    let icon, desc;
    if (e.type === 'sub') {
      const onName  = e.playerOn  ? esc(e.playerOn.name)  : '?';
      const offName = e.playerOff ? esc(e.playerOff.name) : '?';
      icon = '';
      desc = `<span class="sub-event-rows"><span class="sub-row-on"><span class="sub-arrow-on">▲</span> ${onName}</span><span class="sub-row-off"><span class="sub-arrow-off">▼</span> ${offName}</span></span>`;
    } else if (e.type === 'injury') {
      icon = '<svg class="ev-icon ev-icon-injury" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      const inj = INJURY_TYPES.find(t => t.id === e.injuryType);
      desc = (e.player ? esc(e.player.name) : '') + (inj ? ` <span class="text-muted">${inj.label}</span>` : '');
    } else if (e.type === 'penalty_awarded') {
      icon = '<svg class="ev-icon ev-icon-penalty" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="currentColor"/></svg>';
      desc = `Penalty awarded${e.player ? ' <span class="text-muted">— foul by ' + esc(e.player.name) + '</span>' : ''}`;
    } else if (e.type === 'goal') {
      icon = e.isPenalty
        ? '<svg class="ev-icon ev-icon-penalty" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="currentColor"/></svg>'
        : '<svg class="ev-icon ev-icon-goal" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="6" r="2" fill="currentColor"/></svg>';
      desc = e.player ? esc(e.player.name) : '';
      if (e.assist) desc += ` <span class="text-muted">(${esc(e.assist.name)})</span>`;
    } else if (e.type === 'yellow') {
      icon = '<svg class="ev-icon ev-icon-yellow" viewBox="0 0 10 12"><rect width="10" height="12" rx="1.5" fill="#f5a623"/></svg>';
      desc = e.player ? esc(e.player.name) : '';
    } else {
      icon = '<svg class="ev-icon ev-icon-red" viewBox="0 0 10 12"><rect width="10" height="12" rx="1.5" fill="#ff4d4d"/></svg>';
      desc = e.player ? esc(e.player.name) : '';
    }
    const div = document.createElement('div');
    div.className = 'match-event ' + e.type + (e.isPenalty ? ' penalty' : '');
    div.innerHTML = `<span class="event-min">${formatMatchMinute(e.min, ui.match.sim.stoppage1, ui.match.sim.et)}</span><span class="event-icon">${icon}</span><span class="event-desc">${desc}</span><span class="event-team">${esc(club.name)}</span>`;
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
      // Penalties are taken from the spot — pin the dot there instead of a random box spot
      x = e.isPenalty ? (attRight ? 84 : 16) : attRight ? 76 + Math.random() * 10 : 14 + Math.random() * 10;
      y = e.isPenalty ? 50 : 30 + Math.random() * 40;
      cls = 'goal';
    } else if (e.type === 'shot_saved') {
      // Off-target shots (wide/post) no longer get a dot — between those and every
      // saved shot the pitch was too cluttered to read; on-target is the signal.
      const attRight = (e.team === 'home') ? !swapped : swapped;
      x = e.isPenalty ? (attRight ? 84 : 16) : attRight ? 72 + Math.random() * 14 : 14 + Math.random() * 14;
      y = e.isPenalty ? 50 : 25 + Math.random() * 50;
      cls = 'shot';
    } else if (e.type === 'tackle' && !e.success) {
      const homeLeft = !swapped;
      x = (e.team === 'home') === homeLeft ? 15 + Math.random() * 40 : 45 + Math.random() * 40;
      y = 15 + Math.random() * 70;
      cls = 'foul';
    } else if (e.type === 'penalty_awarded') {
      const attRight = (e.team === 'home') ? !swapped : swapped;
      // Foul dot only — the outcome event (goal/save) drops its own dot on the spot,
      // so a pre-emptive green "penalty" dot would misread as a goal on saved/missed pens.
      const foulCls = e.cardGiven === 'red' ? 'red' : e.cardGiven === 'yellow' ? 'yellow' : 'foul';
      x = attRight ? 76 + Math.random() * 7 : 17 + Math.random() * 7;
      y = 30 + Math.random() * 40;
      cls = foulCls;
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
    $('btn-subs').classList.add('hidden');
    $('btn-tactics').classList.add('hidden');
    const r = ui.match.result;
    const home = ui.match.home, away = ui.match.away;
    $('match-status').textContent = ui.match.sim.et ? 'FULL TIME (AET)' : 'FULL TIME';
    $('match-time').textContent = formatMatchMinute(ui.match.sim.matchEnd, ui.match.sim.stoppage1, ui.match.sim.et);

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
    $('result-score-big').innerHTML = `${r.homeScore} – ${r.awayScore}${ui.match.sim.et ? ' <span class="result-aet">AET</span>' : ''}`;
    $('result-teams').textContent = `${home.name}  vs  ${away.name}`;
    const goals = r.events.filter(e => e.type === 'goal');
    $('result-scorers').innerHTML = goals.length
      ? goals.map(g => `<div class="result-scorer-item"><span>${formatMatchMinute(g.min, ui.match.sim.stoppage1, ui.match.sim.et)}</span><span class="scorer-name">${esc(g.player.name)}</span><span class="scorer-team">${esc((g.team === 'home' ? home : away).name)}</span></div>`).join('')
      : `<div class="result-scorer-item">No goals.</div>`;

    const myRatings = (ui.match.myIsHome ? r.homeRatings : r.awayRatings).slice().sort((a, b) => b.rating - a.rating);
    $('player-ratings-section').innerHTML = `<h4>Your Player Ratings</h4>` + myRatings.map(pr => {
      const cls = pr.rating >= 8 ? 'excellent' : pr.rating >= 7 ? 'good' : pr.rating >= 6 ? 'average' : 'poor';
      return `<div class="player-rating-item"><span class="pr-name">${esc(pr.player.name)} <span class="text-muted">${pr.player.pos}</span></span><span class="pr-rating ${cls}">${pr.rating.toFixed(1)}</span></div>`;
    }).join('');

    // Cup or knockout draw → penalty shootout instead of immediate continue
    const fixture = ui.match?.fixture;
    const isDraw = r.homeScore === r.awayScore;
    const needsWinner = fixture?.type === 'cup';
    if (isDraw && needsWinner) {
      $('match-result-overlay').classList.remove('hidden');
      const btn = $('btn-continue-after-match');
      if (!ui.match.sim.et) {
        // Drawn after 90 — play 30 minutes of extra time first
        btn.textContent = 'Extra Time ➔';
        btn.onclick = () => {
          btn.textContent = 'Continue ➔';
          btn.onclick = null;
          startExtraTime();
        };
      } else {
        // Still level after 120 — penalties decide it
        btn.textContent = 'Penalties ➔';
        btn.onclick = () => {
          $('match-result-overlay').classList.add('hidden');
          btn.textContent = 'Continue ➔';
          btn.onclick = null;
          showPenaltyShootout();
        };
      }
      return;
    }
    $('match-result-overlay').classList.remove('hidden');
  }

  // Cup draw after 90 → 30 minutes of live extra time before any shootout. Reuses
  // the normal tick loop: matchEnd is pushed out by 30 min (+ET stoppage) and the
  // remainder is refilled from a fresh sim scaled to the window, so subs, tactics
  // changes and red cards all keep working through ET.
  function startExtraTime() {
    const m = ui.match;
    const sim = m.sim;
    sim.et = { start: sim.matchEnd, s1: rand(0, 2), s2: rand(1, 3) };
    sim.matchEnd = sim.et.start + 30 + sim.et.s1 + sim.et.s2;
    if (m.fixture) m.fixture.aet = true;
    reSimFromMinute(sim.min);
    $('match-result-overlay').classList.add('hidden');
    startMatchRaf();
    runSimulation();
    $('match-status').textContent = 'EXTRA TIME';
  }

  /* =============================================
     PENALTY SHOOTOUT
     ============================================= */
  function showPenaltyShootout() {
    const m = ui.match;
    if (!m) return;
    const home = m.home, away = m.away;
    const myIsHome = m.myIsHome;
    const myClub = myIsHome ? home : away;
    const oppClub = myIsHome ? away : home;
    const myXI = myIsHome ? m.currentHomeXI : m.currentAwayXI;
    const myPlayers = myXI.map(id => myClub.players.find(p => p.id === id)).filter(Boolean);

    const overlay = $('penalty-shootout-overlay');
    overlay.classList.remove('hidden');
    $('pen-team-home').textContent = home.name;
    $('pen-team-away').textContent = away.name;
    $('pen-score-display').textContent = '0 – 0';
    $('pen-commentary').textContent = 'Penalties. Who will hold their nerve?';

    // Build dot rows (5 dots each side, more added in sudden death)
    const buildDots = (rowId, label, labelClass) => {
      const row = $(rowId);
      row.innerHTML = `<span class="pen-dot-label ${labelClass||''}">${label}</span>`;
      for (let i = 0; i < 5; i++) {
        const d = document.createElement('div');
        d.className = 'pen-dot'; d.id = `${rowId}-dot-${i}`;
        row.appendChild(d);
      }
    };
    buildDots('pen-dots-home', home.name, '');
    buildDots('pen-dots-away', away.name, 'right');

    // Build player picker
    const pickerSection = $('pen-picker-section');
    pickerSection.classList.remove('hidden');
    $('pen-continue-btn').classList.add('hidden');

    const squadList = $('pen-squad-list');
    const selList = $('pen-selected-list');
    let selected = [];

    const renderPicker = () => {
      squadList.innerHTML = myPlayers.map(p =>
        `<div class="pen-squad-item ${selected.some(s=>s.id===p.id)?'picked':''}" data-pid="${p.id}">
          <span>${esc(p.name)} <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span></span>
          <span class="pen-squad-ovr">${p.ovr}</span>
        </div>`).join('');
      selList.innerHTML = selected.map((p, i) =>
        `<div class="pen-selected-item" data-pid="${p.id}">
          <span class="pen-sel-num">${i+1}</span>
          <span>${esc(shortName(p.name))}</span>
        </div>`).join('');
      $('pen-start-btn').disabled = selected.length < 5;
      squadList.querySelectorAll('.pen-squad-item:not(.picked)').forEach(el =>
        el.addEventListener('click', () => {
          const p = myPlayers.find(x => x.id === el.dataset.pid);
          if (p && selected.length < 5) { selected.push(p); renderPicker(); }
        }));
      selList.querySelectorAll('.pen-selected-item').forEach(el =>
        el.addEventListener('click', () => {
          selected = selected.filter(p => p.id !== el.dataset.pid);
          renderPicker();
        }));
    };
    renderPicker();

    $('pen-start-btn').onclick = () => {
      pickerSection.classList.add('hidden');
      // Build AI takers: best shooters from opp XI
      const oppXI = myIsHome ? m.currentAwayXI : m.currentHomeXI;
      const aiPlayers = oppXI.map(id => oppClub.players.find(p => p.id === id)).filter(Boolean)
        .sort((a,b) => (b.attrs?.shooting||65)-(a.attrs?.shooting||65));
      const aiTakers = aiPlayers.slice(0, 5);
      runShootout(selected, aiTakers, myIsHome);
    };
  }

  function runShootout(myTakers, aiTakers, myIsHome) {
    const m = ui.match;
    const myGK = (myIsHome ? m.currentHomeXI : m.currentAwayXI)
      .map(id => (myIsHome ? m.home : m.away).players.find(p=>p.id===id)).find(p=>p?.pos==='GK');
    const oppGK = (myIsHome ? m.currentAwayXI : m.currentHomeXI)
      .map(id => (myIsHome ? m.away : m.home).players.find(p=>p.id===id)).find(p=>p?.pos==='GK');

    const homeTakers = myIsHome ? myTakers : aiTakers;
    const awayTakers = myIsHome ? aiTakers : myTakers;

    let hScore = 0, aScore = 0;
    let kick = 0; // total kicks taken (0-indexed: 0=home1, 1=away1, 2=home2...)
    let suddenDeath = false;

    const commentary = [
      n => `${esc(n)} steps up...`,
      n => `${esc(n)} takes a breath and places the ball...`,
      n => `${esc(n)} is ready to take...`,
      n => `Up steps ${esc(n)}...`,
      n => `${esc(n)} walks to the spot...`,
    ];
    const scored = ['GOAL! Back of the net!', 'SCORED! Emphatic finish!', 'GOAL! Ice in their veins!', 'SCORED! Right down the middle!', 'GOAL! Unstoppable!'];
    const saved  = ['SAVED! The keeper guesses right!', 'Saved! What a stop!', 'SAVED! The keeper dives to his right!', 'No goal! Brilliant save!', 'SAVED! The goalkeeper is a hero!'];
    const missed = ['MISSED! Over the bar!', 'Wide! Nerves got to them!', 'MISSED! Into the post!', 'Off target! The pressure tells!', 'MISSED! Blazed over!'];

    const getDot = (isHome, idx) => {
      const rowId = isHome ? 'pen-dots-home' : 'pen-dots-away';
      let dot = document.getElementById(`${rowId}-dot-${idx}`);
      if (!dot) {
        // sudden death — create extra dot
        dot = document.createElement('div');
        dot.className = 'pen-dot'; dot.id = `${rowId}-dot-${idx}`;
        $(rowId).appendChild(dot);
      }
      return dot;
    };

    const updateScore = () => {
      $('pen-score-display').textContent = `${hScore} – ${aScore}`;
    };

    const kickResult = (taker, gk) => {
      const shoot = taker?.attrs?.shooting || 65;
      const reflex = gk?.attrs?.gkReflexes || 65;
      const conv = 0.73 + (shoot - 65) / 65 * 0.12 - (reflex - 65) / 65 * 0.08;
      const r = Math.random();
      if (r < conv) return 'scored';
      if (r < conv + 0.14) return 'saved';
      return 'missed';
    };

    const canEarlyFinish = () => {
      if (suddenDeath) return false;
      const round = Math.floor(kick / 2); // 0-4
      const hDone = Math.ceil((kick + 1) / 2);
      const aDone = Math.floor((kick + 1) / 2);
      const hLeft = 5 - hDone, aLeft = 5 - aDone;
      if (hScore > aScore + aLeft) return true;
      if (aScore > hScore + hLeft) return true;
      return false;
    };

    const nextKick = () => {
      const isHome = kick % 2 === 0;
      const round = Math.floor(kick / 2);
      const takers = isHome ? homeTakers : awayTakers;
      const gk = isHome ? oppGK : myGK;

      // In sudden death, cycle takers (modulo length)
      const takerIdx = suddenDeath ? (round % takers.length) : round;
      if (!suddenDeath && round >= 5) { endShootout(); return; }

      const taker = takers[takerIdx];
      if (!taker) { endShootout(); return; }

      const dot = getDot(isHome, suddenDeath ? 5 + Math.floor(kick / 2 - 5) : round);
      dot.classList.add('current');
      $('pen-commentary').textContent = commentary[round % commentary.length](taker.name);

      setTimeout(() => {
        const result = kickResult(taker, gk);
        dot.classList.remove('current');
        if (result === 'scored') {
          dot.classList.add('scored');
          if (isHome) hScore++; else aScore++;
          $('pen-commentary').textContent = scored[Math.floor(Math.random()*scored.length)];
        } else {
          dot.classList.add('missed');
          $('pen-commentary').textContent = result === 'saved'
            ? saved[Math.floor(Math.random()*saved.length)]
            : missed[Math.floor(Math.random()*missed.length)];
        }
        updateScore();
        kick++;

        // Check for early finish
        if (canEarlyFinish()) { setTimeout(endShootout, 1200); return; }

        // Check end of 5 rounds
        if (!suddenDeath && kick === 10) {
          if (hScore !== aScore) { setTimeout(endShootout, 1200); return; }
          // Sudden death
          setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'pen-sd-banner'; banner.textContent = '— SUDDEN DEATH —';
            $('pen-dots-home').parentElement.insertAdjacentElement('afterend', banner);
            $('pen-commentary').textContent = 'Level after five each! Sudden death...';
            suddenDeath = true;
            setTimeout(nextKick, 1800);
          }, 1200);
          return;
        }

        // Sudden death finish check: one team scored, other didn't, in same round
        if (suddenDeath && kick % 2 === 0) {
          const sdRound = Math.floor(kick / 2) - 1;
          const hSdDot = getDot(true,  5 + sdRound);
          const aSdDot = getDot(false, 5 + sdRound);
          const hScored = hSdDot.classList.contains('scored');
          const aScored = aSdDot.classList.contains('scored');
          if (hScored !== aScored) { setTimeout(endShootout, 1200); return; }
          if (!hScored && !aScored) { setTimeout(endShootout, 1200); return; } // both missed, redo
        }

        setTimeout(nextKick, 1800);
      }, 1400);
    };

    const endShootout = () => {
      const winner = hScore > aScore ? 'home' : 'away';
      const winClub = winner === 'home' ? m.home : m.away;
      $('pen-commentary').textContent = `${esc(winClub.name)} win the shootout ${hScore}–${aScore}! They advance!`;
      // Record pen winner on fixture
      if (m.fixture) m.fixture.penWinner = winClub.id;
      $('pen-continue-btn').classList.remove('hidden');
      $('pen-continue-btn').onclick = () => {
        $('penalty-shootout-overlay').classList.add('hidden');
        advanceAfterMatch();
      };
    };

    setTimeout(nextKick, 1000);
  }

  /* =============================================
     HALFTIME PANEL
     ============================================= */
  function showHalftimePanel() {
    const m = ui.match;
    if (!m) return;
    m.htActiveTab = 'tactics';
    m.htTactics = { ...m.currentTactics };
    m.htLineup = [...(m.myIsHome ? m.currentHomeXI : m.currentAwayXI)];
    m.htPendingSubs = [];
    m.htSubSelOff = null;
    $('ht-score').textContent = `${m.sim.hs} – ${m.sim.as}`;
    $('halftime-panel').classList.remove('hidden');
    $('match-events-inner').classList.add('hidden');
    renderHalftimePanel();
  }

  function renderHalftimePanel() {
    const m = ui.match;
    if (!m) return;
    const tab = m.htActiveTab || 'tactics';
    document.querySelectorAll('.ht-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.htab === tab);
    });
    const total = (m.htPendingSubs || []).length + m.subsUsed;
    const badge = $('ht-subs-badge');
    if (badge) badge.textContent = total > 0 ? `(${total}/${m.subsMax})` : '';
    const body = $('ht-body');
    if (!body) return;
    if (tab === 'tactics') renderHalfTimeTactics(body);
    else renderHalfTimeSubs(body);
    document.querySelectorAll('.ht-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        m.htActiveTab = btn.dataset.htab;
        renderHalftimePanel();
      });
    });
  }

  function renderHalfTimeTactics(el) {
    const m = ui.match;
    const tac = m.htTactics;
    const pressLabels = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const styleLabels = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession', counter: 'Counter', gegenpressing: 'Gegenpressing', longball: 'Long Ball' };
    const formBtns = Object.keys(DATA.FORMATIONS).map(f =>
      `<button class="formation-btn ${f === tac.formation ? 'selected' : ''}" data-f="${f}">${DATA.FORMATIONS[f].name}</button>`
    ).join('');
    const cornerLabels = { 'near-post': 'Near Post', 'far-post': 'Far Post', 'short': 'Short', 'drilled': 'Drilled' };
    const fkLabels = { shoot: 'Shoot', cross: 'Cross', short: 'Short' };
    const spDefLabels = { zonal: 'Zonal', man: 'Man Mark', mixed: 'Mixed' };
    el.innerHTML = `
      <div class="ht-tac-section"><h4>Formation</h4><div class="formation-grid">${formBtns}</div></div>
      <div class="ht-tac-section"><h4>Mentality</h4>
        <div class="tac-btn-row">${['defensive','balanced','attacking'].map(mt =>
          `<button class="tac-opt-btn ${mt===tac.mentality?'selected':''}" data-tac="mentality" data-v="${mt}">${cap(mt)}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Pressing</h4>
        <div class="tac-btn-row">${['high','medium','low'].map(pr =>
          `<button class="tac-opt-btn ${pr===tac.pressing?'selected':''}" data-tac="pressing" data-v="${pr}">${pressLabels[pr]}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Style</h4>
        <div class="tac-btn-row">${['direct','balanced','possession','counter','gegenpressing','longball'].map(st =>
          `<button class="tac-opt-btn ${st===tac.style?'selected':''}" data-tac="style" data-v="${st}">${styleLabels[st]}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Corners</h4>
        <div class="tac-btn-row">${['near-post','far-post','short','drilled'].map(v =>
          `<button class="tac-opt-btn ${(tac.cornerTaking||'far-post')===v?'selected':''}" data-tac="cornerTaking" data-v="${v}">${cornerLabels[v]}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Free Kicks</h4>
        <div class="tac-btn-row">${['shoot','cross','short'].map(v =>
          `<button class="tac-opt-btn ${(tac.freeKick||'cross')===v?'selected':''}" data-tac="freeKick" data-v="${v}">${fkLabels[v]}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Defence</h4>
        <div class="tac-btn-row">${['zonal','man','mixed'].map(v =>
          `<button class="tac-opt-btn ${(tac.cornerDefense||'mixed')===v?'selected':''}" data-tac="cornerDefense" data-v="${v}">${spDefLabels[v]}</button>`).join('')}</div>
      </div>
      <div class="ht-tac-section"><h4>Instructions</h4>
        <div class="tac-btn-row">
          <button class="tac-opt-btn ${tac.playSetPieces?'selected':''}" data-tac="playSetPieces" data-v="${!tac.playSetPieces}">Play for SP</button>
          <button class="tac-opt-btn ${tac.timeWasting?'selected':''}" data-tac="timeWasting" data-v="${!tac.timeWasting}">Time Wasting</button>
        </div>
      </div>`;
    el.querySelectorAll('.formation-btn[data-f]').forEach(b => b.addEventListener('click', () => {
      tac.formation = b.dataset.f;
      m.htLineup = rearrangeXI(m.htLineup, b.dataset.f);
      renderHalftimePanel();
    }));
    el.querySelectorAll('[data-tac]').forEach(b => b.addEventListener('click', () => {
      const raw = b.dataset.v;
      tac[b.dataset.tac] = raw === 'true' ? true : raw === 'false' ? false : raw;
      renderHalftimePanel();
    }));
  }

  function renderHalfTimeSubs(el) {
    const m = ui.match;
    const myClub = gameState.myClub;
    const totalSubsUsed = m.subsUsed + (m.htPendingSubs || []).length;
    const canSub = totalSubsUsed < m.subsMax;
    const pendingOffIds = new Set((m.htPendingSubs || []).map(s => s.offId));
    const pendingOnIds  = new Set((m.htPendingSubs || []).map(s => s.onId));
    const xiSet = new Set(m.htLineup);
    const selOff = m.htSubSelOff || null;

    const pendingHtml = m.htPendingSubs.length > 0 ? `
      <div class="ht-subs-pending">
        <h5>Pending Subs</h5>
        ${m.htPendingSubs.map((s, i) => {
          const op = myClub.players.find(p => p.id === s.offId);
          const np = myClub.players.find(p => p.id === s.onId);
          return `<div class="ht-sub-item">
            <span class="ht-sub-off">${esc(op?.lastName || '?')} ↓</span>
            <span style="color:var(--text-muted)">→</span>
            <span class="ht-sub-on">${esc(np?.lastName || '?')} ↑</span>
            <button class="ht-sub-cancel" data-idx="${i}">✕</button>
          </div>`;
        }).join('')}
      </div>` : '';

    const xiPlayers = m.htLineup
      .map(id => myClub.players.find(p => p.id === id))
      .filter(Boolean)
      .filter(p => !pendingOffIds.has(p.id));

    const benchPlayers = myClub.players.filter(p => !xiSet.has(p.id) && !pendingOnIds.has(p.id));

    const xiHtml = xiPlayers.map(p => `
      <div class="ht-player-item ${selOff === p.id ? 'selected' : ''} ${!canSub && selOff !== p.id ? 'disabled' : ''}" data-off="${p.id}">
        <span class="pos-badge pos-${p.pos}">${p.pos}</span>
        <span class="ht-player-name">${esc(p.lastName)}</span>
        <span class="ht-player-ovr">${p.ovr}</span>
      </div>`).join('');

    const benchHtml = benchPlayers.map(p => `
      <div class="ht-player-item bench ${!selOff ? 'disabled' : ''}" data-on="${p.id}">
        <span class="pos-badge pos-${p.pos}">${p.pos}</span>
        <span class="ht-player-name">${esc(p.lastName)}</span>
        <span class="ht-player-ovr">${p.ovr}</span>
      </div>`).join('');

    el.innerHTML = `
      ${pendingHtml}
      <div class="ht-subs-info">${totalSubsUsed}/${m.subsMax} substitutions used</div>
      ${canSub ? '' : '<div class="ht-subs-info" style="color:var(--accent-red)">No substitutions remaining</div>'}
      <div class="ht-subs-layout">
        <div>
          <h5>${selOff ? '✓ Going off:' : 'Select player off'}</h5>
          <div class="ht-player-list">${xiHtml}</div>
        </div>
        <div>
          <h5>${selOff ? 'Select player on' : '—'}</h5>
          <div class="ht-player-list">${benchHtml}</div>
        </div>
      </div>`;

    el.querySelectorAll('[data-off]').forEach(item => item.addEventListener('click', () => {
      if (!canSub && m.htSubSelOff !== item.dataset.off) return;
      m.htSubSelOff = m.htSubSelOff === item.dataset.off ? null : item.dataset.off;
      renderHalftimePanel();
    }));
    el.querySelectorAll('[data-on]').forEach(item => item.addEventListener('click', () => {
      if (!m.htSubSelOff || !canSub) return;
      const offId = m.htSubSelOff, onId = item.dataset.on;
      const idx = m.htLineup.indexOf(offId);
      if (idx >= 0) m.htLineup[idx] = onId;
      m.htPendingSubs.push({ offId, onId });
      m.htSubSelOff = null;
      renderHalftimePanel();
    }));
    el.querySelectorAll('.ht-sub-cancel').forEach(btn => btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx);
      const sub = m.htPendingSubs[i];
      const idx = m.htLineup.indexOf(sub.onId);
      if (idx >= 0) m.htLineup[idx] = sub.offId;
      m.htPendingSubs.splice(i, 1);
      renderHalftimePanel();
    }));
  }

  function applyHalftimeChanges() {
    const m = ui.match;
    if (!m) return;
    const myClub = gameState.myClub;

    const origTacStr = JSON.stringify(m.currentTactics);
    const origXI = m.myIsHome ? m.currentHomeXI.join(',') : m.currentAwayXI.join(',');

    // Apply substitutions into result events right at the second-half kickoff
    if (m.htPendingSubs && m.htPendingSubs.length > 0) {
      const kickoffMin = 45 + m.sim.stoppage1 + 1;
      m.htPendingSubs.forEach(sub => {
        const offP = myClub.players.find(p => p.id === sub.offId);
        const onP  = myClub.players.find(p => p.id === sub.onId);
        m.result.events.push({ min: kickoffMin, type: 'sub', team: m.myIsHome ? 'home' : 'away', playerOff: offP, playerOn: onP });
        m.subsUsed++;
      });
      m.result.events.sort((a, b) => a.min - b.min);
    }

    // Commit lineup changes
    if (m.htLineup) {
      if (m.myIsHome) m.currentHomeXI = [...m.htLineup];
      else            m.currentAwayXI = [...m.htLineup];
    }
    // Commit tactics changes
    if (m.htTactics) {
      m.currentTactics = { ...m.htTactics };
    }

    // Re-simulate second half if tactics or lineup changed
    const tacChanged    = JSON.stringify(m.currentTactics) !== origTacStr;
    const lineupChanged = (m.myIsHome ? m.currentHomeXI : m.currentAwayXI).join(',') !== origXI;
    if (tacChanged || lineupChanged) reSimSecondHalf();

    // Mid-match tactic changes are match-only — don't overwrite gameState.tactics

    // Update player dots for any subs made
    if (m.htPendingSubs && m.htPendingSubs.length > 0) updatePitchDotsAfterSubs();

    // Clear halftime state
    m.htPendingSubs = [];
    m.htTactics = null;
    m.htLineup = null;
    m.htSubSelOff = null;
    m.htActiveTab = null;
  }

  // Re-simulates everything after `splitMinute` using the current XI/tactics, so a player
  // who has just been subbed off (or a tactics change) can no longer affect events past that
  // point — without this, the rest of the match would keep playing out from the pre-sub events.
  // `keepThroughMinute` (defaults to splitMinute) lets halftime keep its synthetic min:46 sub markers.
  function reSimFromMinute(splitMinute, keepThroughMinute = splitMinute) {
    const m = ui.match;
    const home = m.home, away = m.away;
    const aiClub = m.myIsHome ? away : home;
    const aiTactics = aiClub.tactics || ENGINE.deriveAITactics(aiClub);
    const aiForm = DATA.FORMATIONS[aiTactics.formation] || DATA.FORMATIONS['4-3-3'];
    const aiSlotPos = aiForm.positions.map(p => p.pos);
    const myFormKey = m.currentTactics.formation;
    const myFormObj = myFormKey === 'custom' && m.currentTactics.customFormation
      ? m.currentTactics.customFormation
      : (DATA.FORMATIONS[myFormKey] || DATA.FORMATIONS['4-3-3']);
    const mySlotPos = myFormObj.positions.map(p => p.pos);
    const newResult = ENGINE.simulateMatch(home, away, {
      homeXI: m.currentHomeXI,
      awayXI: m.currentAwayXI,
      homeTactics: m.myIsHome ? { ...m.currentTactics } : aiTactics,
      awayTactics: m.myIsHome ? aiTactics : { ...m.currentTactics },
      homeSlotPositions: m.myIsHome ? mySlotPos : aiSlotPos,
      awaySlotPositions: m.myIsHome ? aiSlotPos : mySlotPos,
      homeManDown: !!m.sim.homeManDown,
      awayManDown: !!m.sim.awayManDown,
    });
    // Use the new sim's early events as the remainder of the match (shift min by splitMinute).
    // matchEnd (not a flat 90) accounts for this match's own already-fixed stoppage time.
    const remainingMins = m.sim.matchEnd - splitMinute;
    const newRemainder = newResult.events
      .filter(e => e.min > 0 && e.min <= remainingMins)
      .map(e => ({ ...e, min: e.min + splitMinute }));
    // Keep everything already played (plus any synthetic sub markers up to keepThroughMinute)
    const kept = m.result.events.filter(e => e.min <= keepThroughMinute);
    const merged = [...kept, ...newRemainder].sort((a, b) => a.min - b.min);
    // Mutate the existing array in place — the running tick() loop holds its own reference
    // to ui.match.result.events, so reassigning the property here wouldn't reach it.
    m.result.events.length = 0;
    m.result.events.push(...merged);
    // Recalculate final score: what's already on the board + new goals in the regenerated remainder
    const hsNew = newRemainder.filter(e => e.type === 'goal' && e.team === 'home').length;
    const asNew = newRemainder.filter(e => e.type === 'goal' && e.team === 'away').length;
    m.result.homeScore = m.sim.hs + hsNew;
    m.result.awayScore = m.sim.as + asNew;
    // Recompute shot/SOT totals directly off the merged timeline (rather than trusting
    // either simulateMatch call's own totals) so the full-time stats bar always matches
    // however many shot events actually ended up on the pitch after a mid-match re-sim.
    const SHOT_TYPES = ['goal', 'shot_saved', 'shot_wide', 'shot_post'];
    const ON_TARGET_TYPES = ['goal', 'shot_saved'];
    const countShots = (team, types) => merged.filter(e => e.team === team && types.includes(e.type)).length;
    m.result.stats.shots = [countShots('home', SHOT_TYPES), countShots('away', SHOT_TYPES)];
    m.result.stats.shotsOnTarget = [countShots('home', ON_TARGET_TYPES), countShots('away', ON_TARGET_TYPES)];
    // Reset the event pointer to just after the kept window
    m.sim.idx = m.result.events.findIndex(e => e.min > keepThroughMinute);
    if (m.sim.idx < 0) m.sim.idx = m.result.events.length;
  }

  function reSimSecondHalf() {
    const stoppage1 = ui.match.sim.stoppage1;
    reSimFromMinute(45 + stoppage1, 45 + stoppage1 + 1);
    notify('2nd half tactics applied', 'info');
  }

  function updatePitchDotsAfterSubs() {
    const m = ui.match;
    if (!m?.players?.length) return;
    const myClub = gameState.myClub;
    const myXI   = m.myIsHome ? m.currentHomeXI : m.currentAwayXI;
    m.players.forEach(p => {
      if (p.isHome !== m.myIsHome) return;
      const newPlayerId = myXI[p.slotIdx];
      if (!newPlayerId || p.player?.id === newPlayerId) return;
      const newPlayer = myClub.players.find(pl => pl.id === newPlayerId);
      if (!newPlayer) return;
      p.player = newPlayer;
      const nameEl = p.el?.querySelector('.dot-name');
      if (nameEl) nameEl.textContent = shortName(newPlayer.name);
    });
  }

  /* =============================================
     IN-MATCH LIVE TACTICS MODAL — same controls as the half-time tactics tab,
     but reachable any time during play and applied immediately via reSimFromMinute
     instead of waiting for the break.
     ============================================= */
  function showLiveTacticsModal() {
    const m = ui.match;
    if (!m) return;
    const tac = { ...m.currentTactics };
    let lineup = [...(m.myIsHome ? m.currentHomeXI : m.currentAwayXI)];
    const pressLabels = { high: 'High Press', medium: 'Medium Block', low: 'Low Block' };
    const styleLabels = { direct: 'Direct', balanced: 'Balanced', possession: 'Possession', counter: 'Counter', gegenpressing: 'Gegenpressing', longball: 'Long Ball' };

    const render = () => {
      const formBtns = Object.keys(DATA.FORMATIONS).map(f =>
        `<button class="formation-btn ${f === tac.formation ? 'selected' : ''}" data-f="${f}">${DATA.FORMATIONS[f].name}</button>`
      ).join('');
      const cornerLabels = { 'near-post': 'Near Post', 'far-post': 'Far Post', 'short': 'Short', 'drilled': 'Drilled' };
      const fkLabels = { shoot: 'Shoot', cross: 'Cross', short: 'Short' };
      const spDefLabels = { zonal: 'Zonal', man: 'Man Mark', mixed: 'Mixed' };
      showModal(`
        <div class="subs-modal-header">Tactics <span class="subs-used-badge">${formatMatchMinute(m.sim.min, m.sim.stoppage1)}</span></div>
        <div class="ht-tac-section"><h4>Formation</h4><div class="formation-grid">${formBtns}</div></div>
        <div class="ht-tac-section"><h4>Mentality</h4>
          <div class="tac-btn-row">${['defensive','balanced','attacking'].map(mt =>
            `<button class="tac-opt-btn ${mt===tac.mentality?'selected':''}" data-tac="mentality" data-v="${mt}">${cap(mt)}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Pressing</h4>
          <div class="tac-btn-row">${['high','medium','low'].map(pr =>
            `<button class="tac-opt-btn ${pr===tac.pressing?'selected':''}" data-tac="pressing" data-v="${pr}">${pressLabels[pr]}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Style</h4>
          <div class="tac-btn-row">${['direct','balanced','possession','counter','gegenpressing','longball'].map(st =>
            `<button class="tac-opt-btn ${st===tac.style?'selected':''}" data-tac="style" data-v="${st}">${styleLabels[st]}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Corners</h4>
          <div class="tac-btn-row">${['near-post','far-post','short','drilled'].map(v =>
            `<button class="tac-opt-btn ${(tac.cornerTaking||'far-post')===v?'selected':''}" data-tac="cornerTaking" data-v="${v}">${cornerLabels[v]}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Free Kicks</h4>
          <div class="tac-btn-row">${['shoot','cross','short'].map(v =>
            `<button class="tac-opt-btn ${(tac.freeKick||'cross')===v?'selected':''}" data-tac="freeKick" data-v="${v}">${fkLabels[v]}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Defence</h4>
          <div class="tac-btn-row">${['zonal','man','mixed'].map(v =>
            `<button class="tac-opt-btn ${(tac.cornerDefense||'mixed')===v?'selected':''}" data-tac="cornerDefense" data-v="${v}">${spDefLabels[v]}</button>`).join('')}</div>
        </div>
        <div class="ht-tac-section"><h4>Instructions</h4>
          <div class="tac-btn-row">
            <button class="tac-opt-btn ${tac.playSetPieces?'selected':''}" data-tac="playSetPieces" data-v="${!tac.playSetPieces}">Play for SP</button>
            <button class="tac-opt-btn ${tac.timeWasting?'selected':''}" data-tac="timeWasting" data-v="${!tac.timeWasting}">Time Wasting</button>
          </div>
        </div>
        <button id="live-tac-apply" class="btn-primary btn-lg" style="width:100%;margin-top:14px">Apply Tactics</button>
      `);
      document.querySelectorAll('.formation-btn[data-f]').forEach(b => b.addEventListener('click', () => {
        tac.formation = b.dataset.f;
        lineup = rearrangeXI(lineup, b.dataset.f);
        render();
      }));
      document.querySelectorAll('[data-tac]').forEach(b => b.addEventListener('click', () => {
        const raw = b.dataset.v;
        tac[b.dataset.tac] = raw === 'true' ? true : raw === 'false' ? false : raw;
        render();
      }));
      $('live-tac-apply')?.addEventListener('click', () => {
        const origTacStr = JSON.stringify(m.currentTactics);
        const origXI = (m.myIsHome ? m.currentHomeXI : m.currentAwayXI).join(',');
        m.currentTactics = { ...tac };
        if (m.myIsHome) m.currentHomeXI = [...lineup]; else m.currentAwayXI = [...lineup];
        const tacChanged    = JSON.stringify(m.currentTactics) !== origTacStr;
        const lineupChanged = lineup.join(',') !== origXI;
        if (tacChanged || lineupChanged) {
          if (m.sim.min < m.sim.matchEnd) reSimFromMinute(m.sim.min);
          updatePitchDotsAfterSubs();
          notify('Tactics updated for the rest of the match', 'info');
        }
        closeModal();
      });
    };
    render();
  }

  /* =============================================
     IN-MATCH SUBSTITUTION MODAL
     ============================================= */
  function showSubsModal(preSelectOff = null) {
    const m = ui.match;
    if (!m) return;
    const myClub = gameState.myClub;
    const myXI   = m.myIsHome ? m.currentHomeXI : m.currentAwayXI;
    const xiSet  = new Set(myXI);
    const subsRemaining = m.subsMax - m.subsUsed;
    if (subsRemaining <= 0) { notify('No substitutions remaining (5/5 used)', 'warning'); return; }
    const activeForm = activeTacticForm();
    let selOff = preSelectOff || null;

    const fitBar = p => {
      if (p.injured) { const inj = INJURY_TYPES.find(t => t.id === p.injuryType); return `<span class="inj-badge inj-${inj?.severity||'minor'}" style="font-size:10px;padding:1px 4px">${inj?.label||'Inj'}</span>`; }
      const f = p.fitness ?? 80;
      const fc = f >= 80 ? 'fit-high' : f >= 55 ? 'fit-mid' : f >= 30 ? 'fit-low' : 'fit-critical';
      return `<div class="fit-bar-wrap" style="width:36px;display:inline-block"><div class="fit-bar ${fc}" style="width:${f}%"></div></div><span style="font-size:9px;color:#aaa;margin-left:2px">${f}%</span>`;
    };

    const render = () => {
      // Build pitch — map XI slots to live players
      const pitchPlayers = activeForm.positions.map((slot, i) => {
        const p = myClub.players.find(x => x.id === myXI[i]);
        if (!p) return `<div class="pitch-player pitch-empty" style="left:${slot.x}%;top:${slot.y}%"><div class="pitch-player-circle empty-slot">${slot.pos}</div></div>`;
        const isSel = selOff === p.id;
        const selCls = isSel ? ' swap-sel' : (selOff ? ' swap-dim' : '');
        const f = p.fitness ?? 80;
        const fc = f >= 80 ? '' : f >= 55 ? ' fit-mid-dot' : ' fit-low-dot';
        const oopF   = ENGINE.oopFactor(p.pos, slot.pos);
        const oopLvl = oopF >= 1.0 ? '' : oopF >= 0.88 ? 'oop-minor' : oopF >= 0.70 ? 'oop-moderate' : oopF >= 0.48 ? 'oop-severe' : 'oop-extreme';
        const oopCls = oopLvl ? ` ${oopLvl}` : '';
        const effOvr = oopLvl ? Math.round(p.ovr * oopF) : p.ovr;
        const oopTag = oopLvl
          ? `<div class="pitch-player-oop ${oopLvl}">${slot.pos} &minus;${Math.round((1 - oopF) * 100)}%</div>`
          : '';
        return `<div class="pitch-player${selCls}${oopCls}" data-suboff="${p.id}" style="left:${slot.x}%;top:${slot.y}%;cursor:pointer">
          <div class="pitch-player-circle ${slot.pos === 'GK' ? 'gk' : ''}${isSel ? ' sub-sel-circle' : ''}${oopCls}" title="${esc(p.name)} (${p.pos}) playing ${slot.pos} · ${f}% fit · effective OVR ${effOvr}">${effOvr}</div>
          <div class="pitch-player-name">${esc(p.lastName)}</div>
          ${oopTag}
        </div>`;
      }).join('');

      // Bench chips — when a player is selected to come off, show how each bench
      // candidate would fit that vacated slot positionally.
      const offSlotPos = selOff ? activeForm.positions[myXI.indexOf(selOff)]?.pos : null;
      const benchPlayers = myClub.players.filter(p => !xiSet.has(p.id));
      const benchChips = benchPlayers.map(p => {
        const dim = !selOff ? ' bench-chip-dim' : '';
        const oopF    = offSlotPos ? ENGINE.oopFactor(p.pos, offSlotPos) : 1.0;
        const isOOP   = offSlotPos && oopF < 1.0;
        const oopLvl  = !isOOP ? '' : oopF >= 0.88 ? 'oop-badge-minor' : oopF >= 0.70 ? 'oop-badge-moderate' : oopF >= 0.48 ? 'oop-badge-severe' : 'oop-badge-extreme';
        const oopBadge = isOOP ? `<span class="oop-badge ${oopLvl}" title="Playing ${offSlotPos}, effective OVR ${Math.round(p.ovr * oopF)}">${offSlotPos} &minus;${Math.round((1 - oopF) * 100)}%</span>` : '';
        return `<div class="bench-chip${dim}" data-subon="${p.id}" style="cursor:pointer">
          <span class="pos-badge ${posClass(p.pos)}">${p.pos}</span>
          <span class="bench-chip-name">${esc(p.lastName)}</span>
          <span class="bench-chip-ovr">${p.ovr}</span>
          ${oopBadge}
          ${fitBar(p)}
        </div>`;
      }).join('');

      const hint = selOff
        ? `<div class="subs-hint active">Pick bench player to come on</div>`
        : `<div class="subs-hint">Click a player on the pitch to take off</div>`;

      showModal(`
        <div class="subs-modal">
          <div class="subs-modal-header">
            Substitutions
            <span class="subs-used-badge">${m.subsUsed}/${m.subsMax} used</span>
          </div>
          ${hint}
          <div class="subs-pitch-wrap">
            <div class="tactics-pitch" style="height:300px">
              <div class="tactics-pitch-lines">
                <div class="tp-center-line"></div><div class="tp-center-circle"></div>
                <div class="tp-penalty-top"></div><div class="tp-penalty-bottom"></div>
              </div>
              ${pitchPlayers}
            </div>
          </div>
          <div class="subs-bench-label">Bench</div>
          <div class="bench-chips">${benchChips}</div>
        </div>`);

      document.querySelectorAll('[data-suboff]').forEach(el => el.addEventListener('click', () => {
        const pid = el.dataset.suboff;
        selOff = selOff === pid ? null : pid;
        render();
      }));

      document.querySelectorAll('[data-subon]').forEach(el => el.addEventListener('click', () => {
        if (!selOff) return;
        const offId = selOff, onId = el.dataset.subon;
        const offP = myClub.players.find(p => p.id === offId);
        const onP  = myClub.players.find(p => p.id === onId);
        const myXIArr = m.myIsHome ? m.currentHomeXI : m.currentAwayXI;
        const idx = myXIArr.indexOf(offId);
        if (idx >= 0) { myXIArr[idx] = onId; xiSet.delete(offId); xiSet.add(onId); }
        m.subsUsed++;
        const subEv = { min: m.sim.min, type: 'sub', team: m.myIsHome ? 'home' : 'away', playerOff: offP, playerOn: onP };
        m.result.events.push(subEv);
        m.result.events.sort((a, b) => a.min - b.min);
        if (m.sim.min < m.sim.matchEnd) reSimFromMinute(m.sim.min);
        addMatchEvent(subEv);
        updatePitchDotsAfterSubs();
        closeModal();
        notify(`${onP?.lastName || '?'} on for ${offP?.lastName || '?'}`, 'info');
      }));
    };
    render();
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
      sim.min = sim.matchEnd;
      $('match-score').textContent = `${sim.hs} – ${sim.as}`;
      $('match-time').textContent = formatMatchMinute(sim.matchEnd, sim.stoppage1);
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

  /* -- Fitness / injury helpers -- */
  function applyMatchFitness(club, playedIds, subbedOnIds) {
    const playedSet   = new Set(playedIds);
    const subbedOnSet = new Set(subbedOnIds || []);
    club.players.forEach(p => {
      if (playedSet.has(p.id)) {
        const drain = subbedOnSet.has(p.id) ? FITNESS_DRAIN_SUB : FITNESS_DRAIN_STARTER;
        p.fitness = Math.max(20, (p.fitness ?? 80) - drain);
      } else if (!p.injured) {
        p.fitness = Math.min(100, (p.fitness ?? 80) + FITNESS_RECOVER_REST);
      }
    });
  }

  // Weekly injury recovery / fitness top-up — runs for every club so AI players actually
  // recover from injuries instead of staying flagged forever; only the user's club gets toasts.
  // weeksScale: 1.0 = standard week, 0.43 ≈ 3-day turnaround, 1.43 ≈ 10-day rest.
  function tickInjuries(weeksScale = 1) {
    const myClub = gameState.myClub;
    // Rehab centre speeds recovery: level 1-5 → 0/10/20/33/50% faster
    const rehabLvl = myClub?.facilities?.rehab || myClub?.rep || 1;
    const rehabSpeedMult = [1, 1, 1.10, 1.20, 1.33, 1.50][rehabLvl];
    const rehabCoachBonus = ((gameState.staff?.coaches || []).filter(c => c.role === 'rehab').reduce((s, c) => s + [0, 0.05, 0.10, 0.18][c.level] || 0, 0));
    const fitnessCoachBonus = ((gameState.staff?.coaches || []).filter(c => c.role === 'fitness').reduce((s, c) => s + [0, 0.5, 1.0, 2.0][c.level] || 0, 0));
    const tUpgFitness = myClub?.trainingUpgrades || {};
    const upgradesFitnessBonus = (tUpgFitness.altitude_chamber ? 2 : 0) + (tUpgFitness.hydrotherapy ? 1.5 : 0) + (tUpgFitness.indoor_pitch ? 1 : 0);
    Object.values(gameState.clubs).forEach(club => {
      const isUser = club === myClub;
      club.players.forEach(p => {
        if (!p.injured) {
          const recovBonus = isUser ? fitnessCoachBonus + upgradesFitnessBonus : 0;
          p.fitness = Math.min(100, (p.fitness ?? 80) + (FITNESS_RECOVER_WEEK + recovBonus) * weeksScale);
        } else {
          const speedMult = isUser ? (rehabSpeedMult + rehabCoachBonus) : 1;
          p.injuryWeeks = Math.max(0, (p.injuryWeeks || 0) - (1 * speedMult));
          if (p.injuryWeeks <= 0) {
            const inj = INJURY_TYPES.find(t => t.id === p.injuryType);
            if (inj?.potDrop > 0) {
              p.pot = Math.max(p.ovr, p.pot - inj.potDrop);
              if (club === myClub) notify(`${p.name} has recovered but their potential has dropped after their ${inj.label}.`, 'warning');
            }
            p.injured    = false;
            p.injuryType = null;
            p.fitness    = 65; // return at 65% — not full fitness
          }
        }
      });
    });
  }

  // Stats relevant to each position group — growth nudges one of these rather than
  // every attribute, mirroring how generatePlayer differentiates stat ranges by role.
  const DEV_ATTRS = {
    GK:  ['gkReflexes', 'gkPositioning', 'passing', 'physical'],
    DEF: ['defending', 'physical', 'passing', 'pace'],
    MID: ['passing', 'dribbling', 'defending', 'physical'],
    ATT: ['shooting', 'dribbling', 'pace', 'passing'],
  };
  // OVR is derived the same way generatePlayer first set it — mean of the top 4
  // attrs — so it only moves when a gain actually lands among a player's best
  // stats, and is hard-capped at their potential ceiling.
  function recomputeOvrFromAttrs(p) {
    const top4 = Object.values(p.attrs).sort((a, b) => b - a).slice(0, 4);
    const fromAttrs = Math.round(top4.reduce((s, v) => s + v, 0) / 4);
    // Authored real-player OVRs don't always exactly match their (independently
    // randomized) attrs — never let growth read as a regression because of that.
    return Math.min(p.pot, Math.max(p.ovr, fromAttrs));
  }

  // Weekly potential-driven growth: players gain individual stats over time
  // (weighted toward their weakest relevant attribute, so raw teens round out
  // and established pros sharpen their strengths) and OVR just follows from
  // that — a much slower, textured climb than a flat OVR dice roll, and one
  // that tapers hard with age instead of stopping abruptly at 30. Most players
  // still won't fully reach their listed potential before growth ends; the rare
  // "breakout" roll for highly-rated teens is what occasionally lets a wonderkid
  // explode rather than everyone climbing at the same slow trickle.
  // Runs for every club (so the league stays balanced over multiple seasons),
  // but only the user's club gets a toast — nobody needs an AI youth update.
  function tickPlayerDevelopment(weeks) {
    const myClub = gameState.myClub;
    // Coach bonuses: sum of all hired coach level bonuses by role
    const coaches = gameState.staff?.coaches || [];
    const coachBonus = (role) => coaches.filter(c => c.role === role).reduce((s, c) => s + [0, 0.002, 0.005, 0.010][c.level] || 0, 0);
    const attackBonus   = coachBonus('attacking');
    const defendBonus   = coachBonus('defensive');
    const academyBonus  = coachBonus('academy');
    const fitnessBonus  = coachBonus('fitness');   // applied in tickFitness
    const trainingFacLvl = myClub?.facilities?.training || myClub?.rep || 1;
    const trainingFacBonus = [0, 0, 0.002, 0.005, 0.009, 0.015][trainingFacLvl];
    const tUpg = myClub?.trainingUpgrades || {};
    const upgradeDevBonus = (pos) => {
      let b = (tUpg.indoor_pitch ? 0.003 : 0) + (tUpg.gym_upgrade && ['CB','LB','RB','CDM','GK'].includes(pos) ? 0.003 : 0)
        + (tUpg.biometric_lab && ['CAM','LW','RW'].includes(pos) ? 0.004 : 0)
        + (tUpg.sprint_track && ['LW','RW','ST','CF'].includes(pos) ? 0.002 : 0);
      return b;
    };

    const growChanceFor = (age, pos, clubIsUser) => {
      const base = age <= 17 ? 0.05 : age <= 19 ? 0.042 : age <= 21 ? 0.035
        : age <= 23 ? 0.026 : age <= 25 ? 0.018 : age <= 27 ? 0.011 : 0.006;
      if (!clubIsUser) return base;
      const isAtt = ['ST','CF','LW','RW','CAM'].includes(pos);
      const isDef = ['CB','LB','RB','LWB','RWB','CDM','GK'].includes(pos);
      const isYouth = age <= 19;
      return base + trainingFacBonus
        + (isAtt ? attackBonus : 0)
        + (isDef ? defendBonus : 0)
        + (isYouth ? academyBonus : 0)
        + (clubIsUser ? upgradeDevBonus(pos) : 0);
    };
    Object.values(gameState.clubs).forEach(club => {
      let grew = false;
      club.players.forEach(p => {
        if (p.ovr >= p.pot || p.age >= 30 || !p.attrs) return; // development is over past 30 — decline only from here
        const pool = DEV_ATTRS[group(p.pos)] || Object.keys(p.attrs);
        const chance = growChanceFor(p.age, p.pos, club === myClub);
        for (let i = 0; i < weeks && p.ovr < p.pot; i++) {
          // Rare breakout: a teen prospect with real headroom occasionally jumps
          // several points at once instead of the usual one-stat trickle.
          if (p.age <= 19 && (p.pot - p.ovr) >= 8 && Math.random() < 0.012) {
            const burst = rand(2, 4);
            for (let b = 0; b < burst; b++) {
              const cands = pool.filter(k => p.attrs[k] < 99);
              if (!cands.length) break;
              const k = cands[Math.floor(Math.random() * cands.length)];
              p.attrs[k] = Math.min(99, p.attrs[k] + 1);
            }
            const newOvr = recomputeOvrFromAttrs(p);
            if (newOvr !== p.ovr) {
              p.ovr = newOvr; p.value = DATA.calcValue(p.ovr, p.age, club.league, p.pot); grew = true;
              if (club === myClub) notify(`${p.name} has burst onto the scene — now ${p.ovr} OVR!`, 'success');
            }
            continue;
          }
          if (Math.random() >= chance) continue;
          const cands = pool.filter(k => p.attrs[k] < 99).sort((a, b) => p.attrs[a] - p.attrs[b]);
          if (!cands.length) continue;
          // Usually the weakest relevant stat, occasionally the next-weakest.
          const k = cands[Math.random() < 0.75 ? 0 : Math.min(1, cands.length - 1)];
          p.attrs[k] = Math.min(99, p.attrs[k] + 1);
          const newOvr = recomputeOvrFromAttrs(p);
          if (newOvr !== p.ovr) {
            p.ovr = newOvr;
            p.value = DATA.calcValue(p.ovr, p.age, club.league, p.pot);
            grew = true;
            if (club === myClub) notify(`${p.name} has improved to ${p.ovr} OVR!`, 'success');
          }
        }
      });
      if (grew) recalcSqRating(club);
    });
  }

  function doAcademyIntake() {
    const club = gameState.myClub;
    if (!club) return;
    if (!club.facilities) club.facilities = { academy: club.rep, stadium: club.rep, training: club.rep, rehab: club.rep };
    const lvl = club.facilities.academy;
    if (lvl < 1) return;
    const counts = [0, 1, 2, 3, 5, 8][lvl];
    if (!club.youthPlayers)   club.youthPlayers  = [];
    if (!club.pendingIntake)  club.pendingIntake  = [];
    // Age existing youth players by one year at season start
    club.youthPlayers.forEach(p => { p.age = (p.age || 16) + 1; });
    // Release 22+ who haven't been promoted
    club.youthPlayers = club.youthPlayers.filter(p => p.age <= 22);
    if (counts === 0) return;
    const POSITIONS = ['GK','CB','LB','RB','CM','CDM','CAM','LW','RW','ST'];
    const scopeLabels = ['','Regional','Regional','National','National','International'];
    const baseRating = Math.max(40, (club.sqRating||60) - [0,22,18,14,9,4][lvl]);
    const intlGem = lvl >= 4 && Math.random() < [0,0,0,0.15,0.25,0.45][lvl];
    const now = new Date(gameState.currentDate);
    for (let i = 0; i < counts; i++) {
      const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
      const age = 16 + Math.floor(Math.random() * 2);
      const isGem = intlGem && i === 0;
      const rating = isGem ? Math.min(90, baseRating + 10 + Math.floor(Math.random()*8)) : baseRating;
      const p = DATA.generatePlayer(`yu_${club.id}_${Date.now()}_${i}`, pos, rating, age, club.league);
      p.isYouth = true;
      p._isGem = isGem;
      p.contractEnd = new Date(now.getFullYear() + 2, 5, 30);
      // Spread arrivals: first in ~2 weeks, last in ~36 weeks (end of season)
      const weeksDelay = Math.round(2 + (i / Math.max(1, counts - 1)) * 34 + (Math.random() * 4 - 2));
      p._arriveDate = addDays(now, Math.max(7, weeksDelay * 7)).toISOString();
      club.pendingIntake.push(p);
    }
    const scope = scopeLabels[lvl];
    notify(`Academy (${scope}): ${counts} prospect${counts > 1 ? 's' : ''} identified — they'll arrive throughout the season.`, 'info');
  }

  function tickYouthIntake() {
    const club = gameState.myClub;
    if (!club?.pendingIntake?.length) return;
    const now = gameState.currentDate;
    const arrived = [];
    club.pendingIntake = club.pendingIntake.filter(p => {
      if (new Date(p._arriveDate) <= now) { arrived.push(p); return false; }
      return true;
    });
    if (!arrived.length) return;
    if (!club.youthPlayers) club.youthPlayers = [];
    const lvl  = club.facilities?.academy || 1;
    const maxSlots = [0,1,2,3,5,8][Math.min(5, Math.max(1, lvl))];
    arrived.forEach(p => {
      if (club.youthPlayers.length >= maxSlots) {
        // Squad full — delay 3 weeks and try again
        p._arriveDate = addDays(now, 21).toISOString();
        club.pendingIntake.push(p);
        return;
      }
      const gem = p._isGem;
      delete p._arriveDate;
      delete p._isGem;
      club.youthPlayers.push(p);
      notify(`${p.name} (${p.pos}, ${p.age}) has joined the academy!${gem ? ' ⭐ Gem prospect!' : ''}`, 'success');
    });
  }

  function tickRetraining() {
    const club = gameState.myClub;
    if (!club?.retraining) return;
    Object.entries(club.retraining).forEach(([pid, rt]) => {
      rt.weeksLeft = (rt.weeksLeft || 6) - 1;
      if (rt.weeksLeft <= 0) {
        const p = club.players.find(pl => pl.id === pid);
        if (p) {
          const oldPos = p.pos;
          p.pos = rt.targetPos;
          notify(`${p.name} has completed retraining — now plays as ${rt.targetPos} (was ${oldPos}).`, 'success');
        }
        delete club.retraining[pid];
      }
    });
  }

  // Tracks how many consecutive weeks each of the user's players has sat outside
  // the selected XI — feeds the "not getting game time" transfer-request reason.
  // Injured players don't accrue frustration; that's not a selection snub.
  function tickGameTimeMorale() {
    const myClub = gameState.myClub;
    if (!myClub) return;
    const xiSet = new Set(gameState.tactics?.lineup || []);
    myClub.players.forEach(p => {
      if (xiSet.has(p.id) || p.injured) p.benchWeeks = 0;
      else p.benchWeeks = (p.benchWeeks || 0) + 1;
    });
  }

  // Contracts that reach their end date without being renewed actually lapse now:
  // the user's player leaves for free (so renewing on time genuinely matters), while
  // an AI club's player mostly auto-renews (so rival squads don't quietly hollow out)
  // but a minority walk too, keeping the free-agent pool topped up with departures.
  function tickContractExpiries() {
    const now = gameState.currentDate;
    const myId = gameState.myClubId;
    Object.values(gameState.clubs).forEach(club => {
      const expired = club.players.filter(p => p.contractEnd && p.contractEnd <= now);
      if (!expired.length) return;
      expired.forEach(p => {
        if (club.id === myId) {
          club.players = club.players.filter(x => x.id !== p.id);
          p.clubId = null; p.clubName = 'Free Agent'; p.contractEnd = null;
          p.wantsMove = true; p.transferListed = false;
          (gameState.freeAgents || (gameState.freeAgents = [])).push(p);
          addInboxMsg('club_news', `${p.name} leaves on a free transfer`,
            `${p.name}'s contract has expired and he has left the club as a free agent.`,
            { playerId: p.id, playerPos: p.pos, playerOvr: p.ovr });
          notify(`${p.name}'s contract has expired — he has left as a free agent.`, 'warning');
        } else if (Math.random() < 0.88) {
          p.contractEnd = DATA.contractEndAfterYears(now, rand(1, 3)); // quietly re-signs
        } else {
          club.players = club.players.filter(x => x.id !== p.id);
          p.clubId = null; p.clubName = 'Free Agent'; p.contractEnd = null; p.wantsMove = true;
          (gameState.freeAgents || (gameState.freeAgents = [])).push(p);
          pushTransferNews(`${p.name} has left ${club.name} on a free transfer`);
        }
      });
      recalcSqRating(club);
    });
  }

  // AI clubs keep their starting XI current (drops injured/transferred-out players),
  // drain/recover fitness for playing it like the user's club does, and occasionally
  // tweak one tactical dial based on recent form — a lightweight stand-in for a manager
  // reacting to results, mirroring the user's own tactics screen.
  function tickAIClubs() {
    const myId = gameState.myClubId;
    const formKeys = Object.keys(DATA.FORMATIONS);
    const mentalities = ['defensive', 'balanced', 'attacking'];
    const pressings = ['low', 'medium', 'high'];
    const styles = ['direct', 'balanced', 'possession', 'counter', 'gegenpressing', 'longball'];
    Object.values(gameState.clubs).forEach(club => {
      if (club.id === myId) return;
      if (!club.tactics) club.tactics = DATA.seedClubTactics(club);
      club.lineup = autoPickXI(club, club.tactics.formation);
      // AI matches don't track discrete subs, so the whole nominal XI gets the starter drain.
      applyMatchFitness(club, club.lineup, []);

      if (Math.random() >= 0.12) return; // most weeks, stay the course
      const recent = (club.form || []).slice(-3);
      const losses = recent.filter(r => r === 'L').length;
      const wins = recent.filter(r => r === 'W').length;
      if (losses >= 2) {
        if (Math.random() < 0.5) club.tactics.mentality = 'attacking';
        else club.tactics.pressing = 'high';
      } else if (wins >= 2) {
        if (Math.random() < 0.4) club.tactics.pressing = 'medium';
      } else {
        const field = pick(['formation', 'mentality', 'pressing', 'style']);
        if (field === 'formation') club.tactics.formation = pick(formKeys);
        else if (field === 'mentality') club.tactics.mentality = pick(mentalities);
        else if (field === 'pressing') club.tactics.pressing = pick(pressings);
        else club.tactics.style = pick(styles);
      }
    });
  }

  function pushTransferNews(text) {
    if (!gameState.transferNews) gameState.transferNews = [];
    gameState.transferNews.unshift({ text, date: fmtDate(gameState.currentDate) });
    if (gameState.transferNews.length > 30) gameState.transferNews.length = 30;
  }

  // AI clubs trade among themselves and sign free agents within their own budget —
  // sell side flags surplus players with the same `transferListed` flag the market
  // already reads; buy side targets each club's weakest position group. Deliberately
  // does not touch the user's club or gameState.transferLog (that's user-perspective
  // only and feeds season-review spend/earn totals).
  function tickAITransfers() {
    if (!ENGINE.isTransferWindowOpen(gameState)) return;
    const myId = gameState.myClubId;
    const aiClubs = Object.values(gameState.clubs).filter(c => c.id !== myId);

    // Sell side: occasionally flag a surplus/ambitious player for transfer.
    aiClubs.forEach(club => {
      if (Math.random() >= 0.08) return;
      const candidates = club.players.filter(p => !p.transferListed && !p.injured && playerAmbition(p, club) > 0.55);
      if (!candidates.length) return;
      pick(candidates).transferListed = true;
    });

    // Buy side: a handful of clubs each week try to fix their weakest position group.
    const fits = (club, p) => playerPrestige(p.ovr) <= (club.rep ?? 1) + 1.5;
    aiClubs.filter(() => Math.random() < 0.2).slice(0, 6).forEach(club => {
      if ((club.budget || 0) < 1) return;
      const groups = { GK: [], DEF: [], MID: [], ATT: [] };
      club.players.forEach(p => groups[group(p.pos)].push(p));
      const weakest = Object.entries(groups)
        .map(([g, ps]) => ({ g, avg: ps.length ? ps.reduce((s, p) => s + p.ovr, 0) / ps.length : 0 }))
        .sort((a, b) => a.avg - b.avg)[0];
      if (!weakest) return;

      const freePick = (gameState.freeAgents || [])
        .filter(p => group(p.pos) === weakest.g && p.ovr > weakest.avg && fits(club, p))
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (freePick) {
        gameState.freeAgents.splice(gameState.freeAgents.indexOf(freePick), 1);
        freePick.clubId = club.id; freePick.contractEnd = DATA.contractEndAfterYears(gameState.currentDate, rand(2, 4)); freePick.transferListed = false;
        club.players.push(freePick);
        recalcSqRating(club);
        pushTransferNews(`${club.name} signed free agent ${freePick.name} (${freePick.pos}, ${freePick.ovr} OVR)`);
        return;
      }

      let bestListed = null, bestSeller = null;
      aiClubs.forEach(seller => {
        if (seller.id === club.id) return;
        seller.players.forEach(p => {
          if (!p.transferListed || group(p.pos) !== weakest.g || p.ovr <= weakest.avg || !fits(club, p)) return;
          if (!bestListed || p.ovr > bestListed.ovr) { bestListed = p; bestSeller = seller; }
        });
      });
      if (bestListed) {
        const fee = Math.max(0.01, ENGINE.roundFee(bestListed.value * (0.85 + Math.random() * 0.3)));
        if ((club.budget || 0) < fee) return;
        const signedId = bestListed.id;
        bestSeller.players.splice(bestSeller.players.indexOf(bestListed), 1);
        bestListed.clubId = club.id; bestListed.transferListed = false; bestListed.contractEnd = DATA.contractEndAfterYears(gameState.currentDate, rand(2, 4));
        club.players.push(bestListed);
        club.budget = Math.round((club.budget - fee) * 10) / 10;
        bestSeller.budget = Math.round((bestSeller.budget + fee) * 10) / 10;
        recalcSqRating(club); recalcSqRating(bestSeller);
        pushTransferNews(`${club.name} signed ${bestListed.name} from ${bestSeller.name} for ${money(fee)}`);
        // This player may also be on the user's market list, or the subject of a
        // negotiation the user has open — both need to know they're gone now.
        gameState.market = (gameState.market || []).filter(x => x.id !== signedId);
        const userDeal = (gameState.negotiations || []).find(n => n.type === 'outgoing' && n.playerId === signedId);
        if (userDeal) {
          userDeal.stage = 'outbid'; userDeal.awaiting = 'user';
          userDeal.msgLog.push({ text: `${club.name} completed a ${money(fee)} signing of ${bestListed.name} — you've been outbid.`, tone: 'bad' });
          notify(`You've been outbid! ${club.name} signed ${bestListed.name}.`, 'error');
        }
      }
    });
  }

  function advanceAfterMatch() {
    // A drawn cup tie isn't resolved yet — extra time / penalties still have to
    // happen. The result overlay's button onclick drives that flow, but this
    // function is also bound as a persistent click listener on the same button,
    // so bail out here or the game would advance underneath the shootout.
    const mf = ui.match?.fixture;
    if (mf?.type === 'cup' && !mf.penWinner
        && ui.match.result.homeScore === ui.match.result.awayScore) return;
    try { _advanceAfterMatch(); } catch(err) {
      console.error('advanceAfterMatch error:', err);
      notify('Error advancing after match — check console. Try clicking Continue again.', 'error');
      showScreen('game');
      updateSidebar();
      renderView('dashboard');
    }
  }
  function _advanceAfterMatch() {
    const { fixture, result } = ui.match;
    fixture.played = true;
    fixture.homeScore = result.homeScore;
    fixture.awayScore = result.awayScore;
    fixture.events = result.events;

    // Derive who played for each side so recordResult can track appearances
    const myTeam    = ui.match.myIsHome ? 'home' : 'away';
    const myXI      = ui.match.myIsHome ? ui.match.currentHomeXI : ui.match.currentAwayXI;
    const oppXI     = ui.match.myIsHome ? ui.match.currentAwayXI : ui.match.currentHomeXI;
    const subbedOn  = (result.events || []).filter(e => e.type === 'sub' && e.team === myTeam).map(e => e.playerOn?.id).filter(Boolean);
    const oppSubOn  = (result.events || []).filter(e => e.type === 'sub' && e.team !== myTeam).map(e => e.playerOn?.id).filter(Boolean);
    ENGINE.recordResult(gameState, fixture, result.homeScore, result.awayScore, {
      homeXI:       ui.match.myIsHome ? myXI  : oppXI,
      awayXI:       ui.match.myIsHome ? oppXI : myXI,
      homeSubbedOn: ui.match.myIsHome ? subbedOn : oppSubOn,
      awaySubbedOn: ui.match.myIsHome ? oppSubOn : subbedOn,
    });

    // Accumulate career-at-club stats from this match's events for user's players
    const myPlayerIds = new Set(gameState.myClub.players.map(p => p.id));
    (result.events || []).forEach(ev => {
      if (ev.type === 'goal' && ev.player && myPlayerIds.has(ev.player.id))
        ev.player.clubCareerGoals = (ev.player.clubCareerGoals || 0) + 1;
      if (ev.assist && myPlayerIds.has(ev.assist.id))
        ev.assist.clubCareerAssists = (ev.assist.clubCareerAssists || 0) + 1;
    });
    const played = new Set([...(myXI || []), ...subbedOn]);
    gameState.myClub.players.forEach(p => {
      if (played.has(p.id)) p.clubCareerApps = (p.clubCareerApps || 0) + 1;
    });

    // Drain fitness for players who started; recover bench
    applyMatchFitness(gameState.myClub, myXI || [], subbedOn);

    // Scale injury recovery by days since last match — back-to-back games recover less
    const lastDate = gameState.lastMatchDate ? new Date(gameState.lastMatchDate) : null;
    const daysSince = lastDate ? Math.max(3, (fixture.date - lastDate) / DAY_MS) : 7;
    gameState.lastMatchDate = fixture.date.toISOString();
    tickInjuries(Math.min(2, daysSince / 7));
    tickContractExpiries();
    tickPlayerDevelopment(1);
    tickRetraining();
    tickYouthIntake();
    tickGameTimeMorale();
    tickAIClubs();
    tickAITransfers();

    // Remove injured or no-longer-at-the-club players from the lineup
    const tac = gameState.tactics;
    if (tac?.lineup) {
      const aliveIds = new Set(gameState.myClub.players.map(p => p.id));
      const injured = new Set(gameState.myClub.players.filter(p => p.injured).map(p => p.id));
      tac.lineup = tac.lineup.filter(id => aliveIds.has(id) && !injured.has(id));
      if (tac.lineup.length < 11) tac.lineup = autoPickXI(gameState.myClub, activeTacticForm());
      recalcSqRating(gameState.myClub);
    }

    // Finance tick: ~1 week between matches, plus matchday income for home league games.
    // TV money only counts this as a gameweek for actual league fixtures — cup/European
    // ties have their own prize money and shouldn't also draw league TV equal-share.
    const isLeagueFixture = fixture.type !== 'european' && fixture.type !== 'cup';
    tickFinances(1, isLeagueFixture);
    if (isLeagueFixture) awardMatchdayIncome(ui.match.myIsHome);
    checkWageBudget();

    // Board confidence: per-match bump/dip weighted by opponent strength
    {
      const myScore  = ui.match.myIsHome ? result.homeScore : result.awayScore;
      const oppScore = ui.match.myIsHome ? result.awayScore : result.homeScore;
      const oppId    = ui.match.myIsHome ? fixture.away : fixture.home;
      const oppRat   = (gameState.clubs[oppId]?.sqRating || 70);
      const myRat    = gameState.myClub.sqRating || 70;
      // diff > 0 means opponent is stronger than us
      const diff     = Math.round((oppRat - myRat) / 3);  // -3 to +3 range typical
      const fin      = gameState.finances;
      let delta = 0;
      if (myScore > oppScore && fixture.type !== 'european' && fixture.type !== 'cup') paySponsorClause('win');
      if (myScore > oppScore)      delta =  Math.max(1, Math.min(4, 2 + diff));  // upset win gives +4, easy win +1
      else if (myScore < oppScore) delta = -Math.max(1, Math.min(4, 2 - diff));  // upset loss -1, expected loss is also small
      // draw: 0
      fin.boardConfidence = Math.min(100, Math.max(0, fin.boardConfidence + delta));
      fin.boardConfidence = Math.round(fin.boardConfidence);
    }

    // For cup matches: record pen winner on fixture and advance the round
    if (fixture.type === 'cup' && gameState.cups) {
      const cup = Object.values(gameState.cups).find(c => c.fixtures.some(f => f.id === fixture.id));
      if (cup) {
        const cf = cup.fixtures.find(f => f.id === fixture.id);
        if (cf && fixture.penWinner) cf.penWinner = fixture.penWinner;
        if (cf && fixture.aet) cf.aet = true;
        const rnd = cf?.roundIdx || 0;
        const roundDone = cup.fixtures.filter(f => (f.roundIdx||0) === rnd).every(f => f.played);
        if (roundDone) advanceCupRound(cup, rnd);
      }
    }

    ENGINE.simulateSameDay(gameState, fixture);
    ENGINE.continueToNextFixture(gameState);
    const _nextFix = ENGINE.getNextFixture(gameState);
    simulateCompetitionsUpTo(_nextFix ? _nextFix.date : gameState.currentDate);

    // Now that the date has actually moved on, resolve anything whose response was
    // due somewhere in the days just skipped, then roll for new rival interest.
    resolveNegotiationResponses();
    rollBiddingWars();

    ui.match = null;
    delete gameState.matchSave;
    $('btn-simulate').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg> Start Match';
    advanceScouts();
    checkIncomingOffers();
    if (Math.random() < 0.30) generatePlayerEvents();
    if (Math.random() < 0.25) generateClubNews();
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
    ENGINE.simBulkFixture(gameState, f);
    if (f.home === gameState.myClubId || f.away === gameState.myClubId) {
      const opp = f.home === gameState.myClubId ? a : h;
      const my = f.home === gameState.myClubId ? f.homeScore : f.awayScore;
      const og = f.home === gameState.myClubId ? f.awayScore : f.homeScore;
      notify(`${comp.short}: ${gameState.myClub.name} ${my}–${og} ${opp.name}`, my > og ? 'success' : my === og ? 'info' : 'warning');
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

    // Knockout playoff round: two-legged tie for the last bracket spots.
    let playoffWinners = [];
    if (k.playoffField && k.playoffField.length) {
      const ties = [], pf = k.playoffField.slice();
      for (let i = 0; i + 1 < pf.length; i += 2) {
        const tie = simKOTwoLegs(pf[i], pf[i + 1]);
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
      const isFinal = teams.length === 2;
      for (let i = 0; i + 1 < teams.length; i += 2) {
        const tie = isFinal ? simKO(teams[i], teams[i + 1]) : simKOTwoLegs(teams[i], teams[i + 1]);
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
    const aStr = A.sqRating || 70, bStr = B.sqRating || 70;
    let sa = rand(0, 3), sb = rand(0, 3);
    let aet = false, pens = false;
    if (sa === sb) {
      // Extra time
      aet = true;
      sa += Math.random() < 0.15 ? 1 : 0;
      sb += Math.random() < 0.15 ? 1 : 0;
      if (sa === sb) {
        // Penalties
        pens = true;
        if ((aStr + rand(-10, 10)) >= (bStr + rand(-10, 10))) sa++; else sb++;
      }
    }
    const suffix = pens ? ' (pens)' : aet ? ' (aet)' : '';
    return { a: aId, b: bId, sa, sb, aet, pens, suffix, winner: sa > sb ? aId : bId };
  }
  // Two-legged tie: leg 1 at B, leg 2 at A (A gets home advantage in the decider).
  // No away goals (UEFA abolished in 2021) — level aggregate = penalty shootout.
  function simKOTwoLegs(aId, bId) {
    const A = gameState.clubs[aId], B = gameState.clubs[bId];
    if (!A) return { a: aId, b: bId, twoLegged: true, leg1: {sa:0,sb:2}, leg2: {sa:0,sb:1}, aggA:0, aggB:3, winner: bId };
    if (!B) return { a: aId, b: bId, twoLegged: true, leg1: {sa:2,sb:0}, leg2: {sa:1,sb:0}, aggA:3, aggB:0, winner: aId };
    const aStr = A.sqRating || 70, bStr = B.sqRating || 70;
    // Leg 1: B home — give the home side a small random boost
    const l1a = rand(0, 3);
    const l1b = rand(0, 3) + (Math.random() < 0.22 ? 1 : 0); // slight home boost for B
    // Leg 2: A home
    const l2a = rand(0, 3) + (Math.random() < 0.22 ? 1 : 0); // slight home boost for A
    const l2b = rand(0, 3);
    let aggA = l1a + l2a, aggB = l1b + l2b;
    let winner, aet = false, pens = false;
    if (aggA !== aggB) {
      winner = aggA > aggB ? aId : bId;
    } else {
      // Extra time: small chance one team scores in 30 mins (~15% each side)
      aet = true;
      const etA = Math.random() < 0.15 ? 1 : 0;
      const etB = Math.random() < 0.15 ? 1 : 0;
      aggA += etA; aggB += etB;
      l2a += etA; l2b += etB; // fold ET goals into leg 2 display
      if (aggA !== aggB) {
        winner = aggA > aggB ? aId : bId;
      } else {
        pens = true;
        winner = (aStr + rand(-10, 10)) >= (bStr + rand(-10, 10)) ? aId : bId;
      }
    }
    return { a: aId, b: bId, twoLegged: true,
             leg1: { sa: l1a, sb: l1b }, leg2: { sa: l2a, sb: l2b },
             aggA, aggB, aet, pens, winner };
  }

  function resolveCup(cup) {
    if (cup.winner) return;
    const myId = gameState.myClubId;
    const rnd = cup.currentRound || 0;

    // Get this round's fixtures
    const roundFixtures = cup.fixtures.filter(f => (f.roundIdx || 0) === rnd);
    if (!roundFixtures.length) return;

    // Sim all AI-vs-AI fixtures in this round
    roundFixtures.forEach(f => {
      if (f.played) return;
      if (f.home === myId || f.away === myId) return; // player plays manually
      const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
      if (!h || !a) { f.played = true; f.homeScore = 0; f.awayScore = 1; f.penWinner = f.away; return; }
      const ko = simKO(f.home, f.away);
      f.played = true; f.homeScore = ko.sa; f.awayScore = ko.sb;
      f.penWinner = ko.pens ? ko.winner : null;
    });

    // If player still has their match, stop here
    const playerF = roundFixtures.find(f => !f.played && (f.home === myId || f.away === myId));
    if (playerF) return;

    // All round fixtures played — advance
    advanceCupRound(cup, rnd);
  }

  function advanceCupRound(cup, rnd) {
    const myId = gameState.myClubId;
    const roundFixtures = cup.fixtures.filter(f => (f.roundIdx || 0) === rnd);

    // Compute round winners
    const winners = [];
    roundFixtures.forEach(f => {
      const w = f.penWinner || (f.homeScore > f.awayScore ? f.home : f.homeScore < f.awayScore ? f.away : null);
      if (w) winners.push(w);
      else if (!w && f.home && f.away) winners.push(Math.random() < 0.5 ? f.home : f.away); // shouldn't happen
    });

    // Odd team gets a bye
    if (roundFixtures.length % 2 !== winners.length % 2 && cup.remaining.length % 2 === 1)
      winners.push(cup.remaining[cup.remaining.length - 1]);

    if (winners.length <= 1) {
      cup.winner = winners[0];
      awardCupPrize(cup);
      return;
    }

    cup.remaining = winners;
    const nextRnd = rnd + 1;
    cup.currentRound = nextRnd;
    const stages = ['R1','R2','R3','QF','SF','Final'];
    cup.stage = stages[nextRnd] || 'Final';
    const nextDate = (cup.roundDates || [])[nextRnd] || new Date(gameState.currentDate.getTime() + 28*864e5);
    let cid = Math.max(0, ...cup.fixtures.map(f => f.id)) + 1;
    const shuffled = winners.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      cup.fixtures.push({ id: cid++, comp: cup.fixtures[0]?.comp || cup.id, compName: cup.name,
        home: shuffled[i], away: shuffled[i + 1],
        date: new Date(nextDate), played: false, homeScore: null, awayScore: null,
        type: 'cup', stage: cup.stage, roundIdx: nextRnd });
    }
    // Immediately sim new round (will stop if player is in it)
    resolveCup(cup);
  }

  function awardCupPrize(cup) {
    const myId = gameState.myClubId;
    const wasIn = cup.fixtures.some(f => f.home === myId || f.away === myId);
    if (!wasIn) return;
    const myRoundsWon = cup.fixtures.filter(f => (f.penWinner === myId) || (!f.penWinner && f.played && (f.home === myId ? f.homeScore > f.awayScore : f.awayScore > f.homeScore))).length;
    const fin = gameState.finances;
    if (fin) {
      const cupPrize = Math.round((myRoundsWon * 0.4 + (cup.winner === myId ? 2 : 0)) * 10) / 10;
      if (cupPrize > 0) {
        fin.balance = Math.round((fin.balance + cupPrize) * 100) / 100;
        fin.seasonIncome.prizes = Math.round((fin.seasonIncome.prizes + cupPrize) * 100) / 100;
        notify(`${cup.name} prize money: ${money(cupPrize)}`, 'success');
      }
    }
    if (cup.winner === myId) {
      gameState.myClub.rep = clampRep((gameState.myClub.rep ?? 1) + 0.3);
      notify(`You won the ${cup.name}! Club prestige has grown.`, 'success');
    } else {
      notify(`${cup.name}: knocked out.`, 'info');
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
    const rep = myClub.rep ?? 1;
    const repAdj = rep >= 4.5 ? -2 : rep >= 3.5 ? -1 : rep <= 1.5 ? 1 : 0;
    const rel = league.relegation || 0;
    const targetPos = Math.max(1, Math.min(n - rel, expectedPos + repAdj));
    const cl = league.championsLeague || 0;
    const el = league.europaLeague || 0;
    const conf = league.conferenceLeague || 0;
    const ap = league.autoPromotion || 0;
    const ps = league.playoffSpots || 0;
    const midpoint = Math.floor(n / 2);
    let type, label, targetPosMax;
    if (ap > 0) {
      if (targetPos <= ap)                                  { type = 'promotion'; label = 'Win automatic promotion';        targetPosMax = ap; }
      else if (ps > 0 && targetPos <= ap + ps)              { type = 'playoffs';  label = 'Reach the promotion playoffs';   targetPosMax = ap + ps; }
      else if (targetPos > n - rel || targetPos > midpoint) { type = 'survive';   label = 'Avoid relegation';              targetPosMax = n - rel; }
      else                                                  { type = 'midtable';  label = 'Finish in the top half';        targetPosMax = midpoint; }
    } else {
      if (targetPos === 1)                                  { type = 'title';   label = 'Win the league title';                       targetPosMax = 1; }
      else if (cl > 0 && targetPos <= cl)                   { type = 'cl';     label = `Champions League qualification (top ${cl})`; targetPosMax = cl; }
      else if (targetPos <= cl + el)                        { type = 'euro';   label = 'Europa League qualification';                 targetPosMax = cl + el; }
      else if (conf > 0 && targetPos <= cl + el + conf)     { type = 'conf';   label = 'European football';                          targetPosMax = cl + el + conf; }
      else if (targetPos > n - rel || targetPos > midpoint) { type = 'survive'; label = 'Avoid relegation';                          targetPosMax = n - rel; }
      else                                                  { type = 'midtable'; label = 'Top-half finish';                          targetPosMax = midpoint; }
    }
    gameState.boardObjective = { type, label, targetPosMax, n };
  }

  function evalBoardObjective(pos, myTransfer, league) {
    const obj = gameState.boardObjective;
    if (!obj) return { verdict: 'success', msg: '' };
    const fin  = gameState.finances;
    const conf = fin ? fin.boardConfidence : 50;
    const badConf = conf < 30;

    const relegated = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level > league.level);
    const promoted  = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level);

    // Helper: missed-objective outcome driven by board confidence
    function missedVerdict(closeMsg, farMsg) {
      if (badConf) return { verdict: 'sacked', msg: farMsg + ` Board confidence (${conf}/100) was too low to survive.` };
      return { verdict: 'budget_cut', msg: closeMsg };
    }

    if (obj.type === 'survive') {
      if (!relegated) return { verdict: 'success', msg: 'Objective met — survival secured.' };
      return missedVerdict(
        'Relegated, but the board retain some faith. Budget cut next season.',
        'Relegated and the board have run out of patience. You have been dismissed.'
      );
    }
    if (obj.type === 'promotion' || obj.type === 'playoffs') {
      if (promoted || pos <= obj.targetPosMax) return { verdict: 'success', msg: 'Promotion objective achieved!' };
      const gap = pos - obj.targetPosMax;
      return missedVerdict(
        `Just ${gap} place${gap===1?'':'s'} short of the promotion target. The board are disappointed — transfer budget cut by 30%.`,
        `Fell well short of promotion targets. You have been dismissed.`
      );
    }
    if (relegated) {
      return missedVerdict(
        'Relegated, but the board retain some faith. Budget cut next season.',
        'Relegated and the board have completely lost confidence. You have been dismissed.'
      );
    }
    if (pos <= obj.targetPosMax) return { verdict: 'success', msg: `Objective met — finished ${ordinal(pos)}.` };
    const gap = pos - obj.targetPosMax;
    return missedVerdict(
      `Missed the board's target by ${gap} place${gap===1?'':'s'}. Transfer budget cut by 25% for next season.`,
      `A season to forget. The board have lost all confidence (${conf}/100) and dismissed you.`
    );
  }

  /* =============================================
     SEASON END
     ============================================= */
  function endSeason() {
    // finish any remaining league fixtures
    gameState.fixtures.filter(f => !f.played).forEach(f => ENGINE.simBulkFixture(gameState, f));
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

    // Snapshot final standings for the preseason "last season" table view, before
    // tableStats reset (startNextSeason) and league reassignment (just below) land.
    Object.values(gameState.clubs).forEach(c => {
      c.lastSeasonStats  = { ...c.tableStats };
      c.lastSeasonLeague = c.league;
    });
    gameState.lastCompletedSeason = gameState.season;

    // Apply: change club.league
    transfers.forEach(({ clubId, to }) => {
      const c = gameState.clubs[clubId];
      if (c) c.league = to;
    });

    const topScorer = [...gameState.myClub.players].sort((a, b) => b.goals - a.goals)[0];
    const league = DATA.LEAGUES[myOldLeague];
    const myTransfer = transfers.find(t => t.clubId === gameState.myClubId);
    const myClub = gameState.myClub;

    // Club reputation changes based on season outcome. Prestige is meant to track a club's
    // standing/image over time, not spike on a single result — promotion alone (especially
    // via the playoffs) barely moves it; going up as champions or sustained top-flight
    // performance is what actually builds it.
    const promoted  = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level);
    const relegated = !!(myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level > league.level);
    if (relegated) {
      myClub.rep = clampRep((myClub.rep ?? 1) - 0.4); // relegated — image takes a real hit
    } else if (promoted && pos === 1) {
      myClub.rep = clampRep((myClub.rep ?? 1) + 0.2); // won the league outright and went up
    } else if (promoted) {
      myClub.rep = clampRep((myClub.rep ?? 1) + 0.1); // promoted, but that alone isn't much of a statement
    } else if (pos === 1) {
      myClub.rep = clampRep((myClub.rep ?? 1) + 0.4); // champions in the same division — real pedigree
    } else if (pos <= (league.championsLeague || 0) && Math.random() < 0.40) {
      myClub.rep = clampRep((myClub.rep ?? 1) + 0.2); // CL finish
    }
    // Prestige erosion from poor seasons
    if (!myTransfer) {
      const halfway = Math.ceil(table.length / 2);
      if (pos > halfway && Math.random() < 0.25) {
        myClub.rep = clampRep((myClub.rep ?? 1) - 0.2); // bottom half
      } else if ((myClub.rep ?? 1) >= 4 && pos > (league.championsLeague || 0) && Math.random() < 0.30) {
        myClub.rep = clampRep((myClub.rep ?? 1) - 0.25); // big club missing CL
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

    // Apply budget cut before continuing (but not if sacked)
    if (boardResult.verdict === 'budget_cut') {
      const cut = boardObj?.type === 'promotion' || boardObj?.type === 'playoffs' ? 0.30 : 0.25;
      if (gameState.finances) gameState.finances.balance = Math.round(gameState.finances.balance * (1 - cut) * 10) / 10;
      else myClub.budget = Math.round(myClub.budget * (1 - cut) * 10) / 10;
    }

    const sacked = boardResult.verdict === 'sacked';

    // Financial year-end: prize money, FFP, board confidence, next grant
    const euroComp   = gameState.myEuropeanComp;
    const { prize: finPrize, euroPrize } = finaliseSeasonFinances(pos, league, euroComp);
    const leagueSize = table.length || 20;
    updateBoardConfidence(boardResult.verdict, pos, leagueSize);
    const goodSeason = pos <= Math.ceil(leagueSize / 3);
    const fin = gameState.finances;
    const nextGrant   = (!sacked && fin) ? calcBoardGrant(myClub, fin, pos, leagueSize) : 0;
    const nextSponsor = (!sacked && fin && fin.sponsorNeedsRenewal) ? genSponsorOffers(myClub, fin.boardConfidence, goodSeason)[1] : null;
    if (fin) {
      fin.pendingGrant   = nextGrant;
      fin.lastSeasonGood = goodSeason;
      // Sponsor promotion clause
      if (myTransfer?.to && DATA.LEAGUES[myTransfer.to]?.level < league.level) {
        paySponsorClause('promotion', 'for winning promotion');
      }
      // Parachute payments: only if relegated from Premier League
      if (myOldLeague === 'premier_league' && myTransfer?.to === 'championship') {
        fin.parachuteYears = 2;
      }
      // Stop parachute if promoted back or left Championship
      if ((fin.parachuteYears || 0) > 0 && myOldLeague !== 'championship') {
        fin.parachuteYears = 0;
      }
    }
    recordFinancialHistory(gameState.season, pos, nextGrant);

    const leagueTransfers = transfers.map(t => {
      const fromLg = DATA.LEAGUES[t.from], toLg = DATA.LEAGUES[t.to];
      return {
        name: gameState.clubs[t.clubId]?.name || '?',
        to: t.to, fromName: fromLg?.name, toName: toLg?.name,
        promoted: toLg.level < fromLg.level,
      };
    });

    ui.seasonReview = {
      pos, outcome, topScorer, league, champ, poLines,
      boardResult, boardObj, boardObjLabel,
      ts: { ...gameState.myClub.tableStats },
      sacked, leagueTransfers,
      finSummary: fin ? {
        prize: finPrize, euroPrize,
        balance:        fin.balance,
        totalIncome:    totalSeasonIncome(fin),
        totalExpenses:  totalSeasonExpenses(fin),
        boardConfidence:fin.boardConfidence,
        nextGrant, nextSponsor,
        ffp: ffpStatus(fin),
      } : null,
    };

    showScreen('game');
    updateSidebar();
    renderView('dashboard');
  }

  function renderSeasonReview(m) {
    const review = ui.seasonReview;
    if (!review) { renderDashboard(m); return; }
    const { pos, outcome, topScorer, league, champ, poLines, boardResult, boardObj, boardObjLabel, ts, sacked } = review;
    const club = gameState.myClub;

    const topAssist = [...club.players].sort((a, b) => b.assists - a.assists)[0];
    const mostApps  = [...club.players].sort((a, b) => b.appearances - a.appearances)[0];
    const bestRated = [...club.players]
      .filter(p => (p.ratingCount || 0) >= 3)
      .sort((a, b) => (b.seasonRating / b.ratingCount) - (a.seasonRating / a.ratingCount))[0];
    const spentIn   = gameState.transferLog.filter(t => t.in  && !t._old).reduce((s, t) => s + (t.fee || 0), 0);
    const earnedOut = gameState.transferLog.filter(t => !t.in && !t._old).reduce((s, t) => s + (t.fee || 0), 0);

    const sackedBanner = sacked ? `
      <div class="sacked-banner">
        <span class="sacked-banner-icon">✗</span>
        <div><div class="sacked-banner-title">Sacked</div><div class="sacked-banner-msg">${esc(boardResult.msg)}</div></div>
      </div>` : '';

    const boardHtml = boardObj ? `
      <div class="board-verdict-box ${boardResult.verdict}" style="margin-bottom:0">
        <div class="bv-label">Board Objective</div>
        <div class="bv-target">${esc(boardObjLabel)}</div>
        ${boardResult.msg && !sacked ? `<div class="bv-msg">${boardResult.msg}</div>` : ''}
      </div>` : '';

    const outcomeColor = sacked ? 'var(--accent-red)' : outcome.includes('Champion') || outcome.includes('Promot') ? 'var(--accent)' : outcome.includes('Relegate') ? 'var(--accent-red)' : 'var(--accent-gold)';

    const tab = ui.seasonReviewTab || 'overview';

    const overviewBody = `
      <div class="season-review-hero">
        <div class="srh-pos">${ordinal(pos)}</div>
        <div class="srh-outcome" style="color:${outcomeColor}">${outcome}</div>
        <div class="srh-record">${ts.played} played · ${ts.won}W ${ts.drawn}D ${ts.lost}L · ${ts.gf} scored · ${ts.ga} conceded</div>
      </div>
      <div class="dashboard-grid">
        <div class="card"><div class="card-title">Points</div><div class="stat-big">${ts.points}</div><div class="stat-label">Goal diff: ${ts.gf - ts.ga >= 0 ? '+' : ''}${ts.gf - ts.ga}</div></div>
        <div class="card"><div class="card-title">League Champions</div><div class="stat-big" style="font-size:22px">${esc(champ.name)}</div><div class="stat-label">${league.name}</div></div>
        <div class="card"><div class="card-title">Top Scorer</div>
          <div class="stat-big" style="font-size:22px">${topScorer && topScorer.goals > 0 ? esc(topScorer.lastName) : '—'}</div>
          <div class="stat-label">${topScorer && topScorer.goals > 0 ? topScorer.goals + ' goals · ' + topScorer.assists + ' assists' : 'No goals scored'}</div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="card"><div class="card-title">Most Appearances</div>
          <div class="stat-big" style="font-size:22px">${mostApps ? esc(mostApps.lastName) : '—'}</div>
          <div class="stat-label">${mostApps ? mostApps.appearances + ' apps' : ''}</div>
        </div>
        <div class="card"><div class="card-title">Top Assists</div>
          <div class="stat-big" style="font-size:22px">${topAssist && topAssist.assists > 0 ? esc(topAssist.lastName) : '—'}</div>
          <div class="stat-label">${topAssist && topAssist.assists > 0 ? topAssist.assists + ' assists' : 'No assists'}</div>
        </div>
        <div class="card"><div class="card-title">Best Rated</div>
          <div class="stat-big" style="font-size:22px">${bestRated ? esc(bestRated.lastName) : '—'}</div>
          <div class="stat-label">${bestRated ? (bestRated.seasonRating / bestRated.ratingCount).toFixed(1) + ' avg rating' : 'Not enough data'}</div>
        </div>
      </div>
      <div class="dashboard-grid-2">
        <div class="card">
          <div class="card-title">Transfer Activity</div>
          <div class="pm-stats-grid">
            <div class="pm-stat"><span class="pm-stat-name">Spent</span><span class="pm-stat-val red">${money(spentIn)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Earned</span><span class="pm-stat-val text-accent">${money(earnedOut)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Net</span><span class="pm-stat-val" style="color:${earnedOut - spentIn >= 0 ? 'var(--accent)' : 'var(--accent-red)'}">${money(earnedOut - spentIn)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Club Balance</span><span class="pm-stat-val text-gold">${money(gameState.finances?.balance ?? club.budget)}</span></div>
          </div>
        </div>
        <div class="card">
          ${boardHtml || `<div class="card-title">Season Complete</div><div class="stat-label" style="margin-top:8px">No board objective set.</div>`}
          ${poLines ? `<div style="margin-top:12px;font-size:12px;color:#86efac;line-height:1.9">${poLines}</div>` : ''}
        </div>
      </div>
      ${review.finSummary ? (() => {
        const fs = review.finSummary;
        const netProfit = fs.totalIncome - fs.totalExpenses;
        const balColor  = fs.balance >= 0 ? 'var(--accent)' : 'var(--accent-red)';
        const netColor  = netProfit >= 0  ? 'var(--accent)' : 'var(--accent-red)';
        const hap = fs.boardConfidence;
        const hapColor = hap >= 70 ? 'var(--accent)' : hap >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)';
        const tierLabels = ['','Regional','National','Global'];
        return `
        <div class="card">
          <div class="card-title">Financial Report</div>
          <div class="pm-stats-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="pm-stat"><span class="pm-stat-name">Season Income</span><span class="pm-stat-val text-accent">${money(fs.totalIncome)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Season Costs</span><span class="pm-stat-val red">${money(fs.totalExpenses)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Season Net</span><span class="pm-stat-val" style="color:${netColor}">${netProfit>=0?'+':''}${money(netProfit)}</span></div>
            <div class="pm-stat"><span class="pm-stat-name">Prize Money</span><span class="pm-stat-val text-gold">${money(fs.prize)}</span></div>
            ${fs.euroPrize > 0 ? `<div class="pm-stat"><span class="pm-stat-name">European Prize</span><span class="pm-stat-val text-gold">${money(fs.euroPrize)}</span></div>` : ''}
            <div class="pm-stat"><span class="pm-stat-name">Club Balance</span><span class="pm-stat-val" style="color:${balColor}">${money(fs.balance)}</span></div>
          </div>
          ${!sacked ? `
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Next Season Allocation</div>
            <div class="pm-stats-grid" style="grid-template-columns:repeat(2,1fr)">
              <div class="pm-stat">
                <span class="pm-stat-name">Board Grant</span>
                <span class="pm-stat-val" style="color:${fs.nextGrant >= 20 ? 'var(--accent)' : fs.nextGrant >= 8 ? 'var(--accent-gold)' : 'var(--accent-red)'}">${money(fs.nextGrant)}</span>
              </div>
              <div class="pm-stat">
                <span class="pm-stat-name">Board Confidence</span>
                <span class="pm-stat-val" style="color:${hapColor}">${hap}/100</span>
              </div>
              ${fs.nextSponsor ? `<div class="pm-stat" style="grid-column:span 2">
                <span class="pm-stat-name">New Sponsor Offer</span>
                <span class="pm-stat-val">${esc(fs.nextSponsor.name)} · ${tierLabels[fs.nextSponsor.tier]} · ${money(fs.nextSponsor.weeklyValue)}/wk</span>
              </div>` : ''}
            </div>
          </div>` : ''}
        </div>`;
      })() : ''}`;

    const transfersBody = (() => {
      const groups = {};
      (review.leagueTransfers || []).forEach(t => {
        if (!groups[t.to]) groups[t.to] = { promoted: [], relegated: [] };
        groups[t.to][t.promoted ? 'promoted' : 'relegated'].push(t);
      });
      const order = ['premier_league', 'championship', 'league_one', 'league_two', 'national_league'];
      const rows = arr => arr.map(t => `
        <div class="pr-team-row"><span>${esc(t.name)}</span><span class="text-muted" style="font-size:11px">from ${esc(t.fromName)}</span></div>`).join('');
      const sections = order.filter(lid => groups[lid]).map(lid => {
        const g = groups[lid];
        return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-title">${esc(DATA.LEAGUES[lid].name)}</div>
          ${g.promoted.length ? `<div style="margin-top:8px"><div class="stat-label" style="color:var(--accent);margin-bottom:4px">↑ Promoted (${g.promoted.length})</div>${rows(g.promoted)}</div>` : ''}
          ${g.relegated.length ? `<div style="margin-top:8px"><div class="stat-label" style="color:var(--accent-red);margin-bottom:4px">↓ Relegated (${g.relegated.length})</div>${rows(g.relegated)}</div>` : ''}
        </div>`;
      });
      return sections.join('') || `<div class="empty-state"><div class="empty-state-text">No promotion or relegation data available.</div></div>`;
    })();

    m.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Season ${gameState.season} Review</div>
          <div class="view-subtitle">${esc(club.name)} · ${league.name}</div>
        </div>
      </div>
      ${sackedBanner}
      <div class="scout-tab-row">
        <button class="scout-tab-btn ${tab === 'overview' ? 'active' : ''}" data-rt="overview">Season Overview</button>
        <button class="scout-tab-btn ${tab === 'transfers' ? 'active' : ''}" data-rt="transfers">Promoted &amp; Relegated</button>
      </div>
      ${tab === 'overview' ? overviewBody : transfersBody}
      <div class="review-actions">
        ${sacked
          ? `<button class="btn-secondary btn-lg" id="sr-browse">Browse Club ›</button>
             <button class="btn-gold btn-lg" id="sr-menu">Return to Menu</button>`
          : `<button class="btn-primary btn-lg" id="sr-next">Start Season ${gameState.season + 1} →</button>`
        }
      </div>`;

    m.querySelectorAll('.scout-tab-btn[data-rt]').forEach(b => b.addEventListener('click', () => {
      ui.seasonReviewTab = b.dataset.rt;
      renderSeasonReview(m);
    }));

    if (sacked) {
      m.querySelector('#sr-browse').addEventListener('click', () => {
        gameState.sacked = true;
        ui.seasonReview = null;
        ui.seasonReviewTab = null;
        renderView('dashboard');
      });
      m.querySelector('#sr-menu').addEventListener('click', () => {
        setAutoSaveRunning(false);
        gameState = null;
        ui.seasonReview = null;
        ui.seasonReviewTab = null;
        showScreen('start');
      });
    } else {
      m.querySelector('#sr-next').addEventListener('click', () => {
        ui.seasonReview = null;
        ui.seasonReviewTab = null;
        startNextSeason();
      });
    }
  }

  function startNextSeason() {
    gameState.season++;
    gameState.wageViolations = 0;  // reset each season
    gameState.transferBans = {};   // reset rejected players each season
    Object.values(gameState.clubs).forEach(club => {
      club.players.forEach(p => {
        p.age++;
        // Growth toward potential now happens week-to-week during the season
        // (tickPlayerDevelopment) — season-end only ages players down.
        if (p.age >= 33) p.ovr = Math.max(45, p.ovr - rand(1, 3));
        else if (p.age >= 31) p.ovr = Math.max(45, p.ovr - rand(0, 2));
        p.value = DATA.calcValue(p.ovr, p.age, club.league, p.pot);
        // Contracts now carry an absolute end date (tickContractExpiries handles
        // actually releasing players once it passes) — nothing to decrement here.
        p.clubCareerGoals   = (p.clubCareerGoals   || 0) + (p.goals       || 0);
        p.clubCareerAssists = (p.clubCareerAssists || 0) + (p.assists     || 0);
        p.clubCareerApps    = (p.clubCareerApps    || 0) + (p.appearances || 0);
        p.goals = p.assists = p.appearances = p.yellowCards = p.redCards = 0;
        p.seasonRating = 0; p.ratingCount = 0;
        p.listingPrice = null;
        p.inboxedThisSeason = false;
        p.benchWeeks = 0;
        // Full pre-season recovery — injuries clear, fitness restored
        if (!p.injured) p.fitness = 100;
        else if ((p.injuryWeeks || 0) <= 0) { p.injured = false; p.injuryType = null; p.fitness = 80; }
      });
      if (club.id !== gameState.myClubId) club.lineup = autoPickXI(club, club.tactics?.formation || '4-3-3');
      recalcSqRating(club);
      club.tableStats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      club.europeanStats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      club.form = []; club.results = [];
    });

    // Enter pre-season: start in July for the summer transfer window
    const seasonYear = 2025 + gameState.season - 1;
    gameState.currentDate = new Date(seasonYear, 6, 1); // July 1
    gameState.preseason = true;
    gameState.pendingOffers = [];
    gameState.fixtures = [];
    gameState.market = ENGINE.getTransferMarket(gameState);
    gameState.freeAgents = DATA.generateFreeAgents(14);
    activatePreContracts();
    ui.tableLeague = gameState.myClub.league;

    // Apply financial new-season reset
    const fin = gameState.finances;
    if (fin) {
      // Apply board grant as next season's transfer budget
      if (fin.pendingGrant !== undefined && fin.pendingGrant !== null) {
        fin.balance = Math.round((fin.balance + fin.pendingGrant) * 100) / 100;
        notify(`Board grant for Season ${gameState.season}: ${money(fin.pendingGrant)} added to club balance.`, 'success');
        delete fin.pendingGrant;
      }
      // Legacy saves: clear any auto-pending sponsor; renewals are now negotiated by the manager
      delete fin.pendingSponsor;
      // Offer renewal negotiations for any deals that expired during the previous season
      if (fin.sponsorNeedsRenewal) {
        setTimeout(() => showSponsorRenewalModal(), 400);
      }
      if (fin.kitNeedsRenewal) {
        setTimeout(() => showKitRenewalModal(), fin.sponsorNeedsRenewal ? 900 : 400);
      }
      // Reset season income/expense counters
      fin.seasonIncome   = { tv:0, matchday:0, sponsorship:0, merchandise:0, prizes:0, sales:0 };
      fin.seasonExpenses = { wages:0, transfers:0, agentFees:0, staff:0 };
      fin.weeksElapsed   = 0;
      fin.overWageCapWeeks = 0;
      fin.boardFundsRequested = false;
      fin.boardConfVoted = false;
      // Parachute payment (Premier League relegated clubs in Championship only)
      if ((fin.parachuteYears || 0) > 0 && gameState.myClub.league === 'championship') {
        const parachute = fin.parachuteYears >= 2 ? 45 : 27;
        fin.balance = Math.round((fin.balance + parachute) * 10) / 10;
        fin.parachuteYears--;
        notify(`Parachute payment: ${money(parachute)} received (${fin.parachuteYears} season${fin.parachuteYears !== 1 ? 's' : ''} remaining).`, 'success');
      }
    }

    generatePlayerEvents();
    notify(`Pre-season begins — Season ${gameState.season} transfer window is open!`, 'success');
    updateSidebar();
    renderView('dashboard');
    autoSave();
  }

  function advanceToNextMatch() {
    const next = ENGINE.getNextFixture(gameState);
    if (!next || next.date.getTime() <= gameState.currentDate.getTime()) return;
    gameState.currentDate = new Date(next.date);
    recordBalanceSnapshot();
    resolveNegotiationResponses();
    updateSidebar();
    renderView(ui.view);
    autoSave();
  }

  function advancePreseasonWeek() {
    gameState.currentDate = new Date(gameState.currentDate.getTime() + 7 * 86400000);
    tickFinances(1, false); // no league gameweek during preseason — no TV money
    tickInjuries();
    tickContractExpiries();
    tickPlayerDevelopment(1);
    tickYouthIntake();
    tickGameTimeMorale();
    tickAIClubs();
    tickAITransfers();
    if (gameState.tactics?.lineup) {
      const aliveIds = new Set(gameState.myClub.players.map(p => p.id));
      gameState.tactics.lineup = gameState.tactics.lineup.filter(id => aliveIds.has(id));
      if (gameState.tactics.lineup.length < 11) gameState.tactics.lineup = autoPickXI(gameState.myClub, activeTacticForm());
    }
    resolveNegotiationResponses();
    rollBiddingWars();
    checkIncomingOffers();
    checkWageBudget();
    // Prompt sponsor renewal if needed during preseason
    if (gameState.finances?.sponsorNeedsRenewal) showSponsorRenewalModal();
    updateSidebar();
    renderView('dashboard');
    autoSave();
  }

  // Step the calendar forward a single day without running the full weekly tick
  // bundle (finances/injuries/development/AI clubs/AI transfers stay on their
  // existing weekly cadence) — just resolves anything whose negotiation response
  // has come due, so checking on a deal doesn't require playing a match or
  // waiting a whole week.
  function advanceOneDay() {
    const next = ENGINE.getNextFixture(gameState);
    if (next && gameState.currentDate.getTime() + DAY_MS > next.date.getTime()) {
      return notify("Can't skip past your next fixture — play the match first.", 'warning');
    }
    gameState.currentDate = addDays(gameState.currentDate, 1);
    if (gameState.preseason) tickFinances(1 / 7, false);
    recordBalanceSnapshot();
    resolveNegotiationResponses();
    updateSidebar();
    renderView(ui.view);
    autoSave();
  }

  function beginSeasonFromPreseason() {
    doAcademyIntake();
    gameState.preseason = false;
    const seasonYear = 2025 + gameState.season - 1;
    gameState.currentDate = new Date(seasonYear, 7, 9);
    ENGINE.setupEuropean(gameState);
    ENGINE.setupCups(gameState);
    const koDate = new Date(seasonYear + 1, 1, 17);   // European knockout resolves after this
    Object.values(gameState.european).forEach(comp => comp.koDate = koDate);
    gameState.fixtures = ENGINE.generateSchedule(gameState);
    setBoardObjective(gameState);
    gameState.tactics.lineup = autoPickXI(gameState.myClub, activeTacticForm());
    ui.euroTab = gameState.myEuropeanComp || 'champions_league';
    notify(`Season ${gameState.season} has begun!`, 'success');
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
  // Contracts now always end on a window boundary (31 Jan / 30 Jun) — show the
  // month so it's clear which window a deal actually lapses in, not just the year.
  function fmtContractEnd(d) {
    if (!d) return 'Free Agent';
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }
  function monthsUntil(target, from) {
    if (!target) return Infinity;
    return (target - from) / (30.44 * DAY_MS);
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
    const result = { homeScore: ms.result.homeScore, awayScore: ms.result.awayScore, events: ms.result.matchEvents || [], stats: ms.result.stats || { possession:[50,50], shots:[0,0], shotsOnTarget:[0,0] }, homeRatings: ms.result.homeRatings || [], awayRatings: ms.result.awayRatings || [], commentary: ms.result.commentary || [] };
    let fixture = gameState.fixtures.find(f => !f.played && f.home === ms.homeId && f.away === ms.awayId);
    if (!fixture && gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (fixture) return;
        fixture = (comp.fixtures || []).find(f => !f.played && f.home === ms.homeId && f.away === ms.awayId);
      });
    }
    if (!fixture && gameState.cups) {
      Object.values(gameState.cups).forEach(cup => {
        if (fixture) return;
        fixture = (cup.fixtures || []).find(f => !f.played && f.home === ms.homeId && f.away === ms.awayId);
      });
    }
    fixture = fixture || { home: ms.homeId, away: ms.awayId, played: false, type: ms.fixtureType || 'league' };
    ui.match = {
      fixture, home, away, myIsHome: ms.myIsHome, result,
      homeFormation: ms.homeFormation, awayFormation: ms.awayFormation,
      homeXI: ms.homeXI, awayXI: ms.awayXI,
      currentHomeXI: ms.currentHomeXI || ms.homeXI,
      currentAwayXI: ms.currentAwayXI || ms.awayXI,
      currentTactics: ms.currentTactics || { ...gameState.tactics },
      subsUsed: ms.subsUsed || 0, subsMax: ms.subsMax || 5,
      // Defaults backfill saves from before stoppage time/man-down existed.
      sim: { stoppage1: 0, stoppage2: 0, matchEnd: 90, homeManDown: false, awayManDown: false, ...ms.sim },
      simTimer: null, speed: 1, gamePhase: ms.gamePhase || 1,
    };
    showScreen('match');
    $('match-home-name').textContent = home.name;
    $('match-away-name').textContent = away.name;
    setBadge('match-home-badge', home);
    setBadge('match-away-badge', away);
    $('match-score').textContent = `${ms.sim.hs} – ${ms.sim.as}`;
    $('match-time').textContent = formatMatchMinute(ms.sim.min, ui.match.sim.stoppage1, ui.match.sim.et);
    $('match-status').textContent = ms.atHalfTime ? 'HALF TIME' : 'PAUSED';
    $('match-events-list').innerHTML = '';
    $('pitch-events').innerHTML = '';
    const ev = result.events;
    for (let i = 0; i < ms.sim.idx && i < ev.length; i++) { if (['goal','yellow','red','sub','penalty_awarded'].includes(ev[i].type)) addMatchEvent(ev[i]); addPitchDot(ev[i]); }
    result.commentary.forEach(c => {
      const d = document.createElement('div');
      d.className = 'match-event commentary' + (c.cls ? ' ' + c.cls : '');
      d.innerHTML = `<span class="event-min">${formatMatchMinute(c.min, ui.match.sim.stoppage1, ui.match.sim.et)}</span><span class="event-desc">${c.text}</span>`;
      $('match-events-list').appendChild(d);
    });
    $('btn-simulate').classList.add('hidden');
    $('btn-pause').classList.add('hidden');
    $('btn-speed').classList.add('hidden');
    $('btn-subs').classList.add('hidden');
    $('btn-tactics').classList.add('hidden');
    $('match-result-overlay').classList.add('hidden');
    $('halftime-panel').classList.add('hidden');
    $('match-events-inner').classList.remove('hidden');
    if (ui.match.sim.min >= ui.match.sim.matchEnd) {
      finishMatch();
    } else if (ms.atHalfTime) {
      $('btn-halftime').classList.remove('hidden');
      showHalftimePanel();
    } else {
      $('btn-halftime').classList.add('hidden');
      $('btn-simulate').innerHTML = '<svg class="btn-icon" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg> Resume';
      $('btn-simulate').classList.remove('hidden');
    }
    updateSidebar();
    return true;
  }

  function showSlotPicker() {
    const idx = readIndex();
    const slots = [1,2,3,4,5];
    const allFull = slots.every(n => !!idx[`career_${n}`]);

    if (allFull) {
      showModal(`<div class="sv-modal" style="text-align:center">
        <h2 style="margin-bottom:10px">All Save Slots Full</h2>
        <p class="text-muted" style="font-size:13px;margin-bottom:18px">Delete a save from <strong>Load Save</strong> to free up a slot.</p>
        <button class="btn-secondary" id="ssp-close">OK</button>
      </div>`);
      $('ssp-close').addEventListener('click', closeModal);
      return;
    }

    let html = `<div class="sv-modal">
      <div class="sv-modal-hdr">
        <h2>Choose a Save Slot</h2>
        <span class="sv-used-count">${slots.filter(n => !!idx[`career_${n}`]).length} / 5 slots used</span>
      </div>`;

    slots.forEach(n => {
      const id = `career_${n}`;
      const s = idx[id];
      if (s) {
        const posStr = s.pos ? ordinal(s.pos) + ' · ' : '';
        html += `<div class="sv-card sv-occ sv-pick-card" data-slot="${id}">
          <div class="sv-slot-num">${n}</div>
          ${saveBadgeHtml(s)}
          <div class="sv-info">
            <div class="sv-club-name">${esc(s.clubName)}</div>
            <div class="sv-meta">${esc(s.leagueName || '')} · Season ${s.season}</div>
            <div class="sv-meta">${posStr}${esc(s.gameDate || '')}</div>
            <div class="sv-saved-at">Saved ${fmtSavedAt(s.savedAt)}</div>
          </div>
          <div class="sv-actions">
            <span class="sv-overwrite-tag">Overwrite</span>
          </div>
        </div>`;
      } else {
        html += `<div class="sv-card sv-empty sv-pick-card sv-save-here" data-slot="${id}">
          <div class="sv-slot-num">${n}</div>
          <div class="sv-info">
            <span class="sv-club-name sv-empty-label">Empty Slot</span>
            <span class="sv-meta">Start a new career here</span>
          </div>
        </div>`;
      }
    });

    html += `</div>`;
    showModal(html);

    document.querySelectorAll('.sv-pick-card').forEach(card => {
      card.addEventListener('click', () => {
        const slotId = card.dataset.slot;
        const s = idx[slotId];
        if (s && !confirm(`Overwrite ${s.clubName} (Season ${s.season})?`)) return;
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

  // Resolve badge URL for a save-metadata object. Falls back to a name scan
  // so saves created before clubId was stored still get their crest.
  function saveCrestUrl(s) {
    const id = s.clubId || (DATA.CLUBS_DATA.find(c => c.name === s.clubName) || {}).id;
    return id && DATA.CLUB_BADGES && DATA.CLUB_BADGES[id] ? { id, url: DATA.CLUB_BADGES[id] } : null;
  }
  function saveBadgeHtml(s) {
    const col      = s.clubColor ? hex(s.clubColor) : '#1a2035';
    const txt      = s.clubColor ? textOn(s.clubColor) : '#8090a8';
    const initials = (s.clubShort || s.clubName || '?').slice(0, 2).toUpperCase();
    const crest    = saveCrestUrl(s);
    if (crest) {
      const scale  = (DATA.CLUB_BADGE_SCALE && DATA.CLUB_BADGE_SCALE[crest.id]) || 1;
      const filter = (DATA.CLUB_BADGE_FILTER && DATA.CLUB_BADGE_FILTER[crest.id]) || '';
      const styles = [scale !== 1 ? `transform:scale(${scale})` : '', filter ? `filter:${filter}` : ''].filter(Boolean).join(';');
      const styleAttr = styles ? ` style="${styles}"` : '';
      return `<div class="sv-badge crest"><img class="crest-img"${styleAttr} src="${crest.url}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('crest');this.parentNode.style.background='${col}';this.parentNode.style.color='${txt}';this.replaceWith(document.createTextNode('${esc(initials)}'))"></div>`;
    }
    return `<div class="sv-badge" style="background:${col};color:${txt}">${esc(initials)}</div>`;
  }

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
    const c = gameState.myClub;
    return {
      label,
      clubId: c.id,
      clubName: c.name,
      clubShort: c.name,
      clubColor: c.color,
      leagueName: DATA.LEAGUES[c.league].name,
      season: gameState.season,
      gameDate: MONTHS_SHORT[gameState.currentDate.getMonth()] + ' ' + gameState.currentDate.getFullYear(),
      pos: ENGINE.getMyPosition(gameState),
      savedAt: Date.now(),
    };
  }
  function writeSave(slotId, label) {
    if (writeSavePending) return true; // skip if write already queued
    writeSavePending = true;
    const doWrite = () => {
      writeSavePending = false;
      try {
        const json = JSON.stringify(gameState, saveReplacer);
        const payload = LZString.compressToUTF16(json);
        localStorage.setItem(SLOT_PREFIX + slotId, payload);
        const idx = readIndex(); idx[slotId] = saveMeta(label); writeIndex(idx);
      } catch (e) {
        notify('Save failed — storage is full. Delete an old save and retry.', 'error');
      }
    };
    (window.requestIdleCallback || (f => setTimeout(f, 0)))(doWrite, { timeout: 5000 });
    return true;
  }
  function autoSave() {
    if (!gameState) return;
    updateMatchSave();
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
    if (!state.transferNews) state.transferNews = [];
    if (!state.negotiations) {
      // Pre-overhaul saves only had instantly-resolvable pendingOffers — wrap any still
      // outstanding into the new model so they don't just vanish, ready for the user
      // to act on immediately (no retroactive delay).
      state.negotiations = (state.pendingOffers || []).map(o => ({
        ...o, type: 'incoming', stage: 'fee', awaiting: 'user', responseDue: null,
        lastTouch: state.currentDate, rival: null, msgLog: [],
      }));
    }
    Object.values(state.clubs).forEach(c => {   // migrate saves from before AI tactics/lineup existed
      if (!c.tactics) c.tactics = DATA.seedClubTactics(c);
      if (!c.lineup) c.lineup = [];
      // migrate saves from before contracts were a window-aligned end date (used to be
      // a plain "years left" integer) — rebuild a sensible end date from that count.
      c.players.forEach(p => {
        if (!p.contractEnd) p.contractEnd = DATA.contractEndAfterYears(state.currentDate, p.contract || 2);
      });
    });
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
  function defaultLabel() { return gameState.myClub.name + ' · S' + gameState.season; }

  const MAX_SLOTS = 5;   // manual save slots (the 'auto' slot is separate)

  function openSaves(mode) {
    const idx = readIndex();


    function cardHtml(slotNum, s) {
      const id = `career_${slotNum}`;
      if (!s) {
        // empty slot
        if (mode === 'load') {
          return `<div class="sv-card sv-empty">
            <div class="sv-slot-num">${slotNum}</div>
            <div class="sv-info"><span class="sv-club-name sv-empty-label">Empty Slot</span></div>
          </div>`;
        }
        return `<div class="sv-card sv-empty sv-save-here" data-slot="${id}">
          <div class="sv-slot-num">${slotNum}</div>
          <div class="sv-info">
            <span class="sv-club-name sv-empty-label">Empty Slot</span>
            <span class="sv-meta">Click to save here</span>
          </div>
          <div class="sv-actions"><button class="btn-secondary sv-btn" tabindex="-1">Save Here</button></div>
        </div>`;
      }
      const posStr = s.pos ? ordinal(s.pos) + ' · ' : '';
      const isAutoLabel = s.label === 'Autosave';
      return `<div class="sv-card sv-occ">
        <div class="sv-slot-num">${slotNum}</div>
        ${saveBadgeHtml(s)}
        <div class="sv-info">
          <div class="sv-club-name">${esc(s.clubName)}${isAutoLabel ? '<span class="sv-autosave-tag">AUTOSAVE</span>' : ''}</div>
          <div class="sv-meta">${esc(s.leagueName)} · Season ${s.season}</div>
          <div class="sv-meta">${posStr}${esc(s.gameDate)}</div>
          <div class="sv-saved-at">Saved ${fmtSavedAt(s.savedAt)}</div>
        </div>
        <div class="sv-actions">
          ${mode === 'save'
            ? `<button class="btn-gold sv-btn" data-act="save" data-slot="${id}">Overwrite</button>`
            : `<button class="btn-primary sv-btn" data-act="load" data-slot="${id}">Load</button>`}
          <button class="btn-danger sv-btn" data-act="delete" data-slot="${id}">Delete</button>
        </div>
      </div>`;
    }

    const usedCount = Object.keys(idx).filter(k => k.startsWith('career_')).length;
    let html = `<div class="sv-modal">
      <div class="sv-modal-hdr">
        <h2>${mode === 'save' ? 'Save Game' : 'Load Game'}</h2>
        <span class="sv-used-count">${usedCount} / ${MAX_SLOTS} slots used</span>
      </div>`;
    for (let n = 1; n <= MAX_SLOTS; n++) {
      const s = idx[`career_${n}`] ? { id: `career_${n}`, ...idx[`career_${n}`] } : null;
      html += cardHtml(n, s);
    }
    html += `</div>`;
    showModal(html);

    document.querySelectorAll('#modal-content .sv-save-here').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.slot;
        if (writeSave(id, defaultLabel())) { notify('Game saved.', 'success'); openSaves('save'); }
      });
    });
    document.querySelectorAll('#modal-content [data-act]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.slot, act = b.dataset.act;
      if (act === 'delete') {
        if (!confirm('Delete this save?')) return;
        deleteSave(id); openSaves(mode);
      } else if (act === 'save') {
        if (!confirm('Overwrite this save?')) return;
        if (writeSave(id, defaultLabel())) { notify('Game saved.', 'success'); openSaves('save'); }
      } else if (act === 'load') {
        loadSave(id); closeModal();
      }
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
