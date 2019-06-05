workflow "Build, Test, and Publish" {
  on = "push"
  resolves = ["Publish"]
}

action "Filter on tags" {
  uses = "actions/bin/filter@master"
  args = "tag"
}

action "Publish" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "publish --access public"
  secrets = ["NPM_AUTH_TOKEN"]
  needs = ["Filter on tags"]
}
