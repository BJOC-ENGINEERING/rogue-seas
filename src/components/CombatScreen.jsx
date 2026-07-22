import { useEffect } from "react";
import {
  ArrowCounterClockwise,
  Binoculars,
  CaretLeft,
  CaretRight,
  CompassRose,
  Crosshair,
  Drop,
  Eye,
  Flame,
  GridFour,
  Pause,
  Play,
  Stack,
  SteeringWheel,
  Sword,
  WarningCircle,
  Wind,
} from "@phosphor-icons/react";
import { ammoData, targetSystems } from "../gameData";
import { MAX_FRAME_INTERVAL } from "../frameRate";
import { estimateRetreatChance, useGameStore } from "../store";
import { CrewPanel } from "./CrewPanel";
import { OceanScene } from "./OceanScene";

function Meter({ value, tone = "gold", label }) {
  return (
    <div className={`meter ${tone}`} aria-label={`${label}: ${Math.round(value)} percent`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function VesselPlate({ enemy = false }) {
  const player = useGameStore((state) => state.player);
  const foe = useGameStore((state) => state.enemy);
  const ship = enemy ? foe : player;
  return (
    <section className={`vessel-plate ${enemy ? "enemy" : "player"}`}>
      {!enemy && <span className="vessel-monogram">RS</span>}
      <div>
        <small>{enemy ? "Hostile mech" : "Your vessel"}</small>
        <strong>{enemy && !foe.identified ? "Unknown War-Mech" : ship.name}</strong>
        <Meter value={(ship.hull / (ship.maxHull || 100)) * 100} tone={ship.hull < 35 ? "red" : "gold"} label="Hull" />
      </div>
      {enemy && <span className="vessel-monogram"><Sword weight="fill" /></span>}
    </section>
  );
}

function HelmControls() {
  const player = useGameStore((state) => state.player);
  const crew = useGameStore((state) => state.crew);
  const turnHelm = useGameStore((state) => state.turnHelm);
  const centerHelm = useGameStore((state) => state.centerHelm);
  const setThrottle = useGameStore((state) => state.setThrottle);
  const helmManned = crew.some((person) => !person.target && person.location === "helm" && person.health > 0);
  const sailsManned = crew.some((person) => !person.target && person.location === "sails" && person.health > 0);

  return (
    <section className="helm-cluster">
      <div className="helm-panel ink-panel">
        <header><strong>Helm</strong><span>{helmManned ? `${player.heading > 0 ? "Starboard" : player.heading < 0 ? "Port" : "Amidships"} ${Math.abs(player.heading)}°` : "Locked · unmanned"}</span></header>
        <div className="wheel-row">
          <button onClick={() => turnHelm(-1)} aria-label="Turn to port"><CaretLeft weight="bold" /></button>
          <SteeringWheel className={helmManned ? "manned" : ""} weight="duotone" />
          <button onClick={() => turnHelm(1)} aria-label="Turn to starboard"><CaretRight weight="bold" /></button>
        </div>
        <button className="center-wheel" onClick={centerHelm}>Center wheel</button>
        <footer><span>Port</span><i /><span>Starboard</span></footer>
      </div>
      <div className="speed-panel ink-panel">
        <header><strong>Speed</strong><span>{player.throttle}</span></header>
        <div className="throttle-slots">
          {[0, 1, 2, 3, 4].map((value) => (
            <button key={value} className={player.throttle === value ? "active" : ""} onClick={() => setThrottle(value)}>
              <i style={{ height: `${18 + value * 10}px` }} />
              <span>{value}</span>
            </button>
          ))}
        </div>
        <small>{sailsManned ? `Sails ${Math.round(player.sails)}%` : "Sails unmanned"}</small>
      </div>
    </section>
  );
}

function GunneryControls() {
  const player = useGameStore((state) => state.player);
  const crew = useGameStore((state) => state.crew);
  const paused = useGameStore((state) => state.paused);
  const ammo = useGameStore((state) => state.ammo);
  const targetSystem = useGameStore((state) => state.targetSystem);
  const setAmmo = useGameStore((state) => state.setAmmo);
  const setTargetSystem = useGameStore((state) => state.setTargetSystem);
  const fireBroadside = useGameStore((state) => state.fireBroadside);
  const attemptRetreat = useGameStore((state) => state.attemptRetreat);
  const ready = player.reload <= 0 && !paused;
  const odds = Math.round(estimateRetreatChance(player, crew) * 100);

  return (
    <section className="gunnery-panel ink-panel">
      <header>
        <div><small>Gun deck</small><strong>Broadside Orders</strong></div>
        <span className={player.reload > 0 ? "reloading" : "ready"}>{player.reload > 0 ? `${player.reload.toFixed(1)}s` : "Ready"}</span>
      </header>
      <div className="ammo-tabs">
        {Object.entries(ammoData).map(([id, item]) => (
          <button key={id} className={ammo === id ? "active" : ""} onClick={() => setAmmo(id)} title={item.detail}>
            {item.label.replace(" shot", "")}
          </button>
        ))}
      </div>
      <label>
        <span>Target</span>
        <select value={targetSystem} onChange={(event) => setTargetSystem(event.target.value)}>
          {targetSystems.map((system) => (
            <option key={system.id} value={system.id}>{system.label}</option>
          ))}
        </select>
      </label>
      <button className={`fire-button ${ready ? "pulse-ready" : ""}`} onClick={fireBroadside} disabled={!ready}>
        <Crosshair weight="bold" /> {paused ? "Paused" : player.reload > 0 ? "Reloading" : "Fire broadside"}
      </button>
      <button className="retreat-button" onClick={attemptRetreat} disabled={paused} title="Failed breakaways draw an immediate mech volley">
        <Wind /> Break away · {odds}%
      </button>
    </section>
  );
}

function TimeControls() {
  const paused = useGameStore((state) => state.paused);
  const timeScale = useGameStore((state) => state.timeScale);
  const togglePause = useGameStore((state) => state.togglePause);
  const setTimeScale = useGameStore((state) => state.setTimeScale);
  return (
    <div className="time-controls">
      <button className={paused ? "active" : ""} onClick={togglePause} aria-label={paused ? "Resume" : "Pause"}>
        {paused ? <Play weight="fill" /> : <Pause weight="fill" />}
      </button>
      {[1, 2, 3].map((speed) => <button key={speed} className={!paused && timeScale === speed ? "active" : ""} onClick={() => setTimeScale(speed)}>{speed}×</button>)}
    </div>
  );
}

function PauseBanner() {
  const paused = useGameStore((state) => state.paused);
  const pauseReason = useGameStore((state) => state.pauseReason);
  const battleState = useGameStore((state) => state.battleState);
  const togglePause = useGameStore((state) => state.togglePause);
  if (!paused || battleState !== "engaged") return null;

  const copy = {
    fire: { icon: Flame, text: "Fire aboard — time frozen. Assign crew to Fire response." },
    flood: { icon: Drop, text: "Flooding below — time frozen. Patch the leak or man the pumps." },
    crew: { icon: WarningCircle, text: "Crew down — time frozen. Get someone to the surgeon." },
    manual: { icon: Pause, text: "Battle paused. Issue crew orders, then resume." },
  }[pauseReason || "manual"];

  const Icon = copy.icon;
  return (
    <button className={`pause-banner reason-${pauseReason || "manual"}`} onClick={togglePause}>
      <Icon weight="fill" />
      <span>{copy.text}</span>
      <strong>Resume</strong>
    </button>
  );
}

function pickSpecialist(crew, specialty, fallbackStation) {
  const living = crew.filter((person) => person.health > 0);
  return living.find((person) => person.specialty === specialty && person.location !== fallbackStation)
    || living.find((person) => person.location !== fallbackStation)
    || living[0];
}

function CombatAlerts() {
  const player = useGameStore((state) => state.player);
  const crew = useGameStore((state) => state.crew);
  const selectCrew = useGameStore((state) => state.selectCrew);
  const lookout = crew.some((person) => !person.target && person.location === "lookout" && person.health > 0);

  const orderTo = (stationId, specialty) => {
    const pick = pickSpecialist(crew, specialty, stationId);
    if (!pick) return;
    selectCrew(pick.id);
    useGameStore.getState().assignSelectedCrew(stationId);
  };

  return (
    <div className="combat-alerts">
      {!lookout && <button onClick={() => orderTo("lookout", "Sight")}><Binoculars /> Lookout unmanned · visibility limited</button>}
      {player.fire > 1 && <button className="danger" onClick={() => orderTo("fire", "Repair")}><Flame weight="fill" /> Fire on top deck · assign crew</button>}
      {player.flood > 1 && <button className="water" onClick={() => orderTo("leak", "Repair")}><Drop weight="fill" /> Flooding below · patch leak</button>}
    </div>
  );
}

function ShipReadouts() {
  const player = useGameStore((state) => state.player);
  const enemy = useGameStore((state) => state.enemy);
  return (
    <div className="ship-readouts">
      <section><span>Hull</span><strong>{Math.round(player.hull)}</strong><Meter value={(player.hull / (player.maxHull || 100)) * 100} tone={player.hull < 35 ? "red" : "gold"} label="Player hull" /></section>
      <section><span>Sails</span><strong>{Math.round(player.sails)}</strong><Meter value={player.sails} tone={player.sails < 40 ? "red" : "gold"} label="Sails" /></section>
      <section><span>Flood</span><strong>{Math.round(player.flood)}</strong><Meter value={player.flood} tone="blue" label="Flooding" /></section>
      <section><span>Fire</span><strong>{Math.round(player.fire)}</strong><Meter value={player.fire} tone="red" label="Fire" /></section>
      <section>
        <span>Armor</span>
        <strong>{enemy.identified ? Math.round(enemy.hull) : "??"}</strong>
        <Meter value={enemy.identified ? (enemy.hull / (enemy.maxHull || 100)) * 100 : 100} tone="red" label="Mech armor" />
      </section>
      <section>
        <span>Guns</span>
        <strong>{enemy.identified ? Math.round(enemy.weapons ?? 100) : "??"}</strong>
        <Meter value={enemy.identified ? (enemy.weapons ?? 100) : 100} tone="gold" label="Mech weapons" />
      </section>
    </div>
  );
}

function CombatLog() {
  const log = useGameStore((state) => state.log);
  return (
    <ol className="combat-log" aria-live="polite">
      {log.slice(0, 4).map((entry) => <li key={entry.id} className={entry.tone}>{entry.text}</li>)}
    </ol>
  );
}

function BattleOutcome() {
  const battleState = useGameStore((state) => state.battleState);
  const battleSummary = useGameStore((state) => state.battleSummary);
  const returnToChart = useGameStore((state) => state.returnToChart);
  const resetVoyage = useGameStore((state) => state.resetVoyage);
  if (battleState === "engaged") return null;
  const victory = battleState === "victory";
  const escaped = battleState === "escaped";
  return (
    <div className="modal-backdrop battle-outcome">
      <section className="encounter-card">
        <span className="encounter-seal">{victory ? <Sword weight="fill" /> : escaped ? <Wind weight="fill" /> : <Drop weight="fill" />}</span>
        <p className="eyebrow">{victory ? "Mech down" : escaped ? "Fog closes astern" : "The last bell"}</p>
        <h3>{victory ? "The war-mech is silenced" : escaped ? "The Wayward Gull escapes" : "Your vessel is lost"}</h3>
        <p>
          {victory
            ? "Salvage what you can from the wreckage, tend the wounded, and choose the next course."
            : escaped
              ? "The crew lives to fight another day, though the damage remains."
              : "The sea takes ship, cargo, and every unfinished order."}
        </p>
        {battleSummary && battleState !== "defeat" && (
          <dl className="outcome-summary">
            <div><dt>Supplies</dt><dd>+{battleSummary.suppliesGained} crates</dd></div>
            <div><dt>Hull patched</dt><dd>+{battleSummary.hullRepaired}</dd></div>
            <div><dt>Canvas mended</dt><dd>+{battleSummary.sailsRepaired}</dd></div>
            <div><dt>Hull remaining</dt><dd>{battleSummary.hullLeft}%</dd></div>
          </dl>
        )}
        <button className="primary-cta compact" onClick={battleState === "defeat" ? resetVoyage : returnToChart}>
          <CompassRose weight="fill" />
          <span>
            <strong>{battleState === "defeat" ? "Begin another voyage" : battleSummary?.elite && victory ? "Claim the channel" : "Return to chart"}</strong>
            <small>{battleState === "defeat" ? "The sea remembers" : "Choose the next waters"}</small>
          </span>
        </button>
      </section>
    </div>
  );
}

export function CombatScreen() {
  const player = useGameStore((state) => state.player);
  const enemy = useGameStore((state) => state.enemy);
  const crew = useGameStore((state) => state.crew);
  const volleys = useGameStore((state) => state.volleys);
  const tick = useGameStore((state) => state.tick);
  const resetVoyage = useGameStore((state) => state.resetVoyage);
  const lookoutManned = crew.some((person) => !person.target && person.location === "lookout" && person.health > 0);

  useEffect(() => {
    let frame;
    let lastTick = 0;
    const loop = (time) => {
      if (!lastTick || time - lastTick >= MAX_FRAME_INTERVAL - 0.5) {
        tick((time - lastTick || MAX_FRAME_INTERVAL) / 1000);
        lastTick = time;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [tick]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        useGameStore.getState().togglePause();
      }
      if (event.key === "f" || event.key === "F") useGameStore.getState().fireBroadside();
      if (["1", "2", "3"].includes(event.key)) useGameStore.getState().setTimeScale(Number(event.key));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <section className="combat-screen screen">
      <div className="scene-layer"><OceanScene player={player} enemy={enemy} crew={crew} volleys={volleys} fogDense={!lookoutManned} /></div>
      <div className={`fog-overlay ${lookoutManned ? "clear" : "dense"}`} />

      <VesselPlate />
      <div className="encounter-banner"><small>Encounter</small><strong><Sword weight="fill" /> {enemy.elite ? "Siege mech" : "Mech in range"}</strong></div>
      <VesselPlate enemy />

      <CrewPanel />
      <PauseBanner />

      <div className="view-buttons">
        <button onClick={() => window.dispatchEvent(new Event("rogue-seas-reset-camera"))}><Stack weight="duotone" /><span><small>Camera</small><strong>Reset view</strong></span></button>
        <button><GridFour weight="duotone" /><span><small>Movement</small><strong>WASD + drag</strong></span></button>
        <button onClick={resetVoyage}><ArrowCounterClockwise /><strong>Reset voyage</strong></button>
      </div>

      <TimeControls />
      <CombatAlerts />
      <ShipReadouts />
      <CombatLog />
      <div className="combat-control-dock"><GunneryControls /><HelmControls /></div>
      <CompassRose className="combat-compass" weight="duotone" />
      <div className="camera-hint"><Eye /> WASD to move <i /> Drag to look <i /> Scroll to zoom <i /> R resets <i /> Space pauses <i /> F fires</div>
      <BattleOutcome />
    </section>
  );
}
