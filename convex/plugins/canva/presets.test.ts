import { describe, expect, test } from "vitest"
import { TASK_INTEGRATION_IDS } from "@/convex/integrations/taskIntegrations/constants"
import {
  buildCanvaOutputTitle,
  CANVA_PRESETS,
  getCanvaPreset,
  requireCanvaPresetSettings,
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
      settingsKey: "certificates",
    })
    expect(getCanvaPreset("canva.lanyards")).toMatchObject({
      id: "canva.lanyards",
      settingsKey: "lanyards",
    })
  })

  test("unknown Canva integration ids throw clearly", () => {
    expect(() => getCanvaPreset("canva.posters")).toThrow(
      /Unknown Canva integration: canva\.posters/
    )
  })

  test("missing settings name the preset and where to configure it", () => {
    expect(() =>
      requireCanvaPresetSettings(getCanvaPreset("canva.certificates"), null)
    ).toThrow(
      /Canva preset "canva\.certificates" has no brand template or output folder\. Configure them in Admin → Settings/
    )
  })

  test("requireCanvaPresetSettings maps the stored template and folder", () => {
    expect(
      requireCanvaPresetSettings(getCanvaPreset("canva.lanyards"), {
        brandTemplateId: "tpl-lanyard",
        outputFolderId: "folder-lanyard",
      })
    ).toEqual({
      sourceBrandTemplateId: "tpl-lanyard",
      destinationFolderId: "folder-lanyard",
    })
  })

  test("buildCanvaOutputTitle uses preset naming suffix", () => {
    expect(
      buildCanvaOutputTitle(
        "Dublin Open 2026",
        getCanvaPreset("canva.lanyards")
      )
    ).toBe("Dublin Open 2026 - Lanyards")
  })
})
