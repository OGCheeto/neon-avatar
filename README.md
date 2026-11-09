# Nova – Neon 3D Avatar (iPhone web app)

An interactive, animated neon robot companion built with three.js (vendored in `vendor/`, no CDN), plus a small assistant hub.

Open https://ogcheeto.github.io/neon-avatar/ in Safari → Share → **Add to Home Screen** for full-screen mode.

**Avatar:** tap (jump/spin/wave/hop/nod), double-tap (dance), hold (pet), drag (spin), pinch (zoom), head/eyes follow your finger, tap 6× fast (dizzy), sleeps after 45 s idle, optional Tilt (motion permission), 5 color themes, voice + sound toggle.

**Hub:** Apps launcher (iOS URL schemes + custom launchers), Notes with dictation, Agenda with on-screen reminders and `.ics` export to Calendar. All data stays on the device (localStorage).

Tests: `node test/e2e.mjs` (Playwright + SwiftShader, iPhone 393×852 viewport).
