// 오답 연출용 물리 FX (Cannon-es): 부품이 슬롯에 부딪힌 뒤 튕겨나가 바닥에 떨어짐

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { disposeObject } from '../models/factory';

interface FlyingPart {
  mesh: THREE.Object3D;
  body: CANNON.Body;
  blocker: CANNON.Body;
  ttl: number;
}

export class PhysicsFX {
  private world: CANNON.World;
  private active: FlyingPart[] = [];

  constructor(private scene: THREE.Scene) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.defaultContactMaterial.restitution = 0.55;
    this.world.defaultContactMaterial.friction = 0.4;

    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
  }

  /** 부품을 from 위치에서 target(슬롯)으로 던짐 → 슬롯의 정적 구체에 부딪혀 튕김 */
  throwPart(mesh: THREE.Object3D, from: THREE.Vector3, target: THREE.Vector3): void {
    mesh.position.copy(from);
    this.scene.add(mesh);

    const blocker = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(0.22) });
    blocker.position.set(target.x, target.y, target.z);
    this.world.addBody(blocker);

    const body = new CANNON.Body({ mass: 0.9, shape: new CANNON.Sphere(0.26) });
    body.position.set(from.x, from.y, from.z);
    const dir = new CANNON.Vec3(target.x - from.x, target.y - from.y, target.z - from.z);
    dir.normalize();
    body.velocity.set(dir.x * 6.5, dir.y * 6.5 + 1.4, dir.z * 6.5);
    body.angularVelocity.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    this.world.addBody(body);

    this.active.push({ mesh, body, blocker, ttl: 2.0 });
  }

  update(dt: number): void {
    if (this.active.length === 0) return;
    this.world.step(1 / 60, dt, 4);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i] as FlyingPart;
      item.ttl -= dt;
      item.mesh.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
      item.mesh.quaternion.set(
        item.body.quaternion.x,
        item.body.quaternion.y,
        item.body.quaternion.z,
        item.body.quaternion.w
      );

      if (item.ttl < 0.45) {
        const opacity = Math.max(0, item.ttl / 0.45);
        item.mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            const material = m.material;
            const list = Array.isArray(material) ? material : [material];
            for (const mat of list) {
              const std = mat as THREE.MeshStandardMaterial;
              std.transparent = true;
              std.opacity = opacity;
            }
          }
        });
      }

      if (item.ttl <= 0) {
        this.scene.remove(item.mesh);
        disposeObject(item.mesh);
        this.world.removeBody(item.body);
        this.world.removeBody(item.blocker);
        this.active.splice(i, 1);
      }
    }
  }

  get busy(): boolean {
    return this.active.length > 0;
  }
}
