// src/sealife.js — Ocean wildlife: dolphins, leviathan, jellyfish, seabirds, surface ripples
// Why: "P12 Ocean World Sea Life: leaping dolphin schools ahead of player, ~60m leviathan breaching over causeway
// and gliding over Atlantis avenue, drifting jellyfish, seabirds around stacks, ripple rings and splash pools."

import * as THREE from 'three';

export class SeaLife {
  constructor(scene, track = null) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'ocean_sealife';
    this.scene.add(this.group);

    this.dolphins = [];
    this.leviathan = null;
    this.jellyfish = [];
    this.seabirds = [];
    this.ripples = [];

    this._buildDolphins();
    this._buildLeviathan();
    this._buildJellyfish();
    this._buildSeabirds();
    this._buildSplashRipples();
  }

  _buildDolphins() {
    // Leaping dolphins that jump in parabolic arcs over ocean swells
    const dolphinMat = new THREE.MeshStandardMaterial({
      color: 0x223548,
      roughness: 0.3,
      metalness: 0.5
    });

    const bodyGeom = new THREE.ConeGeometry(0.9, 4.2, 8);
    bodyGeom.rotateX(Math.PI * 0.5);

    // Dolphin pod leaping ahead along the causeway (s: 600m to 2000m)
    const podPositions = [
      { x: 380, z: 2700, heading: 0.6 },
      { x: 750, z: 2400, heading: 0.8 },
      { x: 1100, z: 2050, heading: 1.1 },
      { x: 1450, z: 1750, heading: 1.4 }
    ];

    for (let p = 0; p < podPositions.length; p++) {
      const pos = podPositions[p];
      for (let i = 0; i < 4; i++) {
        const dMesh = new THREE.Mesh(bodyGeom, dolphinMat);
        this.group.add(dMesh);

        this.dolphins.push({
          mesh: dMesh,
          baseX: pos.x + (i - 1.5) * 12.0,
          baseZ: pos.z + (i - 1.5) * 8.0,
          heading: pos.heading,
          phase: (i * 0.7) + (p * 1.5),
          jumpSpeed: 1.8 + Math.random() * 0.4,
          jumpHeight: 6.5 + Math.random() * 2.0
        });
      }
    }
  }

  _buildLeviathan() {
    // ~60m Colossal Oceanic Leviathan
    // Breaches over the low causeway and glides through the deep Atlantis submerged avenue
    this.leviathanGroup = new THREE.Group();
    this.leviathanGroup.name = 'ocean_leviathan';

    const leviathanMat = new THREE.MeshStandardMaterial({
      color: 0x142230,
      roughness: 0.65,
      metalness: 0.35
    });

    const finMat = new THREE.MeshStandardMaterial({
      color: 0x103040,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const biolumMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      toneMapped: false
    });

    // 1. Segmented main body (length: ~62m, width: ~14m)
    const bodySegments = 8;
    this.leviathanSegments = [];
    for (let s = 0; s < bodySegments; s++) {
      const segT = s / (bodySegments - 1);
      const radius = Math.sin(segT * Math.PI) * 6.5 + 2.0;
      const length = 8.5;
      const segGeo = new THREE.CylinderGeometry(radius * 0.9, radius, length, 12);
      segGeo.rotateX(Math.PI * 0.5);
      const segMesh = new THREE.Mesh(segGeo, leviathanMat);
      segMesh.position.set(0, 0, (s - bodySegments * 0.5) * length * 0.9);
      this.leviathanGroup.add(segMesh);
      this.leviathanSegments.push(segMesh);

      // Bioluminescent flank stripes
      if (s >= 1 && s <= 5) {
        const stripeGeom = new THREE.BoxGeometry(radius * 2.1, 0.4, 2.0);
        const stripe = new THREE.Mesh(stripeGeom, biolumMat);
        stripe.position.set(0, 0, 0);
        segMesh.add(stripe);
      }
    }

    // 2. Giant lateral pectoral wings (span: 42m)
    const wingGeom = new THREE.BoxGeometry(20, 0.6, 8.5);
    wingGeom.translate(10, 0, 0);
    this.leviathanWingL = new THREE.Mesh(wingGeom, finMat);
    this.leviathanWingL.position.set(-6, 0, -12);
    this.leviathanWingL.rotation.y = 0.25;
    this.leviathanWingL.rotation.z = Math.PI;
    this.leviathanGroup.add(this.leviathanWingL);

    this.leviathanWingR = new THREE.Mesh(wingGeom, finMat);
    this.leviathanWingR.position.set(6, 0, -12);
    this.leviathanWingR.rotation.y = -0.25;
    this.leviathanGroup.add(this.leviathanWingR);

    // 3. Fluked tail
    const flukeGeom = new THREE.BoxGeometry(18, 0.5, 6);
    this.leviathanFluke = new THREE.Mesh(flukeGeom, finMat);
    this.leviathanFluke.position.set(0, 0, (bodySegments * 0.5) * 8.5);
    this.leviathanGroup.add(this.leviathanFluke);

    this.group.add(this.leviathanGroup);

    // Pathway for Leviathan:
    // Loops between surface breach over causeway (y = 8) and glide through Atlantis (y = -440)
    this.leviathan = {
      group: this.leviathanGroup,
      t: 0.0,
      speed: 0.025 // Loop period ~40 seconds
    };
  }

  _buildJellyfish() {
    // Drifting luminous translucent jellyfish in water column
    const jellyMat = new THREE.MeshBasicMaterial({
      color: 0x66ffff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const tentacleMat = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    const bellGeom = new THREE.SphereGeometry(3.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const tentGeom = new THREE.CylinderGeometry(0.1, 0.2, 12, 4);
    tentGeom.translate(0, -6, 0);

    const jellySpawns = [
      new THREE.Vector3(1250, -220, -2820),
      new THREE.Vector3(1380, -320, -3000),
      new THREE.Vector3(1700, -390, -3450),
      new THREE.Vector3(2250, -410, -3980),
      new THREE.Vector3(2450, -350, -4250),
      new THREE.Vector3(2600, -240, -4400),
      new THREE.Vector3(1450, -120, -2850)
    ];

    for (const pos of jellySpawns) {
      for (let j = 0; j < 3; j++) {
        const jGroup = new THREE.Group();
        const bell = new THREE.Mesh(bellGeom, jellyMat);
        jGroup.add(bell);

        for (let t = 0; t < 4; t++) {
          const tent = new THREE.Mesh(tentGeom, tentacleMat);
          const a = (t / 4) * Math.PI * 2;
          tent.position.set(Math.cos(a) * 2.0, 0, Math.sin(a) * 2.0);
          jGroup.add(tent);
        }

        jGroup.position.set(
          pos.x + (Math.random() - 0.5) * 50,
          pos.y + (Math.random() - 0.5) * 35,
          pos.z + (Math.random() - 0.5) * 50
        );

        this.group.add(jGroup);
        this.jellyfish.push({
          group: jGroup,
          baseY: jGroup.position.y,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 1.4 + Math.random() * 0.5
        });
      }
    }
  }

  _buildSeabirds() {
    // Ocean storm petrels wheeling around sea stacks and lighthouse
    const birdMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.6,
      side: THREE.DoubleSide
    });

    const wingGeom = new THREE.BufferGeometry();
    const verts = new Float32Array([
      0, 0, 0,   -2.2, 0.4, 0.8,   0, 0, 1.2,
      0, 0, 0,    2.2, 0.4, 0.8,   0, 0, 1.2
    ]);
    wingGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    wingGeom.computeVertexNormals();

    const roosts = [
      { x: 1820, y: 48, z: 1620, radius: 45, speed: 0.7 },
      { x: 2150, y: 52, z: 1340, radius: 55, speed: 0.8 },
      { x: 2950, y: 155, z: 180, radius: 85, speed: 0.6 } // Lighthouse top
    ];

    for (const r of roosts) {
      for (let b = 0; b < 6; b++) {
        const bird = new THREE.Mesh(wingGeom, birdMat);
        this.group.add(bird);
        this.seabirds.push({
          mesh: bird,
          cx: r.x,
          cy: r.y + (Math.random() - 0.5) * 15,
          cz: r.z,
          radius: r.radius * (0.8 + Math.random() * 0.4),
          angle: (b / 6) * Math.PI * 2,
          speed: r.speed * (0.9 + Math.random() * 0.2),
          flapPhase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  _buildSplashRipples() {
    // Concentric expanding splash rings at the water surface (y = 0)
    const ringGeom = new THREE.RingGeometry(2.0, 3.2, 24);
    ringGeom.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa0e0ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    for (let r = 0; r < 12; r++) {
      const ring = new THREE.Mesh(ringGeom, ringMat.clone());
      ring.position.set(0, 0.1, 0);
      ring.visible = false;
      this.group.add(ring);
      this.ripples.push({
        mesh: ring,
        active: false,
        scale: 1.0,
        opacity: 0.65
      });
    }
  }

  triggerSplash(x, z) {
    for (let i = 0; i < this.ripples.length; i++) {
      const rip = this.ripples[i];
      if (!rip.active) {
        rip.active = true;
        rip.scale = 1.0;
        rip.opacity = 0.7;
        rip.mesh.position.set(x, 0.1, z);
        rip.mesh.scale.set(1, 1, 1);
        rip.mesh.visible = true;
        break;
      }
    }
  }

  update(dt, time) {
    // 1. Dolphins jumping in parabolic arcs
    for (let i = 0; i < this.dolphins.length; i++) {
      const d = this.dolphins[i];
      const cycle = (time * d.jumpSpeed + d.phase) % (Math.PI * 2);
      // Half of the time under water, half leaping over surface
      const jumpProgress = Math.sin(cycle);
      const isLeaping = jumpProgress > 0;
      const y = isLeaping ? jumpProgress * d.jumpHeight : jumpProgress * 2.5;

      const fwd = time * 8.0;
      d.mesh.position.set(
        d.baseX + Math.sin(d.heading) * fwd,
        y,
        d.baseZ + Math.cos(d.heading) * fwd
      );
      // Pitch with trajectory
      d.mesh.rotation.x = -Math.cos(cycle) * 0.6;
      d.mesh.rotation.y = d.heading;

      // Trigger splash when crossing waterline
      if (Math.abs(y) < 0.4 && isLeaping) {
        if (Math.random() < 0.15) {
          this.triggerSplash(d.mesh.position.x, d.mesh.position.z);
        }
      }
    }

    // 2. Colossal Leviathan movement & undulation
    if (this.leviathan) {
      this.leviathan.t = (this.leviathan.t + dt * this.leviathan.speed) % 1.0;
      const lt = this.leviathan.t;

      // Parabolic flight: breaches surface at causeway (lt ≈ 0.25, y = 14m), plunges down to Atlantis (lt ≈ 0.75, y = -430m)
      const loopAngle = lt * Math.PI * 2;
      const lx = 1800 + Math.cos(loopAngle) * 900;
      const lz = -3200 + Math.sin(loopAngle) * 1100;
      const ly = Math.sin(loopAngle) * 230 - 200; // -430 to +30m

      this.leviathan.group.position.set(lx, ly, lz);
      this.leviathan.group.rotation.y = -loopAngle;
      this.leviathan.group.rotation.x = Math.cos(loopAngle) * 0.35;

      // Segment wave undulation
      for (let s = 0; s < this.leviathanSegments.length; s++) {
        const seg = this.leviathanSegments[s];
        seg.rotation.y = Math.sin(time * 1.8 + s * 0.6) * 0.18;
      }

      // Wing flaps
      const wingFlap = Math.sin(time * 1.4) * 0.22;
      if (this.leviathanWingL) this.leviathanWingL.rotation.z = Math.PI + wingFlap;
      if (this.leviathanWingR) this.leviathanWingR.rotation.z = -wingFlap;
    }

    // 3. Jellyfish pulsation & drift
    for (let j = 0; j < this.jellyfish.length; j++) {
      const jf = this.jellyfish[j];
      const pulse = Math.sin(time * jf.pulseSpeed + jf.phase);
      const scaleXZ = 1.0 + pulse * 0.18;
      const scaleY = 1.0 - pulse * 0.12;
      jf.group.scale.set(scaleXZ, scaleY, scaleXZ);
      jf.group.position.y = jf.baseY + Math.sin(time * 0.6 + jf.phase) * 3.5;
    }

    // 4. Wheeling seabirds
    for (let b = 0; b < this.seabirds.length; b++) {
      const bird = this.seabirds[b];
      bird.angle += bird.speed * dt;
      bird.mesh.position.set(
        bird.cx + Math.cos(bird.angle) * bird.radius,
        bird.cy + Math.sin(time * 1.2 + bird.flapPhase) * 2.0,
        bird.cz + Math.sin(bird.angle) * bird.radius
      );
      bird.mesh.rotation.y = -bird.angle;
      bird.mesh.rotation.z = 0.25; // Banking turn
    }

    // 5. Expand splash ripples
    for (let r = 0; r < this.ripples.length; r++) {
      const rip = this.ripples[r];
      if (rip.active) {
        rip.scale += dt * 8.0;
        rip.opacity -= dt * 0.7;
        rip.mesh.scale.set(rip.scale, rip.scale, rip.scale);
        rip.mesh.material.opacity = rip.opacity;
        if (rip.opacity <= 0.0) {
          rip.active = false;
          rip.mesh.visible = false;
        }
      }
    }
  }
}
