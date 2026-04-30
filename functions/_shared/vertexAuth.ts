/**
 * vertexAuth.ts — Helper de Autenticação para Vertex AI
 *
 * Suporta três modos automaticamente (detecta pelo conteúdo de GCP_CREDENTIALS_JSON):
 *
 * 1. Service Account JSON  {"type":"service_account", "private_key":...}
 *    → Gera JWT e troca por Access Token via OAuth2 (produção ideal)
 *
 * 2. Authorized User JSON  {"type":"authorized_user", "refresh_token":...}
 *    → Usa refresh_token para obter novo Access Token via OAuth2
 *    → Não expira — basta rodar "gcloud auth application-default login" uma vez
 *
 * 3. Access Token direto  ya29.xxxx
 *    → Usa o token diretamente (expira em 1h — apenas para testes rápidos)
 */

interface ServiceAccountCredentials {
  type: 'service_account';
  client_email: string;
  private_key: string;
}

interface AuthorizedUserCredentials {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

type Credentials = ServiceAccountCredentials | AuthorizedUserCredentials;

// ─── Helpers ────────────────────────────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64url(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Service Account Flow ────────────────────────────────────────────────────

async function signJWT(payload: object, privateKeyPem: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureBytes = new Uint8Array(signatureBuffer);
  let signatureBinary = '';
  for (let i = 0; i < signatureBytes.length; i++) {
    signatureBinary += String.fromCharCode(signatureBytes[i]);
  }
  const signature = btoa(signatureBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${signature}`;
}

async function getTokenFromServiceAccount(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const jwt = await signJWT(payload, credentials.private_key);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData: any = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(`[vertexAuth] Service Account token falhou: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

// ─── Authorized User (Refresh Token) Flow ───────────────────────────────────

async function getTokenFromRefreshToken(credentials: AuthorizedUserCredentials): Promise<string> {
  console.log('[vertexAuth] Usando Refresh Token (authorized_user)...');

  const body = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    grant_type: 'refresh_token',
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const tokenData: any = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(`[vertexAuth] Refresh Token falhou: ${JSON.stringify(tokenData)}`);
  }

  console.log('[vertexAuth] Access Token obtido via Refresh Token com sucesso.');
  return tokenData.access_token;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Obtém um Access Token do Google Cloud.
 * Detecta automaticamente o tipo de credencial em GCP_CREDENTIALS_JSON.
 */
export async function getVertexToken(env: Record<string, string>): Promise<string> {
  const credentialsRaw = (env.GCP_CREDENTIALS_JSON || '').trim().replace(/\r/g, '');

  if (!credentialsRaw) {
    throw new Error('[vertexAuth] GCP_CREDENTIALS_JSON não configurado.');
  }

  // Modo 3: Access Token direto (ya29.) — expira em 1h, apenas para testes
  if (credentialsRaw.startsWith('ya29')) {
    console.log('[vertexAuth] Usando Access Token direto (expira em 1h — apenas para testes)');
    return credentialsRaw;
  }

  // Modos 1 e 2: JSON de credenciais
  let credentials: Credentials;
  try {
    credentials = JSON.parse(credentialsRaw);
  } catch (e: any) {
    throw new Error(`[vertexAuth] GCP_CREDENTIALS_JSON inválido — não é JSON nem token ya29.: ${e.message}`);
  }

  // Modo 1: Service Account JSON
  if (credentials.type === 'service_account') {
    console.log('[vertexAuth] Usando Service Account:', credentials.client_email);
    return await getTokenFromServiceAccount(credentials as ServiceAccountCredentials);
  }

  // Modo 2: Authorized User (refresh_token — não expira)
  if (credentials.type === 'authorized_user') {
    return await getTokenFromRefreshToken(credentials as AuthorizedUserCredentials);
  }

  throw new Error(`[vertexAuth] Tipo de credencial não suportado: ${(credentials as any).type}`);
}
