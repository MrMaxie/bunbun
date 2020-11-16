import chalk from 'chalk';
import execa from 'execa';
import Logger from './Logger';
import Fs from './Fs';
import Task, { TaskOptions } from './Task';
import HttpServer, { HttpOptions } from './HttpServer';
import hasha from 'hasha';

type Options = TaskOptions & {
    debugging: boolean;
    silent: boolean;
    cwd: string;
};

export default class Bunbun {
    private _defaultOptions: Options = {
        debouncePromise: true,
        debounceTime: 200,
        debugging: false,
        silent: false,
        cwd: process.cwd(),
    };

    constructor(defaultOptions: Partial<Options> = {}) {
        this._defaultOptions = Object.assign(
            {}, this._defaultOptions, defaultOptions
        );

        this.logger.debugging = this._defaultOptions.debugging;
        this.logger.silent = this._defaultOptions.silent;
    }

    private _tasks = new Map<string, Task>();

    logger = new Logger();

    fs = new Fs();

    task(name: string, fn: () => unknown, options: Partial<TaskOptions> = {}) {
        this.logger.debug(`[${chalk.blue(name)}] registering task`);

        if (this._tasks.has(name)) {
            this.logger.error(`[${chalk.red(name)}] task already exists`);
            return;
        }

        const task = new Task(name, fn, Object.assign(
            {}, this._defaultOptions, options,
        ));

        task.on('start', () => {
            this.logger.log(`[${chalk.blue(name)}] start`);
        });

        task.on('success', time => {
            this.logger.success(`[${chalk.green(name)}] done ($s)`, time);
        });

        task.on('fail', (time, e) => {
            this.logger.error(`[${chalk.red(name)}] fail ($s)`, time);
            if (e) this.logger.log('reason: $', e);
        });

        this._tasks.set(name, task);
    }

    alias(name: string, names: string[]) {
        this.logger.debug(`[${chalk.blue(name)}] registering alias`);

        for (const subName of names) {
            if (!this._tasks.has(subName)) {
                this.logger.error(`[${chalk.red(name)}] cannot find task $`, subName);
                return;
            }
        }

        this.task(name, () => Promise.all(names.map(x => this.run(x))));
    }

    async run(name: string) {
        this.logger.debug(`[${chalk.blue(name)}] running task`);

        const task =  this._tasks.get(name);

        if (!task) {
            this.logger.error(`[${chalk.red(name)}] cannot find task`);
            return await Promise.reject(false);
        }

        return task.run();
    }

    async until(name: string) {
        this.logger.debug(`[${chalk.blue(name)}] awaiting for task`);

        const task =  this._tasks.get(name);

        if (!task) {
            this.logger.error(`[${chalk.red(name)}] cannot find task`);
            return await Promise.reject(false);
        }

        if (task.heap.isEmpty()) {
            return Promise.resolve(true);
        }

        return new Promise(res => {
            task.heap.once('empty', () => {
                res(true);
            });
        });
    }

    async rescue<
        T1 extends unknown,
        T2 extends unknown
    >(
        promise: Promise<T1> | T1,
        alter?: T2
    ): Promise<T1 | T2> {
        try {
            const res = await promise;
            return res;
        } catch (e) {
            return alter ? alter : e;
        }
    }

    async hash(
        text: string,
        algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
        encoding: 'hex' | 'base64' | 'buffer' | 'latin1' = 'base64'
    ) {
        const res = await hasha.async(text, {
            algorithm,
            encoding: encoding === 'buffer' ? undefined : encoding,
        });
        return res;
    }

    private _debounceCount = 0;

    debounce<T extends unknown>(
        fn: () => Promise<T> | T,
        time = 0
    ): () => Promise<T> {
        this._debounceCount += 1;
        const id = this._debounceCount;
        this.logger.debug('[debounce#$] registering', id);

        let working = false;
        let p = Promise.resolve();
        let waiting = time > 0;
        let wp: Promise<unknown> | false = false;

        const dfn = (() => {
            this.logger.debug('[debounce#$] executing', id);

            if (waiting) {
                this.logger.debug('[debounce#$] returning waiting promise for $', id, time);

                if (wp) {
                    return wp;
                }

                wp = (new Promise(res => {
                    setTimeout(res, time);
                })).then(() => {
                    waiting = false;
                    wp = false;
                    this.logger.debug('[debounce#$] waiting done', id);
                    return dfn();
                });
                return wp;
            }

            if (working) {
                this.logger.debug('[debounce#$] returning last promise', id);
                return p;
            }

            working = true;
            return new Promise((res, rej) => {
                p
                    .then(() => fn())
                    .then(data => {
                        res(data);
                        return data;
                    })
                    .catch(err => {
                        this.logger.debug('[debounce#$] error ->', id);
                        this.logger.error('debounce throwed exception: $', err);
                        rej(err);
                    })
                    .finally(() => {
                        waiting = time > 0;
                        working = false;
                    });
            });
        }) as () => Promise<T>;

        return dfn;
    }

    serve(
        directory: string,
        port: number,
        options: Partial<HttpOptions> = {}
    ) {
        const server = new HttpServer(this, Object.assign({}, options, {
            directory,
            port,
        }));

        server.run();

        return server;
    }

    async exec(
        command: string,
        timeout: number = 0,
    ) {
        const { stdout, stderr } = await execa.command(command, {
            cwd: this._defaultOptions.cwd,
            timeout: Math.max(0, timeout),
        });
        return { stdout, stderr };
    }

    async start(
        defaultTask: string = 'default',
        tasks: string[] = process.argv.slice(2),
    ): Promise<void> {
        this.logger.debug(`starting with default as $ and args $`, defaultTask, tasks);

        if (tasks.length > 0) {
            let mainPromise: Promise<void> = Promise.resolve();
            tasks.map(x => {
                mainPromise = mainPromise.then(async () => {
                    await this.rescue(this.run(x));
                });
            });
            return mainPromise;
        }

        try {
            await this.run(defaultTask);
        } catch(e) {
            this.logger.debug(`cannot find task $ at start`, defaultTask);
            return;
        }
    }
}
