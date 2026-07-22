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

/** Count plus specialty match — specialists punch above a warm body. */
function stationPower(crew, stationId) {
  const stationed = crew.filter((person) => person.health > 0 && !person.target && person.location === stationId);
  const specialty = stationData[stationId]?.specialty;
  const specialists = stationed.filter((person) => person.specialty === specialty).length;
  return stationed.length + specialists * 0.55;
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
    hull: clamp(state.enemy.hull - damage.hull, 0, state.enemy.maxHull ?? 100),
    mobility: clamp(state.enemy.mobility - damage.mobility),
    crew: clamp(state.enemy.crew - damage.crew),
    weapons: clamp((state.enemy.weapons ?? 100) - (damage.weapons || 0)),
    morale: clamp(state.enemy.morale - damage.crew * 0.45 - damage.hull * 0.18),
    fire: clamp(state.enemy.fire + (ammoId === "fire" ? 24 : 0)),
    identified: true,
  };
  const won = nextEnemy.hull <= 0 || nextEnemy.morale <= 0 || nextEnemy.crew <= 0 || nextEnemy.mobility <= 0;

  let logText;
  if (won) {
    logText = "The war-mech collapses into the surf. The field is yours.";
  } else if (targetSystem === "weapons" && damage.weapons > 0) {
    logText = `${ammoData[ammoId].label} smashes weapon pods: batteries stutter.`;
  } else {
    logText = `${ammoData[ammoId].label} hammers ${targetSystem}: ${Math.round(damage.hull)} armor damage.`;
  }

  return {
    ...state,
    enemy: nextEnemy,
    battleState: won ? "victory" : state.battleState,
    log: addLog(state.log, logText, won ? "success" : "danger"),
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
  let pauseReason = state.pauseReason;
  const events = damage.events || [];

  if (events.includes("fire")) {
    nextPlayer.fire = clamp(nextPlayer.fire + 16 + Math.random() * 16);
    shouldAutoPause = true;
    pauseReason = "fire";
  }
  if (events.includes("flood")) {
    nextPlayer.flood = clamp(nextPlayer.flood + 14 + Math.random() * 14);
    shouldAutoPause = true;
    pauseReason = pauseReason === "fire" ? "fire" : "flood";
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
      pauseReason = pauseReason || "crew";
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
    pauseReason: battleState === "engaged" && shouldAutoPause ? pauseReason : state.pauseReason,
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

function buildBattleSummary(state, outcome) {
  const suppliesGained = outcome === "victory" ? 6 + Math.floor(Math.random() * 5) : outcome === "escaped" ? 0 : 0;
  const hullRepaired = outcome === "victory" ? 8 + Math.floor(Math.random() * 6) : 0;
  const sailsRepaired = outcome === "victory" ? 6 + Math.floor(Math.random() * 6) : 0;
  return {
    outcome,
    enemyName: state.enemy?.name || "War-Mech",
    elite: Boolean(state.enemy?.elite),
    suppliesGained,
    hullRepaired,
    sailsRepaired,
    hullLeft: Math.round(state.player.hull),
    wounded: state.crew.filter((person) => person.health > 0 && person.health < 70).length,
  };
}

function applyOutcomeRewards(player, summary) {
  if (!summary || summary.outcome === "defeat") return player;
  return {
    ...player,
    supplies: player.supplies + (summary.suppliesGained || 0),
    hull: clamp(player.hull + (summary.hullRepaired || 0), 0, player.maxHull),
    sails: clamp(player.sails + (summary.sailsRepaired || 0)),
    fire: 0,
    flood: clamp(player.flood - 8),
    morale: clamp(player.morale + (summary.outcome === "victory" ? 8 : 3)),
  };
}

function preserveCrewForNextFight(crew) {
  return crew.map((person) => ({
    ...person,
    target: null,
    moveProgress: 0,
    status: person.health <= 0
      ? "Out of action"
      : `Manning ${stationData[person.location]?.label ?? "deck"}`,
  }));
}

function softResetCombat(player, crew, { elite = false, storm = false } = {}) {
  const nextPlayer = {
    ...player,
    reload: 0,
    heading: 0,
    throttle: storm ? 1 : 2,
    distance: storm ? 70 : 62,
    fire: 0,
    flood: storm ? clamp(player.flood + 10 + Math.random() * 8) : clamp(player.flood * 0.35),
    sails: storm ? clamp(player.sails - 8 - Math.random() * 10) : player.sails,
  };

  const openingLines = storm
    ? [
        { id: "welcome", tone: "warning", text: "Gale winds shred the fog—mech guns flash between the rain." },
        { id: nowId(), tone: "danger", text: "Bilges are already wet. Assign pumps before the next shell." },
      ]
    : elite
      ? [
          { id: "welcome", tone: "danger", text: "Siege-mech sighted. Heavier armor. Hotter guns. No quarter." },
        ]
      : initialLog;

  return {
    crew: preserveCrewForNextFight(crew),
    player: nextPlayer,
    enemy: makeEnemyMech({ elite }),
    selectedCrewId: crew.find((person) => person.health > 0)?.id || "mara",
    ammo: "round",
    targetSystem: "hull",
    battleState: "engaged",
    paused: false,
    pauseReason: null,
    timeScale: 1,
    log: openingLines,
    enemyVolleyTimer: elite ? 3.8 : storm ? 4.6 : 5.5,
    elapsed: 0,
    shotsFired: 0,
    volleys: [],
    battleSummary: null,
    voyageComplete: false,
  };
}

function resetCombatState() {
  return softResetCombat(makePlayerShip(), makeCrew());
}

export const useGameStore = create(persist((set, get) => ({
  screen: "title",
  chartNode: "calm-reach",
  visitedNodes: ["calm-reach"],
  selectedChartNode: "blackwater",
  encounterOpen: false,
  voyageNumber: 1,
  voyageComplete: false,
  battleSummary: null,
  pauseReason: null,
  ...resetCombatState(),

  beginVoyage: () =>
    set({
      screen: "chart",
      chartNode: "calm-reach",
      visitedNodes: ["calm-reach"],
      selectedChartNode: "blackwater",
      encounterOpen: false,
      voyageComplete: false,
      battleSummary: null,
      ...resetCombatState(),
    }),

  resetVoyage: () =>
    set({
      screen: "title",
      chartNode: "calm-reach",
      visitedNodes: ["calm-reach"],
      selectedChartNode: "blackwater",
      encounterOpen: false,
      voyageNumber: get().voyageNumber + 1,
      voyageComplete: false,
      battleSummary: null,
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
        player: {
          ...state.player,
          hull: state.player.maxHull,
          sails: 100,
          flood: 0,
          fire: 0,
          supplies: state.player.supplies + 8,
          morale: clamp(state.player.morale + 12),
        },
        crew: state.crew.map((person) => {
          const healed = clamp((person.health > 0 ? person.health : 0) + (person.health > 0 ? 28 : 40));
          const location = stationData[person.location] ? person.location : "helm";
          return {
            ...person,
            health: healed,
            location,
            target: null,
            moveProgress: 0,
            status: `Manning ${stationData[location].label}`,
          };
        }),
        log: addLog(state.log, "Golden Haven restocks powder, timber, and rumours.", "success"),
      }));
      return;
    }

    set({ encounterOpen: true });
  },

  closeEncounter: () => set({ encounterOpen: false }),

  startEncounter: () =>
    set((state) => {
      const node = chartNodes.find((item) => item.id === state.selectedChartNode);
      const elite = node?.type === "elite";
      const storm = node?.type === "storm";
      const crew = state.crew?.length ? state.crew : makeCrew();
      const player = state.player?.name ? state.player : makePlayerShip();
      return {
        screen: "combat",
        encounterOpen: false,
        voyageNumber: state.voyageNumber,
        ...softResetCombat(player, crew, { elite, storm }),
      };
    }),

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
  setTimeScale: (timeScale) => set({ timeScale, paused: false, pauseReason: null }),
  togglePause: () =>
    set((state) => ({
      paused: !state.paused,
      pauseReason: state.paused ? null : state.pauseReason || "manual",
    })),

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
    const helmPower = stationPower(get().crew, "helm");
    const step = 10 + Math.min(8, helmPower * 4);
    set((state) => ({
      player: {
        ...state.player,
        heading: clamp(state.player.heading + direction * step, -90, 90),
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
    const gunPower = stationPower(state.crew, "portGuns") + stationPower(state.crew, "starboardGuns");
    if (!gunCrew) {
      set((current) => ({ log: addLog(current.log, "Gun decks unmanned—no broadside available.", "warning") }));
      return;
    }

    const preferred = facingBattery(playerYaw(state.player.heading));
    let battery = preferred;
    if (preferred === "port" && !portCrew && starboardCrew) battery = "starboard";
    if (preferred === "starboard" && !starboardCrew && portCrew) battery = "port";

    const lookoutPower = stationPower(state.crew, "lookout");
    const lookoutBonus = lookoutPower > 0 ? 0.9 + Math.min(0.22, lookoutPower * 0.08) : 0.68;
    const distancePenalty = state.player.distance > 72 ? 0.72 : state.player.distance < 40 ? 1.08 : 1;
    const gunneryBonus = 1 + Math.min(0.18, (gunPower - gunCrew) * 0.1);
    const hitChance = (0.58 + Math.min(gunCrew, 3) * 0.08) * gunneryBonus;
    // Opening volley always lands so a new player sees the Empire-style ripple.
    const hit = state.shotsFired === 0 || Math.random() < hitChance * lookoutBonus * distancePenalty;
    const ammo = ammoData[state.ammo];

    const targetModifier = state.targetSystem === "hull" ? 1.1 : 0.88;
    const damageSpread = 0.86 + Math.random() * 0.28;
    let hullDamage = ammo.hull * targetModifier * damageSpread * gunneryBonus;
    let mobilityDamage = ammo.mobility * damageSpread * gunneryBonus;
    let crewDamage = ammo.crew * damageSpread * gunneryBonus;
    let weaponsDamage = 0;

    if (state.targetSystem === "mobility") mobilityDamage *= 1.45;
    if (state.targetSystem === "weapons") {
      hullDamage *= 0.55;
      weaponsDamage = (10 + ammo.hull * 0.65) * damageSpread * gunneryBonus;
    }
    if (state.targetSystem === "crew") crewDamage *= 1.5;

    const magazinePower = stationPower(state.crew, "magazine");
    const reloadTime = ammo.reload / Math.max(1, gunCrew * 0.68 + magazinePower * 0.35);

    const volley = buildPlayerVolley({
      battery,
      heading: state.player.heading,
      hit,
      ammoId: state.ammo,
      targetSystem: state.targetSystem,
      damage: { hull: hullDamage, mobility: mobilityDamage, crew: crewDamage, weapons: weaponsDamage },
    });

    set((current) => ({
      player: { ...current.player, reload: reloadTime },
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
    if (state.battleState !== "engaged" || state.paused) return;
    const sailsManned = stationPower(state.crew, "sails");
    const helmManned = stationPower(state.crew, "helm") > 0;
    const sailFactor = state.player.sails / 100;
    const speedFactor = state.player.throttle / 4;
    const rangeFactor = clamp((state.player.distance - 40) / 55, 0, 1);
    const chance = clamp(
      0.1 + sailsManned * 0.14 + sailFactor * 0.22 + speedFactor * 0.16 + rangeFactor * 0.12 + (helmManned ? 0.06 : -0.08),
      0.05,
      0.85,
    );

    if (Math.random() < chance) {
      const summary = buildBattleSummary(state, "escaped");
      set((current) => ({
        battleState: "escaped",
        volleys: [],
        battleSummary: summary,
        player: applyOutcomeRewards(current.player, summary),
        log: addLog(current.log, "The Wayward Gull disappears into the fog.", "success"),
      }));
      return;
    }

    // Failed breakaway draws an immediate ranging volley.
    const weaponsFactor = clamp((state.enemy.weapons ?? 100) / 100, 0.35, 1);
    const impact = (6 + Math.random() * 7) * (0.55 + 0.45 * weaponsFactor);
    const events = [];
    if (Math.random() < 0.4) events.push("sails");
    if (Math.random() < 0.35) events.push("crew");
    const volley = buildEnemyVolley({ hit: true, impact, events });
    set((current) => ({
      volleys: [...current.volleys, volley],
      enemyVolleyTimer: Math.max(current.enemyVolleyTimer, 3.2),
      log: addLog(current.log, "The mech tracks our turn and fires as we claw for fog!", "danger"),
    }));
  },

  returnToChart: () => {
    const state = get();
    const destination = state.selectedChartNode;
    const node = chartNodes.find((item) => item.id === destination);
    const campaignWon = state.battleState === "victory" && node?.type === "elite";
    const summary = state.battleSummary || buildBattleSummary(state, state.battleState);
    const rewardedPlayer = state.battleSummary
      ? state.player
      : applyOutcomeRewards(state.player, summary);

    set((current) => ({
      screen: campaignWon ? "victory" : "chart",
      chartNode: destination,
      visitedNodes: [...new Set([...current.visitedNodes, destination])],
      encounterOpen: false,
      battleState: "engaged",
      volleys: [],
      pauseReason: null,
      paused: false,
      voyageComplete: campaignWon,
      battleSummary: summary,
      player: rewardedPlayer,
      crew: preserveCrewForNextFight(current.crew),
    }));
  },

  tick: (rawDelta) => {
    const state = get();
    if (state.screen !== "combat" || state.paused || state.battleState !== "engaged") return;

    const delta = Math.min(rawDelta, 0.5) * state.timeScale;
    let nextCrew = state.crew.map((person) => {
      if (!person.target || person.health <= 0) return person;
      const speed = person.specialty === stationData[person.target]?.specialty ? 0.38 : 0.25;
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

    const pumps = stationPower(nextCrew, "pumps");
    const firefighters = stationPower(nextCrew, "fire");
    const leakCrew = stationPower(nextCrew, "leak");
    const carpenter = stationPower(nextCrew, "carpenter");
    const sailmakers = stationPower(nextCrew, "sails");
    const surgeon = stationPower(nextCrew, "surgeon");
    const lookout = stationPower(nextCrew, "lookout");
    const magazine = stationPower(nextCrew, "magazine");

    let playerFire = clamp(state.player.fire - firefighters * 5.2 * delta);
    // Magazine is dangerous while burning.
    if (magazine > 0 && playerFire > 12) {
      playerFire = clamp(playerFire + magazine * 0.35 * delta);
    }
    let playerFlood = clamp(state.player.flood + Math.max(0, state.player.flood > 0 ? 0.6 - pumps * 1.45 - leakCrew * 1.1 : 0) * delta);
    if (pumps > 0) playerFlood = clamp(playerFlood - pumps * 2.2 * delta);
    let playerHull = clamp(state.player.hull - playerFire * 0.0045 * delta + carpenter * 0.14 * delta, 0, state.player.maxHull);
    let playerSails = clamp(state.player.sails + sailmakers * 0.55 * delta + carpenter * 0.18 * delta);
    const enemyFire = clamp(state.enemy.fire - 0.9 * delta);
    const enemyHull = clamp(state.enemy.hull - enemyFire * 0.01 * delta, 0, state.enemy.maxHull ?? 100);
    const reloadSpeed = 1 + magazine * 0.28;
    const playerReload = Math.max(0, state.player.reload - delta * reloadSpeed);
    let enemyTimer = state.enemyVolleyTimer - delta;
    let nextLog = state.log;
    const weaponsFactor = clamp((state.enemy.weapons ?? 100) / 100, 0.3, 1);
    const mobilityFactor = clamp(state.enemy.mobility / 100, 0.45, 1);
    let nextEnemy = {
      ...state.enemy,
      fire: enemyFire,
      hull: enemyHull,
      identified: state.enemy.identified || lookout > 0,
      name: state.enemy.elite
        ? "Red Bastion Siege-Mech"
        : state.enemy.identified || lookout > 0
          ? "Iron Leviathan"
          : state.enemy.name,
    };
    let nextPlayer = {
      ...state.player,
      hull: playerHull,
      sails: playerSails,
      fire: playerFire,
      flood: playerFlood,
      reload: playerReload,
      distance: clamp(
        state.player.distance + (1 - state.player.throttle) * 0.06 * delta - state.player.throttle * 0.09 * delta * (0.7 + 0.3 * (state.player.sails / 100)),
        28,
        95,
      ),
    };

    if (surgeon > 0) {
      nextCrew = nextCrew.map((person) => ({
        ...person,
        health: person.health > 0 ? clamp(person.health + surgeon * 0.55 * delta) : person.health,
      }));
    }

    let nextVolleys = state.volleys;
    if (enemyTimer <= 0 && nextEnemy.hull > 0 && !state.volleys.some((volley) => volley.side === "enemy" && !volley.damageApplied)) {
      const evasion = clamp(
        0.05 + Math.abs(nextPlayer.heading) / 250 + nextPlayer.throttle * 0.035 + (nextPlayer.sails / 100) * 0.04,
        0.05,
        0.42,
      );
      const hit = Math.random() > evasion;
      const baseCadence = nextEnemy.elite ? 5.6 : 7.4;
      enemyTimer = (Math.max(3.4, baseCadence - (100 - nextEnemy.crew) / 35) / Math.max(0.45, weaponsFactor * (0.7 + 0.3 * mobilityFactor)))
        + Math.random() * 2;

      const impact = (7 + Math.random() * 8) * (0.5 + 0.5 * weaponsFactor) * (nextEnemy.elite ? 1.2 : 1);
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
      const summary = buildBattleSummary(working, "victory");
      working = {
        ...working,
        battleState: "victory",
        paused: true,
        pauseReason: null,
        battleSummary: summary,
        player: applyOutcomeRewards(working.player, summary),
      };
    }
    if (working.player.hull <= 0 || working.player.flood >= 100 || working.crew.every((person) => person.health <= 0)) {
      working = {
        ...working,
        battleState: "defeat",
        paused: true,
        pauseReason: null,
        battleSummary: buildBattleSummary(working, "defeat"),
      };
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
      pauseReason: working.pauseReason,
      volleys: working.volleys,
      battleSummary: working.battleSummary,
    });
  },
}), {
  name: "rogue-seas-voyage",
  version: 3,
  migrate: (persisted, version) => {
    if (!persisted) return persisted;
    if (version < 3) {
      return {
        chartNode: persisted.chartNode ?? "calm-reach",
        visitedNodes: persisted.visitedNodes ?? ["calm-reach"],
        selectedChartNode: persisted.selectedChartNode ?? "blackwater",
        voyageNumber: persisted.voyageNumber ?? 1,
        voyageComplete: false,
      };
    }
    return persisted;
  },
  partialize: (state) => ({
    chartNode: state.chartNode,
    visitedNodes: state.visitedNodes,
    selectedChartNode: state.selectedChartNode,
    voyageNumber: state.voyageNumber,
    voyageComplete: state.voyageComplete,
    player: {
      name: state.player.name,
      hull: state.player.hull,
      maxHull: state.player.maxHull,
      sails: state.player.sails,
      flood: state.player.flood,
      fire: state.player.fire,
      morale: state.player.morale,
      supplies: state.player.supplies,
    },
    crew: state.crew.map((person) => ({
      id: person.id,
      health: person.health,
      location: person.location,
      status: person.status,
    })),
  }),
  merge: (persisted, current) => {
    if (!persisted) return current;
    const mergedCrew = current.crew.map((person) => {
      const saved = persisted.crew?.find((item) => item.id === person.id);
      if (!saved) return person;
      return {
        ...person,
        health: saved.health ?? person.health,
        location: stationData[saved.location] ? saved.location : person.location,
        status: saved.status ?? person.status,
      };
    });
    const hasProgress = Boolean(persisted.voyageComplete)
      || (persisted.visitedNodes?.length > 1)
      || (persisted.chartNode && persisted.chartNode !== "calm-reach");
    return {
      ...current,
      ...persisted,
      crew: mergedCrew,
      player: { ...current.player, ...persisted.player },
      screen: persisted.voyageComplete ? "victory" : hasProgress ? "chart" : "title",
      battleState: "engaged",
      volleys: [],
      paused: false,
      pauseReason: null,
      encounterOpen: false,
    };
  },
}));
