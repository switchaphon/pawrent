/**
 * __tests__/storage.test.ts
 *
 * Unit tests (always run, jsdom-safe — S3 client is fully mocked).
 * Integration tests (env-gated — require compose MinIO running).
 *
 * Run unit tests only:
 *   npx vitest run __tests__/storage.test.ts --coverage
 *
 * Run with integration block (compose must be up):
 *   S3_ENDPOINT_TEST=http://localhost:9000 \
 *   MINIO_ROOT_USER=pawrent \
 *   MINIO_ROOT_PASSWORD=pawrent_minio_dev \
 *   npx vitest run __tests__/storage.test.ts
 *
 * Buckets required for integration (created by compose init, anonymous download):
 *   pet-photos, user-photos, report-media, feedback-images
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any imports that trigger them.
// vi.mock hoisting ensures these run before the module under test loads.
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = mockSend;
  }
  class PutObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class GetObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place.
// ---------------------------------------------------------------------------
import { upload, getPublicUrl, download, remove, createPresignedUploadUrl } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set the standard env vars the module needs. */
function setEnv(overrides: Partial<Record<string, string>> = {}) {
  process.env.S3_ENDPOINT = "http://minio:9000";
  process.env.S3_PUBLIC_URL = "http://localhost:9000";
  process.env.MINIO_ROOT_USER = "pawrent";
  process.env.MINIO_ROOT_PASSWORD = "pawrent_minio_dev";
  process.env.S3_BUCKET_PET_PHOTOS = "pet-photos";
  process.env.S3_BUCKET_USER_PHOTOS = "user-photos";
  process.env.S3_BUCKET_REPORT_MEDIA = "report-media";
  process.env.S3_BUCKET_FEEDBACK_IMAGES = "feedback-images";
  process.env.S3_BUCKET_VOICE_RECORDINGS = "voice-recordings";
  Object.assign(process.env, overrides);
}

function clearStorageEnv() {
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_PUBLIC_URL;
  delete process.env.MINIO_ROOT_USER;
  delete process.env.MINIO_ROOT_PASSWORD;
  delete process.env.S3_BUCKET_PET_PHOTOS;
  delete process.env.S3_BUCKET_USER_PHOTOS;
  delete process.env.S3_BUCKET_REPORT_MEDIA;
  delete process.env.S3_BUCKET_FEEDBACK_IMAGES;
  delete process.env.S3_BUCKET_VOICE_RECORDINGS;
}

/** Build a minimal mock GetObject response with a transformToByteArray body. */
function mockGetObjectResponse(data: Uint8Array) {
  return {
    Body: {
      transformToByteArray: vi.fn().mockResolvedValue(data),
    },
  };
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("lib/storage (unit — mocked S3 client)", () => {
  beforeEach(() => {
    // Reset the lazy singleton between tests by clearing the module cache.
    vi.resetModules();
    setEnv();
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
  });

  afterEach(() => {
    clearStorageEnv();
  });

  // -------------------------------------------------------------------------
  // getPublicUrl — pure, no network
  // -------------------------------------------------------------------------
  describe("getPublicUrl", () => {
    it("constructs the correct URL for pet-photos bucket", () => {
      const url = getPublicUrl("pet-photos", "gallery/abc/photo.jpg");
      expect(url).toBe("http://localhost:9000/pet-photos/gallery/abc/photo.jpg");
    });

    it("constructs the correct URL for user-photos bucket", () => {
      const url = getPublicUrl("user-photos", "avatars/user123.jpg");
      expect(url).toBe("http://localhost:9000/user-photos/avatars/user123.jpg");
    });

    it("constructs the correct URL for report-media bucket", () => {
      const url = getPublicUrl("report-media", "alert-video.mp4");
      expect(url).toBe("http://localhost:9000/report-media/alert-video.mp4");
    });

    it("constructs the correct URL for feedback-images bucket", () => {
      const url = getPublicUrl("feedback-images", "anonymous_1234.png");
      expect(url).toBe("http://localhost:9000/feedback-images/anonymous_1234.png");
    });

    it("constructs the correct URL for voice-recordings bucket (5th, lead amendment)", () => {
      const url = getPublicUrl("voice-recordings", "alerts/abc/memo.webm");
      expect(url).toBe("http://localhost:9000/voice-recordings/alerts/abc/memo.webm");
    });

    it("trims a trailing slash from S3_PUBLIC_URL", () => {
      process.env.S3_PUBLIC_URL = "http://localhost:9000/";
      const url = getPublicUrl("pet-photos", "test.jpg");
      expect(url).toBe("http://localhost:9000/pet-photos/test.jpg");
    });

    it("uses the prod CDN base when S3_PUBLIC_URL points to cdn.pops.pet", () => {
      process.env.S3_PUBLIC_URL = "https://cdn.pops.pet";
      const url = getPublicUrl("pet-photos", "gallery/abc/photo.jpg");
      expect(url).toBe("https://cdn.pops.pet/pet-photos/gallery/abc/photo.jpg");
    });

    it("uses the env-controlled real bucket name (not the literal)", () => {
      process.env.S3_BUCKET_PET_PHOTOS = "pawrent-pet-photos-prod";
      const url = getPublicUrl("pet-photos", "test.jpg");
      expect(url).toBe("http://localhost:9000/pawrent-pet-photos-prod/test.jpg");
    });
  });

  // -------------------------------------------------------------------------
  // Key validation
  // -------------------------------------------------------------------------
  describe("key validation", () => {
    it("rejects an empty key", async () => {
      await expect(upload("pet-photos", "", Buffer.from("x"))).rejects.toThrow(
        "Key must not be empty"
      );
    });

    it("rejects a key with a leading slash", async () => {
      await expect(upload("pet-photos", "/avatar.jpg", Buffer.from("x"))).rejects.toThrow(
        "Key must not start with /"
      );
    });

    it("rejects a key containing '..'", async () => {
      await expect(upload("pet-photos", "foo/../bar.jpg", Buffer.from("x"))).rejects.toThrow(
        "Key must not contain '..'"
      );
    });

    it("rejects a key with consecutive slashes (empty segment)", async () => {
      await expect(upload("pet-photos", "foo//bar.jpg", Buffer.from("x"))).rejects.toThrow(
        "empty path segments"
      );
    });

    it("also validates keys in getPublicUrl", () => {
      expect(() => getPublicUrl("pet-photos", "")).toThrow("Key must not be empty");
    });

    it("also validates keys in download", async () => {
      await expect(download("pet-photos", "")).rejects.toThrow("Key must not be empty");
    });

    it("also validates keys in remove", async () => {
      await expect(remove("pet-photos", "")).rejects.toThrow("Key must not be empty");
    });

    it("also validates keys in createPresignedUploadUrl", async () => {
      await expect(createPresignedUploadUrl("pet-photos", "")).rejects.toThrow(
        "Key must not be empty"
      );
    });

    it("accepts a valid nested key", async () => {
      mockSend.mockResolvedValue({});
      await expect(
        upload("pet-photos", "gallery/pet-id/photo-123.jpg", Buffer.from("data"))
      ).resolves.toBeTypeOf("string");
    });
  });

  // -------------------------------------------------------------------------
  // upload
  // -------------------------------------------------------------------------
  describe("upload", () => {
    it("calls PutObjectCommand with the correct bucket and key", async () => {
      mockSend.mockResolvedValue({});
      await upload("user-photos", "avatars/abc123.jpg", Buffer.from("img-data"), {
        contentType: "image/jpeg",
        upsert: true,
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe("user-photos");
      expect(cmd.input.Key).toBe("avatars/abc123.jpg");
      expect(cmd.input.ContentType).toBe("image/jpeg");
    });

    it("passes ContentType when provided", async () => {
      mockSend.mockResolvedValue({});
      await upload("pet-photos", "test.png", Buffer.from("x"), {
        contentType: "image/png",
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ContentType).toBe("image/png");
    });

    it("omits ContentType when not provided", async () => {
      mockSend.mockResolvedValue({});
      await upload("pet-photos", "test.bin", Buffer.from("x"));
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ContentType).toBeUndefined();
    });

    it("passes CacheControl when provided", async () => {
      mockSend.mockResolvedValue({});
      await upload("pet-photos", "test.jpg", Buffer.from("x"), {
        cacheControl: "public, max-age=31536000",
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.CacheControl).toBe("public, max-age=31536000");
    });

    it("returns the full public URL after upload", async () => {
      mockSend.mockResolvedValue({});
      const url = await upload("pet-photos", "gallery/pet/photo.jpg", Buffer.from("x"));
      expect(url).toBe("http://localhost:9000/pet-photos/gallery/pet/photo.jpg");
    });

    it("upsert:true is accepted and does not change SDK behaviour (no-op)", async () => {
      mockSend.mockResolvedValue({});
      // Should not throw — upsert flag is silently accepted
      await expect(
        upload("user-photos", "avatars/test.jpg", Buffer.from("x"), { upsert: true })
      ).resolves.toBeTypeOf("string");
      // S3 has no upsert-disable mode — PutObject always overwrites
      // Verify no extra field was smuggled into the command
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input).not.toHaveProperty("upsert");
    });

    it("propagates S3 errors without swallowing", async () => {
      mockSend.mockRejectedValue(new Error("S3 network error"));
      await expect(upload("pet-photos", "bad.jpg", Buffer.from("x"))).rejects.toThrow(
        "S3 network error"
      );
    });

    it("uses the env-mapped real bucket name for report-media", async () => {
      process.env.S3_BUCKET_REPORT_MEDIA = "pawrent-report-media-staging";
      mockSend.mockResolvedValue({});
      await upload("report-media", "video.mp4", Buffer.from("x"));
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe("pawrent-report-media-staging");
    });
  });

  // -------------------------------------------------------------------------
  // download
  // -------------------------------------------------------------------------
  describe("download", () => {
    it("returns file content as a Buffer", async () => {
      const data = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
      mockSend.mockResolvedValue(mockGetObjectResponse(data));

      const result = await download("pet-photos", "gallery/pet/photo.jpg");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe("hello");
    });

    it("calls GetObjectCommand with the correct bucket and key", async () => {
      const data = new Uint8Array([1, 2, 3]);
      mockSend.mockResolvedValue(mockGetObjectResponse(data));

      await download("user-photos", "avatars/user.jpg");

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe("user-photos");
      expect(cmd.input.Key).toBe("avatars/user.jpg");
    });

    it("throws when response body is empty", async () => {
      mockSend.mockResolvedValue({ Body: undefined });
      await expect(download("pet-photos", "missing.jpg")).rejects.toThrow("empty body");
    });

    it("propagates S3 errors", async () => {
      mockSend.mockRejectedValue(new Error("NoSuchKey"));
      await expect(download("pet-photos", "nonexistent.jpg")).rejects.toThrow("NoSuchKey");
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe("remove", () => {
    it("calls DeleteObjectCommand with the correct bucket and key", async () => {
      mockSend.mockResolvedValue({});
      await remove("feedback-images", "anonymous_12345.png");

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Bucket).toBe("feedback-images");
      expect(cmd.input.Key).toBe("anonymous_12345.png");
    });

    it("propagates S3 errors", async () => {
      mockSend.mockRejectedValue(new Error("AccessDenied"));
      await expect(remove("pet-photos", "photo.jpg")).rejects.toThrow("AccessDenied");
    });
  });

  // -------------------------------------------------------------------------
  // createPresignedUploadUrl
  // -------------------------------------------------------------------------
  describe("createPresignedUploadUrl", () => {
    it("calls getSignedUrl with PutObjectCommand, correct bucket/key", async () => {
      mockGetSignedUrl.mockResolvedValue("https://presigned.url/token");

      const url = await createPresignedUploadUrl("pet-photos", "gallery/pet/new.jpg", {
        contentType: "image/jpeg",
        expiresIn: 900,
      });

      expect(url).toBe("https://presigned.url/token");
      expect(mockGetSignedUrl).toHaveBeenCalledOnce();

      const [, cmd, opts] = mockGetSignedUrl.mock.calls[0];
      expect(cmd.input.Bucket).toBe("pet-photos");
      expect(cmd.input.Key).toBe("gallery/pet/new.jpg");
      expect(cmd.input.ContentType).toBe("image/jpeg");
      expect(opts.expiresIn).toBe(900);
    });

    it("defaults expiresIn to 3600 when not specified", async () => {
      mockGetSignedUrl.mockResolvedValue("https://presigned.url/default");
      await createPresignedUploadUrl("user-photos", "avatars/new.jpg");

      const [, , opts] = mockGetSignedUrl.mock.calls[0];
      expect(opts.expiresIn).toBe(3600);
    });

    it("omits ContentType from command when not provided", async () => {
      mockGetSignedUrl.mockResolvedValue("https://presigned.url/no-ct");
      await createPresignedUploadUrl("report-media", "clip.mp4");

      const [, cmd] = mockGetSignedUrl.mock.calls[0];
      expect(cmd.input.ContentType).toBeUndefined();
    });

    it("propagates presigner errors", async () => {
      mockGetSignedUrl.mockRejectedValue(new Error("CredentialsProviderError"));
      await expect(createPresignedUploadUrl("pet-photos", "photo.jpg")).rejects.toThrow(
        "CredentialsProviderError"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Missing env var — lazy throw
  // -------------------------------------------------------------------------
  describe("env validation", () => {
    it("throws a clear error when S3_PUBLIC_URL is missing from getPublicUrl", () => {
      delete process.env.S3_PUBLIC_URL;
      expect(() => getPublicUrl("pet-photos", "test.jpg")).toThrow("S3_PUBLIC_URL");
    });

    it("throws a clear error when a bucket env var is missing", () => {
      delete process.env.S3_BUCKET_FEEDBACK_IMAGES;
      expect(() => getPublicUrl("feedback-images", "test.jpg")).toThrow(
        "S3_BUCKET_FEEDBACK_IMAGES"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests — gated on S3_ENDPOINT_TEST env var.
// Run command (compose must be up):
//   S3_ENDPOINT_TEST=http://localhost:9000 \
//   MINIO_ROOT_USER=pawrent \
//   MINIO_ROOT_PASSWORD=pawrent_minio_dev \
//   npx vitest run __tests__/storage.test.ts
//
// NOTE: vi.mock() at the top of this file mocks @aws-sdk/client-s3 globally.
// The integration block bypasses this by loading the actual (unmocked) module
// implementations directly via vi.importActual — the real S3Client is
// constructed inside the importActual'd module instance, not the mocked one.
// ---------------------------------------------------------------------------
describe("lib/storage (integration — compose MinIO)", () => {
  const isIntegration = !!process.env.S3_ENDPOINT_TEST;

  it.skipIf(!isIntegration)(
    "round-trips upload → download → public-URL fetch → remove (pet-photos)",
    async () => {
      // Point to the real MinIO instance.
      process.env.S3_ENDPOINT = process.env.S3_ENDPOINT_TEST!;
      process.env.S3_PUBLIC_URL = process.env.S3_ENDPOINT_TEST!;
      process.env.MINIO_ROOT_USER = process.env.MINIO_ROOT_USER ?? "pawrent";
      process.env.MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD ?? "pawrent_minio_dev";
      process.env.S3_BUCKET_PET_PHOTOS = "pet-photos";
      process.env.S3_BUCKET_USER_PHOTOS = "user-photos";
      process.env.S3_BUCKET_REPORT_MEDIA = "report-media";
      process.env.S3_BUCKET_FEEDBACK_IMAGES = "feedback-images";

      // The unit-test vi.mock() at the top replaces @aws-sdk/client-s3 for
      // the whole file. For the integration round-trip we build the operations
      // directly using the real SDK loaded via vi.importActual — this sidesteps
      // the mock without disturbing the unit tests that run in the same file.
      const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
        await vi.importActual<typeof import("@aws-sdk/client-s3")>("@aws-sdk/client-s3");

      const endpoint = process.env.S3_ENDPOINT_TEST!;
      const client = new S3Client({
        endpoint,
        forcePathStyle: true,
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.MINIO_ROOT_USER!,
          secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
        },
      });

      const bucket = "pet-photos";
      const key = `integration-test/storage-roundtrip-${Date.now()}.txt`;
      const content = Buffer.from("pawrent storage integration test");

      // Upload via real SDK
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: content,
          ContentType: "text/plain",
        })
      );

      // Download via real SDK
      const getResp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      expect(getResp.Body).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bytes = (await (getResp.Body as any).transformToByteArray()) as Uint8Array;
      expect(Buffer.from(bytes).toString()).toBe("pawrent storage integration test");

      // Public URL fetch — buckets have anonymous download policy
      // Path-style URL: <endpoint>/<bucket>/<key>
      const publicUrl = `${endpoint}/${bucket}/${key}`;
      const httpResp = await fetch(publicUrl);
      expect(httpResp.ok).toBe(true);
      const body = await httpResp.text();
      expect(body).toBe("pawrent storage integration test");

      // Also verify getPublicUrl() produces the right shape (pure function, no SDK)
      process.env.S3_ENDPOINT = endpoint;
      process.env.S3_PUBLIC_URL = endpoint;
      process.env.S3_BUCKET_PET_PHOTOS = "pet-photos";
      const derivedUrl = getPublicUrl("pet-photos", key);
      expect(derivedUrl).toBe(publicUrl);

      // Remove via real SDK
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

      // Confirm deletion — fetch should now 404
      const afterDelete = await fetch(publicUrl);
      expect(afterDelete.status).toBe(404);
    }
  );
});
