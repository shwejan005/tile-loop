"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function highlightTile(selectedInstanceRef, nextInstance) {
  const previousInstance = selectedInstanceRef.current;
  if (previousInstance?.mesh === nextInstance?.mesh && previousInstance?.instanceId === nextInstance?.instanceId) return;
  if (previousInstance) {
    if (previousInstance.instanceId != null) {
      previousInstance.mesh.setColorAt(previousInstance.instanceId, previousInstance.baseColor);
      previousInstance.mesh.instanceColor.needsUpdate = true;
    } else {
      previousInstance.mesh.material.emissive.copy(previousInstance.baseEmissive);
      previousInstance.mesh.material.needsUpdate = true;
    }
  }
  selectedInstanceRef.current = nextInstance;
  if (nextInstance) {
    if (nextInstance.instanceId != null) {
      nextInstance.mesh.setColorAt(nextInstance.instanceId, new THREE.Color(0x00d4e8));
      nextInstance.mesh.instanceColor.needsUpdate = true;
    } else {
      nextInstance.mesh.material.emissive.setHex(0x00d4e8);
      nextInstance.mesh.material.needsUpdate = true;
    }
  }
}

function makeShapeGeometry(polygon, bounds) {
  const convert = ([x, y]) => [(x - bounds.minX) / 1000, (y - bounds.minY) / 1000];
  const addRing = (path, ring) => {
    const points = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
    if (!points.length) return;
    const [firstX, firstY] = convert(points[0]);
    path.moveTo(firstX, firstY);
    for (const point of points.slice(1)) {
      const [x, y] = convert(point);
      path.lineTo(x, y);
    }
    path.closePath();
  };
  const shape = new THREE.Shape();
  addRing(shape, polygon[0]);
  for (const hole of polygon.slice(1)) {
    const path = new THREE.Path();
    addRing(path, hole);
    shape.holes.push(path);
  }
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export default function RoomScene({ plan, selectedPieceNumber, onPieceSelect }) {
  const mountRef = useRef(null);
  const selectedMeshRef = useRef(null);
  const tileMeshByNumberRef = useRef(new Map());
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const host = mountRef.current;
    if (!host || !plan?.pieces?.length) return undefined;

    let renderer;
    let animationId = 0;
    let observer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#10181b");
    const maximumSide = Math.max(plan.roomWidth, plan.roomLength) / 1000;
    const width = plan.roomWidth / 1000;
    const length = plan.roomLength / 1000;
    const roomHeight = Math.min(2.2, maximumSide * 0.58);
    const roomLeft = -width / 2;
    const roomBack = -length / 2;
    const roomBounds = plan.bounds || { minX: 0, minY: 0 };
    const tileMeshes = [];
    const tileMeshByNumber = new Map();

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional tile layout. Drag to orbit, scroll to zoom, click a tile for its cut dimensions.");
      host.appendChild(renderer.domElement);
    } catch {
      setUnsupported(true);
      return undefined;
    }

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.05, maximumSide * 12 + 10);
    camera.position.set(width * 0.9 + maximumSide * 0.45, maximumSide * 1.15 + 0.2, length * 0.9 + maximumSide * 0.5);
    const controlsInstance = new OrbitControls(camera, renderer.domElement);
    controlsInstance.target.set(0, 0.08, 0);
    controlsInstance.enableDamping = true;
    controlsInstance.dampingFactor = 0.06;
    controlsInstance.enablePan = false;
    controlsInstance.minDistance = maximumSide * 0.65;
    controlsInstance.maxDistance = maximumSide * 4.5;
    controlsInstance.maxPolarAngle = Math.PI * 0.48;
    scene.add(new THREE.HemisphereLight(0xeafcff, 0x101719, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(width * 0.35 + maximumSide * 0.5, maximumSide * 2 + 0.7, -length * 0.35 - maximumSide * 0.7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -maximumSide * 1.4;
    key.shadow.camera.right = maximumSide * 1.4;
    key.shadow.camera.top = maximumSide * 1.4;
    key.shadow.camera.bottom = -maximumSide * 1.4;
    scene.add(key);
    const cyanRim = new THREE.PointLight(0x00d4e8, 8, maximumSide * 5);
    cyanRim.position.set(-width * 0.3, roomHeight * 0.4 + maximumSide * 0.45, length * 0.45 + maximumSide * 0.45);
    scene.add(cyanRim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(maximumSide * 5, maximumSide * 5),
      new THREE.MeshStandardMaterial({ color: 0x10181b, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.28;
    ground.receiveShadow = true;
    scene.add(ground);

    if (plan.geometryMode && plan.footprint?.length) {
      for (const polygon of plan.footprint) {
        const floor = new THREE.Mesh(
          makeShapeGeometry(polygon, roomBounds),
          new THREE.MeshStandardMaterial({ color: 0x253237, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide }),
        );
        floor.position.set(roomLeft, -0.15, roomBack);
        floor.receiveShadow = true;
        scene.add(floor);
      }
    } else {
      const groutBase = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.19, length),
        new THREE.MeshStandardMaterial({ color: 0x253237, roughness: 0.92, metalness: 0.05 }),
      );
      groutBase.position.set(0, -0.15, 0);
      groutBase.receiveShadow = true;
      scene.add(groutBase);
    }

    const roomEdges = [];
    const floorY = -0.055;
    const ceilingY = roomHeight;
    const x0 = roomLeft;
    const x1 = -roomLeft;
    const z0 = roomBack;
    const z1 = -roomBack;
    if (plan.geometryMode && plan.roomGeometry) {
      const zones = plan.roomGeometry.zones || [{ boundary: plan.roomGeometry.boundary }];
      for (const zone of zones) {
        const ring = zone.boundary;
        for (let index = 0; index < ring.length; index += 1) {
          const current = ring[index];
          const next = ring[(index + 1) % ring.length];
          const currentX = roomLeft + (current[0] - roomBounds.minX) / 1000;
          const currentZ = roomBack + (current[1] - roomBounds.minY) / 1000;
          const nextX = roomLeft + (next[0] - roomBounds.minX) / 1000;
          const nextZ = roomBack + (next[1] - roomBounds.minY) / 1000;
          roomEdges.push(
            new THREE.Vector3(currentX, floorY, currentZ), new THREE.Vector3(nextX, floorY, nextZ),
            new THREE.Vector3(currentX, floorY, currentZ), new THREE.Vector3(currentX, ceilingY, currentZ),
            new THREE.Vector3(currentX, ceilingY, currentZ), new THREE.Vector3(nextX, ceilingY, nextZ),
          );
        }
      }
    } else {
      const corners = [
        new THREE.Vector3(x0, floorY, z0), new THREE.Vector3(x1, floorY, z0),
        new THREE.Vector3(x1, floorY, z1), new THREE.Vector3(x0, floorY, z1),
        new THREE.Vector3(x0, ceilingY, z0), new THREE.Vector3(x1, ceilingY, z0),
        new THREE.Vector3(x1, ceilingY, z1), new THREE.Vector3(x0, ceilingY, z1),
      ];
      for (const [a, b] of [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]]) {
        roomEdges.push(corners[a], corners[b]);
      }
    }
    const wallLineGeometry = new THREE.BufferGeometry().setFromPoints(roomEdges);
    const wallLines = new THREE.LineSegments(wallLineGeometry, new THREE.LineBasicMaterial({ color: 0x00c9dc, transparent: true, opacity: 0.55 }));
    scene.add(wallLines);

    const tileHeight = 0.065;
    if (plan.geometryMode) {
      for (const piece of plan.pieces) {
        for (const polygon of piece.geometry || []) {
          const geometry = makeShapeGeometry(polygon, roomBounds);
          const material = new THREE.MeshStandardMaterial({
            color: piece.full ? 0xe6eef0 : 0x66e5f0,
            roughness: piece.full ? 0.28 : 0.3,
            metalness: piece.full ? 0.04 : 0.07,
            emissive: piece.full ? 0x071114 : 0x003c46,
            emissiveIntensity: piece.full ? 0.22 : 0.28,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(roomLeft, tileHeight / 2 - 0.025, roomBack);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.piece = piece;
          tileMeshByNumber.set(piece.number, { mesh, piece, baseEmissive: material.emissive.clone() });
          scene.add(mesh);
          tileMeshes.push(mesh);
        }
      }
    } else {
      const pieceGroups = new Map();
      for (const piece of plan.pieces) {
        const key = `${piece.full}:${piece.w}:${piece.h}`;
        const group = pieceGroups.get(key) || { full: piece.full, width: piece.w, length: piece.h, pieces: [] };
        group.pieces.push(piece);
        pieceGroups.set(key, group);
      }

      const position = new THREE.Object3D();
      for (const group of pieceGroups.values()) {
        const pieceWidth = group.width / 1000;
        const pieceLength = group.length / 1000;
        const geometry = new THREE.BoxGeometry(pieceWidth, tileHeight, pieceLength);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: group.full ? 0.28 : 0.3,
          metalness: group.full ? 0.04 : 0.07,
          emissive: group.full ? 0x071114 : 0x003c46,
          emissiveIntensity: group.full ? 0.22 : 0.28,
        });
        const mesh = new THREE.InstancedMesh(geometry, material, group.pieces.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.pieces = group.pieces;

        group.pieces.forEach((piece, instanceId) => {
          position.position.set(
            roomLeft + piece.x / 1000 + pieceWidth / 2,
            tileHeight / 2 - 0.025,
            roomBack + piece.y / 1000 + pieceLength / 2,
          );
          position.updateMatrix();
          mesh.setMatrixAt(instanceId, position.matrix);
          const baseColor = new THREE.Color(group.full ? 0xe6eef0 : 0x66e5f0);
          mesh.setColorAt(instanceId, baseColor);
          tileMeshByNumber.set(piece.number, { mesh, instanceId, piece, baseColor });
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        scene.add(mesh);
        tileMeshes.push(mesh);
      }
    }
    tileMeshByNumberRef.current = tileMeshByNumber;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = null;
    const down = (event) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const pickInstance = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(tileMeshes, false)[0];
      if (!hit || hit.instanceId == null) return null;
      const piece = hit.instanceId == null ? hit.object.userData.piece : hit.object.userData.pieces[hit.instanceId];
      if (!piece) return null;
      return tileMeshByNumber.get(piece.number) || null;
    };
    const move = (event) => {
      renderer.domElement.style.cursor = pickInstance(event) ? "pointer" : "grab";
    };
    const up = (event) => {
      if (!pointerStart) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7;
      pointerStart = null;
      if (moved) return;
      const hit = pickInstance(event);
      highlightTile(selectedMeshRef, hit);
      onPieceSelect?.(hit?.piece || null);
    };
    renderer.domElement.addEventListener("pointerdown", down, true);
    renderer.domElement.addEventListener("pointerup", up, true);
    renderer.domElement.addEventListener("pointermove", move, true);

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    observer = new ResizeObserver(resize);
    observer.observe(host);
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controlsInstance.update();
      renderer.render(scene, camera);
    };
    animate();
    setUnsupported(false);

    return () => {
      cancelAnimationFrame(animationId);
      observer?.disconnect();
      controlsInstance.dispose();
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointerup", up, true);
      renderer.domElement.removeEventListener("pointermove", move, true);
      selectedMeshRef.current = null;
      tileMeshByNumberRef.current = new Map();
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          const ownedMaterials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of ownedMaterials) {
            materials.add(material);
            if (material.map) textures.add(material.map);
          }
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [plan, onPieceSelect]);

  useEffect(() => {
    const selectedInstance = selectedPieceNumber == null
      ? null
      : tileMeshByNumberRef.current.get(selectedPieceNumber) || null;
    highlightTile(selectedMeshRef, selectedInstance);
  }, [selectedPieceNumber]);

  return (
    <div className="scene-shell">
      <div className="scene-stage" ref={mountRef}>
        {unsupported && <div className="scene-fallback">3D preview needs a browser with WebGL enabled.</div>}
      </div>
      <div className="scene-hud scene-hud-top"><span className="scene-dot" /> LIVE MODEL <span className="hud-divider" /> {plan.columns.length} × {plan.rows.length} GRID</div>
      <div className="scene-hud scene-hud-bottom"><span>DRAG TO ORBIT</span><span className="hud-divider" /><span>SCROLL TO ZOOM</span></div>
      <div className="axis-tag">X <i /> Z</div>
    </div>
  );
}
