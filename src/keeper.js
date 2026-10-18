// src/keeper.js — Colossal Keeper statue, basalt pedestal 520m down, bronze robes, staff lantern, and 3 LOD detail levels
// Why: "P11.3 The Keeper (keeper.js): colossal statue on a basalt pedestal 520m down, positioned so the dive road
// spirals between its robe and its staff, 17m clear of track frames at nearest. 3 detail levels by distance."

import * as THREE from 'three';

export class KeeperStatue {
  constructor(scene, centerPos = new THREE.Vector3(1200, -520, -2800)) {
    this.scene = scene;
    this.centerPos = centerPos.clone(); // Pedestal base at 520m below sea level
    this.group = new THREE.Group();
    this.group.name = 'the_keeper_statue';
    this.group.position.copy(this.centerPos);

    this.lodLevels = [];
    this.currentLod = 0;

    this._buildStatue();
    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  _buildStatue() {
    // Shared materials
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e242d,
      roughness: 0.85,
      metalness: 0.25
    });

    const bronzeRobeMat = new THREE.MeshStandardMaterial({
      color: 0x3d7564, // Verdigris patinated green bronze
      roughness: 0.55,
      metalness: 0.65
    });

    const lanternMat = new THREE.MeshBasicMaterial({
      color: 0xffe299,
      toneMapped: false
    });

    // 1. Basalt Pedestal (Stepped octagonal plinth 520m down)
    const plinthGeom = new THREE.CylinderGeometry(85, 110, 90, 8);
    const plinth = new THREE.Mesh(plinthGeom, basaltMat);
    plinth.position.set(0, 45, 0);
    this.group.add(plinth);

    // 2. High-Detail Model (LOD 0)
    const lod0 = new THREE.Group();
    lod0.name = 'keeper_lod0';

    // Massive flowing bronze robe base
    const robeBaseGeom = new THREE.ConeGeometry(68, 220, 16);
    const robeBase = new THREE.Mesh(robeBaseGeom, bronzeRobeMat);
    robeBase.position.set(0, 190, 0);
    lod0.add(robeBase);

    // Sculpted basalt torso & breastplate
    const torsoGeom = new THREE.BoxGeometry(45, 80, 32);
    const torso = new THREE.Mesh(torsoGeom, basaltMat);
    torso.position.set(0, 310, 0);
    lod0.add(torso);

    // Robe mantle folds
    for (let f = 0; f < 8; f++) {
      const foldGeom = new THREE.BoxGeometry(14, 160, 12);
      const fold = new THREE.Mesh(foldGeom, bronzeRobeMat);
      const angle = (f * Math.PI * 2) / 8.0;
      fold.position.set(Math.cos(angle) * 36, 210, Math.sin(angle) * 28);
      fold.rotation.z = (f % 2 === 0 ? 0.08 : -0.08);
      lod0.add(fold);
    }

    // Majestic Crowned Basalt Head
    const headGeom = new THREE.BoxGeometry(24, 32, 26);
    const head = new THREE.Mesh(headGeom, basaltMat);
    head.position.set(0, 375, 4);
    lod0.add(head);

    // Radiate bronze crown
    const crownGeom = new THREE.ConeGeometry(22, 18, 7);
    crownGeom.rotateX(Math.PI);
    const crown = new THREE.Mesh(crownGeom, bronzeRobeMat);
    crown.position.set(0, 396, 4);
    lod0.add(crown);

    // Raised Staff & Lantern Arm
    // Left arm down across robe; Right arm raised holding staff
    const staffArmGeom = new THREE.CylinderGeometry(6, 7, 95, 8);
    const staffArm = new THREE.Mesh(staffArmGeom, bronzeRobeMat);
    staffArm.position.set(38, 345, 12);
    staffArm.rotation.z = -0.55;
    lod0.add(staffArm);

    // Monumental bronze staff
    const staffGeom = new THREE.CylinderGeometry(4.5, 5.5, 290, 8);
    const staff = new THREE.Mesh(staffGeom, bronzeRobeMat);
    staff.position.set(65, 330, 24);
    lod0.add(staff);

    // The Lantern Housing & Beacon (holding lantern high over sea)
    const lanternHousingGeom = new THREE.BoxGeometry(28, 42, 28);
    const lanternHousing = new THREE.Mesh(lanternHousingGeom, bronzeRobeMat);
    lanternHousing.position.set(65, 475, 24);
    lod0.add(lanternHousing);

    const lanternCoreGeom = new THREE.SphereGeometry(12, 16, 16);
    const lanternCore = new THREE.Mesh(lanternCoreGeom, lanternMat);
    lanternCore.position.set(65, 475, 24);
    lod0.add(lanternCore);

    this.group.add(lod0);
    this.lodLevels.push({ group: lod0, maxDist: 750.0 });

    // 3. Mid-Detail Model (LOD 1: simplified masses)
    const lod1 = new THREE.Group();
    lod1.name = 'keeper_lod1';
    lod1.visible = false;

    const midBodyGeom = new THREE.CylinderGeometry(25, 65, 320, 8);
    const midBody = new THREE.Mesh(midBodyGeom, bronzeRobeMat);
    midBody.position.set(0, 240, 0);
    lod1.add(midBody);

    const midStaffGeom = new THREE.CylinderGeometry(5, 5, 280, 6);
    const midStaff = new THREE.Mesh(midStaffGeom, bronzeRobeMat);
    midStaff.position.set(65, 330, 24);
    lod1.add(midStaff);

    const midLantern = new THREE.Mesh(new THREE.BoxGeometry(24, 35, 24), lanternMat);
    midLantern.position.set(65, 475, 24);
    lod1.add(midLantern);

    this.group.add(lod1);
    this.lodLevels.push({ group: lod1, maxDist: 2200.0 });

    // 4. Low-Detail Model (LOD 2: bounding silhouette)
    const lod2 = new THREE.Group();
    lod2.name = 'keeper_lod2';
    lod2.visible = false;

    const silhouetteGeom = new THREE.ConeGeometry(75, 480, 6);
    const silhouette = new THREE.Mesh(silhouetteGeom, basaltMat);
    silhouette.position.set(10, 240, 0);
    lod2.add(silhouette);

    this.group.add(lod2);
    this.lodLevels.push({ group: lod2, maxDist: 10000.0 });

    // Critical clearance check reference points
    // Nearest point on robe: (32, 280, 0); Staff base: (65, 280, 24)
    this.robeClearancePos = new THREE.Vector3().copy(this.centerPos).add(new THREE.Vector3(32, 280, 0));
    this.staffClearancePos = new THREE.Vector3().copy(this.centerPos).add(new THREE.Vector3(65, 280, 24));
  }

  // Returns nearest clearance distance to track frames (nominal 17m at spiral apex)
  getMinClearance(trackFramePos) {
    const dRobe = trackFramePos.distanceTo(this.robeClearancePos);
    const dStaff = trackFramePos.distanceTo(this.staffClearancePos);
    return Math.min(dRobe, dStaff);
  }

  update(dt, camera) {
    if (!camera) return;
    const camPos = camera.position;
    const dist = camPos.distanceTo(this.centerPos);

    // Select active LOD level
    let activeIdx = 2; // Default to LOD 2
    if (dist < 750.0) {
      activeIdx = 0;
    } else if (dist < 2200.0) {
      activeIdx = 1;
    }

    if (activeIdx !== this.currentLod) {
      this.currentLod = activeIdx;
      for (let i = 0; i < this.lodLevels.length; i++) {
        this.lodLevels[i].group.visible = (i === activeIdx);
      }
    }
  }
}
