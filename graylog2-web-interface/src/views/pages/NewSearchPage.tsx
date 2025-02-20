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
import * as React from 'react';

import withLocation from 'routing/withLocation';
import type { Location } from 'routing/withLocation';
import { Spinner } from 'components/common';
import useLoadView from 'views/logic/views/UseLoadView';
import useCreateSavedSearch from 'views/logic/views/UseCreateSavedSearch';
import normalizeSearchURLQueryParams, { RawQuery } from 'views/logic/NormalizeSearchURLQueryParams';

import SearchPage from './SearchPage';

type Props = {
  location: Location<RawQuery>,
};

const NewSearchPage = ({ location: { query } }: Props) => {
  const { timeRange, queryString } = normalizeSearchURLQueryParams(query);
  const view = useCreateSavedSearch(undefined, timeRange, queryString);
  const [loaded, HookComponent] = useLoadView(view, query);

  if (HookComponent) {
    return HookComponent;
  }

  if (!loaded) {
    return <Spinner />;
  }

  return <SearchPage />;
};

NewSearchPage.propTypes = {};

export default withLocation(NewSearchPage);
