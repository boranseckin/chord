#!/usr/bin/env node

import readline from 'readline';

import Node, { SimpleNode } from './node';
import { clear, hash, inRange } from './utils';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'node> ',
    completer: (line: string) => {
        const completions = 'info suc pre finger stabilize fix start stop que flush ping msg range clear exit kill'.split(' ');
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits, line];
    },
});

/**
 * Prints to stdout without messing up the readline prompt.
 */
export default function print(...x: any) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    console.log(...x);

    rl.prompt();
    // Ctrl + E -> Go to to end of line
    rl.write('', { ctrl: true, name: 'e' });
}

let node: Node;
let id: number | undefined;
let address: string | undefined;
let port: number | undefined;
let flare: SimpleNode | undefined;

function askQuestions(callback: CallableFunction) {
    rl.question('ID: ', (qid) => {
        rl.question('Address: ', (qaddress) => {
            rl.question('Port: ', (qport) => {
                id = Number(qid) || undefined;
                address = qaddress || undefined;
                port = Number(qport) || undefined;
                callback();
            });
        });
    });
}

function askFlare(callback: CallableFunction) {
    rl.question('Join to an existing network? [y/n] ', (qisFlare) => {
        if (qisFlare.toLowerCase() === 'y') {
            rl.question('Flare ID: ', (qid) => {
                rl.question('Flare Address: ', (qaddress) => {
                    rl.question('Flare Port: ', (qport) => {
                        flare = {
                            id: Number(qid) || 0,
                            hash: hash(`${qaddress}:${qport}`).slice(10, 16).toUpperCase() || 'FFFFFF',
                            address: qaddress || '127.0.0.1',
                            port: Number(qport) || 50000,
                        };
                        callback();
                    });
                });
            });
        } else if (qisFlare.toLowerCase() === 'n') {
            flare = undefined;
            callback();
        } else {
            askFlare(callback);
        }
    });
}

clear();

askQuestions(() => {
    askFlare(() => {
        node = new Node(id, address, port, flare, () => {
            clear();
            rl.prompt();
        });
    });
});

rl.on('line', async (line) => {
    const input = line.trim().split(' ');
    switch (input[0]) {
    case 'info':
        print(node.encapsulateSelf());
        print(node.predecessor);
        print(node.fingerTable);
        break;

    case 'suc':
        print(await node.findSuccessor(Number(input[1])));
        break;

    case 'pre':
        print(await node.findPredecessor(Number(input[1])));
        break;

    case 'finger':
        print(node.closestPrecedingFinger(Number(input[1])));
        break;

    case 'stabilize':
        await node.stabilize();
        break;

    case 'fix':
        await node.fixFingers(Number(input[1]));
        break;

    case 'start':
        node.startLoop();
        break;

    case 'stop':
        node.endLoop();
        break;

    case 'que':
        print(node.network.promises);
        break;

    case 'flush':
        await node.network.flush();
        break;

    case 'ping':
        if (input[1] && input[2]) {
            await node.ping({
                id: -1,
                hash: 'N/A',
                address: input[1],
                port: Number(input[2]),
            })
                .catch((error) => console.error(error));
        } else {
            print('Ping requires 2 arguments!');
        }
        break;

    case 'msg':
        if (input[1] && input[2] && input[3]) {
            await node.message({
                id: -1,
                hash: 'N/A',
                address: input[1],
                port: Number(input[2]),
            }, input[3])
                .catch((error) => console.error(error));
        } else {
            print('Message requires 3 arguments!');
        }
        break;

    case 'range':
        if (input[4] === 'start' || input[4] === 'end' || input[4] === 'none' || input[4] === 'both') {
            print(inRange(Number(input[1]), Number(input[2]), Number(input[3]), input[4]));
        }
        break;

    case 'clear':
        process.stdout.write('\u001b[2J\u001b[0;0H');
        break;

    case 'exit':
        rl.question('Are you sure to terminate this node? [y/n] ', (answer) => {
            if (answer.toLowerCase() === 'y') {
                node.terminate();
            } else {
                rl.prompt();
            }
        });
        break;

    case 'kill':
        rl.question('Are you sure to kill this node? [y/n] ', (answer) => {
            if (answer.toLowerCase() === 'y') {
                process.exit();
            } else {
                rl.prompt();
            }
        });
        break;

    default:
        print(`Unkown command: ${input}`);
        break;
    }

    rl.prompt();
}).on('close', () => node.terminate());
