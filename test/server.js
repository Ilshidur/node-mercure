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
});

(async () => {

  await server.listen(3000);

  // === TEST ===

  // const publisher = new Publisher(server.hub);

  const jwt = await server.generatePublishJwt(['http://localhost:3000/books/{id}']);
  const publisher = new Publisher({
    protocol: 'http', // or 'https'
    host: 'localhost',
    port: 3000,
    path: '/hub',
    jwt,
  });

  console.log('Using encryption ...');
  // await publisher.useEncryption({}); // TODO: set RSA private key
  console.log('Generated keys !');

  server.hub.on('subscribe', (subscriber) => {
    console.log('New subscriber');
  });

  server.hub.on('unsubscribe', (subscriber) => {
    console.log('Subscriber left');
  });

  server.hub.on('publish', (update, id) => {
    // console.log('Published', update);
  });

  setInterval(async () => {
    const data = {
      '@id': 'http://localhost:3000/books/666.jsonld' // TODO: Using JSON-LD
    };

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

    console.log('Published', updateId);
  }, 5000);

})()
  .catch(console.error.bind(console));
