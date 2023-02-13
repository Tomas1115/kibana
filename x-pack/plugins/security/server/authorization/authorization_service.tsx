/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import querystring from 'querystring';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Observable, Subscription } from 'rxjs';

import type {
  CapabilitiesSetup,
  HttpServiceSetup,
  IClusterClient,
  KibanaRequest,
  Logger,
  LoggerFactory,
} from 'src/core/server';
import type { Capabilities as UICapabilities } from 'src/core/types';

import type {
  PluginSetupContract as FeaturesPluginSetup,
  PluginStartContract as FeaturesPluginStart,
} from '../../../features/server';
import { APPLICATION_PREFIX, LOGOUT_REASON_QUERY_STRING_PARAMETER } from '../../common/constants';
import type { SecurityLicense } from '../../common/licensing';
import type { AuthenticatedUser } from '../../common/model';
import { canRedirectRequest } from '../authentication';
import type { OnlineStatusRetryScheduler } from '../elasticsearch';
import type { SpacesService } from '../plugin';
import { Actions } from './actions';
import { initAPIAuthorization } from './api_authorization';
import { initAppAuthorization } from './app_authorization';
import { checkPrivilegesWithRequestFactory } from './check_privileges';
import type { CheckPrivilegesDynamicallyWithRequest } from './check_privileges_dynamically';
import { checkPrivilegesDynamicallyWithRequestFactory } from './check_privileges_dynamically';
import type { CheckSavedObjectsPrivilegesWithRequest } from './check_saved_objects_privileges';
import { checkSavedObjectsPrivilegesWithRequestFactory } from './check_saved_objects_privileges';
import { disableUICapabilitiesFactory } from './disable_ui_capabilities';
import type { AuthorizationMode } from './mode';
import { authorizationModeFactory } from './mode';
import { Nginx403Page } from './nginx_403_page';
import type { PrivilegesService } from './privileges';
import { privilegesFactory } from './privileges';
import { registerPrivilegesWithCluster } from './register_privileges_with_cluster';
import { ResetSessionPage } from './reset_session_page';
import type { CheckPrivilegesWithRequest } from './types';
import { validateFeaturePrivileges } from './validate_feature_privileges';
import { validateReservedPrivileges } from './validate_reserved_privileges';

export { Actions } from './actions';
export { CheckSavedObjectsPrivileges } from './check_saved_objects_privileges';

interface AuthorizationServiceSetupParams {
  packageVersion: string;
  buildNumber: number;
  http: HttpServiceSetup;
  capabilities: CapabilitiesSetup;
  getClusterClient: () => Promise<IClusterClient>;
  license: SecurityLicense;
  loggers: LoggerFactory;
  features: FeaturesPluginSetup;
  kibanaIndexName: string;
  getSpacesService(): SpacesService | undefined;
  getCurrentUser(request: KibanaRequest): AuthenticatedUser | null;
}

interface AuthorizationServiceStartParams {
  features: FeaturesPluginStart;
  clusterClient: IClusterClient;
  online$: Observable<OnlineStatusRetryScheduler>;
}

export interface AuthorizationServiceSetupInternal extends AuthorizationServiceSetup {
  actions: Actions;
  checkPrivilegesWithRequest: CheckPrivilegesWithRequest;
  checkPrivilegesDynamicallyWithRequest: CheckPrivilegesDynamicallyWithRequest;
  checkSavedObjectsPrivilegesWithRequest: CheckSavedObjectsPrivilegesWithRequest;
  applicationName: string;
  mode: AuthorizationMode;
  privileges: PrivilegesService;
}

/**
 * Authorization services available on the setup contract of the security plugin.
 */
export interface AuthorizationServiceSetup {
  /**
   * Actions are used to create the "actions" that are associated with Elasticsearch's
   * application privileges, and are used to perform the authorization checks implemented
   * by the various `checkPrivilegesWithRequest` derivatives.
   */
  actions: Actions;
  checkPrivilegesWithRequest: CheckPrivilegesWithRequest;
  checkPrivilegesDynamicallyWithRequest: CheckPrivilegesDynamicallyWithRequest;
  checkSavedObjectsPrivilegesWithRequest: CheckSavedObjectsPrivilegesWithRequest;
  mode: AuthorizationMode;
}

export class AuthorizationService {
  private logger!: Logger;
  private applicationName!: string;
  private privileges!: PrivilegesService;

  private statusSubscription?: Subscription;

  setup({
    http,
    capabilities,
    packageVersion,
    buildNumber,
    getClusterClient,
    license,
    loggers,
    features,
    kibanaIndexName,
    getSpacesService,
    getCurrentUser,
  }: AuthorizationServiceSetupParams): AuthorizationServiceSetupInternal {
    this.logger = loggers.get('authorization');
    this.applicationName = `${APPLICATION_PREFIX}${kibanaIndexName}`;

    const mode = authorizationModeFactory(license);
    const actions = new Actions(packageVersion);
    this.privileges = privilegesFactory(actions, features, license);

    const checkPrivilegesWithRequest = checkPrivilegesWithRequestFactory(
      actions,
      getClusterClient,
      this.applicationName
    );

    const authz = {
      actions,
      applicationName: this.applicationName,
      mode,
      privileges: this.privileges,
      checkPrivilegesWithRequest,
      checkPrivilegesDynamicallyWithRequest: checkPrivilegesDynamicallyWithRequestFactory(
        checkPrivilegesWithRequest,
        getSpacesService
      ),
      checkSavedObjectsPrivilegesWithRequest: checkSavedObjectsPrivilegesWithRequestFactory(
        checkPrivilegesWithRequest,
        getSpacesService
      ),
    };

    capabilities.registerSwitcher(
      async (request: KibanaRequest, uiCapabilities: UICapabilities) => {
        // If we have a license which doesn't enable security, or we're a legacy user we shouldn't
        // disable any ui capabilities
        if (!mode.useRbacForRequest(request)) {
          return uiCapabilities;
        }

        const disableUICapabilities = disableUICapabilitiesFactory(
          request,
          features.getKibanaFeatures(),
          features.getElasticsearchFeatures(),
          this.logger,
          authz,
          getCurrentUser(request)
        );

        if (!request.auth.isAuthenticated) {
          return disableUICapabilities.all(uiCapabilities);
        }

        return await disableUICapabilities.usingPrivileges(uiCapabilities);
      }
    );

    initAPIAuthorization(http, authz, loggers.get('api-authorization'));
    initAppAuthorization(http, authz, loggers.get('app-authorization'), features);

    http.registerOnPreResponse((request, preResponse, toolkit) => {
      if (canRedirectRequest(request)) {
        switch (preResponse.statusCode) {
          case 403: {
            const next = `${http.basePath.get(request)}${request.url.pathname}${
              request.url.search
            }`;
            const body = renderToStaticMarkup(
              <ResetSessionPage
                buildNumber={buildNumber}
                basePath={http.basePath}
                logoutUrl={http.basePath.prepend(
                  `/api/security/logout?${querystring.stringify({ next })}`
                )}
              />
            );

            return toolkit.render({
              body,
              headers: { 'Content-Security-Policy': http.csp.header },
            });
          }
          case 499: {
            try {
              this.logger.debug(`[ACCESS_CONTROL] intercept by on pre response`);
              const body = renderToStaticMarkup(<Nginx403Page />);

              return toolkit.render({
                body,
              });
            } catch (err) {
              this.logger.debug(`[ACCESS_CONTROL] render nginx 403 page fail, ${err}`);
            }
          }
        }
      }

      return toolkit.next();
    });

    const shouldPreCheck = (request: KibanaRequest) => {
      return (
        !/.(css|js|svg|png|jpg|jpeg|woff2|map|json)$/.test(request?.url?.pathname) &&
        canRedirectRequest(request)
      );
    };

    http.registerOnPreAuth(async (request, response, toolkit) => {
      try {
        if (shouldPreCheck(request)) {
          this.logger.debug(`[ACCESS_CONTROL]on pre auth check for url: ${request?.url?.pathname}`);

          const clusterClient = await getClusterClient();
          // 仅拦截白名单，实际该生命周期并无登录态
          await clusterClient.asScoped(request).asCurrentUser.transport.request({
            method: 'GET',
            path: '/',
          });
        }
      } catch (err: any) {
        if (err?.statusCode === 403) {
          this.logger.debug(`[ACCESS_CONTROL] response 499`);

          return response.customError({
            statusCode: 499,
            body: err?.meta?.body || 'Forbidden',
          });
        }
      }

      return toolkit.next();
    });

    http.registerOnPostAuth(async (request, response, toolkit) => {
      try {
        if (request.auth?.isAuthenticated && shouldPreCheck(request)) {
          this.logger.debug(
            `[ACCESS_CONTROL]on post auth check for url: ${request?.url?.pathname}`
          );

          const clusterClient = await getClusterClient();
          await clusterClient.asScoped(request).asCurrentUser.transport.request({
            method: 'GET',
            path: '/',
          });
          this.logger.debug('[ACCESS_CONTROL]on post auth check done');
        }
      } catch (err: any) {
        // 欠费状态码
        if (err?.statusCode === 438) {
          this.logger.debug(`[ACCESS_CONTROL]on post auth check response 438`);
          return response.redirected({
            headers: {
              location: `${http.basePath.serverBasePath}/logout?${LOGOUT_REASON_QUERY_STRING_PARAMETER}=OUT_OF_CREDIT`,
            },
          });
        }
      }

      return toolkit.next();
    });

    return authz;
  }

  start({ clusterClient, features, online$ }: AuthorizationServiceStartParams) {
    const allFeatures = features.getKibanaFeatures();
    validateFeaturePrivileges(allFeatures);
    validateReservedPrivileges(allFeatures);

    this.statusSubscription = online$.subscribe(async ({ scheduleRetry }) => {
      try {
        await registerPrivilegesWithCluster(
          this.logger,
          this.privileges,
          this.applicationName,
          clusterClient
        );
      } catch (err) {
        scheduleRetry();
      }
    });
  }

  stop() {
    if (this.statusSubscription !== undefined) {
      this.statusSubscription.unsubscribe();
      this.statusSubscription = undefined;
    }
  }
}
