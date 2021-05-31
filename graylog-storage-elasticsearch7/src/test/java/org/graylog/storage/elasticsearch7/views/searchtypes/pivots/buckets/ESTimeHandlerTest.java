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
package org.graylog.storage.elasticsearch7.views.searchtypes.pivots.buckets;

import org.graylog.plugins.views.search.Query;
import org.graylog.plugins.views.search.searchtypes.pivot.Pivot;
import org.graylog.plugins.views.search.searchtypes.pivot.buckets.Time;
import org.graylog.storage.elasticsearch7.views.ESGeneratedQueryContext;
import org.graylog.storage.elasticsearch7.views.searchtypes.pivot.ESPivot;
import org.graylog.storage.elasticsearch7.views.searchtypes.pivot.buckets.ESTimeHandler;
import org.graylog2.plugin.indexer.searches.timeranges.InvalidRangeParametersException;
import org.graylog2.plugin.indexer.searches.timeranges.RelativeRange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ESTimeHandlerTest {
    private ESTimeHandler esTimeHandler;

    private final Pivot pivot = mock(Pivot.class);

    private final Time time = mock(Time.class);

    private final ESPivot esPivot = mock(ESPivot.class);

    private final ESGeneratedQueryContext queryContext = mock(ESGeneratedQueryContext.class, RETURNS_DEEP_STUBS);

    private final Query query = mock(Query.class);

    @BeforeEach
    public void setUp() throws Exception {
        this.esTimeHandler = new ESTimeHandler();
        when(time.buckets()).thenReturn(Time.DEFAULT_BUCKET_SIZE);
        when(time.field()).thenReturn("foobar");
        final ESPivot.AggTypes aggTypes = mock(ESPivot.AggTypes.class);
        when(queryContext.contextMap().get(any())).thenReturn(aggTypes);
        when(query.effectiveTimeRange(any())).thenCallRealMethod();
    }

    @ParameterizedTest
    @ValueSource(strings = { "1s", "1M", "4s", "14d" })
    public void correctIntervalTypeIsUsedForAggregation(String intervalString) throws InvalidRangeParametersException {
        when(pivot.timerange()).thenReturn(Optional.empty());
        when(query.timerange()).thenReturn(RelativeRange.create(2323));

        this.esTimeHandler.doCreateAggregation("foobar", pivot, time, esPivot, queryContext, query);
    }
}
