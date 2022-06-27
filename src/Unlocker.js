const AES_KEY_LENGTH = 32;
const AES_BLOCK_SIZE = 16;

const crypto = require('crypto');
const util = require('util');

class Unlocker {
  constructor(pwd) {
    this.pwd = pwd;
  }

  async encrypt(data) {
    return new Promise((resolve, reject) => {
      const cipher = crypto.createCipheriv(`aes-${AES_KEY_LENGTH * 8}-ctr`, this.aesKey, this.aesIv);
      const chunks = [];
      cipher.on('readable', () => {
        let chunk;
        while ((chunk = cipher.read()) !== null) {
          chunks.push(chunk);
        }
      });
      cipher.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      cipher.on('error', (e) => {
        reject(e);
      });

      cipher.write(data);
      cipher.end();
    });
  }

  async generatePassword(serverKeyAndIv) {
    this.setServerKeyAndIv(serverKeyAndIv);
    const unlockCmd = util.format('{"c":"ol","p":"%s"}', this.pwd);
    return (await this.encrypt(unlockCmd)).toString('base64');
  }

  setServerKeyAndIv(serverKeyAndIv) {
    const serverKeyAndIvBuffer = Buffer.from(serverKeyAndIv, 'base64');
    this.aesIv = serverKeyAndIvBuffer.subarray(0, AES_BLOCK_SIZE);
    this.aesKey = serverKeyAndIvBuffer.subarray(AES_BLOCK_SIZE, AES_BLOCK_SIZE + AES_KEY_LENGTH);
  }
}

module.exports = Unlocker;
