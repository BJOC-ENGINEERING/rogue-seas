# Rogue Seas

**A browser-based age-of-sail combat roguelike with an FTL-style crew and damage-control layer.**

[![License: MIT](https://img.shields.io/badge/license-MIT-c59035.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-111111.svg)](https://threejs.org/)
[![CI](https://github.com/BJOC-ENGINEERING/rogue-seas/actions/workflows/ci.yml/badge.svg)](https://github.com/BJOC-ENGINEERING/rogue-seas/actions/workflows/ci.yml)

Command the *Wayward Gull* through a branching voyage. Assign a named crew to the helm, lookout, sails, guns, pumps, repairs, and surgery. Slow time when a broadside tears through the hull, then decide whether to fight, repair, or run before fire and flooding overwhelm the ship.

Rogue Seas is a single-player, offline-first prototype. There are no accounts, analytics, multiplayer services, or backend dependencies.

## Play

**Live game:** deployment link will be added after the first production release.

The game runs best in a modern desktop browser with WebGL enabled.

## What is playable

- A title, voyage chart, encounter, and full combat loop
- Six named crew members with roles, health, movement, and station bonuses
- Pausable real-time combat at 1x, 2x, and 3x speed
- Port and starboard broadsides with round, chain, and grape shot
- Targetable enemy systems and deterministic opening-fire behavior
- Fires, flooding, hull damage, torn sails, wounds, and critical-event auto-pause
- Repair, pump, firefighting, surgery, retreat, victory, and defeat actions
- Branching voyage nodes, port repair, supplies, and persistent local progress
- A detailed three-mast ship generated through Blender's Python API
- A movable 3D camera with orbit and zoom controls

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move the combat camera |
| `Shift` | Move the camera faster |
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom |
| `R` | Reset the camera |
| `Space` | Pause or resume combat |
| `1` `2` `3` | Set combat speed |
| `F` | Fire a loaded broadside |

Select a crew member in the left panel, then choose a station or deck cell. Crew specialties make their matching systems faster and more effective.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/BJOC-ENGINEERING/rogue-seas.git
cd rogue-seas
npm ci
npm run dev
```

Create a production bundle with:

```bash
npm run build
npm run preview
```

## Architecture

```text
React UI
├── Title and voyage chart
├── Crew and deck management
└── Combat HUD and controls
        │
        ▼
Zustand simulation store
├── Voyage progression
├── Crew movement and stations
├── Combat timing and damage
└── Local persistence
        │
        ▼
React Three Fiber / Three.js
├── Blender-generated glTF ships
├── Ocean, fog, lighting, and wake
└── Crew, damage, and camera presentation
```

Simulation state is kept separate from 3D presentation so combat rules can grow without replacing the renderer or interface.

## Rebuild the detailed ship

Blender is optional for playing or developing the game. It is only needed to regenerate the main glTF ship asset.

```bash
blender --background --python scripts/build_detailed_ship.py
```

The script procedurally builds the layered hull, gun battery, decks, rails, three masts, yards, sails, standing and running rigging, ratlines, fittings, lanterns, flag, and wake. It exports the browser-ready model to `public/assets/models/ships/wayward-gull-detailed.glb`.

## Project structure

```text
src/components/       Screens, HUD panels, and Three.js scene
src/store.js          Voyage and combat simulation
src/gameData.js       Crew, stations, encounters, and chart data
scripts/              Reproducible Blender asset generator
public/assets/        Redistributable runtime models and textures
```

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing, and add licensing information for any new third-party asset.

## License and assets

The source code is available under the [MIT License](./LICENSE). Runtime assets have their own provenance and license notes in [ATTRIBUTION.md](./ATTRIBUTION.md).
