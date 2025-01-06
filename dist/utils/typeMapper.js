"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapNormalizedTypeToTypeScript = void 0;
const mapNormalizedTypeToTypeScript = (type) => {
    if (typeof type === 'string') {
        return mapPrimitiveType(type);
    }
    if ('Vector' in type) {
        return `${(0, exports.mapNormalizedTypeToTypeScript)(type.Vector)}[]`;
    }
    if ('Struct' in type) {
        return mapStructType(type.Struct);
    }
    return 'Record<string, any>';
};
exports.mapNormalizedTypeToTypeScript = mapNormalizedTypeToTypeScript;
const mapPrimitiveType = (type) => {
    switch (type) {
        case 'Bool':
            return 'boolean';
        case 'U8':
        case 'U16':
        case 'U32':
            return 'number';
        case 'U64':
        case 'U128':
            return 'bigint';
        case 'U256':
            return 'string';
        case 'Address':
            return 'string';
        default:
            return 'Record<string, any>';
    }
};
const mapStructType = (struct) => {
    const { module, name, typeArguments } = struct;
    if (module === 'object' && (name === 'ID' || name === 'UID')) {
        return 'string';
    }
    const genericParams = typeArguments.length
        ? `<${typeArguments.map(exports.mapNormalizedTypeToTypeScript).join(', ')}>`
        : '';
    return `${module}_${name}${genericParams}`;
};
