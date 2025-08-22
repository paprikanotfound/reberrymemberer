

export function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

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

async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
  }
  return await response.blob();
}