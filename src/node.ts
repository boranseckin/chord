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
            this.network.send(target, 'ping', { resolve, reject });
        });
    }

    async terminate() {
        console.log('Terminating the node...');
        await this.network.disconnect();
        process.exit(0);
    }
}
