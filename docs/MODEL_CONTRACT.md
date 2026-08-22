# Model and manifest contract

## Supported input

- Local products: self-contained binary `.glb` files.
- Hosted products: CORS-enabled `.glb` or `.gltf` URLs.
- Optional engineering data: JSON matching `engineering-manifest.schema.json`.

GLB is preferred because geometry, materials, and textures travel in one file.

## Mesh naming

Every inspectable object must have a stable, unique mesh name. The recommended pattern is:

```text
group__part_name
```

Examples: `exterior__top_shell`, `electronics__controller`, and `reference__motion_keepout`.

## Units and axes

The engineering manifest always reports dimensions in millimetres. `model.upAxis` states the source convention (`X`, `Y`, or `Z`). A model without a manifest must be accompanied by the user's source-unit and up-axis selection and is labeled as a measured preview.

## Compatibility rule

The viewer reports a linked manifest as compatible only when:

1. Every manifest part key has a mesh with the same name.
2. Every named mesh has a manifest record.
3. `model.partCount` agrees with the assembly.
4. Required project, model, part, dimension, and engineering fields are present.

## Geometry status

| Status | Meaning |
|---|---|
| `design_exact` | Nominal designed geometry controlled by the project |
| `manufacturer_verified` | Envelope checked against manufacturer mechanical information |
| `vendor_cad_imported` | Vendor geometry imported into the assembly |
| `candidate_envelope` | Placeholder or not-yet-frozen purchased component |
| `reference_only` | Keep-out, path, field, or nonphysical visualization object |

The status describes evidence provenance. It is not a safety certification.

## Schema evolution

Additive fields are allowed. Breaking changes require a new `schemaVersion`, updated tests, and migration notes. The viewer should continue to display a plain model even when optional manifest data is unavailable.
