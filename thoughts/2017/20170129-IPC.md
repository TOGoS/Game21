# Inter-process communication protocols

I like OSC.  A lot of the messaging systems are based on OSC.

/path/to/endpoint ...arbitrary parameters of JSON-compatible types

# Sending datagrams over stream sockets

When representing a datagram link as a stream,
the simplest thing to do may be to send packets prepended with their length.

```
  (32-bit length) (packet data) ...
```

This is easier than SLIP encoding.
I should add a mode to TUN2UDP that does this.

The endpoints will need to agree on what type of frames are being sent.
Options:
- ethernet II frames
- IP packets
- For more flexibility: OSC packets
- A line-based text protocol (mappable to OSC, maybe)

If a library is built that can translate between different kinds of framing,
it might be nice if it supported SLIP also.

To keep things simple, let's standardize on ethernet II frames
for sockets that are purely representative of a single packet stream.

For streams that need to multiplex different kinds of data,
and/or an arbitrary number of datagram links,
let's use OSC, and have a standard mapping from a line-based text format to/from OSC.
(data: URIs to represent buffers, maybe double-quotes for literal strings, etc)

```
  /ethX/frame frameData
```

To simulate a bidirectional link, you'll need two sockets.
