import { KNOWN_TYPES } from '../utils/typeMapper';
import { extractAllStructs } from './dtoGenerator';
import { SuiClient } from './suiClient';

export interface EventInfo {
  eventType: string;
  moduleName: string;
}

export const extractEventTypes = (
  bytecode: Map<string, string>,
  packageData: any,
): Set<EventInfo> => {
  const eventTypes = new Set<EventInfo>();

  for (const [moduleName, moduleBytecode] of Object.entries(bytecode)) {
    const lines = moduleBytecode.split('\n');
    const packageId = extractPackageId(moduleBytecode);

    // Find all `event::emit` calls
    for (const line of lines) {
      const emitMatch = line.match(/event::emit<([\w_]+)>/);
      if (emitMatch) {
        const eventType = emitMatch[1];
        // Check if this event type exists in the module's structs
        if (packageData.result[moduleName]?.structs?.[eventType]) {
          eventTypes.add({
            eventType: `${packageId}::${moduleName}-${eventType}`,
            moduleName,
          });
        }
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
  eventTypes: Set<EventInfo>,
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
      const [module, _] = type.split('-');
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

      if (
        module === KNOWN_TYPES.OBJECT_MODULE ||
        module === KNOWN_TYPES.STRING_MODULE ||
        module === KNOWN_TYPES.ASCII_MODULE
      ) {
        // don't create types for these
        return;
      }
      const nestedType = `${address}::${module}-${name}`;
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
      collectDependencies(eventType.eventType, allStructs),
    ),
  );
  return result;
};

const extractPackageId = (bytecode: string): string => {
  const match = bytecode.match(/module\s+([0-9a-f]+)\.(\w+)/);
  if (!match) return '';
  return match[1];
};
