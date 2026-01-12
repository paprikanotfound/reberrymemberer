
/**
 * Fetches a resource from a URL and returns it as a Blob.
 *
 * @param url - The URL to fetch the resource from
 * @param signal - Optional AbortSignal to cancel the fetch request
 * @returns A Promise that resolves to the fetched Blob
 * @throws Error if the fetch request fails
 */
async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
  }
  return await response.blob();
}

/**
 * Uploads content to a presigned URL using XMLHttpRequest with support for progress tracking and cancellation.
 *
 * @param signedUrl - The presigned URL to upload to (e.g., S3/R2 presigned PUT URL)
 * @param content - The content to upload. Can be a File, Blob, or URL string. If a string is provided, it will be fetched as a Blob first.
 * @param onProgress - Optional callback that receives upload progress as a percentage (0-100)
 * @param signal - Optional AbortSignal to cancel the upload request
 * @returns A Promise that resolves to true when upload succeeds, or rejects on error
 * @throws Error if the upload fails or is aborted
 *
 * @example
 * ```typescript
 * // Upload a blob with progress tracking
 * await uploadContent(
 *   presignedUrl,
 *   imageBlob,
 *   (progress) => console.log(`Upload progress: ${progress}%`)
 * );
 *
 * // Upload from URL with abort capability
 * const controller = new AbortController();
 * uploadContent(presignedUrl, 'https://example.com/image.jpg', undefined, controller.signal);
 * // Later: controller.abort();
 * ```
 */
export async function uploadContent(
  signedUrl: string,
  content: File|Blob|string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
) {
  
  const blob = typeof content === "string"
    ? await fetchAsBlob(content, signal)
    : content;

  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        let progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress)
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        res(true)
      } else {
        rej()
      }
    };
    xhr.onerror = () => {
      rej(new Error(`Upload failed`));
    };

    signal?.addEventListener('abort', () => xhr.abort());
    
    xhr.send(blob);
  })
}