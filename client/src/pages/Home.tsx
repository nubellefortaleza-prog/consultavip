import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Mic, Square, Pause, Play, Upload, FileText, Send,
  Loader2, CheckCircle2, RotateCcw, Clock, LogOut, History,
} from "lucide-react";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663032644247/XjbcOchGTMROPEqF.png";

type AppStep = "record" | "uploading" | "transcribing" | "report" | "sending" | "done";

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

const SINGLE_LINE_FIELDS: (keyof ReportData)[] = ["patientName", "consultationDate"];

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const recorder = useAudioRecorder();
  const [step, setStep] = useState<AppStep>("record");
  const [consultationId, setConsultationId] = useState<number | null>(null);
  const [transcription, setTranscription] = useState("");
  const [report, setReport] = useState<ReportData>({
    patientName: "", consultationDate: "", patientProfile: "",
    mainComplaints: "", treatmentPlan: "", budgetPresented: "",
    closedDeal: "", additionalNotes: "",
  });
  const [showHistory, setShowHistory] = useState(false);
  const processingRef = useRef(false);

  const uploadMutation = trpc.consultation.uploadAudio.useMutation();
  const transcribeMutation = trpc.consultation.transcribe.useMutation();
  const generateReportMutation = trpc.consultation.generateReport.useMutation();
  const sendEmailMutation = trpc.consultation.sendEmail.useMutation();
  const historyQuery = trpc.consultation.list.useQuery(undefined, { enabled: isAuthenticated && showHistory });

  const handleStartRecording = useCallback(async () => {
    try { await recorder.startRecording(); } catch (err: any) { toast.error(err.message || "Erro ao iniciar gravação"); }
  }, [recorder]);

  const processAudio = useCallback(async (blob: Blob) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      setStep("uploading");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => { const r = reader.result as string; resolve(r.split(",")[1] || r); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const uploadResult = await uploadMutation.mutateAsync({ audioBase64: base64, mimeType: blob.type || "audio/webm" });
      setConsultationId(uploadResult.consultationId);

      setStep("transcribing");
      const transcribeResult = await transcribeMutation.mutateAsync({ consultationId: uploadResult.consultationId, audioUrl: uploadResult.audioUrl });
      setTranscription(transcribeResult.text);

      const reportResult = await generateReportMutation.mutateAsync({ consultationId: uploadResult.consultationId, transcription: transcribeResult.text });
      setReport(reportResult);
      setStep("report");
      toast.success("Relatório gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar áudio");
      setStep("record");
    } finally {
      processingRef.current = false;
    }
  }, [uploadMutation, transcribeMutation, generateReportMutation]);

  // waitingForBlob: flag that signals we stopped recording and are waiting for the blob
  const waitingForBlobRef = useRef(false);
  const processAudioRef = useRef(processAudio);
  useEffect(() => { processAudioRef.current = processAudio; }, [processAudio]);

  // Automatically trigger processing when blob becomes available after stop
  useEffect(() => {
    if (waitingForBlobRef.current && recorder.audioBlob && recorder.state === "stopped" && step === "record") {
      waitingForBlobRef.current = false;
      processAudioRef.current(recorder.audioBlob);
    }
  }, [recorder.audioBlob, recorder.state, step]);

  const handleStopAndProcess = useCallback(() => {
    waitingForBlobRef.current = true;
    recorder.stopRecording();
  }, [recorder]);

  const handleProcessStopped = useCallback(() => {
    const blob = recorder.audioBlob;
    if (blob) processAudio(blob);
    else toast.error("Nenhum áudio encontrado.");
  }, [recorder.audioBlob, processAudio]);

  const handleSendEmail = useCallback(async () => {
    if (!consultationId) return;
    try {
      setStep("sending");
      await sendEmailMutation.mutateAsync({ consultationId, ...report });
      setStep("done");
      toast.success("E-mail enviado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail");
      setStep("report");
    }
  }, [consultationId, report, sendEmailMutation]);

  const handleNewConsultation = useCallback(() => {
    setStep("record"); setConsultationId(null); setTranscription("");
    setReport({ patientName: "", consultationDate: "", patientProfile: "", mainComplaints: "", treatmentPlan: "", budgetPresented: "", closedDeal: "", additionalNotes: "" });
    recorder.reset(); lastBlobRef.current = null; processingRef.current = false;
  }, [recorder]);

  const updateReportField = useCallback((field: keyof ReportData, value: string) => {
    setReport((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isProcessing = step === "uploading" || step === "transcribing" || step === "sending";
  const stepMessage = useMemo(() => {
    switch (step) {
      case "uploading": return "Enviando áudio...";
      case "transcribing": return "Transcrevendo consulta com IA...";
      case "sending": return "Enviando relatório por e-mail...";
      default: return "";
    }
  }, [step]);

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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-vip-pearl)]">
      <AppHeader user={user} onLogout={logout} onToggleHistory={() => setShowHistory(!showHistory)} showHistory={showHistory} />
      <main className="flex-1 container py-6 md:py-10">
        {showHistory ? (
          <HistoryView consultations={historyQuery.data || []} loading={historyQuery.isLoading} onBack={() => setShowHistory(false)} />
        ) : (
          <div className="max-w-2xl mx-auto">
            <StepIndicator currentStep={step} />

            {step === "record" && (
              <RecordingCard
                recorderState={recorder.state} formattedDuration={recorder.formattedDuration}
                onStart={handleStartRecording} onStop={handleStopAndProcess}
                onPause={recorder.pauseRecording} onResume={recorder.resumeRecording}
                hasBlob={!!recorder.audioBlob} onProcess={handleProcessStopped}
              />
            )}

            {isProcessing && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 md:p-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-vip-silk)]/50 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--color-vip-blush)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--color-vip-noir)] mb-2">{stepMessage}</h3>
                  <p className="text-sm text-[var(--color-vip-noir)]/50 font-sans">Aguarde enquanto processamos sua consulta</p>
                  {step === "transcribing" && (
                    <div className="mt-6 flex justify-center gap-1">
                      {[0,1,2,3,4].map(i => <div key={i} className="w-1.5 rounded-full bg-[var(--color-vip-blush)] audio-wave-bar" style={{animationDelay:`${i*0.15}s`,height:"8px"}} />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === "report" && (
              <div className="space-y-6">
                <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-[var(--color-vip-terracotta)]" />
                      <h3 className="text-sm font-semibold text-[var(--color-vip-noir)] uppercase tracking-wider font-sans">Transcrição</h3>
                    </div>
                    <div className="bg-[var(--color-vip-pearl)] rounded-lg p-4 max-h-40 overflow-y-auto">
                      <p className="text-sm text-[var(--color-vip-noir)]/70 font-sans leading-relaxed whitespace-pre-wrap">{transcription || "Nenhuma transcrição disponível"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-6">
                      <FileText className="w-5 h-5 text-[var(--color-vip-blush)]" />
                      <h3 className="text-lg font-semibold text-[var(--color-vip-noir)]">Relatório da Consulta</h3>
                    </div>
                    <p className="text-sm text-[var(--color-vip-noir)]/50 mb-6 font-sans">Revise e edite os campos abaixo antes de enviar por e-mail.</p>
                    <div className="space-y-5">
                      {FIELD_ORDER.map(field => (
                        <div key={field}>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-1.5 block font-sans">{REPORT_LABELS[field]}</Label>
                          {SINGLE_LINE_FIELDS.includes(field) ? (
                            <Input value={report[field]} onChange={e => updateReportField(field, e.target.value)} className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans" />
                          ) : (
                            <Textarea value={report[field]} onChange={e => updateReportField(field, e.target.value)} rows={3} className="border-[var(--color-vip-silk)] focus:border-[var(--color-vip-blush)] bg-white font-sans resize-y" />
                          )}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-6 bg-[var(--color-vip-silk)]" />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={handleSendEmail} className="flex-1 bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg">
                        <Send className="w-4 h-4 mr-2" />Enviar por E-mail
                      </Button>
                      <Button onClick={handleNewConsultation} variant="outline" className="border-[var(--color-vip-sage)] text-[var(--color-vip-noir)] hover:bg-[var(--color-vip-sage)]/10 font-sans" size="lg">
                        <RotateCcw className="w-4 h-4 mr-2" />Nova Consulta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "done" && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 md:p-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-vip-sage)]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-[var(--color-vip-sage)]" />
                  </div>
                  <h3 className="text-2xl font-semibold text-[var(--color-vip-noir)] mb-2">Relatório Enviado!</h3>
                  <p className="text-sm text-[var(--color-vip-noir)]/50 mb-2 font-sans">O relatório de <strong>{report.patientName}</strong> foi enviado com sucesso para:</p>
                  <p className="text-sm font-medium text-[var(--color-vip-blush)] mb-8 font-sans">nubellefortaleza@gmail.com</p>
                  <div className="text-left bg-[var(--color-vip-pearl)] rounded-lg p-5 mb-8">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-vip-terracotta)] mb-3 font-sans">Resumo do Relatório</h4>
                    {FIELD_ORDER.map(field => (
                      <div key={field} className="flex gap-2 py-1.5 border-b border-[var(--color-vip-silk)]/50 last:border-0">
                        <span className="text-xs font-semibold text-[var(--color-vip-noir)]/60 uppercase min-w-[140px] font-sans">{REPORT_LABELS[field]}:</span>
                        <span className="text-xs text-[var(--color-vip-noir)] font-sans">{report[field]}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleNewConsultation} className="bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg">
                    <RotateCcw className="w-4 h-4 mr-2" />Nova Consulta
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

function AppHeader({ user, onLogout, onToggleHistory, showHistory }: { user?: any; onLogout?: () => void; onToggleHistory?: () => void; showHistory?: boolean }) {
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
  const steps = [{ key: "record", label: "Gravar" }, { key: "process", label: "Processar" }, { key: "report", label: "Relatório" }, { key: "done", label: "Enviado" }];
  const getIdx = () => { if (currentStep === "record") return 0; if (["uploading","transcribing"].includes(currentStep)) return 1; if (currentStep === "report" || currentStep === "sending") return 2; return 3; };
  const activeIndex = getIdx();
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

function RecordingCard({ recorderState, formattedDuration, onStart, onStop, onPause, onResume, hasBlob, onProcess }: {
  recorderState: string; formattedDuration: string; onStart: () => void; onStop: () => void;
  onPause: () => void; onResume: () => void; hasBlob: boolean; onProcess: () => void;
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
            {isRecording ? <Square className="w-8 h-8 md:w-10 md:h-10 text-white" /> : <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />}
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
          {isIdle && "Iniciar Gravação"}{isRecording && "Gravando Consulta..."}{isPaused && "Gravação Pausada"}{isStopped && "Gravação Finalizada"}
        </h3>
        <p className="text-sm text-[var(--color-vip-noir)]/50 mb-6 font-sans">
          {isIdle && "Toque no microfone para começar a gravar a consulta"}
          {isRecording && "Toque no botão para parar a gravação"}
          {isPaused && "Toque para retomar ou finalize a gravação"}
          {isStopped && "Áudio pronto para processamento"}
        </p>

        <div className="flex justify-center gap-3">
          {isRecording && (
            <Button onClick={onPause} variant="outline" className="border-[var(--color-vip-silk)] text-[var(--color-vip-noir)] font-sans"><Pause className="w-4 h-4 mr-2" />Pausar</Button>
          )}
          {isPaused && (
            <>
              <Button onClick={onResume} className="bg-[var(--color-vip-terracotta)] hover:bg-[var(--color-vip-terracotta)]/90 text-white font-sans"><Play className="w-4 h-4 mr-2" />Retomar</Button>
              <Button onClick={onStop} variant="outline" className="border-[var(--color-vip-blush)] text-[var(--color-vip-blush)] font-sans"><Square className="w-4 h-4 mr-2" />Finalizar</Button>
            </>
          )}
          {isStopped && hasBlob && (
            <Button onClick={onProcess} className="bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-sans" size="lg"><Upload className="w-4 h-4 mr-2" />Processar Consulta</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryView({ consultations, loading, onBack }: { consultations: any[]; loading: boolean; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[var(--color-vip-noir)]/60 font-sans">← Voltar</Button>
        <h2 className="text-xl font-semibold text-[var(--color-vip-noir)]">Histórico de Consultas</h2>
      </div>
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-vip-blush)] mx-auto" /></div>
      ) : consultations.length === 0 ? (
        <Card className="border-0 shadow-md bg-white/80"><CardContent className="p-8 text-center"><p className="text-sm text-[var(--color-vip-noir)]/50 font-sans">Nenhuma consulta registrada ainda.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {consultations.map((c: any) => (
            <Card key={c.id} className="border-0 shadow-md bg-white/80 hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-[var(--color-vip-noir)] text-sm">{c.patientName || "Paciente não identificado"}</h4>
                    <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans mt-1">{c.consultationDate || new Date(c.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-sans ${c.emailSent === "yes" ? "bg-[var(--color-vip-sage)]/20 text-[var(--color-vip-sage)]" : "bg-[var(--color-vip-silk)]/50 text-[var(--color-vip-terracotta)]"}`}>
                    {c.emailSent === "yes" ? "Enviado" : "Pendente"}
                  </span>
                </div>
                {c.mainComplaints && c.mainComplaints !== "Não mencionado" && <p className="text-xs text-[var(--color-vip-noir)]/40 font-sans mt-2 line-clamp-2">{c.mainComplaints}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
