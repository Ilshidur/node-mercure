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

const defaultOptions = {
  path: '/hub',
  allowAnonymous: false, // Don't force subscriber authorization.
  maxTopics: 0,
  ignorePublisherId: true,
  publishAllowedOrigins: null,
};

const initializeClient = SSE.Client.prototype.initialize;
SSE.Client.prototype.initialize = () => {}; // Noop this in order to defer the client initialization.

function createHttpServer() {
  return http.createServer();
}

// One Hub per server, thus one per publisher.
class Hub extends EventEmitter {
  constructor(server, options) {
    super();

    this.options = {
      ...defaultOptions,
      ...options || (typeof server.listen !== 'function' ? server : {})
    };

    if (!this.options.jwtKey) {
      throw new Error('Missing "jwtKey" option.');
    }

    this.server = typeof server.listen === 'function' ? server : createHttpServer();

    this.redis = null;
    if (this.options.redis) {
      this.redis = createRedisClient(this.options.redis);
    }

    this.subscribers = new Set(); // TODO: Store in Redis
    this.history = new History(this.redis);
  }

  get isMercureHub() {
    return true;
  }

  getSubscribersCount() {
    return this.subscribers.size;
  }

  authorize(req) {
    return authorize(req, this.options.jwtKey, this.options.publishAllowedOrigins);
  }

  async listen(port, addr = null) {
    await new Promise((resolve, reject) => {
      try {
        this.server.listen(port, addr, resolve);
      } catch (err) {
        reject(err);
      }
    });

    // TODO: Try to NOT immediately set the headers.
    const sse = new SSE(this.server, {
      path: this.options.path,
      verifyRequest: (req) => req.url.startsWith('/hub') && (req.method === 'GET' || req.method === 'HEAD')
    });

    this.history.on('update', (update) => {
      const subscribers = Array.from(this.subscribers).filter(subscriber => subscriber.canReceive(update))

      // TODO: Send event to subscribers in ONE TIME.
      for (const subscriber of subscribers) {
        subscriber.send(update);
      }

      this.emit('publish', update, update.event.id);

      // TODO: options.retry
    });

    await this.history.start();

    sse.on('connection', async (client, { topic: topics }) => {
      // Check the allowed topics in the subscriber's JWT.
      let claims;
      try {
        claims = await this.authorize(client.req, null);
      } catch (err) {
        client.res.writeHead(401);
        client.res.write('Unauthorized');
        client.res.end();
        return;
      }

      if (!claims && !this.options.allowAnonymous) {
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

      if (this.options.maxTopics > 0 && topics.length > this.options.maxTopics) {
        client.res.writeHead(400);
        client.res.write(`Exceeded limit of ${this.options.maxTopics} topics`);
        client.res.end();
        return;
      }

      // Set the HTTP headers to make it a persistent connection.
      initializeClient.call(client);

      const templates = [];
      if (topics.length > 0) {
        for (const topic of topics) {
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

      const lastEventId = client.req.headers['last-event-id']
      const subscriber = new Subscriber(client, allTargetsAuthorized, authorizedTargets, templates, lastEventId);

      this.subscribers.add(subscriber);
      client.on('close', () => {
        this.subscribers.delete(subscriber);
        this.emit('unsubscribe', subscriber);
      });

      this.emit('subscribe', subscriber);

      if (subscriber.lastEventId) {
        await this.sendMissedEvents(subscriber);
      }
    });
  }

  async sendMissedEvents(subscriber) {
    const updates = await this.history.findFor(subscriber);
    for (const update of updates) {
      subscriber.send(update);
    }
  }

  async dispatchUpdate(topics, data, options = {}) {
    let updateId = options.id;
    if (!updateId || this.options.ignorePublisherId) {
      updateId = uuidv4();
    }

    let targets = options.targets || []
    if (options.allTargets) {
      targets = null
    }

    // Handle when topics is a string
    const topicsArray = Array.isArray(topics) ? topics : [topics];

    const update = new Update(targets, topicsArray, {
      data,
      id: updateId,
      type: options.type || 'message',
      retry: Number(options.retry) || 0,
    });

    await this.history.push(update);

    return updateId;
  }

  generateJwt(claims = {}) {
    return util.promisify(jwt.sign)({
      mercure: claims,
    }, this.options.jwtKey);
  }

  generatePublishJwt(targets = []) {
    return this.generateJwt({
      publish: targets,
    });
  }

  generateSubscribeJwt(targets = []) {
    return this.generateJwt({
      subscribe: targets,
    });
  }

  // In case of compromission of the JWT key.
  changeJwtKey(jwtKey) {
    this.options.jwtKey = jwtKey;

    // Force re-authentication on subscribers that can only
    // subscribe to certain topics.
    for (const subscriber of this.subscribers) {
      if (!subscriber.allTargetsAuthorized) {
        subscriber.closeConnection();
      }
    }
  }

  // Generates random 256 bytes JWT and outputs it in the console.
  killSwitch() {
    const buffer = crypto.randomBytes(256); // Using sync function on purpose.
    const jwtKey = buffer.toString('hex');
    console.log(`====================================\n\n\tNEW JWT KEY :\n\n${jwtKey}\n\n====================================`);
    this.changeJwtKey(jwtKey);
  }

  async end({ force = false } = {}) {
    if (!force) {
      for (const subscriber of this.subscribers) {
        subscriber.closeConnection();
      }
    }

    if (force) {
      this.redis.end();
    } else {
      await this.redis.quitAsync();
    }

    await this.history.end({ force });
    await this.server.close();
  }
}

module.exports = Hub;
