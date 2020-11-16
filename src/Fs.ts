import chokidar from 'chokidar';
import fse from 'fs-extra';
import fg from 'fast-glob';
import _p from 'path';
import os from 'os';
import hasha from 'hasha';

type ListOptions = {
    absolute: boolean;
    cwd: string;
    onlyDirectories: boolean;
    onlyFiles: boolean;
};

export default class Fs {
    cwd = process.cwd();

    async copy(
        source: string,
        target: string
    ): Promise<true> {
        await fse.copy(_p.resolve(this.cwd, source), _p.resolve(this.cwd, target), {
            overwrite: true,
            dereference: true,
            recursive: true,
        });
        return true;
    }

    async createDir(path: string, mode?: number): Promise<true> {
        await fse.ensureDir(_p.resolve(this.cwd, path), mode);
        return true;
    }

    async createTempDir(): Promise<string> {
        const path = await fse.mkdtemp(_p.join(os.tmpdir(), 'bunbun-'));
        return path;
    }

    async edit(
        path: string,
        fn: (data: string) => (Promise<string> | string),
    ): Promise<void> {
        await Promise.resolve()
            .then(() => this.read(path))
            .then(x => fn(x))
            .then(x => this.write(path, x));
    }

    async exists(path: string): Promise<false | 'file' | 'dir'> {
        try {
            const stats = await fse.lstat(_p.resolve(this.cwd, path));
            return stats.isDirectory() ? 'dir' : 'file';
        } catch (e) {
            return false;
        }
    }

    async hash(
        file: string,
        algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
        encoding: 'hex' | 'base64' | 'buffer' | 'latin1' = 'base64'
    ) {
        const res = await hasha.fromFile(_p.resolve(this.cwd, file), {
            algorithm,
            encoding: encoding === 'buffer' ? undefined : encoding,
        });
        return res;
    }

    async list(pattern: string | string[], options: Partial<ListOptions> = {}) {
        const _opts: ListOptions = {
            absolute: false,
            cwd: this.cwd,
            onlyDirectories: false,
            onlyFiles: false,
        };

        pattern = typeof pattern === 'string' ? [pattern] : pattern;

        pattern = pattern.map(x => x.replace(/\\/g, '/'));

        const list = await fg(pattern, Object.assign({}, _opts, options, {
            suppressErrors: true,
            throwErrorOnBrokenSymbolicLink: false,
            unique: true,
            dot: true,
        }));

        return list;
    }

    async read(path: string): Promise<string> {
        const data = await fse.readFile(_p.resolve(this.cwd, path), {
            encoding: 'utf8',
        });

        return data;
    }

    async remove(path: string): Promise<true> {
        await fse.remove(_p.resolve(this.cwd, path));
        return true;
    }

    async rename(source: string, target: string): Promise<true> {
        await fse.rename(
            _p.resolve(this.cwd, source),
            _p.resolve(this.cwd, target),
        );
        return true;
    }

    watch(pattern: string | string[], fn: () => any) {
        const watcher = chokidar.watch(pattern, {
            persistent: true,
            cwd: this.cwd,
            ignoreInitial: true,
            followSymlinks: true,
            disableGlobbing: false,
            ignorePermissionErrors: true,
        });

        watcher.on('add', () => fn());
        watcher.on('change', () => fn());
        watcher.on('unlink', () => fn());
        watcher.on('add', () => fn());
        watcher.on('addDir', () => fn());
        watcher.on('unlinkDir', () => fn());
        watcher.once('ready', () => fn());

        return () => {
            watcher.close();
        };
    }

    async write(path: string, data: string | Buffer) {
        await fse.writeFile(_p.resolve(this.cwd, path), data);
    }
}
