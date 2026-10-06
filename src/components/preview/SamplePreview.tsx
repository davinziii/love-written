"use client";

import { DevicePreview, type Device } from "./DevicePreview";
import { PauseOffscreen } from "@/components/motion/Motion";
import { TemplateExperience } from "@/templates/renderers";
import { getTemplate, type TemplateId } from "@/templates";

/** A template's example surprise in the Desktop / Mobile / Full preview switcher. */
export function SamplePreview({
  templateId,
  defaultDevice = "desktop",
  phoneHeight = 640,
  desktopHeight = 540,
}: {
  templateId: TemplateId;
  defaultDevice?: Device;
  phoneHeight?: number;
  desktopHeight?: number;
}) {
  const template = getTemplate(templateId);
  if (!template) return null;
  return (
    <PauseOffscreen>
      <DevicePreview
        label={`${template.name} example`}
        defaultDevice={defaultDevice}
        phoneHeight={phoneHeight}
        desktopHeight={desktopHeight}
        render={() => <TemplateExperience templateId={templateId} data={template.sample} mode="preview" />}
      />
    </PauseOffscreen>
  );
}
