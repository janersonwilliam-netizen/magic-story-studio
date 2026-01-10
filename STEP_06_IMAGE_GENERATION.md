# Passo 6: Geração de Imagens das Cenas (DALL-E 3)

## 🎯 Objetivo
Permitir que cada cena tenha uma imagem gerada por IA, mantendo consistência visual (estilo Pixar/DreamWorks) e fidelidade à narrativa.

## 🛠 Atividades
1. **Engenharia de Prompt (Gemini)**:
   - Criar função `generateImagePrompt` no serviço Gemini.
   - Transformar a `visual_description` da cena em um prompt otimizado para DALL-E 3.
   - Garantir inclusão do estilo visual e características dos personagens.

2. **Integração OpenAI (DALL-E 3)**:
   - Criar serviço `src/services/openai.ts`.
   - Implementar chamada à API `images.generate`.
   - Gerenciar erros e custos (DALL-E 3 é mais caro, cuidado com loops).

3. **Interface de Usuário**:
   - Atualizar `SceneList` e `SceneItem`.
   - Adicionar botão "Gerar Imagem" por cena.
   - Adicionar placeholder enquanto gera.
   - Exibir imagem gerada com opção de regenerar.

4. **Armazenamento**:
   - Salvar imagem gerada no bucket `story-images` do Supabase.
   - Salvar URL pública na tabela `assets`.

## 📋 Checklist de Implementação
- [ ] Configurar `VITE_OPENAI_API_KEY`.
- [ ] Criar serviço OpenAI.
- [ ] Implementar geração de prompt refinado (Gemini).
- [ ] Implementar UI de geração nos cards de cena.
- [ ] Integrar upload para Supabase Storage.
- [ ] Salvar referência no banco de dados.

## ⚠️ Pontos de Atenção
- **Consistência**: O prompt deve repetir as características físicas dos personagens em cada cena.
- **Custo**: Evitar gerar automaticamente todas as imagens de uma vez. O usuário deve clicar cena por cena ou confirmar "Gerar Todas".
- **Estilo**: Forçar "3D render, Pixar style, vivid colors, high quality" no prompt.
