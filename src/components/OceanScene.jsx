import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

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
  enemy = false,
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
      if (child.material) {
        child.material = child.material.clone();
        if (enemy && /oak|timber|ensign/i.test(child.material.name)) {
          child.material.color.lerp(new THREE.Color("#251617"), 0.26);
        }
      }
    });
    return object;
  }, [enemy, scene]);
  const phase = enemy ? 1.7 : 0;

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8 + phase) * 0.08;
    group.current.rotation.z = rotation[2] + Math.sin(clock.elapsedTime * 0.55 + phase) * 0.018;
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

function makeSwarmRoster(count, kind) {
  return Array.from({ length: count }, (_, index) => {
    const orbit = 1.1 + (index % 9) * 0.42 + (kind === "wasp" ? 0.35 : 0);
    return {
      kind,
      radius: orbit,
      elev: ((index * 0.37) % 2.4) - 1.1,
      speed: (kind === "wasp" ? 1.15 : 0.85) + (index % 6) * 0.18,
      phase: index * 0.53 + (kind === "wasp" ? 1.2 : 0),
      bob: 0.55 + (index % 5) * 0.12,
      spin: 0.7 + (index % 4) * 0.35,
      size: kind === "wasp" ? 0.11 + (index % 4) * 0.018 : 0.09 + (index % 5) * 0.014,
    };
  });
}

function EvilSwarm({ enemy, position = [-8.2, 1.35, -7.2] }) {
  const group = useRef();
  const beeBodies = useRef();
  const waspBodies = useRef();
  const wings = useRef();
  const queen = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bees = useMemo(() => makeSwarmRoster(96, "bee"), []);
  const wasps = useMemo(() => makeSwarmRoster(58, "wasp"), []);
  const insects = useMemo(() => [...bees, ...wasps], [bees, wasps]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const integrity = Math.max(0.12, (enemy?.hull ?? 100) / 100);
    const drones = Math.max(0.18, (enemy?.crew ?? 100) / 100);
    const rage = Math.min(1, (enemy?.fire ?? 0) / 70);
    const aliveCount = Math.max(18, Math.floor(insects.length * integrity * (0.55 + drones * 0.45)));

    group.current.position.y = position[1] + Math.sin(t * 0.9) * 0.18;
    group.current.rotation.y = t * 0.08;

    let wingIndex = 0;
    insects.forEach((bug, index) => {
      const alive = index < aliveCount;
      const angle = t * bug.speed + bug.phase;
      const swirl = 1 + Math.sin(t * bug.bob + bug.phase) * 0.12 + rage * 0.18;
      const x = Math.cos(angle) * bug.radius * swirl * integrity;
      const z = Math.sin(angle * 0.92) * bug.radius * 0.78 * swirl * integrity;
      const y = bug.elev * integrity + Math.sin(t * bug.bob * 1.4 + bug.phase) * 0.35;
      const scale = alive ? bug.size * (0.85 + integrity * 0.35) : 0.0001;

      dummy.position.set(x, y, z);
      if (bug.kind === "wasp") {
        dummy.scale.set(scale * 0.75, scale * 0.75, scale * 1.35);
      } else {
        dummy.scale.set(scale * 0.85, scale * 0.7, scale * 1.45);
      }
      dummy.rotation.set(
        Math.sin(t * bug.spin + bug.phase) * 0.45,
        angle + Math.PI / 2,
        Math.cos(t * bug.spin * 1.2) * 0.35,
      );
      dummy.updateMatrix();

      const bodyMesh = bug.kind === "wasp" ? waspBodies.current : beeBodies.current;
      const localIndex = bug.kind === "wasp" ? index - bees.length : index;
      if (bodyMesh) bodyMesh.setMatrixAt(localIndex, dummy.matrix);

      if (wings.current) {
        dummy.scale.set(scale * 2.4, scale * 0.18, scale * 1.1);
        dummy.rotation.z = Math.sin(t * 28 + bug.phase) * 0.55;
        dummy.updateMatrix();
        wings.current.setMatrixAt(wingIndex, dummy.matrix);
        wingIndex += 1;
      }
    });

    if (beeBodies.current) beeBodies.current.instanceMatrix.needsUpdate = true;
    if (waspBodies.current) waspBodies.current.instanceMatrix.needsUpdate = true;
    if (wings.current) wings.current.instanceMatrix.needsUpdate = true;

    if (queen.current) {
      const pulse = 1 + Math.sin(t * 3.2) * 0.08 + rage * 0.12;
      queen.current.scale.setScalar(0.55 * integrity * pulse);
      queen.current.rotation.y = t * 1.4;
      queen.current.rotation.z = Math.sin(t * 2.1) * 0.2;
    }
  });

  return (
    <group ref={group} position={position}>
      <pointLight color="#ffb347" intensity={2.4 + Math.min(3, (enemy?.fire || 0) / 20)} distance={10} />
      <pointLight color="#ff3b1f" intensity={0.8 + Math.min(2.5, (enemy?.fire || 0) / 28)} distance={7} position={[0.4, 0.2, -0.3]} />

      <group ref={queen}>
        <mesh castShadow>
          <capsuleGeometry args={[0.22, 0.55, 6, 10]} />
          <meshStandardMaterial color="#1a1208" roughness={0.45} metalness={0.15} emissive="#4a1808" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0.08, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.28, 4, 8]} />
          <meshStandardMaterial color="#d4a017" roughness={0.4} emissive="#a86400" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-0.12, 0.42, 0]} rotation={[0, 0, 0.4]}>
          <coneGeometry args={[0.05, 0.28, 6]} />
          <meshStandardMaterial color="#2b1208" />
        </mesh>
        <mesh position={[0.05, 0.2, 0.18]} rotation={[0.3, 0.4, 0.8]}>
          <planeGeometry args={[0.55, 0.28]} />
          <meshStandardMaterial color="#f4e8c1" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0.05, 0.2, -0.18]} rotation={[-0.3, -0.4, -0.8]}>
          <planeGeometry args={[0.55, 0.28]} />
          <meshStandardMaterial color="#f4e8c1" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      <instancedMesh ref={beeBodies} args={[undefined, undefined, bees.length]} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f0c040" roughness={0.48} emissive="#6b4a00" emissiveIntensity={0.18} />
      </instancedMesh>
      <instancedMesh ref={waspBodies} args={[undefined, undefined, wasps.length]} castShadow>
        <capsuleGeometry args={[0.55, 1.35, 4, 8]} />
        <meshStandardMaterial color="#e8a018" roughness={0.42} emissive="#6b2a00" emissiveIntensity={0.2} />
      </instancedMesh>
      <instancedMesh ref={wings} args={[undefined, undefined, insects.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#fff6d8" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>

      {(enemy?.fire || 0) > 8 && (
        <mesh>
          <sphereGeometry args={[0.35 + (enemy.fire || 0) / 180, 12, 8]} />
          <meshBasicMaterial color="#ff5a1f" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

function SceneContent({ variant, player, enemy, crew, fogDense }) {
  const title = variant === "title";
  const playerRotation = title ? [0, 0.7, 0] : [0, 0.7 + (player?.heading || 0) * 0.004, 0];

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
        position={title ? [0, -0.05, 0] : [3.2, 0, 3.2]}
        rotation={playerRotation}
        scale={title ? 0.86 : 0.58}
        crew={title ? [] : crew}
        fire={player?.fire || 0}
        damage={100 - (player?.hull || 100)}
      />
      {!title && <EvilSwarm enemy={enemy} />}
      <CameraControls title={title} />
    </>
  );
}

export function OceanScene({ variant = "combat", player, enemy, crew = [], fogDense = false }) {
  const title = variant === "title";
  return (
    <Canvas
      className="ocean-canvas"
      tabIndex={title ? -1 : 0}
      aria-label={title ? "The Wayward Gull title diorama" : "3D combat camera"}
      shadows={THREE.PCFShadowMap}
      dpr={[1, 1.65]}
      camera={{ position: title ? [11.5, 7, 14] : [12, 12, 16], fov: title ? 39 : 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <SceneContent variant={variant} player={player} enemy={enemy} crew={crew} fogDense={fogDense} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/assets/models/ships/wayward-gull-detailed.glb");
