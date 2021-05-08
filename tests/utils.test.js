const crypto = require('crypto');

const Utils = require('../dist/utils');

test('tests serializing', () => {
    const data = {
        test: crypto.randomBytes(8).toString('utf-8'),
        test1: crypto.randomBytes(8),
    }
    expect(Utils.serialize(data)).toStrictEqual(Buffer.from(JSON.stringify(data)));
});

test('tests deserializing', () => {
    const data = {
        test: crypto.randomBytes(8).toString('utf-8'),
        test1: crypto.randomBytes(8),
    }
    const buffer = Buffer.from(JSON.stringify(data));
    expect(Utils.deserialize(buffer)).toStrictEqual(JSON.parse(buffer.toString('utf8')));
});

test('tests hashing', () => {
    const data = crypto.randomBytes(8).toString('utf-8');
    const sha1 = crypto.createHash('sha1').update(data);
    expect(Utils.hash(data)).toStrictEqual(sha1.digest('hex'));
});

test('tests getting finger index', () => {
    expect.assertions(3);
    expect(Utils.getFingerIndex(3, 0)).toBe(-1);
    expect(Utils.getFingerIndex(3, 999)).toBe(-1);
    expect(Utils.getFingerIndex(3, 3)).toBe(7);
});

describe('function isNull', () => {
    test('classifies NULL_NODE as null', () => {
        expect(Utils.isNull(Utils.NULL_NODE)).toBeTruthy();
    });
    
    test('classifies null as null', () => {
        expect(Utils.isNull(null)).toBeTruthy();
    });
    
    test('does not classify SimpleNode as null', () => {
        expect(Utils.isNull({
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        })).toBeFalsy();
    });

    test('does not classify number as null', () => {
        expect(Utils.isNull(1)).toBeFalsy();
    });
});

describe('function isSame', () => {
    test('classifies identical nodes as same', () => {
        const a = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };
        const b = a;
        expect(Utils.isSame(a, b)).toBeTruthy();
    });

    test('does not classify nodes with different ids as same', () => {
        const a = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };
        const b = {
            id: 1,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };;
        expect(Utils.isSame(a, b)).toBeFalsy();
    });

    test('does not classify nodes with different hashes as same', () => {
        const a = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };
        const b = {
            id: 0,
            hash: '5D13F3',
            address: '127.0.0.1',
            port: 50000,
        };;
        expect(Utils.isSame(a, b)).toBeFalsy();
    });

    test('does not classify nodes with different addresses as same', () => {
        const a = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };
        const b = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.2',
            port: 50000,
        };;
        expect(Utils.isSame(a, b)).toBeFalsy();
    });

    test('does not classify nodes with different ports as same', () => {
        const a = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50000,
        };
        const b = {
            id: 0,
            hash: '3F31D5',
            address: '127.0.0.1',
            port: 50001,
        };;
        expect(Utils.isSame(a, b)).toBeFalsy();
    });
});

describe('function inRange', () => {
    describe('start', () => {
        test('1 <= 2 < 3: True', () => {
            expect(Utils.inRange(2, 1, 3, 'start')).toBeTruthy();
        });
        test('3 <= 2 < 1: False', () => {
            expect(Utils.inRange(2, 3, 1, 'start')).toBeFalsy();
        });
        test('3 <= 2 < 3: False', () => {
            expect(Utils.inRange(2, 3, 3, 'start')).toBeFalsy();
        });
        test('1 <= 1 < 3: True', () => {
            expect(Utils.inRange(1, 1, 3, 'start')).toBeTruthy();
        });
        test('1 <= 3 < 3: False', () => {
            expect(Utils.inRange(3, 1, 3, 'start')).toBeFalsy();
        });
    });
    describe('end', () => {
        test('1 < 2 <= 3: True', () => {
            expect(Utils.inRange(2, 1, 3, 'end')).toBeTruthy();
        });
        test('3 < 2 <= 1: False', () => {
            expect(Utils.inRange(2, 3, 1, 'end')).toBeFalsy();
        });
        test('3 < 2 <= 3: False', () => {
            expect(Utils.inRange(2, 3, 3, 'end')).toBeFalsy();
        });
        test('1 <= 3 < 3: True', () => {
            expect(Utils.inRange(3, 1, 3, 'end')).toBeTruthy();
        });
        test('1 <= 1 < 3: False', () => {
            expect(Utils.inRange(1, 1, 3, 'end')).toBeFalsy();
        });
    });
    describe('both', () => {
        test('1 <= 2 <= 3: True', () => {
            expect(Utils.inRange(2, 1, 3, 'both')).toBeTruthy();
        });
        test('3 <= 2 <= 1: False', () => {
            expect(Utils.inRange(2, 3, 1, 'both')).toBeFalsy();
        });
        test('3 <= 2 <= 3: False', () => {
            expect(Utils.inRange(2, 3, 3, 'both')).toBeFalsy();
        });
        test('1 <= 1 <= 3: True', () => {
            expect(Utils.inRange(1, 1, 3, 'both')).toBeTruthy();
        });
        test('1 <= 3 <= 3: True', () => {
            expect(Utils.inRange(3, 1, 3, 'both')).toBeTruthy();
        });
    });
    describe('none', () => {
        test('1 < 2 < 3: True', () => {
            expect(Utils.inRange(2, 1, 3, 'none')).toBeTruthy();
        });
        test('3 < 2 < 1: False', () => {
            expect(Utils.inRange(2, 3, 1, 'none')).toBeFalsy();
        });
        test('3 < 2 < 3: True', () => {
            expect(Utils.inRange(2, 3, 3, 'none')).toBeTruthy();
        });
        test('1 < 1 < 3: False', () => {
            expect(Utils.inRange(1, 1, 3, 'none')).toBeFalsy();
        });
        test('1 < 3 < 3: False', () => {
            expect(Utils.inRange(3, 1, 3, 'none')).toBeFalsy();
        });
    });
    test('no argument', () => {
        expect(Utils.inRange(0, 0, 0)).toBeFalsy();
    });
});
