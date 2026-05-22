export const DEFAULT_INSTRUCTIONS_CLASSICA = `📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

🎬 Estrutura da História:
Introdução (Cena Inicial): Abertura com um gancho leve e convidativo, iniciando OBRIGATORIAMENTE com a frase exata:
“Hoje eu vou contar uma historinha [Titulo da Historia]…”
Seguido imediatamente da apresentação do personagem principal (ex.: um animal, uma criança ou criatura mágica) e do cenário encantado.

Desenvolvimento:
- Um evento muda a rotina do personagem (conflito leve, seguro e educativo).
- Desafio adequado à idade: ajudar um amigo, proteger a natureza, superar um pequeno medo.
- Interação com outros personagens ou busca de uma solução.

Conclusão e Encerramento (Cena Final):
- Resolução positiva e alegre.
- Reconhecimento ou recompensa simbólica ao personagem.
- Moral da história, com lição educativa.
- Encerramento carinhoso, que DEVE conter exatamente o seguinte texto de chamada para ação ao final:
"Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!”

Não inclua capa ou título separados. Toda a história deve ser gerada integrada nos blocos de cena.`;

export const DEFAULT_INSTRUCTIONS_BIBLICA = `📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis bíblicas narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e inspiradoras baseadas em princípios, personagens ou ensinamentos bíblicos. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros devem ensinar valores como amor, fé, bondade, obediência e coragem, sempre de forma compreensível para crianças e encerrando com uma mensagem positiva ou princípio da Palavra.

🎬 Estrutura da História:

Introdução (Cena Inicial)
Abertura com um gancho leve e convidativo, iniciando OBRIGATORIAMENTE com a frase exata:
“Hoje eu vou contar uma historinha [Titulo da Historia]…”
Seguido imediatamente da apresentação do personagem principal da Bíblia ou fictício e do cenário encantado, conectando a criança com o tema.

Desenvolvimento
Apresente o desafio ou conflito leve que o personagem enfrentou.
Mostre:
- Como ele se sentiu
- O que ele precisou decidir
- Como confiou em Deus
O foco deve estar na atitude de fé e na ação de Deus, não no problema em si.

Conclusão e Encerramento (Cena Final)
Mostre como Deus cuidou da situação e como o personagem aprendeu algo importante.
Finalize dentro da própria narrativa com uma lição de fé clara e prática para a criança, seguida de um encerramento carinhoso que DEVE conter exatamente o seguinte texto de chamada para ação ao final:
"Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!”

Não inclua capa ou título separados. Toda a história deve ser gerada integrada nos blocos de cena.`;


export const DEFAULT_IMAGE_TEMPLATE_3D = `PROMPT MESTRE DE IMAGEM 3D - CENAS AUTENTICAS

Crie uma imagem em estilo filme infantil 3D premium, com personagem fofo e expressivo, olhos grandes e vivos, materiais macios e acabamento cinematografico. A identidade visual do personagem deve permanecer consistente entre as cenas, mas o fundo, camera, luz, clima, objetos e composicao precisam mudar de acordo com o momento da historia.

Regra principal: cada cena deve parecer um frame unico de um filme, nao uma repeticao do mesmo palco. Evite repetir floresta ensolarada, caminho de terra, jardim magico, arvores arredondadas ou backlight dourado quando a narrativa nao pedir. Se a historia continuar no mesmo lugar, mostre outro recorte: interior, toca, oficina, margem do rio, vista aerea, detalhe de objeto, sombra, chuva, noite, campo aberto, janela, ponte, montanha, etc.

Inclua sempre: local especifico, acao clara, angulo de camera, distancia do plano, primeiro plano, fundo, horario/clima, paleta de cores e objetos narrativos. Varie entre wide shot, low angle, high angle, over-the-shoulder, top-down, side view, close-up emocional e ponto de vista do personagem.

O personagem nao deve estar sempre centralizado sorrindo para a camera. Ele deve agir, observar, correr, construir, se esconder, descobrir, olhar para outro personagem, interagir com objetos ou ocupar apenas parte da composicao quando o cenario for importante.

Estilo: 3D animated children movie, Pixar-quality charm, tactile materials, cinematic storytelling, vibrant but scene-specific colors, fully detailed environment, no plain background, no white background, horizontal 16:9, 1920x1080.`;

export const DEFAULT_IMAGE_TEMPLATE_2D = `PROMPT MESTRE DE IMAGEM 2D - CENAS AUTENTICAS

Ilustracao 2D premium de altissima qualidade, estilo livro infantil animado e jogos mobile modernos, com contornos limpos, sombreamento suave, cores vivas e leitura clara. Preserve a identidade do personagem, mas trate cada cena como uma ilustracao nova e especifica da historia.

Regra principal: nao repita automaticamente o mesmo jardim, a mesma floresta, o mesmo caminho ou a mesma luz dourada. O cenario precisa nascer do texto da cena. Varie local, camera, luz, clima, paleta, objetos e profundidade visual.

Inclua sempre: acao principal, local especifico, angulo de camera, primeiro plano, fundo, horario/clima, objetos narrativos e expressao emocional. Varie entre plano geral, low angle, high angle, over-the-shoulder, top-down, silhueta, detalhe de objeto e ponto de vista.

O personagem nao deve aparecer sempre centralizado e sorrindo. Ele deve interagir com o mundo: construir, explorar, olhar para algo, conversar, correr, se esconder, descobrir, ajudar ou reagir ao acontecimento da cena.

Estilo: premium 2D cartoon illustration, modern Disney-like storybook feel, crisp outlines, soft colorful shading, vibrant scene-specific palette, fully detailed environment, NO 3D rendering, NO CGI, no white background, no plain background, horizontal 16:9, 1920x1080.`;

export const DEFAULT_CHARACTER_SHEET = `Olá, aqui é o Concept Artist Sênior.
Para garantir que o personagem [NOME DO PERSONAGEM] mantenha identidade visual consistente em qualquer ângulo, cena ou variação gerada por IA, este design equilibra apelo emocional no estilo Pixar com especificações técnicas rígidas e reproduzíveis.

Abaixo está o Character Sheet Oficial de [NOME DO PERSONAGEM]:

1. Espécie e Anatomia Colorimétrica

Espécie: [Definir espécie principal] estilizada, com proporções infantis e leitura clara de silhueta.
Formato do Corpo: [Ex: oval, arredondado, gota, compacto], priorizando simplicidade e reconhecimento imediato.
Cor Principal: [Cor base dominante].
Textura da Superfície: [Descrever textura: lisa, macia, iridescente, pelúcia, escamas, etc.], com acabamento cartoon ultra-realista.
Regiões Secundárias: [Barriga, patas, barbatanas, rosto ou detalhes] em tom complementar ou mais claro.
Extremidades: Curtas, arredondadas e levemente estilizadas para reforçar fofura e segurança visual.

2. Olhos (Ponto Focal Emocional)

Formato: Proporcionalmente grandes, estilo Pixar / DreamWorks, ocupando cerca de 35% a 45% do rosto.
Cor da Íris: [Cor contrastante com o corpo].
Pupilas: Grandes e bem definidas para facilitar leitura emocional.
Brilho: Brilho especular duplo (dois pontos de luz branca) para efeito vítreo e sensação de vida.
Função Emocional: Olhos devem transmitir claramente emoções como alegria, curiosidade, medo, ternura ou surpresa.

3. Acessórios Fixos (Identidade Permanente)

Acessório Principal: [Item icônico do personagem: chapéu, capacete, laço, mochila, concha, etc.].
Material: [Madeira, folha, tecido, metal suave, elemento natural].
Fixação: [Como o acessório se prende ao personagem].
Item Afetivo: O personagem sempre carrega ou mantém por perto um objeto simbólico (ex: brinquedo, pedra, folha, instrumento), que ajuda na continuidade visual e emocional.

4. Detalhes Únicos e Silhueta

Expressão Característica: [Ex: sobrancelhas expressivas, sorriso tímido, boca pequena, bochechas com blush].
Proporção Geral: Cabeça levemente maior que o corpo (chibi sofisticado), reforçando vulnerabilidade e empatia.
Efeito de Luz: Uso de subsurface scattering em áreas finas (orelhas, barbatanas, asas, bordas do corpo).
Silhueta: Reconhecível mesmo em sombra ou contra a luz, sem depender de detalhes finos.

5. Diretrizes de Renderização (Obrigatórias)

Estilo: Animação 3D estilo Pixar / DreamWorks.
Iluminação: Cinematográfica, suave, com backlight dourado.
Textura: Ultra-realista cartoon, sem aspecto plástico.
Cenário: Compatível com o universo da história, mantendo o personagem visualmente dominante.
Consistência: Todas as gerações devem respeitar este sheet como referência base.

PROMPT DE REFERÊNCIA RÁPIDA (PARA IA)

"A stylized Pixar-style character named [NOME DO PERSONAGEM], a [espécie] with [cor principal], [textura do corpo], huge expressive eyes with [cor da íris], wearing [acessório fixo] and carrying [item afetivo]. Cute proportions with a slightly oversized head, cinematic lighting, subsurface scattering, ultra-detailed 3D render, high consistency character design, 8k."`;
