# Description

This module controls Schneider Electric/Merten/Ritto Wiser Door products, using the same SIP-based protocol the official app uses as well.
It is used by [@unwise-door/unwise-mqtt-bridge](https://github.com/unwise-door/unwise-mqtt-bridge), which helps to integrate these products into home automation systems like OpenHAB.

## Usage Example

```js
    const WiserDoorController = require("@unwise-door/unwise-controller").WiserDoorController;

    const controller = new WiserDoorController({
      // IP of Wiser Door device
      "host": "...",
      // Internal user as configured in Wiser Door device
      "sipUser": "...",
      "sipPassword": "...",
      "unlockPassword": "..."
    });

    await controller.connect();

    // example: get list of door bell rings
    const historyList = await controller.getHistoryList();

    // example: retrieve picture data for most recent door bell ring
    const historyPhoto = await controller.getHistoryPhoto(historyList[0].id);

    // example: unlock door
    await controller.unlock();
```

## Relation to Schneider Electric/Merten/Ritto
This project is not affiliated with Schneider Electric/Merten/Ritto.

All product and company names are trademarks™ or registered® trademarks of their respective holders. 
Use of them does not imply any affiliation with or endorsement by them. 