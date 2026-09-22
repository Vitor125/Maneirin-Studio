const WHATSAPP_PHONE = '5521980453636';

export function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function buildWhatsappUrl(message) {
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = String(dateStr).split('-');
    return `${day}/${month}/${year}`;
}

export function formatTime(timeStr) {
    return String(timeStr || '').slice(0, 5);
}

export function getScheduleStart(schedule) {
    const date = String(schedule.date || '');
    const rawTime = String(schedule.time || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(rawTime)) return null;
    const time = formatTime(rawTime);
    // Os horários pertencem ao Studio, independentemente do fuso do visitante.
    const start = new Date(`${date}T${time}:00-03:00`);
    if (Number.isNaN(start.getTime())) return null;
    const local = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 16) === `${date}T${time}` ? start : null;
}

export function isUpcomingSchedule(schedule) {
    const start = getScheduleStart(schedule);
    if (!start) return false;

    return start.getTime() >= Date.now();
}

export function sortSchedulesByStart(schedules) {
    return [...schedules].sort((first, second) => {
        const firstStart = getScheduleStart(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const secondStart = getScheduleStart(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return firstStart - secondStart;
    });
}

export function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) {
            return url.href;
        }
    } catch (error) {
        return '#';
    }

    return '#';
}

// Um campo "id" legado não pode substituir o identificador real do Firestore.
export function documentData(snapshot) {
    return { ...snapshot.data(), id: snapshot.id };
}

export function safeImageUrl(value) {
    if (typeof value !== 'string') return '';
    if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    const url = safeExternalUrl(value);
    return url === '#' ? '' : url;
}

export function boundedText(value, label, max, required = true) {
    const text = String(value || '').trim();
    if ((required && !text) || text.length > max) {
        throw new Error(`${label}: informe ${required ? 'de 1 a' : 'até'} ${max} caracteres.`);
    }
    return text;
}
