# Magic Set Editor keyword source

`keywords_en` is an unmodified snapshot of
`MagicSetEditorPacks/Full-Magic-Pack/data/magic.mse-game/keywords_en` at commit
`71b382d5da74efd533ae25a23ac324a80c3dfeb4` (synced 2026-08-05).

The snapshot contains 368 English keyword definitions and the parameter,
mode, match, rules, and reminder data used by Magic Set Editor. Set Conjurer's
generated browser catalog is `js/mseKeywordCatalog.js`.

- `npm run keywords:check` verifies the generated catalog matches this snapshot.
- `npm run keywords:compile` rebuilds the generated catalog offline.
- `npm run keywords:sync` downloads the current upstream `main` snapshot,
  records its latest file commit, and rebuilds the catalog.

Magic Set Editor's matching implementation is maintained separately in
`haganbmj/MagicSetEditor2`; its current stable engine tag is `v2.5.6`. Keyword
content updates are made in Full Magic Pack and are not fetched automatically by
MSE itself.
