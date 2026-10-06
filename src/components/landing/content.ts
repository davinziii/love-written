import { isManualPayments } from "@/lib/payments/mode";

export interface Step {
  title: string;
  body: string;
  icon: "layers" | "message" | "wallet" | "link" | "pen" | "send" | "eye";
}

/** "How it works" follows the active payment workflow. */
export const HOW_IT_WORKS: Step[] = isManualPayments
  ? [
      { title: "Pick a surprise", body: "Browse our templates and choose the one that feels like the two of you.", icon: "layers" },
      { title: "Message us", body: "Send us a DM with the template you'd like. A real person answers.", icon: "message" },
      { title: "Pay once", body: "GCash, Maya or bank transfer. We confirm it personally.", icon: "wallet" },
      { title: "Get your private link", body: "Your own page to create the surprise. No account, no app.", icon: "link" },
      { title: "Make it yours", body: "Add their name, your words and photos. Preview it on laptop and phone.", icon: "pen" },
      { title: "Reveal it", body: "Publish now, or schedule it for the exact moment you want.", icon: "send" },
    ]
  : [
      { title: "Pick a surprise", body: "Choose a professionally designed, interactive experience.", icon: "layers" },
      { title: "Make it yours", body: "Add their name, your words and your favorite photos.", icon: "pen" },
      { title: "Preview", body: "See exactly what they'll see on laptop and phone, before you pay.", icon: "eye" },
      { title: "Reveal it", body: "Publish now or schedule it for the perfect moment.", icon: "send" },
    ];

export const FAQ_TEASER: { q: string; a: string }[] = [
  {
    q: "What exactly am I getting?",
    a: "A private, beautifully designed mini website made from your words and photos. It works on phones, tablets and laptops.",
  },
  {
    q: "How long does it stay online?",
    a: "30 days after it goes live. If you schedule it, the 30 days start at the reveal time. After that, its photos and messages are deleted.",
  },
  {
    q: "Can I edit it after it's published?",
    a: "You can edit as much as you like until it goes live. Once it's live, it's locked — exactly as they'll remember it.",
  },
  {
    q: "Will it show up on Google?",
    a: "No. Each surprise has its own long, unguessable link and is marked so search engines don't index it.",
  },
];
