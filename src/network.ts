import dgram from 'dgram';
import crypto from 'crypto';

import Node, { SimpleNode } from './node';
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

    async messageHandler(msg: Buffer, rinfo: dgram.RemoteInfo) {
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

        if (process.env.VERBOSE) console.log(`[${this.node.id}] <${type} - ${promiseId}> from #${sender.id}`);

        let responseData: any;

        switch (type) {
        case 'ping':
            responseData = { result: true, ping: true };
            break;

        case 'message':
            if (process.env.VERBOSE) console.log(`--> ${data.message}`);
            responseData = { result: true };
            break;

        case 'command':
            responseData = {
                result: await this.node.execute(data.function, reciever, ...data.args),
            };
            break;

        case 'response':
            this.respondToPromise(promiseId, data);
            break;

        default:
            if (process.env.VERBOSE) console.log('Unknown message type!');
            responseData = { result: false, error: 'Unknown message type!' };
            break;
        }

        if (type !== 'response') await this.send(sender, 'response', promiseId, responseData);
    }

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
        }).catch((error) => console.error(error));
    }

    respondToPromise(promiseId: string, data: any) {
        if (data.result) {
            this.promises[promiseId].resolve(data.result);
        } else if (data.error) {
            this.promises[promiseId].reject(data.error);
        } else {
            this.promises[promiseId].reject(data);
        }
        delete this.promises[promiseId];
    }

    async flush(): Promise<void> {
        await new Promise<void>((resolve) => {
            Object.keys(this.promises).forEach((promise) => delete this.promises[promise]);
            resolve();
        });
    }
}
