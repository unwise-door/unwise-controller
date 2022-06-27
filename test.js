const fs = require('fs').promises;
const WiserDoorController = require('./src/WiserDoorController');

class TestController {
  async getConfig() {
    const config = await fs.readFile('./unwise-config.json');
    return JSON.parse(config);
  }

  async run() {
    const config = await this.getConfig();
    console.log(config.wiserdoor);
    const controller = new WiserDoorController(config.wiserdoor);
    await controller.connect();

    const historyCount = await controller.getHistoryCount();
    console.log('historyCount', historyCount);

    const historyList = await controller.getHistoryList();
    console.log('historyList', historyList);

    const historyPhoto = await controller.getHistoryPhoto(historyList[0].id);
    console.log('historyPhoto', historyPhoto);
  }
}

new TestController().run();
