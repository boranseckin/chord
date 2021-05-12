#!/bin/sh

# 1. Get the current container's name using the Docker API.
# 2. Digest the last number.
# 3. Use the number as the Chord ID.
# 4. Start Chord.

CHORD_ID=$(curl -s --unix-socket /var/run/docker.sock -X GET http://localhost/containers/$HOSTNAME/json | jq '.Name' | rev | cut -c 2);

# If not found, set to 0.
[ -z $CHORD_ID ] && CHORD_ID=0

export CHORD_ID;
echo "Starting chord node with ID $CHORD_ID.";

/usr/bin/env node node.js;
