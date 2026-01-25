// src/supabase.js
// Supabase 클라이언트 (채팅 히스토리 200개/48시간 보관용)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const isSupabaseConfigured = () => !!supabaseUrl && !!supabaseAnonKey;

let supabase = null;

if (isSupabaseConfigured()) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    'Supabase 환경변수(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)가 없습니다. ' +
    '채팅 히스토리는 Ably만 사용하며, 200개/48시간 유지가 되지 않을 수 있습니다.'
  );
}

export { supabase, isSupabaseConfigured };
