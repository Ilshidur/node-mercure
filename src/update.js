class Update {
  constructor(targets, topics, event) {
    this.targets = targets;
    this.topics = topics;
    this.event = event;
  }

  serialize() {
    return JSON.stringify({
      targets: this.targets,
      topics: this.topics,
      event: this.event,
    });
  }

  static unserialize(str) {
    const data = JSON.parse(str);
    return new Update(data.targets, data.topics, data.event);
  }
}

module.exports = Update;
