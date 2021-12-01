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
package org.graylog2.storage.providers;

import org.graylog.plugins.views.migrations.V20200730000000_AddGl2MessageIdFieldAliasForEvents;
import org.graylog2.storage.DetectedSearchVersion;
import org.graylog2.storage.VersionAwareProvider;
import org.graylog2.storage.SearchVersion;

import javax.inject.Inject;
import javax.inject.Provider;
import java.util.Map;

public class V20200730000000_AddGl2MessageIdFieldAliasForEventsElasticsearchAdapterProvider
        extends VersionAwareProvider<V20200730000000_AddGl2MessageIdFieldAliasForEvents.ElasticsearchAdapter> {
    @Inject
    public V20200730000000_AddGl2MessageIdFieldAliasForEventsElasticsearchAdapterProvider(
            @DetectedSearchVersion SearchVersion version,
            Map<SearchVersion, Provider<V20200730000000_AddGl2MessageIdFieldAliasForEvents.ElasticsearchAdapter>> pluginBindings) {
        super(version, pluginBindings);
    }
}
