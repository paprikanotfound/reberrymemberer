import Compressor from "compressorjs";


/**
 * Resizes an image to fit within 2000x2000px while maintaining aspect ratio.
 * Uses compressorjs for high-quality browser-side image processing.
 *
 * @param file - The image File or Blob to resize
 * @returns Promise that resolves to the resized image as a File or Blob
 */
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

/**
 * Loads an image from a File or Blob and returns an HTMLImageElement.
 * Automatically cleans up the object URL after loading.
 *
 * @param image - The image File or Blob to load
 * @returns Promise that resolves to an HTMLImageElement with the loaded image
 */
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

/**
 * Analyzes an image to determine if it has a dark or light background.
 * Samples pixels from the image and calculates average brightness.
 *
 * @param image - HTMLImageElement to analyze
 * @param sampleSize - Number of pixels to sample (default: 100). Higher = more accurate but slower
 * @returns Promise that resolves to 'dark' or 'light'
 */
export function detectImageBrightness(image: HTMLImageElement, sampleSize: number = 100): 'dark' | 'light' {
  // Create a small canvas to analyze the image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    console.warn('Failed to get canvas context for brightness detection');
    return 'light'; // Default fallback
  }

  // Use a smaller canvas for performance
  const maxSize = 200;
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;

  // Draw the image scaled down
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Sample pixels evenly across the image
  const step = Math.floor((canvas.width * canvas.height) / sampleSize);
  let totalBrightness = 0;
  let sampledPixels = 0;

  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate perceived brightness using the relative luminance formula
      // https://www.w3.org/TR/WCAG20/#relativeluminancedef
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
      totalBrightness += brightness;
      sampledPixels++;
    }

    const averageBrightness = totalBrightness / sampledPixels;
    // Threshold of 128 (middle of 0-255 range)
    return averageBrightness < 128 ? 'dark' : 'light';
  } catch (e) {
    console.warn('Failed to analyze image brightness:', e);
    return 'light'; // Default fallback
  }
}