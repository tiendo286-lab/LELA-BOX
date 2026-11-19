// Chọn nơi lưu dữ liệu: 'local' = chạy thử trong trình duyệt (khách giả); 'supabase' = máy chủ thật.
// Mặc định: web trên GitHub Pages (*.github.io) dùng máy chủ thật; mở trên máy (chay_thu.command, bài thử) dùng bản chạy thử.
// Ép chọn bằng ?store=local hoặc ?store=supabase trên địa chỉ.
// anonKey là khoá công khai của Supabase (được phép để trong web). KHÔNG bao giờ để khoá service_role / sb_secret ở đây.
const loc = globalThis.location || { hostname: '', search: '' };
const ep = (loc.search.match(/[?&]store=(local|supabase)\b/) || [])[1];
export default {
  store: ep || (/\.github\.io$/.test(loc.hostname) ? 'supabase' : 'local'),
  supabaseUrl: 'https://twavnihbqzggvqrftfzj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3YXZuaWhicXpnZ3ZxcmZ0ZnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNjc0NDAsImV4cCI6MjExMDY0MzQ0MH0.OWBzlSfLAdb8SUzsXWhzH2nSoNB_n4PWiLCWkOnpEec',
};
