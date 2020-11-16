# bunbun

Node.JS based simple, lightweight task bunner... I mean runner

<p align="center">
  <img src="bunbun.png" />
</p>

## Why?

⏱ **Lightweight and very fast** - very simple in design, without any library compilers that you will never use, just plain task runner

📐 **Ready to use** - just add to your project, create file and prepare your first task

🔌 **Extendable** - "extends-by-code" philosophy - you are owner of your build flow, without any magic and invisible parts/configurations etc., neither no compilers included

✨ **Universal** - this library contains **only** language/tool/framework agnostic tools, all compilations/copying things are in your hands

🎈 **Without magic** - all of your tasks are just JS code, without any configs, 3rd-party plugins etc. just plain source code, therefore the learning curve is very low

🐞 **Debuggable** - debugging is very simple because none of all tasks are done invisibly underhood, it's easy to find erroring part if you see all steps of build process, also you can enable debugging mode in Bunbun to log all things

🧰 **Safe versioning** - version of Bunbun will never break any of building processes because Bunbun don't conains any API for them, updating Bunbun will need from you only update your building script - it's all, you will never have to wait for a some plugin to be updated

## Requirements

- `Node.JS >= 7.6v`
    - ...because of default support of async/await syntax
- or `Node.JS >= 10v`
    - ...for execution and handling processes
- `NPM`

## How to install?

Simplest way is just using npm:

```bash
npm install --save-exact --save-dev bunbun
```

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


## Table of Contents

- [`class Bunbun`](#class-bunbun)
    - [`fs`](#class-bunbun--fs) - filesystem API
    - [`logger`](#class-bunbun--logger) - logger API
    - [`alias()`](#class-bunbun--alias) - regiser alias of multiple tasks
    - [`debounce()`](#class-bunbun--debounce) - allows to debounce by promise and time
    - [`exec()`](#class-bunbun--exec) - execute terminal command
    - [`hash()`](#class-bunbun--hash) - hash given file
    - [`rescue()`](#class-bunbun--rescue) - catch exception making result optional
    - [`run()`](#class-bunbun--run) - run registered task
    - [`start()`](#class-bunbun--start) - run tasks by `process.argv`
    - [`serve()`](#class-bunbun--serve) - create new http server
    - [`task()`](#class-bunbun--task) - register new task
    - [`until()`](#class-bunbun--until) - waits until task has been done
    - [`wait()`](#class-bunbun--wait) - `setTimeout` but in `await`/`async` convention
- [`class Logger`](#class-logger)
    - [`debugging`](#class-logger--debugging) - determine if logger have to be louder
    - [`silent`](#class-logger--silent) - determine if logger have to log nothing
    - [`debug()`](#class-logger--debug) - debug log
    - [`error()`](#class-logger--error) - error log
    - [`format()`](#class-logger--format) - prepare message before log
    - [`log()`](#class-logger--log) - basic log
    - [`success()`](#class-logger--success) - success log
- [`class Fs`](#class-fs)
    - [`cwd`](#class-fs--cwd) - current working directory
    - [`copy()`](#class-fs--copy) - copy (also recursive and glob option) files/dirs
    - [`createDir()`](#class-fs--createdir) - create dir
    - [`createTempDir()`](#class-fs--createtempdir) - create unique temporary dir
    - [`edit()`](#class-fs--edit) - reads and writes back file
    - [`exists()`](#class-fs--exists) - check whenever file/dir exists and returns type
    - [`hash()`](#class-fs--hash) - hash given file
    - [`list()`](#class-fs--list) - list files/dirs
    - [`read()`](#class-fs--read) - reads data from file
    - [`remove()`](#class-fs--remove) - removes file/dir
    - [`rename()`](#class-fs--rename) - renames (also moves) file/dir
    - [`watch()`](#class-fs--watch) - watches files/dirs for changes
    - [`write()`](#class-fs--write) - writes data into file
- [`class HttpServer`](#class-httpserver)
    - [`reload()`](#class-httpserver--reload) - reloads all html pages

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun"><code>class Bunbun</code></h3>

Main class of whole script, it's also default exported thing from module

```typescript
type Options = {
    // Determines if logger should be louder by default
    debugging: boolean; // default: false

    // Determines if logger should be silent by default
    // this option has higher priority than `debugging`
    silent: boolean; // default: false

    // Determines if tasks should wait for previous promise by default
    debouncePromise: boolean; // default: true

    // Determines if tasks should debounce and with what time by default
    // 0 means turn off
    debounceTime: number; // default: 200

    // Current working directory for fs/exec etc.
    cwd: string; // default: process.cwd()
};

type Bunbun = {
    new(options?: Partial<Options>);
    // ...
};
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const Bunbun = require('bunbun');

// Debugging instance
const $1 = new Bunbun({
    debugging: true,
});

// Default instance
const $2 = new Bunbun();
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--fs"><code>bunbun.fs</code></h3>

[`Fs`](#class-fs) (filesystem) instance available for external usage

```typescript
fs: Fs;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.fs.read('./file.txt').then(data => {
    // ...
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--logger"><code>bunbun.logger</code></h3>

[`Logger`](#class-logger) instance used by Bunbun and available for external usage as well

```typescript
logger: Logger;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

const myVar = { test: 1 };

$.logger.log('my var = $$', myVar);
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--alias"><code>bunbun.alias()</code></h3>

Registers alias of tasks, those tasks will be executed asynchronously. Name of such alias will be in same pool where tasks are so you can't register task of same name which already exists

```typescript
alias(
    name: string,
    tasks: string[],
): void;
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

$.alias('baz', ['bar', 'foo']);
// is equal to
$.task('qux', async () => {
    return Promise.all([
        $.run('bar'),
        $.run('foo'),
    ]);
});

$.run('baz'); // or $.run('qux');
// output:
// >> foo
// >> bar (because it's waited for long running function)
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--debounce"><code>bunbun.debounce()</code></h3>

Creates debounce function of given function, this kind of function allows you avoid multiple calls of time-critical functions, e.g:
- To avoid overloop building process for same code
- To avoid overwriting things at overwriting they in previous call

> 💡 **Tip** - time debouncing don't call function until given timeout, promise debouncing call function and wait for fulfilling last promise

```typescript
debounce<T>(
    fn: () => Promise<T> | T,
    time: number = 0,
): Promise<T>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

// Not working debounce (without promise nor time)
let i1 = 0;
const fnNothing = $.debounce(() => {
    console.log('1', i1 += 1);
});
// Promise based debounce
let i2 = 0;
const fnPromise = $.debounce(() => {
    new Promise(res => setTimeout(() => {
        console.log('2', i2 += 1);
        res();
    }, 10 * 1000))
});
// Time based debounce
let i3 = 0;
const fnTime = $.debounce(() => {
    console.log('3', i3 += 1);
}, 10 * 1000);
// Promise and time based debounce
let i4 = 0;
const fnPromiseAndTime = $.debounce(() =>
    new Promise(res => setTimeout(() => {
        console.log('4', i4 += 1);
        res();
    }, 9 * 1000))
, 9 * 1000);

// --- results ---

fnNothing(); // > 1
fnNothing(); // > 2
fnNothing(); // > 3
fnNothing(); // > 4

fnPromise(); // > wait for promise > 1
// after 5s
fnPromise(); // > wait for previous result > 1
// after 5s
fnPromise(); // > wait for new promise > 2
// after 10s
fnPromise(); // > wait for new promise > 3

fnTime(); // > wait for timeout > 1
// after 5s
fnTime(); // > wait for previous timeout > 1
// after 5s
fnTime(); // > wait for new timeout > 2
// after 10s
fnTime(); // > wait for new timeout > 3

fnPromiseAndTime(); // > wait for timeout > wait for promise > 1
// after 5s
fnPromiseAndTime(); // > wait for previous timeout > wait for previous promise > 1
// after 5s
fnPromiseAndTime(); // > wait for previous promise > 1
// after 10s
fnPromiseAndTime(); // > wait for new timeout > wait for new promise > 2
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--exec"><code>bunbun.exec()</code></h3>

Allows you to execute command in shell and wait for result

> 💡 **Tip** - if timeout is equal or less than 0 then timeout will don't be turned on

```typescript
exec(
    command: string,
    timeout: number = 0,
): Promise<{
    stdout: string;
    stderr: string;
}>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.exec('node -v').then(({ stdout }) => {
    console.log(stdout);
});

// or

$.task('node-v', async () => {
    const { stdout } = await $.exec('node -v');
    console.log(stdout);
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--hash"><code>bunbun.hash()</code></h3>

Hash given string

```typescript
hash(
    text: string,
    algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
    encoding: 'hex' | 'base64' | 'buffer' | 'latin1' = 'base64'
): Promise<string>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.hash('test').then(hash => console.log(hash));
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--rescue"><code>bunbun.rescue()</code></h3>

Allows catch promise and keep `async`/`await` syntax

> 💡 **Tip** - be careful and never call (`await `)`rescue(await someFunc())` because this `someFunc()` will throw in higher, current context instead of `rescue`'s context, instead of that call `await rescue(someFunc())`

> 🎈 **Fun fact** - in Ruby language `rescue` keyword is used instead of typical `catch` keyword - that's why Bunbun use this name in this context

```typescript
rescue<T1, T2>(
    promise: Promise<T1> | T1,
    alter?: T2,
): Promise<T1 | T2>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

const justReject = async () => {
    throw 'wowie, such error';
};

const dontReject = async () => 'ok!';

$.task('test-1', async () => {
    const error = await $.rescue(justReject());
    console.log(error); // > 'wowie, such error'
});

$.task('test-2', async () => {
    const error = await $.rescue(await justReject());
    // unreachable code because `justReject` is executed
    // in current context!
});

$.task('test-3', async () => {
    const ok = await $.rescue(dontReject());
    console.log(ok); // > 'ok!'
});

$.task('test-4', async () => {
    const ok = await $.rescue('ok!');
    console.log(ok); // > 'ok!'
});

$.task('test-5', async () => {
    const alternativeValue = await $.rescue(justReject(), 'ok!');
    console.log(alternativeValue); // > 'ok!'
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--run"><code>bunbun.run()</code></h3>

Run single task by name and returns promise of call of this task

> 💡 **Tip** - if task with such name will be unable to found then this function will throw `false`

```typescript
run(name: string): Promise<boolean>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('reject', async () => {
    throw 'oh no!';
});

$.task('resolve', async () => {
    return 'ok!';
});

$.task('test', async () => {
    // try run task
    await $.rescue($.run('reject'));
    console.log(
        await $.rescue($.run('reject')
    ); // > 'oh no!'
    console.log(
        await $.rescue($.run('?')
    ); // > false
    console.log(
        await $.rescue($.run('resolve')
    ); // > true
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--start"><code>bunbun.start()</code></h3>

Similar to [`bunbun.run()`](#class-bunbun--run) but instead of running single task allows run multiple tasks, with single fallback task. This function will don't throw at error (only log it)

> 💡 **Tip** - this function is created mainly for using as main method

```typescript
start(
    defaultTask: string = 'default',
    tasks: string[] = process.argv.slice(2),
): Promise<void>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('reject', async () => {
    throw 'oh no!';
});

$.task('resolve', async () => {
    return 'ok!';
});

$.start(); // run 'default' task or given names from terminal
// or
$.start('resolve'); // run 'resolve' task or given names from terminal
// or
$.start(
    'resolve',
    ['resolve', 'reject'],
); // run always 'resolve' and 'reject'
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--serve"><code>bunbun.serve()</code></h3>

Creates new instance of [`class HttpServer`](#class-httpserver)

```typescript
type Options = {
    fallback: string = './index.html',,
    reload: boolean = true,
    reloadPort: number = 8181,
};

serve(
    directory: string,
    port: number,
    options?: Partial<Options>,
): HttpServer;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

const server = $.serve('build', 8080);

// after some action you can force reload of pages
server.reload();
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--task"><code>bunbun.task()</code></h3>

Register new task under given name. Task can be simple function or async function if needed

> 💡 **Tip** - if you cannot use `async`/`await` syntax then returning `Promise` instance will give same effect

```typescript
task(
    name: string,
    fn: () => unknown,
): void;
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
$.task('baz', async () => {
    await $.run('foo');
    await $.run('bar');
});
$.task('qux', async () => {
    await $.run('bar');
    await $.run('foo');,
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

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--until"><code>bunbun.until()</code></h3>

Waits until given task has been completed, it doesn't matter if it ended successfully, throws if task has been not found

```typescript
until(name: string): Promise<boolean>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('long', async () => {
    await $.wait(1500);
});
$.task('run-and-wait', async () => {
    $.run('long');
    await $.until('long');
    // waits until 'long' ended
    await $.until('long');
    // pass immediately because 'long' is not running
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-bunbun--wait"><code>bunbun.wait()</code></h3>

`setTimeout()` alternative for `async`/`await` syntax

```typescript
wait(time: number): Promise<void>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.task('long', async () => {
    console.log('wait moment');
    await $.wait(1500);
    console.log('hello again');
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-logger"><code>class Logger</code></h3>

Class prepared for logging purposes. Logger is already constructed with [`class Bunbun`](#class-bunbun) with default settings

```typescript
type Logger = {
    new();
    // ...
};
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();
$.logger; // here you are
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-logger--debugging"><code>logger.debugging</code></h3>

Determines if logger should log more useful data for debugging purposes

```typescript
debugging: boolean = false;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();
$.logger.debugging = true;
// Now bunbun will throw more logs
$.logger.debugging = false;
// Now bunbun will don't throw so much data
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-logger--silent"><code>logger.silent</code></h3>

Determines if logger should be silent

```typescript
silent: boolean = false;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();
$.logger.silent = true;
// Now bunbun will be silent
$.logger.silent = false;
// Now bunbun will be loud
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-logger--debug"><code>logger.debug()</code></h3>
<h3 id="class-logger--error"><code>logger.error()</code></h3>
<h3 id="class-logger--log"><code>logger.log()</code></h3>
<h3 id="class-logger--success"><code>logger.success()</code></h3>

Using [`logger.format()`](#class-logger--format) function to colorize data, adds prefix and log given thing. Nothing will be logged if [`logger.silent`](#class-logger--silent) is true. `logger.debug()` will log things only if [`logger.debugging`](#class-logger--debugging) is true

```typescript
debug(template: string, ...args: any[]): void;
// or
error(template: string, ...args: any[]): void;
// or
log(template: string, ...args: any[]): void;
// or
success(template: string, ...args: any[]): void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.logger.debug('my var = $$', 10);
// logs only if 'logger.debugging' is equal to 'true'
// > '? ~ my var = 10'

$.logger.error('my var = $$', 10);
// > '✗ ~ my var = 10'

$.logger.log('my var = $$', 10);
// > '  ~ my var = 10'

$.logger.success('my var = $$', 10);
// > '✔ ~ my var = 10'
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-logger--format"><code>logger.format()</code></h3>

Format given template using built-in Node's functions, but uses `$$` as placeholder for any type of variable

```typescript
format(template: string, ...args: any[]): string;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

console.log(
    $.logger.format(
        '1.$$\n2.$$\n3.$$',
        10,
        'test',
        { test: 10 },
    )
);
// > output:
// 1.10
// 2.'test'
// 3.{ test: 10 }
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs"><code>class Fs</code></h3>

Class prepared for filesystem manipulations or fetching data purposes. Fs is already constructed with [`class Bunbun`](#class-bunbun) with default settings

```typescript
type Fs = {
    new();
    // ...
};
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();
$.fs; // here you are
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--cwd"><code>fs.cwd</code></h3>

Current working directory for all methods of [`class Fs`](#class-fs)

```typescript
cwd: string = process.cwd();
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();
$.fs.cwd === process.cwd(); // > true
$.fs.cwd = 'C:/src'; // now all methods starts from "C:/src"
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--copy"><code>fs.copy()</code></h3>

Copy single file or whole dir (recursively), returns `true` if done without any errors, errors will be throwed as exception

```typescript
copy(
    source: string,
    target: string
): Promise<true>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('maybe-copy-file', async () => {
    const res = await $.rescue(
        $.fs.copy('file.txt', 'second-file.txt'),
        false
    );

    if (res) {
        // file has been copied
    } else {
        // file has NOT been copied
    }
});

$.task('swallow-copy-file', async () => {
    await $.rescue($.fs.copy('file.txt', 'second-file.txt'));
    // nobody cares if file has been copied
});

$.task('force-copy-file', async () => {
    await $.fs.copy('file.txt', 'second-file.txt');
    // unreachable without successful copying file
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--createdir"><code>fs.createDir()</code></h3>

If any directory in tree does not exists then they will be created - otherwise nothing will be created

```typescript
createDir(
    path: string,
    mode?: number // e.g 0o776
): Promise<true>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('maybe-create-dir', async () => {
    const res = await $.rescue(
        $.fs.createDir('test/test/test'),
        false
    );

    if (res) {
        // dir is prepared
    } else {
        // dir isn't prepared for some reason
    }
});

$.task('swallow-create-dir', async () => {
    await $.rescue($.fs.createDir('test/test/test'));
    // nobody cares if dir exists
});

$.task('force-create-dir', async () => {
    await $.fs.createDir('file.txt', 'second-file.txt');
    // unreachable without successful dir creating or check if exists
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--createtempdir"><code>fs.createTempDir()</code></h3>

Creates dir in temporary directory of your operating system, those directories are often cleared

```typescript
createTempDir(): Promise<string>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('temp-dir', async () => {
    const dir = await $.fs.createTempDir();
    // "dir" variable contains temporary directory path
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--edit"><code>fs.edit()</code></h3>

Allows seamlessly edit content of file

```typescript
edit(
    path: string,
    fn: (data: string) => (Promise<string> | string)
): Promise<void>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('edit-file', async () => {
    await $.fs.edit(
        'test.txt',
        data => data.replace('$$', 'USD')
    );
    // file has been edited
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--exists"><code>fs.exists()</code></h3>

Check if given path exists and if so, returns type of given path

```typescript
exists(path: string): Promise<false | 'file' | 'dir'>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('check-path', async () => {
    const type = await $.fs.exists('test');

    switch (type) {
        case false:
            // does not exists
            break;

        case 'file':
            // path is file
            break;

        case 'dir':
            // path is directory
            break;
    }
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--hash"><code>fs.hash()</code></h3>

Hash given file

```typescript
hash(
    file: string,
    algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
    encoding: 'hex' | 'base64' | 'buffer' | 'latin1' = 'base64'
): Promise<string>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```javascript
const $ = new Bunbun;

$.fs.hash('test.txt').then(hash => console.log(hash));
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--list"><code>fs.list()</code></h3>

Returns list of files matching given pattern

```typescript
type ListOptions = {
    absolute: boolean = false,
    cwd: string = fs.cwd,
    onlyDirectories: boolean = false,
    onlyFiles: boolean = false,
};

exists(
    pattern: string | string[],
    options: Partial<ListOptions> = {}
): Promise<string[]>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('assets-files', async () => {
    const images = await $.fs.list([
        './src/**/*.(png|jpg)',
        '!./src/**/*.raw.png'
    ]);

    // images is array of matching paths
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--read"><code>fs.read()</code></h3>

Reads content of file as string

```typescript
read(path: string): Promise<string>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('read-files', async () => {
    const text = await $.fs.read('package.json');
    // text is package.json content
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--remove"><code>fs.remove()</code></h3>

Removes given file or dir

```typescript
remove(path: string): Promise<true>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('remove-file', async () => {
    const text = await $.fs.remove('package.json');
    // package.json is removed here
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--remove"><code>fs.rename()</code></h3>

Renames given file or dir

```typescript
rename(source: string, target: string): Promise<true>;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.task('rename-file', async () => {
    await $.fs.rename('package.json', 'package.json.bak');
    // package.json is renamed here
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--watch"><code>fs.watch()</code></h3>

Watches given files which matches given paths and returns disposer, every time any matching file has been changed, removed or added then given function will be executed, also after initial scanning function is executed once

```typescript
watch(
    pattern: string | string[],
    fn: () => any
): () => void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.fs.watch('./src/**/*.js', () => {
    console.log('some file has been changed!');
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-fs--write"><code>fs.write()</code></h3>

Writes given content into file

```typescript
watch(
    path: string,
    data: string | Buffer
): void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun();

$.fs.write('test.txt').then(() => {
    console.log('DONE!');
});
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-httpserver"><code>class HttpServer</code></h3>

Can be created via [`bunbun.serve()`](#class-bunbun--serve)

```typescript
type HttpServer = {
    new();
    // ...
};
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun;

const server = $.serve('build', 8080); // here you are
```
</details>

<!------------------------------------------------------------------------------------------------------------->

<h3 id="class-httpserver--reload"><code>httpserver.reload()</code></h3>

Reloads all pages with injected reloading script if turned on at creating

```typescript
reload(): void;
```

<details>
  <summary>📚 Click to expand the sample code</summary>

```typescript
const $ = new Bunbun;

const server = $.serve('build', 8080);

// after some change you can ask for reload pages:
server.reload();
```
</details>