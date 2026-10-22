import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function bucket(): string {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not set");
  return name;
}

function baseClient(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
}

function presignClient(): S3Client {
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
  if (!publicEndpoint || publicEndpoint === process.env.S3_ENDPOINT) return baseClient();
  return new S3Client({
    endpoint: publicEndpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
}

export async function ensureBucket(): Promise<void> {
  // Bucket-scoped keys (R2, B2, IAM policies) may read a bucket but not create one: don't try if it's there.
  if (await storageHealthy()) return;
  try {
    await baseClient().send(new CreateBucketCommand({ Bucket: bucket() }));
  } catch (err) {
    if (!/BucketAlready/i.test(String(err))) throw err;
  }
}

export async function storageHealthy(): Promise<boolean> {
  try {
    await baseClient().send(new HeadBucketCommand({ Bucket: bucket() }));
    return true;
  } catch {
    return false;
  }
}

export async function presignPut(
  key: string,
  contentType: string,
): Promise<{ url: string; expiresIn: number }> {
  const expiresIn = 900;
  const url = await getSignedUrl(
    presignClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
  return { url, expiresIn };
}

export async function presignGet(key: string): Promise<{ url: string; expiresIn: number }> {
  const expiresIn = 3600;
  const url = await getSignedUrl(presignClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn,
  });
  return { url, expiresIn };
}
