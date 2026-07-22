import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ENEMY_MECH, PLAYER_SHIP, PORT_GUNS, STARBOARD_GUNS } from "../battleLayout";
import { MAX_FRAME_INTERVAL } from "../frameRate";

const GUNNER_INDICES = [1, 3, 5];

function LegoCaptainFigure({ firing }) {
  const texture = useTexture("/assets/textures/crew/lego-captain.png");
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  // Cutout is ~367x768 after background removal.
  const height = 1.28;
  const width = height * (367 / 768);

  return (
    <group>
      {/* Little-man cutout rendered as the crew on the boat */}
      <mesh position={[0, height / 2 + 0.02, 0]} castShadow>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {firing && (
        <mesh position={[0.22, 0.5, 0.22]} rotation={[Math.PI / 2, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.055, 0.42, 8]} />
          <meshStandardMaterial color="#2b2118" metalness={0.55} roughness={0.45} />
        </mesh>
      )}
    </group>
  );
}

function CrewModel({ member, position, side, firing }) {
  const group = useRef();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = firing ? Math.sin(clock.elapsedTime * 28) * 0.035 : Math.sin(clock.elapsedTime * 1.7) * 0.008;
    group.current.position.y = position[1] + pulse;
    group.current.rotation.x = firing ? -0.14 : 0;
  });

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, side === "port" ? Math.PI / 2 : -Math.PI / 2, 0]}
      scale={1.15}
      visible={member.health > 0}
    >
      <LegoCaptainFigure firing={firing} />
    </group>
  );
}

function DeckCrew({ crew = [], volleys = [] }) {
  const activeVolley = [...volleys].reverse().find((volley) => (
    volley.side === "player"
    && volley.shots.some((shot) => volley.age >= shot.fireDelay && volley.age - shot.fireDelay < 0.24)
  ));
  const firingSide = activeVolley?.battery;
  const stations = [
    ...GUNNER_INDICES.map((index, crewIndex) => ({
      member: crew[crewIndex],
      position: [PORT_GUNS[index][0], PORT_GUNS[index][1] + 0.1, PORT_GUNS[index][2] * 0.55],
      side: "port",
    })),
    ...GUNNER_INDICES.map((index, crewIndex) => ({
      member: crew[crewIndex + 3],
      position: [STARBOARD_GUNS[index][0], STARBOARD_GUNS[index][1] + 0.1, STARBOARD_GUNS[index][2] * 0.55],
      side: "starboard",
    })),
  ];

  return (
    <group>
      {stations.map(({ member, position, side }, index) => member && (
        <CrewModel
          key={member.id}
          member={member}
          position={position}
          side={side}
          firing={firingSide === side}
        />
      ))}
    </group>
  );
}

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

function ShipModel({
  url,
  position,
  rotation,
  scale = 1,
  damage = 0,
  fire = 0,
  crew = [],
  volleys = [],
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
      <DeckCrew crew={crew} volleys={volleys} />
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

function MechModel({ enemy, position = ENEMY_MECH.position, yaw = ENEMY_MECH.yaw, scale = ENEMY_MECH.scale }) {
  const group = useRef();
  const { scene } = useGLTF("/assets/models/mechs/iron-leviathan.glb");
  const baseColors = useRef(new Map());
  const clone = useMemo(() => {
    const object = scene.clone(true);
    baseColors.current.clear();
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        if (child.material.color) {
          baseColors.current.set(child.uuid, child.material.color.clone());
        }
      }
    });
    return object;
  }, [scene]);

  const damage = 100 - (enemy?.hull || 100);
  const mobility = enemy?.mobility ?? 100;
  const fire = enemy?.fire || 0;
  const limp = mobility < 45 ? 0.22 : 0.08;

  useEffect(() => {
    const scar = Math.min(0.45, damage / 180);
    clone.traverse((child) => {
      if (!child.isMesh || !child.material?.color) return;
      const base = baseColors.current.get(child.uuid);
      if (!base) return;
      child.material.color.copy(base);
      child.material.color.offsetHSL(0, -scar * 0.15, -scar * 0.12);
    });
  }, [clone, damage]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    group.current.rotation.y = yaw + Math.sin(t * 0.35) * 0.03;
    group.current.rotation.z = Math.sin(t * 0.7) * limp * 0.15;
  });

  return (
    <group ref={group} position={position} rotation={[0, yaw, 0]} scale={scale}>
      <primitive object={clone} castShadow receiveShadow />

      {fire > 5 && (
        <group position={[0.15, 2.6, 0.35]}>
          <pointLight color="#ff6a24" intensity={Math.min(5, fire / 16)} distance={6} />
          <mesh>
            <sphereGeometry args={[0.28 + fire / 350, 12, 8]} />
            <meshBasicMaterial color="#f65d2f" transparent opacity={0.7} />
          </mesh>
        </group>
      )}
      {damage > 40 && (
        <mesh position={[0.55, 2.85, 0.4]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshBasicMaterial color="#120e0c" />
        </mesh>
      )}
      {mobility < 50 && (
        <mesh position={[-0.7, 0.9, 0.2]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color="#6a2a1a" emissive="#ff3a00" emissiveIntensity={0.6} />
        </mesh>
      )}

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
        fire={player?.fire || 0}
        damage={100 - (player?.hull || 100)}
        crew={title ? [] : crew}
        volleys={volleys}
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
useGLTF.preload("/assets/models/mechs/iron-leviathan.glb");
useTexture.preload("/assets/textures/crew/lego-captain.png");
useTexture.preload("/assets/textures/storm-sea.png");
