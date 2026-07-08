import React, { useState } from "react";
import { motion } from "framer-motion";
import { Music, Users, Image, Video, Sparkles, Plus, Trash2, RefreshCw, Loader2, Play, Download, ChevronRight, Wand2 } from "lucide-react";
import { MusicProject, MusicScene, MusicCharacter, MusicStep, MusicGenre, MusicDurationTarget } from "../types/music";
import { VisualStyle } from "../types/studio";
import { generateMusicScenes, generateMusicCharacters, generateAnimationPrompt, generateMusicCoverPrompt, generateSongLyrics } from "../services/musicClip";
import { generateSongAudio } from "../services/musicAudio";
import { generateImageWithNanoBanana as generateImage, generateImageWithReferences } from "../services/google_image";
import { generateVideoVertex } from "../services/video_service";
import { DEFAULT_IMAGE_TEMPLATE_3D, DEFAULT_IMAGE_TEMPLATE_2D } from "../lib/promptDefaults";

const STEPS: { key: MusicStep; label: string }[] = [
  { key: "LYRICS", label: "Letra" },
  { key: "AUDIO", label: "Musica" },
  { key: "CHARACTERS", label: "Personagens" },
  { key: "COVER", label: "Capa" },
  { key: "IMAGES", label: "Imagens" },
  { key: "VIDEOS", label: "Videos" },
];

const VISUAL_STYLES: VisualStyle[] = ["Estilo 2D Cartoon", "Estilo Pixar 3D"];
const MUSIC_GENRES: MusicGenre[] = ["Música Infantil", "Música Infantil Bíblica"];
const DURATION_OPTIONS: { key: MusicDurationTarget; label: string }[] = [
  { key: "curta", label: "Curta (~1 min)" },
  { key: "media", label: "Média (~2 min)" },
  { key: "longa", label: "Longa (~3 min)" },
];

function newProject(): MusicProject {
  return {
    id: crypto.randomUUID(),
    title: "",
    artist: "",
    lyrics: "",
    genre: "Música Infantil",
    durationTarget: "media",
    visualStyle: "Estilo 2D Cartoon",
    currentStep: "LYRICS",
    scenes: [],
    characters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Step Components ──────────────────────────────────────────────────────────

function StepLyrics({ project, onChange, onNext }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void; onNext: () => void }) {
  const [loading, setLoading] = useState(false);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateLyrics = async () => {
    if (!project.title.trim()) {
      setError("Preencha o titulo da musica.");
      return;
    }
    setLoadingLyrics(true);
    setError("");
    try {
      const lyrics = await generateSongLyrics(project.title, project.genre, project.durationTarget);
      onChange({ lyrics });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingLyrics(false);
    }
  };

  const handleGenerate = async () => {
    if (!project.lyrics.trim() || !project.title.trim()) {
      setError("Preencha o titulo e a letra da musica.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const scenes = await generateMusicScenes(project.lyrics, project.title, project.visualStyle);
      onChange({ scenes, currentStep: "AUDIO" });
      onNext();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Titulo da Musica *</label>
          <input
            value={project.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="Ex: A Arca de Noe"
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Artista (opcional)</label>
          <input
            value={project.artist || ""}
            onChange={e => onChange({ artist: e.target.value })}
            placeholder="Ex: Turma da Magic"
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Estilo Musical</label>
          <div className="flex flex-col gap-2">
            {MUSIC_GENRES.map(g => (
              <button
                key={g}
                onClick={() => onChange({ genre: g })}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all ${project.genre === g ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                {g === "Música Infantil" ? "🎈 Música Infantil" : "📖 Música Infantil Bíblica"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Duracao</label>
          <div className="flex flex-col gap-2">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d.key}
                onClick={() => onChange({ durationTarget: d.key })}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all ${project.durationTarget === d.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Estilo Visual</label>
        <div className="flex gap-3">
          {VISUAL_STYLES.map(s => (
            <button
              key={s}
              onClick={() => onChange({ visualStyle: s })}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${project.visualStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {s === "Estilo 2D Cartoon" ? "🎨 2D Cartoon" : "✨ Pixar 3D"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-foreground">Letra da Musica *</label>
          <button
            onClick={handleGenerateLyrics}
            disabled={loadingLyrics}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 font-semibold"
          >
            {loadingLyrics ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Gerar Letra com IA
          </button>
        </div>
        <textarea
          value={project.lyrics}
          onChange={e => onChange({ lyrics: e.target.value })}
          placeholder="Cole a letra aqui ou clique em 'Gerar Letra com IA'..."
          className="w-full h-72 px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando Cenas...</> : <><Sparkles className="w-5 h-5" /> Gerar Cenas da Musica</>}
      </button>
    </div>
  );
}

function StepAudio({ project, onChange, onNext }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void; onNext: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    onChange({ audioStatus: "generating" });
    try {
      const audioUrl = await generateSongAudio(project.lyrics, project.title, project.genre, project.durationTarget);
      onChange({ audioUrl, audioStatus: "done" });
    } catch (e: any) {
      setError(e.message);
      onChange({ audioStatus: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    onChange({ audioUrl: url, audioStatus: "done" });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Letra</p>
        <pre className="whitespace-pre-wrap text-sm text-foreground max-h-64 overflow-y-auto font-sans">{project.lyrics}</pre>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4">
        {project.audioUrl ? (
          <audio controls src={project.audioUrl} className="w-full" />
        ) : (
          <div className="text-center text-muted-foreground py-6">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>A musica cantada sera exibida aqui</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando Musica...</> : <><Sparkles className="w-5 h-5" /> {project.audioUrl ? "Regerar Musica com IA" : "Gerar Musica com IA"}</>}
        </button>

        <label className="w-full text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2">
          Ou envie um arquivo de audio pronto
          <input type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </label>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <button onClick={onNext} disabled={!project.audioUrl} className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
        Continuar para Personagens <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function StepCharacters({ project, onChange, onNext }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void; onNext: () => void }) {
  const [loading, setLoading] = useState(false);
  const [genImgIndex, setGenImgIndex] = useState<number | null>(null);

  const handleGenRefImage = async (idx: number, currentChars = project.characters) => {
    const char = currentChars[idx];
    if (!char) return currentChars;
    setGenImgIndex(idx);
    try {
      const is3D = project.visualStyle === "Estilo Pixar 3D";
      const baseTemplate = is3D ? DEFAULT_IMAGE_TEMPLATE_3D : DEFAULT_IMAGE_TEMPLATE_2D;
      
      const charDetails = `${char.name}, ${char.description}`;
      
      let prompt = baseTemplate;
      if (is3D) {
        prompt = prompt.replace('[personagem]', charDetails)
                       .replace('[emoção desejada, ex: surpresa encantada, alegria radiante ou curiosidade profunda]', 'alegria radiante e simpatia')
                       .replace('[formato, ex: arredondadas, caídas ou pontudas]', 'normais e proporcionais')
                       .replace('[ex: floresta ensolarada, jardim encantado, vila mágica ou clareira brilhante]', 'cenário cinematográfico, mágico e detalhado que combina com o personagem');
      } else {
        prompt = prompt.replace('[CENA]', 'apresentando o personagem')
                       .replace('[PERSONAGEM]', charDetails);
      }
      const url = await generateImage(prompt, project.visualStyle);
      const updated = [...currentChars];
      updated[idx] = { ...char, referenceImageUrl: url };
      onChange({ characters: updated });
      return updated;
    } catch (e: any) { 
      console.error(e);
      return currentChars; 
    } finally { 
      setGenImgIndex(null); 
    }
  };

  const handleGenerateChars = async () => {
    setLoading(true);
    try {
      let chars = await generateMusicCharacters(project.lyrics, project.title, project.visualStyle);
      onChange({ characters: chars });
      
      // Auto-generate images sequentially
      for (let i = 0; i < chars.length; i++) {
        chars = await handleGenRefImage(i, chars);
      }
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };


  const updateChar = (idx: number, field: keyof MusicCharacter, val: string) => {
    const updated = [...project.characters];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange({ characters: updated });
  };

  const addChar = () => onChange({ characters: [...project.characters, { name: "", description: "" }] });
  const removeChar = (idx: number) => onChange({ characters: project.characters.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex gap-3">
        <button onClick={handleGenerateChars} disabled={loading} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Sparkles className="w-4 h-4" />Gerar Personagens com IA</>}
        </button>
        <button onClick={addChar} className="px-4 py-3 border-2 border-border rounded-xl text-foreground font-semibold flex items-center gap-2 hover:border-primary">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      <div className="space-y-4">
        {project.characters.map((char, idx) => (
          <div key={idx} className="bg-card border border-border rounded-2xl p-5 flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 h-64 flex-shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative group shadow-sm">
              {char.referenceImageUrl
                ? <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                : <Image className="w-8 h-8 text-muted-foreground opacity-30" />}
              
              {/* Always show generate button if no image, otherwise show on hover */}
              <button
                onClick={() => handleGenRefImage(idx)}
                disabled={genImgIndex === idx}
                className={`absolute inset-0 flex flex-col items-center justify-center transition-all ${
                  !char.referenceImageUrl && genImgIndex !== idx
                    ? "bg-black/40 hover:bg-black/60" 
                    : "bg-black/60 opacity-0 group-hover:opacity-100"
                }`}
              >
                {genImgIndex === idx ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : !char.referenceImageUrl ? (
                  <>
                    <Sparkles className="w-5 h-5 text-white mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase">Gerar</span>
                  </>
                ) : (
                  <RefreshCw className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            <div className="flex-1 space-y-3 flex flex-col">
              <div className="flex justify-between items-center gap-3">
                <input value={char.name} onChange={e => updateChar(idx, "name", e.target.value)} placeholder="Nome do personagem" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                <button onClick={() => removeChar(idx)} className="p-3 bg-muted rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="w-5 h-5" /></button>
              </div>
              <textarea value={char.description} onChange={e => updateChar(idx, "description", e.target.value)} placeholder="Editar descrição visual aqui..." className="w-full flex-1 min-h-[100px] px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-solid transition-all" />
            </div>
          </div>
        ))}
      </div>

      {project.characters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Clique em "Gerar Personagens com IA" ou adicione manualmente</p>
        </div>
      )}

      <button onClick={onNext} className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90">
        Continuar para Capa <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function StepCover({ project, onChange, onNext }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void; onNext: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const prompt = await generateMusicCoverPrompt(project.title, project.artist || "", project.lyrics || "", project.characters, project.visualStyle);
      const refs = project.characters.filter(c => c.referenceImageUrl).map(c => c.referenceImageUrl!);
      const statuses = refs.map(() => "protagonist");
      let url: string;
      if (refs.length > 0) {
        url = await generateImageWithReferences(prompt, refs, statuses, project.visualStyle);
      } else {
        url = await generateImage(prompt, project.visualStyle);
      }
      onChange({ coverUrl: url });
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="aspect-video bg-muted rounded-2xl overflow-hidden flex items-center justify-center relative">
        {loading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10"><Loader2 className="w-12 h-12 text-primary animate-spin mb-2" /><p className="text-white font-medium">Criando capa...</p></div>}
        {project.coverUrl
          ? <img src={project.coverUrl} alt="Capa" className="w-full h-full object-cover" />
          : <div className="text-center text-muted-foreground"><Image className="w-16 h-16 mx-auto mb-3 opacity-40" /><p>Capa sera exibida aqui</p></div>}
      </div>

      <div className="flex gap-3">
        <button onClick={handleGenerate} disabled={loading} className="flex-1 py-3 bg-card border-2 border-border text-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:border-primary disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          {project.coverUrl ? "Regenerar Capa" : "Gerar Capa"}
        </button>
        <button onClick={onNext} disabled={!project.coverUrl} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
          Continuar para Imagens <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function StepImages({ project, onChange, onNext }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void; onNext: () => void }) {
  const [generatingAll, setGeneratingAll] = useState(false);

  const updateScene = (idx: number, data: Partial<MusicScene>) => {
    const scenes = [...project.scenes];
    scenes[idx] = { ...scenes[idx], ...data };
    onChange({ scenes });
  };

  const genImage = async (idx: number) => {
    const scene = project.scenes[idx];
    if (!scene || scene.imageStatus === "generating") return;
    if (scene.isChorus && scene.chorusRefIndex !== undefined && scene.chorusRefIndex !== null) {
      const refScene = project.scenes[scene.chorusRefIndex];
      if (refScene?.imageUrl) { updateScene(idx, { imageUrl: refScene.imageUrl, imageStatus: "done" }); return; }
    }
    updateScene(idx, { imageStatus: "generating" });
    try {
      const refs = project.characters.filter(c => c.referenceImageUrl).map(c => c.referenceImageUrl!);
      const statuses = refs.map(() => "protagonist");
      let url: string;
      if (refs.length > 0) {
        url = await generateImageWithReferences(scene.visualDescription, refs, statuses, project.visualStyle);
      } else {
        url = await generateImage(scene.visualDescription, project.visualStyle);
      }
      updateScene(idx, { imageUrl: url, imageStatus: "done" });
    } catch { updateScene(idx, { imageStatus: "error" }); }
  };

  const genAll = async () => {
    setGeneratingAll(true);
    for (let i = 0; i < project.scenes.length; i++) {
      await genImage(i);
      if (i < project.scenes.length - 1) await new Promise(r => setTimeout(r, 7000));
    }
    setGeneratingAll(false);
  };

  const allDone = project.scenes.length > 0 && project.scenes.every(s => s.imageStatus === "done");

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={genAll} disabled={generatingAll} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
          {generatingAll ? <><Loader2 className="w-5 h-5 animate-spin" />Gerando imagens...</> : <><Sparkles className="w-5 h-5" />Gerar Todas as Imagens</>}
        </button>
        {allDone && (
          <button onClick={onNext} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700">
            Continuar para Videos <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {project.scenes.map((scene, idx) => (
          <div key={scene.id} className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-start">
            <div className="w-40 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
              {scene.imageStatus === "generating" && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
              {scene.imageUrl
                ? <img src={scene.imageUrl} alt={scene.part} className="w-full h-full object-cover" />
                : <Image className="w-8 h-8 text-muted-foreground opacity-50" />}
              {scene.isChorus && scene.chorusRefIndex !== null && scene.chorusRefIndex !== undefined && (
                <div className="absolute bottom-1 left-1 bg-blue-600/80 text-white text-[10px] px-1 py-0.5 rounded">Reutilizada</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-primary uppercase">{scene.part}</span>
                {scene.imageStatus === "done" && <span className="text-green-500 text-xs">✓</span>}
                {scene.imageStatus === "error" && <span className="text-destructive text-xs">✗ Erro</span>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{scene.lyrics}</p>
            </div>
            <button onClick={() => genImage(idx)} disabled={scene.imageStatus === "generating" || generatingAll} className="p-2 text-muted-foreground hover:text-primary flex-shrink-0">
              {scene.imageStatus === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepVideos({ project, onChange }: { project: MusicProject; onChange: (p: Partial<MusicProject>) => void }) {
  const [genPromptIdx, setGenPromptIdx] = useState<number | null>(null);
  const [genVideoIdx, setGenVideoIdx] = useState<number | null>(null);

  const updateScene = (idx: number, data: Partial<MusicScene>) => {
    const scenes = [...project.scenes];
    scenes[idx] = { ...scenes[idx], ...data };
    onChange({ scenes });
  };

  const handleGenPrompt = async (idx: number) => {
    const scene = project.scenes[idx];
    if (!scene?.imageUrl) { alert("Gere a imagem primeiro."); return; }
    setGenPromptIdx(idx);
    updateScene(idx, { promptStatus: "generating" });
    try {
      const prompt = await generateAnimationPrompt(scene.imageUrl, scene.lyrics, scene.part, project.visualStyle);
      updateScene(idx, { animationPrompt: prompt, promptStatus: "done" });
    } catch (e: any) { alert(e.message); updateScene(idx, { promptStatus: "error" }); }
    finally { setGenPromptIdx(null); }
  };

  const handleGenVideo = async (idx: number) => {
    const scene = project.scenes[idx];
    if (!scene?.animationPrompt || !scene?.imageUrl) { alert("Preencha o prompt de animacao."); return; }
    setGenVideoIdx(idx);
    updateScene(idx, { videoStatus: "generating" });
    try {
      const imageResponse = await fetch(scene.imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], "scene.jpg", { type: imageBlob.type });
      const url = await generateVideoVertex({
        prompt: scene.animationPrompt,
        imageFile,
        duration: scene.videoDuration,
        resolution: "720p",
        aspectRatio: scene.videoAspectRatio,
      });
      updateScene(idx, { videoUrl: url, videoStatus: "done" });
    } catch (e: any) { alert(e.message); updateScene(idx, { videoStatus: "error" }); }
    finally { setGenVideoIdx(null); }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  return (
    <div className="space-y-6">
      {project.scenes.map((scene, idx) => (
        <div key={scene.id} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-muted/30 px-5 py-3 border-b border-border flex items-center gap-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{scene.part}</span>
            <span className="text-xs text-muted-foreground line-clamp-1 flex-1">{scene.lyrics.slice(0, 80)}{scene.lyrics.length > 80 ? "..." : ""}</span>
          </div>

          <div className="p-5 grid grid-cols-3 gap-5 items-start">
            {/* Col 1: Image */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Imagem</p>
              <div className="aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {scene.imageUrl
                  ? <img src={scene.imageUrl} alt={scene.part} className="w-full h-full object-cover" />
                  : <Image className="w-8 h-8 text-muted-foreground opacity-40" />}
              </div>
            </div>

            {/* Col 2: Animation Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt de Animacao</p>
                <button
                  onClick={() => handleGenPrompt(idx)}
                  disabled={genPromptIdx === idx || !scene.imageUrl}
                  title="Gerar prompt com IA"
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50"
                >
                  {genPromptIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Gerar com IA
                </button>
              </div>
              <textarea
                value={scene.animationPrompt || ""}
                onChange={e => updateScene(idx, { animationPrompt: e.target.value })}
                placeholder="Descreva como a cena deve se animar... ou clique em Gerar com IA"
                rows={5}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                {(["4s", "8s"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => updateScene(idx, { videoDuration: d })}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold ${scene.videoDuration === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >{d}</button>
                ))}
              </div>
            </div>

            {/* Col 3: Video */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</p>
              <div className="aspect-video rounded-xl overflow-hidden bg-black/80 flex items-center justify-center">
                {scene.videoStatus === "generating"
                  ? <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /><p className="text-xs text-purple-300">Gerando...</p></div>
                  : scene.videoUrl
                    ? <video src={scene.videoUrl} controls loop className="w-full h-full object-contain" />
                    : <Play className="w-8 h-8 text-muted-foreground opacity-40" />}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenVideo(idx)}
                  disabled={genVideoIdx === idx || scene.videoStatus === "generating" || !scene.animationPrompt}
                  className="flex-1 py-2 text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 hover:opacity-90 disabled:opacity-50"
                >
                  {scene.videoStatus === "generating" ? <><Loader2 className="w-3 h-3 animate-spin" />Gerando</> : <><Video className="w-3 h-3" />Gerar Video</>}
                </button>
                {scene.videoUrl && (
                  <button onClick={() => handleDownload(scene.videoUrl!, `${scene.part}.mp4`)} className="px-3 py-2 border border-border rounded-xl text-muted-foreground hover:text-foreground">
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MusicClipPage() {
  const [project, setProject] = useState<MusicProject>(newProject);
  const [stepIdx, setStepIdx] = useState(0);

  const currentStep = STEPS[stepIdx];

  const handleChange = (partial: Partial<MusicProject>) => {
    setProject(prev => ({ ...prev, ...partial, updatedAt: Date.now() }));
  };

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < STEPS.length) setStepIdx(idx);
  };

  const goNext = () => goTo(stepIdx + 1);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Music className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerador de Clipe Musical</h1>
          <p className="text-muted-foreground text-sm">Transforme a letra de uma musica em um clipe animado com IA</p>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="bg-card border border-border rounded-2xl px-6 py-4 mb-8 flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const isActive = idx === stepIdx;
          const isDone = idx < stepIdx;
          return (
            <button
              key={step.key}
              onClick={() => isDone && goTo(idx)}
              disabled={idx > stepIdx}
              className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all ${isActive ? "bg-primary/10" : isDone ? "hover:bg-muted cursor-pointer" : "cursor-not-allowed opacity-40"}`}
            >
              <div className={`w-20 h-1 rounded-full mb-2 ${isActive || isDone ? "bg-primary" : "bg-muted"}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wide ${isActive || isDone ? "text-primary" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <motion.div key={currentStep.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {currentStep.key === "LYRICS" && <StepLyrics project={project} onChange={handleChange} onNext={goNext} />}
        {currentStep.key === "AUDIO" && <StepAudio project={project} onChange={handleChange} onNext={goNext} />}
        {currentStep.key === "CHARACTERS" && <StepCharacters project={project} onChange={handleChange} onNext={goNext} />}
        {currentStep.key === "COVER" && <StepCover project={project} onChange={handleChange} onNext={goNext} />}
        {currentStep.key === "IMAGES" && <StepImages project={project} onChange={handleChange} onNext={goNext} />}
        {currentStep.key === "VIDEOS" && <StepVideos project={project} onChange={handleChange} />}
      </motion.div>
    </div>
  );
}
