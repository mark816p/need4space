// src/pillars.js — Ring of colossal alien fluted columns in the ocean abyss
// Why: "P12 Ocean World Alien Pillars: ring of colossal alien fluted columns (650m to >1500m tall),
// twisting lobes, heavy collars, root buttresses, power conduits, emitter galleries, and upward-pulsing cyan energy veins."

import * as THREE from 'three';

export class AlienPillarsRing {
  constructor(scene, center = new THREE.Vector3(2000, -520, -3500), radius = 2200, count = 8) {
    this.scene = scene;
    this.center = center;
    this.radius = radius;
    this.count = count;

    this.group = new THREE.Group();
    this.group.name = 'alien_pillars_ring';
    this.scene.add(this.group);

    this.veinMats = [];
    this.pillars = [];

    this._buildPillarsRing();
  }

  _buildPillarsRing() {
    // 1. Structural Materials
    const darkBasaltMat = new THREE.MeshStandardMaterial({
      color: 0x12171e,
      roughness: 0.85,
      metalness: 0.3
    });

    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x1f2b38,
      roughness: 0.5,
      metalness: 0.65
    });

    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0x0a1017,
      roughness: 0.3,
      metalness: 0.8
    });

    // 2. Colossal Columns Ring
    for (let i = 0; i < this.count; i++) {
      const angle = (i / this.count) * Math.PI * 2;
      const px = this.center.x + Math.cos(angle) * this.radius;
      const pz = this.center.z + Math.sin(angle) * this.radius;

      // Heights range from 650m to >1500m (towering from deep seabed to above cloud deck)
      const height = 750.0 + (i % 3) * 420.0 + ((i * 137) % 350.0);
      const pillarGroup = new THREE.Group();
      pillarGroup.position.set(px, this.center.y, pz);

      // Fluted Main Shaft (multilobed cylinder)
      const shaftRadius = 38.0;
      const shaftGeom = new THREE.CylinderGeometry(shaftRadius * 0.75, shaftRadius, height, 16, 8);
      shaftGeom.translate(0, height * 0.5, 0);

      const shaft = new THREE.Mesh(shaftGeom, darkBasaltMat);
      shaft.rotation.y = angle * 0.5;
      pillarGroup.add(shaft);

      // Flared Root Buttresses anchored into the deep ocean floor
      const buttressCount = 6;
      for (let b = 0; b < buttressCount; b++) {
        const bAngle = (b / buttressCount) * Math.PI * 2;
        const bGeom = new THREE.BoxGeometry(16, 120, 75);
        bGeom.translate(0, 60, 45);
        const buttress = new THREE.Mesh(bGeom, darkBasaltMat);
        buttress.rotation.y = bAngle;
        pillarGroup.add(buttress);
      }

      // Heavy Structural Collars spaced along height
      const numCollars = Math.floor(height / 220);
      for (let c = 1; c <= numCollars; c++) {
        const collarY = c * 220.0;
        const cRadius = shaftRadius * 1.35;
        const cGeom = new THREE.CylinderGeometry(cRadius, cRadius, 28, 16);
        const collar = new THREE.Mesh(cGeom, collarMat);
        collar.position.y = collarY;
        pillarGroup.add(collar);

        // Emitter gallery windows around collar
        const emitterGeom = new THREE.BoxGeometry(cRadius * 2.1, 8, cRadius * 2.1);
        const emitterMat = new THREE.MeshBasicMaterial({
          color: 0x00d2ff,
          toneMapped: false
        });
        const emitter = new THREE.Mesh(emitterGeom, emitterMat);
        emitter.position.y = collarY;
        pillarGroup.add(emitter);
      }

      // Vertical Power Conduits & Upward-Pulsing Cyan Energy Veins
      const veinMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      this.veinMats.push(veinMat);

      for (let v = 0; v < 4; v++) {
        const vAngle = (v / 4) * Math.PI * 2;
        const vx = Math.cos(vAngle) * (shaftRadius + 2.5);
        const vz = Math.sin(vAngle) * (shaftRadius + 2.5);

        // Dark conduit housing
        const condGeom = new THREE.CylinderGeometry(2.5, 2.5, height, 6);
        condGeom.translate(0, height * 0.5, 0);
        const condMesh = new THREE.Mesh(condGeom, conduitMat);
        condMesh.position.set(vx, 0, vz);
        pillarGroup.add(condMesh);

        // Glowing energy vein strip inside conduit
        const veinGeom = new THREE.CylinderGeometry(1.2, 1.2, height, 4);
        veinGeom.translate(0, height * 0.5, 0);
        const veinMesh = new THREE.Mesh(veinGeom, veinMat);
        veinMesh.position.set(vx * 1.05, 0, vz * 1.05);
        pillarGroup.add(veinMesh);
      }

      this.group.add(pillarGroup);
      this.pillars.push({
        group: pillarGroup,
        height,
        phase: i * 0.85
      });
    }
  }

  update(dt, time) {
    // Upward-pulsing energy waves along cyan veins
    for (let i = 0; i < this.veinMats.length; i++) {
      const p = this.pillars[i];
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.5 - p.phase);
      this.veinMats[i].opacity = 0.45 + pulse * 0.5;
    }
  }
}
