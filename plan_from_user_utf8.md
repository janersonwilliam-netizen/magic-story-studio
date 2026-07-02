__MAGIC STORY STUDIO__

Instru├º├úo T├®cnica ÔÇö Migra├º├úo para Vertex AI

Para: Time Antigravity  |  Stack: React \+ Supabase \+ Cloudflare Pages  |  Abril 2026

# __1\. Contexto__

O Magic Story Studio usa React no frontend, Supabase como banco de dados e Cloudflare Pages para o deploy\. As credenciais e vari├íveis de ambiente ficam no Cloudflare Pages \(Settings \-> Environment Variables\)\. O objetivo ├® migrar a gera├º├úo de imagens, texto e narra├º├úo para o Vertex AI do Google Cloud, aproveitando R$ 1\.785,67 de cr├®ditos GCP dispon├¡veis\.

__Item__

__Antes__

__Depois__

API imagens

Google AI Studio \(cart├úo\)

Vertex AI \(cr├®ditos GCP\)

Modelo imagens

Nano Banana Pro \($0,134/img\)

Nano Banana 2 \($0,067/img\)

Narra├º├úo TTS

N├úo implementado

Gemini 3\.1 Flash TTS \(pt\-BR\)

Custo/hist├│ria \(21 imgs\)

~$2,81

~$1,42

Cr├®ditos GCP dispon├¡veis

N├úo utilizados

R$ 1\.785,67 ÔÇö at├® jul/2026

# __2\. Credenciais GCP__

__Par├ómetro__

__Valor__

Project ID

project\-07564737\-45c4\-4b24\-823

Conta de faturamento

010ECB\-2DED3A\-90E393

Regi├úo imagens

global

Regi├úo TTS

us\-central1

## __2\.1 Criar Service Account \(executar uma vez no Cloud Shell\)__

\# Abrir Google Cloud Shell em console\.cloud\.google\.com

\# 1\. Criar service account

gcloud iam service\-accounts create magic\-story\-vertex \\

  \-\-project=project\-07564737\-45c4\-4b24\-823

\# 2\. Conceder permiss├úo

gcloud projects add\-iam\-policy\-binding project\-07564737\-45c4\-4b24\-823 \\

  \-\-member="serviceAccount:magic\-story\-vertex@project\-07564737\-45c4\-4b24\-823\.iam\.gserviceaccount\.com" \\

  \-\-role="roles/aiplatform\.user"

\# 3\. Baixar chave JSON

gcloud iam service\-accounts keys create vertex\-key\.json \\

  \-\-iam\-account=magic\-story\-vertex@project\-07564737\-45c4\-4b24\-823\.iam\.gserviceaccount\.com

\# 4\. Ver o conte├║do para copiar

cat vertex\-key\.json

ÔÜá´©Å  Nunca commitar o vertex\-key\.json no reposit├│rio\. Adicionar ao \.gitignore\. O conte├║do vai como vari├ível de ambiente no Cloudflare\.

## __2\.2 Configurar Vari├íveis no Cloudflare Pages__

Acessar: Cloudflare Dashboard \-> Pages \-> magic\-story\-studio \-> Settings \-> Environment Variables

Adicionar as seguintes vari├íveis em Production e Preview:

__Nome da Vari├ível__

__Valor__

__Tipo__

GCP\_PROJECT\_ID

project\-07564737\-45c4\-4b24\-823

Text

GCP\_CREDENTIALS\_JSON

Conte├║do completo do vertex\-key\.json

Secret

GCP\_REGION\_IMAGE

global

Text

GCP\_REGION\_TTS

us\-central1

Text

­ƒÆí  Para adicionar o GCP\_CREDENTIALS\_JSON: copiar todo o conte├║do do vertex\-key\.json \(incluindo as chaves \{ \}\) e colar como valor da vari├ível\. Marcar como "Encrypt" para seguran├ºa\.

## __2\.3 Via Wrangler CLI \(alternativo\)__

\# Adicionar secrets via terminal

wrangler pages secret put GCP\_PROJECT\_ID

wrangler pages secret put GCP\_CREDENTIALS\_JSON

wrangler pages secret put GCP\_REGION\_IMAGE

wrangler pages secret put GCP\_REGION\_TTS

# __3\. Arquitetura das Chamadas__

Como o projeto usa Cloudflare Pages, as chamadas para o Vertex AI devem ser feitas via Cloudflare Functions \(server\-side\) para proteger as credenciais\. O React chama as Functions, que por sua vez chamam o Vertex AI\.

React \(browser\)

    |

    | fetch\("/api/generate\-image"\)

    v

Cloudflare Function \(server\-side\)

    |  usa env\.GCP\_CREDENTIALS\_JSON

    | fetch\("https://aiplatform\.googleapis\.com/\.\.\."\)

    v

Vertex AI API \(Google Cloud\)

    |

    | retorna imagem base64

    v

Cloudflare Function \-> React

­ƒÆí  As Functions ficam na pasta /functions do projeto Cloudflare Pages\. Cada arquivo \.ts vira uma rota /api/nome\-do\-arquivo automaticamente\.

# __4\. Helper de Autentica├º├úo__

Criar arquivo: functions/\_shared/vertexAuth\.ts

// functions/\_shared/vertexAuth\.ts

import \{ GoogleAuth \} from "google\-auth\-library";

export async function getVertexToken\(env: Record<string, string>\): Promise<string> \{

  const credentials = JSON\.parse\(env\.GCP\_CREDENTIALS\_JSON || "\{\}"\);

  const auth = new GoogleAuth\(\{

    credentials,

    scopes: \["https://www\.googleapis\.com/auth/cloud\-platform"\]

  \}\);

  const client = await auth\.getClient\(\);

  const tokenResponse = await client\.getAccessToken\(\);

  return tokenResponse\.token || "";

\}

­ƒôª  Instalar depend├¬ncia: npm install google\-auth\-library

# __5\. Gera├º├úo de Imagens ÔÇö Nano Banana 2__

Criar arquivo: functions/api/generate\-image\.ts

## __5\.1 Cloudflare Function__

// functions/api/generate\-image\.ts

import \{ getVertexToken \} from "\.\./\_shared/vertexAuth";

interface Env \{

  GCP\_PROJECT\_ID: string;

  GCP\_CREDENTIALS\_JSON: string;

  GCP\_REGION\_IMAGE: string;

\}

export const onRequestPost: PagesFunction<Env> = async \(\{ request, env \}\) => \{

  const \{ prompt, aspectRatio = "16:9" \} = await request\.json\(\);

  const token = await getVertexToken\(env as any\);

  const projectId = env\.GCP\_PROJECT\_ID;

  const model = "gemini\-3\.1\-flash\-image\-preview";

  const url = \`https://aiplatform\.googleapis\.com/v1/projects/$\{projectId\}/locations/global/publishers/google/models/$\{model\}:generateContent\`;

  const response = await fetch\(url, \{

    method: "POST",

    headers: \{

      "Authorization": \`Bearer $\{token\}\`,

      "Content\-Type": "application/json"

    \},

    body: JSON\.stringify\(\{

      contents: \[\{ role: "user", parts: \[\{ text: prompt \}\] \}\],

      generationConfig: \{

        responseModalities: \["TEXT", "IMAGE"\],

        imageConfig: \{ aspectRatio \}

      \}

    \}\)

  \}\);

  const data = await response\.json\(\);

  const parts = data\.candidates?\.\[0\]?\.content?\.parts || \[\];

  for \(const part of parts\) \{

    if \(part\.inlineData?\.mimeType?\.startsWith\("image/"\)\) \{

      return Response\.json\(\{

        base64: part\.inlineData\.data,

        mimeType: part\.inlineData\.mimeType

      \}\);

    \}

  \}

  return Response\.json\(\{ error: "Nenhuma imagem gerada" \}, \{ status: 500 \}\);

\};

## __5\.2 Chamada no React__

// src/services/imageService\.ts

export async function generateImage\(prompt: string, aspectRatio = "16:9"\) \{

  const response = await fetch\("/api/generate\-image", \{

    method: "POST",

    headers: \{ "Content\-Type": "application/json" \},

    body: JSON\.stringify\(\{ prompt, aspectRatio \}\)

  \}\);

  const data = await response\.json\(\);

  if \(data\.error\) throw new Error\(data\.error\);

  // Retorna data URL pronta para usar em <img src=\{\.\.\.\} />

  return \`data:$\{data\.mimeType\};base64,$\{data\.base64\}\`;

\}

// Cenas \(16:9\):  generateImage\(scenePrompt, "16:9"\)

// Capa  \(9:16\):  generateImage\(coverPrompt, "9:16"\)

## __5\.3 Aspect Ratios__

__Uso__

__aspectRatio__

__Custo__

Cenas da hist├│ria

"16:9"

$0,067/img

Capa do livro

"9:16"

$0,067/img

Quadrado

"1:1"

$0,067/img

# __6\. Gera├º├úo de Texto da Hist├│ria__

Criar arquivo: functions/api/generate\-story\.ts

// functions/api/generate\-story\.ts

import \{ getVertexToken \} from "\.\./\_shared/vertexAuth";

interface Env \{

  GCP\_PROJECT\_ID: string;

  GCP\_CREDENTIALS\_JSON: string;

\}

export const onRequestPost: PagesFunction<Env> = async \(\{ request, env \}\) => \{

  const \{ title, theme, duration, scenes, style, idea \} = await request\.json\(\);

  const token = await getVertexToken\(env as any\);

  const projectId = env\.GCP\_PROJECT\_ID;

  const url = \`https://aiplatform\.googleapis\.com/v1/projects/$\{projectId\}/locations/global/publishers/google/models/gemini\-2\.5\-flash:generateContent\`;

  const prompt = \`Crie uma historia infantil em portugues brasileiro\.

    Titulo: $\{title\}

    Tema: $\{theme\}

    Duracao: $\{duration\} minutos

    Cenas: $\{scenes\}

    Estilo visual: $\{style\}

    $\{idea ? "Ideia: " \+ idea : ""\}

    Retorne JSON com a estrutura:

    \{

      "titulo": "\.\.\.",

      "cenas": \[

        \{

          "numero": 1,

          "texto": "texto para narracao",

          "prompt\_imagem": "prompt em ingles para gerar imagem, estilo $\{style\}"

        \}

      \]

    \}\`;

  const response = await fetch\(url, \{

    method: "POST",

    headers: \{

      "Authorization": \`Bearer $\{token\}\`,

      "Content\-Type": "application/json"

    \},

    body: JSON\.stringify\(\{

      contents: \[\{ role: "user", parts: \[\{ text: prompt \}\] \}\],

      generationConfig: \{

        temperature: 0\.8,

        maxOutputTokens: 8192,

        responseMimeType: "application/json"

      \}

    \}\)

  \}\);

  const data = await response\.json\(\);

  const text = data\.candidates?\.\[0\]?\.content?\.parts?\.\[0\]?\.text || "\{\}";

  return Response\.json\(JSON\.parse\(text\)\);

\};

# __7\. Narra├º├úo de ├üudio ÔÇö Gemini 3\.1 Flash TTS__

Criar arquivo: functions/api/generate\-narration\.ts

## __7\.1 Cloudflare Function__

// functions/api/generate\-narration\.ts

import \{ getVertexToken \} from "\.\./\_shared/vertexAuth";

interface Env \{

  GCP\_PROJECT\_ID: string;

  GCP\_CREDENTIALS\_JSON: string;

  GCP\_REGION\_TTS: string;

\}

function addWavHeaders\(pcm: Uint8Array, rate = 24000, ch = 1, bits = 16\): Uint8Array \{

  const buf = new ArrayBuffer\(44 \+ pcm\.length\);

  const v = new DataView\(buf\);

  const w = \(o: number, s: string\) => \{ for \(let i = 0; i < s\.length; i\+\+\) v\.setUint8\(o \+ i, s\.charCodeAt\(i\)\); \};

  w\(0,"RIFF"\); v\.setUint32\(4, 36 \+ pcm\.length, true\);

  w\(8,"WAVE"\); w\(12,"fmt "\);

  v\.setUint32\(16,16,true\); v\.setUint16\(20,1,true\);

  v\.setUint16\(22,ch,true\); v\.setUint32\(24,rate,true\);

  v\.setUint32\(28,rate\*ch\*bits/8,true\); v\.setUint16\(32,ch\*bits/8,true\);

  v\.setUint16\(34,bits,true\); w\(36,"data"\); v\.setUint32\(40,pcm\.length,true\);

  new Uint8Array\(buf\)\.set\(pcm, 44\);

  return new Uint8Array\(buf\);

\}

export const onRequestPost: PagesFunction<Env> = async \(\{ request, env \}\) => \{

  const \{

    text,

    voice = "Kore",

    styleInstruction = "Narre em tom animado e caloroso para criancas de 4 a 8 anos\."

  \} = await request\.json\(\);

  const token = await getVertexToken\(env as any\);

  const projectId = env\.GCP\_PROJECT\_ID;

  const region = env\.GCP\_REGION\_TTS || "us\-central1";

  const model = "gemini\-3\.1\-flash\-tts\-preview";

  const url = \`https://$\{region\}\-aiplatform\.googleapis\.com/v1beta1/projects/$\{projectId\}/locations/$\{region\}/publishers/google/models/$\{model\}:generateContent\`;

  const fullText = styleInstruction ? \`$\{styleInstruction\} $\{text\}\` : text;

  const response = await fetch\(url, \{

    method: "POST",

    headers: \{

      "Authorization": \`Bearer $\{token\}\`,

      "Content\-Type": "application/json",

      "x\-goog\-user\-project": projectId

    \},

    body: JSON\.stringify\(\{

      contents: \[\{ role: "user", parts: \[\{ text: fullText \}\] \}\],

      generationConfig: \{

        responseModalities: \["AUDIO"\],

        speechConfig: \{

          languageCode: "pt\-BR",

          voiceConfig: \{ prebuiltVoiceConfig: \{ voiceName: voice \} \}

        \}

      \}

    \}\)

  \}\);

  const data = await response\.json\(\);

  const audioB64 = data\.candidates?\.\[0\]?\.content?\.parts?\.\[0\]?\.inlineData?\.data;

  if \(\!audioB64\) return Response\.json\(\{ error: "Sem audio" \}, \{ status: 500 \}\);

  // PCM raw \-> WAV com headers

  const binary = atob\(audioB64\);

  const pcm = new Uint8Array\(binary\.length\);

  for \(let i = 0; i < binary\.length; i\+\+\) pcm\[i\] = binary\.charCodeAt\(i\);

  const wav = addWavHeaders\(pcm\);

  const wavB64 = btoa\(String\.fromCharCode\(\.\.\.wav\)\);

  return Response\.json\(\{ audio: wavB64, mimeType: "audio/wav" \}\);

\};

## __7\.2 Vozes dispon├¡veis__

__Voice Name__

__Perfil__

__Recomendado para__

Kore

Feminina infantil doce

Narra├º├úo padr├úo ÔÇö mesma do playground

Leda

Crian├ºa fofa

Hist├│rias com crian├ºas protagonistas

Puck

Jovem alegre

Hist├│rias de aventura

Aoede

Feminina suave

Contos de fadas

Charon

Masculina grave

Narrador adulto

Fenrir

Dram├ítica

Hist├│rias de suspense

## __7\.3 Chamada no React__

// src/services/narrationService\.ts

export async function generateNarration\(

  text: string,

  voice = "Kore",

  styleInstruction = "Narre em tom animado e caloroso para criancas de 4 a 8 anos\."

\) \{

  const response = await fetch\("/api/generate\-narration", \{

    method: "POST",

    headers: \{ "Content\-Type": "application/json" \},

    body: JSON\.stringify\(\{ text, voice, styleInstruction \}\)

  \}\);

  const data = await response\.json\(\);

  if \(data\.error\) throw new Error\(data\.error\);

  // Converter base64 WAV para URL de audio

  const bytes = Uint8Array\.from\(atob\(data\.audio\), c => c\.charCodeAt\(0\)\);

  const blob = new Blob\(\[bytes\], \{ type: "audio/wav" \}\);

  return URL\.createObjectURL\(blob\);

\}

// Uso:

// const audioUrl = await generateNarration\(sceneText, "Kore"\);

// <audio src=\{audioUrl\} controls />

# __8\. Estrutura de Arquivos Final__

projeto/

Ôö£ÔöÇÔöÇ functions/

Ôöé   Ôö£ÔöÇÔöÇ \_shared/

Ôöé   Ôöé   ÔööÔöÇÔöÇ vertexAuth\.ts       <\- helper autenticacao GCP

Ôöé   ÔööÔöÇÔöÇ api/

Ôöé       Ôö£ÔöÇÔöÇ generate\-image\.ts   <\- POST /api/generate\-image

Ôöé       Ôö£ÔöÇÔöÇ generate\-story\.ts   <\- POST /api/generate\-story

Ôöé       ÔööÔöÇÔöÇ generate\-narration\.ts <\- POST /api/generate\-narration

Ôö£ÔöÇÔöÇ src/

Ôöé   ÔööÔöÇÔöÇ services/

Ôöé       Ôö£ÔöÇÔöÇ imageService\.ts     <\- chamadas do React para imagens

Ôöé       ÔööÔöÇÔöÇ narrationService\.ts <\- chamadas do React para audio

ÔööÔöÇÔöÇ \.gitignore                  <\- incluir vertex\-key\.json

# __9\. Estimativa de Custos__

__Recurso__

__Modelo__

__Custo unit\.__

__Por hist├│ria__

__Mensal \(35 hist\.\)__

Texto

gemini\-2\.5\-flash

~$0,001

$0,001

$0,04

Capa 9:16

Nano Banana 2

$0,067

$0,067

$2,35

Cenas 16:9 \(x20\)

Nano Banana 2

$0,067

$1,340

$46,90

Narra├º├úo TTS

gemini\-3\.1\-flash\-tts

~$0,012

$0,012

$0,42

TOTAL

~$1,42

~$49,70

Ô£à  Com R$ 1\.785,67 de cr├®ditos GCP \(v├ílido at├® 22/07/2026\): aproximadamente 1\.257 hist├│rias completas sem custo adicional\.

# __10\. Checklist de Implementa├º├úo__

- Criar Service Account no GCP e baixar vertex\-key\.json
- Adicionar vari├íveis no Cloudflare Pages: GCP\_PROJECT\_ID, GCP\_CREDENTIALS\_JSON, GCP\_REGION\_IMAGE, GCP\_REGION\_TTS
- Instalar depend├¬ncia: npm install google\-auth\-library
- Criar functions/\_shared/vertexAuth\.ts
- Criar functions/api/generate\-image\.ts
- Criar functions/api/generate\-story\.ts
- Criar functions/api/generate\-narration\.ts
- Criar src/services/imageService\.ts
- Criar src/services/narrationService\.ts
- Atualizar componentes React para usar os novos services
- Testar localmente com: wrangler pages dev
- Deploy: wrangler pages deploy ou push para o branch de produ├º├úo
- Verificar consumo de cr├®ditos em console\.cloud\.google\.com/billing

*Magic Story Studio  |  Janerson William  |  Abril 2026*

