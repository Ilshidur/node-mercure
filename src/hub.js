const crypto = require('crypto');
const EventEmitter = require('events');
const http = require('http');
const jwt = require('jsonwebtoken');
const SSE = require('sse');
const uriTemplates = require('uri-templates');
const util = require('util');
const uuidv4 = require('uuid/v4');

const { authorize, getAuthorizedTargets } = require('./authorization');
const Subscriber = require('./subscriber');
const Update = require('./update');
const History = require('./history');
const { createRedisClient } = require('./redis');
const SubscribersStore = require('./subscribers_store');

const defaultOptions = {
  id: uuidv4(),
  path: '/hub',
  allowAnonymous: false, // Don't force subscriber authorization.
  maxTopics: 0,
  ignorePublisherId: true,
  publishAllowedOrigins: null,
};

const initializeClient = SSE.Client.prototype.initialize;
SSE.Client.prototype.initialize = () => {}; // Noop this in order to defer the client initialization.

// TODO: Handle CORS

// One Hub per server, thus one per publisher.
class Hub extends EventEmitter {
  constructor(server, config) {
    super();

    this.config = {
      ...defaultOptions,
      ...config || (typeof server.listen !== 'function' ? server : {})
    };

    if (!this.config.jwtKey && (!this.config.pubJwtKey || !this.config.subJwtKey)) {
      throw new Error('Missing "jwtKey" or "pubJwtKey"/"subJwtKey" option.');
    }
    if (this.config.jwtKey && (this.config.pubJwtKey || this.config.subJwtKey)) {
      throw new Error('"jwtKey" and "pubJwtKey"/"subJwtKey" cannot be passed in the same time.');
    }

    this.server = typeof server.listen === 'function' ? server : http.createServer();

    this.redis = null;
    if (this.config.redis) {
      this.redis = createRedisClient(this.config.redis);
    }

    this.subscribers = new SubscribersStore(this.config.id, this.redis);
    this.history = new History(this.redis);
  }

  get isMercureHub() {
    return true;
  }

  hasRedis() {
    return !!this.redis;
  }

  authorizePublish(req) {
    return authorize(req, this.config.pubJwtKey || this.config.jwtKey, this.config.publishAllowedOrigins);
  }
  authorizeSubscribe(req) {
    return authorize(req, this.config.subJwtKey || this.config.jwtKey, this.config.publishAllowedOrigins);
  }

  async onSseConnection(client, { topic: topics, 'Last-Event-ID': queryLastEventId }) {
    // Check the allowed topics in the subscriber's JWT.
    let claims;
    try {
      claims = await this.authorizeSubscribe(client.req);
    } catch (err) {
      client.res.writeHead(401);
      client.res.write('Unauthorized');
      client.res.end();
      return;
    }

    if (!claims && !this.config.allowAnonymous) {
      client.res.writeHead(403);
      client.res.write('Forbidden');
      client.res.end();
      return;
    }

    if (!topics) {
      client.res.writeHead(400);
      client.res.write('Missing "topic" parameter');
      client.res.end();
      return;
    }

    const topicsArray = Array.isArray(topics) ? topics : [topics];
    if (this.config.maxTopics > 0 && topicsArray.length > this.config.maxTopics) {
      client.res.writeHead(400);
      client.res.write(`Exceeded limit of ${this.config.maxTopics} topics`);
      client.res.end();
      return;
    }

    // Set the HTTP headers to make it a persistent connection.
    initializeClient.call(client);

    const templates = [];
    if (topicsArray.length > 0) {
      for (const topic of topicsArray) {
        try {
          templates.push(uriTemplates(topic));
        } catch (err) {
          console.error(err);
          client.res.writeHead(400);
          client.res.write(`${topic} is not a valid URI template (RFC6570)`);
          client.res.end();
          return;
        }
      }
    }

    const { allTargetsAuthorized, authorizedTargets } = getAuthorizedTargets(claims, false);

    const lastEventId = client.req.headers['last-event-id'] || queryLastEventId;
    const subscriber = new Subscriber(client, allTargetsAuthorized, authorizedTargets, templates, lastEventId);

    await this.subscribers.add(subscriber);
    client.on('close', async () => {
      await this.subscribers.delete(subscriber);
      this.emit('unsubscribe', subscriber);
    });

    this.emit('subscribe', subscriber);

    if (subscriber.lastEventId) {
      const updates = await this.history.findFor(subscriber);
      for (const update of updates) {
        subscriber.send(update);
      }
    }
  }

  async listen(port, addr = '0.0.0.0') {
    if (!port || !Number.isInteger(port)) {
      throw new Error('Invalid port', port);
    }

    await new Promise((resolve, reject) => {
      try {
        this.server.listen(port, addr, resolve);
      } catch (err) {
        reject(err);
      }
    });

    const sse = new SSE(this.server, {
      path: this.config.path,
      verifyRequest: (req) => req.url.startsWith('/hub') && (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS')
    });

    this.history.on('update', async (update) => {
      const subscribers = this.subscribers.getList().filter(subscriber => subscriber.canReceive(update))

      for (const subscriber of subscribers) {
        subscriber.sendAsync(update);
      }

      this.emit('publish', update, update.event.id);
    });

    await this.history.start();

    sse.on('connection', this.onSseConnection);
  }

  async dispatchUpdate(topics, data, opts = {}) {
    let updateId = opts.id;
    if (!updateId || this.config.ignorePublisherId) {
      updateId = uuidv4();
    }

    let targets = opts.targets || []
    if (opts.allTargets) {
      targets = null
    }

    // Handle when topics is a string
    const topicsArray = Array.isArray(topics) ? topics : [topics];

    const update = new Update(targets, topicsArray, {
      data,
      id: updateId,
      type: opts.type || 'message',
      retry: Number(opts.retry) || 0,
    });

    await this.history.push(update);

    return updateId;
  }

  generateJwt(claims = {}, key = null) {
    return util.promisify(jwt.sign)({
      mercure: claims,
    }, key || this.config.jwtKey);
  }

  generatePublishJwt(targets = []) {
    return this.generateJwt({
      publish: targets,
    }, this.config.pubJwtKey);
  }

  generateSubscribeJwt(targets = []) {
    return this.generateJwt({
      subscribe: targets,
    }, this.config.subJwtKey);
  }

  // In case of compromission of the JWT key(s).
  async changeJwtKey(jwtKey) {
    this.config.jwtKey = jwtKey;
    this.config.pubJwtKey = null;
    this.config.subJwtKey = null;

    // Force re-authentication on subscribers that can only
    // subscribe to certain topics.
    await this.subscribers.clear(false);
  }

  // Generates random 256 bytes JWT and outputs it in the console.
  async killSwitch() {
    const buffer = crypto.randomBytes(256); // Using sync function on purpose.
    const jwtKey = buffer.toString('hex');
    console.log(`====================================\n\n\tNEW JWT KEY :\n\n${jwtKey}\n\n====================================`);
    await this.changeJwtKey(jwtKey);
  }

  async end({ force = false } = {}) {
    if (!force) {
      await this.subscribers.clear(true);
    }

    if (this.redis) {
      if (force) {
        this.redis.end(false);
      } else {
        await this.redis.quitAsync();
      }
    }

    await this.history.end({ force });
    await this.server.close();
  }

  endSync() {
    this.subscribers.clearSync();
    this.history.endSync();
    if (this.redis) {
      this.redis.end(false);
    }
    // Server connections will be interrupted.
  }
}

module.exports = Hub;
