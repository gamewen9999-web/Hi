/* =============================================
   DATA.JS — Clubs, Players, Leagues
   ============================================= */

const LEAGUES = {
  premier_league: { name: 'Premier League', country: 'England', level: 1, championsLeague: 5, europaLeague: 2, conferenceLeague: 1, relegation: 3, autoPromotion: 0, playoffSpots: 0 },
  championship:   { name: 'Championship',   country: 'England', level: 2, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 3, autoPromotion: 2, playoffSpots: 4 },
  league_one:     { name: 'League One',     country: 'England', level: 3, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 4, autoPromotion: 2, playoffSpots: 4 },
  league_two:     { name: 'League Two',     country: 'England', level: 4, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 2, autoPromotion: 3, playoffSpots: 4 },
  national_league:{ name: 'National League',country: 'England', level: 5, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 2, autoPromotion: 1, playoffSpots: 4 },
  la_liga:        { name: 'La Liga',        country: 'Spain',   level: 1, championsLeague: 4, europaLeague: 3, conferenceLeague: 1, relegation: 3 },
  bundesliga:     { name: 'Bundesliga',     country: 'Germany', level: 1, championsLeague: 4, europaLeague: 3, conferenceLeague: 1, relegation: 3 },
  serie_a:        { name: 'Serie A',        country: 'Italy',   level: 1, championsLeague: 4, europaLeague: 3, conferenceLeague: 1, relegation: 3 },
  ligue_1:        { name: 'Ligue 1',        country: 'France',  level: 1, championsLeague: 3, europaLeague: 3, conferenceLeague: 2, relegation: 3 },
};

const CLUBS_DATA = [
  // Premier League (2025/26)
  { id:'man_city',    name:'Manchester City',   league:'premier_league', rep:5, color:'#6CABDD', budget:250, wage:5.2, sqRating:88 },
  { id:'arsenal',     name:'Arsenal',            league:'premier_league', rep:5, color:'#EF0107', budget:200, wage:4.8, sqRating:86 },
  { id:'liverpool',   name:'Liverpool',          league:'premier_league', rep:5, color:'#C8102E', budget:220, wage:5.0, sqRating:87 },
  { id:'chelsea',     name:'Chelsea',            league:'premier_league', rep:5, color:'#034694', budget:240, wage:5.1, sqRating:85 },
  { id:'man_utd',     name:'Manchester United',  league:'premier_league', rep:5, color:'#DA291C', budget:190, wage:4.6, sqRating:83 },
  { id:'tottenham',   name:'Tottenham Hotspur',  league:'premier_league', rep:4, color:'#132257', budget:150, wage:3.8, sqRating:82 },
  { id:'newcastle',   name:'Newcastle United',   league:'premier_league', rep:4, color:'#241F20', budget:160, wage:3.9, sqRating:81 },
  { id:'aston_villa', name:'Aston Villa',        league:'premier_league', rep:4, color:'#95BFE5', budget:120, wage:3.2, sqRating:80 },
  { id:'west_ham',    name:'West Ham United',    league:'premier_league', rep:3, color:'#7A263A', budget:80,  wage:2.5, sqRating:77 },
  { id:'brighton',    name:'Brighton & Hove',    league:'premier_league', rep:3, color:'#0057B8', budget:70,  wage:2.2, sqRating:76 },
  { id:'brentford',   name:'Brentford',          league:'premier_league', rep:3, color:'#D20000', budget:55,  wage:1.8, sqRating:75 },
  { id:'wolves',      name:'Wolverhampton',      league:'premier_league', rep:3, color:'#FDB913', budget:60,  wage:2.0, sqRating:74 },
  { id:'crystal',     name:'Crystal Palace',     league:'premier_league', rep:3, color:'#1B458F', budget:45,  wage:1.7, sqRating:74 },
  { id:'fulham',      name:'Fulham',             league:'premier_league', rep:3, color:'#CC0000', budget:55,  wage:1.8, sqRating:74 },
  { id:'everton',     name:'Everton',            league:'premier_league', rep:3, color:'#003399', budget:40,  wage:1.5, sqRating:72 },
  { id:'nottm_forest',name:'Nottingham Forest',  league:'premier_league', rep:3, color:'#DD0000', budget:55,  wage:1.7, sqRating:75 },
  { id:'bournemouth', name:'Bournemouth',        league:'premier_league', rep:3, color:'#DA291C', budget:40,  wage:1.4, sqRating:73 },
  { id:'leeds',       name:'Leeds United',       league:'premier_league', rep:3, color:'#1D428A', budget:45,  wage:1.6, sqRating:73 },
  { id:'burnley',     name:'Burnley',            league:'premier_league', rep:3, color:'#6C1D45', budget:35,  wage:1.4, sqRating:72 },
  { id:'sunderland',  name:'Sunderland',         league:'premier_league', rep:3, color:'#EB172B', budget:40,  wage:1.6, sqRating:73 },
  // Championship (2025/26)
  { id:'leicester',   name:'Leicester City',     league:'championship',   rep:3, color:'#003090', budget:25,  wage:1.2, sqRating:72 },
  { id:'ipswich',     name:'Ipswich Town',       league:'championship',   rep:2, color:'#3A64A3', budget:16,  wage:0.9, sqRating:70 },
  { id:'southampton', name:'Southampton',        league:'championship',   rep:2, color:'#D71920', budget:16,  wage:0.9, sqRating:70 },
  { id:'sheff_utd',   name:'Sheffield United',   league:'championship',   rep:3, color:'#EE2737', budget:14,  wage:0.75,sqRating:70 },
  { id:'middlesbrough',name:'Middlesbrough',     league:'championship',   rep:3, color:'#E32221', budget:13,  wage:0.72,sqRating:69 },
  { id:'coventry',    name:'Coventry City',      league:'championship',   rep:3, color:'#58ABDF', budget:12,  wage:0.7, sqRating:69 },
  { id:'west_brom',   name:'West Bromwich Albion',league:'championship',  rep:3, color:'#122F67', budget:12,  wage:0.68,sqRating:68 },
  { id:'stoke',       name:'Stoke City',         league:'championship',   rep:3, color:'#E03A3E', budget:11,  wage:0.65,sqRating:68 },
  { id:'norwich',     name:'Norwich City',       league:'championship',   rep:3, color:'#00A650', budget:11,  wage:0.65,sqRating:68 },
  { id:'derby',       name:'Derby County',       league:'championship',   rep:3, color:'#000000', budget:11,  wage:0.65,sqRating:68 },
  { id:'sheff_wed',   name:'Sheffield Wednesday',league:'championship',   rep:3, color:'#1B4FA3', budget:9,   wage:0.55,sqRating:66 },
  { id:'millwall',    name:'Millwall',           league:'championship',   rep:2, color:'#001D5E', budget:9,   wage:0.55,sqRating:66 },
  { id:'blackburn',   name:'Blackburn Rovers',   league:'championship',   rep:2, color:'#009EE0', budget:8,   wage:0.5, sqRating:65 },
  { id:'bristol_city',name:'Bristol City',       league:'championship',   rep:2, color:'#E21C38', budget:9,   wage:0.55,sqRating:66 },
  { id:'watford',     name:'Watford',            league:'championship',   rep:2, color:'#FBEE23', budget:8,   wage:0.5, sqRating:65 },
  { id:'swansea',     name:'Swansea City',       league:'championship',   rep:2, color:'#FFFFFF', budget:8,   wage:0.5, sqRating:65 },
  { id:'qpr',         name:'Queens Park Rangers',league:'championship',   rep:2, color:'#1D5BA4', budget:8,   wage:0.5, sqRating:65 },
  { id:'hull',        name:'Hull City',          league:'championship',   rep:2, color:'#F5A12D', budget:8,   wage:0.5, sqRating:65 },
  { id:'preston',     name:'Preston North End',  league:'championship',   rep:2, color:'#FFFFFF', budget:7,   wage:0.45,sqRating:64 },
  { id:'birmingham',  name:'Birmingham City',    league:'championship',   rep:2, color:'#0000FF', budget:9,   wage:0.55,sqRating:66 },
  { id:'oxford',      name:'Oxford United',      league:'championship',   rep:2, color:'#FFD700', budget:6,   wage:0.4, sqRating:63 },
  { id:'portsmouth',  name:'Portsmouth',         league:'championship',   rep:2, color:'#001489', budget:8,   wage:0.5, sqRating:65 },
  { id:'wrexham',     name:'Wrexham',            league:'championship',   rep:2, color:'#D6001C', budget:10,  wage:0.6, sqRating:66 },
  { id:'charlton',    name:'Charlton Athletic',  league:'championship',   rep:2, color:'#D4021D', budget:7,   wage:0.45,sqRating:64 },
  // League One (2025/26)
  { id:'cardiff',     name:'Cardiff City',       league:'league_one',     rep:2, color:'#0070B5', budget:5,   wage:0.3, sqRating:65 },
  { id:'luton',       name:'Luton Town',         league:'league_one',     rep:2, color:'#F78F1E', budget:5,   wage:0.3, sqRating:65 },
  { id:'plymouth',    name:'Plymouth Argyle',    league:'league_one',     rep:2, color:'#007B5E', budget:4.5, wage:0.28,sqRating:64 },
  { id:'rotherham',   name:'Rotherham United',   league:'league_one',     rep:2, color:'#D6001C', budget:4,   wage:0.25,sqRating:63 },
  { id:'blackpool',   name:'Blackpool',          league:'league_one',     rep:2, color:'#F58220', budget:4,   wage:0.25,sqRating:63 },
  { id:'bolton',      name:'Bolton Wanderers',   league:'league_one',     rep:2, color:'#FFFFFF', budget:4,   wage:0.25,sqRating:63 },
  { id:'huddersfield',name:'Huddersfield Town',  league:'league_one',     rep:2, color:'#0073CF', budget:5,   wage:0.3, sqRating:64 },
  { id:'wigan',       name:'Wigan Athletic',     league:'league_one',     rep:2, color:'#1B458F', budget:4,   wage:0.25,sqRating:63 },
  { id:'bradford',    name:'Bradford City',      league:'league_one',     rep:2, color:'#8A1538', budget:3,   wage:0.2, sqRating:61 },
  { id:'reading',     name:'Reading',            league:'league_one',     rep:2, color:'#004494', budget:5,   wage:0.3, sqRating:64 },
  { id:'barnsley',    name:'Barnsley',           league:'league_one',     rep:2, color:'#EE3524', budget:4,   wage:0.25,sqRating:62 },
  { id:'peterborough',name:'Peterborough Utd',   league:'league_one',     rep:2, color:'#034694', budget:4,   wage:0.25,sqRating:62 },
  { id:'stockport',   name:'Stockport County',   league:'league_one',     rep:1, color:'#003F6B', budget:3,   wage:0.2, sqRating:61 },
  { id:'doncaster',   name:'Doncaster Rovers',   league:'league_one',     rep:1, color:'#DD0000', budget:3,   wage:0.2, sqRating:61 },
  { id:'exeter',      name:'Exeter City',        league:'league_one',     rep:1, color:'#EC2227', budget:3,   wage:0.2, sqRating:61 },
  { id:'lincoln',     name:'Lincoln City',       league:'league_one',     rep:1, color:'#D6001C', budget:3,   wage:0.2, sqRating:62 },
  { id:'leyton_orient',name:'Leyton Orient',     league:'league_one',     rep:1, color:'#D6001C', budget:3,   wage:0.2, sqRating:62 },
  { id:'wycombe',     name:'Wycombe Wanderers',  league:'league_one',     rep:1, color:'#0B1A4A', budget:3,   wage:0.2, sqRating:62 },
  { id:'burton',      name:'Burton Albion',      league:'league_one',     rep:1, color:'#F7C600', budget:3,   wage:0.2, sqRating:60 },
  { id:'stevenage',   name:'Stevenage',          league:'league_one',     rep:1, color:'#FF0000', budget:2,   wage:0.15,sqRating:59 },
  { id:'mansfield',   name:'Mansfield Town',     league:'league_one',     rep:1, color:'#FFD200', budget:3,   wage:0.2, sqRating:61 },
  { id:'northampton', name:'Northampton Town',   league:'league_one',     rep:1, color:'#7C2529', budget:2.5, wage:0.18,sqRating:60 },
  { id:'port_vale',   name:'Port Vale',          league:'league_one',     rep:1, color:'#FFFFFF', budget:2.5, wage:0.18,sqRating:60 },
  { id:'afc_wimbledon',name:'AFC Wimbledon',     league:'league_one',     rep:1, color:'#003DA5', budget:2.5, wage:0.18,sqRating:60 },
  // League Two (2025/26)
  { id:'notts_county',name:'Notts County',       league:'league_two',     rep:1, color:'#000000', budget:1.5, wage:0.1, sqRating:58 },
  { id:'grimsby',     name:'Grimsby Town',       league:'league_two',     rep:1, color:'#000000', budget:1.5, wage:0.1, sqRating:58 },
  { id:'swindon',     name:'Swindon Town',       league:'league_two',     rep:1, color:'#CC0000', budget:1.5, wage:0.1, sqRating:57 },
  { id:'mk_dons',     name:'MK Dons',            league:'league_two',     rep:1, color:'#D6001C', budget:1.5, wage:0.1, sqRating:57 },
  { id:'bristol_rovers',name:'Bristol Rovers',   league:'league_two',     rep:1, color:'#004A97', budget:1.8, wage:0.12,sqRating:59 },
  { id:'cambridge',   name:'Cambridge United',   league:'league_two',     rep:1, color:'#F5A623', budget:1.8, wage:0.12,sqRating:59 },
  { id:'shrewsbury',  name:'Shrewsbury Town',    league:'league_two',     rep:1, color:'#0C4899', budget:1.8, wage:0.12,sqRating:59 },
  { id:'tranmere',    name:'Tranmere Rovers',    league:'league_two',     rep:1, color:'#FFFFFF', budget:1,   wage:0.08,sqRating:56 },
  { id:'colchester',  name:'Colchester United',  league:'league_two',     rep:1, color:'#0000FF', budget:1.5, wage:0.1, sqRating:57 },
  { id:'walsall',     name:'Walsall',            league:'league_two',     rep:1, color:'#D6001C', budget:1.5, wage:0.1, sqRating:57 },
  { id:'oldham',      name:'Oldham Athletic',    league:'league_two',     rep:1, color:'#004A97', budget:1.3, wage:0.09,sqRating:56 },
  { id:'chesterfield',name:'Chesterfield',       league:'league_two',     rep:1, color:'#1D5BA4', budget:1.3, wage:0.09,sqRating:56 },
  { id:'gillingham',  name:'Gillingham',         league:'league_two',     rep:1, color:'#003DA5', budget:1.2, wage:0.09,sqRating:56 },
  { id:'cheltenham',  name:'Cheltenham Town',    league:'league_two',     rep:1, color:'#D6001C', budget:1.2, wage:0.09,sqRating:56 },
  { id:'harrogate',   name:'Harrogate Town',     league:'league_two',     rep:1, color:'#F8C300', budget:1,   wage:0.08,sqRating:55 },
  { id:'crawley',     name:'Crawley Town',       league:'league_two',     rep:1, color:'#CC0000', budget:1,   wage:0.08,sqRating:55 },
  { id:'salford',     name:'Salford City',       league:'league_two',     rep:1, color:'#D6001C', budget:1.5, wage:0.1, sqRating:57 },
  { id:'barnet',      name:'Barnet',             league:'league_two',     rep:1, color:'#F58220', budget:1.2, wage:0.09,sqRating:56 },
  { id:'newport',     name:'Newport County',     league:'league_two',     rep:1, color:'#F7A32F', budget:1,   wage:0.08,sqRating:54 },
  { id:'fleetwood',   name:'Fleetwood Town',     league:'league_two',     rep:1, color:'#D6001C', budget:1,   wage:0.08,sqRating:55 },
  { id:'accrington',  name:'Accrington Stanley', league:'league_two',     rep:1, color:'#D6001C', budget:1,   wage:0.08,sqRating:55 },
  { id:'crewe',       name:'Crewe Alexandra',    league:'league_two',     rep:1, color:'#D6001C', budget:1,   wage:0.08,sqRating:55 },
  { id:'bromley',     name:'Bromley',            league:'league_two',     rep:1, color:'#FFFFFF', budget:1,   wage:0.08,sqRating:55 },
  { id:'barrow',      name:'Barrow',             league:'league_two',     rep:1, color:'#003DA5', budget:1,   wage:0.08,sqRating:54 },
  // National League (2025/26) — level 5, avg sqRating ~44
  { id:'carlisle',    name:'Carlisle United',    league:'national_league', rep:1, color:'#003DA5', budget:0.6, wage:0.05,sqRating:53 },
  { id:'morecambe',   name:'Morecambe',          league:'national_league', rep:1, color:'#D6001C', budget:0.5, wage:0.05,sqRating:52 },
  { id:'york',        name:'York City',          league:'national_league', rep:1, color:'#D00027', budget:0.5, wage:0.05,sqRating:53 },
  { id:'forest_green',name:'Forest Green Rovers',league:'national_league', rep:1, color:'#0B6E4F', budget:0.5, wage:0.05,sqRating:52 },
  { id:'southend',    name:'Southend United',    league:'national_league', rep:1, color:'#003DA5', budget:0.5, wage:0.05,sqRating:52 },
  { id:'scunthorpe',  name:'Scunthorpe United',  league:'national_league', rep:1, color:'#D6001C', budget:0.4, wage:0.04,sqRating:51 },
  { id:'halifax',     name:'FC Halifax Town',    league:'national_league', rep:1, color:'#003DA5', budget:0.4, wage:0.04,sqRating:51 },
  { id:'altrincham',  name:'Altrincham',         league:'national_league', rep:1, color:'#FF0000', budget:0.3, wage:0.04,sqRating:51 },
  { id:'gateshead',   name:'Gateshead',          league:'national_league', rep:1, color:'#000000', budget:0.3, wage:0.04,sqRating:50 },
  { id:'hartlepool',  name:'Hartlepool United',  league:'national_league', rep:1, color:'#003DA5', budget:0.4, wage:0.04,sqRating:51 },
  { id:'rochdale',    name:'Rochdale',           league:'national_league', rep:1, color:'#003DA5', budget:0.4, wage:0.04,sqRating:51 },
  { id:'solihull',    name:'Solihull Moors',     league:'national_league', rep:1, color:'#F58220', budget:0.4, wage:0.04,sqRating:51 },
  { id:'yeovil',      name:'Yeovil Town',        league:'national_league', rep:1, color:'#0B6E4F', budget:0.4, wage:0.04,sqRating:51 },
  { id:'aldershot',   name:'Aldershot Town',     league:'national_league', rep:1, color:'#D6001C', budget:0.4, wage:0.04,sqRating:51 },
  { id:'eastleigh',   name:'Eastleigh',          league:'national_league', rep:1, color:'#003DA5', budget:0.3, wage:0.04,sqRating:50 },
  { id:'sutton',      name:'Sutton United',      league:'national_league', rep:1, color:'#FFB300', budget:0.3, wage:0.04,sqRating:50 },
  { id:'woking',      name:'Woking',             league:'national_league', rep:1, color:'#D6001C', budget:0.3, wage:0.04,sqRating:50 },
  { id:'boston_utd',  name:'Boston United',      league:'national_league', rep:1, color:'#D6001C', budget:0.3, wage:0.04,sqRating:50 },
  { id:'braintree',   name:'Braintree Town',     league:'national_league', rep:1, color:'#F58220', budget:0.3, wage:0.04,sqRating:49 },
  { id:'wealdstone',  name:'Wealdstone',         league:'national_league', rep:1, color:'#003DA5', budget:0.3, wage:0.04,sqRating:49 },
  { id:'tamworth',    name:'Tamworth',           league:'national_league', rep:1, color:'#D6001C', budget:0.3, wage:0.04,sqRating:49 },
  { id:'truro',       name:'Truro City',         league:'national_league', rep:1, color:'#FFFFFF', budget:0.3, wage:0.04,sqRating:49 },
  { id:'brackley',    name:'Brackley Town',      league:'national_league', rep:1, color:'#D6001C', budget:0.3, wage:0.04,sqRating:48 },
  { id:'boreham_wood',name:'Boreham Wood',       league:'national_league', rep:1, color:'#FFFFFF', budget:0.3, wage:0.04,sqRating:49 },
  // La Liga
  { id:'real_madrid', name:'Real Madrid',        league:'la_liga',        rep:5, color:'#FEBE10', budget:180, wage:4.2, sqRating:89 },
  { id:'barcelona',   name:'Barcelona',          league:'la_liga',        rep:5, color:'#A50044', budget:160, wage:3.8, sqRating:87 },
  { id:'atletico',    name:'Atletico Madrid',    league:'la_liga',        rep:5, color:'#CB3524', budget:90,  wage:2.4, sqRating:84 },
  { id:'sevilla',     name:'Sevilla',            league:'la_liga',        rep:4, color:'#D4021D', budget:44,  wage:1.4, sqRating:79 },
  { id:'villarreal',  name:'Villarreal',         league:'la_liga',        rep:4, color:'#FFE135', budget:40,  wage:1.3, sqRating:78 },
  { id:'real_sociedad',name:'Real Sociedad',     league:'la_liga',        rep:3, color:'#0067B1', budget:29,  wage:0.95,sqRating:76 },
  { id:'betis',       name:'Real Betis',         league:'la_liga',        rep:3, color:'#00954C', budget:27,  wage:0.9, sqRating:75 },
  { id:'valencia',    name:'Valencia',           league:'la_liga',        rep:4, color:'#F1B80E', budget:23,  wage:0.8, sqRating:73 },
  { id:'athletic',    name:'Athletic Club',      league:'la_liga',        rep:3, color:'#EE2523', budget:23,  wage:0.8, sqRating:74 },
  { id:'getafe',      name:'Getafe',             league:'la_liga',        rep:2, color:'#005A9C', budget:12,  wage:0.5, sqRating:69 },
  { id:'osasuna',     name:'Osasuna',            league:'la_liga',        rep:2, color:'#D0021B', budget:9,   wage:0.38,sqRating:67 },
  { id:'girona',      name:'Girona',             league:'la_liga',        rep:2, color:'#CC0000', budget:13,  wage:0.52,sqRating:70 },
  { id:'alaves',      name:'Deportivo Alavés',   league:'la_liga',        rep:2, color:'#1D59A6', budget:7,   wage:0.32,sqRating:66 },
  { id:'celta',       name:'Celta Vigo',         league:'la_liga',        rep:2, color:'#8CBFD4', budget:11,  wage:0.44,sqRating:68 },
  { id:'mallorca',    name:'RCD Mallorca',       league:'la_liga',        rep:2, color:'#D40000', budget:7,   wage:0.32,sqRating:65 },
  { id:'espanyol',    name:'Espanyol',           league:'la_liga',        rep:2, color:'#0070B8', budget:9,   wage:0.38,sqRating:67 },
  { id:'rayo',        name:'Rayo Vallecano',     league:'la_liga',        rep:2, color:'#DA291C', budget:6,   wage:0.28,sqRating:65 },
  { id:'levante',     name:'Levante',            league:'la_liga',        rep:2, color:'#9E1B32', budget:6,   wage:0.28,sqRating:64 },
  { id:'elche',       name:'Elche',              league:'la_liga',        rep:2, color:'#00913F', budget:6,   wage:0.28,sqRating:64 },
  { id:'oviedo',      name:'Real Oviedo',        league:'la_liga',        rep:2, color:'#0033A0', budget:5,   wage:0.24,sqRating:63 },
  // Bundesliga
  { id:'bayern',      name:'Bayern Munich',      league:'bundesliga',     rep:5, color:'#DC052D', budget:150, wage:3.8, sqRating:88 },
  { id:'dortmund',    name:'Borussia Dortmund',  league:'bundesliga',     rep:5, color:'#FDE100', budget:100, wage:2.9, sqRating:84 },
  { id:'leverkusen',  name:'Bayer Leverkusen',   league:'bundesliga',     rep:4, color:'#E32221', budget:70,  wage:2.3, sqRating:83 },
  { id:'rb_leipzig',  name:'RB Leipzig',         league:'bundesliga',     rep:4, color:'#DD0741', budget:65,  wage:2.1, sqRating:82 },
  { id:'frankfurt',   name:'Eintracht Frankfurt',league:'bundesliga',     rep:4, color:'#E2001A', budget:46,  wage:1.6, sqRating:79 },
  { id:'wolfsburg',   name:'VfL Wolfsburg',      league:'bundesliga',     rep:3, color:'#65B32E', budget:36,  wage:1.2, sqRating:76 },
  { id:'gladbach',    name:"Borussia M'gladbach", league:'bundesliga',    rep:3, color:'#000000', budget:31,  wage:1.05,sqRating:75 },
  { id:'stuttgart',   name:'VfB Stuttgart',      league:'bundesliga',     rep:3, color:'#E32221', budget:34,  wage:1.1, sqRating:77 },
  { id:'hoffenheim',  name:'Hoffenheim',         league:'bundesliga',     rep:3, color:'#1869AE', budget:22,  wage:0.85,sqRating:73 },
  { id:'werder',      name:'Werder Bremen',      league:'bundesliga',     rep:3, color:'#1D9053', budget:18,  wage:0.75,sqRating:72 },
  { id:'freiburg',    name:'SC Freiburg',        league:'bundesliga',     rep:3, color:'#D40000', budget:18,  wage:0.7, sqRating:72 },
  { id:'augsburg',    name:'FC Augsburg',        league:'bundesliga',     rep:2, color:'#005A9C', budget:12,  wage:0.5, sqRating:68 },
  { id:'heidenheim',  name:'FC Heidenheim',      league:'bundesliga',     rep:2, color:'#D40000', budget:7,   wage:0.32,sqRating:65 },
  { id:'mainz',       name:'FSV Mainz 05',       league:'bundesliga',     rep:3, color:'#CC0000', budget:15,  wage:0.6, sqRating:71 },
  { id:'union_berlin',name:'Union Berlin',       league:'bundesliga',     rep:3, color:'#EB1923', budget:15,  wage:0.6, sqRating:71 },
  { id:'st_pauli',    name:'FC St. Pauli',       league:'bundesliga',     rep:2, color:'#6B0E1E', budget:6,   wage:0.28,sqRating:64 },
  { id:'hamburg',     name:'Hamburger SV',       league:'bundesliga',     rep:3, color:'#0A3A6B', budget:15,  wage:0.6, sqRating:70 },
  { id:'koln',        name:'1. FC Köln',         league:'bundesliga',     rep:3, color:'#D6001C', budget:13,  wage:0.55,sqRating:69 },
  // Serie A
  { id:'inter',       name:'Inter Milan',        league:'serie_a',        rep:5, color:'#010E80', budget:120, wage:3.5, sqRating:86 },
  { id:'juventus',    name:'Juventus',           league:'serie_a',        rep:5, color:'#000000', budget:110, wage:3.2, sqRating:84 },
  { id:'ac_milan',    name:'AC Milan',           league:'serie_a',        rep:5, color:'#FB090B', budget:100, wage:3.0, sqRating:83 },
  { id:'napoli',      name:'Napoli',             league:'serie_a',        rep:5, color:'#087AC2', budget:90,  wage:2.8, sqRating:83 },
  { id:'roma',        name:'AS Roma',            league:'serie_a',        rep:4, color:'#8E1F2F', budget:65,  wage:2.1, sqRating:80 },
  { id:'lazio',       name:'Lazio',              league:'serie_a',        rep:4, color:'#87D8F7', budget:55,  wage:1.8, sqRating:78 },
  { id:'atalanta',    name:'Atalanta',           league:'serie_a',        rep:4, color:'#1E71B8', budget:60,  wage:2.0, sqRating:80 },
  { id:'fiorentina',  name:'Fiorentina',         league:'serie_a',        rep:3, color:'#6A0DAD', budget:38,  wage:1.4, sqRating:76 },
  { id:'bologna',     name:'Bologna',            league:'serie_a',        rep:3, color:'#00447C', budget:28,  wage:1.05,sqRating:75 },
  { id:'torino',      name:'Torino',             league:'serie_a',        rep:3, color:'#8B0000', budget:18,  wage:0.75,sqRating:72 },
  { id:'udinese',     name:'Udinese',            league:'serie_a',        rep:2, color:'#000000', budget:12,  wage:0.5, sqRating:69 },
  { id:'genoa',       name:'Genoa',              league:'serie_a',        rep:2, color:'#CC0000', budget:12,  wage:0.5, sqRating:68 },
  { id:'como',        name:'Como',               league:'serie_a',        rep:2, color:'#1B458F', budget:15,  wage:0.6, sqRating:69 },
  { id:'parma',       name:'Parma',              league:'serie_a',        rep:2, color:'#FFCC00', budget:10,  wage:0.44,sqRating:67 },
  { id:'cagliari',    name:'Cagliari',           league:'serie_a',        rep:2, color:'#CC0000', budget:9,   wage:0.38,sqRating:66 },
  { id:'lecce',       name:'Lecce',              league:'serie_a',        rep:2, color:'#F5A623', budget:7,   wage:0.32,sqRating:64 },
  { id:'verona',      name:'Hellas Verona',      league:'serie_a',        rep:2, color:'#1B458F', budget:9,   wage:0.38,sqRating:65 },
  { id:'sassuolo',    name:'Sassuolo',           league:'serie_a',        rep:2, color:'#00A752', budget:10,  wage:0.44,sqRating:67 },
  { id:'pisa',        name:'Pisa',               league:'serie_a',        rep:2, color:'#0A3A6B', budget:7,   wage:0.32,sqRating:64 },
  { id:'cremonese',   name:'Cremonese',          league:'serie_a',        rep:2, color:'#D6001C', budget:7,   wage:0.32,sqRating:64 },
  // Ligue 1
  { id:'psg',         name:'Paris Saint-Germain',league:'ligue_1',        rep:5, color:'#004170', budget:175, wage:4.5, sqRating:88 },
  { id:'marseille',   name:'Olympique Marseille',league:'ligue_1',        rep:4, color:'#009AC7', budget:54,  wage:1.8, sqRating:78 },
  { id:'lyon',        name:'Olympique Lyonnais', league:'ligue_1',        rep:4, color:'#CC0000', budget:47,  wage:1.6, sqRating:77 },
  { id:'monaco',      name:'AS Monaco',          league:'ligue_1',        rep:4, color:'#E4002B', budget:65,  wage:2.0, sqRating:79 },
  { id:'lille',       name:'LOSC Lille',         league:'ligue_1',        rep:4, color:'#E01E13', budget:33,  wage:1.1, sqRating:76 },
  { id:'nice',        name:'OGC Nice',           league:'ligue_1',        rep:3, color:'#CC0000', budget:29,  wage:1.0, sqRating:74 },
  { id:'lens',        name:'RC Lens',            league:'ligue_1',        rep:3, color:'#E4002B', budget:24,  wage:0.82,sqRating:73 },
  { id:'rennes',      name:'Stade Rennais',      league:'ligue_1',        rep:3, color:'#000000', budget:24,  wage:0.82,sqRating:73 },
  { id:'strasbourg',  name:'Strasbourg',         league:'ligue_1',        rep:2, color:'#003FA5', budget:13,  wage:0.55,sqRating:69 },
  { id:'nantes',      name:'FC Nantes',          league:'ligue_1',        rep:3, color:'#F5A623', budget:16,  wage:0.65,sqRating:71 },
  { id:'toulouse',    name:'Toulouse FC',        league:'ligue_1',        rep:2, color:'#6A0DAD', budget:11,  wage:0.46,sqRating:68 },
  { id:'brest',       name:'Stade Brestois',     league:'ligue_1',        rep:2, color:'#CC0000', budget:9,   wage:0.38,sqRating:67 },
  { id:'auxerre',     name:'AJ Auxerre',         league:'ligue_1',        rep:2, color:'#003DA5', budget:7,   wage:0.32,sqRating:65 },
  { id:'angers',      name:'Angers SCO',         league:'ligue_1',        rep:2, color:'#000000', budget:7,   wage:0.32,sqRating:64 },
  { id:'havre',       name:'Le Havre',           league:'ligue_1',        rep:2, color:'#003DA5', budget:6,   wage:0.28,sqRating:63 },
  { id:'lorient',     name:'FC Lorient',         league:'ligue_1',        rep:2, color:'#F58220', budget:8,   wage:0.38,sqRating:66 },
  { id:'paris_fc',    name:'Paris FC',           league:'ligue_1',        rep:2, color:'#0033A0', budget:11,  wage:0.46,sqRating:67 },
  { id:'metz',        name:'FC Metz',            league:'ligue_1',        rep:2, color:'#6B0E1E', budget:6,   wage:0.28,sqRating:63 },
  // European clubs (outside the big 5) — Champions League only, not playable
  { id:'benfica',     name:'Benfica',            league:'european', country:'Portugal',    european:true, rep:4, color:'#E20E0E', budget:45, wage:1.8, sqRating:81 },
  { id:'sporting_cp', name:'Sporting CP',        league:'european', country:'Portugal',    european:true, rep:4, color:'#008057', budget:40, wage:1.6, sqRating:80 },
  { id:'porto',       name:'FC Porto',           league:'european', country:'Portugal',    european:true, rep:4, color:'#00428C', budget:40, wage:1.6, sqRating:80 },
  { id:'ajax',        name:'Ajax',               league:'european', country:'Netherlands', european:true, rep:4, color:'#D2122E', budget:35, wage:1.5, sqRating:78 },
  { id:'psv',         name:'PSV Eindhoven',      league:'european', country:'Netherlands', european:true, rep:3, color:'#ED1C24', budget:30, wage:1.3, sqRating:78 },
  { id:'feyenoord',   name:'Feyenoord',          league:'european', country:'Netherlands', european:true, rep:3, color:'#E30613', budget:28, wage:1.2, sqRating:77 },
  { id:'galatasaray', name:'Galatasaray',        league:'european', country:'Turkey',      european:true, rep:3, color:'#A90432', budget:30, wage:1.3, sqRating:77 },
  { id:'fenerbahce',  name:'Fenerbahçe',         league:'european', country:'Turkey',      european:true, rep:3, color:'#154284', budget:30, wage:1.3, sqRating:77 },
  { id:'celtic',      name:'Celtic',             league:'european', country:'Scotland',    european:true, rep:3, color:'#018749', budget:25, wage:1.1, sqRating:76 },
  { id:'rangers',     name:'Rangers',            league:'european', country:'Scotland',    european:true, rep:3, color:'#1B458F', budget:22, wage:1.0, sqRating:75 },
  { id:'salzburg',    name:'RB Salzburg',        league:'european', country:'Austria',     european:true, rep:3, color:'#D40026', budget:25, wage:1.1, sqRating:76 },
  { id:'club_brugge', name:'Club Brugge',        league:'european', country:'Belgium',     european:true, rep:3, color:'#005BAA', budget:22, wage:1.0, sqRating:75 },
  { id:'shakhtar',    name:'Shakhtar Donetsk',   league:'european', country:'Ukraine',     european:true, rep:3, color:'#F47B20', budget:20, wage:0.9, sqRating:75 },
  { id:'olympiacos',  name:'Olympiacos',         league:'european', country:'Greece',      european:true, rep:3, color:'#C8102E', budget:20, wage:0.9, sqRating:75 },
  { id:'dinamo_zagreb',name:'Dinamo Zagreb',     league:'european', country:'Croatia',     european:true, rep:2, color:'#1067B1', budget:15, wage:0.7, sqRating:73 },
  { id:'young_boys',  name:'BSC Young Boys',     league:'european', country:'Switzerland', european:true, rep:2, color:'#FFD500', budget:15, wage:0.7, sqRating:73 },
  // Europa League clubs (outside the big 5) — 22 clubs, not playable
  { id:'braga',        name:'SC Braga',            league:'european', country:'Portugal',   european:true, europeanComp:'europa_league', rep:3, color:'#E2001A', budget:22, wage:1.0, sqRating:75 },
  { id:'paok',         name:'PAOK',                league:'european', country:'Greece',      european:true, europeanComp:'europa_league', rep:3, color:'#000000', budget:18, wage:0.85,sqRating:74 },
  { id:'anderlecht',   name:'Anderlecht',          league:'european', country:'Belgium',     european:true, europeanComp:'europa_league', rep:3, color:'#582C83', budget:18, wage:0.85,sqRating:74 },
  { id:'union_sg',     name:'Union Saint-Gilloise',league:'european', country:'Belgium',     european:true, europeanComp:'europa_league', rep:3, color:'#FFE600', budget:16, wage:0.8, sqRating:74 },
  { id:'besiktas',     name:'Beşiktaş',            league:'european', country:'Turkey',      european:true, europeanComp:'europa_league', rep:3, color:'#000000', budget:20, wage:0.9, sqRating:74 },
  { id:'slavia_prague',name:'Slavia Prague',       league:'european', country:'Czechia',     european:true, europeanComp:'europa_league', rep:3, color:'#D7141A', budget:15, wage:0.7, sqRating:73 },
  { id:'sparta_prague',name:'Sparta Prague',       league:'european', country:'Czechia',     european:true, europeanComp:'europa_league', rep:2, color:'#8B1A1A', budget:14, wage:0.68,sqRating:73 },
  { id:'viktoria_plzen',name:'Viktoria Plzeň',     league:'european', country:'Czechia',     european:true, europeanComp:'europa_league', rep:2, color:'#0046AD', budget:12, wage:0.6, sqRating:72 },
  { id:'ferencvaros',  name:'Ferencváros',         league:'european', country:'Hungary',     european:true, europeanComp:'europa_league', rep:2, color:'#0A9648', budget:13, wage:0.62,sqRating:72 },
  { id:'fcsb',         name:'FCSB',                league:'european', country:'Romania',     european:true, europeanComp:'europa_league', rep:2, color:'#D5001C', budget:12, wage:0.6, sqRating:72 },
  { id:'dynamo_kyiv',  name:'Dynamo Kyiv',         league:'european', country:'Ukraine',     european:true, europeanComp:'europa_league', rep:3, color:'#005BAC', budget:15, wage:0.7, sqRating:73 },
  { id:'red_star',     name:'Red Star Belgrade',   league:'european', country:'Serbia',      european:true, europeanComp:'europa_league', rep:3, color:'#D7141A', budget:15, wage:0.7, sqRating:73 },
  { id:'ludogorets',   name:'Ludogorets Razgrad',  league:'european', country:'Bulgaria',    european:true, europeanComp:'europa_league', rep:2, color:'#006C3B', budget:11, wage:0.55,sqRating:72 },
  { id:'qarabag',      name:'Qarabağ',             league:'european', country:'Azerbaijan',  european:true, europeanComp:'europa_league', rep:2, color:'#000000', budget:11, wage:0.55,sqRating:72 },
  { id:'midtjylland',  name:'FC Midtjylland',      league:'european', country:'Denmark',     european:true, europeanComp:'europa_league', rep:2, color:'#000000', budget:13, wage:0.62,sqRating:72 },
  { id:'malmo',        name:'Malmö FF',            league:'european', country:'Sweden',      european:true, europeanComp:'europa_league', rep:2, color:'#0099D8', budget:12, wage:0.6, sqRating:72 },
  { id:'elfsborg',     name:'IF Elfsborg',         league:'european', country:'Sweden',      european:true, europeanComp:'europa_league', rep:2, color:'#FFCD00', budget:10, wage:0.5, sqRating:71 },
  { id:'bodo_glimt',   name:'Bodø/Glimt',          league:'european', country:'Norway',      european:true, europeanComp:'europa_league', rep:2, color:'#FFD200', budget:11, wage:0.55,sqRating:72 },
  { id:'twente',       name:'FC Twente',           league:'european', country:'Netherlands', european:true, europeanComp:'europa_league', rep:2, color:'#E1001A', budget:13, wage:0.62,sqRating:72 },
  { id:'az_alkmaar',   name:'AZ Alkmaar',          league:'european', country:'Netherlands', european:true, europeanComp:'europa_league', rep:3, color:'#E1001A', budget:15, wage:0.7, sqRating:73 },
  { id:'rapid_wien',   name:'Rapid Wien',          league:'european', country:'Austria',     european:true, europeanComp:'europa_league', rep:2, color:'#008C45', budget:11, wage:0.55,sqRating:72 },
  { id:'maccabi_tel_aviv',name:'Maccabi Tel Aviv', league:'european', country:'Israel',      european:true, europeanComp:'europa_league', rep:2, color:'#FCD800', budget:11, wage:0.55,sqRating:72 },
  // Conference League clubs (outside the big 5) — 30 clubs, not playable
  { id:'aek_athens',  name:'AEK Athens',          league:'european', country:'Greece',         european:true, europeanComp:'conference_league', rep:3, color:'#FFD200', budget:20, wage:0.9, sqRating:74 },
  { id:'samsunspor',  name:'Samsunspor',          league:'european', country:'Turkey',         european:true, europeanComp:'conference_league', rep:2, color:'#D6001C', budget:16, wage:0.8, sqRating:72 },
  { id:'legia',       name:'Legia Warsaw',        league:'european', country:'Poland',         european:true, europeanComp:'conference_league', rep:3, color:'#006847', budget:16, wage:0.8, sqRating:73 },
  { id:'rijeka',      name:'HNK Rijeka',          league:'european', country:'Croatia',        european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:13, wage:0.62,sqRating:72 },
  { id:'aberdeen',    name:'Aberdeen',            league:'european', country:'Scotland',       european:true, europeanComp:'conference_league', rep:2, color:'#E03A3E', budget:14, wage:0.7, sqRating:72 },
  { id:'omonia',      name:'Omonia Nicosia',      league:'european', country:'Cyprus',         european:true, europeanComp:'conference_league', rep:2, color:'#00843D', budget:11, wage:0.55,sqRating:71 },
  { id:'craiova',     name:'Universitatea Craiova',league:'european',country:'Romania',        european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:11, wage:0.55,sqRating:71 },
  { id:'celje',       name:'NK Celje',            league:'european', country:'Slovenia',       european:true, europeanComp:'conference_league', rep:2, color:'#FFD200', budget:9,  wage:0.45,sqRating:70 },
  { id:'lausanne',    name:'Lausanne-Sport',      league:'european', country:'Switzerland',    european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:10, wage:0.5, sqRating:70 },
  { id:'sigma',       name:'Sigma Olomouc',       league:'european', country:'Czechia',        european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:9,  wage:0.45,sqRating:70 },
  { id:'shamrock',    name:'Shamrock Rovers',     league:'european', country:'Ireland',        european:true, europeanComp:'conference_league', rep:2, color:'#00843D', budget:7,  wage:0.4, sqRating:69 },
  { id:'drita',       name:'FC Drita',            league:'european', country:'Kosovo',         european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:5,  wage:0.3, sqRating:67 },
  { id:'breidablik',  name:'Breiðablik',          league:'european', country:'Iceland',        european:true, europeanComp:'conference_league', rep:1, color:'#00843D', budget:5,  wage:0.3, sqRating:67 },
  { id:'kups',        name:'KuPS',                league:'european', country:'Finland',        european:true, europeanComp:'conference_league', rep:1, color:'#FFD200', budget:6,  wage:0.35,sqRating:68 },
  { id:'hacken',      name:'BK Häcken',           league:'european', country:'Sweden',         european:true, europeanComp:'conference_league', rep:2, color:'#FFD200', budget:9,  wage:0.45,sqRating:70 },
  { id:'hamrun',      name:'Hamrun Spartans',     league:'european', country:'Malta',          european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:4,  wage:0.25,sqRating:66 },
  { id:'lincoln_ri',  name:'Lincoln Red Imps',    league:'european', country:'Gibraltar',      european:true, europeanComp:'conference_league', rep:1, color:'#000000', budget:3,  wage:0.2, sqRating:64 },
  { id:'shkendija',   name:'Shkëndija',           league:'european', country:'North Macedonia',european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:5,  wage:0.3, sqRating:67 },
  { id:'zrinjski',    name:'Zrinjski Mostar',     league:'european', country:'Bosnia',         european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:6,  wage:0.35,sqRating:68 },
  { id:'noah',        name:'FC Noah',             league:'european', country:'Armenia',        european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:5,  wage:0.3, sqRating:67 },
  { id:'slovan',      name:'Slovan Bratislava',   league:'european', country:'Slovakia',       european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:10, wage:0.5, sqRating:71 },
  { id:'aek_larnaca', name:'AEK Larnaca',         league:'european', country:'Cyprus',         european:true, europeanComp:'conference_league', rep:2, color:'#FFD200', budget:9,  wage:0.45,sqRating:70 },
  { id:'lech_poznan', name:'Lech Poznań',         league:'european', country:'Poland',         european:true, europeanComp:'conference_league', rep:2, color:'#0046AD', budget:11, wage:0.55,sqRating:71 },
  { id:'jagiellonia', name:'Jagiellonia',         league:'european', country:'Poland',         european:true, europeanComp:'conference_league', rep:2, color:'#D6001C', budget:10, wage:0.5, sqRating:71 },
  { id:'rakow',       name:'Raków',               league:'european', country:'Poland',         european:true, europeanComp:'conference_league', rep:2, color:'#D6001C', budget:11, wage:0.55,sqRating:71 },
  { id:'hibernian',   name:'Hibernian',           league:'european', country:'Scotland',       european:true, europeanComp:'conference_league', rep:2, color:'#00843D', budget:8,  wage:0.45,sqRating:70 },
  { id:'rosenborg',   name:'Rosenborg',           league:'european', country:'Norway',         european:true, europeanComp:'conference_league', rep:2, color:'#FFFFFF', budget:7,  wage:0.4, sqRating:69 },
  { id:'santa_clara', name:'Santa Clara',         league:'european', country:'Portugal',       european:true, europeanComp:'conference_league', rep:2, color:'#D6001C', budget:7,  wage:0.4, sqRating:69 },
  { id:'brondby',     name:'Brøndby',             league:'european', country:'Denmark',        european:true, europeanComp:'conference_league', rep:2, color:'#FFD200', budget:9,  wage:0.45,sqRating:70 },
  { id:'shelbourne',  name:'Shelbourne',          league:'european', country:'Ireland',        european:true, europeanComp:'conference_league', rep:1, color:'#D6001C', budget:4,  wage:0.25,sqRating:67 },
];

const FORMATIONS = {
  '4-4-2':  { name:'4-4-2',  positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:76},{pos:'CB',x:62,y:76},{pos:'CB',x:38,y:76},{pos:'LB',x:18,y:76},{pos:'RM',x:82,y:54},{pos:'CM',x:62,y:54},{pos:'CM',x:38,y:54},{pos:'LM',x:18,y:54},{pos:'ST',x:62,y:26},{pos:'ST',x:38,y:26}]},
  '4-3-3':  { name:'4-3-3',  positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:76},{pos:'CB',x:62,y:76},{pos:'CB',x:38,y:76},{pos:'LB',x:18,y:76},{pos:'CM',x:72,y:55},{pos:'CM',x:50,y:55},{pos:'CM',x:28,y:55},{pos:'RW',x:80,y:28},{pos:'ST',x:50,y:22},{pos:'LW',x:20,y:28}]},
  '4-2-3-1':{ name:'4-2-3-1',positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:76},{pos:'CB',x:62,y:76},{pos:'CB',x:38,y:76},{pos:'LB',x:18,y:76},{pos:'CDM',x:62,y:62},{pos:'CDM',x:38,y:62},{pos:'RW',x:78,y:44},{pos:'CAM',x:50,y:42},{pos:'LW',x:22,y:44},{pos:'ST',x:50,y:22}]},
  '3-5-2':  { name:'3-5-2',  positions:[{pos:'GK',x:50,y:92},{pos:'CB',x:72,y:76},{pos:'CB',x:50,y:76},{pos:'CB',x:28,y:76},{pos:'RM',x:90,y:55},{pos:'CM',x:68,y:58},{pos:'CM',x:50,y:62},{pos:'CM',x:32,y:58},{pos:'LM',x:10,y:55},{pos:'ST',x:64,y:26},{pos:'ST',x:36,y:26}]},
  '5-3-2':  { name:'5-3-2',  positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:90,y:74},{pos:'CB',x:70,y:78},{pos:'CB',x:50,y:80},{pos:'CB',x:30,y:78},{pos:'LB',x:10,y:74},{pos:'CM',x:70,y:55},{pos:'CM',x:50,y:55},{pos:'CM',x:30,y:55},{pos:'ST',x:64,y:26},{pos:'ST',x:36,y:26}]},
  '4-5-1':  { name:'4-5-1',  positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:76},{pos:'CB',x:62,y:76},{pos:'CB',x:38,y:76},{pos:'LB',x:18,y:76},{pos:'RM',x:82,y:54},{pos:'CM',x:65,y:56},{pos:'CM',x:50,y:60},{pos:'CM',x:35,y:56},{pos:'LM',x:18,y:54},{pos:'ST',x:50,y:22}]},
  '3-4-3':  { name:'3-4-3',  positions:[{pos:'GK',x:50,y:92},{pos:'CB',x:72,y:76},{pos:'CB',x:50,y:76},{pos:'CB',x:28,y:76},{pos:'RM',x:84,y:56},{pos:'CM',x:62,y:58},{pos:'CM',x:38,y:58},{pos:'LM',x:16,y:56},{pos:'RW',x:80,y:28},{pos:'ST',x:50,y:22},{pos:'LW',x:20,y:28}]},
  '4-1-4-1':{ name:'4-1-4-1',positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:76},{pos:'CB',x:62,y:76},{pos:'CB',x:38,y:76},{pos:'LB',x:18,y:76},{pos:'CDM',x:50,y:64},{pos:'RM',x:82,y:48},{pos:'CM',x:62,y:50},{pos:'CM',x:38,y:50},{pos:'LM',x:18,y:48},{pos:'ST',x:50,y:22}]},
  '4-4-2 D':{ name:'4-4-2 D',positions:[{pos:'GK',x:50,y:92},{pos:'RB',x:82,y:78},{pos:'CB',x:62,y:80},{pos:'CB',x:38,y:80},{pos:'LB',x:18,y:78},{pos:'RM',x:82,y:60},{pos:'CM',x:62,y:62},{pos:'CM',x:38,y:62},{pos:'LM',x:18,y:60},{pos:'ST',x:62,y:30},{pos:'ST',x:38,y:30}]},
};

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeightedPairs(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
  return pairs[pairs.length - 1][0];
}

// Name pools grouped by region rather than one-per-nationality — nationalities that share
// naming conventions (e.g. Croatian/Serbian/Bosnian, or the smaller European nations with
// no dedicated pool) draw from the same list. NATIONALITY_POOL_KEY below maps every
// nationality label we can assign to the pool it should actually draw names from.
const NAME_POOLS = {
  British:    { first:['James','John','Michael','David','Chris','Tom','Daniel','Jack','Ryan','Alex','Sam','Adam','Luke','Matt','Ben','Josh','Nathan','Oliver','Liam','Harry','Marcus','Jude','Mason','Bukayo','Trent','Declan','Jordan','Callum','Theo','Tammy','Dominic','Raheem','Danny'],
              last:['Smith','Jones','Williams','Brown','Taylor','Davies','Evans','Wilson','Thomas','Roberts','Johnson','Walker','Wright','Robinson','Thompson','White','Hughes','Edwards','Green','Hall','Wood','Harris','Martin','Jackson','Clarke','Turner','Hill','Scott','Young','Morris','Baker','Rashford','Saka','Mount','Rice','Alexander-Arnold'] },
  Scottish:   { first:['Andy','Scott','Stuart','Callum','Ryan','Kieran','Liam','Aaron','Lewis','Craig','Grant','Ross','Kenny'],
              last:['Robertson','Tierney','McGregor','Ferguson','Stewart','MacKay','Fraser','Burns','Christie','Dykes','Adams','McTominay'] },
  Welsh:      { first:['Gareth','Aaron','Ben','Joe','Dan','Rhys','Tom','Connor','Brennan','Ethan'],
              last:['Bale','Ramsey','Allen','James','Wilson','Roberts','Davies','Williams','Moore','Johnson'] },
  Irish:      { first:['Seamus','Aiden','Conor','Liam','Shane','Declan','James','Nathan','Jayson','Evan'],
              last:["O'Brien","Egan","Doherty","Brady","Hendrick","Collins","Duffy","Parrott","Idah","Cullen"] },
  Spanish:    { first:['Carlos','Juan','Luis','Diego','Sergio','Alejandro','Pablo','Jorge','Alvaro','Marcos','Pedro','Ruben','Inaki','Nico','Fermin'],
              last:['Fernandez','Garcia','Martinez','Lopez','Rodriguez','Sanchez','Perez','Gonzalez','Hernandez','Torres','Navas','Merino','Olmo','Cucurella'] },
  French:     { first:['Antoine','Kylian','Ousmane','Theo','Hugo','Florian','Marcel','Thomas','Julian','Aurelien','William','Mattéo','Bradley','Eduardo'],
              last:['Dubois','Bernard','Moreau','Laurent','Simon','Michel','Leroy','Roux','Mbappe','Griezmann','Dembele','Kante','Tchouameni','Konate'] },
  German:     { first:['Florian','Marcel','Julian','Robert','Thomas','Niklas','Joshua','Leon','Kai','Jamal','Ilkay','Maximilian'],
              last:['Muller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Kimmich','Gundogan','Havertz'] },
  Italian:    { first:['Marco','Luca','Lorenzo','Federico','Giovanni','Matteo','Ciro','Nicolo','Gianluigi','Alessandro','Davide','Sandro'],
              last:['Rossi','Ferrari','Russo','Bianchi','Esposito','Romano','Ricci','Marino','Greco','Bruno','Barella','Chiesa','Donnarumma'] },
  Portuguese: { first:['Joao','Rafael','Andre','Bernardo','Bruno','Diogo','Goncalo','Ruben','Pedro','Vitinha','Renato'],
              last:['Silva','Santos','Ferreira','Pereira','Costa','Oliveira','Rodrigues','Alves','Nascimento','Sousa','Fernandes','Neves'] },
  Brazilian:  { first:['Gabriel','Andre','Willian','Richarlison','Thiago','Fabinho','Rodrygo','Vinicius','Lucas','Bruno','Antony','Endrick','Raphinha'],
              last:['Silva','Santos','Pereira','Costa','Oliveira','Souza','Lima','Ribeiro','Carvalho','Barbosa','Martinelli','Casemiro'] },
  Argentine:  { first:['Lautaro','Paulo','Nicolas','Rodrigo','Enzo','Julian','Alexis','Angel','Leandro','Giovani','Exequiel'],
              last:['Fernandez','Martinez','Gonzalez','Lopez','Romero','Acuna','Otamendi','Di Maria','Mac Allister','Paredes'] },
  Dutch:      { first:['Virgil','Frenkie','Memphis','Denzel','Cody','Matthijs','Donyell','Steven','Xavi','Jurrien','Joey'],
              last:['de Jong','van Dijk','Bergwijn','Dumfries','Gakpo','de Ligt','Malen','Berghuis','Simons','Timber'] },
  Belgian:    { first:['Eden','Kevin','Romelu','Youri','Thibaut','Axel','Jeremy','Leandro','Charles','Amadou'],
              last:['Hazard','De Bruyne','Lukaku','Tielemans','Courtois','Witsel','Doku','Trossard','De Ketelaere','Onana'] },
  Turkish:    { first:['Burak','Hakan','Cengiz','Merih','Kerem','Arda','Orkun','Yusuf','Kenan','Ozan'],
              last:['Yilmaz','Calhanoglu','Under','Demiral','Akturkoglu','Kokcu','Guler','Akman','Karaman','Soyuncu'] },
  Greek:      { first:['Kostas','Giorgos','Vangelis','Tasos','Dimitris','Christos','Petros','Nikos'],
              last:['Tsimikas','Manolas','Bakasetas','Pavlidis','Mantalos','Fortounis','Masouras','Vlachodimos'] },
  Ukrainian:  { first:['Andriy','Oleksandr','Mykola','Ruslan','Vitaliy','Yevhen','Taras','Artem'],
              last:['Shevchenko','Zinchenko','Mudryk','Yarmolenko','Malinovskyi','Sudakov','Trubin','Tymchyk'] },
  Balkan:     { first:['Luka','Ivan','Marko','Milan','Dusan','Stefan','Nikola','Vedran','Josip','Edin','Miralem'],
              last:['Modric','Kovacic','Brozovic','Vlasic','Jovic','Milenkovic','Vlahovic','Mitrovic','Dzeko','Pjanic','Kolasinac'] },
  Polish:     { first:['Robert','Piotr','Wojciech','Jakub','Kamil','Krystian','Przemysław','Sebastian'],
              last:['Lewandowski','Zielinski','Szczesny','Bednarek','Milik','Glik','Piszczek','Kaminski'] },
  Slavic:     { first:['Tomas','Petr','Jakub','Pavel','Martin','Vladimir','Filip','Stanislav'],
              last:['Novak','Cerny','Soucek','Coufal','Hubocan','Hamsik','Skriniar','Lobotka'] },
  Scandinavian:{ first:['Erling','Martin','Alexander','Viktor','Mathias','Rasmus','Joakim','Kasper','Robin'],
              last:['Haaland','Odegaard','Berg','Hojbjerg','Eriksen','Olsen','Andersen','Nilsson','Forsberg'] },
  American:   { first:['Christian','Tyler','Weston','Brenden','Gio','Ricardo','Tim','Sergino','Folarin'],
              last:['Pulisic','Adams','McKennie','Reyna','Aaronson','Dest','Balogun','Weah','Robinson'] },
  Latin:      { first:['Carlos','Diego','Mateo','Santiago','Jose','Eduardo','Fernando','Andres','Cristian'],
              last:['Vargas','Morales','Ramirez','Castillo','Mendez','Torres','Cuadrado','Falcao','Suarez','Cavani'] },
  WestAfrican:{ first:['Sadio','Mo','Wilfried','Adama','Emmanuel','Hakim','Ismaila','Bukayo','Iheanacho','Thomas'],
              last:['Mane','Salah','Zaha','Traore','Sarr','Diatta','Toure','Diaby','Osimhen','Partey'] },
  NorthAfrican:{ first:['Mohamed','Achraf','Youssef','Sofiane','Riyad','Karim','Hakim','Yassine'],
              last:['Salah','Hakimi','En-Nesyri','Mahrez','Boufal','Benzema','Ziyech','Bounou'] },
  EastAsian:  { first:['Heung-Min','Takehiro','Kaoru','Hwang','Min-jae','Kim','Daichi','Wataru','Ritsu'],
              last:['Son','Tomiyasu','Mitoma','Hee-chan','Kang-in','Doan','Endo','Kubo'] },
  Other:      { first:['Aleksandar','Dario','Borja','Emil','Nemanja','Goran','Ivo','Pavel','Tibor'],
              last:['Petrov','Markovic','Horvat','Novak','Kralev','Stoyanov','Andric','Kovac'] },
};

// Every assignable nationality label maps to one of the pools above for *naming* purposes,
// even though the displayed nationality stays specific (e.g. a club in Bosnia still reads
// "Bosnian", it just draws a Balkan-style name).
const NATIONALITY_POOL_KEY = {
  English:'British', Scottish:'Scottish', Welsh:'Welsh', Irish:'Irish', American:'American',
  Spanish:'Spanish', Mexican:'Spanish', Colombian:'Latin', Uruguayan:'Latin', Chilean:'Latin', Peruvian:'Latin', Paraguayan:'Latin', Venezuelan:'Latin',
  French:'French', Belgian:'Belgian',
  German:'German', Austrian:'German', Swiss:'German',
  Italian:'Italian',
  Portuguese:'Portuguese', Brazilian:'Brazilian', Argentine:'Argentine',
  Dutch:'Dutch',
  Turkish:'Turkish', Greek:'Greek', Cypriot:'Greek',
  Ukrainian:'Ukrainian',
  Croatian:'Balkan', Serbian:'Balkan', Bosnian:'Balkan', Slovenian:'Balkan', Montenegrin:'Balkan', Macedonian:'Balkan', Kosovan:'Balkan', Albanian:'Balkan',
  Polish:'Polish',
  Czech:'Slavic', Slovak:'Slavic', Hungarian:'Slavic', Romanian:'Slavic', Bulgarian:'Slavic', Moldovan:'Slavic', Belarusian:'Slavic',
  Swedish:'Scandinavian', Danish:'Scandinavian', Norwegian:'Scandinavian', Finnish:'Scandinavian', Icelandic:'Scandinavian',
  Senegalese:'WestAfrican', Ivorian:'WestAfrican', Ghanaian:'WestAfrican', Nigerian:'WestAfrican', Malian:'WestAfrican', Cameroonian:'WestAfrican',
  Egyptian:'NorthAfrican', Moroccan:'NorthAfrican', Algerian:'NorthAfrican', Tunisian:'NorthAfrican',
  'South Korean':'EastAsian', Japanese:'EastAsian',
  Israeli:'Other', Armenian:'Other', Azerbaijani:'Other', Georgian:'Other', Maltese:'Italian', Gibraltarian:'British',
};
const ALL_NATIONALITIES = Object.keys(NATIONALITY_POOL_KEY);

// Each country's squad mix: weighted [nationality, weight] pairs. Anything not listed
// for a country falls back to a generic "mostly home nation, some Europe" spread.
const COUNTRY_NATIONALITY_WEIGHTS = {
  England:    [['English',24],['Scottish',5],['Welsh',4],['Irish',5],['French',4],['Brazilian',3],['Portuguese',3],['Dutch',2],['Belgian',2],['Nigerian',2],['Senegalese',2],['Ivorian',2],['Ghanaian',2],['Spanish',2],['American',2],['South Korean',1],['Argentine',1]],
  Spain:      [['Spanish',60],['Argentine',10],['Brazilian',7],['Uruguayan',4],['Colombian',3],['French',3],['Moroccan',3],['Portuguese',3],['Dutch',2],['English',2],['Croatian',1],['Senegalese',2]],
  Germany:    [['German',55],['Austrian',4],['Swiss',2],['French',4],['Polish',4],['Turkish',5],['Croatian',3],['Serbian',3],['Brazilian',3],['Dutch',3],['Ghanaian',2],['Nigerian',2],['Senegalese',2],['Czech',2],['American',2]],
  Italy:      [['Italian',55],['Argentine',6],['Brazilian',5],['French',5],['Serbian',3],['Croatian',3],['Senegalese',3],['Nigerian',3],['Ivorian',3],['Belgian',3],['Dutch',2],['Polish',2],['Ghanaian',2],['Colombian',2],['Uruguayan',2],['English',1]],
  France:     [['French',50],['Senegalese',6],['Ivorian',5],['Ghanaian',3],['Nigerian',3],['Moroccan',5],['Algerian',4],['Portuguese',4],['Brazilian',4],['Belgian',3],['Argentine',2],['Dutch',2],['Polish',2],['Croatian',2],['Serbian',2],['Italian',2],['English',1]],
  Portugal:   [['Portuguese',55],['Brazilian',20],['French',4],['Spanish',4],['Argentine',3],['Senegalese',3],['Nigerian',3],['Cameroonian',2],['Moroccan',2],['Dutch',2],['Belgian',2]],
  Netherlands:[['Dutch',60],['Belgian',6],['Moroccan',6],['Ghanaian',4],['Nigerian',4],['Senegalese',3],['Polish',3],['German',3],['Turkish',3],['French',3],['English',2],['American',3],['Other',6]],
  Turkey:     [['Turkish',65],['Brazilian',5],['French',4],['Dutch',4],['Croatian',3],['Serbian',3],['German',4],['Senegalese',3],['Nigerian',3],['Ghanaian',2],['English',2],['Portuguese',2]],
  Scotland:   [['Scottish',55],['English',12],['Irish',6],['Welsh',2],['French',4],['American',3],['Nigerian',3],['Ghanaian',3],['Senegalese',3],['Dutch',2],['Croatian',2],['Polish',3],['Spanish',2]],
  Belgium:    [['Belgian',50],['French',8],['Dutch',8],['Moroccan',8],['Senegalese',4],['Ivorian',3],['Ghanaian',3],['Other',6],['Polish',3],['Italian',3],['English',3],['German',4]],
  Ukraine:    [['Ukrainian',70],['Brazilian',6],['Croatian',4],['Serbian',3],['Nigerian',3],['Polish',4],['Slovak',3],['Other',7]],
  Greece:     [['Greek',65],['Brazilian',5],['Nigerian',4],['Albanian',4],['Serbian',4],['Croatian',3],['Argentine',3],['Other',12]],
  Austria:    [['Austrian',55],['German',12],['Serbian',6],['Croatian',5],['Bosnian',4],['Hungarian',4],['Turkish',4],['Nigerian',3],['Other',7]],
  Switzerland:[['Swiss',50],['French',8],['Italian',6],['Serbian',6],['Croatian',5],['Albanian',5],['Portuguese',6],['Spanish',4],['Other',10]],
  Croatia:    [['Croatian',75],['Bosnian',6],['Serbian',4],['German',4],['Brazilian',3],['Other',8]],
  Serbia:     [['Serbian',75],['Croatian',5],['Bosnian',5],['Montenegrin',4],['Brazilian',3],['Other',8]],
  Bosnia:     [['Bosnian',70],['Serbian',8],['Croatian',8],['German',5],['Other',9]],
  Slovenia:   [['Slovenian',70],['Croatian',8],['Serbian',6],['Bosnian',4],['Other',12]],
  Poland:     [['Polish',75],['Ukrainian',6],['Brazilian',3],['Slovak',3],['German',4],['Other',9]],
  Czechia:    [['Czech',70],['Slovak',10],['Ukrainian',5],['Polish',5],['Other',10]],
  Slovakia:   [['Slovak',70],['Czech',10],['Ukrainian',5],['Hungarian',5],['Other',10]],
  Hungary:    [['Hungarian',75],['German',6],['Serbian',5],['Slovak',5],['Other',9]],
  Romania:    [['Romanian',75],['Hungarian',6],['Bulgarian',4],['Moldovan',5],['Other',10]],
  Bulgaria:   [['Bulgarian',75],['Romanian',6],['Macedonian',5],['Other',14]],
  Israel:     [['Israeli',70],['Nigerian',5],['Ghanaian',4],['French',5],['Brazilian',4],['Other',12]],
  Cyprus:     [['Cypriot',55],['Greek',15],['Nigerian',6],['Brazilian',5],['Other',19]],
  Malta:      [['Maltese',60],['Italian',12],['English',6],['Spanish',5],['Other',17]],
  Gibraltar:  [['Gibraltarian',55],['Spanish',18],['English',15],['Other',12]],
  Iceland:    [['Icelandic',75],['Danish',6],['Norwegian',5],['Swedish',5],['Other',9]],
  Denmark:    [['Danish',70],['Swedish',5],['Norwegian',4],['Nigerian',4],['Ghanaian',3],['Other',14]],
  Sweden:     [['Swedish',65],['Danish',5],['Norwegian',4],['Nigerian',4],['Ghanaian',4],['Other',18]],
  Norway:     [['Norwegian',70],['Swedish',6],['Danish',5],['Nigerian',4],['Other',15]],
  Finland:    [['Finnish',75],['Swedish',6],['Other',19]],
  Armenia:    [['Armenian',70],['Brazilian',5],['Other',25]],
  Azerbaijan: [['Azerbaijani',70],['Brazilian',5],['Georgian',5],['Other',20]],
  'North Macedonia':[['Macedonian',70],['Serbian',8],['Albanian',8],['Other',14]],
  Kosovo:     [['Kosovan',70],['Albanian',12],['Serbian',5],['Other',13]],
  Ireland:    [['Irish',65],['English',15],['Scottish',5],['Nigerian',4],['Other',11]],
};

function clubCountry(club) {
  return club.country || LEAGUES[club.league]?.country || 'England';
}

// Pick a nationality weighted by the club's country, then draw the name from the
// nationality's own pool — replaces the old fully-independent random pick of name +
// nationality, which routinely produced mismatched combinations.
// Real squads get markedly more domestic the lower the division — a National League squad
// is overwhelmingly English, while a Premier League one is genuinely multinational. Only
// England has multiple league levels in this game (the other "big" leagues and the european
// filler clubs are always level 1), so this only ever kicks in for English tiers below the PL —
// level 1 just uses each country table's own authored home/foreign mix.
const DOMESTIC_FRACTION_BY_LEVEL = { 2: 0.50, 3: 0.62, 4: 0.75, 5: 0.88 };

function pickNameAndNationality(club) {
  const country = clubCountry(club);
  const baseWeights = COUNTRY_NATIONALITY_WEIGHTS[country];
  let nationality = 'English';
  if (baseWeights) {
    const level = LEAGUES[club.league]?.level || 1;
    const targetFrac = DOMESTIC_FRACTION_BY_LEVEL[level];
    let weights = baseWeights;
    if (targetFrac) {
      const homeNat = baseWeights[0][0];
      const restTotal = baseWeights.filter(([nat]) => nat !== homeNat).reduce((s, [, w]) => s + w, 0);
      const homeWeight = restTotal * targetFrac / (1 - targetFrac);
      weights = baseWeights.map(([nat, w]) => [nat, nat === homeNat ? homeWeight : w]);
    }
    nationality = pickWeightedPairs(weights);
  }
  const poolKey = NATIONALITY_POOL_KEY[nationality] || 'Other';
  const pool = NAME_POOLS[poolKey] || NAME_POOLS.Other;
  return { nationality, firstName: pick(pool.first), lastName: pick(pool.last) };
}

// Market wages scale sharply with division: a 63-rated player earns ~£5.8k in PL context
// but only ~£2-3k in League One and £0.9k in League Two. Same ability, different market.
const LEAGUE_WAGE_MULTS = {
  premier_league:  1.00,
  championship:    1.00,  // currently well-calibrated
  league_one:      0.55,  // main fix: L1 wages were ~£6m/yr vs ~£5m income
  league_two:      0.45,
  national_league: 0.40,
  european:        1.00,
};

// Depth tier shifts (and re-widens) the OVR anchor so a squad has real internal spread
// instead of every player clustering within ~14 points of clubRating regardless of role.
// 0 = undisputed starter/key player, 1 = rotation starter (today's old default band),
// 2 = backup, 3 = fringe/academy filler.
const DEPTH_TIERS = [
  { shift: 6,   lo: 3, hi: 9 },
  { shift: 0,   lo: 6, hi: 6 },
  { shift: -7,  lo: 6, hi: 4 },
  { shift: -15, lo: 7, hi: 4 },
];

function generatePlayer(id, pos, clubRating, age, leagueKey = 'premier_league', opts = {}) {
  const country = opts.country || LEAGUES[leagueKey]?.country || 'England';
  const { nationality, firstName, lastName } = pickNameAndNationality({ country, league: leagueKey });
  const depth = DEPTH_TIERS[Math.min(Math.max(opts.depthTier ?? 1, 0), DEPTH_TIERS.length - 1)];
  const ageAdj = age < 18 ? (age - 18) * 4 : 0; // under-18s are rawer: -4 per year below 18
  const base = clubRating + rand(-5, 5) + ageAdj;

  const isGK = pos === 'GK';
  const isDef = ['CB','LB','RB','LWB','RWB'].includes(pos);
  const isMid = ['CM','CDM','CAM','LM','RM'].includes(pos);
  const isAtt = ['ST','CF','LW','RW'].includes(pos);

  // Scale each stat range around clubRating so better clubs get better players.
  // Full 1:1 propagation (with a small -2 offset to counter top-4 inflation) so
  // lower-league players genuinely rate at their tier instead of compressing toward 70.
  const sc = (lo, hi) => {
    const mid = (lo + hi) / 2, half = (hi - lo) / 2;
    const shifted = mid + (base - 72);
    return Math.max(10, Math.min(99, rand(Math.round(shifted - half), Math.round(shifted + half))));
  };

  const attrs = {
    pace:     isGK ? sc(30,55) : isAtt ? sc(60,95) : isDef ? sc(50,80) : sc(55,85),
    shooting: isGK ? sc(10,30) : isAtt ? sc(55,90) : isMid ? sc(40,70) : sc(20,50),
    passing:  isGK ? sc(40,70) : isDef ? sc(40,72) : isMid ? sc(60,90) : sc(50,80),
    dribbling:isGK ? sc(20,40) : isAtt ? sc(60,95) : isMid ? sc(55,85) : sc(35,70),
    defending:isGK ? sc(10,30) : isDef ? sc(60,90) : isMid ? sc(40,70) : sc(20,50),
    physical: isGK ? sc(55,80) : sc(50,85),
    gkReflexes:    isGK ? sc(60,92) : sc(5,20),
    gkPositioning: isGK ? sc(60,92) : sc(5,20),
  };

  // OVR = mean of top 4 stats across all attrs
  const top4 = Object.values(attrs).sort((a, b) => b - a).slice(0, 4);
  let rawOvr = Math.round(top4.reduce((s, v) => s + v, 0) / 4);
  // Anchor to the club's level (and depth-tier role): no League Two club fields a
  // 75-rated star, but a club's 1st-choice players should still clearly outrank its fringe.
  // (Transfermarkt: best L2 player ~£1.5m; outlier rolls were inflating whole-tier values.)
  const anchor = clubRating + ageAdj + depth.shift;
  rawOvr = Math.max(anchor - depth.lo, Math.min(anchor + depth.hi, rawOvr));
  // Soft cap: compress above 87 — 90-rated players should be very rare world-class
  const cappedOvr = rawOvr <= 87 ? rawOvr : 87 + Math.round((rawOvr - 87) * 0.22);
  const ovr = Math.max(38, Math.min(91, cappedOvr));
  // potGap = realistic remaining headroom above current ability, banded by age —
  // not by current quality, so a low-rated teen still has real upside rather than
  // already being "finished" at a low rating. It tapers through the late 20s and
  // hits a hard 0 at 30: development is over, only decline is left from here.
  // Combined with tickPlayerDevelopment's own age cutoff and per-week growth odds,
  // most players still fall short of fully reaching their potential.
  const potGap = age >= 30 ? 0
    : age <= 17 ? rand(10, Math.round((42 - age) * 1.1))
    : age <= 20 ? rand(6, 22)
    : age <= 23 ? rand(3, 14)
    : age <= 26 ? rand(1, 8)
    : rand(0, 4); // 27-29: fading but not necessarily zero yet
  const pot  = Math.min(93, ovr + potGap);

  const value = calcValue(ovr, age);
  // Wage in game units (p.wage / 1000 = £m/wk for display)
  // Base formula calibrated for PL/Champ: OVR 60=£3.8k, OVR 70=£16k, OVR 75=£33k, OVR 80=£69k, OVR 85=£140k
  // League mult scales down wages for lower divisions to match real market rates:
  //   L1 avg player (OVR 62, mult 0.55) = ~£2.8k/wk → squad wage bill ~£3.5m/yr (real L1: £3-12m) ✓
  //   L2 avg player (OVR 57, mult 0.45) = ~£0.9k/wk → squad wage bill ~£1m/yr (real L2: £1.5-4m) ✓
  //   NL avg player (OVR 50, mult 0.40) = ~£300/wk (floor) → squad bill ~£0.35m/yr (real NL: £0.3-2m) ✓
  const wageBase = ovr >= 60
    ? Math.pow(1.155, ovr - 60) * 3.8
    : Math.pow(0.80, 60 - ovr) * 3.8;
  const leagueMult = LEAGUE_WAGE_MULTS[leagueKey] ?? 1.0;
  const wage = Math.min(350, Math.max(0.3, Math.round(wageBase * leagueMult * (0.75 + rand(0, 50) / 100) * 10) / 10));

  return {
    id, firstName, lastName,
    name: `${firstName} ${lastName}`,
    pos,
    age: age || rand(17, 35),
    nationality,
    ovr,
    pot,
    attrs,
    value,
    wage: Math.max(0.5, wage),
    contract: rand(1, 5),
    transferListed: rand(0, 99) < 3,
    loyal: rand(0, 99) < 60,
    morale: rand(65, 95),
    fitness: rand(75, 100),
    injured: false,
    injuryType: null,
    injuryWeeks: 0,
    careerInjuries: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    yellowCards: 0,
    redCards: 0,
    seasonRating: 0,
    ratingCount: 0,
  };
}

function calcValue(ovr, age) {
  // Calibrated vs Transfermarkt tier anchors (2025-26): NL squads ~£0.5-3m, L2 avg €4m,
  // L1 avg €10m, Championship €14-210m, PL €200m-1.3bn.
  // OVR 50 = £24k, 55 = £72k, 60 = £220k, 65 = £750k, 70 = £2.6m, 75 = £8.8m,
  // 80 = £18.5m, 85 = £39m, 88 = £61m (age multiplier pushes young stars higher)
  // Anchors: Bradford-type L1 club ~£7m squad, Champ median ~£50m, PL bottom ~£170m.
  const base = ovr >= 60
    ? (ovr <= 75
        ? 0.18 * Math.pow(1.296, ovr - 60)
        : 0.18 * Math.pow(1.296, 15) * Math.pow(1.16, ovr - 75))
    : 0.18 * Math.pow(0.80, 60 - ovr);
  const ageMult = age < 20 ? 1.5 : age < 23 ? 1.3 : age < 27 ? 1.1 : age < 30 ? 1.0 : age < 32 ? 0.55 : age < 34 ? 0.3 : 0.12;
  return Math.max(0.003, Math.round(base * ageMult * 100) / 100);
}

// Real players for key squad slots, keyed by club id. Each entry is a compact tuple:
// [firstName, lastName, position, age, nationality, ovr, pot]. Only ~14-16 notable
// players per covered club — the rest of the squad is filled by the generator above.
// Ages/ratings are calibrated as of the 2025-26 season; they age and develop normally
// from here via the same systems as every other player.
const REAL_PLAYERS = {
  man_city: [
    ["Ederson","Moraes","GK",32,"Brazilian",84,84],
    ["Ruben","Dias","CB",28,"Portuguese",87,89],
    ["John","Stones","CB",31,"English",83,83],
    ["Josko","Gvardiol","CB",23,"Croatian",86,91],
    ["Nathan","Ake","CB",30,"Dutch",82,82],
    ["Rico","Lewis","RB",20,"English",80,88],
    ["Rodrigo","Hernandez","CDM",29,"Spanish",90,91],
    ["Mateo","Kovacic","CM",31,"Croatian",82,82],
    ["Matheus","Nunes","CM",27,"Portuguese",81,83],
    ["Bernardo","Silva","CAM",31,"Portuguese",86,86],
    ["Phil","Foden","LW",25,"English",87,90],
    ["Jeremy","Doku","LW",23,"Belgian",85,89],
    ["Savio","Moreira","RW",21,"Brazilian",82,88],
    ["Erling","Haaland","ST",25,"Norwegian",91,92],
    ["Omar","Marmoush","ST",26,"Egyptian",83,85],
    ["Tijjani","Reijnders","CM",27,"Dutch",84,86],
  ],
  arsenal: [
    ["David","Raya","GK",30,"Spanish",85,85],
    ["William","Saliba","CB",24,"French",87,90],
    ["Gabriel","Magalhaes","CB",27,"Brazilian",86,87],
    ["Jurrien","Timber","RB",24,"Dutch",83,87],
    ["Riccardo","Calafiori","LB",23,"Italian",83,87],
    ["Myles","Lewis-Skelly","LB",19,"English",78,88],
    ["Declan","Rice","CM",26,"English",87,89],
    ["Martin","Odegaard","CAM",26,"Norwegian",87,89],
    ["Mikel","Merino","CM",29,"Spanish",82,83],
    ["Bukayo","Saka","RW",23,"English",88,91],
    ["Gabriel","Martinelli","LW",24,"Brazilian",83,86],
    ["Kai","Havertz","ST",26,"German",83,84],
    ["Viktor","Gyokeres","ST",27,"Swedish",85,86],
    ["Leandro","Trossard","LW",30,"Belgian",81,81],
    ["Eberechi","Eze","CAM",27,"English",83,84],
    ["Noni","Madueke","RW",23,"English",80,85],
  ],
  liverpool: [
    ["Alisson","Becker","GK",33,"Brazilian",85,85],
    ["Giorgi","Mamardashvili","GK",25,"Georgian",78,83],
    ["Virgil","van Dijk","CB",34,"Dutch",85,85],
    ["Ibrahima","Konate","CB",26,"French",85,87],
    ["Joe","Gomez","CB",28,"English",78,78],
    ["Milos","Kerkez","LB",21,"Hungarian",82,88],
    ["Jeremie","Frimpong","RB",24,"Dutch",83,87],
    ["Ryan","Gravenberch","CM",23,"Dutch",85,89],
    ["Alexis","Mac Allister","CM",26,"Argentine",85,87],
    ["Dominik","Szoboszlai","CM",24,"Hungarian",84,87],
    ["Florian","Wirtz","CAM",22,"German",87,92],
    ["Mohamed","Salah","RW",33,"Egyptian",89,89],
    ["Cody","Gakpo","LW",26,"Dutch",83,85],
    ["Alexander","Isak","ST",25,"Swedish",87,89],
    ["Hugo","Ekitike","ST",23,"French",80,85],
    ["Federico","Chiesa","RW",27,"Italian",78,79],
  ],
  chelsea: [
    ["Robert","Sanchez","GK",27,"Spanish",79,81],
    ["Filip","Jorgensen","GK",23,"Danish",75,80],
    ["Levi","Colwill","CB",22,"English",81,87],
    ["Wesley","Fofana","CB",24,"French",80,84],
    ["Benoit","Badiashile","CB",24,"French",78,82],
    ["Reece","James","RB",25,"English",82,86],
    ["Marc","Cucurella","LB",27,"Spanish",81,82],
    ["Moises","Caicedo","CDM",23,"Ecuadorian",85,89],
    ["Enzo","Fernandez","CM",24,"Argentine",84,87],
    ["Romeo","Lavia","CM",21,"Belgian",78,85],
    ["Cole","Palmer","CAM",23,"English",87,90],
    ["Pedro","Neto","RW",25,"Portuguese",81,84],
    ["Jadon","Sancho","LW",25,"English",76,78],
    ["Nicolas","Jackson","ST",24,"Senegalese",79,83],
    ["Liam","Delap","ST",22,"English",78,84],
    ["Joao","Pedro","ST",23,"Brazilian",82,86],
  ],
  man_utd: [
    ["Andre","Onana","GK",29,"Cameroonian",79,80],
    ["Senne","Lammens","GK",23,"Belgian",74,79],
    ["Lisandro","Martinez","CB",27,"Argentine",81,82],
    ["Matthijs","de Ligt","CB",26,"Dutch",81,82],
    ["Leny","Yoro","CB",19,"French",78,88],
    ["Noussair","Mazraoui","RB",27,"Moroccan",79,80],
    ["Diogo","Dalot","RB",26,"Portuguese",80,81],
    ["Patrick","Dorgu","LB",20,"Danish",76,85],
    ["Manuel","Ugarte","CDM",24,"Uruguayan",80,83],
    ["Carlos","Casemiro","CDM",33,"Brazilian",80,80],
    ["Bruno","Fernandes","CAM",31,"Portuguese",86,86],
    ["Mason","Mount","CM",26,"English",76,78],
    ["Amad","Diallo","RW",23,"Ivorian",81,85],
    ["Bryan","Mbeumo","RW",25,"Cameroonian",83,85],
    ["Matheus","Cunha","ST",26,"Brazilian",82,83],
    ["Benjamin","Sesko","ST",22,"Slovenian",80,87],
  ],
  tottenham: [
    ["Guglielmo","Vicario","GK",28,"Italian",82,83],
    ["Cristian","Romero","CB",27,"Argentine",83,84],
    ["Micky","van de Ven","CB",24,"Dutch",82,86],
    ["Kota","Takai","CB",20,"Japanese",74,82],
    ["Pedro","Porro","RB",25,"Spanish",81,83],
    ["Destiny","Udogie","LB",22,"Italian",80,86],
    ["Rodrigo","Bentancur","CM",28,"Uruguayan",80,80],
    ["Yves","Bissouma","CDM",28,"Malian",79,79],
    ["James","Maddison","CAM",28,"English",83,83],
    ["Dejan","Kulusevski","RW",25,"Swedish",82,85],
    ["Brennan","Johnson","RW",24,"Welsh",79,82],
    ["Mohammed","Kudus","LW",25,"Ghanaian",80,83],
    ["Richarlison","Andrade","ST",28,"Brazilian",78,78],
    ["Dominic","Solanke","ST",27,"English",80,80],
    ["Randal","Kolo Muani","ST",26,"French",80,82],
  ],
  newcastle: [
    ["Nick","Pope","GK",33,"English",82,82],
    ["Sven","Botman","CB",25,"Dutch",81,84],
    ["Fabian","Schar","CB",33,"Swiss",79,79],
    ["Jamaal","Lascelles","CB",31,"English",73,73],
    ["Kieran","Trippier","RB",35,"English",77,77],
    ["Tino","Livramento","RB",22,"English",80,85],
    ["Dan","Burn","LB",33,"English",76,76],
    ["Bruno","Guimaraes","CDM",27,"Brazilian",86,87],
    ["Sandro","Tonali","CM",25,"Italian",84,86],
    ["Joelinton","Lira","CM",28,"Brazilian",80,80],
    ["Anthony","Gordon","LW",24,"English",83,86],
    ["Jacob","Murphy","RW",30,"English",77,77],
    ["Harvey","Barnes","LW",27,"English",78,79],
    ["Yoane","Wissa","ST",28,"Congolese",80,80],
    ["Nick","Woltemade","ST",23,"German",80,85],
  ],
  aston_villa: [
    ["Emiliano","Martinez","GK",33,"Argentine",84,84],
    ["Pau","Torres","CB",28,"Spanish",81,81],
    ["Ezri","Konsa","CB",27,"English",79,80],
    ["Tyrone","Mings","CB",32,"English",76,76],
    ["Matty","Cash","RB",28,"Polish",78,78],
    ["Lucas","Digne","LB",32,"French",76,76],
    ["Boubacar","Kamara","CDM",25,"French",81,83],
    ["Youri","Tielemans","CM",28,"Belgian",80,80],
    ["John","McGinn","CM",30,"Scottish",80,80],
    ["Morgan","Rogers","CAM",23,"English",82,87],
    ["Emiliano","Buendia","CAM",28,"Argentine",77,77],
    ["Ollie","Watkins","ST",29,"English",85,85],
    ["Donyell","Malen","RW",26,"Dutch",80,81],
    ["Evann","Guessand","ST",23,"Ivorian",77,82],
  ],
  west_ham: [
    ["Alphonse","Areola","GK",32,"French",76,76],
    ["Max","Kilman","CB",28,"English",78,78],
    ["Konstantinos","Mavropanos","CB",27,"Greek",77,77],
    ["Aaron","Wan-Bissaka","RB",27,"English",78,78],
    ["Emerson","Palmieri","LB",31,"Italian",75,75],
    ["Edson","Alvarez","CDM",27,"Mexican",80,81],
    ["Tomas","Soucek","CM",30,"Czech",79,79],
    ["James","Ward-Prowse","CM",30,"English",78,78],
    ["Lucas","Paqueta","CAM",27,"Brazilian",81,82],
    ["Jarrod","Bowen","RW",28,"English",81,81],
    ["Crysencio","Summerville","LW",23,"Dutch",79,83],
    ["Niclas","Fullkrug","ST",32,"German",78,78],
    ["Guido","Rodriguez","CDM",31,"Argentine",77,77],
  ],
  brighton: [
    ["Bart","Verbruggen","GK",23,"Dutch",78,84],
    ["Jan Paul","van Hecke","CB",25,"Dutch",78,82],
    ["Lewis","Dunk","CB",33,"English",77,77],
    ["Igor","Julio","CB",27,"Brazilian",76,76],
    ["Tariq","Lamptey","RB",25,"English",75,77],
    ["Pervis","Estupinan","LB",27,"Ecuadorian",79,80],
    ["Carlos","Baleba","CDM",21,"Cameroonian",82,89],
    ["Mats","Wieffer","CM",25,"Dutch",79,83],
    ["Yankuba","Minteh","RW",21,"Gambian",79,86],
    ["Kaoru","Mitoma","LW",28,"Japanese",81,82],
    ["Brajan","Gruda","CAM",21,"German",76,83],
    ["Danny","Welbeck","ST",34,"English",76,76],
    ["Georginio","Rutter","CF",23,"French",79,84],
  ],
  brentford: [
    ["Caoimhin","Kelleher","GK",27,"Irish",78,80],
    ["Nathan","Collins","CB",24,"Irish",79,82],
    ["Sepp","van den Berg","CB",23,"Dutch",77,82],
    ["Kristoffer","Ajer","CB",27,"Norwegian",76,76],
    ["Aaron","Hickey","RB",23,"Scottish",76,80],
    ["Keane","Lewis-Potter","LB",24,"English",76,78],
    ["Yehor","Yarmoliuk","CM",21,"Ukrainian",75,81],
    ["Mathias","Jensen","CM",29,"Danish",76,76],
    ["Mikkel","Damsgaard","CAM",25,"Danish",79,81],
    ["Kevin","Schade","RW",23,"German",79,84],
    ["Igor","Thiago","ST",23,"Brazilian",77,82],
    ["Dango","Ouattara","RW",23,"Burkinabe",76,81],
  ],
  wolves: [
    ["Jose","Sa","GK",32,"Portuguese",78,78],
    ["Yerson","Mosquera","CB",24,"Colombian",75,79],
    ["Emmanuel","Agbadou","CB",28,"Ivorian",76,76],
    ["Ladislav","Krejci","CB",27,"Czech",76,77],
    ["Matt","Doherty","RB",33,"Irish",73,73],
    ["Jackson","Tchatchoua","RB",22,"Belgian",74,80],
    ["Marshall","Munetsi","CM",29,"Zimbabwean",76,76],
    ["Joao","Gomes","CM",24,"Brazilian",79,83],
    ["Andre","Trindade","CM",23,"Brazilian",77,82],
    ["Jean-Ricner","Bellegarde","CAM",26,"French",74,75],
    ["Hwang","Hee-chan","ST",29,"South Korean",78,78],
    ["Jorgen","Strand Larsen","ST",25,"Norwegian",78,80],
    ["Fer","Lopez","LW",20,"Spanish",76,84],
  ],
  crystal: [
    ["Dean","Henderson","GK",28,"English",80,80],
    ["Marc","Guehi","CB",25,"English",81,84],
    ["Maxence","Lacroix","CB",25,"French",78,80],
    ["Chris","Richards","CB",25,"American",76,78],
    ["Daniel","Munoz","RB",29,"Colombian",79,79],
    ["Tyrick","Mitchell","LB",26,"English",78,79],
    ["Will","Hughes","CM",30,"English",75,75],
    ["Adam","Wharton","CM",21,"English",80,87],
    ["Daichi","Kamada","CAM",29,"Japanese",76,76],
    ["Ismaila","Sarr","RW",27,"Senegalese",80,80],
    ["Jean-Philippe","Mateta","ST",28,"French",80,80],
    ["Yeremy","Pino","RW",22,"Spanish",76,82],
    ["Justin","Devenny","CM",21,"English",72,78],
  ],
  fulham: [
    ["Bernd","Leno","GK",33,"German",80,80],
    ["Calvin","Bassey","CB",25,"Nigerian",77,79],
    ["Joachim","Andersen","CB",29,"Danish",79,79],
    ["Issa","Diop","CB",28,"French",75,75],
    ["Kenny","Tete","RB",30,"Dutch",76,76],
    ["Antonee","Robinson","LB",28,"American",79,79],
    ["Joao","Palhinha","CDM",30,"Portuguese",81,81],
    ["Sander","Berge","CM",27,"Norwegian",77,77],
    ["Emile","Smith Rowe","CAM",25,"English",77,78],
    ["Alex","Iwobi","LW",29,"Nigerian",79,79],
    ["Adama","Traore","RW",29,"Spanish",77,77],
    ["Raul","Jimenez","ST",34,"Mexican",75,75],
    ["Rodrigo","Muniz","ST",24,"Brazilian",76,79],
  ],
  everton: [
    ["Jordan","Pickford","GK",32,"English",83,83],
    ["James","Tarkowski","CB",33,"English",78,78],
    ["Jarrad","Branthwaite","CB",23,"English",81,87],
    ["Jake","O'Brien","CB",24,"Irish",75,79],
    ["Nathan","Patterson","RB",23,"Scottish",74,78],
    ["Vitaliy","Mykolenko","LB",26,"Ukrainian",77,78],
    ["Idrissa","Gueye","CDM",36,"Senegalese",73,73],
    ["James","Garner","CM",24,"English",76,79],
    ["Iliman","Ndiaye","CAM",25,"Senegalese",79,81],
    ["Dwight","McNeil","LW",26,"English",79,79],
    ["Jack","Grealish","LW",30,"English",81,81],
    ["Beto","Betuncal","ST",27,"Portuguese",76,76],
    ["Tim","Iroegbunam","CM",22,"English",74,79],
  ],
  nottm_forest: [
    ["Matz","Sels","GK",33,"Belgian",82,82],
    ["Murillo","Santos","CB",23,"Brazilian",81,86],
    ["Nikola","Milenkovic","CB",28,"Serbian",80,80],
    ["Morato","Carmo","CB",23,"Brazilian",74,79],
    ["Neco","Williams","RB",24,"Welsh",77,79],
    ["Ola","Aina","RB",28,"Nigerian",78,78],
    ["Nicolas","Dominguez","CDM",27,"Argentine",79,80],
    ["Elliot","Anderson","CM",23,"English",78,82],
    ["Morgan","Gibbs-White","CAM",25,"English",82,84],
    ["Anthony","Elanga","RW",23,"Swedish",80,84],
    ["Callum","Hudson-Odoi","LW",25,"English",76,78],
    ["Chris","Wood","ST",34,"New Zealander",80,80],
    ["Taiwo","Awoniyi","ST",28,"Nigerian",78,78],
  ],
  bournemouth: [
    ["Djordje","Petrovic","GK",26,"Serbian",78,81],
    ["Marcos","Senesi","CB",28,"Argentine",78,78],
    ["James","Hill","CB",23,"English",73,78],
    ["Bafode","Diakite","CB",24,"French",76,80],
    ["Adam","Smith","RB",34,"English",73,73],
    ["Alex","Jimenez","LB",20,"Spanish",75,84],
    ["Ryan","Christie","CM",30,"Scottish",76,76],
    ["Alex","Scott","CM",22,"English",76,81],
    ["Tyler","Adams","CDM",26,"American",76,77],
    ["David","Brooks","CAM",28,"Welsh",76,76],
    ["Antoine","Semenyo","RW",25,"Ghanaian",80,82],
    ["Evanilson","Barbosa","ST",25,"Brazilian",79,82],
  ],
  leeds: [
    ["Lucas","Perri","GK",27,"Brazilian",77,78],
    ["Pascal","Struijk","CB",26,"Dutch",76,77],
    ["Joe","Rodon","CB",28,"Welsh",75,75],
    ["Jayden","Bogle","RB",25,"English",76,77],
    ["Gustaf","Lagerbielke","CB",24,"Swedish",73,76],
    ["Gabriel","Gudmundsson","LB",26,"Swedish",74,74],
    ["Ethan","Ampadu","CDM",24,"Welsh",77,79],
    ["Ilia","Gruev","CM",24,"Bulgarian",74,75],
    ["Brenden","Aaronson","CAM",24,"American",75,77],
    ["Daniel","James","RW",27,"Welsh",76,76],
    ["Noah","Okafor","LW",25,"Swiss",76,78],
    ["Joel","Piroe","ST",26,"Dutch",77,77],
  ],
  burnley: [
    ["James","Trafford","GK",22,"English",78,84],
    ["Maxime","Esteve","CB",23,"French",75,79],
    ["Axel","Tuanzebe","CB",27,"English",72,72],
    ["CJ","Egan-Riley","CB",22,"English",73,78],
    ["Connor","Roberts","RB",30,"Welsh",73,73],
    ["Quentin","Merlin","LB",23,"French",74,79],
    ["Josh","Cullen","CM",29,"Irish",75,75],
    ["Josh","Laurent","CM",30,"English",73,73],
    ["Jaidon","Anthony","LW",25,"English",74,75],
    ["Lesley","Ugochukwu","CM",21,"French",75,82],
    ["Loum","Tchaouna","RW",22,"French",73,80],
    ["Lyle","Foster","ST",25,"South African",75,77],
  ],
  sunderland: [
    ["Robin","Roefs","GK",23,"Dutch",75,81],
    ["Dan","Ballard","CB",26,"Northern Irish",75,76],
    ["Nordi","Mukiele","CB",27,"French",76,76],
    ["Trai","Hume","RB",23,"Northern Irish",74,77],
    ["Reinildo","Mandava","LB",31,"Mozambican",73,73],
    ["Granit","Xhaka","CM",32,"Swiss",80,80],
    ["Habib","Diarra","CM",21,"Senegalese",76,83],
    ["Chris","Rigg","CAM",18,"English",74,86],
    ["Romaine","Mundle","RW",21,"English",71,79],
    ["Wilson","Isidor","ST",24,"French",74,79],
    ["Eliezer","Mayenda","ST",20,"French",73,82],
  ],
};

// Builds one authored real player: reuses generatePlayer purely as the attrs engine
// (anchored to the authored OVR so stats feel appropriate for that ability level), then
// overrides identity/ability fields with the authored real-world values. Potential still
// follows the existing realistic age-banding — there's no "real" published potential data,
// so it's calibrated the same way the rest of the game's potential system is.
function buildRealPlayer(entry, club) {
  const [first, last, pos, age, nationality, ovr, pot] = entry;
  const id = `${club.id}_real_${first}${last}`.replace(/[^A-Za-z0-9]/g, '');
  const p = generatePlayer(id, pos, ovr, age, club.league, { depthTier: 1 });
  p.firstName = first;
  p.lastName = last;
  p.name = `${first} ${last}`;
  p.nationality = nationality;
  p.ovr = ovr;
  p.pot = Math.max(ovr, pot != null ? pot : ovr);
  p.value = calcValue(p.ovr, p.age);
  const wageBase = p.ovr >= 60 ? Math.pow(1.155, p.ovr - 60) * 3.8 : Math.pow(0.80, 60 - p.ovr) * 3.8;
  const leagueMult = LEAGUE_WAGE_MULTS[club.league] ?? 1.0;
  p.wage = Math.max(0.5, Math.min(350, Math.round(wageBase * leagueMult * (0.85 + rand(0, 20) / 100) * 10) / 10));
  return p;
}

const POSITION_SETS = {
  GK:  ['GK'],
  DEF: ['RB','CB','CB','LB'],
  MID: ['CM','CM','CDM'],
  ATT: ['ST','RW','LW'],
};

function generateSquad(club) {
  // Real-roster clubs get their authored key players first; the procedural generator
  // only fills whatever's left of each position group, continuing the depth ranking
  // (so a real club's fringe/academy slots are still properly fringe-tier, not stars).
  const real = (REAL_PLAYERS[club.id] || []).map(entry => buildRealPlayer(entry, club));
  const realPosCounts = {};
  real.forEach(p => { realPosCounts[p.pos] = (realPosCounts[p.pos] || 0) + 1; });

  const players = [...real];
  let pid = 0;
  const positions = [
    { pos:'GK',  count:3 },
    { pos:'CB',  count:4 },
    { pos:'RB',  count:2 },
    { pos:'LB',  count:2 },
    { pos:'CDM', count:2 },
    { pos:'CM',  count:4 },
    { pos:'CAM', count:2 },
    { pos:'RM',  count:1 },
    { pos:'LM',  count:1 },
    { pos:'RW',  count:2 },
    { pos:'LW',  count:2 },
    { pos:'ST',  count:4 },
    { pos:'CF',  count:1 },
  ];
  // Lower-league clubs run leaner squads (~25 players vs ~30 at the top, like real life)
  const lean = club.sqRating < 66;
  const trimmable = new Set(['GK','CB','CM','ST','CF']);
  const country = clubCountry(club);
  positions.forEach(({ pos, count }) => {
    if (lean && trimmable.has(pos)) count = Math.max(1, count - 1);
    const already = realPosCounts[pos] || 0;
    const remaining = Math.max(0, count - already);
    for (let i = 0; i < remaining; i++) {
      const depthTier = Math.min(already + i, 3);
      // Deeper depth tiers skew younger (development/academy players), not just lower-rated.
      const age = pos === 'GK' ? rand(22, 36)
        : depthTier >= 3 ? rand(16, 21)
        : depthTier === 2 ? rand(18, 30)
        : rand(19, 33);
      players.push(generatePlayer(`${club.id}_p${pid++}`, pos, club.sqRating, age, club.league, { country, depthTier }));
    }
  });
  return players;
}

// Seed tactics for every club so AI clubs start with a real (if simple) setup —
// main.js's weekly tick picks the actual starting XI and may nudge these over time.
function seedClubTactics(data) {
  const formKeys = Object.keys(FORMATIONS);
  const hash = data.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rep = data.rep || 3;
  return {
    formation: formKeys[hash % formKeys.length],
    mentality: 'balanced',
    pressing: rep >= 4 ? 'high' : rep >= 2 ? 'medium' : 'low',
    style: rep >= 4 ? 'possession' : rep >= 3 ? 'balanced' : rep >= 2 ? 'direct' : 'counter',
  };
}

function buildClub(data) {
  return {
    ...data,
    shortName: data.name,
    budget: data.budget,
    wageBudget: data.wage,
    players: generateSquad(data),
    tactics: seedClubTactics(data),
    lineup: [],
    form: [],
    results: [],
    tableStats: { played:0, won:0, drawn:0, lost:0, gf:0, ga:0, points:0 },
    europeanStats: { played:0, won:0, drawn:0, lost:0, gf:0, ga:0, points:0 },
  };
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase();
}

function generateFreeAgents(count) {
  const positions = ['GK','CB','CB','LB','RB','CDM','CM','CM','CAM','LW','RW','ST','ST','CB','CM','ST','LB','RB','GK','LW','RW','CDM','CAM'];
  // Tiers: national league → prem fringe, with more lower-league players
  const tiers = [
    { minOvr:46, maxOvr:53, minAge:22, maxAge:38, count:14 }, // National League level
    { minOvr:53, maxOvr:60, minAge:22, maxAge:36, count:14 }, // League Two / One level
    { minOvr:60, maxOvr:67, minAge:24, maxAge:35, count:10 }, // Championship level
    { minOvr:67, maxOvr:73, minAge:25, maxAge:34, count:7 },  // PL fringe / Champ top
    { minOvr:73, maxOvr:79, minAge:27, maxAge:35, count:5 },  // PL squad / released stars
  ];
  const agents = [];
  let pid = 0;
  tiers.forEach(tier => {
    for (let i = 0; i < tier.count; i++) {
      const pos = positions[pid % positions.length];
      const ovr = rand(tier.minOvr, tier.maxOvr);
      const age = rand(tier.minAge, tier.maxAge);
      const id = `free_${pid}_${Date.now()}`;
      const p = generatePlayer(id, pos, ovr, age);
      p.clubId = null;
      p.clubName = 'Free Agent';
      p.contract = 0;
      p.expiring = false;
      p.wantsMove = true;
      agents.push(p);
      pid++;
    }
  });
  return agents;
}

const CLUB_BADGES = {
  "man_city": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/250px-Manchester_City_FC_badge.svg.png",
  "arsenal": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/250px-Arsenal_FC.svg.png",
  "liverpool": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/250px-Liverpool_FC.svg.png",
  "chelsea": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/250px-Chelsea_FC.svg.png",
  "man_utd": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/250px-Manchester_United_FC_crest.svg.png",
  "tottenham": "https://a.espncdn.com/i/teamlogos/soccer/500-dark/367.png",
  "newcastle": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Newcastle_United_Logo.svg/250px-Newcastle_United_Logo.svg.png",
  "aston_villa": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Aston_Villa_FC_new_crest.svg/250px-Aston_Villa_FC_new_crest.svg.png",
  "west_ham": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/West_Ham_United_FC_logo.svg/250px-West_Ham_United_FC_logo.svg.png",
  "brighton": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d0/Brighton_and_Hove_Albion_FC_crest.svg/250px-Brighton_and_Hove_Albion_FC_crest.svg.png",
  "brentford": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Brentford_FC_crest.svg/250px-Brentford_FC_crest.svg.png",
  "wolves": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/Wolverhampton_Wanderers_FC_crest.svg/250px-Wolverhampton_Wanderers_FC_crest.svg.png",
  "crystal": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Crystal_Palace_FC_logo_%282022%29.svg/250px-Crystal_Palace_FC_logo_%282022%29.svg.png",
  "fulham": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Fulham_FC_%28shield%29.svg/250px-Fulham_FC_%28shield%29.svg.png",
  "everton": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Everton_FC_logo.svg/250px-Everton_FC_logo.svg.png",
  "nottm_forest": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Nottingham_Forest_F.C._logo.svg/250px-Nottingham_Forest_F.C._logo.svg.png",
  "bournemouth": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/AFC_Bournemouth_%282013%29.svg/250px-AFC_Bournemouth_%282013%29.svg.png",
  "leeds": "https://upload.wikimedia.org/wikipedia/en/thumb/5/54/Leeds_United_F.C._logo.svg/250px-Leeds_United_F.C._logo.svg.png",
  "burnley": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/Burnley_FC_Logo.svg/250px-Burnley_FC_Logo.svg.png",
  "sunderland": "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Logo_Sunderland.svg/250px-Logo_Sunderland.svg.png",
  "leicester": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/Leicester_City_crest.svg/250px-Leicester_City_crest.svg.png",
  "ipswich": "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Ipswich_Town.svg/250px-Ipswich_Town.svg.png",
  "southampton": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/FC_Southampton.svg/250px-FC_Southampton.svg.png",
  "sheff_utd": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/Sheffield_United_FC_logo.svg/250px-Sheffield_United_FC_logo.svg.png",
  "middlesbrough": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2c/Middlesbrough_FC_crest.svg/250px-Middlesbrough_FC_crest.svg.png",
  "coventry": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Coventry_City_FC_crest.svg/250px-Coventry_City_FC_crest.svg.png",
  "west_brom": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/West_Bromwich_Albion.svg/250px-West_Bromwich_Albion.svg.png",
  "stoke": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/Stoke_City_FC_crest_2001.svg/250px-Stoke_City_FC_crest_2001.svg.png",
  "norwich": "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/Norwich_City_FC_logo.svg/250px-Norwich_City_FC_logo.svg.png",
  "derby": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4a/Derby_County_crest.svg/250px-Derby_County_crest.svg.png",
  "sheff_wed": "https://upload.wikimedia.org/wikipedia/en/thumb/8/88/Sheffield_Wednesday_badge.svg/250px-Sheffield_Wednesday_badge.svg.png",
  "millwall": "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Millwall_FC_crest.svg/250px-Millwall_FC_crest.svg.png",
  "blackburn": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0f/Blackburn_Rovers.svg/250px-Blackburn_Rovers.svg.png",
  "bristol_city": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Bristol_City_crest.svg/250px-Bristol_City_crest.svg.png",
  "watford": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Watford.svg/250px-Watford.svg.png",
  "swansea": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Swansea_City_AFC_logo.svg/250px-Swansea_City_AFC_logo.svg.png",
  "qpr": "https://upload.wikimedia.org/wikipedia/en/thumb/3/31/Queens_Park_Rangers_crest.svg/250px-Queens_Park_Rangers_crest.svg.png",
  "hull": "https://upload.wikimedia.org/wikipedia/en/thumb/5/54/Hull_City_A.F.C._logo.svg/250px-Hull_City_A.F.C._logo.svg.png",
  "preston": "https://upload.wikimedia.org/wikipedia/en/thumb/8/82/Preston_North_End_FC.svg/250px-Preston_North_End_FC.svg.png",
  "birmingham": "https://upload.wikimedia.org/wikipedia/en/thumb/6/68/Birmingham_City_FC_logo.svg/250px-Birmingham_City_FC_logo.svg.png",
  "oxford": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3e/Oxford_United_FC_logo.svg/250px-Oxford_United_FC_logo.svg.png",
  "portsmouth": "https://upload.wikimedia.org/wikipedia/en/thumb/3/38/Portsmouth_FC_logo.svg/250px-Portsmouth_FC_logo.svg.png",
  "wrexham": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/Wrexham_A.F.C._Logo.svg/250px-Wrexham_A.F.C._Logo.svg.png",
  "charlton": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Charlton_Athletic_FC_crest.svg/250px-Charlton_Athletic_FC_crest.svg.png",
  "cardiff": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3c/Cardiff_City_crest.svg/250px-Cardiff_City_crest.svg.png",
  "luton": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9d/Luton_Town_logo.svg/250px-Luton_Town_logo.svg.png",
  "plymouth": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/Plymouth_Argyle_F.C._logo.svg/250px-Plymouth_Argyle_F.C._logo.svg.png",
  "rotherham": "https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Rotherham_United_F.C._svg.svg/250px-Rotherham_United_F.C._svg.svg.png",
  "blackpool": "https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Blackpool_FC_logo.svg/250px-Blackpool_FC_logo.svg.png",
  "bolton": "https://upload.wikimedia.org/wikipedia/en/thumb/8/82/Bolton_Wanderers_FC_logo.svg/250px-Bolton_Wanderers_FC_logo.svg.png",
  "huddersfield": "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Huddersfield_Town_AFC_crest.svg/250px-Huddersfield_Town_AFC_crest.svg.png",
  "wigan": "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Wigan_Athletic.svg/250px-Wigan_Athletic.svg.png",
  "bradford": "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/Bradford_City_AFC_crest.svg/250px-Bradford_City_AFC_crest.svg.png",
  "reading": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Reading_FC.svg/250px-Reading_FC.svg.png",
  "barnsley": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/Barnsley_FC.svg/250px-Barnsley_FC.svg.png",
  "peterborough": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Peterborough_United%27s_new_badge.svg/250px-Peterborough_United%27s_new_badge.svg.png",
  "stockport": "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Stockport_County_FC_logo_2020.svg/250px-Stockport_County_FC_logo_2020.svg.png",
  "doncaster": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Doncaster_Rovers_F.C._logo.svg/250px-Doncaster_Rovers_F.C._logo.svg.png",
  "exeter": "https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Exeter_City_FC.svg/250px-Exeter_City_FC.svg.png",
  "lincoln": "https://upload.wikimedia.org/wikipedia/en/thumb/3/39/Lincoln_City_FC_2024_crest.svg/250px-Lincoln_City_FC_2024_crest.svg.png",
  "leyton_orient": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/Leyton_Orient_F.C._logo.svg/250px-Leyton_Orient_F.C._logo.svg.png",
  "wycombe": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fb/Wycombe_Wanderers_FC_logo.svg/250px-Wycombe_Wanderers_FC_logo.svg.png",
  "burton": "https://upload.wikimedia.org/wikipedia/en/thumb/9/93/Burton_Albion_FC_crest.svg/250px-Burton_Albion_FC_crest.svg.png",
  "stevenage": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/Stevenage_FC_crest.svg/250px-Stevenage_FC_crest.svg.png",
  "mansfield": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Mansfield_Town_FC.svg/250px-Mansfield_Town_FC.svg.png",
  "northampton": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/Northampton_Town_F.C._logo.svg/250px-Northampton_Town_F.C._logo.svg.png",
  "port_vale": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5f/Port_Vale_logo.svg/250px-Port_Vale_logo.svg.png",
  "afc_wimbledon": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/AFC_Wimbledon_%282020%29_logo.svg/250px-AFC_Wimbledon_%282020%29_logo.svg.png",
  "notts_county": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Notts_County_Logo.svg/250px-Notts_County_Logo.svg.png",
  "grimsby": "https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Grimsby_Town_F.C._logo.svg/250px-Grimsby_Town_F.C._logo.svg.png",
  "swindon": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Swindon_Town_FC.svg/250px-Swindon_Town_FC.svg.png",
  "mk_dons": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Milton_Keynes_Dons_FC_2025_crest.svg/250px-Milton_Keynes_Dons_FC_2025_crest.svg.png",
  "bristol_rovers": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/Bristol_Rovers_F.C._logo.svg/250px-Bristol_Rovers_F.C._logo.svg.png",
  "cambridge": "https://upload.wikimedia.org/wikipedia/en/thumb/5/57/Cambridge_United_FC_crest.svg/250px-Cambridge_United_FC_crest.svg.png",
  "shrewsbury": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/Shrewsbury_Town_F.C._logo.svg/250px-Shrewsbury_Town_F.C._logo.svg.png",
  "tranmere": "https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/250px-Tranmere_Rovers_FC_crest.svg.png",
  "colchester": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/Colchester_United_FC_crest.svg/250px-Colchester_United_FC_crest.svg.png",
  "walsall": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Walsall_FC.svg/250px-Walsall_FC.svg.png",
  "oldham": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Oldham_Athletic_AFC_%28emblem%29.svg/250px-Oldham_Athletic_AFC_%28emblem%29.svg.png",
  "chesterfield": "https://upload.wikimedia.org/wikipedia/en/thumb/9/94/Chesterfield_FC_crest.svg/250px-Chesterfield_FC_crest.svg.png",
  "gillingham": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/FC_Gillingham_Logo.svg/250px-FC_Gillingham_Logo.svg.png",
  "cheltenham": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Cheltenham_Town_F.C._logo.svg/250px-Cheltenham_Town_F.C._logo.svg.png",
  "harrogate": "https://upload.wikimedia.org/wikipedia/en/thumb/4/40/Harrogate_Town_AFC.svg/250px-Harrogate_Town_AFC.svg.png",
  "crawley": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Crawley_Town_FC_crest.svg/250px-Crawley_Town_FC_crest.svg.png",
  "salford": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/Salford_City_FC_crest.svg/250px-Salford_City_FC_crest.svg.png",
  "barnet": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Barnet_FC.svg/250px-Barnet_FC.svg.png",
  "newport": "https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Newport_County_AFC_crest.svg/250px-Newport_County_AFC_crest.svg.png",
  "fleetwood": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ed/Fleetwood_Town_F.C._logo.svg/250px-Fleetwood_Town_F.C._logo.svg.png",
  "accrington": "https://upload.wikimedia.org/wikipedia/en/thumb/b/ba/Accrington_Stanley_F.C._logo.svg/250px-Accrington_Stanley_F.C._logo.svg.png",
  "crewe": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9d/Crewe_Alexandra.svg/250px-Crewe_Alexandra.svg.png",
  "bromley": "https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Bromley_FC_crest.svg/250px-Bromley_FC_crest.svg.png",
  "barrow": "https://upload.wikimedia.org/wikipedia/en/thumb/2/28/Barrow_AFC_logo.svg/250px-Barrow_AFC_logo.svg.png",
  "carlisle": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/Carlisle_United_FC_crest.svg/250px-Carlisle_United_FC_crest.svg.png",
  "morecambe": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ee/Morecambe_FC_crest.svg/250px-Morecambe_FC_crest.svg.png",
  "york": "https://upload.wikimedia.org/wikipedia/en/thumb/7/71/York_City_FC.svg/250px-York_City_FC.svg.png",
  "forest_green": "https://upload.wikimedia.org/wikipedia/en/thumb/8/85/Forest_Green_Rovers_crest.svg/250px-Forest_Green_Rovers_crest.svg.png",
  "southend": "https://upload.wikimedia.org/wikipedia/en/thumb/7/79/Southend_United.svg/250px-Southend_United.svg.png",
  "scunthorpe": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b3/Scunthorpe_United_FC_crest.svg/250px-Scunthorpe_United_FC_crest.svg.png",
  "halifax": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/FC_Halifax_Town_crest.svg/250px-FC_Halifax_Town_crest.svg.png",
  "altrincham": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Altrincham_FC_crest.svg/250px-Altrincham_FC_crest.svg.png",
  "gateshead": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b3/Gateshead_FC.svg/250px-Gateshead_FC.svg.png",
  "hartlepool": "https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Hartlepool_United_FC_crest.svg/250px-Hartlepool_United_FC_crest.svg.png",
  "rochdale": "https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/Rochdale_AFC_crest.svg/250px-Rochdale_AFC_crest.svg.png",
  "solihull": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Solihull_Moors_FC_crest.svg/250px-Solihull_Moors_FC_crest.svg.png",
  "yeovil": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Yeovil_Town_FC_crest.svg/250px-Yeovil_Town_FC_crest.svg.png",
  "aldershot": "https://upload.wikimedia.org/wikipedia/en/thumb/3/30/Aldershot_Town_FC_crest.svg/250px-Aldershot_Town_FC_crest.svg.png",
  "eastleigh": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Eastleigh_FC_crest.svg/250px-Eastleigh_FC_crest.svg.png",
  "sutton": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Sutton_United_FC_crest.svg/250px-Sutton_United_FC_crest.svg.png",
  "woking": "https://upload.wikimedia.org/wikipedia/en/thumb/d/de/Woking_FC_logo.svg/250px-Woking_FC_logo.svg.png",
  "boston_utd": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Boston_United_FC_logo.svg/250px-Boston_United_FC_logo.svg.png",
  "braintree": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/Braintree_Town_FC_crest.svg/250px-Braintree_Town_FC_crest.svg.png",
  "wealdstone": "https://upload.wikimedia.org/wikipedia/en/thumb/d/dc/Wealdstone_FC_crest.svg/250px-Wealdstone_FC_crest.svg.png",
  "tamworth": "https://upload.wikimedia.org/wikipedia/en/thumb/d/dd/Tamworth_FC.svg/250px-Tamworth_FC.svg.png",
  "truro": "https://upload.wikimedia.org/wikipedia/en/thumb/0/00/Truro_City_FC_crest.svg/250px-Truro_City_FC_crest.svg.png",
  "brackley": "https://upload.wikimedia.org/wikipedia/en/thumb/0/08/BrackleyTownFCBadge.png/250px-BrackleyTownFCBadge.png",
  "boreham_wood": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Boreham_Wood_FC_logo.svg/250px-Boreham_Wood_FC_logo.svg.png",
  "real_madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/250px-Real_Madrid_CF.svg.png",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/250px-FC_Barcelona_%28crest%29.svg.png",
  "atletico": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Atletico_Madrid_Logo_2024.svg/250px-Atletico_Madrid_Logo_2024.svg.png",
  "sevilla": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/250px-Sevilla_FC_logo.svg.png",
  "villarreal": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/250px-Villarreal_CF_logo-en.svg.png",
  "real_sociedad": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/250px-Real_Sociedad_logo.svg.png",
  "betis": "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_betis_logo.svg/250px-Real_betis_logo.svg.png",
  "valencia": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/250px-Valenciacf.svg.png",
  "athletic": "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  "getafe": "https://upload.wikimedia.org/wikipedia/en/thumb/4/46/Getafe_logo.svg/250px-Getafe_logo.svg.png",
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/3/38/CA_Osasuna_2024_crest.svg/250px-CA_Osasuna_2024_crest.svg.png",
  "girona": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Girona_FC_Logo.svg/250px-Girona_FC_Logo.svg.png",
  "alaves": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/Deportivo_Alaves_logo_%282020%29.svg/250px-Deportivo_Alaves_logo_%282020%29.svg.png",
  "celta": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/250px-RC_Celta_de_Vigo_logo.svg.png",
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Rcd_mallorca.svg/250px-Rcd_mallorca.svg.png",
  "espanyol": "https://upload.wikimedia.org/wikipedia/en/thumb/9/92/RCD_Espanyol_crest.svg/250px-RCD_Espanyol_crest.svg.png",
  "rayo": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d8/Rayo_Vallecano_logo.svg/250px-Rayo_Vallecano_logo.svg.png",
  "levante": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg/250px-Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg.png",
  "elche": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Elche_CF_logo.svg/250px-Elche_CF_logo.svg.png",
  "oviedo": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Real_Oviedo_logo.svg/250px-Real_Oviedo_logo.svg.png",
  "bayern": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/FC_Bayern_M%C3%BCnchen_logo_%282024%29.svg/250px-FC_Bayern_M%C3%BCnchen_logo_%282024%29.svg.png",
  "dortmund": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/250px-Borussia_Dortmund_logo.svg.png",
  "leverkusen": "https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Bayer_04_Leverkusen_logo.svg/250px-Bayer_04_Leverkusen_logo.svg.png",
  "rb_leipzig": "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/RB_Leipzig_2014_logo.svg/250px-RB_Leipzig_2014_logo.svg.png",
  "frankfurt": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Eintracht_Frankfurt_crest.svg/250px-Eintracht_Frankfurt_crest.svg.png",
  "wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/VfL_Wolfsburg_logo_2026.svg/250px-VfL_Wolfsburg_logo_2026.svg.png",
  "gladbach": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/250px-Borussia_M%C3%B6nchengladbach_logo.svg.png",
  "stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/250px-VfB_Stuttgart_1893_Logo.svg.png",
  "hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/250px-Logo_TSG_Hoffenheim.svg.png",
  "werder": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/250px-SV-Werder-Bremen-Logo.svg.png",
  "freiburg": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/SC_Freiburg_logo.svg/250px-SC_Freiburg_logo.svg.png",
  "augsburg": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/FC_Augsburg_logo.svg/250px-FC_Augsburg_logo.svg.png",
  "heidenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/1._FC_Heidenheim_1846.svg/250px-1._FC_Heidenheim_1846.svg.png",
  "mainz": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/1._FSV_Mainz_05_logo.svg/250px-1._FSV_Mainz_05_logo.svg.png",
  "union_berlin": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/1._FC_Union_Berlin_Logo.svg/250px-1._FC_Union_Berlin_Logo.svg.png",
  "st_pauli": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8f/FC_St._Pauli_logo_%282018%29.svg/250px-FC_St._Pauli_logo_%282018%29.svg.png",
  "hamburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Hamburger_SV_logo.svg/250px-Hamburger_SV_logo.svg.png",
  "koln": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/1._FC_Koeln_Logo_2014%E2%80%93.svg/250px-1._FC_Koeln_Logo_2014%E2%80%93.svg.png",
  "inter": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/250px-FC_Internazionale_Milano_2021.svg.png",
  "juventus": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg/250px-Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg.png",
  "ac_milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/250px-Logo_of_AC_Milan.svg.png",
  "napoli": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/SSC_Napoli_2025_%28white_and_azure%29.svg/250px-SSC_Napoli_2025_%28white_and_azure%29.svg.png",
  "roma": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/AS_Roma_logo_%282017%29.svg/250px-AS_Roma_logo_%282017%29.svg.png",
  "lazio": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/S.S._Lazio_badge.svg/250px-S.S._Lazio_badge.svg.png",
  "atalanta": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Atalanta_BC_new_logo.svg/250px-Atalanta_BC_new_logo.svg.png",
  "fiorentina": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/ACF_Fiorentina_-_logo_%28Italy%2C_2022%29.svg/250px-ACF_Fiorentina_-_logo_%28Italy%2C_2022%29.svg.png",
  "bologna": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Bologna_F.C._1909_logo.svg/250px-Bologna_F.C._1909_logo.svg.png",
  "torino": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Torino_FC_Logo.svg/250px-Torino_FC_Logo.svg.png",
  "udinese": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Udinese_Calcio_logo.svg/250px-Udinese_Calcio_logo.svg.png",
  "genoa": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2c/Genoa_CFC_crest.svg/250px-Genoa_CFC_crest.svg.png",
  "como": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg/250px-Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg.png",
  "parma": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Parma_Calcio_1913_%28adozione_2016%29.svg/250px-Logo_Parma_Calcio_1913_%28adozione_2016%29.svg.png",
  "cagliari": "https://upload.wikimedia.org/wikipedia/en/thumb/6/61/Cagliari_Calcio_1920.svg/250px-Cagliari_Calcio_1920.svg.png",
  "lecce": "https://upload.wikimedia.org/wikipedia/en/thumb/2/23/US_Lecce_crest.svg/250px-US_Lecce_crest.svg.png",
  "verona": "https://upload.wikimedia.org/wikipedia/en/thumb/9/92/Hellas_Verona_FC_logo_%282020%29.svg/250px-Hellas_Verona_FC_logo_%282020%29.svg.png",
  "sassuolo": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/US_Sassuolo_Calcio_logo.svg/250px-US_Sassuolo_Calcio_logo.svg.png",
  "pisa": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Pisa_SC_crest.svg/250px-Pisa_SC_crest.svg.png",
  "cremonese": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e1/US_Cremonese_logo.svg/250px-US_Cremonese_logo.svg.png",
  "psg": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/250px-Paris_Saint-Germain_F.C..svg.png",
  "marseille": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Olympique_de_Marseille_2026_logo.svg/250px-Olympique_de_Marseille_2026_logo.svg.png",
  "lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/6/62/OL_Lyonnes.svg/250px-OL_Lyonnes.svg.png",
  "monaco": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/LogoASMonacoFC2021.svg/250px-LogoASMonacoFC2021.svg.png",
  "lille": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/Lille_OSC_2018_logo.svg/250px-Lille_OSC_2018_logo.svg.png",
  "nice": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/OGC_Nice_logo.svg/250px-OGC_Nice_logo.svg.png",
  "lens": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/RC_Lens_logo.svg/250px-RC_Lens_logo.svg.png",
  "rennes": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Stade_Rennais_FC.svg/250px-Stade_Rennais_FC.svg.png",
  "strasbourg": "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Racing_Club_de_Strasbourg_logo.svg/250px-Racing_Club_de_Strasbourg_logo.svg.png",
  "nantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Logo_FC_Nantes_%28avec_fond%29_-_2019.svg/250px-Logo_FC_Nantes_%28avec_fond%29_-_2019.svg.png",
  "toulouse": "https://upload.wikimedia.org/wikipedia/en/thumb/6/63/Toulouse_FC_2018_logo.svg/250px-Toulouse_FC_2018_logo.svg.png",
  "brest": "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Stade_Brestois_29_logo.svg/250px-Stade_Brestois_29_logo.svg.png",
  "auxerre": "https://upload.wikimedia.org/wikipedia/en/thumb/5/51/AJAuxerreLogo.svg/250px-AJAuxerreLogo.svg.png",
  "angers": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Angers_Sporting_Club_de_l%27Ouest_logo.svg/250px-Angers_Sporting_Club_de_l%27Ouest_logo.svg.png",
  "havre": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Le_Havre_AC_logo.svg/250px-Le_Havre_AC_logo.svg.png",
  "lorient": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/FC_Lorient_logo.svg/250px-FC_Lorient_logo.svg.png",
  "paris_fc": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Paris_FC_logo.svg/250px-Paris_FC_logo.svg.png",
  "metz": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/FC_Metz_2021_Logo.svg/250px-FC_Metz_2021_Logo.svg.png",
  "benfica": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/SL_Benfica_logo.svg/250px-SL_Benfica_logo.svg.png",
  "sporting_cp": "https://upload.wikimedia.org/wikipedia/en/thumb/9/95/Sporting_CP_crest.svg/250px-Sporting_CP_crest.svg.png",
  "porto": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/FC_Porto.svg/250px-FC_Porto.svg.png",
  "ajax": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Logo_AFC_Ajax_%281928-1991%2C_2025-%29.png/250px-Logo_AFC_Ajax_%281928-1991%2C_2025-%29.png",
  "psv": "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/PSV_Eindhoven.svg/250px-PSV_Eindhoven.svg.png",
  "feyenoord": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Feyenoord_logo_since_2024.svg/250px-Feyenoord_logo_since_2024.svg.png",
  "galatasaray": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Galatasaray_S.K._Logo_2026_5-stars.svg/250px-Galatasaray_S.K._Logo_2026_5-stars.svg.png",
  "fenerbahce": "https://upload.wikimedia.org/wikipedia/en/thumb/3/39/Fenerbah%C3%A7e.svg/250px-Fenerbah%C3%A7e.svg.png",
  "celtic": "https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Celtic_FC_crest.svg/250px-Celtic_FC_crest.svg.png",
  "rangers": "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Rangers_FC.svg/250px-Rangers_FC.svg.png",
  "salzburg": "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/FC_Red_Bull_Salzburg_logo.svg/250px-FC_Red_Bull_Salzburg_logo.svg.png",
  "club_brugge": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d0/Club_Brugge_KV_logo.svg/250px-Club_Brugge_KV_logo.svg.png",
  "shakhtar": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a1/FC_Shakhtar_Donetsk.svg/250px-FC_Shakhtar_Donetsk.svg.png",
  "olympiacos": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Olympiacos_FC_crest.svg/250px-Olympiacos_FC_crest.svg.png",
  "dinamo_zagreb": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Logo_GNK_Dinamo_Zagreb_%282019%29.svg/250px-Logo_GNK_Dinamo_Zagreb_%282019%29.svg.png",
  "young_boys": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/BSC_Young_Boys.svg/250px-BSC_Young_Boys.svg.png",
  "braga": "https://upload.wikimedia.org/wikipedia/en/thumb/7/79/S.C._Braga_logo.svg/250px-S.C._Braga_logo.svg.png",
  "paok": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e6/PAOK_FC_EMBLEM.png/250px-PAOK_FC_EMBLEM.png",
  "anderlecht": "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/R.S.C._Anderlecht.svg/250px-R.S.C._Anderlecht.svg.png",
  "union_sg": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Royale_Union_Saint-Gilloise_logo.svg/250px-Royale_Union_Saint-Gilloise_logo.svg.png",
  "besiktas": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/BesiktasJK-Logo.svg/250px-BesiktasJK-Logo.svg.png",
  "slavia_prague": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/SK_Slavia_Praha_full_logo.svg/250px-SK_Slavia_Praha_full_logo.svg.png",
  "sparta_prague": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/AC-Sparta-LOGO2021.svg/250px-AC-Sparta-LOGO2021.svg.png",
  "viktoria_plzen": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/Viktoria_Plzen_logo.svg/250px-Viktoria_Plzen_logo.svg.png",
  "ferencvaros": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Ferencvarosi_TC.svg/250px-Ferencvarosi_TC.svg.png",
  "fcsb": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Fcsb-logo.svg/250px-Fcsb-logo.svg.png",
  "dynamo_kyiv": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Dynamo_logo.svg/250px-Dynamo_logo.svg.png",
  "red_star": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Red_Star_Belgrade_crest.svg/250px-Red_Star_Belgrade_crest.svg.png",
  "ludogorets": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/PFC_Ludogorets_Razgrad_logo.png/250px-PFC_Ludogorets_Razgrad_logo.png",
  "qarabag": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fe/Qaraba%C4%9F_FK_logo.svg/250px-Qaraba%C4%9F_FK_logo.svg.png",
  "midtjylland": "https://upload.wikimedia.org/wikipedia/en/thumb/d/dd/FC_Midtjylland_logo.svg/250px-FC_Midtjylland_logo.svg.png",
  "malmo": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Malmo_FF_logo.svg/250px-Malmo_FF_logo.svg.png",
  "elfsborg": "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/IF_Elfsborg_logo.svg/250px-IF_Elfsborg_logo.svg.png",
  "bodo_glimt": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/FK_Bodo_Glimt_logo.svg/250px-FK_Bodo_Glimt_logo.svg.png",
  "twente": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/FC_Twente.svg/250px-FC_Twente.svg.png",
  "az_alkmaar": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/AZ_Alkmaar.svg/250px-AZ_Alkmaar.svg.png",
  "rapid_wien": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/SK_Rapid_Wien_Logo.svg/250px-SK_Rapid_Wien_Logo.svg.png",
  "maccabi_tel_aviv": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Maccabi_Tel_Aviv.png/250px-Maccabi_Tel_Aviv.png",
  "aek_athens": "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/AEK_Athens_FC_logo.svg/250px-AEK_Athens_FC_logo.svg.png",
  "samsunspor": "https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Samsunspor_crest.svg/250px-Samsunspor_crest.svg.png",
  "legia": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/Legia_Warsaw_logo.svg/250px-Legia_Warsaw_logo.svg.png",
  "rijeka": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HNK_Rijeka.svg/250px-HNK_Rijeka.svg.png",
  "aberdeen": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fb/Aberdeen_FC_stars_crest.svg/250px-Aberdeen_FC_stars_crest.svg.png",
  "omonia": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3d/AC_Omonia_logo.svg/250px-AC_Omonia_logo.svg.png",
  "craiova": "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/CS_Universitatea_Craiova_logo.svg/250px-CS_Universitatea_Craiova_logo.svg.png",
  "celje": "https://upload.wikimedia.org/wikipedia/en/f/fc/NK_Celje.png",
  "lausanne": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/FC_Lausanne-Sport_logo.svg/250px-FC_Lausanne-Sport_logo.svg.png",
  "sigma": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/SK_Sigma_Olomouc_logo.svg/250px-SK_Sigma_Olomouc_logo.svg.png",
  "shamrock": "https://upload.wikimedia.org/wikipedia/en/thumb/6/63/Shamrock_Rovers_F.C._crest.svg/250px-Shamrock_Rovers_F.C._crest.svg.png",
  "drita": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a0/FC_Drita.svg/250px-FC_Drita.svg.png",
  "breidablik": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Brei%C3%B0ablik_men%27s_football_logo.png/250px-Brei%C3%B0ablik_men%27s_football_logo.png",
  "kups": "https://upload.wikimedia.org/wikipedia/en/thumb/b/bd/KuPS_logo.svg/250px-KuPS_logo.svg.png",
  "hacken": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/BK_Hacken_logo.svg/250px-BK_Hacken_logo.svg.png",
  "hamrun": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Hamrun_badge_hi_deffb1.png/250px-Hamrun_badge_hi_deffb1.png",
  "lincoln_ri": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Lincoln_Red_Imps_FC_logo.svg/250px-Lincoln_Red_Imps_FC_logo.svg.png",
  "shkendija": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/KF_Shk%C3%ABndija_Logo.svg/250px-KF_Shk%C3%ABndija_Logo.svg.png",
  "zrinjski": "https://upload.wikimedia.org/wikipedia/en/thumb/6/69/H%C5%A0K_Zrinjski_Mostar.svg/250px-H%C5%A0K_Zrinjski_Mostar.svg.png",
  "noah": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/FC_Noah_logo_%282024%29.svg/250px-FC_Noah_logo_%282024%29.svg.png",
  "slovan": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/SK_Slovan_Bratislava_logo.svg/250px-SK_Slovan_Bratislava_logo.svg.png",
  "aek_larnaca": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/AEK_Larnaca_logo.svg/250px-AEK_Larnaca_logo.svg.png",
  "lech_poznan": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/KKS_Lech_Pozna%C5%84.svg/250px-KKS_Lech_Pozna%C5%84.svg.png",
  "jagiellonia": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Jagiellonia_Bia%C5%82ystok_logo.svg/250px-Jagiellonia_Bia%C5%82ystok_logo.svg.png",
  "rakow": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Rks_rakow_crest_ai.svg/250px-Rks_rakow_crest_ai.svg.png",
  "hibernian": "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Hibernian_FC_logo.svg/250px-Hibernian_FC_logo.svg.png",
  "rosenborg": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Rosenborg_logo_RGB.svg/250px-Rosenborg_logo_RGB.svg.png",
  "santa_clara": "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/C.D._Santa_Clara_logo.svg/250px-C.D._Santa_Clara_logo.svg.png",
  "brondby": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/Brondby_IF_logo.svg/250px-Brondby_IF_logo.svg.png",
  "shelbourne": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Shelbourne_F.C._crest.svg/250px-Shelbourne_F.C._crest.svg.png"
};

const CLUB_BADGE_SCALE = {
  "brighton": 1.45
};

const CLUB_BADGE_FILTER = {
  "derby":   "brightness(0) invert(1)",
  "swansea": "brightness(0) invert(1)"
};

window.DATA = { LEAGUES, CLUBS_DATA, FORMATIONS, buildClub, seedClubTactics, generatePlayer, generateFreeAgents, getInitials, calcValue, CLUB_BADGES, CLUB_BADGE_SCALE, CLUB_BADGE_FILTER };
