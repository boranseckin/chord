import crypto from 'crypto';

import { M, SimpleNode } from './node';

export const NULL_NODE: SimpleNode = {
    id: -1,
    hash: 'FFFFFF',
    address: '0.0.0.0',
    port: 0,
};

/**
 * Checks if x is null or a NULL_NODE.
 */
export function isNull(x: any): Boolean {
    return (x == null) || (x === NULL_NODE);
}

/**
 * Deeply compares two nodes.
 */
export function isSame(a: SimpleNode, b: SimpleNode): Boolean {
    return (a.id === b.id)
    && (a.hash === b.hash)
    && (a.address === b.address)
    && (a.port === b.port);
}

/**
 * Serializes a JSON object.
 * @param data A JSON object.
 * @returns A buffer of string.
 */
export function serialize(data: any): Buffer {
    return Buffer.from(JSON.stringify(data));
}

/**
 * Deserializes a buffer into a JSON object.
 * @param data A buffer of string.
 * @returns A JSON object.
 */
export function deserialize(data: Buffer): any {
    return JSON.parse(data.toString('utf8'));
}

/**
 * Hashes a given data using SHA-1 algorithm.
 * @param data A string to be hashed.
 * @returns A string of hashed data.
 */
export function hash(data: string): string {
    const sha1 = crypto.createHash('sha1').update(data);
    return sha1.digest('hex');
}

/**
 * Returns the kth finger index of the id.
 * k must be between 1 and M exclusively.
 */
export function getFingerIndex(id: number, k: number) {
    if (k < 1 && k > M) return -1;

    return (id + (2 ** (k - 1))) % (2 ** M);
}

/**
 * Evaluates if a value is in a range using modular arithmetics.
 * If the starting value is greater than the ending value, the interval loops around.
 * @param index A value to be evaluated.
 * @param start The start of the range.
 * @param end The end of the range.
 * @param include The behaviour of the range.
 */
export function inRange(
    index: number,
    start: number,
    end: number,
    include: 'start' | 'end' | 'both' | 'none',
) {
    switch (include) {
    case 'start':
        if (start < end) return (start <= index && index < end);
        if (start > end) return (start <= index || index < end);
        if (start === end) return (index === end);
        break;

    case 'end':
        if (start < end) return (start < index && index <= end);
        if (start > end) return (start < index || index <= end);
        if (start === end) return (index === end);
        break;

    case 'both':
        if (start < end) return (start <= index && index <= end);
        if (start > end) return (start <= index || index <= end);
        if (start === end) return (index === end);
        break;

    case 'none':
        if (start < end) return (start < index && index < end);
        if (start > end) return (start < index || index < end);
        if (start === end) return (index !== end);
        break;

    default:
        break;
    }

    return false;
}
