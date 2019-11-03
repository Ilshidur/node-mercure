# API documentation

![Classes preview](classes-preview.jpg "Classes preview")

## Table of contents

- [API documentation](#api-documentation)
  - [Table of contents](#table-of-contents)
  - [Hub](#hub)
    - [`Hub#constructor(server, config)` -> `Hub`](#hubconstructorserver-config---hub)
    - [`Hub#listen(port, addr)` -> `Promise<void>`](#hublistenport-addr---promisevoid)
    - [`Hub#dispatchUpdate(topics, data, opts)` -> `Promise<Number>`](#hubdispatchupdatetopics-data-opts---promisenumber)
    - [`Hub#generateJwt(claims)` -> `Promise<String>`](#hubgeneratejwtclaims---promisestring)
    - [`Hub#generatePublishJwt(targets)` -> `Promise<String>`](#hubgeneratepublishjwttargets---promisestring)
    - [`Hub#generateSubscribeJwt(targets)` -> `Promise<String>`](#hubgeneratesubscribejwttargets---promisestring)
    - [`Hub#authorizePublish(req)` -> `Promise<Object>`](#hubauthorizepublishreq---promiseobject)
    - [`Hub#authorizeSubscribe(req)` -> `Promise<Object>`](#hubauthorizesubscribereq---promiseobject)
    - [`Hub#end(opts)` -> `Promise<void>`](#hubendopts---promisevoid)
    - [`Hub#endSync()` -> `void`](#hubendsync---void)
    - [`Hub#changeJwtKey()` -> `Promise<void>`](#hubchangejwtkey---promisevoid)
    - [`Hub#killSwitch()` -> `Promise<void>`](#hubkillswitch---promisevoid)
  - [Server](#server)
    - [`Server#constructor(config)` -> `Server`](#serverconstructorconfig---server)
    - [static `Server#createFromExpressApp(app, config)` -> `Objet<http.Server, Hub>`](#static-servercreatefromexpressappapp-config---objethttpserver-hub)
    - [`Server#listen(port, addr)` -> `Promise<void>`](#serverlistenport-addr---promisevoid)
    - [`Server#end(opts)` -> `Promise<void>`](#serverendopts---promisevoid)
    - [`Server#endSync()` -> `void`](#serverendsync---void)
  - [Publisher](#publisher)
    - [`Publisher#constructor(config || hub)` -> `Publisher`](#publisherconstructorconfig--hub---publisher)
    - [`Publisher#publish(topics, message, options)` -> `Promise<String>`](#publisherpublishtopics-message-options---promisestring)
    - [`Publisher#useEncryption(config)` -> `Promise<Object<String, String>>`](#publisheruseencryptionconfig---promiseobjectstring-string)
    - [`Publisher#getClaims()` => `Object`](#publishergetclaims--object)

## Hub

### `Hub#constructor(server, config)` -> `Hub`

Initializes a new Hub instance. When clustering the application, it is required to connect the hub to [Redis](https://redis.io) in order to leverage its pub/sub capabilities and scale across multiple hub instances.

The instance does not immediately "listen". Calling the `Hub#listen()` method is required.

**Arguments :**

* `server` ([`http.Server`](https://nodejs.org/api/http.html#http_class_http_server), *optional*) : a native `http.Server` instance. If not passed, the hub will create one.
* `config` (`Object`, *optional*) :
  * `id` (`String`, *optional*) : a unique ID identifying this instance amongst a full instances cluster.
  * `jwtKey` (`String`, **required**) : the publisher's AND subscriber's JSON Web Token key. Throws if either `pubJwtKey` or `subJwtKey` are passed.
  * `pubJwtKey` (`String`, **required**) : the publisher's jwt key. Throws if `jwtKey` is also passed.
  * `subJwtKey` (`String`, **required**) : the subscriber's jwt key. Throws if `jwtKey` is also passed.
  * `path` (`String`, *defaults to `'/.well-known/mercure'`*) : the hub's route.
  * `allowAnonymous` (`Boolean`, *defaults to `false`*) : set to `true` to allow subscribers with no valid JWT to connect.
  * `maxTopics` (`Number`, *defaults to `0`*) : maximum topics count the subscribers can subscribe to. `0` means no limit.
  * `ignorePublisherId` (`Boolean`, *defaults to `true`*) : set to `false` to accept the event ID by the publisher instead of creating a new one.
  * `publishAllowedOrigins` (`Array<String>`, *defaults to `[]`*) : a list of origins allowed to publish (only applicable when using cookie-based auth).
  * `redis` (`Object`, *optional*) : if defined, the Hub will connect to a Redis instance and use it to store the events and scale across multiple instances. This option is directly passed to the `redis.createInstance()` method of the [`redis`](https://www.npmjs.com/package/redis) npm module.

**Returns :** a new `Hub` instance.

### `Hub#listen(port, addr)` -> `Promise<void>`

Listens to incoming subscription requests. It can be stopped with the methods `Hub#end()` or `Hub#endSync()`.

**Arguments :**

* `port` (`Number`, **required**) : the port which the hub will listen to.
* `addr` (`String`, *defaults to `'0.0.0.0'`*) : the listening bound address.

**Returns :** a `Promise` resolving when the server has started listening.

### `Hub#dispatchUpdate(topics, data, opts)` -> `Promise<Number>`

Sends an update to the subscribers. Only the subscribers watching the corresponding topics will receive the update if they are allowed to.

**Arguments :**

* `topics` (`Array<String> || String`, **required**) : Topic(s) of the update.
* `data` (`String`, **required**) : the message to send to the subscribers.
* `opts` (`Object`, *optional*) :
  * `id` (`String`, *optional*) : the event ID. Will be discarded if `ignorePublisherId` is set to `true` in the hub's configuration.
  * `targets` (`Array<String>`, *defaults to `[]`*) :
  * `allTargets` (`Boolean`, *defaults to `false`*) :
  * `type` (`String`, *defaults to `'message'`*) : the event message type.
  * `retry` (`Number`, *defaults to `0`*) : the subscriber's reconnection time.

**Returns :** a `Promise` resolving with the update ID when the update has been dispatched.

### `Hub#generateJwt(claims)` -> `Promise<String>`

Generates a JWT using the stored JSON Web Token key. This JWT contains the targets the subscriber is allowed to get updates about.

=> [Example on jwt.io](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXJjdXJlIjp7InN1YnNjcmliZSI6WyJmb28iLCJiYXIiXSwicHVibGlzaCI6WyJmb28iXX19.LRLvirgONK13JgacQ_VbcjySbVhkSmHy3IznH3tA9PM)

**Arguments :**

* `claims` (`Object`, **required**) :
  * `publish`: (`Array<String>`, *optional*) : targets that the client can publish to.
  * `subscribe`: (`Array<String>`, *optional*) : targets that the client can subscribe to.

**Returns :** a `Promise` resolving a `String` containing the JWT.

### `Hub#generatePublishJwt(targets)` -> `Promise<String>`

Generates a JWT using the stored JSON Web Token key. This JWT only contains permissions to **publish** on the given targets.

=> [Example on jwt.io](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXJjdXJlIjp7InB1Ymxpc2giOlsiZm9vIl19fQ.weCGCnFpami1oNG9nflP7jb3-d1G8uSv8vd3yGjDBDU)

**Arguments :**

* `targets`: (`Array<String>`, *optional*) : targets that the client can publish to.

**Returns :** a `Promise` resolving a `String` containing the JWT.

### `Hub#generateSubscribeJwt(targets)` -> `Promise<String>`

Generates a JWT using the stored JSON Web Token key. This JWT only contains permissions to **subscribe** on the given targets.

=> [Example on jwt.io](https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXJjdXJlIjp7InN1YnNjcmliZSI6WyJmb28iLCJiYXIiXX19.DNa7vHxKE-l_NBc1a_JrfLPDjq0rG1_gAOZMBeC3xh0)

**Arguments :**

* `targets`: (`Array<String>`, *optional*) : targets that the client can subscribe to.

**Returns :** a `Promise` resolving a `String` containing the JWT.

### `Hub#authorizePublish(req)` -> `Promise<Object>`

Extracts the claims from a request (header or cookie) addressed to the hub. This only extracts claims from a request sent by a **publisher**.

**Arguments :**

* `req` ([`http.ClientRequest`](https://nodejs.org/api/http.html#http_class_http_clientrequest)) : 

**Returns :** a `Promise` resolving the claims extracted from the request's JWT.

### `Hub#authorizeSubscribe(req)` -> `Promise<Object>`

Extracts the claims from a request (header or cookie) addressed to the hub. This only extracts claims from a request sent by a **subscriber**.

**Arguments :**

* `req` ([`http.ClientRequest`](https://nodejs.org/api/http.html#http_class_http_clientrequest)) : 

**Returns :** a `Promise` resolving the claims extracted from the request's JWT.

### `Hub#end(opts)` -> `Promise<void>`

Gracefully stops the hub **asynchronously**. This will close the connections to the subscribers.

**Arguments :**

* `opts` (`Object`, *optional*) :
  * `force` (`Boolean`, *defaults to `false`*) : set to `true` to forcefully close all connections.

**Returns :** a `Promise` resolving when the hub is stopped.

### `Hub#endSync()` -> `void`

*Forcefully* stops the hub **synchronously**.

**Arguments :** *(none)*

**Returns :** *(void)*

### `Hub#changeJwtKey()` -> `Promise<void>`

Changes the JSON Web Token key. This will close all subscribers' open connections, except the ones from subscribers who have full subscription rights to the hub.

**Arguments :** *(none)*

**Returns :** a `Promise` resolving when the JWT has been changed.

### `Hub#killSwitch()` -> `Promise<void>`

Will :

* generate a new JWT key.
* close all subscribers' open connections, except the ones from subscribers who have full subscription rights to the hub.
* outputs the new JWT Key to stdout.

**Use case :** in case the hub must urgently close all connections (e.g.: in case of compromission of the JWT key).

**Arguments :** *(none)*

**Returns :** a `Promise` resolving when the JWT has been changed.

## Server

### `Server#constructor(config)` -> `Server`

Initializes a new Server instance. When clustering the application, it is required to connect the server to [Redis](https://redis.io) in order to leverage its pub/sub capabilities and scale across multiple hub instances.

The instance does not immediately "listen". Calling the `Server#listen()` method is required.

**Arguments :**

*Note :* this constructor takes the same options as `Hub#constructor()`.

* `server` ([`http.Server`](https://nodejs.org/api/http.html#http_class_http_server), *optional*) : a native `http.Server` instance. If not passed, the hub will create one.
* `config` (`Object`, *optional*) :
  * `id` (`String`, *optional*) : a unique ID identifying this instance amongst a full instances cluster.
  * `jwtKey` (`String`, **required**) : the publisher's AND subscriber's JSON Web Token key. Throws if either `pubJwtKey` or `subJwtKey` are passed.
  * `pubJwtKey` (`String`, **required**) : the publisher's jwt key. Throws if `jwtKey` is also passed.
  * `subJwtKey` (`String`, **required**) : the subscriber's jwt key. Throws if `jwtKey` is also passed.
  * `path` (`String`, *defaults to `'/.well-known/mercure'`*) : the hub's route.
  * `allowAnonymous` (`Boolean`, *defaults to `false`*) : set to `true` to allow subscribers with no valid JWT to connect.
  * `maxTopics` (`Number`, *defaults to `0`*) : maximum topics count the subscribers can subscribe to. `0` means no limit.
  * `ignorePublisherId` (`Boolean`, *defaults to `true`*) : set to `false` to accept the event ID by the publisher instead of creating a new one.
  * `publishAllowedOrigins` (`Array<String>`, *defaults to `[]`*) : a list of origins allowed to publish (only applicable when using cookie-based auth).
  * `redis` (`Object`, *optional*) : if defined, the Hub will connect to a Redis instance and use it to store the events and scale across multiple instances. This option is directly passed to the `redis.createInstance()` method of the [`redis`](https://www.npmjs.com/package/redis) npm module.

**Returns :** a new `Server` instance.

### static `Server#createFromExpressApp(app, config)` -> `Objet<http.Server, Hub>`

Creates a `http.Server` instance and a Hub from an existing Express app. The created hub is bound to the http server.

The `http.Server` instance does not immediately "listen". Calling the `http.Server#listen()` method is required.

*Note :* the Hub requires data encoded to `x-form-urlencoded`, thus the Express app **MUST** use the [`express.urlencoded()` middleware](https://expressjs.com/en/api.html#express.urlencoded) beforehand, in order to parse the requests datas.

**Arguments :**

* `app` : the Express application.
* `config` (`Object`) : the configuration to pass to the Hub. See `Hub#constructor()`.

**Returns :** an `Object` :

* `server` (`http.Server` instance) : the created http server from the Express app.
* `hub` (`Hub` instance) : the Hub that will handle the SSE connections.

### `Server#listen(port, addr)` -> `Promise<void>`

Listens to incoming subscription requests. It can be stopped with the methods `Hub#end()` or `Hub#endSync()`.

**Arguments :**

* `port` (`Number`, **required**) : the port which the hub will listen to.
* `addr` (`String`, *defaults to `'0.0.0.0'`*) : the listening bound address.

**Returns :** a `Promise` resolving when the server has started listening.

### `Server#end(opts)` -> `Promise<void>`

Gracefully stops the hub **asynchronously**. This will close the connections to the subscribers.

**Arguments :**

* `opts` (`Object`, *optional*) :
  * `force` (`Boolean`, *defaults to `false`*) : set to `true` to forcefully close all connections.

**Returns :** a `Promise` resolving when the hub is stopped.

### `Server#endSync()` -> `void`

*Forcefully* stops the hub **synchronously**.

**Arguments :** *(none)*

**Returns :** *(void)*

## Publisher

### `Publisher#constructor(config || hub)` -> `Publisher`

Initializes a new publisher, ready to send messages to its hub.

**Arguments :**

* The 1st and only argument is **required**. It is either :
  * a `Hub` instance (for publisher that are located in the same code base as the hub).
  * a configuration `Object` : (usually for remote publishers)
    * `protocol` (`String`, *defaults to `'https'`*)
    * `host` (`String`, **required**)
    * `port` (`Number`, *defaults to `80`*)
    * `path` (`String`, *defaults to `'/.well-known/mercure'`*)
    * `jwt` (`String`, **required**)
    * `rsaPrivateKey` (`String`, *optional*) : 

### `Publisher#publish(topics, message, options)` -> `Promise<String>`

Sends a message to the hub. The hub will dispatch the event to the appropriate subscribers.

**Arguments :**

* `topics` (`Array<String> || String`, **required**) : the topics of the publication.
* `message` (`String`, **required**) : The content to send to the subscribers.
* `options` (`Object`, *optional*) :
  * `targets` (`Array<String> || String`, *optional*) : the targets that will receive the update. Passing nothing will publish the update to all subscribers.
  * `id` (`String`, *optional*) : the ID to give to the sent update. The server can discard it if it's configured to do so.
  * `type` (`String`, *defaults to `'message'`*) : the type of the event to send to the subscribers.
  * `retry` (`Number`, *optional*) : the reconnection cooldown  to send to the subscribers.
  * `allTargets` (`Boolean`, *optional*) : set to `true` to dispatch the update to all subscribers. Only available when the publisher is directly linked to the Hub instance.

**Returns :** a `Promise` resolving the event ID when the message has been sent to the hub.

### `Publisher#useEncryption(config)` -> `Promise<Object<String, String>>`

Allows encryption of the sent update to the Hub.

**Arguments :**

* `config` (`Object`, *optional*)
  * `rsaPrivateKey` (`String`, *optional*) : the private RSA key that will be used to cypher the messages. If nothing is passed, the method will use the key passed in the class constructor. If nothing was passed, the method generates a new RSA public/private key pair.

**Returns :** a `Promise` resolving an `Object` when the encryption mechanism is ready :

* `rsaPrivateKey` (`String`) : the used RSA private key.
* `rsaPublicKey` (`String`) : the public RSA key, calculated from the private RSA key.

### `Publisher#getClaims()` => `Object`

Decodes the stored JWT used to send updates. If no JWT is used (e.g.: the Publisher is created with a `Hub` instance), returns `null`.

**Arguments :** *(none)*

**Returns :** an `Object` containing the decoded JWT's payload.
