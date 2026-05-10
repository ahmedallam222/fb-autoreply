# App Review Screencast Script

Meta requires a video that demonstrates each requested permission being
used by a real (non-admin) end user of the app. The video should be
**90–180 seconds** total, in landscape, in English, with a 1080p+ source.

This is the exact script. Read the narration aloud while screen-recording.
Pauses are written as `(pause 2s)` so the video doesn't cut transitions
mid-action.

> Tip: record in two takes — one for the Pages OAuth flow (permissions
> 2.1 and 2.5), and one for the comment + message reply (2.2, 2.3, 2.4).
> Then concatenate them.

---

## Setup before recording

Open three browser tabs, side by side if possible:

1. **Tab A:** Your fb-autoreply dashboard, signed out, on `/login`.
2. **Tab B:** A logged-in Facebook profile that **admins the test Page**
   you'll demo with. Open the test Page directly so you can post a
   comment from it.
3. **Tab C:** A second Facebook profile (a personal test account that is
   **not** a Page admin) that you'll use to send a Messenger message and
   post a comment as a regular user.

Keep tab C signed in throughout — it's the "end user" perspective Meta
wants to see.

---

## Scene 1 — Sign in & connect a Page (covers 2.1, 2.5)

**On screen:** Tab A, the `/login` page.

> "This is fb-autoreply. It's a SaaS dashboard a Page admin uses to
> auto-reply to comments and Messenger messages on their Facebook Pages.
> I'll log in as a Page admin now."

Log in with the test account credentials you submitted in the App Review
form. Land on `/dashboard`.

**On screen:** the sidebar with `Pages`, `Rules`, `Conversations`, etc.

> "Step one: connect a Facebook Page. I click Pages, then Connect with
> Facebook."

Click **Pages** → **Connect with Facebook**. Facebook's OAuth dialog
opens.

> "Facebook asks me to grant the permissions our app needs. The app
> requests `pages_show_list` so it can list the Pages I admin so I can
> pick which ones to connect, and `pages_manage_metadata` so it can
> subscribe my Page to webhooks for incoming comments and messages."

Approve all permissions. The browser redirects back to the dashboard
Pages list.

> "I'm back on the Pages list. The test Page is connected and the green
> Webhook badge shows that the webhook subscription was created on the
> Page automatically."

(pause 2s — let the Page row settle)

---

## Scene 2 — Post a comment (covers 2.3, 2.4)

**On screen:** Tab C (the non-admin user).

> "Now I'm a regular user. I'll post a comment on the connected Page's
> latest post. The Page admin has a rule called 'Pricing FAQ' that
> matches the keyword 'price'."

Type a comment such as:

```
What's the price of your Premium plan?
```

Click Post.

**On screen:** stay on the comment for 5–10 seconds. The Page's
auto-reply will appear underneath.

> "Within a few seconds the Page replies automatically with the response
> the admin configured. The reply is personalised — it uses my first
> name, which the app reads using the `pages_read_engagement` permission
> — and the reply itself is sent using `pages_manage_engagement`."

(pause 3s)

Switch to **Tab A** (the dashboard).

> "Back in the dashboard, the Conversations tab shows the new
> conversation. Clicking it opens the full transcript with the inbound
> comment, the matched rule, and the outbound reply."

Click **Conversations** → click the new conversation. Show the timeline.

---

## Scene 3 — Send a Messenger message (covers 2.2)

**On screen:** Tab C again.

> "Now I'll send a direct message to the same Page on Messenger."

Open the Page's Messenger thread (`m.me/<page-username>`). Send:

```
Hi, do you ship internationally?
```

(pause 5s — wait for the reply)

> "The Page replies via Messenger using the `pages_messaging` permission,
> within Meta's standard 24-hour response window."

Show the reply in the Messenger thread.

Switch to Tab A:

> "And again the Conversations view records the full message thread for
> the admin's audit log."

Refresh the Conversations list and show the new Messenger thread.

---

## Scene 4 — Disconnect (covers consent withdrawal)

**On screen:** Tab A, dashboard `Pages`.

> "Finally, the user can disconnect the Page at any time. This removes
> the webhook subscription and stops all auto-replies immediately."

Click **Disconnect** on the test Page row. Confirm.

> "The Page is removed from the list. From this point on, no comments or
> messages on this Page are processed by fb-autoreply, and the Page's
> stored access token is deleted."

(pause 2s)

> "That covers all five requested permissions, end to end."

---

## Recording tips

- Use OBS Studio (free) or QuickTime. Output 1920 × 1080, 30 fps, MP4
  (H.264). Meta's upload limit is 1 GB.
- Hide other browser tabs, bookmarks bar, and any personal info. The
  reviewer screenshots are sometimes shared internally — keep it clean.
- Speak slower than feels natural. Reviewers often watch at 1× and need
  to hear permission names clearly.
- Don't edit out delays under 3 seconds. Showing the real ~5 second
  webhook → reply round-trip is a positive signal that the app actually
  works rather than being faked.
- If the video exceeds 3 minutes, cut Scene 4 first (it's nice-to-have
  but not strictly needed).
