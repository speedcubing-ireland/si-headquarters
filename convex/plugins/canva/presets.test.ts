import { afterEach, describe, expect, test } from "vitest"
import { TASK_INTEGRATION_IDS } from "@/convex/plugins/core/constants"
import {
  buildCanvaOutputTitle,
  CANVA_PRESETS,
  getCanvaPreset,
  requireCanvaEnv,
  resolveCanvaPresetEnv,
} from "@/convex/plugins/canva/presets"

const envSnapshot = { ...process.env }

afterEach(() => {
  process.env = { ...envSnapshot }
})

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
    })
    expect(getCanvaPreset("canva.lanyards")).toMatchObject({
      id: "canva.lanyards",
      sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
    })
  })

  test("unknown Canva integration ids throw clearly", () => {
    expect(() => getCanvaPreset("canva.posters")).toThrow(
      /Unknown Canva integration: canva\.posters/
    )
  })

  test("missing env vars name the preset and env key", () => {
    const preset = getCanvaPreset("canva.certificates")
    delete process.env.CANVA_CERT_TEMPLATE_ID

    expect(() => requireCanvaEnv("CANVA_CERT_TEMPLATE_ID", preset)).toThrow(
      /Canva preset "canva\.certificates" requires Convex env CANVA_CERT_TEMPLATE_ID/
    )
  })

  test("resolveCanvaPresetEnv reads template and folder from env", () => {
    process.env.CANVA_CERT_TEMPLATE_ID = "tpl-cert"
    process.env.CANVA_OUTPUT_FOLDER_ID = "folder-1"

    expect(resolveCanvaPresetEnv(getCanvaPreset("canva.certificates"))).toEqual({
      sourceBrandTemplateId: "tpl-cert",
      destinationFolderId: "folder-1",
    })
  })

  test("buildCanvaOutputTitle uses preset naming suffix", () => {
    expect(
      buildCanvaOutputTitle("Dublin Open 2026", getCanvaPreset("canva.lanyards"))
    ).toBe("Dublin Open 2026 - Lanyards")
  })
})
