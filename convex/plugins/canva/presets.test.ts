import { describe, expect, test } from "vitest"
import { TASK_INTEGRATION_IDS } from "@/convex/plugins/core/constants"
import {
  buildCanvaOutputTitle,
  CANVA_PRESETS,
  type CanvaEnvSource,
  getCanvaPreset,
  requireCanvaEnv,
  resolveCanvaPresetEnv,
} from "@/convex/plugins/canva/presets"

describe("canva presets", () => {
  test("registry ids are registered task integration ids", () => {
    for (const preset of CANVA_PRESETS) {
      expect(TASK_INTEGRATION_IDS).toContain(preset.id)
    }
  })

  test("known Canva integration ids resolve to the correct preset", () => {
    expect(getCanvaPreset("canva.certificates")).toMatchObject({
      id: "canva.certificates",
      sourceBrandTemplateEnv: "CANVA_CERT_TEMPLATE_ID",
      destinationFolderEnv: "CANVA_CERT_OUTPUT_FOLDER_ID",
    })
    expect(getCanvaPreset("canva.lanyards")).toMatchObject({
      id: "canva.lanyards",
      sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
      destinationFolderEnv: "CANVA_LANYARD_OUTPUT_FOLDER_ID",
    })
  })

  test("unknown Canva integration ids throw clearly", () => {
    expect(() => getCanvaPreset("canva.posters")).toThrow(
      /Unknown Canva integration: canva\.posters/
    )
  })

  test("missing env vars name the preset and env key", () => {
    const preset = getCanvaPreset("canva.certificates")
    const source: CanvaEnvSource = {
      CANVA_CERT_TEMPLATE_ID: undefined,
      CANVA_LANYARD_TEMPLATE_ID: "tpl-lanyard",
      CANVA_CERT_OUTPUT_FOLDER_ID: "folder-cert",
      CANVA_LANYARD_OUTPUT_FOLDER_ID: "folder-lanyard",
    }

    expect(() =>
      requireCanvaEnv("CANVA_CERT_TEMPLATE_ID", preset, source)
    ).toThrow(
      /Canva preset "canva\.certificates" requires Convex env CANVA_CERT_TEMPLATE_ID/
    )
  })

  test("resolveCanvaPresetEnv reads template and folder from env", () => {
    const source: CanvaEnvSource = {
      CANVA_CERT_TEMPLATE_ID: "tpl-cert",
      CANVA_LANYARD_TEMPLATE_ID: "tpl-lanyard",
      CANVA_CERT_OUTPUT_FOLDER_ID: "folder-cert",
      CANVA_LANYARD_OUTPUT_FOLDER_ID: "folder-lanyard",
    }

    expect(resolveCanvaPresetEnv(getCanvaPreset("canva.certificates"), source))
      .toEqual({
        sourceBrandTemplateId: "tpl-cert",
        destinationFolderId: "folder-cert",
      })
    expect(resolveCanvaPresetEnv(getCanvaPreset("canva.lanyards"), source))
      .toEqual({
        sourceBrandTemplateId: "tpl-lanyard",
        destinationFolderId: "folder-lanyard",
      })
  })

  test("buildCanvaOutputTitle uses preset naming suffix", () => {
    expect(
      buildCanvaOutputTitle("Dublin Open 2026", getCanvaPreset("canva.lanyards"))
    ).toBe("Dublin Open 2026 - Lanyards")
  })
})
