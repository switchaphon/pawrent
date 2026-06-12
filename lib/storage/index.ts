/**
 * lib/storage/index.ts
 *
 * MinIO-backed object storage module for pawrent.
 *
 * WHY path-style (forcePathStyle: true):
 *   MinIO does not support virtual-hosted-style URLs (bucket.host/key).
 *   Without this flag the SDK constructs URLs like
 *   http://pet-photos.minio:9000/key which DNS never resolves.
 *   Path-style produces http://minio:9000/pet-photos/key — correct for MinIO.
 *
 * WHY region "us-east-1":
 *   The AWS SDK requires a non-empty region string even for non-AWS endpoints.
 *   MinIO ignores it. Any non-empty string works; "us-east-1" is the SDK's
 *   conventional dummy value for self-hosted S3-compatible stores.
 *
 * WHY upsert is a no-op:
 *   S3 PutObject always overwrites an existing object at the same key.
 *   The { upsert: true } option exists only for call-site compatibility with
 *   the existing supabase.storage.upload(..., { upsert: true }) calls
 *   (auth avatar, feedback image, pet gallery). There is no S3 equivalent
 *   of "fail on existing key" mode in this module, so accepting the flag
 *   keeps callers unchanged during migration without changing behaviour.
 *
 * WHY bucket env mapping:
 *   Callers reference logical bucket names ("pet-photos") as literals.
 *   The actual bucket names in the object store are controlled by env vars
 *   (S3_BUCKET_PET_PHOTOS etc.) so that staging/production can diverge
 *   from the defaults without touching application code.
 *
 * PDPA: this module never logs keys that contain user ids.
 *   Keys of the pattern "avatars/<uuid>.jpg", "<uuid>-<ts>.<ext>",
 *   "gallery/<uuid>/..." all contain user/pet ids. We log only bucket
 *   and operation type at debug level — never the full key path.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Bucket type — callers use the literal; env controls the real bucket name.
// ---------------------------------------------------------------------------
export type Bucket =
  | "pet-photos"
  | "user-photos"
  | "report-media"
  | "feedback-images"
  // 5th bucket beyond the grilled Module-3 spec: app/api/voice/route.ts
  // stores SOS voice memos here (existed only in hosted Supabase). Lead
  // amendment 2026-06-12, parity-first; revisit before Phase 4 migration.
  | "voice-recordings";

// ---------------------------------------------------------------------------
// Upload options — mirrors Supabase storage options for call-site compat.
// ---------------------------------------------------------------------------
export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  /**
   * Accepted for Supabase call-site compatibility only.
   * S3 PutObject always overwrites — this flag is a no-op (see file header).
   */
  upsert?: boolean;
}

export interface PresignedUploadOptions {
  contentType?: string;
  /** Seconds until the presigned URL expires. Defaults to 3600 (1 hour). */
  expiresIn?: number;
}

// ---------------------------------------------------------------------------
// Env-validation helpers — lazy, throw on first use, not at import time.
// This mirrors lib/db/index.ts lazy init so test suites that don't set env
// vars can still import the module and skip integration blocks cleanly.
// ---------------------------------------------------------------------------
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[storage] Required environment variable ${name} is not set`);
  return val;
}

// ---------------------------------------------------------------------------
// Bucket name resolution — maps the logical Bucket literal to the env-
// controlled real bucket name.
// ---------------------------------------------------------------------------
function resolveBucketName(bucket: Bucket): string {
  switch (bucket) {
    case "pet-photos":
      return requireEnv("S3_BUCKET_PET_PHOTOS");
    case "user-photos":
      return requireEnv("S3_BUCKET_USER_PHOTOS");
    case "report-media":
      return requireEnv("S3_BUCKET_REPORT_MEDIA");
    case "feedback-images":
      return requireEnv("S3_BUCKET_FEEDBACK_IMAGES");
    case "voice-recordings":
      return requireEnv("S3_BUCKET_VOICE_RECORDINGS");
  }
}

// ---------------------------------------------------------------------------
// Lazy S3Client singleton — constructed on first use, not at import time.
// ---------------------------------------------------------------------------
let _client: S3Client | undefined;

function getClient(): S3Client {
  if (!_client) {
    const endpoint = requireEnv("S3_ENDPOINT");
    const accessKeyId = requireEnv("MINIO_ROOT_USER");
    const secretAccessKey = requireEnv("MINIO_ROOT_PASSWORD");

    _client = new S3Client({
      endpoint,
      // MinIO requires path-style URLs — see file header.
      forcePathStyle: true,
      // AWS SDK requires a non-empty region even for non-AWS endpoints.
      region: "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Key validation — reject dangerous path components before any network call.
// ---------------------------------------------------------------------------
function validateKey(key: string): void {
  if (!key) throw new Error("[storage] Key must not be empty");
  if (key.startsWith("/")) throw new Error("[storage] Key must not start with /");
  if (key.includes("..")) throw new Error("[storage] Key must not contain '..'");
  const segments = key.split("/");
  if (segments.some((s) => s === "")) {
    throw new Error("[storage] Key must not contain empty path segments (//)");
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Upload a file to the given bucket.
 *
 * Returns the FULL public URL: `${S3_PUBLIC_URL}/${bucketName}/${key}`.
 * This URL is stored directly in the database per PRD-002 decision #7,
 * matching the current Supabase URL-in-DB pattern.
 */
export async function upload(
  bucket: Bucket,
  key: string,
  body: PutObjectCommandInput["Body"],
  opts?: UploadOptions
): Promise<string> {
  validateKey(key);
  const bucketName = resolveBucketName(bucket);

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ...(opts?.contentType && { ContentType: opts.contentType }),
      ...(opts?.cacheControl && { CacheControl: opts.cacheControl }),
    })
  );

  return getPublicUrl(bucket, key);
}

/**
 * Derive the public URL for a stored object without a network call.
 * Uses the S3_PUBLIC_URL env var (browser-reachable base URL).
 */
export function getPublicUrl(bucket: Bucket, key: string): string {
  validateKey(key);
  const publicBase = requireEnv("S3_PUBLIC_URL");
  const bucketName = resolveBucketName(bucket);
  // Trim any trailing slash from the base to avoid double slashes.
  return `${publicBase.replace(/\/$/, "")}/${bucketName}/${key}`;
}

/**
 * Download an object and return its content as a Buffer.
 * Propagates SDK errors — does not fail-open.
 */
export async function download(bucket: Bucket, key: string): Promise<Buffer> {
  validateKey(key);
  const bucketName = resolveBucketName(bucket);

  const resp = await getClient().send(new GetObjectCommand({ Bucket: bucketName, Key: key }));

  if (!resp.Body) throw new Error("[storage] GetObject returned empty body");

  // resp.Body is a SdkStreamMixin in the Node runtime.
  // transformToByteArray() is the SDK-native drain — no manual chunk loop.
  // The cast to `any` is the pragmatic escape hatch: GetObjectCommandOutput.Body
  // is typed as a union of Node/browser stream types that share transformToByteArray
  // at runtime but the TS union does not expose a common method directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = (await (resp.Body as any).transformToByteArray()) as Uint8Array;
  return Buffer.from(bytes);
}

/**
 * Delete an object. Propagates SDK errors.
 */
export async function remove(bucket: Bucket, key: string): Promise<void> {
  validateKey(key);
  const bucketName = resolveBucketName(bucket);

  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
}

/**
 * Generate a presigned URL that allows a client to PUT an object directly
 * to MinIO without passing credentials through the application server.
 */
export async function createPresignedUploadUrl(
  bucket: Bucket,
  key: string,
  opts?: PresignedUploadOptions
): Promise<string> {
  validateKey(key);
  const bucketName = resolveBucketName(bucket);
  const expiresIn = opts?.expiresIn ?? 3600;

  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ...(opts?.contentType && { ContentType: opts.contentType }),
    }),
    { expiresIn }
  );
}

// The raw S3Client is intentionally NOT exported.
// Callers must use the above functions which enforce key validation,
// bucket name resolution, and consistent public URL construction.
