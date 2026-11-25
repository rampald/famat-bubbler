# FAMAT and Mu Alpha Theta Scantron Builder

**Use it online:** https://rampald.github.io/famat-bubbler/

The home page is **Quick print**: paste your famat.org roster, check each student's test, and download the scantrons. Everything runs in your browser; the roster is never uploaded. The full builder (State, Regional, National, Custom) is at `builder.html`.

Created and maintained by **Derek Rampal**. Version 2.3.0 is a substantial redesign and expansion of the original MIT-licensed [FAMATBubbler](https://github.com/AnirudhRahul/FAMATBubbler) project by AnirudhRahul, including an earlier roster-reader contribution by NoRePercussions.

The application header includes the same current geometric orange-and-blue FAMAT identity used in the 2027 participant packet. The bundled image is a byte-identical runtime copy of the project's approved active logo.

This browser application turns competition registration data into print-ready answer sheets. It prints each student's name, school, correct nine-digit FAMAT ID for that test, event name, and reviewed three-digit scorer code, and fills both digit grids on the official 2018.B answer-sheet image.

Every student row has one **Tests to print** checklist; each checked test prints one scantron. The student's division comes from the 8th digit of the FAMAT registration ID, checked against the FAMAT Sponsors' Guide 2026-2027 eligibility chart. The app does not ask for a student's current math course.

The app supports four explicit workflows:

- **FAMAT Regional / Invitational:** also covers FAMAT Statewide competitions. The ID's division sets the allowed Individuals; organizers add their Opens and other written events.
- **FAMAT State Convention 2027:** the current packet's Individual divisions (Chi, Theta, Alpha, Mu/Calculus, Statistics) and its Round 1 and Round 2 topic tests.
- **Mu Alpha Theta National Convention 2027:** Individual plus three topic rounds. The event list is an editable starting template, not a current packet or scorer-code list.
- **Custom competition:** a user-defined name and event catalog for unusual or nonstandard competitions.

All roster processing and PDF generation happen locally in the browser. The application does not upload or retain student information.

## Division rules (Sponsors' Guide 2026-2027)

The 8th digit of a FAMAT ID is the division number, assigned by the student's current mathematics class (p. 34): `1` Algebra I, `2` Geometry, `3` Algebra II, `4` Pre-Calculus, `5` Calculus, `6` Statistics. The State Convention also uses `9` for Chi. The digit selects the row of the eligibility chart (p. 31):

| 8th digit | Regional / Statewide divisions | State Convention divisions |
|---:|---|---|
| 1 | Algebra I, Geometry, Algebra II, Precalculus, Calculus, Statistics | (none) |
| 2 or 3 | Geometry, Algebra II, Precalculus, Calculus, Statistics | Theta, Alpha, Mu, Statistics |
| 4 | Precalculus, Calculus, Statistics | Alpha, Mu, Statistics |
| 5 | Calculus, Statistics | Mu, Statistics |
| 6 | Statistics, Precalculus, Calculus; Algebra I, Geometry, Algebra II only under chart note ** | Statistics |
| 9 | (not used) | Chi, Statistics |

The Individual for the ID's division is checked automatically. Divisions the chart does not allow are locked in the checklist with the reason. State's Chi and Statistics divisions come from the 2027 State packet, which opens Statistics to any student.

**Previous-year IDs** are optional. When supplied, each one removes divisions: eligibility in Algebra I, Geometry, Algebra II, and Statistics lasts one year; students may never test down (across years Geometry counts as lower than Algebra II); students who previously competed in Statistics are no longer eligible for it. A Statistics-course student whose previous-year ID shows Geometry or Algebra II loses Algebra I, Geometry, and Algebra II (chart note **). Within the current season a Geometry or Algebra II student may still enter either division (chart note ***).

Other rules:

- Regional / Statewide students may take at most two Individuals, and one must be Statistics, Precalculus, or Calculus (chart note ****). Each Individual prints with its own division's 8th digit and keeps the team digit (p. 34: use the appropriate ID number for each test).
- Two Individuals in the same round of the 2026-27 regional schedule (p. 5: Round 1 Algebra I, Geometry, Calculus; Round 2 Algebra II, Pre-Calculus, Statistics) produce a warning, because hosts may change schedules.
- State and National students take one Individual. Two topic tests in the same round produce a warning.
- State and National topic tests must be at or above the student's Chi/Theta/Alpha/Mu level; a previous-year ID can raise that level.
- Events marked non-scantron, including Speed and Mental, never produce sheets.

The course-eligibility questions from versions 2.0-2.2 remain in the code but are switched off through each profile's `courseEligibilityQuestions` setting.

## Event catalogs and current status

Open the **event catalog and codes** editor to change the catalog without editing application code. An organizer can add or rename an event, change its session, set the eligible-division list, specify whether it uses this scantron, deactivate an event that is not offered, and enter or replace its printed code. Active scorer codes must be unique strings of exactly three digits; leading zeroes are preserved. A checked event with a blank or invalid code blocks generation.

Every scorer code must be checked against the current competition's organizer-approved list. The Regional sample event names and codes are fictional demonstration data; never use them for production scoring.

### State

| State division | ID digit 8 | Individual code |
|---|---:|---:|
| Chi | `9` | `291` |
| Theta | `2` for Geometry or `3` for Algebra II | `231` |
| Alpha | `4` | `241` |
| Mu / Calculus | `5` | `251` |
| Statistics | `6` | `261` |

State IDs are nine digits and must end in `0`. A State Individual in a higher division than the ID prints with that division's digit. Speed and Mental do not use these prepared answer sheets and are excluded. Before production printing, compare the complete State catalog with the final organizer-approved instructions and retain that approval with the packet.

### National

The National profile contains an editable 2027 starting template with three Individual events and 33 topic events, divided into 11 choices in each of Rounds 1, 2, and 3. It does **not** claim that those events use this answer sheet, and it does not include current scorer codes. All National codes begin blank and block generation when checked. A `Division` column (Theta, Alpha, or Mu) checks that Individual and sets the lowest topic level.

### Regional / Invitational

Regional / Invitational mode also covers FAMAT Statewide competitions. It begins with the six official division Individuals (Algebra I `1`, Geometry `2`, Algebra II `3`, Precalculus `4`, Calculus `5`, Statistics `6`) but no assumed tournament scorer codes. Opens are organizer-defined: edit their name, eligible divisions, session, scantron status, and three-digit scorer code. ID digit 9 is preserved as `0` no team, `1` Team 1, or `2` Team 2.

### Custom competitions

Custom mode is separate from Regional / Invitational and starts with its own empty setup. Enter a competition name, add only applicable events, and enter codes supplied by that competition's scorer. Each student needs at least one checked event.

## Quick start

No package installation is required. Serve the repository over localhost because browsers do not reliably load JavaScript modules from a `file:` URL:

```powershell
npm start
```

Then open `http://127.0.0.1:4173` in a current browser.

1. Choose **Regional / Invitational**, **State**, **National**, or **Custom**. State remains the initial selection.
2. For Regional / Invitational, enter the tournament name, enter reviewed codes for the six division Individuals, and add only the Opens or other written events offered by that competition. For Custom, enter the competition name and build its catalog.
3. Enter a default full school name, or supply `School` on every imported row.
4. Upload one or more registration files, or paste spreadsheet rows.
5. Review every student, school, ID, previous-year ID, and checklist. Use the row checkboxes to select several students, **Select all** to select every row, **Delete selected** or **Clear all rows** (each confirmed), and **Check or uncheck a test for several students** for bulk changes.
6. Open the **event catalog and codes** editor. Review the State catalog, including Chi `291`, against the current packet, enter the host tournament's Regional or National codes, or build the custom catalog. Do not treat sample Regional codes as real.
7. Resolve every blocking issue and review warnings.
8. Check the manifest, generate the PDF, and print US Letter, single-sided, at **Actual size / 100%**. Disable "Fit to page," headers, and footers.

Print one sample first. Verify the dark marks are centered in both the Student ID and Test Code bubbles, then run that sample through the actual event scanner before printing the full packet. Automated geometry tests cannot replace a physical scanner acceptance test.

## Input formatting shown in the app

The import screen changes its directions and example when the convention type changes. The same synthetic formats are available as templates:

- `samples/state-registration-template.csv`
- `samples/national-registration-template.csv`
- `samples/regional-invitational-template.csv`
- `samples/custom-famat-event-template.csv`
- `samples/README.md` for field-by-field directions

```csv
School,School Code,Student Name,Student ID,Previous Year IDs,Events
Sample Academy,1234,Jordan Lee,123400330,123400220,"Algebra II Individual; Geometry Open"
```

- `Student Name` and `Student ID` are required. `School`, `School Code`, `Previous Year IDs`, and `Events` are optional; National files may add `Division`.
- `Events` lists the tests to print, separated by semicolons, as full names, unambiguous aliases, or reviewed three-digit codes. A blank cell checks only the Individual for the ID's division.
- `Previous Year IDs` lists last year's FAMAT ID or IDs, separated by semicolons.
- Older files still import: `Individual`, `Round 1`-`Round 3`, `Optional Event 1`-`6`, and `Event 1`-`4` columns become checked tests. A test in the wrong round column is checked and noted; a test listed twice prints once and is noted. Course columns (`Eligibility Basis`, `Statistics Eligibility Basis`, `Topic Eligibility Level`) are ignored. In Regional and State files, a `Division` value that disagrees with the ID is a warning and the ID is used.
- For State files, the participant packet's exact `No Team STATE ID` heading is accepted as the Student ID column.

### Formatting rules

- Keep every FAMAT ID as exactly nine digits. State Convention uses the No Team ID ending in `0`. Regional/Invitational/Statewide accepts digit 9 values `0` no team, `1` Team 1, and `2` Team 2.
- The first four ID digits are the school code. If `School Code` is supplied, it must contain exactly four digits and match that prefix.
- Keep IDs and scorer codes as text when leading zeroes are possible. Do not let a spreadsheet convert them to shorter numbers.
- Put a full school name in `School` on every row, or enter one default school name in the app. Row-level school values override the default.
- Quote CSV values containing commas, for example `"Rivera, Ana M."`.
- Blank rows are ignored. Malformed rows, unknown columns, unresolved events, and invalid IDs are reported for review rather than silently omitted.
- Use synthetic data in reusable examples. Do not save real student information in the repository.

## Batch files and PDFs

The file picker accepts one file or a batch of `.csv`, `.tsv`, `.txt`, and `.pdf` files. This supports importing a roster PDF with a separate assignment spreadsheet, or one file per school.

When the same nonblank Student ID appears in more than one source, identical rows are deduplicated, compatible rows are merged, and contradictory populated values (including different Events lists) create a blocking conflict naming the source files.

The State registration-roster PDF layout is supported. A PDF must contain extractable text; an image-only scan or a PDF with no student rows produces a blocking error. The importer reads the roster header and the Student, Division, Team 1 ID, Team 2 ID, and No Team ID columns and selects the exact No Team ID; the checklist starts with the Individual for that ID's division. Placeholder rows such as `1Alg, 1Alg` are reported and skipped.

## Validation rules

- A full school name is required for every student, either from the row or the default school field.
- Every Student ID must be exactly nine digits, have a known division digit, and agree with any supplied four-digit school code. State requires final digit `0`; Regional/Invitational/Statewide permits `0`, `1`, or `2`.
- Previous-year IDs must be nine digits with a known division digit.
- Every student needs at least one checked test. Checked tests must be in the catalog, have reviewed codes, use this scantron, and be allowed by the student's IDs.
- Duplicate IDs are deduplicated only when their data is identical or complementary; contradictions block generation.
- The PDF contains exactly the validated page jobs and does not append a trailing blank page.

The manifest groups planned output by event name and code. Packets may be ordered by student or by test.

## Development and verification

No package installation is required. Runtime copies of jsPDF and PDF.js are committed under `vendor/` so roster import and PDF creation do not depend on a CDN.

```powershell
npm test
npm run check
```

The automated suite covers all four profiles, the ID-based division rules (`src/eligibility.js`), independent configurable catalogs, editable code catalogs, CSV/TSV/roster parsing, batch deduplication and conflict handling, Student ID validation, per-test ID digits, deterministic ordering, Letter-page geometry, both bubble grids, leading-zero codes, image decoding, and prevention of trailing blank pages.

The answer-sheet image is the official Sheet version 2018.B. Its dimensions and calibrated marks must not be independently scaled. Any template replacement requires a new physical alignment and scanner test.

## Third-party software and license

- jsPDF 2.5.2 — local UMD build; license in `vendor/LICENSE-jspdf.txt`.
- PDF.js 4.10.38 — local browser modules; license in `vendor/LICENSE-pdfjs.txt`.

The application code is licensed under the MIT License; see `LICENSE.MD`.
