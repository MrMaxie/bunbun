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

## Plans

- [x] filesystem API
  - [x] simple methods
  - [ ] covering whole fs/fse
- [ ] tasks sharing?
- [ ] tasks context?
- [ ] better tests using virtual fs?

## Real example

<details>
  <summary>📚 Click to expand the sample code</summary>

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

</details>


## Methods

- **Bunbun**
  - tasks:
    - [run](#-run) - run registered task
    - [task](#-task) - register new task
  - filesystem:
    - ([try-](#-tryread)) [read](#-read) - read content of file as string
    - ([try-](#-trywrite)) [write](#-write) - write content into file from string
    - ([try-](#-tryreadraw)) [readRaw](#-readraw) - read content of file as buffer
    - ([try-](#-trywriteraw)) [writeRaw](#-writeraw) - write content into file from buffer
    - ([try-](#-trycopy)) [copy](#-copy) - just copy file
    - ([try-](#-tryglobcopy)) [globCopy](#-globcopy) - copy all files by glob from one directory into another
    - [glob](#-glob) - list files by glob pattern
    - [watch](#-watch) - observe files by glob pattern for any changes
    - [exists](#-exists) - check if file or directory exists and returns type: file or directory
    - [tempDir](#-tempdir) - creates temporary dir and remove it after current task
    - [tempDirClean](#-tempdirclean) - removes temp dir manually
  - utils:
    - [debounce](#-debounce) - debounce function to prevent too fast calling
    - [serve](#-serve) - serve directory as http server; create **BunbunHttpServer**
    - ([try-](#-tryexec)) [exec](#-exec) - execute command
    - [wait](#-wait) - async timeout
  - logging
    - [debug](#-debug) - enable/disable debug mode, which allows to throw errors from `try-` methods
    - [log](#-log) - almost colorized version of `console.log()`
    - [error](#-error) - same as [log](#-log) but with different color
- **BunbunHttpServer**
  - [reload](#-reload) - reload pages using injected script

> 📝 **Note** - methods with prefix `try-` do the same thing that version without that prefix but will don't throw exception, so they can be used as optional step of task, in default all `try-` methods don't show error in console nor casue break of task, you can read message of such error by enabling debug mode

### » run

Execute registered task by name

```typescript
run(name: string): void | Promise<unknown>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

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
</details>

### » task

Register new task under given name. Task can be simple function, async function or array of names of other tasks to create alias

```typescript
task(
    name: string,
    fn: () => PromiseLike<unknown> | void | unknown,
): void;

// or

task(name: string, tasks: string[]): void;
```
<details>
  <summary>📚 Click to expand the sample code</summary>

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
</details>

### » read
### » tryRead
### » readRaw
### » tryReadRaw

Reads file from given path, if reading will cause error then this method also will throw down same error. `try-` version will don't throw anything, instead of that will returns empty string/buffer

```typescript
read(file: string): Promise<string>;
// or
tryRead(file: string): Promise<string | ''>;
// or
readRaw(file: string): Promise<Buffer>;
// or
tryReadRaw(file: string): Promise<Buffer>;
```
<details>
  <summary>📚 Click to expand the sample code</summary>

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
</details>

### » write
### » tryWrite
### » writeRaw
### » tryWriteRaw

Write content (string or buffer) into file. If this action will cause any error then this method also will throw down same error. `try-` version will returns boolean if the writing was successful

```typescript
write(file: string, data: string): Promise<void>;
// or
tryWrite(file: string, data: string): Promise<boolean>;
// or
writeRaw(file: string, data: Buffer): Promise<void>;
// or
tryWriteRaw(file: string, data: Buffer): Promise<boolean>;
```
<details>
  <summary>📚 Click to expand the sample code</summary>

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
</details>

### » copy
### » tryCopy

Copy file from one place to another, doesn't move that file, instead of that opens read-write buffers. `try-` version will returns boolean if the copying was successful

```typescript
copy(source: string, target: string): Promise<void>;
// or
tryCopy(source: string, target: string): Promise<boolean>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('try-copy-logo', async () => {
    const copied = await $.tryCopy('./src/logo.png', './build/logo.png');

    // you reach this place always

    if (copied) {
        console.log('logo has been copied');
    } else {
        console.log('logo has not been copied, but we don\'t need it at all');
    }
});

$.task('copy-logo', async () => {
    $.copy('./src/logo.png', './build/logo.png');
    console.log('logo has been copied!');
    // you can't reach this place in code without success at copying
});
```

</details>

### » globCopy
### » tryGlobCopy

Copy files recursively using glob pattern

> 💕 **External config** - This method is powered by [**cpy** library](https://github.com/sindresorhus/cpy), `cpy.Options` will be provided to this library so check documentation of this library for more informations

```typescript
globCopy(
    source: string | string[],
    target: string,
    opts?: cpy.Options,
): Promise<void>;
// or
tryGlobCopy(
    source: string,
    target: string,
    opts?: cpy.Options,
): Promise<boolean>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

So for example we want to copy files with extensions png, jpg and jpeg from `./src` directory, except `logo.png` into `./build` directory. So from such files tree:

```
.
└── src/
    ├── images/
    │   ├── a.png
    │   └── b.jpg
    ├── other/
    │   └── c.jpeg
    ├── d.png
    └── logo.png
```

We want to copy into such tree:

```
.
└── build/
    ├── images/
    │   ├── a.png
    │   └── b.jpg
    ├── other/
    │   └── c.jpeg
    └── d.png
```

So we can use code from this example:

```javascript
const $ = new Bunbun;

$.task('try-copy-assets', async () => {
    const copied = await $.tryGlobCopy(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png'], './build');

    // you reach this place always

    if (copied) {
        console.log('images has been copied');
    } else {
        console.log('images has not been copied, but we don\'t need it at all');
    }
});

$.task('copy-logo', async () => {
    $.copy(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png'], './build/logo.png');
    console.log('images has been copied!');
    // you can't reach this place in code without success at copying
});
```
</details>

### » glob

List files using glob pattern

> 💕 **External config** - This method is powered by [**fast-glob** library](https://github.com/mrmlnc/fast-globy), `fastGlob.Options` will be provided to this library so check documentation of this library for more informations

```typescript
glob(
    target: string | string[],
    opts?: fastGlob.Options,
): Promise<string[]>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

If we want to get all filenames of such images:

```
.
└── src/
    ├── images/
    │   ├── a.png
    │   └── b.jpg
    ├── other/
    │   └── c.jpeg
    ├── d.png
    └── logo.png
```

We can do it in such way:

```javascript
const $ = new Bunbun;

$.task('list-assets', async () => {
    const files = await $.glob(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png']);

    /*
        files = [
            'src/images/a.png',
            'src/images/b.png',
            'src/other/c.jpeg',
            'src/d.png',
        ];
    */
});
```
</details>

### » watch

Watch all changes on files using glob pattern

> 💕 **External config** - This method is powered by [**chokidar** library](https://github.com/paulmillr/chokidar), `chokidar.WatchOptions` will be provided to this library so check documentation of this library for more informations

> ✨ **Tip** - Watch will inform about every changed file, so if you change more than one file you will get multiple messages, if you want avoid spam of execution just use [debounce](#-debounce) method

```typescript
watch(
    target: string | string[],
    fn: () => unknown,
    opts?: chokidar.WatchOptions,
): void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('watch-assets', async () => {
    $.watch(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png'], () => {
        // will be throwed EVERY time some file changed
        console.log('some image has been changed/removed/added, except logo.png that has been ignored');
    });

    // Recommended usage, dependent on destiny:
    // will be throwed EVERY time some file changed, but never will be fired multiple times
    // at the same time
    $.watch(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png'], $.debounce(() => {
        console.log('some image has been changed/removed/added, except logo.png that has been ignored');
    }));

    // or

    $.watch(['./src/**/*.{png,jpg,jpeg}','!./src/logo.png'], () => {
        $.run('debounce-task');
    });
});
```
</details>

### » exists

Check if file or directory exists

```typescript
exists(path: string): Promise<false | 'dir' | 'file'>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('check-assets', async () => {
    if ((await $.exists('./src/logo')) === 'file') {
        // logo exists and its file
    }

    if ((await $.exists('./src/logo')) === 'dir') {
        // logo exists and its directory
    }

    if ((await $.exists('./src/logo')) === false) {
        // logo does not exists
    }

    // or

    switch (await $.exists('./src/logo')) {
        case 'file':
            // file!
            break;

        case 'dir':
            // directory!
            break;

        default:
            // nothing :c
            break;
    }
});
```
</details>

### » tempDir
### » tempDirClean

Create temporary directory and removes it after current task or manually

```typescript
tempDir(
    cleanOnFinish = true, // if false then directory will don't disappear after task
): Promise<string>;

// temp directory can be removed manually using this method in any moment
tempDirClean(path: string): Promise<void>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('temp-1', async () => {
    const dir = await $.tempDir();
    // dir exists
    await $.wait(30 * 1000);

    // dir will be removed after task
});

$.task('temp-2', async () => {
    const dir = await $.tempDir(true);
    // dir exists
    await $.wait(30 * 1000);

    // dir will be don't removed after task
    await $.tempDirClean(dir);
    // dir doesn't exists
});
```
</details>

### » debounce

Avoid multiple fires of given function basing on returned promise

```typescript
debounce(fn: () => unknown | PromiseLike<unknown>): Promise<unknown>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('debounce-task', $.debounce(async () => {
    console.log('hello!');
    await longTask();
    console.log('bye!');
}));

// if we will fire this function manually multiple times, e.g:
$.run('debounce-task'); // > Ok! task will be executed
$.run('debounce-task'); // > Task will be executed after previous execution
$.run('debounce-task'); // > Task already wait for re-run, so it's ignored
$.run('debounce-task'); // > Task already wait for re-run, so it's ignored
$.run('debounce-task'); // > Task already wait for re-run, so it's ignored
$.run('debounce-task'); // > Task already wait for re-run, so it's ignored

// function can be used everywhere
const fn = $.debounce(async () => {
    await longTask();
    console.log('bye');
})

// if we will fire this function manually multiple times, e.g:
fn(); // > Ok! task will be executed
fn(); // > Task will be executed after previous execution
fn(); // > Task already wait for re-run, so it's ignored

```
</details>

### » serve

Serve directory as HTTP server

> ✨ **Tip** - Methods of returned **BunbunHttpServer** are listed with other methods in [methods](#methods) part of this file

```typescript
serve(
    directory: string, // main dir of server
    port: number, // port for hosting
    options?: {
        fallback?: string; // fallback file, default: index.html
        reload?: boolean; // if server should be reloadable, default: true
        reloadPort?: number; // port for reloading, default: 8181
    },
): BunbunHttpServer;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('serve', () => {
    $.serve('./build', 8080);
    // visit: http://localhost:8080/
});
```
</details>

### » exec
### » tryExec

Execute command in commandline

```typescript
type ExecOptions = {
    cwd?: string; // default: current cwd
    env?: { // list of enviroment values, default: current env
        [name: string]: string;
    };
    timeout?: number; // default: 0
    maxBuffer?: number; // default: 1024 * 1024
};

exec(command: string, opts?: ExecOptions): Promise<{
    stdout: Buffer;
    stderr: Buffer;
}>;
// or
tryExec(command: string, opts?: ExecOptions): Promise<{
    stdout: Buffer;
    stderr: Buffer;
}>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('exec', async () => {
    const { stdout, stderr } = await $.exec('echo test');
    // if error (NOT stderr data) will be throwed, then you can't reach this position
    console.log(stdout, stderr);
});

$.task('try-exec', () => {
    const { stdout, stderr } = await $.tryExec('echo test');
    // this place will be always reachable, at least stdout/stderr will be empty string
    console.log(stdout, stderr);
});

```
</details>

### » wait

Async timeout

```typescript
wait(ms: number): Promise<void>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('waiting', async () => {
    await longAction();
    await $.wait(3000);
    // you reach this place after longAction + 3s of waiting
    await nextLongAction();
});

```
</details>

### » log
### » error

Print colored message in console, all string and number variables will be colored

```typescript
log(text: string, ...params: any[]);
// or
error(text: string, ...params: any[]);
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.log('Hello, %s, %s', 'Bob', 10);
$.error('Bye bye, %s, %s', 'Bob', 10);

```
</details>

### » reload

Reload openned pages of server if at [creating server](#-serve) options `reload` has been turned on

```typescript
reload(): void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('serve', () => {
    const server = $.serve('./build', 8080);

    setInterval(() => {
        // pages of server will be reloaded after every 1s
        server.reload();
    }, 1000);
});

$.task('watch', () => {
    const server = $.serve('./build', 8080);

    $.watch('./build/**/*', () => {
        // pages of server will be reloaded after every change in files
        server.reload();
    });
});

```
</details>