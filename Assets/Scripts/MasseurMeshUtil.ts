/**
 * MasseurMeshUtil - small MeshBuilder helpers shared by the procedural visuals.
 *
 * Owns: a lofted-tube builder with automatic outward winding and smooth
 * normals (mannequin), and a vertex-colored ribbon / disc layout used by the
 * neon strokes, rings, scan band and landmark dots.
 * Must not: hold any session state.
 */

/** Layout for lit, solid meshes. */
export const LIT_LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
]

/** Layout for unlit glow meshes (vertex color drives brightness). */
export const GLOW_LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
  {name: "color", components: 4},
]
export const GLOW_STRIDE = 10

export function newBuilder(layout: any[]): MeshBuilder {
  const b = new MeshBuilder(layout)
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  return b
}

/**
 * Appends a closed loft (rings of points) plus end caps to a lit builder.
 * Each ring must have the same point count. Triangles are wound so their
 * normal points away from the ring centroid, which makes them visible under
 * back-face culling regardless of the ring ordering.
 */
export function appendLoft(builder: MeshBuilder, rings: vec3[][], capStart: boolean, capEnd: boolean): void {
  const base = builder.getVerticesCount()
  const n = rings[0].length
  const positions: vec3[] = []
  const normals: vec3[] = []
  const centers: vec3[] = rings.map((r) => {
    let c = vec3.zero()
    for (const p of r) c = c.add(p)
    return c.uniformScale(1 / r.length)
  })
  for (const r of rings) for (const p of r) {
    positions.push(p)
    normals.push(vec3.zero())
  }
  const tris: number[] = []
  const addTri = (a: number, b: number, c: number, outward: vec3) => {
    const pa = positions[a], pb = positions[b], pc = positions[c]
    let nrm = pb.sub(pa).cross(pc.sub(pa))
    if (nrm.dot(outward) < 0) {
      const t = b
      b = c
      c = t
      nrm = nrm.uniformScale(-1)
    }
    tris.push(a, b, c)
    normals[a] = normals[a].add(nrm)
    normals[b] = normals[b].add(nrm)
    normals[c] = normals[c].add(nrm)
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n
      const a = i * n + j, b = i * n + j2, c = (i + 1) * n + j, d = (i + 1) * n + j2
      const mid = positions[a].add(positions[d]).uniformScale(0.5)
      const ctr = centers[i].add(centers[i + 1]).uniformScale(0.5)
      const out = mid.sub(ctr)
      addTri(a, c, b, out)
      addTri(b, c, d, out)
    }
  }
  const verts: number[] = []
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    const nn = normals[i].length > 1e-6 ? normals[i].normalize() : vec3.up()
    verts.push(p.x, p.y, p.z, nn.x, nn.y, nn.z)
  }
  // End caps: separate vertices with flat normals along the loft axis.
  const capIdx: number[] = []
  const addCap = (ringIndex: number, axisOut: vec3): void => {
    const r = rings[ringIndex]
    const c = centers[ringIndex]
    const startIndex = base + verts.length / 6
    verts.push(c.x, c.y, c.z, axisOut.x, axisOut.y, axisOut.z)
    for (const p of r) verts.push(p.x, p.y, p.z, axisOut.x, axisOut.y, axisOut.z)
    for (let j = 0; j < n; j++) {
      const p0 = r[j], p1 = r[(j + 1) % n]
      const nrm = p0.sub(c).cross(p1.sub(c))
      const i0 = startIndex + 1 + j, i1 = startIndex + 1 + ((j + 1) % n)
      if (nrm.dot(axisOut) >= 0) capIdx.push(startIndex, i0, i1)
      else capIdx.push(startIndex, i1, i0)
    }
  }
  if (capStart && rings.length > 1) addCap(0, centers[0].sub(centers[1]).normalize())
  if (capEnd && rings.length > 1) addCap(rings.length - 1, centers[rings.length - 1].sub(centers[rings.length - 2]).normalize())
  builder.appendVerticesInterleaved(verts)
  builder.appendIndices(tris.map((t) => t + base).concat(capIdx))
}

/** Piecewise-smooth interpolation through [x, y] keys (smoothstep between keys). */
export function keyed(keys: number[][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [x0, y0] = keys[i]
    const [x1, y1] = keys[i + 1]
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0)
      const s = t * t * (3 - 2 * t)
      return y0 + (y1 - y0) * s
    }
  }
  return keys[keys.length - 1][1]
}

export function glowVertex(out: number[], p: vec3, c: vec4): void {
  out.push(p.x, p.y, p.z, 0, 1, 0, c.x, c.y, c.z, c.w)
}

export function scaleColor(c: vec4, k: number): vec4 {
  return new vec4(c.x * k, c.y * k, c.z * k, c.w)
}

/** Additive, two-sided, no-depth-write clone of a vertex-color material: a soft neon glow. */
export function makeGlowMaterial(base: Material): Material {
  const m = base.clone()
  m.mainPass.blendMode = BlendMode.Add
  m.mainPass.depthWrite = false
  m.mainPass.depthTest = true
  m.mainPass.twoSided = true
  return m
}
