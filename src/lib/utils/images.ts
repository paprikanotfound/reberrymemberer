import Compressor from "compressorjs";


export function preloadImage(src: string, srcset?: string, sizes?: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Fetch image
    const img = new Image();
    img.fetchPriority = "low"
    if (srcset) img.srcset = srcset;
    if (sizes) img.sizes = sizes;
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

export function getLowResPlaceholder(file: File|Blob): Promise<string> {
  return new Promise((res, rej) => { 
    const img = new Image();
    const reader = new FileReader();
  
    reader.onload = () => {
      img.onerror = rej;
      img.onload = () => {
        const maxSize = 20;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
  
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
  
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
  
        ctx.drawImage(img, 0, 0, width, height);
        const base64Image = canvas.toDataURL("image/png"); // or "image/jpeg"
        res(base64Image)
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  })
}

export async function resizeImage(file: File|Blob) {
  return new Promise<File|Blob>((res, rej) => {
    new Compressor(file, {
      quality: 1,
      maxHeight: 2000, // TODO: configure max size global const
      maxWidth: 2000,
      // The compression process is asynchronous,
      // which means you have to access the `result` in the `success` hook function.
      success(result) {
        res(result)
      },
      error(err) {
        console.log(err.message);
        rej(err)
      },
    });
  }) 
}

export async function loadImage(image: File|Blob) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const url = URL.createObjectURL(image);
    const elm = new Image();
    elm.onload = () => {
      // Cleanup
      URL.revokeObjectURL(url);
      res(elm);
    };
    elm.onerror = () => {
      URL.revokeObjectURL(url);
      rej("Image load failed");
    };
    elm.src = url;
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}