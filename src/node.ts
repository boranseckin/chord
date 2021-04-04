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
    'setPredecessor' |
    'findPredecessor' |
    'closestPrecedingFinger' |
    'updateFingerTable' |
    'notify'
);

export default class Node {
    id: number;
    hash: string;
    network: Network;
    predecessor: SimpleNode;
    fingerTable = new Array<TableEntry>(M);
    loop: ReturnType<typeof setInterval> | null = null;

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

        this.network.connect()
            .then(() => {
                this.join(flare)
                    .then(() => {
                        if (callback) callback();
                    });
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

    async join(flare?: SimpleNode) {
        await this.initFingerTable(flare);
        this.startLoop();
    }

    async stabilize() {
        const prime = await this.getPredecessor(this.fingerTable[0].node);

        if (inRange(prime.id, this.id, this.fingerTable[0].node.id, 'none')) {
            console.log(`Successor changed ${this.fingerTable[0].node.id} -> ${prime.id}`);
            this.fingerTable[0].node = prime;
        }

        if (this.fingerTable[0].node.id !== this.id) {
            await this.notify(this.encapsulateSelf(), this.fingerTable[0].node);
        }
    }

    async notify(node: SimpleNode, executer?: SimpleNode): Promise<Boolean> {
        if (!executer || executer.id === this.id) {
            if (inRange(node.id, this.predecessor.id, this.id, 'none')) {
                this.predecessor = node;
            }

            return true;
        }

        return this.execute('notify', executer, node);
    }

    async fixFingers(index?: number) {
        const i = index || Math.floor(Math.random() * M);
        const node = await this.findSuccessor(this.fingerTable[i].interval[0]);
        if (this.fingerTable[i].node.id !== node.id) {
            console.log(`Finger Fixed: [${i}] ${this.fingerTable[i].node.id} -> ${node.id}`);
            this.fingerTable[i].node = node;
        }
    }

    async initFingerTable(flare?: SimpleNode) {
        for (let i = 0; i < M; i += 1) {
            this.fingerTable[i] = {
                interval: [getFingerIndex(this.id, (i + 1)), getFingerIndex(this.id, i + 2)],
                node: this.encapsulateSelf(),
            };
        }

        if (flare) {
            const successor = await this.findSuccessor(this.fingerTable[0].interval[0], flare);
            console.log(successor);
            this.predecessor = await this.getPredecessor(successor);
            this.fingerTable[0].node = successor;
            // this.setPredecessor(this.encapsulateSelf(), successor);

            for (let i = 0; i < (M - 1); i += 1) {
                if (inRange(this.fingerTable[i + 1].interval[0], this.id, this.fingerTable[i].node.id, 'start')) {
                    this.fingerTable[i + 1].node = this.fingerTable[i].node;
                } else {
                    this.fingerTable[i + 1].node = await this.findSuccessor(
                        this.fingerTable[i + 1].interval[0],
                        flare,
                    );
                }
            }
        }
    }

    async updateFingerTable(node: SimpleNode, i: number, executer?: SimpleNode): Promise<Boolean> {
        if (!executer || executer.id === this.id) {
            if (inRange(node.id, this.id, this.fingerTable[i].node.id, 'start')) {
                this.fingerTable[i].node = node;
                this.updateFingerTable(node, i, this.predecessor);
            }

            return true;
        }

        return this.execute('updateFingerTable', executer, node, i);
    }

    async updateOthers() {
        for (let i = 0; i < M; i += 1) {
            let index = this.id - (2 ** i);
            if (index < 0) index += (2 ** M);

            const prime = await this.findPredecessor(index);
            this.updateFingerTable(this.encapsulateSelf(), i, prime);
        }
    }

    async execute(func: Functions, executer: SimpleNode, ...args: any[]): Promise<any> {
        // console.log(`${func}(${args}) @ ${executer.id}`);

        // Forward the execution request to the correct node and return its promise
        if (executer.id !== this.id) {
            return new Promise((resolve, reject) => {
                const fallback = setTimeout(
                    () => reject(new Error(`Execution of ${func} timed out for target ${executer.address}:${executer.port}.`)),
                    2000,
                );

                this.network.send(executer, 'command', {
                    resolve: (data?: any) => {
                        clearTimeout(fallback);
                        resolve(data);
                    },
                    reject,
                }, { function: func, args });
            });
        }

        // Execute the command locally and return its promise
        if (func === 'findSuccessor') return this.findSuccessor(args[0]);
        if (func === 'getSuccessor') return this.getSuccessor(args[0]);
        if (func === 'findPredecessor') return this.findPredecessor(args[0]);
        if (func === 'getPredecessor') return this.getPredecessor(args[0]);
        if (func === 'setPredecessor') return this.setPredecessor(args[0]);
        if (func === 'closestPrecedingFinger') return this.closestPrecedingFinger(args[0]);
        if (func === 'updateFingerTable') return this.updateFingerTable(args[0], args[1]);
        if (func === 'notify') return this.notify(args[0]);

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

    async setPredecessor(node: SimpleNode, executer?: SimpleNode): Promise<Boolean> {
        if (!executer || executer.id === this.id) {
            this.predecessor = node;
            return true;
        }

        return this.execute('setPredecessor', executer, node);
    }

    async findPredecessor(id: number, executer?: SimpleNode): Promise<SimpleNode> {
        if (!executer || executer.id === this.id) {
            let prime = this.encapsulateSelf();
            let primeSuccessor = await this.getSuccessor();

            while (!inRange(id, prime.id, primeSuccessor.id, 'end')) {
                if (prime.id === primeSuccessor.id) break;

                prime = await this.execute('closestPrecedingFinger', prime, id);
                primeSuccessor = await this.execute('getSuccessor', prime);
            }

            return prime;
        }

        return this.execute('findPredecessor', executer, id);
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

    startLoop() {
        if (!this.loop) {
            this.loop = setInterval(async () => {
                await this.stabilize();
                await this.fixFingers();
            }, 1000);
        }
    }

    endLoop() {
        if (this.loop) clearInterval(this.loop);
    }

    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
