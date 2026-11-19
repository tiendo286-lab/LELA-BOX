// Chọn nơi lưu dữ liệu: 'local' = chạy thử trong trình duyệt; 'supabase' = máy chủ thật.
// anonKey là khoá công khai của Supabase (được phép để trong web). KHÔNG bao giờ để khoá service_role / sb_secret ở đây.
export default { store: 'local', supabaseUrl: '', anonKey: '' };
