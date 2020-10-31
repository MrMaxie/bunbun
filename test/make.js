const { build } = require('esbuild');
const nodeSass = require('node-sass');
const Bunbun = require('./../main.js');

const sass = args => new Promise((res, rej) => {
    nodeSass.render(args, (err, data) => {
        err ? rej(err) : res(data);
    });
});

const hash = async file => {
    const res = await $.hashFile(file, {
        algorithm: 'md5',
        encoding: 'base64',
    });
    return res.replace(/[^a-z0-9]/gi, '');
};

const SOURCE_EXTS = '(scss|ts|tsx|js|jsx|html)';

const $ = new Bunbun;

$.task('build:typescript', async () => {
    await build({
        sourcemap: true,
        format: 'iife',
        minify: true,
        bundle: true,
        outfile: './build/index.js',
        entryPoints: ['./src/index.tsx'],
        platform: 'browser',
        tsconfig: './tsconfig.json',
        define: {
            'process.env.NODE_ENV': '"develop"',
        },
    });
    $.run('hash');
});

$.task('build:scss', async () => {
    const result = await sass({
        file: './src/index.scss',
        sourceMap: './index.css.map',
        outFile: './index.css',
        outputStyle: 'compressed',
        sourceMapContents: true,
    });
    await $.write('./build/index.css', result.css || '');
    await $.write('./build/index.css.map', result.map || '');
    $.run('hash');
});

$.task('hash', $.debounce(async () => {
    let html = await $.read('./src/index.html');
    const jsHash = await hash('./build/index.js');
    const cssHash = await hash('./build/index.css');
    html = html
        .replace('__JS_HASH__', jsHash)
        .replace('__CSS_HASH__', cssHash);
    await $.write('./build/index.html', html);
}));

$.task('build', $.debounce(async () => {
    await $.run('build:typescript');
    await $.run('build:scss');
}));

$.task('assets', $.debounce(async () => {
    await $.globCopy(`./src/**/*.!${SOURCE_EXTS}`, './build');
}));

$.task('watch', async () => {
    const server = $.serve('./build', 8080);

    $.watch(`./src/**/*.${SOURCE_EXTS}`, async () => {
        await $.run('build');
        server.reload();
    });

    $.watch(`./src/**/*.!${SOURCE_EXTS}`, async () => {
        await $.run('assets');
        server.reload();
    });
});

$.run(process.argv[2] || 'build');
