-- Criação da tabela user_preferences com todas as colunas necessárias (Textos, Imagens, Bíblico e 2D)

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Prompts de História
    master_prompt_description TEXT DEFAULT 'Cria historinhas infantis com personagens cativantes, aventuras leves e mensagens educativas. Ideal para contação de histórias, leitura em voz alta e criação de histórias lúdicas para crianças pequenas.',
    master_prompt_instructions TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

As histórias devem ter duração equivalente a 3 a 10 minutos de leitura, adaptadas para leitura em voz alta.

🎬 Estrutura da História:
Introdução: Abertura com um gancho leve e convidativo, como: "Hoje eu vou contar uma historinha [Titulo da Historia]…"
Desenvolvimento: Um evento muda a rotina do personagem (conflito leve, seguro e educativo).
Conclusão: Resolução positiva e alegre. Encerramento carinhoso: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!"',
    
    -- Prompts de História Bíblica
    master_prompt_instructions_biblica TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis bíblicas narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e inspiradoras baseadas em princípios, personagens ou ensinamentos bíblicos. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros devem ensinar valores como amor, fé, bondade, obediência e coragem, sempre de forma compreensível para crianças e encerrando com uma mensagem positiva ou princípio da Palavra.

🎬 Estrutura da História:
Introdução: Abertura com gancho convidativo
Desenvolvimento: Conflito ou situação a ser superada com um princípio bíblico
Conclusão: Resolução inspiradora com lição de vida e aplicação do ensinamento

Encerramento: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho!"',

    -- Prompts de Imagem (Pixar 3D)
    image_prompt_template TEXT DEFAULT 'Crie um [personagem] com aparência extremamente fofa e expressiva, no estilo de animação 3D Pixar / DreamWorks. O personagem deve ter olhos grandes e brilhantes, repletos de [emoção desejada], com blush suave nas bochechas, orelhas [formato], e uma textura realista com acabamento suave que ressalta sua personalidade cativante. Os traços devem transmitir ternura e carisma à primeira vista.
IMPORTANTE: O personagem deve ocupar cerca de 10% da largura da imagem, posicionado de forma centralizada ou levemente deslocado, para que o cenário ao redor seja amplamente visível e contribua com a atmosfera mágica da composição.
O fundo deve retratar um cenário rico em cor e profundidade, como uma [cenário], com árvores detalhadas, flores vibrantes, folhas dançantes ao vento, pequenos animais ao fundo ou trilhas sinuosas. Adicione elementos que tragam dinamismo e fantasia — como luz filtrando entre as copas das árvores, pétalas flutuando no ar, cogumelos coloridos, borboletas ou passarinhos em movimento — para criar um visual cinematográfico, vibrante e encantador.
A iluminação deve ser suave e mágica, com um efeito de backlight dourado que contorna o personagem com luz quente, realçando sua silhueta e trazendo uma sensação de manhã ensolarada ou entardecer encantado.
Estilo ultra-realista cartoon, com riqueza de detalhes e atmosfera envolvente. Referências visuais: Zootopia, Encanto, Como Treinar o Seu Dragão. Composição horizontal. Resolução: 1920x1080 pixels.',

    -- Prompts de Imagem (Cartoon 2D)
    image_prompt_template_2d TEXT DEFAULT 'Crie uma ilustração de [CENA] com [PERSONAGEM] no estilo de Animação 2D Cartoon (Flat Vector Art).
A emoção geral da cena deve ser [EMOÇÃO].
Estilo Visual Obrigatório: Desenho animado 2D, cores sólidas em blocos (flat colors), contornos bem definidos e limpos (crisp outlines), estilo de programas de TV infantis educacionais modernos. SEM sombreamento 3D profundo, SEM renderização realista, SEM CGI/Pixar look.
O cenário de fundo deve ser lúdico, brilhante e colorido, servindo de palco para o personagem sem roubar a atenção. 
Resolução: Alta qualidade, 16:9 wide shot, ilustrado como uma pintura vetorial vibrante.',

    -- Outras colunas
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Função e Trigger de Updated At
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at_trigger
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- Cria uma preferência padrão para os usuários que já existem
INSERT INTO public.user_preferences (user_id) 
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
