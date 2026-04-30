import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
}

/**
 * Detecta se GCP_CREDENTIALS_JSON tem credenciais válidas (Service Account ou Authorized User)
 */
function hasVertexCredentials(credentialsRaw: string): boolean {
  if (!credentialsRaw) return false;
  try {
    const parsed = JSON.parse(credentialsRaw);
    return parsed.type === 'service_account' || parsed.type === 'authorized_user';
  } catch {
    return false;
  }
}

/**
 * Gera texto via Vertex AI (créditos GCP)
 */
async function generateViaVertexAI(
  payload: object,
  env: Env
): Promise<any> {
  const token = await getVertexToken(env as any);
  const projectId = env.GCP_PROJECT_ID;
  const region = 'us-central1';

  const url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/gemini-2.5-flash:generateContent`;
  console.log(`[generate-story] Usando Vertex AI no projeto ${projectId}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json<any>();
  if (!response.ok) throw new Error(data?.error?.message || "Erro no Vertex AI");
  return data;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { title, theme, duration, minWords, maxWords, scenes, style, idea, systemInstructions, ageRequirements, toneRequirements } = await request.json<any>();

    const prompt = `${systemInstructions || 'Crie uma historia infantil em portugues brasileiro.'}

    REQUISITOS DA HISTÓRIA:
    Titulo: ${title}
    Tema: ${theme}
    Duração: ${duration} minutos de leitura
    Tamanho OBRIGATÓRIO: A história COMPLETA (soma de todas as cenas) DEVE ter entre ${minWords} e ${maxWords} palavras. Você será penalizado se não seguir esta regra de tamanho.
    Quantidade EXATA de cenas: Você DEVE gerar EXATAMENTE ${scenes} cenas no array JSON (numeradas de 1 a ${scenes}). É CRITICAMENTE IMPORTANTE não fazer menos que ${scenes} cenas. Divida a história para preencher exatamente ${scenes} blocos.
    
    ${ageRequirements ? "Requisitos de Idade:\n" + ageRequirements : ""}
    ${toneRequirements ? "Requisitos de Tom:\n" + toneRequirements : ""}
    ${idea || ""}

    DIRETRIZES DE IMAGEM PARA VARIEDADE:
    As imagens geradas (prompt_imagem) NÃO devem ser apenas retratos dos personagens (close-ups). Você DEVE variar ativamente:
    - O ângulo de câmera: Wide shot, low angle, high angle, over-the-shoulder.
    - A distância: Extreme wide shot (mostrando o ambiente e os personagens pequenos), medium shot, close-up apenas quando necessário para emoções.
    - A ação: Personagens correndo, pulando, interagindo com objetos, de costas olhando algo gigante, escondidos atrás de algo.
    - O cenário: Mude a iluminação e a perspectiva a cada cena.
    - Evite que todas as imagens sejam "personagem no centro sorrindo para a câmera".

    Retorne a história JSON ESTRITAMENTE com a seguinte estrutura:
    {
      "titulo": "...",
      "cenas": [
        {
          "numero": 1,
          "texto": "texto da cena para narração",
          "prompt_imagem": "prompt detalhado em ingles descrevendo A AÇÃO, ÂNGULO DE CÂMERA e CENÁRIO. NÃO use nomes próprios, descreva os personagens visualmente."
        }
      ]
    }`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt + '\n\nIMPORTANTE (EVITAR ERRO DE JSON): NÃO use quebras de linha reais dentro do valor das strings (use \\n). Se precisar de aspas dentro do texto, certifique-se de usar aspas simples (\') para não quebrar o formato JSON.' }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            titulo: { type: "STRING" },
            cenas: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  numero: { type: "INTEGER" },
                  texto: { type: "STRING" },
                  prompt_imagem: { type: "STRING" }
                },
                required: ["numero", "texto", "prompt_imagem"]
              }
            }
          },
          required: ["titulo", "cenas"]
        }
      }
    };

    const hasVertex = hasVertexCredentials(env.GCP_CREDENTIALS_JSON) && !!env.GCP_PROJECT_ID;

    if (!hasVertex) {
      return Response.json({ error: "GCP_CREDENTIALS_JSON ou GCP_PROJECT_ID não configurados corretamente." }, { status: 500 });
    }

    const data = await generateViaVertexAI(payload, env);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Safely remove markdown JSON blocks if the model accidentally includes them
    text = text.replace(/^```json/i, '').replace(/```$/i, '').trim();

    try {
      return Response.json(JSON.parse(text));
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, text.substring(0, 500) + '...');
      return Response.json({ error: "O modelo de IA gerou uma resposta mal formatada. Tente gerar a história novamente." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Function error:", error);
    return Response.json({ error: error.message || "Erro interno no Vertex AI" }, { status: 500 });
  }
};
