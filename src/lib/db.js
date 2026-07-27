import { supabase, SALON_ID } from "./supabaseClient";

// ---------- helpers de conversão ----------
function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

// ---------- profissionais ----------
function rowToProfessional(row, vacations = []) {
  return {
    id: row.id,
    name: row.name,
    color: row.calendar_color || "#8C3B4E",
    workStart: timeToMinutes(row.work_start) ?? 8 * 60,
    workEnd: timeToMinutes(row.work_end) ?? 18 * 60,
    lunchStart: timeToMinutes(row.lunch_start),
    lunchEnd: timeToMinutes(row.lunch_end),
    password: row.password || "",
    photo: row.photo_url || null,
    vacations: vacations.map((v) => ({ id: v.id, start: v.start_date, end: v.end_date })),
  };
}

export async function fetchProfessionals() {
  const { data: pros, error } = await supabase
    .from("professionals")
    .select("*")
    .eq("salon_id", SALON_ID)
    .order("created_at", { ascending: true });
  if (error) { console.error("fetchProfessionals", error); return []; }
  if (!pros.length) return [];
  const { data: vacs } = await supabase
    .from("professional_vacations")
    .select("*")
    .in("professional_id", pros.map((p) => p.id));
  return pros.map((row) => rowToProfessional(row, (vacs || []).filter((v) => v.professional_id === row.id)));
}

export async function insertProfessional(name, color) {
  const { data, error } = await supabase
    .from("professionals")
    .insert({
      salon_id: SALON_ID,
      name,
      calendar_color: color,
      work_start: "08:00:00",
      work_end: "18:00:00",
      lunch_start: "12:00:00",
      lunch_end: "13:00:00",
      password: "trocar123",
    })
    .select()
    .single();
  if (error) { console.error("insertProfessional", error); return null; }
  return rowToProfessional(data, []);
}

const PROFESSIONAL_COLUMN_MAP = {
  name: "name",
  color: "calendar_color",
  password: "password",
  photo: "photo_url",
};
const PROFESSIONAL_TIME_FIELDS = { workStart: "work_start", workEnd: "work_end", lunchStart: "lunch_start", lunchEnd: "lunch_end" };

export async function updateProfessionalField(id, field, value) {
  let payload = {};
  if (PROFESSIONAL_TIME_FIELDS[field]) {
    payload[PROFESSIONAL_TIME_FIELDS[field]] = minutesToTime(value);
  } else if (PROFESSIONAL_COLUMN_MAP[field]) {
    payload[PROFESSIONAL_COLUMN_MAP[field]] = value;
  } else {
    return; // campo sem coluna correspondente ainda (ex: vacations, tratado separadamente)
  }
  const { error } = await supabase.from("professionals").update(payload).eq("id", id);
  if (error) console.error("updateProfessionalField", error);
}

export async function deleteProfessional(id) {
  const { error } = await supabase.from("professionals").delete().eq("id", id);
  if (error) console.error("deleteProfessional", error);
}

export async function insertVacation(professionalId, start, end) {
  const { data, error } = await supabase
    .from("professional_vacations")
    .insert({ professional_id: professionalId, start_date: start, end_date: end })
    .select()
    .single();
  if (error) { console.error("insertVacation", error); return null; }
  return { id: data.id, start: data.start_date, end: data.end_date };
}

export async function updateVacationField(id, field, value) {
  const column = field === "start" ? "start_date" : "end_date";
  const { error } = await supabase.from("professional_vacations").update({ [column]: value }).eq("id", id);
  if (error) console.error("updateVacationField", error);
}

export async function deleteVacation(id) {
  const { error } = await supabase.from("professional_vacations").delete().eq("id", id);
  if (error) console.error("deleteVacation", error);
}

// ---------- serviços ----------
function rowToService(row) {
  return { id: row.id, name: row.name, duration: row.duration_minutes, price: Number(row.price) };
}

export async function fetchServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", SALON_ID)
    .order("created_at", { ascending: true });
  if (error) { console.error("fetchServices", error); return []; }
  return data.map(rowToService);
}

export async function insertService(name) {
  const { data, error } = await supabase
    .from("services")
    .insert({ salon_id: SALON_ID, name, duration_minutes: 60, price: 0 })
    .select()
    .single();
  if (error) { console.error("insertService", error); return null; }
  return rowToService(data);
}

const SERVICE_COLUMN_MAP = { name: "name", duration: "duration_minutes", price: "price" };

export async function updateServiceField(id, field, value) {
  if (!SERVICE_COLUMN_MAP[field]) return;
  const { error } = await supabase.from("services").update({ [SERVICE_COLUMN_MAP[field]]: value }).eq("id", id);
  if (error) console.error("updateServiceField", error);
}

export async function deleteService(id) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) console.error("deleteService", error);
}

// ---------- agendamentos ----------
function rowToAppointment(row) {
  return {
    id: row.id,
    proId: row.professional_id,
    serviceId: row.service_id,
    date: row.date,
    start: row.start_minutes,
    clientName: row.client_name,
    phone: row.client_phone,
    status: row.status,
  };
}

export async function fetchAppointments() {
  const { data, error } = await supabase.from("appointments").select("*").eq("salon_id", SALON_ID);
  if (error) { console.error("fetchAppointments", error); return []; }
  return data.map(rowToAppointment);
}

// Retorna { data } em caso de sucesso, ou { error } se o horário já tiver sido
// ocupado por outra pessoa entre o momento em que a tela carregou e o clique em
// "Confirmar" — é a trava de conflito do banco (exclusion constraint) protegendo
// de verdade, não só a lógica em JavaScript.
export async function insertAppointment(appt, durationMinutes) {
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: SALON_ID,
      professional_id: appt.proId,
      service_id: appt.serviceId,
      date: appt.date,
      start_minutes: appt.start,
      duration_minutes: durationMinutes,
      client_name: appt.clientName,
      client_phone: appt.phone,
      status: "confirmed",
    })
    .select()
    .single();
  if (error) { console.error("insertAppointment", error); return { error }; }
  return { data: rowToAppointment(data) };
}

export async function cancelAppointmentDb(id) {
  const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  if (error) console.error("cancelAppointmentDb", error);
}
