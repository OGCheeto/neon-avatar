import * as THREE from './vendor/three.module.js';
import { initHub } from './hub.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const ICON = params.has('icon');
if (ICON) document.body.classList.add('icon');

// ---------- themes ----------
const THEMES = [
  { name: 'Cyber', a: '#22f3ff', b: '#ff3ad8', c: '#9b5cff' },
  { name: 'Synth', a: '#ff3ad8', b: '#22f3ff', c: '#ffd23a' },
  { name: 'Toxic', a: '#7cff6b', b: '#ff3ad8', c: '#22f3ff' },
  { name: 'Sunset', a: '#ffb020', b: '#ff2d55', c: '#ff3ad8' },
  { name: 'Ultra', a: '#9b5cff', b: '#22f3ff', c: '#ff3ad8' },
];
let themeIdx = +(localStorage.getItem('nova.theme') || 0) % THEMES.length;

// ---------- renderer ----------
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: ICON });
} catch (e) {
  $('#nogl').hidden = false; throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x05040a, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05040a, 7, 20);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

// lights: dark body + coloured rim lights = neon look
scene.add(new THREE.HemisphereLight(0x3a2a6a, 0x05040a, 0.9));
const keyL = new THREE.DirectionalLight(0xffffff, 0.6); keyL.position.set(0, 4, 5); scene.add(keyL);
const rimA = new THREE.PointLight(0x22f3ff, 30, 12, 1.6); rimA.position.set(-3, 2.5, -1); scene.add(rimA);
const rimB = new THREE.PointLight(0xff3ad8, 30, 12, 1.6); rimB.position.set(3, 1.5, -1); scene.add(rimB);
const fill = new THREE.PointLight(0x9b5cff, 8, 8, 1.6); fill.position.set(0, 0.5, 3); scene.add(fill);

// glow sprite texture
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = glowTex();
const glows = [];
function glow(color, size, role) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  s.scale.setScalar(size); s.userData = { base: size, role }; glows.push(s); return s;
}

// ---------- materials ----------
const shell = new THREE.MeshStandardMaterial({ color: 0x14101f, metalness: 0.65, roughness: 0.3 });
const shell2 = new THREE.MeshStandardMaterial({ color: 0x0a0812, metalness: 0.4, roughness: 0.5 });
const neonA = new THREE.MeshBasicMaterial({ color: 0x22f3ff });
const neonB = new THREE.MeshBasicMaterial({ color: 0xff3ad8 });
const neonC = new THREE.MeshBasicMaterial({ color: 0x9b5cff });
const hullA = new THREE.MeshBasicMaterial({ color: 0x22f3ff, side: THREE.BackSide, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
const hullB = hullA.clone(); hullB.color.set(0xff3ad8);
function withHull(mesh, mat, k = 1.05) {
  const h = new THREE.Mesh(mesh.geometry, mat); h.scale.setScalar(k); h.raycast = () => {}; mesh.add(h); return mesh;
}

// ---------- avatar ----------
const avatar = new THREE.Group(); scene.add(avatar);
const rig = new THREE.Group(); avatar.add(rig); // animated offsets
const hitMeshes = [];
const M = (geo, mat, hit = true) => { const m = new THREE.Mesh(geo, mat); if (hit) hitMeshes.push(m); return m; };

// hover pad
const pad = new THREE.Group(); avatar.add(pad);
const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.03, 12, 80), neonA); padRing.rotation.x = Math.PI / 2; pad.add(padRing);
const padRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.015, 8, 64), neonB); padRing2.rotation.x = Math.PI / 2; pad.add(padRing2);
const padDisc = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48), new THREE.MeshBasicMaterial({ color: 0x22f3ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
padDisc.rotation.x = -Math.PI / 2; pad.add(padDisc);
const padGlow = glow(0x22f3ff, 2.4, 'a'); padGlow.position.y = 0.05; padGlow.material.opacity = 0.35; pad.add(padGlow);

// body
const body = new THREE.Group(); body.position.y = 0.95; rig.add(body);
const torso = withHull(M(new THREE.CapsuleGeometry(0.46, 0.42, 8, 24), shell), hullA, 1.06); torso.scale.set(1, 1, 0.85); body.add(torso);
const belt = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.022, 8, 64), neonB); belt.rotation.x = Math.PI / 2; belt.position.y = -0.12; belt.scale.set(1, 0.85, 1); body.add(belt);
const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), neonA); core.position.set(0, 0.12, 0.4); body.add(core);
const coreGlow = glow(0x22f3ff, 0.6, 'a'); coreGlow.position.copy(core.position); body.add(coreGlow);
const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 24), shell2); tail.rotation.x = Math.PI; tail.position.y = -0.62; body.add(tail);
const thruster = glow(0xff3ad8, 0.7, 'b'); thruster.position.y = -0.82; body.add(thruster);

// arms
function makeArm(side) {
  const sh = new THREE.Group(); sh.position.set(0.58 * side, 0.22, 0); body.add(sh);
  const joint = M(new THREE.SphereGeometry(0.11, 16, 12), shell2); sh.add(joint);
  const arm = withHull(M(new THREE.CapsuleGeometry(0.075, 0.38, 6, 12), shell), side > 0 ? hullB : hullA, 1.12); arm.position.y = -0.3; sh.add(arm);
  const hand = M(new THREE.SphereGeometry(0.11, 16, 12), side > 0 ? neonB : neonA); hand.position.y = -0.62; sh.add(hand);
  const hg = glow(side > 0 ? 0xff3ad8 : 0x22f3ff, 0.45, side > 0 ? 'b' : 'a'); hg.position.y = -0.62; sh.add(hg);
  sh.userData.side = side; sh.rotation.z = 0.12 * side; return sh;
}
const armL = makeArm(-1), armR = makeArm(1);

// head
const neck = new THREE.Group(); neck.position.y = 1.62; rig.add(neck);
const head = new THREE.Group(); neck.add(head);
const skull = withHull(M(new THREE.SphereGeometry(0.6, 40, 28), shell), hullB, 1.045); skull.scale.set(1.15, 0.95, 1); head.add(skull);
const visor = new THREE.Mesh(new THREE.SphereGeometry(0.605, 40, 20, Math.PI / 2 - 1.0, 2.0, Math.PI / 2 - 0.55, 1.1), new THREE.MeshStandardMaterial({ color: 0x020205, metalness: 0.9, roughness: 0.15 }));
visor.scale.copy(skull.scale); head.add(visor);
const faceCanvas = document.createElement('canvas'); faceCanvas.width = 512; faceCanvas.height = 256;
const fctx = faceCanvas.getContext('2d');
const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace;
const face = new THREE.Mesh(new THREE.SphereGeometry(0.612, 40, 20, Math.PI / 2 - 1.0, 2.0, Math.PI / 2 - 0.55, 1.1), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
face.scale.copy(skull.scale); head.add(face);
const ears = [];
for (const s of [-1, 1]) {
  const ear = M(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), shell2); ear.rotation.z = Math.PI / 2; ear.position.x = 0.69 * s; head.add(ear);
  const er = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 40), s > 0 ? neonB : neonA); er.rotation.y = Math.PI / 2; er.position.x = 0.76 * s; head.add(er); ears.push(er);
}
const antenna = new THREE.Group(); antenna.position.y = 0.55; head.add(antenna);
const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 8), shell2); stalk.position.y = 0.16; antenna.add(stalk);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), neonB); bulb.position.y = 0.35; antenna.add(bulb);
const bulbGlow = glow(0xff3ad8, 0.55, 'b'); bulbGlow.position.y = 0.35; antenna.add(bulbGlow);

// ---------- environment ----------
const grid = new THREE.GridHelper(40, 40, 0x9b5cff, 0x9b5cff); grid.material.transparent = true; grid.material.opacity = 0.22; grid.position.y = -0.02; scene.add(grid);
const stars = (() => {
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = 14 + Math.random() * 16, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5; pos.set([r * Math.cos(th) * Math.sin(ph), 0.5 + r * Math.cos(ph), r * Math.sin(th) * Math.sin(ph)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.06, transparent: true, opacity: 0.8, fog: false })); scene.add(p); return p;
})();
const motes = (() => {
  const n = 60, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 6, Math.random() * 3.5, (Math.random() - 0.5) * 6], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: GLOW, color: 0xff3ad8, size: 0.12, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(p); return p;
})();

function applyTheme(i, announce) {
  themeIdx = (i + THEMES.length) % THEMES.length; const T = THEMES[themeIdx];
  localStorage.setItem('nova.theme', themeIdx);
  const A = new THREE.Color(T.a), B = new THREE.Color(T.b), C = new THREE.Color(T.c);
  neonA.color.copy(A); neonB.color.copy(B); neonC.color.copy(C); hullA.color.copy(A); hullB.color.copy(B);
  padDisc.material.color.copy(A); rimA.color.copy(A); rimB.color.copy(B); fill.color.copy(C);
  grid.material.color.copy(C); motes.material.color.copy(B);
  for (const g of glows) g.material.color.copy(g.userData.role === 'a' ? A : B);
  const r = document.documentElement.style; r.setProperty('--a', T.a); r.setProperty('--b', T.b); r.setProperty('--c', T.c);
  if (announce) say(`${T.name} mode!`, { speak: false });
}

// ---------- face drawing ----------
const S = { expr: 'normal', exprUntil: 0, blink: 0, nextBlink: 2, lookX: 0, lookY: 0, talk: 0, listening: false, speaking: false, lastInput: performance.now() };
function rr(x, y, w, h, r) { fctx.beginPath(); fctx.roundRect ? fctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(r, w / 2, h / 2)) : fctx.rect(x - w / 2, y - h / 2, w, h); fctx.fill(); }
function heart(x, y, s) { fctx.beginPath(); fctx.moveTo(x, y + s * 0.9); fctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45); fctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); fctx.fill(); }
function drawFace(t) {
  const T = THEMES[themeIdx]; const g = fctx; g.clearRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(40,20,80,0.25)'; rr(256, 128, 420, 200, 90);
  const e = S.expr, lx = S.lookX * 34, ly = -S.lookY * 20, bl = 1 - S.blink;
  g.shadowBlur = 24; g.shadowColor = T.a; g.fillStyle = T.a; g.strokeStyle = T.a; g.lineWidth = 16; g.lineCap = 'round';
  const EX = [176, 336], EY = 112;
  const arcEye = (x) => { g.beginPath(); g.arc(x + lx, EY + 18 + ly, 34, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); };
  for (let k = 0; k < 2; k++) {
    const x = EX[k];
    if (e === 'happy' || (e === 'wink' && k === 1)) arcEye(x);
    else if (e === 'love') { g.fillStyle = T.b; g.shadowColor = T.b; heart(x + lx, EY + ly, 36 + Math.sin(t * 10) * 4); g.fillStyle = T.a; g.shadowColor = T.a; }
    else if (e === 'dizzy') { g.beginPath(); g.moveTo(x - 26, EY - 26); g.lineTo(x + 26, EY + 26); g.moveTo(x + 26, EY - 26); g.lineTo(x - 26, EY + 26); g.stroke(); }
    else if (e === 'sleepy') { g.beginPath(); g.moveTo(x - 30, EY + 10); g.lineTo(x + 30, EY + 10); g.stroke(); }
    else if (e === 'surprised') { g.beginPath(); g.arc(x + lx, EY + ly, 38 * Math.max(bl, 0.1), 0, Math.PI * 2); g.lineWidth = 14; g.stroke(); g.lineWidth = 16; rr(x + lx, EY + ly, 18, 18 * Math.max(bl, .1), 9); }
    else rr(x + lx, EY + ly, 62, Math.max(8, 84 * bl), 30);
  }
  // mouth
  g.shadowColor = T.b; g.strokeStyle = T.b; g.fillStyle = T.b; const my = 190 + ly * 0.4, mx = 256 + lx * 0.6;
  if (S.listening) { for (let i = -3; i <= 3; i++) { const h = 10 + Math.abs(Math.sin(t * 9 + i * 1.3)) * 34; rr(mx + i * 18, my, 9, h, 5); } }
  else if (S.talk > 0.05) { rr(mx, my, 58, 10 + S.talk * 34, 20); }
  else if (e === 'surprised') { g.beginPath(); g.arc(mx, my, 16, 0, Math.PI * 2); g.lineWidth = 10; g.stroke(); }
  else if (e === 'dizzy') { g.beginPath(); g.lineWidth = 8; for (let i = 0; i <= 60; i++) { const x = mx - 45 + i * 1.5, y = my + Math.sin(i / 6 + t * 8) * 7; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  else if (e === 'sleepy') { rr(mx, my, 26, 8, 4); }
  else { g.beginPath(); g.lineWidth = 10; const w = (e === 'happy' || e === 'love' || e === 'wink') ? 46 : 30; g.arc(mx, my - w * 0.9, w, Math.PI * 0.25, Math.PI * 0.75); g.stroke(); }
  g.shadowBlur = 0; faceTex.needsUpdate = true;
}
function setExpr(e, secs = 1.8) { S.expr = e; S.exprUntil = performance.now() + secs * 1000; }

// ---------- actions ----------
let action = null; // {type,t0,dur}
const DUR = { jump: 0.9, spin: 1.1, wave: 2.0, dance: 4.6, hop: 0.6, pet: 2.2, nod: 0.9 };
function act(type) {
  S.lastInput = performance.now();
  action = { type, t0: clock.elapsedTime, dur: DUR[type] || 1 };
  sfx(type);
  if (type === 'wave') { setExpr('happy', 2); say(pick(['Hi there! 👋', 'Hey friend!', 'Hello!'])); }
  if (type === 'dance') { setExpr('happy', 4.6); say('♪ Let’s dance! ♪', { speak: false }); burst(['🎵', '✨', '🎶'], 8); }
  if (type === 'jump') { setExpr('surprised', 0.9); say('Whee!', { speak: false }); }
  if (type === 'spin') { setExpr('wink', 1.4); burst(['✨'], 5); }
  if (type === 'hop') setExpr('surprised', 0.8);
  if (type === 'pet') { setExpr('love', 2.4); say(pick(['Aww ♥', 'Hehe, that tickles!', '♥ ♥ ♥']), { speak: false }); burst(['💖', '💜', '💙'], 7); }
  if (type === 'nod') setExpr('happy', 1);
}
const pick = (a) => a[(Math.random() * a.length) | 0];
const ease = (p) => p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;

// ---------- speech bubble + voice ----------
const bubble = $('#bubble'); let bubbleUntil = 0;
let muted = localStorage.getItem('nova.muted') === '1';
const muteBtn = $('#muteBtn'); const syncMute = () => (muteBtn.textContent = muted ? '🔇' : '🔊'); syncMute();
muteBtn.onclick = () => { muted = !muted; localStorage.setItem('nova.muted', muted ? '1' : '0'); syncMute(); if (muted) speechSynthesis?.cancel(); else say('Sound on!'); };
function say(text, { speak = true, secs } = {}) {
  bubble.textContent = text; bubble.classList.add('show');
  const dur = secs || Math.min(6, 1.6 + text.length * 0.06); bubbleUntil = performance.now() + dur * 1000;
  if (speak && !muted && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'’:-]/gu, ''));
      u.rate = 1.05; u.pitch = 1.35; u.onstart = () => (S.speaking = true); u.onend = u.onerror = () => (S.speaking = false);
      speechSynthesis.speak(u);
    } catch {}
  }
}
// tiny synth blips
let actx;
function sfx(kind) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine';
    const n = actx.currentTime, f = { jump: [400, 900], spin: [500, 1200], wave: [600, 800], dance: [300, 600], pet: [700, 1000], hop: [500, 700], nod: [500, 600] }[kind] || [500, 700];
    o.frequency.setValueAtTime(f[0], n); o.frequency.exponentialRampToValueAtTime(f[1], n + 0.15);
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.08, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.25);
    o.connect(g).connect(actx.destination); o.start(n); o.stop(n + 0.3);
  } catch {}
}
const fx = $('#fx'); const headWorld = new THREE.Vector3();
function screenOf(obj, dy = 0) { obj.getWorldPosition(headWorld); headWorld.y += dy; headWorld.project(camera); return [(headWorld.x * 0.5 + 0.5) * innerWidth, (-headWorld.y * 0.5 + 0.5) * innerHeight]; }
function burst(chars, n) {
  const [x, y] = screenOf(head, 0.2);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'pop'; s.textContent = pick(chars);
    s.style.left = x + (Math.random() - 0.5) * 120 + 'px'; s.style.top = y + (Math.random() - 0.3) * 80 + 'px';
    s.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px'); s.style.animationDelay = i * 0.07 + 's';
    fx.appendChild(s); setTimeout(() => s.remove(), 1600 + i * 70);
  }
}

// ---------- camera orbit + touch ----------
const cam = { yaw: 0, pitch: 0.12, dist: 6.4, vyaw: 0, tiltX: 0, tiltY: 0, targetY: 1.15 };
let sheetOpen = false;
const pointers = new Map(); let pinch0 = 0, dist0 = 0, downInfo = null, lastTap = 0, longTimer = 0;
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let finger = null; // {x,y} ndc
function setNdc(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
function hitAvatar(e) { setNdc(e); ray.setFromCamera(ndc, camera); return ray.intersectObjects(hitMeshes, false).length > 0; }
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  S.lastInput = performance.now(); if (S.expr === 'sleepy') { setExpr('surprised', 0.8); say('Oh! I’m awake!', { speak: false }); }
  setNdc(e); finger = { x: ndc.x, y: ndc.y };
  if (pointers.size === 1) {
    downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, onAvatar: hitAvatar(e) };
    clearTimeout(longTimer);
    if (downInfo.onAvatar) longTimer = setTimeout(() => { if (downInfo && !downInfo.moved) { downInfo.long = true; act('pet'); } }, 550);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist; if (downInfo) downInfo.moved = true; clearTimeout(longTimer);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  setNdc(e); finger = { x: ndc.x, y: ndc.y }; S.lastInput = performance.now();
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0) cam.dist = THREE.MathUtils.clamp(dist0 * pinch0 / d, 3.8, 11);
  } else if (downInfo) {
    if (!downInfo.moved && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 9) { downInfo.moved = true; clearTimeout(longTimer); }
    if (downInfo.moved) { cam.vyaw = -dx * 0.009; cam.yaw += cam.vyaw; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.005, -0.15, 0.75); }
  }
});
function up(e) {
  pointers.delete(e.pointerId); clearTimeout(longTimer);
  if (pointers.size === 0) {
    finger = null;
    if (downInfo && !downInfo.moved && !downInfo.long && performance.now() - downInfo.t < 350) onTap(e, downInfo.onAvatar);
    downInfo = null;
  }
  if (pointers.size < 2) pinch0 = 0;
}
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
let tapCount = 0, tapWindow = 0;
const REACTIONS = ['jump', 'spin', 'wave', 'hop', 'nod'];
let rIdx = 0;
function onTap(e, onAvatar) {
  const now = performance.now();
  if (!onAvatar) { setNdc(e); lookHold = { x: ndc.x, y: ndc.y, until: now + 1200 }; if (sheetOpen) closeSheet(); return; }
  if (now - lastTap < 320) { act('dance'); lastTap = 0; return; }
  lastTap = now;
  tapCount = now - tapWindow < 2500 ? tapCount + 1 : 1; tapWindow = now;
  if (tapCount >= 6) { tapCount = 0; action = { type: 'spin', t0: clock.elapsedTime, dur: 1.6 }; setExpr('dizzy', 2.6); say('Woah… dizzy… 😵‍💫', { speak: false }); return; }
  act(REACTIONS[rIdx++ % REACTIONS.length]);
}
let lookHold = null;
// prevent iOS gestures
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.sheet-body')) e.preventDefault(); }, { passive: false });

// device tilt (optional)
const tiltBtn = $('#tiltBtn');
if ('DeviceOrientationEvent' in window && !ICON) {
  tiltBtn.hidden = false;
  let on = false;
  const handler = (ev) => { cam.tiltX = THREE.MathUtils.clamp((ev.gamma || 0) / 45, -1, 1); cam.tiltY = THREE.MathUtils.clamp(((ev.beta || 0) - 45) / 45, -1, 1); };
  tiltBtn.onclick = async () => {
    if (on) { removeEventListener('deviceorientation', handler); on = false; cam.tiltX = cam.tiltY = 0; tiltBtn.classList.remove('on'); return; }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') { toast('Motion access was declined. You can still drag to spin me.'); return; }
      }
      addEventListener('deviceorientation', handler); on = true; tiltBtn.classList.add('on'); say('Tilt your phone!', { speak: false });
    } catch { toast('Motion sensors aren’t available here.'); }
  };
}

// dock
document.querySelectorAll('#dock [data-act]').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.act; if (a === 'theme') { applyTheme(themeIdx + 1, true); act('spin'); } else act(a);
}));

// toast
let toastT; function toast(msg, secs = 3) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), secs * 1000); }

// ---------- sheet ----------
const sheet = $('#sheet');
function openSheet(name, title) {
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === name));
  $('#sheetTitle').textContent = title; sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); sheetOpen = true; document.body.classList.add('sheet-open');
}
function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); sheetOpen = false; document.body.classList.remove('sheet-open'); document.activeElement?.blur?.(); }
$('#sheetClose').onclick = closeSheet;

// ---------- resize ----------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.7 ? 40 : 34; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- loop ----------
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), plane = new THREE.Plane();
const lookTarget = new THREE.Vector2(); const look = new THREE.Vector2();
let frames = 0;
function update() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
  frames++;
  // camera
  if (!downInfo || !downInfo.moved) { cam.yaw += cam.vyaw; cam.vyaw *= 0.93; }
  const k = 1 - Math.pow(0.001, dt);
  const ty = sheetOpen ? -0.8 : 1.15, td = sheetOpen ? 9.5 : cam.dist;
  cam.targetY += (ty - cam.targetY) * k * 0.6;
  cam._d = (cam._d ?? td) + (td - (cam._d ?? td)) * k * 0.6;
  const yaw = cam.yaw + cam.tiltX * 0.35, pitch = (sheetOpen ? 0.12 : cam.pitch) + cam.tiltY * 0.2;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * cam._d, cam.targetY + 0.15 + Math.sin(pitch) * cam._d, Math.cos(yaw) * Math.cos(pitch) * cam._d);
  camera.lookAt(0, cam.targetY, 0);
  if (ICON) { camera.position.set(0.0, 1.95, 3.1); camera.lookAt(0, 1.78, 0); camera.fov = 40; camera.aspect = 1; camera.updateProjectionMatrix(); }

  // expression timers
  if (S.expr !== 'normal' && S.expr !== 'sleepy' && now > S.exprUntil) S.expr = 'normal';
  if (!ICON && now - S.lastInput > 45000 && !action && !S.listening && S.expr === 'normal') { S.expr = 'sleepy'; say('Zzz…', { speak: false, secs: 3 }); }
  // blink
  S.nextBlink -= dt; if (S.nextBlink <= 0) { S.blinkT = 0.16; S.nextBlink = 2 + Math.random() * 3.5; if (Math.random() < 0.2) S.nextBlink = 0.25; }
  if (S.blinkT > 0) { S.blinkT -= dt; S.blink = Math.sin((1 - S.blinkT / 0.16) * Math.PI); } else S.blink = 0;
  if (ICON) S.blink = 0;
  // talk mouth
  S.talk += (((S.speaking || now < bubbleUntil - 600) && !S.listening && S.expr !== 'sleepy' ? Math.abs(Math.sin(t * 16)) * 0.9 : 0) - S.talk) * 0.35;

  // look target (head follows finger / tap point / camera)
  const src = finger || (lookHold && now < lookHold.until ? lookHold : null);
  if (src) {
    ndc.set(src.x, src.y); ray.setFromCamera(ndc, camera);
    neck.getWorldPosition(tmpV); camera.getWorldDirection(tmpV2); plane.setFromNormalAndCoplanarPoint(tmpV2, tmpV);
    const hitP = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, hitP)) { avatar.worldToLocal(hitP); neck.position && hitP.sub(neck.position); }
    lookTarget.set(Math.atan2(hitP.x, Math.max(0.6, hitP.z + 2.5)), Math.atan2(hitP.y, 2.5));
  } else {
    // face the camera with a gentle wander
    const camLocal = avatar.worldToLocal(camera.position.clone()).sub(neck.position);
    lookTarget.set(Math.atan2(camLocal.x, camLocal.z) + Math.sin(t * 0.4) * 0.15, Math.atan2(camLocal.y, Math.hypot(camLocal.x, camLocal.z)) + Math.sin(t * 0.3) * 0.06);
  }
  if (S.expr === 'sleepy') lookTarget.set(0, -0.35);
  lookTarget.x = THREE.MathUtils.clamp(lookTarget.x, -0.9, 0.9); lookTarget.y = THREE.MathUtils.clamp(lookTarget.y, -0.5, 0.45);
  look.lerp(lookTarget, k * 0.5);
  S.lookX = THREE.MathUtils.clamp(look.x * 0.8, -1, 1); S.lookY = THREE.MathUtils.clamp(look.y * 1.2, -1, 1);

  // base idle pose
  let y = 0.18 + Math.sin(t * 1.7) * 0.07, ryaw = 0, rz = 0, sq = 1, hx = 0, hz = 0;
  let aL = -0.12 - Math.sin(t * 1.7) * 0.05, aR = 0.12 + Math.sin(t * 1.7) * 0.05, aLx = Math.sin(t * 1.1) * 0.1, aRx = -Math.sin(t * 1.1) * 0.1;
  if (S.expr === 'sleepy') { y = 0.08 + Math.sin(t * 0.8) * 0.03; hx = 0.25; aL = -0.05; aR = 0.05; }
  if (S.listening) { hz = Math.sin(t * 2) * 0.12 + 0.12; }
  // action overlay
  if (action) {
    const p = (t - action.t0) / action.dur;
    if (p >= 1) action = null;
    else {
      const a = action.type;
      if (a === 'jump') { const j = Math.sin(Math.PI * p); y += j * 0.95; sq = p < 0.12 ? 1 - Math.sin(p / 0.12 * Math.PI) * 0.12 : 1 + j * 0.05; aL = -2.4 * j - 0.1; aR = 2.4 * j + 0.1; }
      if (a === 'spin') { ryaw = ease(p) * Math.PI * 2; y += Math.sin(Math.PI * p) * 0.25; aL = -1.2 * Math.sin(Math.PI * p); aR = 1.2 * Math.sin(Math.PI * p); }
      if (a === 'hop') { y += Math.abs(Math.sin(p * Math.PI * 2)) * 0.3; hx = -0.15; }
      if (a === 'nod') { hx = Math.sin(p * Math.PI * 3) * 0.3; }
      if (a === 'wave') { const r = Math.min(1, p * 5, (1 - p) * 5); aR = 0.12 + r * 2.45 + Math.sin(t * 13) * 0.35 * r; aRx = -0.3 * r; hz = -0.15 * r; rz = 0.05 * r; }
      if (a === 'pet') { rz = Math.sin(t * 5) * 0.12; hz = Math.sin(t * 5) * 0.18; y += 0.05; aL = -0.6; aR = 0.6; aLx = aRx = -0.6; }
      if (a === 'dance') {
        const b = t * 7.5; y += Math.abs(Math.sin(b)) * 0.32; rz = Math.sin(b) * 0.18; hz = -Math.sin(b) * 0.22;
        aL = -1.4 - Math.sin(b) * 1.0; aR = 1.4 - Math.sin(b) * 1.0; aLx = Math.cos(b) * 0.5; aRx = -Math.cos(b) * 0.5;
        ryaw = p > 0.45 && p < 0.7 ? ease((p - 0.45) / 0.25) * Math.PI * 2 : 0;
        if ((frames & 31) === 0) applyHueKick(t);
      }
    }
  }
  rig.position.y = y; rig.rotation.y = ryaw; rig.rotation.z = rz; rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  body.scale.y = 1 + Math.sin(t * 2.2) * 0.015;
  const ab = 1 - Math.pow(0.0005, dt);
  armL.rotation.z += (aL - armL.rotation.z) * ab; armR.rotation.z += (aR - armR.rotation.z) * ab;
  armL.rotation.x += (aLx - armL.rotation.x) * ab; armR.rotation.x += (aRx - armR.rotation.x) * ab;
  head.rotation.y = look.x * 0.75; head.rotation.x = -look.y * 0.6 + hx; head.rotation.z += (hz - head.rotation.z) * ab;
  antenna.rotation.z = Math.sin(t * 2.3) * 0.12 - rz * 1.5; antenna.rotation.x = Math.sin(t * 1.7) * 0.08;
  // glow pulse
  const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
  for (const g of glows) g.scale.setScalar(g.userData.base * (g === bulbGlow ? 0.8 + Math.abs(Math.sin(t * 3)) * 0.5 : pulse));
  hullA.opacity = 0.22 + Math.sin(t * 2.4) * 0.08; hullB.opacity = 0.22 + Math.cos(t * 2.4) * 0.08;
  for (const er of ears) er.scale.setScalar(S.listening ? 1 + Math.abs(Math.sin(t * 8)) * 0.35 : 1);
  core.rotation.y += dt * 2; core.rotation.x += dt * 0.7;
  padRing.rotation.z += dt * 0.6; padRing2.rotation.z -= dt * 1.1;
  const padS = 1 - (rig.position.y - 0.18) * 0.25; pad.scale.set(padS, 1, padS);
  stars.rotation.y += dt * 0.01; motes.rotation.y -= dt * 0.05; motes.position.y = Math.sin(t * 0.5) * 0.1;
  drawFace(t);
  // bubble position
  if (bubble.classList.contains('show')) {
    if (now > bubbleUntil && !S.speaking) bubble.classList.remove('show');
    const [bx, by] = screenOf(head, 0.85); bubble.style.left = bx + 'px'; bubble.style.top = Math.max(by, 70) + 'px';
  }
}
let hueKick = 0;
function applyHueKick() { hueKick = (hueKick + 1) % 3; const T = THEMES[themeIdx]; const cols = [T.a, T.b, T.c]; rimA.color.set(cols[hueKick]); rimB.color.set(cols[(hueKick + 1) % 3]); if (!action || action.type !== 'dance') applyTheme(themeIdx); }
function loop() {
  update(); renderer.render(scene, camera);
  if (action == null && hueKick) { hueKick = 0; applyTheme(themeIdx); }
  requestAnimationFrame(loop);
}
applyTheme(themeIdx);
requestAnimationFrame(loop);

// ---------- hub API ----------
const nova = {
  say, act, setExpr, toast, openSheet, closeSheet,
  set listening(v) { S.listening = v; if (v) setExpr('normal', 0); },
  get listening() { return S.listening; },
  get state() { return { expr: S.expr, action: action?.type || null, theme: THEMES[themeIdx].name, dist: cam.dist, yaw: cam.yaw, listening: S.listening, frames, sheetOpen, muted, look: [look.x, look.y] }; },
  get muted() { return muted; },
  _tapAvatar() { onTap({ clientX: 0, clientY: 0 }, true); },
  _projectHead() { return screenOf(head, 0); },
};
window.__nova = nova;
if (!ICON) {
  initHub(nova);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setTimeout(() => { if ($('#hint')) $('#hint').style.opacity = 0; }, 9000);
}
