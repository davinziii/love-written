import { describe, expect, it } from "vitest";
import { inAppBrowserName } from "@/lib/client/in-app-browser";

describe("in-app browser detection", () => {
  it("recognises social apps' built-in browsers", () => {
    expect(
      inAppBrowserName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/466.0.0.41.109;FBBV/615310455]",
      ),
    ).toBe("Messenger");
    expect(
      inAppBrowserName(
        "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/478.0.0.28.109;]",
      ),
    ).toBe("Messenger");
    expect(
      inAppBrowserName(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/483.0.0.50.88;]",
      ),
    ).toBe("Facebook");
    expect(
      inAppBrowserName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.25.104 (iPhone15,2; iOS 17_5; en_US)",
      ),
    ).toBe("Instagram");
  });

  it("leaves regular browsers alone", () => {
    expect(
      inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    ).toBeNull();
    expect(
      inAppBrowserName("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"),
    ).toBeNull();
    expect(inAppBrowserName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")).toBeNull();
  });
});
