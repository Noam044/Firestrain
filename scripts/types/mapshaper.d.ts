// mapshaper ships no type declarations; only the API used by scripts/ is typed here.
declare module "mapshaper" {
  const mapshaper: {
    /** Runs mapshaper commands on in-memory inputs; resolves to the output files. */
    applyCommands(
      commands: string,
      inputs: Record<string, string | Uint8Array>,
    ): Promise<Record<string, string | Uint8Array>>;
  };
  export default mapshaper;
}
