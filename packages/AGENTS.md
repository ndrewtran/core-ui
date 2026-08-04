# Package navigation

Each package owns its manifest, detailed scripts, implementation, exports, and
package-local checks. Use workspace dependencies for cross-package ordering;
do not copy package tasks into the root script surface.

Run the owning package's checks, then `pnpm check` for affected dependents.
