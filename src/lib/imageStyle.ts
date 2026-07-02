// Vocabulário de estilo compartilhado entre a capa (ThumbnailPage) e as cenas (ImagesPage / gemini.ts).
// Existiam 3-4 variações de texto quase-sinônimas para "2D Cartoon" e "3D Pixar" espalhadas pelo
// código, cada uma com uma combinação diferente de adjetivos — isso fazia a capa (que usava a versão
// mais "poster/game art") sair visualmente mais vibrante e polida que as cenas (que usavam uma versão
// mais fraca, tipo "livro infantil genérico"). Usar a mesma string em todos os lugares garante que o
// modelo de imagem receba exatamente o mesmo vocabulário de estilo para capa e cena.
export const IMAGE_STYLE_2D = 'Premium 2D cartoon illustration, modern mobile game art style, modern Disney 2D style, rich details, very vibrant saturated colors, soft colorful shading, crisp clean bold outlines, cinematic poster-quality polish, well-proportioned anatomy, correct number of limbs, animated children storybook style, NO 3D rendering, NO CGI, NO photorealism';

export const IMAGE_STYLE_3D = '3D animated children movie style, Pixar-quality charm, big expressive eyes, soft rounded features, rich cinematic lighting, very vibrant saturated colors, tactile materials, cinematic poster-quality polish, well-proportioned anatomy, correct number of limbs, children book illustration, NO photorealism';
