// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Client } from '@/src/collections/client';
import { Collection } from './collection';
import { default as MongooseConnection } from 'mongoose/lib/connection';
import STATES from 'mongoose/lib/connectionstate';
import _ from 'lodash';

export class Connection extends MongooseConnection {
  debugType = 'AstraMongooseConnection';
  constructor(base: any) {
    super(base);
  }

  _waitForClient() {
    return new Promise<void>((resolve, reject) => {
      if ((this.readyState === STATES.connecting || this.readyState === STATES.disconnected) && this._shouldBufferCommands()) {
        this._queue.push({ fn: resolve });
      } else if (this.readyState === STATES.disconnected && this.db == null) {
        reject(new Error('Connection is disconnected'));
      } else {
        resolve();
      }
    });
  }

  collection(name: string, options: any) {
    if (!(name in this.collections)) {
      this.collections[name] = new Collection(name, this, options);
    }
    return super.collection(name, options);
  }

  async createCollection(name: string, options: any, callback: any) {
    try {
      await this._waitForClient();
      const db = this.client.db();
      return db.createCollection(name, options, callback);
    } catch (err) {
      if (callback != null) {
        return callback(err);
      }
      throw err;
    }
  }

  async dropCollection(name: string, callback: any) {
    try {
      await this._waitForClient();
      const db = this.client.db();
      return db.dropCollection(name);
    } catch (err) {
      if (callback != null) {
        return callback(err);
      }
      throw err;
    }
  }

  openUri(uri: string, options: any, callback: any) {
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }

    this._connectionString = uri;
    this.readyState = STATES.connecting;
    this._closeCalled = false;
    const _this = this;

    for (const model of Object.values(this.models)) {
      // @ts-ignore
      model.init(() => {});
    }

    return new Promise((resolve, reject) => {
      Client.connect(uri, function (err, client) {
        if (err) {
          _this.readyState = STATES.disconnected;
        }
        _this.client = client;
        _this.db = client.db();
        _this.readyState = STATES.connected;

        _this.onOpen();

        if (callback) {
          return callback(err, _this);
        }
        if (err) {
          return reject(err);
        }
        return resolve(_this);
      });
    });
  }

  /**
   *
   * @param cb
   * @returns Client
   */
   doClose(force?: boolean, cb?: (err: Error | undefined) => void) {
    if (cb) {
      cb(undefined);
    }
    return this;
  }

  // NOOPS and unimplemented
}
