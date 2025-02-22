/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createAPMTransactionErrorRateIndicator, createSLO } from '../fixtures/slo';
import { ApmTransactionErrorRateTransformGenerator } from './apm_transaction_error_rate';

const generator = new ApmTransactionErrorRateTransformGenerator();

describe('APM Transaction Error Rate Transform Generator', () => {
  it('returns the correct transform params with every specified indicator params', async () => {
    const anSLO = createSLO(createAPMTransactionErrorRateIndicator());
    const transform = generator.getTransformParams(anSLO);

    expect(transform).toMatchSnapshot({
      transform_id: expect.any(String),
      source: { runtime_mappings: { 'slo.id': { script: { source: expect.any(String) } } } },
    });
    expect(transform.transform_id).toEqual(`slo-${anSLO.id}-${anSLO.revision}`);
    expect(transform.source.runtime_mappings!['slo.id']).toMatchObject({
      script: { source: `emit('${anSLO.id}')` },
    });
    expect(transform.source.runtime_mappings!['slo.revision']).toMatchObject({
      script: { source: `emit(${anSLO.revision})` },
    });
  });

  it("uses default values when 'good_status_codes' is not specified", async () => {
    const anSLO = createSLO(createAPMTransactionErrorRateIndicator({ good_status_codes: [] }));
    const transform = generator.getTransformParams(anSLO);

    expect(transform.pivot?.aggregations).toMatchSnapshot();
  });

  it("does not include the query filter when params are '*'", async () => {
    const anSLO = createSLO(
      createAPMTransactionErrorRateIndicator({
        environment: '*',
        service: '*',
        transaction_name: '*',
        transaction_type: '*',
      })
    );
    const transform = generator.getTransformParams(anSLO);

    expect(transform.source.query).toMatchSnapshot();
  });
});
