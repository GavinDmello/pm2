
'use strict';

var WebSocket = require('ws');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var util = require('util');
var log = require('debug')('interactor:ws');
var cst = require('../../constants.js');
var Utility = require('./Utility.js');

/**
 * Websocket Transport used to communicate with KM
 * @param {Object} opts options
 * @param {Daemon} daemon Interactor instance
 */
var WebsocketTransport = module.exports = function (opts, daemon) {
  this.opts = opts;
  this._daemon = daemon;
  this._ws = null;

  // instanciate the eventemitter
  EventEmitter2.call(this, {
    wildcard: true,
    delimiter: ':'
  });
};

util.inherits(WebsocketTransport, EventEmitter2);

/**
 * Connect the websocket client to a url
 * @param {String} url where the client will connect
 * @param {Function} cb invoked with <err>
 */
WebsocketTransport.prototype.connect = function (url, cb) {
  var self = this;
  // cipher metadata to prove that we have the secret key
  var data = this._daemon.getSystemMetadata();
  data = Utility.Cipher.cipherMessage(JSON.stringify(data), this.opts.SECRET_KEY);

  this._host = url;
  this._ws = new WebSocket(url, {
    perMessageDeflate: false,
    headers: {
      'X-KM-PUBLIC': this.opts.PUBLIC_KEY,
      'X-KM-DATA': data,
      'X-KM-SERVER': this.opts.MACHINE_NAME,
      'X-PM2-VERSION': this.opts.PM2_VERSION
    }
  });

  function onError (err) {
    return cb(err);
  }
  this._ws.once('error', cb);
  this._ws.once('open', cb);

  this._ws.on('close', this._onClose.bind(this));
  this._ws.on('error', this._onError.bind(this));
  this._ws.on('message', this._onMessage.bind(this));
};

/**
 * Disconnect the websocket client
 */
WebsocketTransport.prototype.disconnect = function () {
  if (this.isConnected()) {
    this._ws.close(1000, 'Disconnecting');
  }
};

/**
 * Disconnect and connect to a url
 * @param {String} url where the client will connect [optionnal]
 * @param {Function} cb invoked with <err>
 */
WebsocketTransport.prototype.reconnect = function (url, cb) {
  if (typeof url === 'function') {
    cb = url;
    url = this._host;
  }

  this.disconnect();
  this.connect(url, cb);
};

/**
 * Is the websocket connection ready
 * @return {Boolean}
 */
WebsocketTransport.prototype.isConnected = function () {
  return this._ws && this._ws.readyState === 1;
};

// PRIVATE METHODS //

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype._onClose = function (code, reason) {
  this.emit('close', code, reason);
};

/**
 * Broadcast the error event from websocket connection
 * and eventually close the connection if it isnt already
 * @private
 * @param {Error} err
 */
WebsocketTransport.prototype._onError = function (err) {
  // close connection if needed
  if (this.isConnected()) {
    this._ws.close(400, err.message);
  }
  this.emit('error', err);
};

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype._onMessage = function (data, flags) {
  // ensure that all required field are present
  if (!data || !data.version || !data.payload || !data.channel) {
    return log('Received message without all necessary fields');
  }
  this.emit(data.channel, data.payload);
};

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype.ping = function (data) {
  log('Sending ping request to remote');
  try {
    this._ws.ping(JSON.stringify(data), true, false);
  } catch (err) {
    // connection is closed
    this.emit('error', err);
  }
};

/**
 * Send data to ws endpoint
 * @param {String} channel
 * @param {Object} data
 */
WebsocketTransport.prototype.send = function (channel, data) {
  if (!channel || !data) {
    return log('Trying to send message without all necessary fields');
  }
  if (!this.isConnected()) {
    return log('Trying to send data while not connected');
  }

  log('Sending packet over for channel %s', channel);
  var packet = {
    version: cst.PROTOCOL_VERSION,
    payload: data,
    channel: channel
  };
  this._ws.send(JSON.stringify(packet), {
    compress: cst.COMPRESS_PROTOCOL || false
  }, function (err) {
    if (err) {
      console.error(err);
    }
    // TODO: add fixed queue of packet to allow retry if network fail
  });
};
