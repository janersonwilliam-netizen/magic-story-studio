# ✨ Magic Story Studio — Image Playground

Playground de geração de imagens usando **Cloudflare Workers AI** (100% gratuito).

## Modelos disponíveis

| Modelo | Velocidade | Qualidade | Estilo |
|--------|-----------|-----------|--------|
| FLUX.1 Schnell | ⚡ Muito rápido | ★★★★☆ | Versátil |
| SDXL Base | 🐢 Lento | ★★★★★ | Fotorrealista |
| SDXL Lightning | ⚡ Rápido | ★★★★☆ | Balanceado |
| DreamShaper 8 | 🚀 Rápido | ★★★★☆ | Artístico/Cartoon |

## Como rodar localmente

### 1. Instalar dependências
```bash
npm install
```

### 2. Login no Cloudflare
```bash
npx wrangler login
```

### 3. Rodar em modo desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:8787

> ⚠️ A inferência roda nos servidores da Cloudflare mesmo em modo local. Você precisa estar conectado à internet.

## Como fazer deploy

```bash
npm run deploy
```

Seu playground ficará disponível em:
`https://flux-playground.SEU-SUBDOMINIO.workers.dev`

## Uso da API diretamente

```bash
curl -X POST https://SEU-WORKER.workers.dev/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cute cartoon lion, 3D Pixar style",
    "model": "@cf/black-forest-labs/flux-1-schnell",
    "width": 1024,
    "height": 1024
  }' --output imagem.png
```

## Limites gratuitos

- ✅ **100.000 requisições/dia** no free tier
- ✅ Sem watermark
- ✅ Sem cartão de crédito
- ✅ Imagens 100% suas
