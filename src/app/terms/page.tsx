import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms explain how Love, Written works and the rules for using it. By ordering or creating a surprise, you
          agree to them. Please also read our{" "}
          <Link href="/privacy" className="text-rose underline underline-offset-2">
            Privacy Notice
          </Link>
          .
        </p>
      }
      sections={[
        {
          id: "the-service",
          title: "The service",
          body: (
            <p>
              Love, Written lets you create a personalized, interactive digital surprise from a template, using your own
              words and photos, and share it through a private link or heart QR code. You don&rsquo;t need an account.
            </p>
          ),
        },
        {
          id: "orders",
          title: "Orders and payment",
          body: (
            <>
              <p>
                Prices are shown on the site in Philippine pesos. Your surprise is activated once we confirm your payment.
                We then send you a private customization link and a recovery code.
              </p>
              <p>
                <strong>Successful payments are non-refundable.</strong> If something on our side stops your surprise from
                publishing, we&rsquo;ll fix it or publish it for you at no extra cost — you will never be asked to pay
                twice for the same surprise.
              </p>
            </>
          ),
        },
        {
          id: "your-link",
          title: "Your private link and recovery code",
          body: (
            <ul>
              <li>Your customization link lets anyone who has it edit your surprise. Keep it to yourself.</li>
              <li>Don&rsquo;t forward your order message to the person you&rsquo;re surprising.</li>
              <li>Keep your recovery code safe — it lets you get back to your surprise on any device.</li>
            </ul>
          ),
        },
        {
          id: "publishing",
          title: "Publishing, editing and hosting",
          body: (
            <ul>
              <li>You can edit your surprise until it goes live. Once published, it is locked and cannot be edited.</li>
              <li>A scheduled surprise can be edited until its reveal time, and won&rsquo;t open before then.</li>
              <li>
                Each surprise stays online for <strong>30 days after it goes live</strong>, then its photos and messages are
                deleted. Save anything you want to keep.
              </li>
              <li>
                A paid surprise that is never published is deleted after <strong>60 days without being opened</strong>.
              </li>
              <li>Anyone who has the surprise link can view it.</li>
            </ul>
          ),
        },
        {
          id: "acceptable-use",
          title: "Rules: what you can't create",
          body: (
            <>
              <p>Love, Written is for kindness. You may not use it to create or share anything that:</p>
              <ul>
                <li>harasses, threatens, bullies, intimidates or humiliates anyone;</li>
                <li>contains sexual or explicit content, or any sexual content involving minors;</li>
                <li>promotes hate, violence, self-harm or discrimination;</li>
                <li>impersonates someone, deceives, scams or phishes;</li>
                <li>reveals someone&rsquo;s private information (addresses, IDs, financial details) without consent;</li>
                <li>uses photos, names or likenesses of people who wouldn&rsquo;t agree to it;</li>
                <li>infringes copyright or other people&rsquo;s rights;</li>
                <li>is illegal under Philippine law;</li>
                <li>attempts to break, overload or misuse the website.</li>
              </ul>
              <p>
                Anyone viewing a surprise can report it with the <strong>Report a concern</strong> link at the bottom of the
                page. Reports are anonymous.
              </p>
            </>
          ),
        },
        {
          id: "enforcement",
          title: "What happens if the rules are broken",
          body: (
            <p>
              We may review reported surprises and, at our discretion, take a surprise offline, delete it, or refuse future
              orders — without a refund when the rules were broken. Where the law requires, we may report content to the
              authorities.
            </p>
          ),
        },
        {
          id: "content",
          title: "Your content",
          body: (
            <p>
              You keep ownership of your messages and photos. You give us permission to store, process and display them only
              to provide your surprise. You confirm you have the right to use everything you upload. The templates, designs
              and software belong to Love, Written.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Availability",
          body: (
            <p>
              We work hard to keep Love, Written running, but we can&rsquo;t guarantee it will always be available or error
              free — for example during maintenance or problems with our providers.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Limitation of liability",
          body: (
            <p>
              To the extent the law allows, Love, Written isn&rsquo;t liable for indirect losses, and our total liability for
              any claim is limited to the amount you paid for the surprise concerned. Nothing in these terms limits rights
              you have under Philippine consumer protection law.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of the Republic of the Philippines.</p>,
        },
        {
          id: "changes",
          title: "Changes",
          body: (
            <p>
              We may update these terms. The version on this page (with its date) applies to new orders. For questions,
              email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-rose underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
