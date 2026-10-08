import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      intro={
        <p>
          Love, Written helps you make a private digital surprise for someone you love. What you write and the photos you
          add are personal, so we collect as little as we can, keep it private, and delete it on a fixed schedule. This
          notice explains how, in line with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      }
      sections={[
        {
          id: "who-we-are",
          title: "Who we are",
          body: (
            <p>
              Love, Written (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is the personal information controller for the data
              described here. Contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-rose underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ),
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <p>
                <strong>Surprise content you provide:</strong> names (yours and the recipient&rsquo;s), messages, dates,
                photos, and your design choices. Photos are re-saved by us without their location (GPS) data.
              </p>
              <p>
                <strong>Order details:</strong> the template, amount paid, how you paid (for example GCash), the payment
                reference you give us, and a contact name or handle so we can help you. If card or e-wallet checkout is
                enabled, payments are handled by PayMongo — we never see or store your card or wallet credentials.
              </p>
              <p>
                <strong>Technical data:</strong> to stop abuse we briefly use a scrambled (hashed) version of your IP
                address for rate limiting — we don&rsquo;t store your raw IP. We count anonymous events (such as
                &ldquo;a surprise was opened&rdquo;) without identifying anyone.
              </p>
              <p>
                <strong>On your device:</strong> your browser stores your draft, a private access key and your recovery
                code so you can continue later. This stays on your device; clearing your browser data removes it.
              </p>
              <p>
                <strong>Recipients:</strong> we only count how many times a surprise is opened. We don&rsquo;t collect
                recipients&rsquo; names, contact details or location. Abuse reports are anonymous.
              </p>
            </>
          ),
        },
        {
          id: "why",
          title: "Why we use it",
          body: (
            <ul>
              <li>To create, show and deliver your surprise to whoever has its link.</li>
              <li>To confirm payments, keep order records, and help you if something goes wrong.</li>
              <li>To keep the service secure and prevent abuse (rate limiting, abuse reports).</li>
              <li>To understand, in aggregate, how people use the site so we can improve it.</li>
            </ul>
          ),
        },
        {
          id: "sharing",
          title: "Who can see it",
          body: (
            <>
              <p>
                <strong>Anyone who has your surprise link can open it.</strong> Links are long and practically impossible
                to guess, and surprise pages are hidden from search engines, but please share the link (or its heart QR
                code) only with the person it&rsquo;s for.
              </p>
              <p>
                We never sell your data. We use trusted service providers to run Love, Written: Supabase (database and
                photo storage), Vercel (website hosting), Cloudflare (security), PayMongo (payments, when enabled) and
                Resend (sending internal alert emails to us — these never contain your messages or photos). They process
                data only to provide their service to us.
              </p>
              <p>We may disclose information if required by law or to protect someone from harm.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <ul>
              <li>
                <strong>Published surprises:</strong> online for 30 days after they go live (for scheduled surprises, from
                the reveal time). Then their photos and messages are deleted, and we verify the deletion.
              </li>
              <li>
                <strong>Paid surprises that are never published:</strong> deleted after 60 days without you opening them.
              </li>
              <li>
                <strong>Unpaid drafts:</strong> deleted after 14 days of inactivity.
              </li>
              <li>
                <strong>Photobooth:</strong> the live view is sent directly between you and your person (encrypted; when a direct
                connection isn&rsquo;t possible it passes, still encrypted, through our video relay provider Cloudflare) and is never
                recorded or stored. Only the photos you take are uploaded. Your name and chat messages in the photobooth are
                deleted together with the photos.
                Photos and the photobooth strip are kept for 7 days after the session is completed, then deleted (we verify
                it). Paid sessions that are never completed are deleted after 60 days without activity.
              </li>
              <li>
                <strong>Order and payment records</strong> (no messages or photos) are kept as long as needed for
                accounting and legal requirements.
              </li>
              <li>
                Our database provider keeps short-term system backups for reliability; these expire on their own schedule
                and are not used to restore deleted surprises. Photos are not kept in those backups.
              </li>
            </ul>
          ),
        },
        {
          id: "security",
          title: "How we protect it",
          body: (
            <p>
              Surprise links and private access keys are random and long. Access keys and recovery codes are stored only in
              scrambled (hashed) form. Photos are kept in private storage and shown through short-lived secure links.
              Published surprises are locked from editing. No system is perfectly secure, so we also limit what we collect.
            </p>
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: (
            <>
              <p>
                Under the Data Privacy Act you may ask to access, correct or delete your personal data, object to its
                processing, or ask for a copy. Email us with your order number or recovery code so we can find your surprise
                without asking for more personal information. You may also file a complaint with the National Privacy
                Commission.
              </p>
              <p>
                You can delete your own data sooner by asking us to take your surprise down. If you lose access, use{" "}
                <Link href="/recover" className="text-rose underline">
                  Find my surprise
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "photos-of-others",
          title: "Photos and names of other people",
          body: (
            <p>
              When you add photos or names of other people (including the recipient), you confirm you&rsquo;re comfortable
              sharing them with the recipient and have any permission needed. Please don&rsquo;t upload government IDs,
              financial details or other sensitive information.
            </p>
          ),
        },
        {
          id: "age",
          title: "Age",
          body: <p>Orders must be placed by people who are 18 or older, or with a parent or guardian&rsquo;s permission.</p>,
        },
        {
          id: "changes",
          title: "Changes to this notice",
          body: <p>If we change how we handle data, we&rsquo;ll update this page and its date.</p>,
        },
      ]}
    />
  );
}
