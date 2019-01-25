const axios = require('axios');
const crypto = require('crypto');
const jose = require('node-jose');
const util = require('util');
const querystring = require('querystring');

class Publisher {
  constructor(config = {}) {
    if (config.isMercureHub) {
      this.hub = config;
    } else {
      // TODO: Check protocol, host, port, path, jwt.
      this.config = config;
    }
  }

  // Will encrypt each POST message between the publisher and the Mercure server.
  async useEncryption({
    rsaPrivateKey = null
    // TODO: Support jwks
  } = {}) {
    // TODO: Uncomment
    if (this.hub) {
      // If the Hub is in the same code base as the publisher, no need to encrypt.
      // This assumes that the Hub is handled by the developer, so it shall be trusted.
      // Moreover, it would be overkill to encrypt each message in order to
      return null;
    }

    if (!this.config || !this.config.encryptionKey) {
      let rsaPublicKey;
      if (!rsaPrivateKey) {
        const { publicKey, privateKey } = await util.promisify(crypto.generateKeyPair)('rsa', {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            // TODO: USE CYPHER
            // cipher: 'aes-256-cbc',
            // passphrase: 'top secret'
          },
        });
        rsaPrivateKey = privateKey;
        rsaPublicKey = publicKey;
      }

      // TODO: Extract public key from private key

      const privateJwk = await jose.JWK.asKey(rsaPrivateKey, 'pem');
      const jwks = {
        keys: [privateJwk],
      };
      this.keystore = await jose.JWK.asKeyStore(jwks);
      this.kid = privateJwk.kid;

      return {
        rsaPrivateKey,
        rsaPublicKey,
        jwks,
      };
    }
  }

  async publish(topics, message, options = {}) {
    if (this.hub) {
      return this.hub.dispatchUpdate(topics, message, options)
    } else {
      if (this.keystore) {
        // Message can be encrypted.

        // Currently only supports 1 key-value pair.
        const publicJwk = this.keystore.get(this.kid, { kty: 'RSA' });
        message = await jose.JWE.createEncrypt({ format: 'compact' }, publicJwk).update(message).final();

        // // Decrypting :
        // const decrypted = await jose.JWE.createDecrypt(this.keystore).decrypt(encryptedData);
        // console.log(JSON.parse(decrypted.plaintext.toString()));
      }

      const url = `${this.config.protocol}://${this.config.host}:${this.config.port}${this.config.path}`;
      const data = {
        data: message,
        topic: topics,
        ...options.targets ? { target: options.targets }: {},
        ...options.id ? { id: options.id }: {},
        ...options.type ? { type: options.type }: {},
        ...options.retry ? { retry: options.retry }: {},
      };
      const response = await axios.post(url, querystring.stringify(data), {
        headers: {
          'Authorization': `Bearer ${this.config.jwt}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    }
  }
}

module.exports = Publisher;
