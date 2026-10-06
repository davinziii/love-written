"use client";

import { PhoneFrame } from "@/components/preview/PhoneFrame";
import { BrowserFrame } from "@/components/preview/BrowserFrame";
import { PauseOffscreen } from "@/components/motion/Motion";
import { TemplateExperience } from "@/templates/renderers";
import type { TemplateId } from "@/templates";
import type { RenderData } from "@/templates/renderers";

/**
 * Hero composition: the same surprise on a laptop and on a phone, so visitors see at a
 * glance that they're getting a real mini website. The phone is interactive.
 */
export function HeroDevices({ templateId, data }: { templateId: TemplateId; data: RenderData }) {
  return (
    // The phone overlaps the laptop's right edge but always stays inside this box, so the
    // page edge never clips it.
    <PauseOffscreen className="relative mx-auto w-full max-w-[640px] sm:pb-10">
      <div className="hidden w-[78%] sm:block">
        <BrowserFrame height={380} interactive={false} label="Example surprise on a laptop">
          <TemplateExperience templateId={templateId} data={data} mode="preview" />
        </BrowserFrame>
      </div>
      <div className="relative z-10 mx-auto w-[min(300px,82vw)] sm:absolute sm:bottom-0 sm:right-2 sm:w-[210px] sm:rotate-[2deg]">
        <PhoneFrame height={420} label="Example surprise on a phone — tap to open">
          <TemplateExperience templateId={templateId} data={data} mode="preview" />
        </PhoneFrame>
      </div>
    </PauseOffscreen>
  );
}
