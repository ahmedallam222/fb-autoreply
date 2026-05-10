import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — fb-autoreply',
  description: 'Terms governing your use of the fb-autoreply service.',
};

const COMPANY = 'fb-autoreply';
const CONTACT_EMAIL = 'support@example.com';
const LAST_UPDATED = '2025-01-01';

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the {COMPANY}{' '}
        platform (&ldquo;Service&rdquo;). By creating an account or connecting a Facebook
        Page, you agree to these Terms.
      </p>

      <h2 className="mt-8 text-xl font-semibold">1. The Service</h2>
      <p>
        We provide a hosted automation platform that listens to comments and Messenger
        messages on your connected Facebook Pages and replies to them based on the
        keyword rules and AI configuration you define in your workspace.
      </p>

      <h2 className="mt-8 text-xl font-semibold">2. Your account</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your credentials.</li>
        <li>
          You must provide accurate information and only connect Facebook Pages you are
          authorised to administer.
        </li>
        <li>
          You will not share your account with anyone outside your organisation, except via
          a workspace invite once team accounts are available.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">3. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>
          Send unsolicited bulk messages, spam, or content that violates{' '}
          <a
            href="https://www.facebook.com/communitystandards/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Meta&rsquo;s Community Standards
          </a>{' '}
          or any{' '}
          <a
            href="https://developers.facebook.com/terms/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Meta Platform Terms or Developer Policies
          </a>
          .
        </li>
        <li>Harass, defraud, or impersonate any person.</li>
        <li>
          Promote or sell illegal goods or services, or content that violates the law in
          your jurisdiction.
        </li>
        <li>
          Reverse engineer, scrape, or otherwise misuse the Service or attempt to bypass
          rate limits or access controls.
        </li>
        <li>
          Build a competing service using our APIs or platform without our written
          permission.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these rules or that put our
        Meta app review status at risk.
      </p>

      <h2 className="mt-8 text-xl font-semibold">4. Customer content</h2>
      <p>
        You retain ownership of all content you provide to the Service (rules, response
        templates, system prompts) and all messages your customers send to your Pages.
        You grant us a limited licence to process this content solely to operate the
        Service for you.
      </p>

      <h2 className="mt-8 text-xl font-semibold">5. AI replies</h2>
      <p>
        AI fallback uses third-party LLM providers (currently OpenAI). You are
        responsible for the content of replies sent on your behalf, including AI-generated
        ones. We recommend reviewing the AI system prompt and monitoring conversations,
        especially in regulated industries.
      </p>

      <h2 className="mt-8 text-xl font-semibold">6. Fees and billing</h2>
      <p>
        During the MVP, the Service is free. Paid plans, billing, and usage limits will
        be introduced in a future release with at least 14 days&rsquo; notice. AI replies
        consume tokens on your OpenAI account if you bring your own API key.
      </p>

      <h2 className="mt-8 text-xl font-semibold">7. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted operation. The
        Service is provided &ldquo;as is&rdquo; without warranty of any kind, express or
        implied. We are not liable for any loss of revenue, data, or goodwill arising
        from your use of the Service, to the maximum extent permitted by law.
      </p>

      <h2 className="mt-8 text-xl font-semibold">8. Termination</h2>
      <p>
        You can delete your workspace at any time from the dashboard or by emailing us.
        We may terminate or suspend access for breach of these Terms, fraud, or by court
        order. On termination we will delete your workspace data per the{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2 className="mt-8 text-xl font-semibold">9. Changes</h2>
      <p>
        We may update these Terms when we add features or to reflect legal changes.
        Material changes will be announced by email at least 14 days in advance.
      </p>

      <h2 className="mt-8 text-xl font-semibold">10. Governing law</h2>
      <p>
        These Terms are governed by the laws of the operator&rsquo;s country of registration.
        Disputes will be resolved by the competent courts there, unless local consumer
        protection laws require otherwise.
      </p>

      <h2 className="mt-8 text-xl font-semibold">11. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
