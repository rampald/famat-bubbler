# Registration file formatting

These files contain fictional example students only. Replace every sample value before producing a real packet.

## Basic rules

- Save spreadsheet data as CSV (UTF-8) or TSV, or copy it with its header row and paste it into the program.
- Keep one student per row.
- Keep `Student ID` as exactly nine digits and format that spreadsheet column as plain text so leading zeroes survive. State Convention uses the No Team ID ending in `0`; Regional, Invitational, and Statewide files may end in `0`, `1`, or `2` for no team, Team 1, or Team 2.
- Put a comma-containing value in double quotation marks, such as `"Rivera, Ana"`.
- `Student Name` and `Student ID` are the only required columns.
- `Events` lists the tests to print, separated by semicolons, for example `"Precalculus Individual; Sample Open"`. Use the full event name or reviewed three-digit code shown in the program's event catalog. Leave it blank to print only the Individual for the division in the ID's 8th digit.
- `Previous Year IDs` (Regional and State) is optional: the student's FAMAT ID or IDs from last year, separated by semicolons. They remove divisions the Sponsors' Guide no longer allows.
- `School` and `School Code` are optional when the app supplies one default full school name. Include `School` for a multi-school file. If `School Code` is supplied, it must contain four digits and match the first four digits of the Student ID.
- Multiple files may be selected together. Rows with the same Student ID are merged only when their populated values agree; contradictions block generation.
- A PDF must contain selectable registration text. Scanned or photo-only PDFs are blocked because they cannot be read reliably.
- Older files still import: `Individual`, `Round 1`-`Round 3`, `Optional Event 1`-`6`, and `Event 1`-`4` columns become checked tests. Course columns such as `Eligibility Basis` and `Topic Eligibility Level` are ignored.

## How divisions are set

The 8th digit of the FAMAT ID is the division number (Sponsors' Guide 2026-2027, p. 34): `1` Algebra I, `2` Geometry, `3` Algebra II, `4` Pre-Calculus, `5` Calculus, `6` Statistics. The State Convention also uses `9` for Chi. The app lets you check only the divisions the eligibility chart (p. 31) allows for that digit, and checks the matching Individual automatically.

A previous-year ID removes divisions: Algebra I, Geometry, Algebra II, and Statistics eligibility lasts one year; students may never test down (across years Geometry counts as lower than Algebra II); a student who competed in Statistics may not compete in it again.

## State

```csv
School,School Code,Student Name,Student ID,Previous Year IDs,Events
```

The State divisions are Chi, Theta, Alpha, Mu/Calculus, and Statistics:

- Chi: digit 8 is `9`; Individual code `291`.
- Theta: digit 8 is `2` for Geometry or `3` for Algebra II; Individual code `231`.
- Alpha: digit 8 is `4`; Individual code `241`.
- Mu/Calculus: digit 8 is `5`; Individual code `251`.
- Statistics: digit 8 is `6`; Individual code `261`.

State digit 9 must be `0`. A State student normally takes one Individual, one Round 1 topic, and one Round 2 topic. Topics must be at the student's Chi/Theta/Alpha/Mu level or higher. Speed and Mental do not use these prepared scantrons.

## National

```csv
School,School Code,Student Name,Student ID,Division,Events
```

`Division` (Theta, Alpha, or Mu) checks that Individual and sets the lowest topic level. The National event list is an editable starting template. Enter the current organizer-approved three-digit codes in the program before generating sheets.

## Regional / Invitational

This profile also covers FAMAT Statewide tournaments.

```csv
School,School Code,Student Name,Student ID,Previous Year IDs,Events
```

A student may take at most two Individuals, and one must be Statistics, Precalculus, or Calculus. A second Individual prints with its own division digit and keeps the team digit.

The six Individual event rows are preloaded, but their organizer codes begin blank. No Open events are assumed. Enter the tournament name, supply the host's reviewed three-digit Individual codes, and add the actual Open or other written events (such as `Geometry Open`, `Calculus Open`, and `Statistics Open` in `regional-invitational-template.csv`) with their eligible divisions and reviewed codes before importing. Speed and Mental must remain non-scantron events. All example Regional names and codes are fictional placeholders.

## Custom competition

```csv
School,School Code,Student Name,Student ID,Events
```

Each student must have at least one event. Custom keeps its own tournament name and catalog. Configure matching event names and three-digit codes before importing `custom-famat-event-template.csv`. The example names `Sample Event A` through `Sample Event D` are placeholders, not official events or codes.

## Managing imported rows

Use the checkbox beside a row to select and highlight it. The checkbox in the table heading selects or deselects every student row. **Delete selected** removes only those selected rows after confirmation. **Clear all rows** removes the entire current roster after a separate confirmation; it does not clear the selected profile or its configured event catalog. **Check or uncheck a test for several students** applies one test to the selected rows, or to every row when none are selected.
