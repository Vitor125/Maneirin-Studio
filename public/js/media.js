import { safeExternalUrl } from './utils.js';

const MAX_IMAGE_SIZE = 600 * 1024;

/** Converte o arquivo local em base64; o resultado ainda será validado como imagem. */
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/** Confirma que o navegador decodifica a imagem e limita a espera a quinze segundos. */
export function validateImageLink(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => {
            image.onload = image.onerror = null;
            reject(new Error('A imagem demorou para carregar. Envie o arquivo ou tente outro link.'));
        }, 15000);
        image.onload = () => { window.clearTimeout(timeout); resolve(url); };
        image.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('Este link não abre uma imagem. Envie o arquivo ou use o endereço direto da foto.'));
        };
        image.src = url;
    });
}

// Produtos e galeria usam os mesmos limites e validam também o conteúdo do arquivo.
/** Prioriza arquivo sobre URL e aplica os mesmos tipos, tamanho máximo e validação para todos os uploads. */
export async function readImageInput(fileId, urlId, required = false) {
    const file = document.getElementById(fileId).files[0];
    if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
            throw new Error('Use uma imagem JPG, PNG, WebP, GIF ou AVIF.');
        }
        if (file.size > MAX_IMAGE_SIZE) throw new Error('Use uma imagem de até 600 KB ou um link de imagem.');
        return validateImageLink(await readFileAsDataUrl(file));
    }
    const url = document.getElementById(urlId).value.trim();
    if (!url && !required) return '';
    const normalizedUrl = safeExternalUrl(url);
    if (!url || normalizedUrl === '#' || normalizedUrl.length > 4096) throw new Error('Envie uma foto ou informe um link HTTP/HTTPS válido de até 4096 caracteres.');
    return validateImageLink(normalizedUrl);
}

/** Oculta imagens quebradas e, opcionalmente, mostra orientação junto da miniatura. */
export function bindImageErrors(container, message = '') {
    container.querySelectorAll('img').forEach(image => {
        const hide = () => {
            image.hidden = true;
            if (message && image.nextElementSibling) image.nextElementSibling.textContent = message;
        };
        image.addEventListener('error', hide, { once: true });
        if (image.complete && !image.naturalWidth) hide();
    });
}
