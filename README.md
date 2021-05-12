# chord
[![npm (scoped)](https://img.shields.io/npm/v/@boranseckin/chord?style=for-the-badge)](https://www.npmjs.com/package/@boranseckin/chord)
![Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=for-the-badge)
[![Travis (.com)](https://img.shields.io/travis/com/boranseckin/chord?style=for-the-badge)](https://travis-ci.com/github/boranseckin/chord)
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/boranseckin/chord?style=for-the-badge)](https://hub.docker.com/r/boranseckin/chord)
[![Codecov](https://img.shields.io/codecov/c/github/boranseckin/chord?style=for-the-badge&token=wq26EbilpW)](https://codecov.io/gh/boranseckin/chord)

A Scalable Peer-to-peer Lookup Service for Internet Applications

This is an implementation of Chord network explained in this [paper](https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf) using TypeScript. All the communication between nodes is handled using UDP sockets and the code is written asynchronously using promises to facilitate the high traffic of requests. This project only uses pure NodeJS and is dependency-free.

## Network
In the network, nodes constantly communicate with each other to make sure that their version of the network is up to date. Moreover, Chord network requires nodes to execute functions for other nodes remotely. This remote execution is essential for the network since every node only knows a few other nodes and they require other nodes to perform actions like lookups where they cannot reach.

Every node uses an IPv4 address and a port number to communicate with other nodes. All the messages are serialized and sent over UDP sockets. When a node sends a new message, it wraps it into a promise and passes a `promise id` that corresponds to the resolve/reject functions of the promise with the message. The receiver then can respond to this message using the supplied `promise id` and whether the response is positive or negative, the promise can be resolved or rejected. With this method, the network module never gets blocked and multiple messages can be sent to different nodes without waiting for a response.

Most of the functions are written to handle both local and remote execution. If a function was called with a remote executer argument, the function gets forwarded to that executer and a promise is returned instead. Once the remote node finishes the execution, it sends the return value back to the original node and the promise gets resolved (or rejected) with that value.

## Visualizer
To see the network clearly and admire its dynamic structure, a different module is built called [@boranseckin/chord-visualizer](https://github.com/boranseckin/chord-visualizer). Visualizer class inherits the node class to seamlessly send/receive messages. It is not a part of the network and it only uses the `getInfo` command to gather information about nodes.

Collected data is shown as a graph on a simple web page that is periodically updated to reflect the changes on the network. The visualizer requires an anchor node to start crawling a network. If the anchor node is lost, it will try to use a previously-found node to replace its place.

## Docker
After a long struggle, this project is fully dockerized. Both [boranseckin/chord](https://hub.docker.com/r/boranseckin/chord) and [boranseckin/chord-visualizer](https://hub.docker.com/r/boranseckin/chord-visualizer) can be run as standalone containers. Additionally, [docker-compose](docker-compose.yml) file can be used to create and scale a fully functional Chord network (including a visualizer). When scaling, only make copies of the `node` service. There must be at most one `flare` and one `visualizer` services active at all times since they are staticly binded to specific ports.


### Problems and Solutions
>To create the network, a node must first enter and act as a flare to the rest.

Using the [boranseckin/chord](https://hub.docker.com/r/boranseckin/chord) image create two different services. The first one (`flare`) uses a static configuration and becomes the flare. The second one (`node`) depends on the first one and scales the network using the configuration of the `flare`.

>When adding a new node (automatically scaling), its IPv4 address is not known yet. So it can't be supplied as an environmental variable.

Do not specifiy the address and let the node find figure it out instead using `os` module. This is a workaround and only works if the interface is called `eth0` like it is in docker containers.

>NodeJS `dgram` module does not like Dynamic DNS as an address.

In a custom network, containers can use their names as DDNS to communicate with each other. Since `dgram` module requires IPv4 addresses, use `dns` module to lookup IPv4 equivalent of the DDNS.

>Each node requires a **unique** ID but used IDs are not known during scaling.

When using `docker-compose` each new container is assigned a unique id as an extension to its name. However, for some reason, these names are not easily accessible from inside the container. To get container information, [Docker Engine API](https://docs.docker.com/engine/api/) must be exposed to each node. During startup, a [shell script](docker-start.sh) is run to digest the data and export an ID for the node. Exposing the API is sub-optimal but a necessity in this case.

## References
- [Sigcomm Paper](https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf) by Ion Stoica, Robert Morris, David Karger, M. Frans Kaashoek and Hari Balakrishna
- [Wikipedia Page](https://en.wikipedia.org/wiki/Chord_(peer-to-peer))
- [chord-gRPC](https://github.com/bushidocodes/chord-grpc) by bushidocodes
- [Presentation](https://www.kth.se/social/upload/51647996f276545db53654c0/3-chord.pdf) by Amir H. Payberah and Jim Dowling

## Author
- Boran Seckin

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.