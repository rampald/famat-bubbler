# FAMAT Bubbler 2.1.1

Release date: October 22, 2026

Version 2.1.1 withdraws the earlier Chi Individual confirmation claim and improves the placement of the application header.

## Chi Individual safety correction

- Chi Individual no longer has a default scorer code.
- The catalog marks Chi Individual as pending and generation-blocking.
- A student assigned to Chi Individual cannot receive generated sheets until an organizer-reviewed, unique three-digit code is entered in the event catalog.
- The interface, documentation, tests, and validation records no longer describe code `291` as authoritative.
- Entering a later reviewed code through the catalog editor still enables Chi sheets without changing the built-in catalog.

## Header alignment

- The FAMAT logo, convention label, title, summary, and catalog button now share one centered column.
- The summary is constrained and balanced so it stays visually connected to the title at wide widths.
- The Import, Review, and Download navigation remains aligned to the same content frame.
- The centered layout adapts at tablet and phone widths without introducing page-level horizontal overflow.

Before production use, compare every event name and scorer code with the final organizer-approved instructions. Print and scan-test one sample sheet at Actual size / 100 percent before printing a full packet.
