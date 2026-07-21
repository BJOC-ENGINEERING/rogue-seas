import { ChartScreen } from "./components/ChartScreen";
import { CombatScreen } from "./components/CombatScreen";
import { TitleScreen } from "./components/TitleScreen";
import { useGameStore } from "./store";

export function App() {
  const screen = useGameStore((state) => state.screen);

  return (
    <main className="game-shell" data-screen={screen}>
      {screen === "title" && <TitleScreen />}
      {screen === "chart" && <ChartScreen />}
      {screen === "combat" && <CombatScreen />}
    </main>
  );
}
