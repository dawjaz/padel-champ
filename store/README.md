# Store materials

- `listing-en.md`, `listing-es.md`: Google Play and App Store texts (English, Spanish), with the fields each store asks for and the checks before submitting.
  `python3 store/check.py` checks the character limits.
- `privacy-policy.md`, `privacy-policy-es.md`: the privacy policy (source, English and Spanish; the hosted page has both, `#es` opens the Spanish one). The hosted copy is `public/privacy.html`, published with the game at
  https://dawjaz.github.io/padel-champ/privacy.html. Fill in the developer's name, contact email and the date in both.
- `screenshots/play/` (1080 x 1920) and `screenshots/ios-6.9/` (1320 x 2868): captioned screenshots, 8 each.
- `graphics/feature-graphic-1024x500.png`: Google Play feature graphic. The 512 px icon is `design/brand/play-store-512.png`.
- `raw/`: the game captures (720 x 1280 canvas snapshots) the screenshots are made from; `compose.py` rebuilds everything
  (`python3 store/compose.py`; needs Pillow and the Anton / Baloo 2 TTFs named at its top).

Retake the captures after visible changes, and after renaming the divisions and gear brands (see listing-en.md, "Before you submit").
The current captures avoid screens that show those names.
