# chord
![npm (scoped)](https://img.shields.io/npm/v/@boranseckin/chord?style=for-the-badge)
![Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=for-the-badge)

A Scalable Peer-to-peer Lookup Service for Internet Applications

This is an implementation of Chord network explained in this [paper](https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf) using TypeScript. All the communication between nodes is handled using UDP datagram sockets and the code is written asynchronously using promises to facilitate the high traffic of requests. This project only uses pure NodeJS and is dependency-free.

## Network
In the network, nodes talk to each other all the time to make sure that their version of the network is up to date. Moreover, Chord network requires nodes to execute functions for other nodes remotely. This remote execution is essential for the network since every node only knows a few other nodes and they require other nodes to perform lookups where they cannot reach.

Every node uses an IPv4 address and a port number to communicate with other nodes. All the messages are serialized and sent over UDP sockets. When a node sends a new message, it wraps it into a promise and passes a `promise id` that corresponds to the resolve/reject functions of the promise with the message. The receiver then can respond to this message using the supplied `promise id` and whether the response is positive or negative, the promise can be resolved or rejected. With this method, the network module never gets blocked and multiple messages can be sent to different nodes without waiting for a response.

Most of the functions are written to handle both local and remote execution. If a function was called with a remote executer argument, the function gets forwarded to that executer and a promise is returned instead. Once the remote node finishes the execution, it sends the return value back to the original node and the promise gets resolved (or rejected) with that value.

## References
- [Sigcomm Paper](https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf) by Ion Stoica, Robert Morris, David Karger, M. Frans Kaashoek and Hari Balakrishna
- [Wikipedia Page](https://en.wikipedia.org/wiki/Chord_(peer-to-peer))
- [chord-gRPC](https://github.com/bushidocodes/chord-grpc) by bushidocodes
- [Presentation](https://www.kth.se/social/upload/51647996f276545db53654c0/3-chord.pdf) by Amir H. Payberah and Jim Dowling

## Author
- Boran Seckin

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.