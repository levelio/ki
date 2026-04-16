'ki-skill': minor
---

Add installation reconciliation and restore commands, including `ki reconcile`, `ki repair`, and `ki restore` for managing drift between `installed.json` and real target state.

Add bulk source operations with `ki source install <name>` and `ki source uninstall <name>` so users can install or remove all skills from a source across one or more targets.

Improve source management and platform compatibility by adding CLI support for source option updates, safer non-interactive install behavior, and platform-aware config, cache, and installed index paths.
