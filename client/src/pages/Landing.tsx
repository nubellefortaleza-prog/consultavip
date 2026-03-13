import { useState } from "react";
import { useLocation } from "wouter";
import {
  Mic, FileText, Mail, BarChart2, Users, Shield, CheckCircle2,
  ArrowRight, ChevronDown, Star, Building2, Zap, Brain,
  ClipboardList, TrendingUp, AlertCircle, XCircle, DollarSign,
  Clock, PhoneCall,
} from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663032644247/XjbcOchGTMROPEqF.png";

function NavBar() {
  const [, navigate] = useLocation();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-vip-silk)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Consulta Vip" className="h-8 w-auto" />
          <span className="font-serif text-lg font-semibold text-[var(--color-vip-noir)] hidden sm:block">
            Consulta<span className="text-[var(--color-vip-blush)]">Vip</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#beneficios" className="hidden md:block text-sm text-[var(--color-vip-noir)]/60 hover:text-[var(--color-vip-blush)] font-sans transition-colors">Benefícios</a>
          <a href="#como-funciona" className="hidden md:block text-sm text-[var(--color-vip-noir)]/60 hover:text-[var(--color-vip-blush)] font-sans transition-colors">Como funciona</a>
          <a href="#planos" className="hidden md:block text-sm text-[var(--color-vip-noir)]/60 hover:text-[var(--color-vip-blush)] font-sans transition-colors">Planos</a>
          <button
            onClick={() => navigate("/login")}
            className="text-sm px-4 py-2 rounded-full border border-[var(--color-vip-silk)] text-[var(--color-vip-noir)]/70 hover:border-[var(--color-vip-blush)] hover:text-[var(--color-vip-blush)] font-sans transition-colors"
          >
            Entrar
          </button>
          <a
            href="#cta"
            className="text-sm px-5 py-2 rounded-full bg-[var(--color-vip-blush)] text-white hover:bg-[var(--color-vip-blush)]/90 font-sans font-semibold transition-colors shadow-sm"
          >
            Quero testar
          </a>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 pt-24 pb-16 overflow-hidden bg-[var(--color-vip-pearl)]">
      {/* Decorative blobs */}
      <div className="absolute top-20 -right-32 w-96 h-96 rounded-full bg-[var(--color-vip-blush)]/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-32 w-96 h-96 rounded-full bg-[var(--color-vip-silk)]/60 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[var(--color-vip-blush)]/10 text-[var(--color-vip-blush)] text-xs font-semibold px-4 py-2 rounded-full mb-6 font-sans tracking-wider uppercase">
          <Zap className="w-3.5 h-3.5" />
          Tecnologia com IA para clínicas de estética
        </div>

        <h1 className="font-serif text-5xl md:text-7xl font-semibold text-[var(--color-vip-noir)] leading-tight mb-6">
          Agora você não perde{" "}
          <span className="text-[var(--color-vip-blush)]">nenhuma informação</span>{" "}
          da sua consulta
        </h1>

        <p className="text-lg md:text-xl text-[var(--color-vip-noir)]/60 font-sans max-w-2xl mx-auto mb-3 leading-relaxed">
          Grave, transcreva e analise cada avaliação com inteligência artificial.
          Relatório completo, enviado automáticamente. Tudo na palma da sua mão.
        </p>
        <p className="text-base text-[var(--color-vip-noir)]/40 font-sans max-w-xl mx-auto mb-10">
          Mais controle · Mais performance · Experiência completa para o seu paciente
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#cta"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[var(--color-vip-blush)] text-white font-semibold font-sans text-base hover:bg-[var(--color-vip-blush)]/90 transition-all shadow-lg shadow-[var(--color-vip-blush)]/25 hover:shadow-xl hover:shadow-[var(--color-vip-blush)]/30 hover:-translate-y-0.5"
          >
            Solicitar demonstração gratuita
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-[var(--color-vip-silk)] text-[var(--color-vip-noir)]/70 font-sans text-base hover:border-[var(--color-vip-blush)] hover:text-[var(--color-vip-blush)] transition-colors"
          >
            Ver como funciona
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>

        {/* Social proof bar */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-[var(--color-vip-noir)]/50 font-sans">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["C","A","M","R","L"].map((l, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-[var(--color-vip-silk)] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[var(--color-vip-blush)]">{l}</div>
              ))}
            </div>
            <span>Clínicas já usam o ConsultaVip</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
            <span className="ml-1">5.0 de avaliação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[var(--color-vip-sage)]" />
            <span>Dados 100% seguros</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const PAINS = [
  {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-50",
    title: "Informações perdidas após a consulta",
    desc: "Você sai da avaliação com anotações espalhadas, detalhes esquecidos e sem registro formal do que foi discutido com o paciente.",
  },
  {
    icon: ClipboardList,
    color: "text-orange-400",
    bg: "bg-orange-50",
    title: "Sem controle dos orçamentos apresentados",
    desc: "Não existe visibilidade de quais tratamentos foram orçados, quais foram aceitos e quais ficaram em aberto sem fechamento.",
  },
  {
    icon: AlertCircle,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    title: "Qualidade das avaliações sem supervisão",
    desc: "Como gestor, você não tem como acompanhar se os profissionais estão conduzindo as consultas com o padrão exigido pela clínica.",
  },
  {
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-50",
    title: "Próximas vendas perdidas",
    desc: "Sem registro de o que foi combinado, a continuação do tratamento depende só da memória — e pacientes ficam sem retorno no momento certo.",
  },
  {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-50",
    title: "Histórico do paciente fragmentado",
    desc: "Cada consulta existe de forma isolada. Não há visão do histórico completo do paciente para embasar decisões de tratamento.",
  },
  {
    icon: Clock,
    color: "text-[var(--color-vip-terracotta)]",
    bg: "bg-[var(--color-vip-silk)]/40",
    title: "Tempo perdido com burocracia manual",
    desc: "Preencher relatórios manualmente consome tempo precioso que deveria ser dedicado aos pacientes e à gestão do negócio.",
  },
];

function PainsSection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-3">As dores que você conhece bem</p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[var(--color-vip-noir)] mb-4">
            Você reconhece<br />alguma dessas situações?
          </h2>
          <p className="text-[var(--color-vip-noir)]/50 font-sans max-w-xl mx-auto">
            Profissionais de estética e gestores de clínica lidam com esses problemas todos os dias — e eles custam pacientes, receita e reputação.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PAINS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-[var(--color-vip-silk)] p-6 hover:shadow-md transition-shadow group">
              <div className={`w-10 h-10 ${p.bg} rounded-xl flex items-center justify-center mb-4`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <h3 className="font-sans font-semibold text-[var(--color-vip-noir)] text-sm mb-2 leading-snug">{p.title}</h3>
              <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Mic,
    title: "Gravação inteligente da consulta",
    desc: "Grave o áudio da avaliação com um toque. Nada digitado, nada esquecido. O paciente fala, você ouve e a IA faz o resto.",
    highlight: "Gravação + transcrição automática",
  },
  {
    icon: Brain,
    title: "Análise com IA Gemini",
    desc: "Inteligência artificial analisa a consulta e gera um relatório estruturado: perfil do paciente, queixas, plano de tratamento, orçamento e próximos passos.",
    highlight: "Relatório gerado em segundos",
  },
  {
    icon: FileText,
    title: "Relatório completo e padronizado",
    desc: "Cada consulta gera um relatório detalhado com todos os dados relevantes, formatado e pronto para uso clínico ou comercial.",
    highlight: "100% padronizado para a sua clínica",
  },
  {
    icon: Mail,
    title: "Envio automático por e-mail",
    desc: "O relatório é enviado automaticamente para o e-mail do profissional ou para o destino configurado — sem nenhuma ação manual.",
    highlight: "Zero esforço pós-consulta",
  },
  {
    icon: BarChart2,
    title: "Supervisão e controle de qualidade",
    desc: "Gestor acompanha todas as avaliações realizadas, identifica pontos de melhoria e garante o padrão de atendimento da clínica.",
    highlight: "Visibilidade total para o gestor",
  },
  {
    icon: DollarSign,
    title: "Controle de orçamentos e próximas vendas",
    desc: "Registre o que foi orçado, o que foi fechado e acompanhe os tratamentos em aberto. Não perca nenhuma oportunidade de continuação.",
    highlight: "Pipeline de vendas da clínica",
  },
  {
    icon: Users,
    title: "Histórico centralizado do paciente",
    desc: "Todas as consultas ficam registradas e acessíveis. Continuidade de tratamento com base em dados reais, não em memória.",
    highlight: "Fidelização no longo prazo",
  },
  {
    icon: Building2,
    title: "Multi-clínica e multi-usuário",
    desc: "Gerencie uma ou várias unidades na mesma plataforma. Cada clínica com seus dados isolados, seus profissionais e seu controle.",
    highlight: "Escalável para redes de clínicas",
  },
];

function FeaturesSection() {
  return (
    <section id="beneficios" className="py-24 px-6 bg-[var(--color-vip-pearl)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-3">O que o ConsultaVip entrega</p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[var(--color-vip-noir)] mb-4">
            Tudo que foi conversado,<br />combinado e planejado
          </h2>
          <p className="text-[var(--color-vip-noir)]/50 font-sans max-w-xl mx-auto">
            Na palma da sua mão. Com controle real, dados precisos e inteligência para tomar as melhores decisões.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-[var(--color-vip-silk)] p-6 hover:shadow-md transition-all hover:-translate-y-0.5 group">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-vip-blush)]/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-[var(--color-vip-blush)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-sans font-semibold text-[var(--color-vip-noir)] text-sm leading-snug">{f.title}</h3>
                  </div>
                  <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans leading-relaxed mb-3">{f.desc}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-vip-blush)] bg-[var(--color-vip-blush)]/8 px-2.5 py-1 rounded-full font-sans">
                    <CheckCircle2 className="w-3 h-3" />
                    {f.highlight}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    icon: Mic,
    title: "Grave a consulta",
    desc: "No início ou durante a avaliação, inicie a gravação no app. O áudio é capturado sem interromper o atendimento.",
  },
  {
    n: "02",
    icon: Brain,
    title: "IA analisa e gera o relatório",
    desc: "Em segundos, a inteligência artificial transcreve o áudio e estrutura um relatório completo com todas as informações relevantes.",
  },
  {
    n: "03",
    icon: Mail,
    title: "Relatório entregue automaticamente",
    desc: "O relatório é enviado por e-mail para o profissional responsável ou para o destino configurado — sem nenhum passo manual.",
  },
  {
    n: "04",
    icon: BarChart2,
    title: "Gestor acompanha tudo",
    desc: "O histórico fica centralizado. O gestor supervisiona a qualidade das avaliações, controla orçamentos e acompanha o funil de tratamentos.",
  },
];

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-3">Simples de usar</p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[var(--color-vip-noir)] mb-4">
            Como funciona
          </h2>
          <p className="text-[var(--color-vip-noir)]/50 font-sans max-w-xl mx-auto">
            Do áudio ao relatório em menos de 2 minutos. Sem complicação, sem treinamento extenso.
          </p>
        </div>
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-[var(--color-vip-silk)] via-[var(--color-vip-blush)]/30 to-[var(--color-vip-silk)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-2xl bg-[var(--color-vip-blush)]/10 flex items-center justify-center border-2 border-[var(--color-vip-blush)]/20">
                    <s.icon className="w-8 h-8 text-[var(--color-vip-blush)]" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-vip-blush)] text-white text-[10px] font-bold flex items-center justify-center font-sans">{s.n}</span>
                </div>
                <h3 className="font-sans font-semibold text-[var(--color-vip-noir)] text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-[var(--color-vip-noir)]/50 font-sans leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    name: "Dra. Carolina M.",
    role: "Esteticista · São Paulo",
    text: "Antes eu perdia detalhes importantíssimos da consulta. Hoje tudo fica registrado e o relatório chega no meu e-mail antes de eu terminar de despedir o paciente.",
    initials: "CM",
  },
  {
    name: "André R.",
    role: "Gestor · Clínica Lumière",
    text: "Como gestor, consegui finalmente supervisionar a qualidade das avaliações da minha equipe sem precisar estar presente em cada consulta. Isso mudou a gestão da clínica.",
    initials: "AR",
  },
  {
    name: "Dra. Fernanda L.",
    role: "Biomédica Esteta · Curitiba",
    text: "O controle de orçamentos que ficavam em aberto era nosso maior problema. Agora sabemos exatamente quem orçou o quê e quando fazer o acompanhamento.",
    initials: "FL",
  },
];

function TestimonialsSection() {
  return (
    <section className="py-24 px-6 bg-[var(--color-vip-pearl)]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-3">Quem já usa</p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[var(--color-vip-noir)]">
            Resultados reais
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl bg-white border border-[var(--color-vip-silk)] p-6">
              <div className="flex mb-3">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-sm text-[var(--color-vip-noir)]/70 font-sans leading-relaxed mb-5 italic">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-vip-blush)]/15 flex items-center justify-center text-xs font-bold text-[var(--color-vip-blush)] font-sans flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-vip-noir)] font-sans">{t.name}</p>
                  <p className="text-[11px] text-[var(--color-vip-noir)]/40 font-sans">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    desc: "Ideal para profissionais autônomos",
    features: [
      "1 usuário",
      "Gravação e transcrição de consultas",
      "Relatório com IA",
      "Envio por e-mail automático",
      "Histórico ilimitado",
    ],
    cta: "Começar agora",
    highlight: false,
  },
  {
    name: "Clínica",
    price: "R$ 247",
    period: "/mês",
    desc: "Para clínicas com equipe",
    features: [
      "Até 5 usuários",
      "Tudo do Starter",
      "Painel do gestor",
      "Supervisão de qualidade",
      "Controle de orçamentos",
      "Relatórios da equipe",
    ],
    cta: "Escolher Clínica",
    highlight: true,
    badge: "Mais popular",
  },
  {
    name: "Rede",
    price: "Sob consulta",
    period: "",
    desc: "Para redes e múltiplas unidades",
    features: [
      "Usuários ilimitados",
      "Múltiplas clínicas",
      "Tudo do Clínica",
      "Onboarding dedicado",
      "SLA prioritário",
      "Personalização de marca",
    ],
    cta: "Falar com especialista",
    highlight: false,
  },
];

function PricingSection() {
  return (
    <section id="planos" className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-3">Investimento</p>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-[var(--color-vip-noir)] mb-4">
            Planos simples,<br />resultados reais
          </h2>
          <p className="text-[var(--color-vip-noir)]/50 font-sans max-w-md mx-auto">
            Sem contrato. Cancele quando quiser. 7 dias grátis para testar sem compromisso.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-7 border flex flex-col ${
                p.highlight
                  ? "bg-[var(--color-vip-blush)] border-[var(--color-vip-blush)] text-white shadow-2xl shadow-[var(--color-vip-blush)]/30 scale-105"
                  : "bg-white border-[var(--color-vip-silk)]"
              }`}
            >
              {p.badge && (
                <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 font-sans self-start">
                  {p.badge}
                </span>
              )}
              <p className={`text-xs font-semibold uppercase tracking-widest font-sans mb-1 ${p.highlight ? "text-white/70" : "text-[var(--color-vip-blush)]"}`}>
                {p.name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className={`font-serif text-4xl font-semibold ${p.highlight ? "text-white" : "text-[var(--color-vip-noir)]"}`}>{p.price}</span>
                {p.period && <span className={`text-sm font-sans mb-1.5 ${p.highlight ? "text-white/60" : "text-[var(--color-vip-noir)]/40"}`}>{p.period}</span>}
              </div>
              <p className={`text-xs font-sans mb-6 ${p.highlight ? "text-white/70" : "text-[var(--color-vip-noir)]/50"}`}>{p.desc}</p>
              <ul className="space-y-2.5 mb-7 flex-1">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2.5 text-sm font-sans ${p.highlight ? "text-white/90" : "text-[var(--color-vip-noir)]/70"}`}>
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${p.highlight ? "text-white" : "text-[var(--color-vip-sage)]"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className={`block text-center py-3 rounded-full text-sm font-semibold font-sans transition-all ${
                  p.highlight
                    ? "bg-white text-[var(--color-vip-blush)] hover:bg-white/90"
                    : "border border-[var(--color-vip-silk)] text-[var(--color-vip-noir)]/70 hover:border-[var(--color-vip-blush)] hover:text-[var(--color-vip-blush)]"
                }`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinic, setClinic] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to a backend or form service
    setSubmitted(true);
  };

  return (
    <section id="cta" className="py-24 px-6 bg-[var(--color-vip-noir)] relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[var(--color-vip-blush)]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[var(--color-vip-silk)]/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-vip-blush)] font-sans mb-4">Dê o próximo passo</p>
        <h2 className="font-serif text-4xl md:text-5xl font-semibold text-white mb-4">
          Comece hoje.<br />
          <span className="text-[var(--color-vip-blush)]">7 dias completamente gratuitos.</span>
        </h2>
        <p className="text-white/50 font-sans mb-10 max-w-xl mx-auto">
          Sem cartão de crédito. Sem burocracia. Preencha abaixo e nossa equipe entra em contato para configurar tudo para a sua clínica.
        </p>

        {submitted ? (
          <div className="bg-white/10 rounded-2xl p-10 border border-white/10">
            <CheckCircle2 className="w-14 h-14 text-[var(--color-vip-sage)] mx-auto mb-4" />
            <p className="font-serif text-2xl text-white mb-2">Ótimo, {name}!</p>
            <p className="text-white/60 font-sans">Nossa equipe vai entrar em contato em breve pelo WhatsApp ou e-mail para agendar sua demonstração.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/8 rounded-2xl p-8 border border-white/10 text-left space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 font-sans mb-1.5">Seu nome</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Dra. Maria Silva"
                  className="w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 font-sans text-sm focus:outline-none focus:border-[var(--color-vip-blush)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 font-sans mb-1.5">WhatsApp</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="(11) 99999-0000"
                  className="w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 font-sans text-sm focus:outline-none focus:border-[var(--color-vip-blush)] transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 font-sans mb-1.5">Nome da clínica (opcional)</label>
              <input
                value={clinic}
                onChange={e => setClinic(e.target.value)}
                placeholder="Clínica Exemplo Estética"
                className="w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 font-sans text-sm focus:outline-none focus:border-[var(--color-vip-blush)] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full h-12 rounded-full bg-[var(--color-vip-blush)] hover:bg-[var(--color-vip-blush)]/90 text-white font-semibold font-sans text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-[var(--color-vip-blush)]/30 mt-2"
            >
              <PhoneCall className="w-4 h-4" />
              Quero minha demonstração gratuita
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[11px] text-white/30 font-sans">
              Ao enviar, você concorda em ser contatado pela nossa equipe. Sem spam.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[var(--color-vip-noir)] border-t border-white/10 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="ConsultaVip" className="h-7 w-auto opacity-70" />
          <span className="font-serif text-base text-white/40">
            Consulta<span className="text-[var(--color-vip-blush)]/70">Vip</span>
          </span>
        </div>
        <p className="text-xs text-white/30 font-sans text-center">
          © {new Date().getFullYear()} ConsultaVip · Todos os direitos reservados
        </p>
        <div className="flex items-center gap-2 text-xs text-white/30 font-sans">
          <Shield className="w-3.5 h-3.5" />
          Dados protegidos e seguros
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-vip-pearl)]">
      <NavBar />
      <HeroSection />
      <PainsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
