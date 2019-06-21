const { Server, Publisher } = require('../src');

const server = new Server({
  jwtKey: '!UnsecureChangeMe!',
  path: '/hub',
  // Additional check for POST request made in a browser :
  publishAllowedOrigins: ['http://localhost:3000'],
  allowAnonymous: true, // Don't force subscriber authorization.
  maxTopics: 0, // Not limits
  ignorePublisherId: true,
  publishAllowedOrigins: null,
  redis: {
    host: 'localhost',
    port: 6379,
  },
  prometheus: {
    host: 'localhost',
    port: 9090,
  },
});

process.on('SIGTERM', () => {
  console.log('Ending server ...');
  server.endSync();
});
process.on('SIGINT', () => {
  console.log('Ending server ...');
  server.end();
});

(async () => {
  await server.listen(Number(process.argv[2]) || 3000);

  // === TEST ===

  const crypto = require('crypto');
  const util = require('util');

  const jwt = await server.hub.generatePublishJwt(['http://localhost:3000/books/{id}']);
  // const publisher = new Publisher({
  //   protocol: 'http', // or 'https'
  //   host: 'localhost',
  //   port: 3000,
  //   path: '/hub',
  //   jwt,
  // });
  const publisher = new Publisher(server.hub);

  console.log('Using encryption ...');
  // await publisher.useEncryption({
  //   rsaPrivateKey: (await util.promisify(crypto.generateKeyPair)('rsa', {
  //     modulusLength: 4096,
  //     privateKeyEncoding: {
  //       type: 'pkcs8',
  //       format: 'pem',
  //     },
  //   })).privateKey,
  // });
  console.log('Generated keys !');

  server.hub.on('connect', ({ topics }) => {
    console.log('Connection established');
    // console.log(topics);
  });

  server.hub.on('subscribe', ({ subscriber, topics }) => {
    console.log('Subscriber joined');
    // console.log(subscriber);
    // console.log(topics);
  });

  server.hub.on('unsubscribe', ({ subscriber, topics }) => {
    console.log('Subscriber left');
    // console.log(subscriber);
    // console.log(topics);
  });

  server.hub.on('publish', ({ event, subscribers }) => {
    console.log('Published');
    console.log(event);
    console.log(subscribers);
  });

  server.hub.on('scale-up', (update) => {
    console.log('Scaling up !');
  });
  server.hub.on('scale-down', (update) => {
    console.log('Scaling down !');
  });

  let interval

  server.hub.on('stopping', (update, id) => {
    clearInterval(interval);
  });
  server.hub.on('stopped', (update, id) => {
    clearInterval(interval);
  });

  interval = setInterval(async () => {
    if (await server.hub.subscribers.getTotalCount() === 0) {
      return;
    }
    if (process.env.pm_id && process.env.pm_id !== '0') {
      return;
    }

    const data = {
      '@id': 'http://localhost:3000/books/666.jsonld',
    };

    try {
      const updateId = await publisher.publish(
        ['http://localhost:3000/books/666'],
        JSON.stringify(data),
        {
          // allTargets: true // Only available on same instance publishers, ignored otherwise.
          // Not public, so sending with specific targets :
          targets: ['http://localhost:3000/books/{id}'],
          id: 'wesh',
          type: 'message',
          retry: 1000,
        },
      );

      // console.log('Published', updateId);
    } catch (err) {
      console.error('[Publisher]', err);
    }
  }, 5000);

})()
  .catch(console.error.bind(console));
