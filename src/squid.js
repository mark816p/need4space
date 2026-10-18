// src/squid.js — The Kraken colossal cephalopod on grid sea stack
// Why: "P12 Ocean World Kraken: perched on grid sea stack with amber eyes, pumping mantle,
// writhing arms, lashing tentacle, slow creep around rock, tracking ships, and surface table texture."

import * as THREE from 'three';

export class KrakenSquid {
  constructor(scene, stackPos = new THREE.Vector3(120, 22, 2820)) {
    this.scene = scene;
    this.stackPos = stackPos;
    this.group = new THREE.Group();
    this.group.name = 'kraken_colossus';
    this.group.position.copy(stackPos);
    this.scene.add(this.group);

    this.arms = [];
    this.tentacles = [];
    this.creepAngle = 0.0;

    this._buildKraken();
  }

  _buildKraken() {
    // 1. Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x4a1818, // Deep maroon cephalopod skin
      roughness: 0.45,
      metalness: 0.25
    });

    const suckerMat = new THREE.MeshStandardMaterial({
      color: 0xd8c8b8,
      roughness: 0.6,
      metalness: 0.1
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00, // Glowing amber eyes
      toneMapped: false
    });

    const pupilMat = new THREE.MeshBasicMaterial({
      color: 0x050505
    });

    // 2. Head & Pumping Mantle
    // Torpedo/bullet mantle shape (length: 22m, width: 8m)
    this.mantleGroup = new THREE.Group();
    this.mantleGroup.position.set(0, 8, 0);

    const mantleGeom = new THREE.SphereGeometry(6.5, 16, 16);
    mantleGeom.scale(1.0, 1.8, 1.0);
    mantleGeom.rotateX(Math.PI * 0.25);
    this.mantleMesh = new THREE.Mesh(mantleGeom, skinMat);
    this.mantleGroup.add(this.mantleMesh);

    // Lateral swimming fins on tip of mantle
    const finGeom = new THREE.ConeGeometry(5.5, 9.0, 4);
    finGeom.rotateZ(Math.PI * 0.5);
    const finMesh = new THREE.Mesh(finGeom, skinMat);
    finMesh.position.set(0, 10, -5);
    this.mantleGroup.add(finMesh);

    // Head base with 2 large amber eyes
    const headGeom = new THREE.SphereGeometry(5.2, 16, 14);
    const headMesh = new THREE.Mesh(headGeom, skinMat);
    headMesh.position.set(0, 1, 3);
    this.mantleGroup.add(headMesh);

    // Amber Slit Eyes (Left and Right)
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eyeGlobe = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), eyeMat);
      eyeGlobe.position.set(side * 4.4, 2, 4.2);
      this.mantleGroup.add(eyeGlobe);

      // Horizontal slit pupil
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 1.7), pupilMat);
      pupil.position.set(side * 4.6, 2, 4.6);
      pupil.rotation.y = side * 0.3;
      this.mantleGroup.add(pupil);

      this.eyes.push(eyeGlobe);
    }

    this.group.add(this.mantleGroup);

    // 3. 8 Writhing Arms (length: ~28m each, wrapping basalt sea stack)
    const armSegments = 7;
    for (let a = 0; a < 8; a++) {
      const armGroup = new THREE.Group();
      const baseAngle = (a / 8) * Math.PI * 2;
      armGroup.position.set(Math.cos(baseAngle) * 3.8, 1, Math.sin(baseAngle) * 3.8);

      const armParts = [];
      let parentObj = armGroup;

      for (let s = 0; s < armSegments; s++) {
        const segRadius = (1.0 - (s / armSegments) * 0.75) * 1.6;
        const segLen = 4.2;
        const segGeom = new THREE.CylinderGeometry(segRadius * 0.85, segRadius, segLen, 8);
        segGeom.translate(0, segLen * 0.5, 0);

        const segMesh = new THREE.Mesh(segGeom, skinMat);
        if (s > 0) segMesh.position.y = 4.0;
        parentObj.add(segMesh);

        // Suction cups along inner underside
        const sucker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 6), suckerMat);
        sucker.position.set(0, segLen * 0.5, segRadius * 0.9);
        sucker.rotation.x = Math.PI * 0.5;
        segMesh.add(sucker);

        armParts.push(segMesh);
        parentObj = segMesh;
      }

      this.group.add(armGroup);
      this.arms.push({
        baseAngle,
        group: armGroup,
        parts: armParts,
        phase: a * 0.78,
        speed: 1.2 + Math.random() * 0.4
      });
    }

    // 4. 2 Extra Long Lashing Tentacles (length: ~55m, with club at tip)
    for (let t = 0; t < 2; t++) {
      const tentGroup = new THREE.Group();
      const side = (t === 0 ? -1 : 1);
      tentGroup.position.set(side * 3.5, 0, 5.0);

      const tentParts = [];
      let parentObj = tentGroup;
      const tentSegments = 10;

      for (let s = 0; s < tentSegments; s++) {
        const segRadius = (s === tentSegments - 1 ? 1.8 : (1.0 - (s / tentSegments) * 0.5) * 0.9);
        const segLen = 5.2;
        const segGeom = new THREE.CylinderGeometry(segRadius * 0.9, segRadius, segLen, 8);
        segGeom.translate(0, 0, segLen * 0.5);

        const segMesh = new THREE.Mesh(segGeom, skinMat);
        if (s > 0) segMesh.position.z = 5.0;
        parentObj.add(segMesh);

        tentParts.push(segMesh);
        parentObj = segMesh;
      }

      this.group.add(tentGroup);
      this.tentacles.push({
        side,
        group: tentGroup,
        parts: tentParts,
        phase: t * Math.PI,
        lashSpeed: 1.6
      });
    }
  }

  update(dt, time, shipPos = null) {
    // 1. Rhythmic mantle pumping / breathing respiration
    const breath = Math.sin(time * 2.2);
    const mantleScale = 1.0 + breath * 0.08;
    this.mantleMesh.scale.set(mantleScale, 1.8 * (1.0 - breath * 0.04), mantleScale);

    // 2. Slow creep around the basalt sea stack
    this.creepAngle += dt * 0.04;
    this.group.position.x = this.stackPos.x + Math.cos(this.creepAngle) * 8.0;
    this.group.position.z = this.stackPos.z + Math.sin(this.creepAngle) * 8.0;

    // 3. Head & Eye tracking passing ships
    if (shipPos) {
      const dirToShip = new THREE.Vector3().subVectors(shipPos, this.group.position);
      const targetAngle = Math.atan2(dirToShip.x, dirToShip.z);
      // Smoothly rotate mantle towards ship
      const curRot = this.mantleGroup.rotation.y;
      this.mantleGroup.rotation.y += (targetAngle - curRot) * dt * 1.5;
    }

    // 4. Writhing arms wrapping rock
    for (let a = 0; a < this.arms.length; a++) {
      const arm = this.arms[a];
      const armWave = Math.sin(time * arm.speed + arm.phase);
      for (let s = 0; s < arm.parts.length; s++) {
        const seg = arm.parts[s];
        seg.rotation.x = Math.sin(time * 1.5 + s * 0.4 + arm.phase) * 0.22 - 0.2;
        seg.rotation.z = Math.cos(time * 1.2 + s * 0.5 + arm.phase) * 0.18;
      }
    }

    // 5. Long lashing tentacles reaching out
    for (let t = 0; t < this.tentacles.length; t++) {
      const tent = this.tentacles[t];
      const lash = Math.sin(time * tent.lashSpeed + tent.phase);
      for (let s = 0; s < tent.parts.length; s++) {
        const seg = tent.parts[s];
        seg.rotation.x = Math.sin(time * 2.5 + s * 0.3) * 0.15;
        seg.rotation.y = tent.side * (0.12 + Math.cos(time * 2.0 + s * 0.4) * 0.15);
      }
    }
  }
}
