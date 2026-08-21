// Build configuration, in JS rather than package.json because the signing identity has
// to be DECIDED at build time rather than hard-coded.
//
// Three states, and the difference between them is what a user sees on first launch:
//
//   1. A Developer ID is in the keychain → sign with it. If the notarization
//      credentials are also present, notarize, and the app opens with a double-click
//      like any other Mac app.
//   2. No Developer ID → sign AD-HOC. This does not satisfy Gatekeeper (the user still
//      gets "unidentified developer" and must right-click → Open once), but it gives
//      the bundle a valid signature of its own.
//   3. `identity: null`, the previous setting → no signing at all, which leaves the
//      bundle carrying ELECTRON'S signature. That signature no longer matches the
//      modified bundle, so `codesign -dv` reported `Identifier=Electron` and "code has
//      no resources but signature indicates they must be present" — the state that
//      produces "Kage is damaged and can't be opened", which reads to a user as a
//      corrupt download rather than an unsigned app. State 2 is strictly better than
//      state 3 and costs nothing.
"use strict";

const { execFileSync } = require("node:child_process");

/** A Developer ID Application identity in the keychain, if the machine has one. */
function developerId() {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
    const match = out.match(/"(Developer ID Application: [^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const identity = developerId();

// Notarization needs all three; partial credentials would fail late and confusingly.
const canNotarize = Boolean(
  identity && process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID,
);

if (identity) {
  console.log(`[kage] signing with: ${identity}${canNotarize ? " (and notarizing)" : " (no notarization credentials)"}`);
} else {
  console.log("[kage] no Developer ID found — signing ad-hoc. Users will need to right-click → Open once.");
}

/**
 * Ad-hoc sign the packaged bundle when there is no Developer ID.
 *
 * electron-builder will not do this itself — it looks `identity` up in the keychain and
 * skips signing when the name does not resolve, and codesign's ad-hoc identity ("-")
 * is not a keychain entry. So the bundle would keep Electron's stale signature. Doing
 * it here, after packing, replaces that with a valid self-signed one.
 */
async function adHocSign(context) {
  if (process.platform !== "darwin" || identity) return;
  const app = require("node:path").join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  try {
    // --deep is deprecated for distribution signing but is the correct tool here: every
    // nested framework and helper carries the same stale Electron signature.
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "pipe" });
    console.log("[kage] ad-hoc signed the bundle (valid signature, no certificate behind it)");
  } catch (error) {
    console.warn(`[kage] ad-hoc signing failed: ${error.message}`);
  }
}

module.exports = {
  afterPack: adHocSign,
  appId: "dev.kage.desktop",
  productName: "Kage",
  directories: { output: "dist", buildResources: "build" },
  files: ["main.js", "update.js", "bootstrap.js", "package.json", "build/icon.icns", "node_modules/**/*"],
  // `autoUpdateSigned` rides into the packaged package.json so update.js can read, at
  // runtime, the same signing decision made here at build time — see update.js for why
  // an ad-hoc-signed bundle must degrade to notify-only instead of attempting installs
  // Squirrel.Mac will refuse to apply.
  extraMetadata: { main: "main.js", autoUpdateSigned: Boolean(identity) },
  mac: {
    category: "public.app-category.developer-tools",
    // zip is not a second human download — it exists because Squirrel.Mac (the engine
    // electron-updater drives on macOS) updates FROM a zip, never from a dmg. The dmg
    // stays the one users double-click; the zip is auto-update's own artifact.
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
    icon: "build/icon.icns",
    // "-" is codesign's ad-hoc identity: a real, self-consistent signature with no
    // certificate behind it.
    identity: identity ?? "-",
    hardenedRuntime: Boolean(identity),
    gatekeeperAssess: false,
    ...(canNotarize
      ? { notarize: { teamId: process.env.APPLE_TEAM_ID } }
      : {}),
  },
  dmg: { title: "Kage" },
  // Publishing to GitHub Releases is what makes electron-builder emit latest-mac.yml —
  // the manifest electron-updater polls to learn a new version exists. `publish` only
  // fires when the build is run with --publish (see shell/README's release flow); a
  // plain `npm run dmg` never touches the network.
  publish: [{ provider: "github", owner: "kage-core", repo: "Kage" }],
};
