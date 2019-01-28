const bluebird = require('bluebird');
const redis = require('redis');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function createRedisClient(config) {
  return redis.createClient(config);
}

module.exports = { createRedisClient };
