import { DTOInterface } from '../types/dto-interface';
import { mapNormalizedTypeToTypeScript } from '../utils/typeMapper';

export const extractAllStructs = (response: any): Record<string, any> => {
  try {
    const result: Record<string, any> = {};

    for (const [moduleName, moduleData] of Object.entries(response)) {
      const module = moduleData as {
        structs?: Record<string, any>;
        enums?: Record<string, any>;
      };

      // Handle structs
      if (module.structs && Object.keys(module.structs).length > 0) {
        for (const [structName, structDef] of Object.entries(module.structs)) {
          const uniqueName = `${moduleName}_${structName}`;
          result[uniqueName] = {
            type: 'struct',
            ...structDef,
          };
        }
      }

      // Handle enums
      if (module.enums && Object.keys(module.enums).length > 0) {
        for (const [enumName, enumDef] of Object.entries(module.enums)) {
          const uniqueName = `${moduleName}_${enumName}`;
          result[uniqueName] = {
            type: 'enum',
            values: Object.keys(enumDef.variants),
          };
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error extracting structs and enums:', error);
    return {};
  }
};

export const generateTypeScriptDTOs = (
  items: Record<string, any>,
): DTOInterface[] => {
  const interfaces: DTOInterface[] = [];

  for (const [itemName, itemDef] of Object.entries(items)) {
    if (itemDef.type === 'enum') {
      const values = itemDef.values.map((value: string) => `  ${value}`);
      const content = `export enum ${itemName} {\n${values.join(',\n')}\n}`;
      interfaces.push({
        name: itemName,
        content,
      });
    } else if (itemDef.type === 'struct') {
      if (itemDef.fields) {
        const fields = itemDef.fields.map((field: any) => {
          const tsType = mapNormalizedTypeToTypeScript(field.type);
          return `  ${field.name}: ${tsType};`;
        });

        const content = `export interface ${itemName} {\n${fields.join(
          '\n',
        )}\n}`;
        interfaces.push({
          name: itemName,
          content,
        });
      }
    }
  }

  // Add imports based on type usage in the interface
  interfaces.forEach((dto) => {
    const typeRegex = /\b([a-z]\w*_[A-Z]\w+)\b/g;
    const matches = Array.from(dto.content.matchAll(typeRegex));
    const deps = new Set(
      matches.map((m) => m[1]).filter((dep) => dep !== dto.name), // Don't import self
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
