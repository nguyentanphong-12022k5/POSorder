import { createClient } from "@supabase/supabase-js";

// Polyfill native WebSocket cho môi trường Node.js (< v22 hoặc CI runner không có global WebSocket)
if (typeof globalThis.WebSocket === "undefined") {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 1;
    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;
    constructor(_url?: string, _protocols?: any) {}
    send(_data: any) {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-key";

// Client dùng cho Browser (client-side)
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

// Client dùng cho Server (service role quyền cao nhất)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
