# Decimate a posed character GLB and shrink its textures for SPECS.
# Usage: Blender -b --factory-startup --python optimize_glb.py -- in.glb out.glb target_tris max_tex
import sys, bpy

a = sys.argv[sys.argv.index("--") + 1:]
src, dst, target, max_tex = a[0], a[1], int(a[2]), int(a[3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


total = sum(tris(o) for o in meshes)
print("STATS before", total, [(o.name, tris(o)) for o in meshes])
ratio = min(1.0, target / total)
for o in meshes:
    # small parts (eyes, lashes, brows) keep their shape; only heavy meshes are decimated
    if tris(o) < 2000:
        continue
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="dec")
print("STATS after", sum(tris(o) for o in meshes))

for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > max_tex:
        s = max_tex / max(w, h)
        img.scale(int(w * s), int(h * s))
        print("TEX", img.name, (w, h), "->", tuple(img.size))

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=88)
print("EXPORT", dst)
