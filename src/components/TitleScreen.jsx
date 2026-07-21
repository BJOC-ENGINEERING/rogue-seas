import { Anchor, Play } from "@phosphor-icons/react";
import { OceanScene } from "./OceanScene";
import { useGameStore } from "../store";

export function TitleScreen() {
  const beginVoyage = useGameStore((state) => state.beginVoyage);

  return (
    <section className="title-screen screen">
      <div className="title-atmosphere" />
      <div className="title-copy">
        <p className="eyebrow">An age-of-sail gunnery roguelike</p>
        <h1>
          <span>Rogue</span>
          Seas
        </h1>
        <div className="title-rule"><Anchor weight="fill" /></div>
        <p className="title-tagline">Chart the unknown. Command your crew. Break the mechs with cannon fire.</p>
        <button className="primary-cta" onClick={beginVoyage}>
          <Play weight="fill" />
          <span>
            <strong>Begin voyage</strong>
            <small>Set sail for dangerous waters</small>
          </span>
        </button>
      </div>
      <div className="title-diorama" aria-label="The Wayward Gull sailing at night">
        <OceanScene variant="title" />
      </div>
      <p className="prototype-stamp">First sailing prototype</p>
    </section>
  );
}
