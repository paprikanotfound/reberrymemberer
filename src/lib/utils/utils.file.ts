
// Get all the entries (files or sub-directories) in a directory 
// by calling readEntries until it returns empty array
async function readAllDirectoryEntries(directoryReader: FileSystemDirectoryReader) {
  let entries: FileSystemEntry[] = [];
  let readEntries = await readEntriesPromise(directoryReader);
  if (!readEntries) return entries;
  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await readEntriesPromise(directoryReader);
    if (!readEntries) break;
  }
  return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
// readEntries will return only some of the entries in a directory
// e.g. Chrome returns at most 100 entries at a time
async function readEntriesPromise(directoryReader: FileSystemDirectoryReader) {
  try {
    return await new Promise<FileSystemEntry[]>((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (err) {
    console.log(err);
  }
}

type FileWithPath = File & { relativePath: string };


async function getAllFileEntries(dataTransferItemList: DataTransferItemList) {
  let fileEntries: FileWithPath[] = [];
  // Use BFS to traverse entire directory/file structure
  let queue: FileSystemEntry[] = [];
  // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  for (let i = 0; i < dataTransferItemList.length; i++) {
    // Note webkitGetAsEntry a non-standard feature and may change
    // Usage is necessary for handling directories
    queue.push(dataTransferItemList[i].webkitGetAsEntry()!);
  }
  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry?.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      const fileWithPath = file as FileWithPath;
      fileWithPath.relativePath = entry.fullPath;
      
      fileEntries.push(fileWithPath);
    } else if (entry?.isDirectory) {
      queue.push(...await readAllDirectoryEntries((entry as FileSystemDirectoryEntry).createReader()));
    }
  }
  return fileEntries;
}

// Utility function to normalize FileList or FileSystemEntry[] into a common structure
type FileInput = File[] | FileList | DataTransferItemList;

async function normalizeFiles(input: FileInput): Promise<FileWithPath[]> {
  if (Array.isArray(input) || input instanceof FileList) {
    const files: File[] = Array.isArray(input) ? input : Array.from(input);
    return files.map(file => {
      const relativePath = file.webkitRelativePath;
      const fileWithPath = file as FileWithPath;
      fileWithPath.relativePath = relativePath.length === 0 ? `/${file.name}` : relativePath;
      return fileWithPath;
    });
  }
  return await getAllFileEntries(input);
}


function getImageDimensions(file: File|Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


export function fileToBase64(file: File|Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(base64: string): Blob {
  const [meta, content] = base64.split(',');
  const mime = meta.match(/:(.*?);/)?.[1];
  const binary = atob(content);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export { normalizeFiles, getAllFileEntries, getImageDimensions, type FileWithPath };