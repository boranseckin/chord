const Node = require('../dist/node');
const Utils = require('../dist/utils');

let xNode, yNode;

jest.setTimeout(20000);

test('creates a Node with default arguments', (done) => {
    expect.assertions(4);

    xNode = new Node.default(undefined, undefined, undefined, undefined, () => {
        expect(xNode.id).toBe(0);
        expect(xNode.hash).toBe('F04F1F');
        expect(xNode.network.address).toBe('127.0.0.1');
        expect(xNode.network.port).toBe(50000);
        done();
    });
});

test('creates a Node with default arguments and a flare', (done) => {
    expect.assertions(6);

    yNode = new Node.default(1, undefined, 50001, xNode.encapsulateSelf(), () => {
        setTimeout(() => {
            expect(yNode.id).toBe(1);
            expect(yNode.hash).toBe('A69757');
            expect(yNode.network.address).toBe('127.0.0.1');
            expect(yNode.network.port).toBe(50001);
            expect(yNode.predecessor).toStrictEqual(xNode.encapsulateSelf());
            expect(xNode.fingerTable[0].node).toStrictEqual(yNode.encapsulateSelf());
            done();
        }, 5000);
    });
});

test('function encapsulateSelf', () => {
    expect(xNode.encapsulateSelf()).toStrictEqual({
        id: xNode.id,
        hash: xNode.hash,
        address: xNode.network.address,
        port: xNode.network.port,
    });
});

test('function fixFingers', async () => {
    xNode.fingerTable[2].node = yNode.encapsulateSelf();
    await xNode.fixFingers(2)
    await xNode.fixFingers(-1);
    await xNode.fixFingers(5);
    
    expect(xNode.fingerTable[2].node).toStrictEqual(xNode.encapsulateSelf());
});

test('function checkSuccessor', async () => {
    expect.assertions(3);

    expect(await xNode.checkSuccessor()).toBeTruthy();

    xNode.fingerTable[0].node = Utils.NULL_NODE;
    expect(await xNode.checkSuccessor()).toBeFalsy();
    
    xNode.fingerTable[0].node = { id: 4, hash: 'FFFFFF', address: '1.1.1.1', port: 0};
    expect(await xNode.checkSuccessor()).toBeFalsy();

    xNode.fingerTable[0].node = yNode.encapsulateSelf();
});

test('function checkPredecessor', async () => {
    expect.assertions(3);

    expect(await xNode.checkPredecessor()).toBeTruthy();
    
    xNode.predecessor = Utils.NULL_NODE;
    expect(await xNode.checkPredecessor()).toBeFalsy();
    
    xNode.predecessor = { id: 4, hash: 'FFFFFF', address: '1.1.1.1', port: 0};
    expect(await xNode.checkPredecessor()).toBeFalsy();
    
    xNode.predecessor = yNode.encapsulateSelf();
});

test('function execute', async () => {
    expect.assertions(4);
    
    try {
        await xNode.execute('none', xNode.encapsulateSelf())
    } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBe('Unkown command.');
    }

    await xNode.execute('getInfo', Utils.NULL_NODE).catch((error) => {
        expect(error).toBeDefined();
        expect(error.message).toBe('Null node cannot execute getInfo.');
    });

});

test('function ping', async () => {
    expect.assertions(2);
    expect(await xNode.ping(yNode.encapsulateSelf())).toBeTruthy();
    expect(await xNode.ping(xNode.encapsulateSelf())).toBeTruthy();
});

test('function message', async () => {
    expect.assertions(3);

    expect(async () => {
        await xNode.message(yNode.encapsulateSelf(), 'hello')
    }).not.toThrowError();

    await xNode.message(Utils.NULL_NODE, 'hello').catch((error) => {
        expect(error).toBeDefined();
        expect(error.message).toBe('Message timed out for target 0.0.0.0:0.');
    });
});

test('function closestPrecedingFinger', () => {
    expect.assertions(2);
    expect(xNode.closestPrecedingFinger(xNode.id)).toStrictEqual(yNode.encapsulateSelf());
    expect(xNode.closestPrecedingFinger(xNode.id + 1)).toStrictEqual(xNode.encapsulateSelf());
});

describe('function getInfo', () => {
    test('local', () => {
        expect(xNode.getInfo()).toStrictEqual({
            node: xNode.encapsulateSelf(),
            pre: xNode.predecessor,
            suc: xNode.fingerTable[0].node,
            finger: xNode.fingerTable,
        });
    });

    test('remote', async () => {
        expect(await xNode.execute('getInfo', yNode.encapsulateSelf())).toStrictEqual({
            node: yNode.encapsulateSelf(),
            pre: yNode.predecessor,
            suc: yNode.fingerTable[0].node,
            finger: yNode.fingerTable,
        });
    });
});

describe('function getSuccessor', () => {
    test('local', async () => {
        expect.assertions(2);
        expect(await xNode.getSuccessor()).toStrictEqual(yNode.encapsulateSelf());
        const a = await xNode.getSuccessor({ id: -1, hash: 'FFFFFF', address: '127.0.0.1', port: 55});
        expect(a).toStrictEqual(Utils.NULL_NODE);
    });
    
    test('remote', async () => {
        expect(await xNode.getSuccessor(yNode.encapsulateSelf())).toStrictEqual(xNode.encapsulateSelf());
        
    });
})

describe('function getPredecessor', () => {
    test('local', async () => {
        expect.assertions(2);
        expect(await xNode.getPredecessor()).toStrictEqual(yNode.encapsulateSelf());
        const a = await xNode.getPredecessor({ id: -1, hash: 'FFFFFF', address: '127.0.0.1', port: 55});
        expect(a).toStrictEqual(Utils.NULL_NODE);
    });
    
    test('remote', async () => {
        expect(await xNode.getPredecessor(yNode.encapsulateSelf())).toStrictEqual(xNode.encapsulateSelf());
    });
})

describe('function findSuccessor', () => {
    test('local', async () => {
        expect.assertions(3);
        expect(await xNode.findSuccessor(xNode.id)).toStrictEqual(xNode.encapsulateSelf());
        expect(await xNode.findSuccessor(yNode.id)).toStrictEqual(yNode.encapsulateSelf());
        expect(await xNode.findSuccessor(5)).toStrictEqual(xNode.encapsulateSelf());
    });
    
    test('remote', async () => {
        expect.assertions(3);
        expect(await xNode.findSuccessor(xNode.id, yNode.encapsulateSelf())).toStrictEqual(xNode.encapsulateSelf());
        expect(await xNode.findSuccessor(yNode.id, yNode.encapsulateSelf())).toStrictEqual(yNode.encapsulateSelf());
        expect(await xNode.findSuccessor(5, yNode.encapsulateSelf())).toStrictEqual(xNode.encapsulateSelf());
    });
});

describe('function findPredecessor', () => {
    test('local', async () => {
        expect.assertions(3);
        expect(await xNode.findPredecessor(xNode.id)).toStrictEqual(yNode.encapsulateSelf());
        expect(await xNode.findPredecessor(yNode.id)).toStrictEqual(xNode.encapsulateSelf());
        expect(await xNode.findPredecessor(5)).toStrictEqual(yNode.encapsulateSelf());
    });
    
    test('remote', async () => {
        expect.assertions(3);
        expect(await xNode.findPredecessor(xNode.id, yNode.encapsulateSelf())).toStrictEqual(yNode.encapsulateSelf());
        expect(await xNode.findPredecessor(yNode.id, yNode.encapsulateSelf())).toStrictEqual(xNode.encapsulateSelf());
        expect(await xNode.findPredecessor(5, yNode.encapsulateSelf())).toStrictEqual(yNode.encapsulateSelf());
    });
});

describe('function setPredecessor', () => {
    test('local', async () => {
        expect(await xNode.setPredecessor(yNode.encapsulateSelf())).toBeTruthy();
    });

    test('remote', async () => {
        expect(await xNode.setPredecessor(xNode.encapsulateSelf(), yNode.encapsulateSelf())).toBeTruthy();
    });
});

describe('stabilize', () => {
    test('fix successor', async () => {
        xNode.fingerTable[0].node = Utils.NULL_NODE;
        await xNode.stabilize();
    });

    test('fix predecessor', async () => {
        xNode.predecessor = Utils.NULL_NODE;
        await xNode.fixFingers();
        await xNode.stabilize();
    });

    test('fix successor and predecessor',  async () => {
        xNode.fingerTable[0].node = Utils.NULL_NODE;
        xNode.predecessor = Utils.NULL_NODE;
        await xNode.stabilize();
    });

    test('fix successor without fingers',  async () => {
        xNode.fingerTable.forEach((finger) => {
            finger.node = Utils.NULL_NODE;
        });
        xNode.fingerTable[0].node = Utils.NULL_NODE;
        await xNode.stabilize();
    });

    test('fix predecessor without fingers',  async () => {
        xNode.fingerTable.forEach((finger) => {
            finger.node = Utils.NULL_NODE;
        });
        xNode.predecessor = Utils.NULL_NODE;
        await xNode.stabilize();
    });

    test('fix successor and predecessor without fingers',  async () => {
        xNode.fingerTable.forEach((finger) => {
            finger.node = Utils.NULL_NODE;
        });
        xNode.fingerTable[0].node = Utils.NULL_NODE;
        xNode.predecessor = Utils.NULL_NODE;
        await xNode.stabilize();
    });
});

afterAll(async () => {
    xNode.endLoop();
    await xNode.network.flush();
    await xNode.terminate();
    await yNode.terminate();
    await new Promise(resolve => setTimeout(() => resolve(), 1000));
});
