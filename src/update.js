class Update {
  constructor(targets, topics, event, publisher) {
    this.targets = targets;
    this.topics = topics;
    this.event = event;
    this.publisher = publisher;
  }

  serialize() {
    return JSON.stringify({
      targets: this.targets,
      topics: this.topics,
      event: this.event,
      publisher: this.publisher,
    });
  }

  static unserialize(str) {
    const data = JSON.parse(str);
    return new Update(data.targets, data.topics, data.event, data.publisher);
  }
}

module.exports = Update;
