/* ENGINE.JS — Match simulation, schedule, European, cups */

const ENGINE = (() => {

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function poisson(lambda) {
    const l = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > l);
    return k - 1;
  }

  /* ---- ROUND-ROBIN SCHEDULE ---- */
  function roundRobin(clubs) {
    const teams = [...clubs];
    if (teams.length % 2 !== 0) teams.push({ id: '__bye__' });
    const rounds = [];
    for (let r = 0; r < teams.length - 1; r++) {
      const round = [];
      for (let i = 0; i < teams.length / 2; i++) {
        const h = teams[i], a = teams[teams.length - 1 - i];
        if (h.id !== '__bye__' && a.id !== '__bye__') round.push({ home: h.id, away: a.id });
      }
      rounds.push(round);
      teams.splice(1, 0, teams.pop());
    }
    return rounds;
  }

  function generateSchedule(gameState) {
    const fixtures = []; let fid = 0;
    const seasonStart = new Date(2025, 7, 9);

    Object.keys(DATA.LEAGUES).forEach(lid => {
      const clubs = Object.values(gameState.clubs).filter(c => c.league === lid);
      if (clubs.length < 4) return;
      const home = roundRobin(clubs);
      const away = home.map(r => r.map(m => ({ home: m.away, away: m.home })));
      [...home, ...away].forEach((round, ri) => {
        const d = new Date(seasonStart);
        d.setDate(d.getDate() + ri * 7);
        round.forEach(m => {
          fixtures.push({ id: fid++, leagueId: lid, home: m.home, away: m.away,
            date: new Date(d), played: false, homeScore: null, awayScore: null,
            events: [], type: 'league' });
        });
      });
    });

    return fixtures.sort((a, b) => a.date - b.date);
  }

  /* ---- MATCH SIMULATION ---- */
  function effectiveRating(club) { return club.sqRating || 70; }

  function pickScorer(club, xi) {
    const pool = xi
      ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
      : club.players;
    const w = pool.map(p => {
      if (['ST','CF'].includes(p.pos)) return 12;
      if (['RW','LW','CAM'].includes(p.pos)) return 7;
      if (['CM','RM','LM'].includes(p.pos)) return 3;
      if (['CDM'].includes(p.pos)) return 1;
      if (['CB','RB','LB'].includes(p.pos)) return 0.5;
      return 0.1;
    });
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function pickAssist(club, scorer, xi) {
    const pool = (xi
      ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
      : club.players).filter(p => p.id !== scorer.id);
    if (!pool.length) return null;
    const w = pool.map(p => {
      if (['CAM','CM'].includes(p.pos)) return 9;
      if (['RW','LW','RM','LM'].includes(p.pos)) return 7;
      if (['CDM','RB','LB'].includes(p.pos)) return 3;
      if (['ST','CF'].includes(p.pos)) return 2;
      return 1;
    });
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function simulateMatch(homeClub, awayClub, opts = {}) {
    const hR = effectiveRating(homeClub);
    const aR = effectiveRating(awayClub);
    const hStr = (hR * 1.15) / (hR * 1.15 + aR);

    const hExp = Math.max(0.3, 2.7 * hStr);
    const aExp = Math.max(0.3, 2.7 * (1 - hStr));

    const hScore = poisson(hExp);
    const aScore = poisson(aExp);

    const events = [];
    const hXI = opts.homeXI || null;
    const aXI = opts.awayXI || null;

    const addGoals = (count, team, club, xi) => {
      const mins = Array.from({ length: count }, () => rand(1, 90)).sort((a,b) => a-b);
      mins.forEach(min => {
        const scorer = pickScorer(club, xi);
        const assist = Math.random() > 0.25 ? pickAssist(club, scorer, xi) : null;
        events.push({ min, type: 'goal', team, player: scorer, assist });
      });
    };

    addGoals(hScore, 'home', homeClub, hXI);
    addGoals(aScore, 'away', awayClub, aXI);

    // Cards
    for (let i = 0; i < poisson(1.4); i++)
      events.push({ min: rand(5,90), type: 'yellow', team: 'home', player: pick(homeClub.players) });
    for (let i = 0; i < poisson(1.4); i++)
      events.push({ min: rand(5,90), type: 'yellow', team: 'away', player: pick(awayClub.players) });
    if (Math.random() < 0.055) {
      const t = Math.random() < 0.5 ? 'home' : 'away';
      events.push({ min: rand(20,85), type: 'red', team: t, player: pick(t === 'home' ? homeClub.players : awayClub.players) });
    }

    events.sort((a, b) => a.min - b.min);

    const hPoss = Math.min(75, Math.max(25, Math.round(40 + hStr * 20 + rand(-8, 8))));
    const hShots = hScore * rand(3,5) + rand(1,5);
    const aShots = aScore * rand(3,5) + rand(1,5);

    const genRatings = (club, xi, won, drew) => {
      const pool = xi
        ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
        : club.players.slice(0, 11);
      return pool.map(p => {
        let base = 6.0 + (p.ovr - 70) * 0.04 + (won ? 0.4 : drew ? 0 : -0.4) + (Math.random() - 0.5);
        events.filter(e => e.player?.id === p.id && e.type === 'goal').forEach(() => base += 0.7);
        events.filter(e => e.assist?.id === p.id).forEach(() => base += 0.3);
        return { player: p, rating: Math.min(10, Math.max(4, Math.round(base * 10) / 10)) };
      });
    };

    const hWon = hScore > aScore, drew = hScore === aScore;

    return {
      homeScore: hScore, awayScore: aScore, events,
      stats: { possession: [hPoss, 100 - hPoss], shots: [hShots, aShots],
               shotsOnTarget: [Math.min(hShots, hScore + rand(0,3)), Math.min(aShots, aScore + rand(0,3))] },
      homeRatings: genRatings(homeClub, hXI, hWon, drew),
      awayRatings: genRatings(awayClub, aXI, !hWon && !drew, drew),
    };
  }

  /* ---- RESULT PROCESSING ---- */
  function recordResult(gameState, fixture, hScore, aScore) {
    const upd = (club, gf, ga, home) => {
      club.tableStats.played++;
      club.tableStats.gf += gf;
      club.tableStats.ga += ga;
      if (gf > ga) { club.tableStats.won++; club.tableStats.points += 3; club.form.push('W'); }
      else if (gf === ga) { club.tableStats.drawn++; club.tableStats.points += 1; club.form.push('D'); }
      else { club.tableStats.lost++; club.form.push('L'); }
      if (club.form.length > 5) club.form.shift();
      club.results.unshift({ opp: home ? fixture.away : fixture.home, gf, ga, home });
      if (club.results.length > 10) club.results.pop();
    };
    const h = gameState.clubs[fixture.home], a = gameState.clubs[fixture.away];
    if (h) upd(h, hScore, aScore, true);
    if (a) upd(a, aScore, hScore, false);

    fixture.events.forEach(ev => {
      if (ev.type === 'goal') {
        if (ev.player) { ev.player.goals = (ev.player.goals||0)+1; ev.player.appearances = (ev.player.appearances||0)+1; }
        if (ev.assist) ev.assist.assists = (ev.assist.assists||0)+1;
      } else if (ev.type === 'yellow' && ev.player) {
        ev.player.yellowCards = (ev.player.yellowCards||0)+1;
      } else if (ev.type === 'red' && ev.player) {
        ev.player.redCards = (ev.player.redCards||0)+1;
      }
    });
  }

  function simulateSameDay(gameState, referenceFixture) {
    const ds = referenceFixture.date.toDateString();
    gameState.fixtures
      .filter(f => !f.played && f.date.toDateString() === ds && f.id !== referenceFixture.id)
      .forEach(f => {
        const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
        if (!h || !a) return;
        const r = simulateMatch(h, a);
        f.played = true; f.homeScore = r.homeScore; f.awayScore = r.awayScore; f.events = r.events;
        recordResult(gameState, f, r.homeScore, r.awayScore);
      });
  }

  function continueToNextFixture(gameState) {
    const next = getNextFixture(gameState);
    if (!next) return;
    gameState.fixtures
      .filter(f => !f.played && f.date < next.date)
      .forEach(f => {
        const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
        if (!h || !a) return;
        const r = simulateMatch(h, a);
        f.played = true; f.homeScore = r.homeScore; f.awayScore = r.awayScore; f.events = r.events;
        recordResult(gameState, f, r.homeScore, r.awayScore);
      });
    gameState.currentDate = new Date(next.date);
  }

  function getNextFixture(gameState) {
    return gameState.fixtures.find(f =>
      !f.played && (f.home === gameState.myClubId || f.away === gameState.myClubId)
    ) || null;
  }

  function getLeagueTable(gameState, leagueId) {
    return Object.values(gameState.clubs)
      .filter(c => c.league === leagueId)
      .sort((a, b) => {
        const dPts = b.tableStats.points - a.tableStats.points;
        if (dPts) return dPts;
        const dGD = (b.tableStats.gf - b.tableStats.ga) - (a.tableStats.gf - a.tableStats.ga);
        if (dGD) return dGD;
        return b.tableStats.gf - a.tableStats.gf;
      });
  }

  function getMyPosition(gameState) {
    const t = getLeagueTable(gameState, gameState.myClub.league);
    return t.findIndex(c => c.id === gameState.myClubId) + 1;
  }

  /* ---- EUROPEAN SETUP ---- */
  function setupEuropean(gameState) {
    const ucl = [], uel = [], uecl = [];
    const topLeagues = ['premier_league','la_liga','bundesliga','serie_a','ligue_1'];

    topLeagues.forEach(lid => {
      const league = DATA.LEAGUES[lid];
      if (!league) return;
      const clubs = Object.values(gameState.clubs)
        .filter(c => c.league === lid)
        .sort((a, b) => b.rep - a.rep || b.sqRating - a.sqRating);
      clubs.slice(0, league.championsLeague || 0).forEach(c => { if (!ucl.includes(c.id)) ucl.push(c.id); });
      clubs.slice(league.championsLeague || 0, (league.championsLeague||0) + (league.europaLeague||0))
        .forEach(c => { if (!uel.includes(c.id)) uel.push(c.id); });
      clubs.slice((league.championsLeague||0) + (league.europaLeague||0),
                  (league.championsLeague||0) + (league.europaLeague||0) + 2)
        .forEach(c => { if (!uecl.includes(c.id)) uecl.push(c.id); });
    });

    // Determine player's European competition
    const myLeague = DATA.LEAGUES[gameState.myClub.league];
    const myLeagueRanked = Object.values(gameState.clubs)
      .filter(c => c.league === gameState.myClub.league)
      .sort((a,b) => b.rep - a.rep || b.sqRating - a.sqRating);
    const myRank = myLeagueRanked.findIndex(c => c.id === gameState.myClubId) + 1;
    let myEuropean = null;
    if (myLeague) {
      if (myRank <= (myLeague.championsLeague||0)) myEuropean = 'champions_league';
      else if (myRank <= (myLeague.championsLeague||0)+(myLeague.europaLeague||0)) myEuropean = 'europa_league';
      else if (myRank <= (myLeague.championsLeague||0)+(myLeague.europaLeague||0)+1) myEuropean = 'conference_league';
    }
    gameState.myEuropeanComp = myEuropean;

    const makeGroups = (clubs, n) => {
      const s = [...clubs].sort(() => Math.random()-0.5);
      while (s.length < n * 4) s.push(...s.slice(0, Math.min(4, n*4-s.length)));
      return Array.from({ length: n }, (_, i) => s.slice(i*4, i*4+4));
    };

    const euDates = [
      new Date(2025,8,17), new Date(2025,9,1), new Date(2025,9,22),
      new Date(2025,10,5), new Date(2025,10,26), new Date(2025,11,10),
    ];
    let eid = 100000;

    const genEuFixtures = (comp, clubIds, groups) => {
      const fixtures = [];
      groups.forEach((group, gi) => {
        if (group.length < 2) return;
        const rr = roundRobin(group.map(id => ({ id })));
        rr.forEach((round, ri) => {
          const date = euDates[ri] || euDates[5];
          round.forEach(m => {
            fixtures.push({ id: eid++, comp, group: gi, home: m.home, away: m.away,
              date: new Date(date), played: false, homeScore: null, awayScore: null,
              type: 'european', stage: 'group' });
          });
        });
      });
      return fixtures;
    };

    const uclGroups = makeGroups(ucl, 8);
    const uelGroups = makeGroups(uel, 8);
    const ueclGroups = makeGroups(uecl, 6);

    gameState.european = {
      champions_league: { name:'Champions League', short:'UCL', clubs: ucl, groups: uclGroups, fixtures: genEuFixtures('champions_league', ucl, uclGroups), stage:'group', groupStats:{} },
      europa_league:    { name:'Europa League',    short:'UEL', clubs: uel, groups: uelGroups, fixtures: genEuFixtures('europa_league', uel, uelGroups), stage:'group', groupStats:{} },
      conference_league:{ name:'Conference League',short:'UECL',clubs: uecl, groups: ueclGroups, fixtures: genEuFixtures('conference_league', uecl, ueclGroups), stage:'group', groupStats:{} },
    };
  }

  /* ---- DOMESTIC CUPS ---- */
  function setupCups(gameState) {
    const cupDefs = [
      { id:'fa_cup',         name:'FA Cup',          country:'England', date: new Date(2025,10,8)  },
      { id:'copa_del_rey',   name:'Copa del Rey',    country:'Spain',   date: new Date(2025,10,22) },
      { id:'coppa_italia',   name:'Coppa Italia',    country:'Italy',   date: new Date(2025,10,15) },
      { id:'dfb_pokal',      name:'DFB-Pokal',       country:'Germany', date: new Date(2025,9,29)  },
      { id:'coupe_de_france',name:'Coupe de France', country:'France',  date: new Date(2025,10,22) },
    ];

    gameState.cups = {};
    let cid = 200000;

    cupDefs.forEach(cup => {
      const participants = Object.values(gameState.clubs)
        .filter(c => { const l = DATA.LEAGUES[c.league]; return l && l.country === cup.country; })
        .map(c => c.id)
        .sort(() => Math.random()-0.5);

      const fixtures = [];
      for (let i = 0; i + 1 < participants.length; i += 2) {
        fixtures.push({ id: cid++, comp: cup.id, compName: cup.name,
          home: participants[i], away: participants[i+1],
          date: new Date(cup.date), played: false, homeScore: null, awayScore: null,
          type: 'cup', stage: 'R1' });
      }

      gameState.cups[cup.id] = {
        name: cup.name, country: cup.country, stage: 'R1',
        fixtures, remaining: [...participants], winner: null,
      };
    });
  }

  /* ---- TRANSFER MARKET ---- */
  function getTransferMarket(gameState) {
    const listed = [];
    Object.values(gameState.clubs).forEach(club => {
      if (club.id === gameState.myClubId) return;
      club.players.forEach(p => {
        if (Math.random() < 0.08) listed.push({ ...p, clubId: club.id, clubName: club.name });
      });
    });
    return listed.sort((a, b) => b.ovr - a.ovr);
  }

  function isTransferWindowOpen(gameState) {
    const m = gameState.currentDate.getMonth();
    return m === 6 || m === 7 || m === 0; // Jul, Aug, Jan
  }

  return {
    generateSchedule, simulateMatch, recordResult,
    simulateSameDay, continueToNextFixture,
    getNextFixture, getLeagueTable, getMyPosition,
    setupEuropean, setupCups,
    getTransferMarket, isTransferWindowOpen,
  };

})();
