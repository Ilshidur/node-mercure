const EventEmitter = require('events');

class Discovery extends EventEmitter {
  constructor(id, redisClient, pub, sub) {
    super();

    this.id = id;
    this.redisClient = redisClient;
    this.pub = pub;
    this.sub = sub;
  }

  async start() {
    this.sub.on('message', (subject, message) => {
      if (subject === 'mercure-instances') {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.id === this.id) {
          return
        }

        switch (parsedMessage.action) {
          case 'join':
            this.emit('scale-up', message);
            break;
          default:
            this.emit('scale-down', message);
        }
      }
    });

    await this.sub.subscribeAsync('mercure-instances');
  }

  async join() {
    await this.pub.publishAsync('mercure-instances', JSON.stringify({
      id: this.id,
      action: 'join',
    }));
  }

  async leave() {
    await this.pub.publishAsync('mercure-instances', JSON.stringify({
      id: this.id,
      action: 'leave',
    }));
  }
}

module.exports = Discovery;
