/**
 * MasseurHumanBody - the stand-in person: Snap's "Body Mesh With Skeleton"
 * (Lens Studio Asset Library), laid face down on the table.
 *
 * Owns: a one-time bake at start. The A-pose skinned body (a child of this
 * object, rotated to lie prone) is skinned on the CPU with its arm bones
 * turned down so the arms rest by the sides, then rebuilt as one static mesh
 * in this object's local space (crown at z = 0, body along -Z, front on the
 * table at y = 0). The static mesh is what renders, and its top surface is
 * rasterized into a height grid (default every 2 cm) that MasseurBodyMap and
 * the towel use, so the strokes sit exactly on the real skin.
 *
 * Verification: after the bake, a brute-force vertical ray test against the
 * real triangles is run at sample points and the worst difference from the
 * grid is printed and exposed as `gridMaxErrorCm`.
 *
 * Inputs: the source body, the skin material and tint, the arm angle.
 * Must not: know about the session, strokes or UI.
 */

const GRID_MIN_X = -36
const GRID_MAX_X = 36
const GRID_MIN_Z = -150
const GRID_MAX_Z = 2

@component
export class MasseurHumanBody extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurHumanBody - Asset Library body, prone, baked</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Root of the A-pose skinned body instance (has the Skin component); hidden after the bake")
  sourceBody: SceneObject
  @input
  @hint("Lit material for the skin; a tinted copy is made at runtime")
  skinMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input("vec3", "{0.92, 0.79, 0.69}")
  @hint("Neutral, light skin tone (keep it light: the display is additive)")
  @widget(new ColorWidget())
  skinColor: vec3
  @input
  @hint("Bring the A-pose arms down so they rest along the sides of the body")
  armsAlongBody: boolean = true
  @input
  @hint("Bring the A-pose legs together (the source stands with the feet apart)")
  legsTogether: boolean = true
  @input
  @hint("Body thickness when lying prone, relative to the standing scan (a prone back settles; 1 = as scanned)")
  @widget(new SliderWidget(0.6, 1, 0.01))
  proneThicknessScale: number = 0.8
  @input
  @hint("Height grid spacing in cm")
  @widget(new SliderWidget(1, 4, 0.5))
  gridStepCm: number = 2
  @ui.group_end

  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Print the baked mesh to the log as OBJ text (for offline inspection)")
  debugDumpObj: boolean = false
  @ui.group_end
  private baked = false

  // ---- read state ----
  get isBaked(): boolean { return this.baked }
  get triangleCount(): number { return this.tris }
  get vertexCount(): number { return this.verts }
  get gridMaxErrorCm(): number { return this.gridErr }
  /** Bone positions in this object's local space after the bake (for landmark placement). */
  getBoneLocal(name: string): vec3 | null { return this.boneLocal[name] ?? null }

  private tris = 0
  private flippedTris = 0
  private missingBones = 0
  private verts = 0
  private gridErr = -1
  private nx = 0
  private nz = 0
  private grid: Float32Array = new Float32Array(0)
  private boneLocal: Record<string, vec3> = {}
  private localPos: vec3[] = []
  private indices: number[] = []

  onAwake(): void {
    this.ensureBaked()
  }

  /** Skin height above the table at a local (x, z) point, 0 off the body. */
  heightAt(x: number, z: number): number {
    if (!this.baked) return 0
    const fx = (x - GRID_MIN_X) / this.gridStepCm
    const fz = (z - GRID_MIN_Z) / this.gridStepCm
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

  ensureBaked(): void {
    if (this.baked) return
    if (!this.sourceBody) {
      print("MasseurHumanBody: sourceBody not wired")
      return
    }
    try {
      this.bake()
    } catch (e) {
      print(`MasseurHumanBody: bake failed: ${e}`)
    }
  }

  // ---- bake ----

  private bake(): void {
    const skin = this.findComponent(this.sourceBody, "Component.Skin") as Skin
    const rmv = this.findComponent(this.sourceBody, "Component.RenderMeshVisual") as RenderMeshVisual
    if (!skin || !rmv || !rmv.mesh) throw new Error("source body has no Skin / RenderMeshVisual")
    const mesh = rmv.mesh
    const pos = mesh.getVertexDataForAttribute("position")
    const nrm = mesh.getVertexDataForAttribute("normal")
    const bone = mesh.getVertexDataForAttribute("boneData")
    const idx = mesh.getIndexBuffer()
    const names = mesh.extractBoneNames()
    const inv = mesh.extractBoneInverseMatrices()
    const n = pos.length / 3
    if (!idx || idx.length === 0 || bone.length < n * 4) throw new Error(`unexpected mesh data (pos ${pos.length}, bone ${bone.length}, idx ${idx ? idx.length : 0})`)

    // 1) Rest pose (the A-pose as authored). At rest every bone's world x inverse-bind is the
    //    same mesh-to-world matrix, so take it from the hips. Joint (bind) positions come from
    //    the inverse bind matrices.
    const toLocal = this.getTransform().getInvertedWorldTransform()
    const boneObj = (nm: string) => skin.getSkinBone(nm) ?? this.findByName(this.sourceBody, nm)
    const bindPos: Record<string, vec3> = {}
    names.forEach((nm, i) => (bindPos[nm] = inv[i].inverse().multiplyPoint(vec3.zero())))
    const hipsIdx = Math.max(0, names.indexOf("Character1_Hips"))
    const hipsObj = boneObj(names[hipsIdx])
    if (!hipsObj) throw new Error("hips bone not found")
    const meshToWorld = hipsObj.getTransform().getWorldTransform().mult(inv[hipsIdx])
    this.missingBones = names.filter((nm) => !boneObj(nm)).length

    // 2) Geometric re-pose in the standing mesh space (cm, +Y up, front = +Z). The source's
    //    boneData indices do not map reliably to its bone names, so instead of reskinning,
    //    limb vertices are rotated about the joint, blended in across the joint region.
    interface Limb { pivot: vec3; q: quat; weight: (p: vec3) => number }
    const limbs: Limb[] = []
    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
      return t * t * (3 - 2 * t)
    }
    for (const side of [1, -1]) {
      const nm = side > 0 ? "Left" : "Right"
      const sh = bindPos[`Character1_${nm}Arm`]
      const el = bindPos[`Character1_${nm}ForeArm`]
      if (this.armsAlongBody && sh && el) {
        const target = new vec3(0.12 * side, -1, 0.3) // down the body, a little forward (toward the table) and out
        const q = quat.rotationFromTo(el.sub(sh).normalize(), target.normalize())
        const x0 = Math.abs(sh.x) - 3
        // below the chest only the far-out forearm/hand counts as arm (keeps the thighs out)
        limbs.push({pivot: sh, q, weight: (p) => (Math.sign(p.x) === side && p.y > sh.y - 70 ? smooth(x0, x0 + 6, Math.abs(p.x)) * (p.y > sh.y - 30 ? 1 : smooth(22, 30, Math.abs(p.x))) : 0)})
      }
      const hip = bindPos[`Character1_${nm}UpLeg`]
      const knee = bindPos[`Character1_${nm}Leg`]
      if (this.legsTogether && hip && knee) {
        const target = new vec3(0.04 * side, -1, 0)
        const q = quat.rotationFromTo(knee.sub(hip).normalize(), target.normalize())
        limbs.push({pivot: hip, q, weight: (p) => ((Math.sign(p.x) === side || Math.abs(p.x) < 0.5) && Math.abs(p.x) < 28 ? smooth(hip.y + 4, hip.y - 8, p.y) : 0)})
      }
    }
    const pose = (p: vec3): {p: vec3; rot: quat | null; w: number} => {
      let out = p
      for (const l of limbs) {
        const w = l.weight(p)
        if (w <= 0) continue
        const rotated = l.pivot.add(l.q.multiplyVec3(p.sub(l.pivot)))
        out = vec3.lerp(p, rotated, w)
        return {p: out, rot: quat.slerp(quat.quatIdentity(), l.q, w), w}
      }
      return {p: out, rot: null, w: 0}
    }

    const out: vec3[] = new Array(n)
    const outN: vec3[] = new Array(n)
    for (let v = 0; v < n; v++) {
      const p = new vec3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
      const q = nrm.length >= n * 3 ? new vec3(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) : vec3.up()
      const r = pose(p)
      out[v] = toLocal.multiplyPoint(meshToWorld.multiplyPoint(r.p))
      outN[v] = toLocal.multiplyDirection(meshToWorld.multiplyDirection(r.rot ? r.rot.multiplyVec3(q) : q)).normalize()
    }
    // posed joint positions (for landmark placement)
    const posedBone = (b: SceneObject): vec3 => {
      const bp = bindPos[b.name]
      return bp ? meshToWorld.multiplyPoint(pose(bp).p) : b.getTransform().getWorldPosition()
    }

    // align: front on the table (min y = 0), crown at z = 0, centred on x = 0
    let minY = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity
    for (const p of out) {
      minY = Math.min(minY, p.y)
      maxZ = Math.max(maxZ, p.z)
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
    }
    // centre on the hips bone (the arms can make the bounding box asymmetric)
    const hips = skin.getSkinBone("Character1_Hips")
    const cx = hips ? toLocal.multiplyPoint(hips.getTransform().getWorldPosition()).x : (minX + maxX) / 2
    const shift = new vec3(-cx, -minY, -maxZ)
    const flat = this.proneThicknessScale
    for (let v = 0; v < n; v++) {
      const p = out[v].add(shift)
      out[v] = new vec3(p.x, p.y * flat, p.z)
      const q = outN[v]
      outN[v] = new vec3(q.x * flat, q.y, q.z * flat).normalize() // normals transform by the inverse scale
    }
    for (const nm of names) {
      const b = boneObj(nm)
      if (b) {
        const p = toLocal.multiplyPoint(posedBone(b)).add(shift)
        this.boneLocal[nm] = new vec3(p.x, p.y * flat, p.z)
      }
    }

    // static, lit render mesh
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    const data: number[] = []
    for (let v = 0; v < n; v++) data.push(out[v].x, out[v].y, out[v].z, outN[v].x, outN[v].y, outN[v].z)
    builder.appendVerticesInterleaved(data)
    const ind: number[] = Array.from(idx)
    // orient every triangle so its face normal agrees with its vertex normals (front = counter-clockwise)
    let flipped = 0
    for (let t = 0; t < ind.length; t += 3) {
      const a = out[ind[t]], b = out[ind[t + 1]], c = out[ind[t + 2]]
      const fn = b.sub(a).cross(c.sub(a))
      const vn = outN[ind[t]].add(outN[ind[t + 1]]).add(outN[ind[t + 2]])
      if (fn.dot(vn) < 0) {
        const tmp = ind[t + 1]
        ind[t + 1] = ind[t + 2]
        ind[t + 2] = tmp
        flipped++
      }
    }
    this.flippedTris = flipped
    builder.appendIndices(ind)
    const obj = global.scene.createSceneObject("BakedBodyMesh")
    obj.setParent(this.getSceneObject())
    const vis = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    vis.mesh = builder.getMesh()
    if (this.skinMaterial) {
      const m = this.skinMaterial.clone()
      const c = this.skinColor ?? new vec3(0.92, 0.79, 0.69)
      m.mainPass.baseColor = new vec4(c.x, c.y, c.z, 1)
      m.mainPass.roughness = 0.7
      m.mainPass.metallic = 0
      vis.mainMaterial = m
    }
    builder.updateMesh()
    this.sourceBody.enabled = false

    this.localPos = out
    this.indices = ind
    this.verts = n
    this.tris = ind.length / 3
    this.buildGrid()
    this.baked = true
    this.verifyGrid()
    if (this.debugDumpObj) {
      for (let v = 0; v < n; v += 40) print("OBJV " + out.slice(v, v + 40).map((p) => `v ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}`).join("|"))
      for (let t = 0; t < ind.length; t += 120) {
        const fs: string[] = []
        for (let k = t; k < Math.min(ind.length, t + 120); k += 3) fs.push(`f ${ind[k] + 1} ${ind[k + 1] + 1} ${ind[k + 2] + 1}`)
        print("OBJF " + fs.join("|"))
      }
    }
    print(`MasseurHumanBody: baked ${this.verts} verts / ${this.tris} tris, length ${(-this.minZ()).toFixed(1)} cm, grid ${this.nx}x${this.nz} @ ${this.gridStepCm} cm, grid max error ${this.gridErr.toFixed(3)} cm, triangles re-oriented ${this.flippedTris}, bones ${names.length} (missing ${this.missingBones})`)
  }

  private minZ(): number {
    let m = 0
    for (const p of this.localPos) m = Math.min(m, p.z)
    return m
  }

  /** Top surface of the body: for each grid cell centre, the highest triangle above it. */
  private buildGrid(): void {
    const s = this.gridStepCm
    this.nx = Math.floor((GRID_MAX_X - GRID_MIN_X) / s) + 1
    this.nz = Math.floor((GRID_MAX_Z - GRID_MIN_Z) / s) + 1
    this.grid = new Float32Array(this.nx * this.nz).fill(-1)
    const P = this.localPos
    for (let t = 0; t < this.indices.length; t += 3) {
      const a = P[this.indices[t]], b = P[this.indices[t + 1]], c = P[this.indices[t + 2]]
      const i0 = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - GRID_MIN_X) / s))
      const i1 = Math.min(this.nx - 1, Math.floor((Math.max(a.x, b.x, c.x) - GRID_MIN_X) / s))
      const k0 = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - GRID_MIN_Z) / s))
      const k1 = Math.min(this.nz - 1, Math.floor((Math.max(a.z, b.z, c.z) - GRID_MIN_Z) / s))
      for (let k = k0; k <= k1; k++) {
        for (let i = i0; i <= i1; i++) {
          const y = triHeight(a, b, c, GRID_MIN_X + i * s, GRID_MIN_Z + k * s)
          if (y !== null && y > this.grid[k * this.nx + i]) this.grid[k * this.nx + i] = y
        }
      }
    }
  }

  /** Brute-force vertical rays against all triangles at sample points across the back. */
  private verifyGrid(): void {
    let worst = 0
    for (let z = -40; z >= -80; z -= 5) {
      for (let x = -10; x <= 10; x += 5) {
        let best = -1
        const P = this.localPos
        for (let t = 0; t < this.indices.length; t += 3) {
          const y = triHeight(P[this.indices[t]], P[this.indices[t + 1]], P[this.indices[t + 2]], x, z)
          if (y !== null && y > best) best = y
        }
        if (best >= 0) worst = Math.max(worst, Math.abs(best - this.heightAt(x, z)))
      }
    }
    this.gridErr = worst
  }

  private findByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) return root
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const r = this.findByName(root.getChild(i), name)
      if (r) return r
    }
    return null
  }

  private findComponent(root: SceneObject, type: string): Component | null {
    const c = root.getComponent(type as any) as Component
    if (c) return c
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const r = this.findComponent(root.getChild(i), type)
      if (r) return r
    }
    return null
  }
}

/** Height of triangle abc above the point (x, z), or null if (x, z) is outside it in plan view. */
function triHeight(a: vec3, b: vec3, c: vec3, x: number, z: number): number | null {
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
  if (Math.abs(d) < 1e-9) return null
  const w1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d
  const w2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d
  const w3 = 1 - w1 - w2
  // small tolerance so a point on a shared edge is not rejected by both triangles (float precision)
  const eps = 2e-3
  if (w1 < -eps || w2 < -eps || w3 < -eps) return null
  return w1 * a.y + w2 * b.y + w3 * c.y
}
