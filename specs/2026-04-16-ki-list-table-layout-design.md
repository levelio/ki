# ki list Table Layout Design

## Summary

Redesign `ki list` to use a compact table layout instead of the current multi-line tree output.

The new default rendering uses these columns:

- `STATUS`
- `SKILL ID`
- `SOURCE`
- `INSTALLATION`

Installation locations are rendered as `target@scope`, for example `claude-code@global` and `cursor@project`.

## Goals

- Make `ki list` easier to scan quickly
- Keep the default output dense and aligned
- Preserve the current filtering behavior for `--installed`, `--source`, and search queries
- Remove the current per-skill multi-line installation detail block from default list output

## Non-Goals

- Redesign `ki source skills`
- Add colors, unicode box drawing, or a rich TUI table
- Add truncation or horizontal paging in the first version
- Add new data columns beyond `STATUS`, `SKILL ID`, `SOURCE`, and `INSTALLATION`

## Recommended Approach

Replace the current row-by-row display helpers with a table renderer that computes column widths from the filtered result set.

Each skill should render exactly one row in the default list output. When a skill has multiple installation records, merge them into a comma-separated `INSTALLATION` cell.

This approach is preferred because it improves scanability without changing the command contract or filter semantics.

## Alternatives Considered

### 1. Card-style multi-line layout

Pros:

- Easier to extend with descriptions and metadata later
- More readable when a skill has many installation targets

Cons:

- Too tall for the default list command
- Slower to scan in large result sets

### 2. Keep current layout and only tweak spacing

Pros:

- Lowest implementation risk

Cons:

- Does not solve the core problem that the output is visually noisy
- Still spreads one logical row across multiple terminal lines

## Design

### Output Shape

The command keeps the current intro/spinner/outro flow, but the result body changes to:

```text
Skill List

Found 4 skills

STATUS  SKILL ID                    SOURCE        INSTALLATION
------  --------------------------  ------------  -----------------------------
✓       ki:ki-usage                ki            claude-code@global
✓       superpowers:brainstorming  superpowers   codex@global, cursor@project
·       superpowers:debugging      superpowers   -
✓       acme:prd-review            acme          claude-code@project

4 skill(s)
```

### Status Rules

- Installed skill: `✓`
- Not installed skill: `·`

The first version does not need a separate disabled-only state because current list output is driven by installed records, not by a fully distinct lifecycle status model.

### Installation Formatting

Installation cell rules:

- No installs: `-`
- One install: `target@scope`
- Multiple installs: join with `, `

Formatting must remove the spaces around `@`. Examples:

- `claude-code@global`
- `codex@global, cursor@project`

### Source Column

Use `skill._source` directly as the `SOURCE` column value.

This is already available in the discovered skill metadata and avoids extra lookup work.

### Column Widths

Column widths should be computed from:

- header text
- rendered row values in the filtered result set

Rules:

- Align columns with spaces
- Do not truncate values in the first version
- Keep one space block between columns, matching the repo's plain CLI style

### Filtering Behavior

These behaviors remain unchanged:

- `ki list --installed`
- `ki list --source <name>`
- `ki search <query>`
- project/global filtering via installed-record scope logic

The redesign is display-only.

## Components

### 1. List rendering helper

Add a rendering helper for table output, likely in `src/commands/skills/display.ts`.

Responsibility:

- accept the filtered skill rows plus installed-record context
- compute widths
- print header, divider, and aligned rows

### 2. Installation summary formatter

Update the installation summary helper so list output uses `target@scope` rather than `target @ scope`.

Responsibility:

- keep the summary logic centralized
- avoid one formatter for list and another for status unless behavior actually differs

### 3. List command integration

Update `src/commands/skills/list.ts` so it collects the filtered result set, maps it into renderable rows, and prints the new table instead of calling the old multi-line renderer.

## Data Flow

1. Discover enabled-source skills
2. Load installed records
3. Apply existing filters
4. Build one display row per skill:
   - status
   - skill id
   - source
   - installation summary
5. Compute table widths
6. Print aligned table

## Error Handling

The redesign should not add new failure modes.

Rules:

- Empty result still prints the current "No skills found matching criteria" path
- Missing installs remain `-`
- Unexpected long values should still print completely rather than fail

## Testing

Update tests around `ki list` to cover:

- compact one-row rendering for installed and uninstalled skills
- multiple installations rendered in one cell
- `target@scope` formatting with no spaces around `@`
- source column output
- filtering behavior still producing the right rows

The tests should focus on rendered output lines, not internal helper structure.

## Documentation Impact

No README change is required for the first version because command semantics do not change.

## Open Question Resolution

This design assumes:

- default `ki list` uses the compact table layout
- `ki source skills` remains unchanged for now
- installation summary format becomes `target@scope`

These decisions match the approved direction for this change.
