# API documentation

TODO: API documentation
TODO: Summary section

![Classes preview](classes-preview.jpg "Classes preview")

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
  * `path` (`String`, *defaults to `'/hub'`*) : the hub's route.
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

### `Hub#authorizeSubscribe(req)` -> `Promise<Object>`

### `Hub#end(opts)` -> `Promise<void>`

### `Hub#endSync()` -> `void`

### `Hub#changeJwtKey()` -> `Promise<void>`

### `Hub#killSwitch()` -> `Promise<void>`

## Server

### `Server#constructor(config)` -> `Server`

### static `Server#createFromExpressApp(app, config)` -> `Objet<http.Server, Hub>`

### static `Server#publishEndpointHandler()` -> `(req, res, next) => {}`

### `Server#listen()` -> `Promise<void>`

### `Server#end(opts)` -> `Promise<void>`

### `Server#endSync()` -> `void`

## Publisher

### `Publisher#constructor(config || hub)` -> `Publisher`

### `Publisher#publish(topics, message, options)` -> `Promise<String>`

### `Publisher#useEncryption(config)` -> `Promise<Object<String, String>>`
