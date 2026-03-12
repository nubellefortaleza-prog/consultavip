import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1A1A1B",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#F9F7F2",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#1A1A1B",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              color: "#F2D9C2",
              margin: 0,
              fontSize: "28px",
              letterSpacing: "4px",
              fontFamily: "Georgia, serif",
              fontWeight: "normal",
            }}
          >
            VIP ESTETIC
          </h1>
          <p
            style={{
              color: "#AABAA4",
              margin: "8px 0 0",
              fontSize: "12px",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Consulta VIP
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "32px 24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "#1A1A1B",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #F2D9C2",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1A1A1B",
                backgroundColor: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "28px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "#1A1A1B",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #F2D9C2",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1A1A1B",
                backgroundColor: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: loginMutation.isPending ? "#AABAA4" : "#1A1A1B",
              color: "#F2D9C2",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
