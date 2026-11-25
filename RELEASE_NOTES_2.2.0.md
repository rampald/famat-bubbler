# FAMAT Bubbler 2.2.0

Release date: October 22, 2026

Version 2.2.0 restores the original Bubbler's central rule—division determines the required Individual scantron—and extends it with current FAMAT eligibility, State numbering, configurable written events, and per-test ID validation.

## Regional, Invitational, and Statewide workflow

- Added the six official course divisions and ID digit-8 values:
  - `1` Algebra I
  - `2` Geometry
  - `3` Algebra II
  - `4` Precalculus
  - `5` Calculus
  - `6` Statistics
- Added a separate current-course or eligibility-basis field so the program can enforce the Sponsor Guide's never-test-down rule.
- Statistics-basis students can provide a separate non-Statistics `Statistics Eligibility Basis` (also accepted as `Other Course Basis` or `Secondary Eligibility Basis`) so their remaining division eligibility is evaluated from documented coursework rather than Statistics alone.
- The registered division now derives one required Individual scantron automatically.
- Regional digit 9 now correctly accepts and preserves `0` no team, `1` Team 1, or `2` Team 2.
- Organizers may expose zero through six additional written-event columns instead of carrying unused fixed columns.
- Opens and other written events are configurable by name, session, eligible divisions, scantron status, active state, and reviewed three-digit code.
- Speed and Mental are explicitly excluded from scantron output.
- A permitted second Individual uses its own division-specific ID digit rather than reusing the primary division's ID.
- The model permits at most two division Individuals, and a two-Individual pair must include Statistics, Precalculus, or Calculus.
- Regional sample event names and codes are fictional. Current organizer-approved codes are required for production use.

## State Convention workflow

- Reconciled the builder with the verified current State packet's five Individual divisions:
  - Chi: State ID digit `9`, Individual code `291`
  - Theta: State ID digit `2` or `3`, Individual code `231`
  - Alpha: State ID digit `4`, Individual code `241`
  - Mu / Calculus: State ID digit `5`, Individual code `251`
  - Statistics: State ID digit `6`, Individual code `261`
- State IDs remain nine-digit No Team IDs ending in `0`.
- Individual is derived from State division and validated against digit 8.
- Each State student receives exactly three prepared sheets: Individual, Round 1, and Round 2.
- Chi, Theta, Alpha, and Mu topic choices follow the same-level-or-higher ladder.
- Statistics students must provide a separate Chi/Theta/Alpha/Mu topic-eligibility level.
- Speed and Mental remain outside the prepared-scantron workflow.

## Imports and review interface

- Added import support for `Eligibility Basis`, `Current Course`, `Statistics Eligibility Basis`, and `Topic Eligibility Level`.
- Added `Optional Event 1` through `Optional Event 6` and equivalent `Additional Event` aliases.
- Preserved legacy Custom-mode `Event 1` through `Event 4` imports.
- Regional roster parsing preserves Algebra I, Geometry, Algebra II, Precalculus, Calculus, and Statistics instead of collapsing course divisions into State levels.
- Batch merging now detects conflicts in eligibility, division, and every dynamic optional-event slot.
- Division and event choices are filtered before assignment, while the packet model independently validates forged or malformed imported values.
- Existing multi-row selection, delete-selected, clear-all, catalog editing, manifest, and local-only PDF generation remain available.

## National and Custom

- National Convention remains an editable Individual-plus-three-round starting template. Current National event applicability and scorer codes must be supplied by the organizer.
- Custom remains a separate editable competition workflow with its legacy one-to-four assignment structure.

## Production checklist

1. Run `npm test` and `npm run check`.
2. Start the local preview with `npm start` and open `http://127.0.0.1:4173`.
3. Compare every event name, eligibility rule, and three-digit code with the current organizer-approved materials.
4. Generate one synthetic sample and print at Actual size / 100 percent.
5. Verify the ID and test-code bubbles visually and with the event's actual scanner before printing a full packet.

The application remains local-only: roster files and generated student data are processed in the browser and are not uploaded by the application.
