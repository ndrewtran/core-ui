# React Native package navigation

This package owns the shared React Native substrate, explicit platform files,
native accessibility integration, responder ownership, and package-owned
serialization of native token projections. Canonical token transforms remain
owned by `@core-ui/tokens`; binding, runtime-profile, and platform-safety facts
remain owned by the catalog.

Do not add CSS, DOM, React DOM, Expo, Storybook, a component support claim, or
an injectable production primitive adapter. Keep native explorer hosts and
synthetic fixtures under `tests/`.

Run `pnpm --filter @core-ui/react-native check`, then `pnpm check` and
`pnpm generate:check` when package inputs or generated projections change.
