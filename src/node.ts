/* eslint-disable no-await-in-loop */

import Network from './network';
import { getFingerIndex, hash, inRange } from './utils';

export const M = 3; // identifier length

export interface SimpleNode {
    id: number;
    hash: string;
    address: string;
    port: number;
}

interface TableEntry {
    node: SimpleNode;
    interval: [number, number];
}

type Functions = (
    'getSuccessor' |
    'findSuccessor' |
    'getPredecessor' |
    'findPredecessor' |
    'closestPrecedingFinger'
);

export default class Node {
    id: number;
    hash: string;
    network: Network;
    predecessor: SimpleNode;
    fingerTable = new Array<TableEntry>(M);

    constructor(
        id?: number,
        address?: string,
        port?: number,
        flare?: SimpleNode,
        callback?: Function,
    ) {
        this.id = id || 0;
        this.hash = hash(`${address}:${port}`).slice(10, 16).toUpperCase();
        this.network = new Network(this, address, port);

        this.predecessor = flare || this.encapsulateSelf();

        this.initFingerTable(flare);

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

    initFingerTable(flare?: SimpleNode) {
        for (let i = 0; i < M; i += 1) {
            this.fingerTable[i] = {
                interval: [getFingerIndex(this.id, (i + 1)), getFingerIndex(this.id, i + 2)],
                node: flare || this.encapsulateSelf(),
            };
        }
    }

    async execute(func: Functions, executer: SimpleNode, ...args: any[]): Promise<any> {
        console.log(`${func}(${args}) @ ${executer.id}`);

        // Forward the execution request to the correct node and return its promise
        if (executer.id !== this.id) {
            return new Promise((resolve, reject) => {
                this.network.send(executer, 'command', { resolve, reject }, { function: func, args });
            });
        }

        // Execute the command locally and return its promise
        if (func === 'findSuccessor') return this.findSuccessor(args[0]);
        if (func === 'getSuccessor') return this.getSuccessor(args[0]);
        if (func === 'findPredecessor') return this.findPredecessor(args[0]);
        if (func === 'getPredecessor') return this.getPredecessor(args[0]);
        if (func === 'closestPrecedingFinger') return this.closestPrecedingFinger(args[0]);

        return null;
    }

    async getSuccessor(node?: SimpleNode): Promise<SimpleNode> {
        if (!node || node.id === this.id) return this.fingerTable[0].node;

        return this.execute('getSuccessor', node);
    }

    async findSuccessor(id: number, executer?: SimpleNode): Promise<SimpleNode> {
        if (!executer || executer.id === this.id) {
            const prime = await this.findPredecessor(id);
            const primeSuccessor = await this.getSuccessor(prime);

            return primeSuccessor;
        }

        return this.execute('findSuccessor', executer, id);
    }

    async getPredecessor(node?: SimpleNode): Promise<SimpleNode> {
        if (!node || node.id === this.id) return this.predecessor;

        return this.execute('getPredecessor', node);
    }

    async findPredecessor(id: number): Promise<SimpleNode> {
        let prime = this.encapsulateSelf();
        let primeSuccessor = await this.getSuccessor();

        while (!inRange(id, prime.id, primeSuccessor.id, 'end')) {
            if (prime.id === primeSuccessor.id) break;

            prime = await this.execute('closestPrecedingFinger', prime, id);
            primeSuccessor = await this.execute('getSuccessor', prime);
        }

        return prime;
    }

    closestPrecedingFinger(id: number): SimpleNode {
        for (let i = (M - 1); i >= 0; i -= 1) {
            if (inRange(this.fingerTable[i].node.id, this.id, id, 'none')) {
                return this.fingerTable[i].node;
            }
        }
        return this.encapsulateSelf();
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

    // async registerTo(target: SimpleNode) {
    //     await new Promise((resolve, reject) => {
    //         const fallback = setTimeout(
    // eslint-disable-next-line max-len
    //             () => reject(new Error(`Register timed out for target ${target.address}:${target.port}.`)),
    //             2000,
    //         );

    //         this.network.send(target, 'update', {
    //             resolve: (data?: any) => {
    //                 clearTimeout(fallback);
    //                 resolve(data);
    //             },
    //             reject,
    //         },
    //         { update: 'add', node: this.encapsulateSelf() });
    //     })
    //         .then(() => {
    //             // this.roster.push(target);
    //         })
    //         .catch((error) => console.error(error));
    // }

    // async notifyOthers(update: 'add' | 'remove', node: SimpleNode) {
    //     const outbound: Promise<any>[] = [];

    //     this.roster.forEach((target) => {
    //         if (target.node.hash === node.hash) return;

    //         outbound.push(new Promise((resolve, reject) => {
    //             this.network.send(target.node, 'update', { resolve, reject }, { update, node });
    //         }));
    //     });

    //     return Promise.all(outbound);
    // }

    // sync() {
    //     this.fingerTable.forEach((entry) => {
    //         this.ping(entry.node)
    //             .then(() => {
    //                 this.notifyOthers('add', entry.node);
    //             })
    //             .catch(() => {
    //                 this.notifyOthers('remove', entry.node);
    //             });
    //     });
    // }

    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
