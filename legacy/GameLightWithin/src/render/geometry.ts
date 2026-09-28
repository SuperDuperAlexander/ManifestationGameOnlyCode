/**
 * Procedural geometry.
 *
 * The world is generated in code, so the shapes it is made of are generated
 * here rather than taken from an engine's mesh library. Every generator
 * produces the same vertex layout, the same winding and the same texture
 * coordinates it always has, because several shaders read those coordinates
 * directly: the rainbow reads them across its arc, the tone ring across its
 * band, the blob shadow out from its middle. A shape whose coordinates run
 * the other way is a different picture, not a different mesh library.
 *
 * Positions are right-handed with y up, and faces wind counter-clockwise when
 * seen from the front.
 */

export interface Geo {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

function empty(): Geo {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/** Moves every vertex. Used where a shape's origin is not its middle. */
export function translateGeo(geo: Geo, x: number, y: number, z: number): Geo {
  for (let i = 0; i < geo.positions.length; i += 3) {
    geo.positions[i] = (geo.positions[i] ?? 0) + x;
    geo.positions[i + 1] = (geo.positions[i + 1] ?? 0) + y;
    geo.positions[i + 2] = (geo.positions[i + 2] ?? 0) + z;
  }
  return geo;
}

/** Turns a shape about the x axis, in radians. */
export function rotateXGeo(geo: Geo, angle: number): Geo {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const turn = (arr: number[]): void => {
    for (let i = 0; i < arr.length; i += 3) {
      const y = arr[i + 1] ?? 0;
      const z = arr[i + 2] ?? 0;
      arr[i + 1] = y * c - z * s;
      arr[i + 2] = y * s + z * c;
    }
  };
  turn(geo.positions);
  turn(geo.normals);
  return geo;
}

/** Drops the index buffer, so every triangle owns its three vertices. */
export function toNonIndexed(geo: Geo): Geo {
  if (geo.indices.length === 0) return geo;
  const out = empty();
  for (const index of geo.indices) {
    out.positions.push(
      geo.positions[index * 3] ?? 0,
      geo.positions[index * 3 + 1] ?? 0,
      geo.positions[index * 3 + 2] ?? 0,
    );
    out.normals.push(
      geo.normals[index * 3] ?? 0,
      geo.normals[index * 3 + 1] ?? 0,
      geo.normals[index * 3 + 2] ?? 0,
    );
    out.uvs.push(geo.uvs[index * 2] ?? 0, geo.uvs[index * 2 + 1] ?? 0);
  }
  return out;
}

/**
 * Works the normals out from the triangles.
 *
 * Call it after moving vertices about. On an indexed shape the normals are
 * averaged at each shared vertex, which reads as smooth; on one without an
 * index buffer each triangle gets its own, which reads as faceted. That is
 * the whole difference between a soft leaf blob and a rough rock, and both
 * are wanted.
 */
export function computeVertexNormals(geo: Geo): Geo {
  const count = geo.positions.length / 3;
  const normals = new Array<number>(count * 3).fill(0);
  const indices = geo.indices.length > 0 ? geo.indices : Array.from({ length: count }, (_, i) => i);

  for (let i = 0; i < indices.length; i += 3) {
    const ia = (indices[i] ?? 0) * 3;
    const ib = (indices[i + 1] ?? 0) * 3;
    const ic = (indices[i + 2] ?? 0) * 3;
    const ax = geo.positions[ia] ?? 0;
    const ay = geo.positions[ia + 1] ?? 0;
    const az = geo.positions[ia + 2] ?? 0;
    const e1x = (geo.positions[ib] ?? 0) - ax;
    const e1y = (geo.positions[ib + 1] ?? 0) - ay;
    const e1z = (geo.positions[ib + 2] ?? 0) - az;
    const e2x = (geo.positions[ic] ?? 0) - ax;
    const e2y = (geo.positions[ic + 1] ?? 0) - ay;
    const e2z = (geo.positions[ic + 2] ?? 0) - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const base of [ia, ib, ic]) {
      normals[base] = (normals[base] ?? 0) + nx;
      normals[base + 1] = (normals[base + 1] ?? 0) + ny;
      normals[base + 2] = (normals[base + 2] ?? 0) + nz;
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i] ?? 0;
    const y = normals[i + 1] ?? 0;
    const z = normals[i + 2] ?? 0;
    const len = Math.hypot(x, y, z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  geo.normals = normals;
  return geo;
}

/** A flat rectangle in the xy plane, facing positive z. */
export function planeGeo(width: number, height: number, segX = 1, segY = 1): Geo {
  const geo = empty();
  const halfW = width / 2;
  const halfH = height / 2;
  const stepX = width / segX;
  const stepY = height / segY;
  for (let iy = 0; iy <= segY; iy++) {
    const y = iy * stepY - halfH;
    for (let ix = 0; ix <= segX; ix++) {
      geo.positions.push(ix * stepX - halfW, -y, 0);
      geo.normals.push(0, 0, 1);
      geo.uvs.push(ix / segX, 1 - iy / segY);
    }
  }
  const cols = segX + 1;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = ix + cols * iy;
      const b = ix + cols * (iy + 1);
      const c = ix + 1 + cols * (iy + 1);
      const d = ix + 1 + cols * iy;
      geo.indices.push(a, b, d, b, c, d);
    }
  }
  return geo;
}

/** A filled disc in the xy plane, facing positive z. */
export function circleGeo(radius: number, segments: number): Geo {
  const geo = empty();
  geo.positions.push(0, 0, 0);
  geo.normals.push(0, 0, 1);
  geo.uvs.push(0.5, 0.5);
  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    geo.positions.push(x, y, 0);
    geo.normals.push(0, 0, 1);
    geo.uvs.push((x / radius + 1) / 2, (y / radius + 1) / 2);
  }
  for (let i = 1; i <= segments; i++) geo.indices.push(i, i + 1, 0);
  return geo;
}

/**
 * A flat ring, or a part of one, in the xy plane.
 *
 * The texture coordinates follow the vertex's own place in the plane rather
 * than the angle around the ring. The rainbow and the tone rings both read
 * them that way.
 */
export function ringGeo(
  inner: number,
  outer: number,
  thetaSegments: number,
  phiSegments = 1,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
): Geo {
  const geo = empty();
  let radius = inner;
  const radiusStep = (outer - inner) / phiSegments;
  for (let j = 0; j <= phiSegments; j++) {
    for (let i = 0; i <= thetaSegments; i++) {
      const segment = thetaStart + (i / thetaSegments) * thetaLength;
      const x = radius * Math.cos(segment);
      const y = radius * Math.sin(segment);
      geo.positions.push(x, y, 0);
      geo.normals.push(0, 0, 1);
      geo.uvs.push((x / outer + 1) / 2, (y / outer + 1) / 2);
    }
    radius += radiusStep;
  }
  for (let j = 0; j < phiSegments; j++) {
    const level = j * (thetaSegments + 1);
    for (let i = 0; i < thetaSegments; i++) {
      const a = i + level;
      const b = a + thetaSegments + 1;
      const c = a + thetaSegments + 2;
      const d = a + 1;
      geo.indices.push(a, b, d, b, c, d);
    }
  }
  return geo;
}

/** A sphere built from rings of quads. */
export function sphereGeo(radius: number, widthSegments: number, heightSegments: number): Geo {
  const geo = empty();
  const grid: number[][] = [];
  let index = 0;
  for (let iy = 0; iy <= heightSegments; iy++) {
    const row: number[] = [];
    const v = iy / heightSegments;
    let uOffset = 0;
    if (iy === 0) uOffset = 0.5 / widthSegments;
    else if (iy === heightSegments) uOffset = -0.5 / widthSegments;
    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments;
      const x = -radius * Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
      const y = radius * Math.cos(v * Math.PI);
      const z = radius * Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);
      geo.positions.push(x, y, z);
      const len = Math.hypot(x, y, z) || 1;
      geo.normals.push(x / len, y / len, z / len);
      geo.uvs.push(u + uOffset, 1 - v);
      row.push(index++);
    }
    grid.push(row);
  }
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = grid[iy]?.[ix + 1] ?? 0;
      const b = grid[iy]?.[ix] ?? 0;
      const c = grid[iy + 1]?.[ix] ?? 0;
      const d = grid[iy + 1]?.[ix + 1] ?? 0;
      if (iy !== 0) geo.indices.push(a, b, d);
      if (iy !== heightSegments - 1) geo.indices.push(b, c, d);
    }
  }
  return geo;
}

/** A box, with its middle at the origin. */
export function boxGeo(
  width: number,
  height: number,
  depth: number,
  segX = 1,
  segY = 1,
  segZ = 1,
): Geo {
  const geo = empty();
  let vertexCount = 0;

  const buildFace = (
    u: 0 | 1 | 2,
    v: 0 | 1 | 2,
    w: 0 | 1 | 2,
    uDir: number,
    vDir: number,
    faceWidth: number,
    faceHeight: number,
    faceDepth: number,
    gridX: number,
    gridY: number,
  ): void => {
    const stepX = faceWidth / gridX;
    const stepY = faceHeight / gridY;
    const halfW = faceWidth / 2;
    const halfH = faceHeight / 2;
    const halfD = faceDepth / 2;
    for (let iy = 0; iy <= gridY; iy++) {
      const y = iy * stepY - halfH;
      for (let ix = 0; ix <= gridX; ix++) {
        const x = ix * stepX - halfW;
        const point = [0, 0, 0];
        point[u] = x * uDir;
        point[v] = y * vDir;
        point[w] = halfD;
        geo.positions.push(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0);
        const normal = [0, 0, 0];
        normal[w] = faceDepth > 0 ? 1 : -1;
        geo.normals.push(normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0);
        geo.uvs.push(ix / gridX, 1 - iy / gridY);
      }
    }
    const cols = gridX + 1;
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = vertexCount + ix + cols * iy;
        const b = vertexCount + ix + cols * (iy + 1);
        const c = vertexCount + ix + 1 + cols * (iy + 1);
        const d = vertexCount + ix + 1 + cols * iy;
        geo.indices.push(a, b, d, b, c, d);
      }
    }
    vertexCount += (gridX + 1) * (gridY + 1);
  };

  buildFace(2, 1, 0, -1, -1, depth, height, width, segZ, segY);
  buildFace(2, 1, 0, 1, -1, depth, height, -width, segZ, segY);
  buildFace(0, 2, 1, 1, 1, width, depth, height, segX, segZ);
  buildFace(0, 2, 1, 1, -1, width, depth, -height, segX, segZ);
  buildFace(0, 1, 2, 1, -1, width, height, depth, segX, segY);
  buildFace(0, 1, 2, -1, -1, width, height, -depth, segX, segY);
  return geo;
}

/** A cylinder, or a cone when the top radius is zero. Middle at the origin. */
export function cylinderGeo(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  heightSegments = 1,
  openEnded = false,
): Geo {
  const geo = empty();
  const halfHeight = height / 2;
  let index = 0;
  const grid: number[][] = [];
  const slope = (radiusBottom - radiusTop) / height;

  for (let y = 0; y <= heightSegments; y++) {
    const row: number[] = [];
    const v = y / heightSegments;
    const radius = v * (radiusBottom - radiusTop) + radiusTop;
    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      geo.positions.push(radius * sinTheta, -v * height + halfHeight, radius * cosTheta);
      const len = Math.hypot(sinTheta, slope, cosTheta) || 1;
      geo.normals.push(sinTheta / len, slope / len, cosTheta / len);
      geo.uvs.push(u, 1 - v);
      row.push(index++);
    }
    grid.push(row);
  }

  for (let x = 0; x < radialSegments; x++) {
    for (let y = 0; y < heightSegments; y++) {
      const a = grid[y]?.[x] ?? 0;
      const b = grid[y + 1]?.[x] ?? 0;
      const c = grid[y + 1]?.[x + 1] ?? 0;
      const d = grid[y]?.[x + 1] ?? 0;
      if (radiusTop > 0 || y !== 0) geo.indices.push(a, b, d);
      if (radiusBottom > 0 || y !== heightSegments - 1) geo.indices.push(b, c, d);
    }
  }

  if (!openEnded) {
    for (const top of [true, false]) {
      const radius = top ? radiusTop : radiusBottom;
      if (radius <= 0) continue;
      const sign = top ? 1 : -1;
      const centerStart = index;
      for (let x = 1; x <= radialSegments; x++) {
        geo.positions.push(0, halfHeight * sign, 0);
        geo.normals.push(0, sign, 0);
        geo.uvs.push(0.5, 0.5);
        index++;
      }
      const centerEnd = index;
      for (let x = 0; x <= radialSegments; x++) {
        const theta = (x / radialSegments) * Math.PI * 2;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        geo.positions.push(radius * sinTheta, halfHeight * sign, radius * cosTheta);
        geo.normals.push(0, sign, 0);
        geo.uvs.push(cosTheta * 0.5 + 0.5, sinTheta * 0.5 * sign + 0.5);
        index++;
      }
      for (let x = 0; x < radialSegments; x++) {
        const c = centerStart + x;
        const i = centerEnd + x;
        if (top) geo.indices.push(i, i + 1, c);
        else geo.indices.push(i + 1, i, c);
      }
    }
  }
  return geo;
}

/** A cone. The point is up. */
export function coneGeo(
  radius: number,
  height: number,
  radialSegments: number,
  heightSegments = 1,
  openEnded = false,
): Geo {
  return cylinderGeo(0, radius, height, radialSegments, heightSegments, openEnded);
}

/** A ring of tube, lying in the xy plane. */
export function torusGeo(
  radius: number,
  tube: number,
  radialSegments: number,
  tubularSegments: number,
): Geo {
  const geo = empty();
  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * Math.PI * 2;
      const v = (j / radialSegments) * Math.PI * 2;
      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const y = (radius + tube * Math.cos(v)) * Math.sin(u);
      const z = tube * Math.sin(v);
      geo.positions.push(x, y, z);
      const nx = x - radius * Math.cos(u);
      const ny = y - radius * Math.sin(u);
      const len = Math.hypot(nx, ny, z) || 1;
      geo.normals.push(nx / len, ny / len, z / len);
      geo.uvs.push(i / tubularSegments, j / radialSegments);
    }
  }
  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;
      geo.indices.push(a, b, d, b, c, d);
    }
  }
  return geo;
}

const ICO_T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTICES = [
  -1,
  ICO_T,
  0,
  1,
  ICO_T,
  0,
  -1,
  -ICO_T,
  0,
  1,
  -ICO_T,
  0,
  0,
  -1,
  ICO_T,
  0,
  1,
  ICO_T,
  0,
  -1,
  -ICO_T,
  0,
  1,
  -ICO_T,
  ICO_T,
  0,
  -1,
  ICO_T,
  0,
  1,
  -ICO_T,
  0,
  -1,
  -ICO_T,
  0,
  1,
];
const ICO_FACES = [
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

/**
 * A rounded twenty-sided shape, used for rocks and leaf blobs.
 *
 * At detail 0 the faces stay flat, which is what makes a rock read as rock.
 * At detail 1 each face is split in four and the normals are smoothed, which
 * is what makes a leaf blob read as soft.
 */
export function icosahedronGeo(radius: number, detail = 0): Geo {
  const positions: number[] = [];

  const vertexAt = (i: number, out: number[]): number[] => {
    out[0] = ICO_VERTICES[i * 3] ?? 0;
    out[1] = ICO_VERTICES[i * 3 + 1] ?? 0;
    out[2] = ICO_VERTICES[i * 3 + 2] ?? 0;
    return out;
  };

  const lerp3 = (a: number[], b: number[], t: number): number[] => [
    (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t,
    (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t,
    (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t,
  ];

  const cols = detail + 1;
  for (let f = 0; f < ICO_FACES.length; f += 3) {
    const a = vertexAt(ICO_FACES[f] ?? 0, [0, 0, 0]);
    const b = vertexAt(ICO_FACES[f + 1] ?? 0, [0, 0, 0]);
    const c = vertexAt(ICO_FACES[f + 2] ?? 0, [0, 0, 0]);
    // A triangular grid over the face, then two triangles per cell.
    const grid: number[][][] = [];
    for (let i = 0; i <= cols; i++) {
      const left = lerp3(a, c, i / cols);
      const right = lerp3(b, c, i / cols);
      const rows = cols - i;
      const row: number[][] = [];
      for (let j = 0; j <= rows; j++) {
        row.push(rows === 0 ? left : lerp3(left, right, j / rows));
      }
      grid.push(row);
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);
        if (j % 2 === 0) {
          positions.push(...(grid[i]?.[k + 1] ?? []));
          positions.push(...(grid[i + 1]?.[k] ?? []));
          positions.push(...(grid[i]?.[k] ?? []));
        } else {
          positions.push(...(grid[i]?.[k + 1] ?? []));
          positions.push(...(grid[i + 1]?.[k + 1] ?? []));
          positions.push(...(grid[i + 1]?.[k] ?? []));
        }
      }
    }
  }

  // Push every vertex out onto the sphere.
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const z = positions[i + 2] ?? 0;
    const scale = radius / (Math.hypot(x, y, z) || 1);
    positions[i] = x * scale;
    positions[i + 1] = y * scale;
    positions[i + 2] = z * scale;
  }

  const geo: Geo = {
    positions,
    normals: [],
    uvs: new Array<number>((positions.length / 3) * 2).fill(0),
    indices: [],
  };
  if (detail === 0) return computeVertexNormals(geo);
  // Smooth: the normal of a point on a sphere is the point itself.
  geo.normals = positions.map((v, i) => {
    const base = i - (i % 3);
    const len =
      Math.hypot(positions[base] ?? 0, positions[base + 1] ?? 0, positions[base + 2] ?? 0) || 1;
    return v / len;
  });
  return geo;
}

/** Spins a profile round the y axis. */
export function latheGeo(
  points: { x: number; y: number }[],
  segments: number,
  phiStart = 0,
  phiLength = Math.PI * 2,
): Geo {
  const geo = empty();
  const inverse = 1 / (points.length - 1);
  for (let i = 0; i <= segments; i++) {
    const phi = phiStart + (i / segments) * phiLength;
    const sin = Math.sin(phi);
    const cos = Math.cos(phi);
    for (let j = 0; j < points.length; j++) {
      const point = points[j] ?? { x: 0, y: 0 };
      geo.positions.push(point.x * sin, point.y, point.x * cos);
      geo.uvs.push(i / segments, j * inverse);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < points.length - 1; j++) {
      const base = j + i * points.length;
      const a = base;
      const b = base + points.length;
      const c = base + points.length + 1;
      const d = base + 1;
      geo.indices.push(a, b, d, c, d, b);
    }
  }
  geo.normals = new Array<number>(geo.positions.length).fill(0);
  return computeVertexNormals(geo);
}

/** A cylinder with a rounded cap at each end. Middle at the origin. */
export function capsuleGeo(
  radius: number,
  length: number,
  capSegments: number,
  radialSegments: number,
): Geo {
  const profile: { x: number; y: number }[] = [];
  const half = length / 2;
  // Up the bottom cap, then over the top one. The two arcs meet at the side.
  for (let i = 0; i <= capSegments; i++) {
    const a = Math.PI * 1.5 + (i / capSegments) * (Math.PI * 0.5);
    profile.push({ x: Math.cos(a) * radius, y: -half + Math.sin(a) * radius });
  }
  for (let i = 0; i <= capSegments; i++) {
    const a = (i / capSegments) * (Math.PI * 0.5);
    profile.push({ x: Math.cos(a) * radius, y: half + Math.sin(a) * radius });
  }
  return latheGeo(profile, radialSegments);
}
