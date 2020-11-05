/// <reference types="node" />
import chokidar from 'chokidar';
import hasha from 'hasha';
import fg from 'fast-glob';
import cpy from 'cpy';
declare type BunbunExecOptions = {
    cwd?: string;
    env?: {
        [name: string]: string;
    };
    timeout?: number;
    maxBuffer?: number;
};
declare type BunbunHttpServerOptions = {
    directory: string;
    port: number;
    fallback?: string;
    reload?: boolean;
    reloadPort?: number;
};
declare class BunbunHttpServer {
    private _$;
    private _http;
    private _ws;
    private _options;
    constructor(_$: Bunbun, _options: BunbunHttpServerOptions);
    reload(): void;
}
declare class Bunbun {
    private _debug;
    debug(val: boolean): void;
    private _makeTry;
    private _tasks;
    hashFile(file: string, opts: hasha.Options<hasha.ToStringEncoding>): Promise<string>;
    hash(text: string, opts: hasha.Options<hasha.ToStringEncoding>): Promise<string>;
    wait(ms: number): Promise<void>;
    private _currentTempStack;
    private _tempDirs;
    tempDir(cleanOnFinish?: boolean): Promise<string>;
    tempDirClean(path: string): Promise<void>;
    private _tempStackDown;
    private _tempStackUp;
    task(name: string, fn: () => void): void;
    task(name: string, fn: () => PromiseLike<unknown>): void;
    task(name: string, fn: () => unknown): void;
    task(name: string, tasks: string[]): void;
    remove(path: string): Promise<void>;
    tryRemove(path: string): Promise<boolean>;
    read(file: string): Promise<string>;
    tryRead(file: string): Promise<string>;
    write(file: string, data: string): Promise<void>;
    tryWrite(file: string, data: string): Promise<boolean>;
    readRaw(file: string): Promise<Buffer>;
    tryReadRaw(file: string): Promise<Buffer>;
    writeRaw(file: string, data: Buffer): Promise<void>;
    tryWriteRaw(file: string, data: Buffer): Promise<boolean>;
    copy(source: string, target: string, overwrite?: boolean): Promise<void>;
    tryCopy(source: string, target: string, overwrite?: boolean): Promise<boolean>;
    globCopy(source: string | string[], target: string, opts?: cpy.Options): Promise<void>;
    tryGlobCopy(source: string | string[], target: string, opts?: cpy.Options): Promise<boolean>;
    exec(command: string, opts?: BunbunExecOptions): Promise<{
        stdout: Buffer;
        stderr: Buffer;
    }>;
    tryExec(command: string, opts?: BunbunExecOptions): Promise<{
        stdout: Buffer;
        stderr: Buffer;
    }>;
    glob(target: string | string[], opts?: Parameters<typeof fg>[1]): Promise<string[]>;
    watch(target: string | string[], fn: () => unknown, opts?: chokidar.WatchOptions): void;
    debounce(fn: () => unknown | PromiseLike<unknown>): () => Promise<unknown>;
    exists(path: string): Promise<false | "dir" | "file">;
    serve(directory: string, port: number, options?: Omit<BunbunHttpServerOptions, 'directory' | 'port'>): BunbunHttpServer;
    run(name: string): void | Promise<unknown>;
    log(text: string, ...params: any[]): void;
    error(text: string, ...params: any[]): void;
    private _log;
}
export default Bunbun;
//# sourceMappingURL=main.d.ts.map