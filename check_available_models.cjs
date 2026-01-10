// Script para verificar modelos disponíveis com sua API Key
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ VITE_GEMINI_API_KEY não encontrada no .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        console.log('🔍 Verificando modelos disponíveis...\n');

        const models = await genAI.listModels();

        console.log('📋 MODELOS DISPONÍVEIS:\n');

        const imageModels = [];
        const textModels = [];

        for (const model of models) {
            const info = `- ${model.name} (${model.displayName})`;

            if (model.name.includes('image') || model.displayName.toLowerCase().includes('image')) {
                imageModels.push(info);
            } else {
                textModels.push(info);
            }
        }

        console.log('🖼️  MODELOS DE IMAGEM:');
        if (imageModels.length > 0) {
            imageModels.forEach(m => console.log(m));
        } else {
            console.log('   ❌ Nenhum modelo de imagem disponível');
        }

        console.log('\n📝 MODELOS DE TEXTO:');
        textModels.slice(0, 5).forEach(m => console.log(m));
        console.log(`   ... e mais ${textModels.length - 5} modelos\n`);

        // Verificar especificamente o Nano Banana
        const nanoBanana = models.find(m =>
            m.name.includes('gemini-2.5-flash-image') ||
            m.name.includes('imagen')
        );

        if (nanoBanana) {
            console.log('✅ Nano Banana DISPONÍVEL:', nanoBanana.name);
        } else {
            console.log('❌ Nano Banana NÃO DISPONÍVEL');
            console.log('\n💡 SOLUÇÃO:');
            console.log('   1. Habilite billing no Google AI Studio');
            console.log('   2. Ou use DALL-E 3 (OpenAI) como alternativa');
        }

    } catch (error) {
        console.error('❌ Erro ao listar modelos:', error.message);

        if (error.message.includes('quota')) {
            console.log('\n⚠️  PROBLEMA DE QUOTA DETECTADO');
            console.log('   Sua API Key não tem acesso aos modelos de imagem.');
            console.log('   Você precisa:');
            console.log('   1. Habilitar billing no Google Cloud Console');
            console.log('   2. Ou criar uma nova API Key com acesso ao Imagen/Nano Banana');
        }
    }
}

listModels();
