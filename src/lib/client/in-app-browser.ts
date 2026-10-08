/**
 * Detects the built-in browsers of social apps (Messenger, Facebook, Instagram, …).
 * They're fine for viewing a surprise, but unreliable for uploading photos — the app can
 * pause or cut off the page while the photo picker is open — so the studio suggests
 * opening the link in Chrome or Safari instead.
 */
const IN_APP_BROWSERS: [RegExp, string][] = [
  [/MessengerForiOS|Orca-Android|\bMessenger\b/i, "Messenger"],
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, "Facebook"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/\bLine\//i, "LINE"],
  [/Snapchat/i, "Snapchat"],
];

/** The app's name if this user agent is a social app's built-in browser, otherwise null. */
export function inAppBrowserName(userAgent: string): string | null {
  for (const [pattern, name] of IN_APP_BROWSERS) if (pattern.test(userAgent)) return name;
  return null;
}
