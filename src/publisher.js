const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jose = require('node-jose');
const util = require('util');
const querystring = require('querystring');

const { isJwt } = require('./util');

function validateConfig(config) {
  const validatedConfig = config;

  // Required configurations
  if (!validatedConfig.host) {
    throw new Error('Missing host');
  }
  if (!validatedConfig.jwt) {
    throw new Error('Missing jwt');
  }

  // Defaults
  if (!validatedConfig.protocol) {
    validatedConfig.protocol = 'https';
  }
  if (!validatedConfig.port) {
    validatedConfig.port = 80;
  }
  if (!validatedConfig.path) {
    validatedConfig.path = '/.well-known/mercure';
  }

  // Validations
  if (!['http', 'https'].includes(validatedConfig.protocol)) {
    throw new Error('Invalid protocol', validatedConfig.protocol);
  }
  if (!Number.isInteger(validatedConfig.port)) {
    throw new Error('Invalid port', validatedConfig.port);
  }
  if (!validatedConfig.path.startsWith('/')) {
    throw new Error('Path must start with "/"');
  }
  if (!isJwt(validatedConfig.jwt)) {
    throw new Error('Invalid jwt', validatedConfig.jwt);
  }

  return validatedConfig
}

class Publisher {
  constructor(config = {}) {
    if (config.isMercureHub) {
      this.hub = config;
    } else {
      this.config = validateConfig(config)
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
      return null;
    }

    let rsaPublicKey;
    if (this.config && this.config.rsaPrivateKey) {
      rsaPrivateKey = this.config.rsaPrivateKey
    }
    if (!rsaPrivateKey) {
      // If no RSA public key is provided, generate a new one.
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

    // Creating private JSON Web Key.
    const privateJwk = await jose.JWK.asKey(rsaPrivateKey, 'pem');
    // Store the JWK in a keystore in order to publish encrypted messages later.
    this.keystore = await jose.JWK.asKeyStore({
      keys: [privateJwk],
    });
    this.kid = privateJwk.kid;

    return {
      rsaPrivateKey,
      rsaPublicKey,
    };
  }

  async publish(topics, message, options = {}) {
    if (this.hub) {
      return await this.hub.dispatchUpdate(topics, message, options)
    }

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

  getClaims() {
    if (this.hub) {
      return null
    }

    return jwt.decode(this.config.jwt);
  }
}

module.exports = Publisher;
