# Magic Set Editor keyword source

`keywords_en` is an unmodified snapshot of the `develop` version of
`MagicSetEditorPacks/Full-Magic-Pack/data/magic.mse-game/keywords_en` at its
latest keyword-file commit, `f1891ee0ed0038d233760d2f5b779923579c38bb`
(synced 2026-08-05).

The snapshot contains 373 English keyword definitions and the parameter, mode,
match, rules, and reminder data used by Magic Set Editor. Set Conjurer retains
the printed `worthy` definition that `develop` removed, producing 374 built-in
definitions in `js/mseKeywordCatalog.js`.

## Reviewed development definitions

The six definitions added after `main` were checked against actual Oracle text
on Scryfall rather than accepted blindly:

- `Disappear`: [Foot Mystic](https://scryfall.com/card/tmt/63/foot-mystic)
- `Recruit`: [Bard's Company](https://scryfall.com/card/hob/146/bards-company)
- `Storied`: [Balin, Loremaster](https://scryfall.com/card/hob/87/balin-loremaster)
- `Hone counters`: [Dwalin, Weaponmaster](https://scryfall.com/card/hob/154/dwalin-weaponmaster)
- `Rulebreaker`: [Grizzlegom, Hurloon Hero](https://scryfall.com/card/mbc/39/grizzlegom-hurloon-hero)
- `Heartwood token`: [Woodwork Prodigy // Soul Tether](https://scryfall.com/card/fra/165/woodwork-prodigy-soul-tether)

`Disappear` is an ability word, so Set Conjurer italicizes it and does not add
reminder text. Its incomplete upstream `[Something]` template is replaced in
the generated catalog with a real-card form. Hone-counter and Heartwood-token
reminders are placed after the complete sentence, matching their printed cards.
The retained `worthy` wording was checked against
[Mjolnir, Hammer of Thor](https://scryfall.com/card/msh/146/mj%C3%B6lnir-hammer-of-thor).

- `npm run keywords:check` verifies the generated catalog matches this snapshot.
- `npm run keywords:compile` rebuilds the generated catalog offline.
- `npm run keywords:sync` downloads the current upstream `develop` snapshot,
  records its latest file commit, and rebuilds the catalog.

Magic Set Editor's matching implementation is maintained separately from the
Full Magic Pack keyword data. Keyword content updates are manually authored in
Full Magic Pack; they are not generated automatically from card releases.
