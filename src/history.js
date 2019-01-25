class History {
  constructor() {
    // TODO: Store this in a scalable way.
    this.updates = [];
  }

  push(update) {
    this.updates.push(update);
  }

  findFor(subscriber) {
    let afterLastEventId = false;

    return this.updates.filter((update) => {
      if (!afterLastEventId) {
        if (update.event.id === subscriber.lastEventId) {
          afterLastEventId = true;
          return false;
        }
      }

      return subscriber.canReceive(update);
    });
  }
}

module.exports = History;
