# Private Core UI React Storybook

This is a private development showcase for the standalone `@core-ui/react`
renderer. Storybook 10.5.10, `@storybook/react-vite` 10.5.10, and the
`@storybook/addon-a11y` 10.5.10 integration are pinned to the workspace's
React 19.2.8 and Vite 8.2.1 baseline.

The generator reads the Core-owned React descriptor and the canonical R1 family
snapshot. It emits one tracked package-owned CSF story module per family,
grouped by R1 tranche. The explicit renderer adapters are checked against that
descriptor so the private projection cannot silently gain or lose a family.

```sh
pnpm --filter @core-ui/react-storybook storybook
pnpm --filter @core-ui/react-storybook check
pnpm --filter @core-ui/react-storybook build
```
