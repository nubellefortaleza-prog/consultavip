import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function Particle({ style }: { style: React.CSSProperties }) {
  return <div style={style} />;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 18 }, (_, i) => {
      const size = Math.random() * 3 + 1;
      const x = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = Math.random() * 10 + 12;
      const opacity = Math.random() * 0.35 + 0.08;
      return {
        position: "absolute" as const,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        left: `${x}%`,
        bottom: "-10px",
        backgroundColor: i % 2 === 0 ? "#ffffff" : "#e0d8d0",
        opacity,
        animation: `floatUp ${duration}s ${delay}s ease-in infinite`,
        pointerEvents: "none" as const,
      };
    });
    setParticles(generated);
  }, []);

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
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.5; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.15; }
          33%       { transform: scale(1.15) translate(20px, -30px); opacity: 0.25; }
          66%       { transform: scale(0.9) translate(-15px, 20px); opacity: 0.12; }
        }
        @keyframes orbPulse2 {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.12; }
          33%       { transform: scale(0.85) translate(-25px, 15px); opacity: 0.22; }
          66%       { transform: scale(1.2) translate(10px, -20px); opacity: 0.1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: fadeSlideUp 0.7s ease forwards;
        }
        .login-input:focus {
          border-color: #1A1A1B !important;
          box-shadow: 0 0 0 3px rgba(26,26,27,0.1) !important;
        }
        .login-btn:hover:not(:disabled) {
          background: #2d2d2f !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      {/* Background */}
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0d0d0e 0%, #1A1A1B 40%, #111213 70%, #0a0c0b 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        {/* Glowing orb 1 */}
        <div style={{
          position: "absolute", width: "520px", height: "520px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
          top: "-100px", right: "-100px",
          animation: "orbPulse 14s ease-in-out infinite", pointerEvents: "none",
        }} />
        {/* Glowing orb 2 */}
        <div style={{
          position: "absolute", width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
          bottom: "-80px", left: "-80px",
          animation: "orbPulse2 18s ease-in-out infinite", pointerEvents: "none",
        }} />
        {/* Glowing orb 3 */}
        <div style={{
          position: "absolute", width: "250px", height: "250px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
          top: "50%", left: "15%",
          animation: "orbPulse 20s ease-in-out infinite reverse", pointerEvents: "none",
        }} />

        {/* Floating particles */}
        {particles.map((style, i) => (
          <Particle key={i} style={style} />
        ))}

        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px", pointerEvents: "none",
        }} />

        {/* Card wrapper */}
        <div
          className="login-card"
          style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 10 }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <img
              src="/logo-vip.png"
              alt="VIP Estetic"
              style={{
                width: "280px",
                maxWidth: "82vw",
                display: "block",
                margin: "0 auto 14px",
                filter: "drop-shadow(0 2px 16px rgba(255,255,255,0.12)) brightness(1.05)",
              }}
            />
            <p style={{
              color: "rgba(255,255,255,0.55)",
              margin: 0,
              fontSize: "11px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "Georgia, serif",
            }}>
              Vip Estetic
            </p>
          </div>

          {/* Form card */}
          <div style={{
            background: "rgba(249,247,242,0.97)",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.55), 0 4px 20px rgba(255,255,255,0.04)",
            backdropFilter: "blur(10px)",
          }}>
            <form onSubmit={handleSubmit} style={{ padding: "36px 32px" }}>
              {/* Email */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block", fontSize: "11px", fontWeight: "700",
                  color: "#1A1A1B", letterSpacing: "1.5px",
                  textTransform: "uppercase", marginBottom: "8px",
                }}>
                  E-mail
                </label>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  style={{
                    width: "100%", padding: "13px 16px",
                    border: "1.5px solid #ddd5c8", borderRadius: "10px",
                    fontSize: "14px", color: "#1A1A1B", backgroundColor: "white",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: "32px" }}>
                <label style={{
                  display: "block", fontSize: "11px", fontWeight: "700",
                  color: "#1A1A1B", letterSpacing: "1.5px",
                  textTransform: "uppercase", marginBottom: "8px",
                }}>
                  Senha
                </label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "13px 16px",
                    border: "1.5px solid #ddd5c8", borderRadius: "10px",
                    fontSize: "14px", color: "#1A1A1B", backgroundColor: "white",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              </div>

              {/* Button */}
              <button
                type="submit"
                className="login-btn"
                disabled={loginMutation.isPending}
                style={{
                  width: "100%", padding: "15px",
                  background: loginMutation.isPending ? "#9a9a9a" : "#1A1A1B",
                  color: "#ffffff",
                  border: "none", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "700",
                  letterSpacing: "3px", textTransform: "uppercase",
                  cursor: loginMutation.isPending ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: loginMutation.isPending ? "none" : "0 4px 15px rgba(0,0,0,0.35)",
                }}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.2)",
            fontSize: "10px", letterSpacing: "1px",
            marginTop: "22px",
          }}>
            © {new Date().getFullYear()} VIP ESTETIC · Sistema Exclusivo
          </p>
        </div>
      </div>
    </>
  );
}
