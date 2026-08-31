# Schema package navigation

`schemas/` owns source and response grammar, stable identifiers, relation
vocabulary, field ownership, and schema-evolution policy. `src/` owns generic
validation, canonical serialization, revision closure, and generation from
those declarations. `generated/` is a projection and is never edited directly.

Run `pnpm --filter @muxui/schema check`, then the root affected checks.
