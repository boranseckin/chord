import crypto from 'crypto';

import { M } from './node';

export function serialize(data: any): Buffer {
    return Buffer.from(JSON.stringify(data));
}

export function deserialize(data: Buffer): any {
    return JSON.parse(data.toString('utf8'));
}

export function hash(data: string) {
    const sha1 = crypto.createHash('sha1').update(data);
    return sha1.digest('hex');
}

export function getFingerIndex(id: number, k: number) {
    if (k < 1 && k > M) return -1;

    return (id + (2 ** (k - 1))) % (2 ** M);
}

export function inRange(index: number, start: number, end: number, include: 'start' | 'end' | 'both' | 'none') {
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
