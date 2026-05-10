import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions — fb-autoreply',
  description:
    'How to request deletion of data fb-autoreply has stored about your Facebook Page or your end users.',
};

const COMPANY = 'fb-autoreply';
const CONTACT_EMAIL = 'support@example.com';
const LAST_UPDATED = '2025-01-01';

export default function DataDeletionPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold mb-2">Data Deletion Instructions</h1>
      <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6">
        This page explains how to request deletion of data stored by {COMPANY}. Meta
        requires every app that connects to the Facebook Platform to provide this
        information.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What we store</h2>
      <ul>
        <li>Your account email, hashed password, and workspace settings.</li>
        <li>
          Connected Facebook Page metadata (Page ID, name, category, encrypted Page
          Access Token).
        </li>
        <li>
          Conversations and individual reply events &mdash; including the inbound message
          text, the reply we sent, the rule that matched (if any), and any error returned
          by Meta&rsquo;s API.
        </li>
        <li>Aggregated analytics counters and AI token-usage metrics.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">How to request deletion</h2>

      <h3 className="mt-4 text-lg font-semibold">Workspace owners (you connected a page)</h3>
      <ol>
        <li>
          The fastest way: log in, go to <strong>Pages</strong> &rarr; click{' '}
          <strong>Disconnect</strong> next to a page. We immediately stop processing
          webhook events for that page and queue its data for deletion.
        </li>
        <li>
          To delete your entire workspace (account, all pages, all rules, all
          conversations), email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address
          on the account, with the subject line <em>&ldquo;Workspace deletion
          request&rdquo;</em>.
        </li>
      </ol>

      <h3 className="mt-4 text-lg font-semibold">
        End users (you messaged a page that uses fb-autoreply)
      </h3>
      <p>
        If a Facebook Page you messaged uses {COMPANY} to auto-reply, your message text
        and reply may have been stored in the Page operator&rsquo;s workspace. To request
        deletion:
      </p>
      <ol>
        <li>
          The simplest path is to ask the Page operator directly &mdash; they own the
          conversation log and can delete it from their dashboard.
        </li>
        <li>
          You can also email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
          with: (a) your Facebook display name, (b) the name or URL of the Page you
          messaged, and (c) approximate dates of the messages. We will locate and delete
          the matching records within 30 days. We may need to verify your identity by
          asking you to confirm a few message details.
        </li>
      </ol>

      <h3 className="mt-4 text-lg font-semibold">Removing the app from Facebook</h3>
      <p>
        To revoke {COMPANY}&rsquo;s access to your Facebook account at the platform level:
      </p>
      <ol>
        <li>
          Go to{' '}
          <a
            href="https://www.facebook.com/settings?tab=business_tools"
            target="_blank"
            rel="noreferrer noopener"
          >
            Facebook Settings &rarr; Business Integrations
          </a>
          .
        </li>
        <li>Find <strong>{COMPANY}</strong> in the list and click <strong>Remove</strong>.</li>
        <li>
          Then email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and let us
          know &mdash; we&rsquo;ll delete any cached data we still hold for the
          disconnected pages.
        </li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">Processing time</h2>
      <p>
        We acknowledge requests within 5 business days and complete verified deletions
        within 30 days. Deletion is irreversible.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What survives deletion</h2>
      <p>
        We may retain anonymised, aggregated analytics (e.g. &ldquo;total replies served
        across the platform per day&rdquo;) that cannot be traced back to your workspace
        or any individual end user. Server access logs are kept for up to 30 days for
        security purposes and are then automatically purged.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p>
        For any deletion-related question:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
