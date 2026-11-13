import * as THREE from "three";

/**
 * Small ambient Three.js scene for the landing page.
 * It is deliberately independent from gameplay scenes so the arcade shell
 * can be rendered and tested without loading any game module.
 */
export class ArcadeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = new THREE.Vector2(0, 0);
    this.targetPointer = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.frameId = 0;
    this.resizeObserver = null;
    this.disposed = false;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power"
      });
    } catch {
      this.renderer = null;
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    this.camera.position.set(0, 0, 7.4);

    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    this.scene.add(new THREE.AmbientLight(0x9ad9ff, 1.5));
    const keyLight = new THREE.PointLight(0x73f3e0, 34, 14);
    keyLight.position.set(-3, 3, 4);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x8067ff, 25, 12);
    rimLight.position.set(3, -2, -1);
    this.scene.add(rimLight);

    this.#buildHand();
    this.#buildOrbit();
    this.#buildParticles();
    this.#resize();

    this.onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.targetPointer.set(
        ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        -((event.clientY - rect.top) / rect.height - 0.5) * 2
      );
    };
    canvas.addEventListener("pointermove", this.onPointerMove);
    this.resizeObserver = new ResizeObserver(() => this.#resize());
    this.resizeObserver.observe(canvas);
    this.#animate();
  }

  #buildHand() {
    const hand = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x76f0d9,
      metalness: 0.34,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      emissive: 0x0b4b5a,
      emissiveIntensity: 0.48
    });
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0fff2,
      metalness: 0.2,
      roughness: 0.24,
      emissive: 0x147b87,
      emissiveIntensity: 0.5
    });

    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.52, 7, 16), material);
    palm.position.set(0, -0.25, 0);
    palm.scale.set(1, 1, 0.52);
    hand.add(palm);

    const fingers = [
      { x: -0.34, y: 0.63, length: 0.39, tilt: -0.08 },
      { x: -0.12, y: 0.75, length: 0.57, tilt: -0.025 },
      { x: 0.12, y: 0.72, length: 0.53, tilt: 0.025 },
      { x: 0.34, y: 0.59, length: 0.36, tilt: 0.09 }
    ];

    for (const finger of fingers) {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.105, finger.length, 5, 12),
        material
      );
      mesh.position.set(finger.x, finger.y, 0.01);
      mesh.rotation.z = finger.tilt;
      mesh.scale.z = 0.72;
      hand.add(mesh);

      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), jointMaterial);
      joint.position.set(finger.x, finger.y - finger.length * 0.23, 0.09);
      joint.scale.set(1, 0.78, 0.6);
      hand.add(joint);
    }

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.34, 5, 12), material);
    thumb.position.set(-0.56, -0.12, 0.02);
    thumb.rotation.z = -0.83;
    thumb.scale.z = 0.72;
    hand.add(thumb);

    const thumbJoint = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), jointMaterial);
    thumbJoint.position.set(-0.43, -0.34, 0.1);
    hand.add(thumbJoint);

    hand.rotation.z = -0.07;
    hand.rotation.x = -0.08;
    this.rig.add(hand);
    this.hand = hand;

    const palmGlow = new THREE.PointLight(0x4dffe2, 7, 3);
    palmGlow.position.set(0, 0, 0.8);
    hand.add(palmGlow);
  }

  #buildOrbit() {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x74f3db,
      transparent: true,
      opacity: 0.44
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.012, 8, 120), ringMaterial);
    ringA.rotation.set(0.82, 0.1, -0.3);
    this.rig.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(2.22, 0.008, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x8d7bff, transparent: true, opacity: 0.5 })
    );
    ringB.rotation.set(1.24, -0.52, 0.16);
    this.rig.add(ringB);

    const ringC = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.006, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.23 })
    );
    ringC.rotation.set(0.14, 0.85, 0.8);
    this.rig.add(ringC);

    this.orbitRings = [ringA, ringB, ringC];
  }

  #buildParticles() {
    const count = 190;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 2.45 + Math.random() * 1.75;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.4 - 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xa4c9d9,
      size: 0.018,
      transparent: true,
      opacity: 0.74,
      sizeAttenuation: true
    });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  #resize() {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.position.z = width < 560 ? 8.4 : 7.4;
    this.camera.updateProjectionMatrix();
  }

  #animate = () => {
    if (this.disposed || !this.renderer) return;
    this.frameId = requestAnimationFrame(this.#animate);

    const elapsed = this.clock.getElapsedTime();
    this.pointer.lerp(this.targetPointer, 0.035);
    this.rig.rotation.y = Math.sin(elapsed * 0.22) * 0.16 + this.pointer.x * 0.08;
    this.rig.rotation.x = Math.cos(elapsed * 0.19) * 0.06 - this.pointer.y * 0.045;
    this.rig.position.y = Math.sin(elapsed * 0.8) * 0.075;
    this.hand.rotation.z = -0.07 + Math.sin(elapsed * 0.55) * 0.035;
    this.orbitRings[0].rotation.z += 0.0009;
    this.orbitRings[1].rotation.y -= 0.0007;
    this.orbitRings[2].rotation.x += 0.0005;
    this.particles.rotation.y = elapsed * 0.012;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener("pointermove", this.onPointerMove);
    this.scene?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
    this.renderer?.dispose();
  }
}
