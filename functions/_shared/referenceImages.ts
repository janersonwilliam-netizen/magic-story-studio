/**
 * referenceImages.ts — resolve imagens de referência recebidas pelas APIs de geração
 * para inlineData (base64) aceito pelo Gemini.
 *
 * As referências podem chegar em 4 formatos, dependendo de onde o frontend as leu:
 *  - data URL base64 (geração recente, sem R2 configurado)
 *  - URL relativa `/api/image/<key>` (imagem persistida no Cloudflare R2)
 *  - URL http(s) absoluta (imagem persistida no Supabase Storage após salvar a história)
 *  - base64 cru sem prefixo (legado)
 *
 * Antes deste módulo, apenas base64 era aceito: URLs do R2 eram descartadas em
 * silêncio e URLs do Supabase eram enviadas como base64 inválido — nos dois casos
 * o Gemini gerava a cena SEM referência e os personagens perdiam consistência.
 */

export interface InlineImagePart {
  inlineData: { mimeType: string; data: string };
}

// Subconjunto estrutural de R2Bucket suficiente para leitura (facilita teste fora do Workers).
export interface ReadableImageBucket {
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mimeFromKey(key: string): string {
  return key.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

async function resolveOne(
  ref: string,
  bucket: ReadableImageBucket | undefined,
  origin: string | undefined,
  fetchImpl: typeof fetch,
): Promise<InlineImagePart | null> {
  if (typeof ref !== 'string' || !ref) return null;

  const dataMatch = ref.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
  if (dataMatch) {
    return { inlineData: { mimeType: dataMatch[1], data: dataMatch[2] } };
  }

  const r2Match = ref.match(/^\/api\/image\/(.+)$/);
  if (r2Match) {
    const key = r2Match[1];
    if (bucket) {
      const object = await bucket.get(key);
      if (object) {
        const bytes = new Uint8Array(await object.arrayBuffer());
        const mimeType = object.httpMetadata?.contentType || mimeFromKey(key);
        return { inlineData: { mimeType, data: base64FromBytes(bytes) } };
      }
    }
    // Sem bucket (dev local) ou chave ausente: tenta via HTTP no próprio origin.
    if (origin) {
      return fetchAsInline(new URL(ref, origin).toString(), fetchImpl);
    }
    return null;
  }

  if (/^https?:\/\//i.test(ref)) {
    return fetchAsInline(ref, fetchImpl);
  }

  // Base64 cru (legado): longo e apenas caracteres de base64.
  if (ref.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(ref.slice(0, 256))) {
    return { inlineData: { mimeType: 'image/png', data: ref } };
  }

  return null;
}

async function fetchAsInline(url: string, fetchImpl: typeof fetch): Promise<InlineImagePart | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    if (!mimeType.startsWith('image/')) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { inlineData: { mimeType, data: base64FromBytes(bytes) } };
  } catch {
    return null;
  }
}

/**
 * Converte a lista de referências em parts inlineData para o Gemini.
 * Referências irresolvíveis são contadas em `dropped` para o caller decidir
 * se falha alto em vez de gerar sem consistência.
 */
export async function resolveReferenceImages(
  refs: string[],
  bucket?: ReadableImageBucket,
  origin?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ parts: InlineImagePart[]; dropped: number }> {
  const parts: InlineImagePart[] = [];
  let dropped = 0;
  for (const ref of refs) {
    const part = await resolveOne(ref, bucket, origin, fetchImpl);
    if (part) parts.push(part);
    else dropped++;
  }
  return { parts, dropped };
}
