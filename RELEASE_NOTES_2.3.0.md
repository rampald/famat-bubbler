# FAMAT Bubbler 2.3.0

Release date: October 23, 2026

Version 2.3.0 gives every student one checklist of tests to print and takes each student's division from the FAMAT registration ID. It follows the FAMAT Sponsors' Guide 2026-2027: the Eligibility Chart for Competitions (p. 31), the Student ID instructions (p. 34), and the regional schedule (p. 5). The Bubbler no longer asks for a student's current math course.

## One checklist per student

- All four profiles (Regional / Invitational, State, National, Custom) show a **Tests to print** checklist in each row, grouped as Individual, Additional / Open, and Rounds 1-3. Each checked test prints one scantron.
- The Individual for the division in the ID's 8th digit is checked automatically. It can be unchecked.
- Tests the student's IDs do not allow are listed but locked, with the reason shown under each one.
- **Check or uncheck a test for several students** replaces the bulk-default selectors. It applies to the selected rows, or to every row when none are selected, and skips students whose ID does not allow the test.
- The Regional setting for 0-6 additional written-event columns is gone; any number of tests can be checked.

## Division rules

The 8th digit of the current ID selects the row of the eligibility chart.

| 8th digit (current class) | Regional / Statewide divisions | State Convention divisions |
|---|---|---|
| 1 Algebra I | Algebra I, Geometry, Algebra II, Precalculus, Calculus, Statistics | (none) |
| 2 Geometry / 3 Algebra II | Geometry, Algebra II, Precalculus, Calculus, Statistics | Theta, Alpha, Mu, Statistics |
| 4 Pre-Calculus | Precalculus, Calculus, Statistics | Alpha, Mu, Statistics |
| 5 Calculus | Calculus, Statistics | Mu, Statistics |
| 6 Statistics | Statistics, Precalculus, Calculus; Algebra I, Geometry, Algebra II only under chart note ** (warning) | Statistics |
| 9 Chi (State only) | (not used) | Chi, Statistics |

State's Theta, Alpha, and Mu come from the chart's State Convention columns. Chi (digit 9) and Statistics (open to any student) are the 2027 State packet's additional divisions.

A previous-year ID is optional. When it is given, its 8th digit removes divisions:

| Previous-year 8th digit | Removed this year | Reason |
|---|---|---|
| 1 | Algebra I | Eligibility lasts one year |
| 2 | Algebra I, Geometry | No testing down; one year in Geometry |
| 3 | Algebra I, Geometry, Algebra II | No testing down (Geometry counts as lower than Algebra II across years); one year in Algebra II |
| 4 | Algebra I, Geometry, Algebra II (State: Chi, Theta) | No testing down |
| 5 | Algebra I, Geometry, Algebra II, Precalculus (State: Chi, Theta, Alpha) | No testing down |
| 6 | Statistics | Students who previously competed in Statistics are no longer eligible for it |

Several previous-year IDs can be entered, separated by semicolons; each one applies. A Statistics-course student (current digit 6) whose previous-year ID shows Geometry or Algebra II loses Algebra I, Geometry, and Algebra II (chart note **). Within the current season, a Geometry or Algebra II student may still enter either division (chart note ***).

Other rules:

- **Regional / Statewide:** at most two Individuals, and one must be Statistics, Precalculus, or Calculus (chart note ****). Each Individual prints with its own division's 8th digit and keeps the team digit (p. 34).
- **Same round:** a warning appears when two checked Individuals are in the same round of the 2026-27 regional schedule (Round 1: Algebra I, Geometry, Calculus; Round 2: Algebra II, Pre-Calculus, Statistics). Hosts may change schedules, so it does not block.
- **State and National:** one Individual per student. Two topic tests in the same round produce a warning.
- **Topics:** State and National topic tests must be at or above the student's Chi/Theta/Alpha/Mu level. A previous-year ID can raise that level, which also sets a level for a Statistics student.
- A State Individual in a higher division than the ID prints with that division's 8th digit.

## Imports

- New optional columns: **Events** (test names or three-digit codes separated by semicolons) and **Previous Year IDs** (separated by semicolons). Only Student Name and Student ID are required.
- A blank Events cell checks the Individual for the ID's division.
- Older files still import. Individual, Round 1-3, Optional Event 1-6, and Event 1-4 columns become checked tests. A test placed in the wrong round column is checked and noted; a test listed twice prints once and is noted.
- Course columns (Eligibility Basis, Statistics Eligibility Basis, Topic Eligibility Level) are ignored.
- In Regional and State files a Division column is compared with the ID. A mismatch is a warning and the ID is used.
- Sample templates in `samples/` use the new columns.

## Retained but switched off

The course-eligibility questions and their rules remain in the code behind each profile's `courseEligibilityQuestions` setting, which is `false` in every profile. Setting it to `true` restores the course column and its checks.

## Verification

- `npm test`: 101 tests pass, including 8 new tests in `tests/checklist-eligibility.test.js`. Tests that checked the removed course rules were rewritten for the ID rules.
- Browser check in Microsoft Edge, version 2.3.0:

  | Workflow | Result |
  |---|---|
  | State sample | 12 scantrons; downloaded PDF has 12 pages |
  | Regional sample | 7 scantrons |
  | Custom sample | 2 scantrons |
  | National sample | Blocked until reviewed codes are entered (unchanged) |
  | Pasted Regional rows with Events and Previous Year IDs | Imported as expected |
  | Locked divisions in the checklist | Correct, with previous-year exclusions |

## Production checklist

1. Run `npm test` and `npm run check`.
2. Start the local preview with `npm start` and open `http://127.0.0.1:4173`.
3. Compare every event name and three-digit code with the current organizer-approved materials.
4. Generate one synthetic sample and print at Actual size / 100 percent.
5. Verify the ID and test-code bubbles visually and with the event's actual scanner before printing a full packet.

The application remains local-only: roster files and generated student data are processed in the browser and are not uploaded.
