import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Mic, Square, Pause, Play, Loader2, CheckCircle2, RotateCcw, Clock, LogOut,
  History, FileText, CloudUpload, BarChart2, Users, Settings, Shield,
  Bell, Database, X, NotebookPen, ChevronRight, Zap,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663032644247/XjbcOchGTMROPEqF.png";

type AppStep = "info" | "record" | "notes";

type ReportData = {
  patientName: string;
  consultationDate: string;
  patientProfile: string;
  mainComplaints: string;
  treatmentPlan: string;
  budgetPresented: string;
  closedDeal: string;
  additionalNotes: string;
};

const REPORT_LABELS: Record<keyof ReportData, string> = {
  patientName: "NOME DO PACIENTE",
  consultationDate: "DATA E HORÁRIO",
  patientProfile: "PERFIL DO PACIENTE",
  mainComplaints: "QUEIXAS PRINCIPAIS",
  treatmentPlan: "PLANO DE TRATAMENTO INDICADO",
  budgetPresented: "ORÇAMENTO APRESENTADO",
  closedDeal: "O QUE FOI FECHADO",
  additionalNotes: "OBSERVAÇÕES ADICIONAIS",
};

const FIELD_ORDER: (keyof ReportData)[] = [
  "patientName", "consultationDate", "patientProfile", "mainComplaints",
  "treatmentPlan", "budgetPresented", "closedDeal", "additionalNotes",
];

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const recorder = useAudioRecorder();
  const [step, setStep] = useState<AppStep>("info");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const bgProcessingRef = useRef(false);
  const waitingForBlobRef = useRef(false);

  const uploadMutation = trpc.consultation.uploadAudio.useMutation();
  const transcribeMutation = trpc.consultation.transcribe.useMutation();
  const generateReportMutation = trpc.consultation.generateReport.useMutation();
  const sendEmailMutation = trpc.consultation.sendEmail.useMutation();
  const historyQuery = trpc.consultation.list.useQuery(undefined, { enabled: isAuthenticated && showHistory });
  const [showServerInfo, setShowServerInfo] = useState(false);
  const serverInfoQuery = trpc.consultation.serverInfo.useQuery(undefined, { enabled: showServerInfo });

  const handleStartRecording = useCallback(async () => {
    try { await recorder.startRecording(); } catch (err: any) { toast.error(err.message || "Erro ao iniciar gravação"); }
  }, [recorder]);

  const handleStopRecording = useCallback(() => {
    waitingForBlobRef.current = true;
    recorder.stopRecording();
  }, [recorder]);

  // When blob is ready after stop → go to notes step
  useEffect(() => {
    if (waitingForBlobRef.current && recorder.audioBlob && recorder.state === "stopped" && step === "record") {
      waitingForBlobRef.current = false;
      setStep("notes");
    }
  }, [recorder.audioBlob, recorder.state, step]);

  const handleFinishAndSend = useCallback(() => {
    const blob = recorder.audioBlob;
    if (!blob) { toast.error("Nenhum áudio encontrado."); return; }

    const capturedNotes = notes;
    const capturedName = patientName;
    const capturedPhone = patientPhone;

    // Reset UI immediately → doctor goes back to initial screen
    setStep("info");
    setPatientName("");
    setPatientPhone("");
    setNotes("");
    recorder.reset();

    if (bgProcessingRef.current) return;
    bgProcessingRef.current = true;

    (async () => {
      const toastId = toast.loading("Enviando áudio...");
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => { const r = reader.result as string; resolve(r.split(",")[1] || r); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const uploadResult = await uploadMutation.mutateAsync({
          audioBase64: base64,
          mimeType: blob.type || "audio/webm",
          patientName: capturedName,
          patientPhone: capturedPhone,
        });

        toast.loading("Transcrevendo consulta com IA...", { id: toastId });
        const transcribeResult = await transcribeMutation.mutateAsync({
          consultationId: uploadResult.consultationId,
          audioUrl: uploadResult.audioUrl,
        });

        toast.loading("Gerando relatório com IA...", { id: toastId });
        const reportResult = await generateReportMutation.mutateAsync({
          consultationId: uploadResult.consultationId,
          transcription: transcribeResult.text,
        });

        toast.loading("Enviando por e-mail...", { id: toastId });
        await sendEmailMutation.mutateAsync({
          consultationId: uploadResult.consultationId,
          patientName: reportResult.patientName || capturedName,
          consultationDate: reportResult.consultationDate || "",
          patientProfile: reportResult.patientProfile || "",
          mainComplaints: reportResult.mainComplaints || "",
          treatmentPlan: reportResult.treatmentPlan || "",
          budgetPresented: reportResult.budgetPresented || "",
          closedDeal: reportResult.closedDeal || "",
          additionalNotes: capturedNotes
            ? (reportResult.additionalNotes && reportResult.additionalNotes !== "Não mencionado"
                ? `${reportResult.additionalNotes}\n\nAnotações do Dr.: ${capturedNotes}`
                : capturedNotes)
            : (reportResult.additionalNotes || ""),
        });

        toast.success(`Relatório de ${capturedName} enviado por e-mail!`, { id: toastId });
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar consulta", { id: toastId });
      } finally {
        bgProcessingRef.current = false;
      }
    })();
  }, [recorder, notes, patientName, patientPhone, uploadMutation, transcribeMutation, generateReportMutation, sendEmailMutation]);

  const handleCancelNotes = useCallback(() => {
    setNotes("");
    setStep("record");
    recorder.reset();
    setStep("info");
  }, [recorder]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-vip-pearl)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-vip-blush)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-vip-pearl)]">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-vip-silk)] flex items-center justify-center">
                <Mic className="w-8 h-8 text-[var(--color-vip-noir)]" />
              </div>
              <h2 className="text-2xl font-semibold mb-3 text-[var(--color-vip-noir)]">ConsultaVip</h2>
              <p className="text-sm text-[var(--color-vip-noir)]/60 mb-6 font-sans">Grave, transcreva e gere relatórios de consultas automaticamente com inteligência artificial.</p>
              <Button onClick={() => (window.location.href = getLoginUrl())} className="w-full bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg">Entrar no ConsultaVip</Button>
            </CardContent>
          </Card>
        </main>
        <AppFooter />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-vip-pearl)]">
      <AppHeader
        user={user}
        onLogout={logout}
        onToggleHistory={() => { setShowHistory(!showHistory); setShowAdmin(false); }}
        showHistory={showHistory}
        isAdmin={isAdmin}
        onToggleAdmin={() => { setShowAdmin(!showAdmin); setShowHistory(false); }}
        showAdmin={showAdmin}
      />
      <main className="flex-1 container py-6 md:py-10">
        {showAdmin && isAdmin ? (
          <AdminView onBack={() => setShowAdmin(false)} />
        ) : showHistory ? (
          <HistoryView
            consultations={historyQuery.data || []}
            loading={historyQuery.isLoading}
            onBack={() => setShowHistory(false)}
            onRefresh={() => historyQuery.refetch()}
            showServerInfo={showServerInfo}
            onToggleServerInfo={() => setShowServerInfo(v => !v)}
            serverInfo={serverInfoQuery.data}
            serverInfoLoading={serverInfoQuery.isLoading}
          />
        ) : (
          <div className="max-w-2xl mx-auto">
            <StepIndicator currentStep={step} />

            {step === "info" && (
              <PatientInfoCard
                patientName={patientName}
                patientPhone={patientPhone}
                onPatientNameChange={setPatientName}
                onPatientPhoneChange={setPatientPhone}
                onConfirm={() => setStep("record")}
              />
            )}

            {step === "record" && (
              <RecordingCard
                recorderState={recorder.state}
                formattedDuration={recorder.formattedDuration}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onPause={recorder.pauseRecording}
                onResume={recorder.resumeRecording}
              />
            )}

            {step === "notes" && (
              <NotesCard
                notes={notes}
                onNotesChange={setNotes}
                onFinish={handleFinishAndSend}
                onCancel={handleCancelNotes}
              />
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

function AppHeader({
  user, onLogout, onToggleHistory, showHistory, isAdmin, onToggleAdmin, showAdmin,
}: {
  user?: any; onLogout?: () => void; onToggleHistory?: () => void; showHistory?: boolean;
  isAdmin?: boolean; onToggleAdmin?: () => void; showAdmin?: boolean;
}) {
  return (
    <header className="bg-white/70 backdrop-blur-md border-b border-[var(--color-vip-silk)]/50 sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16 md:h-20">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Vip Estetic" className="h-8 md:h-10 w-auto" />
          <div className="hidden sm:block h-6 w-px bg-[var(--color-vip-silk)]" />
          <span className="hidden sm:block text-xs font-sans font-medium text-[var(--color-vip-noir)]/50 uppercase tracking-widest">ConsultaVip</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {isAdmin && onToggleAdmin && (
              <Button variant="ghost" size="sm" onClick={onToggleAdmin} className={`text-xs font-sans ${showAdmin ? "text-[var(--color-vip-blush)]" : "text-[var(--color-vip-noir)]/60"}`}>
                <Shield className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            {onToggleHistory && (
              <Button variant="ghost" size="sm" onClick={onToggleHistory} className={`text-xs font-sans ${showHistory ? "text-[var(--color-vip-blush)]" : "text-[var(--color-vip-noir)]/60"}`}>
                <History className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Histórico</span>
              </Button>
            )}
            <span className="text-xs text-[var(--color-vip-noir)]/50 font-sans hidden md:block">{user.name || user.email}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs text-[var(--color-vip-noir)]/40 hover:text-[var(--color-vip-noir)] font-sans">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="py-4 text-center border-t border-[var(--color-vip-silk)]/30">
      <p className="text-xs text-[var(--color-vip-noir)]/30 font-sans tracking-wide">ConsultaVip &bull; Vip Estetic &copy; {new Date().getFullYear()}</p>
    </footer>
  );
}

function StepIndicator({ currentStep }: { currentStep: AppStep }) {
  const steps = [
    { key: "info", label: "Paciente" },
    { key: "record", label: "Gravar" },
    { key: "notes", label: "Anotações" },
  ];
  const activeIndex = steps.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sans font-semibold transition-all ${i <= activeIndex ? "bg-[var(--color-vip-blush)] text-white" : "bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-noir)]/30"}`}>
            {i < activeIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-xs font-sans hidden sm:block ${i <= activeIndex ? "text-[var(--color-vip-noir)]" : "text-[var(--color-vip-noir)]/30"}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`w-8 h-px ${i < activeIndex ? "bg-[var(--color-vip-blush)]" : "bg-[var(--color-vip-silk)]"}`} />}
        </div>
      ))}
    </div>
  );
}

function PatientInfoCard({ patientName, patientPhone, onPatientNameChange, onPatientPhoneChange, onConfirm }: {
  patientName: string; patientPhone: string;
  onPatientNameChange: (v: string) => void; onPatientPhoneChange: (v: string) => void;
  onConfirm: () => void;
}) {
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (patientName.trim() && patientPhone.trim()) onConfirm(); };
  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardContent className="p-8 md:p-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-full bg-[var(--color-vip-silk)] flex items-center justify-center">
            <Mic className="w-5 h-5 text-[var(--color-vip-noir)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-vip-noir)]">Identificação da Paciente</h3>
            <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans">Preencha antes de iniciar a gravação</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">Nome da Paciente</Label>
            <Input value={patientName} onChange={e => onPatientNameChange(e.target.value)} placeholder="Ex: Maria Silva" required className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">Telefone / WhatsApp</Label>
            <Input value={patientPhone} onChange={e => onPatientPhoneChange(e.target.value)} placeholder="Ex: 85999990000" required type="tel" className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans" />
            <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">O telefone será usado como identificador da paciente</p>
          </div>
          <Button type="submit" disabled={!patientName.trim() || !patientPhone.trim()} className="w-full bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg">
            <Mic className="w-4 h-4 mr-2" />Iniciar Gravação
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecordingCard({ recorderState, formattedDuration, onStart, onStop, onPause, onResume }: {
  recorderState: string; formattedDuration: string; onStart: () => void; onStop: () => void;
  onPause: () => void; onResume: () => void;
}) {
  const isRecording = recorderState === "recording";
  const isPaused = recorderState === "paused";
  const isStopped = recorderState === "stopped";
  const isIdle = recorderState === "idle";

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardContent className="p-8 md:p-12 text-center">
        <div className="relative inline-flex items-center justify-center mb-6">
          {isRecording && <div className="absolute inset-0 rounded-full bg-[var(--color-vip-blush)]/20 animate-pulse-recording scale-150" />}
          <button
            onClick={isIdle ? onStart : isRecording ? onStop : isPaused ? onResume : onStart}
            className={`relative w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording ? "bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90"
              : isPaused ? "bg-[var(--color-vip-terracotta)] hover:bg-[var(--color-vip-terracotta)]/90"
              : isStopped ? "bg-[var(--color-vip-sage)] hover:bg-[var(--color-vip-sage)]/90"
              : "bg-[var(--color-vip-noir)] hover:bg-[var(--color-vip-noir)]/90"
            }`}
          >
            {isRecording ? <Square className="w-8 h-8 md:w-10 md:h-10 text-white" /> : isStopped ? <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-white animate-spin" /> : <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />}
          </button>
        </div>

        {(isRecording || isPaused || isStopped) && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[var(--color-vip-noir)]/40" />
            <span className="text-2xl font-mono font-semibold text-[var(--color-vip-noir)] tracking-wider">{formattedDuration}</span>
            {isRecording && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
          </div>
        )}

        {isRecording && (
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({length:12}).map((_,i) => <div key={i} className="w-1 rounded-full bg-[var(--color-vip-blush)] audio-wave-bar" style={{animationDelay:`${i*0.1}s`,height:"8px"}} />)}
          </div>
        )}

        <h3 className="text-xl md:text-2xl font-semibold text-[var(--color-vip-noir)] mb-2">
          {isIdle && "Iniciar Gravação"}
          {isRecording && "Gravando Consulta..."}
          {isPaused && "Gravação Pausada"}
          {isStopped && "Preparando..."}
        </h3>
        <p className="text-sm text-[var(--color-vip-noir)]/50 mb-6 font-sans">
          {isIdle && "Toque no microfone para começar a gravar a consulta"}
          {isRecording && "Toque no botão para parar a gravação"}
          {isPaused && "Toque para retomar ou finalize a gravação"}
          {isStopped && "Aguarde, finalizando a gravação..."}
        </p>

        <div className="flex justify-center gap-3">
          {isRecording && (
            <Button onClick={onPause} variant="outline" className="border-[var(--color-vip-silk)] text-[var(--color-vip-noir)] font-sans">
              <Pause className="w-4 h-4 mr-2" />Pausar
            </Button>
          )}
          {isPaused && (
            <>
              <Button onClick={onResume} className="bg-[var(--color-vip-terracotta)] hover:bg-[var(--color-vip-terracotta)]/90 text-white font-sans">
                <Play className="w-4 h-4 mr-2" />Retomar
              </Button>
              <Button onClick={onStop} variant="outline" className="border-[var(--color-vip-blush)] text-[var(--color-vip-blush)] font-sans">
                <Square className="w-4 h-4 mr-2" />Finalizar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NotesCard({ notes, onNotesChange, onFinish, onCancel }: {
  notes: string; onNotesChange: (v: string) => void; onFinish: () => void; onCancel: () => void;
}) {
  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardContent className="p-8 md:p-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-[var(--color-vip-silk)] flex items-center justify-center">
            <NotebookPen className="w-5 h-5 text-[var(--color-vip-noir)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-vip-noir)]">Anotações do Médico</h3>
            <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans">Gravação concluída! Adicione informações extras se desejar.</p>
          </div>
        </div>

        <div className="bg-[var(--color-vip-sage)]/10 border border-[var(--color-vip-sage)]/30 rounded-lg px-4 py-3 mb-6 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-vip-sage)] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--color-vip-noir)]/60 font-sans">
            Após clicar em <strong>Finalizar e Enviar</strong>, o processamento ocorrerá automaticamente em segundo plano. O relatório será enviado por e-mail quando concluído.
          </p>
        </div>

        <div className="mb-6">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
            Observações Adicionais (opcional)
          </Label>
          <Textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Ex: Paciente apresentou interesse em harmonização facial. Agendado retorno para próxima semana..."
            rows={6}
            className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans resize-none"
          />
          <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">Este campo é opcional. A IA irá gerar automaticamente o relatório completo da consulta.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onFinish} className="flex-1 bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg">
            <Zap className="w-4 h-4 mr-2" />Finalizar e Enviar
          </Button>
          <Button onClick={onCancel} variant="outline" className="border-[var(--color-vip-silk)] text-[var(--color-vip-noir)]/60 hover:bg-[var(--color-vip-silk)]/20 font-sans" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Admin View ────────────────────────────────────────────────────────────────

const ADMIN_STATS = [
  { label: "Total de Consultas", value: "—", icon: FileText, color: "text-[var(--color-vip-blush)]", bg: "bg-[var(--color-vip-blush)]/10" },
  { label: "Consultas Hoje", value: "—", icon: Mic, color: "text-[var(--color-vip-terracotta)]", bg: "bg-[var(--color-vip-terracotta)]/10" },
  { label: "E-mails Enviados", value: "—", icon: Bell, color: "text-[var(--color-vip-sage)]", bg: "bg-[var(--color-vip-sage)]/10" },
  { label: "Usuários Ativos", value: "—", icon: Users, color: "text-[var(--color-vip-noir)]", bg: "bg-[var(--color-vip-silk)]/50" },
];

const ADMIN_FEATURES = [
  { icon: Users, label: "Gestão de Usuários", desc: "Cadastrar, editar e remover usuários do sistema" },
  { icon: BarChart2, label: "Relatórios Avançados", desc: "Dashboard com métricas e análises de consultas" },
  { icon: Settings, label: "Configurações do Sistema", desc: "E-mail, IA, integrações e parâmetros gerais" },
  { icon: Database, label: "Backup Automático", desc: "Exportação periódica para Google Drive" },
  { icon: FileText, label: "Templates de Relatório", desc: "Personalizar o formato dos relatórios gerados pela IA" },
  { icon: CloudUpload, label: "Armazenamento em Nuvem", desc: "Gerenciar arquivos de áudio e relatórios" },
];

function AdminView({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[var(--color-vip-noir)]/60 font-sans">← Voltar</Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-vip-blush)]" />
          <h2 className="text-xl font-semibold text-[var(--color-vip-noir)]">Painel Administrativo</h2>
        </div>
      </div>

      {/* Coming soon banner */}
      <Card className="border-0 shadow-md bg-[var(--color-vip-noir)] mb-6">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-vip-blush)]/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-[var(--color-vip-blush)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-vip-silk)] mb-1">Funcionalidades em desenvolvimento</h3>
            <p className="text-xs text-[var(--color-vip-silk)]/50 font-sans leading-relaxed">
              O painel administrativo está sendo construído. Em breve você terá acesso completo à gestão de usuários, métricas de consultas, configurações avançadas e muito mais.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {ADMIN_STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-md bg-white/80">
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-[var(--color-vip-noir)]/30 mb-1">{value}</p>
              <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans">{label}</p>
              <span className="text-[10px] bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-noir)]/30 px-2 py-0.5 rounded-full font-sans mt-1 inline-block">em breve</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features list */}
      <Card className="border-0 shadow-md bg-white/80">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-[var(--color-vip-noir)] uppercase tracking-wider mb-4 font-sans">Funcionalidades Planejadas</h3>
          <div className="space-y-3">
            {ADMIN_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 py-3 border-b border-[var(--color-vip-silk)]/50 last:border-0">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-vip-silk)]/40 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[var(--color-vip-noir)]/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-vip-noir)]/70">{label}</p>
                  <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans">{desc}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] bg-[var(--color-vip-blush)]/10 text-[var(--color-vip-blush)] px-2 py-0.5 rounded-full font-sans">em breve</span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-vip-noir)]/20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── History View ──────────────────────────────────────────────────────────────

function HistoryView({ consultations, loading, onBack, showServerInfo, onToggleServerInfo, serverInfo, serverInfoLoading }: {
  consultations: any[]; loading: boolean; onBack: () => void; onRefresh?: () => void;
  showServerInfo?: boolean; onToggleServerInfo?: () => void; serverInfo?: any; serverInfoLoading?: boolean;
}) {
  const [reportConsultation, setReportConsultation] = useState<any | null>(null);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[var(--color-vip-noir)]/60 font-sans">← Voltar</Button>
        <h2 className="text-xl font-semibold text-[var(--color-vip-noir)]">Histórico de Consultas</h2>
        <button onClick={onToggleServerInfo} title="Diagnóstico do servidor" className="ml-auto text-xs text-[var(--color-vip-noir)]/30 hover:text-[var(--color-vip-noir)]/60 font-sans px-2 py-1 rounded">⚙</button>
      </div>

      {showServerInfo && (
        <Card className="border-0 shadow-md bg-white/80 mb-4">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-[var(--color-vip-noir)] mb-2 font-sans">Diagnóstico do Servidor</p>
            {serverInfoLoading ? (
              <div className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs font-sans text-[var(--color-vip-noir)]/50">Carregando...</span></div>
            ) : serverInfo ? (
              <div className="space-y-1 text-xs font-mono text-[var(--color-vip-noir)]/70">
                <p>📁 Pasta uploads: <span className="text-[var(--color-vip-noir)]">{serverInfo.uploadsDir}</span></p>
                <p>🎵 Arquivos de áudio: <span className="font-bold text-[var(--color-vip-blush)]">{serverInfo.fileCount}</span></p>
                <p>📋 Consultas no banco: <span className="font-bold text-[var(--color-vip-blush)]">{serverInfo.dbConsultationsForUser}</span></p>
                <p>🌐 APP_BASE_URL: <span className="text-[var(--color-vip-noir)]">{serverInfo.appBaseUrl}</span></p>
                <p>🤖 Gemini: <span className={serverInfo.geminiConfigured ? "text-green-600" : "text-red-500"}>{serverInfo.geminiConfigured ? "✓ configurado" : "✗ não configurado"}</span></p>
                <p>📂 cwd: <span className="text-[var(--color-vip-noir)]/50">{serverInfo.cwd}</span></p>
                {serverInfo.files.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer text-[var(--color-vip-noir)]/50">Arquivos ({serverInfo.files.length})</summary>
                    <div className="mt-1 space-y-0.5 pl-2">{serverInfo.files.map((f: string, i: number) => <p key={i} className="text-[var(--color-vip-noir)]/40">{f}</p>)}</div>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-xs font-sans text-red-500">Erro ao carregar diagnóstico</p>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-vip-blush)] mx-auto" /></div>
      ) : consultations.length === 0 ? (
        <Card className="border-0 shadow-md bg-white/80"><CardContent className="p-8 text-center"><p className="text-sm text-[var(--color-vip-noir)]/50 font-sans">Nenhuma consulta registrada ainda.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {consultations.map((c: any) => {
            const hasReport = c.patientName || c.mainComplaints;
            return (
              <Card key={c.id} className="border-0 shadow-md bg-white/80 hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[var(--color-vip-noir)] text-sm truncate">{c.patientName || "Paciente não identificado"}</h4>
                      {c.patientPhone && <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans">📞 {c.patientPhone}</p>}
                      <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans mt-0.5">{c.consultationDate || new Date(c.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.audioUrl && (
                        <a href={c.audioUrl} download title="Baixar gravação" className="p-1.5 rounded-md text-[var(--color-vip-noir)]/40 hover:text-[var(--color-vip-blush)] hover:bg-[var(--color-vip-silk)]/30 transition-colors">
                          <Mic className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {hasReport && (
                        <button
                          onClick={() => setReportConsultation(c)}
                          title="Ver relatório"
                          className="p-1.5 rounded-md text-[var(--color-vip-noir)]/40 hover:text-[var(--color-vip-blush)] hover:bg-[var(--color-vip-silk)]/30 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-sans ${c.emailSent === "yes" ? "bg-[var(--color-vip-sage)]/20 text-[var(--color-vip-sage)]" : "bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-terracotta)]"}`}>
                        {c.emailSent === "yes" ? "Enviado" : "Pendente"}
                      </span>
                    </div>
                  </div>
                  {c.mainComplaints && c.mainComplaints !== "Não mencionado" && (
                    <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans mt-2 line-clamp-2">{c.mainComplaints}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {reportConsultation && (
        <ReportModal consultation={reportConsultation} onClose={() => setReportConsultation(null)} />
      )}
    </div>
  );
}

// ─── Report Modal ──────────────────────────────────────────────────────────────

function ReportModal({ consultation: c, onClose }: { consultation: any; onClose: () => void }) {
  const fields: Array<[string, string]> = [
    ["NOME DO PACIENTE", c.patientName || "Não informado"],
    ["TELEFONE", c.patientPhone || "Não informado"],
    ["DATA E HORÁRIO", c.consultationDate || new Date(c.createdAt).toLocaleString("pt-BR")],
    ["PERFIL DO PACIENTE", c.patientProfile || "Não mencionado"],
    ["QUEIXAS PRINCIPAIS", c.mainComplaints || "Não mencionado"],
    ["PLANO DE TRATAMENTO INDICADO", c.treatmentPlan || "Não mencionado"],
    ["ORÇAMENTO APRESENTADO", c.budgetPresented || "Não mencionado"],
    ["O QUE FOI FECHADO", c.closedDeal || "Não mencionado"],
    ["OBSERVAÇÕES ADICIONAIS", c.additionalNotes || "Não mencionado"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[var(--color-vip-noir)] px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-[var(--color-vip-silk)] font-semibold tracking-widest text-sm uppercase">VIP ESTETIC</h2>
            <p className="text-[var(--color-vip-silk)]/50 text-xs font-sans tracking-wider mt-0.5">Relatório de Consulta</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-6 space-y-4">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-[var(--color-vip-silk)]/50 pb-3 last:border-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 font-sans">{label}</p>
              <p className="text-sm text-[var(--color-vip-noir)] font-sans leading-relaxed whitespace-pre-wrap">{value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-[var(--color-vip-pearl)] px-6 py-4 rounded-b-2xl flex items-center justify-between">
          <p className="text-[10px] text-[var(--color-vip-noir)]/30 font-sans uppercase tracking-wider">ConsultaVip • Vip Estetic</p>
          <span className={`text-xs px-2 py-1 rounded-full font-sans ${c.emailSent === "yes" ? "bg-[var(--color-vip-sage)]/20 text-[var(--color-vip-sage)]" : "bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-terracotta)]"}`}>
            {c.emailSent === "yes" ? "E-mail Enviado" : "E-mail Pendente"}
          </span>
        </div>
      </div>
    </div>
  );
}
