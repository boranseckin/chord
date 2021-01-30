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
