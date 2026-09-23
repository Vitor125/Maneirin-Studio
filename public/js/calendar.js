import { getScheduleStart } from './utils.js';

const APPOINTMENT_DURATION_MINUTES = 60;
const STUDIO_ADDRESS = 'R. Nilópolis, 352 - Éden, São João de Meriti - RJ, 25535-050';
export const GOOGLE_CALENDAR_ID = 'd2970e3f2205392d94a72d232a6e03bccd39237d8291c4f068d6fa6348e42fc7@group.calendar.google.com';
const GOOGLE_CALENDAR_TIMEZONE = 'America/Sao_Paulo';

/** Formata um instante UTC no padrão compacto aceito pelo Google Calendar. */
function toGoogleCalendarDate(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/** Preenche título, data, duração, endereço e agenda; gera apenas um link, sem chamar a API do Google. */
export function buildGoogleCalendarUrl(schedule, clientName) {
    const start = getScheduleStart(schedule);
    const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        src: GOOGLE_CALENDAR_ID,
        text: `Maneirin Studio - ${clientName}`,
        dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`,
        details: `Cliente: ${clientName}\nBarbeiro: ${schedule.barber_name || 'Maneirin Studio'}\nHorário confirmado pela dashboard do Maneirin Studio.`,
        location: STUDIO_ADDRESS,
        ctz: GOOGLE_CALENDAR_TIMEZONE
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
