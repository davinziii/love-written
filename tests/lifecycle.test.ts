import { describe, expect, it } from "vitest";
import {
  canCheckout,
  canEdit,
  canPublish,
  expiryFrom,
  studioScreen,
  validateScheduleTime,
  UNPUBLISHED_PAID_TTL_DAYS,
  viewerAccess,
  STAGES,
  type Stage,
} from "@/lib/lifecycle";

const now = new Date("2026-10-06T12:00:00Z");
const hour = 3_600_000;

describe("editing lock", () => {
  it("allows edits only before going live", () => {
    const editable = STAGES.filter(canEdit);
    expect(editable).toEqual(["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH", "SCHEDULED", "PUBLISH_FAILED"]);
    for (const s of ["PUBLISHED", "EXPIRED", "DELETED", "DISABLED", "CLEANUP_FAILED"] as Stage[]) expect(canEdit(s)).toBe(false);
  });
});

describe("payment vs publishing are independent", () => {
  it("a paid surprise whose publish failed can be published again without checkout", () => {
    expect(canPublish("PUBLISH_FAILED", "PAID")).toBe(true);
    expect(canCheckout("PUBLISH_FAILED", "PAID")).toBe(false);
    expect(studioScreen("PUBLISH_FAILED", "PAID")).toBe("publish_failed");
  });
  it("unpaid surprises cannot be published", () => {
    expect(canPublish("CUSTOMIZING", "UNPAID")).toBe(false);
    expect(canPublish("READY_TO_PUBLISH", "AWAITING_PAYMENT")).toBe(false);
  });
  it("manual workflow: a paid draft can be published straight from the editor", () => {
    expect(canPublish("DRAFT", "PAID")).toBe(true);
    expect(canPublish("CUSTOMIZING", "PAID")).toBe(true);
    expect(studioScreen("CUSTOMIZING", "PAID")).toBe("edit");
    expect(canEdit("CUSTOMIZING")).toBe(true);
  });
  it("paid surprises can't be checked out again", () => {
    expect(canCheckout("CUSTOMIZING", "PAID")).toBe(false);
    expect(canCheckout("CUSTOMIZING", "PAYMENT_FAILED")).toBe(true);
  });
});

describe("recipient access", () => {
  const row = (stage: Stage, extra: Partial<{ scheduled_for: string; expires_at: string }> = {}) => ({
    stage,
    scheduled_for: extra.scheduled_for ?? null,
    expires_at: extra.expires_at ?? null,
  });

  it("scheduled surprises are inaccessible before the reveal time", () => {
    const a = viewerAccess(row("SCHEDULED", { scheduled_for: new Date(now.getTime() + hour).toISOString() }), now);
    expect(a.kind).toBe("not_yet");
  });
  it("become accessible (activation) at the reveal time", () => {
    expect(viewerAccess(row("SCHEDULED", { scheduled_for: now.toISOString() }), now).kind).toBe("activate");
  });
  it("published surprises end at expiry even if cleanup hasn't run", () => {
    expect(viewerAccess(row("PUBLISHED", { expires_at: new Date(now.getTime() + 1).toISOString() }), now).kind).toBe("live");
    expect(viewerAccess(row("PUBLISHED", { expires_at: now.toISOString() }), now).kind).toBe("ended");
  });
  it("drafts and unpaid surprises are never viewable", () => {
    for (const s of ["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH"] as Stage[]) expect(viewerAccess(row(s), now).kind).toBe("not_found");
  });
  it("disabled and deleted are not viewable", () => {
    expect(viewerAccess(row("DISABLED"), now).kind).toBe("unavailable");
    expect(viewerAccess(row("DELETED"), now).kind).toBe("ended");
  });
});

describe("60-day rule for unpublished paid surprises", () => {
  it("is 60 days", () => {
    expect(UNPUBLISHED_PAID_TTL_DAYS).toBe(60);
  });
});

describe("timing", () => {
  it("hosting is exactly 30 days from going live", () => {
    expect(expiryFrom(now).toISOString()).toBe("2026-11-05T12:00:00.000Z");
  });
  it("schedule must be in the future but not too far", () => {
    expect(validateScheduleTime(new Date(now.getTime() + 60_000), now).ok).toBe(false);
    expect(validateScheduleTime(new Date(now.getTime() + hour), now).ok).toBe(true);
    expect(validateScheduleTime(new Date(now.getTime() + 400 * 24 * hour), now).ok).toBe(false);
    expect(validateScheduleTime(new Date(NaN), now).ok).toBe(false);
  });
});
