# Real-world padel match statistics (reference for game balancing)

Compiled 2026-11-26 from peer-reviewed match-analysis studies (mostly World Padel Tour / Premier Padel video
coding), plus a few analytics sources (Padel Intelligence data via press, the Padelmetrics newsletter) and
student theses for amateur/youth levels. Every figure carries a source tag `[n]` that points to the list at the end.

**How to read the numbers.** Two different denominators show up, and mixing them is the most common mistake:

- **% of point-ending shots** (the last shot of a rally): winners + forced errors + unforced errors = 100%.
  Use these for "how do points end".
- **% of all shots of a type** (per-shot effectiveness): winner + error + continuation ("into play") = 100%.
  Use these for "what happens when a player hits a smash / lob / volley".

Level and sex labels: **PRO** = WPT/Premier main draw unless stated; **SUB-ELITE** = national-league,
top national ranking or federation first category; **AMATEUR/YOUTH** = beginners, initiation, juniors. M = men, W = women.

---

## 1. Summary table: key reference ranges

### 1a. How points end and rally shape

| Metric | PRO men | PRO women | Sub-elite / amateur | Main sources |
|---|---|---|---|---|
| Points ending in a **winner** (% of endings) | **38-48%** (full range 34-48%) | **33-37%** (26% on golden points) | 37% (Finnish top-60 M); about 29% (youth beginners, derived) | [1][3][4][5][9][22] / [6][40][41] |
| Points ending in an **error** (forced + unforced) | 52-62% (up to 66% in mixed M+W samples) | 63-74% | 63% (Finnish M); 65.5% of points come from the opponent's UE (Italian Serie B M) | [2][3][4][20] / [6][38] |
| **Unforced errors** (% of endings) | 29-45% (most often 33-39%) | 38-43% | 40% (Finnish M); 43% (kids, tiny sample) | [1][5][8][9][22] / [6][41] |
| **Forced errors** (% of endings) | 13-29% (most often 17-29%) | 28-32% | 23% (Finnish M); 28% (kids) | [1][5][8][9][22] / [6][41] |
| **Aces** | about 0-0.1% of serves | 0% | about 2% of serves (Italian sub-elite M) | [1][32] / [38] |
| **Double faults** | about 0.2% of serve points (2% of 2nd serves) | n/a | 1.6% (Italian sub-elite M) | [1] / [38] |
| **1st-serve faults** | 9-11% | 12-13% | about 20% (78.8% of 1st serves in) | [1][32] / [38] |
| **Shots per point** (mean) | **8-11** (Premier 2025 season 7.95; WPT studies 9.3-10.8) | **9.5-12.8** (Premier 2025 season 9.52) | 4.1-4.7 (sub-elite, national A-level, youth initiation) | [12][13][14][15][47] / [38][39][40] |
| **Point duration** (mean) | **9.4-14.8 s** | **14.4-16.8 s** | 6.5-7.7 s (sub-elite/initiation); 12.7 s (regional 1st category) | [9][10][12][13] / [38][39][40][44] |
| **Serving pair wins the point** | **60-63%** | **48-58%** | 60% (Finnish M) | [15][32][47] / [6] |

### 1b. Per-shot effectiveness (% of all shots of that type; PRO unless stated)

| Shot | Winner % | Error % | Continuation % | Notes / sources |
|---|---|---|---|---|
| **Smash (all types)**, M | **41-53%** | 5-6% | 43-54% | 45.1% W [1]; 52.5% W [22, derived]; best players 48-70% "efficiency" [45] |
| Smash hit **from the net zone**, M | 74% | 2% | 24% | [22, derived] |
| Smash hit **from mid-court**, M | 40% | 6% | 54% | [22, derived] |
| **Flat smash** | M 52%, W 33% | M 4%, W 4% | M 44%, W 63% | [21] |
| **Topspin smash** (the x3/x4 type) | M 41%, W 29% | M 2%, W 8% | M 57%, W 63% | [21] |
| Smash **that ended the point**: winner share | M 77-89%, W 63-75% | M 11-23%, W 25-37% | n/a | [19][23] |
| **x3 / x4** (ball leaves the court) | x3 smash appears in 4-9% of points | rarely an error | n/a | x3+x4 = 22-28% of men's and 24-41% of women's winning smashes [12][18][19] |
| **Bandeja** | 2-7% | 3-6% | 87-95% | [1][21][22] |
| **Víbora** | not found separately | | | Always grouped with the bandeja ("tray") |
| **Bajada de pared / off-the-wall smash** | **8-17%** | **7-15%** | 70-84% | the riskiest attacking shot [1][21][17] |
| **Volley** | 3.4-5.7% | 5-7% (UE 3.4-4.8% + FE 2-2.6%) | 87-91% | [1][22] |
| **Lob (globo)** | about 0% | 3-7% | 93-96% | beats the net pair about 25-31% of the time [24][45]; lobs are 0-0.3% of winners but 14-16% of errors [2][4] |
| **Groundstroke** (direct, from the back) | <1% | 5-7% | 92-94% | [1][22] |
| **Back-glass exit** (salida de pared) | <1% | 8.6-8.8% (mostly UE) | 90-91% | [1] |
| **Double wall** | 0-7% | 10-13% | 84-87% | [1][26] |
| **Contrapared** | 0% | 16% (FE 11%, UE 5%) | 85% | [1] (n=129) |
| **Serve** | about 0% | 9-13% faults | 87-91% | [1][32] |
| **Return** | about 0% | 4-5% | about 95% | [32] |
| **Chiquita, dejada, bloqueo** | **not found** | | | No published per-shot figures. Closest proxy: direct groundstrokes from the back (row above) |

### 1c. Position

| Metric | Value | Source |
|---|---|---|
| Points **scored** (winners) at the net | **>80%** (PRO M); 57% net / 32% mid / 11% baseline (PRO M+W) | [11][2] |
| Errors by zone | baseline 42%, mid 31%, net 27% (PRO M+W) | [2] |
| Rallies finishing at the net | about 60% (PRO M) | [11] |
| Winner rate per shot by zone (PRO M) | net 8.6%, transition 5.5%, baseline 0.6% | [22, derived] |
| % of points won "while holding the net" | **not found directly.** Proxies: serving pair (which takes the net) wins 60-63% (M) and 48-58% (W). The server's edge holds only up to about shot 6-12 | [15][27][32][34] |
| Lob actually dislodges the net pair | 25-31% of lobs (PRO); best player in 2024 recovered the net after 25.7% of lobs | [24][45] |

---

## 2. Detail by topic

### 2.1 How points end

**Professional men**

- **Mellado-Arbelo, Baiget & Vivès 2019** [1]. WPT 2014 QF/SF/F, 8 matches, 8,581 shots, men.
  Of 1,060 point-ending shots: **unforced errors 44.9%, winners 38.4%, forced errors 16.7%**.
  Of all shots: 87.6% continued, 5.5% were UE, 4.7% winners, 2.1% forced errors.
- **Courel-Ibáñez, Sánchez-Alcaraz & Cañas 2017** [9]. WPT Masters Final 2013, 1,527 rallies, men.
  From their Table 2 (my tally): **winners 45.2%, forced errors 22.3%, unforced errors 32.5%** of 1,526 endings.
  About 40% of unforced errors occur in the first 4 s of a rally. More than half of points are won between seconds 5 and 11.
- **Conde-Ripoll, Martín-Miguel, Sánchez-Alcaraz & Escudero-Tena 2025** [5]. WPT Finland Open 2023, main and qualifying draws.
  Men, 2,796 rallies (my tally): **W 37.9%, FE 29.0%, UE 33.1%**. Women, 2,033 rallies: **W 33.2%, FE 28.4%, UE 38.4%**.
  Set winners hit about 59-60% of all winners. Set losers made about 56-60% of the errors.
- **Conde-Ripoll, Boullosa, Gómez-Carmona & Escudero-Tena 2025** [8]. Same tournament, endings by side:
  - Men, left side: W 40-42%, FE 22-29%, UE 29-37%. Men, right side: W 33-34%, FE 29-33%, UE 33-38%.
  - Women, left side: W 36-37%, UE 36-38%. Women, right side: W 29-30%, UE 38-43%.
  - The left-side (backhand-side, usually the "smasher") player ends more points with winners.
- **Escudero-Tena, Muñoz, Sánchez-Alcaraz, García-Rubio & Ibáñez 2022** [3]. WPT 2021, 2,759 points from golden-point games.
  - Errors / winners: **men 58.7% / 41.3%; women 63.2% / 36.8%**. Forced and unforced were not separated.
- **Martín-Miguel et al. 2024 (Contribuciones)** [4]. WPT 2023, 878 points.
  - Last shot a winner: **men 44.8%, women 36.1%** (errors 55.2% / 63.9%). The same 55.2/44.8 (M) and 63.9/36.1 (W) splits appear in [23].
- **Sánchez-Alcaraz et al. 2022** [2]. WPT Master Final 2021, 1,927 points, men and women pooled: **winners 33.9%, errors 66.1%**.
- **Martín-Miguel et al. 2025 (golden points)** [20]. 418 golden points, WPT 2023: winners **38.8% (M) vs 26.2% (W)**.
  Pressure points end more often in errors, especially for women.
- **Ampuero, Fuentes-García & Baiget 2025** [22]. Premier Padel 2022, 10,321 shots, men. From Table 2 (my tally):
  - Endings: W 48.1%, FE 12.7%, UE 39.2%.
  - Of all shots, 90.2% stayed in play.
- **Padel Intelligence data, Premier Padel 2024** [46]. First four men's tournaments: 13,456 winners vs 10,140 unforced errors.
  That is a W:UE ratio of 1.33, or winners = 57% of (W + UE). Forced errors were not reported.
  - Player shot-level rates: Galán winners on 10.5% of his shots and UE on 4%; Chingotto UE 2.5% and winners 3.5% [46].
  - Coki Nieto had the lowest UE rate, 2.1% of shots [45].
  - Men's winner rate per shot: 5.9% at the Paris Major 2025, 6.2% season average [47].
- **Example official match sheet** [48]. Finland P2 2024 final (Lebrón/Di Nenno vs Nieto/Sanz), 117 points:
  - 54 winners (46%), 25 UE (21%); the remainder are forced errors and other endings.
  - 8.5 shots per point.

**Professional women**

- Women end fewer points with winners and more with errors: W 33-37% vs 38-45% for men [3][4][5].
- Women make more unforced errors per set: **about 6.9-7.5 UE per set for set winners, about 9.0-9.4 for set losers.**
  The men's figures are about 6.0-6.1 and 7.8-8.0 (WPT 2016-2022, 2,567 sets) [7].
- Women's WPT finals 2018 (1,324 baseline actions) [25]:
  - The baseline action itself was a winner 12.8%, UE 12.2%, FE 8.1%.
  - The point continued in the remaining cases. These figures are per action, not per point.

**Serve, aces, double faults**

- Pro serve, WPT 2020 Masters Final [32]: 1st serves in 92.9% (M) / 87.7% (W); serve faults 8.8% (M) / 13.0% (W); **0 aces** in 668 serves.
- [1] (WPT 2014 men):
  - First serve: 10.6% faults, 1 winner out of about 965 (0.1%).
  - Second serve: 2 errors out of 97 (2.1%). That is about 0.2% double faults per serve point.
- Italian Serie B (sub-elite men) [38]: first serve in 78.8%, **aces 2%, double faults 1.6%**. Serve errors were 30.6% of all errors.
- Lithuanian national A-level (simulated matches) [39]: 1st-serve in 80.2%, 2nd-serve in 91.0%.
- Padel Intelligence reports Coello at 16.7% "direct serves" [45]. The metric is undefined (probably serve + return-error points), so treat it with care.

### 2.2 Rally / point length

**Shots per point (mean)**

| Study | Level | Men | Women |
|---|---|---|---|
| Martín-Miguel et al. 2024 [12] (WPT 2020 QF-F, 3,239 points) | PRO | 10-11 | similar (n.s.) |
| Lupo et al. 2018 [13] (WPT 2016) | PRO | 9.6 | 12.2 |
| Torres-Luque et al. 2015 (cited in [10]) | PRO | 9.38 (both sexes) | |
| Mauro et al. 2026 [15] (Premier 2023, 3,537 points) | PRO M | 9.34 (SD 7.56) | |
| Premier Padel 2024, e-balonmano 2026 [14] | PRO | 8 | 11 |
| Padel Intelligence, Premier 2025 season avg [47] | PRO | 7.95 | 9.52 |
| Paris Major 2025 [47] | PRO | 8.87 | 10.99 |
| Golden points, WPT 2023 [20] | PRO | 10.82 | 12.77 |
| 2015 RAMD abstract, sex comparison [44] | PRO | 6.55-7.67 | 6.89-9.71 |
| Italian Serie B [38] | SUB-ELITE M | 4.7 | |
| Lithuanian national A-level (simulated) [39] | SUB-ELITE M | 4.53 | |
| García-Benítez et al. 2018 (via review [36]) | YOUTH national U16/U18 | 6.1 / 8.0 | 6.9-7.2 |
| Andreu et al. 2021 [40] | INITIATION youth M (13.5 y) | 4.08 (range 1-15) | |

**Duration**

- PRO men: 9.4 s (WPT 2013) [9][10], 12.6 s [13], 13.5-14.8 s [12].
- PRO women: 14.4-16.2 s [12], 16.8 s [13]. Review range: 12.5-13.5 s average across sexes [36].
- Pace (shots per second): men 0.80-0.83, women 0.73-0.75 [12][14].
- Live ball is about 30-46% of match time:
  - About 30% (PRO) [36]; 31% (Italian sub-elite) [38]; 46% (regional 1st category) [44].
  - Rest between points: 14.8-17.4 s [38][39][44].
- Sub-elite / amateur: 6.7 s [38], 6.5 s [39], 7.66 s (initiation) [40].
  Beginner men: over 70% of rallies ended within 9 s (Ramón-Llin et al. 2021, via review [36]).
- Regional first category: 12.7 s [44].

**Distributions**

- Duration, WPT 2013 men (Courel-Ibáñez & Sánchez-Alcaraz 2017) [10]:

  | <3 s | 3-6 s | 6-9 s | 9-12 s | 12-15 s | 15-18 s | 18-21 s | >21 s |
  |---|---|---|---|---|---|---|---|
  | 6.3% | 36.8% | 21.5% | 12.9% | 7.9% | 4.5% | 3.6% | 6.5% |

  - Match losers lost 38% of their points in the first 4 s, against 27% for match winners.
  - Winners won 33% of their points after 11 s, against 22% for losers.
- Shot-count distribution of **points that ended with a winner**, WPT 2021 finals [18]:

  | Shots | Men | Women |
  |---|---|---|
  | 1-5 | 41.1% | 36.1% |
  | 6-10 | 33.0% | 28.0% |
  | >10 | 26.0% | 36.1% |

- Padelmetrics, 3,281 men's points from WPT/Premier [16]: **about 76% of points last up to 12 shots, 24% longer.**
  About 71% of the points gap between winners and losers comes from short points.
- Ramón-Llin et al. 2019 [27], national-tour and regional players, rally length:

  | Shots | National | Regional |
  |---|---|---|
  | 1-2 | 2.6% | 2.3% |
  | 3-4 | 11.5% | 9.4% |
  | 5-6 | 14.9% | 10.2% |
  | 7-8 | 12.8% | 11.5% |
  | 9+ | 58.2% | 66.7% |

  These are 2012 data and probably count shots differently from other studies.
- Premier 2024 [14]: points under 11 shots dominate men's matches; points over 11 shots dominate women's.

### 2.3 Per-shot effectiveness

**Mellado-Arbelo et al. 2019 [1], PRO men, WPT 2014: full outcome per shot type** (W / FE / UE / continued)

| Shot | n | Winner | Forced err. | Unforced err. | Continued |
|---|---|---|---|---|---|
| Smash (remate) | 512 | **45.1%** | 0.8% | 5.9% | 48.2% |
| Fake smash (finta) | 76 | 9.2% | 0% | 5.3% | 85.5% |
| Bandeja | 514 | 3.5% | 0.2% | 3.1% | 93.2% |
| Forehand volley | 1,115 | 5.7% | 2.2% | 4.8% | 87.4% |
| Backhand volley | 1,428 | 3.4% | 2.6% | 3.4% | 90.6% |
| Forehand / backhand (direct) | 914 / 1,060 | 0.9% / 0.8% | 1.6% / 1.5% | 4.6% / 5.8% | 92.9% / 91.9% |
| Back-glass exit, forehand (salida de pared) | 534 | 0.7% | 3.4% | 5.4% | 90.4% |
| Back-glass exit, backhand | 347 | 0.3% | 2.3% | 6.3% | 91.1% |
| **Bajada de pared, forehand** | 189 | **7.9%** | 0% | **8.5%** | 83.6% |
| Bajada de pared, backhand | 33 | 0% | 0% | 3% | 97% |
| Side wall, forehand / backhand | 74 / 155 | 0% / 0.6% | 0% / 1.3% | 6.8% / 8.4% | 93.2% / 89.7% |
| Double wall (all variants pooled, my tally) | 304 | 0.3% | 6.9% | 5.9% | 86.8% |
| Contrapared, back wall, forehand | 129 | 0% | 10.9% | 4.7% | 84.5% |
| First serve | 965 | 0.1% | 0% | 10.6% (faults) | 89.3% |
| Second serve | 97 | 0% | 0% | 2.1% | 97.9% |

(In this coding a "forced error" is an error committed with that shot under pressure.)

**Ampuero et al. 2025 [22], PRO men, Premier 2022, 10,321 shots: per-shot outcome by type and zone** (my tally from Table 2)

| Shot | All zones: W / FE / UE / in play | Net zone | Transition | Baseline |
|---|---|---|---|---|
| Smash (n=524) | **52.5% / 0 / 5.0% / 42.6%** | W 73.9%, UE 2.1% | W 40.3%, UE 6.0% | W 42.9% (n=21) |
| Fake smash (n=83) | 6.0% / 0 / 3.6% / 90.4% | | | |
| Tray / bandeja (n=1,745) | 1.8% / 0.1% / 3.3% / 94.8% | | W 1.8%, UE 3.0% | W 1.1%, UE 4.3% |
| Volley (n=3,273) | 4.6% / 1.9% / 4.1% / 89.4% | W 5.0%, FE 1.8%, UE 4.0% | W 1.4%, UE 5.4% | |
| Lob (n=2,739) | 0.0% / 0.5% / 3.1% / 96.3% | | | UE 3.0% |
| Forehand (n=1,012) | 1.4% / 3.0% / 4.3% / 91.3% | W 4.8%, FE 6.2% | | UE 4.7% |
| Backhand (n=945) | 1.1% / 1.9% / 4.7% / 92.4% | W 5.8%, FE 5.8% | | UE 5.1% |

**Smash family**

- **Sánchez-Alcaraz et al. 2020 [21]**. WPT 2019 finals, 1,015 smashes. Continuity / winner / error, M vs W:

  | Type | Continuity | Winner | Error |
  |---|---|---|---|
  | Tray (bandeja) | 89.7% / 87.0% | 7.2% / 6.8% | 3.1% / 6.2% |
  | Flat | 43.9% / 63.1% | 51.8% / 33.3% | 4.3% / 3.6% |
  | Topspin | 56.9% / 62.5% | 41.2% / 29.2% | 2.0% / 8.3% |
  | Off the wall (bajada) | 75.6% / 69.6% | 17.1% / 15.2% | 7.3% / 15.2% |

  - Usage: tray 62% of all overheads (women 68.8%, men 55.7%); flat 22%; topspin 7%; off-wall 9%.
  - Smash winning effectiveness is highest close to the net and drops farther back.
- **Finishing smashes (Escudero-Tena et al. 2023) [19]**. 806 smashes that ended a point, WPT 2021:
  - Winners **76.7% (M) / 63.2% (W)**; errors 23.3% / 36.8%.
  - Where men's winning smashes ended: bounced back to the smasher's own side 63.5%, double bounce on the opponent's side 14.8%, **x3 13.6%, x4 8.1%**.
  - Women's winning smashes: own side 32.0%, opponent's side 44.4%, **x3 13.3%, x4 10.2%**.
  - Slice smashes were 55-63% of smash errors.
- **Pozo-Ayerbe et al. 2024 [18]** (WPT 2021 finals): where smash winners ended:
  - Men: back to own court 53.5%, **x3 15.8%, x4 11.7%**, at the body 13.2%, feint 5.9%.
  - Women: own court 34.0%, **x3 19.4%, x4 22.0%**, body 15.2%, feint 9.4%.
- **López-Sierra et al. 2025 [23]**: when a smash or recovery smash was the last shot, men 89.4% winners. Women's smashes 74.5% winners.
- **Frequency of x3** [12]: the x3 smash appears in 7-8% of men's points and 4-9% of women's points. A fake smash appears in 4-6% of men's points.
- **Smash share of all winners**:
  - Men 35-55%: 35% [18], 36% [13], 43% (M+W) [2], 45% (amateur Finnish) [6], 54% [4], 55% (golden points) [20].
  - Women 28-36% [4][18][20].
  - Bandeja share of winners: 5-13% [2][4][18].
- Padel Intelligence 2024 season, best players [45]: Galán 61% direct-smash accuracy and 19.3 smash winners per match; Chingotto 69.6%; Jon Sanz 48.5% smash efficiency. Definitions not published.

**Bajada de pared (attacking shot after the back glass)**

- Per shot (PRO M): **W 7.9%, UE 8.5%** [1]. Off-wall smash: W 15-17%, err 7-15% [21].
  It is the riskiest shot apart from the first serve, by UE rate [1][17].
- When the bajada ends a point: 1.8% (M) / 6.7% (W) of winners; 3.2-3.3% of errors [4].
- It is used in 14-25% of points [12] and is less than 3% of all shots [17].
- Opponents are at the net 73.7% of the time when a bajada is hit [17] (citing [1]-type WPT data).
- Juniors (Spanish championship, via [17]): W 15.9%, UE 15.2% per bajada. That is higher risk and higher reward than pros, though the methods differ.
- Women main draw: more forehand-bajada UEs than the qualifying draw [8].

**Volley**: per shot W 3.4-5.7%, UE 3.4-4.8%, FE about 2-2.6% [1][22]. Volleys are 28% of all winners (M+W) but also 30% of all errors [2].

**Lob (globo)**

- Per shot (PRO M): W about 0%, UE 3.1%, in play 96% [22].
- Pilot study [24] (2021 Master Final, 296 lobs):
  - **Lob gets past the net pair 28.3%** (M 24.5%, W 30.5%); does not get past 64.6%; errors 6.7%.
  - Lobs per point: 1.67 (M) / 2.27 (W).
- Lobs appear in 76-86% of points [12]. They are 22.8-25.5% of men's shots and 29.5-30.8% of women's shots (Premier 2025) [47].
- As a last shot: 0 winners and **14-16% of all point-ending errors** [4]. In [2] they were 0.3% of winners and 14.8% of errors.
- Women's WPT finals 2018 [25]: lobs were 85.4% of baseline actions, and 70.4% of those actions achieved the offensive position.
  This is a much more generous definition than [24].
- Muñoz-Marín et al. 2016 (cited in [24]):
  - The lob is the main way to the net: 60.6% of net-reaching actions.
  - The chance of continuing the point is 1.6-4.8 times higher after a lob than after a low shot.

**Contrapared**: per shot FE 10.9%, UE 4.7%, 0 winners (PRO M, n=129) [1]. Pro men committed more contrapared and double-wall UEs than amateurs [37].

**Double wall**:
- Open double wall [26] (WPT, 451 shots): continuity 83.6-84.0%, error 9.7-9.8%, winner 6.1-6.8%, no sex difference.
- All double walls pooled (PRO M) [1]: continuity 86.8%, FE 6.9%, UE 5.9%.

**Serve and return**

- Return [32]: continuity about 95%, errors 5.4% (M) / 3.9% (W), winners about 0%.
  - Lob returns: 35% (M) / 47% (W). Return directions: 57% down the line (M), 25-30% to the middle.
- Lob returns that land deep (about 8.6 m from the net) led to long rallies 79.8% of the time [27].
- Serve direction: 63-65% to the side glass, 7-16% to the middle, 24-30% to the T [15][32].
- 89% of serves are short and 11% deep [15].

**Before vs after the back glass** (PRO M, [1])

| Shot type | Continued | Errors | Winners |
|---|---|---|---|
| Direct groundstrokes (before the glass) | 92.4% | 6.9% | 0.8% |
| Back-glass exits | 90.7% | 8.7% | 0.6% |
| Double wall | 86.8% | 12.8% | 0.3% |
| Bajada (attacking off the glass) | 84-86% | 8-9% | 7-8% |

So playing off the glass costs about 2-6 points of error rate, mostly as *forced* errors. It almost never produces winners, except through the bajada.

**Víbora, chiquita, dejada, bloqueo: not found.**
- Víbora is grouped with the bandeja in every study found [4][20][23].
- "Topspin bandeja" appears in 16-23% of points [12], and an official match sheet counts "viborejas" separately (5-47 per player per match) [48].
- No paper reported per-shot rates for the chiquita, dejada (drop shot) or bloqueo. The closest proxies:
  - Direct groundstrokes from the back: W <1%, UE about 5%, in play about 92% [1][22].
  - Forehand/backhand hit from the net zone: W about 5-6%, FE about 6% [22].
- Rulo: Stupaczuk 23.7% "efficiency", 2.83 per match (best-player stat, undefined metric) [45].

### 2.4 Position (net vs back)

- **Courel-Ibáñez, Sánchez-Alcaraz & Cañas 2015** [11], WPT 2013 men, 2,107 rallies:
  - About **six in ten rallies finish at the net**, and **over 80% of points are scored at the net**.
  - Match winners scored 34% more points and made 49% fewer UE at the net than losers.
- **Sánchez-Alcaraz et al. 2022** [2], WPT 2021, men and women:

  | Zone | Share of winners | Share of errors |
  |---|---|---|
  | Net | **56.6%** | 26.6% |
  | Middle | 32.1% | 30.6% |
  | Baseline | **10.6%** | **42.0%** |

- **Pozo-Ayerbe et al. 2024** [18]: winners from the net 48.0% (M) / 39.0% (W); midcourt 29.0% / 25.1%; backcourt 22.0% / 36.1%.
- **Lupo et al. 2018** [13]: winning strokes close to the net 34.2% (M) / 20.9% (W); midfield 42.9% / 51.6%; baseline 23.0% / 27.5%.
- **Ampuero et al. 2025** [22] (per-shot rates, PRO M):

  | Zone | Share of shots | Winners per shot | Errors per shot |
  |---|---|---|---|
  | Baseline | 37.6% | **0.6%** | 4.7% |
  | Transition | 28.1% | 5.5% | 4.8% |
  | Net | 34.3% | **8.6%** | 5.7% |

  Only at the net did every outcome type occur.
- Ramón-Llin et al. 2022 (national 1st category men, via review [36]):
  - The last stroke is at the net in 60% of points, and the penultimate stroke is on the baseline in 64%.
  - The net zone accounts for 82.7% of winning points and 46.5% of errors.
- Attack actions [31] (WPT 2017 men's finals): pair winners made at least one attacking action in 85% of points; losers made none in 47%.
  Winners hit 41.2% of their shots from the net zone vs 35.3% for losers (national level) [28].
- One pro women's pair (2 matches, TFG) [43]: winner rate per shot was 2.3% in the defensive zone, 13.1% in construction and 35.4% in attack.
- **"% of points won when holding the net": not found as a direct statistic.** The closest proxies:
  - The serving pair, which normally takes the net after the serve, wins **60-63% (PRO M)** and **48-58% (PRO W)** [15][32][47].
    It wins 97.9% of 1-2 shot rallies, 64% of 3-6 shot rallies, 57% of 7-8 shot rallies and 42% of 9+ shot rallies (national tour) [27].
  - The serve advantage disappears from about the 9th shot [34], or the 12th (M) / 7th (W) [32].
    Each extra shot lowers the server's win probability by about 3.8% [15].
  - Winning the net back: a lob gets past the net pair 25-31% of the time [24].
    The best defender in Premier 2024 recovered the net after 25.7% of lobs [45].
    So the attacking pair keeps the net roughly 70-75% of the time a lob is played.
- **Attacking from the back** is ineffective. Groundstrokes from the baseline produce winners on under 1% of shots [1][22].
  Only 6% of all winners are groundstrokes [2]. Bajadas are the exception (8-17% winners).

### 2.5 Balls to the middle and deep against the back glass

- **Deep ball off the back glass, how often it is returned:** back-glass exits stay in play **about 90-91%** of the time, with errors about 9% (mostly UE) and winners under 1% (PRO M) [1].
  Double-wall balls are returned 84-87% of the time, with errors 10-13% [1][26].
  Pros rarely miss a single-glass ball. The pressure shows as a weak reply that leads to a winner on the next shot, rather than as an immediate error.
- Supporting evidence for that last point (PRO M+W) [4]:
  - The penultimate shot before a winner is often a volley or lob.
  - The penultimate shot before an error is a lob in 25-34% of cases and a groundstroke in 21-23%.
- Back-wall shots are very common: back-wall forehand in 42-48% of points, backhand in 29-36% [12].
  About 49% of all shots are hit from the back court [1].
- Where errors go [42] (WPT 2021): **into the net 45-51%, into the back wall (long) 28%, into the side wall 17-25%**.
- **Balls to the middle: no effectiveness study found.** Usage figures only:
  - About 20% of net-zone shots go to the centre [33].
  - Middle serves: 7-16% [15][32]. Middle returns: 25.6% (M) / 30.1% (W) [32].
  - Cross-court shots have about 8% higher winning odds; down-the-line shots have 23% higher error odds (via review [36]).
- Deep lobs (about 8.6 m from the net) are the defence that most often extends the rally: 79.8% long rallies [27].

### 2.6 Pro vs amateur differences

- **Fernandez-de-Osso et al. 2025** [37] (Retos; 180 matches, about 2,270 points, amateurs vs pros, M and W).
  This is the only direct comparison found; only corrected residuals were accessible:
  - Amateurs commit significantly more unforced errors (CSR 2.9-4.7). Pros hit more winners (CSR 2.0-4.0). Pro men also make more forced errors.
  - Amateur men win points more with forehands and bandejas, and miss more power smashes.
  - Amateur women miss more slow and recovery smashes.
  - Pro women produce more x3, fake and power-smash winners.
  - **Exact percentages are not available in the accessible abstract.**
- Point endings by level (different studies, so only roughly comparable):

  | Level | Winners | Forced errors | Unforced errors | Source |
  |---|---|---|---|---|
  | PRO men | 38-48% | 13-29% | 29-45% | [1][5][9][22] |
  | High-level Finnish men (top-60 national) | 37.0% | 22.8% | 40.1% | [6] |
  | Italian Serie B men | n/a | n/a | 65.5% of points come from the opponent's UE | [38] |
  | Youth initiation boys | about 29% (derived) | about 71% errors combined | | [40] |
  | Kids 9-11 (n=8 players, not reliable) | 29% | 28% | 43% | [41] |

  The Serie B figure [38] is the closest "club/sub-elite" number. There, losing pairs made errors on 15.5% of their shots vs 11.5% for winning pairs.
- Within the pro tour, qualifiers vs main draw [8]: when the returner won the point, the server's mistakes were unforced 41% in qualifying vs 32% in the main draw (M).
  In the main draw more of those points were won by forcing errors. Main-draw players force errors; qualifiers concede unforced ones.
- **Rally length falls sharply with level**: about 8-11 shots for pros vs 4-5 for sub-elite/amateur [38][39][40]. Point duration drops from 10-15 s to 6.5-7.7 s.
- Beginners stand in the traditional (non-Australian) serve formation on over 80% of points (via [36]).
  They reach the net more slowly and cover less ground: 8.3 m vs 11.8 m per point (via [36]).
  High-level players win more points with either formation [29].
- National vs regional (elite amateur) [27]:
  - The server's edge lasts until about shot 8 for national-tour players and shot 6 for regional ones.
  - National players allow the server less time and close to the net faster: 3.84-3.86 m vs 4.45-4.46 m from the net at the third shot.
- Bajada: juniors W 15.9% / UE 15.2% vs pros 7.9% / 8.5% [17].
- Women vs men (pros): women have longer rallies (+2-3 shots), more lobs (+0.6 per point), more bandejas and fewer flat smashes.
  They have fewer winners (-5 to -12 points of share) and more UE per set (+1 to +1.5) [7][12][13][21][24].
  Points end in winners more often for men in non-key moments but are close on golden points [3].

---

## 3. Notes on data quality

- Studies code "forced" vs "unforced" differently, and several report only "errors". UE shares across pro studies therefore range from 29% to 45%.
- Many papers contain internal inconsistencies (flagged in the papers themselves or found while extracting). Examples:
  - [21]'s abstract says flat/topspin winners are "near 60%", while its table gives 29-52%.
  - [1]'s abstract gives 45.9% vs 45.1% in its table.
  - In the [7] figures the set-winner column looks duplicated.
- Where I wrote "my tally" or "derived", I summed table counts myself. The authors did not report those percentages.
- Analytics-company figures (Padel Intelligence via press [45][46][47][48]) use undefined metrics. Use them as sanity checks only.
- Amateur adult club data is thin. No study with exact amateur percentages for winners/FE/UE was accessible beyond [6][38][40][41].

---

## 4. Sources

1. Mellado-Arbelo, Ó., Baiget, E., Vivès, M. (2019). Análisis de las acciones de juego en pádel masculino profesional. *Cultura, Ciencia y Deporte*, 14(42), 191-201. PRO M, WPT 2014. https://ccd.ucam.edu/index.php/revista/article/download/1332/455
2. Sánchez-Alcaraz, B.J., Muñoz, D., Sánchez-Pay, A., Martín-Miguel, I., Piedra, D., Barriocanal, I. (2022). Análisis de los golpes ganadores y errores en pádel profesional. *RICCAFD*, 11(3), 85-97. PRO M+W, WPT Master Final 2021. https://revistas.uma.es/index.php/riccafd/article/download/15474/16156/73921
3. Escudero-Tena, A., Muñoz, D., Sánchez-Alcaraz, B.J., García-Rubio, J., Ibáñez, S.J. (2022). Analysis of Errors and Winners in Men's and Women's Professional Padel. *Applied Sciences*, 12(16), 8125. PRO M+W. https://www.mdpi.com/2076-3417/12/16/8125
4. Martín-Miguel, I., Parraca, J.A., Escudero-Tena, A., Batalha, N., Muñoz, D. (2024). Análisis de la efectividad del último y penúltimo golpeo de la pareja en pádel profesional masculino y femenino. *Contribuciones a las Ciencias Sociales*, 17(1), 6216-6230. PRO M+W, WPT 2023. https://rdpc.uevora.pt/bitstream/10174/38008/1/2024_An%c3%a1lisis%20de%20la%20efectividad%20del%20%c3%baltimo%20y%20pen%c3%baltimo%20golpeo%20de%20la%20pareja%20en%20p%c3%a1del%20profesional%20masculino%20y%20femenino_Contribuiciones.pdf
5. Conde-Ripoll, R., Martín-Miguel, I., Sánchez-Alcaraz, B.J., Escudero-Tena, A. (2025). Determining Shot Effectiveness in Padel: Exploring Differences Between Winning and Losing Teams. *Applied Sciences*, 15(22), 11916. PRO M+W, WPT Finland 2023. https://www.mdpi.com/2076-3417/15/22/11916 (preprint: https://www.preprints.org/manuscript/202508.1788/v1)
6. Conde-Ripoll, R., Escudero-Tena, A., Clemente-Suárez, V.J., Navarro Jimenez, E., Bustamante-Sánchez, Á. (2025). Training under pressure mirrors competition: technical-tactical insights from high-level male padel players. *Frontiers in Sports and Active Living*, 7, 1505817. High-level non-elite M (Finland top 60). https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1505817/full
7. Conde-Ripoll, R., Muñoz, D., Sánchez-Alcaraz, B.J., Escudero-Tena, A. (2024). Analysis and prediction of unforced errors in men's and women's professional padel. *Biology of Sport*, 41(4). PRO M+W, WPT 2016-2022. https://www.termedia.pl/Analysis-and-prediction-of-unforced-errors-in-men-s-and-women-s-r-nprofessional-padel,78,52320,1,1.html
8. Conde-Ripoll, R., Boullosa, D., Gómez-Carmona, C.D., Escudero-Tena, A. (2025). Unveiling the gap: technical-tactical performance differences between main and qualifying draws in professional padel. *Biology of Sport*, 42(4), 97-106. PRO M+W. https://www.termedia.pl/Unveiling-the-gap-technical-tactical-performance-differences-r-nbetween-main-and-qualifying-draws-in-professional-padel,78,56017,1,1.html
9. Courel-Ibáñez, J., Sánchez-Alcaraz, B.J., Cañas, J. (2017). Game Performance and Length of Rally in Professional Padel Players. *Journal of Human Kinetics*, 55, 161-169. PRO M, WPT 2013. https://pmc.ncbi.nlm.nih.gov/articles/PMC5304268
10. Courel-Ibáñez, J., Sánchez-Alcaraz, B.J. (2017). Efecto de las variables situacionales sobre los puntos en jugadores de pádel de élite. *Apunts. Educación Física y Deportes*, 127, 68-74. PRO M. https://www.redalyc.org/journal/5516/551663337007/551663337007.pdf
11. Courel-Ibáñez, J., Sánchez-Alcaraz, B.J., Cañas, J. (2015). Effectiveness at the net as a predictor of final match outcome in professional padel players. *International Journal of Performance Analysis in Sport*, 15(2), 632-640. PRO M. https://econpapers.repec.org/RePEc:taf:rpanxx:v:15:y:2015:i:2:p:632-640
12. Martín-Miguel, I., Almonacid, B., Muñoz, D., Sánchez-Alcaraz, B.J., Courel-Ibáñez, J. (2024). Game Dynamics in Professional Padel: Shots Per Point, Point Pace and Technical Actions. *Sports*, 12(8), 218. PRO M+W, WPT 2020. https://mdpi.com/2075-4663/12/8/218
13. Lupo, C., Condello, G., Courel-Ibáñez, J., Gallo, C., Conte, D., Tessitore, A. (2018). Effect of gender and match outcome on professional padel competition. *RICYDE*, 14(51), 29-41. PRO M+W, WPT 2016. https://www.redalyc.org/journal/710/71055516004/71055516004.pdf
14. (Authors not shown on page) (2026). Game dynamics in men's and women's professional padel: volume, intensity and time parameters at Premier Padel. *E-balonmano.com*, 22(1), 45-54. PRO M+W, Premier 2024. https://revista-ebalonmano.unex.es/index.php/ebalonmano/article/view/2535
15. Mauro, M., Muñoz, D., Martín-Miguel, I., Toselli, S., García, F., Sánchez-Alcaraz, B.J. (2026). How Serve Tactics Shape Game Dynamics in Professional Men's Padel. *Perceptual and Motor Skills*, 133(3), 754-768. PRO M, Premier 2023. https://cris.unibo.it/retrieve/10999f7f-d9ec-4b3a-a812-5807f0c7c170/Manuscript_rev_engl.pdf
16. García Peñalver, F. (2024, Jan). Los partidos no se ganan en los puntos largos. *Padelmetrics* (Substack). PRO M. https://padelmetrics.substack.com/p/los-partidos-no-se-ganan-en-los-puntos
17. García Peñalver, F. (2024, Feb). La bajada de pared: ¿me ayuda o me perjudica? *Padelmetrics*. PRO M + juniors. https://padelmetrics.substack.com/p/atento-a-tu-bajada-de-pared-te-ayuda
18. Pozo-Ayerbe, C., Escudero-Tena, A., Ibáñez, S.J., Mancha-Triguero, D. (2024). Análisis de los diferentes golpes ganadores en pádel profesional: masculino vs. femenino. *E-balonmano.com*, 20(3), 271-280. PRO M+W. https://revista-ebalonmano.unex.es/index.php/ebalonmano/article/download/2106/2176
19. Escudero-Tena, A., Parraça, J.A., Sánchez-Alcaraz, B.J., Muñoz, D., Sánchez-Pay, A., García-Rubio, J., Ibáñez, S.J. (2023). Análisis de los remates finalistas en pádel profesional. *E-balonmano.com*, 19(2), 117-126. PRO M+W. https://revista-ebalonmano.unex.es/index.php/ebalonmano/article/download/2216/2120
20. Martín-Miguel, I., Sánchez-Alcaraz, B.J., Escudero-Tena, A., Conde-Ripoll, R., Muñoz, D. (2025). Diferencias en la finalización del punto de oro en pádel profesional masculino y femenino. *E-balonmano.com*, 21(1), 27-36. PRO M+W. https://revista-ebalonmano.unex.es/index.php/ebalonmano/article/download/2388/2188/8493
21. Sánchez-Alcaraz, B.J., Perez-Puche, D.T., Pradas, F., Ramón-Llín, J., Sánchez-Pay, A., Muñoz, D. (2020). Analysis of Performance Parameters of the Smash in Male and Female Professional Padel. *IJERPH*, 17(19), 7027. PRO M+W. https://pmc.ncbi.nlm.nih.gov/articles/PMC7579567
22. Ampuero, R., Fuentes-García, J.P., Baiget, E. (2025). The Influence of Hitting Locations on Shot Outcomes in Professional Men's Padel. *Applied Sciences*, 15(23), 12806. PRO M, Premier 2022. https://www.mdpi.com/2076-3417/15/23/12806
23. López-Sierra, P., Escudero-Tena, A., Ibáñez, S.J., Muñoz, D. (2025). Beyond Instinct: Data-Driven Decision Trees for Tactical Shot Selection in Professional Padel. *Applied Sciences*, 15(4), 2198. PRO M+W. https://mdpi.com/2076-3417/15/4/2198
24. Sánchez-Alcaraz, B.J., Ramón-Llin, J., González-Moreno, R., Martínez-Gallego, R., Sánchez-Pay, A. (2023). Análisis de la acción del globo en pádel masculino y femenino profesional: estudio piloto. *Padel Scientific Journal*, 1, 39-54. PRO M+W. https://revista-padel.unex.es/index.php/padel/article/download/1754/1784
25. Escudero-Tena, A., Fernández-Cortés, J., García-Rubio, J., Ibáñez, S.J. (2020). Use and Efficacy of the Lob to Achieve the Offensive Position in Women's Professional Padel. *IJERPH*, 17(11), 4061. PRO W. https://www.mdpi.com/1660-4601/17/11/4061
26. Sánchez-Alcaraz, B.J., Ferrer Real, F., Zurano, A., Muñoz, D., Ramón-Llin, J. (2021). Análisis del golpe de doble pared abierta en pádel profesional. Diferencias entre géneros. *Revista ACCAFIDE*, 26. PRO M+W. https://mdc.ulpgc.es/files/original/06ca7e725e094c7f034d7b92de0e5b1c266d09c7.pdf
27. Ramón-Llin, J., Guzmán, J.F., Llana, S., Martínez-Gallego, R., James, N., Vučković, G. (2019). The Effect of the Return of Serve on the Server Pair's Movement Parameters and Rally Outcome in Padel Using Cluster Analysis. *Frontiers in Psychology*, 10, 1194. National tour vs regional elite amateur. https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.01194/full
28. Ramón-Llin, J., Guzmán, J., Martínez-Gallego, R., Muñoz, D., Sánchez-Pay, A., Sánchez-Alcaraz, B.J. (2020). Stroke Analysis in Padel According to Match Outcome and Game Side on Court. *IJERPH*, 17(21), 7838. National 1st category M. https://mdpi.com/1660-4601/17/21/7838
29. Ramón-Llin, J., Guzmán, J., Martínez-Gallego, R., Vučković, G., Muñoz, D., Sánchez-Alcaraz, B.J. (2021). Comparison of service tactic formation on players' movements and point outcome between national and beginner level padel. *PLOS ONE*, 16(10). M national vs beginners. https://ideas.repec.org/a/plo/pone00/0250225.html
30. Ramón-Llín, J., Muñoz, D., Martín-Miguel, I., Guzmán, J.F., Vučković, G., Martínez-Gallego, R., Sánchez-Alcaraz, B.J. (2024). Relationship between Ball Impact Point, Type of Stroke and Shot Direction in High-Performance Padel. *Applied Sciences*, 14(11), 4630. National M. https://mdpi.com/2076-3417/14/11/4630
31. Sánchez-Alcaraz, B.J., Courel-Ibáñez, J., Muñoz, D., Infantes-Córdoba, P., Sáenz de Zumarán, F., Sánchez-Pay, A. (2020). Análisis de las acciones de ataque en el pádel masculino profesional. *Apunts*, 36(142). PRO M. https://www.redalyc.org/journal/5516/551666110004/551666110004.pdf
32. Sánchez-Alcaraz, B.J., Muñoz, D., Pradas, F., Ramón-Llin, J., Cañas, J., Sánchez-Pay, A. (2020). Analysis of Serve and Serve-Return Strategies in Elite Male and Female Padel. *Applied Sciences*, 10(19), 6693. PRO M+W. https://www.mdpi.com/2076-3417/10/19/6693
33. Sánchez-Alcaraz, B.J., Muñoz, D., Escudero-Tena, A., Martín-Miguel, I., Martínez García, J. (2022). Análisis de las zonas de golpeo en pádel profesional. *Kronos*, 21(2). PRO M+W. https://erevistas.universidadeuropea.com/index.php/kronos/article/download/915/908/943
34. Sánchez-Alcaraz, B.J., Valcarcel, M., Sánchez-Pay, A., Ramón-Llin, J., Martínez-Gallego, R., Muñoz, D. (2022). Análisis del saque en pádel profesional. *Kronos*, 21(1). PRO M+W. https://erevistas.universidadeuropea.com/index.php/kronos/article/download/913/906/941
35. Escudero-Tena, A., Sánchez-Alcaraz, B.J., García-Rubio, J., Ibáñez, S.J. (2021). Analysis of Game Performance Indicators during 2015-2019 World Padel Tour Seasons and Their Influence on Match Outcome. *IJERPH*, 18(9), 4904. PRO M+W. https://pmc.ncbi.nlm.nih.gov/articles/PMC8125176
36. Martín-Miguel, I., Escudero-Tena, A., Muñoz, D., Sánchez-Alcaraz, B.J. (2023). Performance Analysis in Padel: A Systematic Review. *Journal of Human Kinetics*, 89, 213-230. (Used for figures from studies not fetched directly; marked "via review".) https://pmc.ncbi.nlm.nih.gov/articles/PMC10694705/
37. Fernandez-de-Osso, A.I., Escudero-Tena, A., Muñoz, D., Martín-Miguel, I., Conde-Ripoll, R. (2025). Skill-level differences in final shot characteristics in padel: comparative insights from amateurs and professionals. *Retos*, 64, 798-808. doi:10.47197/retos.v64.110982. AMATEUR vs PRO, M+W. https://revistaretos.org/index.php/retos/article/view/110982
38. Ungureanu, A.N., Lupo, C., Brustio, P.R. (2022). Padel Match Analysis: Notational and Time-Motion Analysis during Official Italian Sub-Elite Competitions. *IJERPH*, 19, 8386. SUB-ELITE M. https://iris.unito.it/retrieve/13abe969-5bc9-4170-9297-d166441f94d4/Ungureanu%20et%20al.%20%282022%29%20Padel%20Match%20Analysis_Notational%20and%20Time-Motion%20Analysis%20during%20Official%20Italian%20Sub-Elite%20Competitions.pdf (also https://pmc.ncbi.nlm.nih.gov/articles/PMC9324445)
39. Paulauskas, R., Šakinis, D., Figueira, B. (2025). Padel vs. tennis doubles: a comparison of performance demands and game attributes. *Frontiers in Sports and Active Living*, 7, 1540424. National A-level M (simulated matches). https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1540424/full
40. Andreu, M., Sánchez-Pay, A., Sánchez-Alcaraz, B.J. (2021). Estructura temporal y factores técnico-tácticos en el pádel de iniciación. *Sportis Sci J*, 7(1), 111-130. INITIATION youth M. https://core.ac.uk/download/392340196.pdf
41. Dueso Armero, J. (2020). Análisis del éxito-fracaso en los golpeos de pádel (TFG, Universidad de Zaragoza). Kids 9-11, n=8. https://zaguan.unizar.es/record/95213/files/TAZ-TFG-2020-2959.pdf
42. Ramírez Ortega, F.R., Sánchez Pay, A., Sánchez-Alcaraz, B.J. (2025). Distribución de los golpes ganadores y errores en pádel. *Padel Scientific Journal*, 3, 45-57. PRO M+W. https://revista-padel.unex.es/index.php/padel/article/download/2420/2156/7920
43. Arrarte Salcedo, J. (2018). Análisis técnico-táctico de las acciones inherentes a cada zona de la pista en el deporte del pádel (TFG). PRO W, one pair. https://core.ac.uk/download/491726454.pdf
44. Díaz, J., García, A., Grijota, F., Muñoz, J., Muñoz, D. (2015). Incidencia de la importancia del punto sobre variables temporales en pádel de primera categoría regional. *Revista Andaluza de Medicina del Deporte*, 8(4) (abstract compendium, which also holds an unnamed sex-comparison abstract on shots per point). REGIONAL 1st category. https://www.elsevier.es/es-revista-revista-andaluza-medicina-del-deporte-284-pdf-download-S1888754615000945
45. González, Á. (2025, Jan 15). Los números no mienten: las estadísticas más interesantes de la temporada 2024 en Premier Padel. *Padel Addict* (data: Padel Intelligence). PRO. https://www.padeladdict.com/los-numeros-no-mienten-las-estadisticas-mas-interesantes-de-la-temporada-2024-en-premier-padel/
46. Padel Magazine UK (2024, Apr 8). Player with the best winner / unforced error ratio (data: Padel Intelligence). PRO M, Premier 2024. https://padel-magazine.co.uk/le-joueur-au-meilleur-ratio-point-gagnant-faute-directe-est/
47. Dial, M. (2025, Oct 2). The Paris Major 2025 ... (data: Padel Intelligence / Premier Padel). PRO M+W. https://www.minterdial.com/2025/10/premier-padel-paris-major-2025-data/
48. Premier Padel / Padel Intelligence match statistics sheet, Finland P2 2024 final, Lebrón/Di Nenno v Nieto/Sanz. PRO M. https://padelmagazine.fr/wp-content/uploads/2024/08/FINLAND-P2-2024-Lebron-Di-Nenno-v-Nieto-Sanz.pdf
