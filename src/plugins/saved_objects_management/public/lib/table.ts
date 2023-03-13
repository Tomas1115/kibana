/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export function simplifyFun(title: string){
  const reg=/-[A-z0-9]{8}$/
  if (typeof title === 'string'&&reg.test(title)) {
    return title.slice(0, -9);
  }
  return title;
};