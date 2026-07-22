import {
  Binoculars,
  Crosshair,
  Drop,
  FirstAid,
  Flame,
  Hammer,
  SteeringWheel,
  UsersThree,
  Waves,
  Wind,
} from "@phosphor-icons/react";
import { lowerDeckCells, stationData, topDeckCells } from "../gameData";
import { useGameStore } from "../store";

const stationIcons = {
  helm: SteeringWheel,
  lookout: Binoculars,
  sails: Wind,
  portGuns: Crosshair,
  starboardGuns: Crosshair,
  carpenter: Hammer,
  surgeon: FirstAid,
  pumps: Waves,
  magazine: Crosshair,
  fire: Flame,
  leak: Drop,
};

function DeckGrid({ deck, cells, columns = 16 }) {
  const crew = useGameStore((state) => state.crew);
  const selectedCrewId = useGameStore((state) => state.selectedCrewId);
  const player = useGameStore((state) => state.player);
  const assignSelectedCrew = useGameStore((state) => state.assignSelectedCrew);
  const cellSet = new Set(cells.map(([x, y]) => `${x}-${y}`));
  const rows = Math.max(...cells.map(([, y]) => y)) + 1;
  const stations = Object.values(stationData).filter((station) => station.deck === deck);

  return (
    <div className="deck-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: rows * columns }).map((_, index) => {
        const x = index % columns;
        const y = Math.floor(index / columns);
        const active = cellSet.has(`${x}-${y}`);
        const station = stations.find((item) => item.x === x && item.y === y);
        const emergencyInactive = station?.id === "fire" ? player.fire < 1 : station?.id === "leak" ? player.flood < 1 : false;
        const occupants = station ? crew.filter((person) => !person.target && person.location === station.id && person.health > 0) : [];
        const movers = station ? crew.filter((person) => person.target === station.id && person.health > 0) : [];
        const Icon = station ? stationIcons[station.id] : null;

        if (!active) return <span key={`${x}-${y}`} className="deck-cell void" />;
        return (
          <button
            key={`${x}-${y}`}
            className={`deck-cell ${station ? "station" : ""} ${station?.emergency ? "emergency" : ""} ${emergencyInactive ? "inactive-emergency" : ""}`}
            onClick={() => station && !emergencyInactive && assignSelectedCrew(station.id)}
            disabled={!station || emergencyInactive}
            title={station ? `${station.label}: ${station.description}` : "Open deck"}
            aria-label={station ? `Assign selected crew to ${station.label}` : undefined}
          >
            {Icon && <Icon weight={station?.emergency ? "fill" : "bold"} />}
            {occupants.length > 0 && (
              <span className="cell-crew">
                {occupants.map((person) => (
                  <i
                    key={person.id}
                    className={person.id === selectedCrewId ? "selected" : ""}
                    style={{ "--crew-color": person.color }}
                  >
                    {person.initials.slice(0, 1)}
                  </i>
                ))}
              </span>
            )}
            {movers.length > 0 && <span className="incoming-pip" />}
          </button>
        );
      })}
    </div>
  );
}

function CrewCard({ person, selected, onSelect }) {
  const healthTone = person.health <= 0 ? "critical" : person.health < 35 ? "critical" : person.health < 70 ? "wounded" : "healthy";
  const station = stationData[person.location];
  const specialtyMatch = station && person.specialty === station.specialty && !person.target;
  return (
    <button
      className={`crew-card ${selected ? "selected" : ""} ${healthTone} ${specialtyMatch ? "specialty-match" : ""}`}
      onClick={onSelect}
      style={{ "--crew-color": person.color }}
      disabled={person.health <= 0}
    >
      <span className="crew-avatar"><UsersThree weight="fill" /></span>
      <span className="crew-card-copy">
        <strong>{person.name}</strong>
        <small>{person.health <= 0 ? "Out of action" : person.status}</small>
      </span>
      <span className="crew-health"><i style={{ width: `${Math.max(0, person.health)}%` }} /></span>
    </button>
  );
}

export function CrewPanel() {
  const crew = useGameStore((state) => state.crew);
  const selectedCrewId = useGameStore((state) => state.selectedCrewId);
  const selectCrew = useGameStore((state) => state.selectCrew);
  const standDownSelected = useGameStore((state) => state.standDownSelected);
  const selected = crew.find((person) => person.id === selectedCrewId) || crew[0];

  return (
    <aside className="crew-panel ink-panel">
      <header className="panel-title-row">
        <UsersThree weight="fill" />
        <span><small>Ship company</small><strong>Crew Orders</strong></span>
        <i>{crew.filter((person) => person.health > 0).length}</i>
      </header>

      <div className="crew-roster">
        {crew.map((person) => (
          <CrewCard key={person.id} person={person} selected={person.id === selectedCrewId} onSelect={() => selectCrew(person.id)} />
        ))}
      </div>

      <div className="selected-crew-row">
        <span><small>Selected</small><strong>{selected?.name}</strong><em>{selected?.role} · {selected?.specialty}</em></span>
        <button onClick={standDownSelected}>Stand down</button>
      </div>

      <section className="deck-section">
        <header><strong>Top decks</strong><span>Stern&nbsp;&nbsp; Bow →</span></header>
        <DeckGrid deck="top" cells={topDeckCells} />
      </section>

      <section className="deck-section lower">
        <header><strong>Lower gun deck</strong><span>Stern&nbsp;&nbsp; Bow →</span></header>
        <DeckGrid deck="lower" cells={lowerDeckCells} />
      </section>

      <footer className="deck-legend">
        <span><i className="legend-station" /> Station · gold rim = specialty match</span>
        <span><i className="legend-crew" /> Initial = crew on station</span>
      </footer>
    </aside>
  );
}
