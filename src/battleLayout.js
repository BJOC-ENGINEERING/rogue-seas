/** Shared combat-space layout for simulation and R3F presentation. */

export const PLAYER_SHIP = {
  position: [3.2, 0, 3.2],
  yaw: 0.7,
  scale: 0.58,
};

export const ENEMY_MECH = {
  position: [-8.2, 0.35, -7.2],
  yaw: 0.95,
  scale: 1,
};

/** Local-space gun muzzles along each battery (x along keel, z outboard). */
export const PORT_GUNS = [
  [-0.55, 0.78, 0.78],
  [-0.1, 0.8, 0.8],
  [0.35, 0.82, 0.82],
  [0.8, 0.84, 0.8],
  [1.25, 0.82, 0.78],
  [1.7, 0.8, 0.76],
  [2.15, 0.78, 0.74],
];

export const STARBOARD_GUNS = [
  [-0.55, 0.78, -0.72],
  [-0.1, 0.8, -0.74],
  [0.35, 0.82, -0.76],
  [0.8, 0.84, -0.74],
  [1.25, 0.82, -0.72],
  [1.7, 0.8, -0.7],
  [2.15, 0.78, -0.68],
];

/** Mech weapon hardpoints in local space (forearm pods). */
export const MECH_GUNS = [
  [-1.15, 2.0, 1.18],
  [-1.15, 1.8, 0.9],
  [1.15, 2.0, 1.18],
  [1.15, 1.8, 0.9],
];

export function localToWorld(local, origin, yaw, scale = 1) {
  const [lx, ly, lz] = local;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const x = lx * scale;
  const y = ly * scale;
  const z = lz * scale;
  return [
    origin[0] + x * cos - z * sin,
    origin[1] + y,
    origin[2] + x * sin + z * cos,
  ];
}

export function facingBattery(playerYaw) {
  // Enemy sits roughly northwest of the Gull; prefer the battery that faces it.
  const toEnemyX = ENEMY_MECH.position[0] - PLAYER_SHIP.position[0];
  const toEnemyZ = ENEMY_MECH.position[2] - PLAYER_SHIP.position[2];
  const sideX = -Math.sin(playerYaw);
  const sideZ = Math.cos(playerYaw);
  const portDot = sideX * toEnemyX + sideZ * toEnemyZ;
  return portDot > 0 ? "port" : "starboard";
}
