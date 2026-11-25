# FAMAT Bubbler 2.1.0

Version 2.1.0 adds a dedicated Regional / Invitational workflow and safer bulk roster controls while preserving the State and National behavior established in version 2.0.1.

## Current FAMAT identity and State packet compatibility

- The application header now displays the same current geometric orange-and-blue FAMAT logo used in the 2027 participant packet. The distributable asset is byte-identical to the approved active logo.
- The State importer accepts the packet's exact `No Team STATE ID` column heading without manual renaming.
- Chi Individual pending-code blocking and the three-sheet State workflow remain covered by automated tests.

## New Regional / Invitational profile

- The profile selector now presents four explicit choices: **FAMAT Regional / Invitational**, **FAMAT State Convention 2027**, **Mu Alpha Theta National Convention 2027**, and **Custom competition**.
- Regional / Invitational also covers FAMAT statewides.
- A tournament name is required.
- The profile provides four configurable assignment slots, `Event 1` through `Event 4`. Each student needs at least one assignment; unused slots may remain blank.
- It begins with a separate empty event catalog. No event names or scorer codes are presumed.
- Every assigned event requires a unique, organizer-reviewed three-digit code before generation.
- `samples/regional-invitational-template.csv` supplies a fictional formatting example.
- Regional / Invitational and Custom keep independent tournament names and event catalogs.

## Bulk row management

- Every student row has a selection checkbox and visible selected-row highlight.
- The table-heading checkbox selects or deselects all current rows.
- **Delete selected** reports the selected count and asks for confirmation before removing only those rows.
- **Clear all rows** uses a separate confirmation before emptying the roster.
- Clearing rows preserves the selected convention profile and its configured event catalog.
- One-student packet summaries now use the singular word `student`.

## Preserved safety behavior

- FAMAT State Convention remains the initial profile and continues to produce three sheets per valid student.
- Mu Alpha Theta National Convention continues to produce four sheets per valid student after its event list and codes have been reviewed.
- Custom remains a separate generic one-to-four-event workflow.
- Chi Individual remains pending and fail-closed until an organizer-reviewed three-digit scorer code is entered.
- Missing, invalid, pending, or duplicate event codes continue to block generation.
- Student data remains in the browser; the application does not upload or retain it.

Before production use, compare every event catalog and scorer code with the final organizer-approved instructions. Print and scan-test one sample sheet at Actual size / 100 percent before printing a full packet.
