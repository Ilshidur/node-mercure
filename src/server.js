const express = require('express');
const http = require('http');

const Hub = require('./hub');
const Publisher = require('./publisher');
const { getAuthorizedTargets } = require('./authorization');

/**
 * Mercure server built on Express.
 */
class Server {
  constructor(config = {}) {
    this.config = {
      path: '/hub',
      ...config
    };
    this.app = express();

    if (typeof this.configure === 'function') {
      this.configure.call(this);
    }

    this.app.use(express.urlencoded({ extended: true }));

    const { server, hub } = Server.createFromExpressApp(this.app, this.config);
    this.server = server;
    this.hub = hub;
  }

  static createFromExpressApp(app, config) {
    app.post('/hub', Server.publishEndpointHandler(app));

    const server = http.Server(app);

    const hub = new Hub(server, config);
    app.set('hub', hub);

    return { server, hub };
  }

  static publishEndpointHandler(app) {
    return async (req, res) => {
      const hub = app.get('hub');

      // Authorize publisher
      let claims;
      try {
        claims = await hub.authorize(req);
      } catch (err) {
        return res.status(401).send('Unauthorized');
      }
      if (!claims) {
        return res.status(403).send('Forbidden');
      }

      const { topic, data, target: targets, id, type, retry } = req.body;

      if (!topic || topic === '') {
        return res.status(400).send('Missing "topic" parameter in body');
      }
      if (!data || data === '') {
        return res.status(400).send('Missing "data" parameter in body');
      }

      if (hub.config.maxTopics > 0 && topics.length > hub.config.maxTopics) {
        return res.status(400).send(`Exceeded limit of ${hub.config.maxTopics} topics`);
      }

      // TODO: retry
      // TODO: Validate type

      // TODO: Validate input

      const { allTargetsAuthorized, authorizedTargets } = getAuthorizedTargets(claims, true);

      const targetsArray = Array.isArray(targets) ? targets : [targets];

      // Checking if all targets are authorized.
      for (const target of targetsArray) {
        if (!allTargetsAuthorized) {
          if (!authorizedTargets.includes(target)) {
            return res.status(401).send('Unauthorized');
          }
        }
      }

      const publisher = new Publisher(hub);
      const updateId = await publisher.publish(topic, data, {
        allTargets: allTargetsAuthorized,
        targets,
        ...id ? { id } : {},
        ...type ? { type } : {},
        ...retry ? { retry } : {},
      });

      return res.status(200).send(updateId);
    };
  }

  async listen(port, addr = null) {
    await this.hub.listen(port, addr);
  }

  generatePublishJwt(...args) {
    return this.hub.generatePublishJwt(...args);
  }

  generateSubscribeJwt(...args) {
    return this.hub.generateSubscribeJwt(...args);
  }

  async end({ force = false } = {}) {
    await this.hub.end({ force });
  }

  endSync() {
    return this.hub.endSync();
  }
}

module.exports = Server;
