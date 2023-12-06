import { FileOps } from "@laoban/fileops";

export type FileAndKind = {
  kind: string;
  file: string;
};

// Define a default map for file type to desired case
//Note that if not in, will just uppercase the first letter
export type TypeMap = { [ key: string ]: string };
const DEFAULT_TYPE_MAP: TypeMap = {
  'api': 'API',
};
export const makeRelative = ( fileOps: FileOps, dir: string ) => ( file: string ) =>
  './' + fileOps.relative ( dir, file ).replace ( /\\/g, '/' );

export const listFilesRecursively = async ( fileOps: FileOps, dir: string, filterFn: ( filename: string ) => boolean ): Promise<string[]> => {
  const files = await fileOps.listFiles ( dir );
  let allFiles: string[] = [];

  for ( const file of files ) {
    const filepath = fileOps.join ( dir, file );
    if ( await fileOps.isDirectory ( filepath ) ) {
      if ( filepath.endsWith ( '.git' ) || filepath.endsWith ( 'node_modules' ) || filepath.endsWith ( 'target' ) ) continue;
      allFiles = allFiles.concat ( await listFilesRecursively ( fileOps, filepath, filterFn ) );
    } else if ( filterFn ( file ) ) {
      allFiles.push ( filepath );
    }
  }
  return allFiles;
};

const matchBackstage = /^.*backstage\.([^.]+)\.yaml$/;
const isBackstageYamlFile = ( file: string ): boolean => {
  const result = file.match ( matchBackstage ) !== null;
  return result;
}
const mapBackstageYamlFileToKind = ( file: string, typeMap: TypeMap ): FileAndKind | null => {
  const match = file.match ( matchBackstage );
  if ( match ) {
    const fileType = match[ 1 ];
    const kind = typeMap[ fileType ] || fileType.charAt ( 0 ).toUpperCase () + fileType.slice ( 1 );
    return { kind, file };
  }
  throw new Error ( `Invalid backstage file: ${file}` );
};
export const addKindToFileList = ( files: string[], typeMap: TypeMap = DEFAULT_TYPE_MAP ): FileAndKind[] => {
  return files.map ( file => mapBackstageYamlFileToKind ( file, typeMap ) ).filter ( item => item !== null ) as FileAndKind[];
};


export const searchDirectoryForBackstageFiles = async ( fileOps: FileOps, dir: string, typeMap: TypeMap = DEFAULT_TYPE_MAP ): Promise<FileAndKind[]> => {
  const files = await listFilesRecursively ( fileOps, dir, isBackstageYamlFile );
  return addKindToFileList ( files, typeMap );
};
