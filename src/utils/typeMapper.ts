import { NormalizedType, TypeScriptType } from '../types/sui';

export const mapNormalizedTypeToTypeScript = (
  type: NormalizedType,
): TypeScriptType => {
  if (typeof type === 'string') {
    return mapPrimitiveType(type);
  }

  if ('Vector' in type) {
    return `${mapNormalizedTypeToTypeScript(type.Vector)}[]`;
  }

  if ('Struct' in type) {
    return mapStructType(type.Struct);
  }

  return 'Record<string, any>';
};

const mapPrimitiveType = (type: string): TypeScriptType => {
  switch (type) {
    case 'Bool':
      return 'boolean';
    case 'U8':
    case 'U16':
    case 'U32':
      return 'number';
    case 'U64':
    case 'U128':
      return 'string';
    case 'U256':
      return 'string';
    case 'Address':
      return 'string';
    default:
      return 'Record<string, any>';
  }
};

const mapStructType = (struct: {
  module: string;
  name: string;
  typeArguments: any[];
}): TypeScriptType => {
  const { module, name, typeArguments } = struct;

  if (module === 'object' && (name === 'ID' || name === 'UID')) {
    return 'string';
  }

  const genericParams = typeArguments.length
    ? `<${typeArguments.map(mapNormalizedTypeToTypeScript).join(', ')}>`
    : '';
  return `${module}_${name}${genericParams}`;
};
