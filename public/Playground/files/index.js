const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>✨ Magic Story Studio — Image Playground</title>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;800&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0f1a; --surface: #161929; --border: #252a42;
      --accent1: #f7c948; --accent2: #ff6b6b; --accent3: #4ecdc4;
      --text: #e8eaf6; --muted: #7b82a8;
    }
    body {
      background: var(--bg); color: var(--text); font-family: 'Nunito', sans-serif;
      min-height: 100vh; display: flex; flex-direction: column; align-items: center;
      padding: 32px 16px 64px;
      background-image:
        radial-gradient(ellipse 80% 50% at 20% 0%, rgba(247,201,72,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(78,205,196,0.06) 0%, transparent 60%);
    }
    header { text-align: center; margin-bottom: 40px; animation: fadeDown .6s ease both; }
    .logo-badge {
      display: inline-flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, rgba(247,201,72,.15), rgba(78,205,196,.1));
      border: 1px solid rgba(247,201,72,.25); border-radius: 999px;
      padding: 6px 18px; font-size: 13px; font-weight: 700; color: var(--accent1);
      letter-spacing: .04em; margin-bottom: 18px;
    }
    h1 {
      font-family: 'Baloo 2', cursive; font-size: clamp(28px, 5vw, 48px);
      font-weight: 800; line-height: 1.1;
      background: linear-gradient(135deg, var(--accent1) 0%, var(--accent2) 50%, var(--accent3) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .subtitle { color: var(--muted); font-size: 15px; margin-top: 10px; }
    .card {
      width: 100%; max-width: 860px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 24px; padding: 32px;
      animation: fadeUp .6s .1s ease both; box-shadow: 0 24px 80px rgba(0,0,0,.4);
    }
    .label { font-size: 12px; font-weight: 700; letter-spacing: .08em; color: var(--muted); text-transform: uppercase; margin-bottom: 10px; }

    /* Provider tabs */
    .provider-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .provider-tab {
      padding: 8px 18px; border-radius: 999px; border: 1.5px solid var(--border);
      background: var(--bg); color: var(--muted); font-family: 'Nunito', sans-serif;
      font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s;
    }
    .provider-tab.active { border-color: var(--accent1); background: rgba(247,201,72,.1); color: var(--accent1); }
    .provider-tab:hover:not(.active) { border-color: var(--accent3); color: var(--accent3); }

    /* API key box */
    .api-key-box {
      background: rgba(78,205,196,.05); border: 1px solid rgba(78,205,196,.2);
      border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; display: none;
    }
    .api-key-box.show { display: block; }
    .api-key-label { font-size: 12px; color: var(--accent3); font-weight: 700; margin-bottom: 8px; }
    .api-key-input {
      width: 100%; background: var(--bg); border: 1.5px solid var(--border);
      border-radius: 10px; padding: 10px 14px; color: var(--text);
      font-family: 'Nunito', sans-serif; font-size: 14px; transition: border-color .2s;
    }
    .api-key-input:focus { outline: none; border-color: var(--accent1); }
    .api-key-hint { font-size: 11px; color: var(--muted); margin-top: 8px; }

    /* Model grid */
    .model-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 10px; margin-bottom: 24px; }
    .model-pill { position: relative; cursor: pointer; }
    .model-pill input { position: absolute; opacity: 0; width: 0; }
    .model-pill label {
      display: flex; flex-direction: column; gap: 2px; padding: 12px 14px;
      border-radius: 12px; border: 1.5px solid var(--border); cursor: pointer;
      transition: all .2s; background: var(--bg);
    }
    .pill-name { font-weight: 700; font-size: 13px; }
    .pill-desc { font-size: 11px; color: var(--muted); }
    .pill-cost { font-size: 11px; font-weight: 700; margin-top: 3px; }
    .pill-cost.free { color: #4ecdc4; }
    .pill-cost.cheap { color: #a8e06a; }
    .pill-cost.mid { color: #f7c948; }
    .pill-cost.expensive { color: #ff6b6b; }
    .model-pill input:checked + label { border-color: var(--accent1); background: rgba(247,201,72,.08); color: var(--accent1); }
    .model-pill label:hover { border-color: var(--accent3); }

    /* Aspect ratio */
    .ratio-row { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
    .ratio-btn {
      padding: 7px 16px; border-radius: 999px; border: 1.5px solid var(--border);
      background: var(--bg); color: var(--muted); font-family: 'Nunito', sans-serif;
      font-size: 12px; font-weight: 700; cursor: pointer; transition: all .2s;
    }
    .ratio-btn.active { border-color: var(--accent3); background: rgba(78,205,196,.1); color: var(--accent3); }
    .ratio-btn:hover:not(.active) { border-color: var(--accent1); color: var(--accent1); }

    /* Prompt */
    textarea {
      width: 100%; min-height: 110px; background: var(--bg);
      border: 1.5px solid var(--border); border-radius: 12px; padding: 16px;
      color: var(--text); font-family: 'Nunito', sans-serif; font-size: 15px;
      resize: vertical; transition: border-color .2s; line-height: 1.6; margin-bottom: 12px;
    }
    textarea:focus { outline: none; border-color: var(--accent1); }

    /* Presets */
    .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .preset-btn {
      background: var(--bg); border: 1px solid var(--border); color: var(--muted);
      border-radius: 999px; padding: 5px 14px; font-size: 12px;
      font-family: 'Nunito', sans-serif; cursor: pointer; transition: all .2s;
    }
    .preset-btn:hover { border-color: var(--accent3); color: var(--accent3); }

    /* Generate button */
    .generate-btn {
      width: 100%;
      background: linear-gradient(135deg, var(--accent1), #f5a623);
      color: #1a1200; border: none; border-radius: 12px; padding: 15px 28px;
      font-family: 'Baloo 2', cursive; font-size: 18px; font-weight: 800;
      cursor: pointer; transition: transform .15s, box-shadow .15s, opacity .2s;
      box-shadow: 0 4px 20px rgba(247,201,72,.3);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-bottom: 24px;
    }
    .generate-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(247,201,72,.4); }
    .generate-btn:disabled { opacity: .6; cursor: not-allowed; }

    /* Output */
    .output-area {
      border-radius: 16px; overflow: hidden; border: 1.5px solid var(--border);
      background: var(--bg); min-height: 220px;
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .placeholder-msg { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--muted); font-size: 14px; padding: 48px; text-align: center; }
    .placeholder-icon { font-size: 48px; opacity: .4; }
    #result-img { width: 100%; height: auto; display: block; border-radius: 14px; }
    .loading-overlay {
      position: absolute; inset: 0; background: rgba(13,15,26,.88);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 16px; border-radius: 14px; backdrop-filter: blur(4px);
    }
    .spinner { width: 48px; height: 48px; border: 3px solid rgba(247,201,72,.2); border-top-color: var(--accent1); border-radius: 50%; animation: spin .8s linear infinite; }
    .loading-text { font-size: 14px; color: var(--accent1); font-weight: 600; }
    .action-bar { display: flex; gap: 10px; margin-top: 14px; }
    .action-btn {
      flex: 1; background: var(--bg); border: 1.5px solid var(--border); color: var(--text);
      border-radius: 10px; padding: 10px; font-family: 'Nunito', sans-serif; font-size: 13px;
      font-weight: 700; cursor: pointer; transition: all .2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .action-btn:hover { border-color: var(--accent3); color: var(--accent3); }
    .action-btn.hidden { display: none; }
    .error-box {
      background: rgba(255,107,107,.1); border: 1px solid rgba(255,107,107,.3);
      border-radius: 10px; padding: 14px 18px; color: var(--accent2);
      font-size: 14px; margin-top: 14px; display: none; line-height: 1.5;
    }
    .stats-bar { display: flex; gap: 20px; margin-top: 14px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
    .stat { display: flex; gap: 5px; align-items: center; }
    .stat strong { color: var(--accent3); }
    .divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
    @keyframes fadeDown { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes popIn { from { opacity:0; transform:scale(.95); } to { opacity:1; transform:scale(1); } }
    .pop-in { animation: popIn .4s ease both; }
  </style>
</head>
<body>

<header>
  <div class="logo-badge">🎨 Magic Story Studio</div>
  <h1>Magic Story Studio</h1>
  <p class="subtitle">Geração de imagens e narração de áudio para histórias infantis</p>
  <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
    <button onclick="setMode('image')" id="mode-image" style="padding:8px 20px;border-radius:999px;border:2px solid #f7c948;background:rgba(247,201,72,.15);color:#f7c948;font-family:Nunito,sans-serif;font-weight:700;font-size:13px;cursor:pointer">🖼️ Imagens</button>
    <button onclick="setMode('audio')" id="mode-audio" style="padding:8px 20px;border-radius:999px;border:2px solid #252a42;background:#0d0f1a;color:#7b82a8;font-family:Nunito,sans-serif;font-weight:700;font-size:13px;cursor:pointer">🎙️ Narração</button>
  </div>
</header>

<div class="card">

  <div id="image-section">
  <!-- Providers -->
  <div class="label">Provedor</div>
  <div class="provider-tabs">
    <button class="provider-tab active" onclick="setProvider('cloudflare')">☁️ Cloudflare (Grátis)</button>
    <button class="provider-tab" onclick="setProvider('openai')">🤖 OpenAI</button>
    <button class="provider-tab" onclick="setProvider('google')">🌟 Google (Nano Banana)</button>
    <button class="provider-tab" onclick="setProvider('vertex')">☁️ Vertex AI (Créditos GCP)</button>
  </div>

  <!-- API Key box -->
  <div class="api-key-box" id="api-key-box">
    <div class="api-key-label" id="api-key-label">🔑 API Key</div>
    <input type="password" class="api-key-input" id="api-key-input" placeholder="Cole sua API key aqui..."/>
    <div class="api-key-hint" id="api-key-hint">🔒 Sua chave fica só no browser — enviada direto ao provedor. Não passa pelo servidor.</div>
  </div>

  <!-- Models: Cloudflare -->
  <div class="label">Modelo</div>
  <div class="model-grid" id="models-cloudflare">
    <div class="model-pill">
      <input type="radio" name="model" id="m-cf1" value="cf:flux-schnell" checked/>
      <label for="m-cf1"><span class="pill-name">⚡ FLUX Schnell</span><span class="pill-desc">Rápido • Recomendado</span><span class="pill-cost free">Grátis</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-cf2" value="cf:sdxl-base"/>
      <label for="m-cf2"><span class="pill-name">🖼️ SDXL Base</span><span class="pill-desc">Alta qualidade • Lento</span><span class="pill-cost free">Grátis</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-cf3" value="cf:sdxl-lightning"/>
      <label for="m-cf3"><span class="pill-name">🌩️ SDXL Lightning</span><span class="pill-desc">ByteDance • Rápido</span><span class="pill-cost free">Grátis</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-cf4" value="cf:dreamshaper"/>
      <label for="m-cf4"><span class="pill-name">🌈 DreamShaper 8</span><span class="pill-desc">Estilo cartoon</span><span class="pill-cost free">Grátis</span></label>
    </div>
  </div>

  <!-- Models: OpenAI -->
  <div class="model-grid" id="models-openai" style="display:none">
    <div class="model-pill">
      <input type="radio" name="model" id="m-oa1" value="openai:dall-e-3:standard:1024x1024" checked/>
      <label for="m-oa1"><span class="pill-name">🎨 DALL-E 3</span><span class="pill-desc">Standard 1:1</span><span class="pill-cost cheap">$0,040/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-oa2" value="openai:dall-e-3:hd:1024x1024"/>
      <label for="m-oa2"><span class="pill-name">✨ DALL-E 3 HD</span><span class="pill-desc">Alta definição 1:1</span><span class="pill-cost mid">$0,080/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-oa3" value="openai:dall-e-3:hd:1792x1024"/>
      <label for="m-oa3"><span class="pill-name">🖥️ DALL-E 3 16:9</span><span class="pill-desc">1792×1024 HD</span><span class="pill-cost expensive">$0,120/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-oa4" value="openai:dall-e-3:hd:1024x1792"/>
      <label for="m-oa4"><span class="pill-name">📱 DALL-E 3 9:16</span><span class="pill-desc">1024×1792 HD capa</span><span class="pill-cost expensive">$0,120/img</span></label>
    </div>
  </div>

  <!-- Models: Google -->
  <div class="model-grid" id="models-google" style="display:none">
    <div class="model-pill">
      <input type="radio" name="model" id="m-g1" value="google:gemini-3.1-flash-image-preview" checked/>
      <label for="m-g1"><span class="pill-name">⚡ Gemini 2.5 Flash</span><span class="pill-desc">Nano Banana • Rápido</span><span class="pill-cost cheap">$0,039/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-g2" value="google:gemini-3.1-flash-image-preview"/>
      <label for="m-g2"><span class="pill-name">🍌 Nano Banana 2</span><span class="pill-desc">Gemini 3.1 Flash</span><span class="pill-cost mid">$0,067/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-g3" value="google:gemini-3-pro-image-preview"/>
      <label for="m-g3"><span class="pill-name">⭐ Nano Banana Pro</span><span class="pill-desc">Máxima qualidade</span><span class="pill-cost expensive">$0,134/img</span></label>
    </div>
  </div>

  <!-- Models: Vertex AI -->
  <div class="model-grid" id="models-vertex" style="display:none">
    <div class="model-pill">
      <input type="radio" name="model" id="m-v1" value="vertex:gemini-3.1-flash-image-preview" checked/>
      <label for="m-v1"><span class="pill-name">🍌 Nano Banana 2</span><span class="pill-desc">Gemini 3.1 Flash</span><span class="pill-cost mid">$0,067/img</span></label>
    </div>
    <div class="model-pill">
      <input type="radio" name="model" id="m-v2" value="vertex:gemini-3-pro-image-preview"/>
      <label for="m-v2"><span class="pill-name">⭐ Nano Banana Pro</span><span class="pill-desc">Máxima qualidade</span><span class="pill-cost expensive">$0,134/img</span></label>
    </div>
  </div>

  <!-- Aspect ratio -->
  <div class="label">Proporção (aspect ratio)</div>
  <div class="ratio-row" id="ratio-row">
    <button class="ratio-btn" onclick="setRatio('1:1')">1:1 quadrado</button>
    <button class="ratio-btn active" onclick="setRatio('16:9')">16:9 landscape ✅</button>
    <button class="ratio-btn" onclick="setRatio('9:16')">9:16 capa</button>
    <button class="ratio-btn" onclick="setRatio('4:3')">4:3</button>
  </div>

  <!-- Prompt -->
  <div class="label">Prompt</div>
  <textarea id="prompt">A cute cartoon lion with fluffy golden mane walking happily on a dirt path in the African savanna, 3D Pixar animation style, big expressive eyes, wide smile, acacia trees, large orange sun, blue sky with white clouds, tall grass foreground, warm cinematic lighting, vibrant colors, children book illustration, widescreen 16:9</textarea>

  <!-- Presets -->
  <div class="presets">
    <button class="preset-btn" onclick="setPreset('lion')">🦁 Leão na savana</button>
    <button class="preset-btn" onclick="setPreset('mouse')">🐭 Ratinho aventureiro</button>
    <button class="preset-btn" onclick="setPreset('cover')">📖 Capa do livro</button>
    <button class="preset-btn" onclick="setPreset('duo')">🦁🐭 Leão + Rato</button>
    <button class="preset-btn" onclick="setPreset('castle')">🏰 Castelo mágico</button>
  </div>

  <button class="generate-btn" id="generate-btn" onclick="generateImage()">
    <span id="btn-icon">✨</span>
    <span id="btn-text">Gerar Imagem</span>
  </button>

  <hr class="divider"/>

  <div class="label">Resultado</div>
  <div class="output-area" id="output-area">
    <div class="placeholder-msg" id="placeholder">
      <span class="placeholder-icon">🖼️</span>
      <span>Sua imagem aparecerá aqui</span>
      <span style="font-size:12px">Escolha o provedor, modelo e clique em Gerar</span>
    </div>
    <div class="loading-overlay" id="loading" style="display:none">
      <div class="spinner"></div>
      <div class="loading-text" id="loading-text">Gerando imagem...</div>
    </div>
  </div>

  <div class="action-bar">
    <button class="action-btn hidden" id="download-btn" onclick="downloadImage()">⬇️ Download</button>
    <button class="action-btn hidden" id="copy-btn" onclick="copyPrompt()">📋 Copiar Prompt</button>
    <button class="action-btn hidden" id="regen-btn" onclick="generateImage()">🔄 Regerar</button>
  </div>

  <div class="error-box" id="error-box"></div>

  <div class="stats-bar" id="stats-bar" style="display:none">
    <div class="stat">⏱ Tempo: <strong id="stat-time">—</strong></div>
    <div class="stat">🤖 Modelo: <strong id="stat-model">—</strong></div>
    <div class="stat">📐 Ratio: <strong id="stat-ratio">—</strong></div>
    <div class="stat">💰 Custo: <strong id="stat-cost">—</strong></div>
  </div>

</div>

</div><!-- /image-section -->

<div id="audio-section" style="display:none">

  <!-- Layout duas colunas -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

    <!-- Coluna esquerda: Texto -->
    <div>
      <div class="label">Texto para narrar</div>
      <textarea id="tts-text" style="min-height:220px" placeholder="Cole aqui o texto da história...">Era uma vez um leão muito corajoso que vivia na savana africana. Certo dia, enquanto caminhava pela floresta, ele encontrou um pequeno rato perdido. O leão, com seu coração bondoso, decidiu ajudar o ratinho a encontrar o caminho de volta para casa.</textarea>

      <div class="label" style="margin-top:12px">Instrução de estilo</div>
      <textarea id="tts-style" style="min-height:80px" placeholder="Tom, emoção, ritmo...">Narre em tom animado e caloroso para crianças de 4 a 8 anos, como uma contadora de histórias entusiasmada.</textarea>
    </div>

    <!-- Coluna direita: Configurações -->
    <div>
      <div class="label">Provedor</div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="provider-tab active" id="audio-prov-vertex" onclick="setAudioProvider('vertex')">☁️ Vertex AI</button>
        <button class="provider-tab" id="audio-prov-google" onclick="setAudioProvider('google')">🌟 AI Studio</button>
      </div>

      <div style="background:rgba(78,205,196,.05);border:1px solid rgba(78,205,196,.2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div class="label" style="color:#4ecdc4;margin-bottom:8px">🔑 Credenciais</div>
        <input type="password" class="api-key-input" id="audio-project" placeholder="Project ID (ex: project-07564737...)"/>
        <input type="password" class="api-key-input" id="audio-token" placeholder="Access Token (ya29... — Cloud Shell)" style="margin-top:8px"/>
        <div class="api-key-hint" id="audio-hint" style="margin-top:6px">Vertex AI: Project ID + Access Token<br>gcloud auth print-access-token</div>
      </div>

      <div class="label">Modelo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div class="model-pill">
          <input type="radio" name="tts-model" id="tts-m1" value="gemini-3.1-flash-tts-preview" checked/>
          <label for="tts-m1"><span class="pill-name">⚡ Flash TTS</span><span class="pill-desc">Rápido • Natural</span><span class="pill-cost cheap">~$0,006/min</span></label>
        </div>
        <div class="model-pill">
          <input type="radio" name="tts-model" id="tts-m2" value="gemini-2.5-pro-preview-tts"/>
          <label for="tts-m2"><span class="pill-name">🎭 Pro TTS</span><span class="pill-desc">Alta qualidade</span><span class="pill-cost mid">~$0,019/min</span></label>
        </div>
      </div>

      <div class="label">Voz</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="model-pill"><input type="radio" name="tts-voice" id="v1" value="Kore" checked/><label for="v1"><span class="pill-name">🧒 Kore</span><span class="pill-desc">Infantil • Doce</span></label></div>
        <div class="model-pill"><input type="radio" name="tts-voice" id="v2" value="Puck"/><label for="v2"><span class="pill-name">🧒 Puck</span><span class="pill-desc">Jovem • Alegre</span></label></div>
        <div class="model-pill"><input type="radio" name="tts-voice" id="v3" value="Aoede"/><label for="v3"><span class="pill-name">👩 Aoede</span><span class="pill-desc">Feminina • Suave</span></label></div>
        <div class="model-pill"><input type="radio" name="tts-voice" id="v4" value="Charon"/><label for="v4"><span class="pill-name">👨 Charon</span><span class="pill-desc">Masculina</span></label></div>
        <div class="model-pill"><input type="radio" name="tts-voice" id="v5" value="Fenrir"/><label for="v5"><span class="pill-name">🦁 Fenrir</span><span class="pill-desc">Dramática</span></label></div>
        <div class="model-pill"><input type="radio" name="tts-voice" id="v6" value="Leda"/><label for="v6"><span class="pill-name">👧 Leda</span><span class="pill-desc">Criança • Fofa</span></label></div>
      </div>
    </div>
  </div>

  <!-- Botão gerar -->
  <button class="generate-btn" id="tts-btn" onclick="generateAudio()" style="margin-top:20px">
    <span id="tts-btn-icon">🎙️</span>
    <span id="tts-btn-text">Gerar Narração</span>
  </button>

  <!-- Resultado -->
  <div id="audio-result" style="margin-top:16px;display:none">
    <div class="label">▶️ Narração gerada</div>
    <audio id="audio-player" controls style="width:100%;margin-top:8px;border-radius:10px;background:#161929"></audio>
    <div class="action-bar" style="margin-top:10px">
      <button class="action-btn" onclick="downloadAudio()">⬇️ Download WAV</button>
    </div>
  </div>

  <div class="error-box" id="audio-error-box"></div>

  <div class="stats-bar" id="audio-stats" style="display:none">
    <div class="stat">⏱ Tempo: <strong id="audio-stat-time">—</strong></div>
    <div class="stat">🎙️ Modelo: <strong id="audio-stat-model">—</strong></div>
    <div class="stat">💰 Custo est.: <strong id="audio-stat-cost">—</strong></div>
  </div>
</div>

<script>
const PRESETS = {
  lion:   "A cute cartoon lion with fluffy golden mane walking happily on a dirt path in the African savanna, 3D Pixar animation style, big expressive eyes, wide smile, acacia trees, large orange sun, blue sky with white clouds, tall grass foreground, warm cinematic lighting, vibrant colors, children book illustration",
  mouse:  "An adorable tiny cartoon mouse wearing a small green backpack, running through tall golden grass savanna, 3D animation style, big expressive eyes, Pixar render quality, warm sunlight, children book illustration",
  cover:  "Children book cover illustration, a brave lion and a tiny mouse standing together on a rock in the savanna, friendship, warm golden hour lighting, 3D cartoon Pixar style, dramatic sky with rays of light, title space at top",
  duo:    "A cartoon lion and a tiny mouse as best friends, lion sitting on a rock with mouse on his paw, African savanna sunset, 3D Pixar style, warm golden lighting, vibrant colors, children book illustration, emotional and heartwarming scene",
  castle: "A magical fairy tale castle on a hill, pastel colors, fluffy clouds, rainbow, 3D cartoon children book illustration style, dreamy atmosphere, sparkles and stars, wide landscape view"
};

const CF_MODELS = {
  'cf:flux-schnell':   '@cf/black-forest-labs/flux-1-schnell',
  'cf:sdxl-base':      '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  'cf:sdxl-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
  'cf:dreamshaper':    '@cf/lykon/dreamshaper-8-lcm',
};

// ratio → {width, height} for Cloudflare/OpenAI
const RATIO_SIZES = {
  '1:1':  { w: 1024, h: 1024 },
  '16:9': { w: 1792, h: 1024 },
  '9:16': { w: 1024, h: 1792 },
  '4:3':  { w: 1024, h: 768  },
};

// Google aspect ratio strings
const GOOGLE_RATIOS = {
  '1:1':  'IMAGE_ASPECT_RATIO_SQUARE',
  '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '4:3':  'IMAGE_ASPECT_RATIO_LANDSCAPE', // fallback
};

const COSTS = {
  'dall-e-3:standard:1024x1024': '$0.040',
  'dall-e-3:hd:1024x1024':       '$0.080',
  'dall-e-3:hd:1792x1024':       '$0.120',
  'dall-e-3:hd:1024x1792':       '$0.120',
  'gemini-3.1-flash-image-preview': '$0.067',
  'gemini-3-pro-image-preview': '$0.134',
};

let currentProvider = 'cloudflare';
let currentRatio = '16:9';
let currentImageUrl = null;

function setProvider(p) {
  currentProvider = p;
  document.querySelectorAll('.provider-tab').forEach((t,i) => {
    t.classList.toggle('active',
      (i===0&&p==='cloudflare')||(i===1&&p==='openai')||(i===2&&p==='google')||(i===3&&p==='vertex'));
  });
  ['cloudflare','openai','google','vertex'].forEach(id => {
    document.getElementById('models-'+id).style.display = id===p ? 'grid' : 'none';
  });

  const box = document.getElementById('api-key-box');
  const lbl = document.getElementById('api-key-label');
  const inp = document.getElementById('api-key-input');
  const hint = document.getElementById('api-key-hint');

  if (p === 'openai') {
    box.classList.add('show');
    lbl.textContent = '🔑 OpenAI API Key';
    inp.placeholder = 'sk-proj-...';
    hint.textContent = '🔒 Enviada direto para api.openai.com — não passa pelo servidor.';
  } else if (p === 'google') {
    box.classList.add('show');
    lbl.textContent = '🔑 Google AI Studio API Key';
    inp.placeholder = 'AIza...';
    hint.textContent = '🔒 Enviada direto para generativelanguage.googleapis.com — não passa pelo servidor. Pegue em: aistudio.google.com';
  } else if (p === 'vertex') {
    box.classList.add('show');
    lbl.textContent = '☁️ Vertex AI — Project ID + Access Token';
    inp.placeholder = 'Project ID (ex: meu-projeto-123456)';
    hint.textContent = '🔑 Preencha o Project ID acima e o Access Token abaixo. Gere o token no Cloud Shell: gcloud auth print-access-token';
    // Adicionar campo de access token se não existir
    if (!document.getElementById('vertex-token')) {
      const tokenInput = document.createElement('input');
      tokenInput.type = 'password';
      tokenInput.className = 'api-key-input';
      tokenInput.id = 'vertex-token';
      tokenInput.placeholder = 'Access Token (ya29...)';
      tokenInput.style.marginTop = '8px';
      inp.parentNode.insertBefore(tokenInput, hint);
    }
    document.getElementById('vertex-token').style.display = 'block';
  } else {
    box.classList.remove('show');
    const vt = document.getElementById('vertex-token');
    if (vt) vt.style.display = 'none';
  }

  // check first radio
  const first = document.querySelector('#models-'+p+' input[type=radio]');
  if (first) first.checked = true;

  // OpenAI fixa o tamanho no modelo, não no seletor
  updateRatioAvailability();
}

function setRatio(r) {
  currentRatio = r;
  document.querySelectorAll('.ratio-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.startsWith(r));
  });
}

function updateRatioAvailability() {
  // para openai, ratio está embutido no modelo — desabilita botões
  const isOpenAI = currentProvider === 'openai';
  document.querySelectorAll('.ratio-btn').forEach(b => {
    b.style.opacity = isOpenAI ? '0.4' : '1';
    b.style.pointerEvents = isOpenAI ? 'none' : 'auto';
  });
  if (isOpenAI) {
    const hint = document.createElement('div');
  }
}

function setPreset(k) { document.getElementById('prompt').value = PRESETS[k]; }

async function generateImage() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) return alert('Digite um prompt!');

  const modelVal = document.querySelector('input[name="model"]:checked')?.value || '';

  if (currentProvider === 'openai') {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key || !key.startsWith('sk-')) { showError('Cole sua OpenAI API key (começa com sk-)'); return; }
    await generateOpenAI(prompt, modelVal, key);
  } else if (currentProvider === 'google') {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key || !key.startsWith('AIza')) { showError('Cole sua Google AI Studio API key (começa com AIza...)'); return; }
    await generateGoogle(prompt, modelVal, key);
  } else if (currentProvider === 'vertex') {
    const projectId = document.getElementById('api-key-input').value.trim();
    const token = document.getElementById('vertex-token')?.value.trim();
    if (!projectId) { showError('Preencha o Project ID'); return; }
    if (!token || !token.startsWith('ya29')) { showError('Cole o Access Token (começa com ya29...)'); return; }
    await generateVertex(prompt, modelVal, projectId, token);
  } else {
    await generateCloudflare(prompt, modelVal);
  }
}

/* ── Cloudflare ── */
async function generateCloudflare(prompt, modelVal) {
  const cfModel = CF_MODELS[modelVal] || CF_MODELS['cf:flux-schnell'];
  const size = RATIO_SIZES[currentRatio] || RATIO_SIZES['1:1'];
  setLoading(true);
  const t = Date.now();
  try {
    const r = await fetch('/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prompt, model: cfModel, width: size.w, height: size.h })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error||'Erro Cloudflare'); }
    const blob = await r.blob();
    showImage(URL.createObjectURL(blob), Date.now()-t, cfModel.split('/').pop(), 'Grátis ☁️');
  } catch(e) { showError(e.message); }
  finally { setLoading(false); }
}

/* ── OpenAI ── */
async function generateOpenAI(prompt, modelVal, apiKey) {
  const parts = modelVal.replace('openai:','').split(':');
  const modelName = parts[0];
  const quality   = parts[1];
  const size      = parts[2];
  const costKey   = modelName+':'+quality+':'+size;

  setLoading(true);
  const t = Date.now();
  try {
    const body = { model: modelName, prompt, n: 1, size, quality, response_format: 'url' };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error?.message || 'Erro OpenAI '+r.status);
    }
    const data = await r.json();
    const imgSrc = data.data[0].url || ('data:image/png;base64,'+data.data[0].b64_json);
    showImage(imgSrc, Date.now()-t, modelName, COSTS[costKey]||'?');
  } catch(e) { showError(e.message); }
  finally { setLoading(false); }
}

/* ── Google AI Studio ── */
async function generateGoogle(prompt, modelVal, apiKey) {
  const modelId = modelVal.replace('google:','');
  const cost = COSTS[modelId] || '?';

  // Aspect ratio string para Imagen
  const IMAGEN_RATIOS = { '1:1':'1:1', '16:9':'16:9', '9:16':'9:16', '4:3':'4:3' };
  const aspectRatio = IMAGEN_RATIOS[currentRatio] || '16:9';

  setLoading(true);
  const t = Date.now();
  try {
    let imgSrc = null;

    if (modelId === 'gemini-3.1-flash-image-preview' || modelId === 'gemini-3-pro-image-preview' || modelId === 'gemini-3.1-flash-image-preview') {
      // Gemini Flash — generateContent com responseModalities IMAGE
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelId}:generateContent?key=\${apiKey}\`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error?.message || 'Erro Google ' + r.status);
      }
      const data = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          imgSrc = 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data;
          break;
        }
      }

    } else {
      // Imagen 3 — endpoint predict
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelId}:predict?key=\${apiKey}\`;
      const body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          safetySetting: 'block_only_high',
        }
      };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error?.message || 'Erro Google ' + r.status);
      }
      const data = await r.json();
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      const mime = data.predictions?.[0]?.mimeType || 'image/png';
      if (b64) imgSrc = \`data:\${mime};base64,\${b64}\`;
    }

    if (!imgSrc) throw new Error('Nenhuma imagem retornada. Verifique se sua API key tem acesso ao modelo selecionado.');
    showImage(imgSrc, Date.now()-t, modelId.split('-').slice(0,2).join('-'), cost);
  } catch(e) { showError(e.message); }
  finally { setLoading(false); }
}

/* ── Vertex AI ── */
async function generateVertex(prompt, modelVal, projectId, accessToken) {
  const modelId = modelVal.replace('vertex:','');
  const cost = {'gemini-3.1-flash-image-preview':'$0.067','gemini-3-pro-image-preview':'$0.134'}[modelId]||'?';
  const VERTEX_RATIOS = {'1:1':'1:1','16:9':'16:9','9:16':'9:16','4:3':'4:3'};
  const aspectRatio = VERTEX_RATIOS[currentRatio] || '16:9';
  const region = 'global';

  setLoading(true);
  const t = Date.now();
  try {
    const url = \`https://aiplatform.googleapis.com/v1/projects/\${projectId}/locations/global/publishers/google/models/\${modelId}:generateContent\`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio }
      }
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error?.message || 'Erro Vertex AI ' + r.status);
    }
    const data = await r.json();
    let imgSrc = null;

    // Formato Imagen (predict)
    if (data.predictions) {
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      const mime = data.predictions?.[0]?.mimeType || 'image/png';
      if (b64) imgSrc = 'data:' + mime + ';base64,' + b64;
    } else {
      // Formato Gemini (generateContent)
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          imgSrc = 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data;
          break;
        }
      }
    }
    if (!imgSrc) throw new Error('Nenhuma imagem retornada. Verifique se a Vertex AI API está habilitada no projeto e se o token não expirou.');
    showImage(imgSrc, Date.now()-t, modelId.split('-').slice(0,3).join('-'), cost + ' (créditos GCP)');
  } catch(e) { showError(e.message); }
  finally { setLoading(false); }
}

/* ── Helpers ── */
function showImage(url, elapsed, label, cost) {
  currentImageUrl = url;
  const old = document.getElementById('result-img');
  if (old) old.remove();
  const img = document.createElement('img');
  img.id = 'result-img'; img.src = url; img.className = 'pop-in';
  document.getElementById('output-area').appendChild(img);
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('stat-time').textContent = (elapsed/1000).toFixed(1)+'s';
  document.getElementById('stat-model').textContent = label;
  document.getElementById('stat-ratio').textContent = currentRatio;
  document.getElementById('stat-cost').textContent = cost;
  document.getElementById('stats-bar').style.display = 'flex';
  ['download-btn','copy-btn','regen-btn'].forEach(id => document.getElementById(id).classList.remove('hidden'));
}

function showError(msg) {
  const b = document.getElementById('error-box');
  b.textContent = '❌ ' + msg; b.style.display = 'block';
}

function setLoading(on) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = on;
  document.getElementById('btn-icon').textContent = on ? '⏳' : '✨';
  document.getElementById('btn-text').textContent = on ? 'Gerando...' : 'Gerar Imagem';
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
  document.getElementById('error-box').style.display = 'none';
  if (on) {
    document.getElementById('stats-bar').style.display = 'none';
    ['download-btn','copy-btn','regen-btn'].forEach(id => document.getElementById(id).classList.add('hidden'));
    const msgs = ['Gerando imagem...','Processando pixels...','Aplicando magia ✨','Quase pronto...','Renderizando detalhes...'];
    let i = 0;
    window._mi = setInterval(() => { document.getElementById('loading-text').textContent = msgs[++i%msgs.length]; }, 2500);
  } else { clearInterval(window._mi); }
}

function downloadImage() {
  if (!currentImageUrl) return;
  const a = document.createElement('a');
  a.href = currentImageUrl; a.download = 'magic-story-'+Date.now()+'.png'; a.click();
}

function copyPrompt() {
  navigator.clipboard.writeText(document.getElementById('prompt').value).then(() => {
    const b = document.getElementById('copy-btn');
    b.textContent = '✅ Copiado!';
    setTimeout(() => { b.innerHTML = '📋 Copiar Prompt'; }, 2000);
  });
}

document.getElementById('prompt').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') generateImage();
});

// init
setRatio('16:9');

/* ── Mode switch ── */
function setMode(mode) {
  const isAudio = mode === 'audio';

  // Toggle seções
  document.getElementById('audio-section').style.display = isAudio ? 'block' : 'none';
  document.getElementById('image-section').style.display = isAudio ? 'none' : 'block';

  // Update mode buttons
  const imgBtn = document.getElementById('mode-image');
  const audBtn = document.getElementById('mode-audio');
  imgBtn.style.borderColor = isAudio ? '#252a42' : '#f7c948';
  imgBtn.style.background = isAudio ? '#0d0f1a' : 'rgba(247,201,72,.15)';
  imgBtn.style.color = isAudio ? '#7b82a8' : '#f7c948';
  audBtn.style.borderColor = isAudio ? '#f7c948' : '#252a42';
  audBtn.style.background = isAudio ? 'rgba(247,201,72,.15)' : '#0d0f1a';
  audBtn.style.color = isAudio ? '#f7c948' : '#7b82a8';
}

let currentAudioProvider = 'vertex';
let currentAudioBlob = null;

function setAudioProvider(p) {
  currentAudioProvider = p;
  document.getElementById('audio-prov-vertex').classList.toggle('active', p === 'vertex');
  document.getElementById('audio-prov-google').classList.toggle('active', p === 'google');
  const tokenField = document.getElementById('audio-token');
  const hint = document.getElementById('audio-hint');
  const project = document.getElementById('audio-project');
  if (p === 'vertex') {
    tokenField.style.display = 'block';
    project.placeholder = 'Project ID (ex: project-07564737-45c4-4b24-823)';
    hint.textContent = 'Para Vertex AI: Project ID + Access Token (gcloud auth print-access-token)';
  } else {
    tokenField.style.display = 'none';
    project.placeholder = 'Google AI Studio API Key (AIza...)';
    hint.textContent = 'Cole sua API key do Google AI Studio';
  }
}

function addWavHeaders(pcmData, sampleRate, numChannels, bitsPerSample) {
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer).set(pcmData, 44);
  return new Uint8Array(buffer);
}

async function generateAudio() {
  const text = document.getElementById('tts-text').value.trim();
  const style = document.getElementById('tts-style').value.trim();
  const model = document.querySelector('input[name="tts-model"]:checked')?.value || 'gemini-3.1-flash-preview-tts';
  const voice = document.querySelector('input[name="tts-voice"]:checked')?.value || 'Kore';
  const projectOrKey = document.getElementById('audio-project').value.trim();

  if (!text) { showAudioError('Digite o texto para narrar!'); return; }
  if (!projectOrKey) { showAudioError('Preencha o Project ID ou API Key!'); return; }

  const btn = document.getElementById('tts-btn');
  btn.disabled = true;
  document.getElementById('tts-btn-icon').textContent = '⏳';
  document.getElementById('tts-btn-text').textContent = 'Gerando áudio...';
  document.getElementById('audio-error-box').style.display = 'none';
  document.getElementById('audio-result').style.display = 'none';
  document.getElementById('audio-stats').style.display = 'none';

  const t = Date.now();

  try {
    let audioBase64, mimeType = 'audio/wav';

    const prompt = style ? style + ' ' + text : text;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode: 'pt-BR',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    };

    let url, headers;
    if (currentAudioProvider === 'vertex') {
      const token = document.getElementById('audio-token').value.trim();
      if (!token) { showAudioError('Cole o Access Token do Cloud Shell!'); btn.disabled = false; document.getElementById('tts-btn-icon').textContent = '🎙️'; document.getElementById('tts-btn-text').textContent = 'Gerar Narração'; return; }
      url = 'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/' + projectOrKey + '/locations/us-central1/publishers/google/models/' + model + ':generateContent';
      headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-goog-user-project': projectOrKey };
    } else {
      url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + projectOrKey;
      headers = { 'Content-Type': 'application/json' };
    }

    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error?.message || 'Erro ' + r.status);
    }
    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('audio/')) {
        audioBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
        break;
      }
    }

    if (!audioBase64) throw new Error('Nenhum áudio retornado. Verifique o modelo e as credenciais.');

    // Vertex AI TTS retorna PCM raw (16bit, 24kHz, mono) sem headers WAV
    // Precisamos adicionar os headers WAV para o browser tocar
    const binary = atob(audioBase64);
    const pcmBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) pcmBytes[i] = binary.charCodeAt(i);

    // Criar WAV com headers corretos
    const wavBytes = addWavHeaders(pcmBytes, 24000, 1, 16);
    currentAudioBlob = new Blob([wavBytes], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(currentAudioBlob);

    document.getElementById('audio-player').src = audioUrl;
    document.getElementById('audio-result').style.display = 'block';

    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    document.getElementById('audio-stat-time').textContent = elapsed + 's';
    document.getElementById('audio-stat-model').textContent = model.split('-').slice(0,3).join('-');
    document.getElementById('audio-stat-cost').textContent = '~$0,006/min';
    document.getElementById('audio-stats').style.display = 'flex';

  } catch(e) {
    showAudioError(e.message);
  } finally {
    btn.disabled = false;
    document.getElementById('tts-btn-icon').textContent = '🎙️';
    document.getElementById('tts-btn-text').textContent = 'Gerar Narração';
  }
}

function showAudioError(msg) {
  const b = document.getElementById('audio-error-box');
  b.textContent = '❌ ' + msg;
  b.style.display = 'block';
}

function downloadAudio() {
  if (!currentAudioBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(currentAudioBlob);
  a.download = 'narracao-' + Date.now() + '.wav';
  a.click();
}
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    if (url.pathname === '/generate' && request.method === 'POST') {
      try {
        const { prompt, model, width = 1024, height = 1024 } = await request.json();
        if (!prompt) return Response.json({ error: 'Prompt obrigatório' }, { status: 400 });

        const valid = [
          '@cf/black-forest-labs/flux-1-schnell',
          '@cf/stabilityai/stable-diffusion-xl-base-1.0',
          '@cf/bytedance/stable-diffusion-xl-lightning',
          '@cf/lykon/dreamshaper-8-lcm',
        ];
        const selected = valid.includes(model) ? model : '@cf/black-forest-labs/flux-1-schnell';
        const inputs = { prompt };
        if (selected !== '@cf/black-forest-labs/flux-1-schnell') {
          inputs.width = Math.min(width, 1024);
          inputs.height = Math.min(height, 1024);
        }

        const response = await env.AI.run(selected, inputs);
        let imageData;
        if (response && typeof response === 'object' && response.image) {
          const binary = atob(response.image);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          imageData = bytes;
        } else {
          imageData = response;
        }

        return new Response(imageData, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        });

      } catch (err) {
        return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
