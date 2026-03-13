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
  Bell, Database, X, NotebookPen, ChevronRight, Zap, Eye, EyeOff, Trash2,
  UserPlus, Camera, Mail,
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

const FIELD_ORDER: (keyof ReportData)[] = [
  "patientName", "consultationDate", "patientProfile", "mainComplaints",
  "treatmentPlan", "budgetPresented", "closedDeal", "additionalNotes",
];

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout, refresh: refreshAuth } = useAuth();
  const recorder = useAudioRecorder();
  const [step, setStep] = useState<AppStep>("info");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
        onOpenProfile={() => setShowProfile(true)}
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

      {showProfile && user && (
        <UserProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={() => { setShowProfile(false); refreshAuth(); }}
        />
      )}
    </div>
  );
}

// ─── Avatar helper ───────────────────────────────────────────────────────────

function UserAvatar({ user, size = "sm", onClick }: { user: any; size?: "sm" | "md"; onClick?: () => void }) {
  const initials = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const cls = size === "sm" ? "w-8 h-8 text-sm" : "w-14 h-14 text-xl";
  return (
    <button
      onClick={onClick}
      title="Meu perfil"
      className={`${cls} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-[var(--color-vip-silk)] hover:border-[var(--color-vip-blush)] transition-colors`}
    >
      {user?.profilePhoto ? (
        <img src={user.profilePhoto} alt={user.name || "avatar"} className="w-full h-full object-cover" />
      ) : (
        <span className="bg-[var(--color-vip-silk)] w-full h-full flex items-center justify-center font-semibold text-[var(--color-vip-noir)]">
          {initials}
        </span>
      )}
    </button>
  );
}

// ─── App Header ───────────────────────────────────────────────────────────────

function AppHeader({
  user, onLogout, onToggleHistory, showHistory, isAdmin, onToggleAdmin, showAdmin, onOpenProfile,
}: {
  user?: any; onLogout?: () => void; onToggleHistory?: () => void; showHistory?: boolean;
  isAdmin?: boolean; onToggleAdmin?: () => void; showAdmin?: boolean; onOpenProfile?: () => void;
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
            <UserAvatar user={user} size="sm" onClick={onOpenProfile} />
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs text-[var(--color-vip-noir)]/40 hover:text-[var(--color-vip-noir)] font-sans">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

function UserProfileModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name || "");
  const [reportEmail, setReportEmail] = useState(user?.reportEmail || "");
  const [photoPreview, setPhotoPreview] = useState<string>(user?.profilePhoto || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateProfile = trpc.user.updateProfile.useMutation();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Foto muito grande. Máximo 500KB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        name: name.trim() || undefined,
        profilePhoto: photoPreview || undefined,
        reportEmail: reportEmail.trim(),
      });
      toast.success("Perfil atualizado!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar perfil");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-vip-noir)] px-6 py-5 flex items-center justify-between">
          <h2 className="text-[var(--color-vip-silk)] font-semibold tracking-wide text-sm uppercase">Meu Perfil</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="bg-white px-6 py-6 space-y-5">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--color-vip-silk)] flex items-center justify-center bg-[var(--color-vip-silk)]">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[var(--color-vip-noir)]">
                    {(name || user?.email || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--color-vip-blush)] flex items-center justify-center shadow-md hover:bg-[var(--color-vip-blush)]/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {photoPreview && photoPreview !== user?.profilePhoto && (
              <button onClick={() => setPhotoPreview("")} className="text-xs text-[var(--color-vip-noir)]/40 hover:text-red-500 font-sans">
                Remover foto
              </button>
            )}
            <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans">Clique no ícone para alterar (máx. 500KB)</p>
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
              Nome completo
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dr. João Silva"
              className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans"
            />
          </div>

          {/* Email */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
              E-mail para receber relatórios
            </Label>
            <Input
              type="email"
              value={reportEmail}
              onChange={e => setReportEmail(e.target.value)}
              placeholder="meu@email.com (opcional)"
              className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans"
            />
            <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">
              Se preenchido, os relatórios serão enviados para este e-mail em vez do padrão.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="flex-1 bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans"
            >
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Perfil"}
            </Button>
            <Button onClick={onClose} variant="outline" className="border-[var(--color-vip-silk)] font-sans">
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
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

type AdminTab = "settings" | "users";

function AdminView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("settings");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[var(--color-vip-noir)]/60 font-sans">← Voltar</Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-vip-blush)]" />
          <h2 className="text-xl font-semibold text-[var(--color-vip-noir)]">Painel Administrativo</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-vip-silk)]/30 p-1 rounded-xl mb-6">
        {([
          { key: "settings", label: "Configurações", icon: Settings },
          { key: "users", label: "Usuários", icon: Users },
        ] as { key: AdminTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-sans font-medium transition-all ${
              activeTab === key
                ? "bg-white shadow-sm text-[var(--color-vip-noir)]"
                : "text-[var(--color-vip-noir)]/50 hover:text-[var(--color-vip-noir)]/80"
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab === "settings" && <AdminSettingsTab />}
      {activeTab === "users" && <AdminUsersTab />}
    </div>
  );
}

// ─── Admin Settings Tab ───────────────────────────────────────────────────────

function AdminSettingsTab() {
  const settingsQuery = trpc.admin.getSettings.useQuery();
  const saveMutation = trpc.admin.saveSettings.useMutation();

  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [destEmail, setDestEmail] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !loaded) {
      setSmtpUser(settingsQuery.data.smtpUser || "");
      setDestEmail(settingsQuery.data.destinationEmail || "");
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass || undefined,
        geminiApiKey: geminiKey || undefined,
        destinationEmail: destEmail.trim(),
      });
      toast.success("Configurações salvas!");
      setSmtpPass("");
      setGeminiKey("");
      settingsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  };

  if (settingsQuery.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-vip-blush)]" /></div>;
  }

  const s = settingsQuery.data;

  return (
    <div className="space-y-4">
      {/* SMTP */}
      <Card className="border-0 shadow-md bg-white/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-[var(--color-vip-blush)]" />
            <h3 className="text-sm font-semibold text-[var(--color-vip-noir)] uppercase tracking-wider font-sans">Configurações de E-mail (SMTP)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
                E-mail Gmail (remetente)
              </Label>
              <Input
                type="email"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
                placeholder="seuemail@gmail.com"
                className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
                Senha de App Gmail {s?.smtpPassSet && <span className="text-[var(--color-vip-sage)] normal-case font-normal">(configurada)</span>}
              </Label>
              <div className="relative">
                <Input
                  type={showSmtpPass ? "text" : "password"}
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  placeholder={s?.smtpPassSet ? "••••••••••••••• (deixe vazio para manter)" : "Senha de App do Gmail"}
                  className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans pr-10"
                />
                <button type="button" onClick={() => setShowSmtpPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-vip-noir)]/40">
                  {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">Use uma Senha de App gerada nas configurações de segurança do Google.</p>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
                E-mail padrão de destino dos relatórios
              </Label>
              <Input
                type="email"
                value={destEmail}
                onChange={e => setDestEmail(e.target.value)}
                placeholder="destinatario@email.com"
                className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans"
              />
              <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">Os relatórios serão enviados para este e-mail (pode ser sobrescrito por usuário).</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gemini */}
      <Card className="border-0 shadow-md bg-white/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[var(--color-vip-blush)]" />
            <h3 className="text-sm font-semibold text-[var(--color-vip-noir)] uppercase tracking-wider font-sans">Inteligência Artificial (Gemini)</h3>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">
              Chave API Gemini {s?.geminiKeySet && <span className="text-[var(--color-vip-sage)] normal-case font-normal">(configurada)</span>}
            </Label>
            <div className="relative">
              <Input
                type={showGemini ? "text" : "password"}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder={s?.geminiKeySet ? "••••••••••••••• (deixe vazio para manter)" : "AIza..."}
                className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans pr-10"
              />
              <button type="button" onClick={() => setShowGemini(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-vip-noir)]/40">
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[var(--color-vip-noir)]/40 mt-1 font-sans">Obtida em <span className="font-mono">aistudio.google.com</span>. Usada para transcrição e geração de relatórios.</p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="w-full bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans"
        size="lg"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Salvar Configurações
      </Button>
    </div>
  );
}

// ─── Admin Users Tab ──────────────────────────────────────────────────────────

function AdminUsersTab() {
  const usersQuery = trpc.admin.listUsers.useQuery();
  const deleteMutation = trpc.admin.deleteUser.useMutation();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleDelete = async (userId: number, name: string) => {
    if (!confirm(`Excluir o usuário "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ userId });
      toast.success("Usuário excluído.");
      usersQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-vip-noir)]/60 font-sans">
          {usersQuery.data?.length ?? 0} usuário(s) cadastrado(s)
        </p>
        <Button
          onClick={() => setShowCreateForm(v => !v)}
          className="bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans text-sm"
          size="sm"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          {showCreateForm ? "Cancelar" : "Novo Usuário"}
        </Button>
      </div>

      {showCreateForm && (
        <CreateUserForm onCreated={() => { setShowCreateForm(false); usersQuery.refetch(); }} />
      )}

      {usersQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-vip-blush)]" /></div>
      ) : (
        <div className="space-y-2">
          {(usersQuery.data || []).map(u => (
            <Card key={u.id} className="border-0 shadow-sm bg-white/80">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--color-vip-silk)] flex-shrink-0 flex items-center justify-center bg-[var(--color-vip-silk)]">
                  {u.profilePhoto ? (
                    <img src={u.profilePhoto} alt={u.name || "user"} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-[var(--color-vip-noir)]">
                      {(u.name || u.email || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-vip-noir)] truncate">{u.name || "Sem nome"}</p>
                  <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans truncate">{u.email}</p>
                  {u.reportEmail && (
                    <p className="text-xs text-[var(--color-vip-blush)]/70 font-sans truncate">📧 {u.reportEmail}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-sans ${
                    u.role === "admin"
                      ? "bg-[var(--color-vip-blush)]/10 text-[var(--color-vip-blush)]"
                      : "bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-noir)]/50"
                  }`}>
                    {u.role === "admin" ? "Admin" : "Usuário"}
                  </span>
                  <button
                    onClick={() => handleDelete(u.id, u.name || u.email || String(u.id))}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-md text-[var(--color-vip-noir)]/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Excluir usuário"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [reportEmail, setReportEmail] = useState("");
  const createMutation = trpc.admin.createUser.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        reportEmail: reportEmail.trim() || undefined,
      });
      toast.success(`Usuário ${name} criado!`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    }
  };

  return (
    <Card className="border-0 shadow-md bg-[var(--color-vip-pearl)] border border-[var(--color-vip-silk)]">
      <CardContent className="p-5">
        <h4 className="text-sm font-semibold text-[var(--color-vip-noir)] mb-4 font-sans uppercase tracking-wider">Novo Usuário</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 block font-sans">Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Nome Completo" required className="border-[var(--color-vip-silk)] bg-white font-sans text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 block font-sans">Perfil</Label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as "user" | "admin")}
                className="w-full h-10 px-3 rounded-md border border-[var(--color-vip-silk)] bg-white font-sans text-sm text-[var(--color-vip-noir)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vip-blush)]/50"
              >
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 block font-sans">E-mail de login</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" required className="border-[var(--color-vip-silk)] bg-white font-sans text-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 block font-sans">Senha</Label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className="border-[var(--color-vip-silk)] bg-white font-sans text-sm pr-10" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-vip-noir)]/40">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 block font-sans">E-mail para relatórios (opcional)</Label>
            <Input type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)} placeholder="relatorios@email.com" className="border-[var(--color-vip-silk)] bg-white font-sans text-sm" />
          </div>
          <Button type="submit" disabled={createMutation.isPending} className="w-full bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="sm">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
            Criar Usuário
          </Button>
        </form>
      </CardContent>
    </Card>
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
        <div className="bg-[var(--color-vip-noir)] px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-[var(--color-vip-silk)] font-semibold tracking-widest text-sm uppercase">VIP ESTETIC</h2>
            <p className="text-[var(--color-vip-silk)]/50 text-xs font-sans tracking-wider mt-0.5">Relatório de Consulta</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="bg-white px-6 py-6 space-y-4">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-[var(--color-vip-silk)]/50 pb-3 last:border-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1 font-sans">{label}</p>
              <p className="text-sm text-[var(--color-vip-noir)] font-sans leading-relaxed whitespace-pre-wrap">{value}</p>
            </div>
          ))}
        </div>
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
