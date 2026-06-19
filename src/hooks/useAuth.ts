import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = { user: User | null; loading: boolean };

export type UseAuthResult = AuthState & {
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Bu e-posta zaten kayıtlı.";
  }
  if (lower.includes("invalid login")) {
    return "E-posta veya parola hatalı.";
  }
  if (lower.includes("database error")) {
    return "Bu kullanıcı adı alınmış olabilir. Farklı bir kullanıcı adı dene.";
  }
  if (lower.includes("password")) {
    return "Parola en az 6 karakter olmalı.";
  }
  if (lower.includes("email")) {
    return "Geçerli bir e-posta gir.";
  }
  return message;
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    if (!supabase) {
      setState({ user: null, loading: false });
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      setState({ user: data.session?.user ?? null, loading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string): Promise<{ error: string | null }> => {
      if (!supabase) {
        return { error: "Hesap servisi yapılandırılmamış." };
      }

      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 20) {
        return { error: "Kullanıcı adı 3-20 karakter olmalı." };
      }

      // Profil, auth.users üzerindeki trigger ile kullanıcı adından oluşturulur
      // (bkz. kurulum SQL'i). Böylece kullanıcı adı çakışmasında kayıt atomik olarak başarısız olur.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: trimmed } },
      });

      if (error) {
        return { error: mapAuthError(error.message) };
      }
      if (!data.session) {
        return { error: "Hesabını doğrulamak için e-postana gelen bağlantıya tıkla." };
      }
      return { error: null };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      if (!supabase) {
        return { error: "Hesap servisi yapılandırılmamış." };
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? mapAuthError(error.message) : null };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  }, []);

  return { ...state, signUp, signIn, signOut };
}
