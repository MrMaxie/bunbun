import { EventEmitter } from 'events';

export type TaskOptions = {
    debouncePromise: boolean;
    debounceTime: number;
};

class Heap<T> extends EventEmitter {
    private _content: Array<T> = [];

    push(x: T) {
        this._content.push(x);
        this.emit('push', this._content.length);
    }

    last() {
        return this._content[this._content.length - 1];
    }

    first() {
        return this._content[0];
    }

    count() {
        return this._content.length;
    }

    isEmpty() {
        return this.count() === 0;
    }

    remove(x: T) {
        let i = this._content.length;
        while (i--) {
            if (this._content[i] === x) {
                this._content.splice(i, 1);
            }
        }
        this.emit('remove', this._content.length);
        if (this._content.length === 0) {
            this.emit('empty');
        }
    }
}

class Debounce {
    constructor(public time: number) {}

    waiting = false;

    timeout?: NodeJS.Timeout;

    isWaiting() {
        const hasWaiting = this.waiting;
        this.bump();
        return hasWaiting;
    }

    bump() {
        this.waiting = true;
        if (this.waiting && this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            this.waiting = false;
        }, this.time);
    }
}

export default class Task extends EventEmitter {
    heap = new Heap<Promise<boolean>>();

    private _debounce: Debounce;

    constructor(
        public name: string,
        public fn: () => unknown,
        public options: TaskOptions,
    ) {
        super();
        this._debounce = new Debounce(options.debounceTime);
    }

    async run(): Promise<boolean> {
        if (this.options.debounceTime > 0) {
            if (this._debounce.isWaiting()) {
                return this.heap.last();
            }
        }

        if (this.options.debouncePromise) {
            if (this.heap.count() > 1) {
                return this.heap.last();
            }

            if (this.heap.count() > 0) {
                const firstPromise = this.heap.first();

                const p: Promise<boolean> = Promise
                    .resolve()
                    .then(() => new Promise(res => {
                        firstPromise.finally(() => {
                            res();
                        });
                    }))
                    .then(() => {
                        const p2 = this._run();
                        this.heap.remove(p);
                        return p2;
                    });
                this.heap.push(p);
                return p;
            }
        }

        return this._run();
    }

    private _run() {
        this.emit('start');
        const time = Date.now();

        const p = Promise
            .resolve()
            .then(() => {
                try {
                    const res = this.fn();
                    return res;
                } catch (e) {
                    return Promise.reject(e);
                }
            })
            .then(() => {
                this.emit('success', this._toSeconds(time));
                return true;
            })
            .catch(e => {
                this.emit('fail', this._toSeconds(time), e);
                return false;
            })
            .finally(() => {
                this.heap.remove(p);
            });

        this.heap.push(p);

        return p;
    }

    private _toSeconds(time: number) {
        return Math.round((Date.now() - time) / 100) / 10;
    }
}