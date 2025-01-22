import { DTOInterface } from '../types/dto-interface';
import { capitalizeFirstLetter, snakeToCamelCase } from '../utils/naming';
import { mapNormalizedTypeToTypeScript } from '../utils/typeMapper';

export const extractAllStructs = (response: any): Map<string, any> => {
  try {
    const result = new Map<string, any>();

    for (const [moduleName, moduleData] of Object.entries(response.result)) {
      const module = moduleData as {
        structs?: Record<string, any>;
        enums?: Record<string, any>;
      };

      // Handle structs
      if (module.structs && Object.keys(module.structs).length > 0) {
        for (const [structName, structDef] of Object.entries(module.structs)) {
          const uniqueName = `${moduleName}-${structName}`;
          result.set(uniqueName, {
            type: 'struct',
            ...structDef,
          });
        }
      }

      // Handle enums
      if (module.enums && Object.keys(module.enums).length > 0) {
        for (const [enumName, enumDef] of Object.entries(module.enums)) {
          const uniqueName = `${moduleName}-${enumName}`;
          result.set(uniqueName, {
            type: 'enum',
            values: Object.keys(enumDef.variants),
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error extracting structs and enums:', error);
    return new Map();
  }
};

export const generateTypeScriptDTOs = (
  items: Map<string, any>,
): DTOInterface[] => {
  const interfaces: DTOInterface[] = [];

  for (const [itemName, itemDef] of items.entries()) {
    const [module, rawTypeName] = itemName.split('-');
    const modulePart = capitalizeFirstLetter(snakeToCamelCase(module));
    // If type doesn't already include the module name, prepend it
    const typeName = rawTypeName.startsWith(modulePart)
      ? rawTypeName
      : `${modulePart}${rawTypeName}`;

    if (itemDef.type === 'enum') {
      const values = itemDef.values.map((value: string) => `  ${value}`);
      const content = `export enum ${typeName} {\n${values.join(',\n')}\n}`;
      interfaces.push({
        name: typeName,
        content,
      });
    } else if (itemDef.type === 'struct') {
      if (itemDef.fields) {
        const fields = itemDef.fields.map((field: any) => {
          let tsType = mapNormalizedTypeToTypeScript(field.type);

          // Handle array types separately
          const isArray = tsType.endsWith('[]');
          const baseType = isArray ? tsType.slice(0, -2) : tsType;

          if (!['string', 'number', 'boolean', 'bigint'].includes(baseType)) {
            const transformedType = capitalizeFirstLetter(
              snakeToCamelCase(baseType.split('-').pop() || baseType),
            );
            tsType = isArray ? `${transformedType}[]` : transformedType;
          }

          return `  ${snakeToCamelCase(field.name)}: ${tsType};`;
        });

        const content = `export interface ${typeName} {\n${fields.join(
          '\n',
        )}\n}`;
        interfaces.push({
          name: typeName,
          content,
        });
      }
    }
  }

  // Add imports based on type usage in the interface
  interfaces.forEach((dto) => {
    const typeRegex = /\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g;
    const matches = Array.from(dto.content.matchAll(typeRegex));
    const deps = new Set(
      matches
        .map((m) => m[1])
        .filter(
          (dep) =>
            dep !== dto.name &&
            !['string', 'boolean', 'number', 'bigint'].includes(dep),
        ),
    );

    if (deps.size > 0) {
      const imports = Array.from(deps)
        .map((dep) => `import { ${dep} } from './${dep}';`)
        .join('\n');
      dto.content = imports + '\n\n' + dto.content;
    }
  });

  return interfaces;
};
