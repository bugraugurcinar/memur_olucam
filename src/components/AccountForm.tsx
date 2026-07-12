import { useState, type FormEvent } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import type { UseAuthResult } from "../hooks/useAuth";

export function AccountForm({ auth }: { auth: UseAuthResult }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result =
      mode === "login"
        ? await auth.signIn(email.trim(), password)
        : await auth.signUp(email.trim(), password, username);
    if (result.error) {
      setFormError(result.error);
    }
    setSubmitting(false);
  };

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      {!isSupabaseConfigured ? (
        <p className="account-form__error">Hesap servisi yapılandırılmamış.</p>
      ) : null}
      {mode === "register" ? (
        <label>
          <span>Kullanıcı adı</span>
          <input
            autoComplete="username"
            maxLength={20}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </label>
      ) : null}
      <label>
        <span>E-posta</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>Parola</span>
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {formError ? <p className="account-form__error">{formError}</p> : null}
      <button className="quiz-launch-button" disabled={submitting || !isSupabaseConfigured} type="submit">
        {submitting ? "Lütfen bekle…" : mode === "login" ? "Giriş yap" : "Kayıt ol"}
      </button>
      <button
        className="account-form__toggle"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setFormError(null);
        }}
        type="button"
      >
        {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
      </button>
    </form>
  );
}
