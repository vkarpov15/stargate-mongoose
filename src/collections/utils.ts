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

import _ from 'lodash';
import url from 'url';
import { ObjectId } from 'mongodb';
import { logger } from '@/src/logger';
import axios from 'axios';

interface ParsedUri {
  baseUrl: string;
  baseApiPath: string;
  keyspaceName: string;
  applicationToken: string;
  logLevel: string;
}

const types = ['String', 'Number', 'Boolean', 'ObjectId'];

export const formatQuery = (query: any, options?: any) => {
  const modified = _.mapValues(query, (value: any) => {
    if (options?.collation) {
      throw new Error('Collations are not supported');
    }
    if (value == null) {
      return value;
    }
    if (types.includes(value.constructor.name)) {
      return { $eq: value };
    }
    return value;
  });
  return modified;
};

/**
 * Parse an Astra connection URI
 * @param uri a uri in the format of: https://${databaseId}-${region}.apps.astra.datastax.com/${keyspace}?applicationToken=${applicationToken}
 * @returns ParsedUri
 */
export const parseUri = (uri: string): ParsedUri => {
  const parsedUrl = url.parse(uri, true);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const keyspaceName = parsedUrl.pathname?.replace('/', '');
  const applicationToken = parsedUrl.query?.applicationToken as string;
  const baseApiPath = parsedUrl.query?.baseApiPath as string;
  const logLevel = parsedUrl.query?.logLevel as string;
  if (!keyspaceName) {
    throw new Error('Invalid URI: keyspace is required');
  }
  if (!applicationToken) {
    throw new Error('Invalid URI: applicationToken is required');
  }
  return {
    baseUrl,
    baseApiPath: baseApiPath ?? '/api/rest/v2/namespaces',
    keyspaceName,
    applicationToken,
    logLevel
  };
};

/**
 * Create a production Astra connection URI
 * @param databaseId the database id of the Astra database
 * @param region the region of the Astra database
 * @param keyspace the keyspace to connect to
 * @param applicationToken an Astra application token
 * @param logLevel an winston log level
 * @returns string
 */
export const createAstraUri = (
  databaseId: string,
  region: string,
  keyspace?: string,
  applicationToken?: string,
  logLevel?: string
) => {
  let uri = new url.URL(`https://${databaseId}-${region}.apps.astra.datastax.com`);
  if (keyspace) {
    uri.pathname = `/${keyspace}`;
  }
  if (applicationToken) {
    uri.searchParams.append('applicationToken', applicationToken);
  }
  if (logLevel) {
    uri.searchParams.append('logLevel', logLevel);
  }
  return uri.toString();
};

/**
 * Create a stargate  connection URI
 * @param baseUrl
 * @param baseAuthUrl
 * @param keyspace
 * @param username
 * @param password
 * @param logLevel
 * @returns string
 */
export const createStargateUri = async (
  baseUrl: string,
  baseAuthUrl: string,
  keyspace: string,
  username: string,
  password: string,
  logLevel?: string
) => {
  let uri = new url.URL(baseUrl);
  uri.pathname = `/${keyspace}`;
  uri.searchParams.append('baseApiPath', '/v2/namespaces');
  if (logLevel) {
    uri.searchParams.append('logLevel', logLevel);
  }
  const accessToken = await getStargateAccessToken(baseAuthUrl, username, password);
  uri.searchParams.append('applicationToken', accessToken);
  return uri.toString();
};

/**
 *
 * @param authUrl
 * @param username
 * @param password
 */
export const getStargateAccessToken = async (
  authUrl: string,
  username: string,
  password: string
) => {
  try {
    const response = await axios({
      url: authUrl,
      data: { username, password },
      method: 'POST',
      headers: {
        Accepts: 'application/json',
        'Content-Type': 'application/json'
      }
    });
    return response.data.authToken;
  } catch (e: any) {
    if (e.response?.data?.description) {
      e.message = e.response?.data?.description;
    }
    throw e;
  }
};

/**
 *
 * @param doc
 * @returns Object
 */
export const addDefaultId = (doc: any) => {
  if (!doc._id) {
    doc._id = new ObjectId().toHexString();
  }
  return doc;
};

/**
 *
 * @param options
 * @param cb
 * @returns Object
 */
export const setOptionsAndCb = (options: any, cb: any) => {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  return { options, cb };
};

/**
 * executeOperation handles running functions that have a callback parameter and that also can
 * return a promise.
 * @param operation a function that takes no parameters and returns a response
 * @param cb a node callback function
 * @returns Promise
 */
export const executeOperation = async (operation: any, cb: any) => {
  let res = {};
  let err = undefined;
  try {
    res = await operation();
  } catch (e: any) {
    logger.error(e.message);
    err = e;
  }
  if (cb) {
    return cb(err, res);
  }
  if (err) {
    throw err;
  }
  return res;
};
