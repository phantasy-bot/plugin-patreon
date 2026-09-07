
export class BasePlugin {
  async onInit() {}
  getConfig() { return {}; }
  isEnabled() { return true; }
  async onConfigUpdated() {}
}
