import {
  Anchor,
  ArrowCounterClockwise,
  CompassRose,
  FlagBanner,
  MapPin,
  Skull,
  Waves,
  X,
} from "@phosphor-icons/react";
import { chartNodes, encounterCopy } from "../gameData";
import { useGameStore } from "../store";

const nodeIcons = {
  start: Anchor,
  combat: Skull,
  storm: Waves,
  port: MapPin,
  elite: FlagBanner,
};

function RouteLines() {
  const lines = [];
  chartNodes.forEach((node) => {
    node.links.forEach((targetId) => {
      const target = chartNodes.find((item) => item.id === targetId);
      if (!target) return;
      const dx = target.x - node.x;
      const dy = target.y - node.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      lines.push(
        <span
          className="route-line"
          key={`${node.id}-${target.id}`}
          style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${length}%`, transform: `rotate(${angle}deg)` }}
        />,
      );
    });
  });
  return lines;
}

function hullLabel(hull) {
  if (hull >= 85) return "Sound";
  if (hull >= 60) return "Scarred";
  if (hull >= 35) return "Breached";
  return "Critical";
}

export function ChartScreen() {
  const chartNode = useGameStore((state) => state.chartNode);
  const selectedChartNode = useGameStore((state) => state.selectedChartNode);
  const visitedNodes = useGameStore((state) => state.visitedNodes);
  const encounterOpen = useGameStore((state) => state.encounterOpen);
  const player = useGameStore((state) => state.player);
  const battleSummary = useGameStore((state) => state.battleSummary);
  const selectChartNode = useGameStore((state) => state.selectChartNode);
  const sailToSelectedNode = useGameStore((state) => state.sailToSelectedNode);
  const closeEncounter = useGameStore((state) => state.closeEncounter);
  const startEncounter = useGameStore((state) => state.startEncounter);
  const resetVoyage = useGameStore((state) => state.resetVoyage);

  const current = chartNodes.find((node) => node.id === chartNode);
  const selected = chartNodes.find((node) => node.id === selectedChartNode) || current;
  const canSail = current?.links.includes(selected?.id);
  const copy = encounterCopy[selected?.type] || encounterCopy.combat;
  const stuckAtEnd = current?.type === "elite" && !current.links?.length && visitedNodes.includes(current.id);

  return (
    <section className="chart-screen screen">
      <header className="chart-header">
        <div>
          <p className="eyebrow">The Wayward Gull</p>
          <h2>Captain&apos;s Chart</h2>
        </div>
        <div className="chart-current">
          <small>Current waters</small>
          <strong>{current?.name}</strong>
        </div>
        <button className="utility-button" onClick={resetVoyage}>
          <ArrowCounterClockwise /> Reset voyage
        </button>
      </header>

      <div className="chart-layout">
        <div className="chart-frame">
          <div className="chart-paper">
            <RouteLines />
            {chartNodes.map((node) => {
              const Icon = nodeIcons[node.type];
              const reachable = current?.links.includes(node.id);
              const active = node.id === chartNode;
              const selectedState = node.id === selectedChartNode;
              const visited = visitedNodes.includes(node.id);
              return (
                <button
                  key={node.id}
                  className={`chart-node ${node.type} ${active ? "active" : ""} ${reachable ? "reachable" : ""} ${selectedState ? "selected" : ""} ${visited ? "visited" : ""}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  onClick={() => selectChartNode(node.id)}
                  disabled={!reachable && !active}
                  aria-label={`${node.name}: ${node.description}`}
                >
                  <span><Icon weight="fill" /></span>
                  <strong>{node.name}</strong>
                </button>
              );
            })}
            <CompassRose className="chart-compass" weight="duotone" />
          </div>
        </div>

        <aside className="chart-briefing ink-panel">
          <p className="eyebrow">Selected course</p>
          <h3>{selected?.name}</h3>
          <p>{selected?.description}</p>
          <dl>
            <div><dt>Waters</dt><dd>{selected?.type}</dd></div>
            <div><dt>Hull</dt><dd>{hullLabel(player.hull)} · {Math.round(player.hull)}%</dd></div>
            <div><dt>Sails</dt><dd>{Math.round(player.sails)}%</dd></div>
            <div><dt>Supplies</dt><dd>{Math.round(player.supplies)} crates</dd></div>
          </dl>
          {battleSummary?.outcome === "victory" && battleSummary.suppliesGained > 0 && (
            <p className="briefing-note">Last fight yielded +{battleSummary.suppliesGained} supplies and light repairs.</p>
          )}
          {stuckAtEnd ? (
            <button className="primary-cta compact" onClick={resetVoyage}>
              <FlagBanner weight="fill" />
              <span><strong>Voyage complete</strong><small>Begin another run</small></span>
            </button>
          ) : (
            <button className="primary-cta compact" disabled={!canSail} onClick={sailToSelectedNode}>
              <Anchor weight="fill" />
              <span><strong>{selected?.type === "port" ? "Make port" : "Sail onward"}</strong><small>{canSail ? "Commit to this course" : "Choose a connected route"}</small></span>
            </button>
          )}
        </aside>
      </div>

      <button className="primary-cta compact mobile-sail-button" disabled={!canSail || stuckAtEnd} onClick={sailToSelectedNode}>
        <Anchor weight="fill" />
        <span><strong>{selected?.type === "port" ? "Make port" : "Sail onward"}</strong><small>{selected?.name}</small></span>
      </button>

      {encounterOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="encounter-card" role="dialog" aria-modal="true" aria-labelledby="encounter-title">
            <button className="modal-close" onClick={closeEncounter} aria-label="Close encounter"><X /></button>
            <span className="encounter-seal">{selected?.type === "storm" ? <Waves weight="fill" /> : selected?.type === "elite" ? <FlagBanner weight="fill" /> : <Skull weight="fill" />}</span>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h3 id="encounter-title">{copy.title}</h3>
            <p>{copy.body}</p>
            <button className="primary-cta compact" onClick={startEncounter}>
              <FlagBanner weight="fill" />
              <span><strong>{copy.fight}</strong><small>{copy.detail}</small></span>
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
