/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiCommentList } from '@elastic/eui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { waitForEuiPopoverOpen } from '@elastic/eui/lib/test/rtl';

import { Actions } from '../../../../common/api';
import {
  alertComment,
  basicCase,
  externalReferenceAttachment,
  getAlertUserAction,
  getExternalReferenceAttachment,
  getExternalReferenceUserAction,
  getHostIsolationUserAction,
  getPersistableStateAttachment,
  getPersistableStateUserAction,
  getUserAction,
  hostIsolationComment,
  persistableStateAttachment,
} from '../../../containers/mock';
import type { AppMockRenderer } from '../../../common/mock';
import { createAppMockRenderer, TestProviders } from '../../../common/mock';
import { createCommentUserActionBuilder } from './comment';
import { getMockBuilderArgs } from '../mock';
import { useCaseViewParams } from '../../../common/navigation';
import { ExternalReferenceAttachmentTypeRegistry } from '../../../client/attachment_framework/external_reference_registry';
import { PersistableStateAttachmentTypeRegistry } from '../../../client/attachment_framework/persistable_state_registry';
import { userProfiles } from '../../../containers/user_profiles/api.mock';

jest.mock('../../../common/lib/kibana');
jest.mock('../../../common/navigation/hooks');

const useCaseViewParamsMock = useCaseViewParams as jest.Mock;

describe('createCommentUserActionBuilder', () => {
  const builderArgs = getMockBuilderArgs();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when editing a comment', async () => {
    const userAction = getUserAction('comment', Actions.update);
    const builder = createCommentUserActionBuilder({
      ...builderArgs,
      userAction,
    });

    const createdUserAction = builder.build();
    render(
      <TestProviders>
        <EuiCommentList comments={createdUserAction} />
      </TestProviders>
    );

    expect(screen.getByText('edited comment')).toBeInTheDocument();
  });

  it('renders correctly when deleting a comment', async () => {
    const userAction = getUserAction('comment', Actions.delete);
    const builder = createCommentUserActionBuilder({
      ...builderArgs,
      userAction,
    });

    const createdUserAction = builder.build();
    render(
      <TestProviders>
        <EuiCommentList comments={createdUserAction} />
      </TestProviders>
    );

    expect(screen.getByText('removed comment')).toBeInTheDocument();
  });

  it('renders correctly a user comment', async () => {
    const userAction = getUserAction('comment', Actions.create, {
      commentId: basicCase.comments[0].id,
    });

    const builder = createCommentUserActionBuilder({
      ...builderArgs,
      userAction,
    });

    const createdUserAction = builder.build();
    render(
      <TestProviders>
        <EuiCommentList comments={createdUserAction} />
      </TestProviders>
    );

    expect(screen.getByText('Solve this fast!')).toBeInTheDocument();
  });

  describe('Single alert', () => {
    it('renders correctly a single alert', async () => {
      const userAction = getAlertUserAction();

      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        caseData: {
          ...builderArgs.caseData,
          comments: [alertComment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      render(
        <TestProviders>
          <EuiCommentList comments={createdUserAction} />
        </TestProviders>
      );

      expect(screen.getByTestId('single-alert-user-action-alert-action-id')).toHaveTextContent(
        'added an alert from Awesome rule'
      );
    });
  });

  describe('Multiple alerts', () => {
    it('renders correctly multiple alerts with a link to the alerts table', async () => {
      useCaseViewParamsMock.mockReturnValue({ detailName: '1234' });
      const userAction = getAlertUserAction();

      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        caseData: {
          ...builderArgs.caseData,
          comments: [
            {
              ...alertComment,
              alertId: ['alert-id-1', 'alert-id-2'],
              index: ['alert-index-1', 'alert-index-2'],
            },
          ],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      render(
        <TestProviders>
          <EuiCommentList comments={createdUserAction} />
        </TestProviders>
      );

      expect(screen.getByTestId('multiple-alerts-user-action-alert-action-id')).toHaveTextContent(
        'added 2 alerts from Awesome rule'
      );
      expect(screen.getByTestId('comment-action-show-alerts-1234'));
    });
  });

  it('renders correctly an action', async () => {
    const userAction = getHostIsolationUserAction();

    const builder = createCommentUserActionBuilder({
      ...builderArgs,
      caseData: {
        ...builderArgs.caseData,
        comments: [hostIsolationComment()],
      },
      userAction,
    });

    const createdUserAction = builder.build();
    render(
      <TestProviders>
        <EuiCommentList comments={createdUserAction} />
      </TestProviders>
    );

    expect(screen.getByText('submitted isolate request on host')).toBeInTheDocument();
    expect(screen.getByText('host1')).toBeInTheDocument();
    expect(screen.getByText('I just isolated the host!')).toBeInTheDocument();
  });

  describe('External references', () => {
    let appMockRender: AppMockRenderer;

    beforeEach(() => {
      appMockRender = createAppMockRenderer();
    });

    it('renders correctly an external reference', async () => {
      const externalReferenceAttachmentTypeRegistry = new ExternalReferenceAttachmentTypeRegistry();
      externalReferenceAttachmentTypeRegistry.register(getExternalReferenceAttachment());

      const userAction = getExternalReferenceUserAction();
      const damagedRaccoon = userProfiles[0];
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        externalReferenceAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [
            {
              ...externalReferenceAttachment,
              createdBy: {
                username: damagedRaccoon.user.username,
                fullName: damagedRaccoon.user.full_name,
                email: damagedRaccoon.user.email,
              },
            },
          ],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-externalReference-.test')).toBeInTheDocument();
      expect(result.getByTestId('copy-link-external-reference-comment-id')).toBeInTheDocument();
      expect(result.getByTestId('case-user-profile-avatar-damaged_raccoon')).toBeInTheDocument();
      expect(screen.getByText('added a chart')).toBeInTheDocument();
    });

    it('renders correctly if the reference is not registered', async () => {
      const externalReferenceAttachmentTypeRegistry = new ExternalReferenceAttachmentTypeRegistry();

      const userAction = getExternalReferenceUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        externalReferenceAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [externalReferenceAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-externalReference-not-found')).toBeInTheDocument();
      expect(screen.getByText('added an attachment of type')).toBeInTheDocument();
      expect(screen.getByText('Attachment type is not registered')).toBeInTheDocument();
    });

    it('renders correctly an external reference with actions', async () => {
      const ActionsView = () => {
        return <>{'Attachment actions'}</>;
      };

      const attachment = getExternalReferenceAttachment({
        actions: <ActionsView />,
      });

      const externalReferenceAttachmentTypeRegistry = new ExternalReferenceAttachmentTypeRegistry();
      externalReferenceAttachmentTypeRegistry.register(attachment);

      const userAction = getExternalReferenceUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        externalReferenceAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [externalReferenceAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-externalReference-.test')).toBeInTheDocument();
      expect(screen.getByText('Attachment actions')).toBeInTheDocument();
    });

    it('deletes the attachment correctly', async () => {
      const externalReferenceAttachmentTypeRegistry = new ExternalReferenceAttachmentTypeRegistry();
      externalReferenceAttachmentTypeRegistry.register(getExternalReferenceAttachment());

      const userAction = getExternalReferenceUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        externalReferenceAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [externalReferenceAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-externalReference-.test')).toBeInTheDocument();
      expect(result.getByTestId('property-actions')).toBeInTheDocument();

      userEvent.click(result.getByTestId('property-actions-ellipses'));
      await waitForEuiPopoverOpen();

      expect(result.queryByTestId('property-actions-trash')).toBeInTheDocument();

      userEvent.click(result.getByTestId('property-actions-trash'));

      await waitFor(() => {
        expect(result.queryByTestId('property-actions-confirm-modal')).toBeInTheDocument();
      });

      userEvent.click(result.getByText('Delete'));

      await waitFor(() => {
        expect(builderArgs.handleDeleteComment).toHaveBeenCalledWith(
          'external-reference-comment-id'
        );
      });
    });
  });

  describe('Persistable state', () => {
    let appMockRender: AppMockRenderer;

    beforeEach(() => {
      appMockRender = createAppMockRenderer();
    });

    it('renders correctly a persistable state attachment', async () => {
      const MockComponent = jest.fn((props) => {
        return (
          <div data-test-subj={`attachment_${props.persistableStateAttachmentState.test_foo}`} />
        );
      });

      const SpyLazyFactory = jest.fn(() => {
        return Promise.resolve().then(() => {
          return {
            default: React.memo(MockComponent),
          };
        });
      });

      const persistableStateAttachmentTypeRegistry = new PersistableStateAttachmentTypeRegistry();
      persistableStateAttachmentTypeRegistry.register(
        getPersistableStateAttachment({
          children: React.lazy(SpyLazyFactory),
        })
      );

      const userAction = getPersistableStateUserAction();
      const attachment01 = {
        ...persistableStateAttachment,
        persistableStateAttachmentState: { test_foo: '01' },
        createdBy: {
          username: userProfiles[0].user.username,
          fullName: userProfiles[0].user.full_name,
          email: userProfiles[0].user.email,
          profileUid: userProfiles[0].uid,
        },
      };
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        persistableStateAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [attachment01],
        },
        userAction,
      });

      const result = appMockRender.render(<EuiCommentList comments={builder.build()} />);

      await waitFor(() => {
        expect(result.getByTestId('attachment_01')).toBeInTheDocument();
        expect(MockComponent).toHaveBeenCalledTimes(1);
        expect(SpyLazyFactory).toHaveBeenCalledTimes(1);
      });

      expect(result.getByTestId('comment-persistableState-.test')).toBeInTheDocument();
      expect(result.getByTestId('copy-link-persistable-state-comment-id')).toBeInTheDocument();
      expect(result.getByTestId('case-user-profile-avatar-damaged_raccoon')).toBeInTheDocument();
      expect(screen.getByText('added an embeddable')).toBeInTheDocument();

      result.unmount();

      const attachment02 = {
        ...persistableStateAttachment,
        persistableStateAttachmentState: { test_foo: '02' },
      };
      const updateBuilder = createCommentUserActionBuilder({
        ...builderArgs,
        persistableStateAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [attachment02],
        },
        userAction,
      });

      const result2 = appMockRender.render(<EuiCommentList comments={updateBuilder.build()} />);

      await waitFor(() => {
        expect(result2.getByTestId('attachment_02')).toBeInTheDocument();
        expect(MockComponent).toHaveBeenCalledTimes(2);
        expect(SpyLazyFactory).toHaveBeenCalledTimes(1);
      });
    });

    it('renders correctly if the reference is not registered', async () => {
      const persistableStateAttachmentTypeRegistry = new PersistableStateAttachmentTypeRegistry();

      const userAction = getPersistableStateUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        persistableStateAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [persistableStateAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-persistableState-not-found')).toBeInTheDocument();
      expect(screen.getByText('added an attachment of type')).toBeInTheDocument();
      expect(screen.getByText('Attachment type is not registered')).toBeInTheDocument();
    });

    it('renders correctly a persistable state with actions', async () => {
      const ActionsView = () => {
        return <>{'Attachment actions'}</>;
      };

      const attachment = getPersistableStateAttachment({
        actions: <ActionsView />,
      });

      const persistableStateAttachmentTypeRegistry = new PersistableStateAttachmentTypeRegistry();
      persistableStateAttachmentTypeRegistry.register(attachment);

      const userAction = getPersistableStateUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        persistableStateAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [persistableStateAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-persistableState-.test')).toBeInTheDocument();
      expect(screen.getByText('Attachment actions')).toBeInTheDocument();
    });

    it('deletes the attachment correctly', async () => {
      const attachment = getPersistableStateAttachment();
      const persistableStateAttachmentTypeRegistry = new PersistableStateAttachmentTypeRegistry();
      persistableStateAttachmentTypeRegistry.register(attachment);

      const userAction = getPersistableStateUserAction();
      const builder = createCommentUserActionBuilder({
        ...builderArgs,
        persistableStateAttachmentTypeRegistry,
        caseData: {
          ...builderArgs.caseData,
          comments: [persistableStateAttachment],
        },
        userAction,
      });

      const createdUserAction = builder.build();
      const result = appMockRender.render(<EuiCommentList comments={createdUserAction} />);

      expect(result.getByTestId('comment-persistableState-.test')).toBeInTheDocument();
      expect(result.getByTestId('property-actions')).toBeInTheDocument();

      userEvent.click(result.getByTestId('property-actions-ellipses'));
      await waitForEuiPopoverOpen();

      expect(result.queryByTestId('property-actions-trash')).toBeInTheDocument();

      userEvent.click(result.getByTestId('property-actions-trash'));

      await waitFor(() => {
        expect(result.queryByTestId('property-actions-confirm-modal')).toBeInTheDocument();
      });

      userEvent.click(result.getByText('Delete'));

      await waitFor(() => {
        expect(builderArgs.handleDeleteComment).toHaveBeenCalledWith(
          'persistable-state-comment-id'
        );
      });
    });
  });
});
