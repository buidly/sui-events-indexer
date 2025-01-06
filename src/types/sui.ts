// Type definitions for Sui-specific types
export type SuiStruct = {
  module: string;
  name: string;
  typeArguments: any[];
};

export type NormalizedType = string | { Vector: any } | { Struct: SuiStruct };

export type TypeScriptType = string;

export interface DTOInterface {
  name: string;
  content: string;
}
