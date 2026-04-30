import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = env.GCP_CREDENTIALS_JSON || '';
  const token = raw.trim().replace(/\r/g, '').replace(/\n/g, '');
  return Response.json({
    rawLength: raw.length,
    tokenLength: token.length,
    starts: token.substring(0, 15),
    ends: token.substring(token.length - 10),
    projectId: env.GCP_PROJECT_ID,
  });
};
