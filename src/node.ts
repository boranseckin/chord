/* eslint-disable no-await-in-loop */

import Network from './network';
import {
    getFingerIndex,
    hash,
    inRange,
    isNull,
    isSame,
    NULL_NODE,
    print,
} from './utils';

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

// List of functions that can be executed remotely
type Functions = (
    'getSuccessor' |
    'findSuccessor' |
    'getPredecessor' |
    'setPredecessor' |
    'findPredecessor' |
    'closestPrecedingFinger' |
    'notify'
);

export default class Node {
    id: number;
    hash: string;
    network: Network;
    predecessor: SimpleNode;
    fingerTable = new Array<TableEntry>(M);
    loop: ReturnType<typeof setInterval> | null = null;

    /**
     * @param id An identification number for the node.
     * @param address An IPv4 address for the node.
     * @param port A port for the node.
     * @param flare Optional. A node to join from into a chord network.
     * @param callback Optional. A callback function.
     */
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

    /**
     * Returns a simplified version of this node. This is used to serialize a node.
     */
    encapsulateSelf(): SimpleNode {
        return {
            id: this.id,
            hash: this.hash,
            address: this.network.address,
            port: this.network.port,
        };
    }

    /**
     * Initializes the finger table and start the stabilization loop.
     * @param flare Optional. A node to join from into a chord network.
     */
    async join(flare?: SimpleNode) {
        await this.initFingerTable(flare);
        this.startLoop();
    }

    /**
     * Initializes the finger table with by finding the intervals of each finger
     * and filling the fingers with correct nodes. If there is no flare, this node
     * must be the only node of the network so each finger is itself.
     * If there is a flare, it uses the flare to find its successor and fills the finger table.
     * @param flare Optional. A node to join from into a chord network.
     */
    async initFingerTable(flare?: SimpleNode) {
        for (let i = 0; i < M; i += 1) {
            this.fingerTable[i] = {
                interval: [getFingerIndex(this.id, (i + 1)), getFingerIndex(this.id, i + 2)],
                node: this.encapsulateSelf(),
            };
        }

        if (flare) {
            const successor = await this.findSuccessor(this.fingerTable[0].interval[0], flare);
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

    /**
     * Tries to stabilize the node if somethings goes wrong.
     * It checks the successor and the predecessor and replaces them if they
     * are not responding anymore. Also checks for a better successor and if it finds
     * a closer successor notfies it about itself.
     * This method should be called periodically to keep this node correct.
     */
    async stabilize() {
        let isSuccessorOK = await this.checkSuccessor();
        let isPredecessorOK = await this.checkPredecessor();

        // Successor is not responding, try the finger table.
        if (!isSuccessorOK) {
            // Try to find a finger that comes after the successor.
            this.fingerTable.forEach(async (finger) => {
                if (finger.node.id !== this.fingerTable[0].node.id) {
                    await this.ping(finger.node).then(() => {
                        this.fingerTable[0].node = finger.node;
                        isSuccessorOK = true;
                        print(`Successor is changed to finger ${finger.node.id}`);
                    }).catch(() => { /* Ignore this error */ });
                }
            });
        }

        // Finger table did not help.
        // If the predecessor is alive, make it the new successor.
        if (!isSuccessorOK && isPredecessorOK) {
            this.fingerTable[0].node = this.predecessor;
            isSuccessorOK = true;
            print(`Successor is changed to predecessor ${this.predecessor.id}`);
        }

        // No one is alive, either this node lost contact with the chord
        // or this is the only node left in the chord.
        // Make this node its successor and predecessor.
        if (!isSuccessorOK && !isPredecessorOK) {
            this.fingerTable[0].node = this.encapsulateSelf();
            isSuccessorOK = true;
            this.predecessor = this.encapsulateSelf();
            isPredecessorOK = true;
            print('Successor and predecessor are changed to self');
        }

        // Successor is fine (or got replaced) at this point but the predecessor is lost.
        // Use the finger table (starting from the furthest node) to replace the predecessor.
        if (!isPredecessorOK) {
            this.fingerTable.slice().reverse().forEach(async (finger) => {
                if (finger.node.id !== this.predecessor.id) {
                    await this.ping(finger.node).then(() => {
                        this.predecessor = finger.node;
                        isPredecessorOK = true;
                        print(`Predecessor is changed to finger ${finger.node.id}`);
                    }).catch(() => { /* Ignore this error */ });
                }
            });
        }

        // Finger table did not help. Make successor the new predecessor.
        if (!isPredecessorOK) {
            this.predecessor = this.fingerTable[0].node;
            isPredecessorOK = true;
            print(`Predecessor is changed to successor ${this.fingerTable[0].node.id}`);
        }

        // At this point, both the successor and the predecessor should be fine.
        // Try to find a closer successor to stabilize the network.

        // Get the predecessor of the successor.
        const prime = await this.getPredecessor(this.fingerTable[0].node);

        // If we are the successor's predecessor, nothing has changed. Do nothing.
        if (isSame(prime, this.encapsulateSelf())) return;

        // We are not our successor's predecessor so there might be a node between us.
        await this.ping(prime)
            .then(async () => {
                // New node must be between us and our "former" successor.
                if (inRange(prime.id, this.id, this.fingerTable[0].node.id, 'none')) {
                    print(`Successor changed: ${this.fingerTable[0].node.id} -> ${prime.id}`);
                    this.fingerTable[0].node = prime;
                }
            }).catch((error) => { print(error); print('Cannot reach the new successor, not changed.', prime); });

        // If the successor is not self, notify them about us.
        // This will notify the successor whether it is changed or not.
        if (!isSame(this.fingerTable[0].node, this.encapsulateSelf())) {
            await this.notify(this.encapsulateSelf(), this.fingerTable[0].node);
        }
    }

    /**
     * Used by other nodes to notify this node that they might have a new predecessor.
     * @param node The potential predecessor node.
     * @param executer The node that will execute this command locally.
     * @returns A promise for the remote execution if any.
     */
    async notify(node: SimpleNode, executer?: SimpleNode): Promise<void> {
        if (!executer || executer.id === this.id) {
            if (inRange(node.id, this.predecessor.id, this.id, 'none')) {
                this.predecessor = node;
                print(`Notified, predecessor is changed to ${node.id}`);
            }

            return undefined;
        }

        try {
            return await this.execute('notify', executer, node);
        } catch (error) {
            // print(error);
            return undefined;
        }
    }

    /**
     * Picks a random finger table entry and tries to replace it with a closer node.
     * This function should be periodically run to fix the table of the node.
     * @param index Optional. The finger table index to fix.
     */
    async fixFingers(index?: number) {
        if (!await this.checkPredecessor()) return;

        const i = index || Math.floor(Math.random() * M);
        const node = await this.findSuccessor(this.fingerTable[i].interval[0]);
        if (this.fingerTable[i].node.id !== node.id) {
            print(`Finger Fixed: [${i}] ${this.fingerTable[i].node.id} -> ${node.id}`);
            this.fingerTable[i].node = node;
        }
    }

    /**
     * Requests a node's immediate successor.
     * If the node is self, returns the first entry of the finger table.
     * @param node A node to do the query.
     * @returns A promise that will resolve to a node.
     */
    async getSuccessor(node?: SimpleNode): Promise<SimpleNode> {
        if (!node || node.id === this.id) return this.fingerTable[0].node;

        let result: SimpleNode;

        try {
            result = await this.execute('getSuccessor', node);
        } catch (error) {
            // console.error(error);
            result = NULL_NODE;
        }

        return result;
    }

    /**
     * Finds the successor node of an id by first finding the predecessor of the id
     * and then asking for its successor. If the id in question has a node, the successor
     * will be that node.
     * @param id An id to lookup.
     * @param executer Optional. A node to execute this function remotely.
     * @returns A node.
     */
    async findSuccessor(id: number, executer?: SimpleNode): Promise<SimpleNode> {
        if (!executer || executer.id === this.id) {
            const prime = await this.findPredecessor(id);
            const primeSuccessor = await this.getSuccessor(prime);

            return primeSuccessor;
        }

        return this.execute('findSuccessor', executer, id);
    }

    /**
     * Pings the successor of the node. Used to make sure the successor is alive.
     * @returns A promise that will resolve to a boolean.
     */
    async checkSuccessor(): Promise<Boolean> {
        if (isNull(this.fingerTable[0].node)) return false;
        if (isSame(this.fingerTable[0].node, this.encapsulateSelf())) return true;

        try {
            await this.ping(this.fingerTable[0].node);
            return true;
        } catch (error) {
            // console.error(error);
            return false;
        }
    }

    /**
     * Requests a node's immediate predecessor.
     * If the node is self, returns the predecessor.
     * @param node A node to do the query.
     * @returns A promise that will resolve to a node.
     */
    async getPredecessor(node?: SimpleNode): Promise<SimpleNode> {
        if (!node || node.id === this.id) return this.predecessor;

        let result: SimpleNode;

        try {
            result = await this.execute('getPredecessor', node);
        } catch (error) {
            // console.error(error);
            result = NULL_NODE;
        }

        return result;
    }

    /**
     * Forcefully sets a node's predecessor.
     * @param node A node to replace be the predecessor.
     * @param executer A node to execute this command. If empty or self, executes locally.
     * @returns A promise of the request.
     */
    async setPredecessor(node: SimpleNode, executer?: SimpleNode): Promise<void> {
        if (!executer || executer.id === this.id) {
            this.predecessor = node;

            return undefined;
        }

        return this.execute('setPredecessor', executer, node);
    }

    /**
     * Finds the predecessor node of an id. When node executes find predecessor,
     * it contacts a series of nodes moving forward around the Chord circle towards id.
     * If node n contacts a node n'such that id falls between n' and the successor of n',
     * find predecessor is done and returns n'. Otherwise node n asks n' for
     * the node n' knows about that most closely precedes id.
     * Thus the algorithm always makes progress towards the precedessor of id.
     * @param id An id to lookup.
     * @param executer Optional. A node to execute this function remotely.
     * @returns A node.
     */
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

    /**
     * Pings the predecessor of the node. Used to make sure the predecessor is alive.
     * @returns A promise that will resolve to a boolean.
     */
    async checkPredecessor(): Promise<Boolean> {
        if (isNull(this.predecessor)) return false;
        if (isSame(this.predecessor, this.encapsulateSelf())) return true;

        try {
            await this.ping(this.predecessor);
            return true;
        } catch (error) {
            // console.error(error);
            return false;
        }
    }

    /**
     * Finds the closest node that is preceding the supplied id from the finger table.
     * @param id An id to lookup.
     * @returns A node.
     */
    closestPrecedingFinger(id: number): SimpleNode {
        for (let i = (M - 1); i >= 0; i -= 1) {
            if (inRange(this.fingerTable[i].node.id, this.id, id, 'none')) {
                return this.fingerTable[i].node;
            }
        }
        return this.encapsulateSelf();
    }

    /**
     * Sends a ping message to a node. This function is used to check if a node is alive.
     * @param target A node to send ping message.
     * @returns A promise for the request.
     */
    async ping(target: SimpleNode) {
        return new Promise((resolve, reject) => {
            if (isSame(target, this.encapsulateSelf())) resolve({ result: true, ping: true });

            const fallback = setTimeout(
                () => reject(new Error(`Ping timed out for target ${target.address}:${target.port}.`)),
                500,
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

    /**
     * Sends a text message to a node.
     * @param target A node to send a text message.
     * @param message A text message.
     * @returns A promise for the request.
     */
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

    /**
     * Remotely executes a function on a different node and returns the result as a promise.
     * Every request has a 1 second TTL, after that it will be automatically rejected.
     * @param func The name of the function to execute.
     * @param executer A node to execute the function.
     * @param args Optional. Arguments to be supplied to the function.
     * @returns A promise for the request.
     */
    async execute(func: Functions, executer: SimpleNode, ...args: any[]): Promise<any> {
        if (process.env.VERBOSE) console.log(`${func}(${args}) @ ${executer.id}`);

        if (isNull(executer)) throw new Error(`Null node cannot execute ${func}.`);

        // Forward the execution request to the correct node and return its promise
        if (executer.id !== this.id) {
            return new Promise((resolve, reject) => {
                // Every request has a TTL
                const fallback = setTimeout(
                    () => reject(new Error(`Execution of ${func} timed out for target ${executer.address}:${executer.port}.`)),
                    1000,
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
        if (func === 'notify') return this.notify(args[0]);

        return null;
    }

    /**
     * Starts the loop for periodic stabilization.
     */
    startLoop() {
        if (!this.loop) {
            this.loop = setInterval(async () => {
                await this.stabilize();
                await this.fixFingers();
            }, 2000);
        }
    }

    /**
     * Ends the loop for periodic stabilization.
     */
    endLoop() {
        if (this.loop) clearInterval(this.loop);
    }

    /**
     * Terminates the node gracefully.
     */
    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
