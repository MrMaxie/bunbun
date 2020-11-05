import util from 'util';
import chalk, { Chalk } from 'chalk';
import chokidar from 'chokidar';
import path from 'path';
import Koa from 'koa';
import WebSockets from 'ws';
import { lookup } from 'mime-types';
import hasha from 'hasha';
import fg from 'fast-glob';
import cpy from 'cpy';
import { exec } from 'child_process';
import fse from 'fs-extra';
import tmp from 'tmp';

const IGNORED_DEFAULT = Symbol('default');

type BunbunExecOptions = {
    cwd?: string;
    env?: {
        [name: string]: string;
    };
    timeout?: number;
    maxBuffer?: number;
};

type BunbunHttpServerOptions = {
    directory: string;
    port: number;
    fallback?: string;
    reload?: boolean;
    reloadPort?: number;
};

class BunbunHttpServer {
    private _http = new Koa();

    private _ws: WebSockets.Server | undefined;

    private _options: Required<BunbunHttpServerOptions> = {
        directory: './build',
        fallback: './index.html',
        reload: true,
        port: 8080,
        reloadPort: 8181,
    };

    constructor(
        private _$: Bunbun,
        _options: BunbunHttpServerOptions,
    ) {
        this._options = Object.assign({}, this._options, _options);

        const dir = path.resolve(process.cwd(), this._options.directory);
        const fallback = path.resolve(dir, this._options.fallback);

        this._http.use(async (ctx, next) => {
            if (ctx.path === '/__bunbun-reload.js') {
                ctx.body = await fse.readFile(path.join(__dirname, 'inject-reload.js'), 'utf8');
                ctx.body = ctx.body.replace('__PORT__', this._options.reloadPort);
                return;
            }

            await next();
        });

        this._http.use(async ctx => {
            let file = path.resolve(dir, path.join('.', ctx.path));

            if ((await _$.exists(file)) !== 'file') {
                file = path.resolve(dir, fallback);
            }

            if ((await _$.exists(file)) !== 'file') {
                return ctx.throw(404, `cannot find file: ${ctx.path}`);
            }

            const isHtml = ['.htm', '.html'].includes(path.extname(file).toLowerCase());
            let body: string | Buffer = '';

            if (isHtml && this._options.reload) {
                body = await fse.readFile(file, 'utf8');
                body = body.concat('<script src="/__bunbun-reload.js"></script>');
            } else {
                body = await fse.readFile(file);
            }

            ctx.body = body;
            ctx.type = lookup(file) || 'plain/text';
        });

        if (this._options.reload) {
            this._ws = new WebSockets.Server({
                port: this._options.reloadPort,
            });
        }

        this._http.listen(this._options.port);

        _$.log('>> web server listening on port %s', this._options.port);
    }

    reload() {
        const { _$, _options, _ws } = this;

        if (!_options.reload) {
            _$.error('>> ! tried to reload server that isn\'t prepared for reload');
            _$.error('>> ! set-up %s with %s in options', '.serve()', '"reload": true');
            return;
        }

        if (!_ws) {
            return;
        }

        for (const c of _ws.clients) {
            c.send('reload');
        }
    }
}

class Bunbun {
    private _debug = false;

    debug(val: boolean) {
        this._debug = val;
    }

    private _makeTry = <T extends any>(
        promise: Promise<T | any>,
        _default: T,
        _defaultTrue: T | typeof IGNORED_DEFAULT = IGNORED_DEFAULT,
    ): Promise<T> => {
        return new Promise((res, rej) => {
            promise.then(value => {
                res(_defaultTrue === IGNORED_DEFAULT ? value : _defaultTrue);
            }).catch(err => {
                if (this._debug) {
                    console.error(err);
                }
                res(_default);
            });
        });
    };

    private _tasks = new Map<string, (() => unknown) | string[]>();

    async hashFile(file: string, opts: hasha.Options<hasha.ToStringEncoding>) {
        const r = await hasha.fromFile(file, opts);
        return r;
    }

    async hash(text: string, opts: hasha.Options<hasha.ToStringEncoding>) {
        const r = await hasha.async(text, opts);
        return r;
    }

    async wait(ms: number): Promise<void> {
        return new Promise(res => {
            setTimeout(() => {
                res();
            }, ms);
        });
    }

    private _currentTempStack = 0;

    private _tempDirs = new Set<{
        path: string;
        stack: number;
        clean: boolean;
        cleanup: () => void;
    }>();

    async tempDir(cleanOnFinish = true): Promise<string> {
        return new Promise((res, rej) => {
            tmp.dir((err, path, cleanup) => {
                if (err) {
                    rej(err);
                    return;
                }

                this._tempDirs.add({
                    path,
                    stack: this._currentTempStack,
                    clean: cleanOnFinish,
                    cleanup,
                });

                res(path);
            });
        });
    }

    async tempDirClean(path: string): Promise<void> {
        return new Promise(res => {
            for (const e of this._tempDirs.values()) {
                if (e.path === path) {
                    e.cleanup()
                    this._tempDirs.delete(e);
                }
            }
            res();
        });
    }

    private _tempStackDown() {
        this._currentTempStack -= 1;

        for (const e of this._tempDirs.values()) {
            if (e.stack > this._currentTempStack && e.clean) {
                e.cleanup()
                this._tempDirs.delete(e);
            }
        }
    }

    private _tempStackUp() {
        this._currentTempStack += 1;
    }

    task(name: string, fn: () => void): void;
    task(name: string, fn: () => PromiseLike<unknown>): void;
    task(name: string, fn: () => unknown): void;
    task(name: string, tasks: string[]): void;
    task(name: string, tasksOrFn: any[] | (() => any)) {
        this._tasks.set(name, tasksOrFn);
    }

    async remove(path: string): Promise<void> {
        return await fse.remove(path);
    }

    async tryRemove(path: string): Promise<boolean> {
        return await this._makeTry<boolean>(this.remove(path), true, false);
    }

    async read(file: string): Promise<string> {
        return new Promise((res, rej) => {
            fse.readFile(file, {
                encoding: 'utf8',
            }, (err, data) => {
                err ? rej(err) : res(String(data));
            });
        });
    }

    async tryRead(file: string): Promise<string> {
        return await this._makeTry<string>(this.read(file), '');
    }

    async write(file: string, data: string): Promise<void> {
        return new Promise((res, rej) => {
            fse.writeFile(file, data, {
                encoding: 'utf8',
            }, err => {
                err ? rej(err) : res();
            });
        });
    }

    async tryWrite(file: string, data: string): Promise<boolean> {
        return this._makeTry<boolean>(this.write(file, data), true, false);
    }

    async readRaw(file: string): Promise<Buffer> {
        return new Promise((res, rej) => {
            fse.readFile(file, (err, data) => {
                err ? rej(err) : res(data);
            });
        });
    }

    async tryReadRaw(file: string): Promise<Buffer> {
        return await this._makeTry<Buffer>(this.readRaw(file), Buffer.from(''));
    }

    async writeRaw(file: string, data: Buffer): Promise<void> {
        return new Promise((res, rej) => {
            fse.writeFile(file, data, err => {
                err ? rej(err) : res();
            });
        });
    }

    async tryWriteRaw(file: string, data: Buffer): Promise<boolean> {
        return this._makeTry<boolean>(this.writeRaw(file, data), true, false);
    }

    async copy(source: string, target: string, overwrite: boolean = true): Promise<void> {
        await fse.copy(source, target, { overwrite });
    }

    async tryCopy(source: string, target: string, overwrite: boolean = true): Promise<boolean> {
        return await this._makeTry<boolean>(this.copy(source, target, overwrite), true, false);
    }

    async globCopy(source: string | string[], target: string, opts?: cpy.Options): Promise<void> {
        await cpy(source, target, opts);
    }

    async tryGlobCopy(source: string | string[], target: string, opts?: cpy.Options): Promise<boolean> {{
        return await this._makeTry(this.globCopy(source, target, opts), true, false);
    }}

    async exec(command: string, opts: BunbunExecOptions = {}): Promise<{
        stdout: Buffer;
        stderr: Buffer;
    }> {
        return new Promise((res, rej) => {
            exec(command, {
                encoding: 'buffer',
                cwd: opts.cwd || process.cwd(),
                env: Object.assign({}, process.env, opts.env || {}),
                timeout: opts.timeout,
                maxBuffer: opts.maxBuffer,
            }, (err, stdout, stderr) => {
                if (err) {
                    rej(err);
                    return;
                }

                res({ stdout, stderr });
            });
        });
    }

    async tryExec(command: string, opts: BunbunExecOptions = {}): Promise<{
        stdout: Buffer;
        stderr: Buffer;
    }> {
        return await this._makeTry(this.exec(command, opts), {
            stdout: Buffer.from(''),
            stderr: Buffer.from(''),
        });
    }

    async glob(target: string | string[], opts?: Parameters<typeof fg>[1]): Promise<string[]> {
        const files = await fg(target, opts);
        return files;
    }

    watch(target: string | string[], fn: () => unknown, opts?: chokidar.WatchOptions) {
        chokidar.watch(target, Object.assign({}, {
            ignoreInitial: true,
        }, opts)).on('all', () => {
            fn();
        });
        fn();
    }

    debounce(fn: () => unknown | PromiseLike<unknown>) {
        let promise: Promise<unknown>;
        let running = false;
        let repeat = false;

        const cb = (): Promise<unknown> => {
            return Promise.resolve().then(() => fn()).finally(() => {
                if (repeat) {
                    repeat = false;
                    return cb();
                } else {
                    running = false;
                }
            });
        };

        return () => {
            if (running) {
                repeat = true;
                return promise;
            }

            running = true;
            promise = Promise.resolve().then(() => cb());
            return promise;
        }
    }

    async exists(path: string) {
        try {
            const s = await fse.stat(path);
            return s.isDirectory() ? 'dir' : 'file';
        } catch (e) {
            return false;
        }
    }

    serve(
        directory: string,
        port: number,
        options: Omit<BunbunHttpServerOptions, 'directory' | 'port'> = {},
    ) {
        return new BunbunHttpServer(this, Object.assign({}, options, {
            directory,
            port,
        }));
    }

    run(name: string): void | Promise<unknown> {
        const x = this._tasks.get(name);

        if (x === undefined) {
            this.error('Cannot find task "%s"', name);
            return;
        }

        this._tempStackUp();
        this.log('>> %s start', name);
        let time = Date.now();

        return (
            Array.isArray(x)
                ? Promise.all(x.map(y => this.run(y)))
                : Promise.resolve().then(() => x())
        ).catch(msg => {
            this.error('>> %s has crashed', name);
            if (msg) {
                console.log(msg);
            }
        }).finally(() => {
            this.log('>> %s done in time %ss', name, (Date.now() - time) / 1000);
            this._tempStackDown();
        });
    }

    log(text: string, ...params: any[]) {
        this._log(text, chalk.blue, ...params);
    }

    error(text: string, ...params: any[]) {
        this._log(text, chalk.red, ...params);
    }

    private _log(text: string, color: Chalk, ...params: any[]) {
        console.log(util.format(text, ...params.map(x => {
            return typeof x === 'string' || typeof x === 'number'
                ? color(x)
                : x;
        })));
    }
}

export default Bunbun;
module.exports = Bunbun;
