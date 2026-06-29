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

  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(data?.error?.message || "Erro no Vertex AI");
  return data;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { title, theme, duration, minWords, maxWords, scenes, style, idea, systemInstructions, ageRequirements, toneRequirements } = (await request.json()) as any;
    const requestedScenes = Math.max(1, Number(scenes) || 8);
    const minWordsPerScene = Math.max(10, Math.round(Number(minWords) / requestedScenes));
    const maxWordsPerScene = Math.max(15, Math.round(Number(maxWords) / requestedScenes));

    const prompt = `${systemInstructions || 'Crie uma historia infantil em portugues brasileiro.'}

    REQUISITOS DA HISTÓRIA:
    Titulo: ${title}
    Tema: ${theme}
    Duração: ${duration} minutos de leitura
    Tamanho OBRIGATÓRIO: A história COMPLETA (soma de todas as cenas) DEVE ter entre ${minWords} e ${maxWords} palavras. Você será penalizado se não seguir esta regra de tamanho.
    Tamanho por cena: Cada uma das ${requestedScenes} cenas no array JSON DEVE ter OBRIGATORIAMENTE entre ${minWordsPerScene} e ${maxWordsPerScene} palavras no campo "texto". Use descrições ricas, detalhes emocionais e diálogos expressivos para preencher essa quantidade de texto em todas as cenas de forma consistente.
    Quantidade EXATA de cenas: Você DEVE gerar EXATAMENTE ${requestedScenes} cenas no array JSON (numeradas de 1 a ${requestedScenes}). É CRITICAMENTE IMPORTANTE não fazer menos que ${requestedScenes} cenas. Divida a história para preencher exatamente ${requestedScenes} blocos. NUNCA pule cenas, abrevie a história, ou termine antes da cena ${requestedScenes}.
    Cena inicial: a cena 1 DEVE, OBRIGATORIAMENTE, iniciar o texto de narração com a seguinte frase exata de abertura: "Hoje eu vou contar uma historinha [Titulo da Historia]...". Logo APÓS essa frase de abertura, a história PROPRIAMENTE DITA DEVE começar OBRIGATORIAMENTE com a expressão exata "Era uma vez," seguida da apresentação do personagem principal e do cenário encantado da história. Ou seja, o texto da cena 1 segue o formato: "Hoje eu vou contar uma historinha [Titulo]... Era uma vez, ...". O prompt_imagem da cena 1 deve ilustrar esse primeiro momento da história ("Era uma vez..."), NUNCA uma capa, título, vinheta ou tela de abertura. NÃO crie título, capa ou vinheta separados.
    Cena final: a última cena DEVE, OBRIGATORIAMENTE, terminar a narrativa com a lição/moral da história e, SOMENTE DEPOIS da moral, finalizar o texto de narração de forma integral com a chamada e encerramento exato: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!". O prompt_imagem da última cena deve ilustrar a resolução/moral da história, NUNCA uma tela de inscrição, créditos ou cartão final.
    Cobertura narrativa: todas as partes importantes da história devem aparecer entre a cena 1 e a cena ${requestedScenes}; não pule a resolução final.
    
    ${ageRequirements ? "Requisitos de Idade:\n" + ageRequirements : ""}
    ${toneRequirements ? "Requisitos de Tom:\n" + toneRequirements : ""}
    ${idea || ""}

    DIRETRIZES DE IMAGEM PARA AUTENTICIDADE E VARIEDADE:
    CONSISTÊNCIA DE PERSONAGENS: A descrição física, roupas, cores e detalhes visuais dos personagens DEVEM SER EXATAMENTE IGUAIS em todos os 'prompt_imagem' de todas as cenas. Para garantir consistência visual, copie a mesma base descritiva do personagem em todas as cenas.
    As imagens geradas (prompt_imagem) NÃO devem parecer variações do mesmo fundo. Mantenha os personagens consistentes, mas mude ativamente o mundo visual de cada cena.
    - Cada prompt_imagem deve incluir: local específico, ação, ângulo de câmera, distância do plano, primeiro plano, fundo, horário/clima, paleta de cores e objetos narrativos.
    - Varie a câmera: establishing wide shot, low angle, high angle, over-the-shoulder, top-down, side view, point-of-view, close-up emocional apenas quando fizer sentido.
    - Varie o cenário: interior, exterior, margem de rio, oficina, toca, campo aberto, alto de árvore, céu, sombra, chuva, noite, amanhecer, detalhe de objeto, etc., conforme a história permitir.
    - NÃO repita automaticamente floresta ensolarada, caminho de terra, jardim mágico, árvores arredondadas ou backlight dourado em todas as cenas.
    - Evite que todas as imagens sejam "personagem no centro sorrindo para a câmera". Mostre personagens agindo, descobrindo, olhando para algo, interagindo com objetos ou pequenos dentro de um cenário amplo.
    - FUNDO/CENÁRIO OBRIGATÓRIO: NUNCA use "fundo branco", "white background", "solid background" ou "plain background". O cenário deve ser detalhado e específico daquela cena.

    Retorne a história JSON ESTRITAMENTE com a seguinte estrutura:
    {
      "titulo": "...",
      "cenas": [
        {
          "numero": 1,
          "texto": "texto da cena para narração",
          "prompt_imagem": "prompt detalhado em ingles descrevendo A AÇÃO, ÂNGULO DE CÂMERA e CENÁRIO. NÃO use nomes próprios. A DESCRIÇÃO FÍSICA DOS PERSONAGENS (CORES/ROUPAS/ESPÉCIE) DEVE SER COPIADA EXATAMENTE IGUAL EM TODAS AS CENAS."
        }
      ]
    }`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt + '\n\nIMPORTANTE (EVITAR ERRO DE JSON): NÃO use quebras de linha reais dentro do valor das strings (use \\n). Se precisar de aspas dentro do texto, certifique-se de usar aspas simples (\') para não quebrar o formato JSON.' }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 16384,
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
