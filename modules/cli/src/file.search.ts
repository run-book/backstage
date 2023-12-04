import { FileOps } from "@laoban/fileops";

export type FileAndKind = {
  kind: string;
  file: string;
};

// Define a default map for file type to desired case
//Note that if not in, will just uppercase the first letter
export type TypeMap = { [key: string]: string };
const DEFAULT_TYPE_MAP: TypeMap = {
  'api': 'API',
};


export const searchDirectory = async (fileOps: FileOps, dir: string, typeMap: TypeMap = DEFAULT_TYPE_MAP): Promise<FileAndKind[]> => {
  const files = await fileOps.listFiles(dir);

  // Regular expression to match the filename pattern (e.g., 'backstage.anything.yaml')
  const filenameRegex = /^backstage\.(.+)\.yaml$/;

  return (await Promise.all(files.map(async file => {
    const filepath = fileOps.join(dir, file);
    if (await fileOps.isDirectory(filepath)) {
      // Recursively process subdirectories
      return searchDirectory(fileOps, filepath, typeMap);
    } else {
      const match = file.match(filenameRegex);
      if (match && match[1]) {
        const fileType = match[1];
        // If the type is in the map, use it; otherwise, capitalize the first letter
        const kind = typeMap[fileType] || fileType.charAt(0).toUpperCase() + fileType.slice(1);
        return [{ kind, file }];
      } else {
        return [];
      }
    }
  }))).flat();
};
