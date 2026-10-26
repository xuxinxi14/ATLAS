"""
Blender reproducible generator for the ATLAS Glass Index Desk (Retrieval Bridge / 检索桥).
Constructs the suspended glass index surface, ultra-narrow ivory metal bezel,
left/right low-profile guide rails, and localized warm-amber lane locator.
"""

import bpy
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def make_material(name, base_color, metallic=0.0, roughness=0.35, transmission=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        elif "Transmission" in bsdf.inputs:
            bsdf.inputs["Transmission"].default_value = transmission
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def build_index_desk():
    col = bpy.data.collections.get("Index_Desk_Bridge")
    if not col:
        col = bpy.data.collections.new("Index_Desk_Bridge")
        bpy.context.scene.collection.children.link(col)

    ivory_mat = make_material("Bridge_Ivory_Frame", (0.93, 0.91, 0.88), metallic=0.18, roughness=0.32)
    glass_edge_mat = make_material("Bridge_Frosted_Glass", (0.96, 0.95, 0.93), metallic=0.0, roughness=0.22, transmission=0.72)
    warm_plate_mat = make_material("Bridge_Warm_White_Plate", (0.97, 0.96, 0.94), metallic=0.02, roughness=0.48)
    rail_mat = make_material("Bridge_Titanium_Rail", (0.76, 0.74, 0.70), metallic=0.62, roughness=0.28)
    amber_mat = make_material("Bridge_Amber_Signal", (0.93, 0.51, 0.11), roughness=0.2, emission=(0.93, 0.51, 0.11), emission_strength=3.2)

    parts = [
        ("Bridge_Center_Plate", (0.0, 2.85, 1.85), (7.6, 0.04, 3.85), warm_plate_mat),
        ("Bridge_Glass_Slab", (0.0, 2.82, 1.85), (7.95, 0.11, 4.08), glass_edge_mat),
        ("Bridge_Front_Lip", (0.0, 2.76, 5.92), (7.98, 0.14, 0.12), ivory_mat),
        ("Bridge_Rail_Left", (-8.12, 2.52, 2.10), (0.08, 0.12, 4.60), rail_mat),
        ("Bridge_Rail_Right", (8.12, 2.52, 2.10), (0.08, 0.12, 4.60), rail_mat),
        ("Bridge_Amber_Locator", (0.0, 1.92, 5.45), (0.52, 0.05, 0.85), amber_mat),
    ]

    for name, loc, scale, mat in parts:
        existing = bpy.data.objects.get(name)
        if existing:
            bpy.data.objects.remove(existing, do_unlink=True)
        bpy.ops.mesh.primitive_cube_add(location=Vector(loc))
        obj = bpy.context.object
        obj.name = name
        obj.scale = Vector(scale)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)


if __name__ == "__main__":
    build_index_desk()
