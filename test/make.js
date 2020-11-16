const { build } = require('esbuild');
const nodeSass = require('node-sass');
const Bunbun = require('./../dist/main.js');

const sass = args => new Promise((res, rej) => {
    nodeSass.render(args, (err, data) => {
        err ? rej(err) : res(data);
    });
});

const hash = async file => {
    const res = await $.fs.hash(file, 'md5', 'base64');
    return res.replace(/[^a-z0-9]/gi, '');
};

const SOURCE_EXTS = '(scss|ts|tsx|js|jsx|html)';

const $ = new Bunbun;

$.task('build:typescript', async () => {
    await $.until('hash');
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
    await $.until('hash');
    const result = await sass({
        file: './src/index.scss',
        sourceMap: './index.css.map',
        outFile: './index.css',
        outputStyle: 'compressed',
        sourceMapContents: true,
    });
    await $.fs.write('./build/index.css', result.css || '');
    await $.fs.write('./build/index.css.map', result.map || '');
    $.run('hash');
});

$.task('hash', async () => {
    await $.fs.edit('./src/index.html', async html => {
        const jsHash = await hash('./build/index.js');
        const cssHash = await hash('./build/index.css');
        return html
            .replace('__JS_HASH__', jsHash)
            .replace('__CSS_HASH__', cssHash);
    });
});

$.alias('build', ['build:typescript', 'build:scss']);

$.task('assets', async () => {
    let list = await $.fs.list(['./src/**/*.*', `!**/*.${SOURCE_EXTS}`]);
    for (const x of list) {
        await $.fs.copy(x, x.replace(/^\.\/src/, './build'));
    }
});

$.task('watch', async () => {
    const server = $.serve('./build', 8080);

    $.fs.watch(`./src/**/*.${SOURCE_EXTS}`, async () => {
        await $.run('build');
        server.reload();
    });

    $.fs.watch(`./src/**/*.!${SOURCE_EXTS}`, async () => {
        await $.run('assets');
        server.reload();
    });
});

$.start('build');
