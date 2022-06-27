const sipjsimport = import('sip.js');

const UDPTransport = require('@unwise-door/sipjs-udp-transport');
const EventEmitter = require('events');
const Unlocker = require('./Unlocker');

class WiserDoorController extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.unlocker = new Unlocker(options.unlockPassword);
    this.handlers = {};
  }

  async connect() {
    await this.sipConnect();

    if (!this.heartbeatinterval) {
      this.heartbeatinterval = setInterval(async () => {
        try {
          await this.heartbeat();
        } catch (e) {
          console.error(e); // TODO thing of a better error handling pattern
          this.sipConnect();
        }
      }, 20 * 1000);
    }
  }

  async sipConnect() {
    this.sipjs = await sipjsimport;

    this.userAgent = new this.sipjs.UserAgent({
      uri: this.sipjs.UserAgent.makeURI(`sip:${this.options.sipUser}@${this.options.host}`),
      authorizationPassword: this.options.sipPassword,
      transportConstructor: UDPTransport,
      transportOptions: {
        server: this.options.host,
        port: this.options.port,
      },
      // logLevel: 'debug',
      delegate: {
        onMessage: async (msg) => {
          const bodyString = msg.incomingMessageRequest.message.body;
          // console.log(`received ${msg.incomingMessageRequest.message.method} ${msg.incomingMessageRequest.message.cseq}: ${msg.incomingMessageRequest.message.body} `);
          const body = JSON.parse(bodyString);

          if (body.c) {
            this.emit(body.c, { body });
          }
        },
        onInvite: async (invite) => {
          this.emit('door-bell', { invite });
          invite.cancel();
        },
      },
    });

    await this.userAgent.start();
    const registerer = new this.sipjs.Registerer(this.userAgent, { viaHost: '', expires: 60 * 60 * 24 });
    const res = new Promise((resolve, reject) => {
      registerer.stateChange.addListener((state) => {
        if (state === 'Registered') { resolve(state); } else { reject(state); }
      });
    });
    await registerer.register();
    return res;
  }

  sendMessage(body) {
    const bodyString = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      new this.sipjs.Messager(this.userAgent, this.sipjs.UserAgent.makeURI(`sip:9999@${this.options.host}`), bodyString).message({
        requestDelegate: {
          onAccept: (response) => resolve(response),
          onReject: (response) => reject(response),
        },
      });
    });
  }

  async waitForReturnMessage(waitfor) {
    return new Promise((resolve, reject) => {
      const handler = ({ body }) => {
        resolve(body);
      };
      setTimeout(() => {
        this.off(waitfor, handler);
        reject(new Error(`timeout in  waitForReturnMessage(${waitfor})`));
      }, 10 * 1000);
      this.once(waitfor, handler);
    });
  }

  async sendMessageAndWaitForReturnMessage(body, waitfor) {
    const response = this.waitForReturnMessage(waitfor);
    await this.sendMessage(body);
    return response;
  }

  async heartbeat() {
    return this.sendMessageAndWaitForReturnMessage({ c: 't', timestamp: new Date().getTime() }, 'ta');
  }

  async switchCamera(cameraId) {
    return this.sendMessageAndWaitForReturnMessage({ c: 'sc', id: cameraId, timestamp: new Date().getTime() }, 'sca');
  }

  async getHistoryCount() {
    return this.sendMessageAndWaitForReturnMessage({ c: 'ghc', timestamp: new Date().getTime() }, 'ghca');
  }

  async syncHistory(id) {
    return this.sendMessageAndWaitForReturnMessage({ c: 'shs', id, timestamp: new Date().getTime() }, 'shsa');
  }

  async getHistoryList(skipUntilAfterId) {
    if (skipUntilAfterId !== undefined) {
      await this.sendMessage({ c: 'ghl', id: skipUntilAfterId, timestamp: new Date().getTime() });
    } else {
      await this.sendMessage({ c: 'ghl', timestamp: new Date().getTime() });
    }

    const response = await this.waitForReturnMessage('ghla');
    return response.list;
  }

  async getHistoryPhoto(id) {
    await this.sendMessage({
      c: 'ghp',
      id,
      tb: 0,
      timestamp: new Date().getTime(),
    });
    let receivedbytes = 0;
    let expectedbytes = -1;
    const picturedata = [];
    while (receivedbytes !== expectedbytes) {
      const body = await this.waitForReturnMessage('ghpa');
      if (body.r === 'fail') {
        throw new Error(body);
      }
      const { groups: { segmentId, data } } = /^(?<segmentId>-?\d+)##\*%@\$##(?<data>.*)/.exec(body.ct);
      if (segmentId === '-1') {
        expectedbytes = parseInt(data, 10);
      } else {
        const buffer = Buffer.from(data, 'base64');
        receivedbytes += buffer.length;
        picturedata.push({ segmentId: parseInt(segmentId, 10), buffer });
      }
    }
    // acknowledge to server
    await this.sendMessage({
      c: 'ghpa',
      id,
      r: 'ok',
      timestamp: new Date().getTime(),
    });
    // segments might have been received out-of-order, sort them first
    const buffers = picturedata.sort((a, b) => a.segmentId - b.segmentId).map((pd) => pd.buffer);
    return Buffer.concat(buffers);
  }

  async unlock() {
    const body = await this.sendMessageAndWaitForReturnMessage({ c: 'ol', p: '', timestamp: new Date().getTime() }, 'ola');
    const encryptedUnlockBody = await this.unlocker.generatePassword(body.p);
    return this.sendMessageAndWaitForReturnMessage({ c: 'ol', p: encryptedUnlockBody, timestamp: new Date().getTime() }, 'ola');
  }
}

module.exports = WiserDoorController;
