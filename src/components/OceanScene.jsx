import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ENEMY_MECH, PLAYER_SHIP } from "../battleLayout";
import { MAX_FRAME_INTERVAL } from "../frameRate";

const stationWorldPositions = {
  helm: [-1.65, 1.02, 0.15],
  lookout: [0.1, 1.55, -0.08],
  sails: [0.25, 1.1, -0.05],
  portGuns: [0.1, 0.85, 0.72],
  starboardGuns: [0.7, 0.85, -0.62],
  carpenter: [-0.65, 0.9, 0.48],
  surgeon: [-0.3, 0.9, -0.45],
  pumps: [0.9, 0.68, 0.18],
  magazine: [1.25, 0.7, -0.18],
  fire: [0.15, 0.87, 0.16],
  leak: [0.75, 0.68, 0.1],
  deck: [-1.1, 0.88, -0.2],
};

function FrameLimiter() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let frame;
    let lastFrame = 0;
    const loop = (time) => {
      if (!lastFrame || time - lastFrame >= MAX_FRAME_INTERVAL - 0.5) {
        invalidate();
        lastFrame = time;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [invalidate]);

  return null;
}

function SceneFog({ dense = false }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2(dense ? "#7899a0" : "#2a6673", dense ? 0.055 : 0.018);
    return () => {
      scene.fog = null;
    };
  }, [dense, scene]);
  return null;
}

function CameraControls({ title }) {
  const controls = useRef();
  const keys = useRef(new Set());
  const { camera } = useThree();

  useEffect(() => {
    if (title) return undefined;
    const resetCamera = () => {
      camera.position.set(12, 12, 16);
      controls.current?.target.set(0, 0.65, 0);
      controls.current?.update();
    };
    const press = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "shift"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
      if (key === "r") resetCamera();
    };
    const release = (event) => keys.current.delete(event.key.toLowerCase());
    const clearKeys = () => keys.current.clear();
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", clearKeys);
    window.addEventListener("rogue-seas-reset-camera", resetCamera);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("rogue-seas-reset-camera", resetCamera);
    };
  }, [camera, title]);

  useFrame((_, delta) => {
    if (title || keys.current.size === 0 || !controls.current) return;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const movement = new THREE.Vector3();
    if (keys.current.has("w")) movement.add(forward);
    if (keys.current.has("s")) movement.sub(forward);
    if (keys.current.has("d")) movement.add(right);
    if (keys.current.has("a")) movement.sub(right);
    if (movement.lengthSq() === 0) return;
    movement.normalize().multiplyScalar(delta * (keys.current.has("shift") ? 13 : 7));
    camera.position.add(movement);
    controls.current.target.add(movement);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      minDistance={title ? 8 : 5.5}
      maxDistance={title ? 18 : 42}
      minPolarAngle={0.35}
      maxPolarAngle={1.48}
      target={title ? [0, 2.25, 0] : [0, 0.65, 0]}
      autoRotate={title}
      autoRotateSpeed={title ? 0.25 : 0}
    />
  );
}

function OceanSurface({ calm = false }) {
  const material = useRef();
  const texture = useTexture("/assets/textures/storm-sea.png");

  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.8, 2.8);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  useFrame((_, delta) => {
    texture.offset.x += delta * (calm ? 0.003 : 0.006);
    texture.offset.y -= delta * (calm ? 0.002 : 0.004);
    if (material.current) material.current.opacity = calm ? 0.82 : 0.94;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[130, 130, 1, 1]} />
      <meshStandardMaterial
        ref={material}
        map={texture}
        color={calm ? "#1a5261" : "#0f6174"}
        roughness={0.72}
        metalness={0.05}
        transparent
      />
    </mesh>
  );
}

function CrewModel({ member, index }) {
  const { scene } = useGLTF(member.model);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const target = stationWorldPositions[member.target || member.location] || stationWorldPositions.deck;
  const start = stationWorldPositions[member.location] || stationWorldPositions.deck;
  const progress = member.target ? member.moveProgress : 1;
  const position = [
    THREE.MathUtils.lerp(start[0], target[0], progress),
    THREE.MathUtils.lerp(start[1], target[1], progress),
    THREE.MathUtils.lerp(start[2], target[2], progress),
  ];

  return (
    <group position={position} rotation={[0, index % 2 ? -0.5 : 0.55, 0]} scale={0.075} visible={member.health > 0}>
      <primitive object={clone} />
      <pointLight color={member.color} intensity={0.45} distance={1.8} position={[0, 2.5, 0]} />
    </group>
  );
}

function ShipModel({
  url,
  position,
  rotation,
  scale = 1,
  crew = [],
  damage = 0,
  fire = 0,
}) {
  const group = useRef();
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const object = scene.clone(true);
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) child.material = child.material.clone();
    });
    return object;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8) * 0.08;
    group.current.rotation.z = rotation[2] + Math.sin(clock.elapsedTime * 0.55) * 0.018;
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={clone} castShadow receiveShadow />
      {crew.map((member, index) => (
        <CrewModel key={member.id} member={member} index={index} />
      ))}
      {fire > 5 && (
        <group position={[0.15, 1.2, 0.1]}>
          <pointLight color="#ff6a24" intensity={Math.min(4, fire / 18)} distance={5} />
          <mesh>
            <sphereGeometry args={[0.22 + fire / 400, 12, 8]} />
            <meshBasicMaterial color="#f65d2f" transparent opacity={0.72} />
          </mesh>
        </group>
      )}
      {damage > 50 && (
        <mesh position={[0.4, 0.85, 0.56]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color="#15100d" />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.8, -0.42, 0]} scale={[1, 1.7, 1]}>
        <ringGeometry args={[0.45, 1.15, 48, 1, 0.25, Math.PI * 1.5]} />
        <meshBasicMaterial color="#b7d8d1" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ArmorPlate({ args, position, rotation = [0, 0, 0], color = "#3a454c", metalness = 0.72, roughness = 0.38 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function MechModel({ enemy, position = ENEMY_MECH.position, yaw = ENEMY_MECH.yaw }) {
  const group = useRef();
  const torso = useRef();
  const damage = 100 - (enemy?.hull || 100);
  const mobility = enemy?.mobility ?? 100;
  const fire = enemy?.fire || 0;
  const limp = mobility < 45 ? 0.22 : 0.08;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    group.current.rotation.y = yaw + Math.sin(t * 0.35) * 0.03;
    group.current.rotation.z = Math.sin(t * 0.7) * limp * 0.15;
    if (torso.current) torso.current.rotation.y = Math.sin(t * 0.45) * 0.08;
  });

  const plate = damage > 55 ? "#2a2220" : "#3d4850";
  const accent = "#8a3a2a";

  return (
    <group ref={group} position={position} rotation={[0, yaw, 0]}>
      {/* Legs */}
      <ArmorPlate args={[0.55, 1.35, 0.55]} position={[-0.45, 0.55, 0.15]} color={plate} />
      <ArmorPlate args={[0.55, 1.35, 0.55]} position={[0.45, 0.55, 0.15]} color={plate} />
      <ArmorPlate args={[0.7, 0.28, 0.95]} position={[-0.45, -0.05, 0.35]} color="#2b3238" />
      <ArmorPlate args={[0.7, 0.28, 0.95]} position={[0.45, -0.05, 0.35]} color="#2b3238" />
      <ArmorPlate args={[0.35, 0.55, 0.35]} position={[-0.45, 1.25, 0.05]} color="#505a62" />
      <ArmorPlate args={[0.35, 0.55, 0.35]} position={[0.45, 1.25, 0.05]} color="#505a62" />

      {/* Hip / pelvis */}
      <ArmorPlate args={[1.35, 0.45, 0.85]} position={[0, 1.55, 0]} color="#333b42" />

      <group ref={torso} position={[0, 1.85, 0]}>
        {/* Torso */}
        <ArmorPlate args={[1.55, 1.45, 1.05]} position={[0, 0.7, 0]} color={plate} />
        <ArmorPlate args={[1.15, 0.55, 0.35]} position={[0, 1.15, 0.55]} color={accent} metalness={0.55} />
        <ArmorPlate args={[0.55, 0.7, 0.55]} position={[0, 1.55, 0]} color="#1c2228" />
        {/* Head / optics */}
        <mesh position={[0, 1.95, 0.15]} castShadow>
          <boxGeometry args={[0.7, 0.55, 0.65]} />
          <meshStandardMaterial color="#1a1f24" metalness={0.8} roughness={0.28} />
        </mesh>
        <mesh position={[0, 1.95, 0.48]}>
          <boxGeometry args={[0.42, 0.12, 0.08]} />
          <meshStandardMaterial color="#ff6a2b" emissive="#ff3b00" emissiveIntensity={1.4} />
        </mesh>
        <pointLight position={[0, 1.95, 0.7]} color="#ff6a2b" intensity={1.2} distance={4} />

        {/* Arms + gun pods */}
        <ArmorPlate args={[0.38, 1.05, 0.38]} position={[-0.95, 0.55, 0.1]} rotation={[0.15, 0, 0.25]} color="#464f57" />
        <ArmorPlate args={[0.38, 1.05, 0.38]} position={[0.95, 0.55, 0.1]} rotation={[0.15, 0, -0.25]} color="#464f57" />
        <ArmorPlate args={[0.55, 0.45, 1.15]} position={[-1.15, 0.15, 0.55]} color="#2f363c" />
        <ArmorPlate args={[0.55, 0.45, 1.15]} position={[1.15, 0.15, 0.55]} color="#2f363c" />
        <mesh position={[-1.15, 0.15, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.55, 10]} />
          <meshStandardMaterial color="#1a1c1e" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[1.15, 0.15, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.55, 10]} />
          <meshStandardMaterial color="#1a1c1e" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[-1.15, -0.05, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.4, 8]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[1.15, -0.05, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.4, 8]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Shoulder stacks */}
      <ArmorPlate args={[0.7, 0.35, 0.7]} position={[-0.85, 2.55, -0.05]} color="#505862" />
      <ArmorPlate args={[0.7, 0.35, 0.7]} position={[0.85, 2.55, -0.05]} color="#505862" />

      {fire > 5 && (
        <group position={[0.2, 2.2, 0.1]}>
          <pointLight color="#ff6a24" intensity={Math.min(5, fire / 16)} distance={6} />
          <mesh>
            <sphereGeometry args={[0.28 + fire / 350, 12, 8]} />
            <meshBasicMaterial color="#f65d2f" transparent opacity={0.7} />
          </mesh>
        </group>
      )}
      {damage > 40 && (
        <mesh position={[0.55, 2.1, 0.4]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshBasicMaterial color="#120e0c" />
        </mesh>
      )}
      {mobility < 50 && (
        <mesh position={[-0.45, 0.9, 0.4]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#6a2a1a" emissive="#ff3a00" emissiveIntensity={0.6} />
        </mesh>
      )}

      {/* Wake / footing in the surf */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0.2]}>
        <ringGeometry args={[0.9, 1.8, 40]} />
        <meshBasicMaterial color="#9ec9c2" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

function shotProgress(shot, age) {
  if (age < shot.fireDelay) return -1;
  return Math.min(1, (age - shot.fireDelay) / shot.duration);
}

function sampleArc(origin, destination, t, arc) {
  const x = THREE.MathUtils.lerp(origin[0], destination[0], t);
  const z = THREE.MathUtils.lerp(origin[2], destination[2], t);
  const baseY = THREE.MathUtils.lerp(origin[1], destination[1], t);
  const y = baseY + Math.sin(Math.PI * t) * arc;
  return [x, y, z];
}

function MuzzleFlash({ position, kind, strength }) {
  const color = kind === "mech" ? "#ff7a3a" : "#ffd28a";
  return (
    <group position={position}>
      <pointLight color={color} intensity={2.8 * strength} distance={4.5} decay={2} />
      <mesh>
        <sphereGeometry args={[0.12 + 0.08 * strength, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85 * strength} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.28 + 0.12 * strength, 8, 8]} />
        <meshBasicMaterial color="#fff6df" transparent opacity={0.28 * strength} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ImpactBurst({ position, kind, strength }) {
  const color = kind === "mech" ? "#ff9a55" : "#e8c07a";
  return (
    <group position={position}>
      <pointLight color={color} intensity={3.2 * strength} distance={5} />
      <mesh>
        <sphereGeometry args={[0.18 + 0.2 * strength, 10, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.75 * strength} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.45 + 0.25 * strength, 10, 8]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.18 * strength} depthWrite={false} />
      </mesh>
    </group>
  );
}

function VolleyEffects({ volleys = [] }) {
  const flashes = [];
  const balls = [];
  const impacts = [];

  volleys.forEach((volley) => {
    volley.shots.forEach((shot) => {
      const t = shotProgress(shot, volley.age);
      if (t < 0) return;

      const sinceFire = volley.age - shot.fireDelay;
      if (sinceFire < 0.18) {
        flashes.push({
          id: `${shot.id}-flash`,
          position: shot.origin,
          kind: shot.kind,
          strength: 1 - sinceFire / 0.18,
        });
      }

      if (t < 1) {
        balls.push({
          id: shot.id,
          position: sampleArc(shot.origin, shot.destination, t, shot.arc),
          kind: shot.kind,
        });
      } else {
        const sinceLand = volley.age - shot.fireDelay - shot.duration;
        if (sinceLand < 0.28) {
          impacts.push({
            id: `${shot.id}-hit`,
            position: shot.destination,
            kind: shot.kind,
            strength: 1 - sinceLand / 0.28,
          });
        }
      }
    });
  });

  return (
    <group>
      {flashes.map((flash) => (
        <MuzzleFlash key={flash.id} {...flash} />
      ))}
      {balls.map((ball) => (
        <mesh key={ball.id} position={ball.position} castShadow>
          <sphereGeometry args={[ball.kind === "mech" ? 0.09 : 0.07, 10, 8]} />
          <meshStandardMaterial
            color={ball.kind === "mech" ? "#ffb070" : "#2a2a2a"}
            emissive={ball.kind === "mech" ? "#ff5a18" : "#111"}
            emissiveIntensity={ball.kind === "mech" ? 1.6 : 0.15}
            metalness={0.85}
            roughness={0.35}
          />
        </mesh>
      ))}
      {impacts.map((burst) => (
        <ImpactBurst key={burst.id} {...burst} />
      ))}
    </group>
  );
}

function SceneContent({ variant, player, enemy, crew, fogDense, volleys }) {
  const title = variant === "title";
  const playerRotation = title
    ? [0, 0.7, 0]
    : [0, PLAYER_SHIP.yaw + (player?.heading || 0) * 0.004, 0];

  return (
    <>
      <color attach="background" args={[title ? "#0b3740" : "#246d7b"]} />
      <SceneFog dense={fogDense} />
      <ambientLight intensity={title ? 1.3 : 1.7} color="#9ac2bd" />
      <directionalLight
        castShadow
        position={[10, 18, 8]}
        intensity={3.2}
        color="#ffe2a1"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <OceanSurface calm={title} />
      <ShipModel
        url="/assets/models/ships/wayward-gull-detailed.glb"
        position={title ? [0, -0.05, 0] : PLAYER_SHIP.position}
        rotation={playerRotation}
        scale={title ? 0.86 : PLAYER_SHIP.scale}
        crew={title ? [] : crew}
        fire={player?.fire || 0}
        damage={100 - (player?.hull || 100)}
      />
      {!title && <MechModel enemy={enemy} />}
      {!title && <VolleyEffects volleys={volleys} />}
      <CameraControls title={title} />
    </>
  );
}

export function OceanScene({
  variant = "combat",
  player,
  enemy,
  crew = [],
  fogDense = false,
  volleys = [],
}) {
  const title = variant === "title";
  return (
    <Canvas
      className="ocean-canvas"
      tabIndex={title ? -1 : 0}
      aria-label={title ? "The Wayward Gull title diorama" : "3D combat camera"}
      frameloop="demand"
      shadows={THREE.PCFShadowMap}
      dpr={[1, 1.65]}
      camera={{ position: title ? [11.5, 7, 14] : [12, 12, 16], fov: title ? 39 : 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <FrameLimiter />
      <Suspense fallback={null}>
        <SceneContent
          variant={variant}
          player={player}
          enemy={enemy}
          crew={crew}
          fogDense={fogDense}
          volleys={volleys}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/assets/models/ships/wayward-gull-detailed.glb");
