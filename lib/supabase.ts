import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-key";

// Client dùng cho Browser (client-side)
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

// Client dùng cho Server (service role quyền cao nhất)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
