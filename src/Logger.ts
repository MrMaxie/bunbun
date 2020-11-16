import { format, inspect } from 'util';
import chalk from 'chalk';

export default class Logger {
    debugging = false;

    silent = false;

    format(template: string, ...args: any[]) {
        template = template
            .replace(/\%/g, '%%')
            .split('$$')
            .map(x => x.replace(/\$/g, '%s'))
            .join('$');

        return format(template, ...args.map(x => inspect(x, {
            colors: true,
        })));
    }

    log(template: string, ...args: any[]) {
        if (this.silent) return;
        console.log(this.format(`  ~ ${template}`, ...args));
    }

    success(template: string, ...args: any[]) {
        if (this.silent) return;
        console.log(this.format(`${chalk.green('✔ ~')} ${template}`, ...args));
    }

    error(template: string, ...args: any[]) {
        if (this.silent) return;
        console.log(this.format(`${chalk.red('✗ ~')} ${template}`, ...args));
    }

    debug(template: string, ...args: any[]) {
        if (!this.debugging || this.silent) return;
        console.log(this.format(`${chalk.blue('? ~')} ${template}`, ...args));
    }
}
