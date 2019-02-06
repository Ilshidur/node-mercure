const axios = require('axios');
const crypto = require('crypto');
const jose = require('node-jose');
const util = require('util');
const querystring = require('querystring');

const { isJwt } = require('./util');

class Publisher {
  constructor(config = {}) {
    if (config.isMercureHub) {
      this.hub = config;
    } else {
      this.config = config;

      // Required configurations
      if (!this.config.host) {
        throw new Error('Missing host');
      }
      if (!this.config.jwt) {
        throw new Error('Missing jwt');
      }

      // Defaults
      if (!this.config.protocol) {
        this.config.protocol = 'https';
      }
      if (!this.config.port) {
        this.config.port = 80;
      }
      if (!this.config.path) {
        this.config.path = '/hub';
      }

      // Validations
      if (!['http', 'https'].includes(this.config.protocol)) {
        throw new Error('Invalid protocol', this.config.protocol);
      }
      if (!Number.isInteger(this.config.port)) {
        throw new Error('Invalid port', this.config.port);
      }
      if (!this.config.path.startsWith('/')) {
        throw new Error('Path must start with "/"');
      }
      if (!isJwt(this.config.jwt)) {
        throw new Error('Invalid jwt', this.config.jwt);
      }
    }
  }

  // Will encrypt each POST message between the publisher and the Mercure server.
  async useEncryption({
    rsaPrivateKey = null,
    // TODO: Support jwks
    passphrase = null
    // TODO: Support RSA key passphrase
  } = {}) {
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
            type: 'pkcs1',
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

      if (!rsaPublicKey) {
        const key = crypto.createPublicKey(rsaPrivateKey);
        rsaPublicKey = key.export({ type: 'pkcs1', format: 'pem' });
      }

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
      return await this.hub.dispatchUpdate(topics, message, options)
    } else {
      if (this.keystore) {
        // Message can be encrypted.

        // Currently only supports 1 key-value pair.
        const publicJwk = this.keystore.get(this.kid, { kty: 'RSA' });
        message = await jose.JWE.createEncrypt({ format: 'compact' }, publicJwk).update(message).final();
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

      try {
        const response = await axios.post(url, querystring.stringify(data), {
          headers: {
            'Authorization': `Bearer ${this.config.jwt}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return response.data;
      } catch (err) {
        if (err.response) {
          throw new Error(`${err.response.status} ${err.response.statusText} : ${err.response.data}`);
        }
        throw err;
      }
    }
  }
}

module.exports = Publisher;
