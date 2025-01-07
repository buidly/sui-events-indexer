import { type SuiMoveNormalizedType } from '@mysten/sui/client';

export interface TypeReference {
  address: string;
  module: string;
  name: string;
  typeArguments: SuiMoveNormalizedType[];
}

// Constants for well-known Move modules and types
const MOVE_STDLIB_ADDRESS = '0x1';
const SUI_FRAMEWORK_ADDRESS = '0x2';

const KNOWN_TYPES = {
  OBJECT_MODULE: 'object',
  STRING_MODULE: 'string',
  ASCII_MODULE: 'ascii',
  OPTION_MODULE: 'option',
  TABLE_MODULE: 'table',
  VEC_MAP_MODULE: 'vec_map',
  VEC_SET_MODULE: 'vec_set',
} as const;

export const mapNormalizedTypeToTypeScript = (
  type: SuiMoveNormalizedType,
): string => {
  if (typeof type === 'string') {
    return mapPrimitiveType(type);
  }

  if ('Vector' in type) {
    return `${mapNormalizedTypeToTypeScript(type.Vector)}[]`;
  }

  if ('Struct' in type) {
    return mapStructType(type.Struct);
  }

  return 'Map<string, any>';
};

const mapPrimitiveType = (type: string): string => {
  switch (type) {
    case 'Bool':
      return 'boolean';
    case 'U8':
    case 'U16':
    case 'U32':
      return 'number';
    case 'U64':
    case 'U128':
    case 'U256':
      return 'string';
    case 'Address':
      return 'string';
    default:
      return 'Map<string, any>';
  }
};

const mapStructType = (struct: TypeReference): string => {
  const { address, module, name, typeArguments } = struct;

  // Handle standard library types (0x1)
  if (address === MOVE_STDLIB_ADDRESS) {
    switch (module) {
      case KNOWN_TYPES.STRING_MODULE:
      case KNOWN_TYPES.ASCII_MODULE:
        return 'string';
      case KNOWN_TYPES.OPTION_MODULE:
        if (typeArguments.length === 1) {
          return `${mapNormalizedTypeToTypeScript(typeArguments[0])} | null`;
        }
        return 'any | null';
    }
  }

  // Handle Sui framework types (0x2)
  if (address === SUI_FRAMEWORK_ADDRESS) {
    switch (module) {
      case KNOWN_TYPES.OBJECT_MODULE:
        if (name === 'ID' || name === 'UID') {
          return 'string';
        }
        break;
      case KNOWN_TYPES.TABLE_MODULE:
      case KNOWN_TYPES.VEC_MAP_MODULE:
        if (typeArguments.length === 2) {
          const [keyType, valueType] = typeArguments;
          return `Map<${mapNormalizedTypeToTypeScript(
            keyType,
          )}, ${mapNormalizedTypeToTypeScript(valueType)}>`;
        }
        return 'Map<string, any>';
      case KNOWN_TYPES.VEC_SET_MODULE:
        if (typeArguments.length === 1) {
          return `Set<${mapNormalizedTypeToTypeScript(typeArguments[0])}>`;
        }
        return 'Set<any>';
    }
  }

  return `${module}_${name}`;
};
