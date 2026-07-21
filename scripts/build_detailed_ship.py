"""Build the browser-ready Wayward Gull asset with Blender's Python API.

Run with:
  blender --background --python scripts/build_detailed_ship.py
"""

from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
GLB_OUT = ROOT / "public/assets/models/ships/wayward-gull-detailed.glb"
BLEND_OUT = ROOT / "work/blender/wayward-gull-detailed.blend"


def material(name, color, roughness=0.55, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 3.2
    return mat


def set_mat(obj, mat):
    obj.data.materials.append(mat)
    return obj


def cube(name, location, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_mat(obj, mat)
    if bevel:
        mod = obj.modifiers.new("Softened edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def cylinder(name, location, radius, depth, mat, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    return obj


def beam_between(name, start, end, radius, mat, vertices=12):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    obj = cylinder(name, (start_v + end_v) / 2, radius, delta.length, mat, vertices=vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def rope(name, points, radius=0.014, mat=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coords in zip(spline.points, points):
        point.co = (*coords, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if mat:
        set_mat(obj, mat)
    return obj


def disc(name, location, radius, depth, mat, rotation=(0, 0, 0), vertices=24):
    return cylinder(name, location, radius, depth, mat, rotation=rotation, vertices=vertices)


def hull_width(x):
    normalized = min(1.0, abs(x) / 6.4)
    return 0.18 + 1.72 * max(0.0, 1.0 - normalized**1.72) ** 0.52


def build_hull(mats):
    xs = [-6.4 + i * 0.4 for i in range(33)]
    arcs = 18
    verts = []
    for x in xs:
        width = hull_width(x)
        depth = 1.06 + 0.25 * (1 - min(1, abs(x) / 6.4))
        sheer = 0.50 + 0.16 * (abs(x) / 6.4) ** 1.7
        for j in range(arcs + 1):
            angle = pi * j / arcs
            y = width * cos(angle)
            z = sheer - depth * sin(angle)
            # Pull the bow upward and sharpen the waterline.
            z += max(0, (abs(x) - 4.8)) * 0.16
            verts.append((x, y, z))
    faces = []
    ring = arcs + 1
    for i in range(len(xs) - 1):
        for j in range(arcs):
            a = i * ring + j
            b = a + 1
            c = a + ring + 1
            d = a + ring
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new("WaywardGullHullMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    hull = bpy.data.objects.new("Hull_detailed_oak", mesh)
    bpy.context.collection.objects.link(hull)
    set_mat(hull, mats["hull"])
    for poly in mesh.polygons:
        poly.use_smooth = True

    deck_verts = []
    for x in xs:
        w = hull_width(x) * 0.94
        deck_verts.extend([(x, -w, 0.59 + 0.12 * (abs(x) / 6.4)), (x, w, 0.59 + 0.12 * (abs(x) / 6.4))])
    deck_faces = [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(len(xs) - 1)]
    deck_mesh = bpy.data.meshes.new("WaywardGullDeckMesh")
    deck_mesh.from_pydata(deck_verts, [], deck_faces)
    deck = bpy.data.objects.new("Deck_planked_oak", deck_mesh)
    bpy.context.collection.objects.link(deck)
    set_mat(deck, mats["deck"])

    # Bright hull strakes give the silhouette the same readable layered trim as the reference.
    for side in (-1, 1):
        for z, radius in ((0.26, 0.035), (-0.02, 0.028)):
            points = []
            for x in xs[2:-2]:
                points.append((x, side * hull_width(x) * 1.005, z + max(0, abs(x) - 4.8) * 0.13))
            rope("Hull_trim", points, radius, mats["trim"])

    # Keel, stern galleries and raised quarterdeck.
    beam_between("Keel", (-5.8, 0, -0.55), (5.75, 0, -0.55), 0.10, mats["dark_wood"], 12)
    cube("Quarterdeck", (-4.35, 0, 0.83), (1.45, 1.36, 0.18), mats["deck"], 0.06)
    cube("Stern_gallery", (-5.6, 0, 1.02), (0.42, 1.26, 0.45), mats["dark_wood"], 0.08)
    for side in (-0.76, 0, 0.76):
        cube("Stern_window", (-6.04, side, 1.12), (0.035, 0.22, 0.18), mats["window"], 0.025)

    # Gun ports, bronze barrels and deck-plank seams.
    for side in (-1, 1):
        for x in (-4.4, -3.25, -2.1, -0.95, 0.2, 1.35, 2.5, 3.65, 4.75):
            y = side * (hull_width(x) + 0.025)
            port = cube("Gun_port", (x, y, 0.07), (0.25, 0.035, 0.18), mats["port"], 0.025)
            barrel = cylinder("Cannon_barrel", (x, y + side * 0.18, 0.07), 0.055, 0.42, mats["metal"], rotation=(pi / 2, 0, 0), vertices=12)
            if side < 0:
                barrel.rotation_euler.x = -pi / 2
    for y in (-1.05, -0.7, -0.35, 0.35, 0.7, 1.05):
        rope("Deck_seam", [(-5.35, y * 0.82, 0.615), (5.35, y * 0.82, 0.615)], 0.007, mats["dark_wood"])


def cloth_panel(name, x, z_top, z_bottom, half_width_top, half_width_bottom, mats, billow=0.18):
    rows, cols = 7, 9
    verts = []
    for row in range(rows):
        t = row / (rows - 1)
        z = z_top * (1 - t) + z_bottom * t
        half_width = half_width_top * (1 - t) + half_width_bottom * t
        for col in range(cols):
            u = col / (cols - 1)
            y = -half_width + 2 * half_width * u
            x_billow = x + billow * sin(pi * u) * sin(pi * t)
            verts.append((x_billow, y, z))
    faces = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            a = row * cols + col
            faces.append((a, a + 1, a + cols + 1, a + cols))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_mat(obj, mats["sail"])
    solidify = obj.modifiers.new("Canvas thickness", "SOLIDIFY")
    solidify.thickness = 0.018
    return obj


def triangular_sail(name, points, mats, billow_direction=0.13):
    # Subdivided triangular cloth would be excessive for a background ship; the center
    # vertex adds enough curvature to catch light while retaining a clean silhouette.
    p0, p1, p2 = [Vector(point) for point in points]
    center = (p0 + p1 + p2) / 3 + Vector((0, billow_direction, 0))
    verts = [tuple(p0), tuple(p1), tuple(p2), tuple(center)]
    faces = [(0, 1, 3), (1, 2, 3), (2, 0, 3)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_mat(obj, mats["sail"])
    solidify = obj.modifiers.new("Canvas thickness", "SOLIDIFY")
    solidify.thickness = 0.016
    return obj


def build_rig(mats):
    masts = [(-3.25, 6.5), (0.0, 8.25), (3.15, 7.1)]
    for mast_index, (x, height) in enumerate(masts):
        beam_between("Mast", (x, 0, 0.54), (x, 0, height), 0.13 if mast_index != 1 else 0.16, mats["mast"], 18)
        beam_between("Topmast", (x, 0, height - 0.25), (x, 0, height + 1.55), 0.082, mats["mast"], 16)
        disc("Mast_cap", (x, 0, height), 0.2, 0.10, mats["metal"], vertices=20)
        if mast_index == 1:
            disc("Crows_nest", (x, 0, 6.2), 0.46, 0.12, mats["dark_wood"], vertices=24)

        yard_specs = [(height - 0.8, 1.62), (height - 2.25, 2.05), (height - 3.62, 2.28)]
        for yard_idx, (z, half_span) in enumerate(yard_specs):
            beam_between("Yard", (x, -half_span, z), (x, half_span, z), 0.065, mats["mast"], 14)
            if yard_idx < 2 or mast_index == 1:
                next_z = z - (1.22 if yard_idx == 0 else 1.08)
                cloth_panel("Square_sail", x + 0.035, z - 0.06, next_z, half_span * 0.92, half_span * 0.76, mats, 0.16)

        # Shrouds and ratlines on both sides.
        top = (x, 0, height - 0.35)
        for side in (-1, 1):
            anchor_y = side * (1.32 if mast_index == 1 else 1.18)
            for offset in (-0.62, -0.2, 0.2, 0.62):
                rope("Standing_rigging", [top, (x + offset, anchor_y, 0.68)], 0.017, mats["rope"])
            for z_step in range(1, 9):
                t = z_step / 10
                left = Vector(top).lerp(Vector((x - 0.62, anchor_y, 0.68)), t)
                right = Vector(top).lerp(Vector((x + 0.62, anchor_y, 0.68)), t)
                rope("Ratline", [tuple(left), tuple(right)], 0.008, mats["rope"])

    # Fore-and-aft stays, braces, jibs and bow sprit.
    tops = [(-3.25, 0, 7.95), (0, 0, 9.7), (3.15, 0, 8.55)]
    rope("Forestay", [tops[0], (-6.1, 0, 0.9)], 0.025, mats["rope"])
    rope("Mainstay", [tops[1], (-3.25, 0, 1.0)], 0.025, mats["rope"])
    rope("Mizzenstay", [tops[2], (0, 0, 1.05)], 0.024, mats["rope"])
    rope("Backstay", [tops[2], (5.8, 0, 0.9)], 0.025, mats["rope"])
    for top in tops:
        for side in (-1, 1):
            rope("Running_rigging", [top, (top[0] - 1.2, side * 1.35, 0.7)], 0.012, mats["rope"])
            rope("Running_rigging", [top, (top[0] + 1.2, side * 1.35, 0.7)], 0.012, mats["rope"])
    beam_between("Bowsprit", (-5.45, 0, 0.82), (-8.15, 0, 2.0), 0.105, mats["mast"], 16)
    rope("Bowsprit_stay", [(-8.15, 0, 2.0), (-6.0, 0, -0.15)], 0.016, mats["rope"])
    triangular_sail("Fore_jib", [(-6.15, 0.02, 1.05), (-3.35, 0.02, 6.55), (-3.35, 0.02, 1.02)], mats)
    triangular_sail("Main_staysail", [(-3.12, 0.03, 1.2), (-0.12, 0.03, 8.0), (-0.12, 0.03, 1.2)], mats, -0.12)

    # Ensign and pennant.
    triangular_sail("Red_pennant", [(3.15, 0.01, 8.52), (4.05, 0.01, 8.22), (3.15, 0.01, 8.08)], {**mats, "sail": mats["flag"]}, 0.06)


def build_deck_details(mats):
    # Rails and stanchions follow the hull sheer.
    for side in (-1, 1):
        rail_points = []
        for i, x in enumerate([-5.45 + j * 0.5 for j in range(23)]):
            y = side * hull_width(x) * 0.90
            z = 0.94 + 0.08 * (abs(x) / 5.7)
            rail_points.append((x, y, z))
            if i % 2 == 0:
                beam_between("Rail_post", (x, y, 0.64), (x, y, z), 0.025, mats["trim"], 8)
        rope("Rail_top", rail_points, 0.035, mats["trim"])

    # Deck houses, hatch grates, capstan, wheel and cargo.
    cube("Forward_hatch", (2.75, 0, 0.73), (0.72, 0.58, 0.12), mats["dark_wood"], 0.05)
    cube("Main_hatch", (-0.75, 0, 0.73), (0.86, 0.62, 0.11), mats["dark_wood"], 0.05)
    cube("Cabin_skylight", (-4.3, 0, 1.16), (0.55, 0.52, 0.18), mats["dark_wood"], 0.05)
    for x in (-0.75, 2.75):
        for line in (-0.34, 0, 0.34):
            rope("Hatch_grate", [(x - 0.62, line, 0.86), (x + 0.62, line, 0.86)], 0.018, mats["trim"])
    cylinder("Capstan", (1.25, 0, 0.93), 0.18, 0.58, mats["dark_wood"], vertices=12)
    disc("Ship_wheel", (-3.2, 0, 1.42), 0.34, 0.07, mats["trim"], rotation=(pi / 2, 0, 0))
    for angle in range(0, 360, 45):
        rad = angle * pi / 180
        beam_between("Wheel_spoke", (-3.2, 0, 1.42), (-3.2 + 0.28 * cos(rad), 0, 1.42 + 0.28 * sin(rad)), 0.018, mats["trim"], 8)
    for x, y in ((3.9, -0.55), (4.35, 0.55), (-2.2, 0.72), (-2.0, -0.66)):
        cylinder("Cargo_barrel", (x, y, 0.86), 0.18, 0.42, mats["barrel"], vertices=14)
        rope("Barrel_band", [(x - 0.2, y, 0.75), (x + 0.2, y, 0.75)], 0.018, mats["metal"])

    # Lanterns are small, but the warm emissive points stay legible through fog.
    for x, y in ((-5.75, -0.86), (-5.75, 0.86), (4.85, -0.82), (4.85, 0.82)):
        cylinder("Lantern_frame", (x, y, 1.18), 0.07, 0.28, mats["metal"], vertices=10)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.055, location=(x, y, 1.18))
        set_mat(bpy.context.object, mats["lantern"])


def join_named(prefix):
    objects = [obj for obj in bpy.context.scene.objects if obj.name.startswith(prefix)]
    if len(objects) < 2:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if obj.type == "CURVE":
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
    objects = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    if len(objects) > 1:
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = prefix + "_merged"


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    mats = {
        "hull": material("Aged dark oak", (0.075, 0.045, 0.025), 0.68),
        "dark_wood": material("Tarred timber", (0.032, 0.022, 0.016), 0.72),
        "deck": material("Weathered deck oak", (0.31, 0.19, 0.09), 0.78),
        "mast": material("Spar pine", (0.24, 0.12, 0.048), 0.7),
        "trim": material("Warm ivory trim", (0.57, 0.47, 0.28), 0.58, 0.08),
        "metal": material("Blackened iron", (0.035, 0.04, 0.038), 0.38, 0.78),
        "rope": material("Hemp rigging", (0.07, 0.055, 0.038), 0.92),
        "sail": material("Salt-stained canvas", (0.68, 0.63, 0.48), 0.9),
        "flag": material("Wayward red ensign", (0.38, 0.035, 0.04), 0.78),
        "port": material("Open gun ports", (0.012, 0.009, 0.008), 0.88),
        "window": material("Stern glass", (0.08, 0.22, 0.23), 0.24, 0.28),
        "barrel": material("Cargo stave", (0.22, 0.105, 0.035), 0.8),
        "lantern": material("Lantern flame", (0.7, 0.25, 0.035), 0.3, emission=(1.0, 0.22, 0.025)),
    }

    build_hull(mats)
    build_rig(mats)
    build_deck_details(mats)

    # Merge the numerous thin repeated pieces into sensible WebGL draw groups.
    for prefix in ("Standing_rigging", "Running_rigging", "Ratline", "Rail_post", "Cannon_barrel", "Gun_port", "Deck_seam"):
        join_named(prefix)

    bpy.ops.object.select_all(action="SELECT")
    for obj in bpy.context.selected_objects:
        if obj.type == "MESH":
            obj["game_asset"] = "wayward-gull"
    GLB_OUT.parent.mkdir(parents=True, exist_ok=True)
    BLEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUT),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print(f"Exported {GLB_OUT}")


if __name__ == "__main__":
    main()
