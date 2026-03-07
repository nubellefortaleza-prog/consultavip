import { useEffect, useState } from "react";

export default function AuthCallback() {
  const [message, setMessage] = useState("Concluindo autenticação...");

  useEffect(() => {
    const finishLogin = async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken =
          hashParams.get("access_token") ||
          queryParams.get("access_token") ||
          queryParams.get("token");

        if (!accessToken) {
          setMessage("Não foi possível obter o token de login do Supabase.");
          return;
        }

        const response = await fetch("/api/auth/supabase/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          setMessage(`Falha ao criar sessão no servidor. ${detail}`);
          return;
        }

        window.location.href = "/";
      } catch (error: any) {
        setMessage(error?.message || "Falha ao concluir autenticação.");
      }
    };

    finishLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2] px-6">
      <div className="max-w-md w-full rounded-xl border border-[#E7DBC8] bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-[#1A1A1B] mb-2">Autenticação</h1>
        <p className="text-sm text-[#4A4A4A]">{message}</p>
      </div>
    </div>
  );
}
