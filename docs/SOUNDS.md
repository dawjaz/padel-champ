# PorTres: lista dźwięków do znalezienia

Lista powstała z kodu gry (każde miejsce, w którym dziś gra coś syntetycznego albo nic). Przy każdym dźwięku: **do czego służy**, **ile wariantów**, **co wpisać w wyszukiwarkę** (po angielsku). Priorytet: **1** = bez tego gra brzmi źle, **2** = mocno podnosi jakość, **3** = ozdoba, można po wydaniu.

## Zasady wyboru (ważne dla sklepów)
- Licencja: tylko **CC0**, **CC-BY** (wtedy zapisuję autora i dopisuję w grze) albo płatna licencja komercyjna. **Nigdy "NonCommercial"** i nigdy nagrania z gier, filmów czy telewizji.
- Przy każdym pliku zapisz: nazwa, link, autor, licencja (arkusz wystarczy). Ja wgrywam je do gry i prowadzę rejestr.
- Format: najlepiej WAV 44,1 lub 48 kHz, bez efektów i bez muzyki w tle. Krótkie dźwięki mono. Przytnę, wyrównam głośność i zrobię z nich ogg i mp3.
- Kilka wariantów tego samego dźwięku (podane niżej) gra wybiera losowo, żeby nie brzmiało jak maszyna.
- Padel brzmi inaczej niż tenis: rakieta bez strun, z otworami, daje głuchsze "pop". Najbliższe są **pickleball paddle** i **padel**. Piłka o szybę brzmi jak głuchy "tonk" z krótkim dzwonieniem szkła.

---

## A. MECZ: piłka i rakieta (priorytet 1)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| A1 | Uderzenie rakietą **mocne** | flat, smash, vibora z mocą | 4 | `padel racket hit hard`, `pickleball paddle hit hard` |
| A2 | Uderzenie **miękkie** | chiquita, wolej, bloqueo, dejada | 4 | `padel soft hit`, `pickleball dink` |
| A3 | Uderzenie **z rotacją** (tnące, krótkie "szur+pop") | vibora, bandeja, rulo | 3 | `padel slice hit`, `racket slice ball` |
| A4 | **Serwis** (uderzenie z podbicia, wyraźniejsze) | serwis | 3 | `padel serve`, `tennis serve hit` |
| A5 | Piłka o **podłogę** (sztuczna trawa z piaskiem, głuche "puk") | każde odbicie | 3 miękkie + 3 twarde | `ball bounce artificial turf`, `padel ball bounce` |
| A6 | Piłka o **szybę** (głuchy "tonk", dzwoni szkło) | odbicia od szyby | po 3: lekkie, średnie, mocne | `ball hit glass wall`, `padel glass wall hit`, `squash ball glass` |
| A7 | Piłka o **siatkę ogrodzenia** (metaliczny grzechot) | odbicia od metalowej siatki | 3 | `ball hit chain link fence`, `fence rattle` |
| A8 | Piłka o **siatkę** (głuche uderzenie w linę i taśmę) | siatka, taśma | 3 (w tym 1 "dzwonek" taśmy) | `tennis ball net cord`, `ball hits net` |
| A9 | **Świst rakiety** w powietrzu | zamach (lekki i mocny) | 3 lekkie + 3 mocne | `racket swing whoosh`, `paddle swish` |
| A10 | Powerful Smash: **narastający świst + głęboki huk + trzask i dzwonienie szyby** | super smash | 2 (można zmontować z A1 i A6) | `power hit boom impact`, `whoosh to impact` |

## B. MECZ: zawodnicy (priorytet 2)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| B1 | Kroki i **skrzypienie butów** na korcie | biegi, hamowanie | 4 | `shoes squeak court`, `footsteps artificial turf` |
| B2 | **Sprint za kort** (szybkie kroki i hamowanie, drzwi w szkle) | wybieganie za kort | 2 | `running fast footsteps stop`, `glass door slam` |
| B3 | **Wysiłek** zawodnika (krótkie "hap!", bez słów) | mocne uderzenia, smash | 3 męskie, 3 żeńskie | `tennis grunt effort male`, `tennis grunt effort female` |
| B4 | Zawodnik **wygrywa punkt** (okrzyk radości, bez słów) | wygrany punkt | 2 + 2 | `athlete cheer yes`, `fist pump yeah` |

## C. MECZ: pierścień timingu i zagrania specjalne (priorytet 2)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| C1 | **Tykanie** zwężającego się pierścienia | pierścień timingu | 1 (pętla) | `soft tick countdown`, `ui timer tick` |
| C2 | **Idealne trafienie** (jasny "ding") | timing = perfekcyjny | 1 | `perfect hit ding`, `success chime short` |
| C3 | **Spóźnione / pudło** (głuche, rozczarowujące) | timing = zły | 1 | `miss buzz soft`, `fail thud` |
| C4 | **Sky Rocket** (rakieta wznosi się i huczy) | zagranie specjalne | 1 | `rocket launch whoosh rising` |
| C5 | **Venom** (syk i ugryzienie, złowrogo) | zagranie specjalne | 1 | `snake hiss strike`, `venom spit` |
| C6 | **Corner Lock** (metaliczne "klik" zatrzaśnięcia) | zagranie specjalne | 1 | `lock click metal`, `latch snap` |
| C7 | **Freeze** (pękający lód i zamrożenie) | zagranie specjalne | 1 | `ice crack freeze`, `frost magic` |
| C8 | **Wejście zagrania specjalnego** (krótka "aura" przed uderzeniem) | animacja specjału | 1 | `power up charge short`, `energy charge swoosh` |

## D. TŁUM I OTOCZENIE (priorytet 1 i 2)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| D1 | **Ambience małej hali** (szmer, rzadkie klaskanie), **pętla** 30–60 s bez wyraźnych okrzyków | mecze klubowe i regionalne | 1 | `small sports hall ambience`, `indoor tennis crowd murmur loop` |
| D2 | **Ambience dużej areny** (głośniejszy tłum), pętla | finały, Grand Slam Cup | 1 | `stadium crowd ambience loop`, `arena crowd` |
| D3 | **Oklaski** po punkcie: krótkie (2–3 s) i długie (6–8 s) | wygrany punkt | 3 + 2 | `crowd applause short`, `tennis applause` |
| D4 | **"Ooooh"** zachwytu przy efektownej akcji | winner, długa wymiana | 2 | `crowd ooh reaction`, `crowd gasp` |
| D5 | **Westchnienie / jęk** po błędzie | błąd własny | 2 | `crowd groan`, `crowd disappointed` |
| D6 | **Ryk tłumu** po wygranym secie i meczu | koniec seta i meczu | 2 | `crowd cheer roar big`, `stadium cheer` |
| D7 | Pojedyncze klaśnięcia, okrzyki z trybun ("Vamos!") | tło, losowo | 4 | `single clap`, `crowd shout vamos` |
| D8 | **Kibicowski doping** (rytmiczne klaskanie) | finał, mecz o puchar | 1 | `crowd rhythmic clapping` |

## E. INTERFEJS I NAGRODY (priorytet 1 i 2)
Dziś wszystko to piski z fali kwadratowej, czyli właśnie te "zbyt cyfrowe". Szukaj w stylu **soft / wood / glass / game UI**, nie 8-bitowych.

| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| E1 | **Kliknięcie przycisku** | wszystkie przyciski (najczęstszy dźwięk w grze) | 3 | `ui click soft`, `button click game` |
| E2 | **Wstecz / anuluj** | przycisk BACK | 1 | `ui back soft`, `menu cancel` |
| E3 | **Potwierdzenie** (ważny wybór) | START, zatwierdzenie | 1 | `ui confirm`, `menu select positive` |
| E4 | **Odmowa** (niedozwolone, za mało monet) | zablokowany przycisk | 1 | `ui denied`, `error soft buzz` |
| E5 | **Rzut monetą** i **lądowanie monety** | losowanie na początku meczu | 1 + 2 | `coin flip`, `coin spin land table` |
| E6 | **Monety** (zdobyte) i **wydane** | nagrody, zakupy | 2 + 2 | `coins collect`, `cash register ching`, `coins pour` |
| E7 | **Punkt wygrany** (krótki sygnał) | po każdym punkcie | 1 | `point score chime short` |
| E8 | **Gem / set wygrany** | koniec gema | 1 | `success jingle short` |
| E9 | **Wygrany mecz** (fanfara 2–4 s) | wynik meczu | 1 | `victory fanfare short`, `win jingle` |
| E10 | **Przegrany mecz** (smutna fraza 2–3 s) | wynik meczu | 1 | `defeat jingle sad short`, `lose stinger` |
| E11 | **Zwycięstwo w turnieju / puchar** (większa fanfara 5–8 s) | wygrany turniej | 1 | `trophy win fanfare`, `champion celebration` |
| E12 | **Awans poziomu** (level up) | nowy poziom | 1 | `level up`, `rank up chime` |
| E13 | **Punkty XP** (krótkie tykanie przy naliczaniu) | ekran wyniku | 1 | `xp tick`, `counter increment` |
| E14 | **Gwiazdka** (1, 2, 3 gwiazdki w obozie) | wynik minigry | 3 rosnące | `star earn ding`, `star collect` |
| E15 | **Osiągnięcie odblokowane** | osiągnięcia | 1 | `achievement unlocked` |
| E16 | **Nagroda dzienna / tygodniowa** odebrana | zadania | 1 | `reward claim`, `bonus collected` |
| E17 | **Założenie sprzętu** (rakieta, buty) | zmiana wyposażenia | 1 | `equip item`, `armor equip click` |
| E18 | **Paczka sprzętu**: otwieranie (napięcie), potem odkrycie wg rzadkości: zwykła, rzadka, epicka, legendarna | paczki | 1 + 4 | `loot box open`, `card reveal`, `legendary reveal sparkle` |
| E19 | **Przejście między ekranami** (krótki "swish") | zmiana scen | 2 | `ui whoosh transition short` |
| E20 | **Dymek mowy** (jedna litera): bardzo cichy tyk | dialogi, wstawki | 2 | `typewriter tick soft`, `text blip` |
| E21 | **Podpowiedź (tip) pojawia się** | podpowiedzi | 1 | `notification soft pop` |
| E22 | **Zaznaczenie punktu na korcie** (dotknięcie kortu, celowanie) | celowanie | 2 | `target lock soft`, `aim tick` |

## F. OBÓZ TRENINGOWY: minigry (priorytet 2)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| F1 | **Trafienie w cel** (cel pęka lub dzwoni) | minigra "Targets" | 3 (zwykłe, w środek, pudło) | `target hit ding`, `bullseye hit`, `ball hits wooden board` |
| F2 | **Serwis w strefę** | minigra "Serve" | użyj A4 + E3 | – |
| F3 | **Timing** (trafienie w okno) | minigra "Timing" | użyj C1, C2, C3 | – |
| F4 | **Smash Show**: rosnąca kombinacja (kolejne smashe coraz wyższym tonem), eksplozja przy 3 gwiazdkach | minigra "Smash" | 5 rosnących + 1 finał | `combo hit rising pitch`, `fireworks small burst` |
| F5 | **Otwarcie obozu / start próby** (gwizdek trenera lub krótki sygnał) | start minigry | 1 | `coach whistle`, `start beep` |

## G. INTRO, MENU I WSTAWKI (priorytet 2 i 3)
| # | Dźwięk | Do czego | Warianty | Szukaj |
|---|---|---|---|---|
| G1 | **Plansza studia "DAVJ STUDIO"** (cichy narastający pogłos, potem "uderzenie" i długi ogon, w ciemności) | pierwsza plansza | 1 | `cinematic logo sting dark`, `logo reveal bass hit reverb` |
| G2 | **Intro gry**: ognista kula (świst, zapłon), uderzenie logo, pęknięcia szkła | animowane intro | 3 | `fireball whoosh ignite`, `logo impact boom`, `glass crack` |
| G3 | **TAP TO PLAY** (potwierdzenie startu) | ekran startowy | 1 | `game start confirm` |
| G4 | **Wstawki filmowe**: przejście kamery, uderzenie piłki, doping (można z A i D) | wstawki | – | – |

## H. MUZYKA (priorytet 2, licencje muzyki bywają bardziej zawiłe)
Szukaj muzyki **na licencji komercyjnej z prawem do gier** i bez systemu Content ID, który blokuje wideo w sklepach. Najlepsze są pętle (loop), które wracają bez szwu.

| # | Utwór | Do czego | Czas | Szukaj |
|---|---|---|---|---|
| H1 | **Motyw menu** (energiczny, nowoczesny, sportowy, lekko elektroniczny) | ekran startowy, menu | pętla 1–2 min | `upbeat sport game menu music loop` |
| H2 | **Tło w meczu** (cicha, rytmiczna, nie przeszkadza) | mecz | pętla 2 min | `sports game background music loop calm tension` |
| H3 | **Mecz o puchar / finał** (bardziej napięta) | finał, Grand Slam Cup | pętla 2 min | `final match tension music loop` |
| H4 | **Obóz** (żywa, treningowa) | obóz | pętla 1–2 min | `training montage music loop` |
| H5 | **Wynik: wygrana / przegrana** (krótkie, dublują E9, E10) | wynik | 10–20 s | `victory theme short`, `defeat theme short` |

## Na co zwrócić uwagę przy wyborze
1. **Najpierw priorytet 1** (A1–A9, D1–D3, E1–E5, E7, E9–E10): to jest 80% wrażenia z gry.
2. Szkło i siatka (A6, A7) wyróżniają padla. Warto poświęcić na nie najwięcej czasu.
3. Jeśli znajdziesz **gotowy pakiet jednego autora** (np. padel lub tenis) i **drugi, uniwersalny pakiet UI**, to często wystarczą dwa źródła na całą grę. Mniej źródeł to mniej rejestrów licencji i bardziej spójne brzmienie.
4. Daj mi znać, co pobrałeś. Wgrywam, przycinam, normalizuję głośność, podpinam pod odpowiednie miejsca w kodzie (dziś są pod nazwami `racket_strong`, `racket_soft`, `racket_spin`, `racket_serve`, `floor`, `glass`, `mesh`, `net` i `select`, `hit`, `point`, `win`, `lose`, `coinFlip`, `coinLand`, `type`) i dopisuję autorów w grze, jeśli licencja tego wymaga.
