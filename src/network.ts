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

type MessageType = 'ping' | 'response' | 'message';

interface Message {
    sender: SimpleNode;
    reciever: SimpleNode;
    type: MessageType;
    promise: string;
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

        this.socket = dgram.createSocket('udp4');

        this.socket.on('message', (msg, rinfo) => this.messageHandler(msg, rinfo));
    }

    async messageHandler(msg: Buffer, rinfo: dgram.RemoteInfo) {
        const message: Message = deserialize(msg);
        const {
            sender,
            reciever,
            type,
            promise,
            data,
        } = message;

        if (rinfo.address === this.address && rinfo.port === this.port) return;
        if (reciever.address !== this.address || reciever.port !== this.port) return;
        if (rinfo.address !== sender.address || rinfo.port !== sender.port) return;

        console.log('------------------------------------------------');
        console.log(`[${this.node.id}] <${type} - ${promise}> from #${sender.id}`);

        let responseData: any;

        switch (type) {
        case 'ping':
            responseData = { promise: true, ping: true };
            break;

        case 'response':
            this.respondToPromise(promise, data);
            break;

        case 'message':
            console.log(`--> ${data.message}`);
            responseData = { promise: true };
            break;

        default:
            console.log('Unknown message type!');
            responseData = { promise: false, error: 'Unknown message type!' };
            break;
        }

        if (type !== 'response') await this.send(sender, 'response', promise, responseData);
        console.log('------------------------------------------------');
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

    async disconnect() {
        await new Promise((resolve) => {
            this.socket.close(resolve);
        });
    }

    async send(
        reciever: SimpleNode,
        type: MessageType,
        promise: ResponsePromise | string,
        data?: any,
    ) {
        await new Promise((resolve, reject) => {
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
                promise: outgoingPromise,
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
        });
    }

    respondToPromise(promiseId: string, data: any) {
        if (data.promise) {
            this.promises[promiseId].resolve(data);
        } else {
            this.promises[promiseId].reject(data.error);
        }
        delete this.promises[promiseId];
    }

    async flush() {
        await new Promise((resolve) => {
            Object.keys(this.promises).forEach((promise) => delete this.promises[promise]);
            resolve();
        });
    }
}
