// src/skeleton.js — The Colossal Skeleton (reptilian skull, fangs, palate ribs, plunging spine & ribcage)
// Why: Track passes into jaws, under palate ribs, and out the back of skull; neck plunges 1.2 km to jungle ribcage
import * as THREE from 'three';
import { TRACK_W } from './track.js';

export const SKULL_PASSAGE_W = 56.0; // Acceptance criterion: Skull must be passable at 56 m road width

export function createBoneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xdfd7c6,
    roughness: 0.88,
    metalness: 0.05
  });
}

export class ColossalSkeleton {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();

    this.boneMat = createBoneMaterial();
    this.mossBoneMat = new THREE.MeshStandardMaterial({
      color: 0x6e7d62,
      roughness: 0.92,
      metalness: 0.04
    });

    if (track) {
      this._buildSkeleton();
    }

    scene.add(this.group);
  }

  _buildSkeleton() {
    const sEntry = 10400; // Track arc length entry
    const _f = {};
    this.track.frame(sEntry, _f);

    const skullCenter = _f.pos.clone().addScaledVector(_f.U, 14.0);
    const skullGroup = new THREE.Group();
    skullGroup.position.copy(skullCenter);

    // Align skull forward with track tangent
    const rotMat = new THREE.Matrix4().makeBasis(_f.R, _f.U, _f.T);
    skullGroup.setRotationFromMatrix(rotMat);

    // 1. Upper Jaw Arch & Palate Ribs (Width > 64m to clear 56m road, Height 36m over track)
    const spanHalf = SKULL_PASSAGE_W * 0.5;
    const jawArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-(spanHalf + 8), 0, -40),
      new THREE.Vector3(-(spanHalf + 6), 26, -20),
      new THREE.Vector3(0, 34, 0),
      new THREE.Vector3((spanHalf + 6), 26, -20),
      new THREE.Vector3((spanHalf + 8), 0, -40)
    ]);
    const jawArchGeo = new THREE.TubeGeometry(jawArchCurve, 24, 4.5, 8, false);
    const jawArchMesh = new THREE.Mesh(jawArchGeo, this.boneMat);
    skullGroup.add(jawArchMesh);

    // Palate ribs spanning overhead
    for (let r = -30; r <= 30; r += 15) {
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-(spanHalf + 4), 6, r),
        new THREE.Vector3(0, 28, r + 4),
        new THREE.Vector3((spanHalf + 4), 6, r)
      ]);
      const ribGeo = new THREE.TubeGeometry(ribCurve, 16, 2.2, 6, false);
      skullGroup.add(new THREE.Mesh(ribGeo, this.boneMat));
    }

    // 2. Colossal Fangs & Tooth Rows
    const fangGeo = new THREE.ConeGeometry(2.4, 16.0, 6);
    fangGeo.rotateX(Math.PI); // Point downward into jaws

    const fangPositions = [
      [-spanHalf - 2, 22, -18],
      [-spanHalf + 4, 26, -6],
      [-14, 30, 2],
      [14, 30, 2],
      [spanHalf - 4, 26, -6],
      [spanHalf + 2, 22, -18],
    ];

    for (const [fx, fy, fz] of fangPositions) {
      const fang = new THREE.Mesh(fangGeo, this.boneMat);
      fang.position.set(fx, fy - 6, fz);
      // Slight inward curvature
      fang.rotation.z = (fx > 0 ? -0.18 : 0.18);
      skullGroup.add(fang);
    }

    // 3. Cranium Dome, Eye Sockets (Orbits), and Antorbital Fenestrae
    const craniumGeo = new THREE.SphereGeometry(32.0, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65);
    craniumGeo.scale(1.2, 0.85, 1.8);
    const craniumMesh = new THREE.Mesh(craniumGeo, this.mossBoneMat);
    craniumMesh.position.set(0, 24, 60);
    skullGroup.add(craniumMesh);

    // Horn Crests projecting backwards
    const hornCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-18, 32, 85),
      new THREE.Vector3(-28, 48, 120),
      new THREE.Vector3(-38, 62, 165)
    ]);
    const hornCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(18, 32, 85),
      new THREE.Vector3(28, 48, 120),
      new THREE.Vector3(38, 62, 165)
    ]);
    skullGroup.add(new THREE.Mesh(new THREE.TubeGeometry(hornCurveL, 16, 3.8, 6, false), this.boneMat));
    skullGroup.add(new THREE.Mesh(new THREE.TubeGeometry(hornCurveR, 16, 3.8, 6, false), this.boneMat));

    this.group.add(skullGroup);

    // 4. Plunging Spine: Chain of cervical vertebrae descending 1.2 km into the abyss
    const spineVertsCount = 28;
    const vertGeo = new THREE.BoxGeometry(16, 12, 18);
    const spineCurve = new THREE.CatmullRomCurve3([
      skullCenter.clone().addScaledVector(_f.T, 140),
      skullCenter.clone().add(new THREE.Vector3(60, -280, 250)),
      skullCenter.clone().add(new THREE.Vector3(140, -680, 420)),
      skullCenter.clone().add(new THREE.Vector3(220, -1180, 650)), // Deep in canopy
    ]);

    for (let i = 0; i < spineVertsCount; i++) {
      const t = i / (spineVertsCount - 1);
      const pt = spineCurve.getPoint(t);
      const tangent = spineCurve.getTangent(t);

      const vertMesh = new THREE.Mesh(vertGeo, this.mossBoneMat);
      vertMesh.position.copy(pt);
      vertMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      this.group.add(vertMesh);

      // Deep abyss rib cage (t > 0.65)
      if (t > 0.65) {
        const ribArcCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-90, -35, 0),
          new THREE.Vector3(-120, 10, 0),
          new THREE.Vector3(0, 45, 0),
          new THREE.Vector3(120, 10, 0),
          new THREE.Vector3(90, -35, 0)
        ]);
        const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(ribArcCurve, 16, 3.2, 6, false), this.mossBoneMat);
        ribMesh.position.copy(pt);
        this.group.add(ribMesh);
      }
    }
  }
}
