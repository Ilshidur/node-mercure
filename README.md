# mercure

Mercure Hub & Publisher implemented in Node.js.

TODO: README badges

## TODOs

* **CORS**
* Publisher#getClaims()
* Export authorization.js mechanism
* Discovery helpers
* JSDoc
* Logging
* Unit tests
* Find a way to clear Redis if the process gets interrupted
* Benchmarks

## Requirements

* node.js **>= 11.7.0**
* Redis (optional)

## Features

* 100% implementation of the protocol
* Events asymmetric encryption
* Easy integration to any existing app using `http.Server` or `express`
* Redis-based clustering support
* Inventory of all open connections stored in Redis, per node process
* Kill switch

## Future improvements

* Implement as a lambda function ?

## Usage

This library provides 3 components : a `Hub`, a `Server` and a `Publisher` :

![Classes preview](classes-preview.jpg "Classes preview")

### Simple hub

The `Hub` class is the core component that uses a simple `http.Server` instance. An existing instance can be provided to the `Hub`, thus the Hub will use it instead of creating a new one.

**Use case :** implanting the hub on an existing `http.Server` app, without the need to handle external publishers (only the app does the publishing).

It handles :

* the SSE connections
* the events database
* the authorization mechanism
* events related to the Hub activity

```javascript
const http = require('http');
const { Hub } = require('mercure');

const server = http.createHttpServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('200');
});

const hub = new Hub(server, {
  jwtKey: '!UnsecureChangeMe!',
  path: '/hub',
});

hub.listen();
```

### Hub server

The `Server` is built upon the `Hub` component. It creates a new Express instance and allows external publishers to `POST` an event to the hub.

**Use case :** implanting he hub on an new application that is meant to accept external publishers, with no other HTTP server ... or one listening on a different port.

It handles **everything the `Hub` does**, plus :

* a freshly created Express instance, built upon the Hub's `http.Server` (middlewares can be applied to enhance security)
* external publishers (POST requests)

```javascript
const { Server } = require('mercure');

const server = new Server({
  jwtKey: '!UnsecureChangeMe!',
  path: '/hub',
});

server.listen(3000);
```

Because the Server is leverages Express, it is possible to add middlewares in front of the internal Hub middleware :

```javascript
const compression = require('compression');

class SecuredHubServer extends Server {
  configure() {
    this.app.use(compression());
  }
}

const server = new SecuredHubServer(...);
```

### Publisher

It can be created in different ways :

* using an existing `Hub` instance (when the app is meant to be THE ONLY publisher)
* using an existing `Server` instance (when the app is meant to be a publisher)
* using configuration : `host`, `port`... (when the publisher and the hub are distant)

It handles :

* Message publication to the Hub
* Message encryption *(optional)*

```javascript
const { Publisher } = require('mercure');

const publisher = new Publisher({
  protocol: 'https', // or 'http', but please don't.
  host: 'example.com',
  port: 3000,
  path: '/hub',
  jwt: 'PUBLISHER_JWT',
});

// Payload to send to the subscribers.
const data = {
  '@id': 'http://localhost:3000/books/666.jsonld',
  hello: 'world',
};

await publisher.publish(
  ['https://example.com:3000/books/666.jsonld'], // Topics.
  JSON.stringify(data),
);
```

## API

API docs can be found [in the API.md file](API.md).

## Encrypting the datas

In certain cases, the Mercure hub can be hosted by a third-party host. You don't really want them to "sniff" all your cleartext messages. To make the Publisher => Hub => Subscriber flow fully encrypted, it is required that the Publisher sends encrypted data.

To achieve this, the `Publisher#useEncryption()` method will activate messages encryption. Thus, the Hub will not be able to access your private datas :

```javascript
const crypto = require('crypto');
const util = require('util');

const publisher = new Publisher({
  // ...
});

const data = { message: 'TOP SECRET DATAS' };
const { privateKey } = await util.promisify(crypto.generateKeyPair)('rsa', {
  modulusLength: 4096,
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Start encrypting the events.
await publisher.useEncryption({
  rsaPrivateKey: privateKey,
});

// Will send encrypted datas.
await publisher.publish(
  [...], // Topics.
  JSON.stringify(data),
);
```

Decrypting :

```javascript
const jose = require('node-jose');

const encryptedData = 'ENCRYPTED DATA';
const decrypted = await jose.JWE.createDecrypt(publisher.keystore).decrypt(encryptedData);

console.log(decrypted.plaintext.toString());
```

## Kill switch

In case the hub must urgently close all connections (e.g.: in case of compromission of the JWT key), a kill switch is available.
The function `Hub#killSwitch()` takes no argument and is asynchronous. It will :

* generate a new JWT key
* close all subscribers' open connections, except the ones from subscribers who have full subscription rights to the hub

```javascript
await hub.killSwitch();
```

## License

GNU GENERAL PUBLIC LICENSE v3.
