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
package org.graylog.plugins.views.search.elasticsearch.parser;

import org.graylog.plugins.views.search.engine.LuceneQueryParsingException;
import org.graylog.shaded.elasticsearch7.org.apache.lucene.queryparser.classic.ParseException;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class LuceneQueryParserTest {

    private final LuceneQueryParserES7 parser = new LuceneQueryParserES7();

    @Test
    void getFieldNamesSimple() throws LuceneQueryParsingException {
        final Set<String> fields = parser.getFieldNames("foo:bar AND lorem:ipsum");
        assertThat(fields).contains("foo", "lorem");
    }

    @Test
    void getFieldNamesExist() throws LuceneQueryParsingException {
        final Set<String> fields = parser.getFieldNames("foo:bar AND _exists_:lorem");
        assertThat(fields).contains("foo", "lorem");
    }

    @Test
    void getFieldNamesComplex() throws LuceneQueryParsingException {
        final Set<String> fields = parser.getFieldNames("type :( ssh OR login )");
        assertThat(fields).contains("type");
    }

    @Test
    void getFieldNamesNot() throws LuceneQueryParsingException {
        final Set<String> fields = parser.getFieldNames("NOT _exists_ : type");
        assertThat(fields).contains("type");
    }
}
