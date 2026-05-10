import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — fb-autoreply',
  description: 'How fb-autoreply collects, uses, shares, and protects your data.',
};

const COMPANY = 'fb-autoreply';
const CONTACT_EMAIL = 'support@example.com';
const LAST_UPDATED = '2025-01-01';

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6">
        This Privacy Policy explains how {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects, uses, and shares information when you (&ldquo;you&rdquo;,
        &ldquo;Customer&rdquo;) use our auto-reply service for Facebook Pages
        (&ldquo;Service&rdquo;).
      </p>

      <h2 className="mt-8 text-xl font-semibold">1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> &mdash; email address, hashed password, full name
          (optional), and workspace name you provide at signup.
        </li>
        <li>
          <strong>Facebook Page metadata</strong> &mdash; the Page ID, name, category,
          profile picture URL, and a long-lived Page Access Token, which we store so we can
          reply to comments and Messenger messages on your behalf.
        </li>
        <li>
          <strong>Customer messages</strong> &mdash; the text of comments and Messenger
          messages sent to your connected Facebook Pages, plus the sender&rsquo;s display
          name and Facebook-scoped user ID (PSID). We log these so you can review the
          conversation and so the auto-reply pipeline can match keyword rules and (if
          enabled) generate AI replies.
        </li>
        <li>
          <strong>Reply logs</strong> &mdash; the reply we sent, which rule matched (if
          any), error messages from Facebook&rsquo;s API, and (for AI replies) the model
          name and token counts used for billing analytics.
        </li>
        <li>
          <strong>Operational logs</strong> &mdash; standard server logs (timestamps, IP
          addresses, user-agent, request paths) used for security and debugging. These are
          retained for 30 days unless required for an investigation.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">2. How we use your data</h2>
      <ul>
        <li>To deliver the auto-reply service (matching rules, sending replies).</li>
        <li>
          To show you the conversations and analytics that the Service has produced for
          your workspace.
        </li>
        <li>To detect and prevent abuse, fraud, or technical issues.</li>
        <li>
          To communicate with you about your account and material changes to the Service.
        </li>
      </ul>
      <p>
        <strong>We do not sell your data, and we do not use your customers&rsquo; messages
          to train any AI model.</strong>{' '}
        Customer messages may be sent to a third-party LLM provider (currently OpenAI)
        only when you explicitly enable AI fallback &mdash; see Section 4.
      </p>

      <h2 className="mt-8 text-xl font-semibold">3. Data from Meta (Facebook)</h2>
      <p>
        We use the Facebook Graph API to receive webhook events for your connected Pages
        and to send replies. Your Page Access Token authorises us to perform actions on
        the Page&rsquo;s behalf. We comply with{' '}
        <a
          href="https://developers.facebook.com/terms/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Meta&rsquo;s Platform Terms
        </a>{' '}
        and{' '}
        <a
          href="https://developers.facebook.com/devpolicy/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Developer Policies
        </a>
        . If you disconnect a page from the Service (or revoke our app from your Facebook
        settings), we stop receiving new webhook events for that page and you can request
        deletion of stored data &mdash; see Section 6.
      </p>

      <h2 className="mt-8 text-xl font-semibold">4. Third-party processors</h2>
      <p>
        We use the following processors to operate the Service. We share with them only
        the minimum data they need to perform their function.
      </p>
      <ul>
        <li>
          <strong>Meta Platforms, Inc.</strong> &mdash; Graph API for webhook delivery and
          sending replies.
        </li>
        <li>
          <strong>OpenAI, L.L.C.</strong> &mdash; only when you enable AI fallback.
          Customer message text and your configured system prompt are sent to OpenAI to
          generate the reply. OpenAI{' '}
          <a
            href="https://openai.com/policies/api-data-usage-policies"
            target="_blank"
            rel="noreferrer noopener"
          >
            does not use API data to train its models by default
          </a>
          .
        </li>
        <li>
          <strong>Hosting and database providers</strong> &mdash; for application hosting
          and PostgreSQL. We choose providers that offer industry-standard security
          controls (encryption at rest, access controls, audit logging).
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">5. How we store and protect your data</h2>
      <ul>
        <li>Data is stored in PostgreSQL with encryption at rest at the provider level.</li>
        <li>
          Access to production data is limited to authorised personnel and protected by
          strong authentication.
        </li>
        <li>Passwords are stored as bcrypt hashes &mdash; never in plain text.</li>
        <li>
          Page Access Tokens are stored encrypted in production. (For development they may
          be stored as plain text in a local database that is not internet-accessible.)
        </li>
        <li>All data in transit is encrypted via TLS.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">6. Your rights and data deletion</h2>
      <p>
        You can request a copy of the data we hold about your workspace, or request
        deletion of all of it, at any time by emailing{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or following our{' '}
        <a href="/data-deletion">Data Deletion Instructions</a>. We will action verified
        requests within 30 days. Deletion is irreversible &mdash; once we&rsquo;ve removed
        your data we cannot restore it.
      </p>
      <p>
        Customers (Facebook users who messaged your page) can request deletion of their
        messages from our system by contacting you, the Page operator, or by emailing us
        directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2 className="mt-8 text-xl font-semibold">7. Retention</h2>
      <p>
        We keep account data, page metadata, conversations, and reply logs for as long as
        your workspace is active. If you delete your workspace, we delete those records
        within 30 days. Aggregated, anonymised analytics (e.g. total replies served per
        day across the platform) may be retained indefinitely.
      </p>

      <h2 className="mt-8 text-xl font-semibold">8. Children</h2>
      <p>
        The Service is not directed to children under 13 (or the age of digital consent in
        your jurisdiction). We do not knowingly collect data from children.
      </p>

      <h2 className="mt-8 text-xl font-semibold">9. Changes to this policy</h2>
      <p>
        We may update this policy when we add new features or processors. Material changes
        will be communicated to you by email at least 14 days before they take effect.
      </p>

      <h2 className="mt-8 text-xl font-semibold">10. Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
