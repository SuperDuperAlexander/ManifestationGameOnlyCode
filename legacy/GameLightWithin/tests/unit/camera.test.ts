import { describe, it, expect } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { FollowCamera } from '../../src/core/camera';
import { CAMERA } from '../../src/content/chapter1';

const UP = new Vector3(0, 1, 0);

describe('FollowCamera basis', () => {
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.1, -2.4];

  it('looks along its own forward vector', () => {
    for (const yaw of yaws) {
      const cam = new FollowCamera(16 / 9);
      cam.yaw = yaw;
      cam.pitch = 0;
      const target = new Vector3(0, 0, 0);
      cam.snapTo(target);
      // The camera sits behind the player, so the way from the camera to the
      // player is the same way the player walks when pressing forward.
      const toTarget = target.subtract(cam.position);
      toTarget.y = 0;
      toTarget.normalize();
      const forward = cam.forward(new Vector3());
      expect(Vector3.Dot(toTarget, forward)).toBeCloseTo(1, 5);
    }
  });

  it('puts right at 90 degrees to forward', () => {
    for (const yaw of yaws) {
      const cam = new FollowCamera(16 / 9);
      cam.yaw = yaw;
      const forward = cam.forward(new Vector3());
      const right = cam.right(new Vector3());
      expect(Vector3.Dot(forward, right)).toBeCloseTo(0, 6);
      expect(right.length()).toBeCloseTo(1, 6);
    }
  });

  /**
   * The regression: right used to be the negative of this, so pressing A
   * walked right and pressing D walked left.
   */
  it('puts right on the right, not the left', () => {
    for (const yaw of yaws) {
      const cam = new FollowCamera(16 / 9);
      cam.yaw = yaw;
      const forward = cam.forward(new Vector3());
      const right = cam.right(new Vector3());
      const expected = Vector3.Cross(forward, UP).normalize();
      expect(right.x).toBeCloseTo(expected.x, 6);
      expect(right.z).toBeCloseTo(expected.z, 6);
    }
  });

  it('walks toward positive x when facing negative z and pressing right', () => {
    const cam = new FollowCamera(16 / 9);
    // Facing down the valley, which runs toward negative z.
    cam.yaw = Math.PI;
    const forward = cam.forward(new Vector3());
    expect(forward.z).toBeCloseTo(-1, 5);
    const right = cam.right(new Vector3());
    expect(right.x).toBeCloseTo(1, 5);
  });

  it('keeps the pitch inside its limits', () => {
    const cam = new FollowCamera(16 / 9);
    cam.rotate(0, 100000);
    expect(cam.pitch).toBeLessThanOrEqual(CAMERA.maxPitch);
    cam.rotate(0, -100000);
    expect(cam.pitch).toBeGreaterThanOrEqual(CAMERA.minPitch);
  });
});
