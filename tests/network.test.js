const Node = require('../dist/node');
const Network = require('../dist/network');

let node;

beforeAll(async () => {
    await new Promise((resolve) => {
        node = new Node.default(null, null, null, null, () => {
            node.endLoop();
            node.network.disconnect().then(() => {
                delete node.network;
                resolve();
            }).catch(() => {});
        });
    })
});

describe('Creating Network Classes', () => {
    test('creates a network class with no argument', () => {
        const network = new Network.default(node);
        node.network = network;
        expect(network).toBeDefined();
        expect(network.address).toBe('127.0.0.1');
        expect(network.port).toBe(50000);
    });

    test('creates a network class with only address argument', () => {
        const network = new Network.default(node, '127.0.0.2');
        node.network = network;
        expect(network).toBeDefined();
        expect(network.address).toBe('127.0.0.2');
        expect(network.port).toBe(50000);
    });

    test('creates a network class with only port argument', () => {
        const network = new Network.default(node, null, 50001);
        node.network = network;
        expect(network).toBeDefined();
        expect(network.address).toBe('127.0.0.1');
        expect(network.port).toBe(50001);
    });
});

describe('Binding Network Classes', () => {
    test('binds to the network with correct default values', async () => {
        const network = new Network.default(node);
        node.network = network;
        await network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50000 });
            })
            .catch(() => {});
    });

    test('binds to the network with correct address argument', async () => {
        const network = new Network.default(node, 'localhost');
        node.network = network;
        await network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50000 });
            })
            .catch(() => {});
    });

    test('binds to the network with correct port argument', async () => {
        const network = new Network.default(node, null, 50001);
        node.network = network;
        await network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50001 });
            })
            .catch(() => {});
    });

    test('deos not bind to the network with incorrect address argument', async () => {
        const network = new Network.default(node, '1.1.1.1');
        node.network = network;
        await network.connect().catch((error) => {
            expect(error).toBeDefined();
        });
    });

    test('deos not bind to the network with incorrect port argument', async () => {
        expect.assertions(1);
        const network = new Network.default(node, null, 22);
        node.network = network;
        await network.connect().catch((error) => {
            expect(error).toBeDefined();
        });
    });
});

describe('Destroying Network Classes', () => {
    test('destroys the network that is binded', async () => {
        expect.assertions(2);
        const network = new Network.default(node);
        node.network = network;
        await network.connect().then(() => {
            expect(network.socket.address()).toBeDefined();
        }).catch(() => {});

        await network.disconnect().then(() => {
            expect(() => network.socket.address()).toThrowError()
        }).catch(() => {});
    });
});

describe('Message Handler', () => {
    beforeEach(() => {
        const network = new Network.default(node);
        node.network = network;
    });

    test('return if rinfo is self', async () => {
        const rinfo = {
            address: '127.0.0.1',
            family: 'IPv4',
            port: 50000,
        };
        node.network.messageHandler(Buffer.from('{}'), rinfo);
    });

    test('return if rinfo is not sender - address', async () => {
        const msg = {
            sender: {
                address: '127.0.0.2',
                port: 50001,
            }
        };
        const rinfo = {
            address: '127.0.0.1',
            family: 'IPv4',
            port: 50001,
        };
        node.network.messageHandler(Buffer.from(JSON.stringify(msg)), rinfo);
    });

    test('return if rinfo is not sender - port', async () => {
        const msg = {
            sender: {
                address: '127.0.0.1',
                port: 50002,
            }
        };
        const rinfo = {
            address: '127.0.0.1',
            family: 'IPv4',
            port: 50001,
        };
        node.network.messageHandler(Buffer.from(JSON.stringify(msg)), rinfo);
    });

    test('return if reciever is not self - address', async () => {
        const msg = {
            sender: {
                address: '127.0.0.1',
                port: 50001,
            },
            receiver: {
                address: '127.0.0.2',
                port: 50000,
            },
        };
        const rinfo = {
            address: '127.0.0.1',
            family: 'IPv4',
            port: 50001,
        };
        node.network.messageHandler(Buffer.from(JSON.stringify(msg)), rinfo);
    });

    test('return if reciever is not self - port', async () => {
        const msg = {
            sender: {
                address: '127.0.0.1',
                port: 50001,
            },
            receiver: {
                address: '127.0.0.1',
                port: 50002,
            },
        };
        const rinfo = {
            address: '127.0.0.1',
            family: 'IPv4',
            port: 50001,
        };
        node.network.messageHandler(Buffer.from(JSON.stringify(msg)), rinfo);
    });
});

afterEach(async () => {
    await node.network.disconnect().catch(() => {});
    delete node.network;
    
    // Wait for socket to close
    await new Promise(resolve => setTimeout(() => resolve(), 200));
});