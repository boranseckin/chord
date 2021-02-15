const Node = require('../dist/node');
const Network = require('../dist/network');

let node;
beforeAll(async () => {
    await new Promise((resolve) => {
        node = new Node.default('127.0.0.1', 50000, () => {
            node.network.disconnect().then(() => {
                delete node.network;
                resolve();
            });
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
    test('binds to the network with correct default values', (done) => {
        const network = new Network.default(node);
        node.network = network;
        network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50000 });
                done();
            })
            .catch((error) => done(error));
    });

    test('binds to the network with correct address argument', (done) => {
        const network = new Network.default(node, 'localhost');
        node.network = network;
        network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50000 });
                done();
            })
            .catch((error) => done(error));
    });

    test('binds to the network with correct port argument', (done) => {
        const network = new Network.default(node, null, 50001);
        node.network = network;
        network.connect()
            .then(() => {
                expect(network).toBeDefined();
                expect(network.socket.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port: 50001 });
                done();
            })
            .catch((error) => done(error));
    });

    test('deos not bind to the network with incorrect address argument', async () => {
        expect.assertions(1);
        const network = new Network.default(node, '127.0.0.2');
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
        });

        await network.disconnect().then(() => {
            expect(() => network.socket.address()).toThrowError()
        });
    });
});

afterEach(async () => {
    await node.network.disconnect().catch((error) => {});
    delete node.network;
    
    // Wait for socket to close
    await new Promise(resolve => setTimeout(() => resolve(), 50));
});