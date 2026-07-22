import { Anchor, CompassRose, FlagBanner } from "@phosphor-icons/react";
import { useGameStore } from "../store";
import { OceanScene } from "./OceanScene";

export function VictoryScreen() {
  const resetVoyage = useGameStore((state) => state.resetVoyage);
  const player = useGameStore((state) => state.player);
  const voyageNumber = useGameStore((state) => state.voyageNumber);
  const battleSummary = useGameStore((state) => state.battleSummary);

  return (
    <section className="victory-screen screen">
      <div className="title-atmosphere" />
      <div className="victory-copy">
        <p className="eyebrow">Voyage {voyageNumber} complete</p>
        <h1>
          <span>Channel</span>
          Cleared
        </h1>
        <div className="title-rule"><FlagBanner weight="fill" /></div>
        <p className="title-tagline">
          The Red Bastion sinks beneath the shoals. The Wayward Gull holds {Math.round(player.hull)}% hull,
          {Math.round(player.supplies)} crates, and a crew that still answers the bell.
        </p>
        {battleSummary && (
          <dl className="outcome-summary victory-summary">
            <div><dt>Final foe</dt><dd>{battleSummary.enemyName}</dd></div>
            <div><dt>Hull left</dt><dd>{battleSummary.hullLeft}%</dd></div>
            <div><dt>Wounded</dt><dd>{battleSummary.wounded}</dd></div>
            <div><dt>Salvage</dt><dd>+{battleSummary.suppliesGained} crates</dd></div>
          </dl>
        )}
        <button className="primary-cta" onClick={resetVoyage}>
          <CompassRose weight="fill" />
          <span>
            <strong>Chart another voyage</strong>
            <small>The sea never stays cleared</small>
          </span>
        </button>
      </div>
      <div className="title-diorama" aria-label="The Wayward Gull after the bastion fight">
        <OceanScene variant="title" />
      </div>
      <p className="prototype-stamp"><Anchor weight="fill" /> Bastion broken</p>
    </section>
  );
}
