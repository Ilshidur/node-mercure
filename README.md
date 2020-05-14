# mercure

[Mercure](https://github.com/dunglas/mercure) Hub & Publisher implemented in Node.js.

![stability-beta](https://img.shields.io/badge/stability-beta-green.svg)
[![Build Status][build-badge]][build-url]

[![npm version][version-badge]][version-url]
[![Known Vulnerabilities][vulnerabilities-badge]][vulnerabilities-url]
[![dependency status][dependency-badge]][dependency-url]
[![devdependency status][devdependency-badge]][devdependency-url]
[![downloads][downloads-badge]][downloads-url]
[![Code Climate][maintainability-badge]][maintainability-url]

[![NPM][npm-stats-badge]][npm-stats-url]

*Note: this npm package has been **transfered** for a new project by the [initial owner](https://www.npmjs.com/~francois), which serves a totally different purpose. This new version is an implementation of the [Mercure protocol](https://github.com/dunglas/mercure). The previous `mercure` package had 1 release (`0.0.1`) and served as a file downloader. You can still access it: https://www.npmjs.com/package/mercure/v/0.0.1. Please make sure to **lock** this version in your `package.json` file, as the new versions will begin at `0.0.2` and will keep following the [semver versioning](https://semver.org).*

## TODOs

* **CORS**
* Hearthbeat mechanism (https://github.com/dunglas/mercure/pull/53)
* Docker image (iso with official image)
* Prometheus metrics exporter:
  * Subscribers count
  * Events count / size (in Bytes), per publisher
  * Publishers IPs
  * Instances count
* `hub.on('connect')` listeners
* Events database
* Export authorization.js mechanism
* Discovery helpers
* Handle `Forwarded` and `X-Forwarded-For` headers ([related issue](https://github.com/dunglas/mercure/issues/114))
* Provide a Socket.io adapter ([see this thread](https://github.com/socketio/socket.io-adapter))
* Allow the dev to pass an URL in the `Publisher` contructor
* `Publisher`: allow the user to specify a JWT key and the claims instead of a JWT
* `Publisher`: getters like `get host()`, `port`, `protocol`...
* Increase code quality score
* JSDoc
* Logging
* Unit tests
* Find a way to clear Redis if the process gets interrupted
* Benchmarks

## State

This is a **beta version**. This has not fully been tested in production yet.

This implementation does not reflect the [latest specification](https://github.com/dunglas/mercure/pull/288) since they got changed. I don't recommend to use this module.

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

## Installation

```bash
npm install mercure --save
```

## Usage

This library provides 3 components: a `Hub`, a `Server` and a `Publisher`:

![Classes preview](classes-preview.jpg "Classes preview")

### Simple hub

> -> *[Documentation](docs/API.md#hub)*

The `Hub` class is the core component that uses a simple `http.Server` instance. An existing instance can be provided to the `Hub`, thus the Hub will use it instead of creating a new one.

**Use case:** implanting the hub on an existing `http.Server` app, without the need to handle external publishers (only the app does the publishing).

It handles:

* the SSE connections
* the events database
* the authorization mechanism
* events related to the Hub activity

```javascript
const http = require('http');
const { Hub } = require('mercure');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('200');
});

const hub = new Hub(server, {
  jwtKey: '!UnsecureChangeMe!',
  path: '/.well-known/mercure',
});

hub.listen(3000);
```

### Hub server

> -> *[Documentation](docs/API.md#server)*

The `Server` is built upon the `Hub` component. It creates a new Express instance and allows external publishers to `POST` an event to the hub.

**Use case:** implanting he hub on an new application that is meant to accept external publishers, with no other HTTP server ... or one listening on a different port.

It handles **everything the `Hub` does**, plus:

* a freshly created Express instance, built upon the Hub's `http.Server` (middlewares can be applied to enhance security)
* external publishers (POST requests)

```javascript
const { Server } = require('mercure');

const server = new Server({
  jwtKey: '!UnsecureChangeMe!',
  path: '/.well-known/mercure',
});

server.listen(3000);
```

Because the Server leverages Express, it is possible to add middlewares in front of the internal Hub middleware:

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

> -> *[Documentation](docs/API.md#publisher)*

It can be created in different ways:

* using an existing `Hub` instance (when the app is meant to be THE ONLY publisher)
* using an existing `Server` instance (when the app is meant to be a publisher)
* using configuration: `host`, `port`... (when the publisher and the hub are distant)

It handles:

* Message publication to the Hub
* Message encryption *(optional)*

```javascript
const { Publisher } = require('mercure');

const publisher = new Publisher({
  protocol: 'https', // or 'http', but please don't.
  host: 'example.com',
  port: 3000,
  path: '/.well-known/mercure',
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

API docs can be found [in the docs/API.md file](docs/API.md).

## Encrypting the datas

In certain cases, the Mercure hub can be hosted by a third-party host. You don't really want them to "sniff" all your cleartext messages. To make the Publisher => Hub => Subscriber flow fully encrypted, it is required that the Publisher sends encrypted data.

To achieve this, the `Publisher#useEncryption()` method will activate messages encryption. Thus, the Hub will not be able to access your private datas:

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

Decrypting:

```javascript
const jose = require('node-jose');

const encryptedData = 'ENCRYPTED DATA';
const decrypted = await jose.JWE.createDecrypt(publisher.keystore).decrypt(encryptedData);

console.log(decrypted.plaintext.toString());
```

## Kill switch

In case the hub must urgently close all connections (e.g.: in case of compromission of the JWT key), a kill switch is available:

```javascript
await hub.killSwitch();
```

The new JWT Key will be output to stdout.

## License

GNU GENERAL PUBLIC LICENSE v3.

[build-badge]: https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2FIlshidur%2Fnode-mercure%2Fbadge&style=flat
[build-url]: https://actions-badge.atrox.dev/Ilshidur/node-mercure/goto
[version-badge]: https://img.shields.io/npm/v/mercure.svg
[version-url]: https://www.npmjs.com/package/mercure
[vulnerabilities-badge]: https://snyk.io/test/npm/mercure/badge.svg
[vulnerabilities-url]: https://snyk.io/test/npm/mercure
[dependency-badge]: https://david-dm.org/ilshidur/mercure.svg
[dependency-url]: https://david-dm.org/ilshidur/mercure
[devdependency-badge]: https://david-dm.org/ilshidur/mercure/dev-status.svg
[devdependency-url]: https://david-dm.org/ilshidur/mercure#info=devDependencies
[downloads-badge]: https://img.shields.io/npm/dt/mercure.svg
[downloads-url]: https://www.npmjs.com/package/mercure
[maintainability-badge]: https://api.codeclimate.com/v1/badges/92ad8661f7de98e13f0f/maintainability
[maintainability-url]: https://codeclimate.com/github/Ilshidur/node-mercure/maintainability
[npm-stats-badge]: https://nodei.co/npm/mercure.png?downloads=true&downloadRank=true
[npm-stats-url]: https://nodei.co/npm/mercure
