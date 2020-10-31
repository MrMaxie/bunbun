/// <reference types="node" />
import chokidar from 'chokidar';
import hasha from 'hasha';
import fg from 'fast-glob';
import cpy from 'cpy';
declare type BunbunServerOptions = {
    directory: string;
    port: number;
    fallback?: string;
    reload?: boolean;
    reloadPort?: number;
};
declare class BunbunServer {
    private _$;
    private _http;
    private _ws;
    private _options;
    constructor(_$: Bunbun, _options: BunbunServerOptions);
    reload(): void;
}
declare class Bunbun {
    private _tasks;
    hashFile(file: string, opts: hasha.Options<hasha.ToStringEncoding>): Promise<string>;
    hash(text: string, opts: hasha.Options<hasha.ToStringEncoding>): Promise<string>;
    task(name: string, fn: () => void): void;
    task(name: string, fn: () => PromiseLike<unknown>): void;
    task(name: string, fn: () => unknown): void;
    task(name: string, tasks: string[]): void;
    read(file: string): Promise<Buffer | string>;
    tryRead(file: string, silent?: boolean): Promise<string | Buffer>;
    write(file: string, data: Buffer | string): Promise<unknown>;
    tryWrite(file: string, data: Buffer | string, silent?: boolean): Promise<boolean>;
    copy(source: string, target: string): Promise<unknown>;
    tryCopy(source: string, target: string, silent?: boolean): Promise<boolean>;
    globCopy(source: string | string[], target: string, opts?: cpy.Options): Promise<void>;
    tryGlobCopy(source: string | string[], target: string, silent: boolean | undefined, opts: cpy.Options): Promise<boolean>;
    glob(target: string | string[], opts?: Parameters<typeof fg>[1]): Promise<string[]>;
    watch(target: string | string[], fn: () => unknown, opts?: chokidar.WatchOptions): void;
    debounce(fn: () => unknown | PromiseLike<unknown>): () => Promise<unknown>;
    fileExists(path: string): Promise<boolean>;
    dirExists(path: string): Promise<boolean>;
    exists(path: string): Promise<boolean>;
    serve(directory: string, port: number, options?: Omit<BunbunServerOptions, 'directory' | 'port'>): BunbunServer;
    run(name: string): void | Promise<unknown>;
    log(text: string, ...params: any[]): void;
    error(text: string, ...params: any[]): void;
    private _log;
}
export default Bunbun;
//# sourceMappingURL=main.d.ts.map