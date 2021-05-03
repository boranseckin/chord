import dgram from 'dgram';
import crypto from 'crypto';

import Node, { SimpleNode } from './node';
import print from './index';
import { serialize, deserialize } from './utils';

export interface NetworkInfo {
    address: string;
    port: number;
}

interface ResponsePromise {
    resolve: Function;
    reject: Function;
}

type MessageType = 'ping' | 'response' | 'message' | 'command';

interface Message {
    sender: SimpleNode;
    reciever: SimpleNode;
    type: MessageType;
    promiseId: string;
    data: any;
}

export default class Network {
    node: Node;
    socket: dgram.Socket;
    address: string;
    port: number;
    promises: { [id: string]: ResponsePromise } = {};

    /**
     * @param node A node to initialize a network class for.
     * @param address An IPv4 address for the socket.
     * @param port A port for the socket.
     */
    constructor(
        node: Node,
        address?: string,
        port?: number,
    ) {
        this.node = node;
        this.address = address || '127.0.0.1';
        this.port = port || 50000;

        // Create the socket
        this.socket = dgram.createSocket('udp4');

        // Add a message handler
        this.socket.on('message', (msg, rinfo) => this.messageHandler(msg, rinfo));
    }

    /**
     * Handles all the incoming trafic and forwards the messages to the correct methods.
     * @param msg The data of the incoming message.
     * @param rinfo Remote info for the incoming message.
     */
    async messageHandler(msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
        const message: Message = deserialize(msg);
        const {
            sender,
            reciever,
            type,
            promiseId,
            data,
        } = message;

        // Sender cannot be the current user
        if (rinfo.address === this.address && rinfo.port === this.port) return;
        if (rinfo.address !== sender.address || rinfo.port !== sender.port) return;

        // Reciever must be the current user
        if (reciever.address !== this.address || reciever.port !== this.port) return;

        if (process.env.VERBOSE) print(`[${sender.id}]: [${promiseId} - ${data?.function ? data.function : type}]`);

        let responseData: any;

        switch (type) {
        case 'ping':
            responseData = { result: true, ping: true };
            break;

        case 'message':
            print(`--> ${data.message}`);
            responseData = { result: true };
            break;

        case 'command':
            try {
                responseData = {
                    result: await this.node.execute(data.function, reciever, ...data.args),
                };
            } catch (error) {
                responseData = {
                    result: false,
                    error,
                };
            }
            break;

        case 'response':
            this.respondToPromise(promiseId, data);
            break;

        default:
            if (process.env.VERBOSE) print('Unknown message type!');
            responseData = { result: false, error: 'Unknown message type!' };
            break;
        }

        if (type !== 'response') await this.send(sender, 'response', promiseId, responseData);
    }

    /**
     * Binds this network class to the port.
     * @returns A promise that will resolve to network infromation.
     */
    async connect(): Promise<NetworkInfo> {
        return new Promise((resolve, reject) => {
            const fallback = setTimeout(() => {
                reject(new Error(`Connection timed out for this address: ${this.address}:${this.port}`));
            }, 2000);

            this.socket.bind(this.port, this.address, () => {
                clearTimeout(fallback);

                const { address, port } = this.socket.address();
                this.address = address;
                this.port = port;

                resolve({ address, port });
            });
        });
    }

    /**
     * Unbinds this network class' socket.
     */
    async disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const fallback = setTimeout(() => {
                reject(new Error('Disconnect timed out.'));
            });

            this.socket.close(() => {
                clearTimeout(fallback);
                resolve();
            });
        });
    }

    /**
     * Sends a network message to a node. To send a new message wrap this function with a
     * promise and supply the resolve/reject functions as the promise argument.
     * This method will save those functions locally and forward a promise id with the message.
     *
     * This method is also used by the message handler to respond to a previous message.
     * Upon a response, either the resolve or reject function will be called with returning data.
     * In that case, the promise id is supplied as the promise argument.
     * @param reciever A node to send the message.
     * @param type The message type: ('ping' | 'message' | 'command')
     * @param promise A promise id or a set of resolve and reject functions for a promise.
     * @param data Optional. Any data to be send with the message.
     */
    async send(
        reciever: SimpleNode,
        type: MessageType,
        promise: ResponsePromise | string,
        data?: any,
    ) {
        await new Promise<void>((resolve, reject) => {
            let outgoingPromise: string;

            if (typeof promise === 'string') {
                outgoingPromise = promise;
            } else {
                const promiseId = crypto.randomBytes(4).toString('hex');
                this.promises[promiseId] = promise;
                outgoingPromise = promiseId;
            }

            const message: Message = {
                sender: this.node.encapsulateSelf(),
                reciever,
                type,
                promiseId: outgoingPromise,
                data,
            };

            this.socket.send(
                serialize(message),
                reciever.port,
                reciever.address,
                (sendErr) => {
                    if (sendErr) reject(sendErr);
                    resolve();
                },
            );
        }).catch((error) => { print(error); });
    }

    /**
     * Used by the message handler to handle returning promises.
     * If the result does not have an error in it resolves the promise
     * otherwise, rejects it.
     * @param promiseId An id for the promise.
     * @param data A data to be supplied as the result of the promise.
     */
    respondToPromise(promiseId: string, data: any): void {
        if (!this.promises[promiseId]) return;

        if (data.result) {
            this.promises[promiseId].resolve(data.result);
        } else if (data.error) {
            this.promises[promiseId].reject(data.error);
        } else {
            this.promises[promiseId].reject(data);
        }
        delete this.promises[promiseId];
    }

    /**
     * Flushes the promise queue.
     */
    async flush(): Promise<void> {
        await new Promise<void>((resolve) => {
            Object.keys(this.promises).forEach((promise) => delete this.promises[promise]);
            resolve();
        });
    }
}
