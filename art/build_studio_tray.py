"""
Blender MCP / Python generator for the ATLAS Sliding Studio Tray (录入工作台 / 滑出式录入托盘).
Run inside Blender 4.x (`blender --background --python art/build_studio_tray.py`)
or via the Blender MCP server to regenerate the parametric Studio Tray reference scene.

Design constraints (DESIGN.md & Sliding Studio Specification):
- Slides out in front of the Glass Index Desk along two low-profile side guide rails.
- Left 18–21% is a shallow recessed cassette dock bay sized to the exact aspect ratio
  of `archive-cassette.glb` (preserving the original shell, twin rings, and nameplate
  without stretching the model or redrawing internal geometry).
- Bottom-left of the cassette bay houses a small warm-amber contact indicator light.
- Right 79–82% is a stable warm-white writing surface (#f8f6f0) framed by thin frosted
  glass and ultra-narrow ivory metal trim.
"""

import bpy
import bmesh
from mathutils import Vector


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_material(name: str, base_color, roughness=0.28, metallic=0.08, transmission=0.0, emissive=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 2.2
    return mat


def add_bevel_box(name: str, size: tuple[float, float, float], location: tuple[float, float, float], bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = Vector(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = bevel
    mod.segments = 3
    mod.limit_method = "ANGLE"
    return obj


def build_studio_tray():
    clear_scene()

    ivory_metal = create_material("Studio_Ivory_Trim", (0.91, 0.89, 0.85), roughness=0.24, metallic=0.22)
    frosted_edge = create_material("Studio_Frosted_Edge", (0.95, 0.94, 0.91), roughness=0.36, metallic=0.0, transmission=0.45)
    warm_white_plate = create_material("Studio_Writing_Plate", (0.973, 0.965, 0.941), roughness=0.42, metallic=0.02)
    recessed_bay = create_material("Studio_Cassette_Bay", (0.88, 0.85, 0.80), roughness=0.38, metallic=0.08)
    amber_contact = create_material("Studio_Bay_Contact_Light", (0.93, 0.51, 0.11), roughness=0.18, emissive=(0.93, 0.51, 0.11))

    # 1. Outer Frosted Glass & Ivory Metal Tray Frame (15.6 x 8.4)
    tray_frame = add_bevel_box("Studio_Tray_Base", (15.6, 0.24, 8.4), (0.0, 0.0, 0.0), bevel=0.03)
    tray_frame.data.materials.append(frosted_edge)

    # 2. Left Recessed Cassette Dock Bay (19.5% of width, matched to archive-cassette aspect ratio)
    bay_well = add_bevel_box("Studio_Cassette_Bay", (2.96, 0.18, 7.6), (-5.95, 0.08, 0.0), bevel=0.02)
    bay_well.data.materials.append(recessed_bay)

    # 3. Warm-Amber Contact Light at bottom-left of the Cassette Bay
    contact_lamp = add_bevel_box("Studio_Bay_Contact_Light", (0.08, 0.06, 0.52), (-7.18, 0.16, 2.25), bevel=0.01)
    contact_lamp.data.materials.append(amber_contact)

    # 4. Right Stable Warm-White Writing Surface (80.5% of width)
    writing_plate = add_bevel_box("Studio_Writing_Plate", (11.95, 0.12, 7.9), (1.62, 0.11, 0.0), bevel=0.015)
    writing_plate.data.materials.append(warm_white_plate)

    # 5. Left & Right Low-Profile Sliding Guide Rails
    rail_left = add_bevel_box("Studio_Side_Rail_Left", (0.14, 0.18, 9.2), (-7.96, -0.06, -0.2), bevel=0.015)
    rail_left.data.materials.append(ivory_metal)

    rail_right = add_bevel_box("Studio_Side_Rail_Right", (0.14, 0.18, 9.2), (7.96, -0.06, -0.2), bevel=0.015)
    rail_right.data.materials.append(ivory_metal)

    print("[ATLAS] Built Sliding Studio Tray reference geometry.")


if __name__ == "__main__":
    build_studio_tray()
