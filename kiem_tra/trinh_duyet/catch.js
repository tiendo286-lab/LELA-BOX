window.__ERR = [];
window.addEventListener('error', (e) => window.__ERR.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => window.__ERR.push('reject: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
const __ce = console.error;
console.error = (...a) => { window.__ERR.push('console: ' + a.map((x) => (x && x.stack) || String(x)).join(' ')); __ce(...a); };
window.alert = (m) => window.__ERR.push('alert: ' + m);
window.confirm = () => true;
