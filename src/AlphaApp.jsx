import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Check, Clock, User, Scissors,
  Calendar as CalendarIcon, X, ShieldCheck, Play, Sparkles,
  Phone, Search, Settings, LogOut, Plus, Trash2, Sun, Download, Lock,
} from "lucide-react";
import {
  fetchProfessionals, insertProfessional, updateProfessionalField, deleteProfessional,
  insertVacation, updateVacationField, deleteVacation,
  fetchServices, insertService, updateServiceField, deleteService,
  fetchAppointments, insertAppointment, cancelAppointmentDb,
} from "./lib/db";
import { storage } from "./lib/localStorageShim";

const INK = "#26222B";
const IVORY = "#FBF7F2";
const WINE = "#8C3B4E";
const SAGE = "#748C6B";
const ROSE = "#C97B87";
const GOLD = "#C79A56";
const MUTED = "#9C9184";
const GREEN = "#5C8A5C";
const PALETTE = [WINE, SAGE, ROSE, GOLD, "#5E7CA8", "#8B6E9E"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
const TODAY = todayStr();

// Estes três SEED_* não são mais usados para carregar dados (isso agora vem do
// Supabase, via src/lib/db.js) — ficam só como referência do formato esperado.
const SEED_PROFESSIONALS = [
  { id: "ana", name: "Ana", color: WINE, workStart: 8 * 60, workEnd: 18 * 60, lunchStart: 13 * 60, lunchEnd: 14 * 60, vacations: [], password: "ana123", photo: null },
  { id: "bia", name: "Bia", color: SAGE, workStart: 8 * 60, workEnd: 18 * 60, lunchStart: 12 * 60, lunchEnd: 13 * 60, vacations: [], password: "bia123", photo: null },
  { id: "carla", name: "Carla", color: ROSE, workStart: 9 * 60, workEnd: 19 * 60, lunchStart: 13 * 60, lunchEnd: 14 * 60, vacations: [], password: "carla123", photo: null },
];

const SEED_SERVICES = [
  { id: "mao", name: "Mão", duration: 60, price: 35 },
  { id: "pe", name: "Pé", duration: 60, price: 35 },
  { id: "pemao", name: "Pé + Mão", duration: 120, price: 65 },
  { id: "alongamento", name: "Alongamento", duration: 180, price: 120 },
  { id: "manutencao", name: "Manutenção", duration: 120, price: 70 },
  { id: "blindagem", name: "Blindagem", duration: 90, price: 55 },
];

const SEED_APPOINTMENTS = [
  { id: "seed1", proId: "ana", serviceId: "pemao", date: TODAY, start: 9 * 60, clientName: "Marina", phone: "11 91234-5678", status: "confirmed" },
  { id: "seed2", proId: "bia", serviceId: "alongamento", date: TODAY, start: 8.5 * 60, clientName: "Fernanda", phone: "11 99876-5432", status: "confirmed" },
  { id: "seed3", proId: "carla", serviceId: "blindagem", date: TODAY, start: 10 * 60, clientName: "Paula", phone: "11 98765-4321", status: "confirmed" },
  { id: "seed4", proId: "carla", serviceId: "manutencao", date: TODAY, start: 14 * 60 + 30, clientName: "Sofia", phone: "11 97654-3210", status: "confirmed" },
];

const SEED_SALON = { name: "Bella Studio", whatsapp: "11 90000-0000", address: "Rua das Flores, 123", adminPassword: "admin123" };

// Segunda a sexta 8h-17h, sábado 8h-13h, domingo fechado — tudo editável no painel.
const SEED_BUSINESS_HOURS = {
  0: { open: false },
  1: { open: true, start: 8 * 60, end: 17 * 60 },
  2: { open: true, start: 8 * 60, end: 17 * 60 },
  3: { open: true, start: 8 * 60, end: 17 * 60 },
  4: { open: true, start: 8 * 60, end: 17 * 60 },
  5: { open: true, start: 8 * 60, end: 17 * 60 },
  6: { open: true, start: 8 * 60, end: 13 * 60 },
};

const SEED_HOLIDAYS = [];

const SEED_GALLERY = [
  { id: "g1", type: "placeholder", label: "Alongamento", proName: "Ana", color: WINE },
  { id: "g2", type: "placeholder", label: "Blindagem", proName: "Carla", color: ROSE },
  { id: "g3", type: "placeholder", label: "Esmaltação em gel", proName: "Bia", color: SAGE },
  { id: "g4", type: "placeholder", label: "Nail art", proName: "Ana", color: GOLD },
];

// Redimensiona a imagem no navegador antes de guardar (evita ultrapassar o limite de armazenamento).
function resizeImage(file, maxWidth = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// HELPERS DE DATA / HORÁRIO — tudo trabalha com datas reais (YYYY-MM-DD),
// não com "dias a partir de hoje", para permitir agendar quanto tempo no futuro quiser.
// ============================================================
function fmt(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmtShort(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
function parseTime(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay();
}
function dateLabel(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
function normalizePhone(p) {
  return (p || "").replace(/\D/g, "");
}
function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const monday = addDays(dateStr, day === 0 ? -6 : 1 - day);
  return [monday, addDays(monday, 6)];
}
function getMonthRange(dateStr) {
  const [y, m] = dateStr.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, "0")}`];
}

// Janela de funcionamento do salão para uma data: considera feriado (se houver) ou o horário semanal normal.
function getDayWindow(dateStr, businessHours, holidays) {
  const weekday = weekdayOf(dateStr);
  const holiday = holidays.find((h) => h.date === dateStr);
  const normal = businessHours[weekday] || { open: false };
  if (holiday) {
    if (!holiday.isOpen) return { open: false, holiday, dateStr, weekday };
    const start = normal.open ? normal.start : 8 * 60;
    const end = holiday.closeTime != null ? holiday.closeTime : (normal.open ? normal.end : 18 * 60);
    return { open: true, start, end, holiday, dateStr, weekday };
  }
  if (!normal.open) return { open: false, dateStr, weekday };
  return { open: true, start: normal.start, end: normal.end, dateStr, weekday };
}

function getVacation(pro, dateStr) {
  return (pro.vacations || []).find((v) => dateStr >= v.start && dateStr <= v.end) || null;
}

// Combina: férias > salão fechado > interseção do horário do salão com o horário da profissional.
function computeProWindow(pro, dateStr, businessHours, holidays) {
  const dayWindow = getDayWindow(dateStr, businessHours, holidays);
  const vacation = getVacation(pro, dateStr);
  if (vacation) return { status: "ferias", vacation, dayWindow };
  if (!dayWindow.open) return { status: "fechado", dayWindow };
  const start = Math.max(dayWindow.start, pro.workStart);
  const end = Math.min(dayWindow.end, pro.workEnd);
  if (start >= end) return { status: "fechado", dayWindow };
  return { status: null, start, end, dayWindow };
}

// Gera horários livres. Regra: o último horário oferecido é sempre pelo menos 1h antes do fechamento.
function getAvailableSlots(pro, service, dateStr, businessHours, holidays, appointments, services) {
  const win = computeProWindow(pro, dateStr, businessHours, holidays);
  if (win.status) return [];
  const { start, end } = win;
  const bufferEnd = end - Math.max(service.duration, 60);
  if (bufferEnd < start) return [];

  const occupied = appointments
    .filter((a) => a.proId === pro.id && a.date === dateStr && a.status === "confirmed")
    .map((a) => {
      const s = services.find((x) => x.id === a.serviceId);
      return [a.start, a.start + s.duration];
    });
  occupied.push([pro.lunchStart, pro.lunchEnd]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = dateStr === todayStr();

  const slots = [];
  for (let t = start; t <= bufferEnd; t += 30) {
    if (isToday && t <= nowMinutes) continue;
    const svcEnd = t + service.duration;
    const conflict = occupied.some(([s, e]) => t < svcEnd && svcEnd > s && t < e);
    if (!conflict) slots.push(t);
  }
  return slots;
}

function getProStatus(pro, dateStr, businessHours, holidays, appointments, services) {
  const win = computeProWindow(pro, dateStr, businessHours, holidays);
  if (win.status === "ferias") return { status: "ferias", vacation: win.vacation };
  if (win.status === "fechado") return { status: "fechado" };
  const probe = { duration: 30 };
  const slots = getAvailableSlots(pro, probe, dateStr, businessHours, holidays, appointments, services);
  return { status: slots.length > 0 ? "disponivel" : "cheia" };
}

const STATUS_LABEL = {
  disponivel: { text: "Disponível", color: GREEN },
  cheia: { text: "Agenda cheia", color: MUTED },
  fechado: { text: "Fechado", color: MUTED },
  ferias: { text: "De férias", color: ROSE },
};

async function loadKey(key, fallback) {
  try {
    const res = await storage.get(key);
    return JSON.parse(res.value);
  } catch {
    return fallback;
  }
}

// ============================================================
// APP RAIZ
// ============================================================
export default function AlphaApp() {
  const [area, setArea] = useState("cliente");
  const [staffRole, setStaffRole] = useState(null);
  const [clientScreen, setClientScreen] = useState("welcome");

  const [professionals, setProfessionals] = useState(null);
  const [services, setServices] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [clientNotes, setClientNotes] = useState(null);
  const [salon, setSalon] = useState(null);
  const [businessHours, setBusinessHours] = useState(null);
  const [holidays, setHolidays] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [consentLogs, setConsentLogs] = useState(null);

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      setProfessionals(await fetchProfessionals());
      setServices(await fetchServices());
      setAppointments(await fetchAppointments());
      setClientNotes(await loadKey("client-notes-v1", {}));
      setSalon(await loadKey("salon-v2", SEED_SALON));
      setBusinessHours(await loadKey("business-hours-v1", SEED_BUSINESS_HOURS));
      setHolidays(await loadKey("holidays-v1", SEED_HOLIDAYS));
      setGallery(await loadKey("gallery-v1", SEED_GALLERY));
      setConsentLogs(await loadKey("consent-logs-v1", []));
    })();
  }, []);

  useEffect(() => { if (clientNotes) storage.set("client-notes-v1", JSON.stringify(clientNotes)).catch(() => {}); }, [clientNotes]);
  useEffect(() => { if (salon) storage.set("salon-v2", JSON.stringify(salon)).catch(() => {}); }, [salon]);
  useEffect(() => { if (businessHours) storage.set("business-hours-v1", JSON.stringify(businessHours)).catch(() => {}); }, [businessHours]);
  useEffect(() => { if (holidays) storage.set("holidays-v1", JSON.stringify(holidays)).catch(() => {}); }, [holidays]);
  useEffect(() => { if (gallery) storage.set("gallery-v1", JSON.stringify(gallery)).catch(() => {}); }, [gallery]);
  useEffect(() => { if (consentLogs) storage.set("consent-logs-v1", JSON.stringify(consentLogs)).catch(() => {}); }, [consentLogs]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const loading = !professionals || !services || !appointments || !clientNotes || !salon || !businessHours || !holidays || !gallery || !consentLogs;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <p style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>Carregando…</p>
      </div>
    );
  }

  const activePro = staffRole && staffRole !== "admin" ? professionals.find((p) => p.id === staffRole) : null;

  return (
    <div className="min-h-screen w-full" style={{ background: IVORY, color: INK, fontFamily: "system-ui, sans-serif" }}>
      <div className="flex justify-between items-center px-4 pt-5 pb-3 max-w-3xl mx-auto">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: WINE, letterSpacing: "0.15em" }}>{salon.name} · Alpha</p>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>
            {area === "cliente"
              ? clientScreen === "welcome" ? salon.name : clientScreen === "my" ? "Meus agendamentos" : "Agendar horário"
              : staffRole === "admin" ? "Administração" : activePro ? `Agenda de ${activePro.name}` : "Área da equipe"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {area === "equipe" && staffRole && (
            <button onClick={() => setStaffRole(null)} className="p-2 rounded-full" style={{ background: "#EFE7DC" }} title="Sair"><LogOut size={15} /></button>
          )}
          <div className="flex rounded-full overflow-hidden" style={{ border: `1px solid ${INK}` }}>
            <button onClick={() => { setArea("cliente"); setClientScreen("welcome"); }} className="px-3 py-1.5 text-xs font-medium transition" style={{ background: area === "cliente" ? INK : "transparent", color: area === "cliente" ? IVORY : INK }}>Cliente</button>
            <button onClick={() => setArea("equipe")} className="px-3 py-1.5 text-xs font-medium transition" style={{ background: area === "equipe" ? INK : "transparent", color: area === "equipe" ? IVORY : INK }}>Equipe</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-24">
        {area === "cliente" ? (
          clientScreen === "welcome" ? (
            <Welcome
              salon={salon}
              businessHours={businessHours}
              holidays={holidays}
              gallery={gallery}
              onStart={() => setClientScreen("booking")}
              onMyAppointments={() => setClientScreen("my")}
            />
          ) : clientScreen === "my" ? (
            <MyAppointments
              appointments={appointments}
              professionals={professionals}
              services={services}
              onBack={() => setClientScreen("welcome")}
              onCancel={async (id) => {
                await cancelAppointmentDb(id);
                setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
                showToast("Agendamento cancelado.");
              }}
            />
          ) : (
            <ClientBooking
              professionals={professionals}
              services={services}
              appointments={appointments}
              businessHours={businessHours}
              holidays={holidays}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onBack={() => setClientScreen("welcome")}
              onHome={() => setClientScreen("welcome")}
              onBook={async (appt) => {
                const service = services.find((s) => s.id === appt.serviceId);
                const result = await insertAppointment(appt, service.duration);
                if (result.error) {
                  return { ok: false, message: "Esse horário acabou de ser ocupado por outra pessoa. Escolha outro horário, por favor." };
                }
                setAppointments((prev) => [...prev, result.data]);
                setConsentLogs((prev) => [...prev, { id: `c-${Date.now()}`, phone: appt.phone, name: appt.clientName, grantedAt: new Date().toISOString() }]);
                showToast("Agendamento confirmado!");
                return { ok: true };
              }}
            />
          )
        ) : !staffRole ? (
          <RoleGate professionals={professionals} adminPassword={salon.adminPassword} onSelect={setStaffRole} />
        ) : staffRole === "admin" ? (
          <AdminArea
            professionals={professionals} setProfessionals={setProfessionals}
            services={services} setServices={setServices}
            salon={salon} setSalon={setSalon}
            businessHours={businessHours} setBusinessHours={setBusinessHours}
            holidays={holidays} setHolidays={setHolidays}
            gallery={gallery} setGallery={setGallery}
            consentLogs={consentLogs}
            appointments={appointments}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          />
        ) : (
          <FuncionarioAgenda
            pro={activePro} appointments={appointments} services={services}
            clientNotes={clientNotes} setClientNotes={setClientNotes}
            setProfessionals={setProfessionals}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm shadow-lg flex items-center gap-2" style={{ background: INK, color: IVORY }}>
          <Check size={15} /> {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PORTA DE ENTRADA DA EQUIPE
// ============================================================
function RoleGate({ professionals, adminPassword, onSelect }) {
  const [mode, setMode] = useState("funcionaria"); // 'funcionaria' | 'admin'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (mode === "admin") {
      if (password === adminPassword) { onSelect("admin"); }
      else setError("Senha incorreta.");
      return;
    }
    const pro = professionals.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (pro && password === pro.password) {
      onSelect(pro.id);
    } else {
      setError("Nome ou senha incorretos.");
    }
  }

  return (
    <div className="pt-6">
      <div className="flex rounded-full overflow-hidden mb-5 w-fit" style={{ border: `1px solid ${INK}` }}>
        <button onClick={() => { setMode("funcionaria"); setError(""); }} className="text-xs px-4 py-1.5" style={{ background: mode === "funcionaria" ? INK : "transparent", color: mode === "funcionaria" ? IVORY : INK }}>Funcionária</button>
        <button onClick={() => { setMode("admin"); setError(""); }} className="text-xs px-4 py-1.5" style={{ background: mode === "admin" ? INK : "transparent", color: mode === "admin" ? IVORY : INK }}>Administração</button>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} style={{ color: MUTED }} />
        <h3 className="text-sm font-semibold">{mode === "admin" ? "Entrar como administrador(a)" : "Entrar com seu login"}</h3>
      </div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>{mode === "admin" ? "Use a senha configurada em Salão." : "Use o nome e a senha cadastrados pela administração no seu perfil."}</p>

      {mode === "funcionaria" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm"
          style={{ border: "1px solid #E4DACB", background: "#fff" }}
          autoFocus
        />
      )}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Senha"
        className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm"
        style={{ border: "1px solid #E4DACB", background: "#fff" }}
      />
      {error && <p className="text-xs mb-3" style={{ color: "#B5453D" }}>{error}</p>}
      <button onClick={submit} className="w-full py-3 rounded-full text-sm font-medium" style={{ background: INK, color: IVORY }}>Entrar</button>
    </div>
  );
}

// ============================================================
// ÁREA DO CLIENTE — boas-vindas
// ============================================================
function Welcome({ onStart, onMyAppointments, salon, businessHours, holidays, gallery }) {
  const today = getDayWindow(TODAY, businessHours, holidays);

  return (
    <div className="pt-2">
      <div className="rounded-2xl overflow-hidden mb-4 relative flex flex-col items-center justify-center text-center px-6" style={{ height: 220, background: `linear-gradient(135deg, ${WINE}, ${ROSE})` }}>
        <Sparkles size={22} color={IVORY} className="mb-2 opacity-90" />
        <h2 className="text-2xl font-semibold mb-1" style={{ color: IVORY, fontFamily: "Georgia, serif" }}>Seja bem-vinda à {salon.name}</h2>
        <p className="text-sm mb-5" style={{ color: IVORY, opacity: 0.9 }}>Vamos agendar um horário?</p>
        <button onClick={onStart} className="px-6 py-2.5 rounded-full text-sm font-medium shadow-sm" style={{ background: IVORY, color: WINE }}>Agendar horário</button>
      </div>

      {today.holiday && (
        <div className="rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2 text-xs" style={{ background: today.open ? `${GOLD}1A` : "#EFE7DC", color: INK }}>
          <Sun size={14} style={{ color: GOLD }} />
          {today.open
            ? <span>Hoje é feriado{today.holiday.label ? ` (${today.holiday.label})` : ""} — atendimento até {fmt(today.end)}</span>
            : <span>Hoje é feriado{today.holiday.label ? ` (${today.holiday.label})` : ""} — estamos fechados</span>}
        </div>
      )}

      <div className="rounded-lg p-3 mb-5 text-xs" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
        <p className="font-medium mb-1.5" style={{ color: MUTED }}>Horário de funcionamento</p>
        <div className="grid grid-cols-2 gap-y-0.5">
          {WEEKDAYS_SHORT.map((label, i) => (
            <p key={i}>
              <span style={{ color: INK }}>{label}: </span>
              <span style={{ color: MUTED }}>{businessHours[i]?.open ? `${fmt(businessHours[i].start)}–${fmt(businessHours[i].end)}` : "Fechado"}</span>
            </p>
          ))}
        </div>
      </div>

      <button onClick={onMyAppointments} className="w-full text-sm text-center mb-6" style={{ color: WINE }}>Já tenho agendamento — ver meus horários →</button>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Nosso trabalho</h3>
        <span className="text-xs" style={{ color: MUTED }}>Toque para ver</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {gallery.map((item) => <GalleryCard key={item.id} item={item} />)}
      </div>
      <p className="text-xs text-center" style={{ color: MUTED }}>Fotos e vídeos são publicados pela administração do salão.</p>
    </div>
  );
}

function GalleryCard({ item }) {
  const inner = (
    <div className="rounded-xl overflow-hidden relative flex flex-col items-center justify-center" style={{ height: 140, background: item.type === "photo" ? "#000" : `linear-gradient(160deg, ${item.color || WINE}, ${IVORY})` }}>
      {item.type === "photo" && item.media ? (
        <img src={item.media} alt={item.label} className="w-full h-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.75)" }}>
          {item.type === "video" ? <Play size={15} color={item.color || WINE} fill={item.color || WINE} /> : <Sparkles size={15} color={item.color || WINE} />}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2" style={{ background: "rgba(38,34,43,0.55)" }}>
        <p className="text-[11px] font-medium leading-tight" style={{ color: IVORY }}>{item.label}</p>
        {item.proName && <p className="text-[10px] leading-tight" style={{ color: IVORY, opacity: 0.8 }}>por {item.proName}</p>}
      </div>
    </div>
  );
  if (item.type === "video" && item.videoUrl) {
    return <a href={item.videoUrl} target="_blank" rel="noreferrer">{inner}</a>;
  }
  return inner;
}

// ============================================================
// ÁREA DO CLIENTE — meus agendamentos
// ============================================================
function MyAppointments({ appointments, professionals, services, onBack, onCancel }) {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("phone"); // phone -> code -> results
  const [sentCode, setSentCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");

  const results = appointments
    .filter((a) => a.status === "confirmed" && normalizePhone(a.phone) === normalizePhone(phone) && normalizePhone(phone).length >= 8)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);

  function requestCode() {
    if (normalizePhone(phone).length < 8) { setError("Digite um número de WhatsApp válido."); return; }
    setSentCode(String(Math.floor(1000 + Math.random() * 9000)));
    setError("");
    setStage("code");
  }
  function confirmCode() {
    if (codeInput === sentCode) { setStage("results"); setError(""); }
    else setError("Código incorreto.");
  }

  if (stage === "phone") {
    return (
      <div className="pt-2">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: MUTED }}><ChevronLeft size={16} /> Início</button>
        <h3 className="text-sm font-semibold mb-3">Digite o WhatsApp usado no agendamento</h3>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} placeholder="11 91234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button onClick={requestCode} className="px-4 rounded-lg" style={{ background: INK, color: IVORY }}><Search size={16} /></button>
        </div>
        {error && <p className="text-xs" style={{ color: "#B5453D" }}>{error}</p>}
        <p className="text-xs mt-3" style={{ color: MUTED }}>Por segurança, enviamos um código de confirmação antes de mostrar seus agendamentos — assim ninguém mais vê os seus dados só por digitar seu número.</p>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <div className="pt-2">
        <button onClick={() => { setStage("phone"); setCodeInput(""); setError(""); }} className="flex items-center gap-1 text-sm mb-4" style={{ color: MUTED }}><ChevronLeft size={16} /> Voltar</button>
        <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}44` }}>
          Em produção, esse código chegaria por WhatsApp para {phone}. Neste alpha, sem envio real, o código é: <strong>{sentCode}</strong>
        </div>
        <h3 className="text-sm font-semibold mb-3">Digite o código de 4 dígitos</h3>
        <input
          type="text" inputMode="numeric" maxLength={4} autoFocus
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && codeInput.length === 4 && confirmCode()}
          className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 rounded-lg mb-3"
          style={{ border: "1px solid #E4DACB", background: "#fff" }}
          placeholder="••••"
        />
        {error && <p className="text-xs mb-3" style={{ color: "#B5453D" }}>{error}</p>}
        <button onClick={confirmCode} disabled={codeInput.length < 4} className="w-full py-3 rounded-full text-sm font-medium disabled:opacity-40" style={{ background: INK, color: IVORY }}>Confirmar</button>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: MUTED }}><ChevronLeft size={16} /> Início</button>
      {results.length === 0 && <p className="text-sm text-center py-6" style={{ color: MUTED }}>Nenhum agendamento encontrado para esse número.</p>}
      {results.map((a) => {
        const pro = professionals.find((p) => p.id === a.proId);
        const service = services.find((s) => s.id === a.serviceId);
        return (
          <div key={a.id} className="rounded-lg p-3 mb-2 flex items-center justify-between" style={{ background: "#fff", border: `1px solid ${pro.color}33` }}>
            <div>
              <p className="text-sm font-medium capitalize">{dateLabel(a.date)}</p>
              <p className="text-xs" style={{ color: MUTED }}>{fmt(a.start)} · {service.name} com <span style={{ color: pro.color }}>{pro.name}</span></p>
            </div>
            <button onClick={() => onCancel(a.id)} className="text-xs px-2 py-1 rounded-full" style={{ color: "#B5453D" }}>Cancelar</button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ÁREA DO CLIENTE — fluxo de agendamento
// ============================================================
function ClientBooking({ professionals, services, appointments, businessHours, holidays, selectedDate, setSelectedDate, onBack, onHome, onBook }) {
  const [step, setStep] = useState(1);
  const [proId, setProId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [start, setStart] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const pro = professionals.find((p) => p.id === proId);
  const service = services.find((s) => s.id === serviceId);

  function reset() {
    setStep(1); setProId(null); setServiceId(null); setStart(null);
    setName(""); setPhone(""); setConsent(false); setDone(false);
  }

  if (done) {
    return (
      <div className="pt-16 text-center">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: `${WINE}1A` }}><Check size={26} color={WINE} /></div>
        <h2 className="text-lg font-semibold mb-1">Agendamento confirmado</h2>
        <p className="text-sm mb-6" style={{ color: MUTED }}>{service.name} com {pro.name} · {dateLabel(selectedDate)} às {fmt(start)}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={onHome} className="text-sm px-5 py-2.5 rounded-full" style={{ border: `1px solid ${INK}`, color: INK }}>Voltar ao início</button>
          <button onClick={reset} className="text-sm px-5 py-2.5 rounded-full" style={{ background: INK, color: IVORY }}>Novo agendamento</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <Stepper step={step} />

      {step === 1 && (
        <StepBlock icon={<CalendarIcon size={16} />} title="Escolha a data" onBack={onBack}>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSelectedDate(TODAY)} className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: selectedDate === TODAY ? INK : "transparent", color: selectedDate === TODAY ? IVORY : INK, border: `1px solid ${INK}` }}>Hoje</button>
            <button onClick={() => setSelectedDate(addDays(TODAY, 1))} className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: selectedDate === addDays(TODAY, 1) ? INK : "transparent", color: selectedDate === addDays(TODAY, 1) ? IVORY : INK, border: `1px solid ${INK}` }}>Amanhã</button>
            <div className="relative flex-1">
              <input
                type="date"
                min={TODAY}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                onFocus={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-full"
                style={{ border: "1px solid #E4DACB", background: "#fff" }}
              />
              <CalendarIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
            </div>
          </div>
          <p className="text-xs mb-4 capitalize" style={{ color: MUTED }}>{dateLabel(selectedDate)}</p>
          <p className="text-xs font-medium mb-2" style={{ color: MUTED }}>Profissional</p>
          {professionals.map((p) => {
            const { status, vacation } = getProStatus(p, selectedDate, businessHours, holidays, appointments, services);
            const info = STATUS_LABEL[status];
            const disabled = status !== "disponivel";
            return (
              <button
                key={p.id}
                disabled={disabled}
                onClick={() => { setProId(p.id); setStep(2); }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition mb-2"
                style={{ border: `1px solid ${disabled ? "#E4DACB" : p.color}`, background: disabled ? "#F5F0E8" : "#fff", opacity: disabled ? 0.75 : 1 }}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} className="w-8 h-8 rounded-full object-cover" style={{ opacity: disabled ? 0.6 : 1 }} />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: `${p.color}22`, color: p.color }}>{p.name[0]}</span>
                  )}
                  {p.name}
                </span>
                <span className="text-xs text-right" style={{ color: info.color }}>
                  {info.text}
                  {status === "ferias" && vacation && <><br /><span style={{ color: MUTED }}>{fmtShort(vacation.start)}–{fmtShort(vacation.end)}</span></>}
                </span>
              </button>
            );
          })}
        </StepBlock>
      )}

      {step === 2 && (
        <StepBlock icon={<Scissors size={16} />} title="Escolha o serviço" onBack={() => setStep(1)}>
          {services.map((s) => (
            <SelectRow key={s.id} active={serviceId === s.id} color={pro.color} label={s.name} sub={`${s.duration} min · R$ ${s.price}`} onClick={() => { setServiceId(s.id); setStep(3); }} />
          ))}
        </StepBlock>
      )}

      {step === 3 && (
        <StepBlock icon={<Clock size={16} />} title="Escolha o horário" onBack={() => setStep(2)}>
          <p className="text-xs mb-3 capitalize" style={{ color: MUTED }}>{dateLabel(selectedDate)} · {pro.name}</p>
          <div className="grid grid-cols-4 gap-2">
            {getAvailableSlots(pro, service, selectedDate, businessHours, holidays, appointments, services).length === 0 && (
              <p className="col-span-4 text-sm py-6 text-center" style={{ color: MUTED }}>Sem horários disponíveis neste dia.</p>
            )}
            {getAvailableSlots(pro, service, selectedDate, businessHours, holidays, appointments, services).map((t) => (
              <button key={t} onClick={() => { setStart(t); setStep(4); }} className="text-sm py-2 rounded-lg border transition" style={{ borderColor: pro.color, color: pro.color }}>{fmt(t)}</button>
            ))}
          </div>
        </StepBlock>
      )}

      {step === 4 && (
        <StepBlock icon={<User size={16} />} title="Seus dados" onBack={() => setStep(3)}>
          <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: `${pro.color}0F`, border: `1px solid ${pro.color}33` }}>
            <strong>{service.name}</strong> com {pro.name} — {dateLabel(selectedDate)} às {fmt(start)}
          </div>
          <input className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} placeholder="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="flex items-start gap-2 text-xs mb-4" style={{ color: MUTED }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span><ShieldCheck size={12} className="inline mr-1" style={{ color: WINE }} />Autorizo o uso dos meus dados para confirmar e gerenciar este agendamento, conforme a LGPD.</span>
          </label>
          {submitError && <p className="text-xs mb-3" style={{ color: "#B5453D" }}>{submitError}</p>}
          <button
            disabled={!name || !phone || !consent || submitting}
            onClick={async () => {
              setSubmitting(true);
              setSubmitError("");
              const result = await onBook({ proId, serviceId, date: selectedDate, start, clientName: name, phone, status: "confirmed" });
              setSubmitting(false);
              if (result?.ok) {
                setDone(true);
              } else {
                setSubmitError(result?.message || "Não foi possível confirmar. Tente novamente.");
              }
            }}
            className="w-full py-3 rounded-full text-sm font-medium transition disabled:opacity-40"
            style={{ background: pro.color, color: IVORY }}
          >
            {submitting ? "Confirmando…" : "Confirmar agendamento"}
          </button>
        </StepBlock>
      )}
    </div>
  );
}

function Stepper({ step }) {
  return <div className="flex gap-1.5 mb-5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-1 flex-1 rounded-full" style={{ background: n <= step ? WINE : "#E4DACB" }} />)}</div>;
}
function StepBlock({ icon, title, onBack, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {onBack && <button onClick={onBack} className="p-1 -ml-1"><ChevronLeft size={18} /></button>}
        <span style={{ color: WINE }}>{icon}</span><h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function SelectRow({ active, color, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition" style={{ border: `1px solid ${active ? color : "#E4DACB"}`, background: active ? `${color}0F` : "#fff" }}>
      <span className="flex items-center gap-2 text-sm font-medium"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>
      {sub && <span className="text-xs" style={{ color: MUTED }}>{sub}</span>}
    </button>
  );
}

function DateStrip({ selectedDate, setSelectedDate, countFn }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
      {days.map((d) => {
        const active = d === selectedDate;
        const count = countFn(d);
        const wd = weekdayOf(d);
        return (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className="flex-shrink-0 flex flex-col items-center rounded-lg px-2.5 py-2"
            style={{ minWidth: 52, background: active ? INK : "#fff", border: `1px solid ${active ? INK : "#EDE4D6"}` }}
          >
            <span className="text-[10px]" style={{ color: active ? IVORY : MUTED }}>{WEEKDAYS_SHORT[wd]}</span>
            <span className="text-sm font-semibold" style={{ color: active ? IVORY : INK }}>{d.slice(8, 10)}</span>
            <span className="text-[10px] mt-0.5 px-1.5 rounded-full" style={{ background: active ? "rgba(255,255,255,0.25)" : `${WINE}14`, color: active ? IVORY : WINE }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// ÁREA DO FUNCIONÁRIO
// ============================================================
function FuncionarioAgenda({ pro, appointments, services, clientNotes, setClientNotes, setProfessionals, selectedDate, setSelectedDate }) {
  const [tab, setTab] = useState("agenda");
  return (
    <div className="pt-2">
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab("agenda")} className="text-xs px-3 py-1.5 rounded-full" style={{ background: tab === "agenda" ? INK : "transparent", color: tab === "agenda" ? IVORY : INK, border: `1px solid ${INK}` }}>Agenda</button>
        <button onClick={() => setTab("perfil")} className="text-xs px-3 py-1.5 rounded-full" style={{ background: tab === "perfil" ? INK : "transparent", color: tab === "perfil" ? IVORY : INK, border: `1px solid ${INK}` }}>Perfil</button>
      </div>
      {tab === "agenda" ? (
        <FuncionarioAgendaTab pro={pro} appointments={appointments} services={services} clientNotes={clientNotes} setClientNotes={setClientNotes} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      ) : (
        <ProfileTab pro={pro} setProfessionals={setProfessionals} />
      )}
    </div>
  );
}

function ProfileTab({ pro, setProfessionals }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);

  function submit() {
    if (current !== pro.password) { setMessage({ type: "error", text: "Senha atual incorreta." }); return; }
    if (next.length < 4) { setMessage({ type: "error", text: "A nova senha precisa ter pelo menos 4 caracteres." }); return; }
    if (next !== confirm) { setMessage({ type: "error", text: "As senhas não coincidem." }); return; }
    setProfessionals((prev) => prev.map((p) => (p.id === pro.id ? { ...p, password: next } : p)));
    setCurrent(""); setNext(""); setConfirm("");
    setMessage({ type: "success", text: "Senha alterada com sucesso." });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {pro.photo ? (
          <img src={pro.photo} alt={pro.name} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold" style={{ background: `${pro.color}22`, color: pro.color }}>{pro.name[0]}</div>
        )}
        <div>
          <p className="text-sm font-semibold">{pro.name}</p>
          <p className="text-xs" style={{ color: MUTED }}>Perfil da profissional</p>
        </div>
      </div>

      <p className="text-sm font-semibold mb-3">Alterar senha</p>
      <input type="password" placeholder="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      <input type="password" placeholder="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      <input type="password" placeholder="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      {message && <p className="text-xs mb-3" style={{ color: message.type === "error" ? "#B5453D" : "#5C8A5C" }}>{message.text}</p>}
      <button onClick={submit} className="w-full py-3 rounded-full text-sm font-medium" style={{ background: pro.color, color: IVORY }}>Salvar nova senha</button>
    </div>
  );
}

function FuncionarioAgendaTab({ pro, appointments, services, clientNotes, setClientNotes, selectedDate, setSelectedDate }) {
  const [expandedId, setExpandedId] = useState(null);
  useEffect(() => { setSelectedDate(TODAY); }, []);
  const dayAppts = appointments.filter((a) => a.proId === pro.id && a.date === selectedDate && a.status === "confirmed").sort((a, b) => a.start - b.start);
  const countFn = (d) => appointments.filter((a) => a.proId === pro.id && a.date === d && a.status === "confirmed").length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 rounded-full" style={{ background: "#EFE7DC" }}><ChevronLeft size={16} /></button>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }} onFocus={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }} className="flex-1 text-sm text-center py-1.5 rounded-full capitalize" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 rounded-full" style={{ background: "#EFE7DC" }}><ChevronRight size={16} /></button>
      </div>
      <DateStrip selectedDate={selectedDate} setSelectedDate={setSelectedDate} countFn={countFn} />
      <p className="text-xs mb-4 capitalize text-center" style={{ color: MUTED }}>{dateLabel(selectedDate)}</p>
      {dayAppts.length === 0 && <p className="text-sm text-center py-10" style={{ color: MUTED }}>Nenhum atendimento marcado para este dia.</p>}
      {dayAppts.map((a) => {
        const service = services.find((s) => s.id === a.serviceId);
        const phoneKey = normalizePhone(a.phone);
        const visits = appointments.filter((x) => normalizePhone(x.phone) === phoneKey && x.status === "confirmed").length;
        const expanded = expandedId === a.id;
        return (
          <div key={a.id} className="rounded-lg mb-2 overflow-hidden" style={{ border: `1px solid ${pro.color}33`, background: "#fff" }}>
            <button onClick={() => setExpandedId(expanded ? null : a.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div>
                <p className="text-sm font-semibold">{a.clientName}</p>
                <p className="text-xs" style={{ color: MUTED }}>{service.name} · {fmt(a.start)}–{fmt(a.start + service.duration)}</p>
              </div>
              <span className="text-xs" style={{ color: pro.color }}>{expanded ? "Fechar" : "Ver dados"}</span>
            </button>
            {expanded && (
              <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "#F2EBDF" }}>
                <p className="text-xs flex items-center gap-1.5 mb-1" style={{ color: MUTED }}><Phone size={12} /> {a.phone}</p>
                <p className="text-xs mb-3" style={{ color: MUTED }}>{visits}º atendimento com esta cliente</p>
                <label className="text-xs font-medium block mb-1">Observações</label>
                <textarea className="w-full text-sm p-2 rounded-lg" style={{ border: "1px solid #E4DACB", background: IVORY, minHeight: 60 }} placeholder="Ex: prefere tom nude, alergia a determinado produto…" value={clientNotes[phoneKey] || ""} onChange={(e) => setClientNotes((prev) => ({ ...prev, [phoneKey]: e.target.value }))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ÁREA ADMINISTRATIVA
// ============================================================
const PX_PER_MIN = 1.5;

function AdminArea({ professionals, setProfessionals, services, setServices, salon, setSalon, businessHours, setBusinessHours, holidays, setHolidays, gallery, setGallery, consentLogs, appointments, selectedDate, setSelectedDate }) {
  const [tab, setTab] = useState("agenda");
  const tabs = [
    { id: "agenda", label: "Agenda geral" },
    { id: "financeiro", label: "Financeiro" },
    { id: "profissionais", label: "Profissionais" },
    { id: "servicos", label: "Serviços" },
    { id: "horarios", label: "Horários" },
    { id: "feriados", label: "Feriados" },
    { id: "galeria", label: "Galeria" },
    { id: "salao", label: "Salão" },
  ];

  function exportBackup() {
    const data = { exportedAt: new Date().toISOString(), salon, professionals, services, appointments, businessHours, holidays, gallery, consentLogs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${salon.name.replace(/\s+/g, "-").toLowerCase()}-${TODAY}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: tab === t.id ? INK : "transparent", color: tab === t.id ? IVORY : INK, border: `1px solid ${INK}` }}>{t.label}</button>
          ))}
        </div>
        <button onClick={exportBackup} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full flex-shrink-0 ml-2" style={{ border: "1px solid #E4DACB", color: MUTED }} title="Baixar backup dos dados">
          <Download size={13} />
        </button>
      </div>
      {tab === "agenda" && <AgendaOverview professionals={professionals} services={services} appointments={appointments} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
      {tab === "financeiro" && <FinanceAdmin professionals={professionals} services={services} appointments={appointments} />}
      {tab === "profissionais" && <ProfessionalsAdmin professionals={professionals} setProfessionals={setProfessionals} />}
      {tab === "servicos" && <ServicesAdmin services={services} setServices={setServices} />}
      {tab === "horarios" && <BusinessHoursAdmin businessHours={businessHours} setBusinessHours={setBusinessHours} />}
      {tab === "feriados" && <HolidaysAdmin holidays={holidays} setHolidays={setHolidays} businessHours={businessHours} />}
      {tab === "galeria" && <GalleryAdmin gallery={gallery} setGallery={setGallery} professionals={professionals} />}
      {tab === "salao" && <SalonAdmin salon={salon} setSalon={setSalon} consentLogs={consentLogs} />}
    </div>
  );
}

function FinanceAdmin({ professionals, services, appointments }) {
  const [range, setRange] = useState("dia");
  const [refDate, setRefDate] = useState(TODAY);

  let fromDate = refDate, toDate = refDate;
  if (range === "semana") [fromDate, toDate] = getWeekRange(refDate);
  if (range === "mes") [fromDate, toDate] = getMonthRange(refDate);

  const filtered = appointments.filter((a) => a.status === "confirmed" && a.date >= fromDate && a.date <= toDate);
  const total = filtered.reduce((sum, a) => sum + services.find((s) => s.id === a.serviceId).price, 0);

  const byPro = professionals
    .map((p) => {
      const proAppts = filtered.filter((a) => a.proId === p.id);
      return { pro: p, count: proAppts.length, total: proAppts.reduce((sum, a) => sum + services.find((s) => s.id === a.serviceId).price, 0) };
    })
    .sort((a, b) => b.total - a.total);

  const byService = services
    .map((s) => {
      const svcAppts = filtered.filter((a) => a.serviceId === s.id);
      return { service: s, count: svcAppts.length, total: svcAppts.length * s.price };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {[{ id: "dia", label: "Dia" }, { id: "semana", label: "Semana" }, { id: "mes", label: "Mês" }].map((r) => (
          <button key={r.id} onClick={() => setRange(r.id)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: range === r.id ? INK : "transparent", color: range === r.id ? IVORY : INK, border: `1px solid ${INK}` }}>{r.label}</button>
        ))}
        <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-xs px-2 py-1.5 rounded-full ml-auto" style={{ border: "1px solid #E4DACB" }} />
      </div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>{range === "dia" ? dateLabel(fromDate) : `${fmtShort(fromDate)} a ${fmtShort(toDate)}`}</p>

      <div className="rounded-lg p-4 mb-5 text-center" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
        <p className="text-xs mb-1" style={{ color: MUTED }}>Receita no período</p>
        <p className="text-2xl font-semibold" style={{ color: WINE }}>R$ {total.toFixed(2)}</p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>{filtered.length} atendimento{filtered.length === 1 ? "" : "s"}</p>
      </div>

      <p className="text-xs font-medium mb-2" style={{ color: MUTED }}>Por profissional</p>
      {byPro.map(({ pro, total, count }) => (
        <div key={pro.id} className="flex items-center justify-between rounded-lg px-3 py-2 mb-1.5" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
          <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full" style={{ background: pro.color }} />{pro.name}</span>
          <span className="text-xs" style={{ color: MUTED }}>{count} atend. · <strong style={{ color: INK }}>R$ {total.toFixed(2)}</strong></span>
        </div>
      ))}

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: MUTED }}>Por serviço</p>
      {byService.length === 0 && <p className="text-sm text-center py-4" style={{ color: MUTED }}>Nenhum atendimento no período.</p>}
      {byService.map(({ service, count, total }) => (
        <div key={service.id} className="flex items-center justify-between rounded-lg px-3 py-2 mb-1.5" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
          <span className="text-sm">{service.name}</span>
          <span className="text-xs" style={{ color: MUTED }}>{count}x · <strong style={{ color: INK }}>R$ {total.toFixed(2)}</strong></span>
        </div>
      ))}
    </div>
  );
}

function AgendaOverview({ professionals, services, appointments, selectedDate, setSelectedDate }) {
  const [proFilter, setProFilter] = useState(null);
  useEffect(() => { setSelectedDate(TODAY); }, []);
  const dayStart = 8 * 60, dayEnd = 19 * 60;
  const totalHeight = (dayEnd - dayStart) * PX_PER_MIN;
  const hourMarks = [];
  for (let t = dayStart; t <= dayEnd; t += 60) hourMarks.push(t);
  const team = proFilter ? professionals.filter((p) => p.id === proFilter) : professionals;
  const dayAppointments = appointments.filter((a) => a.date === selectedDate);
  const revenue = dayAppointments.filter((a) => a.status === "confirmed").reduce((sum, a) => sum + services.find((s) => s.id === a.serviceId).price, 0);
  const countFn = (d) => appointments.filter((a) => a.date === d && a.status === "confirmed").length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 rounded-full" style={{ background: "#EFE7DC" }}><ChevronLeft size={16} /></button>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }} onFocus={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }} className="flex-1 text-sm text-center py-1.5 rounded-full" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 rounded-full" style={{ background: "#EFE7DC" }}><ChevronRight size={16} /></button>
      </div>
      <DateStrip selectedDate={selectedDate} setSelectedDate={setSelectedDate} countFn={countFn} />
      <p className="text-xs mb-4 capitalize text-center" style={{ color: MUTED }}>{dateLabel(selectedDate)}</p>
      <div className="rounded-lg p-3 mb-4 flex items-center justify-between text-sm" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
        <span style={{ color: MUTED }}>Receita do dia</span><span className="font-semibold" style={{ color: WINE }}>R$ {revenue.toFixed(2)}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setProFilter(null)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: proFilter === null ? INK : "transparent", color: proFilter === null ? IVORY : INK, border: `1px solid ${INK}` }}>Todas</button>
        {professionals.map((p) => (
          <button key={p.id} onClick={() => setProFilter(proFilter === p.id ? null : p.id)} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: proFilter === p.id ? p.color : "transparent", color: proFilter === p.id ? IVORY : INK, border: `1px solid ${p.color}` }}>
            <span className="w-2 h-2 rounded-full" style={{ background: proFilter === p.id ? IVORY : p.color }} />{p.name}
          </button>
        ))}
      </div>
      <div className="flex">
        <div style={{ width: 48 }} className="relative flex-shrink-0">{hourMarks.map((t) => <div key={t} style={{ position: "absolute", top: (t - dayStart) * PX_PER_MIN - 7 }} className="text-[10px]">{fmt(t)}</div>)}</div>
        <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${team.length}, minmax(0,1fr))` }}>
          {team.map((pro) => {
            const proAppts = dayAppointments.filter((a) => a.proId === pro.id && a.status === "confirmed");
            return (
              <div key={pro.id} className="relative rounded-lg" style={{ height: totalHeight, background: "#fff", border: "1px solid #EDE4D6" }}>
                {hourMarks.map((t) => <div key={t} style={{ position: "absolute", top: (t - dayStart) * PX_PER_MIN, left: 0, right: 0, borderTop: "1px solid #F2EBDF" }} />)}
                <div className="absolute -top-6 left-0 text-xs font-medium flex items-center gap-1.5" style={{ color: pro.color }}><span className="w-2 h-2 rounded-full" style={{ background: pro.color }} />{pro.name}</div>
                <div className="absolute left-1 right-1 rounded-md px-2 py-1" style={{ top: (pro.lunchStart - dayStart) * PX_PER_MIN, height: (pro.lunchEnd - pro.lunchStart) * PX_PER_MIN, background: "#EDE4D6", color: "#7A7166" }}><p className="text-[10px] font-medium">Almoço</p></div>
                {proAppts.map((a) => {
                  const service = services.find((s) => s.id === a.serviceId);
                  const top = (a.start - dayStart) * PX_PER_MIN;
                  const height = service.duration * PX_PER_MIN;
                  return (
                    <div key={a.id} className="absolute left-1 right-1 rounded-md px-2 py-1" style={{ top, height, background: `${pro.color}1A`, borderLeft: `3px solid ${pro.color}` }}>
                      <p className="text-[11px] font-semibold leading-tight truncate">{a.clientName}</p>
                      <p className="text-[10px] leading-tight truncate" style={{ color: pro.color }}>{service.name}</p>
                      <p className="text-[10px] leading-tight flex items-center gap-1 mt-0.5" style={{ opacity: 0.7 }}><Clock size={9} /> {fmt(a.start)}–{fmt(a.start + service.duration)}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProfessionalsAdmin({ professionals, setProfessionals }) {
  function update(id, field, value) {
    setProfessionals((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    updateProfessionalField(id, field, value);
  }
  function remove(id) {
    setProfessionals((prev) => prev.filter((p) => p.id !== id));
    deleteProfessional(id);
  }
  async function add() {
    const color = PALETTE[professionals.length % PALETTE.length];
    const newPro = await insertProfessional("Nova profissional", color);
    if (newPro) setProfessionals((prev) => [...prev, newPro]);
  }
  async function handlePhoto(id, e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 300, 0.8);
      update(id, "photo", dataUrl);
    } catch {
      // ignora falha silenciosamente nesta versão alpha
    } finally {
      e.target.value = "";
    }
  }
  async function addVacation(proId) {
    const vac = await insertVacation(proId, TODAY, addDays(TODAY, 7));
    if (vac) setProfessionals((prev) => prev.map((p) => (p.id === proId ? { ...p, vacations: [...(p.vacations || []), vac] } : p)));
  }
  function updateVacation(proId, vacId, field, value) {
    setProfessionals((prev) => prev.map((p) => p.id === proId ? { ...p, vacations: p.vacations.map((v) => v.id === vacId ? { ...v, [field]: value } : v) } : p));
    updateVacationField(vacId, field, value);
  }
  function removeVacation(proId, vacId) {
    setProfessionals((prev) => prev.map((p) => p.id === proId ? { ...p, vacations: p.vacations.filter((v) => v.id !== vacId) } : p));
    deleteVacation(vacId);
  }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Cadastro visível só para a administração — define quem aparece na agenda e no app do cliente.</p>
      {professionals.map((p) => (
        <div key={p.id} className="rounded-lg p-3 mb-3" style={{ background: "#fff", border: `1px solid ${p.color}44` }}>
          <div className="flex items-center gap-3 mb-2">
            <label className="relative flex-shrink-0 cursor-pointer">
              {p.photo ? (
                <img src={p.photo} alt={p.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: `${p.color}22`, color: p.color }}>{p.name[0]}</div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: INK }}>
                <Plus size={11} color={IVORY} />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(p.id, e)} />
            </label>
            <input value={p.name} onChange={(e) => update(p.id, "name", e.target.value)} className="flex-1 text-sm font-medium px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
            <button onClick={() => remove(p.id)} className="p-1.5 rounded" style={{ color: "#B5453D" }}><Trash2 size={15} /></button>
          </div>
          <p className="text-[11px] mb-2" style={{ color: MUTED }}>Toque na foto para trocar — é o que a cliente vê ao escolher a profissional.</p>
          <div className="flex gap-1.5 mb-2">
            {PALETTE.map((c) => <button key={c} onClick={() => update(p.id, "color", c)} className="w-6 h-6 rounded-full" style={{ background: c, border: p.color === c ? `2px solid ${INK}` : "2px solid transparent" }} />)}
          </div>
          <label className="text-xs block mb-2">Login (nome: <strong>{p.name}</strong>) — senha de acesso
            <input
              value={p.password || ""}
              onChange={(e) => update(p.id, "password", e.target.value)}
              className="w-full px-2 py-1.5 rounded mt-1"
              style={{ border: "1px solid #E4DACB" }}
              placeholder="senha"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <label>Início <input type="time" value={fmt(p.workStart)} onChange={(e) => update(p.id, "workStart", parseTime(e.target.value))} className="w-full px-2 py-1 rounded mt-1" style={{ border: "1px solid #E4DACB" }} /></label>
            <label>Fim <input type="time" value={fmt(p.workEnd)} onChange={(e) => update(p.id, "workEnd", parseTime(e.target.value))} className="w-full px-2 py-1 rounded mt-1" style={{ border: "1px solid #E4DACB" }} /></label>
            <label>Almoço início <input type="time" value={fmt(p.lunchStart)} onChange={(e) => update(p.id, "lunchStart", parseTime(e.target.value))} className="w-full px-2 py-1 rounded mt-1" style={{ border: "1px solid #E4DACB" }} /></label>
            <label>Almoço fim <input type="time" value={fmt(p.lunchEnd)} onChange={(e) => update(p.id, "lunchEnd", parseTime(e.target.value))} className="w-full px-2 py-1 rounded mt-1" style={{ border: "1px solid #E4DACB" }} /></label>
          </div>
          <div className="pt-2 border-t" style={{ borderColor: "#F2EBDF" }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: MUTED }}>Férias</p>
            {(p.vacations || []).map((v) => (
              <div key={v.id} className="flex items-center gap-2 mb-1.5">
                <input type="date" value={v.start} onChange={(e) => updateVacation(p.id, v.id, "start", e.target.value)} className="text-xs px-2 py-1 rounded flex-1" style={{ border: "1px solid #E4DACB" }} />
                <span className="text-xs" style={{ color: MUTED }}>até</span>
                <input type="date" value={v.end} onChange={(e) => updateVacation(p.id, v.id, "end", e.target.value)} className="text-xs px-2 py-1 rounded flex-1" style={{ border: "1px solid #E4DACB" }} />
                <button onClick={() => removeVacation(p.id, v.id)} style={{ color: "#B5453D" }}><X size={13} /></button>
              </div>
            ))}
            <button onClick={() => addVacation(p.id)} className="text-xs flex items-center gap-1" style={{ color: p.color }}><Plus size={12} /> Adicionar período de férias</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm" style={{ border: `1px dashed ${INK}`, color: INK }}><Plus size={14} /> Adicionar profissional</button>
    </div>
  );
}

function ServicesAdmin({ services, setServices }) {
  function update(id, field, value) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    updateServiceField(id, field, value);
  }
  function remove(id) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    deleteService(id);
  }
  async function add() {
    const newSvc = await insertService("Novo serviço");
    if (newSvc) setServices((prev) => [...prev, newSvc]);
  }
  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>A duração de cada serviço é o que alimenta o bloqueio automático de horários na agenda.</p>
      {services.map((s) => (
        <div key={s.id} className="rounded-lg p-3 mb-2 flex items-center gap-2" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
          <input value={s.name} onChange={(e) => update(s.id, "name", e.target.value)} className="flex-1 text-sm px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
          <input type="number" value={s.duration} onChange={(e) => update(s.id, "duration", Number(e.target.value))} className="w-16 text-sm px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
          <span className="text-xs" style={{ color: MUTED }}>min</span>
          <input type="number" value={s.price} onChange={(e) => update(s.id, "price", Number(e.target.value))} className="w-16 text-sm px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
          <button onClick={() => remove(s.id)} className="p-1.5 rounded" style={{ color: "#B5453D" }}><Trash2 size={15} /></button>
        </div>
      ))}
      <button onClick={add} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm" style={{ border: `1px dashed ${INK}`, color: INK }}><Plus size={14} /> Adicionar serviço</button>
    </div>
  );
}

function BusinessHoursAdmin({ businessHours, setBusinessHours }) {
  function update(day, field, value) {
    setBusinessHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }
  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Define os horários padrão da semana. O app do cliente só oferece horários dentro dessa janela — e o último horário disponível é sempre pelo menos 1h antes do fechamento.</p>
      {WEEKDAYS.map((label, day) => {
        const cfg = businessHours[day] || { open: false };
        return (
          <div key={day} className="rounded-lg p-3 mb-2 flex items-center gap-3" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
            <label className="flex items-center gap-2 w-28 flex-shrink-0">
              <input type="checkbox" checked={!!cfg.open} onChange={(e) => update(day, "open", e.target.checked)} />
              <span className="text-sm">{label}</span>
            </label>
            {cfg.open ? (
              <div className="flex items-center gap-2 text-xs">
                <input type="time" value={fmt(cfg.start ?? 480)} onChange={(e) => update(day, "start", parseTime(e.target.value))} className="px-2 py-1 rounded" style={{ border: "1px solid #E4DACB" }} />
                <span style={{ color: MUTED }}>às</span>
                <input type="time" value={fmt(cfg.end ?? 1020)} onChange={(e) => update(day, "end", parseTime(e.target.value))} className="px-2 py-1 rounded" style={{ border: "1px solid #E4DACB" }} />
              </div>
            ) : <span className="text-xs" style={{ color: MUTED }}>Fechado</span>}
          </div>
        );
      })}
    </div>
  );
}

function HolidaysAdmin({ holidays, setHolidays, businessHours }) {
  function update(id, field, value) { setHolidays((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))); }
  function remove(id) { setHolidays((prev) => prev.filter((h) => h.id !== id)); }
  function add() { setHolidays((prev) => [...prev, { id: `h-${Date.now()}`, date: addDays(TODAY, 7), label: "", isOpen: false, closeTime: 12 * 60 }]); }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Marque um feriado como fechado, ou aberto com horário reduzido. Isso aparece automaticamente na tela inicial do cliente naquele dia.</p>
      {holidays.map((h) => (
        <div key={h.id} className="rounded-lg p-3 mb-3" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
          <div className="flex items-center gap-2 mb-2">
            <input type="date" value={h.date} onChange={(e) => update(h.id, "date", e.target.value)} className="text-sm px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
            <input value={h.label} onChange={(e) => update(h.id, "label", e.target.value)} placeholder="Nome (ex: Natal)" className="flex-1 text-sm px-2 py-1.5 rounded" style={{ border: "1px solid #E4DACB" }} />
            <button onClick={() => remove(h.id)} className="p-1.5 rounded" style={{ color: "#B5453D" }}><Trash2 size={15} /></button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => update(h.id, "isOpen", false)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: !h.isOpen ? INK : "transparent", color: !h.isOpen ? IVORY : INK, border: `1px solid ${INK}` }}>Fechado</button>
            <button onClick={() => update(h.id, "isOpen", true)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: h.isOpen ? INK : "transparent", color: h.isOpen ? IVORY : INK, border: `1px solid ${INK}` }}>Aberto</button>
          </div>
          {h.isOpen && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => update(h.id, "closeTime", 12 * 60)} className="text-xs px-2.5 py-1 rounded-full" style={{ border: "1px solid #E4DACB", color: MUTED }}>Até meio-dia</button>
              <button onClick={() => update(h.id, "closeTime", businessHours[weekdayOf(h.date)]?.end ?? 18 * 60)} className="text-xs px-2.5 py-1 rounded-full" style={{ border: "1px solid #E4DACB", color: MUTED }}>Dia todo</button>
              <span className="text-xs" style={{ color: MUTED }}>Fecha às</span>
              <input type="time" value={fmt(h.closeTime ?? 720)} onChange={(e) => update(h.id, "closeTime", parseTime(e.target.value))} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #E4DACB" }} />
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm" style={{ border: `1px dashed ${INK}`, color: INK }}><Plus size={14} /> Adicionar feriado</button>
    </div>
  );
}

function GalleryAdmin({ gallery, setGallery, professionals }) {
  const [label, setLabel] = useState("");
  const [proId, setProId] = useState(professionals[0]?.id || "");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await resizeImage(file);
      const pro = professionals.find((p) => p.id === proId);
      setGallery((prev) => [...prev, { id: `g-${Date.now()}`, type: "photo", media: dataUrl, label: label || "Trabalho", proName: pro?.name || "", color: pro?.color || WINE }]);
      setLabel("");
    } catch {
      setError("Não foi possível processar essa imagem. Tente outro arquivo.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function addVideo() {
    if (!videoUrl.trim()) return;
    const pro = professionals.find((p) => p.id === proId);
    setGallery((prev) => [...prev, { id: `g-${Date.now()}`, type: "video", videoUrl: videoUrl.trim(), label: label || "Vídeo", proName: pro?.name || "", color: pro?.color || WINE }]);
    setVideoUrl("");
    setLabel("");
  }

  function remove(id) {
    setGallery((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Essas fotos e vídeos aparecem na seção "Nosso trabalho" da tela inicial do cliente.</p>

      <div className="rounded-lg p-3 mb-5" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
        <label className="text-xs font-medium block mb-1">Legenda</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Alongamento em gel" className="w-full mb-2 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #E4DACB" }} />

        <label className="text-xs font-medium block mb-1">Profissional</label>
        <select value={proId} onChange={(e) => setProId(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #E4DACB" }}>
          {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label className="text-xs font-medium block mb-1">Enviar foto</label>
        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={busy} className="w-full text-xs mb-1" />
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>{busy ? "Processando foto…" : "A foto é redimensionada automaticamente antes de salvar."}</p>
        {error && <p className="text-[11px] mb-3" style={{ color: "#B5453D" }}>{error}</p>}

        <label className="text-xs font-medium block mb-1">Ou link de vídeo (Instagram, YouTube…)</label>
        <div className="flex gap-2">
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #E4DACB" }} />
          <button onClick={addVideo} className="px-3 rounded-lg text-sm" style={{ background: INK, color: IVORY }}>Adicionar</button>
        </div>
        <p className="text-[11px] mt-1" style={{ color: MUTED }}>Vídeos ficam hospedados fora do app por enquanto — aqui é só o link.</p>
      </div>

      <p className="text-xs font-medium mb-2" style={{ color: MUTED }}>Publicados ({gallery.length})</p>
      <div className="grid grid-cols-2 gap-3">
        {gallery.map((item) => (
          <div key={item.id} className="relative rounded-xl overflow-hidden" style={{ height: 120 }}>
            {item.type === "photo" && item.media ? (
              <img src={item.media} alt={item.label} className="w-full h-full object-cover" />
            ) : item.type === "video" ? (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${item.color || WINE}22` }}>
                <Play size={18} color={item.color || WINE} fill={item.color || WINE} />
              </div>
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(160deg, ${item.color || WINE}, ${IVORY})` }} />
            )}
            <button onClick={() => remove(item.id)} className="absolute top-1.5 right-1.5 p-1 rounded-full" style={{ background: "rgba(38,34,43,0.7)" }}>
              <X size={12} color={IVORY} />
            </button>
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: "rgba(38,34,43,0.55)" }}>
              <p className="text-[10px] font-medium truncate" style={{ color: IVORY }}>{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalonAdmin({ salon, setSalon, consentLogs }) {
  return (
    <div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Informações exibidas para o cliente na tela inicial e usadas nas notificações.</p>
      <label className="text-xs font-medium block mb-1">Nome do salão</label>
      <input value={salon.name} onChange={(e) => setSalon({ ...salon, name: e.target.value })} className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      <label className="text-xs font-medium block mb-1">WhatsApp do salão</label>
      <input value={salon.whatsapp} onChange={(e) => setSalon({ ...salon, whatsapp: e.target.value })} className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      <label className="text-xs font-medium block mb-1">Endereço</label>
      <input value={salon.address} onChange={(e) => setSalon({ ...salon, address: e.target.value })} className="w-full mb-3 px-3 py-2.5 rounded-lg text-sm" style={{ border: "1px solid #E4DACB", background: "#fff" }} />
      <label className="text-xs font-medium block mb-1">Senha de acesso do administrador</label>
      <input
        value={salon.adminPassword || ""}
        onChange={(e) => setSalon({ ...salon, adminPassword: e.target.value })}
        className="w-full mb-6 px-3 py-2.5 rounded-lg text-sm"
        style={{ border: "1px solid #E4DACB", background: "#fff" }}
      />

      <div className="pt-4 border-t" style={{ borderColor: "#EDE4D6" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldCheck size={15} style={{ color: WINE }} />
          <p className="text-sm font-semibold">Registro de consentimento (LGPD)</p>
        </div>
        <p className="text-xs mb-3" style={{ color: MUTED }}>{consentLogs.length} consentimento{consentLogs.length === 1 ? "" : "s"} registrado{consentLogs.length === 1 ? "" : "s"} — cada cliente que confirma um agendamento aceita o uso dos dados, e isso fica com data e hora aqui.</p>
        {consentLogs.length === 0 ? (
          <p className="text-xs" style={{ color: MUTED }}>Nenhum registro ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {consentLogs.slice(-6).reverse().map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "#fff", border: "1px solid #EDE4D6" }}>
                <span>{c.name}</span>
                <span style={{ color: MUTED }}>{new Date(c.grantedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
