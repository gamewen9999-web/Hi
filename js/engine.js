/* ENGINE.JS — Match simulation, schedule, European, cups */

const ENGINE = (() => {

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const INJURY_TYPES = [
    { id: 'knock',     label: 'Knock',           minWeeks: 1,  maxWeeks: 2,  potDrop: 0, weight: 35, severity: 'minor'    },
    { id: 'strain',    label: 'Muscle Strain',   minWeeks: 2,  maxWeeks: 4,  potDrop: 0, weight: 28, severity: 'minor'    },
    { id: 'ankle',     label: 'Ankle Sprain',    minWeeks: 3,  maxWeeks: 6,  potDrop: 0, weight: 18, severity: 'moderate' },
    { id: 'hamstring', label: 'Hamstring Tear',  minWeeks: 4,  maxWeeks: 8,  potDrop: 0, weight: 12, severity: 'moderate' },
    { id: 'broken',    label: 'Broken Bone',     minWeeks: 8,  maxWeeks: 16, potDrop: 1, weight: 4,  severity: 'serious'  },
    { id: 'knee',      label: 'Knee Ligament',   minWeeks: 14, maxWeeks: 28, potDrop: 2, weight: 3,  severity: 'serious'  },
    { id: 'acl',       label: 'ACL Rupture',     minWeeks: 26, maxWeeks: 52, potDrop: 3, weight: 1,  severity: 'career'   },
  ];

  function pickWeighted(types) {
    const total = types.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of types) { r -= t.weight; if (r <= 0) return t; }
    return types[types.length - 1];
  }
  // Tired players get hurt more often. 1x at 95+ fitness, scaling up to ~7x near empty.
  function fatigueInjuryMult(fitness) {
    return 1 + Math.max(0, (95 - (fitness ?? 80)) / 15);
  }
  function goalsFromXG(xg) {
    // Box-Muller normal distribution centred on xg, variance = xg
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 || 1e-9)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(xg + Math.sqrt(Math.max(xg, 0.5)) * z));
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

    // Top-flight leagues stretch to May 18 to run alongside European knockout rounds.
    // Lower leagues keep a natural 7-day weekly cadence.
    const seasonEndTarget = new Date(2026, 4, 18); // May 18
    const winterBreakStart = new Date(2025, 11, 21); // Dec 21

    Object.keys(DATA.LEAGUES).forEach(lid => {
      const leagueDef = DATA.LEAGUES[lid];
      const clubs = Object.values(gameState.clubs).filter(c => c.league === lid);
      if (clubs.length < 4) return;
      const home = roundRobin(clubs);
      const away = home.map(r => r.map(m => ({ home: m.away, away: m.home })));
      const allRounds = [...home, ...away];
      // Only top-flight (level 1) leagues need to reach May — they share the calendar
      // with European competition. Lower leagues run at a flat 7-day cadence.
      let winterBreakDays = 0;
      if (leagueDef && leagueDef.level === 1) {
        const naturalEnd = new Date(seasonStart);
        naturalEnd.setDate(naturalEnd.getDate() + (allRounds.length - 1) * 7);
        winterBreakDays = Math.max(0, Math.round((seasonEndTarget - naturalEnd) / 86400000));
      }
      allRounds.forEach((round, ri) => {
        const d = new Date(seasonStart);
        let days = ri * 7;
        if (winterBreakDays > 0) {
          const rawDate = new Date(seasonStart);
          rawDate.setDate(rawDate.getDate() + days);
          if (rawDate > winterBreakStart) days += winterBreakDays;
        }
        d.setDate(d.getDate() + days);
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
  // Rates a club by its actual starting XI (with OOP penalty applied), not the whole squad —
  // bench depth shouldn't change how strong a team plays on the day. Falls back to a full-squad
  // average when no XI is known (e.g. quick previews before a lineup/formation is settled).
  function effectiveRating(club, xi, slotPositions) {
    if (xi && xi.length) {
      const vals = xi.map((id, i) => {
        const p = club.players.find(x => x.id === id);
        if (!p) return null;
        const factor = slotPositions ? oopFactor(p.pos, slotPositions[i]) : 1.0;
        return (p.ovr || 60) * factor;
      }).filter(v => v != null);
      if (vals.length) return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    if (club.players && club.players.length) {
      const avg = club.players.reduce((s, p) => s + (p.ovr || 60), 0) / club.players.length;
      return Math.round(avg);
    }
    return club.sqRating || 70;
  }

  // Formation tactical attributes: att = attacking weight (0–4), def = defensive weight (0–4).
  // Baseline is 2 = neutral. Each point of advantage in a matchup = ±5% xG swing.
  const FORM_ATTRS = {
    '4-4-2':   { att: 2, def: 2 },
    '4-3-3':   { att: 3, def: 1 },
    '4-2-3-1': { att: 2, def: 3 },
    '3-5-2':   { att: 2, def: 1 },
    '5-3-2':   { att: 1, def: 4 },
    '4-5-1':   { att: 1, def: 3 },
    '3-4-3':   { att: 4, def: 0 },
    '4-1-4-1': { att: 1, def: 3 },
    '4-4-2 D': { att: 1, def: 3 },
  };

  // Pressing: ownBoost = direct xG gain from turnovers, risk = space left behind for opponents.
  // High press is high risk/reward; low block is cautious.
  const PRESS_PRESET = {
    high:   { ownBoost:  0.12, risk:  0.08 },
    medium: { ownBoost:  0.00, risk:  0.00 },
    low:    { ownBoost: -0.10, risk: -0.14 },
  };

  // Style own-attack multiplier.
  const STYLE_ATK = {
    direct:      1.08,
    balanced:    1.00,
    possession:  1.05,
    counter:     0.92, // patient until the moment strikes — lower volume, high quality
    gegenpressing: 1.10, // intense press and immediate transitions — big xG but tiring
    longball:    1.06, // aerial threat + direct delivery
  };

  // How well your play style exploits the *risk* the opponent's pressing leaves:
  //   counter  — how well you exploit space left by an aggressive high press
  //   breakdown — susceptibility to a low block (higher = block is MORE effective against you)
  const STYLE_EXPOSURE = {
    direct:       { counter: 1.4,  breakdown: 0.7  },
    balanced:     { counter: 1.0,  breakdown: 1.0  },
    possession:   { counter: 0.5,  breakdown: 1.2  },
    counter:      { counter: 2.0,  breakdown: 0.5  }, // thrives on space, hard to break down
    gegenpressing:{ counter: 0.8,  breakdown: 0.9  }, // wins ball high, but risky if transition fails
    longball:     { counter: 1.6,  breakdown: 0.6  }, // good on counters, bypasses low blocks with aerial balls
  };

  function formAttrs(tac) {
    if (!tac) return { att: 2, def: 2 };
    if (tac.formation === 'custom' && tac.customFormation?.attrs) return tac.customFormation.attrs;
    return FORM_ATTRS[tac.formation] || { att: 2, def: 2 };
  }

  // Derive sensible AI tactics from a club's rep.
  function deriveAITactics(club) {
    const rep = club.rep || 3;
    return {
      mentality: 'balanced',
      pressing: rep >= 4 ? 'high'   : rep >= 2 ? 'medium' : 'low',
      style:    rep >= 4 ? 'possession' : rep >= 3 ? 'balanced' : rep >= 2 ? 'direct' : 'counter',
    };
  }

  // Build a custom formation from def/mid/att counts (must sum to 10).
  // Build a custom formation from an array of line counts (3 or 4 lines, summing to 10).
  function buildCustomFormation(counts) {
    if (!Array.isArray(counts)) return null;
    const total = counts.reduce((a, b) => a + b, 0);
    if (total !== 10) return null;
    const lines = counts.length;
    if (lines < 3 || lines > 4) return null;

    const positions = [{ pos: 'GK', x: 50, y: 92 }];
    const spread = (n, y, posTypes) => {
      const xs = n === 1 ? [50] : Array.from({ length: n }, (_, i) => Math.round(15 + (70 / (n - 1)) * i));
      for (let i = 0; i < n; i++) positions.push({ pos: posTypes[i % posTypes.length], x: xs[i], y });
    };

    const defPos = n => n <= 2 ? Array(n).fill('CB') : n === 3 ? ['CB','CB','CB'] : n === 4 ? ['RB','CB','CB','LB'] : ['RB','CB','CB','CB','LB'];
    const dmPos  = n => n === 1 ? ['CDM'] : n === 2 ? ['CDM','CDM'] : n === 3 ? ['CM','CDM','CM'] : n === 4 ? ['CM','CDM','CDM','CM'] : ['CM','CDM','CDM','CDM','CM'];
    const midPos = n => n <= 2 ? Array(n).fill('CM') : n === 3 ? ['CM','CM','CM'] : n === 4 ? ['RM','CM','CM','LM'] : ['RM','CM','CM','CM','LM'];
    const amPos  = n => n === 1 ? ['CAM'] : n === 2 ? ['CAM','CAM'] : n === 3 ? ['CM','CAM','CM'] : n === 4 ? ['RM','CAM','CAM','LM'] : ['RM','CAM','CAM','CAM','LM'];
    const attPos = n => n === 1 ? ['ST'] : n === 2 ? ['ST','ST'] : n === 3 ? ['RW','ST','LW'] : n === 4 ? ['RW','ST','ST','LW'] : ['RW','ST','ST','ST','LW'];

    let attW, defW;
    if (lines === 3) {
      const [def, mid, att] = counts;
      spread(def, def >= 5 ? 78 : 76, defPos(def));
      spread(mid, 56, midPos(mid));
      spread(att, att === 1 ? 22 : 26, attPos(att));
      attW = Math.max(0, Math.min(4, (att - 1) * 2));
      defW = Math.max(0, Math.min(4, (def - 3) * 2));
    } else {
      const [def, dm, am, att] = counts;
      spread(def, 76, defPos(def));
      spread(dm,  60, dmPos(dm));
      spread(am,  44, amPos(am));
      spread(att, 26, attPos(att));
      const fwd = am + att, bck = def + dm;
      attW = Math.max(0, Math.min(4, Math.round((fwd - 2) * 4 / 6)));
      defW = Math.max(0, Math.min(4, Math.round((bck - 2) * 4 / 6)));
    }

    return { name: counts.join('-'), positions, attrs: { att: attW, def: defW }, isCustom: true, counts, lines };
  }

  // Deterministic xG from ratings + full tactics. homeTactics/awayTactics can be:
  //   • a string (legacy: treated as mentality)
  //   • an object { mentality, formation, pressing, style, customFormation? }
  // Returns { homeXG, awayXG, hStr } — hStr is used downstream for possession calc.
  function calcMatchXG(homeClub, awayClub, homeTactics, awayTactics, homeXI, awayXI, homeSlotPositions, awaySlotPositions) {
    const hTac = typeof homeTactics === 'string' ? { mentality: homeTactics } : (homeTactics || {});
    const aTac = typeof awayTactics === 'string' ? { mentality: awayTactics } : (awayTactics || {});

    const hMen   = hTac.mentality || 'balanced';
    const aMen   = aTac.mentality || 'balanced';
    const hPress = hTac.pressing  || 'medium';
    const aPress = aTac.pressing  || 'medium';
    const hStyle = hTac.style     || 'balanced';
    const aStyle = aTac.style     || 'balanced';

    // 1. Base xG from starting-XI ratings + mentality (home gets 1.1× advantage).
    const offMod = { attacking: 1.25, balanced: 1.0, defensive: 0.75 };
    const defMod = { attacking: 0.85, balanced: 1.0, defensive: 1.2  };
    const hR   = effectiveRating(homeClub, homeXI, homeSlotPositions);
    const aR   = effectiveRating(awayClub, awayXI, awaySlotPositions);
    const hAtk = hR * (offMod[hMen] || 1.0) * 1.1;
    const hDef = hR * (defMod[hMen] || 1.0);
    const aAtk = aR * (offMod[aMen] || 1.0);
    const aDef = aR * (defMod[aMen] || 1.0);
    const hStr = hAtk / (hAtk + aDef);
    const aStr = aAtk / (aAtk + hDef);
    let homeXG = Math.max(0.20, 2.8 * hStr);
    let awayXG = Math.max(0.20, 2.5 * aStr);

    // 2. Formation matchup — each 1-pt advantage = ±5% xG (capped at ±25%).
    if (hTac.formation || aTac.formation) {
      const hFA = formAttrs(hTac);
      const aFA = formAttrs(aTac);
      homeXG *= 1 + Math.max(-0.25, Math.min(0.25, (hFA.att - aFA.def) * 0.05));
      awayXG *= 1 + Math.max(-0.25, Math.min(0.25, (aFA.att - hFA.def) * 0.05));
    }

    // 3. Pressing: own boost from winning the ball high, plus risk left for the opponent.
    const hp = PRESS_PRESET[hPress] || PRESS_PRESET.medium;
    const ap = PRESS_PRESET[aPress] || PRESS_PRESET.medium;
    const hSE = STYLE_EXPOSURE[hStyle] || STYLE_EXPOSURE.balanced;
    const aSE = STYLE_EXPOSURE[aStyle] || STYLE_EXPOSURE.balanced;
    homeXG *= 1 + hp.ownBoost;
    awayXG *= 1 + ap.ownBoost;
    // Risk from home pressing affects away xG.
    awayXG *= hp.risk >= 0
      ? 1 + hp.risk * aSE.counter    // high press → space for away counters
      : 1 + hp.risk * aSE.breakdown; // low block  → away finds it harder to break through
    // Risk from away pressing affects home xG.
    homeXG *= ap.risk >= 0
      ? 1 + ap.risk * hSE.counter
      : 1 + ap.risk * hSE.breakdown;

    // 4. Play style multiplier on own attack.
    homeXG *= STYLE_ATK[hStyle] || 1.0;
    awayXG *= STYLE_ATK[aStyle] || 1.0;

    return {
      homeXG: Math.max(0.15, Math.round(homeXG * 100) / 100),
      awayXG: Math.max(0.15, Math.round(awayXG * 100) / 100),
      hStr,
    };
  }

  // Position group for OOP calculations
  function posGroup(pos) {
    if (pos === 'GK') return 'GK';
    if (['CB','RB','LB','RWB','LWB'].includes(pos)) return 'DEF';
    if (['CM','CDM','CAM','RM','LM'].includes(pos)) return 'MID';
    return 'ATT';
  }

  // Positional depth: lower = more defensive, higher = more attacking.
  // Used to compute fine-grained OOP distance between any two positions.
  const POS_DEPTH = {
    CB: 2, RB: 2.5, LB: 2.5, RWB: 3, LWB: 3,
    CDM: 4,
    CM: 5, RM: 5.5, LM: 5.5,
    CAM: 6.5, RW: 7, LW: 7,
    CF: 8, ST: 8.5,
  };

  // Stat effectiveness multiplier when a player plays out of position.
  // Scale: 1.0 (natural) → 0.93 (mirror) → 0.88 (adjacent) → 0.80 → 0.70 → 0.58 → 0.45 → 0.35 (GK swap)
  function oopFactor(playerPos, slotPos) {
    if (!slotPos || playerPos === slotPos) return 1.0;
    if (playerPos === 'GK' || slotPos === 'GK') return 0.35;
    // CF never appears as a slot in any formation (every front line is tagged ST) —
    // treat it as a true synonym of ST rather than penalizing it for a gap in the
    // formation data.
    if ((playerPos === 'CF' && slotPos === 'ST') || (playerPos === 'ST' && slotPos === 'CF')) return 1.0;
    // CDM/CM and CAM/CM are rotated near-interchangeably in real squads (deep-lying
    // playmaker vs box-to-box, advanced playmaker vs central mid) — treat as synonyms too.
    if ((playerPos === 'CDM' && slotPos === 'CM') || (playerPos === 'CM' && slotPos === 'CDM')) return 1.0;
    if ((playerPos === 'CAM' && slotPos === 'CM') || (playerPos === 'CM' && slotPos === 'CAM')) return 1.0;
    const pd = POS_DEPTH[playerPos] ?? 5;
    const sd = POS_DEPTH[slotPos] ?? 5;
    const dist = Math.abs(pd - sd);
    if (dist === 0)   return 0.93;  // mirror pos e.g. RB↔LB, RW↔LW
    if (dist <= 1)    return 0.88;  // adjacent e.g. CM↔RM, CF↔wing
    if (dist <= 2)    return 0.80;  // nearby zone e.g. CB↔CDM, CAM↔ST, RW↔CAM
    if (dist <= 3)    return 0.70;  // cross-zone e.g. CB↔CM, CDM↔CAM, CM↔ST
    if (dist <= 4.5)  return 0.58;  // major cross e.g. CB↔MID, CDM↔striker
    if (dist <= 6)    return 0.45;  // extreme e.g. CB↔winger, CDM↔striker
    return 0.35;                    // CB↔ST or similar extremes
  }

  // Average a stat across a subset of the XI (or squad if no XI given).
  // slotPositions: optional array of slot position strings (same index as xi) — enables OOP nerf.
  function avgStat(club, xi, attr, slotPositions) {
    const pool = xi
      ? xi.map((id, i) => {
          const p = club.players.find(x => x.id === id);
          if (!p) return null;
          const factor = slotPositions ? oopFactor(p.pos, slotPositions[i]) : 1.0;
          return { stat: (p.attrs?.[attr] || 65) * factor };
        }).filter(Boolean)
      : club.players.slice(0, 11).map(p => ({ stat: p.attrs?.[attr] || 65 }));
    if (!pool.length) return 65;
    return pool.reduce((s, x) => s + x.stat, 0) / pool.length;
  }

  function pickScorer(club, xi) {
    const pool = xi
      ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
      : club.players;
    const w = pool.map(p => {
      // Position base weight
      let base = 0.1;
      if (['ST','CF'].includes(p.pos))         base = 12;
      else if (['RW','LW','CAM'].includes(p.pos)) base = 7;
      else if (['CM','RM','LM'].includes(p.pos))  base = 3;
      else if (['CDM'].includes(p.pos))            base = 1;
      else if (['CB','RB','LB'].includes(p.pos))   base = 0.5;
      // Shooting stat scales weight — a 90-rated shooter is ~33% more likely than average
      return base * (0.7 + (p.attrs?.shooting || 65) / 195);
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
    // Build full tactics objects for each side. Legacy opts.homeMentality still works.
    const hTac = opts.homeTactics || { ...deriveAITactics(homeClub), mentality: opts.homeMentality || 'balanced' };
    const aTac = opts.awayTactics || { ...deriveAITactics(awayClub), mentality: opts.awayMentality || 'balanced' };
    const hXI      = opts.homeXI || null;
    const aXI      = opts.awayXI || null;
    const hSlotPos = opts.homeSlotPositions || null; // e.g. ['GK','CB','CB','RB','LB',...]
    const aSlotPos = opts.awaySlotPositions || null;
    const { homeXG, awayXG, hStr } = calcMatchXG(homeClub, awayClub, hTac, aTac, hXI, aXI, hSlotPos, aSlotPos);
    const hStyle = hTac.style || 'balanced';
    const aStyle = aTac.style || 'balanced';

    // Stat modifiers with OOP nerf — players out of position contribute less.
    // Shooting: avg team shooting vs 65 baseline shifts xG up to ±18%
    const hShootMod = 0.82 + (avgStat(homeClub, hXI, 'shooting', hSlotPos) / 65) * 0.18;
    const aShootMod = 0.82 + (avgStat(awayClub, aXI, 'shooting', aSlotPos) / 65) * 0.18;
    // GK reflexes of the keeper reduces goals conceded
    const hGKMod = 1.0 - ((avgStat(homeClub, hXI, 'gkReflexes', hSlotPos) - 65) / 65) * 0.10;
    const aGKMod = 1.0 - ((avgStat(awayClub, aXI, 'gkReflexes', aSlotPos) - 65) / 65) * 0.10;
    // Passing: better passing team creates more chances (±8% xG)
    const hPassMod = 0.96 + (avgStat(homeClub, hXI, 'passing', hSlotPos) / 65) * 0.04;
    const aPassMod = 0.96 + (avgStat(awayClub, aXI, 'passing', aSlotPos) / 65) * 0.04;
    // Physical: higher physicality wins more duels, boosts xG slightly (±5%)
    const hPhysMod = 0.975 + (avgStat(homeClub, hXI, 'physical', hSlotPos) / 65) * 0.025;
    const aPhysMod = 0.975 + (avgStat(awayClub, aXI, 'physical', aSlotPos) / 65) * 0.025;
    // Pace: faster team presses harder, slightly reduces opponent xG (±4%)
    const hPaceMod = 1.0 - ((avgStat(awayClub, aXI, 'pace', aSlotPos) - 65) / 65) * 0.04;
    const aPaceMod = 1.0 - ((avgStat(homeClub, hXI, 'pace', hSlotPos) - 65) / 65) * 0.04;
    // Fitness modifier: tired squads underperform (80% quality at 0 energy → 100% at full)
    const avgFit = (club, xi) => {
      const pool = xi ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
                      : club.players.slice(0, 11);
      return pool.length ? pool.reduce((s, p) => s + (p.fitness ?? 80), 0) / pool.length : 80;
    };
    const hFitMult = 0.80 + (avgFit(homeClub, hXI) / 100) * 0.20;
    const aFitMult = 0.80 + (avgFit(awayClub, aXI) / 100) * 0.20;
    // Effective xG after all stat adjustments
    const hEffXG = Math.max(0.15, homeXG * hShootMod * hPassMod * hPhysMod * aGKMod * hPaceMod * hFitMult);
    const aEffXG = Math.max(0.15, awayXG * aShootMod * aPassMod * aPhysMod * hGKMod * aPaceMod * aFitMult);

    // Match-day noise: teams routinely over/underperform xG (range ×0.55–1.45)
    const noise = () => 0.55 + Math.random() * 0.9;
    const hScore = goalsFromXG(hEffXG * noise());
    const aScore = goalsFromXG(aEffXG * noise());

    const events = [];

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

    // Near-miss shots — feed the highlight system
    const missPool = ['shot_saved', 'shot_saved', 'shot_wide', 'shot_post'];
    for (let i = 0; i < rand(2, 5); i++)
      events.push({ min: rand(1, 90), type: pick(missPool), team: 'home', player: pickScorer(homeClub, hXI) });
    for (let i = 0; i < rand(2, 5); i++)
      events.push({ min: rand(1, 90), type: pick(missPool), team: 'away', player: pickScorer(awayClub, aXI) });

    // Stat-based tackle simulation
    // Each tackle: defender vs attacker using physical+defending vs dribbling+pace
    // Ratios determine: success, foul, card type, slide tackle risk
    const simTackle = (tacklerClub, targetClub, min) => {
      const midDefs = tacklerClub.players.filter(p => ['CDM','CM','CB','RB','LB'].includes(p.pos));
      const tackler = midDefs.length ? pick(midDefs) : pick(tacklerClub.players);
      const target  = pick(targetClub.players.filter(p => !['GK'].includes(p.pos)));
      if (!tackler || !target) return;

      const tDef  = (tackler.attrs?.defending || 65) + (tackler.attrs?.physical || 65);
      const tDrib = (target.attrs?.dribbling  || 65) + (target.attrs?.pace     || 65);
      const total = tDef + tDrib;
      // Probability tackler wins the ball
      const successP = tDef / total;

      const isSlide  = Math.random() < 0.30; // 30% chance it's a slide tackle
      const foulP    = isSlide ? (1 - successP) * 0.65 : (1 - successP) * 0.30;
      const isFoul   = Math.random() < foulP;
      const team     = tacklerClub === homeClub ? 'home' : 'away';

      events.push({ min, type: 'tackle', team, player: tackler,
        success: !isFoul, slide: isSlide });

      if (isFoul) {
        const yellowP = isSlide ? 0.38 : 0.18;
        const redP    = isSlide ? 0.06 : 0.02;
        const r = Math.random();
        if (r < redP) {
          events.push({ min: min+1, type: 'red',    team, player: tackler });
        } else if (r < yellowP) {
          events.push({ min: min+1, type: 'yellow', team, player: tackler });
        }
        // Bad tackles can injure the target — tired legs are slower to react, so a tired
        // target is more likely to come off worse from the same tackle.
        const injP = (isSlide ? 0.12 : 0.04) * (1 + Math.max(0, (90 - (target?.fitness ?? 80)) / 30));
        const targetTeam = tacklerClub === homeClub ? 'away' : 'home';
        const alreadyHurt = events.some(ev => ev.type === 'injury' && ev.player?.id === target?.id);
        if (target && !target.injured && !alreadyHurt && Math.random() < injP) {
          const contactTypes = INJURY_TYPES.filter(t => t.severity === 'minor' || t.severity === 'moderate');
          events.push({ min: min+1, type: 'injury', team: targetTeam, player: target, injuryType: pickWeighted(contactTypes).id });
        }
      }
    };

    // 8-14 tackle moments per match spread across both teams
    for (let i = 0; i < rand(8, 14); i++) {
      const homeAttacks = Math.random() < 0.5;
      simTackle(
        homeAttacks ? awayClub : homeClub, // tackler defends
        homeAttacks ? homeClub : awayClub, // target has ball
        rand(4, 88)
      );
    }

    // Injuries — chance scales with low fitness and prior injuries (max 1 per team)
    const tryInjury = (club, xi, team) => {
      const pool = (xi ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
                       : club.players.slice(0, 11))
        .filter(p => !p.injured)
        .sort(() => Math.random() - 0.5);
      for (const p of pool) {
        const injCount = p.careerInjuries || 0;
        // base 1.5%; low fitness multiplies risk up to ~7×; prior injuries add 15% each
        const fatigueMult = fatigueInjuryMult(p.fitness);
        const historyMult = 1 + injCount * 0.15;
        const chance = 0.015 * fatigueMult * historyMult;
        if (Math.random() < chance) {
          const type = pickWeighted(INJURY_TYPES);
          events.push({ min: rand(5, 89), type: 'injury', team, player: p, injuryType: type.id });
          break;
        }
      }
    };
    tryInjury(homeClub, hXI, 'home');
    tryInjury(awayClub, aXI, 'away');

    // Offsides (3-5 per match)
    for (let i = 0; i < rand(3, 5); i++) {
      const t = Math.random() < 0.5 ? 'home' : 'away';
      const club = t === 'home' ? homeClub : awayClub;
      const xi   = t === 'home' ? hXI : aXI;
      events.push({ min: rand(12, 87), type: 'offside', team: t, player: pickScorer(club, xi) });
    }
    // Corners (4-8 per match)
    for (let i = 0; i < rand(4, 8); i++) {
      events.push({ min: rand(3, 89), type: 'corner', team: Math.random() < 0.5 ? 'home' : 'away' });
    }
    // VAR checks after goals (30% chance each)
    events.filter(e => e.type === 'goal').forEach(g => {
      if (Math.random() < 0.30)
        events.push({ min: Math.min(g.min + 1, 89), type: 'var_check', team: g.team });
    });

    events.sort((a, b) => a.min - b.min);

    // Possession: passing quality + style (possession +10%, direct -8%)
    const hPassAvg = avgStat(homeClub, hXI, 'passing');
    const aPassAvg = avgStat(awayClub, aXI, 'passing');
    const passBias  = (hPassAvg - aPassAvg) / (hPassAvg + aPassAvg) * 12;
    const STYLE_POSS = { direct: -8, balanced: 0, possession: 10 };
    const stylePoss  = (STYLE_POSS[hStyle] || 0) - (STYLE_POSS[aStyle] || 0);
    const hPoss = Math.min(75, Math.max(25, Math.round(40 + hStr * 20 + passBias + stylePoss + rand(-5, 5))));
    // Shots proportional to shooting stat — better shooters attempt more
    const hShotMult = 0.85 + (avgStat(homeClub, hXI, 'shooting') / 65) * 0.15;
    const aShotMult = 0.85 + (avgStat(awayClub, aXI, 'shooting') / 65) * 0.15;
    const hShots = Math.round((hScore * rand(3,5) + rand(1,5)) * hShotMult);
    const aShots = Math.round((aScore * rand(3,5) + rand(1,5)) * aShotMult);

    const isBackline = (pos) => pos === 'GK' || ['CB','RB','LB','RWB','LWB'].includes(pos);
    const genRatings = (club, xi, won, drew, conceded) => {
      const pool = xi
        ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean)
        : club.players.slice(0, 11);
      return pool.map(p => {
        const a = p.attrs || {};
        // Rating purely from the stats relevant to that player's role — no ovr influence
        const relevantAvg = p.pos === 'GK'
          ? ((a.gkReflexes||65) + (a.gkPositioning||65) + (a.physical||65)) / 3
          : ['ST','CF'].includes(p.pos)    ? ((a.shooting||65)+(a.pace||65)+(a.dribbling||65)) / 3
          : ['RW','LW','CAM'].includes(p.pos) ? ((a.dribbling||65)+(a.passing||65)+(a.shooting||65)) / 3
          : ['CM','CDM','RM','LM'].includes(p.pos) ? ((a.passing||65)+(a.physical||65)+(a.defending||65)) / 3
          : ((a.defending||65)+(a.physical||65)+(a.pace||65)) / 3; // defenders
        // Tighter normalisation so a routine game lands ~6.0-6.5 instead of 7.5+ —
        // real match ratings cluster there, with 8+ reserved for genuinely standout
        // games (goal involvement, a clean sheet) rather than just "decent and won".
        let base = 6.5 + ((relevantAvg - 65) / 100) * 2.0 + (won ? 0.3 : drew ? 0 : -0.3) + (Math.random() - 0.5) * 1.3;
        // Keepers and defenders are judged on the scoreline as much as their attributes.
        if (isBackline(p.pos)) {
          if (conceded === 0) base += 0.4;
          else if (conceded >= 3) base -= 0.4;
        }
        events.filter(e => e.player?.id === p.id && e.type === 'goal').forEach(() => base += 0.7);
        events.filter(e => e.assist?.id === p.id).forEach(() => base += 0.35);
        events.filter(e => e.player?.id === p.id && e.type === 'yellow').forEach(() => base -= 0.25);
        events.filter(e => e.player?.id === p.id && e.type === 'red').forEach(() => base -= 1.0);
        return { player: p, rating: Math.min(10, Math.max(3.0, Math.round(base * 10) / 10)) };
      });
    };

    const hWon = hScore > aScore, drew = hScore === aScore;

    return {
      homeScore: hScore, awayScore: aScore, events,
      stats: { possession: [hPoss, 100 - hPoss], shots: [hShots, aShots],
               shotsOnTarget: [Math.min(hShots, hScore + rand(0,3)), Math.min(aShots, aScore + rand(0,3))] },
      homeRatings: genRatings(homeClub, hXI, hWon, drew, aScore),
      awayRatings: genRatings(awayClub, aXI, !hWon && !drew, drew, hScore),
    };
  }

  /* ---- RESULT PROCESSING ---- */
  function recordResult(gameState, fixture, hScore, aScore) {
    const isLeague = !fixture.type || fixture.type === 'league';
    const isEuropean = fixture.type === 'european';

    const upd = (club, gf, ga, home) => {
      if (isLeague) {
        club.tableStats.played++;
        club.tableStats.gf += gf;
        club.tableStats.ga += ga;
        if (gf > ga) { club.tableStats.won++; club.tableStats.points += 3; club.form.push('W'); }
        else if (gf === ga) { club.tableStats.drawn++; club.tableStats.points += 1; club.form.push('D'); }
        else { club.tableStats.lost++; club.form.push('L'); }
        if (club.form.length > 5) club.form.shift();
      }
      club.results.unshift({ opp: home ? fixture.away : fixture.home, gf, ga, home });
      if (club.results.length > 10) club.results.pop();
    };
    const h = gameState.clubs[fixture.home], a = gameState.clubs[fixture.away];
    if (h) upd(h, hScore, aScore, true);
    if (a) upd(a, aScore, hScore, false);

    if (isEuropean && gameState.european && fixture.comp) {
      const comp = gameState.european[fixture.comp];
      if (comp) {
        const updStat = (id, gf, ga) => {
          const s = comp.groupStats[id] || (comp.groupStats[id] = { p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 });
          s.p++; s.gf += gf; s.ga += ga;
          if (gf > ga) { s.w++; s.pts += 3; } else if (gf === ga) { s.d++; s.pts++; } else s.l++;
        };
        updStat(fixture.home, hScore, aScore);
        updStat(fixture.away, aScore, hScore);
      }
    }

    (fixture.events || []).forEach(ev => {
      if (ev.type === 'goal') {
        if (ev.player) { ev.player.goals = (ev.player.goals||0)+1; ev.player.appearances = (ev.player.appearances||0)+1; }
        if (ev.assist) ev.assist.assists = (ev.assist.assists||0)+1;
      } else if (ev.type === 'yellow' && ev.player) {
        ev.player.yellowCards = (ev.player.yellowCards||0)+1;
      } else if (ev.type === 'red' && ev.player) {
        ev.player.redCards = (ev.player.redCards||0)+1;
      } else if (ev.type === 'injury' && ev.player && !ev.player.injured) {
        // recordResult runs for every fixture (user's match, European, bulk sims) so this
        // is the one place injuries land on every club's players, not just the user's.
        const inj = INJURY_TYPES.find(t => t.id === ev.injuryType) || INJURY_TYPES[0];
        ev.player.injured        = true;
        ev.player.injuryType     = ev.injuryType;
        ev.player.injuryWeeks    = rand(inj.minWeeks, inj.maxWeeks);
        ev.player.careerInjuries = (ev.player.careerInjuries || 0) + 1;
        ev.player.fitness        = Math.max(5, (ev.player.fitness ?? 80) - 40);
      }
    });
  }

  // Bulk/background fixture sim (AI-vs-AI matches the user never watches) — uses each
  // club's own persisted lineup/tactics when available so bench depth and OOP penalties
  // matter here too, instead of silently falling back to player-array order.
  function simBulkFixture(gameState, f) {
    const h = gameState.clubs[f.home], a = gameState.clubs[f.away];
    if (!h || !a) { f.played = true; return; }
    const slotPos = (club) => (DATA.FORMATIONS[club.tactics?.formation] || DATA.FORMATIONS['4-3-3']).positions.map(p => p.pos);
    const hXI = h.lineup && h.lineup.length === 11 ? h.lineup : null;
    const aXI = a.lineup && a.lineup.length === 11 ? a.lineup : null;
    const r = simulateMatch(h, a, {
      homeXI: hXI, awayXI: aXI,
      homeTactics: h.tactics, awayTactics: a.tactics,
      homeSlotPositions: hXI ? slotPos(h) : null,
      awaySlotPositions: aXI ? slotPos(a) : null,
    });
    f.played = true; f.homeScore = r.homeScore; f.awayScore = r.awayScore; f.events = r.events;
    recordResult(gameState, f, r.homeScore, r.awayScore);
  }

  function simulateSameDay(gameState, referenceFixture) {
    const ds = referenceFixture.date.toDateString();
    const simF = (f) => simBulkFixture(gameState, f);
    gameState.fixtures
      .filter(f => !f.played && f.date.toDateString() === ds && f.id !== referenceFixture.id)
      .forEach(simF);
    const myId = gameState.myClubId;
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (comp.stage !== 'league') return;
        comp.fixtures
          .filter(f => !f.played && f.date.toDateString() === ds && f.id !== referenceFixture.id && f.home !== myId && f.away !== myId)
          .forEach(simF);
      });
    }
  }

  function continueToNextFixture(gameState) {
    const next = getNextFixture(gameState);
    if (!next) return;
    const simF = (f) => simBulkFixture(gameState, f);
    gameState.fixtures
      .filter(f => !f.played && f.date < next.date)
      .forEach(simF);
    const myId = gameState.myClubId;
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (comp.stage !== 'league') return;
        comp.fixtures
          .filter(f => !f.played && f.date < next.date && f.home !== myId && f.away !== myId)
          .forEach(simF);
      });
    }
    gameState.currentDate = new Date(next.date);
  }

  function getNextFixture(gameState) {
    const myId = gameState.myClubId;
    const leagueNext = gameState.fixtures.find(f =>
      !f.played && (f.home === myId || f.away === myId)
    ) || null;
    let euroNext = null;
    if (gameState.european) {
      Object.values(gameState.european).forEach(comp => {
        if (comp.stage !== 'league') return;
        const f = comp.fixtures.find(f => !f.played && (f.home === myId || f.away === myId));
        if (f && (!euroNext || f.date < euroNext.date)) euroNext = f;
      });
    }
    if (!leagueNext && !euroNext) return null;
    if (!leagueNext) return euroNext;
    if (!euroNext) return leagueNext;
    return leagueNext.date <= euroNext.date ? leagueNext : euroNext;
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
                  (league.championsLeague||0) + (league.europaLeague||0) + (league.conferenceLeague||0))
        .forEach(c => { if (!uecl.includes(c.id)) uecl.push(c.id); });
    });

    // Non-big-5 European clubs enter their assigned competition directly
    // (default Champions League if unspecified).
    Object.values(gameState.clubs)
      .filter(c => c.european)
      .forEach(c => {
        const comp = c.europeanComp || 'champions_league';
        if (comp === 'europa_league') { if (!uel.includes(c.id)) uel.push(c.id); }
        else if (comp === 'conference_league') { if (!uecl.includes(c.id)) uecl.push(c.id); }
        else { if (!ucl.includes(c.id)) ucl.push(c.id); }
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
      else if (myRank <= (myLeague.championsLeague||0)+(myLeague.europaLeague||0)+(myLeague.conferenceLeague||0)) myEuropean = 'conference_league';
    }
    gameState.myEuropeanComp = myEuropean;

    // New UEFA format: a single "league phase" — every club sits in one table and
    // plays a fixed number of matches against different opponents (no groups).
    const euDates = [
      new Date(2025,8,16), new Date(2025,8,30), new Date(2025,9,21),
      new Date(2025,10,4), new Date(2025,10,25), new Date(2025,11,9),
      new Date(2026,0,20),  new Date(2026,0,28),
    ];
    let eid = 100000;

    // Take the first `matchdays` rounds of a round-robin so each club faces a
    // distinct set of opponents (the Swiss-model league phase).
    const genLeaguePhase = (comp, clubIds, matchdays) => {
      const fixtures = [];
      if (clubIds.length < 2) return fixtures;
      const rounds = roundRobin(clubIds.map(id => ({ id }))).slice(0, matchdays);
      rounds.forEach((round, ri) => {
        const date = euDates[ri] || euDates[euDates.length - 1];
        // Alternate home/away each matchday to keep things roughly balanced.
        round.forEach(m => {
          const flip = ri % 2 === 1;
          fixtures.push({ id: eid++, comp,
            home: flip ? m.away : m.home, away: flip ? m.home : m.away,
            date: new Date(date), played: false, homeScore: null, awayScore: null,
            events: [], type: 'european', stage: 'league' });
        });
      });
      return fixtures;
    };

    gameState.european = {
      champions_league: { name:'Champions League', short:'UCL', clubs: ucl, matchdays: 8, fixtures: genLeaguePhase('champions_league', ucl, 8), stage:'league', groupStats:{} },
      europa_league:    { name:'Europa League',    short:'UEL', clubs: uel, matchdays: 8, fixtures: genLeaguePhase('europa_league', uel, 8), stage:'league', groupStats:{} },
      conference_league:{ name:'Conference League',short:'UECL',clubs: uecl, matchdays: 6, fixtures: genLeaguePhase('conference_league', uecl, 6), stage:'league', groupStats:{} },
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
    const seen = new Set();
    Object.values(gameState.clubs).forEach(club => {
      if (club.id === gameState.myClubId) return;
      club.players.forEach(p => {
        if (seen.has(p.id)) return;
        const monthsLeft = p.contractEnd ? (p.contractEnd - gameState.currentDate) / (30.44 * 86400000) : 48;
        const expiring = monthsLeft <= 12 && !p.loyal;
        const wantsMove = !!p.transferListed;
        // High-OVR expiring players often get extended — not all appear on market
        // OVR<70: always show if expiring; OVR70-80: 45% chance; OVR80+: 20% chance
        const showExpiring = expiring && (p.ovr < 70 || Math.random() < (p.ovr < 80 ? 0.45 : 0.20));
        // Random listing: lower-league players appear more often (they move more)
        // OVR<55=18%, 55-60=10%, 60-65=4%, 65-70=1.5%, 70-75=0.4%, 75+=0.1%
        const randomChance = p.ovr < 55
          ? 0.18
          : Math.max(0.001, 0.10 * Math.pow(0.80, Math.max(0, p.ovr - 55)));
        const random = !expiring && !wantsMove && Math.random() < randomChance;
        if (showExpiring || wantsMove || random) {
          seen.add(p.id);
          // ±15% price noise so not all players show the same round value
          const priceMult = 0.85 + Math.random() * 0.30;
          const displayValue = Math.max(0.01, Math.round(p.value * priceMult * 100) / 100);
          listed.push({ ...p, value: displayValue, trueValue: p.value, clubId: club.id, clubName: club.name, expiring, wantsMove });
        }
      });
    });
    return listed.sort((a, b) => b.ovr - a.ovr);
  }

  function isTransferWindowOpen(gameState) {
    const m = gameState.currentDate.getMonth();
    return m === 6 || m === 7 || m === 0; // Jul, Aug, Jan
  }

  /* ---- TRANSFER NEGOTIATION ----
     A negotiation has two phases: agree a fee with the selling club, then
     agree personal terms (wages) with the player. Fees are in £m, wages £k/wk. */

  // Real fees aren't all clean £100k multiples — round more coarsely as the fee
  // gets bigger (big deals are reported in round figures; cheap ones aren't),
  // and let fees genuinely land under £100k for low-value players instead of
  // being floored there.
  function roundFee(v) {
    if (v <= 0) return 0;
    if (v >= 50) return Math.round(v);            // ≥£50m -> nearest £1m
    if (v >= 10) return Math.round(v * 4) / 4;     // £10-50m -> nearest £250k
    if (v >= 1)  return Math.round(v * 20) / 20;   // £1-10m -> nearest £50k
    return Math.round(v * 100) / 100;              // <£1m -> nearest £10k
  }

  function startNegotiation(player, sellerClub) {
    const youngBoost = player.age <= 23 ? 0.06 : 0;
    const potBoost = (player.pot - player.ovr) >= 8 ? 0.04 : 0;
    const repBoost = (sellerClub.rep >= 4 && player.ovr >= 80) ? 0.04 : 0;
    // Club asks 12-20% above market; won't accept below 82-93% of value
    const asking = roundFee(player.value * (1.12 + rand(0, 8) / 100));
    const minMult = Math.max(0.82, 0.87 + youngBoost + potBoost + repBoost + rand(0, 6) / 100);
    const minFee = Math.max(0.01, roundFee(player.value * minMult));
    // Player wants 20-40% more than current wage
    const wageDemand = Math.max(0.05, Math.round(player.wage * (1.25 + rand(3, 20) / 100) * 100) / 100);
    return {
      asking,
      minFee,
      wageDemand,
      minWage: Math.max(0.05, Math.round(wageDemand * 0.92 * 100) / 100),
      feeRound: 0,
      wageRound: 0,
    };
  }

  function evaluateFeeOffer(neg, offer) {
    neg.feeRound++;
    if (offer >= neg.minFee) return { decision: 'accept' };
    if (neg.feeRound >= 4) return { decision: 'walk' };
    if (offer >= neg.minFee * 0.78) {
      const midpoint = (neg.asking + neg.minFee) / 2;
      const counter = Math.max(neg.minFee, roundFee((offer + midpoint) / 2));
      neg.asking = counter;
      return { decision: 'counter', counter };
    }
    return { decision: 'reject' };
  }

  function evaluateWageOffer(neg, offer) {
    neg.wageRound++;
    if (offer >= neg.minWage) return { decision: 'accept' };
    if (neg.wageRound >= 4) return { decision: 'walk' };
    if (offer >= neg.minWage * 0.78) {
      const counter = Math.max(neg.minWage, Math.round((offer * 0.35 + neg.wageDemand * 0.65) * 100) / 100);
      neg.wageDemand = counter;
      return { decision: 'counter', counter };
    }
    return { decision: 'reject' };
  }

  return {
    generateSchedule, simulateMatch, calcMatchXG, recordResult,
    simulateSameDay, continueToNextFixture, simBulkFixture,
    getNextFixture, getLeagueTable, getMyPosition,
    setupEuropean, setupCups,
    getTransferMarket, isTransferWindowOpen,
    startNegotiation, evaluateFeeOffer, evaluateWageOffer, roundFee,
    buildCustomFormation, deriveAITactics, FORM_ATTRS, PRESS_PRESET, STYLE_ATK,
    oopFactor, posGroup, INJURY_TYPES,
  };

})();
