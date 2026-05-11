"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (username === "kurtalaz@gmail.com" && password === "Uyuyanbulbul17") {
      sessionStorage.setItem("auth", "1");
      router.push("/dashboard");
    } else {
      setError("Kullanıcı adı veya şifre hatalı.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <img src="/kurtlogo.png" alt="Logo" className="h-24 w-auto mb-4 invert" />
          <h1 className="text-white text-2xl font-semibold tracking-tight">Giriş Yap</h1>
          <p className="text-white/40 text-sm mt-1">Finans Takip Paneli</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs uppercase tracking-wider">E-posta</label>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ornek@mail.com"
              autoComplete="username"
              required
              className="bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs uppercase tracking-wider">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 active:bg-white/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Yükleniyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
