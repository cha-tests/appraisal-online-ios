# How to Invite an External Tester on TestFlight

This is the process for you (the app owner) to get the app in front of one external tester. It assumes you already have an Apple Developer account — you do, since this app is already registered in App Store Connect (App ID `6805013580`).

## Before you start: is the build up to date?

The last build submitted was **build #7**, which does **not** include the fixes made in this session (currency display, the fuller AI report, the address-confirmation step). If you want your tester to see those, you need a new build first — let me know and I can walk you through that separately, or trigger it if you'd like me to.

If build #7 is fine for now (e.g. you just want to test the basic flow), skip ahead to Step 1.

---

## Step 1: Open App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) in a browser and sign in with your Apple Developer account.
2. Click **Apps**, then click **Appraisal Online**.
3. Along the top, click the **TestFlight** tab.

## Step 2: Check that a build is ready

1. On the left side, under "Builds," you should see build **7** (or a newer one, if you had one made).
2. If the build shows a status like "Processing," wait — Apple takes anywhere from a few minutes to an hour to finish processing a new build before it can be tested. If it already says "Ready to Submit" or shows no warning icon, it's ready.
3. If Apple flagged any missing info (a small warning/exclamation icon next to the build), click the build and fill in whatever it's asking for — usually just a one-line "Export Compliance" question, which is already pre-answered by the app's settings in most cases.

## Step 3: Create a tester group (only needs doing once)

1. Still in the TestFlight tab, look at the left sidebar under **External Testing**.
2. Click the **+** button next to "External Testing" (or "Add Group" if that's what you see).
3. Name the group something simple, like **"External Testers."**
4. Under that group, click **Builds** and add build 7 (or your newest build) to the group.

## Step 4: Get a shareable link (the easy way — no need to collect their email in Apple's system)

1. Inside your new "External Testers" group, look for **Public Link**.
2. Toggle it **on**. Apple will generate a link like `https://testflight.apple.com/join/xxxxxxxx`.
3. Copy that link.

## Step 5: Apple has to review the build once (external testers only)

The first time you use a build with **external** testers, Apple reviews it — this is called **Beta App Review**. It's separate from a full App Store review and is usually faster (often within a day, sometimes just a few hours), but it is not instant.

1. If prompted, submit the build for Beta App Review (there's usually a "Submit for Review" button on the group or build page).
2. Wait for an email or status change saying it's approved. Until then, the link won't let anyone in.

## Step 6: Send the tester everything they need

Once approved, send your tester:
1. The TestFlight link from Step 4.
2. The separate tester guide — see **TESTFLIGHT_TESTER_GUIDE.md** in this same folder. It's written for someone with zero technical background; you can forward it as-is (copy the text into an email or chat message).

That's it — once they install TestFlight and open your link, the app installs like a normal App Store app.

## A few things to expect

- **The tester needs an iPhone** — TestFlight for iOS only installs iOS apps, and only on a real device (not a computer).
- **Builds expire after 90 days** on TestFlight — not a concern for a short test, just something to know if this drags on.
- **Up to 10,000 external testers** are allowed per app via a public link, so you don't need to manage individual invites for a small group.
