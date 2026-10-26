/**
 * MasseurSkinGrid - skin height of a static body mesh, sampled once at start.
 *
 * Owns: a height grid (default every 2 cm) over the body, in the local space
 * of this component's SceneObject (the Mannequin root: crown at z = 0, body
 * along -Z, table top at y = 0). For every grid point it keeps the highest
 * triangle above it, which is the surface a downward raycast would hit. Only
 * skin meshes count: render meshes whose SceneObject name contains one of
 * `excludeNames` (towel, hair, eyebrows, eyelashes, eyes) are skipped, so the
 * strokes sit on skin.
 *
 * Verification: after building, vertical rays are tested against all skin
 * triangles at sample points across the back; the worst difference from the
 * interpolated grid is printed and exposed as `gridMaxErrorCm`.
 *
 * Inputs: the body root. Must not: render anything or know about the session.
 */

@component
export class MasseurSkinGrid extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurSkinGrid - skin height grid from the body mesh</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Root of the static body (all render meshes below it are considered)")
  bodyRoot: SceneObject
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Comma-separated name parts of meshes to ignore (towel, hair, eyes...)")
  excludeNames: string = "towel,short,hair,eyebrow,eyelash,high-poly,eye"
  @input
  @hint("Grid spacing in cm")
  @widget(new SliderWidget(1, 4, 0.5))
  gridStepCm: number = 2
  @ui.group_end

  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Check the grid against the exact mesh after the bake and log the worst error (slow, one row per frame)")
  verifyGrid: boolean = false
  @ui.group_end
  private built = false

  get isBaked(): boolean { return this.built }
  get triangleCount(): number { return this.skinTris }
  get gridMaxErrorCm(): number { return this.err }
  get usedMeshNames(): string[] { return this.used.slice() }

  private minX = -36
  private maxX = 36
  private minZ = -210
  private maxZ = 4
  private nx = 0
  private nz = 0
  private grid: Float32Array = new Float32Array(0)
  private tri: number[] = [] // flattened x,y,z triples per vertex of each triangle (local space)
  private skinTris = 0
  private err = -1
  private filledCells = 0
  private used: string[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.ensureBaked())
  }

  ensureBaked(): void {
    if (this.built || !this.bodyRoot) return
    try {
      this.collect()
      this.rasterize()
      this.fillSeams()
      this.built = true
      const summary = () => `MasseurSkinGrid: ${this.skinTris} skin tris from [${this.used.join(", ")}], grid ${this.nx}x${this.nz} @ ${this.gridStepCm} cm, seam cells filled ${this.filledCells}`
      if (!this.verifyGrid) {
        print(summary())
      } else {
        // the brute-force check is diagnostic only; it runs one row per frame
        // after the bake so no frame goes over the script time limit
        this.verifyRows = 0
        this.err = 0
        const ev = this.createEvent("UpdateEvent")
        ev.bind(() => {
          if (this.verifyRow()) {
            ev.enabled = false
            print(`${summary()}, grid max error ${this.err.toFixed(3)} cm`)
          }
        })
      }
    } catch (e) {
      print(`MasseurSkinGrid: failed: ${e}`)
    }
  }

  /** Skin height above the table at a local (x, z) point, 0 off the body. */
  heightAt(x: number, z: number): number {
    if (!this.built) return 0
    const s = this.gridStepCm
    const fx = (x - this.minX) / s
    const fz = (z - this.minZ) / s
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    if (ix < 0 || iz < 0 || ix >= this.nx - 1 || iz >= this.nz - 1) return 0
    const tx = fx - ix
    const tz = fz - iz
    const g = (i: number, k: number) => Math.max(0, this.grid[k * this.nx + i])
    const a = g(ix, iz) * (1 - tx) + g(ix + 1, iz) * tx
    const b = g(ix, iz + 1) * (1 - tx) + g(ix + 1, iz + 1) * tx
    return a * (1 - tz) + b * tz
  }

  /** Exact height (brute force over all skin triangles); used for verification. */
  exactHeightAt(x: number, z: number): number {
    let best = -1
    const T = this.tri
    for (let t = 0; t < T.length; t += 9) {
      const y = triHeight(T, t, x, z)
      if (y !== null && y > best) best = y
    }
    return Math.max(0, best)
  }

  // ---- internals ----

  private collect(): void {
    const excl = this.excludeNames.split(",").map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0)
    const toLocal = this.getTransform().getInvertedWorldTransform()
    const visit = (o: SceneObject) => {
      const lname = o.name.toLowerCase()
      const skip = excl.some((w) => lname.indexOf(w) >= 0)
      const rmv = o.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (rmv && rmv.mesh && !skip) {
        const pos = rmv.mesh.getVertexDataForAttribute("position")
        const idx = rmv.mesh.getIndexBuffer()
        const m = toLocal.mult(o.getTransform().getWorldTransform())
        const P: vec3[] = []
        for (let v = 0; v < pos.length; v += 3) P.push(m.multiplyPoint(new vec3(pos[v], pos[v + 1], pos[v + 2])))
        for (let i = 0; i + 2 < idx.length; i += 3) {
          for (let k = 0; k < 3; k++) {
            const p = P[idx[i + k]]
            this.tri.push(p.x, p.y, p.z)
          }
        }
        this.skinTris += Math.floor(idx.length / 3)
        this.used.push(o.name)
      }
      for (let i = 0; i < o.getChildrenCount(); i++) visit(o.getChild(i))
    }
    visit(this.bodyRoot)
    if (this.tri.length === 0) throw new Error("no skin meshes found under bodyRoot")
  }

  private rasterize(): void {
    const s = this.gridStepCm
    this.nx = Math.floor((this.maxX - this.minX) / s) + 1
    this.nz = Math.floor((this.maxZ - this.minZ) / s) + 1
    this.grid = new Float32Array(this.nx * this.nz).fill(-1)
    const T = this.tri
    for (let t = 0; t < T.length; t += 9) {
      const x0 = Math.min(T[t], T[t + 3], T[t + 6]), x1 = Math.max(T[t], T[t + 3], T[t + 6])
      const z0 = Math.min(T[t + 2], T[t + 5], T[t + 8]), z1 = Math.max(T[t + 2], T[t + 5], T[t + 8])
      const i0 = Math.max(0, Math.ceil((x0 - this.minX) / s)), i1 = Math.min(this.nx - 1, Math.floor((x1 - this.minX) / s))
      const k0 = Math.max(0, Math.ceil((z0 - this.minZ) / s)), k1 = Math.min(this.nz - 1, Math.floor((z1 - this.minZ) / s))
      for (let k = k0; k <= k1; k++) {
        for (let i = i0; i <= i1; i++) {
          const y = triHeight(T, t, this.minX + i * s, this.minZ + k * s)
          if (y !== null && y > this.grid[k * this.nx + i]) this.grid[k * this.nx + i] = y
        }
      }
    }
  }

  /** Fills isolated low cells (a seam where mirrored mesh halves meet) from their neighbours. */
  private fillSeams(): void {
    const g = this.grid
    const nx = this.nx
    let filled = 0
    for (let k = 1; k < this.nz - 1; k++) {
      for (let i = 1; i < nx - 1; i++) {
        const c = g[k * nx + i]
        const l = g[k * nx + i - 1], r = g[k * nx + i + 1], u = g[(k - 1) * nx + i], d = g[(k + 1) * nx + i]
        if (l <= 0 || r <= 0) continue
        const lr = (l + r) / 2
        if (c < lr - 3 && Math.abs(l - r) < 3) {
          g[k * nx + i] = lr
          filled++
        } else if (u > 0 && d > 0 && c < (u + d) / 2 - 3 && Math.abs(u - d) < 3) {
          g[k * nx + i] = (u + d) / 2
          filled++
        }
      }
    }
    this.filledCells = filled
  }

  private verifyRows = 0

  /** Checks one row of sample points against the exact mesh; true when all rows are done. */
  private verifyRow(): boolean {
    const z = -35 - 5 * this.verifyRows
    if (z < -90) return true
    for (let x = -10; x <= 10; x += 5) {
      const e = this.exactHeightAt(x, z)
      if (e > 0) this.err = Math.max(this.err, Math.abs(e - this.heightAt(x, z)))
    }
    this.verifyRows++
    return false
  }
}

/** Height of the triangle at T[t..t+8] above (x, z), or null if (x, z) is outside it in plan view. */
function triHeight(T: number[], t: number, x: number, z: number): number | null {
  const ax = T[t], ay = T[t + 1], az = T[t + 2]
  const bx = T[t + 3], by = T[t + 4], bz = T[t + 5]
  const cx = T[t + 6], cy = T[t + 7], cz = T[t + 8]
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
  if (Math.abs(d) < 1e-9) return null
  const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d
  const w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d
  const w3 = 1 - w1 - w2
  const eps = 2e-3 // a point on a shared edge is not rejected by both triangles
  if (w1 < -eps || w2 < -eps || w3 < -eps) return null
  return w1 * ay + w2 * by + w3 * cy
}
