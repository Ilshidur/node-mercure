const EventEmitter = require('events');

const Update = require('./update');

class History extends EventEmitter {
  constructor(redisClient, pub, sub) {
    super();

    if (redisClient && pub && sub) {
      this.redisClient = redisClient;
      this.sub = sub;
      this.pub = pub;
    }

    if (!this.hasRedis) {
      this.updates = [];
    }
  }

  get hasRedis() {
    return !!this.pub && !!this.sub;
  }

  async push(update) {
    if (!this.running) {
      return;
    }

    if (this.hasRedis) {
      const serializedUpdate = update.serialize();
      await this.pub.publishAsync('mercure-events', serializedUpdate);
      this.redisClient.rpushAsync('mercure-events', serializedUpdate);
    } else {
      this.updates.push(update);
      this.emit('update', update);
    }
  }

  async getUpdates() {
    if (this.hasRedis) {
      const entries = await this.redisClient.lrangeAsync('mercure-events', 0, -1);
      return entries.map(entry => JSON.parse(entry));
    }
    return this.updates;
  }

  async findFor(subscriber) {
    const updates = await this.getUpdates();

    let afterLastEventId = false;

    return updates.filter((update) => {
      if (!afterLastEventId) {
        if (update.event.id === subscriber.lastEventId) {
          afterLastEventId = true;
        }
        return false;
      }

      return subscriber.canReceive(update);
    });
  }

  async start() {
    if (this.hasRedis) {
      this.sub.on('message', (subject, message) => {
        if (subject === 'mercure-events') {
          this.emit('update', Update.unserialize(message));
        }
      });

      await this.sub.subscribeAsync('mercure-events');
    }

    this.running = true;
  }

  async end({ force = false } = {}) {
    if (this.hasRedis) {
      if (force) {
        this.pub.end(false);
        this.sub.end(false);
      } else {
        await this.pub.quitAsync();
        await this.sub.quitAsync();
      }
    }
    this.running = false;
  }

  endSync() {
    if (this.hasRedis) {
      this.pub.end(false);
      this.sub.end(false);
    }
    this.running = false;
  }
}

module.exports = History;
