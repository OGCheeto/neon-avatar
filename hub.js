// Nova assistant hub: app launcher, notes + dictation, agenda + reminders + .ics export.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// v = verified: documented/long-standing iOS link. Others are best-effort custom schemes.
export const BUILTIN_APPS = [
  { id: 'phone', name: 'Phone', icon: '📞', url: 'tel:', ask: 'Number to call?', v: 1, t: '#7cff6b' },
  { id: 'msg', name: 'Messages', icon: '💬', url: 'sms:', v: 1, t: '#7cff6b' },
  { id: 'mail', name: 'Mail', icon: '✉️', url: 'mailto:', v: 1, t: '#22f3ff' },
  { id: 'facetime', name: 'FaceTime', icon: '🎥', url: 'facetime:', ask: 'Number or email for FaceTime?', v: 1, t: '#7cff6b' },
  { id: 'maps', name: 'Maps', icon: '🗺️', url: 'https://maps.apple.com/', v: 1, t: '#22f3ff' },
  { id: 'delivery', name: 'Delivery', icon: '🛒', url: 'https://ogcheeto.github.io/delivery-tracker/', v: 1, t: '#ff3ad8' },
  { id: 'shortcuts', name: 'Shortcuts', icon: '⚡', url: 'shortcuts://', v: 1, t: '#9b5cff' },
  { id: 'calendar', name: 'Calendar', icon: '📅', url: 'calshow://', v: 0, t: '#ff2d55' },
  { id: 'music', name: 'Music', icon: '🎵', url: 'music://', v: 0, t: '#ff2d55' },
  { id: 'spotify', name: 'Spotify', icon: '🎧', url: 'spotify:', v: 1, t: '#7cff6b' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', url: 'youtube://', v: 1, t: '#ff2d55' },
  { id: 'instagram', name: 'Instagram', icon: '📸', url: 'instagram://app', v: 1, t: '#ff3ad8' },
  { id: 'x', name: 'X', icon: '𝕏', url: 'twitter://', v: 0, t: '#e9f8ff' },
  { id: 'facebook', name: 'Facebook', icon: 'ⓕ', url: 'fb://', v: 0, t: '#4f7dff' },
  { id: 'gmail', name: 'Gmail', icon: '📧', url: 'googlegmail://', v: 1, t: '#ff3ad8' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '🟢', url: 'whatsapp://', v: 1, t: '#7cff6b' },
  { id: 'uber', name: 'Uber', icon: '🚗', url: 'uber://', v: 1, t: '#e9f8ff' },
  { id: 'lyft', name: 'Lyft', icon: '🚕', url: 'lyft://', v: 1, t: '#ff3ad8' },
  { id: 'waze', name: 'Waze', icon: '🧭', url: 'waze://', v: 1, t: '#22f3ff' },
  { id: 'instacart', name: 'Shopper', icon: '🥕', url: 'https://shoppers.instacart.com/', v: 0, t: '#7cff6b' },
];

export function initHub(nova) {
  // ---- dock -> sheets
  const TITLES = { apps: 'APPS', notes: 'NOTES', agenda: 'AGENDA' };
  document.querySelectorAll('#dock [data-open]').forEach((b) => b.addEventListener('click', () => {
    const n = b.dataset.open; nova.openSheet(n, TITLES[n]);
    if (n === 'apps') renderApps(); if (n === 'notes') renderNotes(); if (n === 'agenda') renderAgenda();
    nova.act('nod');
  }));

  // ================= APPS =================
  let custom = load('nova.apps', []);
  const grid = $('#appGrid');
  function renderApps() {
    const all = [...BUILTIN_APPS, ...custom.map((c) => ({ ...c, custom: 1 }))];
    grid.innerHTML = all.map((a) => `<button class="tile" data-id="${esc(a.id)}" style="--t:${esc(a.t || 'var(--c)')}">
      <span class="ic">${esc(a.icon || a.name[0].toUpperCase())}</span><span class="nm">${esc(a.name)}</span>
      <span class="vf">${a.custom ? '★' : a.v ? '●' : '◌'}</span>${a.custom ? '<span class="del" data-del="1">✕</span>' : ''}</button>`).join('');
  }
  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile'); if (!tile) return;
    const id = tile.dataset.id;
    if (e.target.dataset.del || grid.classList.contains('editing')) {
      if (custom.some((c) => c.id === id) && confirm('Remove this launcher?')) { custom = custom.filter((c) => c.id !== id); save('nova.apps', custom); renderApps(); }
      return;
    }
    const a = BUILTIN_APPS.find((x) => x.id === id) || custom.find((x) => x.id === id);
    if (a) launch(a);
  });
  function launch(a) {
    let url = a.url;
    if (a.ask) { const v = prompt(a.ask, ''); if (v == null) return; const clean = a.id === 'phone' ? v.replace(/[^\d+*#,;]/g, '') : v.trim(); if (!clean) return; url += clean; }
    nova.say(`Opening ${a.name}!`, { speak: false }); nova.act('wave');
    window.__lastLaunch = url;
    setTimeout(() => {
      if (/^https?:/i.test(url)) {
        // In a Home-Screen web app, window.open hands the link to Safari (or the app via universal link).
        const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
      } else {
        let left = false; const onHide = () => (left = true);
        document.addEventListener('visibilitychange', onHide, { once: true });
        (window.__navigate || ((u) => (location.href = u)))(url);
        setTimeout(() => { document.removeEventListener('visibilitychange', onHide); if (!left && !document.hidden) nova.toast(`If ${a.name} didn’t open, it may not be installed (or iOS blocked the link).`, 4); }, 2200);
      }
    }, 350);
  }
  $('#appAddToggle').onclick = () => { const f = $('#appForm'); f.hidden = !f.hidden; if (!f.hidden) $('#appName').focus(); };
  $('#appEdit').onclick = (e) => { grid.classList.toggle('editing'); e.target.textContent = grid.classList.contains('editing') ? 'Done' : 'Edit'; };
  $('#appForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('#appName').value.trim(); let url = $('#appUrl').value.trim(); const icon = $('#appIcon').value.trim();
    if (!name || !url) return;
    if (/^javascript:/i.test(url)) { nova.toast('That kind of link isn’t allowed.'); return; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url; // bare domain
    custom.push({ id: 'c_' + uid(), name, url, icon }); save('nova.apps', custom);
    e.target.reset(); e.target.hidden = true; renderApps(); nova.say(`Added ${name}!`, { speak: false }); nova.act('jump');
  };

  // ================= NOTES =================
  let notes = load('nova.notes', []);
  const fmt = (ts) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function renderNotes() {
    $('#noteList').innerHTML = notes.length ? notes.map((n) => `<li data-id="${n.id}"><div class="tx">${esc(n.text)}<span class="meta">${fmt(n.ts)}</span></div>
      <div class="acts"><button data-a="share" aria-label="Share">⤴︎</button><button data-a="del" aria-label="Delete">🗑</button></div></li>`).join('')
      : '<li class="empty">No notes yet — type or dictate one above.</li>';
  }
  $('#noteSave').onclick = () => {
    const ta = $('#noteText'); const text = ta.value.trim(); if (!text) { nova.toast('Write or dictate something first.'); return; }
    stopDictation(); notes.unshift({ id: uid(), text, ts: Date.now() }); save('nova.notes', notes); ta.value = ''; renderNotes();
    nova.say('Got it, note saved!'); nova.act('nod');
  };
  $('#noteList').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const id = b.closest('li').dataset.id; const n = notes.find((x) => x.id === id); if (!n) return;
    if (b.dataset.a === 'del') { if (confirm('Delete this note?')) { notes = notes.filter((x) => x.id !== id); save('nova.notes', notes); renderNotes(); } }
    if (b.dataset.a === 'share') shareText(n.text, 'Note from Nova');
  });
  $('#noteShareAll').onclick = () => { if (!notes.length) return nova.toast('No notes to share yet.'); shareText(notes.map((n) => `• ${n.text}  (${fmt(n.ts)})`).join('\n\n'), 'My Nova notes'); };
  async function shareText(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (err) { if (err?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); nova.toast('Copied to clipboard.'); } catch { nova.toast('Sharing isn’t available here.'); }
  }

  // ---- dictation
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, baseText = '';
  const dictBtn = $('#dictBtn'), dictMsg = $('#dictMsg');
  if (!SR) dictMsg.textContent = 'Voice dictation isn’t available in this browser. Tap the text box and use the 🎤 key on your iPhone keyboard instead.';
  else if (isIOS && standalone) dictMsg.textContent = 'Tip: if Dictate doesn’t respond in Home-Screen mode, open Nova in Safari, or use the 🎤 key on your keyboard.';
  function stopDictation() { if (rec) { try { rec.stop(); } catch {} } }
  dictBtn.onclick = () => {
    if (!SR) { $('#noteText').focus(); nova.toast('Use the 🎤 key on your keyboard to dictate.', 4); return; }
    if (rec) { stopDictation(); return; }
    rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.continuous = true; rec.interimResults = true;
    const ta = $('#noteText'); baseText = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
    rec.onstart = () => { nova.listening = true; dictBtn.textContent = '■ Stop'; dictBtn.classList.add('live'); nova.say('I’m listening…', { speak: false, secs: 2 }); };
    rec.onresult = (ev) => {
      let fin = '', interim = '';
      for (let i = 0; i < ev.results.length; i++) { const r = ev.results[i]; (r.isFinal ? (fin += r[0].transcript) : (interim += r[0].transcript)); }
      ta.value = baseText + fin + interim;
    };
    rec.onerror = (ev) => {
      const m = { 'not-allowed': 'Microphone or speech access was denied. Enable it in Settings › Safari, or use the keyboard 🎤.', 'service-not-allowed': 'Speech recognition isn’t allowed here. Use the keyboard 🎤 instead.', 'no-speech': 'I didn’t hear anything — try again.', 'audio-capture': 'No microphone found.' }[ev.error];
      nova.toast(m || `Dictation stopped (${ev.error}).`, 4);
    };
    rec.onend = () => { nova.listening = false; rec = null; dictBtn.textContent = '🎤 Dictate'; dictBtn.classList.remove('live'); };
    try { rec.start(); } catch (err) { rec = null; nova.toast('Couldn’t start dictation — use the keyboard 🎤.'); }
  };

  // ================= AGENDA =================
  let events = load('nova.events', []);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const when = (ev) => new Date(`${ev.date}T${ev.time}`);
  const timeStr = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayStr = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  function initForm() { const d = new Date(Date.now() + 3600e3); $('#evDate').value = ymd(new Date()); $('#evTime').value = `${pad(d.getHours())}:00`; }
  initForm();
  const sorted = () => [...events].sort((a, b) => when(a) - when(b));
  function li(ev, showDay) {
    const d = when(ev); const past = d < Date.now();
    return `<li data-id="${ev.id}" style="${past ? 'opacity:.5' : ''}"><div class="tx">${esc(ev.title)}<span class="meta">${showDay ? dayStr(d) + ' · ' : ''}${timeStr(d)}${ev.remind >= 0 ? ` · 🔔 ${ev.remind ? ev.remind + 'm before' : 'at time'}` : ''}</span></div>
      <div class="acts"><button data-a="ics" aria-label="Add to Calendar">📆</button><button data-a="del" aria-label="Delete">🗑</button></div></li>`;
  }
  function renderAgenda() {
    const today = ymd(new Date()), now = Date.now();
    const s = sorted();
    const t = s.filter((e) => e.date === today), u = s.filter((e) => e.date > today);
    $('#evToday').innerHTML = t.length ? t.map((e) => li(e, false)).join('') : '<li class="empty">Nothing today.</li>';
    $('#evUpcoming').innerHTML = u.length ? u.map((e) => li(e, true)).join('') : '<li class="empty">No upcoming items.</li>';
    // drop items older than 7 days
    const before = events.length; events = events.filter((e) => when(e) > now - 7 * 864e5); if (events.length !== before) save('nova.events', events);
  }
  $('#evForm').onsubmit = (e) => {
    e.preventDefault();
    const ev = { id: uid(), title: $('#evTitle').value.trim(), date: $('#evDate').value, time: $('#evTime').value, remind: +$('#evRemind').value, fired: false };
    if (!ev.title || !ev.date || !ev.time) return;
    events.push(ev); save('nova.events', events); $('#evTitle').value = ''; renderAgenda();
    const d = when(ev); nova.say(`Added ${ev.title}, ${ev.date === ymd(new Date()) ? 'today' : dayStr(d)} at ${timeStr(d)}.`); nova.act('nod');
  };
  const listClick = (e) => {
    const b = e.target.closest('button'); if (!b) return; const id = b.closest('li').dataset.id; const ev = events.find((x) => x.id === id); if (!ev) return;
    if (b.dataset.a === 'del') { if (confirm('Delete this item?')) { events = events.filter((x) => x.id !== id); save('nova.events', events); renderAgenda(); } }
    if (b.dataset.a === 'ics') exportICS(ev);
  };
  $('#evToday').addEventListener('click', listClick); $('#evUpcoming').addEventListener('click', listClick);

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function icsDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
  function utcStamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function buildICS(ev) {
    const s = when(ev), e = new Date(+s + 3600e3);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nova Neon Avatar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${ev.id}@nova-avatar`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(e)}`, `SUMMARY:${icsEscape(ev.title)}`];
    if (ev.remind >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(ev.title)}`, `TRIGGER:-PT${ev.remind}M`, 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR'); return lines.join('\r\n') + '\r\n';
  }
  async function exportICS(ev) {
    const text = buildICS(ev); window.__lastICS = text;
    const name = (ev.title.replace(/[^\w\- ]+/g, '').trim() || 'event') + '.ics';
    const blob = new Blob([text], { type: 'text/calendar' });
    // iOS: opening a text/calendar resource shows the "Add to Calendar" sheet. Share sheet is the fallback.
    if (isIOS) {
      const file = new File([blob], name, { type: 'text/calendar' });
      if (standalone && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: ev.title }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      location.href = URL.createObjectURL(blob); return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    nova.toast('Calendar file downloaded — open it to add the event.');
  }

  function nextEvent() { const now = Date.now(); return sorted().find((e) => when(e) > now); }
  function describeNext() {
    const n = nextEvent(); if (!n) return 'Your agenda is clear. Nothing coming up!';
    const d = when(n); const isToday = n.date === ymd(new Date());
    const mins = Math.round((d - Date.now()) / 60000);
    const rel = mins < 60 ? `in ${mins} minute${mins === 1 ? '' : 's'}` : isToday ? `today at ${timeStr(d)}` : `${dayStr(d)} at ${timeStr(d)}`;
    return `Next up: ${n.title}, ${rel}.`;
  }
  $('#evNext').onclick = () => { nova.say(describeNext()); nova.act('nod'); };

  // in-page reminders (only while app is open)
  const notifBtn = $('#notifBtn');
  if ('Notification' in window && Notification.permission === 'default') notifBtn.hidden = false;
  notifBtn.onclick = async () => { try { const r = await Notification.requestPermission(); notifBtn.hidden = true; nova.toast(r === 'granted' ? 'Alerts on (only while Nova is open).' : 'Alerts not allowed — Nova will still pop up reminders on screen.'); } catch {} };
  async function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) reg.showNotification(title, { body, icon: 'icons/icon-180.png', tag: title }); else new Notification(title, { body }); } catch {}
  }
  function checkReminders() {
    const now = Date.now(); let changed = false;
    for (const ev of events) {
      if (ev.fired || ev.remind < 0) continue;
      const at = +when(ev) - ev.remind * 60000;
      if (now >= at && now - at < 15 * 60000) {
        ev.fired = true; changed = true;
        const msg = ev.remind ? `Reminder: ${ev.title} in ${ev.remind} minutes.` : `It’s time: ${ev.title}!`;
        nova.say(msg, { secs: 6 }); nova.act('jump'); navigator.vibrate?.([120, 60, 120]); notify('Nova reminder', msg); nova.toast('⏰ ' + msg, 6);
      } else if (now - at >= 15 * 60000) { ev.fired = true; changed = true; }
    }
    if (changed) save('nova.events', events);
  }
  setInterval(checkReminders, 15000); document.addEventListener('visibilitychange', () => !document.hidden && checkReminders());

  // greeting
  setTimeout(() => {
    const h = new Date().getHours(); const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const n = nextEvent(); nova.say(n ? `${hi}! ${describeNext()}` : `${hi}! I’m Nova. Tap me!`, { speak: false }); nova.act('wave'); checkReminders();
  }, 1200);

  window.__hub = { buildICS, describeNext, get events() { return events; }, get notes() { return notes; }, get custom() { return custom; }, renderApps, checkReminders, SR: !!SR };
}
