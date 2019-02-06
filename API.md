# API documentation

TODO: API documentation

## Hub

### `Hub#constructor(server, config)` -> `Hub`

### `Hub#listen(port, addr)` -> `Promise<void>`

### `Hub#dispatchUpdate(topics, data, config)` -> `Promise<Number>`

### `Hub#generateJwt(claims, key)` -> `Promise<String>`

### `Hub#generatePublishJwt(targets)` -> `Promise<String>`

### `Hub#generateSubscribeJwt(targets)` -> `Promise<String>`

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
