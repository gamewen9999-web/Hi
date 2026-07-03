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
  // Exponential rather than linear so genuinely fit players (90+) are rarely hurt
  // while tired legs (sub-50) get hurt far more often, instead of both ends being
  // squeezed toward the same 1x-4x band.
  function fatigueInjuryMult(fitness) {
    return Math.pow(1.045, 80 - (fitness ?? 80));
  }
  function goalsFromXG(xg) {
    // Poisson distribution — realistic goal model (variance = mean, no fat tails)
    const L = Math.exp(-Math.max(0, xg));
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
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
    const year = gameState.currentDate.getFullYear();
    const seasonStart = new Date(year, 7, 9);

    // Top-flight leagues stretch to May 18 to run alongside European knockout rounds.
    // Lower leagues keep a natural 7-day weekly cadence.
    const seasonEndTarget = new Date(year + 1, 4, 18); // May 18
    const winterBreakStart = new Date(year, 11, 21); // Dec 21

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

  // Chemistry: how well 11 players work together as a unit.
  // Two components:
  //   - Positional fit: average OOP factor across the XI (0.35–1.0).
  //     A team with everyone in their natural slot scores ~1.0; a patchwork lineup drags it down.
  //   - Nationality cohesion: a large same-nationality group is a proxy for shared tactical
  //     language and automatic understanding (e.g. 7 Brazilians playing together).
  // Output: multiplier 0.92–1.07 applied to effective xG.
  function chemistryFactor(club, xi, slotPositions) {
    if (!xi || xi.length < 11) return 1.0;
    let oopSum = 0, count = 0;
    const natCounts = {};
    xi.forEach((id, i) => {
      const p = club.players.find(pl => pl.id === id);
      if (!p) return;
      oopSum += oopFactor(p.pos, (slotPositions && slotPositions[i]) || p.pos);
      count++;
      const nat = p.nationality || 'Unknown';
      natCounts[nat] = (natCounts[nat] || 0) + 1;
    });
    if (!count) return 1.0;
    const avgOop   = oopSum / count;
    const maxGroup = Math.max(0, ...Object.values(natCounts));
    const natBonus = maxGroup >= 7 ? 0.025 : maxGroup >= 5 ? 0.015 : maxGroup >= 3 ? 0.006 : 0;
    // avgOop=0.35 (extreme OOP) → ~0.94, avgOop=1.0 (all natural) → ~1.05+cohesion
    return Math.min(1.07, 0.89 + avgOop * 0.16 + natBonus);
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
      mentality:    'balanced',
      pressing:     rep >= 4 ? 'high'   : rep >= 2 ? 'medium' : 'low',
      style:        rep >= 4 ? 'possession' : rep >= 3 ? 'balanced' : rep >= 2 ? 'direct' : 'counter',
      cornerTaking: rep >= 4 ? 'far-post' : 'drilled',
      freeKick:     rep >= 4 ? 'shoot' : 'cross',
      cornerDefense: rep >= 3 ? 'zonal' : 'mixed',
      timeWasting:  false,
      playSetPieces: rep <= 2,
    };
  }

  // xG contribution from dead-ball situations (corners + free kicks).
  // Shaped by delivery type, free kick approach, physical threat, and "play for set pieces" flag.
  // The opposing defense multiplier is applied on the receiving side via spDefenseMult().
  function setPieceXG(tac, club, xi, slotPos) {
    const physAvg  = avgStat(club, xi, 'physical', slotPos);
    const passAvg  = avgStat(club, xi, 'passing',  slotPos);
    const shootAvg = avgStat(club, xi, 'shooting', slotPos);

    // Corner delivery: far-post is the most dangerous aerial delivery
    const CORNER_MULT = { 'near-post': 0.92, 'far-post': 1.15, 'short': 0.68, 'drilled': 1.0 };
    const cornerXG = 0.08 * (CORNER_MULT[tac.cornerTaking || 'far-post'] || 1.0) * (physAvg / 72);

    // Free kick: direct shots are higher risk/reward; short builds possession but lower xG
    const FK_MULT = { shoot: 1.10, cross: 1.0, short: 0.78 };
    const fkXG = 0.05 * (FK_MULT[tac.freeKick || 'cross'] || 1.0) * ((passAvg + shootAvg) / 140);

    const base = cornerXG + fkXG;
    return tac.playSetPieces ? base * 1.5 : base;
  }

  // Multiplier applied to the OPPONENT's set piece xG based on your defensive scheme.
  // Zonal marking is harder to beat; man marking is riskier.
  function spDefenseMult(tac) {
    const DEF = { zonal: 0.82, man: 0.96, mixed: 0.88 };
    return DEF[tac.cornerDefense || 'mixed'] || 0.88;
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
    // Separate attack and defense ratings so a team's scoring threat reflects its
    // forwards' quality, and conceding reflects its defenders+GK quality.
    const hAttR = attackRating(homeClub, homeXI, homeSlotPositions);
    const aAttR = attackRating(awayClub,  awayXI, awaySlotPositions);
    const hDefR = defenseRating(homeClub, homeXI, homeSlotPositions);
    const aDefR = defenseRating(awayClub,  awayXI, awaySlotPositions);
    // Raise to 3.5 so a genuine 10-OVR gap shows up decisively in the scoreline.
    const hAtkP = Math.pow(hAttR, 3.5), aAtkP = Math.pow(aAttR, 3.5);
    const hDefP = Math.pow(hDefR, 3.5), aDefP = Math.pow(aDefR, 3.5);
    const hAtk = hAtkP * (offMod[hMen] || 1.0) * 1.1;
    const hDef = hDefP * (defMod[hMen] || 1.0);
    const aAtk = aAtkP * (offMod[aMen] || 1.0);
    const aDef = aDefP * (defMod[aMen] || 1.0);
    const hStr = hAtk / (hAtk + aDef);
    const aStr = aAtk / (aAtk + hDef);
    let homeXG = Math.max(0.15, 2.4 * hStr);
    let awayXG = Math.max(0.15, 2.1 * aStr);

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

  // Get the starting GK from an XI, falling back to the squad's first GK.
  function findGK(club, xi) {
    const pool = xi ? xi.map(id => club.players.find(p => p.id === id)).filter(Boolean) : club.players.slice(0, 11);
    return pool.find(p => p.pos === 'GK') || null;
  }

  // Position-weighted stat average: attackers count more for shooting/dribbling,
  // defenders count more for defending, etc.
  // posWeights: { GK, DEF, MID, ATT } multipliers (missing groups get weight 1).
  function avgStatWeighted(club, xi, attr, slotPositions, posWeights) {
    const pool = xi
      ? xi.map((id, i) => {
          const p = club.players.find(x => x.id === id);
          if (!p) return null;
          const oop    = slotPositions ? oopFactor(p.pos, slotPositions[i]) : 1.0;
          const w      = posWeights[posGroup(p.pos)] ?? 1.0;
          return { stat: (p.attrs?.[attr] || 65) * oop, w };
        }).filter(Boolean)
      : club.players.slice(0, 11).map(p => ({ stat: p.attrs?.[attr] || 65, w: posWeights[posGroup(p.pos)] ?? 1.0 }));
    if (!pool.length) return 65;
    const wSum  = pool.reduce((s, x) => s + x.w,        0);
    const vSum  = pool.reduce((s, x) => s + x.stat * x.w, 0);
    return wSum > 0 ? vSum / wSum : 65;
  }

  // Attack-facing effective rating: forwards and attacking mids count most.
  // Used as the "attack" side of the xG ratio so a team's scoring threat reflects
  // its attackers' quality rather than a diluted all-11 average.
  function attackRating(club, xi, slotPositions) {
    if (!xi || !xi.length) return effectiveRating(club, xi, slotPositions);
    // GK barely contributes to attack; defenders a little; mids build play; attackers dominate.
    const W = { GK: 0.05, DEF: 0.20, MID: 0.75, ATT: 1.50 };
    let wSum = 0, vSum = 0;
    xi.forEach((id, i) => {
      const p = club.players.find(x => x.id === id);
      if (!p) return;
      const oop = slotPositions ? oopFactor(p.pos, slotPositions[i]) : 1.0;
      const w = W[posGroup(p.pos)] ?? 1.0;
      vSum += (p.ovr || 60) * oop * w;
      wSum += w;
    });
    return wSum > 0 ? Math.round(vSum / wSum) : effectiveRating(club, xi, slotPositions);
  }

  // Defense-facing effective rating: GK and defenders count most.
  function defenseRating(club, xi, slotPositions) {
    if (!xi || !xi.length) return effectiveRating(club, xi, slotPositions);
    const W = { GK: 1.80, DEF: 1.50, MID: 0.80, ATT: 0.10 };
    let wSum = 0, vSum = 0;
    xi.forEach((id, i) => {
      const p = club.players.find(x => x.id === id);
      if (!p) return;
      const oop = slotPositions ? oopFactor(p.pos, slotPositions[i]) : 1.0;
      const w = W[posGroup(p.pos)] ?? 1.0;
      vSum += (p.ovr || 60) * oop * w;
      wSum += w;
    });
    return wSum > 0 ? Math.round(vSum / wSum) : effectiveRating(club, xi, slotPositions);
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
      const posW = ['CAM','CM'].includes(p.pos)       ? 9
                 : ['RW','LW','RM','LM'].includes(p.pos) ? 7
                 : ['CDM','RB','LB'].includes(p.pos)  ? 3
                 : ['ST','CF'].includes(p.pos)         ? 2
                 : 1;
      // Scale by passing stat so creative playmakers assist more than plodding defenders.
      return posW * (0.60 + (p.attrs?.passing || 65) / 163);
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

    // Possession: driven primarily by passing quality and overall rating gap, then shaped
    // by play style and pressing. A possession team vs a long-ball side should produce
    // realistic 65/35-ish splits; evenly-matched teams should hover around 50/50 ± a few.
    const hR   = effectiveRating(homeClub, hXI, hSlotPos);
    const aR   = effectiveRating(awayClub,  aXI, aSlotPos);
    const hPassAvg = avgStat(homeClub, hXI, 'passing', hSlotPos);
    const aPassAvg = avgStat(awayClub, aXI, 'passing', aSlotPos);
    // Passing gap is the single biggest real-world possession driver.
    const passBias = (hPassAvg - aPassAvg) / Math.max(1, hPassAvg + aPassAvg) * 22;
    // Rating gap: superior team naturally sees more of the ball.
    const ratingBias = (hR - aR) * 0.28;
    // Style: possession teams hoard the ball; long-ball/counter sides don't want it.
    const STYLE_POSS = {
      direct: -7, balanced: 0, possession: 14,
      counter: -9, gegenpressing: 5, longball: -11,
    };
    const stylePoss = (STYLE_POSS[hStyle] || 0) - (STYLE_POSS[aStyle] || 0);
    // Pressing: winning the ball high gives you more of it; sitting deep cedes it.
    const PRESS_POSS = { high: 5, medium: 0, low: -5 };
    const pressBias = (PRESS_POSS[hTac.pressing || 'medium'] || 0) - (PRESS_POSS[aTac.pressing || 'medium'] || 0);
    const hFA = formAttrs(hTac), aFA = formAttrs(aTac);
    const formBias = Math.max(-5, Math.min(5, ((hFA.att - hFA.def) - (aFA.att - aFA.def)) * 1.0));
    // Less randomness — possession is largely a structured pattern, not a coin flip.
    let hPoss = Math.min(78, Math.max(22, Math.round(50 + passBias + ratingBias + stylePoss + pressBias + formBias + rand(-3, 3))));
    // A red card visibly costs the man-down side the ball, not just chances.
    if (opts.homeManDown) hPoss = Math.max(18, hPoss - 12);
    if (opts.awayManDown) hPoss = Math.min(82, hPoss + 12);

    // Shooting: weighted heavily toward attackers (ATT 3×, MID 1×, DEF 0.3×, GK 0.05×)
    // so a team's strike force quality drives goal conversion, not the defenders' low shooting.
    const SHOOT_W = { GK: 0.05, DEF: 0.30, MID: 1.0, ATT: 3.0 };
    const hShootMod = 0.82 + (avgStatWeighted(homeClub, hXI, 'shooting', hSlotPos, SHOOT_W) / 65) * 0.18;
    const aShootMod = 0.82 + (avgStatWeighted(awayClub, aXI, 'shooting', aSlotPos, SHOOT_W) / 65) * 0.18;
    // GK reflexes: use ONLY the actual keeper's stats — averaging across 11 players was
    // returning a number well below 65 because outfield players have gkReflexes of 5–20,
    // which was making the mod > 1.0 (i.e. accidentally boosting rather than reducing xG).
    const hGK = findGK(homeClub, hXI);
    const aGK = findGK(awayClub,  aXI);
    const hGKMod = 1.0 - (((hGK?.attrs?.gkReflexes || 65) - 65) / 65) * 0.14;
    const aGKMod = 1.0 - (((aGK?.attrs?.gkReflexes || 65) - 65) / 65) * 0.14;
    // GK positioning: further small bonus on top of reflexes for elite keepers
    const hGKPosMod = 1.0 - (((hGK?.attrs?.gkPositioning || 65) - 65) / 65) * 0.06;
    const aGKPosMod = 1.0 - (((aGK?.attrs?.gkPositioning || 65) - 65) / 65) * 0.06;
    // Defending: defenders' and defensive-mids' defending stat reduces opponent xG (±10%)
    const DEF_W = { GK: 0.20, DEF: 3.0, MID: 0.80, ATT: 0.05 };
    const hDefendMod = 1.0 - ((avgStatWeighted(homeClub, hXI, 'defending', hSlotPos, DEF_W) - 65) / 65) * 0.10;
    const aDefendMod = 1.0 - ((avgStatWeighted(awayClub, aXI, 'defending', aSlotPos, DEF_W) - 65) / 65) * 0.10;
    // Passing: midfielders and attackers drive chance creation (±8% xG)
    const PASS_W = { GK: 0.20, DEF: 0.40, MID: 2.0, ATT: 1.2 };
    const hPassMod = 0.96 + (avgStatWeighted(homeClub, hXI, 'passing', hSlotPos, PASS_W) / 65) * 0.04;
    const aPassMod = 0.96 + (avgStatWeighted(awayClub, aXI, 'passing', aSlotPos, PASS_W) / 65) * 0.04;
    // Dribbling: attackers' dribbling creates extra openings (±5%)
    const DRIB_W = { GK: 0.0, DEF: 0.10, MID: 0.80, ATT: 3.0 };
    const hDribMod = 0.975 + (avgStatWeighted(homeClub, hXI, 'dribbling', hSlotPos, DRIB_W) / 65) * 0.025;
    const aDribMod = 0.975 + (avgStatWeighted(awayClub, aXI, 'dribbling', aSlotPos, DRIB_W) / 65) * 0.025;
    // Physical: higher physicality wins more duels, boosts xG slightly (±4%)
    const hPhysMod = 0.980 + (avgStat(homeClub, hXI, 'physical', hSlotPos) / 65) * 0.020;
    const aPhysMod = 0.980 + (avgStat(awayClub, aXI, 'physical', aSlotPos) / 65) * 0.020;
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
    // A sending-off costs the man-down side a big chunk of their threat and hands
    // the opponent a clear boost — this is what makes a red card "obviously" matter
    // when the remainder of the match gets re-simulated with this flag set.
    const hManDownMult = opts.homeManDown ? 0.72 : (opts.awayManDown ? 1.15 : 1.0);
    const aManDownMult = opts.awayManDown ? 0.72 : (opts.homeManDown ? 1.15 : 1.0);
    // Chemistry: teams with players in their natural positions and good national cohesion
    // perform above their individual ratings; patchwork lineups are punished.
    const hChem = chemistryFactor(homeClub, hXI, hSlotPos);
    const aChem = chemistryFactor(awayClub,  aXI, aSlotPos);

    // Set pieces: dead-ball xG bonus shaped by tactics, aerial stats and opponent defence.
    // "Play for set pieces" boosts this 1.5× but slightly penalises open-play output.
    const hSPXG = setPieceXG(hTac, homeClub, hXI, hSlotPos) * spDefenseMult(aTac);
    const aSPXG = setPieceXG(aTac, awayClub, aXI, aSlotPos) * spDefenseMult(hTac);
    const hSPOpenPenalty = hTac.playSetPieces ? 0.95 : 1.0;
    const aSPOpenPenalty = aTac.playSetPieces ? 0.95 : 1.0;

    // Time wasting: the wasting team plays more conservatively (−8% own xG);
    // opponent gets even less space and time (−20% opp xG).
    const hTWself = hTac.timeWasting ? 0.92 : 1.0;
    const hTWopp  = hTac.timeWasting ? 0.80 : 1.0;
    const aTWself = aTac.timeWasting ? 0.92 : 1.0;
    const aTWopp  = aTac.timeWasting ? 0.80 : 1.0;

    // Effective xG: open play × all modifiers, then set piece xG added on top.
    const hOpenXG = homeXG * hShootMod * hDribMod * hPassMod * hPhysMod * aGKMod * aGKPosMod * aDefendMod * hPaceMod * hFitMult * hManDownMult * hChem * hSPOpenPenalty * aTWopp;
    const aOpenXG = awayXG * aShootMod * aDribMod * aPassMod * aPhysMod * hGKMod * hGKPosMod * hDefendMod * aPaceMod * aFitMult * aManDownMult * aChem * aSPOpenPenalty * hTWopp;
    const hEffXG = Math.max(0.15, hOpenXG * hTWself + hSPXG);
    const aEffXG = Math.max(0.15, aOpenXG * aTWself + aSPXG);

    // Match-day noise: narrow band so ratings/chemistry drive outcomes, luck is secondary.
    const noise = () => 0.85 + Math.random() * 0.30;
    // let, not const — a penalty or stoppage-time chance (below) can add to the
    // final score/shot totals on top of what's rolled here.
    let hScore = goalsFromXG(hEffXG * noise());
    let aScore = goalsFromXG(aEffXG * noise());

    // Shot volume follows the team's actual output (hEffXG/aEffXG — already shaped by
    // ratings, formation, pressing and style above) rather than the scoreline, so a
    // dominant-but-unlucky side still racks up shots instead of just the goals they
    // happened to score. An attacking mentality and higher pressing line both add shot
    // volume on top of that; ~0.105 xG per shot is a roughly realistic conversion rate.
    // Floored at the actual goals scored (you can't score more than you shot) — the
    // near-miss events below are generated to match these totals exactly, so the live
    // stat ticker and pitch-event dots always agree with the final shot/SOT counts.
    const MEN_SHOT_VOL = { attacking: 1.12, balanced: 1.0, defensive: 0.86 };
    const tacShotVol = (tac) => {
      const press = PRESS_PRESET[tac.pressing] || PRESS_PRESET.medium;
      return (MEN_SHOT_VOL[tac.mentality] || 1.0) * (1 + press.ownBoost * 0.6);
    };
    let hShots = Math.max(hScore, Math.round((hEffXG / 0.105) * tacShotVol(hTac) * (0.75 + Math.random() * 0.5)));
    let aShots = Math.max(aScore, Math.round((aEffXG / 0.105) * tacShotVol(aTac) * (0.75 + Math.random() * 0.5)));
    // On target is roughly a third of total shots, floored at the actual goals scored
    // (a goal is always on target) and capped by total shots.
    let hSOT = Math.max(hScore, Math.min(hShots, Math.round(hShots * (0.28 + Math.random() * 0.16))));
    let aSOT = Math.max(aScore, Math.min(aShots, Math.round(aShots * (0.28 + Math.random() * 0.16))));

    // Stoppage time — added on top of the regulation-time events below by shifting
    // anything past minute 45 and slotting a little extra late drama into the gaps
    // this creates, same as a broadcast added-time clock.
    const stoppage1 = rand(1, 5);
    const stoppage2 = rand(2, 7);
    const matchEnd  = 90 + stoppage1 + stoppage2;

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

    // Near-miss shots — generated to exactly fill out the hShots/hSOT totals above
    // (minus the goals already added), so every shot counted in the stats bar has a
    // matching event for the pitch dots / commentary feed to show.
    const addNearMisses = (totalShots, onTarget, scored, team, club, xi) => {
      const nonGoalTotal  = Math.max(0, totalShots - scored);
      const nonGoalOnTgt  = Math.max(0, Math.min(nonGoalTotal, onTarget - scored));
      const nonGoalOffTgt = nonGoalTotal - nonGoalOnTgt;
      for (let i = 0; i < nonGoalOnTgt; i++)
        events.push({ min: rand(1, 90), type: 'shot_saved', team, player: pickScorer(club, xi) });
      for (let i = 0; i < nonGoalOffTgt; i++)
        events.push({ min: rand(1, 90), type: Math.random() < 0.75 ? 'shot_wide' : 'shot_post', team, player: pickScorer(club, xi) });
    };
    addNearMisses(hShots, hSOT, hScore, 'home', homeClub, hXI);
    addNearMisses(aShots, aSOT, aScore, 'away', awayClub, aXI);

    // Stat-based tackle simulation
    // Each tackle: defender vs attacker using physical+defending vs dribbling+pace
    // Ratios determine: success, foul, card type, slide tackle risk
    const simTackle = (tacklerClub, targetClub, min) => {
      // Restricted to the actual starting XI — players who aren't even on the pitch
      // (bench/reserves) must never be picked for a tackle, card, or injury.
      const tacklerXI   = tacklerClub === homeClub ? hXI : aXI;
      const targetXI    = targetClub  === homeClub ? hXI : aXI;
      const tacklerPool = tacklerXI
        ? tacklerXI.map(id => tacklerClub.players.find(p => p.id === id)).filter(Boolean)
        : tacklerClub.players.slice(0, 11);
      const targetPool  = targetXI
        ? targetXI.map(id => targetClub.players.find(p => p.id === id)).filter(Boolean)
        : targetClub.players.slice(0, 11);
      const midDefs = tacklerPool.filter(p => ['CDM','CM','CB','RB','LB'].includes(p.pos));
      const tackler = midDefs.length ? pick(midDefs) : pick(tacklerPool);
      const target  = pick(targetPool.filter(p => p.pos !== 'GK'));
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
        let cardGiven = null;
        if (r < redP) {
          cardGiven = 'red';
          events.push({ min: min+1, type: 'red',    team, player: tackler });
        } else if (r < yellowP) {
          cardGiven = 'yellow';
          events.push({ min: min+1, type: 'yellow', team, player: tackler });
        }

        const targetTeam = tacklerClub === homeClub ? 'away' : 'home';
        // A foul defending your own box is a penalty — slide tackles inside the area
        // are the riskiest challenge in football, so they're weighted higher.
        const inBoxP = isSlide ? 0.15 : 0.08;
        if (Math.random() < inBoxP) {
          const taker = pickScorer(targetClub, targetXI);
          events.push({ min: min+1, type: 'penalty_awarded', team: targetTeam, player: tackler, cardGiven });
          const pr = Math.random();
          if (pr < 0.76) {
            events.push({ min: min+2, type: 'goal', team: targetTeam, player: taker, isPenalty: true });
            if (targetTeam === 'home') { hScore++; hShots++; hSOT++; } else { aScore++; aShots++; aSOT++; }
          } else if (pr < 0.90) {
            events.push({ min: min+2, type: 'shot_saved', team: targetTeam, player: taker, isPenalty: true });
            if (targetTeam === 'home') { hShots++; hSOT++; } else { aShots++; aSOT++; }
          } else {
            events.push({ min: min+2, type: 'shot_wide', team: targetTeam, player: taker, isPenalty: true });
            if (targetTeam === 'home') hShots++; else aShots++;
          }
        } else {
          events.push({ min: min+1, type: 'free_kick', team: targetTeam, player: tackler });
        }

        // Bad tackles can injure the target — tired legs are slower to react, so a tired
        // target is more likely to come off worse from the same tackle (shared curve
        // with the standalone fatigue-injury roll below).
        const injP = (isSlide ? 0.12 : 0.04) * fatigueInjuryMult(target?.fitness ?? 80);
        const alreadyHurt = events.some(ev => ev.type === 'injury' && ev.player?.id === target?.id);
        if (target && !target.injured && !alreadyHurt && Math.random() < injP) {
          const contactTypes = INJURY_TYPES.filter(t => t.severity === 'minor' || t.severity === 'moderate');
          events.push({ min: min+1, type: 'injury', team: targetTeam, player: target, injuryType: pickWeighted(contactTypes).id });
        }
      }
    };

    // Total challenges scale with combined pressing intensity — two high-press sides
    // contest the ball far more than two cautious low-blocks — and each individual
    // moment goes to whichever side doesn't have the ball, weighted by possession
    // (itself driven by ratings/formation/style above), not a flat coin flip.
    const PRESS_TACKLE_COUNT = { high: 6.5, medium: 5.5, low: 4.5 };
    const hPressCount = PRESS_TACKLE_COUNT[hTac.pressing] ?? 5.5;
    const aPressCount = PRESS_TACKLE_COUNT[aTac.pressing] ?? 5.5;
    const totalTackles = rand(Math.max(4, Math.round(hPressCount + aPressCount) - 2), Math.round(hPressCount + aPressCount) + 2);
    for (let i = 0; i < totalTackles; i++) {
      const homeAttacks = Math.random() * 100 < hPoss;
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

    // Shift everything after the 45th minute to make room for first-half stoppage,
    // then drop a little extra late drama into both stoppage windows — added time
    // isn't just empty clock-padding, it can produce the chance that decides a match.
    events.forEach(e => { if (e.min > 45) e.min += stoppage1; });
    const addStoppageDrama = (windowStart, windowEnd) => {
      if (windowEnd < windowStart) return;
      for (let i = 0; i < rand(0, 2); i++) {
        const min = rand(windowStart, windowEnd);
        const homeHasBall = Math.random() * 100 < hPoss;
        const team = homeHasBall ? 'home' : 'away';
        const club = homeHasBall ? homeClub : awayClub;
        const xi   = homeHasBall ? hXI : aXI;
        const scorer = pickScorer(club, xi);
        const r = Math.random();
        if (r < 0.12) {
          events.push({ min, type: 'goal', team, player: scorer, assist: Math.random() > 0.4 ? pickAssist(club, scorer, xi) : null });
          if (team === 'home') { hScore++; hShots++; hSOT++; } else { aScore++; aShots++; aSOT++; }
        } else if (r < 0.55) {
          events.push({ min, type: 'shot_saved', team, player: scorer });
          if (team === 'home') { hShots++; hSOT++; } else { aShots++; aSOT++; }
        } else {
          events.push({ min, type: Math.random() < 0.6 ? 'shot_wide' : 'shot_post', team, player: scorer });
          if (team === 'home') hShots++; else aShots++;
        }
      }
    };
    addStoppageDrama(46, 45 + stoppage1);
    addStoppageDrama(91 + stoppage1, matchEnd);
    events.sort((a, b) => a.min - b.min);

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
               shotsOnTarget: [hSOT, aSOT] },
      homeRatings: genRatings(homeClub, hXI, hWon, drew, aScore),
      awayRatings: genRatings(awayClub, aXI, !hWon && !drew, drew, hScore),
      stoppage1, stoppage2, matchEnd,
    };
  }

  /* ---- RESULT PROCESSING ---- */
  function recordResult(gameState, fixture, hScore, aScore, opts = {}) {
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

    // Track appearances for players who actually played — starters + subs who came on.
    // Only done when XI data is available (user's match or bulk sim with lineup).
    const trackApps = (xi, subbedOnIds) => {
      if (!xi) return;
      const played = new Set([...xi, ...(subbedOnIds || [])]);
      played.forEach(id => {
        // Find the player object across both clubs
        const p = gameState.clubs[fixture.home]?.players.find(x => x.id === id)
               || gameState.clubs[fixture.away]?.players.find(x => x.id === id);
        if (p) p.appearances = (p.appearances || 0) + 1;
      });
    };
    trackApps(opts.homeXI, opts.homeSubbedOn);
    trackApps(opts.awayXI, opts.awaySubbedOn);

    (fixture.events || []).forEach(ev => {
      if (ev.type === 'goal') {
        if (ev.player) ev.player.goals = (ev.player.goals||0)+1;
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
    recordResult(gameState, f, r.homeScore, r.awayScore, { homeXI: hXI, awayXI: aXI });
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
    // Do NOT advance currentDate here — leave it at the just-played match date so
    // the dashboard advance buttons (+1 Day / ⏩ Match) are visible between matches.
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
    let cupNext = null;
    if (gameState.cups) {
      Object.values(gameState.cups).forEach(cup => {
        if (cup.winner) return;
        const f = cup.fixtures.find(f => !f.played && (f.home === myId || f.away === myId));
        if (f && (!cupNext || f.date < cupNext.date)) cupNext = f;
      });
    }
    const candidates = [leagueNext, euroNext, cupNext].filter(Boolean);
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => a.date <= b.date ? a : b);
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
    const year = gameState.currentDate.getFullYear();
    const euDates = [
      new Date(year,8,16), new Date(year,8,30), new Date(year,9,21),
      new Date(year,10,4), new Date(year,10,25), new Date(year,11,9),
      new Date(year+1,0,20), new Date(year+1,0,28),
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
    const year = gameState.currentDate.getFullYear();
    const cupDefs = [
      { id:'fa_cup',         name:'FA Cup',          country:'England', date: new Date(year,10,8)  },
      { id:'copa_del_rey',   name:'Copa del Rey',    country:'Spain',   date: new Date(year,10,22) },
      { id:'coppa_italia',   name:'Coppa Italia',    country:'Italy',   date: new Date(year,10,15) },
      { id:'dfb_pokal',      name:'DFB-Pokal',       country:'Germany', date: new Date(year,9,29)  },
      { id:'coupe_de_france',name:'Coupe de France', country:'France',  date: new Date(year,10,22) },
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
          type: 'cup', stage: 'R1', roundIdx: 0 });
      }

      gameState.cups[cup.id] = {
        name: cup.name, country: cup.country, stage: 'R1',
        currentRound: 0,
        roundDates: [
          new Date(cup.date),
          new Date(cup.date.getFullYear(), cup.date.getMonth()+1, cup.date.getDate()),
          new Date(cup.date.getFullYear(), cup.date.getMonth()+2, cup.date.getDate()),
          new Date(cup.date.getFullYear(), cup.date.getMonth()+3, cup.date.getDate()),
          new Date(cup.date.getFullYear(), cup.date.getMonth()+4, cup.date.getDate()),
          new Date(cup.date.getFullYear(), cup.date.getMonth()+5, cup.date.getDate()),
        ],
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

  // Deterministic effective xG preview — all multipliers from simulateMatch but no randomness.
  // Used by the tactics panel to show live xG as options change.
  function previewEffectiveXG(homeClub, awayClub, hTac, aTac, hXI, aXI, hSlotPos, aSlotPos) {
    const { homeXG, awayXG } = calcMatchXG(homeClub, awayClub, hTac, aTac, hXI, aXI, hSlotPos, aSlotPos);
    const SHOOT_W = { GK: 0.05, DEF: 0.30, MID: 1.0, ATT: 3.0 };
    const hShootMod = 0.82 + (avgStatWeighted(homeClub, hXI, 'shooting', hSlotPos, SHOOT_W) / 65) * 0.18;
    const aShootMod = 0.82 + (avgStatWeighted(awayClub, aXI, 'shooting', aSlotPos, SHOOT_W) / 65) * 0.18;
    const hGK = findGK(homeClub, hXI);
    const aGK = findGK(awayClub,  aXI);
    const hGKMod    = 1.0 - (((hGK?.attrs?.gkReflexes || 65) - 65) / 65) * 0.14;
    const aGKMod    = 1.0 - (((aGK?.attrs?.gkReflexes || 65) - 65) / 65) * 0.14;
    const hGKPosMod = 1.0 - (((hGK?.attrs?.gkPositioning || 65) - 65) / 65) * 0.06;
    const aGKPosMod = 1.0 - (((aGK?.attrs?.gkPositioning || 65) - 65) / 65) * 0.06;
    const DEF_W = { GK: 0.20, DEF: 3.0, MID: 0.80, ATT: 0.05 };
    const hDefendMod = 1.0 - ((avgStatWeighted(homeClub, hXI, 'defending', hSlotPos, DEF_W) - 65) / 65) * 0.10;
    const aDefendMod = 1.0 - ((avgStatWeighted(awayClub, aXI, 'defending', aSlotPos, DEF_W) - 65) / 65) * 0.10;
    const PASS_W = { GK: 0.20, DEF: 0.40, MID: 2.0, ATT: 1.2 };
    const hPassMod  = 0.96 + (avgStatWeighted(homeClub, hXI, 'passing', hSlotPos, PASS_W) / 65) * 0.04;
    const aPassMod  = 0.96 + (avgStatWeighted(awayClub, aXI, 'passing', aSlotPos, PASS_W) / 65) * 0.04;
    const DRIB_W = { GK: 0.0, DEF: 0.10, MID: 0.80, ATT: 3.0 };
    const hDribMod  = 0.975 + (avgStatWeighted(homeClub, hXI, 'dribbling', hSlotPos, DRIB_W) / 65) * 0.025;
    const aDribMod  = 0.975 + (avgStatWeighted(awayClub, aXI, 'dribbling', aSlotPos, DRIB_W) / 65) * 0.025;
    const hPhysMod  = 0.980 + (avgStat(homeClub, hXI, 'physical', hSlotPos) / 65) * 0.020;
    const aPhysMod  = 0.980 + (avgStat(awayClub, aXI, 'physical', aSlotPos) / 65) * 0.020;
    const hChem = chemistryFactor(homeClub, hXI, hSlotPos);
    const aChem = chemistryFactor(awayClub,  aXI, aSlotPos);
    const hSPXG = setPieceXG(hTac, homeClub, hXI, hSlotPos) * spDefenseMult(aTac);
    const aSPXG = setPieceXG(aTac, awayClub, aXI, aSlotPos) * spDefenseMult(hTac);
    const hSPOpen = hTac.playSetPieces ? 0.95 : 1.0;
    const aSPOpen = aTac.playSetPieces ? 0.95 : 1.0;
    const hTWself = hTac.timeWasting ? 0.92 : 1.0;
    const hTWopp  = hTac.timeWasting ? 0.80 : 1.0;
    const aTWself = aTac.timeWasting ? 0.92 : 1.0;
    const aTWopp  = aTac.timeWasting ? 0.80 : 1.0;
    const hEff = Math.max(0.15, homeXG * hShootMod * hDribMod * hPassMod * hPhysMod * aGKMod * aGKPosMod * aDefendMod * hChem * hSPOpen * aTWopp * hTWself + hSPXG);
    const aEff = Math.max(0.15, awayXG * aShootMod * aDribMod * aPassMod * aPhysMod * hGKMod * hGKPosMod * hDefendMod * aChem * aSPOpen * hTWopp * aTWself + aSPXG);
    return { hEff, aEff };
  }

  return {
    generateSchedule, simulateMatch, calcMatchXG, recordResult,
    simulateSameDay, continueToNextFixture, simBulkFixture,
    getNextFixture, getLeagueTable, getMyPosition,
    setupEuropean, setupCups,
    getTransferMarket, isTransferWindowOpen,
    startNegotiation, evaluateFeeOffer, evaluateWageOffer, roundFee,
    buildCustomFormation, deriveAITactics, FORM_ATTRS, PRESS_PRESET, STYLE_ATK,
    oopFactor, posGroup, INJURY_TYPES, previewEffectiveXG,
  };

})();
