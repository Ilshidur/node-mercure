/**
 * In-memory store with option to sync with a Redis instance (acts as service discovery).
 */
class SubscribersStore {
  constructor(id, redisClient) {
    this.id = id;
    this.redisClient = redisClient;
    this.list = new Set();
  }

  getRedisKey() {
    return 'mercure-subscribers';
  }

  async syncRedis() {
    await this.redisClient.HMSETAsync(this.getRedisKey(), {
      [`process-${this.id}`]: JSON.stringify(this.getList().map(s => s.toValue()))
    });
  }

  getCount() {
    return this.list.size;
  }

  async getTotalCount() {
    if (!this.redisClient) {
      throw new Error(`Can't determine total subscribers count without Redis set up.`);
    }
    return (await this.getFullList()).length;
  }

  getList() {
    return Array.from(this.list);
  }

  async getFullList() {
    if (!this.redisClient) {
      throw new Error(`Can't get full subscribers list without Redis set up.`);
    }
    const list = await this.redisClient.HVALSAsync(this.getRedisKey());
    return list
      .map(subscribers => subscribers && JSON.parse(subscribers))
      .reduce((result, subscribers) => [ ...result, ...(subscribers || []) ], []);
  }

  async add(subscriber) {
    this.list.add(subscriber);

    if (this.redisClient) {
      await this.syncRedis();
    }
  }

  async delete(subscriber) {
    this.list.delete(subscriber);

    if (this.redisClient) {
      await this.syncRedis();
    }
  }

  async clear(all = false) {
    this.clearSync(all);

    if (this.redisClient) {
      await this.syncRedis();
    }
  }

  clearSync(all) {
    for (const subscriber of this.getList()) {
      if (all || !subscriber.allTargetsAuthorized) {
        subscriber.closeConnection();
        this.list.delete(subscriber);
      }
    }
  }
}

module.exports = SubscribersStore;
