# iPhone Safari Compatibility Checklist

## Test Matrix
- Device: at least one modern iPhone (iOS 17+) and one older iOS Safari target if available.
- Browser: Safari (required), Chrome on iOS (same engine, quick sanity check).
- Orientation: portrait and landscape.

## Core Smoke Tests
- Load app fresh: no blank screen, no JS errors, assets/images render.
- Verify typing in search input works and keyboard opens/closes cleanly.
- Verify suggestions list opens, scrolls, and tap-select works.
- Verify `New Game` resets board and input state correctly.
- Verify horizontal board swipe works and headers stay readable.

## Mode Tests
- Casual: unlimited guesses, no forced reset, normal flow.
- Hard/Extreme: 5-guess limit works, loss does not auto-restart, `New Game` required.
- Daily: mode loads and remains stable across refreshes.
- 1v1 Duel:
- Start round shows `Player 1 ready?` gate.
- After Player 1 guess, row is visible briefly before handoff gate appears.
- While gate is open, background is blurred and non-interactive.
- Opponent guesses are hidden during active turn.
- Player 1 and Player 2 can guess the same character (overlap allowed).
- Same player cannot guess the same character twice.

## UI/Interaction Checks
- Modal close buttons are tappable and not blocked by safe-area insets.
- No accidental double-submit from rapid taps.
- Scrolling and touch interactions feel responsive (no stuck focus).
- Confetti/victory effects do not freeze UI.

## iOS-Specific Guardrails For Future Changes
- Avoid `String.prototype.replaceAll`; use regex `.replace(/.../g, ...)`.
- Avoid optional catch binding `catch {}`; use `catch (err) {}`.
- Keep `scrollIntoView` calls wrapped with fallback (options object can fail on older Safari).
- Preserve `-webkit-` prefixed CSS where used (`-webkit-backdrop-filter`, etc.).
- Re-run this checklist after changes to `app.js`, `style.css`, or mode flow.
