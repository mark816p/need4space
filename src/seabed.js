// src/seabed.js — Ocean seabed environment: pinnacles, kelp beds, hydrothermal vents, fish shoals, lanternfish, crabs
// Why: "P12 Ocean World Seabed: seabed pinnacles (60-200m off), kelp beds, hydrothermal bubble vents,
// multi-species fish shoals (sardines, tuna, red snappers), deep lanternfish, spiny road-crossing crabs, and grass tufts."

import * as THREE from 'three';

export class SeabedEnvironment {
  constructor(scene, track = null) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'seabed_environment';
    this.scene.add(this.group);

    this.kelpFronds = [];
    this.bubbleVents = [];
    this.fishShoals = [];
    this.lanternfish = [];
    this.crabs = [];

    this._buildPinnacles();
    this._buildKelpBeds();
    this._buildHydrothermalVents();
    this._buildFishShoals();
    this._buildLanternfish();
    this._buildCrabs();
    this._buildGrassTufts();
  }

  _buildPinnacles() {
    // Abyssal basalt pinnacles and spires located 60m to 200m off the track
    const pinnacleMat = new THREE.MeshStandardMaterial({
      color: 0x182028,
      roughness: 0.92,
      metalness: 0.15
    });

    const pinnacleGeoms = [
      new THREE.ConeGeometry(35, 240, 7),
      new THREE.CylinderGeometry(15, 45, 280, 8),
      new THREE.ConeGeometry(45, 320, 8)
    ];

    // Seeded locations around the deep abyss sectors (y: -520 to -350)
    const pinnacleLocs = [
      { x: 1380, y: -400, z: -2650, s: 1.2 },
      { x: 1020, y: -420, z: -2980, s: 1.4 },
      { x: 1450, y: -380, z: -3120, s: 1.1 },
      { x: 920,  y: -390, z: -2620, s: 1.5 },
      { x: 1650, y: -360, z: -3400, s: 1.3 },
      { x: 1980, y: -370, z: -3750, s: 1.6 },
      { x: 2750, y: -350, z: -3950, s: 1.4 },
      { x: 2150, y: -340, z: -4450, s: 1.2 },
      { x: 2850, y: -320, z: -4500, s: 1.5 }
    ];

    for (let i = 0; i < pinnacleLocs.length; i++) {
      const loc = pinnacleLocs[i];
      const geom = pinnacleGeoms[i % pinnacleGeoms.length];
      const mesh = new THREE.Mesh(geom, pinnacleMat);
      mesh.position.set(loc.x, loc.y, loc.z);
      mesh.scale.set(loc.s, loc.s, loc.s);
      mesh.rotation.y = i * 1.7;
      mesh.rotation.z = (i % 2 === 0 ? 0.08 : -0.08);
      this.group.add(mesh);
    }
  }

  _buildKelpBeds() {
    // Swaying giant kelp forests along the seabed floor
    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x1a4528,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const bedCenters = [
      new THREE.Vector3(1350, -480, -2900),
      new THREE.Vector3(1600, -470, -3300),
      new THREE.Vector3(2200, -450, -4000),
      new THREE.Vector3(2550, -440, -4300)
    ];

    for (const center of bedCenters) {
      for (let k = 0; k < 18; k++) {
        const h = 45.0 + Math.random() * 35.0;
        const kelpGeo = new THREE.CylinderGeometry(0.3, 0.9, h, 5, 6);
        kelpGeo.translate(0, h * 0.5, 0);
        const mesh = new THREE.Mesh(kelpGeo, kelpMat);

        const ox = (Math.random() - 0.5) * 80.0;
        const oz = (Math.random() - 0.5) * 80.0;
        mesh.position.set(center.x + ox, center.y, center.z + oz);

        this.group.add(mesh);
        this.kelpFronds.push({
          mesh,
          baseRotX: mesh.rotation.x,
          baseRotZ: mesh.rotation.z,
          speed: 0.8 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  _buildHydrothermalVents() {
    // Volcanic hydrothermal chimneys emitting rising bubble streams and mineral clouds
    const ventChimneyMat = new THREE.MeshStandardMaterial({
      color: 0x241d1a,
      roughness: 0.9,
      metalness: 0.25
    });

    const ventGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      toneMapped: false
    });

    const ventCoords = [
      new THREE.Vector3(1280, -505, -2750),
      new THREE.Vector3(1420, -510, -3150),
      new THREE.Vector3(2050, -490, -3850),
      new THREE.Vector3(2600, -485, -4400)
    ];

    for (const coord of ventCoords) {
      // 1. Chimney rock cone
      const chimney = new THREE.Mesh(new THREE.ConeGeometry(12, 38, 8), ventChimneyMat);
      chimney.position.copy(coord);
      chimney.position.y += 19;
      this.group.add(chimney);

      // 2. Glowing volcanic orifice
      const orifice = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 2, 8), ventGlowMat);
      orifice.position.copy(coord);
      orifice.position.y += 38;
      this.group.add(orifice);

      // 3. Bubble particles
      const bubbleCount = 24;
      const bubbleGeom = new THREE.SphereGeometry(0.55, 6, 6);
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: 0xd0f0ff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });

      const bubbleMeshes = [];
      for (let b = 0; b < bubbleCount; b++) {
        const bubble = new THREE.Mesh(bubbleGeom, bubbleMat);
        bubble.position.set(
          coord.x + (Math.random() - 0.5) * 4.0,
          coord.y + 38 + b * 2.8,
          coord.z + (Math.random() - 0.5) * 4.0
        );
        this.group.add(bubble);
        bubbleMeshes.push(bubble);
      }

      this.bubbleVents.push({
        basePos: new THREE.Vector3(coord.x, coord.y + 38, coord.z),
        bubbles: bubbleMeshes,
        speed: 16.0
      });
    }
  }

  _buildFishShoals() {
    // 3 Distinct species of fish shoals:
    // a. Sardines (dense silver flocking)
    // b. Tuna (large sleek predators)
    // c. Red Snappers (vibrant coral red reef fish)
    const species = [
      { name: 'sardine', count: 48, scale: 0.6, color: 0x98b8d8, speed: 18.0, radius: 24.0 },
      { name: 'tuna', count: 16, scale: 1.8, color: 0x224870, speed: 28.0, radius: 45.0 },
      { name: 'snapper', count: 28, scale: 1.0, color: 0xcc3322, speed: 12.0, radius: 30.0 }
    ];

    const shoalCenters = [
      new THREE.Vector3(1220, -420, -2820),
      new THREE.Vector3(1550, -440, -3250),
      new THREE.Vector3(2300, -400, -4100),
      new THREE.Vector3(2650, -360, -4350)
    ];

    for (let s = 0; s < species.length; s++) {
      const sp = species[s];
      const fishMat = new THREE.MeshStandardMaterial({
        color: sp.color,
        roughness: 0.35,
        metalness: 0.7
      });

      const fishGeom = new THREE.ConeGeometry(0.4 * sp.scale, 2.4 * sp.scale, 5);
      fishGeom.rotateX(Math.PI * 0.5);

      for (let c = 0; c < shoalCenters.length; c++) {
        const center = shoalCenters[c];
        const fishList = [];

        for (let i = 0; i < sp.count; i++) {
          const fish = new THREE.Mesh(fishGeom, fishMat);
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * sp.radius;
          fish.position.set(
            center.x + Math.cos(angle) * dist,
            center.y + (Math.random() - 0.5) * (sp.radius * 0.6),
            center.z + Math.sin(angle) * dist
          );
          this.group.add(fish);
          fishList.push({
            mesh: fish,
            angle,
            dist,
            heightOffset: fish.position.y - center.y,
            speed: sp.speed * (0.85 + Math.random() * 0.3)
          });
        }

        this.fishShoals.push({
          species: sp.name,
          center: center.clone(),
          radius: sp.radius,
          fish: fishList
        });
      }
    }
  }

  _buildLanternfish() {
    // Abyssal deep lanternfish with glowing bioluminescent lures
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      roughness: 0.7,
      metalness: 0.4
    });

    const lureMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      toneMapped: false
    });

    const bodyGeom = new THREE.ConeGeometry(0.8, 3.2, 6);
    bodyGeom.rotateX(Math.PI * 0.5);
    const lureGeom = new THREE.SphereGeometry(0.35, 6, 6);

    const depths = [
      new THREE.Vector3(1180, -490, -2760),
      new THREE.Vector3(1350, -500, -2950),
      new THREE.Vector3(1750, -480, -3600),
      new THREE.Vector3(2100, -470, -3950),
      new THREE.Vector3(2500, -460, -4250)
    ];

    for (const d of depths) {
      for (let k = 0; k < 6; k++) {
        const lGroup = new THREE.Group();
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        lGroup.add(body);

        const lure = new THREE.Mesh(lureGeom, lureMat);
        lure.position.set(0, 0.8, 1.8);
        lGroup.add(lure);

        lGroup.position.set(
          d.x + (Math.random() - 0.5) * 60,
          d.y + (Math.random() - 0.5) * 40,
          d.z + (Math.random() - 0.5) * 60
        );

        this.group.add(lGroup);
        this.lanternfish.push({
          group: lGroup,
          basePos: lGroup.position.clone(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 0.5
        });
      }
    }
  }

  _buildCrabs() {
    // Spiny road-crossing crabs scuttling on the submerged causeway deck
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xcc4411,
      roughness: 0.5,
      metalness: 0.2
    });

    const crabGeom = new THREE.SphereGeometry(1.2, 8, 6);
    crabGeom.scale(1.4, 0.5, 1.0);

    const crabLocations = [
      { x: 1215, y: -480, z: -2810, dir: 1 },
      { x: 1450, y: -460, z: -3100, dir: -1 },
      { x: 2200, y: -455, z: -3900, dir: 1 },
      { x: 2420, y: -450, z: -4200, dir: -1 }
    ];

    for (let i = 0; i < crabLocations.length; i++) {
      const c = crabLocations[i];
      const crabMesh = new THREE.Mesh(crabGeom, shellMat);
      crabMesh.position.set(c.x, c.y, c.z);
      this.group.add(crabMesh);

      this.crabs.push({
        mesh: crabMesh,
        startX: c.x,
        y: c.y,
        z: c.z,
        dir: c.dir,
        speed: 2.2 + Math.random() * 1.5,
        range: 16.0
      });
    }
  }

  _buildGrassTufts() {
    // Marine grass tufts scattered along the seabed
    const grassMat = new THREE.MeshBasicMaterial({
      color: 0x143c22,
      side: THREE.DoubleSide
    });
    const grassGeom = new THREE.ConeGeometry(0.8, 4.5, 4);

    for (let i = 0; i < 40; i++) {
      const tuft = new THREE.Mesh(grassGeom, grassMat);
      tuft.position.set(
        1200 + (Math.random() - 0.5) * 600,
        -510 + Math.random() * 20,
        -2800 - Math.random() * 1400
      );
      tuft.rotation.y = Math.random() * Math.PI;
      this.group.add(tuft);
    }
  }

  update(dt, time) {
    // 1. Sway kelp fronds
    for (let i = 0; i < this.kelpFronds.length; i++) {
      const k = this.kelpFronds[i];
      const sway = Math.sin(time * k.speed + k.phase) * 0.18;
      k.mesh.rotation.z = k.baseRotZ + sway;
      k.mesh.rotation.x = k.baseRotX + sway * 0.5;
    }

    // 2. Rise hydrothermal bubbles
    for (let v = 0; v < this.bubbleVents.length; v++) {
      const vent = this.bubbleVents[v];
      for (let b = 0; b < vent.bubbles.length; b++) {
        const bubble = vent.bubbles[b];
        bubble.position.y += vent.speed * dt;
        bubble.position.x += Math.sin(time * 3.0 + b) * 0.15;
        if (bubble.position.y > vent.basePos.y + 65.0) {
          bubble.position.y = vent.basePos.y;
          bubble.position.x = vent.basePos.x + (Math.random() - 0.5) * 3.0;
          bubble.position.z = vent.basePos.z + (Math.random() - 0.5) * 3.0;
        }
      }
    }

    // 3. Circle fish shoals
    for (let s = 0; s < this.fishShoals.length; s++) {
      const shoal = this.fishShoals[s];
      for (let f = 0; f < shoal.fish.length; f++) {
        const fish = shoal.fish[f];
        fish.angle += (fish.speed / shoal.radius) * dt;
        fish.mesh.position.x = shoal.center.x + Math.cos(fish.angle) * fish.dist;
        fish.mesh.position.z = shoal.center.z + Math.sin(fish.angle) * fish.dist;
        fish.mesh.position.y = shoal.center.y + fish.heightOffset + Math.sin(time * 2.0 + f) * 1.5;
        fish.mesh.rotation.y = -fish.angle + Math.PI * 0.5;
      }
    }

    // 4. Bob lanternfish with lure pulse
    for (let l = 0; l < this.lanternfish.length; l++) {
      const lf = this.lanternfish[l];
      lf.group.position.y = lf.basePos.y + Math.sin(time * lf.speed + lf.phase) * 2.5;
      lf.group.position.x = lf.basePos.x + Math.cos(time * lf.speed * 0.7 + lf.phase) * 1.8;
    }

    // 5. Scuttle road-crossing crabs
    for (let c = 0; c < this.crabs.length; c++) {
      const crab = this.crabs[c];
      crab.mesh.position.x += crab.dir * crab.speed * dt;
      if (Math.abs(crab.mesh.position.x - crab.startX) > crab.range) {
        crab.dir *= -1;
      }
    }
  }
}
