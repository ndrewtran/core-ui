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

## Tale migration visual check

Tale UI established the immutable starting point for the bounded visual
migration fixtures at the pinned donor revision recorded in
`visual-migration/manifest.json`. The PNGs are now Core-owned artifacts. The
opt-in `check:visual:migration` command starts Core Storybook, applies the
recorded interactions, and compares those artifacts without resolving Tale,
reading a Tale checkout, using a Tale package, or requiring network access.
During bootstrap, committed Tale screenshots and computed style facts were
consulted once to choose comparable selectors. The checked-in PNGs are the
resulting Core captures, so later checks do not need donor pixels or a Tale
runtime. The sealed `results/comparison.json` retains the full component-pixel
comparison and records genuine mismatches; anatomical adaptations explain
DOM-part mappings but never waive component pixels.
The PNG comparison is consequently sensitive to the selected browser, OS font
metrics, and device scale. Keep those capture inputs stable and treat a
diagnostic diff as an intentional Core-local review, not as a reason to fetch
new donor assets.

The migration closure covers all 51 applicable canonical families, with
`Group` and `TokenField` recorded as the two exact `no-applicable-donor`
families. It contains 132 semantic cases, including an idle case for every
applicable family and only contract-derived high-signal states, captured in
both light and dark modes for 264 donor/Core comparisons. Each case records
its shared copy/data/frame contract, renderer-specific adaptation, and
equivalent-part style facts. Future intentional Core changes update the
Core-owned baselines through an explicit Core-local flow; they are never
synchronized from Tale. Deterministic app checks validate the manifest, PNG
integrity, and sealed report; browser comparison remains opt-in. Both local and
CI-capable comparisons use only Core Storybook and the checked-in Core-owned
artifacts. The current one-time report records its machine-checked pass/fail
counts in `visual-migration/results/comparison.json` (the present capture has
264 passing and 0 failing component-region comparisons), so the donor parity
review remains decision bearing; the verifier derives these counts from the
sealed PNG pairs and report rather than accepting a handwritten result. No public API
or accessibility behavior was changed to chase pixels.

The migration fixture is not a registered Storybook story. Storybook registers
only the 53 generated family modules (the normal 106 Default/States entries).
The runner reuses the generated `core-react-r1-1-button--default` iframe entry
and passes the private `core-ui-migration=1` query; the existing preview renders
the source-owned fixture only for that query. The runner always reserves a port
and starts Storybook from this checkout, so there is no external Storybook URL
override.

For an intentional, reviewed Core visual change, run
`pnpm --filter @core-ui/react-storybook update:visual:migration`. This captures
all 132 cases in both modes from Core Storybook, writes a new content-addressed
264-image snapshot under `visual-migration/baselines/`, and atomically activates
it with one manifest-file replacement while recording the capture environment.
An existing matching snapshot is verified and reused; old inactive snapshots
are only cleaned up after activation. Review the resulting Core-owned diff
before accepting it.

```sh
pnpm --filter @core-ui/react-storybook check:visual:migration
```
