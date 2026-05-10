# Meta App Review — Permissions Pack

This document is the **copy-paste source of truth** for the Meta App Review
submission for `fb-autoreply`. It contains:

1. The exact list of permissions the app requests, mapped to the code paths
   that use each one.
2. Ready-to-paste use-case descriptions for the App Review UI.
3. The required app assets (Privacy Policy, Terms, Data Deletion URL, app
   icon, business verification) and where they live.
4. A reviewer test plan so Meta reviewers can verify the behaviour
   end-to-end.

> **Heads up:** Meta's App Review UI changes its wording every few months
> (use cases vs. permissions, Pages API → "Manage everything on your Page",
> etc.). The justifications below are written generically so they survive
> minor wording changes. If a field name in the dashboard differs slightly
> from what's quoted here, paste the same content — Meta cares about the
> meaning, not the exact heading.

---

## 1. App identity

| Field                    | Value                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| App name                 | `fb-autoreply` (or your white-label name)                                         |
| Category                 | Business → Messaging                                                              |
| App type                 | Business                                                                          |
| Use case                 | "Manage everything on your Page" + "Messenger Platform"                           |
| Privacy Policy URL       | `https://<your-domain>/privacy` (file: `apps/web/src/app/(legal)/privacy/page.tsx`) |
| Terms of Service URL     | `https://<your-domain>/terms` (file: `apps/web/src/app/(legal)/terms/page.tsx`)     |
| Data Deletion URL        | `https://<your-domain>/data-deletion` (file: `apps/web/src/app/(legal)/data-deletion/page.tsx`) |
| Business verification    | **Required.** Use the Business Manager that owns the Page you'll demo with.       |

Before you submit:

- [ ] Open each of the three legal pages and replace the `COMPANY`,
      `CONTACT_EMAIL`, and `LAST_UPDATED` placeholders with your real values.
      Search for those tokens with `rg COMPANY apps/web/src/app/\(legal\)`.
- [ ] Make sure all three pages return HTTP 200 from a real public URL —
      Meta's automated crawler checks this. `curl -I https://<your-domain>/privacy`
      should succeed.

---

## 2. Permissions requested

The app requests the following permissions (see
[`apps/api/src/routes/pages.ts`](../apps/api/src/routes/pages.ts) where
the OAuth `scope` is built):

```
pages_show_list
pages_messaging
pages_manage_engagement
pages_read_engagement
pages_manage_metadata
```

Plus the implicit `public_profile` and `email` from the standard login flow.

### 2.1 `pages_show_list`

**What it does:** Lists the Pages the connecting user manages so the user
can pick which ones to connect to fb-autoreply.

**Where it's used:** `apps/api/src/lib/facebook.ts` → `getUserPages()`,
called from the OAuth callback at
`apps/api/src/routes/pages.ts` (`GET /api/pages/oauth/callback`).

**Justification (paste into the App Review form):**

> Our app, fb-autoreply, is a SaaS dashboard that lets a Page admin connect
> their Facebook Pages so the app can automatically reply to comments and
> Messenger messages on those Pages. Immediately after the user logs in
> with Facebook, we call `/me/accounts` to fetch the list of Pages the user
> manages and display them in our dashboard for the user to pick. The user
> explicitly selects which Pages to connect; we never auto-connect Pages
> they didn't choose. Without this permission, the user would have to
> manually copy and paste a Page Access Token from the Graph API Explorer,
> which is a poor UX.

### 2.2 `pages_messaging`

**What it does:** Lets the app send a Messenger message from a connected
Page in reply to an inbound user message, within the 24-hour standard
messaging window.

**Where it's used:** `apps/api/src/lib/facebook.ts` → `sendMessengerReply()`,
called from `apps/api/src/services/auto-reply.ts` after a
`messages` webhook event matches a rule or triggers the AI fallback.

**Justification:**

> fb-autoreply is a Messenger auto-reply tool. When a user sends a message
> to a connected Page, our webhook receives the event, runs it through the
> Page admin's configured rules (keyword → response template) or, if no
> rule matches, an optional OpenAI fallback. We then call
> `/<PSID>/messages` with `messaging_type=RESPONSE` to send the reply. We
> only send within the 24-hour window allowed for `RESPONSE` messages —
> never as broadcast or marketing. Every reply is a direct response to a
> user-initiated message.

### 2.3 `pages_manage_engagement`

**What it does:** Lets the app reply to comments on the connected Page's
posts.

**Where it's used:** `apps/api/src/lib/facebook.ts` → `replyToComment()`,
called from `apps/api/src/services/auto-reply.ts` after a `feed` webhook
event with `verb=add` matches a rule.

**Justification:**

> Comment auto-reply is the second core feature of fb-autoreply. When a
> user comments on a Page's post, our webhook receives the `feed` event,
> matches it against the Page admin's configured rules, and posts a reply
> as the Page using `/<comment-id>/comments`. We only reply once per
> comment (deduplicated by `comment_id`) and we filter out comments
> authored by the Page itself to prevent reply-loops. The Page admin
> always has a "Disable" toggle per rule and a "Disconnect Page" button
> to stop all activity instantly.

### 2.4 `pages_read_engagement`

**What it does:** Lets the app read the content of incoming comments and
the user's profile name for use as a template variable.

**Where it's used:** Implicit in the webhook handler in
`apps/api/src/routes/webhook.ts` — the `feed` event payload contains the
comment text. We also fetch `first_name` so rule templates can render
`{{first_name}}` (see `apps/api/src/lib/rules-engine.ts`).

**Justification:**

> To pick the right rule for a comment we need to read the comment's text;
> to personalise the reply we read the user's first name. We do not store
> the commenter's full profile — only their first name (used as a template
> variable) and Facebook user ID (used to deduplicate replies and to
> respect the cooldown configured per rule). All inbound text is stored
> only as part of the conversation transcript so the Page admin can audit
> what the bot did, and the admin can delete any conversation at any time
> from the dashboard.

### 2.5 `pages_manage_metadata`

**What it does:** Lets the app subscribe the connected Page to webhooks
for `feed` and `messages` events.

**Where it's used:** `apps/api/src/lib/facebook.ts` → `subscribePageWebhooks()`,
called once at the moment a Page is connected (manual connect or OAuth
callback) — see `apps/api/src/routes/pages.ts`.

**Justification:**

> Without this permission we cannot register our webhook on the user's
> Page, which is the entire delivery mechanism for the inbound events
> the app reacts to. We subscribe to exactly two fields — `feed` and
> `messages` — at the moment the user connects the Page, and we
> unsubscribe automatically when the user disconnects the Page from the
> dashboard.

---

## 3. Reviewer test plan (paste into "Step-by-step instructions")

```
Test account credentials are provided in the App Review submission as
"Test Credentials". The dashboard URL is https://<your-domain>.

1.  Go to https://<your-domain>/login and log in with the provided
    test account.
2.  Click "Pages" in the sidebar, then "Connect with Facebook".
3.  In the Facebook OAuth dialog, grant access to the test Page named
    "<your test Page name>".
4.  You should land back on the Pages list with the test Page connected.
5.  Click "Rules" in the sidebar. There is one preset rule named
    "Pricing FAQ" (channel: comment, keyword: "price").
6.  In a separate browser tab, go to the test Page and post a public
    comment containing the word "price" on the most recent post.
7.  Within ~10 seconds, refresh the comment thread on Facebook. You
    will see a public reply from the Page that begins with the
    template's first line ("Hi <first-name>! ...").
8.  In the dashboard, click "Conversations" — the new conversation is
    listed; click it to see the inbound + outbound transcript.
9.  Send a message to the test Page from a different Facebook account
    (or use the Page's preview-as-visitor mode). Within ~10 seconds the
    Page replies via Messenger.
10. Click "Pages" → "Disconnect" on the test Page. The webhook
    subscription is removed and no further automated replies happen.
```

---

## 4. App icon and screenshots

Meta requires a 1024 × 1024 PNG icon and at least one screenshot.

- App icon: place at `apps/web/public/icon-1024.png` and reference from
  the App Review form upload field. (We do not check this file into git
  by default — generate it from your logo.)
- Screenshot 1: dashboard `/dashboard/rules` showing the rule list.
- Screenshot 2: dashboard `/dashboard/conversations/<id>` showing a real
  inbound + outbound transcript.

---

## 5. Pre-submit checklist

Run through this before clicking "Submit for Review":

- [ ] Privacy Policy / Terms / Data Deletion URLs all return HTTP 200.
- [ ] All three legal pages have the `COMPANY`, `CONTACT_EMAIL`, and
      `LAST_UPDATED` placeholders replaced.
- [ ] The dashboard is reachable from a public URL (not a localhost
      tunnel — Meta's reviewer machine cannot reach `*.ngrok.io` reliably).
- [ ] Webhook endpoint at `https://<your-api-domain>/api/webhooks/facebook`
      returns 200 OK to the GET verification challenge with the
      `FB_VERIFY_TOKEN` you set in Meta dashboard → Webhooks.
- [ ] Webhook signature verification is on (`FB_APP_SECRET` env var set
      in production — see `apps/api/src/routes/webhook.ts`).
- [ ] Token encryption is on (`TOKEN_ENCRYPTION_KEY` env var, 32-byte hex
      via `openssl rand -hex 32` — see `apps/api/src/lib/crypto.ts`).
- [ ] Test credentials provided in the form actually work — log in fresh
      in an incognito window before you submit.
- [ ] Screencast recorded (see `docs/META_APP_REVIEW_SCREENCAST.md`) and
      uploaded — Meta requires a video for `pages_messaging` and
      `pages_manage_engagement`.
- [ ] Business verification completed in Business Manager.

Average turnaround: **3–7 business days**. Typical rejection reasons:

- Webhook URL unreachable from Meta's reviewer environment.
- Privacy Policy missing a section about how data is shared with third
  parties (we ship a generic privacy page that does cover this — make
  sure you didn't accidentally remove it).
- "We can't reproduce the use case" — almost always means the test Page
  in the submission isn't connected to the test account, or the test
  account doesn't admin the Page. Double-check the test account is a
  Page admin **and** connected via the dashboard.
