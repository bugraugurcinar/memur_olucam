import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase yapılandırılmış mı? Env değişkenleri eksikse uygulama yine de
 * anonim (bulutsuz) çalışır; oyunlaştırma panelleri "Giriş yap" durumuna düşer.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Yapılandırma yoksa `null`. Import anında throw etmiyoruz; tüketici hook'lar
 * `if (!supabase)` ile sessizce bellekte / devre dışı moda düşer.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
