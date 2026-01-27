import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, RotateCcw, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_DESCRIPTION = 'Cria historinhas infantis com personagens cativantes, aventuras leves e mensagens educativas. Ideal para contação de histórias, leitura em voz alta e criação de histórias lúdicas para crianças pequenas.';

const DEFAULT_INSTRUCTIONS = `📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

🎬 Estrutura da História:
Introdução: Abertura com gancho convidativo
Desenvolvimento: Conflito leve e educativo
Conclusão: Resolução positiva com lição educativa

Encerramento: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho!"`;

const DEFAULT_IMAGE_TEMPLATE = `Crie um [personagem] com aparência extremamente fofa e expressiva, no estilo de animação 3D Pixar / DreamWorks. O personagem deve ter olhos grandes e brilhantes, repletos de [emoção desejada, ex: surpresa encantada, alegria radiante ou curiosidade profunda], com blush suave nas bochechas, orelhas [formato, ex: arredondadas, caídas ou pontudas], e uma textura realista com acabamento suave que ressalta sua personalidade cativante. Os traços devem transmitir ternura e carisma à primeira vista.
IMPORTANTE: O personagem deve ocupar cerca de 10% da largura da imagem, posicionado de forma centralizada ou levemente deslocado, para que o cenário ao redor seja amplamente visível e contribua com a atmosfera mágica da composição.
O fundo deve retratar um cenário rico em cor e profundidade, como uma [ex: floresta ensolarada, jardim encantado, vila mágica ou clareira brilhante], com árvores detalhadas, flores vibrantes, folhas dançantes ao vento, pequenos animais ao fundo ou trilhas sinuosas. Adicione elementos que tragam dinamismo e fantasia — como luz filtrando entre as copas das árvores, pétalas flutuando no ar, cogumelos coloridos, borboletas ou passarinhos em movimento — para criar um visual cinematográfico, vibrante e encantador.
A iluminação deve ser suave e mágica, com um efeito de backlight dourado que contorna o personagem com luz quente, realçando sua silhueta e trazendo uma sensação de manhã ensolarada ou entardecer encantado.
Estilo ultra-realista cartoon, com riqueza de detalhes e atmosfera envolvente. Referências visuais: Zootopia, Encanto, Como Treinar o Seu Dragão. Composição horizontal. Resolução: 1920x1080 pixels.`;

const DEFAULT_CHARACTER_SHEET = `Olá, aqui é o Concept Artist Sênior.
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

export function PromptMasterPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
    const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
    const [imageTemplate, setImageTemplate] = useState(DEFAULT_IMAGE_TEMPLATE);
    const [characterSheet, setCharacterSheet] = useState(DEFAULT_CHARACTER_SHEET);

    useEffect(() => {
        loadPreferences();
    }, []);

    async function loadPreferences() {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('user_preferences')
                .select('master_prompt_description, master_prompt_instructions, image_prompt_template')
                .eq('user_id', user?.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (data) {
                setDescription(data.master_prompt_description || DEFAULT_DESCRIPTION);
                setInstructions(data.master_prompt_instructions || DEFAULT_INSTRUCTIONS);
                setImageTemplate(data.image_prompt_template || DEFAULT_IMAGE_TEMPLATE);
                // setCharacterSheet(data.character_sheet_template || DEFAULT_CHARACTER_SHEET);
                setCharacterSheet(DEFAULT_CHARACTER_SHEET);
            }
        } catch (err: any) {
            console.error('Error loading preferences:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError('');

            const { error: upsertError } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user?.id,
                    master_prompt_description: description,
                    master_prompt_instructions: instructions,
                    image_prompt_template: imageTemplate,
                    // character_sheet_template: characterSheet,
                }, { onConflict: 'user_id' });

            if (upsertError) throw upsertError;

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        if (confirm('Tem certeza que deseja restaurar os valores padrão?')) {
            setDescription(DEFAULT_DESCRIPTION);
            setInstructions(DEFAULT_INSTRUCTIONS);
            setImageTemplate(DEFAULT_IMAGE_TEMPLATE);
            setCharacterSheet(DEFAULT_CHARACTER_SHEET);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">✨ Prompt Mestre</h1>
                    <p className="text-muted-foreground">
                        Personalize as instruções que a IA usa para criar suas histórias
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {saved && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-500/10 text-green-500 p-4 rounded-lg mb-6 flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        Salvo com sucesso!
                    </motion.div>
                )}

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl border border-border shadow-sm p-8 space-y-6"
                >
                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Descrição do Sistema
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-y"
                            placeholder="Breve descrição do que o sistema faz..."
                        />
                        <p className="text-xs text-muted-foreground">
                            {description.length} caracteres
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Instruções Completas (Histórias)
                        </label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px] resize-y font-mono text-sm"
                            placeholder="Instruções detalhadas para a IA..."
                        />
                        <p className="text-xs text-muted-foreground">
                            {instructions.length} caracteres • Use este campo para definir como a IA deve criar as histórias
                        </p>
                    </div>

                    {/* Image Prompt Template */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Template Base de Imagens
                        </label>
                        <textarea
                            value={imageTemplate}
                            onChange={(e) => setImageTemplate(e.target.value)}
                            className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px] resize-y font-mono text-sm"
                            placeholder="Template base para geração de imagens das cenas..."
                        />
                        <p className="text-xs text-muted-foreground">
                            {imageTemplate.length} caracteres • Este template será usado como base para gerar as imagens de cada cena
                        </p>
                    </div>

                    {/* Character Sheet Oficial */}
                    <div className="space-y-2 border-t pt-6">
                        <label className="text-sm font-medium flex items-center gap-2">
                            🎨 Character Sheet Oficial
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Use este template para criar descrições detalhadas e consistentes dos personagens
                        </p>
                        <textarea
                            value={characterSheet}
                            onChange={(e) => setCharacterSheet(e.target.value)}
                            className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[400px] resize-y font-mono text-sm"
                            placeholder="Template para Character Sheet..."
                        />
                        <p className="text-xs text-muted-foreground">
                            {characterSheet.length} caracteres • Substitua [NOME DO PERSONAGEM] e demais campos para cada personagem
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleReset}
                            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-secondary/80 text-foreground transition-colors flex items-center gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Restaurar Padrão
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
