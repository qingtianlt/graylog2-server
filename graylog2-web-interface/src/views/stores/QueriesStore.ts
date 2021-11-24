/*
 * Copyright (C) 2020 Graylog, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Server Side Public License, version 1,
 * as published by MongoDB, Inc.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Server Side Public License for more details.
 *
 * You should have received a copy of the Server Side Public License
 * along with this program. If not, see
 * <http://www.mongodb.com/licensing/server-side-public-license>.
 */
import Reflux from 'reflux';
import * as Immutable from 'immutable';
import { isEqual } from 'lodash';
import moment from 'moment';

import type { Store } from 'stores/StoreTypes';
import Search from 'views/logic/search/Search';
import { QueriesActions } from 'views/actions/QueriesActions';
import type { QueryId, TimeRange, TimeRangeTypes } from 'views/logic/queries/Query';
import Query from 'views/logic/queries/Query';
import { singletonStore } from 'logic/singleton';
import fetch from 'logic/rest/FetchProvider';
import { qualifyUrl } from 'util/URLUtils';
import type Parameter from 'views/logic/parameters/Parameter';
import type { ParameterBindings } from 'views/logic/search/SearchExecutionState';

import { ViewActions, ViewStore } from './ViewStore';
import { ViewStatesActions } from './ViewStatesStore';

import type { QueriesList } from '../actions/QueriesActions';

export { QueriesActions } from 'views/actions/QueriesActions';

export type QueryValidationState = {
  status: 'OK' | 'ERROR' | 'WARNING',
  explanations: Array<{
    errorType: string,
    errorMessage: string,
    beginLine: number,
    endLine: number,
    beginColumn: number,
    endColumn: number,
  }> | undefined
}

type QueriesStoreState = Immutable.OrderedMap<QueryId, Query>;

type QueriesStoreType = Store<QueriesStoreState>;

export const QueriesStore: QueriesStoreType = singletonStore(
  'views.Queries',
  () => Reflux.createStore({
    listenables: [QueriesActions],
    queries: Immutable.OrderedMap<QueryId, Query>(),
    search: Search.create(),

    init() {
      this.listenTo(ViewStore, this.onViewStoreChange, this.onViewStoreChange);
    },

    getInitialState(): Immutable.OrderedMap<QueryId, Query> {
      return this._state();
    },

    onViewStoreChange(state) {
      const { view } = state;

      if (!view || !view.search) {
        return;
      }

      const { search } = view;

      this.search = search;

      const { queries } = search;
      const newQueries = Immutable.OrderedMap(queries.map((q) => [q.id, q]));

      if (!isEqual(newQueries, this.queries)) {
        this.queries = newQueries;

        this._trigger();
      }
    },

    duplicate(queryId: QueryId) {
      const newQuery = this.queries.get(queryId).toBuilder().newId().build();
      const promise: Promise<QueriesList> = ViewStatesActions.duplicate(queryId)
        .then((newViewState) => {
          return QueriesActions.create(newQuery, newViewState);
        });

      QueriesActions.duplicate.promise(promise);

      return promise;
    },

    remove(queryId: QueryId) {
      const newQueries = this.queries.remove(queryId);
      const promise: Promise<QueriesList> = this._propagateQueryChange(newQueries).then(() => newQueries);

      QueriesActions.remove.promise(promise);

      return promise;
    },
    update(queryId: QueryId, query: Query) {
      const newQueries = this.queries.set(queryId, query);
      const promise: Promise<QueriesList> = this.queries.get(queryId).equals(query)
        ? Promise.resolve(this.queries)
        : this._propagateQueryChange(newQueries).then(() => newQueries);

      QueriesActions.update.promise(promise);

      return promise;
    },

    query(queryId: QueryId, query: string) {
      const activeQuery: Query = this.queries.get(queryId);
      const newQuery = activeQuery.toBuilder().query({ ...activeQuery.query, query_string: query }).build();
      const newQueries = this.queries.set(queryId, newQuery);
      const promise: Promise<QueriesList> = this._propagateQueryChange(newQueries).then(() => newQueries);

      QueriesActions.query.promise(promise);

      return promise;
    },
    timerange(queryId: QueryId, timerange: TimeRange) {
      const query = this.queries.get(queryId);
      const newQueries = this.queries.update(queryId, (q) => q.toBuilder().timerange(timerange).build());
      const promise: Promise<QueriesList> = query.timerange === timerange
        ? Promise.resolve(this.queries)
        : this._propagateQueryChange(newQueries).then(() => newQueries);

      QueriesActions.timerange.promise(promise);

      return promise;
    },
    rangeParams(queryId: QueryId, key: string, value: string | number) {
      const oldQuery = this.queries.get(queryId);
      const oldTimerange = oldQuery.timerange;
      const newTimeRange = { ...oldTimerange, [key]: value };

      const promise: Promise<QueriesList> = QueriesActions.timerange(queryId, newTimeRange);

      QueriesActions.rangeParams.promise(promise);

      return promise;
    },
    rangeType(queryId: QueryId, type: TimeRangeTypes) {
      const promise = new Promise((resolve) => {
        const oldQuery = this.queries.get(queryId);
        const oldTimerange = oldQuery.timerange;
        const oldType = oldTimerange.type;

        if (type === oldType) {
          resolve(this.queries);

          return;
        }

        let newTimeRange: TimeRange;

        // eslint-disable-next-line default-case
        switch (type) {
          case 'absolute':
            newTimeRange = {
              type,
              from: moment().subtract(oldTimerange.from ?? oldTimerange.range, 'seconds').toISOString(),
              to: moment().subtract(oldTimerange.to, 'seconds').toISOString(),
            };

            break;
          case 'relative':
            newTimeRange = {
              type,
              from: 300,
            };

            break;
          case 'keyword':
            newTimeRange = {
              type,
              keyword: 'Last five Minutes',
            };

            break;
          default: throw new Error(`Invalid time range type: ${type}`);
        }

        resolve(QueriesActions.timerange(queryId, newTimeRange));
      }) as Promise<QueriesList>;

      QueriesActions.rangeType.promise(promise);

      return promise;
    },

    validateQuery({
      queryString,
      timeRange,
      streams,
      filter,
      parameters,
      parameterBindings,
    }: {
      queryString: string,
      timeRange: TimeRange | undefined,
      streams?: Array<string> | undefined,
      filter?: string,
      parameters?: Array<Parameter>,
      parameterBindings?: ParameterBindings,
    }): Promise<QueryValidationState | undefined> {
      const payload = {
        query: queryString,
        timerange: timeRange,
        streams,
        filter,
        parameters,
        parameter_bindings: parameterBindings,
      };
      const promise = fetch('POST', qualifyUrl('/search/validate'), payload).then((result) => {
        if (result) {
          return ({
            status: result.status,
            explanations: result.explanations?.map(({
              error_type: errorType,
              error_message: errorMessage,
              begin_line: beginLine,
              end_line: endLine,
              begin_column: beginColumn,
              end_column: endColumn,
            }) => ({
              errorMessage,
              errorType,
              beginLine,
              endLine,
              beginColumn,
              endColumn,
            })),
          });
        }

        return undefined;
      });

      QueriesActions.validateQuery.promise(promise);

      return promise;
    },

    _propagateQueryChange(newQueries: QueriesList) {
      const newSearch = this.search.toBuilder()
        .queries(newQueries.valueSeq().toList())
        .build();

      return ViewActions.search(newSearch);
    },

    _state() {
      return this.queries;
    },

    _trigger() {
      this.trigger(this._state());
    },
  }),
);
