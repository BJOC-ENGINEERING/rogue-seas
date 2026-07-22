"""Build a browser-ready Iron Leviathan war-mech with Blender's Python API.

Procedural bipedal siege machine meant to replace the flat photo cutout in combat.
Hardpoints are authored to match src/battleLayout.js MECH_GUNS (local space).

Run with:
  blender --background --python scripts/build_war_mech.py
"""

from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
GLB_OUT = ROOT / "public/assets/models/mechs/iron-leviathan.glb"
BLEND_OUT = ROOT / "work/blender/iron-leviathan.blend"

# Local muzzle points mirrored from battleLayout MECH_GUNS for muzzle-flash alignment.
MECH_GUNS = [
    (-1.15, 2.0, 1.18),
    (-1.15, 1.8, 0.9),
    (1.15, 2.0, 1.18),
    (1.15, 1.8, 0.9),
]


def material(name, color, roughness=0.45, metallic=0.85, emission=None, emission_strength=2.5):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 22.0
    tex.inputs["Detail"].default_value = 10.0
    tex.location = (-420, 80)
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-220, 80)
    ramp.color_ramp.elements[0].position = 0.4
    ramp.color_ramp.elements[0].color = (color[0] * 0.55, color[1] * 0.55, color[2] * 0.55, 1)
    ramp.color_ramp.elements[1].color = (*[min(1, c * 1.15) for c in color], 1)
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.35
    mix.location = (-40, 120)
    mix.inputs["Color1"].default_value = (*color, 1)
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix.inputs["Color2"])
    links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def set_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def cube(name, location, scale, mat, bevel=0.03, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(obj, mat)
    if bevel:
        mod = obj.modifiers.new("PlateEdge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return obj


def cylinder(name, location, radius, depth, mat, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    return obj


def sphere(name, location, radius, mat, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8, segments // 2), radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    return obj


def beam_between(name, start, end, radius, mat, vertices=12):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    obj = cylinder(name, tuple((start_v + end_v) / 2), radius, delta.length, mat, vertices=vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def armor_plate(name, location, scale, mat, rotation=(0, 0, 0)):
    return cube(name, location, scale, mat, bevel=0.04, rotation=rotation)


def build_legs(mats):
    for side, sx in ((-1, -0.72), (1, 0.72)):
        sphere(f"Hip_{side}", (sx, -0.15, 1.55), 0.28, mats["joint"])
        armor_plate(f"Thigh_{side}", (sx, -0.05, 1.05), (0.32, 0.38, 0.55), mats["armor"])
        beam_between(f"Thigh_piston_{side}", (sx, -0.35, 1.35), (sx, -0.2, 0.7), 0.06, mats["piston"], 10)
        sphere(f"Knee_{side}", (sx, -0.12, 0.55), 0.22, mats["joint"])
        armor_plate(f"Shin_{side}", (sx, 0.0, 0.18), (0.28, 0.34, 0.42), mats["armor_dark"])
        armor_plate(f"Foot_{side}", (sx, -0.15, -0.28), (0.42, 0.7, 0.14), mats["armor_dark"])
        for toe in (-0.35, 0.0, 0.35):
            cube(f"Toe_{side}", (sx + toe * 0.15, -0.45, -0.38), (0.08, 0.18, 0.06), mats["metal"], 0.02)


def build_torso(mats):
    # Blender Z-up: face the mech down -Y so glTF Y-up export yields +Z forward (matches MECH_GUNS).
    armor_plate("Pelvis", (0, 0, 1.7), (0.85, 0.55, 0.28), mats["armor_dark"])
    armor_plate("Torso_core", (0, -0.05, 2.45), (0.95, 0.7, 0.7), mats["armor"])
    armor_plate("Chest_plate", (0, -0.42, 2.55), (0.82, 0.18, 0.55), mats["armor_bright"])
    armor_plate("Back_boiler", (0, 0.55, 2.5), (0.7, 0.35, 0.55), mats["armor_dark"])
    cylinder("Boiler_stack", (0, 0.55, 3.15), 0.18, 0.55, mats["metal"], vertices=14)
    sphere("Boiler_dome", (0, 0.55, 3.45), 0.2, mats["metal"], 14)

    for z in (2.15, 2.45, 2.75):
        for x in (-0.7, -0.35, 0.0, 0.35, 0.7):
            sphere("Rivet", (x, -0.62, z), 0.035, mats["metal"], 8)

    armor_plate("Head_block", (0, -0.25, 3.35), (0.55, 0.4, 0.32), mats["armor"])
    cube("Visor_slit", (0, -0.48, 3.38), (0.38, 0.04, 0.08), mats["glow"], 0.01)
    sphere("Optic_left", (-0.18, -0.5, 3.42), 0.07, mats["glow"], 10)
    sphere("Optic_right", (0.18, -0.5, 3.42), 0.07, mats["glow"], 10)

    for side in (-1, 1):
        armor_plate(
            f"Pauldron_{side}",
            (side * 0.95, -0.1, 2.85),
            (0.28, 0.45, 0.35),
            mats["armor_bright"],
            rotation=(0, 0, side * 0.25),
        )
        armor_plate(f"Hip_skirt_{side}", (side * 0.85, -0.05, 1.85), (0.22, 0.35, 0.2), mats["armor_dark"])


def build_arms(mats):
    for side, sx in ((-1, -1.05), (1, 1.05)):
        sphere(f"Shoulder_{side}", (sx, -0.1, 2.85), 0.26, mats["joint"])
        armor_plate(f"Upper_arm_{side}", (sx * 1.05, -0.35, 2.35), (0.26, 0.32, 0.4), mats["armor"])
        sphere(f"Elbow_{side}", (sx * 1.1, -0.55, 1.95), 0.18, mats["joint"])
        armor_plate(f"Forearm_{side}", (sx * 1.12, -0.85, 1.7), (0.24, 0.55, 0.22), mats["armor_dark"])

        # MECH_GUNS are Three.js Y-up (x, y, z). Blender Z-up uses (x, -z, y) so export_yup lands on the same point.
        for idx, (gx, gy, gz) in enumerate(MECH_GUNS):
            if (side < 0 and gx > 0) or (side > 0 and gx < 0):
                continue
            by = -gz
            cylinder(
                f"Gun_pod_{side}_{idx}",
                (gx, by + 0.15, gy),
                0.16,
                0.55,
                mats["metal"],
                rotation=(pi / 2, 0, 0),
                vertices=14,
            )
            cylinder(
                f"Gun_barrel_{side}_{idx}",
                (gx, by - 0.25, gy),
                0.07,
                0.42,
                mats["metal"],
                rotation=(pi / 2, 0, 0),
                vertices=12,
            )
            cylinder(
                f"Muzzle_{side}_{idx}",
                (gx, by - 0.48, gy),
                0.08,
                0.04,
                mats["glow_dim"],
                rotation=(pi / 2, 0, 0),
                vertices=10,
            )

        cube(f"Mag_{side}", (sx * 1.12, -0.7, 1.55), (0.18, 0.22, 0.16), mats["armor_bright"], 0.02)


def build_details(mats):
    for x in (-0.25, 0.25):
        cube("Vent", (x, 0.75, 2.75), (0.08, 0.05, 0.18), mats["glow_dim"], 0.01)
    beam_between("Banner_pole", (0.55, 0.2, 3.2), (0.55, 0.2, 4.35), 0.04, mats["metal"], 8)
    armor_plate("Banner", (0.75, 0.2, 4.05), (0.28, 0.02, 0.35), mats["banner"])

    for side in (-1, 1):
        armor_plate(f"Spray_skirt_{side}", (side * 0.55, -0.55, -0.15), (0.35, 0.55, 0.08), mats["armor_dark"])

    for z in (2.2, 2.6):
        cube("Heat_seam", (0, -0.58, z), (0.7, 0.02, 0.03), mats["glow_dim"], 0.005)


def apply_modifiers():
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.modifiers:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except RuntimeError:
                pass


def join_named(prefix):
    objects = [obj for obj in bpy.context.scene.objects if obj.name.startswith(prefix)]
    if len(objects) < 2:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    objects = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    if len(objects) > 1:
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = prefix + "_merged"


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    mats = {
        "armor": material("Siege iron", (0.12, 0.11, 0.1), 0.48, 0.82),
        "armor_dark": material("Tarred plate", (0.05, 0.048, 0.045), 0.55, 0.78),
        "armor_bright": material("Bronze trim", (0.28, 0.16, 0.07), 0.42, 0.7),
        "metal": material("Gun metal", (0.08, 0.09, 0.1), 0.35, 0.9),
        "joint": material("Actuator joint", (0.18, 0.12, 0.07), 0.4, 0.75),
        "piston": material("Hydraulics", (0.25, 0.22, 0.18), 0.3, 0.85),
        "glow": material("Optic glow", (0.9, 0.25, 0.05), 0.25, 0.2, emission=(1.0, 0.28, 0.04), emission_strength=5.0),
        "glow_dim": material("Heat vent", (0.45, 0.12, 0.04), 0.4, 0.3, emission=(0.9, 0.2, 0.03), emission_strength=1.6),
        "banner": material("Bastion banner", (0.42, 0.05, 0.05), 0.7, 0.05),
    }

    build_legs(mats)
    build_torso(mats)
    build_arms(mats)
    build_details(mats)
    apply_modifiers()

    for prefix in ("Rivet", "Gun_pod", "Gun_barrel", "Muzzle", "Toe", "Vent", "Heat_seam"):
        join_named(prefix)

    # Blender Z-up construction; glTF export with export_yup converts for Three.js.
    bpy.ops.object.select_all(action="SELECT")
    for obj in bpy.context.selected_objects:
        if obj.type == "MESH":
            obj["game_asset"] = "iron-leviathan"

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
    print("MECH_GUNS hardpoints:", MECH_GUNS)


if __name__ == "__main__":
    main()
