import readline from 'readline';

import Node from './node';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'node> ',
});

const address = process.argv[2] || undefined;
const port = Number(process.argv[3]) || undefined;

const node = new Node(address, port, () => {
    process.stdout.write('\u001b[2J\u001b[0;0H');
    rl.prompt();
});

rl.on('line', async (line) => {
    const input = line.trim().split(' ');
    switch (input[0]) {
    case 'info':
        console.log(node.encapsulateSelf());
        break;

    case 'que':
        console.log(node.network.promises);
        break;

    case 'flush':
        await node.network.flush();
        break;

    case 'ping':
        if (input[1] && input[2]) {
            await node.ping({ id: 'N/A', address: input[1], port: Number(input[2]) })
                .catch((error) => console.error(error));
        } else {
            console.log('Ping requires 2 arguments!');
        }
        break;

    case 'msg':
        if (input[1] && input[2] && input[3]) {
            await node.message({ id: 'N/A', address: input[1], port: Number(input[2]) }, input[3])
                .catch((error) => console.error(error));
        } else {
            console.log('Message requires 3 arguments!');
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
        console.log(`Unkown command: ${input}`);
        break;
    }

    rl.prompt();
}).on('close', () => node.terminate());
