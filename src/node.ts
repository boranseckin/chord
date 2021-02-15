import Network from './network';
import { hash } from './utils';

export interface SimpleNode {
    id: string;
    address: string;
    port: number;
}

export default class Node {
    id: string;
    network: Network;

    constructor(
        address?: string,
        port?: number,
        callback?: Function,
    ) {
        this.id = hash(`${address}:${port}`).slice(10, 18).toUpperCase();
        this.network = new Network(this, address, port);
        this.network.connect()
            .then(() => {
                if (callback) callback();
            })
            .catch((connErr) => {
                console.error(connErr);
            });
    }

    encapsulateSelf(): SimpleNode {
        return {
            id: this.id,
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

    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
