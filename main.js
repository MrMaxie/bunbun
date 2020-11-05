"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
const chalk_1 = __importDefault(require("chalk"));
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const koa_1 = __importDefault(require("koa"));
const ws_1 = __importDefault(require("ws"));
const mime_types_1 = require("mime-types");
const hasha_1 = __importDefault(require("hasha"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const cpy_1 = __importDefault(require("cpy"));
const child_process_1 = require("child_process");
const fs_extra_1 = __importDefault(require("fs-extra"));
const tmp_1 = __importDefault(require("tmp"));
const IGNORED_DEFAULT = Symbol('default');
class BunbunHttpServer {
    constructor(_$, _options) {
        this._$ = _$;
        this._http = new koa_1.default();
        this._options = {
            directory: './build',
            fallback: './index.html',
            reload: true,
            port: 8080,
            reloadPort: 8181,
        };
        this._options = Object.assign({}, this._options, _options);
        const dir = path_1.default.resolve(process.cwd(), this._options.directory);
        const fallback = path_1.default.resolve(dir, this._options.fallback);
        this._http.use((ctx, next) => __awaiter(this, void 0, void 0, function* () {
            if (ctx.path === '/__bunbun-reload.js') {
                ctx.body = yield fs_extra_1.default.readFile(path_1.default.join(__dirname, 'inject-reload.js'), 'utf8');
                ctx.body = ctx.body.replace('__PORT__', this._options.reloadPort);
                return;
            }
            yield next();
        }));
        this._http.use((ctx) => __awaiter(this, void 0, void 0, function* () {
            let file = path_1.default.resolve(dir, path_1.default.join('.', ctx.path));
            if ((yield _$.exists(file)) !== 'file') {
                file = path_1.default.resolve(dir, fallback);
            }
            if ((yield _$.exists(file)) !== 'file') {
                return ctx.throw(404, `cannot find file: ${ctx.path}`);
            }
            const isHtml = ['.htm', '.html'].includes(path_1.default.extname(file).toLowerCase());
            let body = '';
            if (isHtml && this._options.reload) {
                body = yield fs_extra_1.default.readFile(file, 'utf8');
                body = body.concat('<script src="/__bunbun-reload.js"></script>');
            }
            else {
                body = yield fs_extra_1.default.readFile(file);
            }
            ctx.body = body;
            ctx.type = mime_types_1.lookup(file) || 'plain/text';
        }));
        if (this._options.reload) {
            this._ws = new ws_1.default.Server({
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
    constructor() {
        this._debug = false;
        this._makeTry = (promise, _default, _defaultTrue = IGNORED_DEFAULT) => {
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
        this._tasks = new Map();
        this._currentTempStack = 0;
        this._tempDirs = new Set();
    }
    debug(val) {
        this._debug = val;
    }
    hashFile(file, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield hasha_1.default.fromFile(file, opts);
            return r;
        });
    }
    hash(text, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield hasha_1.default.async(text, opts);
            return r;
        });
    }
    wait(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(res => {
                setTimeout(() => {
                    res();
                }, ms);
            });
        });
    }
    tempDir(cleanOnFinish = true) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                tmp_1.default.dir((err, path, cleanup) => {
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
        });
    }
    tempDirClean(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(res => {
                for (const e of this._tempDirs.values()) {
                    if (e.path === path) {
                        e.cleanup();
                        this._tempDirs.delete(e);
                    }
                }
                res();
            });
        });
    }
    _tempStackDown() {
        this._currentTempStack -= 1;
        for (const e of this._tempDirs.values()) {
            if (e.stack > this._currentTempStack && e.clean) {
                e.cleanup();
                this._tempDirs.delete(e);
            }
        }
    }
    _tempStackUp() {
        this._currentTempStack += 1;
    }
    task(name, tasksOrFn) {
        this._tasks.set(name, tasksOrFn);
    }
    remove(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield fs_extra_1.default.remove(path);
        });
    }
    tryRemove(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._makeTry(this.remove(path), true, false);
        });
    }
    read(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_extra_1.default.readFile(file, {
                    encoding: 'utf8',
                }, (err, data) => {
                    err ? rej(err) : res(String(data));
                });
            });
        });
    }
    tryRead(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._makeTry(this.read(file), '');
        });
    }
    write(file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_extra_1.default.writeFile(file, data, {
                    encoding: 'utf8',
                }, err => {
                    err ? rej(err) : res();
                });
            });
        });
    }
    tryWrite(file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._makeTry(this.write(file, data), true, false);
        });
    }
    readRaw(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_extra_1.default.readFile(file, (err, data) => {
                    err ? rej(err) : res(data);
                });
            });
        });
    }
    tryReadRaw(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._makeTry(this.readRaw(file), Buffer.from(''));
        });
    }
    writeRaw(file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_extra_1.default.writeFile(file, data, err => {
                    err ? rej(err) : res();
                });
            });
        });
    }
    tryWriteRaw(file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._makeTry(this.writeRaw(file, data), true, false);
        });
    }
    copy(source, target, overwrite = true) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs_extra_1.default.copy(source, target, { overwrite });
        });
    }
    tryCopy(source, target, overwrite = true) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._makeTry(this.copy(source, target, overwrite), true, false);
        });
    }
    globCopy(source, target, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            yield cpy_1.default(source, target, opts);
        });
    }
    tryGlobCopy(source, target, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            {
                return yield this._makeTry(this.globCopy(source, target, opts), true, false);
            }
        });
    }
    exec(command, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                child_process_1.exec(command, {
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
        });
    }
    tryExec(command, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._makeTry(this.exec(command, opts), {
                stdout: Buffer.from(''),
                stderr: Buffer.from(''),
            });
        });
    }
    glob(target, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = yield fast_glob_1.default(target, opts);
            return files;
        });
    }
    watch(target, fn, opts) {
        chokidar_1.default.watch(target, Object.assign({}, {
            ignoreInitial: true,
        }, opts)).on('all', () => {
            fn();
        });
        fn();
    }
    debounce(fn) {
        let promise;
        let running = false;
        let repeat = false;
        const cb = () => {
            return Promise.resolve().then(() => fn()).finally(() => {
                if (repeat) {
                    repeat = false;
                    return cb();
                }
                else {
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
        };
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const s = yield fs_extra_1.default.stat(path);
                return s.isDirectory() ? 'dir' : 'file';
            }
            catch (e) {
                return false;
            }
        });
    }
    serve(directory, port, options = {}) {
        return new BunbunHttpServer(this, Object.assign({}, options, {
            directory,
            port,
        }));
    }
    run(name) {
        const x = this._tasks.get(name);
        if (x === undefined) {
            this.error('Cannot find task "%s"', name);
            return;
        }
        this._tempStackUp();
        this.log('>> %s start', name);
        let time = Date.now();
        return (Array.isArray(x)
            ? Promise.all(x.map(y => this.run(y)))
            : Promise.resolve().then(() => x())).catch(msg => {
            this.error('>> %s has crashed', name);
            if (msg) {
                console.log(msg);
            }
        }).finally(() => {
            this.log('>> %s done in time %ss', name, (Date.now() - time) / 1000);
            this._tempStackDown();
        });
    }
    log(text, ...params) {
        this._log(text, chalk_1.default.blue, ...params);
    }
    error(text, ...params) {
        this._log(text, chalk_1.default.red, ...params);
    }
    _log(text, color, ...params) {
        console.log(util_1.default.format(text, ...params.map(x => {
            return typeof x === 'string' || typeof x === 'number'
                ? color(x)
                : x;
        })));
    }
}
exports.default = Bunbun;
module.exports = Bunbun;
//# sourceMappingURL=main.js.map