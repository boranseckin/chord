import crypto from 'crypto';

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
