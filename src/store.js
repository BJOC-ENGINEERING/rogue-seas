import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ammoData,
  chartNodes,
  makeCrew,
  makeEnemyShip,
  makePlayerShip,
  stationData,
} from "./gameData";

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const nowId = () => `${Date.now()}-${Math.round(Math.random() * 10000)}`;

const initialLog = [
  { id: "welcome", tone: "neutral", text: "Enemy sighted through the fog. Beat to quarters." },
];

function manningCount(crew, stationId) {
  return crew.filter((person) => person.health > 0 && !person.target && person.location === stationId).length;
}

function addLog(log, text, tone = "neutral") {
  return [{ id: nowId(), text, tone }, ...log].slice(0, 8);
}

function resetCombatState() {
  return {
    crew: makeCrew(),
    player: makePlayerShip(),
    enemy: makeEnemyShip(),
    selectedCrewId: "mara",
    ammo: "round",
    targetSystem: "hull",
    battleState: "engaged",
    paused: false,
    timeScale: 1,
    log: initialLog,
    enemyVolleyTimer: 5.5,
    elapsed: 0,
    shotsFired: 0,
  };
}

export const useGameStore = create(persist((set, get) => ({
  screen: "title",
  chartNode: "calm-reach",
  visitedNodes: ["calm-reach"],
  selectedChartNode: "blackwater",
  encounterOpen: false,
  voyageNumber: 1,
  ...resetCombatState(),

  beginVoyage: () => set({ screen: "chart", encounterOpen: false }),

  resetVoyage: () =>
    set({
      screen: "title",
      chartNode: "calm-reach",
      visitedNodes: ["calm-reach"],
      selectedChartNode: "blackwater",
      encounterOpen: false,
      voyageNumber: get().voyageNumber + 1,
      ...resetCombatState(),
    }),

  selectChartNode: (nodeId) => {
    const state = get();
    const current = chartNodes.find((node) => node.id === state.chartNode);
    if (!current?.links.includes(nodeId) && nodeId !== state.chartNode) return;
    set({ selectedChartNode: nodeId });
  },

  sailToSelectedNode: () => {
    const { selectedChartNode, chartNode } = get();
    if (selectedChartNode === chartNode) return;
    const node = chartNodes.find((item) => item.id === selectedChartNode);
    if (!node) return;

    if (node.type === "port") {
      set((state) => ({
        chartNode: node.id,
        visitedNodes: [...new Set([...state.visitedNodes, node.id])],
        encounterOpen: false,
        player: { ...state.player, hull: 100, sails: 100, supplies: state.player.supplies + 8 },
      }));
      return;
    }

    set({ encounterOpen: true });
  },

  closeEncounter: () => set({ encounterOpen: false }),

  startEncounter: () =>
    set((state) => ({
      screen: "combat",
      encounterOpen: false,
      ...resetCombatState(),
      voyageNumber: state.voyageNumber,
    })),

  selectCrew: (crewId) => set({ selectedCrewId: crewId }),

  assignSelectedCrew: (stationId) => {
    const state = get();
    const station = stationData[stationId];
    if (!station || state.battleState !== "engaged") return;
    set((current) => ({
      crew: current.crew.map((person) =>
        person.id === current.selectedCrewId && person.health > 0
          ? {
              ...person,
              target: stationId,
              moveProgress: 0,
              status: `Moving to ${station.label}`,
            }
          : person,
      ),
      log: addLog(current.log, `${current.crew.find((person) => person.id === current.selectedCrewId)?.name} ordered to ${station.label}.`),
    }));
  },

  standDownSelected: () => {
    set((state) => ({
      crew: state.crew.map((person) =>
        person.id === state.selectedCrewId
          ? { ...person, target: null, location: "deck", moveProgress: 0, status: "Ready on deck" }
          : person,
      ),
    }));
  },

  setAmmo: (ammo) => {
    if (ammoData[ammo]) set({ ammo });
  },
  setTargetSystem: (targetSystem) => set({ targetSystem }),
  setTimeScale: (timeScale) => set({ timeScale, paused: false }),
  togglePause: () => set((state) => ({ paused: !state.paused })),

  setThrottle: (throttle) => {
    const sailsManned = manningCount(get().crew, "sails");
    if (!sailsManned && throttle > get().player.throttle) {
      set((state) => ({ log: addLog(state.log, "Sails unmanned—assign crew before increasing speed.", "warning") }));
      return;
    }
    set((state) => ({ player: { ...state.player, throttle } }));
  },

  turnHelm: (direction) => {
    const helmManned = manningCount(get().crew, "helm");
    if (!helmManned) {
      set((state) => ({ log: addLog(state.log, "Wheel unmanned—the ship will not answer the helm.", "warning") }));
      return;
    }
    set((state) => ({
      player: {
        ...state.player,
        heading: clamp(state.player.heading + direction * 12, -90, 90),
      },
    }));
  },

  centerHelm: () => set((state) => ({ player: { ...state.player, heading: 0 } })),

  fireBroadside: () => {
    const state = get();
    if (state.battleState !== "engaged" || state.paused) return;
    if (state.player.reload > 0) {
      set((current) => ({ log: addLog(current.log, `Broadside reloading—${Math.ceil(current.player.reload)} seconds.`, "warning") }));
      return;
    }

    const gunCrew = manningCount(state.crew, "portGuns") + manningCount(state.crew, "starboardGuns");
    if (!gunCrew) {
      set((current) => ({ log: addLog(current.log, "Gun decks unmanned—no broadside available.", "warning") }));
      return;
    }

    const lookoutBonus = manningCount(state.crew, "lookout") ? 1 : 0.72;
    const distancePenalty = state.player.distance > 72 ? 0.72 : 1;
    const hitChance = 0.64 + Math.min(gunCrew, 3) * 0.08;
    // The opening volley always lands so a new player immediately sees the
    // target/damage/reload loop. Later shots use the live accuracy model.
    const hit = state.shotsFired === 0 || Math.random() < hitChance * lookoutBonus * distancePenalty;
    const ammo = ammoData[state.ammo];

    if (!hit) {
      set((current) => ({
        player: { ...current.player, reload: ammo.reload / Math.max(1, gunCrew * 0.68) },
        shotsFired: current.shotsFired + 1,
        log: addLog(current.log, `${ammo.label} whistles across the enemy bow.`, "warning"),
      }));
      return;
    }

    const targetModifier = state.targetSystem === "hull" ? 1.1 : 0.88;
    const damageSpread = 0.86 + Math.random() * 0.28;
    let hullDamage = ammo.hull * targetModifier * damageSpread;
    let sailDamage = ammo.sails * damageSpread;
    let crewDamage = ammo.crew * damageSpread;

    if (state.targetSystem === "sails") sailDamage *= 1.45;
    if (state.targetSystem === "weapons") hullDamage *= 0.8;
    if (state.targetSystem === "crew") crewDamage *= 1.5;

    const nextEnemy = {
      ...state.enemy,
      hull: clamp(state.enemy.hull - hullDamage),
      sails: clamp(state.enemy.sails - sailDamage),
      crew: clamp(state.enemy.crew - crewDamage),
      morale: clamp(state.enemy.morale - crewDamage * 0.45 - hullDamage * 0.18),
      fire: clamp(state.enemy.fire + (state.ammo === "fire" ? 24 : 0)),
      identified: state.enemy.identified || manningCount(state.crew, "lookout") > 0,
    };

    const won = nextEnemy.hull <= 0 || nextEnemy.morale <= 0 || nextEnemy.crew <= 0;
    set((current) => ({
      enemy: nextEnemy,
      player: { ...current.player, reload: ammo.reload / Math.max(1, gunCrew * 0.68) },
      shotsFired: current.shotsFired + 1,
      battleState: won ? "victory" : current.battleState,
      log: addLog(
        current.log,
        won
          ? "The enemy colours come down. The frigate is yours."
          : `${ammo.label} strikes ${state.targetSystem}: ${Math.round(hullDamage)} hull damage.`,
        won ? "success" : "danger",
      ),
    }));
  },

  attemptRetreat: () => {
    const state = get();
    const sailsManned = manningCount(state.crew, "sails");
    const chance = 0.16 + sailsManned * 0.18 + state.player.sails / 250;
    if (Math.random() < chance) {
      set((current) => ({ battleState: "escaped", log: addLog(current.log, "The Wayward Gull disappears into the fog.", "success") }));
    } else {
      set((current) => ({ log: addLog(current.log, "The frigate matches our turn. We cannot break away yet.", "warning") }));
    }
  },

  returnToChart: () => {
    const state = get();
    const destination = state.selectedChartNode;
    set((current) => ({
      screen: "chart",
      chartNode: destination,
      visitedNodes: [...new Set([...current.visitedNodes, destination])],
      encounterOpen: false,
      battleState: "engaged",
    }));
  },

  tick: (rawDelta) => {
    const state = get();
    if (state.screen !== "combat" || state.paused || state.battleState !== "engaged") return;

    const delta = Math.min(rawDelta, 0.5) * state.timeScale;
    let nextCrew = state.crew.map((person) => {
      if (!person.target || person.health <= 0) return person;
      const speed = person.specialty === stationData[person.target]?.specialty ? 0.34 : 0.25;
      const progress = person.moveProgress + delta * speed;
      if (progress >= 1) {
        return {
          ...person,
          location: person.target,
          target: null,
          moveProgress: 0,
          status: `Manning ${stationData[person.target]?.label}`,
        };
      }
      return { ...person, moveProgress: progress };
    });

    const pumps = manningCount(nextCrew, "pumps");
    const firefighters = manningCount(nextCrew, "fire");
    const leakCrew = manningCount(nextCrew, "leak");
    const carpenter = manningCount(nextCrew, "carpenter");
    const surgeon = manningCount(nextCrew, "surgeon");
    const lookout = manningCount(nextCrew, "lookout");

    let playerFire = clamp(state.player.fire - firefighters * 4.8 * delta);
    let playerFlood = clamp(state.player.flood + Math.max(0, state.player.flood > 0 ? 0.6 - pumps * 1.45 - leakCrew * 1.1 : 0) * delta);
    if (pumps > 0) playerFlood = clamp(playerFlood - pumps * 2.2 * delta);
    let playerHull = clamp(state.player.hull - playerFire * 0.0045 * delta + carpenter * 0.12 * delta, 0, state.player.maxHull);
    const enemyFire = clamp(state.enemy.fire - 0.9 * delta);
    const enemyHull = clamp(state.enemy.hull - enemyFire * 0.01 * delta);
    const playerReload = Math.max(0, state.player.reload - delta);
    let enemyTimer = state.enemyVolleyTimer - delta;
    let nextLog = state.log;
    let shouldAutoPause = false;
    let nextEnemy = { ...state.enemy, fire: enemyFire, hull: enemyHull, identified: state.enemy.identified || lookout > 0 };
    let nextPlayer = {
      ...state.player,
      hull: playerHull,
      fire: playerFire,
      flood: playerFlood,
      reload: playerReload,
      distance: clamp(state.player.distance + (1 - state.player.throttle) * 0.06 * delta - state.player.throttle * 0.09 * delta, 28, 95),
    };

    if (surgeon > 0) {
      nextCrew = nextCrew.map((person) => ({
        ...person,
        health: person.health > 0 ? clamp(person.health + surgeon * 0.42 * delta) : person.health,
      }));
    }

    if (enemyTimer <= 0 && nextEnemy.hull > 0) {
      const evasion = clamp(0.05 + Math.abs(nextPlayer.heading) / 250 + nextPlayer.throttle * 0.035, 0.05, 0.38);
      const hit = Math.random() > evasion;
      enemyTimer = Math.max(3.8, 7.4 - (100 - nextEnemy.crew) / 35) + Math.random() * 2;

      if (hit) {
        const impact = 7 + Math.random() * 8;
        nextPlayer.hull = clamp(nextPlayer.hull - impact);
        const eventRoll = Math.random();
        if (eventRoll < 0.34) {
          nextPlayer.fire = clamp(nextPlayer.fire + 16 + Math.random() * 16);
          shouldAutoPause = true;
        } else if (eventRoll < 0.69) {
          nextPlayer.flood = clamp(nextPlayer.flood + 14 + Math.random() * 14);
          shouldAutoPause = true;
        }
        else nextPlayer.sails = clamp(nextPlayer.sails - 12 - Math.random() * 12);

        const exposedCrew = nextCrew.filter((person) => person.health > 0 && person.location !== "surgeon");
        if (exposedCrew.length && Math.random() < 0.48) {
          const injured = exposedCrew[Math.floor(Math.random() * exposedCrew.length)];
          nextCrew = nextCrew.map((person) =>
            person.id === injured.id
              ? { ...person, health: clamp(person.health - 18 - Math.random() * 22), status: "Wounded at station" }
              : person,
          );
          nextLog = addLog(nextLog, `${injured.name} is wounded by flying splinters!`, "danger");
          shouldAutoPause = true;
        } else {
          nextLog = addLog(nextLog, `Enemy broadside lands—${Math.round(impact)} hull damage.`, "danger");
        }
      } else {
        nextLog = addLog(nextLog, "Enemy broadside falls astern as the Gull turns.", "success");
      }
    }

    let battleState = state.battleState;
    if (nextEnemy.hull <= 0 || nextEnemy.morale <= 0 || nextEnemy.crew <= 0) battleState = "victory";
    if (nextPlayer.hull <= 0 || nextPlayer.flood >= 100 || nextCrew.every((person) => person.health <= 0)) battleState = "defeat";

    set({
      crew: nextCrew,
      player: nextPlayer,
      enemy: nextEnemy,
      enemyVolleyTimer: enemyTimer,
      elapsed: state.elapsed + delta,
      log: nextLog,
      battleState,
      paused: battleState === "engaged" ? shouldAutoPause : true,
    });
  },
}), {
  name: "rogue-seas-voyage",
  version: 1,
  partialize: (state) => ({
    chartNode: state.chartNode,
    visitedNodes: state.visitedNodes,
    selectedChartNode: state.selectedChartNode,
    voyageNumber: state.voyageNumber,
  }),
}));
