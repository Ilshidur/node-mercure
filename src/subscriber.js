class Subscriber {
  constructor(sseClient, allTargetsAuthorized, authorizedTargets, topics, lastEventId) {
    this.sseClient = sseClient;
    this.allTargetsAuthorized = allTargetsAuthorized;
    this.authorizedTargets = authorizedTargets;
    this.topics = topics; // URI templates (RFC 6570)
    this.lastEventId = lastEventId;
  }

  toValue() {
    return {
      topics: this.topics.map(t => t.toString()),
      ip: this.sseClient.req.socket.localAddress,
      all: this.allTargetsAuthorized,
      last: this.lastEventId,
      authorized: this.authorizedTargets
    }
  }

  send(update) {
    this.sseClient.send(update.event);
  }

  async sendAsync(update) {
    this.sseClient.send(update.event);
  }

  closeConnection() {
    // Ends the response.
    this.sseClient.close();
    // Manually closes the connection.
    this.sseClient.res.emit('close');
  }

  canReceive(update) {
    return this.isAuthorized(update) && this.isSubscribed(update);
  }

  isAuthorized(update) {
    // Check if the subscriber's JWT claims a target '*' and/or wants public updates.
    if (this.allTargetsAuthorized || this.authorizedTargets.length === 0) {
      // Either :
      // - the subscriber is authorized to receive updates destined for all targets
      // - the subscriber is authorized to receive public updates
      // => Allow all updates.
      return true;
    }

    if (update.targets === null) {
      // The update can be sent to all subscribers.
      return true;
    }

    return this.authorizedTargets.some(target => update.targets.includes(target));
  }

  isSubscribed(update) {
    for (const subscriberTopic of this.topics) {
      for (const updateTopic of update.topics) {
        if (subscriberTopic.test(updateTopic)) {
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = Subscriber;
