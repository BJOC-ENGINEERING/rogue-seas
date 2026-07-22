export const crewTemplate = [
  {
    id: "mara",
    name: "Captain J",
    initials: "CJ",
    role: "Captain",
    specialty: "Command",
    color: "#c83a3f",
    model: "/assets/textures/crew/lego-captain.png",
    location: "helm",
  },
  {
    id: "briggs",
    name: "Gunner J",
    initials: "GJ",
    role: "Gunner",
    specialty: "Gunnery",
    color: "#d6a345",
    model: "/assets/textures/crew/lego-captain.png",
    location: "portGuns",
  },
  {
    id: "nell",
    name: "Lookout J",
    initials: "LJ",
    role: "Lookout",
    specialty: "Sight",
    color: "#7397a1",
    model: "/assets/textures/crew/lego-captain.png",
    location: "lookout",
  },
  {
    id: "finch",
    name: "Carpenter J",
    initials: "FJ",
    role: "Carpenter",
    specialty: "Repair",
    color: "#7f4db0",
    model: "/assets/textures/crew/lego-captain.png",
    location: "carpenter",
  },
  {
    id: "sol",
    name: "Sailmaker J",
    initials: "SJ",
    role: "Sailmaker",
    specialty: "Rigging",
    color: "#d1783d",
    model: "/assets/textures/crew/lego-captain.png",
    location: "sails",
  },
  {
    id: "wren",
    name: "Surgeon J",
    initials: "WJ",
    role: "Surgeon",
    specialty: "Medicine",
    color: "#557ead",
    model: "/assets/textures/crew/lego-captain.png",
    location: "surgeon",
  },
];

export const stationData = {
  helm: {
    id: "helm",
    label: "Helm",
    short: "H",
    deck: "top",
    x: 3,
    y: 2,
    specialty: "Command",
    description: "Controls heading and turn rate.",
  },
  lookout: {
    id: "lookout",
    label: "Lookout",
    short: "L",
    deck: "top",
    x: 8,
    y: 1,
    specialty: "Sight",
    description: "Reveals mech systems and improves gunnery.",
  },
  sails: {
    id: "sails",
    label: "Sails",
    short: "S",
    deck: "top",
    x: 11,
    y: 2,
    specialty: "Rigging",
    description: "Controls speed and escape chance.",
  },
  portGuns: {
    id: "portGuns",
    label: "Port battery",
    short: "P",
    deck: "top",
    x: 7,
    y: 4,
    specialty: "Gunnery",
    description: "Loads and fires the port cannon battery.",
  },
  starboardGuns: {
    id: "starboardGuns",
    label: "Starboard battery",
    short: "S",
    deck: "top",
    x: 12,
    y: 4,
    specialty: "Gunnery",
    description: "Loads and fires the starboard cannon battery.",
  },
  carpenter: {
    id: "carpenter",
    label: "Carpenter",
    short: "C",
    deck: "top",
    x: 5,
    y: 3,
    specialty: "Repair",
    description: "Restores damaged systems and hull plating.",
  },
  surgeon: {
    id: "surgeon",
    label: "Surgeon",
    short: "+",
    deck: "top",
    x: 10,
    y: 3,
    specialty: "Medicine",
    description: "Treats injured crew.",
  },
  pumps: {
    id: "pumps",
    label: "Bilge pumps",
    short: "B",
    deck: "lower",
    x: 6,
    y: 2,
    specialty: "Repair",
    description: "Removes flood water and slows new leaks.",
  },
  magazine: {
    id: "magazine",
    label: "Magazine",
    short: "M",
    deck: "lower",
    x: 11,
    y: 2,
    specialty: "Gunnery",
    description: "Speeds reloads, but fire near the magazine grows faster.",
  },
  fire: {
    id: "fire",
    label: "Fire response",
    short: "F",
    deck: "top",
    x: 9,
    y: 4,
    specialty: "Repair",
    description: "Extinguishes active deck fires.",
    emergency: true,
  },
  leak: {
    id: "leak",
    label: "Leak response",
    short: "W",
    deck: "lower",
    x: 8,
    y: 3,
    specialty: "Repair",
    description: "Patches the worst hull breach.",
    emergency: true,
  },
};

export const chartNodes = [
  {
    id: "calm-reach",
    name: "Calm Reach",
    type: "start",
    x: 18,
    y: 58,
    description: "A quiet anchorage at the edge of dangerous water.",
    links: ["blackwater", "gale-bank"],
  },
  {
    id: "blackwater",
    name: "Blackwater Passage",
    type: "combat",
    x: 48,
    y: 31,
    description: "A war-mech has been shelling merchant traffic through the fog.",
    links: ["freeport"],
  },
  {
    id: "gale-bank",
    name: "Gale Bank",
    type: "storm",
    x: 52,
    y: 72,
    description: "Violent winds hide opportunity—and splintered wreckage.",
    links: ["freeport"],
  },
  {
    id: "freeport",
    name: "Golden Haven",
    type: "port",
    x: 75,
    y: 54,
    description: "A neutral port offering repairs, recruits, and rumours.",
    links: ["red-bastion"],
  },
  {
    id: "red-bastion",
    name: "The Red Bastion",
    type: "elite",
    x: 88,
    y: 24,
    description: "A siege mech waits beyond the shoals, guns already warm.",
    links: [],
  },
];

export const targetSystems = [
  { id: "hull", label: "Armor plating", detail: "Punch through the mech's outer shell." },
  { id: "mobility", label: "Motive joints", detail: "Shatter legs and hip actuators." },
  { id: "weapons", label: "Weapon pods", detail: "Smash gun pods to slow and weaken enemy volleys." },
  { id: "crew", label: "Pilot & crew", detail: "Rake observation slits and break morale." },
];

export const ammoData = {
  round: {
    label: "Round shot",
    hull: 15,
    mobility: 5,
    crew: 2,
    reload: 7.2,
    detail: "Crush armor plates and open breaches.",
  },
  chain: {
    label: "Chain shot",
    hull: 6,
    mobility: 20,
    crew: 1,
    reload: 6.2,
    detail: "Shear joints and cripple the mech's stride.",
  },
  grape: {
    label: "Grapeshot",
    hull: 3,
    mobility: 2,
    crew: 15,
    reload: 5.4,
    detail: "Rake observation slits and break morale.",
  },
  fire: {
    label: "Incendiary",
    hull: 8,
    mobility: 8,
    crew: 4,
    reload: 8.5,
    detail: "Ignite fuel lines that demand enemy crew.",
  },
};

export const topDeckCells = [
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3],
  [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
];

export const lowerDeckCells = [
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3],
];

export function makeCrew() {
  return crewTemplate.map((crew) => ({
    ...crew,
    health: 100,
    morale: 100,
    target: null,
    moveProgress: 0,
    status: `Manning ${stationData[crew.location]?.label ?? "deck"}`,
  }));
}

export function makePlayerShip() {
  return {
    name: "The Wayward Gull",
    hull: 100,
    maxHull: 100,
    sails: 100,
    flood: 0,
    fire: 0,
    morale: 100,
    reload: 0,
    heading: 0,
    throttle: 1,
    distance: 62,
    supplies: 24,
  };
}

export function makeEnemyMech({ elite = false } = {}) {
  return {
    name: elite ? "Red Bastion Siege-Mech" : "Unknown War-Mech",
    kind: "mech",
    hull: elite ? 135 : 100,
    maxHull: elite ? 135 : 100,
    mobility: elite ? 115 : 100,
    crew: elite ? 120 : 100,
    weapons: 100,
    fire: 0,
    morale: elite ? 125 : 100,
    reload: elite ? 4.1 : 5.5,
    identified: elite,
    elite,
  };
}

export const encounterCopy = {
  combat: {
    eyebrow: "Sail to the sound of guns",
    title: "You encounter a war-mech",
    body: "Iron limbs rise from the fog and the machine turns its gun pods toward your broadside.",
    fight: "Fight",
    detail: "Beat to quarters",
  },
  storm: {
    eyebrow: "Gale Bank claims another keel",
    title: "A storm-wrapped war-mech",
    body: "Sheets of rain hide the machine until its first ranging shots tear through the canvas. Visibility is poor and the bilges are already wet.",
    fight: "Engage in the gale",
    detail: "Reef sail and fight",
  },
  elite: {
    eyebrow: "The Red Bastion waits",
    title: "Siege-mech on the shoals",
    body: "A heavier machine, guns already warm, blocks the only channel out. This is the fight the voyage was built for.",
    fight: "Challenge the bastion",
    detail: "No fog left to hide in",
  },
};

/** @deprecated Use makeEnemyMech */
export const makeEnemyShip = makeEnemyMech;
