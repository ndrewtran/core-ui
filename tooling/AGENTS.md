# Tooling navigation

Compilers and generators transform declared sources deterministically; audits
enforce ownership and parity; evaluations remain subordinate to deterministic
checks. Tools must emit stable diagnostics that point to the earliest owner.

Run the owning tooling package's checks and `pnpm generate:check` when output
generation is affected.
