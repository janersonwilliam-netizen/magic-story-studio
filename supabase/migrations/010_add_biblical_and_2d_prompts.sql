-- Adiciona novos campos de Prompt Master à Tabela user_preferences para Tema Bíblico e Estilo 2D Cartoon

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS master_prompt_instructions_biblica TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis bíblicas narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e inspiradoras baseadas em princípios, personagens ou ensinamentos bíblicos. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros devem ensinar valores como amor, fé, bondade, obediência e coragem, sempre de forma compreensível para crianças e encerrando com uma mensagem positiva ou princípio da Palavra.

🎬 Estrutura da História:
Introdução: Abertura com gancho convidativo
Desenvolvimento: Conflito ou situação a ser superada com um princípio bíblico
Conclusão: Resolução inspiradora com lição de vida e aplicação do ensinamento

Encerramento: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho!"',

ADD COLUMN IF NOT EXISTS image_prompt_template_2d TEXT DEFAULT 'Crie uma ilustração de [CENA] com [PERSONAGEM] no estilo de Animação 2D Cartoon (Flat Vector Art).
A emoção geral da cena deve ser [EMOÇÃO].
Estilo Visual Obrigatório: Desenho animado 2D, cores sólidas em blocos (flat colors), contornos bem definidos e limpos (crisp outlines), estilo de programas de TV infantis educacionais modernos. SEM sombreamento 3D profundo, SEM renderização realista, SEM CGI/Pixar look.
O cenário de fundo deve ser lúdico, brilhante e colorido, servindo de palco para o personagem sem roubar a atenção. 
Resolução: Alta qualidade, 16:9 wide shot, ilustrado como uma pintura vetorial vibrante.';
