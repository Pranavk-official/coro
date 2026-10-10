export async function register() {
  const { ensureBucket } = await import("@/lib/s3/client");
  await ensureBucket();
}
