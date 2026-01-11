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