# Google sign-in

**Off, and not configured in this build.** Everything below is what it would do if you
set it up, and — more importantly — what it would not.

## What it is

A way to open the right local profile by tapping your Google account instead of picking a
name from a list. That is the whole feature.

## What it is not

This app is a static export. There is no server, no session to hold and nothing that
could check one. So this is an **identity label**, not authentication:

|              |                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Does**     | Pick which local profile opens. Fill in your name and avatar.                                                                               |
| **Does not** | Sync anything, anywhere.                                                                                                                    |
| **Does not** | Protect anything. The profile's data is the same plain IndexedDB it was before, readable through devtools whether you are signed in or not. |
| **Does not** | Survive clearing site data, or follow you to another device.                                                                                |

Signing in on a second device creates a **second, empty profile** wearing the same name.
If that is the thing you actually want, you want a backend — see the end of this file.

## Setting it up

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type _Web application_.
2. Add your site's address to **Authorized JavaScript origins** — for local development
   that is `http://localhost:3000`, and for a deployed copy it is that origin exactly.
3. Put the client ID in `.env.local`:

   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
   ```

4. Rebuild. The sign-in option appears in **Settings → Profiles**, and on the profile
   picker when one is shown.

### On a host rather than locally

Same steps, with two things that catch people out:

- **Authorized JavaScript origins must contain the deployed origin exactly** — for
  example `https://engthai-trainer.vercel.app`, with no trailing slash and no path. Add
  `http://localhost:3000` alongside it to keep development working.
- **`NEXT_PUBLIC_*` is read at build time, not at run time.** It is inlined into the
  JavaScript bundle, so adding the variable in a hosting dashboard changes nothing until
  you trigger a **new deployment**. This is the usual reason the option is still missing
  after setting it.

### Where it appears

- **Settings → Profiles**, always — showing either the sign-in button or the "not set up"
  note, the way the AI panel reports a provider it does not have.
- **The profile picker**, which only appears when you have signed out or have more than
  one profile. A single learner with no passcode goes straight into the app and never
  sees it, which is deliberate.

Without step 3 the app says "Google sign-in is not set up in this build" and the local
profile picker works exactly as it always has.

### The client ID is not a secret

It is in the bundle on purpose. A browser OAuth client ID identifies the app; it does not
authorise anything. What stops another site using it is the **authorized origins** list on
the credential, not secrecy — Google's own documented flow puts it in the page.

This does not weaken the rule in [docs/ai.md](ai.md): there is still **no secret anywhere
in this app**, and this does not create a place to put one. The distinction is the same
one that lets a future AI adapter's URL live in the bundle while its key may not.

## What leaves the device, and when

Nothing, until you have read the disclosure and pressed **Agree and continue**. Google's
script is deliberately _not_ in the layout — it is fetched on demand, so an ordinary load
of this app still contacts nothing. There is an end-to-end test that asserts exactly that.

After you agree:

- **Sent:** a request to `accounts.google.com` for the sign-in script, and your sign-in,
  which Google handles on their own page.
- **Received:** your name, email address and profile picture.
- **Never sent:** your sentences, answers, schedule or XP. None of it leaves the device,
  signed in or not.

Consent is remembered per browser and can be withdrawn with **Stop contacting Google**.

## How the token is handled

The credential Google returns is a JWT, and a JWT payload is **untrusted input** until
verified — the same stance this codebase takes on model output and pasted import files.

1. Parsed with Zod. An undeclared claim is dropped rather than passed through.
2. Issuer, audience and expiry checked — cheaply, and **before** any network call, so a
   token that was never Google's costs nothing.
3. Signature verified as RS256 against Google's published keys with WebCrypto. `alg:
"none"` is rejected outright.
4. Each failure reports its own cause. "Sign-in failed" for six different problems tells
   the learner nothing and whoever configured the client ID less.

Verification is worth doing because reading a name out of an unverified string is a bad
habit to leave in a file that looks like an auth module. It proves the token is Google's.
**It proves nothing about who is holding the laptop**, and it is not a security boundary.

`picture` must be an `https` URL. It is rendered as an image source, and `z.string().url()`
accepts `javascript:` and `data:` quite happily — a valid URL is not a safe one.

## One account, one profile

A Google account links to exactly one local profile. Letting one `sub` claim two would
make "sign in" ambiguous and the answer arbitrary. Unlinking detaches the label and
leaves every sentence, answer and schedule exactly where they were — nothing here was
ever holding the data.

## If you want sync

That is a different project. It needs a server holding the data, an account system with
real sessions, and a way to merge two devices' append-only attempt logs. Nothing on this
page moves towards it; this is a nicer profile picker.
