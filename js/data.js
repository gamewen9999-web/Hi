/* =============================================
   DATA.JS — Clubs, Players, Leagues
   ============================================= */

const LEAGUES = {
  premier_league: { name: 'Premier League', country: 'England', level: 1, championsLeague: 5, europaLeague: 2, conferenceLeague: 1, relegation: 3 },
  championship:   { name: 'Championship',   country: 'England', level: 2, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 3 },
  league_one:     { name: 'League One',     country: 'England', level: 3, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 4 },
  league_two:     { name: 'League Two',     country: 'England', level: 4, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 2 },
  national_league:{ name: 'National League',country: 'England', level: 5, championsLeague: 0, europaLeague: 0, conferenceLeague: 0, relegation: 3 },
  la_liga:        { name: 'La Liga',        country: 'Spain',   level: 1, championsLeague: 4, europaLeague: 2, conferenceLeague: 1, relegation: 3 },
  bundesliga:     { name: 'Bundesliga',     country: 'Germany', level: 1, championsLeague: 4, europaLeague: 2, conferenceLeague: 1, relegation: 3 },
  serie_a:        { name: 'Serie A',        country: 'Italy',   level: 1, championsLeague: 4, europaLeague: 2, conferenceLeague: 1, relegation: 3 },
  ligue_1:        { name: 'Ligue 1',        country: 'France',  level: 1, championsLeague: 3, europaLeague: 3, conferenceLeague: 1, relegation: 3 },
};

const CLUBS_DATA = [
  // Premier League
  { id:'man_city',    name:'Manchester City',   league:'premier_league', rep:5, color:'#6CABDD', budget:150, wage:5.2, sqRating:88 },
  { id:'arsenal',     name:'Arsenal',            league:'premier_league', rep:5, color:'#EF0107', budget:120, wage:4.8, sqRating:86 },
  { id:'liverpool',   name:'Liverpool',          league:'premier_league', rep:5, color:'#C8102E', budget:130, wage:5.0, sqRating:87 },
  { id:'chelsea',     name:'Chelsea',            league:'premier_league', rep:5, color:'#034694', budget:140, wage:5.1, sqRating:85 },
  { id:'man_utd',     name:'Manchester United',  league:'premier_league', rep:5, color:'#DA291C', budget:110, wage:4.6, sqRating:83 },
  { id:'tottenham',   name:'Tottenham Hotspur',  league:'premier_league', rep:4, color:'#132257', budget:90,  wage:3.8, sqRating:82 },
  { id:'newcastle',   name:'Newcastle United',   league:'premier_league', rep:4, color:'#241F20', budget:100, wage:3.9, sqRating:81 },
  { id:'aston_villa', name:'Aston Villa',        league:'premier_league', rep:4, color:'#95BFE5', budget:80,  wage:3.2, sqRating:80 },
  { id:'west_ham',    name:'West Ham United',    league:'premier_league', rep:3, color:'#7A263A', budget:55,  wage:2.5, sqRating:77 },
  { id:'brighton',    name:'Brighton & Hove',    league:'premier_league', rep:3, color:'#0057B8', budget:50,  wage:2.2, sqRating:76 },
  { id:'brentford',   name:'Brentford',          league:'premier_league', rep:3, color:'#D20000', budget:40,  wage:1.8, sqRating:75 },
  { id:'wolves',      name:'Wolverhampton',      league:'premier_league', rep:3, color:'#FDB913', budget:45,  wage:2.0, sqRating:74 },
  { id:'crystal',     name:'Crystal Palace',     league:'premier_league', rep:3, color:'#1B458F', budget:35,  wage:1.7, sqRating:73 },
  { id:'fulham',      name:'Fulham',             league:'premier_league', rep:3, color:'#CC0000', budget:40,  wage:1.8, sqRating:74 },
  { id:'everton',     name:'Everton',            league:'premier_league', rep:3, color:'#003399', budget:30,  wage:1.5, sqRating:72 },
  { id:'nottm_forest',name:'Nottingham Forest',  league:'premier_league', rep:3, color:'#DD0000', budget:35,  wage:1.6, sqRating:73 },
  { id:'bournemouth', name:'Bournemouth',        league:'premier_league', rep:2, color:'#DA291C', budget:25,  wage:1.2, sqRating:71 },
  { id:'leicester',   name:'Leicester City',     league:'premier_league', rep:3, color:'#003090', budget:30,  wage:1.4, sqRating:72 },
  { id:'ipswich',     name:'Ipswich Town',       league:'premier_league', rep:2, color:'#3A64A3', budget:20,  wage:1.0, sqRating:70 },
  { id:'southampton', name:'Southampton',        league:'premier_league', rep:2, color:'#D71920', budget:20,  wage:1.0, sqRating:69 },
  // Championship
  { id:'sunderland',  name:'Sunderland',         league:'championship',   rep:3, color:'#EB172B', budget:15,  wage:0.8, sqRating:71 },
  { id:'sheff_utd',   name:'Sheffield United',   league:'championship',   rep:3, color:'#EE2737', budget:14,  wage:0.75,sqRating:70 },
  { id:'derby',       name:'Derby County',       league:'championship',   rep:3, color:'#000000', budget:12,  wage:0.7, sqRating:69 },
  { id:'middlesbrough',name:'Middlesbrough',     league:'championship',   rep:3, color:'#E32221', budget:13,  wage:0.72,sqRating:69 },
  { id:'stoke',       name:'Stoke City',         league:'championship',   rep:3, color:'#E03A3E', budget:12,  wage:0.7, sqRating:68 },
  { id:'norwich',     name:'Norwich City',       league:'championship',   rep:3, color:'#00A650', budget:12,  wage:0.68,sqRating:68 },
  { id:'coventry',    name:'Coventry City',      league:'championship',   rep:2, color:'#58ABDF', budget:10,  wage:0.6, sqRating:67 },
  { id:'millwall',    name:'Millwall',           league:'championship',   rep:2, color:'#001D5E', budget:9,   wage:0.55,sqRating:66 },
  { id:'cardiff',     name:'Cardiff City',       league:'championship',   rep:2, color:'#0070B5', budget:10,  wage:0.6, sqRating:67 },
  { id:'qpr',         name:'Queens Park Rangers',league:'championship',   rep:2, color:'#1D5BA4', budget:8,   wage:0.5, sqRating:65 },
  { id:'preston',     name:'Preston North End',  league:'championship',   rep:2, color:'#FFFFFF', budget:7,   wage:0.45,sqRating:64 },
  { id:'swansea',     name:'Swansea City',       league:'championship',   rep:2, color:'#FFFFFF', budget:8,   wage:0.5, sqRating:65 },
  { id:'hull',        name:'Hull City',          league:'championship',   rep:2, color:'#F5A12D', budget:7,   wage:0.45,sqRating:64 },
  { id:'oxford',      name:'Oxford United',      league:'championship',   rep:2, color:'#FFD700', budget:6,   wage:0.4, sqRating:63 },
  { id:'plymouth',    name:'Plymouth Argyle',    league:'championship',   rep:2, color:'#007B5E', budget:6,   wage:0.4, sqRating:63 },
  { id:'luton',       name:'Luton Town',         league:'championship',   rep:2, color:'#F78F1E', budget:7,   wage:0.45,sqRating:64 },
  { id:'watford',     name:'Watford',            league:'championship',   rep:2, color:'#FBEE23', budget:8,   wage:0.5, sqRating:65 },
  { id:'birmingham',  name:'Birmingham City',    league:'championship',   rep:2, color:'#0000FF', budget:7,   wage:0.45,sqRating:64 },
  { id:'blackburn',   name:'Blackburn Rovers',   league:'championship',   rep:2, color:'#009EE0', budget:7,   wage:0.45,sqRating:63 },
  { id:'burnley',     name:'Burnley',            league:'championship',   rep:3, color:'#6C1D45', budget:10,  wage:0.6, sqRating:67 },
  // League One
  { id:'bolton',      name:'Bolton Wanderers',   league:'league_one',     rep:2, color:'#FFFFFF', budget:4,   wage:0.25,sqRating:61 },
  { id:'barnsley',    name:'Barnsley',           league:'league_one',     rep:2, color:'#EE3524', budget:4,   wage:0.25,sqRating:60 },
  { id:'charlton',    name:'Charlton Athletic',  league:'league_one',     rep:2, color:'#D4021D', budget:4,   wage:0.25,sqRating:61 },
  { id:'reading',     name:'Reading',            league:'league_one',     rep:2, color:'#004494', budget:5,   wage:0.3, sqRating:62 },
  { id:'wigan',       name:'Wigan Athletic',     league:'league_one',     rep:2, color:'#1B458F', budget:4,   wage:0.25,sqRating:61 },
  { id:'exeter',      name:'Exeter City',        league:'league_one',     rep:1, color:'#EC2227', budget:3,   wage:0.2, sqRating:59 },
  { id:'stevenage',   name:'Stevenage',          league:'league_one',     rep:1, color:'#FF0000', budget:2,   wage:0.15,sqRating:57 },
  { id:'burton',      name:'Burton Albion',      league:'league_one',     rep:1, color:'#F7C600', budget:3,   wage:0.2, sqRating:58 },
  { id:'shrewsbury',  name:'Shrewsbury Town',    league:'league_one',     rep:1, color:'#0C4899', budget:3,   wage:0.2, sqRating:58 },
  { id:'peterborough',name:'Peterborough Utd',   league:'league_one',     rep:2, color:'#034694', budget:4,   wage:0.25,sqRating:60 },
  { id:'cambridge',   name:'Cambridge United',   league:'league_one',     rep:1, color:'#F5A623', budget:2,   wage:0.15,sqRating:57 },
  { id:'stockport',   name:'Stockport County',   league:'league_one',     rep:1, color:'#003F6B', budget:3,   wage:0.2, sqRating:58 },
  // League Two
  { id:'grimsby',     name:'Grimsby Town',       league:'league_two',     rep:1, color:'000000', budget:1.5, wage:0.1, sqRating:55 },
  { id:'swindon',     name:'Swindon Town',       league:'league_two',     rep:1, color:'#CC0000', budget:1.5, wage:0.1, sqRating:54 },
  { id:'tranmere',    name:'Tranmere Rovers',    league:'league_two',     rep:1, color:'#FFFFFF', budget:1,   wage:0.08,sqRating:53 },
  { id:'colchester',  name:'Colchester United',  league:'league_two',     rep:1, color:'#0000FF', budget:1.5, wage:0.1, sqRating:54 },
  { id:'harrogate',   name:'Harrogate Town',     league:'league_two',     rep:1, color:'#F8C300', budget:1,   wage:0.08,sqRating:52 },
  { id:'crawley',     name:'Crawley Town',       league:'league_two',     rep:1, color:'#CC0000', budget:1,   wage:0.08,sqRating:52 },
  { id:'newport',     name:'Newport County',     league:'league_two',     rep:1, color:'#F7A32F', budget:1,   wage:0.08,sqRating:51 },
  { id:'doncaster',   name:'Doncaster Rovers',   league:'league_two',     rep:1, color:'#DD0000', budget:1.5, wage:0.1, sqRating:54 },
  // National League
  { id:'york',        name:'York City',          league:'national_league', rep:1, color:'#D00027', budget:0.5, wage:0.05,sqRating:50 },
  { id:'altrincham',  name:'Altrincham',         league:'national_league', rep:1, color:'#FF0000', budget:0.3, wage:0.04,sqRating:48 },
  { id:'gateshead',   name:'Gateshead',          league:'national_league', rep:1, color:'#000000', budget:0.3, wage:0.04,sqRating:47 },
  { id:'notts_county',name:'Notts County',       league:'national_league', rep:1, color:'#000000', budget:0.5, wage:0.05,sqRating:50 },
  // La Liga
  { id:'real_madrid', name:'Real Madrid',        league:'la_liga',        rep:5, color:'#FEBE10', budget:200, wage:6.5, sqRating:91 },
  { id:'barcelona',   name:'Barcelona',          league:'la_liga',        rep:5, color:'#A50044', budget:180, wage:6.0, sqRating:89 },
  { id:'atletico',    name:'Atletico Madrid',    league:'la_liga',        rep:5, color:'#CB3524', budget:120, wage:4.5, sqRating:86 },
  { id:'sevilla',     name:'Sevilla',            league:'la_liga',        rep:4, color:'#D4021D', budget:60,  wage:2.5, sqRating:80 },
  { id:'villarreal',  name:'Villarreal',         league:'la_liga',        rep:4, color:'#FFE135', budget:55,  wage:2.3, sqRating:79 },
  { id:'real_sociedad',name:'Real Sociedad',     league:'la_liga',        rep:3, color:'#0067B1', budget:40,  wage:1.8, sqRating:77 },
  { id:'betis',       name:'Real Betis',         league:'la_liga',        rep:3, color:'#00954C', budget:40,  wage:1.7, sqRating:76 },
  { id:'valencia',    name:'Valencia',           league:'la_liga',        rep:4, color:'#F1B80E', budget:35,  wage:1.5, sqRating:74 },
  { id:'athletic',    name:'Athletic Club',      league:'la_liga',        rep:3, color:'#EE2523', budget:35,  wage:1.5, sqRating:75 },
  { id:'getafe',      name:'Getafe',             league:'la_liga',        rep:2, color:'#005A9C', budget:20,  wage:0.9, sqRating:70 },
  { id:'osasuna',     name:'Osasuna',            league:'la_liga',        rep:2, color:'#D0021B', budget:15,  wage:0.7, sqRating:68 },
  { id:'girona',      name:'Girona',             league:'la_liga',        rep:2, color:'#CC0000', budget:20,  wage:0.9, sqRating:71 },
  { id:'alaves',      name:'Deportivo Alavés',   league:'la_liga',        rep:2, color:'#1D59A6', budget:12,  wage:0.6, sqRating:67 },
  { id:'celta',       name:'Celta Vigo',         league:'la_liga',        rep:2, color:'#8CBFD4', budget:18,  wage:0.8, sqRating:69 },
  { id:'las_palmas',  name:'Las Palmas',         league:'la_liga',        rep:2, color:'#F5A30B', budget:10,  wage:0.5, sqRating:66 },
  { id:'leganes',     name:'Leganés',            league:'la_liga',        rep:2, color:'#003DA5', budget:10,  wage:0.5, sqRating:65 },
  { id:'mallorca',    name:'RCD Mallorca',       league:'la_liga',        rep:2, color:'#D40000', budget:12,  wage:0.6, sqRating:66 },
  { id:'valladolid',  name:'Valladolid',         league:'la_liga',        rep:1, color:'#6A0DAD', budget:8,   wage:0.4, sqRating:63 },
  { id:'espanyol',    name:'Espanyol',           league:'la_liga',        rep:2, color:'#0070B8', budget:15,  wage:0.7, sqRating:68 },
  { id:'rayo',        name:'Rayo Vallecano',     league:'la_liga',        rep:2, color:'#DA291C', budget:10,  wage:0.5, sqRating:66 },
  // Bundesliga
  { id:'bayern',      name:'Bayern Munich',      league:'bundesliga',     rep:5, color:'#DC052D', budget:180, wage:6.2, sqRating:90 },
  { id:'dortmund',    name:'Borussia Dortmund',  league:'bundesliga',     rep:5, color:'#FDE100', budget:120, wage:4.8, sqRating:86 },
  { id:'leverkusen',  name:'Bayer Leverkusen',   league:'bundesliga',     rep:4, color:'#E32221', budget:90,  wage:3.8, sqRating:85 },
  { id:'rb_leipzig',  name:'RB Leipzig',         league:'bundesliga',     rep:4, color:'#DD0741', budget:80,  wage:3.5, sqRating:84 },
  { id:'frankfurt',   name:'Eintracht Frankfurt',league:'bundesliga',     rep:4, color:'#E2001A', budget:60,  wage:2.8, sqRating:80 },
  { id:'wolfsburg',   name:'VfL Wolfsburg',      league:'bundesliga',     rep:3, color:'#65B32E', budget:50,  wage:2.2, sqRating:77 },
  { id:'gladbach',    name:"Borussia M'gladbach", league:'bundesliga',    rep:3, color:'#000000', budget:45,  wage:2.0, sqRating:76 },
  { id:'stuttgart',   name:'VfB Stuttgart',      league:'bundesliga',     rep:3, color:'#E32221', budget:45,  wage:2.0, sqRating:78 },
  { id:'hoffenheim',  name:'Hoffenheim',         league:'bundesliga',     rep:3, color:'#1869AE', budget:35,  wage:1.6, sqRating:74 },
  { id:'werder',      name:'Werder Bremen',      league:'bundesliga',     rep:3, color:'#1D9053', budget:30,  wage:1.4, sqRating:73 },
  { id:'freiburg',    name:'SC Freiburg',        league:'bundesliga',     rep:3, color:'#D40000', budget:30,  wage:1.3, sqRating:73 },
  { id:'augsburg',    name:'FC Augsburg',        league:'bundesliga',     rep:2, color:'#005A9C', budget:20,  wage:0.9, sqRating:69 },
  { id:'bochum',      name:'VfL Bochum',         league:'bundesliga',     rep:2, color:'#005B8E', budget:15,  wage:0.7, sqRating:67 },
  { id:'heidenheim',  name:'FC Heidenheim',      league:'bundesliga',     rep:2, color:'#D40000', budget:12,  wage:0.6, sqRating:66 },
  { id:'mainz',       name:'FSV Mainz 05',       league:'bundesliga',     rep:3, color:'#CC0000', budget:25,  wage:1.1, sqRating:72 },
  { id:'union_berlin',name:'Union Berlin',       league:'bundesliga',     rep:3, color:'#EB1923', budget:25,  wage:1.1, sqRating:72 },
  { id:'kiel',        name:'Holstein Kiel',      league:'bundesliga',     rep:2, color:'#003DA5', budget:10,  wage:0.5, sqRating:65 },
  { id:'st_pauli',    name:'FC St. Pauli',       league:'bundesliga',     rep:2, color:'#6B0E1E', budget:10,  wage:0.5, sqRating:65 },
  // Serie A
  { id:'inter',       name:'Inter Milan',        league:'serie_a',        rep:5, color:'#010E80', budget:150, wage:5.5, sqRating:88 },
  { id:'juventus',    name:'Juventus',           league:'serie_a',        rep:5, color:'#000000', budget:130, wage:5.2, sqRating:86 },
  { id:'ac_milan',    name:'AC Milan',           league:'serie_a',        rep:5, color:'#FB090B', budget:120, wage:4.8, sqRating:85 },
  { id:'napoli',      name:'Napoli',             league:'serie_a',        rep:5, color:'#087AC2', budget:110, wage:4.5, sqRating:85 },
  { id:'roma',        name:'AS Roma',            league:'serie_a',        rep:4, color:'#8E1F2F', budget:80,  wage:3.5, sqRating:82 },
  { id:'lazio',       name:'Lazio',              league:'serie_a',        rep:4, color:'#87D8F7', budget:70,  wage:3.0, sqRating:80 },
  { id:'atalanta',    name:'Atalanta',           league:'serie_a',        rep:4, color:'#1E71B8', budget:75,  wage:3.2, sqRating:82 },
  { id:'fiorentina',  name:'Fiorentina',         league:'serie_a',        rep:3, color:'#6A0DAD', budget:50,  wage:2.2, sqRating:77 },
  { id:'bologna',     name:'Bologna',            league:'serie_a',        rep:3, color:'#00447C', budget:40,  wage:1.8, sqRating:76 },
  { id:'torino',      name:'Torino',             league:'serie_a',        rep:3, color:'#8B0000', budget:30,  wage:1.4, sqRating:73 },
  { id:'udinese',     name:'Udinese',            league:'serie_a',        rep:2, color:'#000000', budget:20,  wage:0.9, sqRating:70 },
  { id:'genoa',       name:'Genoa',              league:'serie_a',        rep:2, color:'#CC0000', budget:20,  wage:0.9, sqRating:69 },
  { id:'como',        name:'Como',               league:'serie_a',        rep:2, color:'#1B458F', budget:25,  wage:1.0, sqRating:70 },
  { id:'parma',       name:'Parma',              league:'serie_a',        rep:2, color:'#FFCC00', budget:18,  wage:0.8, sqRating:68 },
  { id:'cagliari',    name:'Cagliari',           league:'serie_a',        rep:2, color:'#CC0000', budget:15,  wage:0.7, sqRating:67 },
  { id:'venezia',     name:'Venezia',            league:'serie_a',        rep:2, color:'#F78F1E', budget:12,  wage:0.6, sqRating:65 },
  { id:'lecce',       name:'Lecce',              league:'serie_a',        rep:2, color:'#F5A623', budget:12,  wage:0.6, sqRating:65 },
  { id:'empoli',      name:'Empoli',             league:'serie_a',        rep:2, color:'#007AC0', budget:12,  wage:0.6, sqRating:65 },
  { id:'verona',      name:'Hellas Verona',      league:'serie_a',        rep:2, color:'#1B458F', budget:15,  wage:0.7, sqRating:66 },
  { id:'monza',       name:'Monza',              league:'serie_a',        rep:2, color:'#CC0000', budget:20,  wage:0.9, sqRating:69 },
  // Ligue 1
  { id:'psg',         name:'Paris Saint-Germain',league:'ligue_1',        rep:5, color:'#004170', budget:200, wage:7.0, sqRating:90 },
  { id:'marseille',   name:'Olympique Marseille',league:'ligue_1',        rep:4, color:'#009AC7', budget:70,  wage:3.0, sqRating:80 },
  { id:'lyon',        name:'Olympique Lyonnais', league:'ligue_1',        rep:4, color:'#CC0000', budget:60,  wage:2.8, sqRating:79 },
  { id:'monaco',      name:'AS Monaco',          league:'ligue_1',        rep:4, color:'#E4002B', budget:80,  wage:3.2, sqRating:81 },
  { id:'nice',        name:'OGC Nice',           league:'ligue_1',        rep:3, color:'#CC0000', budget:40,  wage:1.8, sqRating:76 },
  { id:'lens',        name:'RC Lens',            league:'ligue_1',        rep:3, color:'#E4002B', budget:35,  wage:1.5, sqRating:75 },
  { id:'rennes',      name:'Stade Rennais',      league:'ligue_1',        rep:3, color:'#000000', budget:35,  wage:1.5, sqRating:75 },
  { id:'strasbourg',  name:'Strasbourg',         league:'ligue_1',        rep:2, color:'#003FA5', budget:20,  wage:0.9, sqRating:70 },
  { id:'nantes',      name:'FC Nantes',          league:'ligue_1',        rep:3, color:'#F5A623', budget:25,  wage:1.1, sqRating:72 },
  { id:'toulouse',    name:'Toulouse FC',        league:'ligue_1',        rep:2, color:'#6A0DAD', budget:18,  wage:0.8, sqRating:69 },
  { id:'reims',       name:'Stade de Reims',     league:'ligue_1',        rep:2, color:'#CC0000', budget:18,  wage:0.8, sqRating:69 },
  { id:'brest',       name:'Stade Brestois',     league:'ligue_1',        rep:2, color:'#CC0000', budget:15,  wage:0.7, sqRating:68 },
  { id:'auxerre',     name:'AJ Auxerre',         league:'ligue_1',        rep:2, color:'#003DA5', budget:12,  wage:0.6, sqRating:66 },
  { id:'angers',      name:'Angers SCO',         league:'ligue_1',        rep:2, color:'#000000', budget:12,  wage:0.6, sqRating:65 },
  { id:'montpellier', name:'Montpellier',        league:'ligue_1',        rep:2, color:'#E4002B', budget:15,  wage:0.7, sqRating:67 },
  { id:'havre',       name:'Le Havre',           league:'ligue_1',        rep:2, color:'#003DA5', budget:10,  wage:0.5, sqRating:64 },
  { id:'saint_etienne',name:"Saint-Étienne",     league:'ligue_1',        rep:3, color:'#007A4D', budget:15,  wage:0.7, sqRating:67 },
  { id:'metz',        name:'FC Metz',            league:'ligue_1',        rep:2, color:'#6B0E1E', budget:10,  wage:0.5, sqRating:64 },
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

const FIRST_NAMES = ['James','John','Michael','David','Chris','Tom','Daniel','Jack','Ryan','Alex','Sam','Adam','Luke','Matt','Ben','Josh','Nathan','Oliver','Liam','Harry','Marcus','Kai','Jude','Phil','Mason','Bukayo','Trent','Declan','Jordan','Callum','Pedro','Carlos','Juan','Luis','Diego','Sergio','Alejandro','Pablo','Jorge','Marco','Luca','Lorenzo','Federico','Giovanni','Matteo','Antoine','Kylian','Ousmane','Theo','Hugo','Florian','Marcel','Thomas','Julian','Robert','Leroy','Karim','Sadio','Mo','Virgil','Kevin','Eden','Romelu','Ruben','Bernardo','Joao','Rafael','Andre','Gabriel','Willian','Richarlison','Thiago','Fabinho','Aymeric','Riyad','Youri','Timothy','Christian','Pierre','Erling','Vinicius','Rodrygo','Eder','Milan','Stefan','Dusan','Lautaro','Paulo','Ciro','Tammy','Dominic','Michail','Raheem','Danny','Emmanuel','Wilfried','Adama','Heung-Min','Takehiro','Kaoru','Hwang','Min-jae','Kim'];
const LAST_NAMES  = ['Smith','Jones','Williams','Brown','Taylor','Davies','Evans','Wilson','Thomas','Roberts','Johnson','Walker','Wright','Robinson','Thompson','White','Hughes','Edwards','Green','Hall','Wood','Harris','Martin','Jackson','Clarke','Turner','Hill','Scott','Young','Morris','Baker','Fernandez','Garcia','Martinez','Lopez','Rodriguez','Sanchez','Perez','Gonzalez','Hernandez','Muller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Rossi','Ferrari','Russo','Bianchi','Esposito','Romano','Ricci','Marino','Greco','Bruno','Dubois','Martin','Bernard','Moreau','Laurent','Simon','Michel','Leroy','Roux','David','Silva','Santos','Ferreira','Pereira','Costa','Oliveira','Rodrigues','Alves','Nascimento','Sousa','Mane','Salah','Kante','Pogba','Benzema','Giroud','Lloris','Mbappe','Griezmann','Dembele','Rashford','Saka','Mount','Rice','Alexander-Arnold'];
const NATIONALITIES = ['English','Spanish','German','French','Italian','Brazilian','Argentine','Portuguese','Dutch','Belgian','Senegalese','Egyptian','Ivorian','Ghanaian','Nigerian','South Korean','Japanese','Croatian','Serbian','Polish','Swedish','Danish','Norwegian','Swiss','Austrian','Czech','Uruguayan','Colombian','Mexican','American'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generatePlayer(id, pos, clubRating, age) {
  const firstName = pick(FIRST_NAMES);
  const lastName  = pick(LAST_NAMES);
  const baseRating = clubRating + rand(-8, 8);
  const ovr = Math.max(45, Math.min(99, baseRating));
  const pot = Math.min(99, ovr + rand(0, Math.max(0, 28 - age)));

  const isGK = pos === 'GK';
  const isDef = ['CB','LB','RB','LWB','RWB'].includes(pos);
  const isMid = ['CM','CDM','CAM','LM','RM'].includes(pos);
  const isAtt = ['ST','CF','LW','RW'].includes(pos);

  const attrs = {
    pace:     isGK ? rand(30,55) : isAtt ? rand(60,95) : isDef ? rand(50,80) : rand(55,85),
    shooting: isGK ? rand(10,30) : isAtt ? rand(55,90) : isMid ? rand(40,70) : rand(20,50),
    passing:  isGK ? rand(40,70) : isDef ? rand(40,72) : isMid ? rand(60,90) : rand(50,80),
    dribbling:isGK ? rand(20,40) : isAtt ? rand(60,95) : isMid ? rand(55,85) : rand(35,70),
    defending:isGK ? rand(10,30) : isDef ? rand(60,90) : isMid ? rand(40,70) : rand(20,50),
    physical: isGK ? rand(55,80) : rand(50,85),
    gkReflexes: isGK ? rand(60,92) : rand(5,20),
    gkPositioning: isGK ? rand(60,92) : rand(5,20),
  };

  const value = calcValue(ovr, age);
  const wage  = Math.round(value / 150) * 5 + rand(-5,15);

  return {
    id, firstName, lastName,
    name: `${firstName} ${lastName}`,
    pos,
    age: age || rand(17, 35),
    nationality: pick(NATIONALITIES),
    ovr,
    pot,
    attrs,
    value,
    wage: Math.max(5, wage),
    contract: rand(1, 4),
    morale: rand(65, 95),
    fitness: rand(75, 100),
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
  const base = Math.pow(1.12, ovr - 60) * 2;
  const ageMult = age < 23 ? 1.4 : age < 27 ? 1.2 : age < 31 ? 1.0 : age < 33 ? 0.7 : 0.4;
  return Math.round(base * ageMult * 10) / 10;
}

const POSITION_SETS = {
  GK:  ['GK'],
  DEF: ['RB','CB','CB','LB'],
  MID: ['CM','CM','CDM'],
  ATT: ['ST','RW','LW'],
};

function generateSquad(club) {
  const players = [];
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
  positions.forEach(({ pos, count }) => {
    for (let i = 0; i < count; i++) {
      const age = pos === 'GK' ? rand(22, 36) : rand(17, 33);
      players.push(generatePlayer(`${club.id}_p${pid++}`, pos, club.sqRating, age));
    }
  });
  return players;
}

function buildClub(data) {
  return {
    ...data,
    shortName: data.name.split(' ').slice(-1)[0],
    budget: data.budget,
    wageBudget: data.wage,
    players: generateSquad(data),
    form: [],
    results: [],
    tableStats: { played:0, won:0, drawn:0, lost:0, gf:0, ga:0, points:0 },
    europeanStats: { played:0, won:0, drawn:0, lost:0, gf:0, ga:0, points:0 },
  };
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase();
}

window.DATA = { LEAGUES, CLUBS_DATA, FORMATIONS, buildClub, generatePlayer, getInitials, calcValue };
