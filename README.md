# bunbun

Node.JS based simple, lightweight task bunner... I mean runner\*

<p align="center">
  <img src="bunbun.png" />
</p>

## Why?

⏱ **Lightweight and very fast** - very simple in design, without any library compilers that you will never use, just plain task runner

📐 **Ready to use** - just add to your project, create file and prepare your first task

🔌 **Extendable** - you are owner of your flow, without any magic and invisible parts/configurations etc., neither no compilers included

✨ **Universal** - this library contains **only** language/tool/framework agnostic tools

## Requirements

- Node.JS `>= 7.6v` (because of default support of async/await syntax, smaller versions force you to use `Promise.then()` syntax)
- `NPM` (or any wrapper like `yarn`) is recommended
- ...that's all 😊

## How to install?

Simplest way is just using npm:

```bash
npm install --save-exact --save-dev bunbun
```

## Usage

Example code:

```js
const Bunbun = require('bunbun');

// Import our tools to build things
const { build } = require('esbuild');
const nodeSass = require('node-sass');

// Helper to make SASS async
const sass = args => new Promise((res, rej) => {
    nodeSass.render(args, (err, data) => {
        err ? rej(err) : res(data);
    });
});

// Helper to prepare default settings of hash
const hash = async file => {
    const res = await $.hashFile(file, {
        algorithm: 'md5',
        encoding: 'base64',
    });
    return res.replace(/[^a-z0-9]/gi, '');
};

// Constant list of extensions of source files
const SOURCE_EXTS = '(scss|ts|tsx|js|jsx|html)';

// Preparing instance
const $ = new Bunbun;

// Task: to javascript building
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

// Task: to css building
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

// Task: preparing HTML with including hashes to urls
$.task('hash', $.debounce(async () => {
    let html = await $.read('./src/index.html');
    const jsHash = await hash('./build/index.js');
    const cssHash = await hash('./build/index.css');
    html = html
        .replace('__JS_HASH__', jsHash)
        .replace('__CSS_HASH__', cssHash);
    await $.write('./build/index.html', html);
}));

// Task: sync building using prepared tasks
$.task('build', $.debounce(async () => {
    await $.run('build:typescript');
    await $.run('build:scss');
}));

// Task: cloning non-source files into build directory
$.task('assets', $.debounce(async () => {
    await $.globCopy(`./src/**/*.!${SOURCE_EXTS}`, './build');
}));

// Task: serving directory, watching files for building
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

// Run task from argument, or just "build" as default
$.run(process.argv[2] || 'build');
```

## Methods

- tasks:
  - [run](#run) - run registered task
  - [task](#task) - register new task
- filesystem:
  - [read](#read) - read content of file as buffer or string
  - [tryRead](#tryread) - same as [read](#read) but will don't throw error
  - [write](#write) - write content into file from buffer or string
  - [tryWrite](#trywrite) - same as [write](#write) but will don't throw error
  - [copy](#copy) - just copy file
  - [tryCopy](#trycopy) - same as [copy](#copy) but will don't throw error
  - [globCopy](#globcopy) - copy all files by glob from one directory into another
  - [tryGlobCopy](#tryglobcopy) - same as [globCopy](#globcopy) but will don't throw error
  - [glob](#glob) - list files by glob pattern
  - [watch](#watch) - observe files by glob pattern for any changes
  - [fileExists](#fileexists) - check if file exists and isn't directory
  - [dirExists](#direxists) - check if directory exists and isn't file
  - [exists](#exists) - check if file or directory exists
- utils:
  - [debounce](#debounce) - debounce function to prevent too fast calling
  - [serve](#serve) - serve directory as http server

### run

```typescript
// Execute task with name
run(name: string): void | Promise<unknown>;
```
example:
```javascript
const $ = new Bunbun;

$.task('task-1', () => {
    console.log('task-1');
});
$.task('task-2', async () => {
    console.log('task-2');
    await $.run('task-1');
});
$.task('task-3', async () => {
    console.log('task-3');
    await $.run('task-2');
});

// Run task from argument or task `task-3`
$.run(process.argv[2] || 'task-3');
// output:
// >> task-3
// >> task-2
// >> task-1
```

### task

```typescript
// Register new task
task(
    name: string,
    // If fn returns promise or is async/await function
    // then task will wait until this promise will be resolved or rejected
    fn: () => PromiseLike<unknown> | void | unknown
): void;
```
or
```typescript
// Register alias of "tasks" under given name, tasks will be executed asynchronously
task(name: string, tasks: string[]): void;
```
example:
```javascript
const $ = new Bunbun;

$.task('foo', () => {
    console.log('foo');
});
$.task('bar', async () => {
    await someLongAction();
    console.log('bar');
});
$.task('baz', ['bar', 'foo']);
$.task('qux', async () => {
    await $.run('bar');
    await $.run('baz');
});

$.run('baz');
// output:
// >> foo
// >> bar (because it's waited for long running function)

$.run('qux');
// output:
// >> bar
// >> foo (because it's waited until previous task ended)
```

### read
### tryRead

```typescript
// Just read file
read(file: string): Promise<Buffer | string>;
```
or
```typescript
// Just read file but cannot fail, if will fail
// then just returns empty string
tryRead(
    file: string,
    silent = false, // If true then fail will don't show message
): Promise<Buffer | string>;
```
example:
```javascript
const $ = new Bunbun;

// So let's assume that
// "exists.html" file exists and
// "doesntExists.html" file doesn't exists
// duuuuh...

$.task('read', async () => {
    const data1 = await $.read('exists.html');
    console.log(data1);

    const data2 = await $.read('doesntExists.html');
    console.log(data2);

    console.log('bye');
});
$.task('try-read', async () => {
    const data1 = await $.tryRead('exists.html', true);
    console.log(data1);

    const data2 = await $.tryRead('doesntExists.html', true);
    console.log(data2);

    console.log('bye');
});

$.run('read');
// output:
// >> <CONTENT_OF_FILE>
// >> ERROR

$.run('try-read');
// output:
// >> <CONTENT_OF_FILE>
// >>
// >> bye
```

### write
### tryWrite

```typescript
// Just write file
write(file: string, data: string | Buffer): Promise<void>;
```
or
```typescript
// Just write file but cannot fail
tryWrite(
    file: string,
    silent = false, // If true then fail will don't show message
): Promise<void>;
```
example:
```javascript
const $ = new Bunbun;

$.task('write', async () => {
    await $.write('./build/file.html', 'hello');
    console.log('one done');
    await $.write('F:/access/denied/file.html', 'hello');
    console.log('bye');
});
$.task('try-write', async () => {
    await $.tryWrite('./build/file.html', 'hello', true);
    console.log('one done');
    await $.tryWrite('F:/access/denied/file.html', 'hello', true);
    console.log('bye');
});

$.run('write');
// output:
// >> one done
// >> ERROR

$.run('try-write');
// output:
// >> one done
// >> bye
```

### copy
### tryCopy

### globCopy
### tryGlobCopy

### glob

### watch

### debounce

### fileExists
### dirExists
### exists

### serve