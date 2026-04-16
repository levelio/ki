# Global Install Reminder Design

## Summary

Add a post-install reminder for `ki-skill` that appears on every global install or global upgrade.

The reminder tells users to run:

```text
ki init
ki source sync ki
```

This feature is reminder-only. It must not automatically initialize config, sync sources, or mutate user state during package installation.

## Goals

- Remind users on every global install or upgrade that they may need to initialize config and sync the built-in `ki` source
- Limit the reminder to global installs only
- Keep installation behavior safe, non-destructive, and platform-neutral

## Non-Goals

- Automatically running `ki init`
- Automatically running `ki source sync ki`
- Reading user config to decide whether the reminder should be shown
- Showing the reminder for local project installs
- Tracking whether the user has already seen the reminder

## Recommended Approach

Use an npm `postinstall` hook that runs a small Node script.

The script detects whether the current install is global. If yes, it prints the reminder. If not, it exits silently.

This is the preferred option because it matches the required timing exactly: the user sees the reminder immediately after every global install or upgrade. It also keeps the implementation simple and avoids adding runtime state to the CLI.

## Alternatives Considered

### 1. Runtime reminder on first CLI execution after upgrade

Pros:

- Less dependent on npm lifecycle behavior
- Can be made more context-aware later

Cons:

- Misses the requested timing
- Requires local state to track whether a version-specific reminder has already been shown

### 2. Automatic sync during install

Pros:

- Removes a user step

Cons:

- Too risky in install hooks
- Depends on config existing, network access, and user environment
- Violates the requirement to keep install-time behavior non-destructive

## Design

### Components

#### 1. `postinstall` package script

Add a `postinstall` entry in `package.json` that runs a dedicated reminder script.

Responsibility:

- Always execute after install when npm lifecycle scripts are enabled
- Delegate all logic to a standalone script

#### 2. Global-install reminder script

Add a small script under `scripts/`, for example `scripts/postinstall-reminder.mjs`.

Responsibility:

- Detect whether the current install context is global
- Print a short reminder only for global installs
- Exit successfully in all supported environments, even if detection is inconclusive

#### 3. Reminder message

The printed message should be explicit and short.

Proposed wording:

```text
ki installed successfully.

Next steps:
  ki init
  ki source sync ki
```

Optional follow-up line:

```text
Run `ki source sync ki` if you use the built-in ki source.
```

The message should avoid claiming that the user definitely uses the built-in source, but it should still keep `ki source sync ki` visible as the default next step.

## Detection Strategy

The script should use npm lifecycle environment signals to distinguish global installs from local installs.

Primary design rule:

- If the script can confidently determine the install is global, print the reminder
- If the script can confidently determine the install is local, do nothing
- If the script cannot determine the install type safely, prefer silence over a false-positive local-install reminder

This keeps the reminder aligned with the requirement "global only" while avoiding fragile filesystem or config inspection.

## Data Flow

1. User runs `npm install -g ki-skill` or `npm update -g ki-skill`
2. npm runs `postinstall`
3. The reminder script evaluates install context
4. If global, print reminder to stdout
5. Exit with code `0`

For local installs:

1. User runs `npm install ki-skill`
2. npm runs `postinstall`
3. The reminder script evaluates install context
4. If local, print nothing
5. Exit with code `0`

## Error Handling

The reminder script must never fail the package installation for reminder-related reasons.

Rules:

- Any detection error falls back to silent success
- Any formatting or logging issue falls back to silent success
- The script must not throw uncaught exceptions
- Exit code must remain `0` unless npm itself fails for unrelated reasons

## Testing

Add focused unit tests for the reminder logic rather than trying to test npm lifecycle behavior end-to-end.

Required cases:

- prints reminder for detected global install
- prints nothing for detected local install
- exits silently when detection input is missing or ambiguous
- reminder text includes both `ki init` and `ki source sync ki`

If the implementation extracts a pure helper such as `shouldShowGlobalInstallReminder(env)`, test that helper directly.

## Documentation Impact

Update README only if needed to mention that global installs now print post-install next steps.

No user-facing docs change is required for the first implementation if the reminder text itself is self-explanatory.

## Open Question Resolution

This design assumes:

- reminder appears on every global install and upgrade
- reminder does not appear for local installs
- reminder does not attempt to inspect existing `ki` config
- reminder does not perform automatic sync

These decisions match the approved direction for the first version.
