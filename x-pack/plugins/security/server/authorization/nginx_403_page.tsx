/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// @ts-expect-error no definitions in component folder
import { EuiButton, EuiButtonEmpty } from '@elastic/eui/lib/components/button';
import React from 'react';

import { i18n } from '@kbn/i18n';

export function Nginx403Page() {
  return (
    <html lang={i18n.getLocale()}>
      <head>
        <title>Elastic</title>
        <link
          href="https://main.qcloudimg.com/raw/ff8942490f97da1b225b0a97b3eea29f.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="m-nf m-nf1 show">
          <div className="g-wrap">
            <img
              src="https://main.qcloudimg.com/raw/3ec07493f99a4110e57a305b65245bae.png"
              alt="403"
            />
          </div>
        </div>
      </body>
    </html>
  );
}
