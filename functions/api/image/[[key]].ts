interface Env {
  IMAGES_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const key = (params.key as string[]).join('/');
  const obj = await env.IMAGES_BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
