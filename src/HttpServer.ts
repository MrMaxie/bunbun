import Koa from 'koa';
import WebSockets from 'ws';
import path from 'path';
import fse from 'fs-extra';
import { lookup } from 'mime-types';
import type Bunbun from './Bunbun';

export type HttpOptions = {
    directory: string;
    port: number;
    fallback?: string;
    reload?: boolean;
    reloadPort?: number;
};

const injectMe: string = `
(() => {
    if (!('WebSocket' in window)) {
        console.error('cannot connect with reload server because websockets are not available');
    }

    const connect = () => {
        const ws = new WebSocket('ws://localhost:__PORT__');
        ws.addEventListener('open', () =>{
            console.log('Reload server connected');
        });
        ws.addEventListener('message', e => {
            const msg = e.data;

            if (msg === 'reload') {
                location.reload();
            }
        });
        const reconnect = () => {
            console.log('Reload server closed, trying to reconnect');
            setTimeout(() => {
                connect();
            }, 300);
        };
        ws.addEventListener('close', reconnect);
        ws.addEventListener('error',reconnect);
    };
    connect();
})();
`;

export default class HttpServer {
    private _http = new Koa();

    private _ws: WebSockets.Server | undefined;

    private _options: Required<HttpOptions> = {
        directory: './build',
        fallback: './index.html',
        reload: true,
        port: 8080,
        reloadPort: 8181,
    };

    private _aliases = new Map<string, string>();

    constructor(
        private $: Bunbun,
        options: HttpOptions
    ) {
        this._options = Object.assign({}, this._options, options);

        this._http.use(this._sendReloadScript.bind(this));
        this._http.use(this._sendFile.bind(this));
    }

    private async _sendReloadScript(
        ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>,
        next: Koa.Next
    ) {
        if (ctx.path === '/__bunbun-reload.js') {
            ctx.body = injectMe.replace('__PORT__', String(this._options.reloadPort));
            return;
        }

        await next();
    }

    private async _sendFile(
        ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>,
        next: Koa.Next
    ) {
        const { $, _options } = this;

        const alias = this._aliases.get(ctx.path);

        const dir = path.resolve($.fs.cwd, _options.directory);
        const fallback = path.resolve(dir, _options.fallback);
        let file = path.resolve(dir, path.join('.', alias ? alias : ctx.path));

        if ((await $.fs.exists(file)) !== 'file') {
            file = path.resolve(dir, fallback);
        }

        if ((await $.fs.exists(file)) !== 'file') {
            return ctx.throw(404, `cannot find file: ${ctx.path}`);
        }

        const isHtml = ['.htm', '.html'].includes(path.extname(file).toLowerCase());
        let body: string | Buffer = '';

        if (isHtml && _options.reload) {
            body = await fse.readFile(file, 'utf8');
            body = body.concat('<script src="/__bunbun-reload.js"></script>');
        } else {
            body = await fse.readFile(file);
        }

        ctx.body = body;
        ctx.type = lookup(file) || 'plain/text';
    }

    run() {
        this._http.listen(this._options.port);

        if (this._options.reload) {
            this._ws = new WebSockets.Server({
                port: this._options.reloadPort,
            });
        }

        this.$.logger.log('http server listening on port $', this._options.port);
    }

    reload() {
        const { $, _options, _ws } = this;

        if (!_options.reload) {
            $.logger.error('tried to reload server that isn\'t prepared for reload');
            $.logger.error('set-up $ with $ in options', '.serve()', '"reload": true');
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
