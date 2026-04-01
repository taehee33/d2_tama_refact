"use strict";

const { createClient } = require("@supabase/supabase-js");

let cachedClient = null;

function getSupabaseAdmin() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase 서버 환경변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해 주세요."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

module.exports = {
  getSupabaseAdmin,
};
