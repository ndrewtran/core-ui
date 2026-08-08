# React package navigation

`src/` owns React lifecycle and host-language refinements while importing the
web runtime and styling identity. It must not copy CSS, binding metadata, or
document lifecycle. `test/` proves SSR/hydration, effect cleanup, typed host
ergonomics, and cross-binding parity. No component-support claim is permitted
before the owning slice milestone.

Run `pnpm --filter @core-ui/react check`, then the root affected checks.
