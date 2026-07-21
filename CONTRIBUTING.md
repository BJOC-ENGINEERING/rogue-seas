# Contributing to Rogue Seas

Thanks for helping improve Rogue Seas. Small, focused pull requests are easiest to review.

## Development setup

1. Fork and clone the repository.
2. Install Node.js 20 or newer.
3. Run `npm ci`.
4. Start the game with `npm run dev`.
5. Verify changes with `npm run build` before opening a pull request.

## Pull requests

- Explain the player-facing change and why it belongs in the game.
- Keep simulation rules in the Zustand store and rendering concerns in the React/Three.js components.
- Test title, chart, encounter, and combat states at both desktop and compact viewport sizes.
- Do not commit generated build output, local design references, credentials, or personal data.
- Credit any new third-party asset in `ATTRIBUTION.md` and confirm that its license permits redistribution.

## Bug reports and ideas

Open a GitHub issue with reproduction steps, expected behavior, actual behavior, browser version, and screenshots when the problem is visual.
