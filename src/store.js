import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ENEMY_MECH,
  MECH_GUNS,
  PLAYER_SHIP,
  PORT_GUNS,
  STARBOARD_GUNS,
  facingBattery,
  localToWorld,
} from "./battleLayout";
import {
  ammoData,
  chartNodes,
  makeCrew,
  makeEnemyMech,
  makePlayerShip,
  stationData,
} from "./gameData";

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const nowId = () => `${Date.now()}-${Math.round(Math.random() * 10000)}`;

const initialLog = [
  { id: "welcome", tone: "neutral", text: "War-mech sighted through the fog. Beat to quarters." },
];

function manningCount(crew, stationId) {
  return crew.filter((person) => person.health > 0 && !person.target && person.location === stationId).length;
}

function addLog(log, text, tone = "neutral") {
  return [{ id: nowId(), text, tone }, ...log].slice(0, 8);
}

function playerYaw(heading = 0) {
  return PLAYER_SHIP.yaw + heading * 0.004;
}

function overshootPoint(from, to, extra = 4.5) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return [
    to[0] + (dx / len) * extra,
    Math.max(0.2, to[1] + (dy / len) * extra * 0.35),
    to[2] + (dz / len) * extra,
  ];
}

function aimJitter(point, amount = 0.55) {
  return [
    point[0] + (Math.random() - 0.5) * amount,
    point[1] + (Math.random() - 0.5) * amount * 0.45,
    point[2] + (Math.random() - 0.5) * amount,
  ];
}

function buildPlayerVolley({ battery, heading, hit, ammoId, damage, targetSystem }) {
  const yaw = playerYaw(heading);
  const guns = battery === "port" ? PORT_GUNS : STARBOARD_GUNS;
  const mechCenter = [
    ENEMY_MECH.position[0],
    ENEMY_MECH.position[1] + 1.35,
    ENEMY_MECH.position[2],
  ];
  const shots = guns.map((local, index) => {
    const origin = localToWorld(local, PLAYER_SHIP.position, yaw, PLAYER_SHIP.scale);
    const aimed = aimJitter(mechCenter, hit ? 0.7 : 1.6);
    const destination = hit ? aimed : overshootPoint(origin, aimed, 5 + Math.random() * 3);
    return {
      id: `p-${nowId()}-${index}`,
      origin,
      destination,
      fireDelay: index * (0.07 + Math.random() * 0.045),
      duration: 0.72 + Math.random() * 0.28,
      arc: 1.55 + Math.random() * 0.7,
      kind: "cannon",
      fired: false,
      landed: false,
    };
  });

  return {
    id: nowId(),
    side: "player",
    battery,
    ammoId,
    targetSystem,
    hit,
    damage,
    shots,
    damageApplied: false,
    age: 0,
  };
}

function buildEnemyVolley({ hit, impact, events }) {
  const shipCenter = [
    PLAYER_SHIP.position[0],
    PLAYER_SHIP.position[1] + 0.95,
    PLAYER_SHIP.position[2],
  ];
  const guns = MECH_GUNS.slice(0, 2 + Math.floor(Math.random() * 3));
  const shots = guns.map((local, index) => {
    const origin = localToWorld(local, ENEMY_MECH.position, ENEMY_MECH.yaw, ENEMY_MECH.scale);
    const aimed = aimJitter(shipCenter, hit ? 0.85 : 2.1);
    const destination = hit ? aimed : overshootPoint(origin, aimed, 4 + Math.random() * 2.5);
    return {
      id: `e-${nowId()}-${index}`,
      origin,
      destination,
      fireDelay: index * (0.11 + Math.random() * 0.06),
      duration: 0.62 + Math.random() * 0.24,
      arc: 0.85 + Math.random() * 0.45,
      kind: "mech",
      fired: false,
      landed: false,
    };
  });

  return {
    id: nowId(),
    side: "enemy",
    hit,
    damage: { impact, events },
    shots,
    damageApplied: false,
    age: 0,
  };
}

function applyPlayerVolleyDamage(state, volley) {
  const { damage, hit, ammoId, targetSystem } = volley;
  if (!hit) {
    return {
      ...state,
      log: addLog(state.log, `${ammoData[ammoId].label} screams past the mech.`, "warning"),
    };
  }

  const nextEnemy = {
    ...state.enemy,
    hull: clamp(state.enemy.hull - damage.hull),
    mobility: clamp(state.enemy.mobility - damage.mobility),
    crew: clamp(state.enemy.crew - damage.crew),
    morale: clamp(state.enemy.morale - damage.crew * 0.45 - damage.hull * 0.18),
    fire: clamp(state.enemy.fire + (ammoId === "fire" ? 24 : 0)),
    identified: true,
  };
  const won = nextEnemy.hull <= 0 || nextEnemy.morale <= 0 || nextEnemy.crew <= 0 || nextEnemy.mobility <= 0;

  return {
    ...state,
    enemy: nextEnemy,
    battleState: won ? "victory" : state.battleState,
    log: addLog(
      state.log,
      won
        ? "The war-mech collapses into the surf. The field is yours."
        : `${ammoData[ammoId].label} hammers ${targetSystem}: ${Math.round(damage.hull)} armor damage.`,
      won ? "success" : "danger",
    ),
  };
}

function applyEnemyVolleyDamage(state, volley) {
  const { hit, damage } = volley;
  if (!hit) {
    return {
      ...state,
      log: addLog(state.log, "Mech shells fall astern as the Gull turns.", "success"),
    };
  }

  let nextPlayer = { ...state.player, hull: clamp(state.player.hull - damage.impact) };
  let nextCrew = state.crew;
  let nextLog = state.log;
  let shouldAutoPause = false;
  const events = damage.events || [];

  if (events.includes("fire")) {
    nextPlayer.fire = clamp(nextPlayer.fire + 16 + Math.random() * 16);
    shouldAutoPause = true;
  }
  if (events.includes("flood")) {
    nextPlayer.flood = clamp(nextPlayer.flood + 14 + Math.random() * 14);
    shouldAutoPause = true;
  }
  if (events.includes("sails")) {
    nextPlayer.sails = clamp(nextPlayer.sails - 12 - Math.random() * 12);
  }
  if (events.includes("crew")) {
    const exposedCrew = nextCrew.filter((person) => person.health > 0 && person.location !== "surgeon");
    if (exposedCrew.length) {
      const injured = exposedCrew[Math.floor(Math.random() * exposedCrew.length)];
      nextCrew = nextCrew.map((person) =>
        person.id === injured.id
          ? { ...person, health: clamp(person.health - 18 - Math.random() * 22), status: "Wounded at station" }
          : person,
      );
      nextLog = addLog(nextLog, `${injured.name} is wounded by flying splinters!`, "danger");
      shouldAutoPause = true;
    } else {
      nextLog = addLog(nextLog, `Mech battery lands—${Math.round(damage.impact)} hull damage.`, "danger");
    }
  } else {
    nextLog = addLog(nextLog, `Mech battery lands—${Math.round(damage.impact)} hull damage.`, "danger");
  }

  let battleState = state.battleState;
  if (nextPlayer.hull <= 0 || nextPlayer.flood >= 100 || nextCrew.every((person) => person.health <= 0)) {
    battleState = "defeat";
  }

  return {
    ...state,
    player: nextPlayer,
    crew: nextCrew,
    log: nextLog,
    battleState,
    paused: battleState === "engaged" ? shouldAutoPause || state.paused : true,
  };
}

function advanceVolleys(state, delta) {
  if (!state.volleys.length) return state;

  let next = state;
  const remaining = [];

  for (const volley of state.volleys) {
    const age = volley.age + delta;
    const shots = volley.shots.map((shot) => {
      const fired = age >= shot.fireDelay;
      const landed = age >= shot.fireDelay + shot.duration;
      return { ...shot, fired, landed };
    });

    let working = { ...volley, age, shots };
    const anyLanded = shots.some((shot) => shot.landed);
    if (anyLanded && !working.damageApplied) {
      working = { ...working, damageApplied: true };
      next = working.side === "player"
        ? applyPlayerVolleyDamage(next, working)
        : applyEnemyVolleyDamage(next, working);
    }

    if (!shots.every((shot) => shot.landed)) {
      remaining.push(working);
    }
  }

  return { ...next, volleys: remaining };
}

function resetCombatState() {
  return {
    crew: makeCrew(),
    player: makePlayerShip(),
    enemy: makeEnemyMech(),
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
    volleys: [],
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
    if (state.volleys.some((volley) => volley.side === "player" && !volley.damageApplied)) {
      set((current) => ({ log: addLog(current.log, "Battery still firing—hold the order.", "warning") }));
      return;
    }
    if (state.player.reload > 0) {
      set((current) => ({ log: addLog(current.log, `Broadside reloading—${Math.ceil(current.player.reload)} seconds.`, "warning") }));
      return;
    }

    const portCrew = manningCount(state.crew, "portGuns");
    const starboardCrew = manningCount(state.crew, "starboardGuns");
    const gunCrew = portCrew + starboardCrew;
    if (!gunCrew) {
      set((current) => ({ log: addLog(current.log, "Gun decks unmanned—no broadside available.", "warning") }));
      return;
    }

    const preferred = facingBattery(playerYaw(state.player.heading));
    let battery = preferred;
    if (preferred === "port" && !portCrew && starboardCrew) battery = "starboard";
    if (preferred === "starboard" && !starboardCrew && portCrew) battery = "port";

    const lookoutBonus = manningCount(state.crew, "lookout") ? 1 : 0.72;
    const distancePenalty = state.player.distance > 72 ? 0.72 : 1;
    const hitChance = 0.64 + Math.min(gunCrew, 3) * 0.08;
    // Opening volley always lands so a new player sees the Empire-style ripple.
    const hit = state.shotsFired === 0 || Math.random() < hitChance * lookoutBonus * distancePenalty;
    const ammo = ammoData[state.ammo];

    const targetModifier = state.targetSystem === "hull" ? 1.1 : 0.88;
    const damageSpread = 0.86 + Math.random() * 0.28;
    let hullDamage = ammo.hull * targetModifier * damageSpread;
    let mobilityDamage = ammo.mobility * damageSpread;
    let crewDamage = ammo.crew * damageSpread;

    if (state.targetSystem === "mobility") mobilityDamage *= 1.45;
    if (state.targetSystem === "weapons") hullDamage *= 0.8;
    if (state.targetSystem === "crew") crewDamage *= 1.5;

    const volley = buildPlayerVolley({
      battery,
      heading: state.player.heading,
      hit,
      ammoId: state.ammo,
      targetSystem: state.targetSystem,
      damage: { hull: hullDamage, mobility: mobilityDamage, crew: crewDamage },
    });

    set((current) => ({
      player: { ...current.player, reload: ammo.reload / Math.max(1, gunCrew * 0.68) },
      shotsFired: current.shotsFired + 1,
      volleys: [...current.volleys, volley],
      log: addLog(
        current.log,
        hit
          ? `${battery === "port" ? "Port" : "Starboard"} battery opens on the mech!`
          : `${battery === "port" ? "Port" : "Starboard"} battery fires—shot flies wild.`,
        hit ? "danger" : "warning",
      ),
    }));
  },

  attemptRetreat: () => {
    const state = get();
    const sailsManned = manningCount(state.crew, "sails");
    const chance = 0.16 + sailsManned * 0.18 + state.player.sails / 250;
    if (Math.random() < chance) {
      set((current) => ({
        battleState: "escaped",
        volleys: [],
        log: addLog(current.log, "The Wayward Gull disappears into the fog.", "success"),
      }));
    } else {
      set((current) => ({ log: addLog(current.log, "The mech tracks our turn. We cannot break away yet.", "warning") }));
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
      volleys: [],
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
    let nextEnemy = {
      ...state.enemy,
      fire: enemyFire,
      hull: enemyHull,
      identified: state.enemy.identified || lookout > 0,
      name: state.enemy.identified || lookout > 0 ? "Iron Leviathan" : state.enemy.name,
    };
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

    let nextVolleys = state.volleys;
    if (enemyTimer <= 0 && nextEnemy.hull > 0 && !state.volleys.some((volley) => volley.side === "enemy" && !volley.damageApplied)) {
      const evasion = clamp(0.05 + Math.abs(nextPlayer.heading) / 250 + nextPlayer.throttle * 0.035, 0.05, 0.38);
      const hit = Math.random() > evasion;
      enemyTimer = Math.max(3.8, 7.4 - (100 - nextEnemy.crew) / 35) + Math.random() * 2;

      const impact = 7 + Math.random() * 8;
      const events = [];
      if (hit) {
        const eventRoll = Math.random();
        if (eventRoll < 0.34) events.push("fire");
        else if (eventRoll < 0.69) events.push("flood");
        else events.push("sails");
        if (Math.random() < 0.48) events.push("crew");
      }

      const volley = buildEnemyVolley({ hit, impact, events });
      nextVolleys = [...nextVolleys, volley];
      nextLog = addLog(nextLog, hit ? "The mech's gun pods ignite!" : "The mech fires—shells go wide.", hit ? "danger" : "warning");
    }

    let working = {
      ...state,
      crew: nextCrew,
      player: nextPlayer,
      enemy: nextEnemy,
      enemyVolleyTimer: enemyTimer,
      elapsed: state.elapsed + delta,
      log: nextLog,
      volleys: nextVolleys,
    };

    working = advanceVolleys(working, delta);

    if (working.enemy.hull <= 0 || working.enemy.morale <= 0 || working.enemy.crew <= 0 || working.enemy.mobility <= 0) {
      working = { ...working, battleState: "victory", paused: true };
    }
    if (working.player.hull <= 0 || working.player.flood >= 100 || working.crew.every((person) => person.health <= 0)) {
      working = { ...working, battleState: "defeat", paused: true };
    }

    set({
      crew: working.crew,
      player: working.player,
      enemy: working.enemy,
      enemyVolleyTimer: working.enemyVolleyTimer,
      elapsed: working.elapsed,
      log: working.log,
      battleState: working.battleState,
      paused: working.paused,
      volleys: working.volleys,
    });
  },
}), {
  name: "rogue-seas-voyage",
  version: 2,
  partialize: (state) => ({
    chartNode: state.chartNode,
    visitedNodes: state.visitedNodes,
    selectedChartNode: state.selectedChartNode,
    voyageNumber: state.voyageNumber,
  }),
}));
