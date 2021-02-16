import Network from './network';
import { hash } from './utils';

export interface SimpleNode {
    id: number;
    hash: string;
    address: string;
    port: number;
}

export default class Node {
    id: number;
    hash: string;
    network: Network;
    roster: SimpleNode[] = [];

    constructor(
        id?: number,
        address?: string,
        port?: number,
        callback?: Function,
    ) {
        this.id = id || 0;
        this.hash = hash(`${address}:${port}`).slice(10, 16).toUpperCase();
        this.network = new Network(this, address, port);
        this.network.connect()
            .then(() => {
                if (callback) callback();
            })
            .catch((error) => {
                throw new Error(error);
            });
    }

    encapsulateSelf(): SimpleNode {
        return {
            id: this.id,
            hash: this.hash,
            address: this.network.address,
            port: this.network.port,
        };
    }

    async ping(target: SimpleNode) {
        return new Promise((resolve, reject) => {
            const fallback = setTimeout(
                () => reject(new Error(`Ping timed out for target ${target.address}:${target.port}.`)),
                2000,
            );

            this.network.send(target, 'ping', {
                resolve: (data?: any) => {
                    clearTimeout(fallback);
                    resolve(data);
                },
                reject,
            });
        });
    }

    async message(target: SimpleNode, message: String) {
        return new Promise((resolve, reject) => {
            const fallback = setTimeout(
                () => reject(new Error(`Message timed out for target ${target.address}:${target.port}.`)),
                2000,
            );

            this.network.send(target, 'message', {
                resolve: (data?: any) => {
                    clearTimeout(fallback);
                    resolve(data);
                },
                reject,
            },
            { message });
        });
    }

    async registerTo(target: SimpleNode) {
        await new Promise((resolve, reject) => {
            const fallback = setTimeout(
                () => reject(new Error(`Register timed out for target ${target.address}:${target.port}.`)),
                2000,
            );

            this.network.send(target, 'update', {
                resolve: (data?: any) => {
                    clearTimeout(fallback);
                    resolve(data);
                },
                reject,
            },
            { update: 'add', node: this.encapsulateSelf() });
        })
            .then(() => {
                this.roster.push(target);
            })
            .catch((error) => console.error(error));
    }

    async notifyOthers(update: 'add' | 'remove', node: SimpleNode) {
        const outbound: Promise<any>[] = [];

        this.roster.forEach((target) => {
            if (target.hash === node.hash) return;

            outbound.push(new Promise((resolve, reject) => {
                this.network.send(target, 'update', { resolve, reject }, { update, node });
            }));
        });

        return Promise.all(outbound);
    }

    sync() {
        this.roster.forEach((node) => {
            this.ping(node)
                .then(() => {
                    this.notifyOthers('add', node);
                })
                .catch(() => {
                    this.notifyOthers('remove', node);
                });
        });
    }

    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
