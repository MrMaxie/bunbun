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
const fs_1 = __importDefault(require("fs"));
const koa_1 = __importDefault(require("koa"));
const ws_1 = __importDefault(require("ws"));
const mime_types_1 = require("mime-types");
const hasha_1 = __importDefault(require("hasha"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const cpy_1 = __importDefault(require("cpy"));
const fsStat = util_1.default.promisify(fs_1.default.lstat);
const fsRead = util_1.default.promisify(fs_1.default.readFile);
class BunbunServer {
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
                ctx.body = yield fsRead(path_1.default.join(__dirname, 'inject-reload.js'), 'utf8');
                ctx.body = ctx.body.replace('__PORT__', this._options.reloadPort);
                return;
            }
            yield next();
        }));
        this._http.use((ctx) => __awaiter(this, void 0, void 0, function* () {
            let file = path_1.default.resolve(dir, path_1.default.join('.', ctx.path));
            if (!(yield _$.fileExists(file))) {
                file = path_1.default.resolve(dir, fallback);
            }
            if (!(yield _$.fileExists(file))) {
                return ctx.throw(404, `cannot find file: ${ctx.path}`);
            }
            const isHtml = ['.htm', '.html'].includes(path_1.default.extname(file).toLowerCase());
            let body = '';
            if (isHtml && this._options.reload) {
                body = yield fsRead(file, 'utf8');
                body = body.concat('<script src="/__bunbun-reload.js"></script>');
            }
            else {
                body = yield fsRead(file);
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
        this._tasks = new Map();
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
    task(name, tasksOrFn) {
        this._tasks.set(name, tasksOrFn);
    }
    read(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_1.default.readFile(file, {
                    encoding: 'utf8',
                }, (err, data) => {
                    err ? rej(err) : res(data);
                });
            });
        });
    }
    tryRead(file, silent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.read(file);
                return data;
            }
            catch (e) {
                if (!silent) {
                    this.error('Cannot read file %s, reason:', file);
                    console.error(e);
                }
                return '';
            }
        });
    }
    write(file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((res, rej) => {
                fs_1.default.writeFile(file, data, {
                    encoding: 'utf8',
                }, err => {
                    err ? rej(err) : res();
                });
            });
        });
    }
    tryWrite(file, data, silent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.write(file, data);
            }
            catch (e) {
                if (!silent) {
                    this.error('Cannot write file %s, reason:', file);
                    console.error(e);
                }
                return false;
            }
            return true;
        });
    }
    copy(source, target) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.fileExists(source))) {
                this.error('Cannot find %s file to copy', source);
                throw false;
            }
            const read = fs_1.default.createReadStream(source);
            const write = fs_1.default.createWriteStream(target);
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
        });
    }
    tryCopy(source, target, silent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.fileExists(source))) {
                if (!silent) {
                    this.error('Cannot find %s file to copy', source);
                }
                return false;
            }
            try {
                yield this.copy(source, target);
                return true;
            }
            catch (e) {
                if (!silent) {
                    this.error('Cannot copy %s file to %s, reason:', source, target);
                    console.error(e);
                }
                return false;
            }
        });
    }
    globCopy(source, target, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            yield cpy_1.default(source, target, opts);
        });
    }
    tryGlobCopy(source, target, silent = false, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            {
                try {
                    yield cpy_1.default(source, target, opts);
                    return true;
                }
                catch (e) {
                    if (!silent) {
                        this.error('Cannot glob-copy %s to %s, reason:', JSON.stringify(source), target);
                        console.error(e);
                    }
                    return false;
                }
            }
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
    fileExists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const s = yield fsStat(path);
                return !s.isDirectory() && s.isFile();
            }
            catch (e) {
                return false;
            }
        });
    }
    dirExists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const s = yield fsStat(path);
                return s.isDirectory();
            }
            catch (e) {
                return false;
            }
        });
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fsStat(path);
            }
            catch (e) {
                return false;
            }
            return true;
        });
    }
    serve(directory, port, options = {}) {
        return new BunbunServer(this, Object.assign({}, options, {
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