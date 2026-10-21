import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;

let client: S3Client | null = null;

export function getR2Client() {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2 env vars");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return { client, bucket };
}

export async function uploadBackupToR2(key: string, body: string) {
  const { client, bucket } = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
    })
  );
  return { bucket, key };
}
