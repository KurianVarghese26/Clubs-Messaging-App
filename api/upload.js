import supabase from './db-client.js';

const BUCKET = 'club-media';
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB (video needs headroom)
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const SAFE = /[^a-zA-Z0-9._-]/g;

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/ogg',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { fileName, fileBase64, contentType, folder } = req.body || {};
    if (!fileName || !fileBase64) return res.status(400).json({ error: 'Missing file.' });
    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length === 0) return res.status(400).json({ error: 'Empty file.' });
    const type = String(contentType || 'application/octet-stream');
    const isVideo = type.startsWith('video/') || VIDEO_TYPES.has(type);
    const limit = isVideo ? MAX_BYTES : MAX_IMAGE_BYTES;
    if (buffer.length > limit)
      return res.status(413).json({ error: isVideo ? 'Video is too large (max 60 MB).' : 'File is too large (max 15 MB).' });
    const clean = String(fileName).replace(SAFE, '_').slice(0, 120);
    const dir = String(folder || 'attachments').replace(SAFE, '_').slice(0, 40) || 'attachments';
    const path = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${clean}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: type,
      upsert: true,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ url: urlData.publicUrl, path });
  } catch (err) {
    console.error('upload API error:', err);
    res.status(500).json({ error: err.message });
  }
}
