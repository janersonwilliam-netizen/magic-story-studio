import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltam variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helpers (similar to the ones in storyStorage.ts)
function isDataUrl(value: any): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const arr = dataUrl.split(',');
  const bstr = Buffer.from(arr[1], 'base64');
  return bstr;
}

function getDataUrlMimeType(dataUrl: string): string {
  return dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || '';
}

async function uploadDataUrl(userId: string, bucket: string, path: string, dataUrl: string): Promise<string> {
  if (!isDataUrl(dataUrl)) return dataUrl;

  const buffer = dataUrlToBuffer(dataUrl);
  const contentType = getDataUrlMimeType(dataUrl);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(`${userId}/${path}`, buffer, {
      upsert: true,
      contentType,
      cacheControl: '604800',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(`${userId}/${path}`);

  return data.publicUrl;
}

async function runMigration() {
  console.log('Iniciando migração de Base64 para Storage...');

  // 1. Encontrar histórias com base64
  // Como o supabase client JS não suporta LIKE diretamente no JSONB sem funções RPC, 
  // vamos trazer todas as histórias ou fazer uma function no banco.
  // Para simplicidade, trazemos todas e filtramos em memória, ou assumimos que o volume não é absurdo.
  // Em produção, seria melhor uma query SQL: SELECT id FROM stories WHERE data::text LIKE '%data:%'
  
  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, user_id, title, data, preview_image');

  if (error) {
    console.error('Erro ao buscar histórias:', error);
    return;
  }

  let count = 0;

  for (const story of stories) {
    let hasChanges = false;
    const userId = story.user_id;
    const storyId = story.id;
    let data = story.data;
    let previewImage = story.preview_image;

    console.log(`Verificando história: ${story.title} (${storyId})`);

    // Preview Image
    if (isDataUrl(previewImage)) {
      console.log(`  - Migrando preview_image`);
      previewImage = await uploadDataUrl(userId, 'thumbnails', `${storyId}/thumbnail.png`, previewImage);
      hasChanges = true;
    }

    // story.audioUrl
    if (isDataUrl(data?.story?.audioUrl)) {
      console.log(`  - Migrando narration.wav`);
      data.story.audioUrl = await uploadDataUrl(userId, 'story-audio', `${storyId}/narration.wav`, data.story.audioUrl);
      hasChanges = true;
    }

    // storyWithScenes.thumbnailUrl
    if (isDataUrl(data?.storyWithScenes?.thumbnailUrl)) {
      console.log(`  - Migrando thumbnailUrl`);
      data.storyWithScenes.thumbnailUrl = await uploadDataUrl(userId, 'thumbnails', `${storyId}/thumbnail.png`, data.storyWithScenes.thumbnailUrl);
      hasChanges = true;
    }

    // scenes[].imageUrl
    if (data?.storyWithScenes?.scenes) {
      for (let i = 0; i < data.storyWithScenes.scenes.length; i++) {
        const scene = data.storyWithScenes.scenes[i];
        if (isDataUrl(scene.imageUrl)) {
          console.log(`  - Migrando cena ${i + 1}`);
          scene.imageUrl = await uploadDataUrl(userId, 'thumbnails', `${storyId}/scene-${i + 1}.png`, scene.imageUrl);
          hasChanges = true;
        }
      }
    }

    // characterReferenceImages
    if (data?.storyWithScenes?.characterReferenceImages) {
      for (const [charName, imageUrl] of Object.entries(data.storyWithScenes.characterReferenceImages)) {
        if (isDataUrl(imageUrl)) {
          console.log(`  - Migrando character ${charName}`);
          const safeName = charName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          data.storyWithScenes.characterReferenceImages[charName] = await uploadDataUrl(userId, 'thumbnails', `${storyId}/character-${safeName}.png`, imageUrl as string);
          hasChanges = true;
        }
      }
    }

    // audioUrls
    if (data?.storyWithScenes?.audioUrls) {
      for (const [indexStr, audioUrl] of Object.entries(data.storyWithScenes.audioUrls)) {
        if (isDataUrl(audioUrl)) {
          console.log(`  - Migrando audio da cena ${parseInt(indexStr) + 1}`);
          data.storyWithScenes.audioUrls[indexStr] = await uploadDataUrl(userId, 'story-audio', `${storyId}/scene-${parseInt(indexStr) + 1}.wav`, audioUrl as string);
          hasChanges = true;
        }
      }
    }

    // timeline clips
    if (data?.timeline?.clips) {
      for (const clip of data.timeline.clips) {
        if (isDataUrl(clip.imageUrl)) {
          console.log(`  - Migrando clip image ${clip.id}`);
          clip.imageUrl = await uploadDataUrl(userId, 'thumbnails', `${storyId}/clip-${clip.id}.png`, clip.imageUrl);
          hasChanges = true;
        }
        if (isDataUrl(clip.audioUrl)) {
          console.log(`  - Migrando clip audio ${clip.id}`);
          clip.audioUrl = await uploadDataUrl(userId, 'story-audio', `${storyId}/clip-${clip.id}.wav`, clip.audioUrl);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      console.log(`Atualizando banco de dados para a história ${storyId}...`);
      const { error: updateError } = await supabase
        .from('stories')
        .update({ data, preview_image: previewImage })
        .eq('id', storyId);

      if (updateError) {
        console.error(`Erro ao atualizar história ${storyId}:`, updateError);
      } else {
        count++;
        console.log(`História ${storyId} atualizada com sucesso.`);
      }
    } else {
      console.log(`  - Sem alterações necessárias.`);
    }
  }

  console.log(`\nMigração concluída. ${count} histórias atualizadas.`);
}

runMigration().catch(console.error);
