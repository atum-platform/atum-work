# Scope stable-tag replay to fork maintenance

The runtime integration branch merges newer upstream T3 history. The stable replay
script treats all descendants of the stable tag as fork patches and tries to apply
them to the previous tag. This reached an upstream pull-request dialog fix that
depended on surrounding upstream changes and stopped before the product checks.

Feature PRs now run brand validation, typecheck, lint, scoped tests, and the eligible
archive smoke. Maintainers run the stable replay against their linear queue before
an upstream bump. The archive build still fetches its pinned upstream source tag.
Refresh affected PR heads from the integration branch to pick up the workflow.

Local verification replayed all eight commits at queue head `95e78a420`
across `v0.1.10` and `v0.1.11` with zero conflicts and a matching final
tree. The brand unit test passed and regenerating the map produced no diff.
