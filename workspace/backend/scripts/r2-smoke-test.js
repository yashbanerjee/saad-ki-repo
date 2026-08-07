/**
 * Live R2 smoke test (loads backend/.env).
 * Usage from workspace/backend:
 *   node ./scripts/r2-smoke-test.js
 */
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function normalizeEndpoint(raw) {
  let endpoint = (raw || '').trim().replace(/\/+$/, '');
  try {
    const u = new URL(endpoint);
    if (u.hostname.endsWith('.r2.cloudflarestorage.com') && u.pathname && u.pathname !== '/') {
      u.pathname = '';
      endpoint = u.toString().replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }
  return endpoint;
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));

  const accessKeyId = (process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
  const endpoint = normalizeEndpoint(process.env.S3_ENDPOINT || '');
  const bucket = (process.env.S3_BUCKET || '').trim();
  const publicUrl = (process.env.S3_PUBLIC_URL || '').trim().replace(/\/+$/, '');

  const missing = [];
  if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');
  if (!endpoint) missing.push('S3_ENDPOINT');
  if (!bucket) missing.push('S3_BUCKET');
  if (missing.length) {
    console.error('Missing env:', missing.join(', '));
    process.exit(1);
  }

  const client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const key = `taskflow-tests/r2-smoke-${Date.now()}.txt`;
  const body = Buffer.from(`ok ${new Date().toISOString()}`);

  console.log('R2 smoke test');
  console.log('  endpoint:', endpoint);
  console.log('  bucket:  ', bucket);
  console.log('  key:     ', key);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain',
    }),
  );
  console.log('  PUT: ok');

  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const buf = await streamToBuffer(got.Body);
  if (!buf.equals(body)) {
    throw new Error('GET body mismatch');
  }
  console.log('  GET: ok');

  const signed = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 120 },
  );
  console.log('  SIGNED: ok', signed.slice(0, 60) + '…');

  if (publicUrl) {
    console.log('  PUBLIC: ', `${publicUrl}/${key}`);
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('  DELETE: ok');
  console.log('All R2 checks passed.');
}

main().catch((err) => {
  console.error('R2 smoke test FAILED');
  console.error(err);
  process.exit(1);
});
