class Update {
  constructor(targets, topics, event) {
    this.targets = targets;
    this.topics = topics;
    this.event = event;
  }

  serialize() {
    return this.event;
  }
}

module.exports = Update;
