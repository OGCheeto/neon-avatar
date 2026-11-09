import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:8811/';
const OUT = process.env.OUT || 'shots';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
// mock speech recognition so dictation flow can be exercised headless
await ctx.addInitScript(() => {
  class FakeSR { start() { setTimeout(() => this.onstart?.(), 50); setTimeout(() => this.onresult?.({ results: [Object.assign([{ transcript: 'buy milk and eggs' }], { isFinal: true })] }), 300); }
    stop() { setTimeout(() => this.onend?.(), 30); } }
  window.webkitSpeechRecognition = window.SpeechRecognition = FakeSR; window.open = (u) => { window.__opened = u; return {}; }; window.__navigate = (u) => { window.__navigated = u; };
});
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '5551234567' : undefined));
const st = () => p.evaluate(() => window.__nova.state);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto(BASE); await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/01-idle.png` });
const f0 = (await st()).frames; await p.waitForTimeout(2000); const fps = ((await st()).frames - f0) / 2; console.log('fps (swiftshader, CPU):', fps);
const [hx, hy] = await p.evaluate(() => window.__nova._projectHead());
// tap
await p.waitForTimeout(1500); await p.touchscreen.tap(hx, hy); await p.waitForTimeout(150); let s = await st(); ok(s.action === 'jump', 'tap avatar -> ' + s.action + ' / ' + s.expr);
await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/02-tap-jump.png` });
await p.waitForTimeout(1200);
// double tap
await p.touchscreen.tap(hx, hy); await p.waitForTimeout(120); await p.touchscreen.tap(hx, hy); await p.waitForTimeout(500);
s = await st(); ok(s.action === 'dance', 'double-tap -> ' + s.action); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/03-dance.png` });
await p.waitForTimeout(4000);
// drag rotate (CDP touch)
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
// finger follow
await touch('touchStart', [{ x: 20, y: 150 }]); await p.waitForTimeout(600); s = await st(); await touch('touchEnd', []);
ok(s.look[0] < -0.2 && s.look[1] > 0.05, 'head follows finger (left/up) look=' + s.look.map((v) => v.toFixed(2)));
await p.screenshot({ path: `${OUT}/03b-follow.png` });
const y0 = (await st()).yaw;
await touch('touchStart', [{ x: 80, y: 700 }]); for (let i = 1; i <= 10; i++) { await touch('touchMove', [{ x: 80 + i * 20, y: 700 }]); await p.waitForTimeout(16); }
await touch('touchEnd', []); await p.waitForTimeout(400); s = await st(); ok(Math.abs(s.yaw - y0) > 0.5, `drag rotates yaw ${y0.toFixed(2)} -> ${s.yaw.toFixed(2)}`);
await p.screenshot({ path: `${OUT}/04-rotated.png` });
// pinch
const d0 = (await st()).dist;
await touch('touchStart', [{ x: 150, y: 400, id: 1 }, { x: 240, y: 400, id: 2 }]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: 150 - i * 10, y: 400, id: 1 }, { x: 240 + i * 10, y: 400, id: 2 }]); await p.waitForTimeout(16); }
await touch('touchEnd', []); await p.waitForTimeout(500); s = await st(); ok(s.dist < d0 - 1.5, `pinch-out zooms in ${d0.toFixed(2)} -> ${s.dist.toFixed(2)}`);
await p.screenshot({ path: `${OUT}/05-zoomed.png` });
// long press = pet
const [hx2, hy2] = await p.evaluate(() => window.__nova._projectHead());
await touch('touchStart', [{ x: hx2, y: hy2 }]); await p.waitForTimeout(800); s = await st(); await p.screenshot({ path: `${OUT}/06-pet.png` }); await touch('touchEnd', []);
ok(s.action === 'pet' && s.expr === 'love', 'long-press -> ' + s.action + '/' + s.expr);
// theme
await p.waitForTimeout(1500); const th0 = (await st()).theme; await p.tap('[data-act=theme]'); await p.waitForTimeout(300); s = await st(); ok(s.theme !== th0, `theme ${th0} -> ${s.theme}`);
await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/07-theme.png` });
await p.tap('[data-act=theme]'); await p.tap('[data-act=theme]'); await p.tap('[data-act=theme]'); await p.tap('[data-act=theme]'); // back to first
// APPS
await p.tap('[data-open=apps]'); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/08-apps.png` });
ok(await p.locator('#appGrid .tile').count() === 20, 'apps grid has 20 built-ins');
await p.tap('#appAddToggle'); await p.fill('#appName', 'Venmo'); await p.fill('#appUrl', 'venmo://'); await p.fill('#appIcon', '💸'); await p.tap('#appForm button[type=submit]');
await p.waitForTimeout(300); ok(await p.locator('#appGrid .tile').count() === 21, 'custom launcher added');
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('nova.apps'))))[0].url === 'venmo://', 'custom launcher persisted');
await p.tap('.tile[data-id=delivery]'); await p.waitForTimeout(600); ok((await p.evaluate(() => window.__opened)) === 'https://ogcheeto.github.io/delivery-tracker/', 'Delivery tile opens tracker');
await p.tap('.tile[data-id=phone]'); await p.waitForTimeout(450); ok((await p.evaluate(() => window.__lastLaunch)) === 'tel:5551234567', 'Phone tile asks number -> tel:');
await p.screenshot({ path: `${OUT}/09-apps-custom.png` });
await p.tap('#appEdit'); await p.tap('.tile[data-id^=c_]'); await p.waitForTimeout(200); ok(await p.locator('#appGrid .tile').count() === 20, 'custom launcher deleted in edit mode'); await p.tap('#appEdit');
await p.tap('#sheetClose'); await p.waitForTimeout(500);
// NOTES
await p.tap('[data-open=notes]'); await p.waitForTimeout(600);
await p.tap('#dictBtn'); await p.waitForTimeout(200); s = await st(); ok(s.listening, 'dictation -> avatar listening');
await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/10-dictating.png` });
ok((await p.inputValue('#noteText')).includes('buy milk'), 'dictation fills note');
await p.tap('#dictBtn'); await p.waitForTimeout(200); ok(!(await st()).listening, 'stop dictation');
await p.tap('#noteSave'); await p.fill('#noteText', 'Call mom Sunday'); await p.tap('#noteSave'); await p.waitForTimeout(300);
ok(await p.locator('#noteList li').count() === 2, 'two notes saved');
await p.screenshot({ path: `${OUT}/11-notes.png` });
await p.tap('#sheetClose'); await p.waitForTimeout(400);
// AGENDA
await p.tap('[data-open=agenda]'); await p.waitForTimeout(600);
const soon = await p.evaluate(() => { const d = new Date(Date.now() + 20 * 60000); const z = (n) => String(n).padStart(2, '0'); return { date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, time: `${z(d.getHours())}:${z(d.getMinutes())}` }; });
await p.fill('#evTitle', 'Dentist, checkup'); await p.fill('#evDate', soon.date); await p.fill('#evTime', soon.time); await p.selectOption('#evRemind', '30'); await p.tap('#evForm button[type=submit]');
await p.fill('#evTitle', 'Pick up Instacart batch'); await p.fill('#evDate', '2026-12-01'); await p.fill('#evTime', '09:30'); await p.selectOption('#evRemind', '10'); await p.tap('#evForm button[type=submit]');
await p.waitForTimeout(300);
const next = await p.evaluate(() => window.__hub.describeNext()); ok(/Dentist/.test(next), 'next: ' + next);
const ics = await p.evaluate(() => window.__hub.buildICS(window.__hub.events[0]));
ok(ics.includes('SUMMARY:Dentist\\, checkup') && ics.includes('TRIGGER:-PT30M') && ics.includes('\r\nEND:VCALENDAR'), 'ICS valid-ish');
await p.evaluate(() => window.__hub.checkReminders()); await p.waitForTimeout(300);
ok((await p.evaluate(() => window.__hub.events[0].fired)) === true, 'reminder fired (30 min lead, event in 20)');
ok((await p.textContent('#toast')).includes('Dentist'), 'reminder toast shown');
await p.screenshot({ path: `${OUT}/12-agenda.png` });
await p.tap('#evNext'); await p.waitForTimeout(300);
await p.tap('#sheetClose'); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/13-final.png` });
// persistence after reload
await p.reload(); await p.waitForTimeout(1500);
ok(await p.evaluate(() => window.__hub.notes.length === 2 && window.__hub.events.length === 2), 'notes/agenda persist after reload');
const scroll = await p.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight); ok(scroll, 'no page scroll');
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
