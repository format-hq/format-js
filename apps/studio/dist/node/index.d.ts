//#region src/server/dev-server/index.d.ts
interface FormatDevOptions {
  open?: boolean;
  port?: string;
}
declare function serve(options: FormatDevOptions): Promise<void>;
//#endregion
export { type FormatDevOptions, serve };