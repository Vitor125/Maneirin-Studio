const WHATSAPP_PHONE = '5521980453636';

/** Escapa caracteres de texto para impedir que valores do banco sejam interpretados como marcação HTML. */
export function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/** Codifica a mensagem e usa o número comercial configurado do Studio. */
export function buildWhatsappUrl(message) {
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

/** Converte a representação YYYY-MM-DD em DD/MM/YYYY para exibição. */
export function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = String(dateStr).split('-');
    return `${day}/${month}/${year}`;
}

/** Exibe apenas horas e minutos; a validação de horário é feita separadamente. */
export function formatTime(timeStr) {
    return String(timeStr || '').slice(0, 5);
}

/** Retorna a data UTC equivalente ao horário UTC−03 do Studio; devolve null para datas impossíveis. */
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

/** Indica se um horário válido ainda não passou, usando o relógio do visitante. */
export function isUpcomingSchedule(schedule) {
    const start = getScheduleStart(schedule);
    if (!start) return false;

    return start.getTime() >= Date.now();
}

/** Ordena uma cópia da lista por instante de início e coloca registros inválidos no fim. */
export function sortSchedulesByStart(schedules) {
    return [...schedules].sort((first, second) => {
        const firstStart = getScheduleStart(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const secondStart = getScheduleStart(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return firstStart - secondStart;
    });
}

/** Aceita somente HTTP/HTTPS sem credenciais embutidas; retorna # para destinos inválidos. */
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
/** Preserva o ID real do documento, mesmo se houver um campo id forjado nos dados. */
export function documentData(snapshot) {
    return { ...snapshot.data(), id: snapshot.id };
}

/** Permite URLs externas válidas ou data URLs raster; rejeita scripts, SVG embutido e outros esquemas. */
export function safeImageUrl(value) {
    if (typeof value !== 'string') return '';
    if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    const url = safeExternalUrl(value);
    return url === '#' ? '' : url;
}

/** Remove espaços externos e valida obrigatoriedade/comprimento antes de persistir um texto. */
export function boundedText(value, label, max, required = true) {
    const text = String(value || '').trim();
    if ((required && !text) || text.length > max) {
        throw new Error(`${label}: informe ${required ? 'de 1 a' : 'até'} ${max} caracteres.`);
    }
    return text;
}
