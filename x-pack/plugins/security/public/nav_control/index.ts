/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export { SecurityNavControlService, SecurityNavControlServiceStart } from './nav_control_service';
export type { UserMenuLink } from './nav_control_component';
export function simplifyFun(title: string){
    if (typeof title === 'string') {
      return title.slice(0, -9);
    }
    return title;
  };