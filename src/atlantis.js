// src/atlantis.js — Sunken city of pale stone, Great Gate above water, colonnade avenue, Great Dome, hypostyle hall, aqueduct
// Why: "P11.3 Atlantis (atlantis.js): city of pale stone that sank whole, still lit. Great Gate whose attic & braziers stand
// above water, avenue between tall colonnades, great dome, hypostyle temple hall, aqueduct arcade, sunken towers.
// Vertex-baked lighting from underwater lamps. Visible only within optical penetration depth of the water (teal murk)."

import * as THREE from 'three';

export class AtlantisCity {
  constructor(scene, centerPos = new THREE.Vector3(2400, -380, -4200)) {
    this.scene = scene;
    this.centerPos = centerPos.clone();
    this.group = new THREE.Group();
    this.group.name = 'atlantis_drowned_city';
    this.group.position.copy(this.centerPos);

    this.cityLamps = [];
    this.braziers = [];
    this.time = 0.0;

    this._buildCity();
    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  _buildCity() {
    // Shared materials
    const paleStoneMat = new THREE.MeshStandardMaterial({
      color: 0xdbe0e8, // Pale limestone/marble that sank whole
      roughness: 0.65,
      metalness: 0.12
    });

    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x28323c,
      roughness: 0.75,
      metalness: 0.3
    });

    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x4a7a72, // Patinated bronze and stone rotunda
      roughness: 0.5,
      metalness: 0.6
    });

    const lampMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      toneMapped: false
    });

    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      toneMapped: false
    });

    // 1. The Great Gate (Colossal portal whose attic & braziers stand above water)
    // Located at local offset (-1200, 380, 2600) so world Y reaches +18m above sea level (sea Y=0)
    this.greatGate = new THREE.Group();
    this.greatGate.name = 'atlantis_great_gate';
    this.greatGate.position.set(-1200, 350, 2600);

    const pylonGeom = new THREE.BoxGeometry(18, 95, 24);
    const pylonL = new THREE.Mesh(pylonGeom, paleStoneMat);
    pylonL.position.set(-42, 20, 0);
    this.greatGate.add(pylonL);

    const pylonR = new THREE.Mesh(pylonGeom, paleStoneMat);
    pylonR.position.set(42, 20, 0);
    this.greatGate.add(pylonR);

    // Arch attic standing above water surface (y = +45 local -> world y = +15m)
    const atticGeom = new THREE.BoxGeometry(105, 24, 28);
    const atticMesh = new THREE.Mesh(atticGeom, paleStoneMat);
    atticMesh.position.set(0, 72, 0);
    this.greatGate.add(atticMesh);

    // Flaming braziers on the attic corners standing above water
    const brazierGeom = new THREE.CylinderGeometry(3.5, 2.2, 5.0, 8);
    const fireGeom = new THREE.SphereGeometry(2.5, 8, 8);
    const bzOffsets = [-45, 45];
    for (const bzX of bzOffsets) {
      const bzMesh = new THREE.Mesh(brazierGeom, darkStoneMat);
      bzMesh.position.set(bzX, 86, 0);
      this.greatGate.add(bzMesh);

      const fire = new THREE.Mesh(fireGeom, fireMat.clone());
      fire.position.set(bzX, 89, 0);
      this.greatGate.add(fire);
      this.braziers.push(fire);
    }
    this.group.add(this.greatGate);

    // 2. Avenue Between Tall Colonnades (32 fluted columns lining submerged avenue)
    this.colonnade = new THREE.Group();
    this.colonnade.name = 'atlantis_colonnade_avenue';
    const colGeom = new THREE.CylinderGeometry(2.2, 2.8, 48, 12);
    const entablatureGeom = new THREE.BoxGeometry(6.0, 4.0, 480);

    for (let c = 0; c < 16; c++) {
      const z = -200 + c * 30;

      // Left column
      const colL = new THREE.Mesh(colGeom, paleStoneMat);
      colL.position.set(-36, 24, z);
      this.colonnade.add(colL);

      // Right column
      const colR = new THREE.Mesh(colGeom, paleStoneMat);
      colR.position.set(36, 24, z);
      this.colonnade.add(colR);

      // Inlaid underwater guide lamps
      const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), lampMat);
      lampMesh.position.set(0, 1.2, z);
      this.colonnade.add(lampMesh);
      this.cityLamps.push(lampMesh);
    }

    // Continuous entablatures resting on column heads
    const entL = new THREE.Mesh(entablatureGeom, paleStoneMat);
    entL.position.set(-36, 50, 25);
    this.colonnade.add(entL);
    const entR = new THREE.Mesh(entablatureGeom, paleStoneMat);
    entR.position.set(36, 50, 25);
    this.colonnade.add(entR);
    this.group.add(this.colonnade);

    // 3. The Sunken Great Dome (180m rotunda with glowing stained-glass lantern)
    this.greatDome = new THREE.Group();
    this.greatDome.name = 'atlantis_great_dome';
    this.greatDome.position.set(160, 40, -650);

    // Rotunda base drum
    const rotundaDrumGeom = new THREE.CylinderGeometry(90, 95, 60, 24);
    const rotundaDrum = new THREE.Mesh(rotundaDrumGeom, paleStoneMat);
    rotundaDrum.position.set(0, 30, 0);
    this.greatDome.add(rotundaDrum);

    // Hemispherical Cupola Dome
    const domeGeom = new THREE.SphereGeometry(90, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMesh = new THREE.Mesh(domeGeom, domeMat);
    domeMesh.position.set(0, 60, 0);
    this.greatDome.add(domeMesh);

    // Illuminated Lantern Cupola at apex
    const lanternCupolaGeom = new THREE.CylinderGeometry(14, 14, 25, 12);
    const lanternCupola = new THREE.Mesh(lanternCupolaGeom, paleStoneMat);
    lanternCupola.position.set(0, 155, 0);
    this.greatDome.add(lanternCupola);

    const domeLantern = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 12), lampMat);
    domeLantern.position.set(0, 172, 0);
    this.greatDome.add(domeLantern);
    this.cityLamps.push(domeLantern);

    this.group.add(this.greatDome);

    // 4. Hypostyle Temple Hall (24 stone pillars supporting architrave cross-beams)
    this.hypostyleHall = new THREE.Group();
    this.hypostyleHall.name = 'atlantis_hypostyle_hall';
    this.hypostyleHall.position.set(-80, 20, -1350);

    const pillarGeom = new THREE.BoxGeometry(4.5, 42, 4.5);
    const architraveGeom = new THREE.BoxGeometry(90, 4.5, 8.0);

    for (let r = 0; r < 6; r++) {
      const z = r * 35;
      for (let p = -2; p <= 2; p++) {
        if (p === 0) continue; // Clear central track corridor
        const pillar = new THREE.Mesh(pillarGeom, paleStoneMat);
        pillar.position.set(p * 22, 21, z);
        this.hypostyleHall.add(pillar);
      }
      // Architrave beam spanning across corridor
      const beam = new THREE.Mesh(architraveGeom, paleStoneMat);
      beam.position.set(0, 43, z);
      this.hypostyleHall.add(beam);
    }
    this.group.add(this.hypostyleHall);

    // 5. Aqueduct Arcade (Two-tier classical stone aqueduct spanning over roadway)
    this.aqueduct = new THREE.Group();
    this.aqueduct.name = 'atlantis_aqueduct_arcade';
    this.aqueduct.position.set(0, 0, -1850);

    const archPierGeom = new THREE.BoxGeometry(8, 75, 14);
    const pierL = new THREE.Mesh(archPierGeom, paleStoneMat);
    pierL.position.set(-45, 37.5, 0);
    this.aqueduct.add(pierL);

    const pierR = new THREE.Mesh(archPierGeom, paleStoneMat);
    pierR.position.set(45, 37.5, 0);
    this.aqueduct.add(pierR);

    // Two-tier arched spans
    const lowerSpanGeom = new THREE.BoxGeometry(110, 8, 14);
    const lowerSpan = new THREE.Mesh(lowerSpanGeom, paleStoneMat);
    lowerSpan.position.set(0, 52, 0);
    this.aqueduct.add(lowerSpan);

    const upperSpanGeom = new THREE.BoxGeometry(125, 12, 10);
    const upperSpan = new THREE.Mesh(upperSpanGeom, paleStoneMat);
    upperSpan.position.set(0, 78, 0);
    this.aqueduct.add(upperSpan);

    this.group.add(this.aqueduct);

    // 6. Sunken Towers & Obelisks
    const towerGeom = new THREE.CylinderGeometry(8, 14, 110, 8);
    for (let t = 0; t < 6; t++) {
      const angle = (t * Math.PI) / 3.0;
      const dist = 320 + (t % 2) * 140;
      const tower = new THREE.Mesh(towerGeom, paleStoneMat);
      tower.position.set(Math.cos(angle) * dist, 55, Math.sin(angle) * dist - 800);
      this.group.add(tower);
    }
  }

  update(dt, camera) {
    this.time += dt;

    // Flickering braziers above sea surface
    for (let i = 0; i < this.braziers.length; i++) {
      const bz = this.braziers[i];
      const flicker = 0.85 + Math.sin(this.time * 12.0 + i * 2.5) * 0.15;
      bz.scale.set(flicker, flicker, flicker);
    }

    // Optical penetration depth culling in teal murk
    if (camera) {
      const camPos = camera.position;
      const worldCenter = this.group.position;
      const d = camPos.distanceTo(worldCenter);
      // Murk optical limit: ~2200m
      this.group.visible = d < 2600.0;
    }
  }
}
