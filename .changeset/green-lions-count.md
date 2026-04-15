---
'ki-skill': minor
---

Refine non-interactive CLI behavior and expand source management commands.

- add structured source configuration commands: `ki source set`, `ki source unset`, and `ki source show`
- allow source option management through CLI flags such as `--branch`, `--skills-path`, `--structure`, and `--skill-file`
- switch install interaction to explicit `-i/--interactive` mode and remove `-y/--yes`
- tighten non-interactive install and uninstall flows so they require exact, reproducible inputs
