import axios from 'axios';

export class SuiClient {
  private packageCache = new Map<string, Record<string, any>>();
  private packageBytecodeCache = new Map<string, any>();

  constructor(private rpcUrl: string) {}

  async getNormalizedMoveModulesByPackage(
    packageId: string,
  ): Promise<Record<string, any>> {
    if (!this.packageCache.has(packageId)) {
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getNormalizedMoveModulesByPackage',
        params: [packageId],
      });
      this.packageCache.set(packageId, response.data);
    }
    return this.packageCache.get(packageId)!;
  }

  async getPackageBytecode(packageId: string): Promise<Record<string, string>> {
    if (!this.packageBytecodeCache.has(packageId)) {
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [
          packageId,
          {
            showContent: true,
          },
        ],
      });

      const bytecode = response.data?.result?.data?.content?.disassembled;
      if (bytecode) {
        this.packageBytecodeCache.set(packageId, bytecode);
      }
    }

    return this.packageBytecodeCache.get(packageId)!;
  }
}
