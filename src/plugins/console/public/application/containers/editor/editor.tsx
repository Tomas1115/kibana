/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, memo, useEffect, useMemo, useState } from 'react';
import { debounce } from 'lodash';
import { EuiProgress } from '@elastic/eui';

import { IndexPatternListItem } from 'src/plugins/data/common';
import { EditorContentSpinner } from '../../components';
import { Panel, PanelsContainer } from '../../../../../kibana_react/public';
import { Editor as EditorUI, EditorOutput } from './legacy/console_editor';
import { StorageKeys } from '../../../services';
import { useEditorReadContext, useServicesContext, useRequestReadContext } from '../../contexts';
import { EDITOR_DEFAULT_INPUT_VALUE } from './legacy/console_editor/editor';

const INITIAL_PANEL_WIDTH = 50;
const PANEL_MIN_WIDTH = '100px';

interface Props {
  loading: boolean;
}

const getDefaultValueWithIndexName = (IndexName: string) => `GET ${
  IndexName ? `${IndexName}/` : ''
}_search
{
  "query": {
    "match_all": {}
  }
}`;

export const Editor = memo(({ loading }: Props) => {
  const {
    services: { storage, data },
  } = useServicesContext();

  const { currentTextObject } = useEditorReadContext();
  const { requestInFlight } = useRequestReadContext();

  // @ts-ignore
  const [indexPatterns, setIndexPatterns] = useState<IndexPatternListItem[]>(null);

  useEffect(() => {
    (async () => {
      if (!data.indexPatterns) return;

      try {
        setIndexPatterns(await data.indexPatterns.getIdsWithTitle(true));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('get index patterns fail', err);
        setIndexPatterns([]);
      }
    })();
  }, [data.indexPatterns]);

  const [firstPanelWidth, secondPanelWidth] = storage.get(StorageKeys.WIDTH, [
    INITIAL_PANEL_WIDTH,
    INITIAL_PANEL_WIDTH,
  ]);

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const onPanelWidthChange = useCallback(
    debounce((widths: number[]) => {
      storage.set(StorageKeys.WIDTH, widths);
    }, 300),
    []
  );

  const initTextValue = useMemo<string>(() => {
    if (!indexPatterns || !currentTextObject) return '';

    if (!currentTextObject.text || currentTextObject.text === EDITOR_DEFAULT_INPUT_VALUE) {
      return getDefaultValueWithIndexName(indexPatterns[0]?.id);
    }

    return currentTextObject.text;
  }, [currentTextObject, indexPatterns]);

  if (!currentTextObject) return null;

  return (
    <>
      {requestInFlight ? (
        <div className="conApp__requestProgressBarContainer">
          <EuiProgress size="xs" color="accent" position="absolute" />
        </div>
      ) : null}
      <PanelsContainer onPanelWidthChange={onPanelWidthChange} resizerClassName="conApp__resizer">
        <Panel
          style={{ height: '100%', position: 'relative', minWidth: PANEL_MIN_WIDTH }}
          initialWidth={firstPanelWidth}
        >
          {loading || !initTextValue ? (
            <EditorContentSpinner />
          ) : (
            <EditorUI initialTextValue={initTextValue} />
          )}
        </Panel>
        <Panel
          style={{ height: '100%', position: 'relative', minWidth: PANEL_MIN_WIDTH }}
          initialWidth={secondPanelWidth}
        >
          {loading ? <EditorContentSpinner /> : <EditorOutput />}
        </Panel>
      </PanelsContainer>
    </>
  );
});
