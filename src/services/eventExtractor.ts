import { extractAllStructs } from './dtoGenerator';
import { SuiClient } from './suiClient';

export const extractEventTypes = (
  bytecode: Map<string, string>,
): Set<string> => {
  const eventTypes = new Set<string>();

  for (const [moduleName, moduleBytecode] of Object.entries(bytecode)) {
    const lines = moduleBytecode.split('\n');
    const packageId = extractPackageId(moduleBytecode);

    // Find all `event::emit` calls
    for (const line of lines) {
      const emitMatch = line.match(/event::emit<([\w_]+)>/);
      if (emitMatch) {
        const eventType = emitMatch[1];
        eventTypes.add(`${packageId}::${moduleName}_${eventType}`);
      }
    }
  }

  return eventTypes;
};

export const extractExternalPackages = (
  bytecode: Map<string, string>,
): Map<string, string> => {
  const externalPackages = new Map<string, string>();

  for (const [_, moduleBytecode] of Object.entries(bytecode)) {
    const lines = moduleBytecode.split('\n');

    // Collect all `use` statements for external packages
    for (const line of lines) {
      const useMatch = line.match(/use\s+([0-9a-fx]+)::([\w_]+)/);
      if (useMatch) {
        const [_, packageId, moduleName] = useMatch;
        externalPackages.set(moduleName, packageId);
      }
    }
  }

  return externalPackages;
};

export const filterEventStructsAndDependencies = async (
  allStructs: Map<string, any>,
  eventTypes: Set<string>,
  suiClient: SuiClient,
): Promise<Map<string, any>> => {
  const result: Map<string, any> = new Map();
  const visited = new Set<string>();
  const externalStructsCache: Map<string, any> = new Map();

  const loadExternalPackage = async (packageId: string) => {
    if (!externalStructsCache.has(packageId)) {
      const packageData = await suiClient.getNormalizedMoveModulesByPackage(
        packageId,
      );
      externalStructsCache.set(packageId, extractAllStructs(packageData));
    }
    return externalStructsCache.get(packageId)!;
  };

  const getStructFromPackage = async (
    packageId: string,
    type: string,
    currentStructs: Map<string, any>,
  ) => {
    let struct = currentStructs.get(type);

    if (!struct) {
      const [module, _] = type.split('_');
      const bytecode = await suiClient.getPackageBytecode(packageId);
      const externalPackages = extractExternalPackages(bytecode);

      if (externalPackages.has(module)) {
        const externalPackageId = externalPackages.get(module)!;
        const externalStructs = await loadExternalPackage(externalPackageId);
        struct = externalStructs[type];
      }
    }

    return struct;
  };

  const processStructField = async (fieldType: any) => {
    if (fieldType.Struct || (fieldType.Vector && fieldType.Vector.Struct)) {
      const structData = fieldType.Struct || fieldType.Vector.Struct;
      const { address, module, name } = structData;
      const nestedType = `${address}::${module}_${name}`;
      const externalStructs = await loadExternalPackage(address);
      await collectDependencies(nestedType, externalStructs);
    }
  };

  const collectDependencies = async (
    rawType: string,
    currentStructs: Map<string, any>,
  ) => {
    if (visited.has(rawType)) return;
    visited.add(rawType);

    const [packageId, type] = rawType.split('::');
    const struct = await getStructFromPackage(packageId, type, currentStructs);

    if (struct) {
      result.set(type, struct);

      if (struct.fields) {
        await Promise.all(
          struct.fields.map((field: any) => processStructField(field.type)),
        );
      }
    }
  };

  await Promise.all(
    [...eventTypes].map((eventType) =>
      collectDependencies(eventType, allStructs),
    ),
  );
  return result;
};

const extractPackageId = (bytecode: string): string => {
  const match = bytecode.match(/module\s+([0-9a-f]+)\.(\w+)/);
  if (!match) return '';
  return match[1];
};
