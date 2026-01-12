import { 
  DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, 
  PutObjectCommand, S3Client, 
  type GetObjectCommandInput, type PutObjectCommandInput 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Initializes an S3-compatible client for interacting with AWS S3 or Cloudflare R2.
 *
 * @see https://developers.cloudflare.com/r2/api/s3/presigned-urls/
 *
 * @param config - Configuration object for S3 client
 * @param config.endpoint - The S3-compatible endpoint URL (e.g., Cloudflare R2 endpoint)
 * @param config.accessKeyId - AWS access key ID or R2 access key ID
 * @param config.secretAccessKey - AWS secret access key or R2 secret access key
 * @param config.bucket - The bucket name to perform operations on
 * @returns An object with methods for S3 operations (get, ls, put, del, getSignedUrl)
 *
 * @example
 * ```typescript
 * const s3 = initS3({
 *   endpoint: 'https://account-id.r2.cloudflarestorage.com',
 *   accessKeyId: 'your-access-key',
 *   secretAccessKey: 'your-secret-key',
 *   bucket: 'my-bucket'
 * });
 *
 * // Upload a file
 * await s3.put('path/to/file.jpg', buffer, 'image/jpeg');
 *
 * // Generate presigned URL
 * const uploadUrl = await s3.getSignedUrl('path/to/file.jpg', 'put', 'image/jpeg', 3600);
 * ```
 */
export const initS3 = (
  {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
  }: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  }
) => {
  const s3 = new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    /**
     * Retrieves an object from S3/R2 and returns its content as a string.
     *
     * @param key - The object key (path) in the bucket
     * @returns A Promise that resolves to the object content as a string
     */
    get: async (key: string) => {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const data = await s3.send(command);
      return streamToString(data.Body!.transformToWebStream());
    },
    /**
     * Lists objects in the bucket with the specified prefix.
     *
     * @param prefix - The prefix to filter objects by (e.g., 'images/' to list all objects in the images folder)
     * @returns A Promise that resolves to the S3 ListObjectsV2 response
     */
    ls: async (prefix: string) => {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });
      return s3.send(command);
    },
    /**
     * Uploads an object to S3/R2.
     *
     * @param key - The object key (path) to store the content at
     * @param content - The content to upload (string or Buffer)
     * @param contentType - Optional MIME type of the content (e.g., 'image/jpeg', 'application/json')
     * @returns A Promise that resolves to the S3 PutObject response
     */
    put: async (key: string, content: string | Buffer, contentType?: string) => {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,  // Specify the file path in your R2 bucket
        Body: content,  // The content to upload (can be a string, buffer, etc.)
        ContentType: contentType,
      });
      return s3.send(command);
    },
    /**
     * Deletes an object from S3/R2.
     *
     * @param key - The object key (path) to delete
     * @returns A Promise that resolves to the S3 DeleteObject response
     */
    del: async (key: string) => {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      return s3.send(command);
    },
    /**
     * Generates a presigned URL for uploading or downloading an object.
     *
     * Presigned URLs allow clients to perform S3 operations without AWS credentials.
     * Common use case: Generate a PUT URL for direct client-side uploads.
     *
     * @param key - The object key (path) for the operation
     * @param action - The operation type: 'put' for upload, 'get' for download
     * @param contentType - MIME type of the content (e.g., 'image/jpeg'). Required for PUT operations to ensure correct Content-Type header.
     * @param expiresIn - URL expiration time in seconds (e.g., 3600 for 1 hour)
     * @param contentLength - Optional content length in bytes for PUT operations
     * @returns A Promise that resolves to the presigned URL string
     *
     * @example
     * ```typescript
     * // Generate a PUT URL for client-side upload (expires in 10 minutes)
     * const uploadUrl = await s3.getSignedUrl('uploads/photo.jpg', 'put', 'image/jpeg', 600);
     *
     * // Generate a GET URL for downloading (expires in 1 hour)
     * const downloadUrl = await s3.getSignedUrl('uploads/photo.jpg', 'get', '', 3600);
     * ```
     */
    getSignedUrl: async (
      key: string,
      action: "put"|"get",
      contentType: string,
      expiresIn: number,
      contentLength?: number,
    ) => {
      let cmd;
      if (action == "put") {
        const params: PutObjectCommandInput = {
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
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
}

/**
 * Converts a ReadableStream of Uint8Array chunks to a UTF-8 string.
 *
 * @param stream - The ReadableStream to convert
 * @returns A Promise that resolves to the complete string
 */
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