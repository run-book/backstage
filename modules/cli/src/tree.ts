import { NameAnd } from "@laoban/utils";

export type Tree<T> = {
  value: T
  parent?: Tree<T>
  children: Tree<T>[]
}
export function treeToString<T> ( tree: Tree<T>, valueFn: ( t: T ) => string, indent = 0 ): string {
  const indentStr = ' '.repeat ( indent )
  const value = valueFn ( tree.value )
  const children = tree.children.map ( child => treeToString ( child, valueFn, indent + 2 ) )
  const childrenStr = children.length === 0 ? '' : '\n' + children.join ( '\n' )
  return `${indentStr}${value}${childrenStr}`
}

export function parentPaths<T> ( path: string ): string[] {
  const parts = path.split ( '/' )
  const result: string[] = []
  for ( let i = parts.length - 1; i >= 0; i-- )
    result.push ( parts.slice ( 0, i ).join ( '/' ) )
  return result
}

export function allChildrenUnder( tree: Tree<any> ): Tree<any>[] {
  const children = tree.children.map ( child => allChildrenUnder ( child ) )
  return [ tree, ...children.flat () ]
}

export function makeTreeFromPathFnAndArray<T> ( pathFn: ( t: T ) => string | undefined, items: T[] ): NameAnd<Tree<T>> {
  const validItems = items.filter ( item => pathFn ( item ) !== undefined )
  const trees: NameAnd<Tree<T>> = Object.fromEntries ( validItems.map ( item => [ pathFn ( item ), { value: item, children: [] } ] ) )
  for ( const item of validItems ) {
    const path = pathFn ( item );
    if ( path === undefined ) continue
    const treeNode: Tree<T> = trees[ path ]
    let parentPath = parentPaths ( path ).find ( parentPath => trees[ parentPath ] !== undefined )
    if ( parentPath === undefined ) continue
    const parent = trees[ parentPath ]
    treeNode.parent = parent
    parent.children.push ( treeNode )
  }
  return trees
}