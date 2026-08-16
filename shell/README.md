# Kage desktop shell

A thin Electron frame over the daemon's own renderer. It contains **zero HTML** — it
loads `http://127.0.0.1:<port>/app` and adds only the four things a browser tab cannot
do: a dock presence with a badge, a global hotkey, native notifications, and being "the
app" in the user's muscle memory. Orchestration logic lives in shared modules behind the
API, so the TUI and CLI never drift from it.

## Running it

```bash
kage app
```

That starts (or reuses) the daemon and opens the app. From a checkout:

```bash
npm start --prefix shell
```

## Building the .dmg

```bash
npm run dmg --prefix shell
```

## Signing — what you get, and what you need

The build decides the signing identity at build time. Three states:

| Your machine | What happens | What a user sees |
|---|---|---|
| Developer ID + `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Signed and notarized | Opens on double-click, like any Mac app |
| Developer ID, no notarization credentials | Signed, hardened runtime, not notarized | One Gatekeeper prompt on first open |
| **No Developer ID (the default here)** | **Ad-hoc signed** | "Unidentified developer" — right-click → **Open**, once |

Ad-hoc signing is not cosmetic. Without it, electron-builder leaves the bundle carrying
*Electron's own* signature, which no longer matches the modified app — `codesign -dv`
reports `Identifier=Electron` and the verification fails outright. macOS presents that
as **"Kage is damaged and can't be opened"**, which reads to a user as a corrupt
download rather than an unsigned app. Ad-hoc signing replaces it with a valid signature
identified as `dev.kage.desktop`, so the only remaining hurdle is the honest one.

Verify any build:

```bash
codesign -dv --verbose=2 /Applications/Kage.app
```

### To ship a notarized build

Notarization cannot be set up from this repo — it needs a **paid Apple Developer
Program membership** ($99/yr) and a certificate issued to your account.

1. Enrol at <https://developer.apple.com/programs/>.
2. In Xcode → Settings → Accounts, create a **Developer ID Application** certificate.
   `security find-identity -v -p codesigning` should then list it.
3. Create an app-specific password at <https://appleid.apple.com> → Sign-In and Security.
4. Build with the credentials in the environment:

```bash
APPLE_ID="you@example.com" APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" APPLE_TEAM_ID="XXXXXXXXXX" npm run dmg --prefix shell
```

The config picks all of this up on its own — nothing in it needs editing. It prints
which path it took at the start of every build.

## The icon

`build/icon.icns` is generated from Kage's 影 seal at all ten sizes macOS asks for. The
same image is set on the dock at runtime, because electron-builder's icon only applies
to a packaged app and a `npm start` run would otherwise show the default Electron
diamond.
