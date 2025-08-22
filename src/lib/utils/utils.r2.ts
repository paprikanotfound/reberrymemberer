import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, 
  PutObjectCommand, S3Client, 
  type GetObjectCommandInput, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


export const R2 = {
  client: (endpoint: string, accessKeyId: string, secretAccessKey: string) => {
    return new S3Client({
      region: "auto",
      endpoint: endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  },
  get: async (s3: S3Client, key: string, bucket: string) => {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const data = await s3.send(command);
    return streamToString(data.Body!.transformToWebStream());
  },
  ls: async (s3: S3Client, prefix: string, bucket: string) => {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });
    return s3.send(command);
  },
  put: async (s3: S3Client, key: string, bucket: string, content: string | Buffer, contentType?: string) => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,  // Specify the file path in your R2 bucket
      Body: content,  // The content to upload (can be a string, buffer, etc.)
      ContentType: contentType,
    });
    return s3.send(command);
  },
  del: async (s3: S3Client, key: string, bucket: string) => {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return s3.send(command);
  },
  getSignedUrl: async (
    s3: S3Client,
    bucket: string,
    key: string,
    action: "put"|"get",
    contentType: string,
    ContentLength: number,
    expiresIn: number, // in seconds
  ) => {
    let cmd;
    if (action == "put") {
      const params: PutObjectCommandInput = {
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: ContentLength,
      };
      cmd = new PutObjectCommand(params);
    } else {
      const params: GetObjectCommandInput = {
        Bucket: bucket,
        Key: key,
      };
      cmd = new GetObjectCommand(params);
    }
    return getSignedUrl(s3, cmd, { expiresIn });
  }
}

function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          resolve(result);
          return;
        }
        result += decoder.decode(value, { stream: true });
        read();
      }).catch(reject);
    }
    read();
  });
}
