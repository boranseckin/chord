const Node = require('../dist/node');
const Network = require('../dist/network');
const Utils = require('../dist/utils');

/** @type Node */
let xNode;
/** @type Node */
let yNode;

console.log = jest.fn()

const messageSpy = jest.spyOn(Network.default.prototype, 'messageHandler');
const respondSpy = jest.spyOn(Network.default.prototype, 'respondToPromise');
const timeoutSpy = jest.spyOn(global, 'setTimeout');
const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

beforeAll(async () => {
    await new Promise((resolve) => {
        xNode = new Node.default(2, '127.0.0.1', 50002, undefined, () => {
            xNode.endLoop();
            resolve();
        });
    })
    
    await new Promise((resolve) => {
        yNode = new Node.default(3, '127.0.0.1', 50003, undefined, () => {
            yNode.endLoop();
            resolve();
        });
    })
});

describe('Sending Messages', () => {
    test('sends message and gets response', async () => {
        expect.assertions(4);

        await xNode.message(yNode.encapsulateSelf(), 'This is node X!')
            .then((res) => {
                expect(res).toEqual(true)
            })
            .catch((err) => expect(err).toBeUndefined())

        expect(messageSpy).toHaveBeenCalledTimes(2);
        expect(respondSpy).toHaveBeenCalledWith(expect.any(String), { "result": true });
        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    test('sends message and gets no response', async () => {
        expect.assertions(6);

        await xNode.message({ id: '1111', hash: 'FFFFFF', address: '127.0.0.1', port: 5000 }, 'This is node X!')
            .catch((error) => expect(error).toBeDefined());

        expect(messageSpy).not.toHaveBeenCalled();
        expect(respondSpy).not.toHaveBeenCalled();
        expect(timeoutSpy).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
        expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });
});

describe('Sending Pings', () => {
    test('sends ping message and gets positive response', async () => {
        expect.assertions(5);

        await xNode.ping(yNode.encapsulateSelf())
            .then((res) => expect(res).toEqual(true))
            .catch((error) => expect(error).toBeUndefined());
        
        expect(messageSpy).toHaveBeenNthCalledWith(1, expect.any(Buffer), { "address": "127.0.0.1", "family": "IPv4", "port": 50002, "size": 178 });
        expect(messageSpy).toHaveBeenNthCalledWith(2, expect.any(Buffer), { "address": "127.0.0.1", "family": "IPv4", "port": 50003, "size": 217 });
        expect(respondSpy).toHaveBeenCalledWith(expect.any(String), { "ping": true, "result": true });
        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    test('sends ping message and gets positive response with mocked respond', async () => {
        expect.assertions(1);

        const spy = jest.spyOn(Network.default.prototype, 'respondToPromise').mockImplementation((promiseId, data) => {
            xNode.network.promises[promiseId].resolve({ result: true, ping: false });
            delete xNode.network.promises[promiseId];
        });

        await xNode.ping(yNode.encapsulateSelf())
            .then((res) => expect(res).toEqual({ result: true, ping: false }))
            .catch((error) => expect(error).toBeUndefined());

        spy.mockRestore();
    });

    test('sends ping message and gets positive response with mocked handler', async () => {
        expect.assertions(1);

        const spy = jest.spyOn(Network.default.prototype, 'messageHandler').mockImplementation(async (msg, rinfo) => {
            const message = Utils.deserialize(msg);
            const {
                sender,
                type,
                promiseId,
                data,
            } = message;

            if (type == 'ping') {
                await yNode.network.send(sender, 'response', promiseId, { result: true, ping: false });
            } else if (type == 'response') {
                xNode.network.respondToPromise(promiseId, data);
            }
        });

        await xNode.ping(yNode.encapsulateSelf())
            .then((res) => expect(res).toBe(true))
            .catch((error) => expect(error).toBeUndefined());

        spy.mockRestore();
    });

    test('sends ping message and gets no response', async () => {
        expect.assertions(6);

        await xNode.ping({ id: '1111', address: '127.0.0.1', port: 5000 })
            .catch((error) => expect(error).toBeDefined());

        expect(messageSpy).not.toHaveBeenCalled();
        expect(respondSpy).not.toHaveBeenCalled();
        expect(timeoutSpy).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
        expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });
});

afterAll(async () => {
    await xNode.network.disconnect();
    await yNode.network.disconnect();

    jest.restoreAllMocks();
    
    // Wait for socket to close
    await new Promise(resolve => setTimeout(() => resolve(), 200));
});