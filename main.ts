import util from 'util';
import chalk, { Chalk } from 'chalk';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import Koa from 'koa';
import WebSockets from 'ws';
import { lookup } from 'mime-types';
import hasha from 'hasha';
import fg from 'fast-glob';
import cpy from 'cpy';
import { exec } from 'child_process';

const fsStat = util.promisify(fs.lstat);
const fsRead = util.promisify(fs.readFile);

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
                ctx.body = await fsRead(path.join(__dirname, 'inject-reload.js'), 'utf8');
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
                body = await fsRead(file, 'utf8');
                body = body.concat('<script src="/__bunbun-reload.js"></script>');
            } else {
                body = await fsRead(file);
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

    task(name: string, fn: () => void): void;
    task(name: string, fn: () => PromiseLike<unknown>): void;
    task(name: string, fn: () => unknown): void;
    task(name: string, tasks: string[]): void;
    task(name: string, tasksOrFn: any[] | (() => any)) {
        this._tasks.set(name, tasksOrFn);
    }

    async read(file: string): Promise<Buffer | string> {
        return new Promise((res, rej) => {
            fs.readFile(file, {
                encoding: 'utf8',
            }, (err, data) => {
                err ? rej(err) : res(data);
            });
        });
    }

    async tryRead(file: string, silent = false) {
        try {
            const data = await this.read(file);
            return data;
        } catch (e) {
            if (!silent) {
                this.error('Cannot read file %s, reason:', file);
                console.error(e);
            }
            return '';
        }
    }

    async write(file: string, data: Buffer | string) {
        return new Promise((res, rej) => {
            fs.writeFile(file, data, {
                encoding: 'utf8',
            }, err => {
                err ? rej(err) : res();
            });
        });
    }

    async tryWrite(file: string, data: Buffer | string, silent = false) {
        try {
            await this.write(file, data);
        } catch (e) {
            if (!silent) {
                this.error('Cannot write file %s, reason:', file);
                console.error(e);
            }
            return false;
        }
        return true;
    }

    async copy(source: string, target: string) {
        if ((await this.exists(source)) !== 'file') {
            this.error('Cannot find %s file to copy', source);
            throw false;
        }

        const read = fs.createReadStream(source);
        const write = fs.createWriteStream(target);

        return new Promise((res, rej) => {
            read.on('error', rej);
            write.on('error', rej);
            write.on('finish', res);
            read.pipe(write);
        }).catch(e => {
            read.destroy();
            write.end();
            throw e;
        });
    }

    async tryCopy(source: string, target: string, silent = false) {
        if ((await this.exists(source)) !== 'file') {
            if (!silent) {
                this.error('Cannot find %s file to copy', source);
            }
            return false;
        }

        try {
            await this.copy(source, target);
            return true;
        } catch (e) {
            if (!silent) {
                this.error('Cannot copy %s file to %s, reason:', source, target);
                console.error(e);
            }
            return false;
        }
    }

    async globCopy(source: string | string[], target: string, opts?: cpy.Options) {
        await cpy(source, target, opts);
    }

    async tryGlobCopy(source: string | string[], target: string, silent = false, opts: cpy.Options) {{
        try {
            await cpy(source, target, opts);
            return true;
        } catch (e) {
            if (!silent) {
                this.error('Cannot glob-copy %s to %s, reason:', JSON.stringify(source), target);
                console.error(e);
            }
            return false;
        }
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

    async tryExec(command: string, silent = false, opts: BunbunExecOptions = {}): Promise<{
        stdout: Buffer;
        stderr: Buffer;
    }> {
        try {
            const res = await this.exec(command, opts);
            return res;
        } catch (e) {
            if (!silent) {
                this.error('Fail at exec %s, reason:', command);
                console.error(e);
            }

            return {
                stdout: Buffer.from(''),
                stderr: Buffer.from(''),
            }
        }
    }

    async glob(target: string | string[], opts?: Parameters<typeof fg>[1]) {
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
            const s = await fsStat(path);
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
