import readline from 'readline';

import Node from './node';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'node> ',
});

const node = new Node(undefined, 50000, () => {
    console.log('\x1b[0f');
    rl.prompt();
});

rl.on('line', async (line) => {
    const input = line.trim();
    switch (input.split(' ')[0]) {
    case 'info':
        console.log(node.encapsulateSelf());
        break;

    case 'que':
        console.log(node.network.promises);
        break;

    case 'flush':
        await node.network.flush();
        break;

    case 'clear':
        console.log('\x1b[0f');
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
