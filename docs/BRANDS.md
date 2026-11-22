# Brands and gear (v0.53)

The six makers in the game are invented. The table says which real padel maker each one stands in for, so that the
racket silhouettes (diamond, teardrop, round) follow the real equivalents. Only the head shape is imitated: no logos,
colour schemes or real model names are used in the game. Names should still get a trademark check before a store release.

| Game brand | Real equivalent | Character |
|---|---|---|
| Bavolé | Babolat | power and spin |
| Toropad | Bullpadel | aggressive power |
| Noctra | Nox | control (technique, accuracy) |
| Adaro | Adidas | all-round (the starter set) |
| Hedron | Head | speed and stamina |
| Syrix | Siux | defence |

Rackets (basic, Pro, Technical, Elite = common, rare, epic, legendary):

| Brand | Basic | Pro | Technical | Elite |
|---|---|---|---|---|
| Bavolé | Origan (teardrop, Air Origin) | Contrix (round, Counter Viper) | Aerix (teardrop, Air Viper) | Vyrax (diamond, Technical Viper) |
| Toropad | Avanto (diamond, Vertex Advance) | Hibrida (teardrop, Vertex Hybrid) | Vertigo (diamond, Vertex 05) | Explosa (diamond, Xplo) |
| Noctra | Mira (round, ML10 Pro Cup) | Duro (teardrop, AT10 Pro Cup Hard) | Genio (teardrop, AT10 Genius) | Genio Ataque (diamond, AT10 Genius Attack) |
| Adaro | Cruz (round, Cross It) | Metalis Ctrl (round, Metalbone CTRL) | Metalis Carbon (diamond, Metalbone Carbon) | Metalis HD (diamond, Metalbone HRD+) |
| Hedron | Evon (teardrop, Evo Speed) | Gravis (round, Gravity) | Veloz (teardrop, Speed) | Extremo (diamond, Extreme Pro) |
| Syrix | Elka Go (teardrop, Electra Go) | Diabla (teardrop, Diablo) | Elka Pro (teardrop, Electra Pro) | Fenyx (diamond, Fenix) |

Notes: makers do not always class a shape the same way (Nox calls the AT10 Genius a teardrop although it plays closer
to round; the Counter Viper is listed as round or hybrid). We took the commonly listed shape.

## Data
- 5 slots (shirt, shorts, shoes, racket, bag) x 6 brands x 4 tiers = 120 items in `src/data/gear.json`; brands in `src/data/brands.json`.
- Item id: `<brand>_<slot>_<tier 1-4>`. Bonus totals 1/2/3/4 (primary and secondary attribute of the brand per slot), minimum level 1/5/12/20.
- The five basic Adaro items are the starter set (`unlock: 1`).
- Removed: cap, wristband, balls. Old save: unknown ids are dropped; the better old items (rare, epic, legendary) pay coins back at the duplicate price (`legacyRefund`).
- Not yet: brand sets (bonus for 3+ items of a brand), brand packs or a shop filter, brand colours and logos on the character (plan, points 3 and 4).
